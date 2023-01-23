/**
 * The Cats Service provides access to the Cat API data from https://api.thecatapi.com/v1/.
 *
 * @service
 * @category Society
 */


const logger = require('../utils/logger')('Cats');
const axios = require('axios');
const ApiConsumer = require('../utils/api-consumer');

const Cats = {};

// Cats API Url
const apiUrl = 'https://api.thecatapi.com/v1/images/search';
const catsConsumer = new ApiConsumer('cats', apiUrl, {cache: {ttl: 5*60}});

var config = {
    method: 'get',
    url: 'https://api.thecatapi.com/v1/images/search',
    headers: { 
      'Content-Type': 'application/json', 
      'x-api-key': 'live_yL38pOVfFAQFLVu0Pk9bu1R26Msm8cZc6nmckkeymTJ9F3zpjBrCZtVhiM3WD4Pm'
    }
  };

 Cats._getImageUrl = async function(rsp) {
    let catImageUrl = '';

    let firstResponse = await axios(config);
    console.log("FIRST RESPONSE:", typeof firstResponse.data);
    catUrl = firstResponse.data[0].url;
    console.log("FIRST RESPONSE: THIS IS THE URL", typeof catUrl);
    logger.info(`HERE IS MY STRINGY ${catImageUrl}`);
   
    let secondResponse = await axios({url: catImageUrl, method: 'GET', responseType: 'arraybuffer'});

    rsp.set('content-type', 'image/jpeg');
    rsp.set('content-length', secondResponse.data.length);
    rsp.set('connection', 'close');

    // logger.info(`WHAT IS THIS IMAGEN ${secondResponse.data}`);
    return rsp.status(200).send(secondResponse.data);

}


Cats.hello = function() {
    return 'world';
};

/**
 * Get random cat image.
 * @returns {Image} the requested image
 */
Cats.loadRandomCat = function() {

    return Cats._getImageUrl(this.response);
}

module.exports = Cats;