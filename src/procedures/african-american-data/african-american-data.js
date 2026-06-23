/**
 * Access to NOAA Earth System Research Laboratory data collected from Mauna Loa, Hawaii.
 *
 * See https://www.esrl.noaa.gov/gmd/ccgg/trends/ for additional details.
 *
 * @service
 * @category History
 */

const { getData } = require("./data");
const AfricanAmericanHistory = {};
AfricanAmericanHistory.serviceName = "AfricanAmericanData";

/**
 * Get all women in STEM, optionally filtered by field of study.
 *
 * @param {String=} field optional field to filter by (e.g. "chemistry", "engineering")
 * @returns {Array}
 */
AfricanAmericanHistory.getWomenInSTEM = async function (field) {
  const people = await getData();
  if (!field) return people;
  return people.filter((p) =>
    p.field.toLowerCase().includes(field.toLowerCase())
  );
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
AfricanAmericanHistory.getCO2Trend = async function (
  startyear = -Infinity,
  endyear = Infinity,
) {
  return (await getData()).filter((datum) =>
    datum.date > startyear && datum.date < endyear
  )
    .map((datum) => [datum.date, datum.trend]);
};

module.exports = AfricanAmericanHistory;
