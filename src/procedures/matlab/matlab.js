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
MATLAB.function = async function (fn, args = [], numReturnValues = 1) {
  const body = [{
    function: fn,
    arguments: args.map((a) => this._parseArgument(a)),
    nargout: numReturnValues,
  }];
  const resp = await request.post(MATLAB_URL, body, { timeout: 5000 });
  const results = resp.data.messages.FEvalResponse;
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
    arg = [[arg]];
  }
  if (!Array.isArray(arg[0])) {
    arg = [arg];
  }

  const shape = MATLAB._shape(arg);
  const flatValues = MATLAB._flatten(arg);
  const mwtype = MATLAB._getMwType(flatValues);
  console.log({ shape, flatValues, mwtype, arg });
  const mwdata = flatValues
    .map((v) => {
      if (mwtype === "logical") {
        return v ? 1 : 0;
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
  let count = 0;
  for (const v of iter) {
    if (count === num) {
      return v;
    } else {
      yield v;
    }
    count++;
  }
};

MATLAB._squeeze = (data) => {
  while (Array.isArray(data) && data.length === 1) {
    data = data[0];
  }
  return data;
};

// TODO: make a method for getting the reshape indices
MATLAB._reshape = (data, shape) => {
  const idx = MATLAB._reshapeIdx(shape);
  const result = [];
  idx.forEach((idx, index) => {
    const element = data[index];
    console.log("setting", idx, "to", element);
    MATLAB._set(result, idx, element);
  });
  return result;
};

MATLAB._range = (end) => {
  return [...new Array(end)].map((_, i) => i);
};

MATLAB._shape = (data) => {
  const shape = [];
  let item = data;
  while (Array.isArray(item)) {
    shape.push(item.length);
    item = item[0];
  }

  return shape;
};

MATLAB._get = (data, ...idx) => {
  return idx.reduce((d, i) => d[i], data);
};

MATLAB._set = (data, idx, value) => {
  const nestedKeys = idx.slice(0, idx.length - 1);
  const nestedValue = nestedKeys.reduce((d, i) => d[i] = d[i] || [], data);
  const last = idx[idx.length - 1];
  nestedValue[last] = value;
};

MATLAB._flatten = (data) => {
  const shape = MATLAB._shape(data);
  console.log(MATLAB._reshapeIdx(shape), data);
  return MATLAB._reshapeIdx(shape)
    .map((idx) => MATLAB._get(data, ...idx));
};

MATLAB._reshapeIdx = function (shape) {
  const places = shape.reduce((places, place) => {
    places.push(places[places.length - 1] * place);
    return places;
  }, [1]).reverse();
  places.shift(); // don't need the biggest place

  const size = shape.reduce((a, b) => a * b, 1);
  console.log({ size, places, shape });
  return MATLAB._range(size)
    .map((num) => MATLAB._toMixedBase(num, places).reverse());
};

MATLAB._toMixedBase = function (num, places) {
  let remainder = num;
  return places.map((place) => {
    let value = Math.floor(remainder / place);
    remainder -= value * place;
    return value;
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
