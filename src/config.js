const config = {};
config.NetsBloxCloud = process.env.NETSBLOX_CLOUD;
config.NetsBloxCloudID = process.env.NETSBLOX_CLOUD_ID;
config.NetsBloxCloudSecret = process.env.NETSBLOX_CLOUD_SECRET;
config.LoginURL = process.env.LOGIN_URL;
config.Port = process.env.PORT || 8080;
config.ServerURL = process.env.SERVER_URL || `http://localhost:${config.Port}`;
module.exports = config;
