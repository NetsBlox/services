const _ = require("lodash");
const assert = require("assert");

const path = require("path");
const fs = require("fs");
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const reqSrc = (p) => require(PROJECT_ROOT + "/src/" + p);

//const Client = reqSrc('client');
//const Socket = require('./mock-websocket');
const Logger = reqSrc("logger");
const Storage = reqSrc("storage/connection");
const ServiceStorage = reqSrc("storage/index");
const mainLogger = new Logger("netsblox:test");
//const serverUtils = reqSrc('server-utils');
const Services = reqSrc("api").services;
//const Projects = reqSrc('storage/projects');

// Create configured room helpers
let logger = new Logger("netsblox:test");
const createSocket = function (username) {
  const uuid = serverUtils.getNewClientId();
  const client = NetworkTopology.onConnect(new Socket(), uuid);
  client.username = username || client.uuid;
  return client;
};

const createRoom = async function (config) {
  // Get the room and attach a project
  const roleNames = Object.keys(config.roles);

  // Ensure there is an owner
  config.owner = config.owner || roleNames
    .map((name) => config.roles[name])
    .reduce((l1, l2) => l1.concat(l2), [])
    .unshift();

  const { name, owner } = config;
  const project = await Projects.new({ name, owner });
  const roles = roleNames.map((name) => serverUtils.getEmptyRole(name));
  await project.setRoles(roles);
  const ids = await project.getRoleIdsFor(roleNames);

  const projectId = project.getId();
  roleNames.forEach((name, i) => {
    const roleId = ids[i];
    const usernames = config.roles[name] || [];

    usernames.forEach((username) => {
      const socket = createSocket(username);
      NetworkTopology.setClientState(socket.uuid, projectId, roleId, username);
      return socket;
    });
  });

  return project;
};

const sendEmptyRole = function (msg) {
  return {
    type: "project-response",
    id: msg.id,
    project: serverUtils.getEmptyRole(this.role),
  };
};

let connection = null;
const connect = async function () {
  const mongoUri = "mongodb://127.0.0.1:27017/netsblox-tests";
  if (!connection) {
    connection = Storage.connect(mongoUri)
      .then(async (db) => {
        await ServiceStorage.init(logger, db);
        return db;
      });
  }
  return await connection;
};

const clearCache = function () {
  var args = Array.prototype.slice.call(arguments);
  args.forEach((arg) => {
    try {
      let fullName = require.resolve(arg);
      delete require.cache[fullName];
    } catch (e) {
      throw `${arg}: ${e}`;
    }
  });
};

async function reset(seedDefaults = true) {
  let db = null;
  // TODO: load the seed data
  // Reload the server and the paths
  return connect()
    .then((_db) => db = _db)
    .then(() => db.dropDatabase());
  //.then(() => fixtures.init(Storage, db))
  //.then(() => seedDefaults && fixtures.seedDefaults(Storage))
  //.then(() => logger.info('Finished loading test fixtures!'))
  //.then(() => Storage._db);
}

function defer() {
  const deferred = {};
  deferred.promise = new Promise((res, rej) => {
    deferred.resolve = res;
    deferred.reject = rej;
  });
  return deferred;
}

const sleep = (delay) => {
  const deferred = defer();
  setTimeout(deferred.resolve, delay);
  return deferred.promise;
};

function isSubclass(Subclass, Clazz) {
  return Subclass.prototype instanceof Clazz;
}

async function shouldThrow(fn, Err, msg) {
  assert(
    Err === undefined || Err instanceof Error || isSubclass(Err, Error),
    `shouldThrow expected Err to be a type of Error: ${Err}`,
  );
  try {
    await fn();
  } catch (err) {
    if (Err) {
      assert(err instanceof Error, `Non-error was thrown: ${err}`);
      assert.equal(
        err.constructor.name,
        Err.name,
        `Expected ${Err.name}. Found ${err}`,
      );
    }
    return err;
  }
  throw new Error(msg || `Expected fn to throw ${Err.name}`);
}

function suiteName(filename) {
  return filename
    .replace(PROJECT_ROOT, "")
    .replace(new RegExp("/test/(unit/server|[a-z]+)/"), "")
    .replace(/\.js$/, "")
    .replace(/\.spec$/, "");
}

async function expect(fn, err) {
  const start = Date.now();
  const maxEndTime = start + 1500;
  let result = await fn();
  while (!result) {
    await sleep(25);
    if (Date.now() > maxEndTime) {
      throw err;
    }
    result = await fn();
  }
  return result;
}

module.exports = {
  verifyRPCInterfaces: function (serviceName, interfaces) {
    describe(`${serviceName} interfaces`, function () {
      before(async () => {
        await connect();
        await Services.load();
      });

      interfaces.forEach((interface) => {
        const [name, expected = []] = interface;

        it(`${name} args should be ${expected.join(", ")}`, function () {
          const args = Services.getArgumentsFor(serviceName, name);
          assert(_.isEqual(args, expected), `Found ${args.join(", ")}`);
        });
      });

      it(`should not have any untested RPCs`, function () {
        const expectedRPCs = interfaces.map((pair) => pair[0]);
        const actualRPCs = Services.getMethodsFor(serviceName);
        const untestedRPCs = _.difference(actualRPCs, expectedRPCs);
        assert(
          untestedRPCs.length === 0,
          `Found extra (untested) RPCs: ${untestedRPCs.join(", ")}`,
        );
      });
    });
  },
  connect: connect,
  reset: reset,
  sleep: sleep,
  logger: mainLogger,
  createRoom: createRoom,
  createSocket: createSocket,
  sendEmptyRole: sendEmptyRole,
  shouldThrow,
  suiteName,
  expect,
  nop: () => {},

  reqSrc,
};
