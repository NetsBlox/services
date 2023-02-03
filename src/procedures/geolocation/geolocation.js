/**
 * The Geolocation Service provides access to the Google Places API and geocoding capabilities.
 * For more information, check out https://developers.google.com/places/
 *
 * Terms of service: https://developers.google.com/maps/terms
 * @service
 * @category Location
 */
const {GoogleMapsKey, TimezoneDBKey} = require('../utils/api-key');
const utils = require('../utils');
const GeoLocationRPC = {};
utils.setRequiredApiKey(GeoLocationRPC, GoogleMapsKey);
const {RPCError} = utils;

const logger = require('../utils/logger')('geolocation');
const CacheManager = require('cache-manager');
const NodeGeocoder = require('node-geocoder');
const jsonQuery = require('json-query');
const rp = require('request-promise');

const cache = CacheManager.caching({ store: 'memory', max: 1000, ttl: 36000 });
const GEOCODER_API = process.env.GOOGLE_GEOCODING_API;
const geocoder = NodeGeocoder({
    provider:    'google',
    httpAdapter: 'https',      // Default
    apiKey:      GEOCODER_API, // for Mapquest, OpenCage, Google Premier
    formatter:   null          // 'gpx', 'string', ...
});

const TIMEZONEDB_URL = 'http://api.timezonedb.com/v2.1';

// turns coordinates into key strings used to bust the match new requests to cached values
// might be a good idea to add a precision limit to reduce cache misses
const locString = (lat, lon) => `${lat}, ${lon}`;

// helper to filter json down
function queryJson(json, query){
    const res = jsonQuery(query, { data: json }).value;
    if (res === undefined || res === null) throw Error('No results found.');
    return res;
}

async function reverseGeocode(lat, lon, query) {
    return await cache.wrap(locString(lat, lon) + query, async () => {
        logger.trace('Geocoding (not cached)', lat, lon, query);
        try {
            const res = await geocoder.reverse({ lat, lon });
            return queryJson(res[0], query); // only interested in the first match
        } catch (e) {
            const message = `Reverse geocoding (${lat},${lon}) error: ${e.message}`;
            logger.warn(message);
            throw Error(`Failed to lookup geocode at ${lat}, ${lon}`);
        }
    });
}

async function rawGeolocate(address) {
    return await cache.wrap(address, async () => {
        logger.trace('Geocoding (not cached)', address);
        try {
            const res = await geocoder.geocode(address);
            if (res.length === 0 || !res[0]) throw Error('no results');
            return res[0];
        } catch (e) {
            const message = `Geocoding (${address}) error: ${e.message}`;
            logger.warn(message);
            throw Error(`Failed to find location for ${address}`);
        }
    });
}

/**
 * Geolocates the address and returns the coordinates
 * @param {String} address target address
 * @returns {Object} structured data representing the location of the address
 */
GeoLocationRPC.geolocate = async function (address) {
    const raw = await rawGeolocate(address);
    return { latitude: raw.latitude, longitude: raw.longitude };
};

/**
 * Get information about the timezone of the provided address or location.
 * You can provide either a list of two values representing the latitude and longitude location, or a string address to look up.
 *
 * @param {Union<Tuple<Latitude,Longitude>,String>} address target location - either a list representing [latitude, longitude], or an address string
 * @returns {Object} information about the target's timezone
 */
GeoLocationRPC.timezone = async function (address) {
    if (typeof(address) === 'string') {
        address = await rawGeolocate(address);
        address = [address.latitude, address.longitude];
    }
    const [latitude, longitude] = address;

    return await cache.wrap(locString(latitude, longitude) + '.timezone', async () => {
        logger.trace('timezone info (not cached)', latitude, longitude);
        const res = await rp({
            method: 'get',
            uri: `${TIMEZONEDB_URL}/get-time-zone`,
            qs: {
                key: TimezoneDBKey.value,
                format: 'json',
                by: 'position',
                lat: latitude,
                lng: longitude,
            },
            json: true,
        });
        return {
            abbr: res.abbreviation,
            gmtOffset: res.gmtOffset / 3600,
            daylightSavings: res.dst != 0, // != is intentional
            localTime: res.formatted.split(' ')[1],
            localTimestamp: res.timestamp,
            countryCode: res.countryCode,
            country: res.countryName,
            zone: res.zoneName,
        };
    }).catch(err => {
        throw new RPCError(err?.error?.message);
    });
};

/**
 * Get the street address of a given target location.
 *
 * @param {String} address the address string to look up
 * @returns {String} the target street address
 */
GeoLocationRPC.streetAddress = async function (address) {
    const info = await rawGeolocate(address);
    return info.formattedAddress;
};

/**
 * Get the name of the city nearest to the given latitude and longitude.
 *
 * @param {Latitude} latitude latitude of the target location
 * @param {Longitude} longitude longitude of the target location
 * @returns {String} city name
 */
GeoLocationRPC.city = function (latitude, longitude) {
    return reverseGeocode(latitude, longitude, '.city');
};

/**
 * Get the name of the county (or closest equivalent) nearest to the given latitude and longitude.
 * If the country does not have counties, it will return the corresponding division for administrative level 2.
 *
 * For more information on administrative divisions, check out https://en.wikipedia.org/wiki/List_of_administrative_divisions_by_country
 *
 * @param {Latitude} latitude latitude of the target location
 * @param {Longitude} longitude longitude of the target location
 * @returns {String} county name
 */
GeoLocationRPC['county*'] = function (latitude, longitude) {
    return reverseGeocode(latitude, longitude, '.administrativeLevels.level2long');
};

/**
 * Get the name of the state (or closest equivalent) nearest to the given latitude and longitude.
 * If the country does not have states, it will return the corresponding division for administrative level 1.
 *
 * For more information on administrative divisions, check out https://en.wikipedia.org/wiki/List_of_administrative_divisions_by_country
 *
 * @param {Latitude} latitude latitude of the target location
 * @param {Longitude} longitude longitude of the target location
 * @returns {String} state name
 */
GeoLocationRPC['state*'] = function (latitude, longitude) {
    return reverseGeocode(latitude, longitude, '.administrativeLevels.level1long');
};

/**
 * Get the code for the state (or closest equivalent) nearest to the given latitude and longitude.
 * If the country does not have states, it will return the corresponding division for administrative level 1.
 *
 * For more information on administrative divisions, check out https://en.wikipedia.org/wiki/List_of_administrative_divisions_by_country
 *
 * @param {Latitude} latitude latitude of the target location
 * @param {Longitude} longitude longitude of the target location
 * @returns {String} state code
 */
GeoLocationRPC['stateCode*'] = function (latitude, longitude) {
    return reverseGeocode(latitude, longitude, '.administrativeLevels.level1short');
};

/**
 * Get the name of the country nearest to the given latitude and longitude.
 *
 * @param {Latitude} latitude latitude of the target location
 * @param {Longitude} longitude longitude of the target location
 * @returns {String} country name
 */
GeoLocationRPC.country = function (latitude, longitude) {
    return reverseGeocode(latitude, longitude, '.country');
};

/**
 * Get the code for the country nearest to the given latitude and longitude.
 *
 * @param {Latitude} latitude latitude of the target location
 * @param {Longitude} longitude longitude of the target location
 * @returns {String} country code
 */
GeoLocationRPC.countryCode = function (latitude, longitude) {
    return reverseGeocode(latitude, longitude, '.countryCode');
};

/**
 * Get administrative division information for the given latitude and longitude.
 *
 * @param {Latitude} latitude latitude of the target location
 * @param {Longitude} longitude longitude of the target location
 * @returns {Array} list of administative level names
 */
GeoLocationRPC.info = async function (latitude, longitude) {
    const [topResult] = await geocoder.reverse({ lat: latitude, lon: longitude });
    const { city, administrativeLevels, country, countryCode } = topResult;
    if (!city || !administrativeLevels || !country || !countryCode) {
        throw Error(`Failed to lookup geocode at ${latitude}, ${longitude}`);
    }
    const levels = [];

    // find and pull out all the provided admin levels
    levels.push(city);
    for (const level in administrativeLevels) {
        levels.push(administrativeLevels[level]);
    }
    levels.push(country);
    levels.push(countryCode);

    return levels.reverse(); // reverse so that it's big to small
};

/**
 * Find places near an earth coordinate (latitude, longitude) (maximum of 10 results)
 * @param {Latitude} latitude
 * @param {Longitude} longitude
 * @param {String=} keyword the keyword you want to search for, like pizza or cinema.
 * @param {Number=} radius search radius in meters (default 50km)
 * @returns {Array<Object>} list of nearby locations
 */
GeoLocationRPC.nearbySearch = async function (latitude, longitude, keyword, radius = 50000) {
    const requestOptions = {
        method: 'get',
        uri: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
        qs: { location: `${latitude},${longitude}`, radius, key: this.apiKey.value },
        json: true,
    };
    if (keyword) {
        requestOptions.qs.keyword = keyword;
    }

    return await cache.wrap(locString(latitude, longitude) + keyword + radius, async () => {
        const res = await rp(requestOptions);
        if (res.error_message) {
            throw Error(res.error_message);
        }
        const places = res.results;
        const topResults = places.slice(0, 10).map(place => {
            return {
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
                name: place.name,
                types: place.types,
            };
        });
        return topResults;
    });
};

module.exports = GeoLocationRPC;
