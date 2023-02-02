/**
 * The Cats Service provides access to the Cat API data from https://api.thecatapi.com/v1/.
 *
 * @service
 * @category Society
 */

<<<<<<< HEAD

const { TheCatApiKey } = require('../utils/api-key');
const {registerTypes, CAT_BREEDS} = require('./types');
const ApiConsumer = require('../utils/api-consumer');
registerTypes();
=======
const { TheCatApiKey } = require("../utils/api-key");
const { catTypes } = require("./types");
const ApiConsumer = require("../utils/api-consumer");
catTypes();
>>>>>>> 765e96475f26c1bf2e25c8e22c160a9132a6104f

// Cats API Url
const catApiUrl = "https://api.thecatapi.com/v1/images/search";

const TheCatApi = new ApiConsumer("TheCatApi", catApiUrl, {
  cache: { ttl: 1 },
});
ApiConsumer.setRequiredApiKey(TheCatApi, TheCatApiKey);

/**
 * Get random cat image.
 * @param {CatBreeds=} catBreed cat breed supported by API.
 * @returns {Image} the requested image
 */
<<<<<<< HEAD
TheCatApi.getRandomCatImage = async function(catBreed = ''){
    //Requesting JSON from the Cat Api Url
    const catJson = await this._requestData({
        baseUrl: 'https://api.thecatapi.com/v1/images/search?t=' + Date.now(),
        queryString: '&breed_ids=' + catBreed,
        
    });
=======
TheCatApi.getRandomCatImage = async function (catBreeds = "") {
  //Requesting JSON from the Cat Api Url
  const catJson = await this._requestData({
    baseUrl: "https://api.thecatapi.com/v1/images/search?t=" + Date.now(),
    queryString: "&breed_ids=" + catBreeds,
  });
>>>>>>> 765e96475f26c1bf2e25c8e22c160a9132a6104f

  //Get the image URL from the received JSON
  const imageUrl = catJson[0].url;

<<<<<<< HEAD
/**
 * Get list of cat breeds.
 * @returns {CatBreeds} list of cat breeds supported by API.
 */
TheDogApi.getCatBreeds = function (){
    return Object.keys(CAT_BREEDS);
  }

module.exports = TheCatApi;
=======
  return this._sendImage({
    baseUrl: imageUrl,
  });
};

module.exports = TheCatApi;
>>>>>>> 765e96475f26c1bf2e25c8e22c160a9132a6104f
