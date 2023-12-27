const utils = require("../../assets/utils");

describe(utils.suiteName(__filename), function () {
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
    ["function", ["fn", "args", "numReturnValues"]],
  ]);

  describe("_parseResult", function () {
    it("should extract the result", function () {
      const exampleResponse = {
        "uuid": "UNSPECIFIED",
        "messages": {
          "FEvalResponse": [{
            "results": [{
              mwdata: [
                0.60964185602745879,
                0.535534059872629,
                0.75432599544689793,
              ],
              mwsize: [1, 3],
              mwtype: "double",
            }],
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

    it("should extract multiple results", function () {
      const exampleResponse = {
        "uuid": "UNSPECIFIED",
        "messages": {
          "FEvalResponse": [{
            "results": [
              {
                mwdata: [
                  0.60964185602745879,
                  0.535534059872629,
                  0.75432599544689793,
                ],
                mwsize: [1, 3],
                mwtype: "double",
              },
              {
                mwdata: [3],
                mwsize: [1, 1],
                mwtype: "double",
              },
            ],
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
        [
          0.60964185602745879,
          0.535534059872629,
          0.75432599544689793,
        ],
        3,
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

  describe("_parseArgument", function () {
    it("should coerce number-strings into numbers", function () {
      const example = ["5", "6"];
      const actual = MATLAB._parseArgument(example);
      const expected = [5, 6];
      assert.deepEqual(actual.mwdata, expected);
    });

    it("should coerce booleans to 1/0", function () {
      const example = [true, false];
      const actual = MATLAB._parseArgument(example);
      const expected = [1, 0];
      assert.deepEqual(actual.mwdata, expected);
    });

    it("should preserve numbers", function () {
      const expected = [5, 6];
      const actual = MATLAB._parseArgument(expected);
      assert.deepEqual(actual.mwdata, expected);
    });

    it("should coerce nested lists", function () {
      const example = [["5", "6"], "7"];
      const actual = MATLAB._parseArgument(example);
      const expected = [5, 6, 7];
      assert.deepEqual(actual.mwdata, expected);
    });

    it("should ignore non-numbers", function () {
      const example = ["5", "cat"];
      const actual = MATLAB._parseArgument(example);
      const expected = [5, "cat"];
      assert.deepEqual(actual.mwdata, expected);
    });

    it("should handle scalars", function () {
      const example = 5;
      const actual = MATLAB._parseArgument(example);
      const expected = [5];
      assert.deepEqual(actual.mwdata, expected);
      assert.deepEqual(actual.mwsize, [1, 1]);
    });
  });

  describe("_getMwType", function () {
    it("should return string if has any strings", function () {
      const mwtype = MATLAB._getMwType([1, 2, 3, "cat"]);
      assert.equal(mwtype, "string");
    });

    it("should return logical if all bools", function () {
      const mwtype = MATLAB._getMwType([true, false, true]);
      assert.equal(mwtype, "logical");
    });

    it("should default to double", function () {
      const mwtype = MATLAB._getMwType([1.]);
      assert.equal(mwtype, "double");
    });
  });

  describe("_flatten", function () {
    it("should flatten recursively", function () {
      const tensor = [
        [
          [1, 5],
        ],
        [
          [2, 6],
        ],
        [
          [3, 7],
        ],
        [
          [4, 8],
        ],
      ];
      const flat = MATLAB._flatten(tensor);
      assert.deepEqual(flat, range(8));
    });

    it("should flatten cols then rows", function () {
      const mat = [
        [1, 3],
        [2, 4],
      ];
      const flat = MATLAB._flatten(mat);
      assert.deepEqual(flat, range(4));
    });
  });

  describe("_shape", function () {
    it("should detect shape in [4,1,2] tensor", function () {
      const tensor = [
        [[1, 2]],
        [[1, 2]],
        [[1, 2]],
        [[1, 2]],
      ];
      const actual = MATLAB._shape(tensor);
      assert.deepEqual(actual, [4, 1, 2]);
    });

    it("should detect shape in [1 2] tensor", function () {
      const tensor = [1, 2];
      const actual = MATLAB._shape(tensor);
      assert.deepEqual(actual, [1, 2]);
    });

    it("should detect shape in [3, 4] tensor", function () {
      const tensor = [
        [1, 2, 3, 4],
        [1, 2, 3, 4],
        [1, 2, 3, 4],
      ];
      const actual = MATLAB._shape(tensor);
      assert.deepEqual(actual, [3, 4]);
    });
  });

  describe("_reshape", function () {
    it("should reconstruct a 2x2 matrix", function () {
      const example = [1, 2, 3, 4];
      const actual = MATLAB._reshape(example, [2, 2]);
      const expected = [[1, 3], [2, 4]];
      assert.deepEqual(actual, expected);
    });

    it("should reconstruct a 3x2 matrix", function () {
      const example = range(6);
      const actual = MATLAB._reshape(example, [3, 2]);
      const expected = [[1, 4], [2, 5], [3, 6]];
      assert.deepEqual(actual, expected);
    });

    it("should reconstruct a 2x3x4 tensor", function () {
      const example = range(24);
      const actual = MATLAB._reshape(example, [2, 3, 4]);
      const expected = [
        [
          [1, 3, 5],
          [2, 4, 6],
        ],
        [
          [7, 9, 11],
          [8, 10, 12],
        ],
        [
          [13, 15, 17],
          [14, 16, 18],
        ],
        [
          [19, 21, 23],
          [20, 22, 24],
        ],
      ];
      assert.deepEqual(actual, expected);
    });

    it("should invert flatten (with shape)", function () {
      const input = [
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        [
          [7, 8, 9],
          [10, 11, 12],
        ],
      ];
      const shape = MATLAB._shape(input);
      const reconstructed = MATLAB._reshape(MATLAB._flatten(input), shape);
      assert.deepEqual(input, reconstructed);
    });
  });

  // TODO: get the indices for reshaping
  describe("_reshapeIdx", function () {
    it("should get columns first", function () {
      const idx = MATLAB._reshapeIdx([3, 2]);
      console.log({ idx });
      // TODO
    });

    it("should return indices for every value", function () {
      // TODO
    });

    it("should get pages", function () {
      // TODO: count and map counts to indices (a weird, reversed, mixed-base thing)
      // TODO
    });
  });

  describe("_toMixedBase", function () {
    it("should represent 10 in [6s, 3s, 1s]", function () {
      const actual = MATLAB._toMixedBase(10, [6, 3, 1]);
      assert.deepEqual(actual, [1, 1, 1]);
    });
  });

  function range(end) {
    return [...new Array(end)].map((_, i) => i + 1);
  }
});
