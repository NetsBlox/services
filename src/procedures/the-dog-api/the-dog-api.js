/**
 * The Dogs Service provides access to the Dog API data from https://api.thedogapi.com/v1/.
 *
 * @service
 * @category Society
 */


const logger = require('../utils/logger')('CatDog');
const axios = require('axios');
const {dogTypes} = require('./types');
const ApiConsumer = require('../utils/api-consumer');
dogTypes();

const TheDogApi = {};

// Dogs API Url
const dogApiUrl = 'https://api.thedogapi.com/v1/images/search';

// const dogConsumer = new ApiConsumer('catDog', apiUrl, {cache: {ttl: 5*60}});


 TheDogApi._getImageUrl = async function(rsp, breeds) {
    let apiUrl = 'https://api.thedogapi.com/v1/images/search';

    var config = {
        method: 'get',
        url: apiUrl,
        params: {
            breed_ids: breeds
        },
        headers: { 
          'Content-Type': 'application/json', 
        //   'x-api-key': 'live_yL38pOVfFAQFLVu0Pk9bu1R26Msm8cZc6nmckkeymTJ9F3zpjBrCZtVhiM3WD4Pm'
        }
      };

    let firstResponse = await axios(config);
    console.log("FIRST RESPONSE:", typeof firstResponse.data);
    const imageUrl = firstResponse.data[0].url;
    console.log("FIRST RESPONSE: THIS IS THE URL", typeof imageUrl);
    logger.info(`HERE IS MY STRINGY ${imageUrl}`);
   
    let secondResponse = await axios({url: imageUrl, method: 'GET', responseType: 'arraybuffer'});

    rsp.set('content-type', 'image/jpeg');
    rsp.set('content-length', secondResponse.data.length);
    rsp.set('connection', 'close');

    // logger.info(`WHAT IS THIS IMAGEN ${secondResponse.data}`);
    return rsp.status(200).send(secondResponse.data);

}


/**
 * Get random dog image.
 * @param {BreedsOfDogs=} dogBreeds The list of all possible Dog Breeds filterable.
 * @returns {Image} the requested image
 */
TheDogApi.getRandomDogImage = function(BreedsOfDogs = '') {

    return TheDogApi._getImageUrl(this.response, BreedsOfDogs);
}

module.exports = TheDogApi;