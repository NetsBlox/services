/**
 * This service allows users to access midi files of different songs.
 * @alpha
 * @service
 * @category Music
 */

"use strict";

const fsp = require("fs/promises");
const { registerTypes } = require("./types");
const { MidiReader } = require("./midi-api");
const path = require("path");
const MidiData = {};
const midiLibrary = require("./MidiLibrary/midiLibrary.json");

registerTypes();

/**
 * Get a song by name
 * @param {String=} nameOfSong
 * @returns {[Object{name: String, notes: [Note]}]}
 */
MidiData.getSongData = async function (nameOfSong = "") {
  const metadata = midiLibrary.netsbloxMidiLibrary.find((obj) =>
    obj.Name === nameOfSong
  );
  if (metadata) {
    const midiPath = path.join(__dirname, "./MidiLibrary/", metadata.Path);
    const data = await fsp.readFile(midiPath);
    const raw = new Uint8Array(data);
    const midi = new MidiReader(raw.buffer);
    return midi.getNotes();
  }
  throw new Error("Song not found");
};

/**
 * Get songs based on query.
 * @param {Composers=} composer
 * @param {Styles=} style
 * @param {String=} search
 * @returns {Array}
 */
MidiData.findSong = async function (composer = "", style = "", search = "") {
  var names = [];
  let queriedJSON = "";

  //Ensure at least one field is selected
  if (composer !== "" || search !== "" || style !== "") {
    queriedJSON = midiLibrary.netsbloxMidiLibrary.filter(function (obj) { // Check if field value is empty before finding obj with value.
      return (composer === "" || obj.Composer === composer) &&
        (style === "" || obj.Style === style) &&
        (search === "" || obj.Name.indexOf(search) !== -1);
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

  return names;
};

module.exports = MidiData;
