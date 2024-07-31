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
    ["imageToMatrix", ["img", "alpha"]],
    ["imageFromMatrix", ["matrix"]],
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

    it("should parse strings - 1", function () {
      const result = MATLAB._parseResult(
        {
          "results": [{
            "mwdata": ["hello world"],
            "mwsize": [1, 1],
            "mwtype": "string",
          }],
          "isError": false,
          "uuid": "",
          "messageFaults": [],
        },
      );
      const expected = "hello world";
      assert.deepEqual(result, expected);
    });
    it("should parse strings - 2", function () {
      const result = MATLAB._parseResult(
        {
          "results": [{
            "mwdata": ["hellotest", "worldtest"],
            "mwsize": [1, 2],
            "mwtype": "string",
          }],
          "isError": false,
          "uuid": "",
          "messageFaults": [],
        },
      );
      const expected = ["hellotest", "worldtest"];
      assert.deepEqual(result, expected);
    });

    it("should parse in column major order - 1", function () {
      const result = MATLAB._parseResult(
        {
          "results": [{
            "mwdata": [1, 1, 1, 1, 1, 1, 1, 1, 1],
            "mwsize": [3, 3],
            "mwtype": "double",
          }],
          "isError": false,
          "uuid": "",
          "messageFaults": [],
        },
      );
      const expected = [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
      assert.deepEqual(result, expected);
    });
    it("should parse in column major order - 2", function () {
      const result = MATLAB._parseResult(
        {
          "results": [{
            "mwdata": [1, 1, 1, 0, 1, 1, 0, 0, 1],
            "mwsize": [3, 3],
            "mwtype": "double",
          }],
          "isError": false,
          "uuid": "",
          "messageFaults": [],
        },
      );
      const expected = [[1, 0, 0], [1, 1, 0], [1, 1, 1]];
      assert.deepEqual(result, expected);
    });
    it("should parse in column major order - 3", function () {
      const result = MATLAB._parseResult(
        {
          "results": [{
            "mwdata": [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            "mwsize": [3, 4],
            "mwtype": "double",
          }],
          "isError": false,
          "uuid": "",
          "messageFaults": [],
        },
      );
      const expected = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];
      assert.deepEqual(result, expected);
    });
    it("should parse in column major order - 4", function () {
      const result = MATLAB._parseResult(
        {
          "results": [{
            "mwdata": [140, 320, 146, 335],
            "mwsize": [2, 2],
            "mwtype": "double",
          }],
          "isError": false,
          "uuid": "",
          "messageFaults": [],
        },
      );
      const expected = [[140, 146], [320, 335]];
      assert.deepEqual(result, expected);
    });

    it("should parse character tensors", function () {
      const result = MATLAB._parseResult(
        {
          "results": [{
            "mwdata": ["00110101"],
            "mwsize": [4, 2],
            "mwtype": "char",
          }],
          "isError": false,
          "uuid": "",
          "messageFaults": [],
        },
      );
      const expected = ["00", "01", "10", "11"];
      assert.deepEqual(result, expected);
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
      const expected = [true, false];
      assert.deepEqual(actual.mwdata, expected);
    });

    it("should preserve numbers", function () {
      const expected = [5, 6];
      const actual = MATLAB._parseArgument(expected);
      assert.deepEqual(actual.mwdata, expected);
    });

    it("should coerce nested lists", function () {
      const example = [["5", "6"], ["7", "9"]];
      const actual = MATLAB._parseArgument(example);
      const expected = [5, 7, 6, 9];
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

  describe("_flatten/_shape", function () {
    it("should flatten recursively - 1", function () {
      const tensor = [
        [[1, 5]],
        [[2, 6]],
        [[3, 7]],
        [[4, 8]],
      ];
      const [flat, shape] = MATLAB._flatten(tensor);
      assert.deepEqual(flat, range(8));
      assert.deepEqual(shape, [4, 1, 2]);
    });

    it("should flatten recursively - 2", function () {
      const tensor = [
        [[1, 9], [5, 13]],
        [[2, 10], [6, 14]],
        [[3, 11], [7, 15]],
        [[4, 12], [8, 16]],
      ];
      const [flat, shape] = MATLAB._flatten(tensor);
      assert.deepEqual(flat, range(16));
      assert.deepEqual(shape, [4, 2, 2]);
    });

    it("should flatten a 1x2 tensor", function () {
      const tensor = [1, 2];
      const [flat, shape] = MATLAB._flatten(tensor);
      assert.deepEqual(flat, [1, 2]);
      assert.deepEqual(shape, [2]);
    });

    it("should flatten a 3x4 tensor", function () {
      const tensor = [
        [1, 2, 3, 4],
        [1, 2, 3, 4],
        [1, 2, 3, 4],
      ];
      const [flat, shape] = MATLAB._flatten(tensor);
      assert.deepEqual(flat, [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
      assert.deepEqual(shape, [3, 4]);
    });
  });

  describe("_unflatten", function () {
    it("should reconstruct a 2x2 matrix", function () {
      const example = [1, 2, 3, 4];
      const actual = MATLAB._unflatten(example, [2, 2]);
      const expected = [[1, 3], [2, 4]];
      assert.deepEqual(actual, expected);
    });

    it("should reconstruct a 3x2 matrix", function () {
      const example = range(6);
      const actual = MATLAB._unflatten(example, [3, 2]);
      const expected = [[1, 4], [2, 5], [3, 6]];
      assert.deepEqual(actual, expected);
    });

    it("should reconstruct a 3x2x2 tensor", function () {
      const example = range(12);
      const actual = MATLAB._unflatten(example, [3, 2, 2]);
      const expected = [
        [[1, 7], [4, 10]],
        [[2, 8], [5, 11]],
        [[3, 9], [6, 12]],
      ];
      assert.deepEqual(actual, expected);
    });

    it("should invert flatten (with shape)", function () {
      const input = [
        [[1, 2, 3], [4, 5, 6]],
        [[7, 8, 9], [10, 11, 12]],
      ];
      const [flat, shape] = MATLAB._flatten(input);
      assert.deepEqual(flat, [1, 7, 4, 10, 2, 8, 5, 11, 3, 9, 6, 12]);
      assert.deepEqual(shape, [2, 2, 3]);
      const reconstructed = MATLAB._unflatten(flat, shape);
      assert.deepEqual(input, reconstructed);
    });

    it("should reconstruct a character tensor", function () {
      const example = ["0", "0", "1", "1", "0", "1", "0", "1"];
      const actual = MATLAB._unflatten(example, [4, 2]);
      const expected = [
        ["0", "0"],
        ["0", "1"],
        ["1", "0"],
        ["1", "1"],
      ];
      assert.deepEqual(actual, expected);
    });
  });

  function range(end) {
    return [...new Array(end)].map((_, i) => i + 1);
  }
});
