const _ = require('lodash');
const {SERVER_URL} = process.env;
const AlexaSMAPI = require('ask-smapi-sdk');
const clientID = process.env.ALEXA_CLIENT_ID;
const clientSecret = process.env.ALEXA_CLIENT_SECRET;
const GetStorage = require('./storage');
// FIXME: address the oauth stuff
//const OAuth = require('../../../api/core/oauth');
const OAUTH_CLIENT_NAME = 'Amazon Alexa';
const assert = require('assert');

let alexaClientID;
async function registerOAuthClient() {
    const clients = await OAuth.getClients();
    const alexaClient = clients.find(client => client.name === OAUTH_CLIENT_NAME);
    alexaClientID = alexaClient ? alexaClient._id :
        await OAuth.createClient(null, OAUTH_CLIENT_NAME);
}

function getClientID() {
    return clientID;
}

function clarifyError(error) {
    if (error.response) {
        const {violations=[]} = (error.response || {});
        if (violations.length) {
            const violationMsg = error.response.violations.map(violation => violation.message).join('\n');
            const message = `${error.response.message}:\n${violationMsg}`;
            return new Error(message);
        } else {
            return new Error(error.response.message);
        }
    }
    return error;
}

const ensureLoggedIn = function(caller) {
    if (!caller.username) {
        throw new Error('Login required.');
    }
};

const getAPIClient = async function(caller) {
    ensureLoggedIn(caller);
    const collection = GetStorage().tokens;
    const tokens = await collection.findOne({username: caller.username});
    if (!tokens) {
        throw new Error('Amazon Login required. Please login.');
    }

    const {access_token, refresh_token} = tokens;
    const refreshTokenConfig = {
        'clientId' : clientID,
        'clientSecret': clientSecret,
        'refreshToken': refresh_token,
        'accessToken': access_token,
    };

    return new AlexaSMAPI.StandardSmapiClientBuilder()
        .withRefreshTokenConfig(refreshTokenConfig)
        .client();
};

const getVendorID = async function (smapiClient) {
    const {vendors} = (await smapiClient.getVendorListV1());
    assert(vendors.length, 'Developer account required.');
    return vendors[0].id;
};

function sleep(duration) {
    return new Promise(resolve => setTimeout(resolve, duration));
}

function getServerURL() {
    return SERVER_URL;  // FIXME?
}

function getOAuthClientID() {
    return alexaClientID;
}

function getConfigWithDefaults(configuration) {
    const skillConfigDefaults = {
        description: 'An under-development Alexa Skill created in NetsBlox!',
        examples: ['none yet!'],
        keywords: [],
        summary: 'An under-development Alexa Skill created in NetsBlox!',
    };

    return _.merge({}, skillConfigDefaults, configuration);
}

async function getSkillData(id) {
    const {skills} = GetStorage();
    const skillData = await skills.findOne({_id: id});
    if (!skillData) {
        throw new Error('Skill not found.');
    }
    return skillData;
}

async function retryWhile(fn, testFn) {
    const seconds = 1000;
    const maxWait = 10*seconds;
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
        .replace(/^data:image\/png;base64,/, '');

    return Buffer.from(imageText, 'base64');
}

function textBtwn(text, start, end) {
    let startIndex = text.indexOf(start) + start.length;
    let endIndex = text.indexOf(end, startIndex);
    return text.substring(startIndex, endIndex);
}

module.exports = {
    getAPIClient,
    clarifyError,
    sleep,
    registerOAuthClient,
    getOAuthClientID,
    getServerURL,
    getClientID,
    getConfigWithDefaults,
    getSkillData,
    retryWhile,
    getImageFromCostumeXml,
    textBtwn,
    getVendorID,
};
