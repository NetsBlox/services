/**
 * The GlobalBiodiversity service provides information on millions of species from around the globe.
 *
 * @service
 * @category GeoData
 */
"use strict";

const ApiConsumer = require("../utils/api-consumer");
const utils = require("../utils");
const types = require("../../input-types");
const _ = require("lodash");

types.defineType({
  name: "SpeciesNameType",
  description:
    "The type of species name to use in the :doc:`/services/GlobalBiodiversity/index` service.",
  baseType: "Enum",
  baseParams: {
    "common name": "VERNACULAR",
    "scientific name": "SCIENTIFIC",
  },
});

const BackBone = "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c";

const GBIF = new ApiConsumer(
  "GlobalBiodiversity",
  "http://api.gbif.org/v1/",
  { cache: { ttl: 24 * 60 * 60 } },
);

function cleanSpecies(r) {
  const res = {
    id: r["key"],
  };

  if (r["canonicalName"] !== undefined) {
    res["canonicalName"] = r["canonicalName"];
  }
  if (r["vernacularNames"] !== undefined) {
    res["vernacularNames"] = _.uniq(
      r["vernacularNames"].filter((x) => !x.language || x.language === "eng")
        .map((x) => x.vernacularName.toLowerCase()),
    ).sort();
  }
  if (r["extinct"] !== undefined) {
    res["extinct"] = r["extinct"];
  }
  if (r["threatStatuses"] !== undefined) {
    res["threatStatuses"] = _.uniq(
      r["threatStatuses"].map((x) => x.toLowerCase().replace("_", " ")),
    ).sort();
  }
  if (r["habitats"] !== undefined) {
    res["habitats"] = _.uniq(r["habitats"].map((x) => x.toLowerCase())).sort();
  }
  if (r["descriptions"] !== undefined) {
    res["descriptions"] = r["descriptions"].filter((x) =>
      !x.language || x.language === "eng"
    ).map((x) => x.description);
  }
  for (
    const k of [
      "kingdom",
      "phylum",
      "class",
      "order",
      "family",
      "genus",
      "species",
    ]
  ) {
    if (r[k] !== undefined) {
      res[k] = r[k];
    }
  }

  return res;
}

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
    path: "species/search",
    queryString:
      `datasetKey=${BackBone}&status=ACCEPTED&rank=SPECIES&qField=${nameType}&q=${
        encodeURIComponent(name)
      }&limit=${limit}&offset=${offset}`,
  });

  return res.results.map((r) => cleanSpecies(r));
};

/**
 * Get the taxonomical parent of a node/entry in the tree of life.
 *
 * @param {BoundedInteger<0>} id id of the taxonomy entry to get the parent of
 * @returns {Object} taxonomical parent of the entry
 */
GBIF.getParent = async function (id) {
  let res;
  try {
    res = await this._requestData({
      path: `species/${id}/parents`,
    });
  } catch (e) {
    throw Error(`unknown taxonomy node: ${id}`);
  }

  if (res.length === 0) {
    throw Error(`taxonomy node ${id} has no parents`);
  }

  return cleanSpecies(res[res.length - 1]);
};

/**
 * Get the taxonomical children of a node/entry in the tree of life.
 *
 * Because a node may have many children, only up to 20 children are returned per call to this RPC.
 * You can check if there are more children by increasing the ``page`` number of children to return.
 * When there are no more children, an empty list is returned.
 *
 * @param {BoundedInteger<0>} id id of the taxonomy entry to get the children of
 * @param {BoundedInteger<1>=} page page number of results to return (default ``1``)
 * @returns {Array<Object>} taxonomical children of the entry
 */
GBIF.getChildren = async function (id, page = 1) {
  const limit = 20;
  const offset = (page - 1) * limit;

  // their api puts a hard cap at offset 100000 - just give empty results
  if (offset > 100000) {
    return [];
  }

  let res;
  try {
    res = await this._requestData({
      path: `species/${id}/children`,
      queryString: `limit=${limit}&offset=${offset}`,
    });
  } catch (e) {
    throw Error(`unknown taxonomy node: ${id}`);
  }

  return res.results.map((r) => cleanSpecies(r));
};

/**
 * Get the URL of any media associated with a particular taxonomy node/entry in the tree of life.
 * These URLs can then be passed to :func:`GlobalBiodiversity.getImage` or :func:`GlobalBiodiversity.getSound` to get the image/sound.
 *
 * Because there may be many associated media entries, only up to 20 URLs are returned per call to this RPC.
 * You can check if there are more URLs by increasing the ``page`` number of results to return.
 * When there are no more URLs, an empty list is returned.
 *
 * @param {Enum<image,sound>=} type the type of media to return
 * @param {BoundedInteger<0>} id id of the taxonomy node to get media from
 * @param {BoundedInteger<1>=} page page number of results to return (default ``1``)
 * @returns {Array<String>} zero or more associated media URLs
 */
GBIF.getMediaURLs = async function (type, id, page = 1) {
  type = { "image": "StillImage", "sound": "Sound" }[type];

  const limit = 20;
  const offset = (page - 1) * limit;

  let res;
  try {
    res = await this._requestData({
      path: `species/${id}/media`,
      queryString: `limit=${limit}&offset=${offset}`,
    });
  } catch (e) {
    throw Error(`unknown taxonomy node: ${id}`);
  }

  return res.results.filter((r) => r.type === type).map((r) => r.identifier);
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

/**
 * Get a sound from a sound URL returned by :func:`GlobalBiodiversity.getMediaURLs`.
 */
GBIF.getSound = async function (url) {
  const data = await this._requestData({ baseUrl: url });
  return utils.sendAudioBuffer(this.response, data);
};

module.exports = GBIF;
