const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  utils.verifyRPCInterfaces("GlobalBiodiversity", [
    ["searchSpecies", ["nameType", "name", "page"]],
    ["getParent", ["id"]],
    ["getChildren", ["id", "page"]],
    ["getMediaURLs", ["type", "id", "page"]],
    ["getImage", ["url"]],
    ["getSound", ["url"]],
  ]);
});
