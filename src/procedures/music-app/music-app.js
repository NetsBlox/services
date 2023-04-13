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

const localSounds = JSON.parse(
  fs.readFileSync("src/procedures/music-app/availableSounds.json", "utf8"),
);

/**
 * Play Available Sound.
 * @param {AvailableSounds=} availableSound provides a sound from the list of stored sounds
 */
MusicApp.playableSounds = function (availableSound = "") {
  var audio_path = path.join(__dirname, availableSound);

  // read image file
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
};

/**
 * Get Sounds based on query.
 * @param {String=} soundType
 */
MusicApp.querySound = async function (soundType = "") {
  const queriedJSON = localSounds.availableSounds.filter((obj) =>
    obj.name === "COMMON_LOVE_VOX_ADLIB_4.mp3"
  );

  return JSON.stringify(queriedJSON);
};
module.exports = MusicApp;
