const utils = require("./assets/utils.js");

describe(utils.suiteName(__filename), function () {
  const assert = require("assert");
  const lib = utils.reqSrc("utils");

  describe("ident checker", () => {
    it("should accept C identifiers", () => {
      assert(lib.isValidIdent("foo"));
      assert(lib.isValidIdent("fooBar"));
      assert(lib.isValidIdent("foo4Bar"));
      assert(lib.isValidIdent("foo4Bar"));
      assert(lib.isValidIdent("foo4Bar5"));
      assert(lib.isValidIdent("foo4Bar5"));
    });

    it("should accept several word separators", () => {
      assert(lib.isValidIdent("foo"));
      assert(lib.isValidIdent("foo Bar"));
      assert(lib.isValidIdent("foo4-Bar"));
      assert(lib.isValidIdent("foo4_Bar"));
      assert(lib.isValidIdent("foo 4 Bar5"));
      assert(lib.isValidIdent("f-o-- o4Ba__r5"));
    });

    it("should forbid illegal characters", () => {
      assert(!lib.isValidIdent("fo$o"));
      assert(!lib.isValidIdent("fo+o"));
      assert(!lib.isValidIdent("f(oo)"));
      assert(!lib.isValidIdent("fo*o"));
      assert(!lib.isValidIdent("f%oo"));
      assert(!lib.isValidIdent("f#oo"));
      assert(!lib.isValidIdent("f'oo"));
      assert(!lib.isValidIdent('f"oo'));
      assert(!lib.isValidIdent("f`oo"));
      assert(!lib.isValidIdent("f:oo"));
      assert(!lib.isValidIdent("f;oo"));
      assert(!lib.isValidIdent("f?oo"));
      assert(!lib.isValidIdent("f,oo"));
    });

    it("should not allow leading or trailing separators", () => {
      assert(!lib.isValidIdent(" foo"));
      assert(!lib.isValidIdent("-foo"));
      assert(!lib.isValidIdent("_foo"));

      assert(!lib.isValidIdent("foo "));
      assert(!lib.isValidIdent("foo-"));
      assert(!lib.isValidIdent("foo_"));
    });

    it("should not allow digits at the beginning", () => {
      assert(!lib.isValidIdent("0foo"));
      assert(!lib.isValidIdent("1foo"));
      assert(!lib.isValidIdent("2foo"));
    });

    it("should allow digits at the end", () => {
      assert(lib.isValidIdent("foo0"));
      assert(lib.isValidIdent("foo1"));
      assert(lib.isValidIdent("foo2"));
    });
  });

  describe("timers", function () {
    describe("setTimeout", function () {
      it("should setTimeout w/ duration", function (done) {
        lib.setTimeout(done, 10);
      });

      it("should setTimeout w/o duration", function (done) {
        lib.setTimeout(done);
      });
    });

    describe("clearTimeout", function () {
      it("should clearTimeout", function (done) {
        const timer = lib.setTimeout(() => done("Timer not stopped"));
        lib.clearTimeout(timer);
        setTimeout(done, 10);
      });
    });

    describe("start/stop timers", function () {
      it("should stop all timers", function (done) {
        const dontCallFns = [
          () => done("First timer not stopped!"),
          () => done("Second timer not stopped!"),
        ];
        dontCallFns.forEach(lib.setTimeout);
        lib.stopTimers();
        lib.clearTimers();
        setTimeout(done, 10);
      });

      it("should start timers", function (done) {
        let calls = 0;
        const callbacks = [
          () => calls++,
          () => calls++,
        ];
        callbacks.forEach(lib.setTimeout);
        lib.stopTimers();
        lib.startTimers();
        lib.setTimeout(() => {
          assert.equal(calls, 2);
          done();
        }, 10);
      });
    });
  });
});
