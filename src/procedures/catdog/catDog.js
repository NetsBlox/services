/**
 * The Cats Service provides access to the Cat API data from https://api.thecatapi.com/v1/.
 *
 * @service
 * @category Society
 */


const logger = require('../utils/logger')('CatDog');
const axios = require('axios');
const types = require('../../input-types');
const ApiConsumer = require('../utils/api-consumer');

// types used to communicate with CatDog
types.defineType({
    name: 'CatBreeds',
    description: 'This is a list of Cat breeds available',
    baseType: 'Enum',
    baseParams: { 
        Abyssinian: "abys",
        Aegean: "aege",
        AmericanBobtail: "abob",
        AmericanCurl: "acur",
        AmericanShorthair: "asho",
        AmericanWirehair: "awir",
        ArabianMau: "amau",
        AustralianMist: "amis",
        Balinese: "bali",
        Bambino: "bamb",
        Bengal: "beng",
        Birman: "birm",
        Bombay: "bomb",
        BritishLonghair: "bslo",
        BritishShorthair: "bsho",
        Burmese: "bure",
        Burmilla: "buri",
        CaliforniaSpangled: "cspa",
        ChantillyTiffany: "ctif",
        Chartreux: "char",
        Chausie: "chau",
        Cheetoh: "chee",
        ColorpointShorthair: "csho",
        CornishRex: "crex",
        Cymric: "cymr",
        Cyprus: "cypr",
        DevonRex: "drex",
        Donskoy: "dons",
        DragonLi: "lihu",
        EgyptianMau: "emau",
        EuropeanBurmese: "ebur",
        ExoticShorthair: "esho",
        HavanaBrown: "hbro",
        Himalayan: "hima",
        JapaneseBobtail: "jbob",
        Javanese: "java",
        KhaoManee: "khao",
        Korat: "kora",
        Kurilian: "kuri",
        LaPerm: "lape",
        MaineCoon: "mcoo",
        Malayan: "mala",
        Manx: "manx",
        Munchkin: "munc",
        Nebelung: "nebe",
        NorwegianForestCat: "norw",
        Ocicat: "ocic",
        Oriental: "orie",
        Persian: "pers",
        Pixiebob: "pixi",
        Ragamuffin: "raga",
        Ragdoll: "ragd",
        RussianBlue: "rblu",
        Savannah: "sava",
        ScottishFold: "sfol",
        SelkirkRex: "srex",
        Siamese: "siam",
        Siberian: "sibe",
        Singapura: "sing",
        Snowshoe: "snow",
        Somali: "soma",
        Sphynx: "sphy",
        Tonkinese: "tonk",
        Toyger: "toyg",
        TurkishAngora: "tang",
        TurkishVan: "tvan",
        YorkChocolate: "ycho"
        
    },
});
types.defineType({
    name: 'DogBreeds',
    description: 'This is a list of Dog breeds available.',
    baseType: 'Enum',
    baseParams: { slider: 0, progress: 1 },
});

const CatDog = {};

// Cats API Url
const catApiUrl = 'https://api.thecatapi.com/v1/images/search';
// Dogs API Url
const dogApiUrl = 'https://api.thedogapi.com/v1/images/search';
// const catDogConsumer = new ApiConsumer('catDog', apiUrl, {cache: {ttl: 5*60}});


 CatDog._getImageUrl = async function(rsp, animalType) {
    let apiUrl = '';
    
    if(animalType === "CAT"){
        apiUrl = 'https://api.thecatapi.com/v1/images/search';
    }
    else{
        apiUrl = 'https://api.thedogapi.com/v1/images/search';
    }

    var config = {
        method: 'get',
        url: apiUrl,
        // headers: { 
        //   'Content-Type': 'application/json', 
        //   'x-api-key': 'live_yL38pOVfFAQFLVu0Pk9bu1R26Msm8cZc6nmckkeymTJ9F3zpjBrCZtVhiM3WD4Pm'
        // }
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


CatDog.hello = function() {
    return 'world';
};

/**
 * Get random cat image.
 * @returns {Image} the requested image
 */
CatDog.loadRandomCatImage = function() {

    return CatDog._getImageUrl(this.response, "CAT");
}

/**
 * Get random dog image.
 * @returns {Image} the requested image
 */
CatDog.loadRandomDogImage = function() {

    return CatDog._getImageUrl(this.response, "DOG");
}

module.exports = CatDog;