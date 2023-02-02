/**
 * The Dogs Service provides access to the Dog API data from https://api.thedogapi.com/v1/.
 *
 * @service
 * @category Society
 */

<<<<<<< HEAD

const { TheDogApiKey } = require('../utils/api-key');
const {registerTypes, DOG_BREEDS} = require('./types');
const ApiConsumer = require('../utils/api-consumer');
registerTypes();
=======
const logger = require("../utils/logger")("CatDog");
const axios = require("axios");
const { TheDogApiKey } = require("../utils/api-key");
const { dogTypes } = require("./types");
const ApiConsumer = require("../utils/api-consumer");
dogTypes();
>>>>>>> 765e96475f26c1bf2e25c8e22c160a9132a6104f

// Dogs API Url
const dogApiUrl = "https://api.thedogapi.com/v1/images/search";

const TheDogApi = new ApiConsumer("TheDogApi", dogApiUrl, {
  cache: { ttl: 1 },
});
ApiConsumer.setRequiredApiKey(TheDogApi, TheDogApiKey);

/**
 * Get random dog image.
 * @param {DogBreeds=} dogBreed dog breed supported by API.
 * @returns {Image} the requested image
 */
<<<<<<< HEAD
TheDogApi.getRandomDogImage = async function(dogBreed = '') {
      //Requesting JSON from the Dog Api Url
      const dogJson = await this._requestData({
        baseUrl: 'https://api.thedogapi.com/v1/images/search?t=' + Date.now(),
        queryString: '&breed_ids=' + dogBreed,
        
    });
=======
TheDogApi.getRandomDogImage = async function (dogBreeds = "") {
  //Requesting JSON from the Dog Api Url
  const dogJson = await this._requestData({
    baseUrl: "https://api.thedogapi.com/v1/images/search?t=" + Date.now(),
    queryString: "&breed_ids=" + dogBreeds,
  });
>>>>>>> 765e96475f26c1bf2e25c8e22c160a9132a6104f

  //Get the image URL from the received JSON
  const imageUrl = dogJson[0].url;

<<<<<<< HEAD
/**
 * Get list of dog breeds.
 * @returns {DogBreeds} list of dog breeds supported by API.
 */
TheDogApi.getDogBreeds = function (){
  return Object.keys(DOG_BREEDS);
}

module.exports = TheDogApi;
=======
  return this._sendImage({
    baseUrl: imageUrl,
  });
};

module.exports = TheDogApi;
>>>>>>> 765e96475f26c1bf2e25c8e22c160a9132a6104f
