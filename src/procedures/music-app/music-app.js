/**
 * This service allows users to play songs.
 * @alpha
 * @service
 * @category Music
 */

"use strict";

const fsp = require("fs/promises");
const { registerTypes } = require("./types");
const path = require("path");
const utils = require("../utils/index");
const MusicApp = {};
const soundLibrary = require("./soundLibrary.json");

registerTypes();

MusicApp._filetoBuffer = async function (audio_path) {
  const data = fsp.readFile(audio_path);
  utils.sendAudioBuffer(this.response, data);
};

/**
 * Get Sounds based on query.
 * @param {String=} soundType
 * @returns {Array}
 */
MusicApp._getNamesBySoundType = async function (soundType = "") {
  var names = [];

  //Filter SoundCategories JSON by soundType
  const queriedJSON = soundLibrary.netsbloxSoundLibrary.filter((obj) =>
    obj.SoundType === soundType.toUpperCase()
  );

  //Convert JSON to array of String names
  for (let i = 0; i < queriedJSON.length; i++) {
    names.push(queriedJSON[i].Name);
  }

  return names;
};

/**
 * Get sounds based on query.
 * @param {ChordProgressions=} Chords
 * @param {Keys=} Key
 * @param {BPM=} BPM
 * @param {InstrumentNames=} InstrumentName
 * @returns {Array}
 */
MusicApp.getSoundNames = async function (
  Chords = "",
  Key = "",
  BPM = "",
  InstrumentName = "",
) {
  var names = [];
  let queriedJSON = "";

  //Ensure at least one field is selected
  if (InstrumentName !== "" || BPM !== "" || Key !== "" || Chords !== "") {
    queriedJSON = soundLibrary.netsbloxSoundLibrary.filter(function (obj) { // Check if field value is empty before finding obj with value.
      return (InstrumentName === "" || obj.InstrumentName === InstrumentName) &&
        (BPM === "" || obj.BPM === BPM) &&
        (Key === "" || obj.Key === Key) &&
        (Chords === "" || obj.ChordProgression === Chords);
    });
  } else {
    throw Error("At least one field must be selected");
  }

  //Convert JSON to array of String names
  for (let i = 0; i < queriedJSON.length; i++) {
    names.push(queriedJSON[i].soundName);
  }

  return names;
};

/**
 * Get sound by name.
 * @param {String=} nameOfSound
 */
MusicApp.nameToSound = async function (nameOfSound = "") {
  const metadata = soundLibrary.netsbloxSoundLibrary
    .find((obj) => obj.soundName === nameOfSound);

  if (metadata) {
    const audio_path = path.join(__dirname, metadata.Path);
    return this._filetoBuffer(audio_path);
  }
};

/**
 * Get sound metadata by name.
 * @param {String=} nameOfSound
 * @returns {Array}
 */
MusicApp._getMetaDataByName = async function (nameOfSound = "") {
  const metadata = soundLibrary.netsbloxSoundLibrary
    .find((obj) => obj.soundName === nameOfSound);
  return metadata;
};

module.exports = MusicApp;
