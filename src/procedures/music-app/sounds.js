const types = require("../../input-types");

const SOUNDS = {
    RnBRhodes4: "YG_RNB_RHODES_4.mp3",
    RnBPiano4: "YG_RNB_RHODES_4.mp3",
    WestCoastHipHopString1: "./availableSounds/YG_WEST_COAST_HIP_HOP_STRINGS_1.mp3",

};

function registerTypes() {
    types.defineType({
      name: "AvailableSounds",
      description: "List of available sounds",
      baseType: "Enum",
      baseParams: SOUNDS,
    });
  }
  
  module.exports = { registerTypes, SOUNDS };