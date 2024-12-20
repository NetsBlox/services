const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  this.timeout(20000);

  const CloudVariables = utils.reqSrc(
    "procedures/cloud-variables/cloud-variables",
  );
  const MockService = require("../assets/mock-service");
  const assert = require("assert");
  let cloudvariables, testSuite;

  before(async () => {
    testSuite = await utils.TestSuiteBuilder().setup();
    cloudvariables = new MockService(CloudVariables);
  });
  after(() => {
    cloudvariables.destroy();
    testSuite.takedown();
  });

  utils.verifyRPCInterfaces("CloudVariables", [
    ["lockVariable", ["name", "password"]],
    ["unlockVariable", ["name", "password"]],
    ["getVariable", ["name", "password"]],
    ["setVariable", ["name", "value", "password"]],
    ["deleteVariable", ["name", "password"]],
    ["getUserVariable", ["name"]],
    ["setUserVariable", ["name", "value"]],
    ["deleteUserVariable", ["name"]],
    ["listenToVariable", ["name", "msgType", "password", "duration"]],
    ["listenToUserVariable", ["name", "msgType", "duration"]],
  ]);

  let counter = 0;
  function newVar() {
    return `var${counter++}`;
  }

  describe("public", function () {
    it("should not set variables w/ invalid names", function () {
      try {
        cloudvariables.setVariable("^#", "world");
      } catch (err) {
        assert(err.message.includes("variable name"));
      }
    });

    it("should get/set variables", function () {
      const name = newVar();
      return cloudvariables.setVariable(name, "world")
        .then(() => cloudvariables.getVariable(name))
        .then((result) => assert.equal(result, "world"));
    });

    it("should delete variables", function () {
      const name = newVar();
      return cloudvariables.setVariable(name, "world")
        .then(() => cloudvariables.deleteVariable(name))
        .then(() => cloudvariables.getVariable(name))
        .catch((err) => assert(err.message.includes("not found")));
    });

    it("should gracefully fail to delete non-existent variables", async function () {
      const name = newVar();
      try {
        await cloudvariables.deleteVariable(name);
        assert(false, "should have thrown");
      } catch (e) {
        assert(e.message.includes("not found"));
      }
    });

    it("should not get/set variables w/ bad password", function () {
      const name = newVar();
      return cloudvariables.setVariable(name, "world", "password")
        .then(() => cloudvariables.getVariable(name))
        .catch((err) => assert(err.message.includes("password")));
    });

    it("should not set variables w/ bad password", function () {
      const name = newVar();
      return cloudvariables.setVariable(name, "world", "password")
        .then(() => cloudvariables.setVariable(name, "asdf"))
        .catch((err) => assert(err.message.includes("password")));
    });

    it("should not delete variables w/ bad password", function () {
      const name = newVar();
      return cloudvariables.setVariable(name, "world", "password")
        .then(() => cloudvariables.deleteVariable(name))
        .catch((err) => assert(err.message.includes("password")));
    });

    describe("locking variables", function () {
      let name;
      let index = 1;
      const initialValue = "world";
      const client1 = "_netsblox_1";
      const client2 = "_netsblox_2";

      beforeEach(async () => {
        cloudvariables.unwrap()._setMaxLockAge(5 * 1000 * 60);
        cloudvariables.setRequester(client1);
        testSuite.dropDatabase();
        name = `lock-var-test-${index++}`;
        await cloudvariables.setVariable(name, initialValue);
        await cloudvariables.lockVariable(name);
      });

      it("should return error if variable doesnt exist", function (done) {
        cloudvariables.lockVariable("i-dont-exist")
          .catch((err) => {
            assert(err.message.includes("not found"));
            done();
          });
      });

      it("should allow locker to read locked variable", function () {
        return cloudvariables.getVariable(name)
          .then((value) => assert.equal(value, initialValue));
      });

      it("should allow other user to read locked variable", function () {
        cloudvariables.socket.uuid = client2;
        return cloudvariables.getVariable(name)
          .then((value) => assert.equal(value, initialValue));
      });

      it("should allow original user to set locked variable", function () {
        return cloudvariables.setVariable(name, "newValue");
      });

      it("should NOT allow other user to set locked variable", function () {
        cloudvariables.socket.uuid = client2;
        return cloudvariables.setVariable(name, "newValue")
          .catch((err) => assert(err.message.includes("locked")));
      });

      it("should throw error on unlock of unlocked variable", function (done) {
        const newVar = "unlocked-var";

        cloudvariables.setVariable(newVar, "10")
          .then(() => cloudvariables.unlockVariable(newVar))
          .then(() => done("no error thrown"))
          .catch((err) => {
            assert.equal(err.message, "Variable not locked");
            done();
          });
      });

      it("should block on subsequent locks", function () {
        const events = [];

        cloudvariables.setRequester(client2);
        const acquireLock = cloudvariables.lockVariable(name)
          .then(() => events.push("acquired lock"));

        cloudvariables.setRequester(client1);
        const releaseLock = cloudvariables.unlockVariable(name)
          .then(() => events.push("release lock"));

        return Promise.all([acquireLock, releaseLock])
          .then(() => assert(events[0] === "release lock"));
      });

      it("should no-op on subsequent locks (same client)", async function () {
        // acquire and release a lock simultaneously
        // This next call should no-op rather than block (like in the prev test)
        await cloudvariables.lockVariable(name);

        await cloudvariables.unlockVariable(name);
      });

      it('should only be able to be unlocked by the "locker"', function (done) {
        cloudvariables.setRequester(client2);
        cloudvariables.unlockVariable(name)
          .then(() => done("expected unlock variable to throw error"))
          .catch((err) => {
            assert(err.message.includes("Variable is locked"));
            done();
          });
      });

      it("should apply next lock if lock times out", function () {
        return cloudvariables.unlockVariable(name)
          .then(() => {
            cloudvariables.unwrap()._setMaxLockAge(200);

            return cloudvariables.lockVariable(name);
          })
          .then(() => {
            cloudvariables.setRequester(client2);
            return cloudvariables.lockVariable(name);
          });
      });

      it("should un-queue lock if connection closed early", function (done) {
        cloudvariables.setRequester(client2);

        // Create a new lock then cancel the request
        setTimeout(() => cloudvariables.request.abort(), 100); // this is not ideal

        cloudvariables.lockVariable(name)
          .then(() => done("did not throw exception"))
          .catch((err) => { // Ensure that it throws exception
            assert(err.message.includes("anceled"));

            const queuedLocks = cloudvariables.unwrap()._queuedLocks;
            assert.deepEqual(queuedLocks, {});
            done();
          });
      });

      it("should reject queued locks on variable delete", function (done) {
        cloudvariables.setRequester(client2);

        // Create a new lock then delete the variable
        cloudvariables.lockVariable(name)
          .then(() => done("did not throw exception"))
          .catch((err) => { // Ensure that it throws exception
            assert(err.message.includes("Variable deleted"));

            const queuedLocks = cloudvariables.unwrap()._queuedLocks;
            assert.deepEqual(queuedLocks, {});
            done();
          });

        cloudvariables.setRequester(client1);
        cloudvariables.deleteVariable(name);
      });
    });
  });

  describe("user", function () {
    beforeEach(function () {
      cloudvariables.setRequester("client_1", "brian");
    });

    it("should not be able to set variables if guest", function () {
      const name = newVar();
      cloudvariables.socket.loggedIn = false;
      try {
        return cloudvariables.setUserVariable(name, "world");
      } catch (err) {
        assert(err.message.includes("Login required"));
      }
    });

    it("should get/set variables", function () {
      const name = newVar();
      return cloudvariables.setUserVariable(name, "world")
        .then(() => cloudvariables.getUserVariable(name))
        .then((result) => assert.equal(result, "world"));
    });

    it("should delete variables", function () {
      const name = newVar();
      return cloudvariables.setUserVariable(name, "world")
        .then(() => cloudvariables.deleteUserVariable(name))
        .then(() => cloudvariables.getUserVariable(name))
        .catch((err) => assert(err.message.includes("not found")));
    });

    it("should not set other user variables", function () {
      const name = newVar();
      return cloudvariables.setUserVariable(name, "world")
        .then(() => {
          cloudvariables.socket.username = "hamid";
          return cloudvariables.getUserVariable(name);
        })
        .catch((err) => assert(err.message.includes("not found")));
    });

    it("should not delete variables w/ bad password", function () {
      const name = newVar();
      return cloudvariables.setUserVariable(name, "world")
        .then(() => cloudvariables.deleteUserVariable(name))
        .catch((err) => assert(err.message.includes("password")));
    });
  });
});
