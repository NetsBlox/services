/**
 * Access to Movebank, a free, online database of animal tracking data hosted by the Max Planck Institute of Animal Behavior.
 *
 * @service
 * @category GeoData
 */

const logger = require("../utils/logger")("movebank");
const ApiConsumer = require("../utils/api-consumer");
const { MovebankKey } = require("../utils/api-key");
const types = require("../../input-types");
const geolib = require("geolib");
const csv = require("fast-csv");
const axios = require("axios");
const md5 = require("md5");

const Movebank = new ApiConsumer(
  "Movebank",
  "https://www.movebank.org/movebank/service/direct-read/",
  { cache: { ttl: 1 * 60 * 60 } },
);
ApiConsumer.setRequiredApiKey(Movebank, MovebankKey);

// some studies require us to accept a license before we can view the data,
// and there doesn't seem to be a way to filter these out before attempting to download the data.
// so we'll just auto-accept any licenses that are (specifically) of the following open license types.
const ALLOWED_LICENSE_TYPES = {
  "CC_0": "CC0",
  "CC_BY": "CC BY",
  "CC_BY_NC": "CC BY-NC",
  "CC_BY_SA": "CC BY-SA",
  "CC_BY_NC_SA": "CC BY-NC-SA",
};

async function parseCSV(content) {
  return new Promise((resolve, reject) => {
    const res = [];
    const stream = csv.parse({ headers: true, objectMode: true })
      .on("data", (x) => res.push(x))
      .on("error", (e) => reject(e))
      .on("end", () => resolve(res));

    stream.write(content);
    stream.end();
  });
}

async function fetchLicensed(settings, licenseHash = null) {
  const licenseSuffix = licenseHash ? `&license-md5=${licenseHash}` : "";
  const url = `${Movebank._baseUrl}?${settings.queryString}${licenseSuffix}`;
  logger.info(`fetching possibly licensed content: ${url}`);

  return await Movebank._cache.wrap(
    `<licensed>::<${licenseHash}>::<${url}>`,
    async () => {
      logger.info("> request is not cached - calling external endpoint");
      const res = await axios({ url, method: "GET" });
      if (!licenseHash && res.headers["accept-license"] === "true") {
        logger.info("> failed with license request");
        for (const ty in ALLOWED_LICENSE_TYPES) {
          if (
            res.data.includes(
              `<span style="font-weight:bold;font-style:italic;">License Type: </span>${
                ALLOWED_LICENSE_TYPES[ty]
              }`,
            )
          ) {
            logger.info(`> accepting license of type ${ty} and retrying...`);
            return await fetchLicensed(settings, md5(res.data));
          }
        }
        logger.info(`> unknown license type`, res.data);
        throw Error("failed to download licensed material");
      }
      return res.data;
    },
  );
}

async function tryOrElse(ok, err) {
  try {
    return await ok();
  } catch (e) {
    return await err();
  }
}

let SENSOR_TYPES_META = [];
types.defineType({
  name: "MovebankSensor",
  description: "A sensor type used by :doc:`/services/Movebank/index`.",
  baseType: "Enum",
  baseParams: (async () => {
    try {
      SENSOR_TYPES_META = await parseCSV(
        await Movebank._requestData({
          queryString:
            `entity_type=tag_type&api-token=${Movebank.apiKey.value}`,
        }),
      );
    } catch (e) {
      console.error("failed to load MoveBank sensor types", e);
    }

    const res = {};
    for (const ty of SENSOR_TYPES_META) {
      res[ty.name] = parseInt(ty.id);
    }
    return res;
  })(),
});

/**
 * Get a list of all the sensor types supported by Movebank.
 *
 * @returns {Array<String>} A list of supported sensor types
 */
Movebank.getSensorTypes = function () {
  return SENSOR_TYPES_META.map((x) => x.name);
};

/**
 * Get a list of all the studies available for (public) viewing.
 *
 * @returns {Array<Object>} A list of available studies
 */
Movebank.getStudies = async function () {
  const data = await parseCSV(
    await Movebank._requestData({
      queryString:
        `entity_type=study&i_have_download_access=true&api-token=${Movebank.apiKey.value}`,
    }),
  );

  const split = (x) => x.split(",").map((x) => x.trim()).filter((x) => x.length);

  const res = [];
  for (const raw of data) {
    if (!raw.id || !raw.main_location_lat || !raw.main_location_long || !raw.citation || !ALLOWED_LICENSE_TYPES[raw.license_type]) continue;

    const species = split(raw.taxon_ids);
    if (species.length === 0) continue;

    res.push({
      id: parseInt(raw.id),
      latitude: parseFloat(raw.main_location_lat),
      longitude: parseFloat(raw.main_location_long),
      species,
      sensors: split(raw.sensor_type_ids),
      citation: raw.citation,
    });
  }
  return res;
};

/**
 * Get a list of all the studies available for (public) viewing within a certain max distance of a point of interest.
 * Note that some of the animals involved in these studies may travel outside of this distance.
 *
 * @param {Latitude} latitude Latitude of the point of interest
 * @param {Longitude} longitude Longitude of the point of interest
 * @param {BoundedNumber<0>} distance Max distance from the point of interest (in meters)
 * @returns {Array<Object>} A list of available studies near the point of interest
 */
Movebank.getStudiesNear = async function (latitude, longitude, distance) {
  const p = { latitude, longitude };
  const d = (x) => geolib.getDistance(p, { latitude: x.latitude, longitude: x.longitude });
  return (await Movebank.getStudies()).filter((x) => d(x) <= distance).sort((a, b) => d(a) - d(b));
};

/**
 * Get a list of all the animals that participated in a specific study.
 *
 * @param {Object} study A study object returned by :func:`Movebank.getStudies`
 * @returns {Array<Object>} A list of animals
 */
Movebank.getAnimals = async function (study) {
  study = parseInt(study.id);
  if (isNaN(study)) throw Error("unknown study");

  const data = await parseCSV(
    await tryOrElse(async () => {
      return await fetchLicensed({
        queryString:
          `entity_type=individual&study_id=${study}&api-token=${Movebank.apiKey.value}`,
      });
    }, () => {
      return "";
    }),
  );

  const res = [];
  for (const raw of data) {
    if (raw.local_identifier && raw.taxon_canonical_name) {
      res.push({
        id: raw.local_identifier,
        sex: raw.sex === "m" ? "male" : raw.sex === "f" ? "female" : "unknown",
        species: raw.taxon_canonical_name,
        sensors: raw.sensor_type_ids.split(",").map((x) => {
          x = x.trim();
          for (const meta of SENSOR_TYPES_META) {
            if (meta.external_id === x) {
              return meta.name;
            }
          }
          return x;
        }),
      });
    }
  }
  return res;
};

/**
 * Get a chronological list of all the migration events for an animal in a specific study.
 *
 * @param {Object} study A study object returned by :func:`Movebank.getStudies`
 * @param {Object} animal An animal object returned by :func:`Movebank.getAnimals`. The animal should be part of the same study.
 * @param {BoundedNumber<0>=} minDistance The minimum distance (in meters) between consecutive returned events (default 0, which gives all available data).
 * @returns {Array<Object>} A list of chronological migration events for the animal
 */
Movebank.getEvents = async function (study, animal, minDistance = 0) {
  study = parseInt(study.id);
  if (isNaN(study)) throw Error("unknown study");

  animal = animal.id.toString();
  if (!animal) throw Error("unknown animal");

  const data = await parseCSV(
    await tryOrElse(async () => {
      return await fetchLicensed({
        queryString:
          `entity_type=event&study_id=${study}&individual_local_identifier=${animal}&attributes=visible,timestamp,location_lat,location_long&api-token=${Movebank.apiKey.value}`,
      });
    }, () => {
      return "";
    }),
  );

  const res = [];
  let prevPos = null;
  for (const raw of data) {
    if (
      raw.visible === "true" && raw.timestamp && raw.location_lat &&
      raw.location_long
    ) {
      const entry = {
        timestamp: new Date(raw.timestamp),
        latitude: parseFloat(raw.location_lat),
        longitude: parseFloat(raw.location_long),
      };

      if (minDistance > 0) {
        const pos = { latitude: entry.latitude, longitude: entry.longitude };
        if (!prevPos || geolib.getDistance(prevPos, pos) >= minDistance) {
          prevPos = pos;
          res.push(entry);
        }
      } else {
        res.push(entry);
      }
    }
  }
  return res;
};

module.exports = Movebank;
