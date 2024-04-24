// handles the incoming input arguments for the RPCs. Parses and validates the inputs based on the code docs for the functions
const _ = require("lodash");
const blocks2js = require("./blocks2js");
const { cleanMarkup } = require("./jsdoc-extractor");
const { isProfane } = require("./utils");
const Cloud = require("./cloud-client");

let typeTape = null;
function withTypeTape(fn) {
  const oldTypeTape = typeTape;

  typeTape = [];
  const result = fn();
  const types = typeTape;

  typeTape = oldTypeTape;
  return [types, result];
}
const GENERIC_ERROR = new Error(""); // don't add to the error msg generated by rpc-manager

const NB_TYPES = {
  Array: "List",
  Object: "Structured Data",
  BoundedNumber: "Number",
};
// converts a javascript type name into netsblox type name
function getNBType(jsType) {
  return NB_TYPES[jsType] || jsType;
}

class InputTypeError extends Error {}
class ParameterError extends InputTypeError {}
class EnumError extends ParameterError {
  constructor(name, variants) {
    super(`${name || "It"} must be one of ${variants.join(", ")}`);
  }
}

function getErrorMessage(arg, err) {
  const typeName = arg.type.name;
  const netsbloxType = getNBType(typeName);
  const omitTypeName = err instanceof ParameterError ||
    err.message.includes(netsbloxType);
  const msg = omitTypeName
    ? `"${arg.name}" is not valid.`
    : `"${arg.name}" is not a valid ${netsbloxType}.`;

  return err.message ? `${msg} ${err.message}` : msg;
}

// Any is the only first-order type, and it has no base type
const types = { Any: (input) => input };
const typesMeta = { // must be the same format produced by defineType()
  Any: { // Any should be the only type not introduced by defineType()
    hidden: false,
    displayName: "Any",
    description: "A value of any type.",
    rawDescription: "A value of any type.",
    baseType: null,
  },
};
const dispToType = { Any: "Any" }; // maps display name to internal name

function getTypeParser(type) {
  if (!type) return undefined;
  return typeof type !== "object"
    ? types[type]
    : (input) => types[type.name](input, type.params);
}

const DEFINE_TYPE_FIELDS = [
  "hidden",
  "name",
  "displayName",
  "description",
  "baseType",
  "baseParams",
  "parser",
];

// introduces a new type to the services type system. settings are specified by info fields, which are defined below:
// hidden: bool - denotes if the type should be hidden from users in documentation
// name: string - the (internal) name of the type to introduce. two types with the same name is forbidden.
// displayName: string?
//         - the user-level name of the type shown in documentation. if omitted, defaults to (internal) name.
//         - two non-hidden types with the same display name is forbidden.
// description: string - a description for the type, which is visible in the documentation.
// baseType: string - the (internal) name of the base type. if there is no appropriate base type, you can use 'Any', which is a no-op.
// baseParams: (any[] | dict<string,any> | params => params)?
//         - the parameters to pass to the base type parser. this can be an array of strings, an object with string keys, or a param mapping function (see below).
//         - if no value is specified, then nothing (undefined) is passed to the base type parser for the params input.
//         - if the value is any[] or dict<string,any>, this value is passed directly to the base type parser as-is.
//         - if the value is a param mapping function, the (single) input is the derived type params, and the output is the params to use for the base type.
//         - any[] values and dict<string,any> keys are exposed as the params in the metadata, while a mapping function shows as no params in the metadata.
// parser: (U => T)?
//         - a function that maps from the output type of base type parser to the desired final output type.
//         - if no parser is specified, the result of the base type parser is returned directly.
// returns: a derived parser function of form (input, params, ctx) => T
function defineType(info) {
  if (typeof info !== "object") throw Error("Type info must be an object");

  const extra_fields = new Set(Object.keys(info));
  for (const expected of DEFINE_TYPE_FIELDS) extra_fields.delete(expected);
  if (extra_fields.size) {
    throw Error(
      `Unrecognized defineType fields: [${
        Array.from(extra_fields).join(", ")
      }]`,
    );
  }

  if (!info.hidden) info.hidden = false;
  if (typeof (info.hidden) !== "boolean") {
    throw Error("Type hidden flag must be a boolean");
  }

  if (!info.name) throw Error("A type name is required");
  if (typeof (info.name) !== "string") {
    throw Error("Type name must be a string");
  }

  if (!info.displayName) info.displayName = info.name;
  if (typeof (info.displayName) !== "string") {
    throw Error("Display name must be a string");
  }
  if (!info.hidden && dispToType[info.displayname]) {
    throw Error(
      `A type (${
        dispToType[info.displayname]
      }) with display name ${info.displayName} already exists.`,
    );
  }

  if (!info.description) {
    throw Error(
      "To enforce good documentation, a type description is required",
    );
  }
  if (typeof (info.description) !== "string") {
    throw Error("Type description must be a string");
  }

  if (!info.baseType) {
    throw Error(
      'For future proofing, a base type is required. If there is no appropriate base type, you may use "Any"',
    );
  }
  if (typeof (info.baseType) !== "string") {
    throw Error("Base type must be a string");
  }

  if (!info.parser) info.parser = (v) => v;
  if (typeof (info.parser) !== "function") {
    throw Error("Type parser must be a function");
  }

  let baseParamsMeta = null;
  let getParams = () => undefined;
  if (typeof (info.baseParams) === "object") {
    getParams = () => info.baseParams;
    baseParamsMeta = Array.isArray(info.baseParams)
      ? info.baseParams
      : Object.keys(info.baseParams);
  } else if (typeof (info.baseParams) === "function") {
    getParams = info.baseParams;
  } else if (info.baseParams) {
    throw Error("Base params must be an array, object, or function");
  }

  const typeMeta = {
    hidden: info.hidden,
    displayName: info.displayName,
    description: cleanMarkup(info.description),
    rawDescription: info.description,
    baseType: {
      name: info.baseType,
      params: baseParamsMeta,
    },
  };
  const argType = new RPCArgumentType(
    info.name,
    typeMeta,
    info.parser,
    getParams,
  );
  if (typeTape) {
    typeTape.push(argType);
  } else {
    registerType(argType);
  }
}

class RPCArgumentType {
  constructor(name, meta, parser, getBaseTypeParameters) {
    this.name = name;
    this.meta = meta;
    this.parser = parser;
    this.getBaseTypeParameters = getBaseTypeParameters;
  }
}

function registerType(argType, serviceName) {
  const { name, meta, parser } = argType;

  if (types[name]) throw Error(`Attempt to redefine existing type: ${name}`);

  const baseType = meta.baseType.name;
  const base = types[baseType];
  if (!base) {
    throw Error(
      `Base type ${baseType} does not exist. Avoid referencing types from external files (other than those defined in this file)`,
    );
  }
  const derivedParser = async (input, params, ctx) =>
    parser(
      await base(input, await argType.getBaseTypeParameters(params), ctx),
      params,
      ctx,
    );

  meta.service = serviceName;
  types[name] = derivedParser;
  typesMeta[name] = meta;

  if (!meta.hidden) {
    if (dispToType[meta.displayName]) {
      throw Error(
        `Attempt to redefine existing type: ${meta.displayName} (display name). Consider marking one as hidden.`,
      );
    }
    dispToType[meta.displayName] = name;
  }
}

defineType({
  name: "String",
  description: "Any piece of text.",
  baseType: "Any",
  parser: (input) => {
    if (typeof input === "object") throw new InputTypeError();
    return input.toString();
  },
});

defineType({
  name: "NonProfaneString",
  description: "A piece of text with profanity filtering applied.",
  baseType: "Any",
  displayName: "String",
  hidden: true, // required because display name 'String' is already used
  parser: (input) => {
    if (isProfane(input.toString())) {
      throw new Error("This text is not appropriate.");
    }

    return input.toString();
  },
});

defineType({
  name: "Enum",
  description: "A string with a restricted set of valid values.",
  baseType: "String",
  parser: (str, variants) => {
    const lower = str.toLowerCase();
    const variantDict = !Array.isArray(variants)
      ? variants
      : _.fromPairs(variants.map((name) => [name, name]));

    for (const variant in variantDict) {
      if (lower === variant.toLowerCase()) return variantDict[variant];
    }

    throw new EnumError(undefined, Object.keys(variantDict));
  },
});

defineType({
  name: "Boolean",
  description: "A true or false value.",
  baseType: "Enum",
  baseParams: { "true": true, "false": false },
});

defineType({
  name: "Number",
  description: "Any numeric value.",
  baseType: "Any",
  parser: (input) => {
    input = parseFloat(input);
    if (isNaN(input)) throw GENERIC_ERROR;
    return input;
  },
});

defineType({
  name: "Union",
  displayName: "AnyOf",
  description: "A value which is any of the listed allowed types.",
  baseType: "Any",
  parser: async (input, params = []) => {
    let errorMsg = "Input was not one of the allowed types:";
    for (const ty of params) {
      const parser = getTypeParser(ty);
      try {
        return await parser(input);
      } catch (e) {
        errorMsg += "\n" + e;
      }
    }
    throw Error(errorMsg);
  },
});

defineType({
  name: "Array",
  displayName: "List",
  description: "A list of (zero or more) values.",
  baseType: "Any",
  parser: async (input, params = []) => {
    const [typeParam, min = 0, max = Infinity] = params;
    const innerType = getTypeParser(typeParam);

    if (!Array.isArray(input)) throw new InputTypeError();
    if (innerType) {
      let i = 0;
      try {
        for (; i < input.length; ++i) input[i] = await innerType(input[i]);
      } catch (e) {
        throw new ParameterError(`Item ${i + 1} ${e}`);
      }
    }
    if (min === max && input.length !== min) {
      throw new ParameterError(`List must contain ${min} items`);
    }
    if (input.length < min) {
      throw new ParameterError(`List must contain at least ${min} items`);
    }
    if (input.length > max) {
      throw new ParameterError(`List must contain at most ${max} items`);
    }
    return input;
  },
});

defineType({
  name: "Tuple",
  description: "A list of a specific number of values of specific types",
  baseType: "Array",
  parser: async (input, params) => {
    if (input.length != params.length) {
      throw new ParameterError(
        `Tuple expected ${params.length} values, but got ${input.length} values`,
      );
    }
    const res = [];
    for (let i = 0; i < params.length; ++i) {
      try {
        res.push(await getTypeParser(params[i])(input[i]));
      } catch (e) {
        throw new ParameterError(`Tuple item ${i + 1}: ${e}`);
      }
    }
    return res;
  },
});

// all Object types are going to be structured data (simplified json for snap environment)
defineType({
  name: "Object",
  description:
    "An unordered (i.e., the order does not matter) set of named fields with values.\n" +
    "This is constructed as a list of lists, where each inner list has two values: the field name and its corresponding value.\n" +
    "The following is an example of structured data:\n\n" +
    '``[["name", "John Doe"], ["age", 15], ["address", "123 Street Ave."]]``\n\n' +
    'This is used to encode complex data such as information about a person (e.g., name, age, address, etc.) or some other "object" being described.\n' +
    "Information like this could be stored in several ways, such as a list of just the field values (without the field names).\n" +
    "However, storing it like an ``Object`` (with the field names) allows for the fields to be specified in any order, or potentially omitting some fields,\n" +
    "and preserves information about what each value means.\n\n" +
    'In NetsBlox, this is also sometimes called "structured data" due to other langues (e.g., C/C++ and Rust) calling this type of data a "struct", which is short for "structure".\n' +
    'Other languages, like Javascript, call this an "object", which is the official name of the NetsBlox type.\n\n' +
    "The official ``Structured data`` library of blocks can be used to work with structured data more easily.\n" +
    "This can be imported through the ``File > Libraries...`` menu in the NetsBlox editor, and the imported blocks show up in the ``Custom`` tab of blocks.",
  baseType: "Any",
  parser: async (input, params = [], ctx) => {
    // check if it has the form of structured data
    let isArray = Array.isArray(input);
    if (
      !isArray || !input.every((pair) => pair.length === 2 || pair.length === 1)
    ) {
      throw new InputTypeError("It should be a list of (key, value) pairs.");
    }
    input = _.fromPairs(input);
    if (!params.length) return input; // no params means we accept anything, so return raw input as obj

    const res = {};
    for (const param of params) {
      const value = input[param.name];
      delete input[param.name];
      const isMissingField = value === undefined || value === null;

      if (isMissingField) {
        if (param.optional) continue;
        throw new ParameterError(`It must contain a(n) ${param.name} field`);
      }

      try {
        res[param.name] = await types[param.type.name](
          value,
          param.type.params,
          ctx,
        );
      } catch (err) {
        throw new ParameterError(`Field ${getErrorMessage(param, err)}`);
      }
    }

    const extraFields = Object.keys(input);
    if (extraFields.length) {
      throw new ParameterError(
        `It contains extra fields: ${extraFields.join(", ")}`,
      );
    }
    return res;
  },
});

const FUNC_DESC = "A block of code that can be executed.";
defineType({
  name: "Function",
  description: FUNC_DESC,
  baseType: "Any",
  parser: async (blockXml, _params, ctx) => {
    let roleName = "";
    let roleNames = [""];

    if (ctx) {
      const room = await Cloud.getRoomState(ctx.caller.projectId);
      if (room) {
        roleNames = Object.values(room.roles)
          .map((role) => role.name);
        roleName = room.roles[ctx.caller.roleId].name;
      }
    }

    let factory = blocks2js.compile(blockXml);
    let env = blocks2js.newContext();
    env.__start = function (project) {
      project.ctx = ctx;
      project.roleName = roleName;
      project.roleNames = roleNames;
    };
    const fn = await factory(env);
    const { doYield } = env;
    return function () {
      env.doYield = doYield.bind(null, Date.now());
      return fn.apply(this, arguments);
    };
  },
});

defineType({
  name: "SerializedFunction",
  displayName: "Function",
  hidden: true, // required because display name 'Function' is already used
  description: FUNC_DESC,
  baseType: "Any",
  parser: async (blockXml, _params, ctx) => {
    await types.Function(blockXml, _params, ctx); // check that it compiles
    return blockXml;
  },
});

// in the future, this should have a useful parser of some kind
defineType({
  name: "Image",
  description: "Any image",
  baseType: "Any",
});
// in the future, this should have a useful parser of some kind
defineType({
  name: "Audio",
  description: "Any audio clip",
  baseType: "Any",
});

defineType({
  name: "BoundedNumber",
  description: "A number with a minimum and/or maximum value.",
  baseType: "Number",
  parser: (number, params) => {
    const [min, max] = params.map((num) => parseFloat(num));
    if (isNaN(max)) { // only minimum specified
      if (number < min) {
        throw new ParameterError(`Number must be greater than ${min}`);
      }
      return number;
    }

    if (isNaN(min)) { // only maximum specified
      if (max < number) {
        throw new ParameterError(`Number must be less than ${max}`);
      }
      return number;
    }

    if (number < min || max < number) { // both min and max bounds
      throw new ParameterError(`Number must be between ${min} and ${max}`);
    }
    return number;
  },
});

defineType({
  name: "Integer",
  description: "A whole number.",
  baseType: "Number",
  parser: (input) => {
    if (!Number.isInteger(input)) {
      throw new InputTypeError("Number must be an integer (whole number)");
    }
    return input;
  },
});

defineType({
  name: "BoundedInteger",
  description: "An integer with a minimum and/or maximum value.",
  baseType: "BoundedNumber",
  baseParams: (p) => p, // pass our params to the base type parser
  parser: (input) => {
    if (!Number.isInteger(input)) {
      throw new InputTypeError("Number must be an integer (whole number)");
    }
    return input;
  },
});

defineType({
  name: "YearSince",
  description:
    "A year starting at some point and ranging up to the current year",
  baseType: "BoundedInteger",
  baseParams: (p) => [p[0], new Date().getFullYear()],
});

defineType({
  name: "BoundedString",
  description: "A string (text) with a minimum and/or maximum length.",
  baseType: "String",
  parser: (str, params) => {
    const [min, max] = params.map((num) => parseInt(num));

    if (max === min) {
      if (str.length != min) throw new ParameterError(`Length must be ${min}`);
    } else if (isNaN(max)) { // only minimum specified
      if (str.length < min) {
        throw new ParameterError(`Length must be greater than ${min}`);
      }
    } else if (isNaN(min)) { // only maximum specified
      if (max < str.length) {
        throw new ParameterError(`Length must be less than ${max}`);
      }
    } else if (str.length < min || max < str.length) { // both min and max bounds
      throw new ParameterError(`Length must be between ${min} and ${max}`);
    }

    return str;
  },
});

const TIME_MS = 1;
const TIME_SEC = 1000 * TIME_MS;
const TIME_MIN = 60 * TIME_SEC;
const TIME_HR = 60 * TIME_MIN;
const TIME_DAY = 24 * TIME_HR;
const TIME_WEEK = 7 * TIME_DAY;
const TIME_UNITS_MS = {
  "ms": TIME_MS,
  "msec": TIME_MS,
  "msecs": TIME_MS,
  "millisecond": TIME_MS,
  "milliseconds": TIME_MS,
  "s": TIME_SEC,
  "sec": TIME_SEC,
  "secs": TIME_SEC,
  "second": TIME_SEC,
  "seconds": TIME_SEC,
  "m": TIME_MIN,
  "min": TIME_MIN,
  "mins": TIME_MIN,
  "minute": TIME_MIN,
  "minutes": TIME_MIN,
  "h": TIME_HR,
  "hr": TIME_HR,
  "hrs": TIME_HR,
  "hour": TIME_HR,
  "hours": TIME_HR,
  "d": TIME_DAY,
  "day": TIME_DAY,
  "days": TIME_DAY,
  "w": TIME_WEEK,
  "week": TIME_WEEK,
  "weeks": TIME_WEEK,
};

function parseDuration(input) {
  input = input.trimLeft();
  let res = 0;
  while (input.length != 0) {
    const delta = input.match(/^([+-]?)\s*(\d+\.?\d*)\s*([^+-\s]*)/);
    if (!delta) throw Error(`Failed to parse "${input}" as a duration`);
    if (delta[3].length === 0) {
      throw Error(`Time offset "${delta[0]}" missing units`);
    }

    input = input.slice(delta[0].length).trimLeft();
    const amount = +`${delta[1]}${delta[2]}`;
    const unit = delta[3].toLowerCase();

    const unitms = TIME_UNITS_MS[unit];
    if (!unitms) throw Error(`Unknown time unit: "${delta[2]}"`);
    res += amount * unitms;
  }
  return res;
}
defineType({
  name: "Duration",
  description: "A length of time such as ``1min`` or ``5hr + 12s``",
  baseType: "String",
  parser: parseDuration,
});

defineType({
  name: "Date",
  description: "A calendar date.",
  baseType: "String",
  parser: (input) => {
    const grabNumber = (input) => {
      const res = input.match(/^\s*([+-]?)\s*(\d+\.?\d*)\s*$/);
      return res ? +`${res[1]}${res[2]}` : null;
    };
    const basicParser = (input, orElse) => {
      const num = grabNumber(input);
      const res = new Date(num !== null ? num : input);
      if (!isNaN(+res)) return res;
      if (orElse !== undefined) return orElse;
      throw GENERIC_ERROR;
    };

    const MAX_DATE_LEN = 128;
    let dateLen = Math.min(MAX_DATE_LEN, input.length);
    let deltaSepPos = 0;
    let spacePrefix = true;
    for (; deltaSepPos < dateLen; ++deltaSepPos) {
      if (
        !spacePrefix && "+-".includes(input[deltaSepPos]) &&
        " \t".includes(input[deltaSepPos - 1])
      ) break;
      if (spacePrefix && !" \t".includes(input[deltaSepPos])) {
        spacePrefix = false;
      }
    }
    dateLen = deltaSepPos;

    let date = null;
    for (; dateLen > 0; --dateLen) {
      date = basicParser(input.slice(0, dateLen), null);
      if (date) break;
    }
    if (!date) {
      const meta = input.match(/^\s*(\w+)/);
      if (!meta) return basicParser(input);

      if (meta[1] === "now") date = new Date();
      else if (meta[1] === "today") date = new Date().setHours(0, 0, 0, 0);
      else return basicParser(input);
      dateLen = meta[0].length;
    }

    return new Date(+date + parseDuration(input.slice(dateLen)));
  },
});

defineType({
  name: "Latitude",
  description: "A latitude position in degrees ``[-90, 90]``.",
  baseType: "BoundedNumber",
  baseParams: ["-90", "90"],
});

defineType({
  name: "Longitude",
  description: "A longitude position in degrees ``[-180, 180]``.",
  baseType: "BoundedNumber",
  baseParams: ["-180", "180"],
});

module.exports = {
  parse: types,
  getNBType,
  withTypeTape,
  registerType,
  defineType,
  typesMeta,
  getErrorMessage,
  Errors: {
    ParameterError,
    InputTypeError,
  },
};
