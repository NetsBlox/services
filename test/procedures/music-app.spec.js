const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  utils.verifyRPCInterfaces("MusicApp", [
    ["getSoundNames"["InstrumentName", "BPM", "Key", "Chords"]],
    ["nameToSound", ["nameOfSound"]],
  ]);
});
