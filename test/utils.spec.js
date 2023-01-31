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
});
