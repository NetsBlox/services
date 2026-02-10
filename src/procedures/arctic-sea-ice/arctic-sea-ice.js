/**
 * ArcticSeaIce service provides access to NOAA PSL monthly Arctic sea ice data.
 * For more information, check out https://psl.noaa.gov/data/timeseries/monthly/NHICE/.
 *
 * @service
 * @category Climate
 * @category GeoData
 */
"use strict";

const { getIceExtentData, getIceAreaData } = require("./data");

const ArcticSeaIce = {};
ArcticSeaIce.serviceName = "ArcticSeaIce";

function filterRange(data, startyear, endyear) {
  return data.filter(([date]) => date >= startyear && date < endyear + 1);
}

/**
 * Get the monthly Arctic sea ice extent data.
 *
 * If startyear or endyear is provided, only measurements within the given range will be returned.
 *
 * @param {Number=} startyear first year of data to include
 * @param {Number=} endyear last year of data to include
 * @returns {Array<Array>} Monthly data points
 */
ArcticSeaIce.getMonthlyIceExtent = async function (startyear = -Infinity, endyear = Infinity,) {
  const data = await getIceExtentData();
  return filterRange(data, startyear, endyear);
};

/**
 * Get the monthly Arctic sea ice area data.
 *
 * If startyear or endyear is provided, only measurements within the given range will be returned.
 *
 * @param {Number=} startyear first year of data to include
 * @param {Number=} endyear last year of data to include
 * @returns {Array<Array>} Monthly data points
 */
ArcticSeaIce.getMonthlyIceArea = async function (startyear = -Infinity, endyear = Infinity,) {
  const data = await getIceAreaData();
  return filterRange(data, startyear, endyear);
};

module.exports = ArcticSeaIce;
