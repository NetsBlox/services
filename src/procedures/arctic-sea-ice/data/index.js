const axios = require("axios");
const logger = require("../../utils/logger")("arctic-sea-ice");

const DATA_SOURCE_LIFETIME = 1 * 24 * 60 * 60 * 1000; // 1 day
const ICE_EXTENT_URL =
  "https://psl.noaa.gov/data/timeseries/monthly/data/n_iceextent.mon.data";
const ICE_AREA_URL =
  "https://psl.noaa.gov/data/timeseries/monthly/data/n_icearea.mon.data";

function parseMonthlySeries(raw) {
  const tokens = raw.trim().split(/\s+/);
  const numeric = tokens
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));

  const startYear = parseInt(numeric[0], 10);
  const endYear = parseInt(numeric[1], 10);

  const yearCount = endYear - startYear + 1;
  const expectedCount = 2 + yearCount * 13;

  const values = numeric.slice(2, expectedCount);
  const data = [];
  let index = 0;

  for (let i = 0; i < yearCount; i++) {
    const year = values[index];
    for (let month = 1; month <= 12; month++) {
      const value = values[index + month];
      if (value === -99.99) continue;
      data.push([year + month / 12, value]);
    }

    index += 13;
  }

  return data;
}

async function getData(url, cache) {
  if (
    cache.data !== undefined &&
    Date.now() - cache.timestamp <= DATA_SOURCE_LIFETIME
  ) {
    return cache.data;
  }

  logger.info(`requesting data from ${url}`);
  const resp = await axios({ url, method: "GET" });
  if (resp.status !== 200) {
    logger.error(`download failed with status ${resp.status}`);
    throw new Error(`Failed to download sea ice data (status ${resp.status}).`);
  }

  logger.info("download complete - restructuring data");
  const data = parseMonthlySeries(resp.data);
  cache.data = data;
  cache.timestamp = Date.now();
  return data;
}

const extentCache = { data: undefined, timestamp: undefined };
const areaCache = { data: undefined, timestamp: undefined };

async function getIceExtentData() {
  return getData(ICE_EXTENT_URL, extentCache);
}

async function getIceAreaData() {
  return getData(ICE_AREA_URL, areaCache);
}

module.exports = { getIceExtentData, getIceAreaData };

// TODO: Implement local file backup.
