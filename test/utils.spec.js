const utils = require("./assets/utils.js");

describe(utils.suiteName(__filename), function () {
  const assert = require("assert");
  const lib = utils.reqSrc("utils");

  describe("ninvoke", () => {
    const thing = {
      errorWithArgs(msg, callback) {
        callback(new Error(msg));
      },
      error(callback) {
        callback(new Error("error!"));
      },
      doSomethingWithArgs(arg1, arg2, callback) {
        callback(null, arg1 + arg2);
      },
      doSomething(callback) {
        callback(null);
      },
    };

    it("should resolve on success", async () => {
      await lib.ninvoke(thing, "doSomething");
    });

    it("should resolve w/ result", async () => {
      const result = await lib.ninvoke(thing, "doSomethingWithArgs", 1, 5);
      assert.equal(result, 6);
    });

    it("should reject on error", async () => {
      await assert.rejects(lib.ninvoke(thing, "error"));
    });

    it("should reject on error w/ args", async () => {
      await assert.rejects(
        lib.ninvoke(thing, "errorWithArgs", "someError"),
        /someError/,
      );
    });
  });

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

  describe("filterMap", function () {
    it("should omit undefined return values", function () {
      const list = [1, 2, 3, 4, 5];
      const doubledOdds = lib.filterMap(list, (num) => {
        if (num % 2 === 1) {
          return 2 * num;
        }
      });
      assert.deepEqual(doubledOdds, [2, 6, 10]);
    });
  });

  describe("filterAsync", function () {
    it("should keep truthy promise results", async function () {
      const list = [1, 2, 3, 4, 5];
      const odds = await lib.filterAsync(list, async (num) => num % 2 === 1);
      assert.deepEqual(odds, [1, 3, 5]);
    });
  });
});
