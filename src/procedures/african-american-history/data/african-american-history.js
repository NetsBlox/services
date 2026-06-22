/**
 * Access to datasets celebrating African American history and contributions,
 * organized by topic (Women in STEM, with more topics to come).
 *
 * See https://www.esrl.noaa.gov/gmd/ccgg/trends/ for additional details.
 *
 * @service
 * @category History //this is the category for the service
 */

const { getData } = require("./data");

const AfricanAmericanHistory = {}; //this add everthing inside this container
AfricanAmericanHistory.servicename = "AfricanAmericanHistory"; 

/**
 * Get the mole fraction of CO2 (in parts per million) by year. Missing measurements
 * are interpolated.
 *
 * If ``startyear`` or ``endyear`` is provided, only measurements within the given range will be returned.
 *
 * @param {Number=} startyear first year of data to include
 * @param {String=} endyear last year of data to include
 * @returns {String}
 */
AfricanAmericanHistory.helloFromSaman = async function (
  startyear = -Infinity,
  endyear = Infinity,
) {
  return "hello saman"
};

/**
 * Get the mole fraction of CO2 (in parts per million) by year with the seasonal
 * cycle removed.
 *
 * If ``startyear`` or ``endyear`` is provided, only measurements within the given range will be returned.
 *
 * @param {Number=} startyear first year of data to include
 * @param {Number=} endyear last year of data to include
 * @returns {Array}
 */
MaunaLoaCO2Data.getCO2Trend = async function (
  startyear = -Infinity,
  endyear = Infinity,
) {
  return (await getData()).filter((datum) =>
    datum.date > startyear && datum.date < endyear
  )
    .map((datum) => [datum.date, datum.trend]);
};

module.exports = MaunaLoaCO2Data;
