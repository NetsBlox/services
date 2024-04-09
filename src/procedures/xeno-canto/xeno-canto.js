/**
 * This service gives access to the XenoCanto database of wildlife sounds.
 * With this service, you can search for real animal sounds/calls based on species.
 *
 * @alpha
 * @service
 * @category Media
 */

const fsp = require("fs").promises;
const logger = require("../utils/logger")("xeno-canto");
const utils = require("../utils/index");
const CacheManager = require("cache-manager");

const cache = CacheManager.caching({
    store: "memory",
    max: 128,
    ttl: Infinity,
});

const dbpath = '../../../xeno-canto';

let __cached_meta = undefined;
async function getMeta() {
    if (__cached_meta !== undefined) return __cached_meta;
    __cached_meta = JSON.parse(await fsp.readFile(`${dbpath}/meta.json`, { encoding: "utf8" }));
    return __cached_meta;
}

async function getMedia(id) {
    logger.info(`requesting media::${id}`);
    return await cache.wrap(`media::${id}`, async () => {
        logger.info(`request not cached, grabbing media::${id}`);
        return await fsp.readFile(`${dbpath}/media/${id}.mp3`);
    });
}

const XenoCanto = {};

XenoCanto.__cachedSpecies = undefined;
/**
 * Return a list of all the species contained in the database.
 * @returns {Array<String>} a list of species names in alphabetical order
 */
XenoCanto.allSpecies = async function () {
    if (XenoCanto.__cachedSpecies !== undefined) return XenoCanto.__cachedSpecies;
    const meta = await getMeta();

    let res = new Set();
    for (const k in meta) {
        for (const species of meta[k].species) {
            res.add(`${species[1]} ${species[2]}`.trimEnd());
        }
    }
    res = Array.from(res).sort();

    XenoCanto.__cachedSpecies = res;
    return res;
};

XenoCanto.__cachedCommonNames = undefined;
/**
 * Return a list of all the common names of species contained in the database.
 * @returns {Array<String>} a list of common names in alphabetical order
 */
XenoCanto.allCommonNames = async function () {
    if (XenoCanto.__cachedCommonNames) return XenoCanto.__cachedCommonNames;
    const meta = await getMeta();

    let res = new Set();
    for (const k in meta) {
        for (const species of meta[k].species) {
            if (species[0]) res.add(species[0]);
        }
    }
    res = Array.from(res).sort();

    XenoCanto.__cachedCommonNames = res;
    return res;
};

XenoCanto._search = async function (filter) {
    const meta = await getMeta();

    const res = [];
    for (const k in meta) {
        const entry = meta[k];
        if (!filter(entry)) continue;

        res.push({
            id: k,

            license: entry.license,
            author: entry.author,

            species: entry.species.map((s) => ({ common: s[0], genus: s[1], species: s[2], subspecies: s[3] })),

            location: entry.location,
            date: entry.date,
            time: entry.time,
            length: entry.length,

            method: entry.method,
            quality: entry.quality,
        });
    }
    return res;
};

/**
 * Searches for data associated with a specific species.
 * 
 * @param {BoundedString<3>} genus The genus of the animals to find.
 * @param {BoundedString<3>=} species The species of the animals to find (if omitted, gives all entries matching genus).
 * @param {BoundedString<3>=} subspecies The subspecies of the animals to find (if omitted, gives all entries matching genus and species).
 * @returns {Array<Object>} a list of matching animal entries.
 */
XenoCanto.searchSpecies = async function (genus, species = '', subspecies = '') {
    genus = genus.toLowerCase().trim();
    species = species.toLowerCase().trim();
    subspecies = subspecies.toLowerCase().trim();

    return XenoCanto._search((entry) => {
        for (const x of entry.species) {
            if (genus && genus !== x[1]) continue;
            if (species && species !== x[2]) continue;
            if (subspecies && subspecies !== x[3]) continue;
            return true;
        }
        return false;
    });
};

/**
 * Searches for data associated with a specific common name for a species.
 * 
 * @param {BoundedString<3>} name The common name of a species to find.
 * @returns {Array<Object>} a list of matching animal entries.
 */
XenoCanto.searchCommonName = async function (name) {
    name = name.toLowerCase().trim();

    return XenoCanto._search((entry) => {
        for (const x of entry.species) {
            if (x[0].includes(name)) return true;
        }
        return false;
    });
};

/**
 * Get the audio recording associated with the given entry as returned by :func:`XenoCanto.searchSpecies` or :func:`XenoCanto.searchCommonName`.
 * 
 * @param {BoundedInteger<0>} id id of the entry to look up
 * @returns {Array<Audio>} the associated audio recording
 */
XenoCanto.getRecording = async function (id) {
    try {
        const data = await getMedia(id);
        return utils.sendAudioBuffer(this.response, data);
    } catch {
        throw Error(`unknown entry id: ${id}`);
    }
};

module.exports = XenoCanto;
