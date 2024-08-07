const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  utils.verifyRPCInterfaces("DailyWordGuess", [
    ["getWordList", []],
    ["giveUp", []],
    ["guess", ["word"]],
    ["timeRemaining", []],
    ["triesRemaining", []],
  ]);

  const assert = require("assert");
  const DailyWordGuess = utils.reqSrc(
    "procedures/daily-word-guess/daily-word-guess",
  );
  let testSuite;
  before(async () => testSuite = await utils.TestSuiteBuilder().setup());
  after(() => testSuite.takedown());

  it("should have same result when simultaneous requests made to _getDailyWord", async function () {
    const concurrentCalls = [...new Array(50)];
    const currentWordList = await Promise.all(
      concurrentCalls.map(() => DailyWordGuess._getDailyWord()),
    );
    assert.deepEqual(
      currentWordList,
      new Array(currentWordList.length).fill(currentWordList[0]),
    );
  });
});
