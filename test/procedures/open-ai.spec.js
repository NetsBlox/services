const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  utils.verifyRPCInterfaces("OpenAI", [
    ["setKey", ["key"]],
    ["generateText", ["prompt"]],
    ["generateImage", ["prompt", "size"]],
  ]);
});
