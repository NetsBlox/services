/**
 * The IEXTrading Service provides access to real-time and historical stock price data.
 * For more information, check out https://iextrading.com/developer.
 *
 * Terms of use: https://iextrading.com/api-exhibit-a
 * @service
 */

const ApiConsumer = require("../utils/api-consumer");
const StockConsumer = new ApiConsumer(
  "IEXTrading",
  "https://api.iextrading.com/1.0",
  { cache: { ttl: 5 * 60 } },
);
const rewordError = (err) => {
  if (err.statusCode === 404) {
    return "Unknown company symbol";
  }
};

/**
 * Get the current price of the given stock, with a 15 min delay
 * @param {String} companySymbol Company stock ticker symbol
 * @returns {Number} Current price for the specified stock
 */
StockConsumer.currentPrice = function (companySymbol) {
  companySymbol = companySymbol.toUpperCase();
  const options = {
    path: `/stock/${companySymbol}/quote`,
    queryString: "displayPercent=true",
  };

  return this._sendAnswer(options, ".latestPrice")
    .catch((err) => {
      const prettyError = rewordError(err);
      if (prettyError) {
        return this.response.status(500).send(prettyError);
      }
      throw err;
    });
};

/**
 * Get the last opening price of the specified company
 * @param {String} companySymbol Company stock ticker symbol
 * @returns {Number} Value of the last opening price for that stock
 */
StockConsumer.lastOpenPrice = function (companySymbol) {
  companySymbol = companySymbol.toUpperCase();
  const options = {
    path: `/stock/${companySymbol}/quote`,
    queryString: "displayPercent=true",
  };

  return this._sendAnswer(options, ".open")
    .catch((err) => {
      const prettyError = rewordError(err);
      if (prettyError) {
        return this.response.status(500).send(prettyError);
      }
      throw err;
    });
};

/**
 * Get the last close price of the specified company
 * @param {String} companySymbol Company stock ticker symbol
 * @returns {Number} Value of the last close price for that stock
 */
StockConsumer.lastClosePrice = function (companySymbol) {
  companySymbol = companySymbol.toUpperCase();
  const options = {
    path: `/stock/${companySymbol}/quote`,
    queryString: "displayPercent=true",
  };

  return this._sendAnswer(options, ".close")
    .catch((err) => {
      const prettyError = rewordError(err);
      if (prettyError) {
        return this.response.status(500).send(prettyError);
      }
      throw err;
    });
};

/**
 * Get all information about the specified company
 * @param {String} companySymbol Company stock ticker symbol
 * @returns {Object} Company information
 */
StockConsumer.companyInformation = function (companySymbol) {
  companySymbol = companySymbol.toUpperCase();
  const options = {
    path: `/stock/${companySymbol}/quote`,
    queryString: "displayPercent=true",
  };

  return this._sendAnswer(options)
    .catch((err) => {
      const prettyError = rewordError(err);
      if (prettyError) {
        return this.response.status(500).send(prettyError);
      }
      throw err;
    });
};

/**
 * Get the daily change percent for a company
 * @param {String} companySymbol Company stock ticker symbol
 * @returns {Number} The daily change percent for the specified company
 */
StockConsumer.dailyPercentChange = function (companySymbol) {
  companySymbol = companySymbol.toUpperCase();
  const options = {
    path: `/stock/${companySymbol}/quote`,
    queryString: "displayPercent=true",
  };

  return this._sendAnswer(options, ".changePercent")
    .catch((err) => {
      const prettyError = rewordError(err);
      if (prettyError) {
        return this.response.status(500).send(prettyError);
      }
      throw err;
    });
};

/**
 * Get historical closing price information about the specified company
 * @param {String} companySymbol Company stock ticker symbol
 * @param {String} range Time period (e.g. 1m, 3m, 1y, etc) to retrieve prices for
 * @returns {Array} A list of pairs of ``[date, closingPrice]`` representing historical price information
 */
StockConsumer.historicalClosingPrices = function (companySymbol, range) {
  companySymbol = companySymbol.toUpperCase();

  return this._requestData({ path: `/stock/${companySymbol}/chart/${range}` })
    .then((res) => {
      return res.map((price) => [price.date, price.close]);
    })
    .catch((err) => {
      const prettyError = rewordError(err);
      if (prettyError) {
        return this.response.status(500).send(prettyError);
      }
      throw err;
    });
};

StockConsumer.isSupported = function () {
  /* eslint-disable no-console */
  console.error(
    "IEXTrading API is no longer available as it has migrated to IEXCloud.",
  );
  /* eslint-enable no-console */
  return false;
};

module.exports = StockConsumer;
