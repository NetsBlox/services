/**
 * The MATLAB service provides access to MATLAB functions from within NetsBlox!
 *
 * For more information, check out https://www.mathworks.com/products/matlab.html.
 *
 * @alpha
 * @service
 */

const logger = require("../utils/logger")("matlab");
const axios = require("axios");
const jimp = require("jimp");
const utils = require("../utils/index");

const { MATLAB_KEY, MATLAB_URL = "" } = process.env;
const request = axios.create({
  headers: {
    "X-NetsBlox-Auth-Token": MATLAB_KEY,
  },
});

const MATLAB = {};
MATLAB.serviceName = "MATLAB";

async function requestWithRetry(url, body, numRetries = 0) {
  try {
    return await request.post(url, body, {
      timeout: 10000,
    });
  } catch (err) {
    if (err.code === "ECONNABORTED" && numRetries > 0) {
      return requestWithRetry(url, body, numRetries - 1);
    }
    throw err;
  }
}

/**
 * Converts an image/costume into a matrix of pixels, each represented as a list of RGB (``[red, green, blue]``) values.
 *
 * @param {Image} img Image to convert into a matrix
 * @param {Boolean=} alpha ``true`` to include the alpha/transparency values (default ``false``)
 * @returns {Array} The resulting pixel matrix
 */
MATLAB.imageToMatrix = async function (img, alpha = false) {
  let matches = img.match(
    /^\s*\<costume .*image="data:image\/\w+;base64,([^"]+)".*\/\>\s*$/,
  );
  if (!matches) {
    throw Error("unknown image type");
  }

  const raw = Buffer.from(matches[1], "base64");
  img = await jimp.read(raw);
  const [width, height] = [img.bitmap.width, img.bitmap.height];
  logger.log(`deconstructing a ${width}x${height} image`);

  const res = [];
  for (y = 0; y < height; ++y) {
    const row = [];
    for (x = 0; x < width; ++x) {
      const color = jimp.intToRGBA(img.getPixelColor(x, y));
      row.push(
        alpha
          ? [color.r, color.g, color.b, color.a]
          : [color.r, color.g, color.b],
      );
    }
    res.push(row);
  }
  return res;
};

/**
 * Converts a HxWx3 matrix of RGB (``[red, green, blue]``) pixel values into an image.
 * For each pixel, an optional additional alpha/transparency value can be included (default ``255``).
 *
 * @param {Array<Array<Array<BoundedInteger<0, 255>, 3, 4>>>} matrix The input matrix of pixel data
 * @returns {Image} The constructed image/costume
 */
MATLAB.imageFromMatrix = async function (matrix) {
  const height = matrix.length;
  const width = height > 0 ? matrix[0].length : 0;

  for (const row of matrix) {
    if (row.length !== width) {
      throw Error(`input matrix must be rectangular`);
    }
  }
  logger.log(`reconstructing a ${width}x${height} image`);

  const res = new jimp(width, height);
  for (y = 0; y < height; ++y) {
    for (x = 0; x < width; ++x) {
      const [r, g, b, a = 255] = matrix[y][x];
      res.setPixelColor(jimp.rgbaToInt(r, g, b, a), x, y);
    }
  }
  return utils.sendImageBuffer(
    this.response,
    await res.getBufferAsync(jimp.MIME_PNG),
  );
};

/**
 * Evaluate a MATLAB function with the given arguments and number of return
 * values.
 *
 * For a list of all MATLAB functions, see the `Reference Manual <https://www.mathworks.com/help/matlab/referencelist.html?type=function>`__.
 *
 * @param {String} fn Name of the function to call
 * @param {Array<Any>=} args arguments to pass to the function
 * @param {BoundedInteger<1>=} numReturnValues Number of return values expected.
 * @returns {Any} Result of the MATLAB function call
 */
MATLAB.function = async function (fn, args = [], numReturnValues = 1) {
  const body = [{
    function: fn,
    arguments: args.map((a) => this._parseArgument(a)),
    nargout: numReturnValues,
  }];

  // TODO: if this is the first call, start
  // high-level alg:
  //  - start
  //    - batch requests while starting
  //    - send requests on start
  //  - keepWarm
  const startTime = Date.now();
  const resp = await requestWithRetry(`${MATLAB_URL}/feval-fast`, body, 5);
  const duration = Date.now() - startTime;
  logger.info(
    `${duration} body: ${JSON.stringify(body)} response: ${
      JSON.stringify(resp.data)
    }`,
  );

  const results = resp.data.FEvalResponse;
  // TODO: add batching queue
  return this._parseResult(results[0]);
};

/**
 * Convert a NetsBlox argument to the expected format. The MATLAB service expects
 * arguments to be in the following format:
 *
 * {
 *   "mwdata": "<flattened matrix>",
 *   "mwsize": "<actual shape of matrix>",
 *   "mwtype": "logical|double|single|string",
 * }
 */
MATLAB._parseArgument = function (arg) {
  // get the shape, flatten, and coerce types
  if (!Array.isArray(arg)) {
    arg = [arg];
  }

  const [flatValues, shape] = MATLAB._flatten(arg);
  const mwtype = MATLAB._getMwType(flatValues);
  const mwdata = flatValues
    .map((v) => {
      if (mwtype === "logical") {
        return v ? true : false;
      } else if (mwtype === "string") {
        return v.toString();
      } else { // number
        if (typeof v === "string") {
          return parseFloat(v);
        } else if (typeof v === "boolean") {
          return v ? 1 : 0;
        }
        return v;
      }
    });

  return {
    mwdata,
    mwsize: shape.length >= 2 ? shape : [1, ...shape],
    mwtype,
  };
};

MATLAB._getMwType = function (values) {
  if (values.find((v) => typeof v === "string" && isNaN(parseFloat(v)))) {
    return "string";
  } else if (values.every((v) => typeof v === "boolean")) {
    return "logical";
  }
  return "double";
};

MATLAB._parseResult = (result) => {
  if (result.isError) {
    const message = result.messageFaults.map((fault) => fault.message).join(
      "\n",
    );
    throw new Error(message);
  }

  let numReturnValues = result.results.length;
  if (numReturnValues === 1) {
    return MATLAB._parseResultData(result.results[0]);
  } else {
    return result.results.map((retVal) => MATLAB._parseResultData(retVal));
  }
};

MATLAB._parseResultData = (result) => {
  let data = result.mwdata;
  let size = result.mwsize;
  if (!Array.isArray(data)) {
    data = [data];
  }

  if (result.mwtype === "char") {
    if (
      !Array.isArray(result.mwdata) || result.mwdata.length !== 1 ||
      typeof (result.mwdata[0]) !== "string"
    ) {
      throw Error("error parsing character string result");
    }
    function rejoin(x) {
      if (x.length !== 0 && !Array.isArray(x[0])) {
        return x.join("");
      }
      return x.map((y) => rejoin(y));
    }
    return MATLAB._squeeze(rejoin(MATLAB._unflatten([...data[0]], size)));
  }

  return MATLAB._squeeze(MATLAB._unflatten(data, size));
};

MATLAB._squeeze = (data) => {
  while (Array.isArray(data) && data.length === 1) {
    data = data[0];
  }
  return data;
};

MATLAB._product = (vals) => {
  let res = 1;
  for (const v of vals) {
    res *= v;
  }
  return res;
};

MATLAB._colcat = (cols) => {
  if (cols.length === 0) {
    return [];
  }
  if (!Array.isArray(cols[0])) {
    return cols.reduce((acc, v) => acc.concat(v), []);
  }

  const rows = cols[0].length;
  const res = [];
  for (let i = 0; i < rows; ++i) {
    res.push(MATLAB._colcat(cols.map((row) => row[i])));
  }
  return res;
};

MATLAB._unflatten = (data, shape) => {
  if (!Array.isArray(data)) {
    throw Error("internal usage error");
  }

  if (shape.length <= 1) {
    return data;
  }

  const colCount = shape[shape.length - 1];
  const colShape = shape.slice(0, shape.length - 1);
  const colSize = MATLAB._product(colShape);

  const cols = [];
  for (let i = 0; i < colCount; ++i) {
    cols.push(
      MATLAB._unflatten(data.slice(i * colSize, (i + 1) * colSize), colShape),
    );
  }
  return MATLAB._colcat(cols);
};

MATLAB._deepEq = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => MATLAB._deepEq(x, b[i]));
  }
  return a === b;
};

MATLAB._shape = (data) => {
  if (!Array.isArray(data)) {
    throw Error("internal usage error");
  }

  if (data.length === 0 || !Array.isArray(data[0])) {
    if (data.some((x) => Array.isArray(x))) {
      throw Error("input must be rectangular");
    }
    return [data.length];
  }
  if (data.some((x) => !Array.isArray(x))) {
    throw Error("input must be rectangular");
  }

  const shapes = data.map((x) => MATLAB._shape(x));
  if (shapes.some((x) => !MATLAB._deepEq(x, shapes[0]))) {
    throw Error("input must be rectangular");
  }
  return [data.length, ...shapes[0]];
};

// returns [flattened, shape] so that shape can be reused
MATLAB._flatten = (data) => {
  const shape = MATLAB._shape(data);
  if (shape.some((x) => x === 0)) return [[], shape];

  const shapeCumProd = [1, ...shape];
  for (let i = 1; i < shapeCumProd.length; ++i) {
    shapeCumProd[i] *= shapeCumProd[i - 1];
  }

  const res = new Array(shapeCumProd[shapeCumProd.length - 1]);
  function visit(x, pos, depth) {
    if (depth === shape.length) {
      res[pos] = x;
    } else {
      for (let i = 0; i < x.length; ++i) {
        visit(x[i], pos + i * shapeCumProd[depth], depth + 1);
      }
    }
  }
  visit(data, 0, 0);
  return [res, shape];
};

MATLAB.isSupported = () => {
  if (!process.env.MATLAB_URL || !process.env.MATLAB_KEY) {
    console.log("MATLAB_URL and MATLAB_KEY required for MATLAB service");
    return false;
  }
  return true;
};

module.exports = MATLAB;
