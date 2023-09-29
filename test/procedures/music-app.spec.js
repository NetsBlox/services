const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  utils.verifyRPCInterfaces("MusicApp", [
    ["getSoundNames"],
    ["nameToSound", ["nameToSound"]],
  ]);
});
