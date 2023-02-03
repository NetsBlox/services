/**
 * The Dogs Service provides access to the Dog API data from https://api.thedogapi.com/v1/.
 *
 * @alpha
 * @service
 * @category Society
 * @category Media
 */

const { TheDogApiKey } = require("../utils/api-key");
const { registerTypes, DOG_BREEDS } = require("./types");
const ApiConsumer = require("../utils/api-consumer");
registerTypes();

// Dogs API Url
const dogApiUrl = "https://api.thedogapi.com/v1/images/search";

const TheDogApi = new ApiConsumer("TheDogApi", dogApiUrl, {
  cache: { ttl: 1 },
});
ApiConsumer.setRequiredApiKey(TheDogApi, TheDogApiKey);

/**
 * Get random dog image.
 * @param {DogBreed=} dogBreed provides a specific breed to search for. If omitted, no-breed-based filtering is performed.
 * @returns {Image} the requested image
 */
TheDogApi.getRandomDogImage = async function (dogBreed = "") {
  //Requesting JSON from the Dog Api Url
  const dogJson = await this._requestData({
    baseUrl: "https://api.thedogapi.com/v1/images/search?t=" + Date.now(),
    queryString: "&breed_ids=" + dogBreed,
  });

  //Get the image URL from the received JSON
  const imageUrl = dogJson[0].url;

  return this._sendImage({
    baseUrl: imageUrl,
  });
};

/**
 * Get list of dog breeds.
 * @returns Array<DogBreed> list of dog breeds supported by API.
 */
TheDogApi.getDogBreeds = function () {
  return Object.keys(DOG_BREEDS);
};

module.exports = TheDogApi;
