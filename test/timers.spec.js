const testUtils = require("./assets/utils.js");

describe.only(testUtils.suiteName(__filename), function () {
  const timers = testUtils.reqSrc("timers");
  const utils = testUtils.reqSrc("utils");
  const assert = require("assert");

  describe("setTimeout", function () {
    it("should setTimeout w/ duration", function (done) {
      timers.setTimeout(done, 10);
    });

    it("should setTimeout w/o duration", function (done) {
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
      const timer = timers.setInterval(cb);
      await utils.sleep(10);
      assert(called > 1);
      timers.clearInterval(timer);
    });

    it("should pause", async function () {
      let called = 0;
      const cb = () => called++;
      const timer = timers.setInterval(cb);
      timer.pause();
      await utils.sleep(10);
      assert.equal(called, 0);
      timers.clearInterval(timer);
    });
  });

  describe("clearInterval", function () {
    it("should clear fn", async function () {
      let called = 0;
      const cb = () => called++;
      const timer = timers.setInterval(cb);
      timers.clearInterval(timer);
      await utils.sleep(10);
      assert.equal(called, 0);
      timers.clearInterval(timer);
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
