/**
 * The MATLAB service provides access to MATLAB functions from within NetsBlox!
 *
 * For more information, check out https://www.mathworks.com/products/matlab.html.
 *
 * @service
 * @alpha
 */

const axios = require("axios");

const { MATLAB_KEY, MATLAB_URL = "" } = process.env;
const request = axios.create({
  headers: {
    "X-NetsBlox-Auth-Token": MATLAB_KEY,
  },
});

const MATLAB = {};
MATLAB.serviceName = "MATLAB";

/**
 * Evaluate a MATLAB function with the given arguments and number of return
 * values.
 *
 * @param{String} fn Name of the function to call
 * @param{Array<Any>=} args arguments to pass to the function
 * @param{BoundedInteger<1>=} numReturnValues Number of return values expected.
 */
MATLAB.feval = async function (fn, args = [], numReturnValues = 1) {
  const body = [{
    function: fn,
    arguments: this._parseArguments(args),
    nargout: numReturnValues,
  }];
  const resp = await request.post(MATLAB_URL, body);
  const results = resp.data.messages.FEvalResponse;
  // TODO: add batching queue
  return this._parseResult(results[0]);
};

/**
 * Try to coerce arguments to numbers if they appear numeric...
 */
MATLAB._parseArguments = function (args) {
  // TODO: get the shape
  // TODO: flatten
  // TODO: coerce types
  return args.map((arg) => {
    const number = parseFloat(arg);
    if (isNaN(number)) {
      return arg;
    }
    return number;
  });
};

MATLAB._parseResult = (result) => {
  if (result.isError) {
    const message = result.messageFaults.map((fault) => fault.message).join(
      "\n",
    );
    throw new Error(message);
  }

  // reshape the data
  return MATLAB._reshape(result.results[0].mwdata, result.results[0].mwsize); // TODO: Check this with multiple return values
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

MATLAB._reshape = (data, shape) => {
  return [
    ...shape.reduce((iterable, num) => MATLAB._take(iterable, num), data),
  ].pop();
};

MATLAB._shape = (data) => {
  const shape = [];
  let item = data;
  while (Array.isArray(item)) {
    shape.unshift(item.length);
  }

  return shape;
};

MATLAB.isSupported = () => {
  if (!process.env.MATLAB_URL || !process.env.MATLAB_KEY) {
    console.log("MATLAB_URL and MATLAB_KEY required for MATLAB service");
    return false;
  }
  return true;
};

module.exports = MATLAB;
