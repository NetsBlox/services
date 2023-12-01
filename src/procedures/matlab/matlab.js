/**
 * The MATLAB service provides access to MATLAB functions from within NetsBlox!
 *
 * For more information, check out https://www.mathworks.com/products/matlab.html.
 *
 * @service
 * @alpha
 */

const ApiConsumer = require("../utils/api-consumer");

const { MATLAB_KEY, MATLAB_URL = "" } = process.env;
const MATLAB = new ApiConsumer("MATLAB", MATLAB_URL);

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
  const headers = {
    "X-NetsBlox-Auth-Token": MATLAB_KEY,
  };
  const resp = await this._requestData({ method: "POST", body, headers });
  const results = resp.messages.FEvalResponse;
  // TODO: add batching queue
  return this._parseResult(results[0]);
};

/**
 * Try to coerce arguments to numbers if they appear numeric...
 */
MATLAB._parseArguments = function (args) {
  return args.map((arg) => {
    if (Array.isArray(arg)) {
      return this._parseArguments(arg);
    }

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

  return result.results[0]; // TODO: Check this with multiple return values
};

MATLAB.isSupported = () => {
  if (!process.env.MATLAB_URL || !process.env.MATLAB_KEY) {
    console.log("MATLAB_URL and MATLAB_KEY required for MATLAB service");
    return false;
  }
  return true;
};

module.exports = MATLAB;
