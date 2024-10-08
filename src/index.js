const path = require("path");
const fs = require("fs");
const config = require("./config");
const ServicesAPI = require("./api");
const express = require("express");
const Storage = require("./storage/connection");
const ServiceStorage = require("./storage");
const Logger = require("./logger");
const routeUtils = require("./procedures/utils/router-utils");
const { filterAsync } = require("./utils");
const types = require("./input-types");

// TODO: if connecting to non-localhost, check for CLIENT_ID, SECRET

async function listen(port) {
  const app = express();
  const logger = new Logger("services");

  // CORS
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", req.get("origin"));
    res.header("Access-Control-Allow-Credentials", true);
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, SESSIONGLUE",
    );
    res.header(
      "Access-Control-Allow-Methods",
      "POST, GET, OPTIONS, PUT, PATCH, DELETE",
    );
    next();
  });
  app.options("*", (_req, res) => res.sendStatus(204));

  const db = await Storage.connect();
  await ServiceStorage.init(logger, db);
  await ServicesAPI.initialize();
  app.use((_req, res, next) => {
    res.header(
      "Access-Control-Allow-Methods",
      "POST, GET, OPTIONS, PUT, PATCH, DELETE",
    );
    next();
  });
  app.use(
    "/keys",
    ...routeUtils.allDefaults(),
    routeUtils.ensureLoggedIn,
    ServicesAPI.keys.router(),
  );
  app.use(
    "/docs",
    express.static(
      path.join(__dirname, "..", "docs", "_generated", "_build", "html"),
    ),
  );
  app.use("/input-types", async (_, res) => {
    res.status(200).json(types.typesMeta);
  });
  app.use("/", ServicesAPI.router());
  const RPC_ROOT = path.join(__dirname, "..", "libs");
  const libraryNames = fs.readFileSync(path.join(RPC_ROOT, "LIBS"), "utf8")
    .split("\n");
  const supportedLibraries = await filterAsync(libraryNames, async (line) => {
    const parts = line.split("\t");
    const deps = parts[2] ? parts[2].split(" ") : [];
    const displayName = parts[1];

    // Check if we have loaded the dependent rpcs
    for (let i = deps.length; i--;) {
      if (!await ServicesAPI.isServiceLoaded(deps[i])) {
        // eslint-disable-next-line no-console
        console.log(
          `Service ${displayName} not available because ${
            deps[i]
          } is not loaded`,
        );
        return false;
      }
    }
    return true;
  });
  const RPC_INDEX = supportedLibraries
    .map((line) => line.split("\t").splice(0, 2).join("\t"))
    .join("\n");

  app.get("/servicelibs/:filename", (req, res) => {
    if (req.params.filename === "SERVICELIBS") {
      res.send(RPC_INDEX);
    } else {
      res.sendFile(path.join(RPC_ROOT, req.params.filename));
    }
  });

  app.listen(+port);
}

if (require.main === module) {
  listen(config.Port);
}

module.exports = listen;
