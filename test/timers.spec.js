const testUtils = require("./assets/utils.js");

describe(testUtils.suiteName(__filename), function () {
  const { newScope, sleep } = testUtils.reqSrc("timers");
  const assert = require("assert");

  let testSuite;
  before(async () => testSuite = await testUtils.TestSuiteBuilder().setup());
  after(() => testSuite.takedown());

  let timers;
  beforeEach(() => timers = newScope());
  afterEach(() => timers.stopTimers());
  describe("setTimeout", function () {
    it("should support duration", function (done) {
      timers.setTimeout(done, 10);
    });

    it("should support variadic arguments", function (done) {
      timers.setTimeout(
        (arg1, arg2, arg3) => {
          assert.equal(arg1, 1);
          assert.equal(arg2, 2);
          assert.equal(arg3, 3);
          done();
        },
        10,
        1,
        2,
        3,
      );
    });

    it("should be callable w/o duration", function (done) {
      timers.setTimeout(done);
    });
  });

  describe("clearTimeout", function () {
    it("should clearTimeout", function (done) {
      const timer = timers.setTimeout(() => done("Timer not stopped"));
      timers.clearTimeout(timer);
      setTimeout(done, 10);
    });
  });

  describe("setInterval", function () {
    it("should call multiple times", async function () {
      let called = 0;
      const cb = () => called++;
      timers.setInterval(cb);
      await sleep(10);
      assert(called > 1);
    });

    it("should pause", async function () {
      let called = 0;
      const cb = () => called++;
      const timer = timers.setInterval(cb);
      timer.pause();
      await sleep(10);
      assert.equal(called, 0);
    });

    it("should support variadic arguments", async function () {
      let called = 0;
      timers.setInterval(
        (arg1, arg2, arg3) => {
          assert.equal(arg1, 1);
          assert.equal(arg2, 2);
          assert.equal(arg3, 3);
          called++;
        },
        1,
        1,
        2,
        3,
      );
      await sleep(10);
      assert(called > 0);
    });
  });

  describe("clearInterval", function () {
    it("should clear fn", async function () {
      let called = 0;
      const cb = () => called++;
      const timer = timers.setInterval(cb);
      timers.clearInterval(timer);
      await sleep(10);
      assert.equal(called, 0);
    });
  });

  describe("start/stop timers", function () {
    it("should stop all timers", function (done) {
      const dontCallFns = [
        () => done("First timer not stopped!"),
        () => done("Second timer not stopped!"),
      ];
      dontCallFns.forEach(timers.setTimeout);
      timers.stopTimers();
      timers.clearTimers();
      setTimeout(done, 10);
    });

    it("should start timers", function (done) {
      let calls = 0;
      const callbacks = [
        () => calls++,
        () => calls++,
      ];
      callbacks.forEach(timers.setTimeout);
      timers.stopTimers();
      timers.startTimers();
      timers.setTimeout(() => {
        assert.equal(calls, 2);
        done();
      }, 10);
    });
  });
});
