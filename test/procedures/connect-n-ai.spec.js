const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  utils.verifyRPCInterfaces("ConnectNAI", [
    ["newSession", []],
    ["newGame", ["rows", "cols", "n", "gravity"]],
    ["makeMove", ["row", "col", "player"]],
    ["getAIMoves", ["player"]],
    ["useMaxDifficulty", []],
  ]);
});
