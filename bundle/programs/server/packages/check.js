Package["core-runtime"].queue("check",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var check, Match;

var require = meteorInstall({"node_modules":{"meteor":{"check":{"match.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/check/match.js                                                                                           //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      check: () => check,
      Match: () => Match
    });
    let isPlainObject;
    module.link("./isPlainObject", {
      isPlainObject(v) {
        isPlainObject = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Things we explicitly do NOT support:
    //    - heterogenous arrays

    const currentArgumentChecker = new Meteor.EnvironmentVariable();
    const hasOwn = Object.prototype.hasOwnProperty;
    const format = result => {
      const err = new Match.Error(result.message);
      if (result.path) {
        err.message += " in field ".concat(result.path);
        err.path = result.path;
      }
      return err;
    };
    function nonEmptyStringCondition(value) {
      check(value, String);
      return value.length > 0;
    }

    /**
     * @summary Check that a value matches a [pattern](#matchpatterns).
     * If the value does not match the pattern, throw a `Match.Error`.
     * By default, it will throw immediately at the first error encountered. Pass in { throwAllErrors: true } to throw all errors.
     *
     * Particularly useful to assert that arguments to a function have the right
     * types and structure.
     * @locus Anywhere
     * @param {Any} value The value to check
     * @param {MatchPattern} pattern The pattern to match `value` against
     * @param {Object} [options={}] Additional options for check
     * @param {Boolean} [options.throwAllErrors=false] If true, throw all errors
     */
    function check(value, pattern) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
        throwAllErrors: false
      };
      // Record that check got called, if somebody cared.
      //
      // We use getOrNullIfOutsideFiber so that it's OK to call check()
      // from non-Fiber server contexts; the downside is that if you forget to
      // bindEnvironment on some random callback in your method/publisher,
      // it might not find the argumentChecker and you'll get an error about
      // not checking an argument that it looks like you're checking (instead
      // of just getting a "Node code must run in a Fiber" error).
      const argChecker = currentArgumentChecker.getOrNullIfOutsideFiber();
      if (argChecker) {
        argChecker.checking(value);
      }
      const result = testSubtree(value, pattern, options.throwAllErrors);
      if (result) {
        if (options.throwAllErrors) {
          throw Array.isArray(result) ? result.map(r => format(r)) : [format(result)];
        } else {
          throw format(result);
        }
      }
    }
    ;

    /**
     * @namespace Match
     * @summary The namespace for all Match types and methods.
     */
    const Match = {
      Optional: function (pattern) {
        return new Optional(pattern);
      },
      Maybe: function (pattern) {
        return new Maybe(pattern);
      },
      OneOf: function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        return new OneOf(args);
      },
      Any: ['__any__'],
      Where: function (condition) {
        return new Where(condition);
      },
      NonEmptyString: ['__NonEmptyString__'],
      ObjectIncluding: function (pattern) {
        return new ObjectIncluding(pattern);
      },
      ObjectWithValues: function (pattern) {
        return new ObjectWithValues(pattern);
      },
      // Matches only signed 32-bit integers
      Integer: ['__integer__'],
      // XXX matchers should know how to describe themselves for errors
      Error: Meteor.makeErrorType('Match.Error', function (msg) {
        this.message = "Match error: ".concat(msg);

        // The path of the value that failed to match. Initially empty, this gets
        // populated by catching and rethrowing the exception as it goes back up the
        // stack.
        // E.g.: "vals[3].entity.created"
        this.path = '';

        // If this gets sent over DDP, don't give full internal details but at least
        // provide something better than 500 Internal server error.
        this.sanitizedError = new Meteor.Error(400, 'Match failed');
      }),
      // Tests to see if value matches pattern. Unlike check, it merely returns true
      // or false (unless an error other than Match.Error was thrown). It does not
      // interact with _failIfArgumentsAreNotAllChecked.
      // XXX maybe also implement a Match.match which returns more information about
      //     failures but without using exception handling or doing what check()
      //     does with _failIfArgumentsAreNotAllChecked and Meteor.Error conversion

      /**
       * @summary Returns true if the value matches the pattern.
       * @locus Anywhere
       * @param {Any} value The value to check
       * @param {MatchPattern} pattern The pattern to match `value` against
       */
      test(value, pattern) {
        return !testSubtree(value, pattern);
      },
      // Runs `f.apply(context, args)`. If check() is not called on every element of
      // `args` (either directly or in the first level of an array), throws an error
      // (using `description` in the message).
      _failIfArgumentsAreNotAllChecked(f, context, args, description) {
        const argChecker = new ArgumentChecker(args, description);
        const result = currentArgumentChecker.withValue(argChecker, () => f.apply(context, args));

        // If f didn't itself throw, make sure it checked all of its arguments.
        argChecker.throwUnlessAllArgumentsHaveBeenChecked();
        return result;
      }
    };
    class Optional {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class Maybe {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class OneOf {
      constructor(choices) {
        if (!choices || choices.length === 0) {
          throw new Error('Must provide at least one choice to Match.OneOf');
        }
        this.choices = choices;
      }
    }
    class Where {
      constructor(condition) {
        this.condition = condition;
      }
    }
    class ObjectIncluding {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class ObjectWithValues {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    const stringForErrorMessage = function (value) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (value === null) {
        return 'null';
      }
      if (options.onlyShowType) {
        return typeof value;
      }

      // Your average non-object things.  Saves from doing the try/catch below for.
      if (typeof value !== 'object') {
        return EJSON.stringify(value);
      }
      try {
        // Find objects with circular references since EJSON doesn't support them yet (Issue #4778 + Unaccepted PR)
        // If the native stringify is going to choke, EJSON.stringify is going to choke too.
        JSON.stringify(value);
      } catch (stringifyError) {
        if (stringifyError.name === 'TypeError') {
          return typeof value;
        }
      }
      return EJSON.stringify(value);
    };
    const typeofChecks = [[String, 'string'], [Number, 'number'], [Boolean, 'boolean'],
    // While we don't allow undefined/function in EJSON, this is good for optional
    // arguments with OneOf.
    [Function, 'function'], [undefined, 'undefined']];

    // Return `false` if it matches. Otherwise, returns an object with a `message` and a `path` field or an array of objects each with a `message` and a `path` field when collecting errors.
    const testSubtree = function (value, pattern) {
      let collectErrors = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      let errors = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      let path = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : '';
      // Match anything!
      if (pattern === Match.Any) {
        return false;
      }

      // Basic atomic types.
      // Do not match boxed objects (e.g. String, Boolean)
      for (let i = 0; i < typeofChecks.length; ++i) {
        if (pattern === typeofChecks[i][0]) {
          if (typeof value === typeofChecks[i][1]) {
            return false;
          }
          return {
            message: "Expected ".concat(typeofChecks[i][1], ", got ").concat(stringForErrorMessage(value, {
              onlyShowType: true
            })),
            path: ''
          };
        }
      }
      if (pattern === null) {
        if (value === null) {
          return false;
        }
        return {
          message: "Expected null, got ".concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // Strings, numbers, and booleans match literally. Goes well with Match.OneOf.
      if (typeof pattern === 'string' || typeof pattern === 'number' || typeof pattern === 'boolean') {
        if (value === pattern) {
          return false;
        }
        return {
          message: "Expected ".concat(pattern, ", got ").concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // Match.Integer is special type encoded with array
      if (pattern === Match.Integer) {
        // There is no consistent and reliable way to check if variable is a 64-bit
        // integer. One of the popular solutions is to get reminder of division by 1
        // but this method fails on really large floats with big precision.
        // E.g.: 1.348192308491824e+23 % 1 === 0 in V8
        // Bitwise operators work consistantly but always cast variable to 32-bit
        // signed integer according to JavaScript specs.
        if (typeof value === 'number' && (value | 0) === value) {
          return false;
        }
        return {
          message: "Expected Integer, got ".concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // 'Object' is shorthand for Match.ObjectIncluding({});
      if (pattern === Object) {
        pattern = Match.ObjectIncluding({});
      }
      // This must be invoked before pattern instanceof Array as strings are regarded as arrays
      // We invoke the pattern as IIFE so that `pattern isntanceof Where` catches it 
      if (pattern === Match.NonEmptyString) {
        pattern = new Where(nonEmptyStringCondition);
      }

      // Array (checked AFTER Any, which is implemented as an Array).
      if (pattern instanceof Array) {
        if (pattern.length !== 1) {
          return {
            message: "Bad pattern: arrays must have one type element ".concat(stringForErrorMessage(pattern)),
            path: ''
          };
        }
        if (!Array.isArray(value) && !isArguments(value)) {
          return {
            message: "Expected array, got ".concat(stringForErrorMessage(value)),
            path: ''
          };
        }
        for (let i = 0, length = value.length; i < length; i++) {
          const arrPath = "".concat(path, "[").concat(i, "]");
          const result = testSubtree(value[i], pattern[0], collectErrors, errors, arrPath);
          if (result) {
            result.path = _prependPath(collectErrors ? arrPath : i, result.path);
            if (!collectErrors) return result;
            if (typeof value[i] !== 'object' || result.message) errors.push(result);
          }
        }
        if (!collectErrors) return false;
        return errors.length === 0 ? false : errors;
      }

      // Arbitrary validation checks. The condition can return false or throw a
      // Match.Error (ie, it can internally use check()) to fail.
      if (pattern instanceof Where) {
        let result;
        try {
          result = pattern.condition(value);
        } catch (err) {
          if (!(err instanceof Match.Error)) {
            throw err;
          }
          return {
            message: err.message,
            path: err.path
          };
        }
        if (result) {
          return false;
        }

        // XXX this error is terrible

        return {
          message: 'Failed Match.Where validation',
          path: ''
        };
      }
      if (pattern instanceof Maybe) {
        pattern = Match.OneOf(undefined, null, pattern.pattern);
      } else if (pattern instanceof Optional) {
        pattern = Match.OneOf(undefined, pattern.pattern);
      }
      if (pattern instanceof OneOf) {
        for (let i = 0; i < pattern.choices.length; ++i) {
          const result = testSubtree(value, pattern.choices[i]);
          if (!result) {
            // No error? Yay, return.
            return false;
          }

          // Match errors just mean try another choice.
        }

        // XXX this error is terrible
        return {
          message: 'Failed Match.OneOf, Match.Maybe or Match.Optional validation',
          path: ''
        };
      }

      // A function that isn't something we special-case is assumed to be a
      // constructor.
      if (pattern instanceof Function) {
        if (value instanceof pattern) {
          return false;
        }
        return {
          message: "Expected ".concat(pattern.name || 'particular constructor'),
          path: ''
        };
      }
      let unknownKeysAllowed = false;
      let unknownKeyPattern;
      if (pattern instanceof ObjectIncluding) {
        unknownKeysAllowed = true;
        pattern = pattern.pattern;
      }
      if (pattern instanceof ObjectWithValues) {
        unknownKeysAllowed = true;
        unknownKeyPattern = [pattern.pattern];
        pattern = {}; // no required keys
      }
      if (typeof pattern !== 'object') {
        return {
          message: 'Bad pattern: unknown pattern type',
          path: ''
        };
      }

      // An object, with required and optional keys. Note that this does NOT do
      // structural matches against objects of special types that happen to match
      // the pattern: this really needs to be a plain old {Object}!
      if (typeof value !== 'object') {
        return {
          message: "Expected object, got ".concat(typeof value),
          path: ''
        };
      }
      if (value === null) {
        return {
          message: "Expected object, got null",
          path: ''
        };
      }
      if (!isPlainObject(value)) {
        return {
          message: "Expected plain object",
          path: ''
        };
      }
      const requiredPatterns = Object.create(null);
      const optionalPatterns = Object.create(null);
      Object.keys(pattern).forEach(key => {
        const subPattern = pattern[key];
        if (subPattern instanceof Optional || subPattern instanceof Maybe) {
          optionalPatterns[key] = subPattern.pattern;
        } else {
          requiredPatterns[key] = subPattern;
        }
      });
      for (let key in Object(value)) {
        const subValue = value[key];
        const objPath = path ? "".concat(path, ".").concat(key) : key;
        if (hasOwn.call(requiredPatterns, key)) {
          const result = testSubtree(subValue, requiredPatterns[key], collectErrors, errors, objPath);
          if (result) {
            result.path = _prependPath(collectErrors ? objPath : key, result.path);
            if (!collectErrors) return result;
            if (typeof subValue !== 'object' || result.message) errors.push(result);
          }
          delete requiredPatterns[key];
        } else if (hasOwn.call(optionalPatterns, key)) {
          const result = testSubtree(subValue, optionalPatterns[key], collectErrors, errors, objPath);
          if (result) {
            result.path = _prependPath(collectErrors ? objPath : key, result.path);
            if (!collectErrors) return result;
            if (typeof subValue !== 'object' || result.message) errors.push(result);
          }
        } else {
          if (!unknownKeysAllowed) {
            const result = {
              message: 'Unknown key',
              path: key
            };
            if (!collectErrors) return result;
            errors.push(result);
          }
          if (unknownKeyPattern) {
            const result = testSubtree(subValue, unknownKeyPattern[0], collectErrors, errors, objPath);
            if (result) {
              result.path = _prependPath(collectErrors ? objPath : key, result.path);
              if (!collectErrors) return result;
              if (typeof subValue !== 'object' || result.message) errors.push(result);
            }
          }
        }
      }
      const keys = Object.keys(requiredPatterns);
      if (keys.length) {
        const createMissingError = key => ({
          message: "Missing key '".concat(key, "'"),
          path: collectErrors ? path : ''
        });
        if (!collectErrors) {
          return createMissingError(keys[0]);
        }
        for (const key of keys) {
          errors.push(createMissingError(key));
        }
      }
      if (!collectErrors) return false;
      return errors.length === 0 ? false : errors;
    };
    class ArgumentChecker {
      constructor(args, description) {
        // Make a SHALLOW copy of the arguments. (We'll be doing identity checks
        // against its contents.)
        this.args = [...args];

        // Since the common case will be to check arguments in order, and we splice
        // out arguments when we check them, make it so we splice out from the end
        // rather than the beginning.
        this.args.reverse();
        this.description = description;
      }
      checking(value) {
        if (this._checkingOneValue(value)) {
          return;
        }

        // Allow check(arguments, [String]) or check(arguments.slice(1), [String])
        // or check([foo, bar], [String]) to count... but only if value wasn't
        // itself an argument.
        if (Array.isArray(value) || isArguments(value)) {
          Array.prototype.forEach.call(value, this._checkingOneValue.bind(this));
        }
      }
      _checkingOneValue(value) {
        for (let i = 0; i < this.args.length; ++i) {
          // Is this value one of the arguments? (This can have a false positive if
          // the argument is an interned primitive, but it's still a good enough
          // check.)
          // (NaN is not === to itself, so we have to check specially.)
          if (value === this.args[i] || Number.isNaN(value) && Number.isNaN(this.args[i])) {
            this.args.splice(i, 1);
            return true;
          }
        }
        return false;
      }
      throwUnlessAllArgumentsHaveBeenChecked() {
        if (this.args.length > 0) throw new Error("Did not check() all arguments during ".concat(this.description));
      }
    }
    const _jsKeywords = ['do', 'if', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'false', 'null', 'this', 'true', 'void', 'with', 'break', 'catch', 'class', 'const', 'super', 'throw', 'while', 'yield', 'delete', 'export', 'import', 'public', 'return', 'static', 'switch', 'typeof', 'default', 'extends', 'finally', 'package', 'private', 'continue', 'debugger', 'function', 'arguments', 'interface', 'protected', 'implements', 'instanceof'];

    // Assumes the base of path is already escaped properly
    // returns key + base
    const _prependPath = (key, base) => {
      if (typeof key === 'number' || key.match(/^[0-9]+$/)) {
        key = "[".concat(key, "]");
      } else if (!key.match(/^[a-z_$][0-9a-z_$.[\]]*$/i) || _jsKeywords.indexOf(key) >= 0) {
        key = JSON.stringify([key]);
      }
      if (base && base[0] !== '[') {
        return "".concat(key, ".").concat(base);
      }
      return key + base;
    };
    const isObject = value => typeof value === 'object' && value !== null;
    const baseIsArguments = item => isObject(item) && Object.prototype.toString.call(item) === '[object Arguments]';
    const isArguments = baseIsArguments(function () {
      return arguments;
    }()) ? baseIsArguments : value => isObject(value) && typeof value.callee === 'function';
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"isPlainObject.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/check/isPlainObject.js                                                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  isPlainObject: () => isPlainObject
});
// Copy of jQuery.isPlainObject for the server side from jQuery v3.1.1.

const class2type = {};
const toString = class2type.toString;
const hasOwn = Object.prototype.hasOwnProperty;
const fnToString = hasOwn.toString;
const ObjectFunctionString = fnToString.call(Object);
const getProto = Object.getPrototypeOf;
const isPlainObject = obj => {
  let proto;
  let Ctor;

  // Detect obvious negatives
  // Use toString instead of jQuery.type to catch host objects
  if (!obj || toString.call(obj) !== '[object Object]') {
    return false;
  }
  proto = getProto(obj);

  // Objects with no prototype (e.g., `Object.create( null )`) are plain
  if (!proto) {
    return true;
  }

  // Objects with prototype are plain iff they were constructed by a global Object function
  Ctor = hasOwn.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor === 'function' && fnToString.call(Ctor) === ObjectFunctionString;
};
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      check: check,
      Match: Match
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/check/match.js"
  ],
  mainModulePath: "/node_modules/meteor/check/match.js"
}});

//# sourceURL=meteor://💻app/packages/check.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2hlY2svbWF0Y2guanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2NoZWNrL2lzUGxhaW5PYmplY3QuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiY2hlY2siLCJNYXRjaCIsImlzUGxhaW5PYmplY3QiLCJsaW5rIiwidiIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiY3VycmVudEFyZ3VtZW50Q2hlY2tlciIsIk1ldGVvciIsIkVudmlyb25tZW50VmFyaWFibGUiLCJoYXNPd24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImZvcm1hdCIsInJlc3VsdCIsImVyciIsIkVycm9yIiwibWVzc2FnZSIsInBhdGgiLCJjb25jYXQiLCJub25FbXB0eVN0cmluZ0NvbmRpdGlvbiIsInZhbHVlIiwiU3RyaW5nIiwibGVuZ3RoIiwicGF0dGVybiIsIm9wdGlvbnMiLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJ0aHJvd0FsbEVycm9ycyIsImFyZ0NoZWNrZXIiLCJnZXRPck51bGxJZk91dHNpZGVGaWJlciIsImNoZWNraW5nIiwidGVzdFN1YnRyZWUiLCJBcnJheSIsImlzQXJyYXkiLCJtYXAiLCJyIiwiT3B0aW9uYWwiLCJNYXliZSIsIk9uZU9mIiwiX2xlbiIsImFyZ3MiLCJfa2V5IiwiQW55IiwiV2hlcmUiLCJjb25kaXRpb24iLCJOb25FbXB0eVN0cmluZyIsIk9iamVjdEluY2x1ZGluZyIsIk9iamVjdFdpdGhWYWx1ZXMiLCJJbnRlZ2VyIiwibWFrZUVycm9yVHlwZSIsIm1zZyIsInNhbml0aXplZEVycm9yIiwidGVzdCIsIl9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkIiwiZiIsImNvbnRleHQiLCJkZXNjcmlwdGlvbiIsIkFyZ3VtZW50Q2hlY2tlciIsIndpdGhWYWx1ZSIsImFwcGx5IiwidGhyb3dVbmxlc3NBbGxBcmd1bWVudHNIYXZlQmVlbkNoZWNrZWQiLCJjb25zdHJ1Y3RvciIsImNob2ljZXMiLCJzdHJpbmdGb3JFcnJvck1lc3NhZ2UiLCJvbmx5U2hvd1R5cGUiLCJFSlNPTiIsInN0cmluZ2lmeSIsIkpTT04iLCJzdHJpbmdpZnlFcnJvciIsIm5hbWUiLCJ0eXBlb2ZDaGVja3MiLCJOdW1iZXIiLCJCb29sZWFuIiwiRnVuY3Rpb24iLCJjb2xsZWN0RXJyb3JzIiwiZXJyb3JzIiwiaSIsImlzQXJndW1lbnRzIiwiYXJyUGF0aCIsIl9wcmVwZW5kUGF0aCIsInB1c2giLCJ1bmtub3duS2V5c0FsbG93ZWQiLCJ1bmtub3duS2V5UGF0dGVybiIsInJlcXVpcmVkUGF0dGVybnMiLCJjcmVhdGUiLCJvcHRpb25hbFBhdHRlcm5zIiwia2V5cyIsImZvckVhY2giLCJrZXkiLCJzdWJQYXR0ZXJuIiwic3ViVmFsdWUiLCJvYmpQYXRoIiwiY2FsbCIsImNyZWF0ZU1pc3NpbmdFcnJvciIsInJldmVyc2UiLCJfY2hlY2tpbmdPbmVWYWx1ZSIsImJpbmQiLCJpc05hTiIsInNwbGljZSIsIl9qc0tleXdvcmRzIiwiYmFzZSIsIm1hdGNoIiwiaW5kZXhPZiIsImlzT2JqZWN0IiwiYmFzZUlzQXJndW1lbnRzIiwiaXRlbSIsInRvU3RyaW5nIiwiY2FsbGVlIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiY2xhc3MydHlwZSIsImZuVG9TdHJpbmciLCJPYmplY3RGdW5jdGlvblN0cmluZyIsImdldFByb3RvIiwiZ2V0UHJvdG90eXBlT2YiLCJvYmoiLCJwcm90byIsIkN0b3IiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBQSxNQUFNLENBQUNDLE1BQU0sQ0FBQztNQUFDQyxLQUFLLEVBQUNBLENBQUEsS0FBSUEsS0FBSztNQUFDQyxLQUFLLEVBQUNBLENBQUEsS0FBSUE7SUFBSyxDQUFDLENBQUM7SUFBQyxJQUFJQyxhQUFhO0lBQUNKLE1BQU0sQ0FBQ0ssSUFBSSxDQUFDLGlCQUFpQixFQUFDO01BQUNELGFBQWFBLENBQUNFLENBQUMsRUFBQztRQUFDRixhQUFhLEdBQUNFLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJQyxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNQSxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUdwTTtJQUNBOztJQUVBLE1BQU1DLHNCQUFzQixHQUFHLElBQUlDLE1BQU0sQ0FBQ0MsbUJBQW1CLENBQUQsQ0FBQztJQUM3RCxNQUFNQyxNQUFNLEdBQUdDLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxjQUFjO0lBRTlDLE1BQU1DLE1BQU0sR0FBR0MsTUFBTSxJQUFJO01BQ3ZCLE1BQU1DLEdBQUcsR0FBRyxJQUFJZCxLQUFLLENBQUNlLEtBQUssQ0FBQ0YsTUFBTSxDQUFDRyxPQUFPLENBQUM7TUFDM0MsSUFBSUgsTUFBTSxDQUFDSSxJQUFJLEVBQUU7UUFDZkgsR0FBRyxDQUFDRSxPQUFPLGlCQUFBRSxNQUFBLENBQWlCTCxNQUFNLENBQUNJLElBQUksQ0FBRTtRQUN6Q0gsR0FBRyxDQUFDRyxJQUFJLEdBQUdKLE1BQU0sQ0FBQ0ksSUFBSTtNQUN4QjtNQUVBLE9BQU9ILEdBQUc7SUFDWixDQUFDO0lBRUQsU0FBU0ssdUJBQXVCQSxDQUFDQyxLQUFLLEVBQUU7TUFDdENyQixLQUFLLENBQUNxQixLQUFLLEVBQUVDLE1BQU0sQ0FBQztNQUNwQixPQUFPRCxLQUFLLENBQUNFLE1BQU0sR0FBRyxDQUFDO0lBQ3pCOztJQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ08sU0FBU3ZCLEtBQUtBLENBQUNxQixLQUFLLEVBQUVHLE9BQU8sRUFBdUM7TUFBQSxJQUFyQ0MsT0FBTyxHQUFBQyxTQUFBLENBQUFILE1BQUEsUUFBQUcsU0FBQSxRQUFBQyxTQUFBLEdBQUFELFNBQUEsTUFBRztRQUFFRSxjQUFjLEVBQUU7TUFBTSxDQUFDO01BQ3ZFO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQSxNQUFNQyxVQUFVLEdBQUd2QixzQkFBc0IsQ0FBQ3dCLHVCQUF1QixDQUFDLENBQUM7TUFDbkUsSUFBSUQsVUFBVSxFQUFFO1FBQ2RBLFVBQVUsQ0FBQ0UsUUFBUSxDQUFDVixLQUFLLENBQUM7TUFDNUI7TUFFQSxNQUFNUCxNQUFNLEdBQUdrQixXQUFXLENBQUNYLEtBQUssRUFBRUcsT0FBTyxFQUFFQyxPQUFPLENBQUNHLGNBQWMsQ0FBQztNQUVsRSxJQUFJZCxNQUFNLEVBQUU7UUFDVixJQUFJVyxPQUFPLENBQUNHLGNBQWMsRUFBRTtVQUMxQixNQUFNSyxLQUFLLENBQUNDLE9BQU8sQ0FBQ3BCLE1BQU0sQ0FBQyxHQUFHQSxNQUFNLENBQUNxQixHQUFHLENBQUNDLENBQUMsSUFBSXZCLE1BQU0sQ0FBQ3VCLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQ3ZCLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLENBQUM7UUFDN0UsQ0FBQyxNQUFNO1VBQ0wsTUFBTUQsTUFBTSxDQUFDQyxNQUFNLENBQUM7UUFDdEI7TUFDRjtJQUNGO0lBQUM7O0lBRUQ7QUFDQTtBQUNBO0FBQ0E7SUFDTyxNQUFNYixLQUFLLEdBQUc7TUFDbkJvQyxRQUFRLEVBQUUsU0FBQUEsQ0FBU2IsT0FBTyxFQUFFO1FBQzFCLE9BQU8sSUFBSWEsUUFBUSxDQUFDYixPQUFPLENBQUM7TUFDOUIsQ0FBQztNQUVEYyxLQUFLLEVBQUUsU0FBQUEsQ0FBU2QsT0FBTyxFQUFFO1FBQ3ZCLE9BQU8sSUFBSWMsS0FBSyxDQUFDZCxPQUFPLENBQUM7TUFDM0IsQ0FBQztNQUVEZSxLQUFLLEVBQUUsU0FBQUEsQ0FBQSxFQUFrQjtRQUFBLFNBQUFDLElBQUEsR0FBQWQsU0FBQSxDQUFBSCxNQUFBLEVBQU5rQixJQUFJLE9BQUFSLEtBQUEsQ0FBQU8sSUFBQSxHQUFBRSxJQUFBLE1BQUFBLElBQUEsR0FBQUYsSUFBQSxFQUFBRSxJQUFBO1VBQUpELElBQUksQ0FBQUMsSUFBQSxJQUFBaEIsU0FBQSxDQUFBZ0IsSUFBQTtRQUFBO1FBQ3JCLE9BQU8sSUFBSUgsS0FBSyxDQUFDRSxJQUFJLENBQUM7TUFDeEIsQ0FBQztNQUVERSxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUM7TUFDaEJDLEtBQUssRUFBRSxTQUFBQSxDQUFTQyxTQUFTLEVBQUU7UUFDekIsT0FBTyxJQUFJRCxLQUFLLENBQUNDLFNBQVMsQ0FBQztNQUM3QixDQUFDO01BRURDLGNBQWMsRUFBRSxDQUFDLG9CQUFvQixDQUFDO01BRXRDQyxlQUFlLEVBQUUsU0FBQUEsQ0FBU3ZCLE9BQU8sRUFBRTtRQUNqQyxPQUFPLElBQUl1QixlQUFlLENBQUN2QixPQUFPLENBQUM7TUFDckMsQ0FBQztNQUVEd0IsZ0JBQWdCLEVBQUUsU0FBQUEsQ0FBU3hCLE9BQU8sRUFBRTtRQUNsQyxPQUFPLElBQUl3QixnQkFBZ0IsQ0FBQ3hCLE9BQU8sQ0FBQztNQUN0QyxDQUFDO01BRUQ7TUFDQXlCLE9BQU8sRUFBRSxDQUFDLGFBQWEsQ0FBQztNQUV4QjtNQUNBakMsS0FBSyxFQUFFVCxNQUFNLENBQUMyQyxhQUFhLENBQUMsYUFBYSxFQUFFLFVBQVVDLEdBQUcsRUFBRTtRQUN4RCxJQUFJLENBQUNsQyxPQUFPLG1CQUFBRSxNQUFBLENBQW1CZ0MsR0FBRyxDQUFFOztRQUVwQztRQUNBO1FBQ0E7UUFDQTtRQUNBLElBQUksQ0FBQ2pDLElBQUksR0FBRyxFQUFFOztRQUVkO1FBQ0E7UUFDQSxJQUFJLENBQUNrQyxjQUFjLEdBQUcsSUFBSTdDLE1BQU0sQ0FBQ1MsS0FBSyxDQUFDLEdBQUcsRUFBRSxjQUFjLENBQUM7TUFDN0QsQ0FBQyxDQUFDO01BRUY7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBOztNQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtNQUNFcUMsSUFBSUEsQ0FBQ2hDLEtBQUssRUFBRUcsT0FBTyxFQUFFO1FBQ25CLE9BQU8sQ0FBQ1EsV0FBVyxDQUFDWCxLQUFLLEVBQUVHLE9BQU8sQ0FBQztNQUNyQyxDQUFDO01BRUQ7TUFDQTtNQUNBO01BQ0E4QixnQ0FBZ0NBLENBQUNDLENBQUMsRUFBRUMsT0FBTyxFQUFFZixJQUFJLEVBQUVnQixXQUFXLEVBQUU7UUFDOUQsTUFBTTVCLFVBQVUsR0FBRyxJQUFJNkIsZUFBZSxDQUFDakIsSUFBSSxFQUFFZ0IsV0FBVyxDQUFDO1FBQ3pELE1BQU0zQyxNQUFNLEdBQUdSLHNCQUFzQixDQUFDcUQsU0FBUyxDQUM3QzlCLFVBQVUsRUFDVixNQUFNMEIsQ0FBQyxDQUFDSyxLQUFLLENBQUNKLE9BQU8sRUFBRWYsSUFBSSxDQUM3QixDQUFDOztRQUVEO1FBQ0FaLFVBQVUsQ0FBQ2dDLHNDQUFzQyxDQUFDLENBQUM7UUFDbkQsT0FBTy9DLE1BQU07TUFDZjtJQUNGLENBQUM7SUFFRCxNQUFNdUIsUUFBUSxDQUFDO01BQ2J5QixXQUFXQSxDQUFDdEMsT0FBTyxFQUFFO1FBQ25CLElBQUksQ0FBQ0EsT0FBTyxHQUFHQSxPQUFPO01BQ3hCO0lBQ0Y7SUFFQSxNQUFNYyxLQUFLLENBQUM7TUFDVndCLFdBQVdBLENBQUN0QyxPQUFPLEVBQUU7UUFDbkIsSUFBSSxDQUFDQSxPQUFPLEdBQUdBLE9BQU87TUFDeEI7SUFDRjtJQUVBLE1BQU1lLEtBQUssQ0FBQztNQUNWdUIsV0FBV0EsQ0FBQ0MsT0FBTyxFQUFFO1FBQ25CLElBQUksQ0FBQ0EsT0FBTyxJQUFJQSxPQUFPLENBQUN4QyxNQUFNLEtBQUssQ0FBQyxFQUFFO1VBQ3BDLE1BQU0sSUFBSVAsS0FBSyxDQUFDLGlEQUFpRCxDQUFDO1FBQ3BFO1FBRUEsSUFBSSxDQUFDK0MsT0FBTyxHQUFHQSxPQUFPO01BQ3hCO0lBQ0Y7SUFFQSxNQUFNbkIsS0FBSyxDQUFDO01BQ1ZrQixXQUFXQSxDQUFDakIsU0FBUyxFQUFFO1FBQ3JCLElBQUksQ0FBQ0EsU0FBUyxHQUFHQSxTQUFTO01BQzVCO0lBQ0Y7SUFFQSxNQUFNRSxlQUFlLENBQUM7TUFDcEJlLFdBQVdBLENBQUN0QyxPQUFPLEVBQUU7UUFDbkIsSUFBSSxDQUFDQSxPQUFPLEdBQUdBLE9BQU87TUFDeEI7SUFDRjtJQUVBLE1BQU13QixnQkFBZ0IsQ0FBQztNQUNyQmMsV0FBV0EsQ0FBQ3RDLE9BQU8sRUFBRTtRQUNuQixJQUFJLENBQUNBLE9BQU8sR0FBR0EsT0FBTztNQUN4QjtJQUNGO0lBRUEsTUFBTXdDLHFCQUFxQixHQUFHLFNBQUFBLENBQUMzQyxLQUFLLEVBQW1CO01BQUEsSUFBakJJLE9BQU8sR0FBQUMsU0FBQSxDQUFBSCxNQUFBLFFBQUFHLFNBQUEsUUFBQUMsU0FBQSxHQUFBRCxTQUFBLE1BQUcsQ0FBQyxDQUFDO01BQ2hELElBQUtMLEtBQUssS0FBSyxJQUFJLEVBQUc7UUFDcEIsT0FBTyxNQUFNO01BQ2Y7TUFFQSxJQUFLSSxPQUFPLENBQUN3QyxZQUFZLEVBQUc7UUFDMUIsT0FBTyxPQUFPNUMsS0FBSztNQUNyQjs7TUFFQTtNQUNBLElBQUssT0FBT0EsS0FBSyxLQUFLLFFBQVEsRUFBRztRQUMvQixPQUFPNkMsS0FBSyxDQUFDQyxTQUFTLENBQUM5QyxLQUFLLENBQUM7TUFDL0I7TUFFQSxJQUFJO1FBRUY7UUFDQTtRQUNBK0MsSUFBSSxDQUFDRCxTQUFTLENBQUM5QyxLQUFLLENBQUM7TUFDdkIsQ0FBQyxDQUFDLE9BQU9nRCxjQUFjLEVBQUU7UUFDdkIsSUFBS0EsY0FBYyxDQUFDQyxJQUFJLEtBQUssV0FBVyxFQUFHO1VBQ3pDLE9BQU8sT0FBT2pELEtBQUs7UUFDckI7TUFDRjtNQUVBLE9BQU82QyxLQUFLLENBQUNDLFNBQVMsQ0FBQzlDLEtBQUssQ0FBQztJQUMvQixDQUFDO0lBR0QsTUFBTWtELFlBQVksR0FBRyxDQUNuQixDQUFDakQsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUNsQixDQUFDa0QsTUFBTSxFQUFFLFFBQVEsQ0FBQyxFQUNsQixDQUFDQyxPQUFPLEVBQUUsU0FBUyxDQUFDO0lBRXBCO0lBQ0E7SUFDQSxDQUFDQyxRQUFRLEVBQUUsVUFBVSxDQUFDLEVBQ3RCLENBQUMvQyxTQUFTLEVBQUUsV0FBVyxDQUFDLENBQ3pCOztJQUVEO0lBQ0EsTUFBTUssV0FBVyxHQUFHLFNBQUFBLENBQUNYLEtBQUssRUFBRUcsT0FBTyxFQUFvRDtNQUFBLElBQWxEbUQsYUFBYSxHQUFBakQsU0FBQSxDQUFBSCxNQUFBLFFBQUFHLFNBQUEsUUFBQUMsU0FBQSxHQUFBRCxTQUFBLE1BQUcsS0FBSztNQUFBLElBQUVrRCxNQUFNLEdBQUFsRCxTQUFBLENBQUFILE1BQUEsUUFBQUcsU0FBQSxRQUFBQyxTQUFBLEdBQUFELFNBQUEsTUFBRyxFQUFFO01BQUEsSUFBRVIsSUFBSSxHQUFBUSxTQUFBLENBQUFILE1BQUEsUUFBQUcsU0FBQSxRQUFBQyxTQUFBLEdBQUFELFNBQUEsTUFBRyxFQUFFO01BQ2hGO01BQ0EsSUFBSUYsT0FBTyxLQUFLdkIsS0FBSyxDQUFDMEMsR0FBRyxFQUFFO1FBQ3pCLE9BQU8sS0FBSztNQUNkOztNQUVBO01BQ0E7TUFDQSxLQUFLLElBQUlrQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdOLFlBQVksQ0FBQ2hELE1BQU0sRUFBRSxFQUFFc0QsQ0FBQyxFQUFFO1FBQzVDLElBQUlyRCxPQUFPLEtBQUsrQyxZQUFZLENBQUNNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1VBQ2xDLElBQUksT0FBT3hELEtBQUssS0FBS2tELFlBQVksQ0FBQ00sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDdkMsT0FBTyxLQUFLO1VBQ2Q7VUFFQSxPQUFPO1lBQ0w1RCxPQUFPLGNBQUFFLE1BQUEsQ0FBY29ELFlBQVksQ0FBQ00sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQUExRCxNQUFBLENBQVM2QyxxQkFBcUIsQ0FBQzNDLEtBQUssRUFBRTtjQUFFNEMsWUFBWSxFQUFFO1lBQUssQ0FBQyxDQUFDLENBQUU7WUFDdEcvQyxJQUFJLEVBQUU7VUFDUixDQUFDO1FBQ0g7TUFDRjtNQUVBLElBQUlNLE9BQU8sS0FBSyxJQUFJLEVBQUU7UUFDcEIsSUFBSUgsS0FBSyxLQUFLLElBQUksRUFBRTtVQUNsQixPQUFPLEtBQUs7UUFDZDtRQUVBLE9BQU87VUFDTEosT0FBTyx3QkFBQUUsTUFBQSxDQUF3QjZDLHFCQUFxQixDQUFDM0MsS0FBSyxDQUFDLENBQUU7VUFDN0RILElBQUksRUFBRTtRQUNSLENBQUM7TUFDSDs7TUFFQTtNQUNBLElBQUksT0FBT00sT0FBTyxLQUFLLFFBQVEsSUFBSSxPQUFPQSxPQUFPLEtBQUssUUFBUSxJQUFJLE9BQU9BLE9BQU8sS0FBSyxTQUFTLEVBQUU7UUFDOUYsSUFBSUgsS0FBSyxLQUFLRyxPQUFPLEVBQUU7VUFDckIsT0FBTyxLQUFLO1FBQ2Q7UUFFQSxPQUFPO1VBQ0xQLE9BQU8sY0FBQUUsTUFBQSxDQUFjSyxPQUFPLFlBQUFMLE1BQUEsQ0FBUzZDLHFCQUFxQixDQUFDM0MsS0FBSyxDQUFDLENBQUU7VUFDbkVILElBQUksRUFBRTtRQUNSLENBQUM7TUFDSDs7TUFFQTtNQUNBLElBQUlNLE9BQU8sS0FBS3ZCLEtBQUssQ0FBQ2dELE9BQU8sRUFBRTtRQUU3QjtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQSxJQUFJLE9BQU81QixLQUFLLEtBQUssUUFBUSxJQUFJLENBQUNBLEtBQUssR0FBRyxDQUFDLE1BQU1BLEtBQUssRUFBRTtVQUN0RCxPQUFPLEtBQUs7UUFDZDtRQUVBLE9BQU87VUFDTEosT0FBTywyQkFBQUUsTUFBQSxDQUEyQjZDLHFCQUFxQixDQUFDM0MsS0FBSyxDQUFDLENBQUU7VUFDaEVILElBQUksRUFBRTtRQUNSLENBQUM7TUFDSDs7TUFFQTtNQUNBLElBQUlNLE9BQU8sS0FBS2QsTUFBTSxFQUFFO1FBQ3RCYyxPQUFPLEdBQUd2QixLQUFLLENBQUM4QyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7TUFDckM7TUFDQTtNQUNBO01BQ0EsSUFBSXZCLE9BQU8sS0FBS3ZCLEtBQUssQ0FBQzZDLGNBQWMsRUFBRTtRQUNwQ3RCLE9BQU8sR0FBRyxJQUFJb0IsS0FBSyxDQUFDeEIsdUJBQXVCLENBQUM7TUFDOUM7O01BRUE7TUFDQSxJQUFJSSxPQUFPLFlBQVlTLEtBQUssRUFBRTtRQUM1QixJQUFJVCxPQUFPLENBQUNELE1BQU0sS0FBSyxDQUFDLEVBQUU7VUFDeEIsT0FBTztZQUNMTixPQUFPLG9EQUFBRSxNQUFBLENBQW9ENkMscUJBQXFCLENBQUN4QyxPQUFPLENBQUMsQ0FBRTtZQUMzRk4sSUFBSSxFQUFFO1VBQ1IsQ0FBQztRQUNIO1FBRUEsSUFBSSxDQUFDZSxLQUFLLENBQUNDLE9BQU8sQ0FBQ2IsS0FBSyxDQUFDLElBQUksQ0FBQ3lELFdBQVcsQ0FBQ3pELEtBQUssQ0FBQyxFQUFFO1VBQ2hELE9BQU87WUFDTEosT0FBTyx5QkFBQUUsTUFBQSxDQUF5QjZDLHFCQUFxQixDQUFDM0MsS0FBSyxDQUFDLENBQUU7WUFDOURILElBQUksRUFBRTtVQUNSLENBQUM7UUFDSDtRQUdBLEtBQUssSUFBSTJELENBQUMsR0FBRyxDQUFDLEVBQUV0RCxNQUFNLEdBQUdGLEtBQUssQ0FBQ0UsTUFBTSxFQUFFc0QsQ0FBQyxHQUFHdEQsTUFBTSxFQUFFc0QsQ0FBQyxFQUFFLEVBQUU7VUFDdEQsTUFBTUUsT0FBTyxNQUFBNUQsTUFBQSxDQUFNRCxJQUFJLE9BQUFDLE1BQUEsQ0FBSTBELENBQUMsTUFBRztVQUMvQixNQUFNL0QsTUFBTSxHQUFHa0IsV0FBVyxDQUFDWCxLQUFLLENBQUN3RCxDQUFDLENBQUMsRUFBRXJELE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRW1ELGFBQWEsRUFBRUMsTUFBTSxFQUFFRyxPQUFPLENBQUM7VUFDaEYsSUFBSWpFLE1BQU0sRUFBRTtZQUNWQSxNQUFNLENBQUNJLElBQUksR0FBRzhELFlBQVksQ0FBQ0wsYUFBYSxHQUFHSSxPQUFPLEdBQUdGLENBQUMsRUFBRS9ELE1BQU0sQ0FBQ0ksSUFBSSxDQUFDO1lBQ3BFLElBQUksQ0FBQ3lELGFBQWEsRUFBRSxPQUFPN0QsTUFBTTtZQUNqQyxJQUFJLE9BQU9PLEtBQUssQ0FBQ3dELENBQUMsQ0FBQyxLQUFLLFFBQVEsSUFBSS9ELE1BQU0sQ0FBQ0csT0FBTyxFQUFFMkQsTUFBTSxDQUFDSyxJQUFJLENBQUNuRSxNQUFNLENBQUM7VUFDekU7UUFDRjtRQUVBLElBQUksQ0FBQzZELGFBQWEsRUFBRSxPQUFPLEtBQUs7UUFDaEMsT0FBT0MsTUFBTSxDQUFDckQsTUFBTSxLQUFLLENBQUMsR0FBRyxLQUFLLEdBQUdxRCxNQUFNO01BQzdDOztNQUVBO01BQ0E7TUFDQSxJQUFJcEQsT0FBTyxZQUFZb0IsS0FBSyxFQUFFO1FBQzVCLElBQUk5QixNQUFNO1FBQ1YsSUFBSTtVQUNGQSxNQUFNLEdBQUdVLE9BQU8sQ0FBQ3FCLFNBQVMsQ0FBQ3hCLEtBQUssQ0FBQztRQUNuQyxDQUFDLENBQUMsT0FBT04sR0FBRyxFQUFFO1VBQ1osSUFBSSxFQUFFQSxHQUFHLFlBQVlkLEtBQUssQ0FBQ2UsS0FBSyxDQUFDLEVBQUU7WUFDakMsTUFBTUQsR0FBRztVQUNYO1VBRUEsT0FBTztZQUNMRSxPQUFPLEVBQUVGLEdBQUcsQ0FBQ0UsT0FBTztZQUNwQkMsSUFBSSxFQUFFSCxHQUFHLENBQUNHO1VBQ1osQ0FBQztRQUNIO1FBRUEsSUFBSUosTUFBTSxFQUFFO1VBQ1YsT0FBTyxLQUFLO1FBQ2Q7O1FBRUE7O1FBRUEsT0FBTztVQUNMRyxPQUFPLEVBQUUsK0JBQStCO1VBQ3hDQyxJQUFJLEVBQUU7UUFDUixDQUFDO01BQ0g7TUFFQSxJQUFJTSxPQUFPLFlBQVljLEtBQUssRUFBRTtRQUM1QmQsT0FBTyxHQUFHdkIsS0FBSyxDQUFDc0MsS0FBSyxDQUFDWixTQUFTLEVBQUUsSUFBSSxFQUFFSCxPQUFPLENBQUNBLE9BQU8sQ0FBQztNQUN6RCxDQUFDLE1BQU0sSUFBSUEsT0FBTyxZQUFZYSxRQUFRLEVBQUU7UUFDdENiLE9BQU8sR0FBR3ZCLEtBQUssQ0FBQ3NDLEtBQUssQ0FBQ1osU0FBUyxFQUFFSCxPQUFPLENBQUNBLE9BQU8sQ0FBQztNQUNuRDtNQUVBLElBQUlBLE9BQU8sWUFBWWUsS0FBSyxFQUFFO1FBQzVCLEtBQUssSUFBSXNDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3JELE9BQU8sQ0FBQ3VDLE9BQU8sQ0FBQ3hDLE1BQU0sRUFBRSxFQUFFc0QsQ0FBQyxFQUFFO1VBQy9DLE1BQU0vRCxNQUFNLEdBQUdrQixXQUFXLENBQUNYLEtBQUssRUFBRUcsT0FBTyxDQUFDdUMsT0FBTyxDQUFDYyxDQUFDLENBQUMsQ0FBQztVQUNyRCxJQUFJLENBQUMvRCxNQUFNLEVBQUU7WUFFWDtZQUNBLE9BQU8sS0FBSztVQUNkOztVQUVBO1FBQ0Y7O1FBRUE7UUFDQSxPQUFPO1VBQ0xHLE9BQU8sRUFBRSw4REFBOEQ7VUFDdkVDLElBQUksRUFBRTtRQUNSLENBQUM7TUFDSDs7TUFFQTtNQUNBO01BQ0EsSUFBSU0sT0FBTyxZQUFZa0QsUUFBUSxFQUFFO1FBQy9CLElBQUlyRCxLQUFLLFlBQVlHLE9BQU8sRUFBRTtVQUM1QixPQUFPLEtBQUs7UUFDZDtRQUVBLE9BQU87VUFDTFAsT0FBTyxjQUFBRSxNQUFBLENBQWNLLE9BQU8sQ0FBQzhDLElBQUksSUFBSSx3QkFBd0IsQ0FBRTtVQUMvRHBELElBQUksRUFBRTtRQUNSLENBQUM7TUFDSDtNQUVBLElBQUlnRSxrQkFBa0IsR0FBRyxLQUFLO01BQzlCLElBQUlDLGlCQUFpQjtNQUNyQixJQUFJM0QsT0FBTyxZQUFZdUIsZUFBZSxFQUFFO1FBQ3RDbUMsa0JBQWtCLEdBQUcsSUFBSTtRQUN6QjFELE9BQU8sR0FBR0EsT0FBTyxDQUFDQSxPQUFPO01BQzNCO01BRUEsSUFBSUEsT0FBTyxZQUFZd0IsZ0JBQWdCLEVBQUU7UUFDdkNrQyxrQkFBa0IsR0FBRyxJQUFJO1FBQ3pCQyxpQkFBaUIsR0FBRyxDQUFDM0QsT0FBTyxDQUFDQSxPQUFPLENBQUM7UUFDckNBLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFFO01BQ2pCO01BRUEsSUFBSSxPQUFPQSxPQUFPLEtBQUssUUFBUSxFQUFFO1FBQy9CLE9BQU87VUFDTFAsT0FBTyxFQUFFLG1DQUFtQztVQUM1Q0MsSUFBSSxFQUFFO1FBQ1IsQ0FBQztNQUNIOztNQUVBO01BQ0E7TUFDQTtNQUNBLElBQUksT0FBT0csS0FBSyxLQUFLLFFBQVEsRUFBRTtRQUM3QixPQUFPO1VBQ0xKLE9BQU8sMEJBQUFFLE1BQUEsQ0FBMEIsT0FBT0UsS0FBSyxDQUFFO1VBQy9DSCxJQUFJLEVBQUU7UUFDUixDQUFDO01BQ0g7TUFFQSxJQUFJRyxLQUFLLEtBQUssSUFBSSxFQUFFO1FBQ2xCLE9BQU87VUFDTEosT0FBTyw2QkFBNkI7VUFDcENDLElBQUksRUFBRTtRQUNSLENBQUM7TUFDSDtNQUVBLElBQUksQ0FBRWhCLGFBQWEsQ0FBQ21CLEtBQUssQ0FBQyxFQUFFO1FBQzFCLE9BQU87VUFDTEosT0FBTyx5QkFBeUI7VUFDaENDLElBQUksRUFBRTtRQUNSLENBQUM7TUFDSDtNQUVBLE1BQU1rRSxnQkFBZ0IsR0FBRzFFLE1BQU0sQ0FBQzJFLE1BQU0sQ0FBQyxJQUFJLENBQUM7TUFDNUMsTUFBTUMsZ0JBQWdCLEdBQUc1RSxNQUFNLENBQUMyRSxNQUFNLENBQUMsSUFBSSxDQUFDO01BRTVDM0UsTUFBTSxDQUFDNkUsSUFBSSxDQUFDL0QsT0FBTyxDQUFDLENBQUNnRSxPQUFPLENBQUNDLEdBQUcsSUFBSTtRQUNsQyxNQUFNQyxVQUFVLEdBQUdsRSxPQUFPLENBQUNpRSxHQUFHLENBQUM7UUFDL0IsSUFBSUMsVUFBVSxZQUFZckQsUUFBUSxJQUM5QnFELFVBQVUsWUFBWXBELEtBQUssRUFBRTtVQUMvQmdELGdCQUFnQixDQUFDRyxHQUFHLENBQUMsR0FBR0MsVUFBVSxDQUFDbEUsT0FBTztRQUM1QyxDQUFDLE1BQU07VUFDTDRELGdCQUFnQixDQUFDSyxHQUFHLENBQUMsR0FBR0MsVUFBVTtRQUNwQztNQUNGLENBQUMsQ0FBQztNQUVGLEtBQUssSUFBSUQsR0FBRyxJQUFJL0UsTUFBTSxDQUFDVyxLQUFLLENBQUMsRUFBRTtRQUM3QixNQUFNc0UsUUFBUSxHQUFHdEUsS0FBSyxDQUFDb0UsR0FBRyxDQUFDO1FBQzNCLE1BQU1HLE9BQU8sR0FBRzFFLElBQUksTUFBQUMsTUFBQSxDQUFNRCxJQUFJLE9BQUFDLE1BQUEsQ0FBSXNFLEdBQUcsSUFBS0EsR0FBRztRQUM3QyxJQUFJaEYsTUFBTSxDQUFDb0YsSUFBSSxDQUFDVCxnQkFBZ0IsRUFBRUssR0FBRyxDQUFDLEVBQUU7VUFDdEMsTUFBTTNFLE1BQU0sR0FBR2tCLFdBQVcsQ0FBQzJELFFBQVEsRUFBRVAsZ0JBQWdCLENBQUNLLEdBQUcsQ0FBQyxFQUFFZCxhQUFhLEVBQUVDLE1BQU0sRUFBRWdCLE9BQU8sQ0FBQztVQUMzRixJQUFJOUUsTUFBTSxFQUFFO1lBQ1ZBLE1BQU0sQ0FBQ0ksSUFBSSxHQUFHOEQsWUFBWSxDQUFDTCxhQUFhLEdBQUdpQixPQUFPLEdBQUdILEdBQUcsRUFBRTNFLE1BQU0sQ0FBQ0ksSUFBSSxDQUFDO1lBQ3RFLElBQUksQ0FBQ3lELGFBQWEsRUFBRSxPQUFPN0QsTUFBTTtZQUNqQyxJQUFJLE9BQU82RSxRQUFRLEtBQUssUUFBUSxJQUFJN0UsTUFBTSxDQUFDRyxPQUFPLEVBQUUyRCxNQUFNLENBQUNLLElBQUksQ0FBQ25FLE1BQU0sQ0FBQztVQUN6RTtVQUVBLE9BQU9zRSxnQkFBZ0IsQ0FBQ0ssR0FBRyxDQUFDO1FBQzlCLENBQUMsTUFBTSxJQUFJaEYsTUFBTSxDQUFDb0YsSUFBSSxDQUFDUCxnQkFBZ0IsRUFBRUcsR0FBRyxDQUFDLEVBQUU7VUFDN0MsTUFBTTNFLE1BQU0sR0FBR2tCLFdBQVcsQ0FBQzJELFFBQVEsRUFBRUwsZ0JBQWdCLENBQUNHLEdBQUcsQ0FBQyxFQUFFZCxhQUFhLEVBQUVDLE1BQU0sRUFBRWdCLE9BQU8sQ0FBQztVQUMzRixJQUFJOUUsTUFBTSxFQUFFO1lBQ1ZBLE1BQU0sQ0FBQ0ksSUFBSSxHQUFHOEQsWUFBWSxDQUFDTCxhQUFhLEdBQUdpQixPQUFPLEdBQUdILEdBQUcsRUFBRTNFLE1BQU0sQ0FBQ0ksSUFBSSxDQUFDO1lBQ3RFLElBQUksQ0FBQ3lELGFBQWEsRUFBRSxPQUFPN0QsTUFBTTtZQUNqQyxJQUFJLE9BQU82RSxRQUFRLEtBQUssUUFBUSxJQUFJN0UsTUFBTSxDQUFDRyxPQUFPLEVBQUUyRCxNQUFNLENBQUNLLElBQUksQ0FBQ25FLE1BQU0sQ0FBQztVQUN6RTtRQUVGLENBQUMsTUFBTTtVQUNMLElBQUksQ0FBQ29FLGtCQUFrQixFQUFFO1lBQ3ZCLE1BQU1wRSxNQUFNLEdBQUc7Y0FDYkcsT0FBTyxFQUFFLGFBQWE7Y0FDdEJDLElBQUksRUFBRXVFO1lBQ1IsQ0FBQztZQUNELElBQUksQ0FBQ2QsYUFBYSxFQUFFLE9BQU83RCxNQUFNO1lBQ2pDOEQsTUFBTSxDQUFDSyxJQUFJLENBQUNuRSxNQUFNLENBQUM7VUFDckI7VUFFQSxJQUFJcUUsaUJBQWlCLEVBQUU7WUFDckIsTUFBTXJFLE1BQU0sR0FBR2tCLFdBQVcsQ0FBQzJELFFBQVEsRUFBRVIsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLEVBQUVSLGFBQWEsRUFBRUMsTUFBTSxFQUFFZ0IsT0FBTyxDQUFDO1lBQzFGLElBQUk5RSxNQUFNLEVBQUU7Y0FDVkEsTUFBTSxDQUFDSSxJQUFJLEdBQUc4RCxZQUFZLENBQUNMLGFBQWEsR0FBR2lCLE9BQU8sR0FBR0gsR0FBRyxFQUFFM0UsTUFBTSxDQUFDSSxJQUFJLENBQUM7Y0FDdEUsSUFBSSxDQUFDeUQsYUFBYSxFQUFFLE9BQU83RCxNQUFNO2NBQ2pDLElBQUksT0FBTzZFLFFBQVEsS0FBSyxRQUFRLElBQUk3RSxNQUFNLENBQUNHLE9BQU8sRUFBRTJELE1BQU0sQ0FBQ0ssSUFBSSxDQUFDbkUsTUFBTSxDQUFDO1lBQ3pFO1VBQ0Y7UUFDRjtNQUNGO01BRUEsTUFBTXlFLElBQUksR0FBRzdFLE1BQU0sQ0FBQzZFLElBQUksQ0FBQ0gsZ0JBQWdCLENBQUM7TUFDMUMsSUFBSUcsSUFBSSxDQUFDaEUsTUFBTSxFQUFFO1FBQ2YsTUFBTXVFLGtCQUFrQixHQUFHTCxHQUFHLEtBQUs7VUFDakN4RSxPQUFPLGtCQUFBRSxNQUFBLENBQWtCc0UsR0FBRyxNQUFHO1VBQy9CdkUsSUFBSSxFQUFFeUQsYUFBYSxHQUFHekQsSUFBSSxHQUFHO1FBQy9CLENBQUMsQ0FBQztRQUVGLElBQUksQ0FBQ3lELGFBQWEsRUFBRTtVQUNsQixPQUFPbUIsa0JBQWtCLENBQUNQLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwQztRQUVBLEtBQUssTUFBTUUsR0FBRyxJQUFJRixJQUFJLEVBQUU7VUFDdEJYLE1BQU0sQ0FBQ0ssSUFBSSxDQUFDYSxrQkFBa0IsQ0FBQ0wsR0FBRyxDQUFDLENBQUM7UUFDdEM7TUFDRjtNQUVBLElBQUksQ0FBQ2QsYUFBYSxFQUFFLE9BQU8sS0FBSztNQUNoQyxPQUFPQyxNQUFNLENBQUNyRCxNQUFNLEtBQUssQ0FBQyxHQUFHLEtBQUssR0FBR3FELE1BQU07SUFDN0MsQ0FBQztJQUVELE1BQU1sQixlQUFlLENBQUM7TUFDcEJJLFdBQVdBLENBQUVyQixJQUFJLEVBQUVnQixXQUFXLEVBQUU7UUFFOUI7UUFDQTtRQUNBLElBQUksQ0FBQ2hCLElBQUksR0FBRyxDQUFDLEdBQUdBLElBQUksQ0FBQzs7UUFFckI7UUFDQTtRQUNBO1FBQ0EsSUFBSSxDQUFDQSxJQUFJLENBQUNzRCxPQUFPLENBQUMsQ0FBQztRQUNuQixJQUFJLENBQUN0QyxXQUFXLEdBQUdBLFdBQVc7TUFDaEM7TUFFQTFCLFFBQVFBLENBQUNWLEtBQUssRUFBRTtRQUNkLElBQUksSUFBSSxDQUFDMkUsaUJBQWlCLENBQUMzRSxLQUFLLENBQUMsRUFBRTtVQUNqQztRQUNGOztRQUVBO1FBQ0E7UUFDQTtRQUNBLElBQUlZLEtBQUssQ0FBQ0MsT0FBTyxDQUFDYixLQUFLLENBQUMsSUFBSXlELFdBQVcsQ0FBQ3pELEtBQUssQ0FBQyxFQUFFO1VBQzlDWSxLQUFLLENBQUN0QixTQUFTLENBQUM2RSxPQUFPLENBQUNLLElBQUksQ0FBQ3hFLEtBQUssRUFBRSxJQUFJLENBQUMyRSxpQkFBaUIsQ0FBQ0MsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hFO01BQ0Y7TUFFQUQsaUJBQWlCQSxDQUFDM0UsS0FBSyxFQUFFO1FBQ3ZCLEtBQUssSUFBSXdELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNwQyxJQUFJLENBQUNsQixNQUFNLEVBQUUsRUFBRXNELENBQUMsRUFBRTtVQUV6QztVQUNBO1VBQ0E7VUFDQTtVQUNBLElBQUl4RCxLQUFLLEtBQUssSUFBSSxDQUFDb0IsSUFBSSxDQUFDb0MsQ0FBQyxDQUFDLElBQ3JCTCxNQUFNLENBQUMwQixLQUFLLENBQUM3RSxLQUFLLENBQUMsSUFBSW1ELE1BQU0sQ0FBQzBCLEtBQUssQ0FBQyxJQUFJLENBQUN6RCxJQUFJLENBQUNvQyxDQUFDLENBQUMsQ0FBRSxFQUFFO1lBQ3ZELElBQUksQ0FBQ3BDLElBQUksQ0FBQzBELE1BQU0sQ0FBQ3RCLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDdEIsT0FBTyxJQUFJO1VBQ2I7UUFDRjtRQUNBLE9BQU8sS0FBSztNQUNkO01BRUFoQixzQ0FBc0NBLENBQUEsRUFBRztRQUN2QyxJQUFJLElBQUksQ0FBQ3BCLElBQUksQ0FBQ2xCLE1BQU0sR0FBRyxDQUFDLEVBQ3RCLE1BQU0sSUFBSVAsS0FBSyx5Q0FBQUcsTUFBQSxDQUF5QyxJQUFJLENBQUNzQyxXQUFXLENBQUUsQ0FBQztNQUMvRTtJQUNGO0lBRUEsTUFBTTJDLFdBQVcsR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUM5RSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFDdkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFDdEUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUNwRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQzNFLFVBQVUsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUMzRSxZQUFZLENBQUM7O0lBRWY7SUFDQTtJQUNBLE1BQU1wQixZQUFZLEdBQUdBLENBQUNTLEdBQUcsRUFBRVksSUFBSSxLQUFLO01BQ2xDLElBQUssT0FBT1osR0FBRyxLQUFNLFFBQVEsSUFBSUEsR0FBRyxDQUFDYSxLQUFLLENBQUMsVUFBVSxDQUFDLEVBQUU7UUFDdERiLEdBQUcsT0FBQXRFLE1BQUEsQ0FBT3NFLEdBQUcsTUFBRztNQUNsQixDQUFDLE1BQU0sSUFBSSxDQUFDQSxHQUFHLENBQUNhLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxJQUN2Q0YsV0FBVyxDQUFDRyxPQUFPLENBQUNkLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtRQUN4Q0EsR0FBRyxHQUFHckIsSUFBSSxDQUFDRCxTQUFTLENBQUMsQ0FBQ3NCLEdBQUcsQ0FBQyxDQUFDO01BQzdCO01BRUEsSUFBSVksSUFBSSxJQUFJQSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1FBQzNCLFVBQUFsRixNQUFBLENBQVVzRSxHQUFHLE9BQUF0RSxNQUFBLENBQUlrRixJQUFJO01BQ3ZCO01BRUEsT0FBT1osR0FBRyxHQUFHWSxJQUFJO0lBQ25CLENBQUM7SUFFRCxNQUFNRyxRQUFRLEdBQUduRixLQUFLLElBQUksT0FBT0EsS0FBSyxLQUFLLFFBQVEsSUFBSUEsS0FBSyxLQUFLLElBQUk7SUFFckUsTUFBTW9GLGVBQWUsR0FBR0MsSUFBSSxJQUMxQkYsUUFBUSxDQUFDRSxJQUFJLENBQUMsSUFDZGhHLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDZ0csUUFBUSxDQUFDZCxJQUFJLENBQUNhLElBQUksQ0FBQyxLQUFLLG9CQUFvQjtJQUUvRCxNQUFNNUIsV0FBVyxHQUFHMkIsZUFBZSxDQUFDLFlBQVc7TUFBRSxPQUFPL0UsU0FBUztJQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FDckUrRSxlQUFlLEdBQ2ZwRixLQUFLLElBQUltRixRQUFRLENBQUNuRixLQUFLLENBQUMsSUFBSSxPQUFPQSxLQUFLLENBQUN1RixNQUFNLEtBQUssVUFBVTtJQUFDQyxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHOzs7Ozs7Ozs7OztBQ3JsQmpFbEgsTUFBTSxDQUFDQyxNQUFNLENBQUM7RUFBQ0csYUFBYSxFQUFDQSxDQUFBLEtBQUlBO0FBQWEsQ0FBQyxDQUFDO0FBQWhEOztBQUVBLE1BQU0rRyxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBRXJCLE1BQU1OLFFBQVEsR0FBR00sVUFBVSxDQUFDTixRQUFRO0FBRXBDLE1BQU1sRyxNQUFNLEdBQUdDLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxjQUFjO0FBRTlDLE1BQU1zRyxVQUFVLEdBQUd6RyxNQUFNLENBQUNrRyxRQUFRO0FBRWxDLE1BQU1RLG9CQUFvQixHQUFHRCxVQUFVLENBQUNyQixJQUFJLENBQUNuRixNQUFNLENBQUM7QUFFcEQsTUFBTTBHLFFBQVEsR0FBRzFHLE1BQU0sQ0FBQzJHLGNBQWM7QUFFL0IsTUFBTW5ILGFBQWEsR0FBR29ILEdBQUcsSUFBSTtFQUNsQyxJQUFJQyxLQUFLO0VBQ1QsSUFBSUMsSUFBSTs7RUFFUjtFQUNBO0VBQ0EsSUFBSSxDQUFDRixHQUFHLElBQUlYLFFBQVEsQ0FBQ2QsSUFBSSxDQUFDeUIsR0FBRyxDQUFDLEtBQUssaUJBQWlCLEVBQUU7SUFDcEQsT0FBTyxLQUFLO0VBQ2Q7RUFFQUMsS0FBSyxHQUFHSCxRQUFRLENBQUNFLEdBQUcsQ0FBQzs7RUFFckI7RUFDQSxJQUFJLENBQUNDLEtBQUssRUFBRTtJQUNWLE9BQU8sSUFBSTtFQUNiOztFQUVBO0VBQ0FDLElBQUksR0FBRy9HLE1BQU0sQ0FBQ29GLElBQUksQ0FBQzBCLEtBQUssRUFBRSxhQUFhLENBQUMsSUFBSUEsS0FBSyxDQUFDekQsV0FBVztFQUM3RCxPQUFPLE9BQU8wRCxJQUFJLEtBQUssVUFBVSxJQUMvQk4sVUFBVSxDQUFDckIsSUFBSSxDQUFDMkIsSUFBSSxDQUFDLEtBQUtMLG9CQUFvQjtBQUNsRCxDQUFDLEMiLCJmaWxlIjoiL3BhY2thZ2VzL2NoZWNrLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gWFhYIGRvY3NcbmltcG9ydCB7IGlzUGxhaW5PYmplY3QgfSBmcm9tICcuL2lzUGxhaW5PYmplY3QnO1xuXG4vLyBUaGluZ3Mgd2UgZXhwbGljaXRseSBkbyBOT1Qgc3VwcG9ydDpcbi8vICAgIC0gaGV0ZXJvZ2Vub3VzIGFycmF5c1xuXG5jb25zdCBjdXJyZW50QXJndW1lbnRDaGVja2VyID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlO1xuY29uc3QgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuY29uc3QgZm9ybWF0ID0gcmVzdWx0ID0+IHtcbiAgY29uc3QgZXJyID0gbmV3IE1hdGNoLkVycm9yKHJlc3VsdC5tZXNzYWdlKTtcbiAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgZXJyLm1lc3NhZ2UgKz0gYCBpbiBmaWVsZCAke3Jlc3VsdC5wYXRofWA7XG4gICAgZXJyLnBhdGggPSByZXN1bHQucGF0aDtcbiAgfVxuXG4gIHJldHVybiBlcnI7XG59XG5cbmZ1bmN0aW9uIG5vbkVtcHR5U3RyaW5nQ29uZGl0aW9uKHZhbHVlKSB7XG4gIGNoZWNrKHZhbHVlLCBTdHJpbmcpO1xuICByZXR1cm4gdmFsdWUubGVuZ3RoID4gMDtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBDaGVjayB0aGF0IGEgdmFsdWUgbWF0Y2hlcyBhIFtwYXR0ZXJuXSgjbWF0Y2hwYXR0ZXJucykuXG4gKiBJZiB0aGUgdmFsdWUgZG9lcyBub3QgbWF0Y2ggdGhlIHBhdHRlcm4sIHRocm93IGEgYE1hdGNoLkVycm9yYC5cbiAqIEJ5IGRlZmF1bHQsIGl0IHdpbGwgdGhyb3cgaW1tZWRpYXRlbHkgYXQgdGhlIGZpcnN0IGVycm9yIGVuY291bnRlcmVkLiBQYXNzIGluIHsgdGhyb3dBbGxFcnJvcnM6IHRydWUgfSB0byB0aHJvdyBhbGwgZXJyb3JzLlxuICpcbiAqIFBhcnRpY3VsYXJseSB1c2VmdWwgdG8gYXNzZXJ0IHRoYXQgYXJndW1lbnRzIHRvIGEgZnVuY3Rpb24gaGF2ZSB0aGUgcmlnaHRcbiAqIHR5cGVzIGFuZCBzdHJ1Y3R1cmUuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7QW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2tcbiAqIEBwYXJhbSB7TWF0Y2hQYXR0ZXJufSBwYXR0ZXJuIFRoZSBwYXR0ZXJuIHRvIG1hdGNoIGB2YWx1ZWAgYWdhaW5zdFxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBBZGRpdGlvbmFsIG9wdGlvbnMgZm9yIGNoZWNrXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtvcHRpb25zLnRocm93QWxsRXJyb3JzPWZhbHNlXSBJZiB0cnVlLCB0aHJvdyBhbGwgZXJyb3JzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjaGVjayh2YWx1ZSwgcGF0dGVybiwgb3B0aW9ucyA9IHsgdGhyb3dBbGxFcnJvcnM6IGZhbHNlIH0pIHtcbiAgLy8gUmVjb3JkIHRoYXQgY2hlY2sgZ290IGNhbGxlZCwgaWYgc29tZWJvZHkgY2FyZWQuXG4gIC8vXG4gIC8vIFdlIHVzZSBnZXRPck51bGxJZk91dHNpZGVGaWJlciBzbyB0aGF0IGl0J3MgT0sgdG8gY2FsbCBjaGVjaygpXG4gIC8vIGZyb20gbm9uLUZpYmVyIHNlcnZlciBjb250ZXh0czsgdGhlIGRvd25zaWRlIGlzIHRoYXQgaWYgeW91IGZvcmdldCB0b1xuICAvLyBiaW5kRW52aXJvbm1lbnQgb24gc29tZSByYW5kb20gY2FsbGJhY2sgaW4geW91ciBtZXRob2QvcHVibGlzaGVyLFxuICAvLyBpdCBtaWdodCBub3QgZmluZCB0aGUgYXJndW1lbnRDaGVja2VyIGFuZCB5b3UnbGwgZ2V0IGFuIGVycm9yIGFib3V0XG4gIC8vIG5vdCBjaGVja2luZyBhbiBhcmd1bWVudCB0aGF0IGl0IGxvb2tzIGxpa2UgeW91J3JlIGNoZWNraW5nIChpbnN0ZWFkXG4gIC8vIG9mIGp1c3QgZ2V0dGluZyBhIFwiTm9kZSBjb2RlIG11c3QgcnVuIGluIGEgRmliZXJcIiBlcnJvcikuXG4gIGNvbnN0IGFyZ0NoZWNrZXIgPSBjdXJyZW50QXJndW1lbnRDaGVja2VyLmdldE9yTnVsbElmT3V0c2lkZUZpYmVyKCk7XG4gIGlmIChhcmdDaGVja2VyKSB7XG4gICAgYXJnQ2hlY2tlci5jaGVja2luZyh2YWx1ZSk7XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZSh2YWx1ZSwgcGF0dGVybiwgb3B0aW9ucy50aHJvd0FsbEVycm9ycyk7XG5cbiAgaWYgKHJlc3VsdCkge1xuICAgIGlmIChvcHRpb25zLnRocm93QWxsRXJyb3JzKSB7XG4gICAgICB0aHJvdyBBcnJheS5pc0FycmF5KHJlc3VsdCkgPyByZXN1bHQubWFwKHIgPT4gZm9ybWF0KHIpKSA6IFtmb3JtYXQocmVzdWx0KV1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgZm9ybWF0KHJlc3VsdClcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogQG5hbWVzcGFjZSBNYXRjaFxuICogQHN1bW1hcnkgVGhlIG5hbWVzcGFjZSBmb3IgYWxsIE1hdGNoIHR5cGVzIGFuZCBtZXRob2RzLlxuICovXG5leHBvcnQgY29uc3QgTWF0Y2ggPSB7XG4gIE9wdGlvbmFsOiBmdW5jdGlvbihwYXR0ZXJuKSB7XG4gICAgcmV0dXJuIG5ldyBPcHRpb25hbChwYXR0ZXJuKTtcbiAgfSxcblxuICBNYXliZTogZnVuY3Rpb24ocGF0dGVybikge1xuICAgIHJldHVybiBuZXcgTWF5YmUocGF0dGVybik7XG4gIH0sXG5cbiAgT25lT2Y6IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gbmV3IE9uZU9mKGFyZ3MpO1xuICB9LFxuXG4gIEFueTogWydfX2FueV9fJ10sXG4gIFdoZXJlOiBmdW5jdGlvbihjb25kaXRpb24pIHtcbiAgICByZXR1cm4gbmV3IFdoZXJlKGNvbmRpdGlvbik7XG4gIH0sXG5cbiAgTm9uRW1wdHlTdHJpbmc6IFsnX19Ob25FbXB0eVN0cmluZ19fJ10sXG5cbiAgT2JqZWN0SW5jbHVkaW5nOiBmdW5jdGlvbihwYXR0ZXJuKSB7XG4gICAgcmV0dXJuIG5ldyBPYmplY3RJbmNsdWRpbmcocGF0dGVybilcbiAgfSxcblxuICBPYmplY3RXaXRoVmFsdWVzOiBmdW5jdGlvbihwYXR0ZXJuKSB7XG4gICAgcmV0dXJuIG5ldyBPYmplY3RXaXRoVmFsdWVzKHBhdHRlcm4pO1xuICB9LFxuXG4gIC8vIE1hdGNoZXMgb25seSBzaWduZWQgMzItYml0IGludGVnZXJzXG4gIEludGVnZXI6IFsnX19pbnRlZ2VyX18nXSxcblxuICAvLyBYWFggbWF0Y2hlcnMgc2hvdWxkIGtub3cgaG93IHRvIGRlc2NyaWJlIHRoZW1zZWx2ZXMgZm9yIGVycm9yc1xuICBFcnJvcjogTWV0ZW9yLm1ha2VFcnJvclR5cGUoJ01hdGNoLkVycm9yJywgZnVuY3Rpb24gKG1zZykge1xuICAgIHRoaXMubWVzc2FnZSA9IGBNYXRjaCBlcnJvcjogJHttc2d9YDtcblxuICAgIC8vIFRoZSBwYXRoIG9mIHRoZSB2YWx1ZSB0aGF0IGZhaWxlZCB0byBtYXRjaC4gSW5pdGlhbGx5IGVtcHR5LCB0aGlzIGdldHNcbiAgICAvLyBwb3B1bGF0ZWQgYnkgY2F0Y2hpbmcgYW5kIHJldGhyb3dpbmcgdGhlIGV4Y2VwdGlvbiBhcyBpdCBnb2VzIGJhY2sgdXAgdGhlXG4gICAgLy8gc3RhY2suXG4gICAgLy8gRS5nLjogXCJ2YWxzWzNdLmVudGl0eS5jcmVhdGVkXCJcbiAgICB0aGlzLnBhdGggPSAnJztcblxuICAgIC8vIElmIHRoaXMgZ2V0cyBzZW50IG92ZXIgRERQLCBkb24ndCBnaXZlIGZ1bGwgaW50ZXJuYWwgZGV0YWlscyBidXQgYXQgbGVhc3RcbiAgICAvLyBwcm92aWRlIHNvbWV0aGluZyBiZXR0ZXIgdGhhbiA1MDAgSW50ZXJuYWwgc2VydmVyIGVycm9yLlxuICAgIHRoaXMuc2FuaXRpemVkRXJyb3IgPSBuZXcgTWV0ZW9yLkVycm9yKDQwMCwgJ01hdGNoIGZhaWxlZCcpO1xuICB9KSxcblxuICAvLyBUZXN0cyB0byBzZWUgaWYgdmFsdWUgbWF0Y2hlcyBwYXR0ZXJuLiBVbmxpa2UgY2hlY2ssIGl0IG1lcmVseSByZXR1cm5zIHRydWVcbiAgLy8gb3IgZmFsc2UgKHVubGVzcyBhbiBlcnJvciBvdGhlciB0aGFuIE1hdGNoLkVycm9yIHdhcyB0aHJvd24pLiBJdCBkb2VzIG5vdFxuICAvLyBpbnRlcmFjdCB3aXRoIF9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkLlxuICAvLyBYWFggbWF5YmUgYWxzbyBpbXBsZW1lbnQgYSBNYXRjaC5tYXRjaCB3aGljaCByZXR1cm5zIG1vcmUgaW5mb3JtYXRpb24gYWJvdXRcbiAgLy8gICAgIGZhaWx1cmVzIGJ1dCB3aXRob3V0IHVzaW5nIGV4Y2VwdGlvbiBoYW5kbGluZyBvciBkb2luZyB3aGF0IGNoZWNrKClcbiAgLy8gICAgIGRvZXMgd2l0aCBfZmFpbElmQXJndW1lbnRzQXJlTm90QWxsQ2hlY2tlZCBhbmQgTWV0ZW9yLkVycm9yIGNvbnZlcnNpb25cblxuICAvKipcbiAgICogQHN1bW1hcnkgUmV0dXJucyB0cnVlIGlmIHRoZSB2YWx1ZSBtYXRjaGVzIHRoZSBwYXR0ZXJuLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtBbnl9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVja1xuICAgKiBAcGFyYW0ge01hdGNoUGF0dGVybn0gcGF0dGVybiBUaGUgcGF0dGVybiB0byBtYXRjaCBgdmFsdWVgIGFnYWluc3RcbiAgICovXG4gIHRlc3QodmFsdWUsIHBhdHRlcm4pIHtcbiAgICByZXR1cm4gIXRlc3RTdWJ0cmVlKHZhbHVlLCBwYXR0ZXJuKTtcbiAgfSxcblxuICAvLyBSdW5zIGBmLmFwcGx5KGNvbnRleHQsIGFyZ3MpYC4gSWYgY2hlY2soKSBpcyBub3QgY2FsbGVkIG9uIGV2ZXJ5IGVsZW1lbnQgb2ZcbiAgLy8gYGFyZ3NgIChlaXRoZXIgZGlyZWN0bHkgb3IgaW4gdGhlIGZpcnN0IGxldmVsIG9mIGFuIGFycmF5KSwgdGhyb3dzIGFuIGVycm9yXG4gIC8vICh1c2luZyBgZGVzY3JpcHRpb25gIGluIHRoZSBtZXNzYWdlKS5cbiAgX2ZhaWxJZkFyZ3VtZW50c0FyZU5vdEFsbENoZWNrZWQoZiwgY29udGV4dCwgYXJncywgZGVzY3JpcHRpb24pIHtcbiAgICBjb25zdCBhcmdDaGVja2VyID0gbmV3IEFyZ3VtZW50Q2hlY2tlcihhcmdzLCBkZXNjcmlwdGlvbik7XG4gICAgY29uc3QgcmVzdWx0ID0gY3VycmVudEFyZ3VtZW50Q2hlY2tlci53aXRoVmFsdWUoXG4gICAgICBhcmdDaGVja2VyLFxuICAgICAgKCkgPT4gZi5hcHBseShjb250ZXh0LCBhcmdzKVxuICAgICk7XG5cbiAgICAvLyBJZiBmIGRpZG4ndCBpdHNlbGYgdGhyb3csIG1ha2Ugc3VyZSBpdCBjaGVja2VkIGFsbCBvZiBpdHMgYXJndW1lbnRzLlxuICAgIGFyZ0NoZWNrZXIudGhyb3dVbmxlc3NBbGxBcmd1bWVudHNIYXZlQmVlbkNoZWNrZWQoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59O1xuXG5jbGFzcyBPcHRpb25hbCB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4pIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIE1heWJlIHtcbiAgY29uc3RydWN0b3IocGF0dGVybikge1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm47XG4gIH1cbn1cblxuY2xhc3MgT25lT2Yge1xuICBjb25zdHJ1Y3RvcihjaG9pY2VzKSB7XG4gICAgaWYgKCFjaG9pY2VzIHx8IGNob2ljZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ011c3QgcHJvdmlkZSBhdCBsZWFzdCBvbmUgY2hvaWNlIHRvIE1hdGNoLk9uZU9mJyk7XG4gICAgfVxuXG4gICAgdGhpcy5jaG9pY2VzID0gY2hvaWNlcztcbiAgfVxufVxuXG5jbGFzcyBXaGVyZSB7XG4gIGNvbnN0cnVjdG9yKGNvbmRpdGlvbikge1xuICAgIHRoaXMuY29uZGl0aW9uID0gY29uZGl0aW9uO1xuICB9XG59XG5cbmNsYXNzIE9iamVjdEluY2x1ZGluZyB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4pIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIE9iamVjdFdpdGhWYWx1ZXMge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gcGF0dGVybjtcbiAgfVxufVxuXG5jb25zdCBzdHJpbmdGb3JFcnJvck1lc3NhZ2UgPSAodmFsdWUsIG9wdGlvbnMgPSB7fSkgPT4ge1xuICBpZiAoIHZhbHVlID09PSBudWxsICkge1xuICAgIHJldHVybiAnbnVsbCc7XG4gIH1cblxuICBpZiAoIG9wdGlvbnMub25seVNob3dUeXBlICkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWU7XG4gIH1cblxuICAvLyBZb3VyIGF2ZXJhZ2Ugbm9uLW9iamVjdCB0aGluZ3MuICBTYXZlcyBmcm9tIGRvaW5nIHRoZSB0cnkvY2F0Y2ggYmVsb3cgZm9yLlxuICBpZiAoIHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcgKSB7XG4gICAgcmV0dXJuIEVKU09OLnN0cmluZ2lmeSh2YWx1ZSlcbiAgfVxuXG4gIHRyeSB7XG5cbiAgICAvLyBGaW5kIG9iamVjdHMgd2l0aCBjaXJjdWxhciByZWZlcmVuY2VzIHNpbmNlIEVKU09OIGRvZXNuJ3Qgc3VwcG9ydCB0aGVtIHlldCAoSXNzdWUgIzQ3NzggKyBVbmFjY2VwdGVkIFBSKVxuICAgIC8vIElmIHRoZSBuYXRpdmUgc3RyaW5naWZ5IGlzIGdvaW5nIHRvIGNob2tlLCBFSlNPTi5zdHJpbmdpZnkgaXMgZ29pbmcgdG8gY2hva2UgdG9vLlxuICAgIEpTT04uc3RyaW5naWZ5KHZhbHVlKTtcbiAgfSBjYXRjaCAoc3RyaW5naWZ5RXJyb3IpIHtcbiAgICBpZiAoIHN0cmluZ2lmeUVycm9yLm5hbWUgPT09ICdUeXBlRXJyb3InICkge1xuICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gRUpTT04uc3RyaW5naWZ5KHZhbHVlKTtcbn07XG5cblxuY29uc3QgdHlwZW9mQ2hlY2tzID0gW1xuICBbU3RyaW5nLCAnc3RyaW5nJ10sXG4gIFtOdW1iZXIsICdudW1iZXInXSxcbiAgW0Jvb2xlYW4sICdib29sZWFuJ10sXG5cbiAgLy8gV2hpbGUgd2UgZG9uJ3QgYWxsb3cgdW5kZWZpbmVkL2Z1bmN0aW9uIGluIEVKU09OLCB0aGlzIGlzIGdvb2QgZm9yIG9wdGlvbmFsXG4gIC8vIGFyZ3VtZW50cyB3aXRoIE9uZU9mLlxuICBbRnVuY3Rpb24sICdmdW5jdGlvbiddLFxuICBbdW5kZWZpbmVkLCAndW5kZWZpbmVkJ10sXG5dO1xuXG4vLyBSZXR1cm4gYGZhbHNlYCBpZiBpdCBtYXRjaGVzLiBPdGhlcndpc2UsIHJldHVybnMgYW4gb2JqZWN0IHdpdGggYSBgbWVzc2FnZWAgYW5kIGEgYHBhdGhgIGZpZWxkIG9yIGFuIGFycmF5IG9mIG9iamVjdHMgZWFjaCB3aXRoIGEgYG1lc3NhZ2VgIGFuZCBhIGBwYXRoYCBmaWVsZCB3aGVuIGNvbGxlY3RpbmcgZXJyb3JzLlxuY29uc3QgdGVzdFN1YnRyZWUgPSAodmFsdWUsIHBhdHRlcm4sIGNvbGxlY3RFcnJvcnMgPSBmYWxzZSwgZXJyb3JzID0gW10sIHBhdGggPSAnJykgPT4ge1xuICAvLyBNYXRjaCBhbnl0aGluZyFcbiAgaWYgKHBhdHRlcm4gPT09IE1hdGNoLkFueSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIEJhc2ljIGF0b21pYyB0eXBlcy5cbiAgLy8gRG8gbm90IG1hdGNoIGJveGVkIG9iamVjdHMgKGUuZy4gU3RyaW5nLCBCb29sZWFuKVxuICBmb3IgKGxldCBpID0gMDsgaSA8IHR5cGVvZkNoZWNrcy5sZW5ndGg7ICsraSkge1xuICAgIGlmIChwYXR0ZXJuID09PSB0eXBlb2ZDaGVja3NbaV1bMF0pIHtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IHR5cGVvZkNoZWNrc1tpXVsxXSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCAke3R5cGVvZkNoZWNrc1tpXVsxXX0sIGdvdCAke3N0cmluZ0ZvckVycm9yTWVzc2FnZSh2YWx1ZSwgeyBvbmx5U2hvd1R5cGU6IHRydWUgfSl9YCxcbiAgICAgICAgcGF0aDogJycsXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGlmIChwYXR0ZXJuID09PSBudWxsKSB7XG4gICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBudWxsLCBnb3QgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UodmFsdWUpfWAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gU3RyaW5ncywgbnVtYmVycywgYW5kIGJvb2xlYW5zIG1hdGNoIGxpdGVyYWxseS4gR29lcyB3ZWxsIHdpdGggTWF0Y2guT25lT2YuXG4gIGlmICh0eXBlb2YgcGF0dGVybiA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHBhdHRlcm4gPT09ICdudW1iZXInIHx8IHR5cGVvZiBwYXR0ZXJuID09PSAnYm9vbGVhbicpIHtcbiAgICBpZiAodmFsdWUgPT09IHBhdHRlcm4pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkICR7cGF0dGVybn0sIGdvdCAke3N0cmluZ0ZvckVycm9yTWVzc2FnZSh2YWx1ZSl9YCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICAvLyBNYXRjaC5JbnRlZ2VyIGlzIHNwZWNpYWwgdHlwZSBlbmNvZGVkIHdpdGggYXJyYXlcbiAgaWYgKHBhdHRlcm4gPT09IE1hdGNoLkludGVnZXIpIHtcblxuICAgIC8vIFRoZXJlIGlzIG5vIGNvbnNpc3RlbnQgYW5kIHJlbGlhYmxlIHdheSB0byBjaGVjayBpZiB2YXJpYWJsZSBpcyBhIDY0LWJpdFxuICAgIC8vIGludGVnZXIuIE9uZSBvZiB0aGUgcG9wdWxhciBzb2x1dGlvbnMgaXMgdG8gZ2V0IHJlbWluZGVyIG9mIGRpdmlzaW9uIGJ5IDFcbiAgICAvLyBidXQgdGhpcyBtZXRob2QgZmFpbHMgb24gcmVhbGx5IGxhcmdlIGZsb2F0cyB3aXRoIGJpZyBwcmVjaXNpb24uXG4gICAgLy8gRS5nLjogMS4zNDgxOTIzMDg0OTE4MjRlKzIzICUgMSA9PT0gMCBpbiBWOFxuICAgIC8vIEJpdHdpc2Ugb3BlcmF0b3JzIHdvcmsgY29uc2lzdGFudGx5IGJ1dCBhbHdheXMgY2FzdCB2YXJpYWJsZSB0byAzMi1iaXRcbiAgICAvLyBzaWduZWQgaW50ZWdlciBhY2NvcmRpbmcgdG8gSmF2YVNjcmlwdCBzcGVjcy5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyAmJiAodmFsdWUgfCAwKSA9PT0gdmFsdWUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkIEludGVnZXIsIGdvdCAke3N0cmluZ0ZvckVycm9yTWVzc2FnZSh2YWx1ZSl9YCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICAvLyAnT2JqZWN0JyBpcyBzaG9ydGhhbmQgZm9yIE1hdGNoLk9iamVjdEluY2x1ZGluZyh7fSk7XG4gIGlmIChwYXR0ZXJuID09PSBPYmplY3QpIHtcbiAgICBwYXR0ZXJuID0gTWF0Y2guT2JqZWN0SW5jbHVkaW5nKHt9KTtcbiAgfVxuICAvLyBUaGlzIG11c3QgYmUgaW52b2tlZCBiZWZvcmUgcGF0dGVybiBpbnN0YW5jZW9mIEFycmF5IGFzIHN0cmluZ3MgYXJlIHJlZ2FyZGVkIGFzIGFycmF5c1xuICAvLyBXZSBpbnZva2UgdGhlIHBhdHRlcm4gYXMgSUlGRSBzbyB0aGF0IGBwYXR0ZXJuIGlzbnRhbmNlb2YgV2hlcmVgIGNhdGNoZXMgaXQgXG4gIGlmIChwYXR0ZXJuID09PSBNYXRjaC5Ob25FbXB0eVN0cmluZykge1xuICAgIHBhdHRlcm4gPSBuZXcgV2hlcmUobm9uRW1wdHlTdHJpbmdDb25kaXRpb24pO1xuICB9XG5cbiAgLy8gQXJyYXkgKGNoZWNrZWQgQUZURVIgQW55LCB3aGljaCBpcyBpbXBsZW1lbnRlZCBhcyBhbiBBcnJheSkuXG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICBpZiAocGF0dGVybi5sZW5ndGggIT09IDEpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGBCYWQgcGF0dGVybjogYXJyYXlzIG11c3QgaGF2ZSBvbmUgdHlwZSBlbGVtZW50ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHBhdHRlcm4pfWAsXG4gICAgICAgIHBhdGg6ICcnLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpICYmICFpc0FyZ3VtZW50cyh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBhcnJheSwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlKX1gLFxuICAgICAgICBwYXRoOiAnJyxcbiAgICAgIH07XG4gICAgfVxuXG5cbiAgICBmb3IgKGxldCBpID0gMCwgbGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGFyclBhdGggPSBgJHtwYXRofVske2l9XWBcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRlc3RTdWJ0cmVlKHZhbHVlW2ldLCBwYXR0ZXJuWzBdLCBjb2xsZWN0RXJyb3JzLCBlcnJvcnMsIGFyclBhdGgpO1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICByZXN1bHQucGF0aCA9IF9wcmVwZW5kUGF0aChjb2xsZWN0RXJyb3JzID8gYXJyUGF0aCA6IGksIHJlc3VsdC5wYXRoKVxuICAgICAgICBpZiAoIWNvbGxlY3RFcnJvcnMpIHJldHVybiByZXN1bHQ7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWVbaV0gIT09ICdvYmplY3QnIHx8IHJlc3VsdC5tZXNzYWdlKSBlcnJvcnMucHVzaChyZXN1bHQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFjb2xsZWN0RXJyb3JzKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIGVycm9ycy5sZW5ndGggPT09IDAgPyBmYWxzZSA6IGVycm9ycztcbiAgfVxuXG4gIC8vIEFyYml0cmFyeSB2YWxpZGF0aW9uIGNoZWNrcy4gVGhlIGNvbmRpdGlvbiBjYW4gcmV0dXJuIGZhbHNlIG9yIHRocm93IGFcbiAgLy8gTWF0Y2guRXJyb3IgKGllLCBpdCBjYW4gaW50ZXJuYWxseSB1c2UgY2hlY2soKSkgdG8gZmFpbC5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBXaGVyZSkge1xuICAgIGxldCByZXN1bHQ7XG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdCA9IHBhdHRlcm4uY29uZGl0aW9uKHZhbHVlKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmICghKGVyciBpbnN0YW5jZW9mIE1hdGNoLkVycm9yKSkge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGVyci5tZXNzYWdlLFxuICAgICAgICBwYXRoOiBlcnIucGF0aFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gWFhYIHRoaXMgZXJyb3IgaXMgdGVycmlibGVcblxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiAnRmFpbGVkIE1hdGNoLldoZXJlIHZhbGlkYXRpb24nLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgTWF5YmUpIHtcbiAgICBwYXR0ZXJuID0gTWF0Y2guT25lT2YodW5kZWZpbmVkLCBudWxsLCBwYXR0ZXJuLnBhdHRlcm4pO1xuICB9IGVsc2UgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBPcHRpb25hbCkge1xuICAgIHBhdHRlcm4gPSBNYXRjaC5PbmVPZih1bmRlZmluZWQsIHBhdHRlcm4ucGF0dGVybik7XG4gIH1cblxuICBpZiAocGF0dGVybiBpbnN0YW5jZW9mIE9uZU9mKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmNob2ljZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRlc3RTdWJ0cmVlKHZhbHVlLCBwYXR0ZXJuLmNob2ljZXNbaV0pO1xuICAgICAgaWYgKCFyZXN1bHQpIHtcblxuICAgICAgICAvLyBObyBlcnJvcj8gWWF5LCByZXR1cm4uXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gTWF0Y2ggZXJyb3JzIGp1c3QgbWVhbiB0cnkgYW5vdGhlciBjaG9pY2UuXG4gICAgfVxuXG4gICAgLy8gWFhYIHRoaXMgZXJyb3IgaXMgdGVycmlibGVcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogJ0ZhaWxlZCBNYXRjaC5PbmVPZiwgTWF0Y2guTWF5YmUgb3IgTWF0Y2guT3B0aW9uYWwgdmFsaWRhdGlvbicsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gQSBmdW5jdGlvbiB0aGF0IGlzbid0IHNvbWV0aGluZyB3ZSBzcGVjaWFsLWNhc2UgaXMgYXNzdW1lZCB0byBiZSBhXG4gIC8vIGNvbnN0cnVjdG9yLlxuICBpZiAocGF0dGVybiBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgcGF0dGVybikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgJHtwYXR0ZXJuLm5hbWUgfHwgJ3BhcnRpY3VsYXIgY29uc3RydWN0b3InfWAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgbGV0IHVua25vd25LZXlzQWxsb3dlZCA9IGZhbHNlO1xuICBsZXQgdW5rbm93bktleVBhdHRlcm47XG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgT2JqZWN0SW5jbHVkaW5nKSB7XG4gICAgdW5rbm93bktleXNBbGxvd2VkID0gdHJ1ZTtcbiAgICBwYXR0ZXJuID0gcGF0dGVybi5wYXR0ZXJuO1xuICB9XG5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBPYmplY3RXaXRoVmFsdWVzKSB7XG4gICAgdW5rbm93bktleXNBbGxvd2VkID0gdHJ1ZTtcbiAgICB1bmtub3duS2V5UGF0dGVybiA9IFtwYXR0ZXJuLnBhdHRlcm5dO1xuICAgIHBhdHRlcm4gPSB7fTsgIC8vIG5vIHJlcXVpcmVkIGtleXNcbiAgfVxuXG4gIGlmICh0eXBlb2YgcGF0dGVybiAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogJ0JhZCBwYXR0ZXJuOiB1bmtub3duIHBhdHRlcm4gdHlwZScsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gQW4gb2JqZWN0LCB3aXRoIHJlcXVpcmVkIGFuZCBvcHRpb25hbCBrZXlzLiBOb3RlIHRoYXQgdGhpcyBkb2VzIE5PVCBkb1xuICAvLyBzdHJ1Y3R1cmFsIG1hdGNoZXMgYWdhaW5zdCBvYmplY3RzIG9mIHNwZWNpYWwgdHlwZXMgdGhhdCBoYXBwZW4gdG8gbWF0Y2hcbiAgLy8gdGhlIHBhdHRlcm46IHRoaXMgcmVhbGx5IG5lZWRzIHRvIGJlIGEgcGxhaW4gb2xkIHtPYmplY3R9IVxuICBpZiAodHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgb2JqZWN0LCBnb3QgJHt0eXBlb2YgdmFsdWV9YCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkIG9iamVjdCwgZ290IG51bGxgLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIGlmICghIGlzUGxhaW5PYmplY3QodmFsdWUpKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBwbGFpbiBvYmplY3RgLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IHJlcXVpcmVkUGF0dGVybnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBjb25zdCBvcHRpb25hbFBhdHRlcm5zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICBPYmplY3Qua2V5cyhwYXR0ZXJuKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgY29uc3Qgc3ViUGF0dGVybiA9IHBhdHRlcm5ba2V5XTtcbiAgICBpZiAoc3ViUGF0dGVybiBpbnN0YW5jZW9mIE9wdGlvbmFsIHx8XG4gICAgICAgIHN1YlBhdHRlcm4gaW5zdGFuY2VvZiBNYXliZSkge1xuICAgICAgb3B0aW9uYWxQYXR0ZXJuc1trZXldID0gc3ViUGF0dGVybi5wYXR0ZXJuO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXF1aXJlZFBhdHRlcm5zW2tleV0gPSBzdWJQYXR0ZXJuO1xuICAgIH1cbiAgfSk7XG5cbiAgZm9yIChsZXQga2V5IGluIE9iamVjdCh2YWx1ZSkpIHtcbiAgICBjb25zdCBzdWJWYWx1ZSA9IHZhbHVlW2tleV07XG4gICAgY29uc3Qgb2JqUGF0aCA9IHBhdGggPyBgJHtwYXRofS4ke2tleX1gIDoga2V5O1xuICAgIGlmIChoYXNPd24uY2FsbChyZXF1aXJlZFBhdHRlcm5zLCBrZXkpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgcmVxdWlyZWRQYXR0ZXJuc1trZXldLCBjb2xsZWN0RXJyb3JzLCBlcnJvcnMsIG9ialBhdGgpO1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICByZXN1bHQucGF0aCA9IF9wcmVwZW5kUGF0aChjb2xsZWN0RXJyb3JzID8gb2JqUGF0aCA6IGtleSwgcmVzdWx0LnBhdGgpXG4gICAgICAgIGlmICghY29sbGVjdEVycm9ycykgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgaWYgKHR5cGVvZiBzdWJWYWx1ZSAhPT0gJ29iamVjdCcgfHwgcmVzdWx0Lm1lc3NhZ2UpIGVycm9ycy5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGRlbGV0ZSByZXF1aXJlZFBhdHRlcm5zW2tleV07XG4gICAgfSBlbHNlIGlmIChoYXNPd24uY2FsbChvcHRpb25hbFBhdHRlcm5zLCBrZXkpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgb3B0aW9uYWxQYXR0ZXJuc1trZXldLCBjb2xsZWN0RXJyb3JzLCBlcnJvcnMsIG9ialBhdGgpO1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICByZXN1bHQucGF0aCA9IF9wcmVwZW5kUGF0aChjb2xsZWN0RXJyb3JzID8gb2JqUGF0aCA6IGtleSwgcmVzdWx0LnBhdGgpXG4gICAgICAgIGlmICghY29sbGVjdEVycm9ycykgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgaWYgKHR5cGVvZiBzdWJWYWx1ZSAhPT0gJ29iamVjdCcgfHwgcmVzdWx0Lm1lc3NhZ2UpIGVycm9ycy5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF1bmtub3duS2V5c0FsbG93ZWQpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgIG1lc3NhZ2U6ICdVbmtub3duIGtleScsXG4gICAgICAgICAgcGF0aDoga2V5LFxuICAgICAgICB9O1xuICAgICAgICBpZiAoIWNvbGxlY3RFcnJvcnMpIHJldHVybiByZXN1bHQ7XG4gICAgICAgIGVycm9ycy5wdXNoKHJlc3VsdCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh1bmtub3duS2V5UGF0dGVybikge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgdW5rbm93bktleVBhdHRlcm5bMF0sIGNvbGxlY3RFcnJvcnMsIGVycm9ycywgb2JqUGF0aCk7XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQucGF0aCA9IF9wcmVwZW5kUGF0aChjb2xsZWN0RXJyb3JzID8gb2JqUGF0aCA6IGtleSwgcmVzdWx0LnBhdGgpXG4gICAgICAgICAgaWYgKCFjb2xsZWN0RXJyb3JzKSByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIGlmICh0eXBlb2Ygc3ViVmFsdWUgIT09ICdvYmplY3QnIHx8IHJlc3VsdC5tZXNzYWdlKSBlcnJvcnMucHVzaChyZXN1bHQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHJlcXVpcmVkUGF0dGVybnMpO1xuICBpZiAoa2V5cy5sZW5ndGgpIHtcbiAgICBjb25zdCBjcmVhdGVNaXNzaW5nRXJyb3IgPSBrZXkgPT4gKHtcbiAgICAgIG1lc3NhZ2U6IGBNaXNzaW5nIGtleSAnJHtrZXl9J2AsXG4gICAgICBwYXRoOiBjb2xsZWN0RXJyb3JzID8gcGF0aCA6ICcnLFxuICAgIH0pO1xuXG4gICAgaWYgKCFjb2xsZWN0RXJyb3JzKSB7XG4gICAgICByZXR1cm4gY3JlYXRlTWlzc2luZ0Vycm9yKGtleXNbMF0pO1xuICAgIH1cblxuICAgIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcbiAgICAgIGVycm9ycy5wdXNoKGNyZWF0ZU1pc3NpbmdFcnJvcihrZXkpKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWNvbGxlY3RFcnJvcnMpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIGVycm9ycy5sZW5ndGggPT09IDAgPyBmYWxzZSA6IGVycm9ycztcbn07XG5cbmNsYXNzIEFyZ3VtZW50Q2hlY2tlciB7XG4gIGNvbnN0cnVjdG9yIChhcmdzLCBkZXNjcmlwdGlvbikge1xuXG4gICAgLy8gTWFrZSBhIFNIQUxMT1cgY29weSBvZiB0aGUgYXJndW1lbnRzLiAoV2UnbGwgYmUgZG9pbmcgaWRlbnRpdHkgY2hlY2tzXG4gICAgLy8gYWdhaW5zdCBpdHMgY29udGVudHMuKVxuICAgIHRoaXMuYXJncyA9IFsuLi5hcmdzXTtcblxuICAgIC8vIFNpbmNlIHRoZSBjb21tb24gY2FzZSB3aWxsIGJlIHRvIGNoZWNrIGFyZ3VtZW50cyBpbiBvcmRlciwgYW5kIHdlIHNwbGljZVxuICAgIC8vIG91dCBhcmd1bWVudHMgd2hlbiB3ZSBjaGVjayB0aGVtLCBtYWtlIGl0IHNvIHdlIHNwbGljZSBvdXQgZnJvbSB0aGUgZW5kXG4gICAgLy8gcmF0aGVyIHRoYW4gdGhlIGJlZ2lubmluZy5cbiAgICB0aGlzLmFyZ3MucmV2ZXJzZSgpO1xuICAgIHRoaXMuZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcbiAgfVxuXG4gIGNoZWNraW5nKHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuX2NoZWNraW5nT25lVmFsdWUodmFsdWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQWxsb3cgY2hlY2soYXJndW1lbnRzLCBbU3RyaW5nXSkgb3IgY2hlY2soYXJndW1lbnRzLnNsaWNlKDEpLCBbU3RyaW5nXSlcbiAgICAvLyBvciBjaGVjayhbZm9vLCBiYXJdLCBbU3RyaW5nXSkgdG8gY291bnQuLi4gYnV0IG9ubHkgaWYgdmFsdWUgd2Fzbid0XG4gICAgLy8gaXRzZWxmIGFuIGFyZ3VtZW50LlxuICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSB8fCBpc0FyZ3VtZW50cyh2YWx1ZSkpIHtcbiAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwodmFsdWUsIHRoaXMuX2NoZWNraW5nT25lVmFsdWUuYmluZCh0aGlzKSk7XG4gICAgfVxuICB9XG5cbiAgX2NoZWNraW5nT25lVmFsdWUodmFsdWUpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuYXJncy5sZW5ndGg7ICsraSkge1xuXG4gICAgICAvLyBJcyB0aGlzIHZhbHVlIG9uZSBvZiB0aGUgYXJndW1lbnRzPyAoVGhpcyBjYW4gaGF2ZSBhIGZhbHNlIHBvc2l0aXZlIGlmXG4gICAgICAvLyB0aGUgYXJndW1lbnQgaXMgYW4gaW50ZXJuZWQgcHJpbWl0aXZlLCBidXQgaXQncyBzdGlsbCBhIGdvb2QgZW5vdWdoXG4gICAgICAvLyBjaGVjay4pXG4gICAgICAvLyAoTmFOIGlzIG5vdCA9PT0gdG8gaXRzZWxmLCBzbyB3ZSBoYXZlIHRvIGNoZWNrIHNwZWNpYWxseS4pXG4gICAgICBpZiAodmFsdWUgPT09IHRoaXMuYXJnc1tpXSB8fFxuICAgICAgICAgIChOdW1iZXIuaXNOYU4odmFsdWUpICYmIE51bWJlci5pc05hTih0aGlzLmFyZ3NbaV0pKSkge1xuICAgICAgICB0aGlzLmFyZ3Muc3BsaWNlKGksIDEpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdGhyb3dVbmxlc3NBbGxBcmd1bWVudHNIYXZlQmVlbkNoZWNrZWQoKSB7XG4gICAgaWYgKHRoaXMuYXJncy5sZW5ndGggPiAwKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBEaWQgbm90IGNoZWNrKCkgYWxsIGFyZ3VtZW50cyBkdXJpbmcgJHt0aGlzLmRlc2NyaXB0aW9ufWApO1xuICB9XG59XG5cbmNvbnN0IF9qc0tleXdvcmRzID0gWydkbycsICdpZicsICdpbicsICdmb3InLCAnbGV0JywgJ25ldycsICd0cnknLCAndmFyJywgJ2Nhc2UnLFxuICAnZWxzZScsICdlbnVtJywgJ2V2YWwnLCAnZmFsc2UnLCAnbnVsbCcsICd0aGlzJywgJ3RydWUnLCAndm9pZCcsICd3aXRoJyxcbiAgJ2JyZWFrJywgJ2NhdGNoJywgJ2NsYXNzJywgJ2NvbnN0JywgJ3N1cGVyJywgJ3Rocm93JywgJ3doaWxlJywgJ3lpZWxkJyxcbiAgJ2RlbGV0ZScsICdleHBvcnQnLCAnaW1wb3J0JywgJ3B1YmxpYycsICdyZXR1cm4nLCAnc3RhdGljJywgJ3N3aXRjaCcsXG4gICd0eXBlb2YnLCAnZGVmYXVsdCcsICdleHRlbmRzJywgJ2ZpbmFsbHknLCAncGFja2FnZScsICdwcml2YXRlJywgJ2NvbnRpbnVlJyxcbiAgJ2RlYnVnZ2VyJywgJ2Z1bmN0aW9uJywgJ2FyZ3VtZW50cycsICdpbnRlcmZhY2UnLCAncHJvdGVjdGVkJywgJ2ltcGxlbWVudHMnLFxuICAnaW5zdGFuY2VvZiddO1xuXG4vLyBBc3N1bWVzIHRoZSBiYXNlIG9mIHBhdGggaXMgYWxyZWFkeSBlc2NhcGVkIHByb3Blcmx5XG4vLyByZXR1cm5zIGtleSArIGJhc2VcbmNvbnN0IF9wcmVwZW5kUGF0aCA9IChrZXksIGJhc2UpID0+IHtcbiAgaWYgKCh0eXBlb2Yga2V5KSA9PT0gJ251bWJlcicgfHwga2V5Lm1hdGNoKC9eWzAtOV0rJC8pKSB7XG4gICAga2V5ID0gYFske2tleX1dYDtcbiAgfSBlbHNlIGlmICgha2V5Lm1hdGNoKC9eW2Etel8kXVswLTlhLXpfJC5bXFxdXSokL2kpIHx8XG4gICAgICAgICAgICAgX2pzS2V5d29yZHMuaW5kZXhPZihrZXkpID49IDApIHtcbiAgICBrZXkgPSBKU09OLnN0cmluZ2lmeShba2V5XSk7XG4gIH1cblxuICBpZiAoYmFzZSAmJiBiYXNlWzBdICE9PSAnWycpIHtcbiAgICByZXR1cm4gYCR7a2V5fS4ke2Jhc2V9YDtcbiAgfVxuXG4gIHJldHVybiBrZXkgKyBiYXNlO1xufVxuXG5jb25zdCBpc09iamVjdCA9IHZhbHVlID0+IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGw7XG5cbmNvbnN0IGJhc2VJc0FyZ3VtZW50cyA9IGl0ZW0gPT5cbiAgaXNPYmplY3QoaXRlbSkgJiZcbiAgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGl0ZW0pID09PSAnW29iamVjdCBBcmd1bWVudHNdJztcblxuY29uc3QgaXNBcmd1bWVudHMgPSBiYXNlSXNBcmd1bWVudHMoZnVuY3Rpb24oKSB7IHJldHVybiBhcmd1bWVudHM7IH0oKSkgP1xuICBiYXNlSXNBcmd1bWVudHMgOlxuICB2YWx1ZSA9PiBpc09iamVjdCh2YWx1ZSkgJiYgdHlwZW9mIHZhbHVlLmNhbGxlZSA9PT0gJ2Z1bmN0aW9uJztcbiIsIi8vIENvcHkgb2YgalF1ZXJ5LmlzUGxhaW5PYmplY3QgZm9yIHRoZSBzZXJ2ZXIgc2lkZSBmcm9tIGpRdWVyeSB2My4xLjEuXG5cbmNvbnN0IGNsYXNzMnR5cGUgPSB7fTtcblxuY29uc3QgdG9TdHJpbmcgPSBjbGFzczJ0eXBlLnRvU3RyaW5nO1xuXG5jb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5jb25zdCBmblRvU3RyaW5nID0gaGFzT3duLnRvU3RyaW5nO1xuXG5jb25zdCBPYmplY3RGdW5jdGlvblN0cmluZyA9IGZuVG9TdHJpbmcuY2FsbChPYmplY3QpO1xuXG5jb25zdCBnZXRQcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZjtcblxuZXhwb3J0IGNvbnN0IGlzUGxhaW5PYmplY3QgPSBvYmogPT4ge1xuICBsZXQgcHJvdG87XG4gIGxldCBDdG9yO1xuXG4gIC8vIERldGVjdCBvYnZpb3VzIG5lZ2F0aXZlc1xuICAvLyBVc2UgdG9TdHJpbmcgaW5zdGVhZCBvZiBqUXVlcnkudHlwZSB0byBjYXRjaCBob3N0IG9iamVjdHNcbiAgaWYgKCFvYmogfHwgdG9TdHJpbmcuY2FsbChvYmopICE9PSAnW29iamVjdCBPYmplY3RdJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHByb3RvID0gZ2V0UHJvdG8ob2JqKTtcblxuICAvLyBPYmplY3RzIHdpdGggbm8gcHJvdG90eXBlIChlLmcuLCBgT2JqZWN0LmNyZWF0ZSggbnVsbCApYCkgYXJlIHBsYWluXG4gIGlmICghcHJvdG8pIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8vIE9iamVjdHMgd2l0aCBwcm90b3R5cGUgYXJlIHBsYWluIGlmZiB0aGV5IHdlcmUgY29uc3RydWN0ZWQgYnkgYSBnbG9iYWwgT2JqZWN0IGZ1bmN0aW9uXG4gIEN0b3IgPSBoYXNPd24uY2FsbChwcm90bywgJ2NvbnN0cnVjdG9yJykgJiYgcHJvdG8uY29uc3RydWN0b3I7XG4gIHJldHVybiB0eXBlb2YgQ3RvciA9PT0gJ2Z1bmN0aW9uJyAmJiBcbiAgICBmblRvU3RyaW5nLmNhbGwoQ3RvcikgPT09IE9iamVjdEZ1bmN0aW9uU3RyaW5nO1xufTtcbiJdfQ==
