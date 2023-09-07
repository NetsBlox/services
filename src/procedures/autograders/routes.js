const fs = require("fs");
const { getAuthorizationHeader, SignatureMethod } = require("node-oauth1");
const logger = require("../utils/logger")("autograders");
const fetch = require("node-fetch");
const uuid = require("uuid");
const path = require("path");
const AutograderCode = fs.readFileSync(
  path.join(__dirname, "template.ejs"),
  "utf8",
);
const getDatabase = require("./storage");
const express = require("express");
const router = express();
const rp = require("request-promise");
const utils = require("../utils");
const { isValidLti1Signature, sha1 } = require("./utils");

// TODO: add v2 prefix
router.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", req.get("origin"));
  res.header("Access-Control-Allow-Credentials", true);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Cache-Control",
  );
  res.header(
    "Access-Control-Allow-Methods",
    "POST, GET, OPTIONS, PUT, PATCH, DELETE",
  );
  next();
});
router.options("*", (req, res) => res.sendStatus(204));

router.get(
  "/:author/",
  async (req, res) => {
    const { author } = req.params;
    const storage = getDatabase().autograders;
    const options = {
      projection: { name: 1 },
    };
    const autograders = await storage.find({ author }, options).toArray();
    return res.json(autograders.map((grader) => grader.name));
  },
);

router.get(
  "/:author/:name/config.json",
  async (req, res) => {
    const { author, name } = req.params;
    const storage = getDatabase().autograders;

    const autograder = await storage.findOne({ author, name });
    if (!autograder) {
      return res.sendStatus(404);
    }

    return res.json(autograder.config);
  },
);

router.get(
  "/:author/:name.js",
  async (req, res) => {
    const { author, name } = req.params;
    const storage = getDatabase().autograders;
    const autograder = await storage.findOne({ author, name });
    if (!autograder) {
      return res.sendStatus(404);
    }

    const code = AutograderCode.replace(
      "AUTOGRADER_CONFIG",
      JSON.stringify(autograder.config),
    );
    return res.send(code);
  },
);

router.post(
  "/submit/coursera",
  async (req, res) => {
    const url =
      "https://www.coursera.org/api/onDemandProgrammingScriptSubmissions.v1";
    try {
      const response = await rp({
        uri: url,
        method: "POST",
        json: req.body,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      });
      return res.send(response);
    } catch (err) {
      const isStatusCodeError = err.name === "StatusCodeError";
      const status = isStatusCodeError ? err.statusCode : 500;
      const message = isStatusCodeError
        ? err.error.message
        : `An error occurred: ${err.message}`;
      return res.status(status).send(message);
    }
  },
);

router.post(
  "/lti/v1.1/:author/:name/launch",
  async (req, res) => {
    // TODO: verify that the consumer is valid...
    // TODO: issue a token for a version of the autograder w/ secrets inlined, too
    const { author, name } = req.params;
    const { autograders, tokens } = getDatabase();

    const autograder = await autograders.findOne({ author, name });
    if (!autograder) {
      return res.sendStatus(404);
    }

    console.log(req.body);
    const consumerName = req.body.oauth_consumer_key;
    const consumers = autograder.ltiConsumers || [];
    const consumer = consumers.find((c) => c.name === consumerName);

    if (!consumer) {
      return res.sendStatus(400); // FIXME: handle errors here
    }

    // TODO: check the oauth_signature is correct (using the consumer secret)
    console.log("----> received post request!");
    console.log(req.body);
    if (!isValidLti1Signature(req.body, consumer.secret)) {
      return res.sendStatus(403);
    }

    // issue a token
    const id = uuid.v4();
    const token = {
      id,
      author,
      name,
      consumer: consumer.name,
      outcomeServiceUrl: req.body.lis_outcome_service_url,
      sourcedId: req.body.lis_result_sourcedid,
      createdAt: new Date(),
    };
    await tokens.insertOne(token);

    const baseUrl = utils.getServicesURL();
    const editorUrl = utils.getEditorURL();
    const extUrl =
      `${baseUrl}/routes/autograders/v2/lti/v1.1/${token.id}/grader.js`; // TODO: add an integration URL here
    const url = `${editorUrl}?extensions=[${
      encodeURIComponent(JSON.stringify(extUrl))
    }]`;
    res.redirect(url);
  },
);

router.get(
  "/v2/lti/v1.1/:tokenId/grader.js",
  async (req, res) => {
    const { tokenId } = req.params;
    const { tokens, autograders } = getDatabase();

    // check on a token
    const token = await tokens.findOne({ id: tokenId });
    if (!token) {
      return res.status(404).send("Invalid token.");
    }

    // add LTI data to the config
    const { author, name } = token;
    const autograder = await autograders.findOne({ author, name });
    if (!autograder) {
      return res.status(404).send("Autograder not found.");
    }

    const baseUrl = utils.getServicesURL();
    const submitUrl = `${baseUrl}/routes/autograders/v2/lti/v1.1/submit`;
    const ltiConfig = {
      "lti1.1": {
        consumer: token.consumer,
        submitUrl,
        token,
      },
    };
    const config = Object.assign(
      { integrations: [] },
      autograder.config,
      ltiConfig,
    );
    console.log({ autograder, config });
    config.integrations.push("lti1.1");
    const code = AutograderCode.replace(
      "AUTOGRADER_CONFIG",
      JSON.stringify(config),
    );
    return res.send(code);
  },
);

router.post(
  "/v2/lti/v1.1/submit/",
  async (req, res) => {
    const { grade, config } = req.body;
    const { outcomeServiceUrl, sourcedId, author, name, consumer } =
      config.token;

    // get the consumer secret
    const { autograders } = getDatabase();
    const grader = await autograders.findOne({ author, name });
    if (!grader) {
      return res.status(404).send("Autograder not found");
    }

    const consumerData = (grader.ltiConsumers || [])
      .find((c) => c.name === consumer);

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
<imsx_POXHeader>
  <imsx_POXRequestHeaderInfo>
    <imsx_version>V1.0</imsx_version>
    <imsx_messageIdentifier>${uuid.v4()}</imsx_messageIdentifier>
  </imsx_POXRequestHeaderInfo>
</imsx_POXHeader>
<imsx_POXBody>
  <replaceResultRequest>
    <resultRecord>
      <sourcedGUID>
        <sourcedId>${sourcedId}</sourcedId>
      </sourcedGUID>
      <result>
        <resultScore>
          <language>en</language>
          <textString>${grade}</textString>
        </resultScore>
      </result>
    </resultRecord>
  </replaceResultRequest>
</imsx_POXBody>
</imsx_POXEnvelopeRequest>`;

    const parameters = {
      oauth_signature_method: "HMAC-SHA1",
      oauth_callback: "about:blank",
      oauth_nonce: Math.floor(Math.random() * 10000000).toString(),
      oauth_consumer_key: consumerData.name,
      oauth_version: "1.0",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(), // time in secs
      oauth_body_hash: sha1(body),
    };
    const message = {
      action: outcomeServiceUrl,
      method: "POST",
      parameters,
    };
    const accessor = {
      consumerSecret: consumerData.secret,
    };
    const signature = SignatureMethod.sign(message, accessor);
    parameters.oauth_signature = signature;
    const authHeader = getAuthorizationHeader(null, parameters);

    const response = await fetch(outcomeServiceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        Authorization: authHeader,
      },
      body,
    });

    if (response.status > 399) {
      logger.error(`An error occurred: ${await response.text()}`);
    }

    return res.sendStatus(response.status);
  },
);

module.exports = router;
