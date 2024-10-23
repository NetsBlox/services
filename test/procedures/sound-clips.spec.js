const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  const MockService = require("../assets/mock-service");
  const SoundClips = utils.reqSrc(
    "procedures/sound-clips/sound-clips",
  );
  const assert = require("assert");
  let service, testSuite;

  utils.verifyRPCInterfaces("SoundClips", [
    ["getSoundNames", ["chords", "key", "bpm", "instrumentName"]],
    ["getSoundNamesByInstruments", ["instrumentFamily", "key", "bpm"]],
    ["nameToSound", ["nameOfSound"]],
    ["getDrumOneShotNames", ["packName", "drumType"]],
    ["getDrumLoopNames", ["packName", "bpm"]],
    ["getFXSoundNames"],
  ]);

  before(async () => {
    testSuite = await utils.TestSuiteBuilder().setup();
    service = new MockService(SoundClips);
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
