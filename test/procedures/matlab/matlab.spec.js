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

  describe("_shape", function () {
    it("should detect shape in [2,3,4] tensor", function () {
      // TODO
    });
  });

  describe.only("_reshape", function () {
    it("should reconstruct a 2x2 matrix", function () {
      const example = [1, 2, 3, 4];
      const actual = MATLAB._reshape(example, [2, 2]);
      const expected = [[1, 2], [3, 4]];
      assert.deepEqual(actual, expected);
    });

    it("should reconstruct a 3x2 matrix", function () {
      const example = [1, 2, 3, 4, 5, 6];
      const actual = MATLAB._reshape(example, [3, 2]);
      const expected = [[1, 2, 3], [4, 5, 6]];
      assert.deepEqual(actual, expected);
    });

    it("should reconstruct a 3x2x2 tensor", function () {
      const example = range(12);
      const actual = MATLAB._reshape(example, [3, 2, 2]);
      const expected = [
        [[1, 2, 3], [4, 5, 6]],
        [[7, 8, 9], [10, 11, 12]],
      ];
      assert.deepEqual(actual, expected);
    });
  });

  function range(end) {
    return [...new Array(end)].map((_, i) => i + 1);
  }
});
