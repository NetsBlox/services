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
const MusicApp = {};



const soundLibrary = JSON.parse(fs.readFileSync('src/procedures/music-app/NetsBlox-SoundLibrary/netsbloxSoundLibrary.json', 'utf8'));

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


/**
 * Get Sounds based on query.
 * @param {String=} soundType 
 * @returns {Array}
 */
MusicApp._getNamesBySoundType = async function (soundType = ""){
    var names = [];

    //Filter SoundCategories JSON by soundType
    const queriedJSON = soundLibrary.netsbloxSoundLibrary.filter(obj => obj.SoundType === soundType.toUpperCase());
  
    //Convert JSON to array of String names
    for (let i = 0; i < queriedJSON.length; i ++){
        names.push(queriedJSON[i].Name)
    }

    return names;
}

/**
 * Get Sounds based on query.
 * @param {String=} SoundType
 * @param {String=} BPM
 * @param {String=} Key
 * @param {String=} Chords
 * @param {Array=} Keywords
 * @returns {Array}
 */
MusicApp.getSoundNames = async function (SoundType = "", BPM = "", Key = "", Chords = "", Keywords = []){
  var names = [];
  let queriedJSON = "";

  //Check is soundType exists
  if(SoundType.length !== 0){
  // If keywords is empty only filter by soundType
  if (Keywords.length === 0){
    queriedJSON = soundLibrary.netsbloxSoundLibrary.filter(function (obj)
    { return obj.SoundType === SoundType.toUpperCase(); 
    });
  }
  else{
    let returnedJSON = "";

    //Loop through list of keywords given
    for(let i = 0; i < Keywords.length; i++){
      if(i === 0){

        //Filter SoundCategories JSON by soundType and first keyword
        const result = soundLibrary.netsbloxSoundLibrary.filter(function (obj){
          return obj.SoundType === SoundType.toUpperCase() && obj.Name.includes(Keywords[i].toUpperCase());
        });
        returnedJSON = result;
      }
      else{

        //Filter Queried JSON further by next keyword
        returnedJSON = returnedJSON.filter(obj => obj.Name.includes(Keywords[i].toUpperCase()));
      }
    }
    queriedJSON = returnedJSON; 
    }
  }
  else{
    let returnedJSON = "";

    //Loop through list of keywords given
    for(let i = 0; i < Keywords.length; i++){
      if(i === 0){

        //Filter SoundCategories JSON by first keyword
        const result = soundLibrary.netsbloxSoundLibrary.filter(function (obj){
          return obj.Name.includes(Keywords[i].toUpperCase());
        });
        returnedJSON = result;
      }
      else{

        //Filter Queried JSON further by next keyword
        returnedJSON = returnedJSON.filter(obj => obj.Name.includes(Keywords[i].toUpperCase()));
      }
    }
    queriedJSON = returnedJSON; 

  }


  //Convert JSON to array of String names
  for (let i = 0; i < queriedJSON.length; i ++){
      names.push(queriedJSON[i].Name)
  }

  return names;
}

/**
 * Get Sound Metadata based on name.
 * @param {String=} nameOfSound
 * @returns {Array}
 */
MusicApp.getMetaDataByName = async function (nameOfSound = ""){
    const queriedJSON = soundLibrary.netsbloxSoundLibrary.filter(obj => obj.Name === nameOfSound);
    return queriedJSON[0];
}

/**
 * Get Sound based on name.
 * @param {String=} nameOfSound 
 * 
 */
MusicApp.nameToSound = async function (nameOfSound = ""){
    const queriedJSON = soundLibrary.netsbloxSoundLibrary.filter(obj => obj.Name === nameOfSound)
    var audio_path = path.join(__dirname, queriedJSON[0].path)
    return this._filetoBuffer(audio_path);
}
module.exports = MusicApp;
