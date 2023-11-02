const utils = require("./assets/utils");

describe(utils.suiteName(__filename), function () {
  const assert = require("assert");
  const RpcCaller = utils.reqSrc("rpc-caller");

  describe("RpcCaller", function () {
    it("should cache username", async function () {
      const clientId = "someClientId";
      let count = 0;
      const username = "someUsername";
      const cloud = {
        getClientInfo() {
          count++;
          assert.equal(count, 1);
          return {
            username,
          };
        },
      };
      const caller = new RpcCaller(cloud, clientId);
      assert.equal(await caller.getUsername(), username);
      assert.equal(await caller.getUsername(), username);
      assert.equal(count, 1);
    });

    it("should cache project ID", async function () {
      let count = 0;
      const clientId = "someClientId";
      const projectId = "someProjectID";
      const roleId = "someRoleID";
      const cloud = {
        getClientInfo() {
          count++;
          assert.equal(count, 1);
          return {
            state: { browser: { projectId, roleId } },
          };
        },
      };
      const caller = new RpcCaller(cloud, clientId);
      assert.equal(await caller.getProjectId(), projectId);
      assert.equal(await caller.getProjectId(), projectId);
      assert.equal(count, 1);
    });

    it("should cache role ID", async function () {
      const clientId = "someClientId";
      let count = 0;
      const projectId = "someProjectID";
      const roleId = "someRoleID";
      const cloud = {
        getClientInfo() {
          count++;
          assert.equal(count, 1);
          return {
            state: { browser: { projectId, roleId } },
          };
        },
      };
      const caller = new RpcCaller(cloud, clientId);
      assert.equal(await caller.getRoleId(), roleId);
      assert.equal(await caller.getRoleId(), roleId);
      assert.equal(count, 1);
    });

    it("should cache room state", async function () {
      const clientId = "someClientId";
      let count = 0;
      const projectId = "someProjectID";
      const roleId = "someRoleID";
      const name = "someProjectName";
      const roomState = {
        name,
        id: projectId,
      };

      const cloud = {
        getRoomState(id) {
          count++;
          assert.equal(count, 1);
          assert.equal(id, projectId);
          return roomState;
        },
        getClientInfo() {
          return {
            state: { browser: { projectId, roleId } },
          };
        },
      };
      const caller = new RpcCaller(cloud, clientId);
      assert.deepEqual(await caller.getRoomState(), roomState);
      assert.deepEqual(await caller.getRoomState(), roomState);
      assert.equal(count, 1);
    });
  });

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
