const utils = require("./assets/utils");

describe(utils.suiteName(__filename), function () {
  const assert = require("assert");

  describe("CallerSnapshot", function () {
    const { CallerSnapshot } = utils.reqSrc("rpc-caller");

    it("should change username w/ setUsername", async function () {
      const username = "newUsername";
      const clientId = "_netsblox" + Date.now();
      const clientInfo = { username: "username" };
      const caller = new CallerSnapshot(clientId, clientInfo, {});
      caller.setUsername(username);
      assert.equal(await caller.getUsername(), username);
    });

    it("should load from data", async function () {
      const clientId = "_netsblox" + Date.now();
      const clientInfo = {
        state: {
          browser: {
            projectId: "someProjectID",
            roleId: "someRoleID",
          },
        },
        username: "username",
      };
      const roomState = {
        name: "someProjectName",
      };

      const caller = new CallerSnapshot(clientId, clientInfo, roomState);
      const data = JSON.parse(JSON.stringify(caller));

      const loadedCaller = CallerSnapshot.load(data);
      assert.equal(caller.clientId, clientId);
      assert.equal(await caller.getUsername(), clientInfo.username);
      assert.equal(
        await caller.getProjectId(),
        clientInfo.state.browser.projectId,
      );
      assert.equal(
        await caller.getRoleId(),
        clientInfo.state.browser.roleId,
      );

      assert.deepEqual(
        await caller.getRoomState(),
        roomState,
      );
    });
  });
  // TODO: test setUsername
});
