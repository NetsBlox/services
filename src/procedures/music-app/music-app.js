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
 * @param {InstrumentNames=} InstrumentName
 * @param {BPM=} BPM
 * @param {Keys=} Key
 * @param {ChordProgressions=} Chords
 * @returns {Array}
 */
MusicApp.getSoundNames = async function (
  InstrumentName = "",
  BPM = "",
  Key = "",
  Chords = "",
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
    const audioPath = path.join(__dirname, metadata.Path);
    const data = await fsp.readFile(audioPath);
    return utils.sendAudioBuffer(this.response, data);
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
