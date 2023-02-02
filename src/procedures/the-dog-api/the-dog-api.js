/**
 * The Dogs Service provides access to the Dog API data from https://api.thedogapi.com/v1/.
 *
 * @service
 * @category Society
 */

const logger = require("../utils/logger")("CatDog");
const axios = require("axios");
const { TheDogApiKey } = require("../utils/api-key");
const { dogTypes } = require("./types");
const ApiConsumer = require("../utils/api-consumer");
dogTypes();

// Dogs API Url
const dogApiUrl = "https://api.thedogapi.com/v1/images/search";

const TheDogApi = new ApiConsumer("TheDogApi", dogApiUrl, {
  cache: { ttl: 1 },
});
ApiConsumer.setRequiredApiKey(TheDogApi, TheDogApiKey);

/**
 * Get random dog image.
 * @param {BreedsOfDogs=} dogBreeds The list of all possible Dog Breeds filterable.
 * @returns {Image} the requested image
 */
TheDogApi.getRandomDogImage = async function (dogBreeds = "") {
  //Requesting JSON from the Dog Api Url
  const dogJson = await this._requestData({
    baseUrl: "https://api.thedogapi.com/v1/images/search?t=" + Date.now(),
    queryString: "&breed_ids=" + dogBreeds,
  });

  //Get the image URL from the received JSON
  const imageUrl = dogJson[0].url;

  return this._sendImage({
    baseUrl: imageUrl,
  });
};

module.exports = TheDogApi;
