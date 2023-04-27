/**
 * This service allows users to play songs.
 * @alpha
 * @service
 * @category Music
 */

"use strict";

const fs = require("fs");
const path = require("path");
const utils = require("../utils/index");
const { registerTypes, SOUNDS } = require("./sounds");
const MusicApp = {};
registerTypes();



const localSounds = JSON.parse(fs.readFileSync('src/procedures/music-app/soundCategories.json', 'utf8'));


MusicApp._filetoBuffer = function(audio_path){
    return new Promise((resolve, reject) => {
        fs.readFile(audio_path, (err, data) => {
          // error handle
          if (err) {
            throw err;
          }
          utils.sendAudioBuffer(this.response, data);
          resolve();
        });
      });
}

// /**
//  * Play Available Sound.
//  * @param {AvailableSounds=} availableSound provides a sound from the list of stored sounds
//  */
// MusicApp.playableSounds = function (availableSound = "") {
//   var audio_path = path.join(__dirname, availableSound);

//   return this._filetoBuffer(audio_path);
  
// };

/**
 * Get Sounds based on query.
 * @param {String=} soundType 
 * @returns {Array}
 */
MusicApp._getNamesBySoundType = async function (soundType = ""){
    var names = [];

    //Filter SoundCategories JSON by soundType
    const queriedJSON = localSounds.soundCategories.filter(obj => obj.soundType === soundType.toUpperCase());
  
    //Convert JSON to array of String names
    for (let i = 0; i < queriedJSON.length; i ++){
        names.push(queriedJSON[i].name)
    }

    return names;
}

/**
 * Get Sounds based on query.
 * @param {String=} soundType 
 * @param {Array=} keywords
 * @returns {Array}
 */
MusicApp.getSoundNames = async function (soundType = "", keywords = []){
  var names = [];
  let queriedJSON = "";

  // If keywords is empty only filter by soundType
  if (keywords.length === 0){
    queriedJSON = localSounds.soundCategories.filter(function (obj)
    { return obj.soundType === soundType.toUpperCase(); 
    });
  }
  else{
    let returnedJSON = "";

    //Loop through list of keywords given
    for(let i = 0; i < keywords.length; i++){
      if(i === 0){

        //Filter SoundCategories JSON by soundType and first keyword
        const result = localSounds.soundCategories.filter(function (obj){
          return obj.soundType === soundType.toUpperCase() && obj.name.includes(keywords[i].toUpperCase());
        });
        returnedJSON = result;
      }
      else{

        //Filter Queried JSON further by next keyword
        returnedJSON = returnedJSON.filter(obj => obj.name.includes(keywords[i].toUpperCase()));
      }
    }
    queriedJSON = returnedJSON;
}

  //Convert JSON to array of String names
  for (let i = 0; i < queriedJSON.length; i ++){
      names.push(queriedJSON[i].name)
  }

  return names;
}

/**
 * Get Sound Metadata based on name.
 * @param {String=} nameOfSound
 * @returns {Array}
 */
MusicApp.getMetaDataByName = async function (nameOfSound = ""){
    const queriedJSON = localSounds.soundCategories.filter(obj => obj.name === nameOfSound);
    return queriedJSON[0];
}

/**
 * Get Sound based on name.
 * @param {String=} nameOfSound 
 * 
 */
MusicApp.nameToSound = async function (nameOfSound = ""){
    const queriedJSON = localSounds.soundCategories.filter(obj => obj.name === nameOfSound)
    var audio_path = path.join(__dirname, queriedJSON[0].path)
    return this._filetoBuffer(audio_path);
}
module.exports = MusicApp;
