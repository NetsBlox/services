const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  const MockService = require("../assets/mock-service");
  const MusicApp = utils.reqSrc(
    "procedures/music-app/music-app",
  );
  const assert = require("assert");
  let service, testSuite;

  utils.verifyRPCInterfaces("MusicApp", [
    ["getSoundNames", ["chords", "key", "bpm", "instrumentName"]],
    ["nameToSound", ["nameOfSound"]],
    ["getDrumOneShotNames", ["packName", "drumType"]],
  ]);

  before(async () => {
    testSuite = await utils.TestSuiteBuilder().setup();
    service = new MockService(MusicApp);
  });
  after(() => {
    testSuite.takedown();
  });

  it("should return audio buffer in response", async function () {
    const names = await service.getSoundNames("1564");
    await service.nameToSound(names[0]);
    const response = service.response;
    assert.equal(response.code, 200);
    const buffer = response.response;
    assert(buffer.length > 100);
  });
});
