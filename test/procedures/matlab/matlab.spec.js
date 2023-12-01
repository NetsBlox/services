const utils = require("../../assets/utils");

describe.only(utils.suiteName(__filename), function () {
  const MATLAB = utils.reqSrc(
    "procedures/matlab/matlab",
  );
  const assert = require("assert");
  let testSuite;

  before(async () => {
    testSuite = await utils.TestSuiteBuilder().setup();
  });
  after(() => {
    testSuite.takedown();
  });

  utils.verifyRPCInterfaces("MATLAB", [
    ["feval", ["fn", "args", "numReturnValues"]],
  ]);

  describe("_parseResult", function () {
    it("should extract the result", function () {
      const exampleResponse = {
        "uuid": "UNSPECIFIED",
        "messages": {
          "FEvalResponse": [{
            "results": [[
              0.60964185602745879,
              0.535534059872629,
              0.75432599544689793,
            ]],
            "isError": false,
            "uuid": "",
            "apiVersion": "1.6",
            "messageFaults": [],
          }],
        },
      };
      const result = MATLAB._parseResult(
        exampleResponse.messages.FEvalResponse[0],
      );
      const expected = [
        0.60964185602745879,
        0.535534059872629,
        0.75432599544689793,
      ];
      assert.deepEqual(result, expected);
    });

    it("should throw errors", function () {
      const example = {
        "results": [],
        "isError": true,
        "uuid": "",
        "apiVersion": "1.6",
        "messageFaults": [
          {
            "message":
              "CLASSNAME argument must be a class that supports RAND, such as 'double' or 'single'.",
            "faultCode": "MATLAB.CodeError",
            "faultConditions": [],
          },
        ],
      };
      assert.throws(
        () => MATLAB._parseResult(example),
        /CLASSNAME argument must be a class/,
      );
    });
  });

  describe("_parseArguments", function () {
    it("should coerce number-strings into numbers", function () {
      const example = ["5", "6"];
      const actual = MATLAB._parseArguments(example);
      const expected = [5, 6];
      assert.deepEqual(actual, expected);
    });

    it("should preserve numbers", function () {
      const expected = [5, 6];
      const actual = MATLAB._parseArguments(expected);
      assert.deepEqual(actual, expected);
    });

    it("should coerce nested lists", function () {
      const example = [["5", "6"], "7"];
      const actual = MATLAB._parseArguments(example);
      const expected = [[5, 6], 7];
      assert.deepEqual(actual, expected);
    });

    it("should ignore non-numbers", function () {
      const example = ["5", "cat"];
      const actual = MATLAB._parseArguments(example);
      const expected = [5, "cat"];
      assert.deepEqual(actual, expected);
    });
  });
});
