/**
 * This service provides access to the `RainViewer <https://www.rainviewer.com/api.html>`__ aggregated database.
 * RainViewer provides access to recent and forecasted weather radar maps all around the world.
 *
 * @service
 * @category Climate
 * @category GeoData
 */

const logger = require("../utils/logger")("rain-viewer");
const GoogleMaps = require("../google-maps/google-maps");
const ApiConsumer = require("../utils/api-consumer");
const jimp = require("jimp");
const _ = require("lodash");
const SphericalMercator = require("sphericalmercator");
const merc256 = new SphericalMercator({ size: 256 });
const merc512 = new SphericalMercator({ size: 512 });

const { defineTypes, TIME_OFFSETS, COLOR_SCHEMES } = require("./types");
const { COLOR_MAPPER, getNearestMapping } = require("./utils");
defineTypes();

const DEFAULT_OPTS = {
  smooth: true,
  showSnow: false,
  colorScheme: 4,
};

const RainViewer = new ApiConsumer("RainViewer", "", {
  cache: { ttl: 5 * 60 },
}); // radar data updates every 10 minutes (or so)

/**
 * Get the list of valid radar time offsets for the :func:`RainViewer.getOverlay` RPC.
 * The returned time offsets are in chronological order.
 *
 * @returns {Array<TimeOffset>} The list of valid time offsets in chronological order.
 */
RainViewer.getTimeOffsets = function () {
  return Object.keys(TIME_OFFSETS);
};

/**
 * Get the list of valid color schemes for the :func:`RainViewer.getOverlay` RPC.
 *
 * @returns {Array<ColorScheme>} The list of valid color schemes.
 */
RainViewer.getColorSchemes = function () {
  return Object.keys(COLOR_SCHEMES);
};

/**
 * Gets a transparent overlay that can be placed directly on to of a map provided by :func:`GoogleMaps.getMap`
 * to display recent or forecasted weather radar data.
 *
 * @param {Latitude} latitude Latitude of the returned map (centered).
 * @param {Longitude} longitude Longitude of the returned map (centered).
 * @param {BoundedInteger<1>} width Width (in pixels) of the returned map.
 * @param {BoundedInteger<1>} height Height (in pixels) of the returned map.
 * @param {BoundedInteger<1,25>} zoom The zoom level of the returned image (see the :doc:`/services/GoogleMaps/index` service).
 * @param {TimeOffset=} timeOffset The time offset of the desired forecast (defaults to ``now``, which represents current weather).
 * @param {Object=} options Additional drawing options.
 * @param {Boolean=} options.smooth If set to true, smooths the radar overlay in the returned image to be more aesthetically pleasing (default true).
 * @param {Boolean=} options.showSnow If set to true, renders snow as a separate color from normal precipitation (default false).
 * @param {ColorScheme=} options.colorScheme An integer denoting the color scheme to use in the returned image (default 4).
 * @returns {Image} The rendered radar data overlay.
 */
RainViewer.getOverlay = async function (
  latitude,
  longitude,
  width,
  height,
  zoom,
  timeOffset = TIME_OFFSETS["now"],
  options = {},
) {
  const JSON_URL = "https://api.rainviewer.com/public/weather-maps.json";

  const MAX_ZOOM = 7;

  options = { ...DEFAULT_OPTS, ...options };

  const radarIndex = await this._requestData({ baseUrl: JSON_URL });
  const host = radarIndex.host;

  const samples = radarIndex.radar["past"];
  const samplesIdxDelta = Object.keys(TIME_OFFSETS).length - samples.length;
  const sampleIdxClamped = Math.max(0, timeOffset - samplesIdxDelta);
  const sample = samples[sampleIdxClamped];

  const widthClamped = Math.min(width, 1280);
  const heightClamped = Math.min(height, 1280);

  const use512 = widthClamped > 640 || heightClamped > 640;
  // logger.trace(`using tile resolution: ${use512 ? "512x512" : "256x256"}`);

  const merc = use512 ? merc512 : merc256;
  const size = use512 ? 512 : 256;

  const zoomDelta = Math.max(0, zoom - MAX_ZOOM);
  const zoomClamped = Math.min(zoom, MAX_ZOOM);
  logger.trace(`zoom_delta: ${zoomDelta}, zoom_clamped: ${zoomClamped}`);

  // Shrink canvas to crop zoom 7 tiles
  // Will be resized back to requested resolution
  const bgWidth = Math.ceil(widthClamped / (zoomDelta + 1));
  const bgHeight = Math.ceil(heightClamped / (zoomDelta + 1));

  // logger.trace(`shrunk image size: ${bgWidth}x${bgHeight}`);

  const res = new jimp(bgWidth, bgHeight);

  const maxPx = 2 ** zoomClamped * size;
  const [MIN_LAT, MAX_LAT] = [-85.05, 85.05];
  const [MIN_LON, MAX_LON] = [-180, 180];

  // logger.trace(`map max pixels: ${maxPx}`);

  const [centerXPx, centerYPx] = merc.px([longitude, latitude], zoomClamped);
  const northYPx = Math.max(0, centerYPx - Math.floor(bgHeight / 2));
  const southYPx = Math.min(maxPx, centerYPx + Math.floor(bgHeight / 2));

  const westXPx = centerXPx - Math.floor(bgWidth / 2);
  const eastXPx = centerXPx + Math.floor(bgWidth / 2);

  // logger.trace(`map pixel x bounds: ${westXPx} to ${eastXPx}`);
  // logger.trace(`map pixel y bounds: ${northYPx} to ${southYPx}`);

  const [westLon, northLat] = merc.ll([westXPx, northYPx], zoomClamped);
  const [eastLon, southLat] = merc.ll([eastXPx, southYPx], zoomClamped);

  // logger.trace(`map coordinate long bounds: ${westLon} to ${eastLon}`);
  // logger.trace(`map coordinate lat bounds: ${northLat} to ${southLat}`);

  const bbox = [westLon, southLat, eastLon, northLat];
  const tileBBox = merc.xyz(bbox, zoomClamped);

  const { minX, maxX, minY, maxY } = tileBBox;

  // logger.trace(`map tiles x indeces from: ${minX} to ${maxX}`);
  // logger.trace(`map tiles y indeces from: ${minY} to ${maxY}`);

  const tilePromises = [];

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const p = this._getTile(host, sample, size, zoomClamped, x, y, options)
        .then((tile) => jimp.read(tile))
        .then((img) => {
          const [tileXPx, tileYPx] = [x * size, y * size];
          const [resXPx, resYPx] = [tileXPx - westXPx, tileYPx - northYPx];
          // logger.trace(`tile (${x}, ${y}) placed at pixel (${resXPx}, ${resYPx})`);
          res.composite(img, resXPx, resYPx);
        });
      tilePromises.push(p);
    }
  }

  const leftWrap = westLon < MIN_LON;
  if (leftWrap) {
    const lBbox = [westLon + 360, southLat, MAX_LON, northLat];
    const { minX, maxX, minY, maxY } = merc.xyz(lBbox, zoomClamped);
    // logger.trace(`left wrapping`);
    // logger.trace(`left wrap map tiles x indeces from: ${minX} to ${maxX}`);
    // logger.trace(`left wrap map tiles y indeces from: ${minY} to ${maxY}`);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const p = this._getTile(host, sample, size, zoomClamped, x, y, options)
          .then((tile) => jimp.read(tile))
          .then((img) => {
            const [tileXPx, tileYPx] = [x * size, y * size];
            const [resXPx, resYPx] = [
              tileXPx - maxPx - westXPx,
              tileYPx - northYPx,
            ];
            // logger.trace(`tile (${x}, ${y}) placed at pixel (${resXPx}, ${resYPx})`);
            res.composite(img, resXPx, resYPx);
          });
        tilePromises.push(p);
      }
    }
  }
  const rightWrap = eastLon > 180;
  if (rightWrap) {
    const rBbox = [MIN_LON, southLat, eastLon - 360, northLat];
    const { minX, maxX, minY, maxY } = merc.xyz(rBbox, zoomClamped);
    // logger.trace(`right wrapping`);
    // logger.trace(`right wrap map tiles x indeces from: ${minX} to ${maxX}`);
    // logger.trace(`right wrap map tiles y indeces from: ${minY} to ${maxY}`);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const p = this._getTile(host, sample, size, zoomClamped, x, y, options)
          .then((tile) => jimp.read(tile))
          .then((img) => {
            const [tileXPx, tileYPx] = [x * size, y * size];
            const [resXPx, resYPx] = [
              tileXPx + maxPx - westXPx,
              tileYPx - northYPx,
            ];
            // logger.trace( `tile (${x}, ${y}) placed at pixel (${resXPx}, ${resYPx})`);
            res.composite(img, resXPx, resYPx);
          });
        tilePromises.push(p);
      }
    }
  }

  await Promise.all(tilePromises);

  // if (options.colorScheme >= 0 && options.colorScheme < 8) {
  //   logger.trace(`recoloring tiles to ${options.colorScheme}`);
  //   this._recolor(res, options.colorScheme);
  // }

  res.resize(widthClamped, heightClamped);
  logger.trace( `resizing from ${bgWidth}x${bgHeight} to ${widthClamped}x${heightClamped}`);
  this._sendImageBuffer(await res.getBufferAsync(jimp.MIME_PNG));
};

RainViewer._getTile = function (baseUrl, sample, size, zoom, x, y, options) {
  const color = 2;
  const path = `${sample.path}/${size}/${zoom}/${x}/${y}/${color}/${options.smooth ? 1 : 0}_${
    options.showSnow ? 1 : 0
  }.png`;

  return this._requestImage({ baseUrl: baseUrl, path });
};

RainViewer._recolor = function (img, selection) {
  for (let xPx = 0; xPx < img.getWidth(); xPx++) {
    for (let yPx = 0; yPx < img.getHeight(); yPx++) {
      const oldColor = img.getPixelColor(xPx, yPx);
      const colorList = COLOR_MAPPER[oldColor];
      const newColor =
        colorList?.[selection] ??
        getNearestMapping(oldColor, selection) ??
        0x0;
      img.setPixelColor(newColor, xPx, yPx);
    }
  }
};
module.exports = RainViewer;
