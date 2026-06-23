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
 * @param {string=} field first year of data to include
 * @returns {object}
 */
AfricanAmericanHistory.getRandomWomanInSTEM = async function (field) {
  const people = await this.getWomenInSTEM(field);
  return people[Math.floor(Math.random() * people.length)];
};

module.exports = AfricanAmericanHistory;
