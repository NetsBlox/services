const express = require("express");
const router = express();
const logger = require("../utils/logger")("iotscape-routes");
const IoTScape = require("./iotscape");
const bodyParser = require("body-parser");
const IoTScapeDevices = require("./iotscape-devices");
const IoTScapeServices = require("./iotscape-services");

router.get(
  "/port",
  async (_, res) => {
    res.status(200).send(
      process.env.IOTSCAPE_PORT || "IoTScape is not enabled.",
    );
  },
);

router.post(
  "/announce",
  bodyParser.json({ limit: "1mb" }),
  async (req, res) => {
    logger.info(`HTTP announcement from ${req.ip}`);
    IoTScape._createService(req.body);
    res.status(200).send("OK");
  },
);

router.post(
  "/response",
  bodyParser.json({ limit: "5mb" }),
  async (req, res) => {
    if (req.body) {
      // Validate fields
      if (!req.body.request || !req.body.response || !Array.isArray(req.body.response)) {
        return res.status(400).send("Invalid request: missing fields");
      }
      
      if(Object.keys(IoTScapeServices._awaitingRequests).includes(req.body.request)) {
        IoTScapeServices._awaitingRequests[req.body.request].resolve(...req.body.response);
        return res.status(200).send("OK");
      } else {
        return res.status(400).send("No request found for this response.");
      }
    }

    res.status(400).send("Invalid request.");
  }
)

module.exports = router;
