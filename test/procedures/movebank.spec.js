const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  utils.verifyRPCInterfaces("Movebank", [
    ["getSensorTypes", []],
    ["getStudies", []],
    ["getStudiesNear", ["latitude", "longitude", "distance"]],
    ["getAnimals", ["study"]],
    ["getEvents", ["study", "animal", "minDistance"]],
  ]);
});
