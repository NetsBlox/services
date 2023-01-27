/**
 * The Cats Service provides access to the Cat API data from https://api.thecatapi.com/v1/.
 *
 * @service
 * @category Society
 */


const logger = require('../utils/logger')('CatDog');
const axios = require('axios');
const { TheCatApiKey } = require('../utils/api-key');
const {catTypes} = require('./types');
const ApiConsumer = require('../utils/api-consumer');
catTypes();

// const TheCatApi = {};

// Cats API Url
const catApiUrl = 'https://api.thecatapi.com/v1/images/search';

 const TheCatApi = new ApiConsumer('TheCatApi', catApiUrl, {cache: {ttl: 5*60}});
 ApiConsumer.setRequiredApiKey(TheCatApi, TheCatApiKey)


//  TheCatApi._getImageUrl = async function(rsp, breeds) {
//     let apiUrl = 'https://api.thecatapi.com/v1/images/search';

//     var config = {
//         method: 'get',
//         url: apiUrl,
//         params: {
//             breed_ids: breeds
//         },
//         headers: { 
//           'Content-Type': 'application/json', 
//         //   'x-api-key': 'live_yL38pOVfFAQFLVu0Pk9bu1R26Msm8cZc6nmckkeymTJ9F3zpjBrCZtVhiM3WD4Pm'
//         }
//       };

//     let firstResponse = await axios(config);
//     console.log("FIRST RESPONSE:", typeof firstResponse.data);
//     const imageUrl = firstResponse.data[0].url;
//     console.log("FIRST RESPONSE: THIS IS THE URL", typeof imageUrl);
//     logger.info(`HERE IS MY STRINGY ${imageUrl}`);
   
//     let secondResponse = await axios({url: imageUrl, method: 'GET', responseType: 'arraybuffer'});

//     rsp.set('content-type', 'image/jpeg');
//     rsp.set('content-length', secondResponse.data.length);
//     rsp.set('connection', 'close');

//     // logger.info(`WHAT IS THIS IMAGEN ${secondResponse.data}`);
//     return rsp.status(200).send(secondResponse.data);

// }


// /**
//  * Get random cat image.
//  * @param {BreedsOfCats=} catBreeds The list of all possible Cat Breeds filterable.
//  * @returns {Image} the requested image
//  */
// TheCatApi.getRandomCatImage = function(BreedsOfCats = '') {

//     return TheCatApi._getImageUrl(this.response, BreedsOfCats);
// }
TheCatApi.hello = function(){
    return 'WELCOME TO THE WORLD';
}

module.exports = TheCatApi;