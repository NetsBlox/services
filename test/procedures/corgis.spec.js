const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  const corgis = utils.reqSrc("procedures/corgis/corgis");
  const datasetRPCs = corgis.allDatasets().map(
    (ds) => [ds.id, ["query", "limit"]],
  );

  utils.verifyRPCInterfaces("Corgis", [
    ["searchDataset", ["name", "query", "limit"]],
    ["availableDatasets", []],
    ["allDatasets"],
    ...datasetRPCs,
  ]);
});
