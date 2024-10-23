const types = require("../../input-types");

const INSTRUMENTS = {
  Piano: "PIANO",
  Synth: "SYNTH",
  Bass: "BASS",
};

const DRUMONESHOTTYPES = {
  Kick: "KICK",
  Snare: "SNARE",
  Toms: "TOMS",
  HiHat: "HI-HAT",
  Clap: "CLAP",
  Cymbal: "CYMBAL",
  Percussion: "PERCUSSION",
  FX: "FX",
};
const DRUMPACKS = {
  PeaceKit: "PeaceTreaty",
  UKKit: "UK",
  USKit: "US",
  DSSKit: "DSSxDP",
  AfricanKit: "African",
};

const NAMES = [
  "AcousticGuitar",
  "BoardingArea",
  "BrightDigitalChords",
  "BrightSynthBrass",
  "ChilledClav",
  "ClassicElectricPiano",
  "ClassicSuitcase",
  "ClassicSuitcasePiano",
  "CloudyPluckedSynth",
  "DreamSinesPad",
  "DriftingPulsations",
  "FadedKeys",
  "FingerstyleBass",
  "FutureFeelsBrass",
  "GhostlyReversedOrgan",
  "JazzOrgan",
  "Liverpool",
  "PulsatingWaves",
  "Saxophone",
  "SolidSoulElectricBass",
  "SunriseChords",
  "Steinway",
  "ToyPiano",
  "80sWaveBells",
  "90sSolidSynthBass",
];

const INSTRUMENTFAMILY = {
  Piano: [ "Steinway",
            "ToyPiano",
            "ClassicSuitcasePiano",
            "ClassicSuitcase",
            "ClassicElectricPiano",
            "FadedKeys",
            "ChilledClav",
            "JazzOrgan",
  ],
  Synth:["GhostlyReversedOrgan",
         "SunriseChords",
         "80sWaveBells",
         "BoardingArea",
         "BrightDigitalChords",
         "CloudyPluckedSynth",
         "DreamSinesPad",
         "DriftingPulsations",
         "PulsatingWaves",
  ],
  Guitar: ["AcousticGuitar",    
  ],
  Bass: ["Liverpool",
         "FingerstyleBass",
         "SolidSoulElectricBass",
         "90sSolidSynthBass",
         "BrightSynthBrass",
  ],
  Brass:["FutureFeelsBrass",
        "Saxophone",
  ]

}

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
  "B",
];

const CHORDS = [
  "1564",
  "1251",
  "3625",
];

const BPM = [
  "70BPM",
  "80BPM",
  "90BPM",
  "100BPM",
  "110BPM",
  "120BPM",
  "130BPM",
];


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
    name: "Chords",
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

  types.defineType({
    name: "DrumOneShotTypes",
    description: "List of available One-Shot Types",
    baseType: "Enum",
    baseParams: DRUMONESHOTTYPES,
  });

  types.defineType({
    name: "DrumPackName",
    description: "List of available Drum Packs",
    baseType: "Enum",
    baseParams: DRUMPACKS,
  });

  types.defineType({
    name: "InstrumentFamily",
    description: "List of available Instrument families",
    baseType: "Enum",
    baseParams: INSTRUMENTFAMILY,
  });
}

module.exports = { registerTypes,INSTRUMENTFAMILY};
