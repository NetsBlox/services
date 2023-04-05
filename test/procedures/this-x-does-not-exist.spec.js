'use strict';

const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  const rpcs = [
    ["getPerson", []],
    ["getCat", []],
    ["getHorse", []],
    ["getArtwork", []],
    ["getWaifu", []],
    ["getFursona", []],
    ["getPony", []],
    ["getHomeInterior", []],
    ["getCongressPerson", []],
  ];
  const deprecated = [
    'getArtwork',
    'getPerson',
    'getCat',
    'getHorse',
  ];
  utils.verifyRPCInterfaces("ThisXDoesNotExist", rpcs);

  const xdneSrc = utils.reqSrc("procedures/this-x-does-not-exist/this-x-does-not-exist");
  const RPCMock = require("../assets/mock-service");
  let xdne;

  before(async () => {
    xdne = new RPCMock(xdneSrc);
  });
  after(() => {
    xdne.destroy();
  });

  describe("rpcs", function () {
    for (const [rpc, params] of rpcs) {
      if (params.length !== 0 || deprecated.some(x => x === rpc)) continue;
      it(`should successfully invoke '${rpc}'`, async function () {
        await xdne[rpc]();
      });
    }
  });
});
