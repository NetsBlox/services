/**
 * The MATLAB service provides access to MATLAB functions from within NetsBlox!
 *
 * For more information, check out https://www.mathworks.com/products/matlab.html.
 *
 * @service
 * @alpha
 */

const logger = require("../utils/logger")("matlab");
const axios = require("axios");

const { MATLAB_KEY, MATLAB_URL = "" } = process.env;
const request = axios.create({
  headers: {
    "X-NetsBlox-Auth-Token": MATLAB_KEY,
  },
});

const MATLAB = {};
MATLAB.serviceName = "MATLAB";

function reversed(arr) {
  const cpy = [...arr];
  return cpy.reverse();
}

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
 * Evaluate a MATLAB function with the given arguments and number of return
 * values.
 *
 * @param {String} fn Name of the function to call
 * @param {Array<Any>=} args arguments to pass to the function
 * @param {BoundedInteger<1>=} numReturnValues Number of return values expected.
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

  if (result.mwtype === 'char') {
    if (!Array.isArray(result.mwdata) || result.mwdata.length !== 1 || typeof(result.mwdata[0]) !== 'string') {
      throw Error('error parsing character string result');
    }
    data = data[0];
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
  if (shape.length <= 1) {
    return data;
  }

  const colCount = shape[shape.length - 1];
  const colShape = shape.slice(0, shape.length - 1);
  const colSize = MATLAB._product(colShape);

  const cols = [];
  for (let i = 0; i < colCount; ++i) {
    cols.push(MATLAB._unflatten(data.slice(i * colSize, (i + 1) * colSize), colShape));
  }
  return MATLAB._colcat(cols);
};

MATLAB._deepEq = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => MATLAB._deepEq(x, b[i]));
  }
  return a === b;
}

MATLAB._shape = (data) => {
  if (!Array.isArray(data)) {
    throw Error('internal usage error');
  }

  if (data.length === 0 || !Array.isArray(data[0])) {
    if (data.some((x) => Array.isArray(x))) {
      throw Error('input must be rectangular');
    }
    return [data.length];
  }
  if (data.some((x) => !Array.isArray(x))) {
    throw Error('input must be rectangular');
  }

  const shapes = data.map((x) => MATLAB._shape(x));
  if (shapes.some((x) => !MATLAB._deepEq(x, shapes[0]))) {
    throw Error('input must be rectangular');
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
