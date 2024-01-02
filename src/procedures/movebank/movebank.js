/**
 * Access to Movebank, a free, online database of animal tracking data hosted by the Max Planck Institute of Animal Behavior.
 *
 * @alpha
 * @service
 * @category GeoData
 */

const logger = require("../utils/logger")("movebank");
const ApiConsumer = require("../utils/api-consumer");
const types = require("../../input-types");
const csv = require("fast-csv");
const md5 = require('md5');
const axios = require("axios");
const { MovebankKey } = require("../utils/api-key");
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
    const licenseSuffix = licenseHash ? `&license-md5=${licenseHash}` : '';
    const url = `${Movebank._baseUrl}?${settings.queryString}${licenseSuffix}`;
    logger.info(`fetching possibly licensed content: ${url}`);

    const res = await axios({ url, method: "GET" });
    if (!licenseHash && res.headers['accept-license'] === 'true') {
        logger.info('> failed with license request');
        for (const ty in ALLOWED_LICENSE_TYPES) {
            if (res.data.includes(`<span style="font-weight:bold;font-style:italic;">License Type: </span>${ALLOWED_LICENSE_TYPES[ty]}`)) {
                logger.info(`> accepting license of type ${ty} and retrying...`);
                return await fetchLicensed(settings, md5(res.data));
            }
        }
        logger.info(`> unknown license type`, res.data);
        throw Error('failed to download licensed material');
    }
    logger.info('> success!');
    return res.data;
}

let SENSOR_TYPES_META = [];
types.defineType({
    name: "MovebankSensor",
    description: "A sensor type used by :doc:`/services/Movebank/index`.",
    baseType: "Enum",
    baseParams: (async () => {
        SENSOR_TYPES_META = await parseCSV(await Movebank._requestData({
            queryString: `entity_type=tag_type&api-token=${Movebank.apiKey.value}`,
        }));

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
    const data = await parseCSV(await Movebank._requestData({
        queryString: `entity_type=study&i_have_download_access=true&api-token=${Movebank.apiKey.value}`,
    }));

    const res = [];
    for (const raw of data) {
        if (raw.id && raw.main_location_lat && raw.main_location_long && raw.citation && ALLOWED_LICENSE_TYPES[raw.license_type]) {
            res.push({
                id: parseInt(raw.id),
                latitude: parseFloat(raw.main_location_lat),
                longitude: parseFloat(raw.main_location_long),
                species: raw.taxon_ids.split(',').map((x) => x.trim()),
                sensors: raw.sensor_type_ids.split(',').map((x) => x.trim()),
                citation: raw.citation,
            });
        }
    }
    return res;
};

/**
 * Get a list of all the animals that participated in a specific study.
 * 
 * @param {Union<Object,Integer>} study A study object or study id returned by :func:`Movebank.getStudies`
 * @returns {Array<Object>} A list of animals
 */
Movebank.getAnimalsInStudy = async function (study) {
    if (typeof(study) === "object") study = parseInt(study.id);
    if (isNaN(study)) throw Error("invalid study");

    const data = await parseCSV(await fetchLicensed({
        queryString: `entity_type=individual&study_id=${study}&api-token=${Movebank.apiKey.value}`,
    }));

    console.log(SENSOR_TYPES_META);

    const res = []
    for (const raw of data) {
        if (raw.id && raw.sex && raw.taxon_canonical_name) {
            res.push({
                id: parseInt(raw.id),
                sex: raw.sex === 'm' ? 'male' : raw.sex === 'f' ? 'female' : raw.sex,
                species: raw.taxon_canonical_name,
                sensors: raw.sensor_type_ids.split(',').map((x) => {
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

module.exports = Movebank;
