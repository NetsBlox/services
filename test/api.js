const utils = require("./assets/utils");

describe(utils.suiteName(__filename), function () {
  const { TestSuiteBuilder } = utils;
  const ServicesAPI = utils.reqSrc("api");
  const MockResponse = require("./assets/mock-response");
  const assert = require("assert");

  let testSuite;
  before(async function () {
    this.timeout(5000);
    testSuite = await TestSuiteBuilder().setup();
    await ServicesAPI.initialize();
  });

  after(() => {
    testSuite.takedown();
  });

  describe("validateRPCRequest", function () {
    it("should return 404 if service not found", async function () {
      const response = new MockResponse();
      const serviceName = "Dev??";
      const request = new MockRequest(serviceName, "echo");
      const isValid = await ServicesAPI.validateRPCRequest(
        serviceName,
        request,
        response,
      );
      assert(!isValid, "RPC request falsey reported as valid");
      assert.equal(response.code, 404);
    });

    it("should return 404 if RPC not found (valid service)", async function () {
      const response = new MockResponse();
      const serviceName = "Dev";
      const request = new MockRequest(serviceName, "unknown");
      const isValid = await ServicesAPI.validateRPCRequest(
        serviceName,
        request,
        response,
      );
      assert(!isValid, "RPC request falsely reported as valid");
      assert.equal(response.code, 404);
    });

    it("should return 400 if missing client ID", async function () {
      const response = new MockResponse();
      const serviceName = "PublicRoles";
      const request = new MockRequest(serviceName, "getPublicRoleId");
      delete request.query.clientId;
      const isValid = await ServicesAPI.validateRPCRequest(
        serviceName,
        request,
        response,
      );
      assert(!isValid, "RPC request falsely reported as valid");
      assert.equal(response.code, 400);
    });

    it("should return true if valid RPC", async function () {
      const response = new MockResponse();
      const serviceName = "PublicRoles";
      const request = new MockRequest(serviceName, "getPublicRoleId");
      const isValid = await ServicesAPI.validateRPCRequest(
        serviceName,
        request,
        response,
      );
      assert(isValid, response.response);
      assert.equal(response.code, undefined);
    });
  });

  function MockRequest(service, rpc) {
    this.query = {
      projectId: "project1",
      clientId: "someClientId",
    };
    this.params = {
      serviceName: service,
      rpcName: rpc,
    };
  }
});
