/**
 * The Cats Service provides access to the Cat API data from https://api.thecatapi.com/v1/.
 *
 * @alpha
 * @service
 * @category Society
 * @category Media
 */

const { TheCatApiKey } = require("../utils/api-key");
const { registerTypes, CAT_BREEDS } = require("./types");
const ApiConsumer = require("../utils/api-consumer");
registerTypes();

// Cats API Url
const catApiUrl = "https://api.thecatapi.com/v1/images/search";

const TheCatApi = new ApiConsumer("TheCatApi", catApiUrl, {
  cache: { ttl: 1 },
});
ApiConsumer.setRequiredApiKey(TheCatApi, TheCatApiKey);

/**
 * Get random cat image.
 * @param {CatBreed=} catBreed provides a specific breed to search for. If ommited, no-breed-based filtering is performed.
 * @returns {Image} the requested image
 */
TheCatApi.getRandomCatImage = async function (catBreed = "") {
  //Requesting JSON from the Cat Api Url
  const catJson = await this._requestData({
    baseUrl: "https://api.thecatapi.com/v1/images/search?t=" + Date.now(),
    queryString: "&breed_ids=" + catBreed,
  });

  //Get the image URL from the received JSON
  const imageUrl = catJson[0].url;

  return this._sendImage({
    baseUrl: imageUrl,
  });
};

/**
 * Get list of cat breeds.
 * @returns {CatBreed} list of cat breeds supported by API.
 */
TheCatApi.getCatBreeds = function () {
  return Object.keys(CAT_BREEDS);
};

module.exports = TheCatApi;
