const express = require("express");
const router = express();
const logger = require("../utils/logger")("iotscape-routes");
const IoTScape = require("./iotscape");
const bodyParser = require("body-parser");

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

module.exports = router;
