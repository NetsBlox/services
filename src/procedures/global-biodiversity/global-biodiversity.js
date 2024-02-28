/**
 * The GlobalBiodiversity service provides information on millions of species from around the globe.
 *
 * @alpha
 * @service
 * @category GeoData
 */
"use strict";

const ApiConsumer = require("../utils/api-consumer");
const types = require('../../input-types');
const _ = require('lodash');

types.defineType({
    name: 'SpeciesNameType',
    description: 'The type of species name to use in the :doc:`/services/GlobalBiodiversity/index` service.',
    baseType: 'Enum',
    baseParams: {
        'common name': 'VERNACULAR',
        'scientific name': 'SCIENTIFIC',
    },
});

const BackBone = "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c"

const GBIF = new ApiConsumer(
  "GlobalBiodiversity",
  "http://api.gbif.org/v1/",
  { cache: { ttl: 24 * 60 * 60 } },
);

/**
 * Search the database for species of the given common or scientific name.
 * 
 * Because there may be many matches, only up to 20 search results are returned per call to this RPC.
 * You can check if there are more matches by increasing the ``page`` number of results to return.
 * When there are no more results, an empty list is returned.
 * 
 * @param {SpeciesNameType} nameType the type of name to search for
 * @param {BoundedString<3>} name name of the species to search for
 * @param {BoundedInteger<1>=} page page number of results to return (default ``1``)
 * @returns {Array<Object>} 
 */
GBIF.searchSpecies = async function (nameType, name, page = 1) {
    const limit = 20;
    const offset = (page - 1) * limit;

    // their api puts a hard cap at offset 100000 - just give empty results
    if (offset > 100000) {
        return [];
    }

    const res = await this._requestData({
        path: 'species/search',
        queryString: `datasetKey=${BackBone}&status=ACCEPTED&rank=SPECIES&qField=${nameType}&q=${encodeURIComponent(name)}&limit=${limit}&offset=${offset}`,
    });

    return res.results.map((r) => {
        return {
            id: r['key'],

            scientificName: r['canonicalName'],
            commonNames: _.uniq(r['vernacularNames'].filter((x) => !x.language || x.language === 'eng').map((x) => x.vernacularName.toLowerCase())).sort(),

            extinct: r['extinct'],
            threatStatuses: _.uniq(r['threatStatuses'].map((x) => x.toLowerCase().replace('_', ' '))).sort(),

            habitats: _.uniq(r['habitats'].map((x) => x.toLowerCase())).sort(),
            descriptions: r['descriptions'].filter((x) => !x.language || x.language === 'eng').map((x) => x.description),

            kingdom: r['kingdom'],
            phylum: r['phylum'],
            class: r['class'],
            order: r['order'],
            family: r['family'],
            genus: r['genus'],
            species: r['species'],
        };
    });
};

/**
 * Get the URL of any image(s) associated with a particular species returned by :func:`GlobalBiodiversity.searchSpecies`.
 * These URLs can then be passed to :func:`GlobalBiodiversity.getImage` to retrieve the image.
 * 
 * Because there may be many associated images, only up to 20 URLs are returned per call to this RPC.
 * You can check if there are more images by increasing the ``page`` number of results to return.
 * When there are no more images, an empty list is returned.
 * 
 * @param {BoundedInteger<0>} speciesId the id of a species returned by :func:`GlobalBiodiversity.searchSpecies`
 * @param {BoundedInteger<1>=} page page number of results to return (default ``1``)
 * @returns {Array<String>} zero or more associated image URLs
 */
GBIF.getImageURLs = async function (speciesId, page = 1) {
    const limit = 20;
    const offset = (page - 1) * limit;

    const res = await this._requestData({
        path: `species/${speciesId}/media`,
        queryString: `limit=${limit}&offset=${offset}`,
    });

    return res.results.map((r) => r.identifier);
};

/**
 * Get an image from an image URL returned by :func:`GlobalBiodiversity.getImageURLs`.
 * 
 * @param {String} url URL of the image to load
 * @returns {Image} the downloaded image
 */
GBIF.getImage = async function (url) {
    return this._sendImage({ baseUrl: url });
};

module.exports = GBIF;
