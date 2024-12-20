/**
 * Wildcam provides access to wildlife images from around the world.
 *
 * Current data sources:
 *
 * - `Zooniverse <https://classroom.zooniverse.org/#/wildcam-gorongosa-lab/explorers/map/>`__
 *
 * @service
 * @category GeoData
 * @category Media
 */
"use strict";

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const geolib = require("geolib");
const logger = require("../utils/logger")("wildcam");
const types = require("../../input-types");
const CacheManager = require("cache-manager");
const fsStore = require("cache-manager-fs");

// -------------------------------------------------------------------------

const CSV_PATH = path.join(__dirname, "wildcam-17nov2022.csv");
const CACHE_LIFETIME = 1 * 60 * 60; // seconds

// -------------------------------------------------------------------------

const CACHE_DIR = process.env.CACHE_DIR || "cache";
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);
const CACHE = CacheManager.caching({
  store: fsStore,
  options: {
    ttl: CACHE_LIFETIME,
    maxsize: 100 * 1024 * 1024,
    path: `${CACHE_DIR}/wildcam`,
    preventfill: false,
    reviveBuffers: true,
  },
});

const Wildcam = {};

function strictParseFloat(val) {
  const res = parseFloat(val);
  if (isNaN(res)) throw Error(`failed to parse '${val}' as a float`);
  return res;
}
function strictParseInt(val) {
  const res = parseInt(val);
  if (isNaN(res)) throw Error(`failed to parse '${val}' as a int`);
  return res;
}
function strictParseDate(val) {
  let match = val.match(/^(\d{4})-([01]?\d)-([0-3]?\d)$/);
  if (match) {
    return new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3]),
    );
  }

  match = val.match(/^([01]?\d)\/([0-3]?\d)\/(\d{4})$/);
  if (match) {
    return new Date(
      parseInt(match[3]),
      parseInt(match[1]) - 1,
      parseInt(match[2]),
    );
  }

  throw Error(`unknown date format '${val}'`);
}
function padNumber(val, width) {
  return val.toString().padStart(width, "0");
}
function formatDate(date) {
  return `${padNumber(date.getFullYear(), 4)}/${
    padNumber(date.getMonth() + 1, 2)
  }/${padNumber(date.getDate(), 2)}`;
}

const { DATA, SPECIES, CAMERAS } = (function () {
  const csvLines = fs.readFileSync(CSV_PATH, "utf8").split(/\r?\n/);
  const res = {};

  const locToCamera = {};
  const locString = (lat, long) => `${lat.trim()}x${long.trim()}`;

  for (let i = 1; i < csvLines.length; ++i) {
    try {
      const items = csvLines[i]
        .split(",")
        .map((x) => x.trim())
        .map((x) =>
          x.length && x[0] === x[x.length - 1] && x[0] === '"'
            ? x.substring(1, x.length - 1)
            : x
        );

      if (items.length === 0 || (items.length === 1 && items[0] === "")) {
        continue;
      }
      if (items.length !== 24) {
        throw Error(`wrong col count - expected 24 got ${items.length}`);
      }

      let entry = res[items[23]];
      if (!entry) {
        entry = res[items[23]] = {
          date: formatDate(strictParseDate(items[4])),
          timePeriod: items[8].split(" ")[0].toLowerCase(),
          latitude: strictParseFloat(items[3]),
          longitude: strictParseFloat(items[2]),
          vegetationType: items[9].toLowerCase(),
          species: [],
          imageUrl: items[23],
        };
      }

      entry.species.push({
        name: items[14].toLowerCase(),
        adults: strictParseInt(items[15]),
        young: strictParseInt(items[21] || "0"),
      });

      locToCamera[locString(items[3], items[2])] = {
        latitude: entry.latitude,
        longitude: entry.longitude,
        vegetationType: entry.vegetationType,
      };
    } catch (ex) {
      throw new Error(`line ${i + 1}: ${ex}`);
    }
  }

  const DATA = Object.values(res);
  DATA.sort((a, b) => a.date === b.date ? 0 : a.date > b.date ? 1 : -1); // dates are now in yyyy/mm/dd string form

  let SPECIES = new Set();
  for (const entry of DATA) {
    for (const species of entry.species) {
      SPECIES.add(species.name);
    }
  }
  SPECIES = [...SPECIES].sort();

  types.defineType({
    name: "Species",
    description:
      "The species of animal in an image provided by :func:`Wildcam.search`.",
    baseType: "Enum",
    baseParams: SPECIES,
  });

  const CAMERAS = [];
  for (const loc in locToCamera) {
    CAMERAS.push(locToCamera[loc]);
  }

  return { DATA, SPECIES, CAMERAS };
})();

/**
 * Returns all the valid species that can be used by :func:`Wildcam.search`.
 * @returns {Array<Species>} All valid species in alphabetical order.
 */
Wildcam.getSpeciesList = function () {
  return SPECIES;
};

/**
 * Returns all the cameras that are stored in the database, optionally filtering by proximity to a central location.
 * @param {Latitude=} latitude Filters results to only cameras within a given distance from a central location. Requires ``longitude`` and ``radius`` also be set.
 * @param {Longitude=} longitude Filters results to only cameras within a given distance from a central location. Requires ``latitude`` and ``radius`` also be set.
 * @param {BoundedNumber<0>=} radius Filters results to only cameras within a given distance (in meters) from a central location. Requires ``latitude`` and ``longitude`` also be set.
 * @returns {Array<Object>} All found cameras
 */
Wildcam.getCameras = function (
  latitude = null,
  longitude = null,
  radius = null,
) {
  const center = { latitude, longitude };
  if (latitude !== null || longitude !== null || radius !== null) {
    if (latitude === null || longitude === null || radius === null) {
      throw Error(
        "Distance filtering requires three params: latitude, longitude, AND radius",
      );
    }
  }

  return CAMERAS.filter((x) => {
    if (radius !== null) {
      const dist = geolib.getDistance(center, {
        latitude: x.latitude,
        longitude: x.longitude,
      });
      if (dist > radius) return false;
    }
    return true;
  });
};

/**
 * Searches the database for wildlife camera entries.
 * Each return value includes information about the contents of its associated image.
 * You can pass an entry to :func:`Wildcam.getImage` to get the actual image being described.
 *
 * @param {Date=} startDate The earliest date to include in the results. If omitted, no starting cutoff is used for filtering.
 * @param {Date=} stopDate The latest date to include in the results. If omitted, no stopping cutoff is used for filtering.
 * @param {Species=} species Filters results to only entries which contained the requested species. If omitted, no species filtering is performed.
 * @param {Latitude=} latitude Filters results to only entries within a given distance from a central location. Requires ``longitude`` and ``radius`` also be set.
 * @param {Longitude=} longitude Filters results to only entries within a given distance from a central location. Requires ``latitude`` and ``radius`` also be set.
 * @param {BoundedNumber<0>=} radius Filters results to only entries within a given distance (in meters) from a central location. Requires ``latitude`` and ``longitude`` also be set.
 * @returns {Array<Object>} All data entries matching the search, in chronological order
 */
Wildcam.search = function (
  startDate = null,
  stopDate = null,
  species = null,
  latitude = null,
  longitude = null,
  radius = null,
) {
  startDate = startDate ? +startDate : -Infinity;
  stopDate = stopDate ? +stopDate : Infinity;
  species = new Set(species ? [species] : SPECIES);

  const center = { latitude, longitude };
  if (latitude !== null || longitude !== null || radius !== null) {
    if (latitude === null || longitude === null || radius === null) {
      throw Error(
        "Distance filtering requires three params: latitude, longitude, AND radius",
      );
    }
  }

  return DATA.filter((x) => {
    const time = +x.date;
    if (time < startDate || time > stopDate) return false;
    if (!x.species.some((y) => species.has(y.name))) return false;
    if (radius !== null) {
      const dist = geolib.getDistance(center, {
        latitude: x.latitude,
        longitude: x.longitude,
      });
      if (dist > radius) return false;
    }
    return true;
  });
};

/**
 * Equivalent to :func:`Wildcam.search`, but can filter to only images taken by a specific camera.
 * @param {Date=} startDate The earliest date to include in the results. If omitted, no starting cutoff is used for filtering.
 * @param {Date=} stopDate The latest date to include in the results. If omitted, no stopping cutoff is used for filtering.
 * @param {Species=} species Filters results to only entries which contained the requested species. If omitted, no species filtering is performed.
 * @param {Object=} camera Filters results to only entries taken by a specific camera. If omitted, no camera-based filtering is performed.
 * @returns {Array<Object>} All data entries matching the search, in chronological order
 */
Wildcam.searchByCamera = function (
  startDate = null,
  stopDate = null,
  species = null,
  camera = null,
) {
  return Wildcam.search(
    startDate,
    stopDate,
    species,
    camera?.latitude,
    camera?.longitude,
    camera ? 10 : null,
  ); // small radius (meters) to make sure slight movement isn't a problem
};

/**
 * Gets the image associated with a given entry.
 * The provided entry should be exactly the format that was returned by one of the various search RPCs in this service.
 *
 * @param {Object} entry The search entry to get an image of
 * @returns {Image} The snapshot associated with the given entry
 */
Wildcam.getImage = async function (entry) {
  const url = entry.imageUrl;
  logger.info(`requesting image from: ${url}`);

  const data = await CACHE.wrap(url, async () => {
    logger.info("image not cached - downloading...");
    return (await axios({ url, method: "GET", responseType: "arraybuffer" }))
      .data;
  });

  this.response.set("content-type", "image/jpeg");
  this.response.set("content-length", data.length);
  this.response.set("connection", "close");

  logger.info("sent the image");
  return this.response.status(200).send(data);
};

module.exports = Wildcam;
