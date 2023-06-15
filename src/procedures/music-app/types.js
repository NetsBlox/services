const types = require("../../input-types");

const INSTRUMENTS = {
    Piano: "PIANO",
    Synth: "SYNTH",
    Bass: "BASS"
};

const NAMES = [
    "Liverpool",
    "BrightSynthBrass",
    "FingerstyleBass",
    "SolidSoulElectricBass",
    "GhostlyReversedOrgan",
    "PulsatingWaves",
    "80sWaveBells",
    "DreamSinesPad",
    "SunriseChords",
    "AcousticGuitar",
    "CloudyPluckedSynth",
    "BrightDigitalChords",
    "BoardingArea",
    "Saxophone",
    "FutureFeelsBrass",
    "JazzOrgan",
    "ToyPiano",
    "ClassicElectricPiano",
    "Steinway",
    "ClassicSuitcase",
    "ClassicSuitcasePiano",
    "ChilledClav",
    "FadedKeys",
    "90sSolidSynthBass",
    "SolidSoulElectricBass"


]

const KEYS = [
    "C",
    "C#",
    "D",
    "Eb",
    "E",
    "F",
    "F#",
    "G",
    "Ab",
    "A",
    "Bb",
    "B"
]

const BPM = [
    "70BPM",
    "80BPM",
    "90BPM",
    "100BPM",
    "110BPM"
]

const CHORDS = [
    "1564",
    "1251",
    "3625"
]

function registerTypes() {
    types.defineType({
      name: "Instruments",
      description: "List of available Instruments",
      baseType: "Enum",
      baseParams: INSTRUMENTS,
    });

    types.defineType({
        name: "Keys",
        description: "List of available keys",
        baseType: "Enum",
        baseParams: KEYS,
      });

      types.defineType({
        name: "BPM",
        description: "List of available BPMs",
        baseType: "Enum",
        baseParams: BPM,
      });

      types.defineType({
        name: "ChordProgressions",
        description: "List of available ChordProgressions",
        baseType: "Enum",
        baseParams: CHORDS,
      });
      types.defineType({
        name: "InstrumentNames",
        description: "List of available Instruments",
        baseType: "Enum",
        baseParams: NAMES,
      });
  }
  
module.exports = { registerTypes};