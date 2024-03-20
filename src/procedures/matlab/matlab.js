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
const KeepWarm = require("./keep-warm");
const request = axios.create({
  headers: {
    "X-NetsBlox-Auth-Token": MATLAB_KEY,
  },
});

const MATLAB = {};
MATLAB.serviceName = "MATLAB";

const warmer = new KeepWarm(async () => {
  logger.info('warming is disabled');
  return;

  const body = [...new Array(10)].map(() => ({
    function: "ver",
    arguments: [],
    nargout: 1,
  }));
  request.post(`${MATLAB_URL}/feval-fast`, body);
});

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
 * @param{String} fn Name of the function to call
 * @param{Array<Any>=} args arguments to pass to the function
 * @param{BoundedInteger<1>=} numReturnValues Number of return values expected.
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
  warmer.keepWarm();
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

  const shape = MATLAB._shape(arg);
  const flatValues = MATLAB._flatten(arg);
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
    mwsize: shape,
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
  // reshape the data
  let data = result.mwdata;
  if (!Array.isArray(data)) {
    data = [data];
  }
  return MATLAB._squeeze(
    MATLAB._reshape(data, result.mwsize),
  );
};

MATLAB._take = function* (iter, num) {
  let chunk = [];
  for (const v of iter) {
    chunk.push(v);
    if (chunk.length === num) {
      yield chunk;
      chunk = [];
    }
  }
  if (chunk.length) {
    return chunk;
  }
};

MATLAB._squeeze = (data) => {
  while (Array.isArray(data) && data.length === 1) {
    data = data[0];
  }
  return data;
};

MATLAB._reshape = (data, shape) => {
  return [
    ...shape.reverse().reduce(
      (iterable, num) => MATLAB._take(iterable, num),
      data,
    ),
  ].pop();
};

MATLAB._shape = (data) => {
  const shape = [];
  let item = data;
  while (Array.isArray(item)) {
    shape.push(item.length);
    item = item[0];
  }

  while (shape.length < 2) {
    shape.unshift(1);
  }

  return shape;
};

MATLAB._flatten = (data) => {
  return data.flatMap((item) => {
    if (Array.isArray(item)) {
      return MATLAB._flatten(item);
    } else {
      return item;
    }
  });
};

MATLAB.isSupported = () => {
  if (!process.env.MATLAB_URL || !process.env.MATLAB_KEY) {
    console.log("MATLAB_URL and MATLAB_KEY required for MATLAB service");
    return false;
  }
  return true;
};

module.exports = MATLAB;
