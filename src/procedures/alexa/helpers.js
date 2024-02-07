const _ = require("lodash");
const AlexaSMAPI = require("ask-smapi-sdk");
const GetStorage = require("./storage");
const assert = require("assert");
const { sleep } = require("../../timers");
// FIXME: update these methods
const { getCloudURL, getServicesURL } = require("../utils");

// login with alexa credentials
const lwaClientID = process.env.LWA_CLIENT_ID;
const lwaClientSecret = process.env.LWA_CLIENT_SECRET;

// NetsBlox core server credentials
const OAUTH_CLIENT_NAME = "Amazon Alexa";
const oauthClientID = process.env.OAUTH_CLIENT_ID;
const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;

function clarifyError(error) {
  if (error.response) {
    const { violations = [] } = error.response || {};
    if (violations.length) {
      const violationMsg = error.response.violations.map((violation) =>
        violation.message
      ).join("\n");
      const message = `${error.response.message}:\n${violationMsg}`;
      return new Error(message);
    } else {
      return new Error(error.response.message);
    }
  }
  return error;
}

const ensureLoggedIn = function (caller) {
  if (!caller.username) {
    throw new Error("Login required.");
  }
};

const getAPIClient = async function (caller) {
  ensureLoggedIn(caller);
  const collection = GetStorage().tokens;
  const tokens = await collection.findOne({ username: caller.username });
  if (!tokens) {
    throw new Error("Amazon Login required. Please login.");
  }

  const { access_token, refresh_token } = tokens;
  const refreshTokenConfig = {
    "clientId": lwaClientID,
    "clientSecret": lwaClientSecret,
    "refreshToken": refresh_token,
    "accessToken": access_token,
  };

  return new AlexaSMAPI.StandardSmapiClientBuilder()
    .withRefreshTokenConfig(refreshTokenConfig)
    .client();
};

const getVendorID = async function (smapiClient) {
  const { vendors } = await smapiClient.getVendorListV1();
  assert(vendors.length, "Developer account required.");
  return vendors[0].id;
};

function getConfigWithDefaults(configuration) {
  const skillConfigDefaults = {
    description: "An under-development Alexa Skill created in NetsBlox!",
    examples: ["none yet!"],
    keywords: [],
    summary: "An under-development Alexa Skill created in NetsBlox!",
  };

  return _.merge({}, skillConfigDefaults, configuration);
}

async function getSkillData(id) {
  const { skills } = GetStorage();
  const skillData = await skills.findOne({ _id: id });
  if (!skillData) {
    throw new Error("Skill not found.");
  }
  return skillData;
}

async function retryWhile(fn, testFn) {
  const seconds = 1000;
  const maxWait = 10 * seconds;
  const startTime = Date.now();
  let retry = true;
  do {
    try {
      return await fn();
    } catch (err) {
      const duration = Date.now() - startTime;
      if (!testFn(err)) {
        throw err;
      }
      retry = duration < maxWait;
      await sleep(.5 * seconds);
    }
  } while (retry);
}

function getImageFromCostumeXml(costume) {
  const imageText = textBtwn(costume, 'image="', '"')
    .replace(/^data:image\/png;base64,/, "");

  return Buffer.from(imageText, "base64");
}

function textBtwn(text, start, end) {
  let startIndex = text.indexOf(start) + start.length;
  let endIndex = text.indexOf(end, startIndex);
  return text.substring(startIndex, endIndex);
}

const oauth = {
  getClientID() {
    return oauthClientID;
  },
  getClientSecret() {
    return oauthClientSecret;
  },
};

const lwa = {
  getClientID() {
    return lwaClientID;
  },
  getClientSecret() {
    return lwaClientSecret;
  },
};

module.exports = {
  getAPIClient,
  clarifyError,
  sleep,

  oauth,
  lwa,

  getServicesURL,
  getCloudURL,
  getConfigWithDefaults,
  getSkillData,
  retryWhile,
  getImageFromCostumeXml,
  textBtwn,
  getVendorID,
  OAUTH_CLIENT_NAME,
  getCloudURL,
  getServicesURL,
};
