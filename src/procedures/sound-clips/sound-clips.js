/**
 * This service allows users to play songs.
 * @alpha
 * @service
 * @category Music
 */

"use strict";

const fsp = require("fs/promises");
const { registerTypes } = require("./types");
const { MidiReader } = require("./src/midi-api");
const path = require("path");
const utils = require("../utils/index");
const SoundClips = {};
const soundLibrary = require("./SoundLibrary/soundLibrary.json");
const drumLibrary = require("./SoundLibrary/drumSoundLibrary.json");
const fxLibrary = require("./SoundLibrary/fxSoundLibrary.json");
const midiLibrary = require("./MidiLibrary/midiLibrary.json");
const masterSoundLibrary = [
  ...soundLibrary.netsbloxSoundLibrary,
  ...drumLibrary.drumSoundLibrary,
  ...fxLibrary.fxSoundLibrary,
];

registerTypes();

SoundClips._filetoBuffer = async function (audio_path) {
  const data = await fsp.readFile(audio_path);
  utils.sendAudioBuffer(this.response, data);
};


/**
 * Get sounds based on query.
 * @param {DrumPackName=} packName
 * @param {DrumOneShotTypes=} drumType
 * @returns {String}
 */
SoundClips.getDrumOneShotNames = async function (
  packName = "",
  drumType = "",
) {
  var names = [];
  let queriedJSON = "";

  //Ensure at least one field is selected
  if (packName !== "" || drumType !== "") {
    queriedJSON = drumLibrary.drumSoundLibrary.filter(function (obj) { // Check if field value is empty before finding obj with value.
      return (packName === "" || obj.packName === packName) &&
        (drumType === "" || obj.Instrument === drumType);
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
 * Get sounds based on query.
 * @param {Chords=} chords
 * @param {Keys=} key
 * @param {BPM=} bpm
 * @param {InstrumentNames=} instrumentName
 * @returns {Array}
 */
SoundClips.getSoundNames = async function (
  chords = "",
  key = "",
  bpm = "",
  instrumentName = "",
) {
  var names = [];
  let queriedJSON = "";

  //Ensure at least one field is selected
  if (chords !== "" || key !== "" || bpm !== "" || instrumentName !== "") {
    queriedJSON = soundLibrary.netsbloxSoundLibrary.filter(function (obj) { // Check if field value is empty before finding obj with value.
      return (instrumentName === "" || obj.InstrumentName === instrumentName) &&
        (bpm === "" || obj.BPM === bpm) &&
        (key === "" || obj.Key === key) &&
        (chords === "" || obj.ChordProgression === chords);
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
 * Get fx sounds 
 * @returns {Array}
 */
SoundClips.getFXSounds = async function(){
  var names = [];
  let queriedJSON = "";
  queriedJSON = fxLibrary.fxSoundLibrary;
  //Convert JSON to array of String names
  for (let i = 0; i < queriedJSON.length; i++) {
    names.push(queriedJSON[i].soundName);
  }
  return names;

}

/**
 * Get sound by name.
 * @param {String=} nameOfSound
 */
SoundClips.nameToSound = async function (nameOfSound = "") {
  const metadata = masterSoundLibrary
    .find((obj) => obj.soundName === nameOfSound);

  if (metadata) {
    const audioPath = path.join(__dirname, metadata.Path);
    const data = await fsp.readFile(audioPath);
    return utils.sendAudioBuffer(this.response, data);
  }
};

/**
 * Get Sounds based on query.
 * @param {String=} soundType
 * @returns {Array}
 */
SoundClips._getNamesBySoundType = async function (soundType = "") {
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
 * Get sound metadata by name.
 * @param {String=} nameOfSound
 * @returns {Array}
 */
SoundClips._getMetaDataByName = async function (nameOfSound = "") {
  const metadata = soundLibrary.netsbloxSoundLibrary
    .find((obj) => obj.soundName === nameOfSound);
  return metadata;
};

/**
 * Get a song by name
 * @param {String=} nameOfSong
 * @returns {[Object{name: String, notes: [Note]}]}
 */
SoundClips._getSong = async function (nameOfSong = "") {
  const metadata = midiLibrary.netsbloxMidiLibrary.find((obj) =>
    obj.Name === nameOfSong
  );
  if (metadata) {
    const audioPath = path.join(__dirname, metadata.Path);
    const data = await fsp.readFile(audioPath);
    const raw = new Uint8Array(data);
    const midi = new MidiReader(raw.buffer);
    return midi.getNotes();
  }
  throw new Error("Song not found");
};

/**
 * Get songs based on query.
 * @param {String=} composer
 * @param {String=} name
 * @returns {Array}
 */
SoundClips._getSongNames = async function (composer = "", name = "") {
  var names = [];
  let queriedJSON = "";

  //Ensure at least one field is selected
  if (composer !== "" || name !== "") {
    queriedJSON = midiLibrary.netsbloxMidiLibrary.filter(function (obj) { // Check if field value is empty before finding obj with value.
      return (composer === "" || obj.Composer === composer) &&
        (name === "" || obj.Name === name);
    });
  } else {
    queriedJSON = midiLibrary.netsbloxMidiLibrary.filter(function (obj) {
      return true;
    });
  }

  //Convert JSON to array of String names
  for (let i = 0; i < queriedJSON.length; i++) {
    names.push(queriedJSON[i].Name);
  }

  if (names.length == 1) {
    return names[0];
  }
  return names;
};

module.exports = SoundClips;
