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

/**
 * Play Available Sound.
 * @param {AvailableSounds=} availableSound provides a sound from the list of stored sounds
 */
MusicApp.playableSounds = function (availableSound = "") {
  var audio_path = path.join(__dirname, availableSound);

  return this._filetoBuffer(audio_path);
  
};

MusicApp.playSynth = function(){
    const synth = new Tone.Synth().toDestination();
    synth.triggetAttackRelease("C4", "8n");
}

/**
 * Get Sounds based on query.
 * @param {String=} soundType 
 * @returns {Array}
 */
MusicApp.getNamesBySoundType = async function (soundType = ""){
    var names = [];
    const queriedJSON = localSounds.soundCategories.filter(obj => obj.soundType === soundType.toUpperCase());
  
    for (let i = 0; i < queriedJSON.length; i ++){
        names.push(queriedJSON[i].name)
    }
    console.dir(names);

    return names;
}

/**
 * Get Sound Metadata based on name.
 * @param {String=} nameOfSound
 * @returns {Array}
 */
MusicApp.getMetaDataByName = async function (nameOfSound = ""){
    var metadata = [];
    const queriedJSON = localSounds.soundCategories.filter(obj => obj.name === nameOfSound);
  
    // for (let i = 0; i < queriedJSON.length; i ++){
    //     names.push(queriedJSON[i].name)
    // }
    console.dir(queriedJSON[0]);

    return queriedJSON[0];
}

/**
 * Get Sound based on name.
 * @param {String=} nameOfSound 
 * 
 */
MusicApp.getSoundByName = async function (nameOfSound = ""){
    const queriedJSON = localSounds.soundCategories.filter(obj => obj.name === nameOfSound)
    var audio_path = path.join(__dirname, queriedJSON[0].path)
    return this._filetoBuffer(audio_path);
}
module.exports = MusicApp;
