Package["core-runtime"].queue("minimongo",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var GeoJSON = Package['geojson-utils'].GeoJSON;
var IdMap = Package['id-map'].IdMap;
var MongoID = Package['mongo-id'].MongoID;
var OrderedDict = Package['ordered-dict'].OrderedDict;
var Random = Package.random.Random;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Decimal = Package['mongo-decimal'].Decimal;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var MinimongoTest, MinimongoError, LocalCollection, Minimongo;

var require = meteorInstall({"node_modules":{"meteor":{"minimongo":{"minimongo_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/minimongo/minimongo_server.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("./minimongo_common.js");
    let hasOwn, isNumericKey, isOperatorObject, pathsToTree, projectionDetails;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      isNumericKey(v) {
        isNumericKey = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      pathsToTree(v) {
        pathsToTree = v;
      },
      projectionDetails(v) {
        projectionDetails = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Minimongo._pathsElidingNumericKeys = paths => paths.map(path => path.split('.').filter(part => !isNumericKey(part)).join('.'));

    // Returns true if the modifier applied to some document may change the result
    // of matching the document by selector
    // The modifier is always in a form of Object:
    //  - $set
    //    - 'a.b.22.z': value
    //    - 'foo.bar': 42
    //  - $unset
    //    - 'abc.d': 1
    Minimongo.Matcher.prototype.affectedByModifier = function (modifier) {
      // safe check for $set/$unset being objects
      modifier = Object.assign({
        $set: {},
        $unset: {}
      }, modifier);
      const meaningfulPaths = this._getPaths();
      const modifiedPaths = [].concat(Object.keys(modifier.$set), Object.keys(modifier.$unset));
      return modifiedPaths.some(path => {
        const mod = path.split('.');
        return meaningfulPaths.some(meaningfulPath => {
          const sel = meaningfulPath.split('.');
          let i = 0,
            j = 0;
          while (i < sel.length && j < mod.length) {
            if (isNumericKey(sel[i]) && isNumericKey(mod[j])) {
              // foo.4.bar selector affected by foo.4 modifier
              // foo.3.bar selector unaffected by foo.4 modifier
              if (sel[i] === mod[j]) {
                i++;
                j++;
              } else {
                return false;
              }
            } else if (isNumericKey(sel[i])) {
              // foo.4.bar selector unaffected by foo.bar modifier
              return false;
            } else if (isNumericKey(mod[j])) {
              j++;
            } else if (sel[i] === mod[j]) {
              i++;
              j++;
            } else {
              return false;
            }
          }

          // One is a prefix of another, taking numeric fields into account
          return true;
        });
      });
    };

    // @param modifier - Object: MongoDB-styled modifier with `$set`s and `$unsets`
    //                           only. (assumed to come from oplog)
    // @returns - Boolean: if after applying the modifier, selector can start
    //                     accepting the modified value.
    // NOTE: assumes that document affected by modifier didn't match this Matcher
    // before, so if modifier can't convince selector in a positive change it would
    // stay 'false'.
    // Currently doesn't support $-operators and numeric indices precisely.
    Minimongo.Matcher.prototype.canBecomeTrueByModifier = function (modifier) {
      if (!this.affectedByModifier(modifier)) {
        return false;
      }
      if (!this.isSimple()) {
        return true;
      }
      modifier = Object.assign({
        $set: {},
        $unset: {}
      }, modifier);
      const modifierPaths = [].concat(Object.keys(modifier.$set), Object.keys(modifier.$unset));
      if (this._getPaths().some(pathHasNumericKeys) || modifierPaths.some(pathHasNumericKeys)) {
        return true;
      }

      // check if there is a $set or $unset that indicates something is an
      // object rather than a scalar in the actual object where we saw $-operator
      // NOTE: it is correct since we allow only scalars in $-operators
      // Example: for selector {'a.b': {$gt: 5}} the modifier {'a.b.c':7} would
      // definitely set the result to false as 'a.b' appears to be an object.
      const expectedScalarIsObject = Object.keys(this._selector).some(path => {
        if (!isOperatorObject(this._selector[path])) {
          return false;
        }
        return modifierPaths.some(modifierPath => modifierPath.startsWith("".concat(path, ".")));
      });
      if (expectedScalarIsObject) {
        return false;
      }

      // See if we can apply the modifier on the ideally matching object. If it
      // still matches the selector, then the modifier could have turned the real
      // object in the database into something matching.
      const matchingDocument = EJSON.clone(this.matchingDocument());

      // The selector is too complex, anything can happen.
      if (matchingDocument === null) {
        return true;
      }
      try {
        LocalCollection._modify(matchingDocument, modifier);
      } catch (error) {
        // Couldn't set a property on a field which is a scalar or null in the
        // selector.
        // Example:
        // real document: { 'a.b': 3 }
        // selector: { 'a': 12 }
        // converted selector (ideal document): { 'a': 12 }
        // modifier: { $set: { 'a.b': 4 } }
        // We don't know what real document was like but from the error raised by
        // $set on a scalar field we can reason that the structure of real document
        // is completely different.
        if (error.name === 'MinimongoError' && error.setPropertyError) {
          return false;
        }
        throw error;
      }
      return this.documentMatches(matchingDocument).result;
    };

    // Knows how to combine a mongo selector and a fields projection to a new fields
    // projection taking into account active fields from the passed selector.
    // @returns Object - projection object (same as fields option of mongo cursor)
    Minimongo.Matcher.prototype.combineIntoProjection = function (projection) {
      const selectorPaths = Minimongo._pathsElidingNumericKeys(this._getPaths());

      // Special case for $where operator in the selector - projection should depend
      // on all fields of the document. getSelectorPaths returns a list of paths
      // selector depends on. If one of the paths is '' (empty string) representing
      // the root or the whole document, complete projection should be returned.
      if (selectorPaths.includes('')) {
        return {};
      }
      return combineImportantPathsIntoProjection(selectorPaths, projection);
    };

    // Returns an object that would match the selector if possible or null if the
    // selector is too complex for us to analyze
    // { 'a.b': { ans: 42 }, 'foo.bar': null, 'foo.baz': "something" }
    // => { a: { b: { ans: 42 } }, foo: { bar: null, baz: "something" } }
    Minimongo.Matcher.prototype.matchingDocument = function () {
      // check if it was computed before
      if (this._matchingDocument !== undefined) {
        return this._matchingDocument;
      }

      // If the analysis of this selector is too hard for our implementation
      // fallback to "YES"
      let fallback = false;
      this._matchingDocument = pathsToTree(this._getPaths(), path => {
        const valueSelector = this._selector[path];
        if (isOperatorObject(valueSelector)) {
          // if there is a strict equality, there is a good
          // chance we can use one of those as "matching"
          // dummy value
          if (valueSelector.$eq) {
            return valueSelector.$eq;
          }
          if (valueSelector.$in) {
            const matcher = new Minimongo.Matcher({
              placeholder: valueSelector
            });

            // Return anything from $in that matches the whole selector for this
            // path. If nothing matches, returns `undefined` as nothing can make
            // this selector into `true`.
            return valueSelector.$in.find(placeholder => matcher.documentMatches({
              placeholder
            }).result);
          }
          if (onlyContainsKeys(valueSelector, ['$gt', '$gte', '$lt', '$lte'])) {
            let lowerBound = -Infinity;
            let upperBound = Infinity;
            ['$lte', '$lt'].forEach(op => {
              if (hasOwn.call(valueSelector, op) && valueSelector[op] < upperBound) {
                upperBound = valueSelector[op];
              }
            });
            ['$gte', '$gt'].forEach(op => {
              if (hasOwn.call(valueSelector, op) && valueSelector[op] > lowerBound) {
                lowerBound = valueSelector[op];
              }
            });
            const middle = (lowerBound + upperBound) / 2;
            const matcher = new Minimongo.Matcher({
              placeholder: valueSelector
            });
            if (!matcher.documentMatches({
              placeholder: middle
            }).result && (middle === lowerBound || middle === upperBound)) {
              fallback = true;
            }
            return middle;
          }
          if (onlyContainsKeys(valueSelector, ['$nin', '$ne'])) {
            // Since this._isSimple makes sure $nin and $ne are not combined with
            // objects or arrays, we can confidently return an empty object as it
            // never matches any scalar.
            return {};
          }
          fallback = true;
        }
        return this._selector[path];
      }, x => x);
      if (fallback) {
        this._matchingDocument = null;
      }
      return this._matchingDocument;
    };

    // Minimongo.Sorter gets a similar method, which delegates to a Matcher it made
    // for this exact purpose.
    Minimongo.Sorter.prototype.affectedByModifier = function (modifier) {
      return this._selectorForAffectedByModifier.affectedByModifier(modifier);
    };
    Minimongo.Sorter.prototype.combineIntoProjection = function (projection) {
      return combineImportantPathsIntoProjection(Minimongo._pathsElidingNumericKeys(this._getPaths()), projection);
    };
    function combineImportantPathsIntoProjection(paths, projection) {
      const details = projectionDetails(projection);

      // merge the paths to include
      const tree = pathsToTree(paths, path => true, (node, path, fullPath) => true, details.tree);
      const mergedProjection = treeToPaths(tree);
      if (details.including) {
        // both selector and projection are pointing on fields to include
        // so we can just return the merged tree
        return mergedProjection;
      }

      // selector is pointing at fields to include
      // projection is pointing at fields to exclude
      // make sure we don't exclude important paths
      const mergedExclProjection = {};
      Object.keys(mergedProjection).forEach(path => {
        if (!mergedProjection[path]) {
          mergedExclProjection[path] = false;
        }
      });
      return mergedExclProjection;
    }
    function getPaths(selector) {
      return Object.keys(new Minimongo.Matcher(selector)._paths);

      // XXX remove it?
      // return Object.keys(selector).map(k => {
      //   // we don't know how to handle $where because it can be anything
      //   if (k === '$where') {
      //     return ''; // matches everything
      //   }

      //   // we branch from $or/$and/$nor operator
      //   if (['$or', '$and', '$nor'].includes(k)) {
      //     return selector[k].map(getPaths);
      //   }

      //   // the value is a literal or some comparison operator
      //   return k;
      // })
      //   .reduce((a, b) => a.concat(b), [])
      //   .filter((a, b, c) => c.indexOf(a) === b);
    }

    // A helper to ensure object has only certain keys
    function onlyContainsKeys(obj, keys) {
      return Object.keys(obj).every(k => keys.includes(k));
    }
    function pathHasNumericKeys(path) {
      return path.split('.').some(isNumericKey);
    }

    // Returns a set of key paths similar to
    // { 'foo.bar': 1, 'a.b.c': 1 }
    function treeToPaths(tree) {
      let prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
      const result = {};
      Object.keys(tree).forEach(key => {
        const value = tree[key];
        if (value === Object(value)) {
          Object.assign(result, treeToPaths(value, "".concat(prefix + key, ".")));
        } else {
          result[prefix + key] = value;
        }
      });
      return result;
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"common.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/minimongo/common.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      hasOwn: () => hasOwn,
      MiniMongoQueryError: () => MiniMongoQueryError,
      ELEMENT_OPERATORS: () => ELEMENT_OPERATORS,
      compileDocumentSelector: () => compileDocumentSelector,
      equalityElementMatcher: () => equalityElementMatcher,
      expandArraysInBranches: () => expandArraysInBranches,
      isIndexable: () => isIndexable,
      isNumericKey: () => isNumericKey,
      isOperatorObject: () => isOperatorObject,
      makeLookupFunction: () => makeLookupFunction,
      nothingMatcher: () => nothingMatcher,
      pathsToTree: () => pathsToTree,
      populateDocumentWithQueryFields: () => populateDocumentWithQueryFields,
      projectionDetails: () => projectionDetails,
      regexpElementMatcher: () => regexpElementMatcher
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const hasOwn = Object.prototype.hasOwnProperty;
    class MiniMongoQueryError extends Error {}
    const ELEMENT_OPERATORS = {
      $lt: makeInequality(cmpValue => cmpValue < 0),
      $gt: makeInequality(cmpValue => cmpValue > 0),
      $lte: makeInequality(cmpValue => cmpValue <= 0),
      $gte: makeInequality(cmpValue => cmpValue >= 0),
      $mod: {
        compileElementSelector(operand) {
          if (!(Array.isArray(operand) && operand.length === 2 && typeof operand[0] === 'number' && typeof operand[1] === 'number')) {
            throw new MiniMongoQueryError('argument to $mod must be an array of two numbers');
          }

          // XXX could require to be ints or round or something
          const divisor = operand[0];
          const remainder = operand[1];
          return value => typeof value === 'number' && value % divisor === remainder;
        }
      },
      $in: {
        compileElementSelector(operand) {
          if (!Array.isArray(operand)) {
            throw new MiniMongoQueryError('$in needs an array');
          }
          const elementMatchers = operand.map(option => {
            if (option instanceof RegExp) {
              return regexpElementMatcher(option);
            }
            if (isOperatorObject(option)) {
              throw new MiniMongoQueryError('cannot nest $ under $in');
            }
            return equalityElementMatcher(option);
          });
          return value => {
            // Allow {a: {$in: [null]}} to match when 'a' does not exist.
            if (value === undefined) {
              value = null;
            }
            return elementMatchers.some(matcher => matcher(value));
          };
        }
      },
      $size: {
        // {a: [[5, 5]]} must match {a: {$size: 1}} but not {a: {$size: 2}}, so we
        // don't want to consider the element [5,5] in the leaf array [[5,5]] as a
        // possible value.
        dontExpandLeafArrays: true,
        compileElementSelector(operand) {
          if (typeof operand === 'string') {
            // Don't ask me why, but by experimentation, this seems to be what Mongo
            // does.
            operand = 0;
          } else if (typeof operand !== 'number') {
            throw new MiniMongoQueryError('$size needs a number');
          }
          return value => Array.isArray(value) && value.length === operand;
        }
      },
      $type: {
        // {a: [5]} must not match {a: {$type: 4}} (4 means array), but it should
        // match {a: {$type: 1}} (1 means number), and {a: [[5]]} must match {$a:
        // {$type: 4}}. Thus, when we see a leaf array, we *should* expand it but
        // should *not* include it itself.
        dontIncludeLeafArrays: true,
        compileElementSelector(operand) {
          if (typeof operand === 'string') {
            const operandAliasMap = {
              'double': 1,
              'string': 2,
              'object': 3,
              'array': 4,
              'binData': 5,
              'undefined': 6,
              'objectId': 7,
              'bool': 8,
              'date': 9,
              'null': 10,
              'regex': 11,
              'dbPointer': 12,
              'javascript': 13,
              'symbol': 14,
              'javascriptWithScope': 15,
              'int': 16,
              'timestamp': 17,
              'long': 18,
              'decimal': 19,
              'minKey': -1,
              'maxKey': 127
            };
            if (!hasOwn.call(operandAliasMap, operand)) {
              throw new MiniMongoQueryError("unknown string alias for $type: ".concat(operand));
            }
            operand = operandAliasMap[operand];
          } else if (typeof operand === 'number') {
            if (operand === 0 || operand < -1 || operand > 19 && operand !== 127) {
              throw new MiniMongoQueryError("Invalid numerical $type code: ".concat(operand));
            }
          } else {
            throw new MiniMongoQueryError('argument to $type is not a number or a string');
          }
          return value => value !== undefined && LocalCollection._f._type(value) === operand;
        }
      },
      $bitsAllSet: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAllSet');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.every((byte, i) => (bitmask[i] & byte) === byte);
          };
        }
      },
      $bitsAnySet: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAnySet');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.some((byte, i) => (~bitmask[i] & byte) !== byte);
          };
        }
      },
      $bitsAllClear: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAllClear');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.every((byte, i) => !(bitmask[i] & byte));
          };
        }
      },
      $bitsAnyClear: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAnyClear');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.some((byte, i) => (bitmask[i] & byte) !== byte);
          };
        }
      },
      $regex: {
        compileElementSelector(operand, valueSelector) {
          if (!(typeof operand === 'string' || operand instanceof RegExp)) {
            throw new MiniMongoQueryError('$regex has to be a string or RegExp');
          }
          let regexp;
          if (valueSelector.$options !== undefined) {
            // Options passed in $options (even the empty string) always overrides
            // options in the RegExp object itself.

            // Be clear that we only support the JS-supported options, not extended
            // ones (eg, Mongo supports x and s). Ideally we would implement x and s
            // by transforming the regexp, but not today...
            if (/[^gim]/.test(valueSelector.$options)) {
              throw new MiniMongoQueryError('Only the i, m, and g regexp options are supported');
            }
            const source = operand instanceof RegExp ? operand.source : operand;
            regexp = new RegExp(source, valueSelector.$options);
          } else if (operand instanceof RegExp) {
            regexp = operand;
          } else {
            regexp = new RegExp(operand);
          }
          return regexpElementMatcher(regexp);
        }
      },
      $elemMatch: {
        dontExpandLeafArrays: true,
        compileElementSelector(operand, valueSelector, matcher) {
          if (!LocalCollection._isPlainObject(operand)) {
            throw new MiniMongoQueryError('$elemMatch need an object');
          }
          const isDocMatcher = !isOperatorObject(Object.keys(operand).filter(key => !hasOwn.call(LOGICAL_OPERATORS, key)).reduce((a, b) => Object.assign(a, {
            [b]: operand[b]
          }), {}), true);
          let subMatcher;
          if (isDocMatcher) {
            // This is NOT the same as compileValueSelector(operand), and not just
            // because of the slightly different calling convention.
            // {$elemMatch: {x: 3}} means "an element has a field x:3", not
            // "consists only of a field x:3". Also, regexps and sub-$ are allowed.
            subMatcher = compileDocumentSelector(operand, matcher, {
              inElemMatch: true
            });
          } else {
            subMatcher = compileValueSelector(operand, matcher);
          }
          return value => {
            if (!Array.isArray(value)) {
              return false;
            }
            for (let i = 0; i < value.length; ++i) {
              const arrayElement = value[i];
              let arg;
              if (isDocMatcher) {
                // We can only match {$elemMatch: {b: 3}} against objects.
                // (We can also match against arrays, if there's numeric indices,
                // eg {$elemMatch: {'0.b': 3}} or {$elemMatch: {0: 3}}.)
                if (!isIndexable(arrayElement)) {
                  return false;
                }
                arg = arrayElement;
              } else {
                // dontIterate ensures that {a: {$elemMatch: {$gt: 5}}} matches
                // {a: [8]} but not {a: [[8]]}
                arg = [{
                  value: arrayElement,
                  dontIterate: true
                }];
              }
              // XXX support $near in $elemMatch by propagating $distance?
              if (subMatcher(arg).result) {
                return i; // specially understood to mean "use as arrayIndices"
              }
            }
            return false;
          };
        }
      }
    };
    // Operators that appear at the top level of a document selector.
    const LOGICAL_OPERATORS = {
      $and(subSelector, matcher, inElemMatch) {
        return andDocumentMatchers(compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch));
      },
      $or(subSelector, matcher, inElemMatch) {
        const matchers = compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch);

        // Special case: if there is only one matcher, use it directly, *preserving*
        // any arrayIndices it returns.
        if (matchers.length === 1) {
          return matchers[0];
        }
        return doc => {
          const result = matchers.some(fn => fn(doc).result);
          // $or does NOT set arrayIndices when it has multiple
          // sub-expressions. (Tested against MongoDB.)
          return {
            result
          };
        };
      },
      $nor(subSelector, matcher, inElemMatch) {
        const matchers = compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch);
        return doc => {
          const result = matchers.every(fn => !fn(doc).result);
          // Never set arrayIndices, because we only match if nothing in particular
          // 'matched' (and because this is consistent with MongoDB).
          return {
            result
          };
        };
      },
      $where(selectorValue, matcher) {
        // Record that *any* path may be used.
        matcher._recordPathUsed('');
        matcher._hasWhere = true;
        if (!(selectorValue instanceof Function)) {
          // XXX MongoDB seems to have more complex logic to decide where or or not
          // to add 'return'; not sure exactly what it is.
          selectorValue = Function('obj', "return ".concat(selectorValue));
        }

        // We make the document available as both `this` and `obj`.
        // // XXX not sure what we should do if this throws
        return doc => ({
          result: selectorValue.call(doc, doc)
        });
      },
      // This is just used as a comment in the query (in MongoDB, it also ends up in
      // query logs); it has no effect on the actual selection.
      $comment() {
        return () => ({
          result: true
        });
      }
    };

    // Operators that (unlike LOGICAL_OPERATORS) pertain to individual paths in a
    // document, but (unlike ELEMENT_OPERATORS) do not have a simple definition as
    // "match each branched value independently and combine with
    // convertElementMatcherToBranchedMatcher".
    const VALUE_OPERATORS = {
      $eq(operand) {
        return convertElementMatcherToBranchedMatcher(equalityElementMatcher(operand));
      },
      $not(operand, valueSelector, matcher) {
        return invertBranchedMatcher(compileValueSelector(operand, matcher));
      },
      $ne(operand) {
        return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(equalityElementMatcher(operand)));
      },
      $nin(operand) {
        return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(ELEMENT_OPERATORS.$in.compileElementSelector(operand)));
      },
      $exists(operand) {
        const exists = convertElementMatcherToBranchedMatcher(value => value !== undefined);
        return operand ? exists : invertBranchedMatcher(exists);
      },
      // $options just provides options for $regex; its logic is inside $regex
      $options(operand, valueSelector) {
        if (!hasOwn.call(valueSelector, '$regex')) {
          throw new MiniMongoQueryError('$options needs a $regex');
        }
        return everythingMatcher;
      },
      // $maxDistance is basically an argument to $near
      $maxDistance(operand, valueSelector) {
        if (!valueSelector.$near) {
          throw new MiniMongoQueryError('$maxDistance needs a $near');
        }
        return everythingMatcher;
      },
      $all(operand, valueSelector, matcher) {
        if (!Array.isArray(operand)) {
          throw new MiniMongoQueryError('$all requires array');
        }

        // Not sure why, but this seems to be what MongoDB does.
        if (operand.length === 0) {
          return nothingMatcher;
        }
        const branchedMatchers = operand.map(criterion => {
          // XXX handle $all/$elemMatch combination
          if (isOperatorObject(criterion)) {
            throw new MiniMongoQueryError('no $ expressions in $all');
          }

          // This is always a regexp or equality selector.
          return compileValueSelector(criterion, matcher);
        });

        // andBranchedMatchers does NOT require all selectors to return true on the
        // SAME branch.
        return andBranchedMatchers(branchedMatchers);
      },
      $near(operand, valueSelector, matcher, isRoot) {
        if (!isRoot) {
          throw new MiniMongoQueryError('$near can\'t be inside another $ operator');
        }
        matcher._hasGeoQuery = true;

        // There are two kinds of geodata in MongoDB: legacy coordinate pairs and
        // GeoJSON. They use different distance metrics, too. GeoJSON queries are
        // marked with a $geometry property, though legacy coordinates can be
        // matched using $geometry.
        let maxDistance, point, distance;
        if (LocalCollection._isPlainObject(operand) && hasOwn.call(operand, '$geometry')) {
          // GeoJSON "2dsphere" mode.
          maxDistance = operand.$maxDistance;
          point = operand.$geometry;
          distance = value => {
            // XXX: for now, we don't calculate the actual distance between, say,
            // polygon and circle. If people care about this use-case it will get
            // a priority.
            if (!value) {
              return null;
            }
            if (!value.type) {
              return GeoJSON.pointDistance(point, {
                type: 'Point',
                coordinates: pointToArray(value)
              });
            }
            if (value.type === 'Point') {
              return GeoJSON.pointDistance(point, value);
            }
            return GeoJSON.geometryWithinRadius(value, point, maxDistance) ? 0 : maxDistance + 1;
          };
        } else {
          maxDistance = valueSelector.$maxDistance;
          if (!isIndexable(operand)) {
            throw new MiniMongoQueryError('$near argument must be coordinate pair or GeoJSON');
          }
          point = pointToArray(operand);
          distance = value => {
            if (!isIndexable(value)) {
              return null;
            }
            return distanceCoordinatePairs(point, value);
          };
        }
        return branchedValues => {
          // There might be multiple points in the document that match the given
          // field. Only one of them needs to be within $maxDistance, but we need to
          // evaluate all of them and use the nearest one for the implicit sort
          // specifier. (That's why we can't just use ELEMENT_OPERATORS here.)
          //
          // Note: This differs from MongoDB's implementation, where a document will
          // actually show up *multiple times* in the result set, with one entry for
          // each within-$maxDistance branching point.
          const result = {
            result: false
          };
          expandArraysInBranches(branchedValues).every(branch => {
            // if operation is an update, don't skip branches, just return the first
            // one (#3599)
            let curDistance;
            if (!matcher._isUpdate) {
              if (!(typeof branch.value === 'object')) {
                return true;
              }
              curDistance = distance(branch.value);

              // Skip branches that aren't real points or are too far away.
              if (curDistance === null || curDistance > maxDistance) {
                return true;
              }

              // Skip anything that's a tie.
              if (result.distance !== undefined && result.distance <= curDistance) {
                return true;
              }
            }
            result.result = true;
            result.distance = curDistance;
            if (branch.arrayIndices) {
              result.arrayIndices = branch.arrayIndices;
            } else {
              delete result.arrayIndices;
            }
            return !matcher._isUpdate;
          });
          return result;
        };
      }
    };

    // NB: We are cheating and using this function to implement 'AND' for both
    // 'document matchers' and 'branched matchers'. They both return result objects
    // but the argument is different: for the former it's a whole doc, whereas for
    // the latter it's an array of 'branched values'.
    function andSomeMatchers(subMatchers) {
      if (subMatchers.length === 0) {
        return everythingMatcher;
      }
      if (subMatchers.length === 1) {
        return subMatchers[0];
      }
      return docOrBranches => {
        const match = {};
        match.result = subMatchers.every(fn => {
          const subResult = fn(docOrBranches);

          // Copy a 'distance' number out of the first sub-matcher that has
          // one. Yes, this means that if there are multiple $near fields in a
          // query, something arbitrary happens; this appears to be consistent with
          // Mongo.
          if (subResult.result && subResult.distance !== undefined && match.distance === undefined) {
            match.distance = subResult.distance;
          }

          // Similarly, propagate arrayIndices from sub-matchers... but to match
          // MongoDB behavior, this time the *last* sub-matcher with arrayIndices
          // wins.
          if (subResult.result && subResult.arrayIndices) {
            match.arrayIndices = subResult.arrayIndices;
          }
          return subResult.result;
        });

        // If we didn't actually match, forget any extra metadata we came up with.
        if (!match.result) {
          delete match.distance;
          delete match.arrayIndices;
        }
        return match;
      };
    }
    const andDocumentMatchers = andSomeMatchers;
    const andBranchedMatchers = andSomeMatchers;
    function compileArrayOfDocumentSelectors(selectors, matcher, inElemMatch) {
      if (!Array.isArray(selectors) || selectors.length === 0) {
        throw new MiniMongoQueryError('$and/$or/$nor must be nonempty array');
      }
      return selectors.map(subSelector => {
        if (!LocalCollection._isPlainObject(subSelector)) {
          throw new MiniMongoQueryError('$or/$and/$nor entries need to be full objects');
        }
        return compileDocumentSelector(subSelector, matcher, {
          inElemMatch
        });
      });
    }

    // Takes in a selector that could match a full document (eg, the original
    // selector). Returns a function mapping document->result object.
    //
    // matcher is the Matcher object we are compiling.
    //
    // If this is the root document selector (ie, not wrapped in $and or the like),
    // then isRoot is true. (This is used by $near.)
    function compileDocumentSelector(docSelector, matcher) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      const docMatchers = Object.keys(docSelector).map(key => {
        const subSelector = docSelector[key];
        if (key.substr(0, 1) === '$') {
          // Outer operators are either logical operators (they recurse back into
          // this function), or $where.
          if (!hasOwn.call(LOGICAL_OPERATORS, key)) {
            throw new MiniMongoQueryError("Unrecognized logical operator: ".concat(key));
          }
          matcher._isSimple = false;
          return LOGICAL_OPERATORS[key](subSelector, matcher, options.inElemMatch);
        }

        // Record this path, but only if we aren't in an elemMatcher, since in an
        // elemMatch this is a path inside an object in an array, not in the doc
        // root.
        if (!options.inElemMatch) {
          matcher._recordPathUsed(key);
        }

        // Don't add a matcher if subSelector is a function -- this is to match
        // the behavior of Meteor on the server (inherited from the node mongodb
        // driver), which is to ignore any part of a selector which is a function.
        if (typeof subSelector === 'function') {
          return undefined;
        }
        const lookUpByIndex = makeLookupFunction(key);
        const valueMatcher = compileValueSelector(subSelector, matcher, options.isRoot);
        return doc => valueMatcher(lookUpByIndex(doc));
      }).filter(Boolean);
      return andDocumentMatchers(docMatchers);
    }
    // Takes in a selector that could match a key-indexed value in a document; eg,
    // {$gt: 5, $lt: 9}, or a regular expression, or any non-expression object (to
    // indicate equality).  Returns a branched matcher: a function mapping
    // [branched value]->result object.
    function compileValueSelector(valueSelector, matcher, isRoot) {
      if (valueSelector instanceof RegExp) {
        matcher._isSimple = false;
        return convertElementMatcherToBranchedMatcher(regexpElementMatcher(valueSelector));
      }
      if (isOperatorObject(valueSelector)) {
        return operatorBranchedMatcher(valueSelector, matcher, isRoot);
      }
      return convertElementMatcherToBranchedMatcher(equalityElementMatcher(valueSelector));
    }

    // Given an element matcher (which evaluates a single value), returns a branched
    // value (which evaluates the element matcher on all the branches and returns a
    // more structured return value possibly including arrayIndices).
    function convertElementMatcherToBranchedMatcher(elementMatcher) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      return branches => {
        const expanded = options.dontExpandLeafArrays ? branches : expandArraysInBranches(branches, options.dontIncludeLeafArrays);
        const match = {};
        match.result = expanded.some(element => {
          let matched = elementMatcher(element.value);

          // Special case for $elemMatch: it means "true, and use this as an array
          // index if I didn't already have one".
          if (typeof matched === 'number') {
            // XXX This code dates from when we only stored a single array index
            // (for the outermost array). Should we be also including deeper array
            // indices from the $elemMatch match?
            if (!element.arrayIndices) {
              element.arrayIndices = [matched];
            }
            matched = true;
          }

          // If some element matched, and it's tagged with array indices, include
          // those indices in our result object.
          if (matched && element.arrayIndices) {
            match.arrayIndices = element.arrayIndices;
          }
          return matched;
        });
        return match;
      };
    }

    // Helpers for $near.
    function distanceCoordinatePairs(a, b) {
      const pointA = pointToArray(a);
      const pointB = pointToArray(b);
      return Math.hypot(pointA[0] - pointB[0], pointA[1] - pointB[1]);
    }

    // Takes something that is not an operator object and returns an element matcher
    // for equality with that thing.
    function equalityElementMatcher(elementSelector) {
      if (isOperatorObject(elementSelector)) {
        throw new MiniMongoQueryError('Can\'t create equalityValueSelector for operator object');
      }

      // Special-case: null and undefined are equal (if you got undefined in there
      // somewhere, or if you got it due to some branch being non-existent in the
      // weird special case), even though they aren't with EJSON.equals.
      // undefined or null
      if (elementSelector == null) {
        return value => value == null;
      }
      return value => LocalCollection._f._equal(elementSelector, value);
    }
    function everythingMatcher(docOrBranchedValues) {
      return {
        result: true
      };
    }
    function expandArraysInBranches(branches, skipTheArrays) {
      const branchesOut = [];
      branches.forEach(branch => {
        const thisIsArray = Array.isArray(branch.value);

        // We include the branch itself, *UNLESS* we it's an array that we're going
        // to iterate and we're told to skip arrays.  (That's right, we include some
        // arrays even skipTheArrays is true: these are arrays that were found via
        // explicit numerical indices.)
        if (!(skipTheArrays && thisIsArray && !branch.dontIterate)) {
          branchesOut.push({
            arrayIndices: branch.arrayIndices,
            value: branch.value
          });
        }
        if (thisIsArray && !branch.dontIterate) {
          branch.value.forEach((value, i) => {
            branchesOut.push({
              arrayIndices: (branch.arrayIndices || []).concat(i),
              value
            });
          });
        }
      });
      return branchesOut;
    }
    // Helpers for $bitsAllSet/$bitsAnySet/$bitsAllClear/$bitsAnyClear.
    function getOperandBitmask(operand, selector) {
      // numeric bitmask
      // You can provide a numeric bitmask to be matched against the operand field.
      // It must be representable as a non-negative 32-bit signed integer.
      // Otherwise, $bitsAllSet will return an error.
      if (Number.isInteger(operand) && operand >= 0) {
        return new Uint8Array(new Int32Array([operand]).buffer);
      }

      // bindata bitmask
      // You can also use an arbitrarily large BinData instance as a bitmask.
      if (EJSON.isBinary(operand)) {
        return new Uint8Array(operand.buffer);
      }

      // position list
      // If querying a list of bit positions, each <position> must be a non-negative
      // integer. Bit positions start at 0 from the least significant bit.
      if (Array.isArray(operand) && operand.every(x => Number.isInteger(x) && x >= 0)) {
        const buffer = new ArrayBuffer((Math.max(...operand) >> 3) + 1);
        const view = new Uint8Array(buffer);
        operand.forEach(x => {
          view[x >> 3] |= 1 << (x & 0x7);
        });
        return view;
      }

      // bad operand
      throw new MiniMongoQueryError("operand to ".concat(selector, " must be a numeric bitmask (representable as a ") + 'non-negative 32-bit signed integer), a bindata bitmask or an array with ' + 'bit positions (non-negative integers)');
    }
    function getValueBitmask(value, length) {
      // The field value must be either numerical or a BinData instance. Otherwise,
      // $bits... will not match the current document.

      // numerical
      if (Number.isSafeInteger(value)) {
        // $bits... will not match numerical values that cannot be represented as a
        // signed 64-bit integer. This can be the case if a value is either too
        // large or small to fit in a signed 64-bit integer, or if it has a
        // fractional component.
        const buffer = new ArrayBuffer(Math.max(length, 2 * Uint32Array.BYTES_PER_ELEMENT));
        let view = new Uint32Array(buffer, 0, 2);
        view[0] = value % ((1 << 16) * (1 << 16)) | 0;
        view[1] = value / ((1 << 16) * (1 << 16)) | 0;

        // sign extension
        if (value < 0) {
          view = new Uint8Array(buffer, 2);
          view.forEach((byte, i) => {
            view[i] = 0xff;
          });
        }
        return new Uint8Array(buffer);
      }

      // bindata
      if (EJSON.isBinary(value)) {
        return new Uint8Array(value.buffer);
      }

      // no match
      return false;
    }

    // Actually inserts a key value into the selector document
    // However, this checks there is no ambiguity in setting
    // the value for the given key, throws otherwise
    function insertIntoDocument(document, key, value) {
      Object.keys(document).forEach(existingKey => {
        if (existingKey.length > key.length && existingKey.indexOf("".concat(key, ".")) === 0 || key.length > existingKey.length && key.indexOf("".concat(existingKey, ".")) === 0) {
          throw new MiniMongoQueryError("cannot infer query fields to set, both paths '".concat(existingKey, "' and '").concat(key, "' are matched"));
        } else if (existingKey === key) {
          throw new MiniMongoQueryError("cannot infer query fields to set, path '".concat(key, "' is matched twice"));
        }
      });
      document[key] = value;
    }

    // Returns a branched matcher that matches iff the given matcher does not.
    // Note that this implicitly "deMorganizes" the wrapped function.  ie, it
    // means that ALL branch values need to fail to match innerBranchedMatcher.
    function invertBranchedMatcher(branchedMatcher) {
      return branchValues => {
        // We explicitly choose to strip arrayIndices here: it doesn't make sense to
        // say "update the array element that does not match something", at least
        // in mongo-land.
        return {
          result: !branchedMatcher(branchValues).result
        };
      };
    }
    function isIndexable(obj) {
      return Array.isArray(obj) || LocalCollection._isPlainObject(obj);
    }
    function isNumericKey(s) {
      return /^[0-9]+$/.test(s);
    }
    function isOperatorObject(valueSelector, inconsistentOK) {
      if (!LocalCollection._isPlainObject(valueSelector)) {
        return false;
      }
      let theseAreOperators = undefined;
      Object.keys(valueSelector).forEach(selKey => {
        const thisIsOperator = selKey.substr(0, 1) === '$' || selKey === 'diff';
        if (theseAreOperators === undefined) {
          theseAreOperators = thisIsOperator;
        } else if (theseAreOperators !== thisIsOperator) {
          if (!inconsistentOK) {
            throw new MiniMongoQueryError("Inconsistent operator: ".concat(JSON.stringify(valueSelector)));
          }
          theseAreOperators = false;
        }
      });
      return !!theseAreOperators; // {} has no operators
    }
    // Helper for $lt/$gt/$lte/$gte.
    function makeInequality(cmpValueComparator) {
      return {
        compileElementSelector(operand) {
          // Arrays never compare false with non-arrays for any inequality.
          // XXX This was behavior we observed in pre-release MongoDB 2.5, but
          //     it seems to have been reverted.
          //     See https://jira.mongodb.org/browse/SERVER-11444
          if (Array.isArray(operand)) {
            return () => false;
          }

          // Special case: consider undefined and null the same (so true with
          // $gte/$lte).
          if (operand === undefined) {
            operand = null;
          }
          const operandType = LocalCollection._f._type(operand);
          return value => {
            if (value === undefined) {
              value = null;
            }

            // Comparisons are never true among things of different type (except
            // null vs undefined).
            if (LocalCollection._f._type(value) !== operandType) {
              return false;
            }
            return cmpValueComparator(LocalCollection._f._cmp(value, operand));
          };
        }
      };
    }

    // makeLookupFunction(key) returns a lookup function.
    //
    // A lookup function takes in a document and returns an array of matching
    // branches.  If no arrays are found while looking up the key, this array will
    // have exactly one branches (possibly 'undefined', if some segment of the key
    // was not found).
    //
    // If arrays are found in the middle, this can have more than one element, since
    // we 'branch'. When we 'branch', if there are more key segments to look up,
    // then we only pursue branches that are plain objects (not arrays or scalars).
    // This means we can actually end up with no branches!
    //
    // We do *NOT* branch on arrays that are found at the end (ie, at the last
    // dotted member of the key). We just return that array; if you want to
    // effectively 'branch' over the array's values, post-process the lookup
    // function with expandArraysInBranches.
    //
    // Each branch is an object with keys:
    //  - value: the value at the branch
    //  - dontIterate: an optional bool; if true, it means that 'value' is an array
    //    that expandArraysInBranches should NOT expand. This specifically happens
    //    when there is a numeric index in the key, and ensures the
    //    perhaps-surprising MongoDB behavior where {'a.0': 5} does NOT
    //    match {a: [[5]]}.
    //  - arrayIndices: if any array indexing was done during lookup (either due to
    //    explicit numeric indices or implicit branching), this will be an array of
    //    the array indices used, from outermost to innermost; it is falsey or
    //    absent if no array index is used. If an explicit numeric index is used,
    //    the index will be followed in arrayIndices by the string 'x'.
    //
    //    Note: arrayIndices is used for two purposes. First, it is used to
    //    implement the '$' modifier feature, which only ever looks at its first
    //    element.
    //
    //    Second, it is used for sort key generation, which needs to be able to tell
    //    the difference between different paths. Moreover, it needs to
    //    differentiate between explicit and implicit branching, which is why
    //    there's the somewhat hacky 'x' entry: this means that explicit and
    //    implicit array lookups will have different full arrayIndices paths. (That
    //    code only requires that different paths have different arrayIndices; it
    //    doesn't actually 'parse' arrayIndices. As an alternative, arrayIndices
    //    could contain objects with flags like 'implicit', but I think that only
    //    makes the code surrounding them more complex.)
    //
    //    (By the way, this field ends up getting passed around a lot without
    //    cloning, so never mutate any arrayIndices field/var in this package!)
    //
    //
    // At the top level, you may only pass in a plain object or array.
    //
    // See the test 'minimongo - lookup' for some examples of what lookup functions
    // return.
    function makeLookupFunction(key) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      const parts = key.split('.');
      const firstPart = parts.length ? parts[0] : '';
      const lookupRest = parts.length > 1 && makeLookupFunction(parts.slice(1).join('.'), options);
      function buildResult(arrayIndices, dontIterate, value) {
        return arrayIndices && arrayIndices.length ? dontIterate ? [{
          arrayIndices,
          dontIterate,
          value
        }] : [{
          arrayIndices,
          value
        }] : dontIterate ? [{
          dontIterate,
          value
        }] : [{
          value
        }];
      }

      // Doc will always be a plain object or an array.
      // apply an explicit numeric index, an array.
      return (doc, arrayIndices) => {
        if (Array.isArray(doc)) {
          // If we're being asked to do an invalid lookup into an array (non-integer
          // or out-of-bounds), return no results (which is different from returning
          // a single undefined result, in that `null` equality checks won't match).
          if (!(isNumericKey(firstPart) && firstPart < doc.length)) {
            return [];
          }

          // Remember that we used this array index. Include an 'x' to indicate that
          // the previous index came from being considered as an explicit array
          // index (not branching).
          arrayIndices = arrayIndices ? arrayIndices.concat(+firstPart, 'x') : [+firstPart, 'x'];
        }

        // Do our first lookup.
        const firstLevel = doc[firstPart];

        // If there is no deeper to dig, return what we found.
        //
        // If what we found is an array, most value selectors will choose to treat
        // the elements of the array as matchable values in their own right, but
        // that's done outside of the lookup function. (Exceptions to this are $size
        // and stuff relating to $elemMatch.  eg, {a: {$size: 2}} does not match {a:
        // [[1, 2]]}.)
        //
        // That said, if we just did an *explicit* array lookup (on doc) to find
        // firstLevel, and firstLevel is an array too, we do NOT want value
        // selectors to iterate over it.  eg, {'a.0': 5} does not match {a: [[5]]}.
        // So in that case, we mark the return value as 'don't iterate'.
        if (!lookupRest) {
          return buildResult(arrayIndices, Array.isArray(doc) && Array.isArray(firstLevel), firstLevel);
        }

        // We need to dig deeper.  But if we can't, because what we've found is not
        // an array or plain object, we're done. If we just did a numeric index into
        // an array, we return nothing here (this is a change in Mongo 2.5 from
        // Mongo 2.4, where {'a.0.b': null} stopped matching {a: [5]}). Otherwise,
        // return a single `undefined` (which can, for example, match via equality
        // with `null`).
        if (!isIndexable(firstLevel)) {
          if (Array.isArray(doc)) {
            return [];
          }
          return buildResult(arrayIndices, false, undefined);
        }
        const result = [];
        const appendToResult = more => {
          result.push(...more);
        };

        // Dig deeper: look up the rest of the parts on whatever we've found.
        // (lookupRest is smart enough to not try to do invalid lookups into
        // firstLevel if it's an array.)
        appendToResult(lookupRest(firstLevel, arrayIndices));

        // If we found an array, then in *addition* to potentially treating the next
        // part as a literal integer lookup, we should also 'branch': try to look up
        // the rest of the parts on each array element in parallel.
        //
        // In this case, we *only* dig deeper into array elements that are plain
        // objects. (Recall that we only got this far if we have further to dig.)
        // This makes sense: we certainly don't dig deeper into non-indexable
        // objects. And it would be weird to dig into an array: it's simpler to have
        // a rule that explicit integer indexes only apply to an outer array, not to
        // an array you find after a branching search.
        //
        // In the special case of a numeric part in a *sort selector* (not a query
        // selector), we skip the branching: we ONLY allow the numeric part to mean
        // 'look up this index' in that case, not 'also look up this index in all
        // the elements of the array'.
        if (Array.isArray(firstLevel) && !(isNumericKey(parts[1]) && options.forSort)) {
          firstLevel.forEach((branch, arrayIndex) => {
            if (LocalCollection._isPlainObject(branch)) {
              appendToResult(lookupRest(branch, arrayIndices ? arrayIndices.concat(arrayIndex) : [arrayIndex]));
            }
          });
        }
        return result;
      };
    }
    // Object exported only for unit testing.
    // Use it to export private functions to test in Tinytest.
    MinimongoTest = {
      makeLookupFunction
    };
    MinimongoError = function (message) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (typeof message === 'string' && options.field) {
        message += " for field '".concat(options.field, "'");
      }
      const error = new Error(message);
      error.name = 'MinimongoError';
      return error;
    };
    function nothingMatcher(docOrBranchedValues) {
      return {
        result: false
      };
    }
    // Takes an operator object (an object with $ keys) and returns a branched
    // matcher for it.
    function operatorBranchedMatcher(valueSelector, matcher, isRoot) {
      // Each valueSelector works separately on the various branches.  So one
      // operator can match one branch and another can match another branch.  This
      // is OK.
      const operatorMatchers = Object.keys(valueSelector).map(operator => {
        const operand = valueSelector[operator];
        const simpleRange = ['$lt', '$lte', '$gt', '$gte'].includes(operator) && typeof operand === 'number';
        const simpleEquality = ['$ne', '$eq'].includes(operator) && operand !== Object(operand);
        const simpleInclusion = ['$in', '$nin'].includes(operator) && Array.isArray(operand) && !operand.some(x => x === Object(x));
        if (!(simpleRange || simpleInclusion || simpleEquality)) {
          matcher._isSimple = false;
        }
        if (hasOwn.call(VALUE_OPERATORS, operator)) {
          return VALUE_OPERATORS[operator](operand, valueSelector, matcher, isRoot);
        }
        if (hasOwn.call(ELEMENT_OPERATORS, operator)) {
          const options = ELEMENT_OPERATORS[operator];
          return convertElementMatcherToBranchedMatcher(options.compileElementSelector(operand, valueSelector, matcher), options);
        }
        throw new MiniMongoQueryError("Unrecognized operator: ".concat(operator));
      });
      return andBranchedMatchers(operatorMatchers);
    }

    // paths - Array: list of mongo style paths
    // newLeafFn - Function: of form function(path) should return a scalar value to
    //                       put into list created for that path
    // conflictFn - Function: of form function(node, path, fullPath) is called
    //                        when building a tree path for 'fullPath' node on
    //                        'path' was already a leaf with a value. Must return a
    //                        conflict resolution.
    // initial tree - Optional Object: starting tree.
    // @returns - Object: tree represented as a set of nested objects
    function pathsToTree(paths, newLeafFn, conflictFn) {
      let root = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      paths.forEach(path => {
        const pathArray = path.split('.');
        let tree = root;

        // use .every just for iteration with break
        const success = pathArray.slice(0, -1).every((key, i) => {
          if (!hasOwn.call(tree, key)) {
            tree[key] = {};
          } else if (tree[key] !== Object(tree[key])) {
            tree[key] = conflictFn(tree[key], pathArray.slice(0, i + 1).join('.'), path);

            // break out of loop if we are failing for this path
            if (tree[key] !== Object(tree[key])) {
              return false;
            }
          }
          tree = tree[key];
          return true;
        });
        if (success) {
          const lastKey = pathArray[pathArray.length - 1];
          if (hasOwn.call(tree, lastKey)) {
            tree[lastKey] = conflictFn(tree[lastKey], path, path);
          } else {
            tree[lastKey] = newLeafFn(path);
          }
        }
      });
      return root;
    }
    // Makes sure we get 2 elements array and assume the first one to be x and
    // the second one to y no matter what user passes.
    // In case user passes { lon: x, lat: y } returns [x, y]
    function pointToArray(point) {
      return Array.isArray(point) ? point.slice() : [point.x, point.y];
    }

    // Creating a document from an upsert is quite tricky.
    // E.g. this selector: {"$or": [{"b.foo": {"$all": ["bar"]}}]}, should result
    // in: {"b.foo": "bar"}
    // But this selector: {"$or": [{"b": {"foo": {"$all": ["bar"]}}}]} should throw
    // an error

    // Some rules (found mainly with trial & error, so there might be more):
    // - handle all childs of $and (or implicit $and)
    // - handle $or nodes with exactly 1 child
    // - ignore $or nodes with more than 1 child
    // - ignore $nor and $not nodes
    // - throw when a value can not be set unambiguously
    // - every value for $all should be dealt with as separate $eq-s
    // - threat all children of $all as $eq setters (=> set if $all.length === 1,
    //   otherwise throw error)
    // - you can not mix '$'-prefixed keys and non-'$'-prefixed keys
    // - you can only have dotted keys on a root-level
    // - you can not have '$'-prefixed keys more than one-level deep in an object

    // Handles one key/value pair to put in the selector document
    function populateDocumentWithKeyValue(document, key, value) {
      if (value && Object.getPrototypeOf(value) === Object.prototype) {
        populateDocumentWithObject(document, key, value);
      } else if (!(value instanceof RegExp)) {
        insertIntoDocument(document, key, value);
      }
    }

    // Handles a key, value pair to put in the selector document
    // if the value is an object
    function populateDocumentWithObject(document, key, value) {
      const keys = Object.keys(value);
      const unprefixedKeys = keys.filter(op => op[0] !== '$');
      if (unprefixedKeys.length > 0 || !keys.length) {
        // Literal (possibly empty) object ( or empty object )
        // Don't allow mixing '$'-prefixed with non-'$'-prefixed fields
        if (keys.length !== unprefixedKeys.length) {
          throw new MiniMongoQueryError("unknown operator: ".concat(unprefixedKeys[0]));
        }
        validateObject(value, key);
        insertIntoDocument(document, key, value);
      } else {
        Object.keys(value).forEach(op => {
          const object = value[op];
          if (op === '$eq') {
            populateDocumentWithKeyValue(document, key, object);
          } else if (op === '$all') {
            // every value for $all should be dealt with as separate $eq-s
            object.forEach(element => populateDocumentWithKeyValue(document, key, element));
          }
        });
      }
    }

    // Fills a document with certain fields from an upsert selector
    function populateDocumentWithQueryFields(query) {
      let document = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (Object.getPrototypeOf(query) === Object.prototype) {
        // handle implicit $and
        Object.keys(query).forEach(key => {
          const value = query[key];
          if (key === '$and') {
            // handle explicit $and
            value.forEach(element => populateDocumentWithQueryFields(element, document));
          } else if (key === '$or') {
            // handle $or nodes with exactly 1 child
            if (value.length === 1) {
              populateDocumentWithQueryFields(value[0], document);
            }
          } else if (key[0] !== '$') {
            // Ignore other '$'-prefixed logical selectors
            populateDocumentWithKeyValue(document, key, value);
          }
        });
      } else {
        // Handle meteor-specific shortcut for selecting _id
        if (LocalCollection._selectorIsId(query)) {
          insertIntoDocument(document, '_id', query);
        }
      }
      return document;
    }
    function projectionDetails(fields) {
      // Find the non-_id keys (_id is handled specially because it is included
      // unless explicitly excluded). Sort the keys, so that our code to detect
      // overlaps like 'foo' and 'foo.bar' can assume that 'foo' comes first.
      let fieldsKeys = Object.keys(fields).sort();

      // If _id is the only field in the projection, do not remove it, since it is
      // required to determine if this is an exclusion or exclusion. Also keep an
      // inclusive _id, since inclusive _id follows the normal rules about mixing
      // inclusive and exclusive fields. If _id is not the only field in the
      // projection and is exclusive, remove it so it can be handled later by a
      // special case, since exclusive _id is always allowed.
      if (!(fieldsKeys.length === 1 && fieldsKeys[0] === '_id') && !(fieldsKeys.includes('_id') && fields._id)) {
        fieldsKeys = fieldsKeys.filter(key => key !== '_id');
      }
      let including = null; // Unknown

      fieldsKeys.forEach(keyPath => {
        const rule = !!fields[keyPath];
        if (including === null) {
          including = rule;
        }

        // This error message is copied from MongoDB shell
        if (including !== rule) {
          throw MinimongoError('You cannot currently mix including and excluding fields.');
        }
      });
      const projectionRulesTree = pathsToTree(fieldsKeys, path => including, (node, path, fullPath) => {
        // Check passed projection fields' keys: If you have two rules such as
        // 'foo.bar' and 'foo.bar.baz', then the result becomes ambiguous. If
        // that happens, there is a probability you are doing something wrong,
        // framework should notify you about such mistake earlier on cursor
        // compilation step than later during runtime.  Note, that real mongo
        // doesn't do anything about it and the later rule appears in projection
        // project, more priority it takes.
        //
        // Example, assume following in mongo shell:
        // > db.coll.insert({ a: { b: 23, c: 44 } })
        // > db.coll.find({}, { 'a': 1, 'a.b': 1 })
        // {"_id": ObjectId("520bfe456024608e8ef24af3"), "a": {"b": 23}}
        // > db.coll.find({}, { 'a.b': 1, 'a': 1 })
        // {"_id": ObjectId("520bfe456024608e8ef24af3"), "a": {"b": 23, "c": 44}}
        //
        // Note, how second time the return set of keys is different.
        const currentPath = fullPath;
        const anotherPath = path;
        throw MinimongoError("both ".concat(currentPath, " and ").concat(anotherPath, " found in fields option, ") + 'using both of them may trigger unexpected behavior. Did you mean to ' + 'use only one of them?');
      });
      return {
        including,
        tree: projectionRulesTree
      };
    }
    function regexpElementMatcher(regexp) {
      return value => {
        if (value instanceof RegExp) {
          return value.toString() === regexp.toString();
        }

        // Regexps only work against strings.
        if (typeof value !== 'string') {
          return false;
        }

        // Reset regexp's state to avoid inconsistent matching for objects with the
        // same value on consecutive calls of regexp.test. This happens only if the
        // regexp has the 'g' flag. Also note that ES6 introduces a new flag 'y' for
        // which we should *not* change the lastIndex but MongoDB doesn't support
        // either of these flags.
        regexp.lastIndex = 0;
        return regexp.test(value);
      };
    }
    // Validates the key in a path.
    // Objects that are nested more then 1 level cannot have dotted fields
    // or fields starting with '$'
    function validateKeyInPath(key, path) {
      if (key.includes('.')) {
        throw new Error("The dotted field '".concat(key, "' in '").concat(path, ".").concat(key, " is not valid for storage."));
      }
      if (key[0] === '$') {
        throw new Error("The dollar ($) prefixed field  '".concat(path, ".").concat(key, " is not valid for storage."));
      }
    }

    // Recursively validates an object that is nested more than one level deep
    function validateObject(object, path) {
      if (object && Object.getPrototypeOf(object) === Object.prototype) {
        Object.keys(object).forEach(key => {
          validateKeyInPath(key, path);
          validateObject(object[key], path + '.' + key);
        });
      }
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"constants.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/minimongo/constants.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  getAsyncMethodName: () => getAsyncMethodName,
  ASYNC_COLLECTION_METHODS: () => ASYNC_COLLECTION_METHODS,
  ASYNC_CURSOR_METHODS: () => ASYNC_CURSOR_METHODS,
  CLIENT_ONLY_METHODS: () => CLIENT_ONLY_METHODS
});
function getAsyncMethodName(method) {
  return "".concat(method.replace('_', ''), "Async");
}
const ASYNC_COLLECTION_METHODS = ['_createCappedCollection', 'dropCollection', 'dropIndex',
/**
 * @summary Creates the specified index on the collection.
 * @locus server
 * @method createIndexAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
 * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
 * @param {String} options.name Name of the index
 * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
 * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
 * @returns {Promise}
 */
'createIndex',
/**
 * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
 * @locus Anywhere
 * @method findOneAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} [selector] A query describing the documents to find
 * @param {Object} [options]
 * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
 * @param {Number} options.skip Number of results to skip at the beginning
 * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
 * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity
 * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
 * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for fetching the document. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
 * @returns {Promise}
 */
'findOne',
/**
 * @summary Insert a document in the collection.  Returns its unique _id.
 * @locus Anywhere
 * @method  insertAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
 * @return {Promise}
 */
'insert',
/**
 * @summary Remove documents from the collection
 * @locus Anywhere
 * @method removeAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} selector Specifies which documents to remove
 * @return {Promise}
 */
'remove',
/**
 * @summary Modify one or more documents in the collection. Returns the number of matched documents.
 * @locus Anywhere
 * @method updateAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} selector Specifies which documents to modify
 * @param {MongoModifier} modifier Specifies how to modify the documents
 * @param {Object} [options]
 * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
 * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
 * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
 * @return {Promise}
 */
'update',
/**
 * @summary Modify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
 * @locus Anywhere
 * @method upsertAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} selector Specifies which documents to modify
 * @param {MongoModifier} modifier Specifies how to modify the documents
 * @param {Object} [options]
 * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
 * @return {Promise}
 */
'upsert'];
const ASYNC_CURSOR_METHODS = [
/**
 * @deprecated in 2.9
 * @summary Returns the number of documents that match a query. This method is
 *          [deprecated since MongoDB 4.0](https://www.mongodb.com/docs/v4.4/reference/command/count/);
 *          see `Collection.countDocuments` and
 *          `Collection.estimatedDocumentCount` for a replacement.
 * @memberOf Mongo.Cursor
 * @method  countAsync
 * @instance
 * @locus Anywhere
 * @returns {Promise}
 */
'count',
/**
 * @summary Return all matching documents as an Array.
 * @memberOf Mongo.Cursor
 * @method  fetchAsync
 * @instance
 * @locus Anywhere
 * @returns {Promise}
 */
'fetch',
/**
 * @summary Call `callback` once for each matching document, sequentially and
 *          synchronously.
 * @locus Anywhere
 * @method  forEachAsync
 * @instance
 * @memberOf Mongo.Cursor
 * @param {IterationCallback} callback Function to call. It will be called
 *                                     with three arguments: the document, a
 *                                     0-based index, and <em>cursor</em>
 *                                     itself.
 * @param {Any} [thisArg] An object which will be the value of `this` inside
 *                        `callback`.
 * @returns {Promise}
 */
'forEach',
/**
 * @summary Map callback over all matching documents.  Returns an Array.
 * @locus Anywhere
 * @method mapAsync
 * @instance
 * @memberOf Mongo.Cursor
 * @param {IterationCallback} callback Function to call. It will be called
 *                                     with three arguments: the document, a
 *                                     0-based index, and <em>cursor</em>
 *                                     itself.
 * @param {Any} [thisArg] An object which will be the value of `this` inside
 *                        `callback`.
 * @returns {Promise}
 */
'map'];
const CLIENT_ONLY_METHODS = ["findOne", "insert", "remove", "update", "upsert"];
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"cursor.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/minimongo/cursor.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      default: () => Cursor
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    let hasOwn;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      }
    }, 1);
    let ASYNC_CURSOR_METHODS, getAsyncMethodName;
    module.link("./constants", {
      ASYNC_CURSOR_METHODS(v) {
        ASYNC_CURSOR_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class Cursor {
      // don't call this ctor directly.  use LocalCollection.find().
      constructor(collection, selector) {
        let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        this.collection = collection;
        this.sorter = null;
        this.matcher = new Minimongo.Matcher(selector);
        if (LocalCollection._selectorIsIdPerhapsAsObject(selector)) {
          // stash for fast _id and { _id }
          this._selectorId = hasOwn.call(selector, '_id') ? selector._id : selector;
        } else {
          this._selectorId = undefined;
          if (this.matcher.hasGeoQuery() || options.sort) {
            this.sorter = new Minimongo.Sorter(options.sort || []);
          }
        }
        this.skip = options.skip || 0;
        this.limit = options.limit;
        this.fields = options.projection || options.fields;
        this._projectionFn = LocalCollection._compileProjection(this.fields || {});
        this._transform = LocalCollection.wrapTransform(options.transform);

        // by default, queries register w/ Tracker when it is available.
        if (typeof Tracker !== 'undefined') {
          this.reactive = options.reactive === undefined ? true : options.reactive;
        }
      }

      /**
       * @deprecated in 2.9
       * @summary Returns the number of documents that match a query. This method is
       *          [deprecated since MongoDB 4.0](https://www.mongodb.com/docs/v4.4/reference/command/count/);
       *          see `Collection.countDocuments` and
       *          `Collection.estimatedDocumentCount` for a replacement.
       * @memberOf Mongo.Cursor
       * @method  count
       * @instance
       * @locus Anywhere
       * @returns {Number}
       */
      count() {
        if (this.reactive) {
          // allow the observe to be unordered
          this._depend({
            added: true,
            removed: true
          }, true);
        }
        return this._getRawObjects({
          ordered: true
        }).length;
      }

      /**
       * @summary Return all matching documents as an Array.
       * @memberOf Mongo.Cursor
       * @method  fetch
       * @instance
       * @locus Anywhere
       * @returns {Object[]}
       */
      fetch() {
        const result = [];
        this.forEach(doc => {
          result.push(doc);
        });
        return result;
      }
      [Symbol.iterator]() {
        if (this.reactive) {
          this._depend({
            addedBefore: true,
            removed: true,
            changed: true,
            movedBefore: true
          });
        }
        let index = 0;
        const objects = this._getRawObjects({
          ordered: true
        });
        return {
          next: () => {
            if (index < objects.length) {
              // This doubles as a clone operation.
              let element = this._projectionFn(objects[index++]);
              if (this._transform) element = this._transform(element);
              return {
                value: element
              };
            }
            return {
              done: true
            };
          }
        };
      }
      [Symbol.asyncIterator]() {
        const syncResult = this[Symbol.iterator]();
        return {
          async next() {
            return Promise.resolve(syncResult.next());
          }
        };
      }

      /**
       * @callback IterationCallback
       * @param {Object} doc
       * @param {Number} index
       */
      /**
       * @summary Call `callback` once for each matching document, sequentially and
       *          synchronously.
       * @locus Anywhere
       * @method  forEach
       * @instance
       * @memberOf Mongo.Cursor
       * @param {IterationCallback} callback Function to call. It will be called
       *                                     with three arguments: the document, a
       *                                     0-based index, and <em>cursor</em>
       *                                     itself.
       * @param {Any} [thisArg] An object which will be the value of `this` inside
       *                        `callback`.
       */
      forEach(callback, thisArg) {
        if (this.reactive) {
          this._depend({
            addedBefore: true,
            removed: true,
            changed: true,
            movedBefore: true
          });
        }
        this._getRawObjects({
          ordered: true
        }).forEach((element, i) => {
          // This doubles as a clone operation.
          element = this._projectionFn(element);
          if (this._transform) {
            element = this._transform(element);
          }
          callback.call(thisArg, element, i, this);
        });
      }
      getTransform() {
        return this._transform;
      }

      /**
       * @summary Map callback over all matching documents.  Returns an Array.
       * @locus Anywhere
       * @method map
       * @instance
       * @memberOf Mongo.Cursor
       * @param {IterationCallback} callback Function to call. It will be called
       *                                     with three arguments: the document, a
       *                                     0-based index, and <em>cursor</em>
       *                                     itself.
       * @param {Any} [thisArg] An object which will be the value of `this` inside
       *                        `callback`.
       */
      map(callback, thisArg) {
        const result = [];
        this.forEach((doc, i) => {
          result.push(callback.call(thisArg, doc, i, this));
        });
        return result;
      }

      // options to contain:
      //  * callbacks for observe():
      //    - addedAt (document, atIndex)
      //    - added (document)
      //    - changedAt (newDocument, oldDocument, atIndex)
      //    - changed (newDocument, oldDocument)
      //    - removedAt (document, atIndex)
      //    - removed (document)
      //    - movedTo (document, oldIndex, newIndex)
      //
      // attributes available on returned query handle:
      //  * stop(): end updates
      //  * collection: the collection this query is querying
      //
      // iff x is a returned query handle, (x instanceof
      // LocalCollection.ObserveHandle) is true
      //
      // initial results delivered through added callback
      // XXX maybe callbacks should take a list of objects, to expose transactions?
      // XXX maybe support field limiting (to limit what you're notified on)

      /**
       * @summary Watch a query.  Receive callbacks as the result set changes.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       * @param {Object} callbacks Functions to call to deliver the result set as it
       *                           changes
       */
      observe(options) {
        return LocalCollection._observeFromObserveChanges(this, options);
      }

      /**
       * @summary Watch a query.  Receive callbacks as the result set changes.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       */
      observeAsync(options) {
        return new Promise(resolve => resolve(this.observe(options)));
      }

      /**
       * @summary Watch a query. Receive callbacks as the result set changes. Only
       *          the differences between the old and new documents are passed to
       *          the callbacks.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       * @param {Object} callbacks Functions to call to deliver the result set as it
       *                           changes
       */
      observeChanges(options) {
        const ordered = LocalCollection._observeChangesCallbacksAreOrdered(options);

        // there are several places that assume you aren't combining skip/limit with
        // unordered observe.  eg, update's EJSON.clone, and the "there are several"
        // comment in _modifyAndNotify
        // XXX allow skip/limit with unordered observe
        if (!options._allow_unordered && !ordered && (this.skip || this.limit)) {
          throw new Error("Must use an ordered observe with skip or limit (i.e. 'addedBefore' " + "for observeChanges or 'addedAt' for observe, instead of 'added').");
        }
        if (this.fields && (this.fields._id === 0 || this.fields._id === false)) {
          throw Error("You may not observe a cursor with {fields: {_id: 0}}");
        }
        const distances = this.matcher.hasGeoQuery() && ordered && new LocalCollection._IdMap();
        const query = {
          cursor: this,
          dirty: false,
          distances,
          matcher: this.matcher,
          // not fast pathed
          ordered,
          projectionFn: this._projectionFn,
          resultsSnapshot: null,
          sorter: ordered && this.sorter
        };
        let qid;

        // Non-reactive queries call added[Before] and then never call anything
        // else.
        if (this.reactive) {
          qid = this.collection.next_qid++;
          this.collection.queries[qid] = query;
        }
        query.results = this._getRawObjects({
          ordered,
          distances: query.distances
        });
        if (this.collection.paused) {
          query.resultsSnapshot = ordered ? [] : new LocalCollection._IdMap();
        }

        // wrap callbacks we were passed. callbacks only fire when not paused and
        // are never undefined
        // Filters out blacklisted fields according to cursor's projection.
        // XXX wrong place for this?

        // furthermore, callbacks enqueue until the operation we're working on is
        // done.
        const wrapCallback = fn => {
          if (!fn) {
            return () => {};
          }
          const self = this;
          return function /* args*/
          () {
            if (self.collection.paused) {
              return;
            }
            const args = arguments;
            self.collection._observeQueue.queueTask(() => {
              fn.apply(this, args);
            });
          };
        };
        query.added = wrapCallback(options.added);
        query.changed = wrapCallback(options.changed);
        query.removed = wrapCallback(options.removed);
        if (ordered) {
          query.addedBefore = wrapCallback(options.addedBefore);
          query.movedBefore = wrapCallback(options.movedBefore);
        }
        if (!options._suppress_initial && !this.collection.paused) {
          var _query$results, _query$results$size;
          const handler = doc => {
            const fields = EJSON.clone(doc);
            delete fields._id;
            if (ordered) {
              query.addedBefore(doc._id, this._projectionFn(fields), null);
            }
            query.added(doc._id, this._projectionFn(fields));
          };
          // it means it's just an array
          if (query.results.length) {
            for (const doc of query.results) {
              handler(doc);
            }
          }
          // it means it's an id map
          if ((_query$results = query.results) !== null && _query$results !== void 0 && (_query$results$size = _query$results.size) !== null && _query$results$size !== void 0 && _query$results$size.call(_query$results)) {
            query.results.forEach(handler);
          }
        }
        const handle = Object.assign(new LocalCollection.ObserveHandle(), {
          collection: this.collection,
          stop: () => {
            if (this.reactive) {
              delete this.collection.queries[qid];
            }
          },
          isReady: false,
          isReadyPromise: null
        });
        if (this.reactive && Tracker.active) {
          // XXX in many cases, the same observe will be recreated when
          // the current autorun is rerun.  we could save work by
          // letting it linger across rerun and potentially get
          // repurposed if the same observe is performed, using logic
          // similar to that of Meteor.subscribe.
          Tracker.onInvalidate(() => {
            handle.stop();
          });
        }

        // run the observe callbacks resulting from the initial contents
        // before we leave the observe.
        const drainResult = this.collection._observeQueue.drain();
        if (drainResult instanceof Promise) {
          handle.isReadyPromise = drainResult;
          drainResult.then(() => handle.isReady = true);
        } else {
          handle.isReady = true;
          handle.isReadyPromise = Promise.resolve();
        }
        return handle;
      }

      /**
       * @summary Watch a query. Receive callbacks as the result set changes. Only
       *          the differences between the old and new documents are passed to
       *          the callbacks.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       * @param {Object} callbacks Functions to call to deliver the result set as it
       *                           changes
       */
      observeChangesAsync(options) {
        return new Promise(resolve => {
          const handle = this.observeChanges(options);
          handle.isReadyPromise.then(() => resolve(handle));
        });
      }

      // XXX Maybe we need a version of observe that just calls a callback if
      // anything changed.
      _depend(changers, _allow_unordered) {
        if (Tracker.active) {
          const dependency = new Tracker.Dependency();
          const notify = dependency.changed.bind(dependency);
          dependency.depend();
          const options = {
            _allow_unordered,
            _suppress_initial: true
          };
          ['added', 'addedBefore', 'changed', 'movedBefore', 'removed'].forEach(fn => {
            if (changers[fn]) {
              options[fn] = notify;
            }
          });

          // observeChanges will stop() when this computation is invalidated
          this.observeChanges(options);
        }
      }
      _getCollectionName() {
        return this.collection.name;
      }

      // Returns a collection of matching objects, but doesn't deep copy them.
      //
      // If ordered is set, returns a sorted array, respecting sorter, skip, and
      // limit properties of the query provided that options.applySkipLimit is
      // not set to false (#1201). If sorter is falsey, no sort -- you get the
      // natural order.
      //
      // If ordered is not set, returns an object mapping from ID to doc (sorter,
      // skip and limit should not be set).
      //
      // If ordered is set and this cursor is a $near geoquery, then this function
      // will use an _IdMap to track each distance from the $near argument point in
      // order to use it as a sort key. If an _IdMap is passed in the 'distances'
      // argument, this function will clear it and use it for this purpose
      // (otherwise it will just create its own _IdMap). The observeChanges
      // implementation uses this to remember the distances after this function
      // returns.
      _getRawObjects() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        // By default this method will respect skip and limit because .fetch(),
        // .forEach() etc... expect this behaviour. It can be forced to ignore
        // skip and limit by setting applySkipLimit to false (.count() does this,
        // for example)
        const applySkipLimit = options.applySkipLimit !== false;

        // XXX use OrderedDict instead of array, and make IdMap and OrderedDict
        // compatible
        const results = options.ordered ? [] : new LocalCollection._IdMap();

        // fast path for single ID value
        if (this._selectorId !== undefined) {
          // If you have non-zero skip and ask for a single id, you get nothing.
          // This is so it matches the behavior of the '{_id: foo}' path.
          if (applySkipLimit && this.skip) {
            return results;
          }
          const selectedDoc = this.collection._docs.get(this._selectorId);
          if (selectedDoc) {
            if (options.ordered) {
              results.push(selectedDoc);
            } else {
              results.set(this._selectorId, selectedDoc);
            }
          }
          return results;
        }

        // slow path for arbitrary selector, sort, skip, limit

        // in the observeChanges case, distances is actually part of the "query"
        // (ie, live results set) object.  in other cases, distances is only used
        // inside this function.
        let distances;
        if (this.matcher.hasGeoQuery() && options.ordered) {
          if (options.distances) {
            distances = options.distances;
            distances.clear();
          } else {
            distances = new LocalCollection._IdMap();
          }
        }
        Meteor._runFresh(() => {
          this.collection._docs.forEach((doc, id) => {
            const matchResult = this.matcher.documentMatches(doc);
            if (matchResult.result) {
              if (options.ordered) {
                results.push(doc);
                if (distances && matchResult.distance !== undefined) {
                  distances.set(id, matchResult.distance);
                }
              } else {
                results.set(id, doc);
              }
            }

            // Override to ensure all docs are matched if ignoring skip & limit
            if (!applySkipLimit) {
              return true;
            }

            // Fast path for limited unsorted queries.
            // XXX 'length' check here seems wrong for ordered
            return !this.limit || this.skip || this.sorter || results.length !== this.limit;
          });
        });
        if (!options.ordered) {
          return results;
        }
        if (this.sorter) {
          results.sort(this.sorter.getComparator({
            distances
          }));
        }

        // Return the full set of results if there is no skip or limit or if we're
        // ignoring them
        if (!applySkipLimit || !this.limit && !this.skip) {
          return results;
        }
        return results.slice(this.skip, this.limit ? this.limit + this.skip : results.length);
      }
      _publishCursor(subscription) {
        // XXX minimongo should not depend on mongo-livedata!
        if (!Package.mongo) {
          throw new Error("Can't publish from Minimongo without the `mongo` package.");
        }
        if (!this.collection.name) {
          throw new Error("Can't publish a cursor from a collection without a name.");
        }
        return Package.mongo.Mongo.Collection._publishCursor(this, subscription, this.collection.name);
      }
    }
    // Implements async version of cursor methods to keep collections isomorphic
    ASYNC_CURSOR_METHODS.forEach(method => {
      const asyncName = getAsyncMethodName(method);
      Cursor.prototype[asyncName] = function () {
        try {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          return Promise.resolve(this[method].apply(this, args));
        } catch (error) {
          return Promise.reject(error);
        }
      };
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"local_collection.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/minimongo/local_collection.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    module.export({
      default: () => LocalCollection
    });
    let Cursor;
    module.link("./cursor.js", {
      default(v) {
        Cursor = v;
      }
    }, 0);
    let ObserveHandle;
    module.link("./observe_handle.js", {
      default(v) {
        ObserveHandle = v;
      }
    }, 1);
    let hasOwn, isIndexable, isNumericKey, isOperatorObject, populateDocumentWithQueryFields, projectionDetails;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      isIndexable(v) {
        isIndexable = v;
      },
      isNumericKey(v) {
        isNumericKey = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      populateDocumentWithQueryFields(v) {
        populateDocumentWithQueryFields = v;
      },
      projectionDetails(v) {
        projectionDetails = v;
      }
    }, 2);
    let getAsyncMethodName;
    module.link("./constants", {
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class LocalCollection {
      constructor(name) {
        this.name = name;
        // _id -> document (also containing id)
        this._docs = new LocalCollection._IdMap();
        this._observeQueue = Meteor.isClient ? new Meteor._SynchronousQueue() : new Meteor._AsynchronousQueue();
        this.next_qid = 1; // live query id generator

        // qid -> live query object. keys:
        //  ordered: bool. ordered queries have addedBefore/movedBefore callbacks.
        //  results: array (ordered) or object (unordered) of current results
        //    (aliased with this._docs!)
        //  resultsSnapshot: snapshot of results. null if not paused.
        //  cursor: Cursor object for the query.
        //  selector, sorter, (callbacks): functions
        this.queries = Object.create(null);

        // null if not saving originals; an IdMap from id to original document value
        // if saving originals. See comments before saveOriginals().
        this._savedOriginals = null;

        // True when observers are paused and we should not send callbacks.
        this.paused = false;
      }
      countDocuments(selector, options) {
        return this.find(selector !== null && selector !== void 0 ? selector : {}, options).countAsync();
      }
      estimatedDocumentCount(options) {
        return this.find({}, options).countAsync();
      }

      // options may include sort, skip, limit, reactive
      // sort may be any of these forms:
      //     {a: 1, b: -1}
      //     [["a", "asc"], ["b", "desc"]]
      //     ["a", ["b", "desc"]]
      //   (in the first form you're beholden to key enumeration order in
      //   your javascript VM)
      //
      // reactive: if given, and false, don't register with Tracker (default
      // is true)
      //
      // XXX possibly should support retrieving a subset of fields? and
      // have it be a hint (ignored on the client, when not copying the
      // doc?)
      //
      // XXX sort does not yet support subkeys ('a.b') .. fix that!
      // XXX add one more sort form: "key"
      // XXX tests
      find(selector, options) {
        // default syntax for everything is to omit the selector argument.
        // but if selector is explicitly passed in as false or undefined, we
        // want a selector that matches nothing.
        if (arguments.length === 0) {
          selector = {};
        }
        return new LocalCollection.Cursor(this, selector, options);
      }
      findOne(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (arguments.length === 0) {
          selector = {};
        }

        // NOTE: by setting limit 1 here, we end up using very inefficient
        // code that recomputes the whole query on each update. The upside is
        // that when you reactively depend on a findOne you only get
        // invalidated when the found object changes, not any object in the
        // collection. Most findOne will be by id, which has a fast path, so
        // this might not be a big deal. In most cases, invalidation causes
        // the called to re-query anyway, so this should be a net performance
        // improvement.
        options.limit = 1;
        return this.find(selector, options).fetch()[0];
      }
      async findOneAsync(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (arguments.length === 0) {
          selector = {};
        }
        options.limit = 1;
        return (await this.find(selector, options).fetchAsync())[0];
      }
      prepareInsert(doc) {
        assertHasValidFieldNames(doc);

        // if you really want to use ObjectIDs, set this global.
        // Mongo.Collection specifies its own ids and does not use this code.
        if (!hasOwn.call(doc, '_id')) {
          doc._id = LocalCollection._useOID ? new MongoID.ObjectID() : Random.id();
        }
        const id = doc._id;
        if (this._docs.has(id)) {
          throw MinimongoError("Duplicate _id '".concat(id, "'"));
        }
        this._saveOriginal(id, undefined);
        this._docs.set(id, doc);
        return id;
      }

      // XXX possibly enforce that 'undefined' does not appear (we assume
      // this in our handling of null and $exists)
      insert(doc, callback) {
        doc = EJSON.clone(doc);
        const id = this.prepareInsert(doc);
        const queriesToRecompute = [];

        // trigger live queries that match
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const matchResult = query.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (query.distances && matchResult.distance !== undefined) {
              query.distances.set(id, matchResult.distance);
            }
            if (query.cursor.skip || query.cursor.limit) {
              queriesToRecompute.push(qid);
            } else {
              LocalCollection._insertInResultsSync(query, doc);
            }
          }
        }
        queriesToRecompute.forEach(qid => {
          if (this.queries[qid]) {
            this._recomputeResults(this.queries[qid]);
          }
        });
        this._observeQueue.drain();
        if (callback) {
          Meteor.defer(() => {
            callback(null, id);
          });
        }
        return id;
      }
      async insertAsync(doc, callback) {
        doc = EJSON.clone(doc);
        const id = this.prepareInsert(doc);
        const queriesToRecompute = [];

        // trigger live queries that match
        for (const qid in this.queries) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const matchResult = query.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (query.distances && matchResult.distance !== undefined) {
              query.distances.set(id, matchResult.distance);
            }
            if (query.cursor.skip || query.cursor.limit) {
              queriesToRecompute.push(qid);
            } else {
              await LocalCollection._insertInResultsAsync(query, doc);
            }
          }
        }
        queriesToRecompute.forEach(qid => {
          if (this.queries[qid]) {
            this._recomputeResults(this.queries[qid]);
          }
        });
        await this._observeQueue.drain();
        if (callback) {
          Meteor.defer(() => {
            callback(null, id);
          });
        }
        return id;
      }

      // Pause the observers. No callbacks from observers will fire until
      // 'resumeObservers' is called.
      pauseObservers() {
        // No-op if already paused.
        if (this.paused) {
          return;
        }

        // Set the 'paused' flag such that new observer messages don't fire.
        this.paused = true;

        // Take a snapshot of the query results for each query.
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          query.resultsSnapshot = EJSON.clone(query.results);
        });
      }
      clearResultQueries(callback) {
        const result = this._docs.size();
        this._docs.clear();
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.ordered) {
            query.results = [];
          } else {
            query.results.clear();
          }
        });
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }
      prepareRemove(selector) {
        const matcher = new Minimongo.Matcher(selector);
        const remove = [];
        this._eachPossiblyMatchingDocSync(selector, (doc, id) => {
          if (matcher.documentMatches(doc).result) {
            remove.push(id);
          }
        });
        const queriesToRecompute = [];
        const queryRemove = [];
        for (let i = 0; i < remove.length; i++) {
          const removeId = remove[i];
          const removeDoc = this._docs.get(removeId);
          Object.keys(this.queries).forEach(qid => {
            const query = this.queries[qid];
            if (query.dirty) {
              return;
            }
            if (query.matcher.documentMatches(removeDoc).result) {
              if (query.cursor.skip || query.cursor.limit) {
                queriesToRecompute.push(qid);
              } else {
                queryRemove.push({
                  qid,
                  doc: removeDoc
                });
              }
            }
          });
          this._saveOriginal(removeId, removeDoc);
          this._docs.remove(removeId);
        }
        return {
          queriesToRecompute,
          queryRemove,
          remove
        };
      }
      remove(selector, callback) {
        // Easy special case: if we're not calling observeChanges callbacks and
        // we're not saving originals and we got asked to remove everything, then
        // just empty everything directly.
        if (this.paused && !this._savedOriginals && EJSON.equals(selector, {})) {
          return this.clearResultQueries(callback);
        }
        const {
          queriesToRecompute,
          queryRemove,
          remove
        } = this.prepareRemove(selector);

        // run live query callbacks _after_ we've removed the documents.
        queryRemove.forEach(remove => {
          const query = this.queries[remove.qid];
          if (query) {
            query.distances && query.distances.remove(remove.doc._id);
            LocalCollection._removeFromResultsSync(query, remove.doc);
          }
        });
        queriesToRecompute.forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query);
          }
        });
        this._observeQueue.drain();
        const result = remove.length;
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }
      async removeAsync(selector, callback) {
        // Easy special case: if we're not calling observeChanges callbacks and
        // we're not saving originals and we got asked to remove everything, then
        // just empty everything directly.
        if (this.paused && !this._savedOriginals && EJSON.equals(selector, {})) {
          return this.clearResultQueries(callback);
        }
        const {
          queriesToRecompute,
          queryRemove,
          remove
        } = this.prepareRemove(selector);

        // run live query callbacks _after_ we've removed the documents.
        for (const remove of queryRemove) {
          const query = this.queries[remove.qid];
          if (query) {
            query.distances && query.distances.remove(remove.doc._id);
            await LocalCollection._removeFromResultsAsync(query, remove.doc);
          }
        }
        queriesToRecompute.forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query);
          }
        });
        await this._observeQueue.drain();
        const result = remove.length;
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }

      // Resume the observers. Observers immediately receive change
      // notifications to bring them to the current state of the
      // database. Note that this is not just replaying all the changes that
      // happened during the pause, it is a smarter 'coalesced' diff.
      _resumeObservers() {
        // No-op if not paused.
        if (!this.paused) {
          return;
        }

        // Unset the 'paused' flag. Make sure to do this first, otherwise
        // observer methods won't actually fire when we trigger them.
        this.paused = false;
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.dirty) {
            query.dirty = false;

            // re-compute results will perform `LocalCollection._diffQueryChanges`
            // automatically.
            this._recomputeResults(query, query.resultsSnapshot);
          } else {
            // Diff the current results against the snapshot and send to observers.
            // pass the query object for its observer callbacks.
            LocalCollection._diffQueryChanges(query.ordered, query.resultsSnapshot, query.results, query, {
              projectionFn: query.projectionFn
            });
          }
          query.resultsSnapshot = null;
        });
      }
      async resumeObserversServer() {
        this._resumeObservers();
        await this._observeQueue.drain();
      }
      resumeObserversClient() {
        this._resumeObservers();
        this._observeQueue.drain();
      }
      retrieveOriginals() {
        if (!this._savedOriginals) {
          throw new Error('Called retrieveOriginals without saveOriginals');
        }
        const originals = this._savedOriginals;
        this._savedOriginals = null;
        return originals;
      }

      // To track what documents are affected by a piece of code, call
      // saveOriginals() before it and retrieveOriginals() after it.
      // retrieveOriginals returns an object whose keys are the ids of the documents
      // that were affected since the call to saveOriginals(), and the values are
      // equal to the document's contents at the time of saveOriginals. (In the case
      // of an inserted document, undefined is the value.) You must alternate
      // between calls to saveOriginals() and retrieveOriginals().
      saveOriginals() {
        if (this._savedOriginals) {
          throw new Error('Called saveOriginals twice without retrieveOriginals');
        }
        this._savedOriginals = new LocalCollection._IdMap();
      }
      prepareUpdate(selector) {
        // Save the original results of any query that we might need to
        // _recomputeResults on, because _modifyAndNotify will mutate the objects in
        // it. (We don't need to save the original results of paused queries because
        // they already have a resultsSnapshot and we won't be diffing in
        // _recomputeResults.)
        const qidToOriginalResults = {};

        // We should only clone each document once, even if it appears in multiple
        // queries
        const docMap = new LocalCollection._IdMap();
        const idsMatched = LocalCollection._idsMatchedBySelector(selector);
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if ((query.cursor.skip || query.cursor.limit) && !this.paused) {
            // Catch the case of a reactive `count()` on a cursor with skip
            // or limit, which registers an unordered observe. This is a
            // pretty rare case, so we just clone the entire result set with
            // no optimizations for documents that appear in these result
            // sets and other queries.
            if (query.results instanceof LocalCollection._IdMap) {
              qidToOriginalResults[qid] = query.results.clone();
              return;
            }
            if (!(query.results instanceof Array)) {
              throw new Error('Assertion failed: query.results not an array');
            }

            // Clones a document to be stored in `qidToOriginalResults`
            // because it may be modified before the new and old result sets
            // are diffed. But if we know exactly which document IDs we're
            // going to modify, then we only need to clone those.
            const memoizedCloneIfNeeded = doc => {
              if (docMap.has(doc._id)) {
                return docMap.get(doc._id);
              }
              const docToMemoize = idsMatched && !idsMatched.some(id => EJSON.equals(id, doc._id)) ? doc : EJSON.clone(doc);
              docMap.set(doc._id, docToMemoize);
              return docToMemoize;
            };
            qidToOriginalResults[qid] = query.results.map(memoizedCloneIfNeeded);
          }
        });
        return qidToOriginalResults;
      }
      finishUpdate(_ref) {
        let {
          options,
          updateCount,
          callback,
          insertedId
        } = _ref;
        // Return the number of affected documents, or in the upsert case, an object
        // containing the number of affected docs and the id of the doc that was
        // inserted, if any.
        let result;
        if (options._returnObject) {
          result = {
            numberAffected: updateCount
          };
          if (insertedId !== undefined) {
            result.insertedId = insertedId;
          }
        } else {
          result = updateCount;
        }
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }

      // XXX atomicity: if multi is true, and one modification fails, do
      // we rollback the whole operation, or what?
      async updateAsync(selector, mod, options, callback) {
        if (!callback && options instanceof Function) {
          callback = options;
          options = null;
        }
        if (!options) {
          options = {};
        }
        const matcher = new Minimongo.Matcher(selector, true);
        const qidToOriginalResults = this.prepareUpdate(selector);
        let recomputeQids = {};
        let updateCount = 0;
        await this._eachPossiblyMatchingDocAsync(selector, async (doc, id) => {
          const queryResult = matcher.documentMatches(doc);
          if (queryResult.result) {
            // XXX Should we save the original even if mod ends up being a no-op?
            this._saveOriginal(id, doc);
            recomputeQids = await this._modifyAndNotifyAsync(doc, mod, queryResult.arrayIndices);
            ++updateCount;
            if (!options.multi) {
              return false; // break
            }
          }
          return true;
        });
        Object.keys(recomputeQids).forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query, qidToOriginalResults[qid]);
          }
        });
        await this._observeQueue.drain();

        // If we are doing an upsert, and we didn't modify any documents yet, then
        // it's time to do an insert. Figure out what document we are inserting, and
        // generate an id for it.
        let insertedId;
        if (updateCount === 0 && options.upsert) {
          const doc = LocalCollection._createUpsertDocument(selector, mod);
          if (!doc._id && options.insertedId) {
            doc._id = options.insertedId;
          }
          insertedId = await this.insertAsync(doc);
          updateCount = 1;
        }
        return this.finishUpdate({
          options,
          insertedId,
          updateCount,
          callback
        });
      }
      // XXX atomicity: if multi is true, and one modification fails, do
      // we rollback the whole operation, or what?
      update(selector, mod, options, callback) {
        if (!callback && options instanceof Function) {
          callback = options;
          options = null;
        }
        if (!options) {
          options = {};
        }
        const matcher = new Minimongo.Matcher(selector, true);
        const qidToOriginalResults = this.prepareUpdate(selector);
        let recomputeQids = {};
        let updateCount = 0;
        this._eachPossiblyMatchingDocSync(selector, (doc, id) => {
          const queryResult = matcher.documentMatches(doc);
          if (queryResult.result) {
            // XXX Should we save the original even if mod ends up being a no-op?
            this._saveOriginal(id, doc);
            recomputeQids = this._modifyAndNotifySync(doc, mod, queryResult.arrayIndices);
            ++updateCount;
            if (!options.multi) {
              return false; // break
            }
          }
          return true;
        });
        Object.keys(recomputeQids).forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query, qidToOriginalResults[qid]);
          }
        });
        this._observeQueue.drain();

        // If we are doing an upsert, and we didn't modify any documents yet, then
        // it's time to do an insert. Figure out what document we are inserting, and
        // generate an id for it.
        let insertedId;
        if (updateCount === 0 && options.upsert) {
          const doc = LocalCollection._createUpsertDocument(selector, mod);
          if (!doc._id && options.insertedId) {
            doc._id = options.insertedId;
          }
          insertedId = this.insert(doc);
          updateCount = 1;
        }
        return this.finishUpdate({
          options,
          insertedId,
          updateCount,
          callback,
          selector,
          mod
        });
      }

      // A convenience wrapper on update. LocalCollection.upsert(sel, mod) is
      // equivalent to LocalCollection.update(sel, mod, {upsert: true,
      // _returnObject: true}).
      upsert(selector, mod, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.update(selector, mod, Object.assign({}, options, {
          upsert: true,
          _returnObject: true
        }), callback);
      }
      upsertAsync(selector, mod, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.updateAsync(selector, mod, Object.assign({}, options, {
          upsert: true,
          _returnObject: true
        }), callback);
      }

      // Iterates over a subset of documents that could match selector; calls
      // fn(doc, id) on each of them.  Specifically, if selector specifies
      // specific _id's, it only looks at those.  doc is *not* cloned: it is the
      // same object that is in _docs.
      async _eachPossiblyMatchingDocAsync(selector, fn) {
        const specificIds = LocalCollection._idsMatchedBySelector(selector);
        if (specificIds) {
          for (const id of specificIds) {
            const doc = this._docs.get(id);
            if (doc && !(await fn(doc, id))) {
              break;
            }
          }
        } else {
          await this._docs.forEachAsync(fn);
        }
      }
      _eachPossiblyMatchingDocSync(selector, fn) {
        const specificIds = LocalCollection._idsMatchedBySelector(selector);
        if (specificIds) {
          for (const id of specificIds) {
            const doc = this._docs.get(id);
            if (doc && fn(doc, id) === false) {
              break;
            }
          }
        } else {
          this._docs.forEach(fn);
        }
      }
      _getMatchedDocAndModify(doc, mod, arrayIndices) {
        const matched_before = {};
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.dirty) {
            return;
          }
          if (query.ordered) {
            matched_before[qid] = query.matcher.documentMatches(doc).result;
          } else {
            // Because we don't support skip or limit (yet) in unordered queries, we
            // can just do a direct lookup.
            matched_before[qid] = query.results.has(doc._id);
          }
        });
        return matched_before;
      }
      _modifyAndNotifySync(doc, mod, arrayIndices) {
        const matched_before = this._getMatchedDocAndModify(doc, mod, arrayIndices);
        const old_doc = EJSON.clone(doc);
        LocalCollection._modify(doc, mod, {
          arrayIndices
        });
        const recomputeQids = {};
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const afterMatch = query.matcher.documentMatches(doc);
          const after = afterMatch.result;
          const before = matched_before[qid];
          if (after && query.distances && afterMatch.distance !== undefined) {
            query.distances.set(doc._id, afterMatch.distance);
          }
          if (query.cursor.skip || query.cursor.limit) {
            // We need to recompute any query where the doc may have been in the
            // cursor's window either before or after the update. (Note that if skip
            // or limit is set, "before" and "after" being true do not necessarily
            // mean that the document is in the cursor's output after skip/limit is
            // applied... but if they are false, then the document definitely is NOT
            // in the output. So it's safe to skip recompute if neither before or
            // after are true.)
            if (before || after) {
              recomputeQids[qid] = true;
            }
          } else if (before && !after) {
            LocalCollection._removeFromResultsSync(query, doc);
          } else if (!before && after) {
            LocalCollection._insertInResultsSync(query, doc);
          } else if (before && after) {
            LocalCollection._updateInResultsSync(query, doc, old_doc);
          }
        }
        return recomputeQids;
      }
      async _modifyAndNotifyAsync(doc, mod, arrayIndices) {
        const matched_before = this._getMatchedDocAndModify(doc, mod, arrayIndices);
        const old_doc = EJSON.clone(doc);
        LocalCollection._modify(doc, mod, {
          arrayIndices
        });
        const recomputeQids = {};
        for (const qid in this.queries) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const afterMatch = query.matcher.documentMatches(doc);
          const after = afterMatch.result;
          const before = matched_before[qid];
          if (after && query.distances && afterMatch.distance !== undefined) {
            query.distances.set(doc._id, afterMatch.distance);
          }
          if (query.cursor.skip || query.cursor.limit) {
            // We need to recompute any query where the doc may have been in the
            // cursor's window either before or after the update. (Note that if skip
            // or limit is set, "before" and "after" being true do not necessarily
            // mean that the document is in the cursor's output after skip/limit is
            // applied... but if they are false, then the document definitely is NOT
            // in the output. So it's safe to skip recompute if neither before or
            // after are true.)
            if (before || after) {
              recomputeQids[qid] = true;
            }
          } else if (before && !after) {
            await LocalCollection._removeFromResultsAsync(query, doc);
          } else if (!before && after) {
            await LocalCollection._insertInResultsAsync(query, doc);
          } else if (before && after) {
            await LocalCollection._updateInResultsAsync(query, doc, old_doc);
          }
        }
        return recomputeQids;
      }

      // Recomputes the results of a query and runs observe callbacks for the
      // difference between the previous results and the current results (unless
      // paused). Used for skip/limit queries.
      //
      // When this is used by insert or remove, it can just use query.results for
      // the old results (and there's no need to pass in oldResults), because these
      // operations don't mutate the documents in the collection. Update needs to
      // pass in an oldResults which was deep-copied before the modifier was
      // applied.
      //
      // oldResults is guaranteed to be ignored if the query is not paused.
      _recomputeResults(query, oldResults) {
        if (this.paused) {
          // There's no reason to recompute the results now as we're still paused.
          // By flagging the query as "dirty", the recompute will be performed
          // when resumeObservers is called.
          query.dirty = true;
          return;
        }
        if (!this.paused && !oldResults) {
          oldResults = query.results;
        }
        if (query.distances) {
          query.distances.clear();
        }
        query.results = query.cursor._getRawObjects({
          distances: query.distances,
          ordered: query.ordered
        });
        if (!this.paused) {
          LocalCollection._diffQueryChanges(query.ordered, oldResults, query.results, query, {
            projectionFn: query.projectionFn
          });
        }
      }
      _saveOriginal(id, doc) {
        // Are we even trying to save originals?
        if (!this._savedOriginals) {
          return;
        }

        // Have we previously mutated the original (and so 'doc' is not actually
        // original)?  (Note the 'has' check rather than truth: we store undefined
        // here for inserted docs!)
        if (this._savedOriginals.has(id)) {
          return;
        }
        this._savedOriginals.set(id, EJSON.clone(doc));
      }
    }
    LocalCollection.Cursor = Cursor;
    LocalCollection.ObserveHandle = ObserveHandle;

    // XXX maybe move these into another ObserveHelpers package or something

    // _CachingChangeObserver is an object which receives observeChanges callbacks
    // and keeps a cache of the current cursor state up to date in this.docs. Users
    // of this class should read the docs field but not modify it. You should pass
    // the "applyChange" field as the callbacks to the underlying observeChanges
    // call. Optionally, you can specify your own observeChanges callbacks which are
    // invoked immediately before the docs field is updated; this object is made
    // available as `this` to those callbacks.
    LocalCollection._CachingChangeObserver = class _CachingChangeObserver {
      constructor() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        const orderedFromCallbacks = options.callbacks && LocalCollection._observeChangesCallbacksAreOrdered(options.callbacks);
        if (hasOwn.call(options, 'ordered')) {
          this.ordered = options.ordered;
          if (options.callbacks && options.ordered !== orderedFromCallbacks) {
            throw Error('ordered option doesn\'t match callbacks');
          }
        } else if (options.callbacks) {
          this.ordered = orderedFromCallbacks;
        } else {
          throw Error('must provide ordered or callbacks');
        }
        const callbacks = options.callbacks || {};
        if (this.ordered) {
          this.docs = new OrderedDict(MongoID.idStringify);
          this.applyChange = {
            addedBefore: (id, fields, before) => {
              // Take a shallow copy since the top-level properties can be changed
              const doc = _objectSpread({}, fields);
              doc._id = id;
              if (callbacks.addedBefore) {
                callbacks.addedBefore.call(this, id, EJSON.clone(fields), before);
              }

              // This line triggers if we provide added with movedBefore.
              if (callbacks.added) {
                callbacks.added.call(this, id, EJSON.clone(fields));
              }

              // XXX could `before` be a falsy ID?  Technically
              // idStringify seems to allow for them -- though
              // OrderedDict won't call stringify on a falsy arg.
              this.docs.putBefore(id, doc, before || null);
            },
            movedBefore: (id, before) => {
              if (callbacks.movedBefore) {
                callbacks.movedBefore.call(this, id, before);
              }
              this.docs.moveBefore(id, before || null);
            }
          };
        } else {
          this.docs = new LocalCollection._IdMap();
          this.applyChange = {
            added: (id, fields) => {
              // Take a shallow copy since the top-level properties can be changed
              const doc = _objectSpread({}, fields);
              if (callbacks.added) {
                callbacks.added.call(this, id, EJSON.clone(fields));
              }
              doc._id = id;
              this.docs.set(id, doc);
            }
          };
        }

        // The methods in _IdMap and OrderedDict used by these callbacks are
        // identical.
        this.applyChange.changed = (id, fields) => {
          const doc = this.docs.get(id);
          if (!doc) {
            throw new Error("Unknown id for changed: ".concat(id));
          }
          if (callbacks.changed) {
            callbacks.changed.call(this, id, EJSON.clone(fields));
          }
          DiffSequence.applyChanges(doc, fields);
        };
        this.applyChange.removed = id => {
          if (callbacks.removed) {
            callbacks.removed.call(this, id);
          }
          this.docs.remove(id);
        };
      }
    };
    LocalCollection._IdMap = class _IdMap extends IdMap {
      constructor() {
        super(MongoID.idStringify, MongoID.idParse);
      }
    };

    // Wrap a transform function to return objects that have the _id field
    // of the untransformed document. This ensures that subsystems such as
    // the observe-sequence package that call `observe` can keep track of
    // the documents identities.
    //
    // - Require that it returns objects
    // - If the return value has an _id field, verify that it matches the
    //   original _id field
    // - If the return value doesn't have an _id field, add it back.
    LocalCollection.wrapTransform = transform => {
      if (!transform) {
        return null;
      }

      // No need to doubly-wrap transforms.
      if (transform.__wrappedTransform__) {
        return transform;
      }
      const wrapped = doc => {
        if (!hasOwn.call(doc, '_id')) {
          // XXX do we ever have a transform on the oplog's collection? because that
          // collection has no _id.
          throw new Error('can only transform documents with _id');
        }
        const id = doc._id;

        // XXX consider making tracker a weak dependency and checking
        // Package.tracker here
        const transformed = Tracker.nonreactive(() => transform(doc));
        if (!LocalCollection._isPlainObject(transformed)) {
          throw new Error('transform must return object');
        }
        if (hasOwn.call(transformed, '_id')) {
          if (!EJSON.equals(transformed._id, id)) {
            throw new Error('transformed document can\'t have different _id');
          }
        } else {
          transformed._id = id;
        }
        return transformed;
      };
      wrapped.__wrappedTransform__ = true;
      return wrapped;
    };

    // XXX the sorted-query logic below is laughably inefficient. we'll
    // need to come up with a better datastructure for this.
    //
    // XXX the logic for observing with a skip or a limit is even more
    // laughably inefficient. we recompute the whole results every time!

    // This binary search puts a value between any equal values, and the first
    // lesser value.
    LocalCollection._binarySearch = (cmp, array, value) => {
      let first = 0;
      let range = array.length;
      while (range > 0) {
        const halfRange = Math.floor(range / 2);
        if (cmp(value, array[first + halfRange]) >= 0) {
          first += halfRange + 1;
          range -= halfRange + 1;
        } else {
          range = halfRange;
        }
      }
      return first;
    };
    LocalCollection._checkSupportedProjection = fields => {
      if (fields !== Object(fields) || Array.isArray(fields)) {
        throw MinimongoError('fields option must be an object');
      }
      Object.keys(fields).forEach(keyPath => {
        if (keyPath.split('.').includes('$')) {
          throw MinimongoError('Minimongo doesn\'t support $ operator in projections yet.');
        }
        const value = fields[keyPath];
        if (typeof value === 'object' && ['$elemMatch', '$meta', '$slice'].some(key => hasOwn.call(value, key))) {
          throw MinimongoError('Minimongo doesn\'t support operators in projections yet.');
        }
        if (![1, 0, true, false].includes(value)) {
          throw MinimongoError('Projection values should be one of 1, 0, true, or false');
        }
      });
    };

    // Knows how to compile a fields projection to a predicate function.
    // @returns - Function: a closure that filters out an object according to the
    //            fields projection rules:
    //            @param obj - Object: MongoDB-styled document
    //            @returns - Object: a document with the fields filtered out
    //                       according to projection rules. Doesn't retain subfields
    //                       of passed argument.
    LocalCollection._compileProjection = fields => {
      LocalCollection._checkSupportedProjection(fields);
      const _idProjection = fields._id === undefined ? true : fields._id;
      const details = projectionDetails(fields);

      // returns transformed doc according to ruleTree
      const transform = (doc, ruleTree) => {
        // Special case for "sets"
        if (Array.isArray(doc)) {
          return doc.map(subdoc => transform(subdoc, ruleTree));
        }
        const result = details.including ? {} : EJSON.clone(doc);
        Object.keys(ruleTree).forEach(key => {
          if (doc == null || !hasOwn.call(doc, key)) {
            return;
          }
          const rule = ruleTree[key];
          if (rule === Object(rule)) {
            // For sub-objects/subsets we branch
            if (doc[key] === Object(doc[key])) {
              result[key] = transform(doc[key], rule);
            }
          } else if (details.including) {
            // Otherwise we don't even touch this subfield
            result[key] = EJSON.clone(doc[key]);
          } else {
            delete result[key];
          }
        });
        return doc != null ? result : doc;
      };
      return doc => {
        const result = transform(doc, details.tree);
        if (_idProjection && hasOwn.call(doc, '_id')) {
          result._id = doc._id;
        }
        if (!_idProjection && hasOwn.call(result, '_id')) {
          delete result._id;
        }
        return result;
      };
    };

    // Calculates the document to insert in case we're doing an upsert and the
    // selector does not match any elements
    LocalCollection._createUpsertDocument = (selector, modifier) => {
      const selectorDocument = populateDocumentWithQueryFields(selector);
      const isModify = LocalCollection._isModificationMod(modifier);
      const newDoc = {};
      if (selectorDocument._id) {
        newDoc._id = selectorDocument._id;
        delete selectorDocument._id;
      }

      // This double _modify call is made to help with nested properties (see issue
      // #8631). We do this even if it's a replacement for validation purposes (e.g.
      // ambiguous id's)
      LocalCollection._modify(newDoc, {
        $set: selectorDocument
      });
      LocalCollection._modify(newDoc, modifier, {
        isInsert: true
      });
      if (isModify) {
        return newDoc;
      }

      // Replacement can take _id from query document
      const replacement = Object.assign({}, modifier);
      if (newDoc._id) {
        replacement._id = newDoc._id;
      }
      return replacement;
    };
    LocalCollection._diffObjects = (left, right, callbacks) => {
      return DiffSequence.diffObjects(left, right, callbacks);
    };

    // ordered: bool.
    // old_results and new_results: collections of documents.
    //    if ordered, they are arrays.
    //    if unordered, they are IdMaps
    LocalCollection._diffQueryChanges = (ordered, oldResults, newResults, observer, options) => DiffSequence.diffQueryChanges(ordered, oldResults, newResults, observer, options);
    LocalCollection._diffQueryOrderedChanges = (oldResults, newResults, observer, options) => DiffSequence.diffQueryOrderedChanges(oldResults, newResults, observer, options);
    LocalCollection._diffQueryUnorderedChanges = (oldResults, newResults, observer, options) => DiffSequence.diffQueryUnorderedChanges(oldResults, newResults, observer, options);
    LocalCollection._findInOrderedResults = (query, doc) => {
      if (!query.ordered) {
        throw new Error('Can\'t call _findInOrderedResults on unordered query');
      }
      for (let i = 0; i < query.results.length; i++) {
        if (query.results[i] === doc) {
          return i;
        }
      }
      throw Error('object missing from query');
    };

    // If this is a selector which explicitly constrains the match by ID to a finite
    // number of documents, returns a list of their IDs.  Otherwise returns
    // null. Note that the selector may have other restrictions so it may not even
    // match those document!  We care about $in and $and since those are generated
    // access-controlled update and remove.
    LocalCollection._idsMatchedBySelector = selector => {
      // Is the selector just an ID?
      if (LocalCollection._selectorIsId(selector)) {
        return [selector];
      }
      if (!selector) {
        return null;
      }

      // Do we have an _id clause?
      if (hasOwn.call(selector, '_id')) {
        // Is the _id clause just an ID?
        if (LocalCollection._selectorIsId(selector._id)) {
          return [selector._id];
        }

        // Is the _id clause {_id: {$in: ["x", "y", "z"]}}?
        if (selector._id && Array.isArray(selector._id.$in) && selector._id.$in.length && selector._id.$in.every(LocalCollection._selectorIsId)) {
          return selector._id.$in;
        }
        return null;
      }

      // If this is a top-level $and, and any of the clauses constrain their
      // documents, then the whole selector is constrained by any one clause's
      // constraint. (Well, by their intersection, but that seems unlikely.)
      if (Array.isArray(selector.$and)) {
        for (let i = 0; i < selector.$and.length; ++i) {
          const subIds = LocalCollection._idsMatchedBySelector(selector.$and[i]);
          if (subIds) {
            return subIds;
          }
        }
      }
      return null;
    };
    LocalCollection._insertInResultsSync = (query, doc) => {
      const fields = EJSON.clone(doc);
      delete fields._id;
      if (query.ordered) {
        if (!query.sorter) {
          query.addedBefore(doc._id, query.projectionFn(fields), null);
          query.results.push(doc);
        } else {
          const i = LocalCollection._insertInSortedList(query.sorter.getComparator({
            distances: query.distances
          }), query.results, doc);
          let next = query.results[i + 1];
          if (next) {
            next = next._id;
          } else {
            next = null;
          }
          query.addedBefore(doc._id, query.projectionFn(fields), next);
        }
        query.added(doc._id, query.projectionFn(fields));
      } else {
        query.added(doc._id, query.projectionFn(fields));
        query.results.set(doc._id, doc);
      }
    };
    LocalCollection._insertInResultsAsync = async (query, doc) => {
      const fields = EJSON.clone(doc);
      delete fields._id;
      if (query.ordered) {
        if (!query.sorter) {
          await query.addedBefore(doc._id, query.projectionFn(fields), null);
          query.results.push(doc);
        } else {
          const i = LocalCollection._insertInSortedList(query.sorter.getComparator({
            distances: query.distances
          }), query.results, doc);
          let next = query.results[i + 1];
          if (next) {
            next = next._id;
          } else {
            next = null;
          }
          await query.addedBefore(doc._id, query.projectionFn(fields), next);
        }
        await query.added(doc._id, query.projectionFn(fields));
      } else {
        await query.added(doc._id, query.projectionFn(fields));
        query.results.set(doc._id, doc);
      }
    };
    LocalCollection._insertInSortedList = (cmp, array, value) => {
      if (array.length === 0) {
        array.push(value);
        return 0;
      }
      const i = LocalCollection._binarySearch(cmp, array, value);
      array.splice(i, 0, value);
      return i;
    };
    LocalCollection._isModificationMod = mod => {
      let isModify = false;
      let isReplace = false;
      Object.keys(mod).forEach(key => {
        if (key.substr(0, 1) === '$') {
          isModify = true;
        } else {
          isReplace = true;
        }
      });
      if (isModify && isReplace) {
        throw new Error('Update parameter cannot have both modifier and non-modifier fields.');
      }
      return isModify;
    };

    // XXX maybe this should be EJSON.isObject, though EJSON doesn't know about
    // RegExp
    // XXX note that _type(undefined) === 3!!!!
    LocalCollection._isPlainObject = x => {
      return x && LocalCollection._f._type(x) === 3;
    };

    // XXX need a strategy for passing the binding of $ into this
    // function, from the compiled selector
    //
    // maybe just {key.up.to.just.before.dollarsign: array_index}
    //
    // XXX atomicity: if one modification fails, do we roll back the whole
    // change?
    //
    // options:
    //   - isInsert is set when _modify is being called to compute the document to
    //     insert as part of an upsert operation. We use this primarily to figure
    //     out when to set the fields in $setOnInsert, if present.
    LocalCollection._modify = function (doc, modifier) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      if (!LocalCollection._isPlainObject(modifier)) {
        throw MinimongoError('Modifier must be an object');
      }

      // Make sure the caller can't mutate our data structures.
      modifier = EJSON.clone(modifier);
      const isModifier = isOperatorObject(modifier);
      const newDoc = isModifier ? EJSON.clone(doc) : modifier;
      if (isModifier) {
        // apply modifiers to the doc.
        Object.keys(modifier).forEach(operator => {
          // Treat $setOnInsert as $set if this is an insert.
          const setOnInsert = options.isInsert && operator === '$setOnInsert';
          const modFunc = MODIFIERS[setOnInsert ? '$set' : operator];
          const operand = modifier[operator];
          if (!modFunc) {
            throw MinimongoError("Invalid modifier specified ".concat(operator));
          }
          Object.keys(operand).forEach(keypath => {
            const arg = operand[keypath];
            if (keypath === '') {
              throw MinimongoError('An empty update path is not valid.');
            }
            const keyparts = keypath.split('.');
            if (!keyparts.every(Boolean)) {
              throw MinimongoError("The update path '".concat(keypath, "' contains an empty field name, ") + 'which is not allowed.');
            }
            const target = findModTarget(newDoc, keyparts, {
              arrayIndices: options.arrayIndices,
              forbidArray: operator === '$rename',
              noCreate: NO_CREATE_MODIFIERS[operator]
            });
            modFunc(target, keyparts.pop(), arg, keypath, newDoc);
          });
        });
        if (doc._id && !EJSON.equals(doc._id, newDoc._id)) {
          throw MinimongoError("After applying the update to the document {_id: \"".concat(doc._id, "\", ...},") + ' the (immutable) field \'_id\' was found to have been altered to ' + "_id: \"".concat(newDoc._id, "\""));
        }
      } else {
        if (doc._id && modifier._id && !EJSON.equals(doc._id, modifier._id)) {
          throw MinimongoError("The _id field cannot be changed from {_id: \"".concat(doc._id, "\"} to ") + "{_id: \"".concat(modifier._id, "\"}"));
        }

        // replace the whole document
        assertHasValidFieldNames(modifier);
      }

      // move new document into place.
      Object.keys(doc).forEach(key => {
        // Note: this used to be for (var key in doc) however, this does not
        // work right in Opera. Deleting from a doc while iterating over it
        // would sometimes cause opera to skip some keys.
        if (key !== '_id') {
          delete doc[key];
        }
      });
      Object.keys(newDoc).forEach(key => {
        doc[key] = newDoc[key];
      });
    };
    LocalCollection._observeFromObserveChanges = (cursor, observeCallbacks) => {
      const transform = cursor.getTransform() || (doc => doc);
      let suppressed = !!observeCallbacks._suppress_initial;
      let observeChangesCallbacks;
      if (LocalCollection._observeCallbacksAreOrdered(observeCallbacks)) {
        // The "_no_indices" option sets all index arguments to -1 and skips the
        // linear scans required to generate them.  This lets observers that don't
        // need absolute indices benefit from the other features of this API --
        // relative order, transforms, and applyChanges -- without the speed hit.
        const indices = !observeCallbacks._no_indices;
        observeChangesCallbacks = {
          addedBefore(id, fields, before) {
            const check = suppressed || !(observeCallbacks.addedAt || observeCallbacks.added);
            if (check) {
              return;
            }
            const doc = transform(Object.assign(fields, {
              _id: id
            }));
            if (observeCallbacks.addedAt) {
              observeCallbacks.addedAt(doc, indices ? before ? this.docs.indexOf(before) : this.docs.size() : -1, before);
            } else {
              observeCallbacks.added(doc);
            }
          },
          changed(id, fields) {
            if (!(observeCallbacks.changedAt || observeCallbacks.changed)) {
              return;
            }
            let doc = EJSON.clone(this.docs.get(id));
            if (!doc) {
              throw new Error("Unknown id for changed: ".concat(id));
            }
            const oldDoc = transform(EJSON.clone(doc));
            DiffSequence.applyChanges(doc, fields);
            if (observeCallbacks.changedAt) {
              observeCallbacks.changedAt(transform(doc), oldDoc, indices ? this.docs.indexOf(id) : -1);
            } else {
              observeCallbacks.changed(transform(doc), oldDoc);
            }
          },
          movedBefore(id, before) {
            if (!observeCallbacks.movedTo) {
              return;
            }
            const from = indices ? this.docs.indexOf(id) : -1;
            let to = indices ? before ? this.docs.indexOf(before) : this.docs.size() : -1;

            // When not moving backwards, adjust for the fact that removing the
            // document slides everything back one slot.
            if (to > from) {
              --to;
            }
            observeCallbacks.movedTo(transform(EJSON.clone(this.docs.get(id))), from, to, before || null);
          },
          removed(id) {
            if (!(observeCallbacks.removedAt || observeCallbacks.removed)) {
              return;
            }

            // technically maybe there should be an EJSON.clone here, but it's about
            // to be removed from this.docs!
            const doc = transform(this.docs.get(id));
            if (observeCallbacks.removedAt) {
              observeCallbacks.removedAt(doc, indices ? this.docs.indexOf(id) : -1);
            } else {
              observeCallbacks.removed(doc);
            }
          }
        };
      } else {
        observeChangesCallbacks = {
          added(id, fields) {
            if (!suppressed && observeCallbacks.added) {
              observeCallbacks.added(transform(Object.assign(fields, {
                _id: id
              })));
            }
          },
          changed(id, fields) {
            if (observeCallbacks.changed) {
              const oldDoc = this.docs.get(id);
              const doc = EJSON.clone(oldDoc);
              DiffSequence.applyChanges(doc, fields);
              observeCallbacks.changed(transform(doc), transform(EJSON.clone(oldDoc)));
            }
          },
          removed(id) {
            if (observeCallbacks.removed) {
              observeCallbacks.removed(transform(this.docs.get(id)));
            }
          }
        };
      }
      const changeObserver = new LocalCollection._CachingChangeObserver({
        callbacks: observeChangesCallbacks
      });

      // CachingChangeObserver clones all received input on its callbacks
      // So we can mark it as safe to reduce the ejson clones.
      // This is tested by the `mongo-livedata - (extended) scribbling` tests
      changeObserver.applyChange._fromObserve = true;
      const handle = cursor.observeChanges(changeObserver.applyChange, {
        nonMutatingCallbacks: true
      });

      // If needed, re-enable callbacks as soon as the initial batch is ready.
      const setSuppressed = h => {
        var _h$isReadyPromise;
        if (h.isReady) suppressed = false;else (_h$isReadyPromise = h.isReadyPromise) === null || _h$isReadyPromise === void 0 ? void 0 : _h$isReadyPromise.then(() => suppressed = false);
      };
      // When we call cursor.observeChanges() it can be the on from
      // the mongo package (instead of the minimongo one) and it doesn't have isReady and isReadyPromise
      if (Meteor._isPromise(handle)) {
        handle.then(setSuppressed);
      } else {
        setSuppressed(handle);
      }
      return handle;
    };
    LocalCollection._observeCallbacksAreOrdered = callbacks => {
      if (callbacks.added && callbacks.addedAt) {
        throw new Error('Please specify only one of added() and addedAt()');
      }
      if (callbacks.changed && callbacks.changedAt) {
        throw new Error('Please specify only one of changed() and changedAt()');
      }
      if (callbacks.removed && callbacks.removedAt) {
        throw new Error('Please specify only one of removed() and removedAt()');
      }
      return !!(callbacks.addedAt || callbacks.changedAt || callbacks.movedTo || callbacks.removedAt);
    };
    LocalCollection._observeChangesCallbacksAreOrdered = callbacks => {
      if (callbacks.added && callbacks.addedBefore) {
        throw new Error('Please specify only one of added() and addedBefore()');
      }
      return !!(callbacks.addedBefore || callbacks.movedBefore);
    };
    LocalCollection._removeFromResultsSync = (query, doc) => {
      if (query.ordered) {
        const i = LocalCollection._findInOrderedResults(query, doc);
        query.removed(doc._id);
        query.results.splice(i, 1);
      } else {
        const id = doc._id; // in case callback mutates doc

        query.removed(doc._id);
        query.results.remove(id);
      }
    };
    LocalCollection._removeFromResultsAsync = async (query, doc) => {
      if (query.ordered) {
        const i = LocalCollection._findInOrderedResults(query, doc);
        await query.removed(doc._id);
        query.results.splice(i, 1);
      } else {
        const id = doc._id; // in case callback mutates doc

        await query.removed(doc._id);
        query.results.remove(id);
      }
    };

    // Is this selector just shorthand for lookup by _id?
    LocalCollection._selectorIsId = selector => typeof selector === 'number' || typeof selector === 'string' || selector instanceof MongoID.ObjectID;

    // Is the selector just lookup by _id (shorthand or not)?
    LocalCollection._selectorIsIdPerhapsAsObject = selector => LocalCollection._selectorIsId(selector) || LocalCollection._selectorIsId(selector && selector._id) && Object.keys(selector).length === 1;
    LocalCollection._updateInResultsSync = (query, doc, old_doc) => {
      if (!EJSON.equals(doc._id, old_doc._id)) {
        throw new Error('Can\'t change a doc\'s _id while updating');
      }
      const projectionFn = query.projectionFn;
      const changedFields = DiffSequence.makeChangedFields(projectionFn(doc), projectionFn(old_doc));
      if (!query.ordered) {
        if (Object.keys(changedFields).length) {
          query.changed(doc._id, changedFields);
          query.results.set(doc._id, doc);
        }
        return;
      }
      const old_idx = LocalCollection._findInOrderedResults(query, doc);
      if (Object.keys(changedFields).length) {
        query.changed(doc._id, changedFields);
      }
      if (!query.sorter) {
        return;
      }

      // just take it out and put it back in again, and see if the index changes
      query.results.splice(old_idx, 1);
      const new_idx = LocalCollection._insertInSortedList(query.sorter.getComparator({
        distances: query.distances
      }), query.results, doc);
      if (old_idx !== new_idx) {
        let next = query.results[new_idx + 1];
        if (next) {
          next = next._id;
        } else {
          next = null;
        }
        query.movedBefore && query.movedBefore(doc._id, next);
      }
    };
    LocalCollection._updateInResultsAsync = async (query, doc, old_doc) => {
      if (!EJSON.equals(doc._id, old_doc._id)) {
        throw new Error('Can\'t change a doc\'s _id while updating');
      }
      const projectionFn = query.projectionFn;
      const changedFields = DiffSequence.makeChangedFields(projectionFn(doc), projectionFn(old_doc));
      if (!query.ordered) {
        if (Object.keys(changedFields).length) {
          await query.changed(doc._id, changedFields);
          query.results.set(doc._id, doc);
        }
        return;
      }
      const old_idx = LocalCollection._findInOrderedResults(query, doc);
      if (Object.keys(changedFields).length) {
        await query.changed(doc._id, changedFields);
      }
      if (!query.sorter) {
        return;
      }

      // just take it out and put it back in again, and see if the index changes
      query.results.splice(old_idx, 1);
      const new_idx = LocalCollection._insertInSortedList(query.sorter.getComparator({
        distances: query.distances
      }), query.results, doc);
      if (old_idx !== new_idx) {
        let next = query.results[new_idx + 1];
        if (next) {
          next = next._id;
        } else {
          next = null;
        }
        query.movedBefore && (await query.movedBefore(doc._id, next));
      }
    };
    const MODIFIERS = {
      $currentDate(target, field, arg) {
        if (typeof arg === 'object' && hasOwn.call(arg, '$type')) {
          if (arg.$type !== 'date') {
            throw MinimongoError('Minimongo does currently only support the date type in ' + '$currentDate modifiers', {
              field
            });
          }
        } else if (arg !== true) {
          throw MinimongoError('Invalid $currentDate modifier', {
            field
          });
        }
        target[field] = new Date();
      },
      $inc(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $inc allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $inc modifier to non-number', {
              field
            });
          }
          target[field] += arg;
        } else {
          target[field] = arg;
        }
      },
      $min(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $min allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $min modifier to non-number', {
              field
            });
          }
          if (target[field] > arg) {
            target[field] = arg;
          }
        } else {
          target[field] = arg;
        }
      },
      $max(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $max allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $max modifier to non-number', {
              field
            });
          }
          if (target[field] < arg) {
            target[field] = arg;
          }
        } else {
          target[field] = arg;
        }
      },
      $mul(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $mul allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $mul modifier to non-number', {
              field
            });
          }
          target[field] *= arg;
        } else {
          target[field] = 0;
        }
      },
      $rename(target, field, arg, keypath, doc) {
        // no idea why mongo has this restriction..
        if (keypath === arg) {
          throw MinimongoError('$rename source must differ from target', {
            field
          });
        }
        if (target === null) {
          throw MinimongoError('$rename source field invalid', {
            field
          });
        }
        if (typeof arg !== 'string') {
          throw MinimongoError('$rename target must be a string', {
            field
          });
        }
        if (arg.includes('\0')) {
          // Null bytes are not allowed in Mongo field names
          // https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
          throw MinimongoError('The \'to\' field for $rename cannot contain an embedded null byte', {
            field
          });
        }
        if (target === undefined) {
          return;
        }
        const object = target[field];
        delete target[field];
        const keyparts = arg.split('.');
        const target2 = findModTarget(doc, keyparts, {
          forbidArray: true
        });
        if (target2 === null) {
          throw MinimongoError('$rename target field invalid', {
            field
          });
        }
        target2[keyparts.pop()] = object;
      },
      $set(target, field, arg) {
        if (target !== Object(target)) {
          // not an array or an object
          const error = MinimongoError('Cannot set property on non-object field', {
            field
          });
          error.setPropertyError = true;
          throw error;
        }
        if (target === null) {
          const error = MinimongoError('Cannot set property on null', {
            field
          });
          error.setPropertyError = true;
          throw error;
        }
        assertHasValidFieldNames(arg);
        target[field] = arg;
      },
      $setOnInsert(target, field, arg) {
        // converted to `$set` in `_modify`
      },
      $unset(target, field, arg) {
        if (target !== undefined) {
          if (target instanceof Array) {
            if (field in target) {
              target[field] = null;
            }
          } else {
            delete target[field];
          }
        }
      },
      $push(target, field, arg) {
        if (target[field] === undefined) {
          target[field] = [];
        }
        if (!(target[field] instanceof Array)) {
          throw MinimongoError('Cannot apply $push modifier to non-array', {
            field
          });
        }
        if (!(arg && arg.$each)) {
          // Simple mode: not $each
          assertHasValidFieldNames(arg);
          target[field].push(arg);
          return;
        }

        // Fancy mode: $each (and maybe $slice and $sort and $position)
        const toPush = arg.$each;
        if (!(toPush instanceof Array)) {
          throw MinimongoError('$each must be an array', {
            field
          });
        }
        assertHasValidFieldNames(toPush);

        // Parse $position
        let position = undefined;
        if ('$position' in arg) {
          if (typeof arg.$position !== 'number') {
            throw MinimongoError('$position must be a numeric value', {
              field
            });
          }

          // XXX should check to make sure integer
          if (arg.$position < 0) {
            throw MinimongoError('$position in $push must be zero or positive', {
              field
            });
          }
          position = arg.$position;
        }

        // Parse $slice.
        let slice = undefined;
        if ('$slice' in arg) {
          if (typeof arg.$slice !== 'number') {
            throw MinimongoError('$slice must be a numeric value', {
              field
            });
          }

          // XXX should check to make sure integer
          slice = arg.$slice;
        }

        // Parse $sort.
        let sortFunction = undefined;
        if (arg.$sort) {
          if (slice === undefined) {
            throw MinimongoError('$sort requires $slice to be present', {
              field
            });
          }

          // XXX this allows us to use a $sort whose value is an array, but that's
          // actually an extension of the Node driver, so it won't work
          // server-side. Could be confusing!
          // XXX is it correct that we don't do geo-stuff here?
          sortFunction = new Minimongo.Sorter(arg.$sort).getComparator();
          toPush.forEach(element => {
            if (LocalCollection._f._type(element) !== 3) {
              throw MinimongoError('$push like modifiers using $sort require all elements to be ' + 'objects', {
                field
              });
            }
          });
        }

        // Actually push.
        if (position === undefined) {
          toPush.forEach(element => {
            target[field].push(element);
          });
        } else {
          const spliceArguments = [position, 0];
          toPush.forEach(element => {
            spliceArguments.push(element);
          });
          target[field].splice(...spliceArguments);
        }

        // Actually sort.
        if (sortFunction) {
          target[field].sort(sortFunction);
        }

        // Actually slice.
        if (slice !== undefined) {
          if (slice === 0) {
            target[field] = []; // differs from Array.slice!
          } else if (slice < 0) {
            target[field] = target[field].slice(slice);
          } else {
            target[field] = target[field].slice(0, slice);
          }
        }
      },
      $pushAll(target, field, arg) {
        if (!(typeof arg === 'object' && arg instanceof Array)) {
          throw MinimongoError('Modifier $pushAll/pullAll allowed for arrays only');
        }
        assertHasValidFieldNames(arg);
        const toPush = target[field];
        if (toPush === undefined) {
          target[field] = arg;
        } else if (!(toPush instanceof Array)) {
          throw MinimongoError('Cannot apply $pushAll modifier to non-array', {
            field
          });
        } else {
          toPush.push(...arg);
        }
      },
      $addToSet(target, field, arg) {
        let isEach = false;
        if (typeof arg === 'object') {
          // check if first key is '$each'
          const keys = Object.keys(arg);
          if (keys[0] === '$each') {
            isEach = true;
          }
        }
        const values = isEach ? arg.$each : [arg];
        assertHasValidFieldNames(values);
        const toAdd = target[field];
        if (toAdd === undefined) {
          target[field] = values;
        } else if (!(toAdd instanceof Array)) {
          throw MinimongoError('Cannot apply $addToSet modifier to non-array', {
            field
          });
        } else {
          values.forEach(value => {
            if (toAdd.some(element => LocalCollection._f._equal(value, element))) {
              return;
            }
            toAdd.push(value);
          });
        }
      },
      $pop(target, field, arg) {
        if (target === undefined) {
          return;
        }
        const toPop = target[field];
        if (toPop === undefined) {
          return;
        }
        if (!(toPop instanceof Array)) {
          throw MinimongoError('Cannot apply $pop modifier to non-array', {
            field
          });
        }
        if (typeof arg === 'number' && arg < 0) {
          toPop.splice(0, 1);
        } else {
          toPop.pop();
        }
      },
      $pull(target, field, arg) {
        if (target === undefined) {
          return;
        }
        const toPull = target[field];
        if (toPull === undefined) {
          return;
        }
        if (!(toPull instanceof Array)) {
          throw MinimongoError('Cannot apply $pull/pullAll modifier to non-array', {
            field
          });
        }
        let out;
        if (arg != null && typeof arg === 'object' && !(arg instanceof Array)) {
          // XXX would be much nicer to compile this once, rather than
          // for each document we modify.. but usually we're not
          // modifying that many documents, so we'll let it slide for
          // now

          // XXX Minimongo.Matcher isn't up for the job, because we need
          // to permit stuff like {$pull: {a: {$gt: 4}}}.. something
          // like {$gt: 4} is not normally a complete selector.
          // same issue as $elemMatch possibly?
          const matcher = new Minimongo.Matcher(arg);
          out = toPull.filter(element => !matcher.documentMatches(element).result);
        } else {
          out = toPull.filter(element => !LocalCollection._f._equal(element, arg));
        }
        target[field] = out;
      },
      $pullAll(target, field, arg) {
        if (!(typeof arg === 'object' && arg instanceof Array)) {
          throw MinimongoError('Modifier $pushAll/pullAll allowed for arrays only', {
            field
          });
        }
        if (target === undefined) {
          return;
        }
        const toPull = target[field];
        if (toPull === undefined) {
          return;
        }
        if (!(toPull instanceof Array)) {
          throw MinimongoError('Cannot apply $pull/pullAll modifier to non-array', {
            field
          });
        }
        target[field] = toPull.filter(object => !arg.some(element => LocalCollection._f._equal(object, element)));
      },
      $bit(target, field, arg) {
        // XXX mongo only supports $bit on integers, and we only support
        // native javascript numbers (doubles) so far, so we can't support $bit
        throw MinimongoError('$bit is not supported', {
          field
        });
      },
      $v() {
        // As discussed in https://github.com/meteor/meteor/issues/9623,
        // the `$v` operator is not needed by Meteor, but problems can occur if
        // it's not at least callable (as of Mongo >= 3.6). It's defined here as
        // a no-op to work around these problems.
      }
    };
    const NO_CREATE_MODIFIERS = {
      $pop: true,
      $pull: true,
      $pullAll: true,
      $rename: true,
      $unset: true
    };

    // Make sure field names do not contain Mongo restricted
    // characters ('$', '\0') or invalid dot usage (leading/trailing/consecutive '.').
    // https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
    const invalidCharMsg = {
      $: 'start with \'$\'',
      '.': 'start or end with \'.\'',
      '..': 'contain consecutive dots',
      '\0': 'contain null bytes'
    };

    // checks if all field names in an object are valid
    function assertHasValidFieldNames(doc) {
      if (doc && typeof doc === 'object') {
        JSON.stringify(doc, (key, value) => {
          assertIsValidFieldName(key);
          return value;
        });
      }
    }
    function assertIsValidFieldName(key) {
      let match;
      if (typeof key === 'string' && (match = key.match(/^\$|^\.|\.\.|\.$|^\.$|\0/))) {
        throw MinimongoError("Key ".concat(key, " must not ").concat(invalidCharMsg[match[0]]));
      }
    }

    // for a.b.c.2.d.e, keyparts should be ['a', 'b', 'c', '2', 'd', 'e'],
    // and then you would operate on the 'e' property of the returned
    // object.
    //
    // if options.noCreate is falsey, creates intermediate levels of
    // structure as necessary, like mkdir -p (and raises an exception if
    // that would mean giving a non-numeric property to an array.) if
    // options.noCreate is true, return undefined instead.
    //
    // may modify the last element of keyparts to signal to the caller that it needs
    // to use a different value to index into the returned object (for example,
    // ['a', '01'] -> ['a', 1]).
    //
    // if forbidArray is true, return null if the keypath goes through an array.
    //
    // if options.arrayIndices is set, use its first element for the (first) '$' in
    // the path.
    function findModTarget(doc, keyparts) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      let usedArrayIndex = false;
      for (let i = 0; i < keyparts.length; i++) {
        const last = i === keyparts.length - 1;
        let keypart = keyparts[i];
        if (!isIndexable(doc)) {
          if (options.noCreate) {
            return undefined;
          }
          const error = MinimongoError("cannot use the part '".concat(keypart, "' to traverse ").concat(doc));
          error.setPropertyError = true;
          throw error;
        }
        if (doc instanceof Array) {
          if (options.forbidArray) {
            return null;
          }
          if (keypart === '$') {
            if (usedArrayIndex) {
              throw MinimongoError('Too many positional (i.e. \'$\') elements');
            }
            if (!options.arrayIndices || !options.arrayIndices.length) {
              throw MinimongoError('The positional operator did not find the match needed from the ' + 'query');
            }
            keypart = options.arrayIndices[0];
            usedArrayIndex = true;
          } else if (isNumericKey(keypart)) {
            keypart = parseInt(keypart);
          } else {
            if (options.noCreate) {
              return undefined;
            }
            throw MinimongoError("can't append to array using string field name [".concat(keypart, "]"));
          }
          if (last) {
            keyparts[i] = keypart; // handle 'a.01'
          }
          if (options.noCreate && keypart >= doc.length) {
            return undefined;
          }
          while (doc.length < keypart) {
            doc.push(null);
          }
          if (!last) {
            if (doc.length === keypart) {
              doc.push({});
            } else if (typeof doc[keypart] !== 'object') {
              throw MinimongoError("can't modify field '".concat(keyparts[i + 1], "' of list value ") + JSON.stringify(doc[keypart]));
            }
          }
        } else {
          assertIsValidFieldName(keypart);
          if (!(keypart in doc)) {
            if (options.noCreate) {
              return undefined;
            }
            if (!last) {
              doc[keypart] = {};
            }
          }
        }
        if (last) {
          return doc;
        }
        doc = doc[keypart];
      }

      // notreached
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"matcher.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/minimongo/matcher.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    var _Package$mongoDecima;
    module.export({
      default: () => Matcher
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    let compileDocumentSelector, hasOwn, nothingMatcher;
    module.link("./common.js", {
      compileDocumentSelector(v) {
        compileDocumentSelector = v;
      },
      hasOwn(v) {
        hasOwn = v;
      },
      nothingMatcher(v) {
        nothingMatcher = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const Decimal = ((_Package$mongoDecima = Package['mongo-decimal']) === null || _Package$mongoDecima === void 0 ? void 0 : _Package$mongoDecima.Decimal) || class DecimalStub {};

    // The minimongo selector compiler!

    // Terminology:
    //  - a 'selector' is the EJSON object representing a selector
    //  - a 'matcher' is its compiled form (whether a full Minimongo.Matcher
    //    object or one of the component lambdas that matches parts of it)
    //  - a 'result object' is an object with a 'result' field and maybe
    //    distance and arrayIndices.
    //  - a 'branched value' is an object with a 'value' field and maybe
    //    'dontIterate' and 'arrayIndices'.
    //  - a 'document' is a top-level object that can be stored in a collection.
    //  - a 'lookup function' is a function that takes in a document and returns
    //    an array of 'branched values'.
    //  - a 'branched matcher' maps from an array of branched values to a result
    //    object.
    //  - an 'element matcher' maps from a single value to a bool.

    // Main entry point.
    //   var matcher = new Minimongo.Matcher({a: {$gt: 5}});
    //   if (matcher.documentMatches({a: 7})) ...
    class Matcher {
      constructor(selector, isUpdate) {
        // A set (object mapping string -> *) of all of the document paths looked
        // at by the selector. Also includes the empty string if it may look at any
        // path (eg, $where).
        this._paths = {};
        // Set to true if compilation finds a $near.
        this._hasGeoQuery = false;
        // Set to true if compilation finds a $where.
        this._hasWhere = false;
        // Set to false if compilation finds anything other than a simple equality
        // or one or more of '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin' used
        // with scalars as operands.
        this._isSimple = true;
        // Set to a dummy document which always matches this Matcher. Or set to null
        // if such document is too hard to find.
        this._matchingDocument = undefined;
        // A clone of the original selector. It may just be a function if the user
        // passed in a function; otherwise is definitely an object (eg, IDs are
        // translated into {_id: ID} first. Used by canBecomeTrueByModifier and
        // Sorter._useWithMatcher.
        this._selector = null;
        this._docMatcher = this._compileSelector(selector);
        // Set to true if selection is done for an update operation
        // Default is false
        // Used for $near array update (issue #3599)
        this._isUpdate = isUpdate;
      }
      documentMatches(doc) {
        if (doc !== Object(doc)) {
          throw Error('documentMatches needs a document');
        }
        return this._docMatcher(doc);
      }
      hasGeoQuery() {
        return this._hasGeoQuery;
      }
      hasWhere() {
        return this._hasWhere;
      }
      isSimple() {
        return this._isSimple;
      }

      // Given a selector, return a function that takes one argument, a
      // document. It returns a result object.
      _compileSelector(selector) {
        // you can pass a literal function instead of a selector
        if (selector instanceof Function) {
          this._isSimple = false;
          this._selector = selector;
          this._recordPathUsed('');
          return doc => ({
            result: !!selector.call(doc)
          });
        }

        // shorthand -- scalar _id
        if (LocalCollection._selectorIsId(selector)) {
          this._selector = {
            _id: selector
          };
          this._recordPathUsed('_id');
          return doc => ({
            result: EJSON.equals(doc._id, selector)
          });
        }

        // protect against dangerous selectors.  falsey and {_id: falsey} are both
        // likely programmer error, and not what you want, particularly for
        // destructive operations.
        if (!selector || hasOwn.call(selector, '_id') && !selector._id) {
          this._isSimple = false;
          return nothingMatcher;
        }

        // Top level can't be an array or true or binary.
        if (Array.isArray(selector) || EJSON.isBinary(selector) || typeof selector === 'boolean') {
          throw new Error("Invalid selector: ".concat(selector));
        }
        this._selector = EJSON.clone(selector);
        return compileDocumentSelector(selector, this, {
          isRoot: true
        });
      }

      // Returns a list of key paths the given selector is looking for. It includes
      // the empty string if there is a $where.
      _getPaths() {
        return Object.keys(this._paths);
      }
      _recordPathUsed(path) {
        this._paths[path] = true;
      }
    }
    // helpers used by compiled selector code
    LocalCollection._f = {
      // XXX for _all and _in, consider building 'inquery' at compile time..
      _type(v) {
        if (typeof v === 'number') {
          return 1;
        }
        if (typeof v === 'string') {
          return 2;
        }
        if (typeof v === 'boolean') {
          return 8;
        }
        if (Array.isArray(v)) {
          return 4;
        }
        if (v === null) {
          return 10;
        }

        // note that typeof(/x/) === "object"
        if (v instanceof RegExp) {
          return 11;
        }
        if (typeof v === 'function') {
          return 13;
        }
        if (v instanceof Date) {
          return 9;
        }
        if (EJSON.isBinary(v)) {
          return 5;
        }
        if (v instanceof MongoID.ObjectID) {
          return 7;
        }
        if (v instanceof Decimal) {
          return 1;
        }

        // object
        return 3;

        // XXX support some/all of these:
        // 14, symbol
        // 15, javascript code with scope
        // 16, 18: 32-bit/64-bit integer
        // 17, timestamp
        // 255, minkey
        // 127, maxkey
      },
      // deep equality test: use for literal document and array matches
      _equal(a, b) {
        return EJSON.equals(a, b, {
          keyOrderSensitive: true
        });
      },
      // maps a type code to a value that can be used to sort values of different
      // types
      _typeorder(t) {
        // http://www.mongodb.org/display/DOCS/What+is+the+Compare+Order+for+BSON+Types
        // XXX what is the correct sort position for Javascript code?
        // ('100' in the matrix below)
        // XXX minkey/maxkey
        return [-1,
        // (not a type)
        1,
        // number
        2,
        // string
        3,
        // object
        4,
        // array
        5,
        // binary
        -1,
        // deprecated
        6,
        // ObjectID
        7,
        // bool
        8,
        // Date
        0,
        // null
        9,
        // RegExp
        -1,
        // deprecated
        100,
        // JS code
        2,
        // deprecated (symbol)
        100,
        // JS code
        1,
        // 32-bit int
        8,
        // Mongo timestamp
        1 // 64-bit int
        ][t];
      },
      // compare two values of unknown type according to BSON ordering
      // semantics. (as an extension, consider 'undefined' to be less than
      // any other value.) return negative if a is less, positive if b is
      // less, or 0 if equal
      _cmp(a, b) {
        if (a === undefined) {
          return b === undefined ? 0 : -1;
        }
        if (b === undefined) {
          return 1;
        }
        let ta = LocalCollection._f._type(a);
        let tb = LocalCollection._f._type(b);
        const oa = LocalCollection._f._typeorder(ta);
        const ob = LocalCollection._f._typeorder(tb);
        if (oa !== ob) {
          return oa < ob ? -1 : 1;
        }

        // XXX need to implement this if we implement Symbol or integers, or
        // Timestamp
        if (ta !== tb) {
          throw Error('Missing type coercion logic in _cmp');
        }
        if (ta === 7) {
          // ObjectID
          // Convert to string.
          ta = tb = 2;
          a = a.toHexString();
          b = b.toHexString();
        }
        if (ta === 9) {
          // Date
          // Convert to millis.
          ta = tb = 1;
          a = isNaN(a) ? 0 : a.getTime();
          b = isNaN(b) ? 0 : b.getTime();
        }
        if (ta === 1) {
          // double
          if (a instanceof Decimal) {
            return a.minus(b).toNumber();
          } else {
            return a - b;
          }
        }
        if (tb === 2)
          // string
          return a < b ? -1 : a === b ? 0 : 1;
        if (ta === 3) {
          // Object
          // this could be much more efficient in the expected case ...
          const toArray = object => {
            const result = [];
            Object.keys(object).forEach(key => {
              result.push(key, object[key]);
            });
            return result;
          };
          return LocalCollection._f._cmp(toArray(a), toArray(b));
        }
        if (ta === 4) {
          // Array
          for (let i = 0;; i++) {
            if (i === a.length) {
              return i === b.length ? 0 : -1;
            }
            if (i === b.length) {
              return 1;
            }
            const s = LocalCollection._f._cmp(a[i], b[i]);
            if (s !== 0) {
              return s;
            }
          }
        }
        if (ta === 5) {
          // binary
          // Surprisingly, a small binary blob is always less than a large one in
          // Mongo.
          if (a.length !== b.length) {
            return a.length - b.length;
          }
          for (let i = 0; i < a.length; i++) {
            if (a[i] < b[i]) {
              return -1;
            }
            if (a[i] > b[i]) {
              return 1;
            }
          }
          return 0;
        }
        if (ta === 8) {
          // boolean
          if (a) {
            return b ? 0 : 1;
          }
          return b ? -1 : 0;
        }
        if (ta === 10)
          // null
          return 0;
        if (ta === 11)
          // regexp
          throw Error('Sorting not supported on regular expression'); // XXX

        // 13: javascript code
        // 14: symbol
        // 15: javascript code with scope
        // 16: 32-bit integer
        // 17: timestamp
        // 18: 64-bit integer
        // 255: minkey
        // 127: maxkey
        if (ta === 13)
          // javascript code
          throw Error('Sorting not supported on Javascript code'); // XXX

        throw Error('Unknown type to sort');
      }
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"minimongo_common.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/minimongo/minimongo_common.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let LocalCollection_;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection_ = v;
      }
    }, 0);
    let Matcher;
    module.link("./matcher.js", {
      default(v) {
        Matcher = v;
      }
    }, 1);
    let Sorter;
    module.link("./sorter.js", {
      default(v) {
        Sorter = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    LocalCollection = LocalCollection_;
    Minimongo = {
      LocalCollection: LocalCollection_,
      Matcher,
      Sorter
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"observe_handle.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/minimongo/observe_handle.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  default: () => ObserveHandle
});
class ObserveHandle {}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sorter.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/minimongo/sorter.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      default: () => Sorter
    });
    let ELEMENT_OPERATORS, equalityElementMatcher, expandArraysInBranches, hasOwn, isOperatorObject, makeLookupFunction, regexpElementMatcher;
    module.link("./common.js", {
      ELEMENT_OPERATORS(v) {
        ELEMENT_OPERATORS = v;
      },
      equalityElementMatcher(v) {
        equalityElementMatcher = v;
      },
      expandArraysInBranches(v) {
        expandArraysInBranches = v;
      },
      hasOwn(v) {
        hasOwn = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      makeLookupFunction(v) {
        makeLookupFunction = v;
      },
      regexpElementMatcher(v) {
        regexpElementMatcher = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class Sorter {
      constructor(spec) {
        this._sortSpecParts = [];
        this._sortFunction = null;
        const addSpecPart = (path, ascending) => {
          if (!path) {
            throw Error('sort keys must be non-empty');
          }
          if (path.charAt(0) === '$') {
            throw Error("unsupported sort key: ".concat(path));
          }
          this._sortSpecParts.push({
            ascending,
            lookup: makeLookupFunction(path, {
              forSort: true
            }),
            path
          });
        };
        if (spec instanceof Array) {
          spec.forEach(element => {
            if (typeof element === 'string') {
              addSpecPart(element, true);
            } else {
              addSpecPart(element[0], element[1] !== 'desc');
            }
          });
        } else if (typeof spec === 'object') {
          Object.keys(spec).forEach(key => {
            addSpecPart(key, spec[key] >= 0);
          });
        } else if (typeof spec === 'function') {
          this._sortFunction = spec;
        } else {
          throw Error("Bad sort specification: ".concat(JSON.stringify(spec)));
        }

        // If a function is specified for sorting, we skip the rest.
        if (this._sortFunction) {
          return;
        }

        // To implement affectedByModifier, we piggy-back on top of Matcher's
        // affectedByModifier code; we create a selector that is affected by the
        // same modifiers as this sort order. This is only implemented on the
        // server.
        if (this.affectedByModifier) {
          const selector = {};
          this._sortSpecParts.forEach(spec => {
            selector[spec.path] = 1;
          });
          this._selectorForAffectedByModifier = new Minimongo.Matcher(selector);
        }
        this._keyComparator = composeComparators(this._sortSpecParts.map((spec, i) => this._keyFieldComparator(i)));
      }
      getComparator(options) {
        // If sort is specified or have no distances, just use the comparator from
        // the source specification (which defaults to "everything is equal".
        // issue #3599
        // https://docs.mongodb.com/manual/reference/operator/query/near/#sort-operation
        // sort effectively overrides $near
        if (this._sortSpecParts.length || !options || !options.distances) {
          return this._getBaseComparator();
        }
        const distances = options.distances;

        // Return a comparator which compares using $near distances.
        return (a, b) => {
          if (!distances.has(a._id)) {
            throw Error("Missing distance for ".concat(a._id));
          }
          if (!distances.has(b._id)) {
            throw Error("Missing distance for ".concat(b._id));
          }
          return distances.get(a._id) - distances.get(b._id);
        };
      }

      // Takes in two keys: arrays whose lengths match the number of spec
      // parts. Returns negative, 0, or positive based on using the sort spec to
      // compare fields.
      _compareKeys(key1, key2) {
        if (key1.length !== this._sortSpecParts.length || key2.length !== this._sortSpecParts.length) {
          throw Error('Key has wrong length');
        }
        return this._keyComparator(key1, key2);
      }

      // Iterates over each possible "key" from doc (ie, over each branch), calling
      // 'cb' with the key.
      _generateKeysFromDoc(doc, cb) {
        if (this._sortSpecParts.length === 0) {
          throw new Error('can\'t generate keys without a spec');
        }
        const pathFromIndices = indices => "".concat(indices.join(','), ",");
        let knownPaths = null;

        // maps index -> ({'' -> value} or {path -> value})
        const valuesByIndexAndPath = this._sortSpecParts.map(spec => {
          // Expand any leaf arrays that we find, and ignore those arrays
          // themselves.  (We never sort based on an array itself.)
          let branches = expandArraysInBranches(spec.lookup(doc), true);

          // If there are no values for a key (eg, key goes to an empty array),
          // pretend we found one undefined value.
          if (!branches.length) {
            branches = [{
              value: void 0
            }];
          }
          const element = Object.create(null);
          let usedPaths = false;
          branches.forEach(branch => {
            if (!branch.arrayIndices) {
              // If there are no array indices for a branch, then it must be the
              // only branch, because the only thing that produces multiple branches
              // is the use of arrays.
              if (branches.length > 1) {
                throw Error('multiple branches but no array used?');
              }
              element[''] = branch.value;
              return;
            }
            usedPaths = true;
            const path = pathFromIndices(branch.arrayIndices);
            if (hasOwn.call(element, path)) {
              throw Error("duplicate path: ".concat(path));
            }
            element[path] = branch.value;

            // If two sort fields both go into arrays, they have to go into the
            // exact same arrays and we have to find the same paths.  This is
            // roughly the same condition that makes MongoDB throw this strange
            // error message.  eg, the main thing is that if sort spec is {a: 1,
            // b:1} then a and b cannot both be arrays.
            //
            // (In MongoDB it seems to be OK to have {a: 1, 'a.x.y': 1} where 'a'
            // and 'a.x.y' are both arrays, but we don't allow this for now.
            // #NestedArraySort
            // XXX achieve full compatibility here
            if (knownPaths && !hasOwn.call(knownPaths, path)) {
              throw Error('cannot index parallel arrays');
            }
          });
          if (knownPaths) {
            // Similarly to above, paths must match everywhere, unless this is a
            // non-array field.
            if (!hasOwn.call(element, '') && Object.keys(knownPaths).length !== Object.keys(element).length) {
              throw Error('cannot index parallel arrays!');
            }
          } else if (usedPaths) {
            knownPaths = {};
            Object.keys(element).forEach(path => {
              knownPaths[path] = true;
            });
          }
          return element;
        });
        if (!knownPaths) {
          // Easy case: no use of arrays.
          const soleKey = valuesByIndexAndPath.map(values => {
            if (!hasOwn.call(values, '')) {
              throw Error('no value in sole key case?');
            }
            return values[''];
          });
          cb(soleKey);
          return;
        }
        Object.keys(knownPaths).forEach(path => {
          const key = valuesByIndexAndPath.map(values => {
            if (hasOwn.call(values, '')) {
              return values[''];
            }
            if (!hasOwn.call(values, path)) {
              throw Error('missing path?');
            }
            return values[path];
          });
          cb(key);
        });
      }

      // Returns a comparator that represents the sort specification (but not
      // including a possible geoquery distance tie-breaker).
      _getBaseComparator() {
        if (this._sortFunction) {
          return this._sortFunction;
        }

        // If we're only sorting on geoquery distance and no specs, just say
        // everything is equal.
        if (!this._sortSpecParts.length) {
          return (doc1, doc2) => 0;
        }
        return (doc1, doc2) => {
          const key1 = this._getMinKeyFromDoc(doc1);
          const key2 = this._getMinKeyFromDoc(doc2);
          return this._compareKeys(key1, key2);
        };
      }

      // Finds the minimum key from the doc, according to the sort specs.  (We say
      // "minimum" here but this is with respect to the sort spec, so "descending"
      // sort fields mean we're finding the max for that field.)
      //
      // Note that this is NOT "find the minimum value of the first field, the
      // minimum value of the second field, etc"... it's "choose the
      // lexicographically minimum value of the key vector, allowing only keys which
      // you can find along the same paths".  ie, for a doc {a: [{x: 0, y: 5}, {x:
      // 1, y: 3}]} with sort spec {'a.x': 1, 'a.y': 1}, the only keys are [0,5] and
      // [1,3], and the minimum key is [0,5]; notably, [0,3] is NOT a key.
      _getMinKeyFromDoc(doc) {
        let minKey = null;
        this._generateKeysFromDoc(doc, key => {
          if (minKey === null) {
            minKey = key;
            return;
          }
          if (this._compareKeys(key, minKey) < 0) {
            minKey = key;
          }
        });
        return minKey;
      }
      _getPaths() {
        return this._sortSpecParts.map(part => part.path);
      }

      // Given an index 'i', returns a comparator that compares two key arrays based
      // on field 'i'.
      _keyFieldComparator(i) {
        const invert = !this._sortSpecParts[i].ascending;
        return (key1, key2) => {
          const compare = LocalCollection._f._cmp(key1[i], key2[i]);
          return invert ? -compare : compare;
        };
      }
    }
    // Given an array of comparators
    // (functions (a,b)->(negative or positive or zero)), returns a single
    // comparator which uses each comparator in order and returns the first
    // non-zero value.
    function composeComparators(comparatorArray) {
      return (a, b) => {
        for (let i = 0; i < comparatorArray.length; ++i) {
          const compare = comparatorArray[i](a, b);
          if (compare !== 0) {
            return compare;
          }
        }
        return 0;
      };
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      LocalCollection: LocalCollection,
      Minimongo: Minimongo,
      MinimongoTest: MinimongoTest,
      MinimongoError: MinimongoError
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/minimongo/minimongo_server.js"
  ],
  mainModulePath: "/node_modules/meteor/minimongo/minimongo_server.js"
}});

//# sourceURL=meteor://💻app/packages/minimongo.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL21pbmltb25nb19zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jb25zdGFudHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jdXJzb3IuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9sb2NhbF9jb2xsZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9taW5pbW9uZ28vbWF0Y2hlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL21pbmltb25nb19jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9vYnNlcnZlX2hhbmRsZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL3NvcnRlci5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJsaW5rIiwiaGFzT3duIiwiaXNOdW1lcmljS2V5IiwiaXNPcGVyYXRvck9iamVjdCIsInBhdGhzVG9UcmVlIiwicHJvamVjdGlvbkRldGFpbHMiLCJ2IiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJNaW5pbW9uZ28iLCJfcGF0aHNFbGlkaW5nTnVtZXJpY0tleXMiLCJwYXRocyIsIm1hcCIsInBhdGgiLCJzcGxpdCIsImZpbHRlciIsInBhcnQiLCJqb2luIiwiTWF0Y2hlciIsInByb3RvdHlwZSIsImFmZmVjdGVkQnlNb2RpZmllciIsIm1vZGlmaWVyIiwiT2JqZWN0IiwiYXNzaWduIiwiJHNldCIsIiR1bnNldCIsIm1lYW5pbmdmdWxQYXRocyIsIl9nZXRQYXRocyIsIm1vZGlmaWVkUGF0aHMiLCJjb25jYXQiLCJrZXlzIiwic29tZSIsIm1vZCIsIm1lYW5pbmdmdWxQYXRoIiwic2VsIiwiaSIsImoiLCJsZW5ndGgiLCJjYW5CZWNvbWVUcnVlQnlNb2RpZmllciIsImlzU2ltcGxlIiwibW9kaWZpZXJQYXRocyIsInBhdGhIYXNOdW1lcmljS2V5cyIsImV4cGVjdGVkU2NhbGFySXNPYmplY3QiLCJfc2VsZWN0b3IiLCJtb2RpZmllclBhdGgiLCJzdGFydHNXaXRoIiwibWF0Y2hpbmdEb2N1bWVudCIsIkVKU09OIiwiY2xvbmUiLCJMb2NhbENvbGxlY3Rpb24iLCJfbW9kaWZ5IiwiZXJyb3IiLCJuYW1lIiwic2V0UHJvcGVydHlFcnJvciIsImRvY3VtZW50TWF0Y2hlcyIsInJlc3VsdCIsImNvbWJpbmVJbnRvUHJvamVjdGlvbiIsInByb2plY3Rpb24iLCJzZWxlY3RvclBhdGhzIiwiaW5jbHVkZXMiLCJjb21iaW5lSW1wb3J0YW50UGF0aHNJbnRvUHJvamVjdGlvbiIsIl9tYXRjaGluZ0RvY3VtZW50IiwidW5kZWZpbmVkIiwiZmFsbGJhY2siLCJ2YWx1ZVNlbGVjdG9yIiwiJGVxIiwiJGluIiwibWF0Y2hlciIsInBsYWNlaG9sZGVyIiwiZmluZCIsIm9ubHlDb250YWluc0tleXMiLCJsb3dlckJvdW5kIiwiSW5maW5pdHkiLCJ1cHBlckJvdW5kIiwiZm9yRWFjaCIsIm9wIiwiY2FsbCIsIm1pZGRsZSIsIngiLCJTb3J0ZXIiLCJfc2VsZWN0b3JGb3JBZmZlY3RlZEJ5TW9kaWZpZXIiLCJkZXRhaWxzIiwidHJlZSIsIm5vZGUiLCJmdWxsUGF0aCIsIm1lcmdlZFByb2plY3Rpb24iLCJ0cmVlVG9QYXRocyIsImluY2x1ZGluZyIsIm1lcmdlZEV4Y2xQcm9qZWN0aW9uIiwiZ2V0UGF0aHMiLCJzZWxlY3RvciIsIl9wYXRocyIsIm9iaiIsImV2ZXJ5IiwiayIsInByZWZpeCIsImFyZ3VtZW50cyIsImtleSIsInZhbHVlIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiZXhwb3J0IiwiTWluaU1vbmdvUXVlcnlFcnJvciIsIkVMRU1FTlRfT1BFUkFUT1JTIiwiY29tcGlsZURvY3VtZW50U2VsZWN0b3IiLCJlcXVhbGl0eUVsZW1lbnRNYXRjaGVyIiwiZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyIsImlzSW5kZXhhYmxlIiwibWFrZUxvb2t1cEZ1bmN0aW9uIiwibm90aGluZ01hdGNoZXIiLCJwb3B1bGF0ZURvY3VtZW50V2l0aFF1ZXJ5RmllbGRzIiwicmVnZXhwRWxlbWVudE1hdGNoZXIiLCJkZWZhdWx0IiwiaGFzT3duUHJvcGVydHkiLCJFcnJvciIsIiRsdCIsIm1ha2VJbmVxdWFsaXR5IiwiY21wVmFsdWUiLCIkZ3QiLCIkbHRlIiwiJGd0ZSIsIiRtb2QiLCJjb21waWxlRWxlbWVudFNlbGVjdG9yIiwib3BlcmFuZCIsIkFycmF5IiwiaXNBcnJheSIsImRpdmlzb3IiLCJyZW1haW5kZXIiLCJlbGVtZW50TWF0Y2hlcnMiLCJvcHRpb24iLCJSZWdFeHAiLCIkc2l6ZSIsImRvbnRFeHBhbmRMZWFmQXJyYXlzIiwiJHR5cGUiLCJkb250SW5jbHVkZUxlYWZBcnJheXMiLCJvcGVyYW5kQWxpYXNNYXAiLCJfZiIsIl90eXBlIiwiJGJpdHNBbGxTZXQiLCJtYXNrIiwiZ2V0T3BlcmFuZEJpdG1hc2siLCJiaXRtYXNrIiwiZ2V0VmFsdWVCaXRtYXNrIiwiYnl0ZSIsIiRiaXRzQW55U2V0IiwiJGJpdHNBbGxDbGVhciIsIiRiaXRzQW55Q2xlYXIiLCIkcmVnZXgiLCJyZWdleHAiLCIkb3B0aW9ucyIsInRlc3QiLCJzb3VyY2UiLCIkZWxlbU1hdGNoIiwiX2lzUGxhaW5PYmplY3QiLCJpc0RvY01hdGNoZXIiLCJMT0dJQ0FMX09QRVJBVE9SUyIsInJlZHVjZSIsImEiLCJiIiwic3ViTWF0Y2hlciIsImluRWxlbU1hdGNoIiwiY29tcGlsZVZhbHVlU2VsZWN0b3IiLCJhcnJheUVsZW1lbnQiLCJhcmciLCJkb250SXRlcmF0ZSIsIiRhbmQiLCJzdWJTZWxlY3RvciIsImFuZERvY3VtZW50TWF0Y2hlcnMiLCJjb21waWxlQXJyYXlPZkRvY3VtZW50U2VsZWN0b3JzIiwiJG9yIiwibWF0Y2hlcnMiLCJkb2MiLCJmbiIsIiRub3IiLCIkd2hlcmUiLCJzZWxlY3RvclZhbHVlIiwiX3JlY29yZFBhdGhVc2VkIiwiX2hhc1doZXJlIiwiRnVuY3Rpb24iLCIkY29tbWVudCIsIlZBTFVFX09QRVJBVE9SUyIsImNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyIiwiJG5vdCIsImludmVydEJyYW5jaGVkTWF0Y2hlciIsIiRuZSIsIiRuaW4iLCIkZXhpc3RzIiwiZXhpc3RzIiwiZXZlcnl0aGluZ01hdGNoZXIiLCIkbWF4RGlzdGFuY2UiLCIkbmVhciIsIiRhbGwiLCJicmFuY2hlZE1hdGNoZXJzIiwiY3JpdGVyaW9uIiwiYW5kQnJhbmNoZWRNYXRjaGVycyIsImlzUm9vdCIsIl9oYXNHZW9RdWVyeSIsIm1heERpc3RhbmNlIiwicG9pbnQiLCJkaXN0YW5jZSIsIiRnZW9tZXRyeSIsInR5cGUiLCJHZW9KU09OIiwicG9pbnREaXN0YW5jZSIsImNvb3JkaW5hdGVzIiwicG9pbnRUb0FycmF5IiwiZ2VvbWV0cnlXaXRoaW5SYWRpdXMiLCJkaXN0YW5jZUNvb3JkaW5hdGVQYWlycyIsImJyYW5jaGVkVmFsdWVzIiwiYnJhbmNoIiwiY3VyRGlzdGFuY2UiLCJfaXNVcGRhdGUiLCJhcnJheUluZGljZXMiLCJhbmRTb21lTWF0Y2hlcnMiLCJzdWJNYXRjaGVycyIsImRvY09yQnJhbmNoZXMiLCJtYXRjaCIsInN1YlJlc3VsdCIsInNlbGVjdG9ycyIsImRvY1NlbGVjdG9yIiwib3B0aW9ucyIsImRvY01hdGNoZXJzIiwic3Vic3RyIiwiX2lzU2ltcGxlIiwibG9va1VwQnlJbmRleCIsInZhbHVlTWF0Y2hlciIsIkJvb2xlYW4iLCJvcGVyYXRvckJyYW5jaGVkTWF0Y2hlciIsImVsZW1lbnRNYXRjaGVyIiwiYnJhbmNoZXMiLCJleHBhbmRlZCIsImVsZW1lbnQiLCJtYXRjaGVkIiwicG9pbnRBIiwicG9pbnRCIiwiTWF0aCIsImh5cG90IiwiZWxlbWVudFNlbGVjdG9yIiwiX2VxdWFsIiwiZG9jT3JCcmFuY2hlZFZhbHVlcyIsInNraXBUaGVBcnJheXMiLCJicmFuY2hlc091dCIsInRoaXNJc0FycmF5IiwicHVzaCIsIk51bWJlciIsImlzSW50ZWdlciIsIlVpbnQ4QXJyYXkiLCJJbnQzMkFycmF5IiwiYnVmZmVyIiwiaXNCaW5hcnkiLCJBcnJheUJ1ZmZlciIsIm1heCIsInZpZXciLCJpc1NhZmVJbnRlZ2VyIiwiVWludDMyQXJyYXkiLCJCWVRFU19QRVJfRUxFTUVOVCIsImluc2VydEludG9Eb2N1bWVudCIsImRvY3VtZW50IiwiZXhpc3RpbmdLZXkiLCJpbmRleE9mIiwiYnJhbmNoZWRNYXRjaGVyIiwiYnJhbmNoVmFsdWVzIiwicyIsImluY29uc2lzdGVudE9LIiwidGhlc2VBcmVPcGVyYXRvcnMiLCJzZWxLZXkiLCJ0aGlzSXNPcGVyYXRvciIsIkpTT04iLCJzdHJpbmdpZnkiLCJjbXBWYWx1ZUNvbXBhcmF0b3IiLCJvcGVyYW5kVHlwZSIsIl9jbXAiLCJwYXJ0cyIsImZpcnN0UGFydCIsImxvb2t1cFJlc3QiLCJzbGljZSIsImJ1aWxkUmVzdWx0IiwiZmlyc3RMZXZlbCIsImFwcGVuZFRvUmVzdWx0IiwibW9yZSIsImZvclNvcnQiLCJhcnJheUluZGV4IiwiTWluaW1vbmdvVGVzdCIsIk1pbmltb25nb0Vycm9yIiwibWVzc2FnZSIsImZpZWxkIiwib3BlcmF0b3JNYXRjaGVycyIsIm9wZXJhdG9yIiwic2ltcGxlUmFuZ2UiLCJzaW1wbGVFcXVhbGl0eSIsInNpbXBsZUluY2x1c2lvbiIsIm5ld0xlYWZGbiIsImNvbmZsaWN0Rm4iLCJyb290IiwicGF0aEFycmF5Iiwic3VjY2VzcyIsImxhc3RLZXkiLCJ5IiwicG9wdWxhdGVEb2N1bWVudFdpdGhLZXlWYWx1ZSIsImdldFByb3RvdHlwZU9mIiwicG9wdWxhdGVEb2N1bWVudFdpdGhPYmplY3QiLCJ1bnByZWZpeGVkS2V5cyIsInZhbGlkYXRlT2JqZWN0Iiwib2JqZWN0IiwicXVlcnkiLCJfc2VsZWN0b3JJc0lkIiwiZmllbGRzIiwiZmllbGRzS2V5cyIsInNvcnQiLCJfaWQiLCJrZXlQYXRoIiwicnVsZSIsInByb2plY3Rpb25SdWxlc1RyZWUiLCJjdXJyZW50UGF0aCIsImFub3RoZXJQYXRoIiwidG9TdHJpbmciLCJsYXN0SW5kZXgiLCJ2YWxpZGF0ZUtleUluUGF0aCIsImdldEFzeW5jTWV0aG9kTmFtZSIsIkFTWU5DX0NPTExFQ1RJT05fTUVUSE9EUyIsIkFTWU5DX0NVUlNPUl9NRVRIT0RTIiwiQ0xJRU5UX09OTFlfTUVUSE9EUyIsIm1ldGhvZCIsInJlcGxhY2UiLCJDdXJzb3IiLCJjb25zdHJ1Y3RvciIsImNvbGxlY3Rpb24iLCJzb3J0ZXIiLCJfc2VsZWN0b3JJc0lkUGVyaGFwc0FzT2JqZWN0IiwiX3NlbGVjdG9ySWQiLCJoYXNHZW9RdWVyeSIsInNraXAiLCJsaW1pdCIsIl9wcm9qZWN0aW9uRm4iLCJfY29tcGlsZVByb2plY3Rpb24iLCJfdHJhbnNmb3JtIiwid3JhcFRyYW5zZm9ybSIsInRyYW5zZm9ybSIsIlRyYWNrZXIiLCJyZWFjdGl2ZSIsImNvdW50IiwiX2RlcGVuZCIsImFkZGVkIiwicmVtb3ZlZCIsIl9nZXRSYXdPYmplY3RzIiwib3JkZXJlZCIsImZldGNoIiwiU3ltYm9sIiwiaXRlcmF0b3IiLCJhZGRlZEJlZm9yZSIsImNoYW5nZWQiLCJtb3ZlZEJlZm9yZSIsImluZGV4Iiwib2JqZWN0cyIsIm5leHQiLCJkb25lIiwiYXN5bmNJdGVyYXRvciIsInN5bmNSZXN1bHQiLCJQcm9taXNlIiwicmVzb2x2ZSIsImNhbGxiYWNrIiwidGhpc0FyZyIsImdldFRyYW5zZm9ybSIsIm9ic2VydmUiLCJfb2JzZXJ2ZUZyb21PYnNlcnZlQ2hhbmdlcyIsIm9ic2VydmVBc3luYyIsIm9ic2VydmVDaGFuZ2VzIiwiX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZCIsIl9hbGxvd191bm9yZGVyZWQiLCJkaXN0YW5jZXMiLCJfSWRNYXAiLCJjdXJzb3IiLCJkaXJ0eSIsInByb2plY3Rpb25GbiIsInJlc3VsdHNTbmFwc2hvdCIsInFpZCIsIm5leHRfcWlkIiwicXVlcmllcyIsInJlc3VsdHMiLCJwYXVzZWQiLCJ3cmFwQ2FsbGJhY2siLCJhcmdzIiwiX29ic2VydmVRdWV1ZSIsInF1ZXVlVGFzayIsImFwcGx5IiwiX3N1cHByZXNzX2luaXRpYWwiLCJfcXVlcnkkcmVzdWx0cyIsIl9xdWVyeSRyZXN1bHRzJHNpemUiLCJoYW5kbGVyIiwic2l6ZSIsImhhbmRsZSIsIk9ic2VydmVIYW5kbGUiLCJzdG9wIiwiaXNSZWFkeSIsImlzUmVhZHlQcm9taXNlIiwiYWN0aXZlIiwib25JbnZhbGlkYXRlIiwiZHJhaW5SZXN1bHQiLCJkcmFpbiIsInRoZW4iLCJvYnNlcnZlQ2hhbmdlc0FzeW5jIiwiY2hhbmdlcnMiLCJkZXBlbmRlbmN5IiwiRGVwZW5kZW5jeSIsIm5vdGlmeSIsImJpbmQiLCJkZXBlbmQiLCJfZ2V0Q29sbGVjdGlvbk5hbWUiLCJhcHBseVNraXBMaW1pdCIsInNlbGVjdGVkRG9jIiwiX2RvY3MiLCJnZXQiLCJzZXQiLCJjbGVhciIsIk1ldGVvciIsIl9ydW5GcmVzaCIsImlkIiwibWF0Y2hSZXN1bHQiLCJnZXRDb21wYXJhdG9yIiwiX3B1Ymxpc2hDdXJzb3IiLCJzdWJzY3JpcHRpb24iLCJQYWNrYWdlIiwibW9uZ28iLCJNb25nbyIsIkNvbGxlY3Rpb24iLCJhc3luY05hbWUiLCJfbGVuIiwiX2tleSIsInJlamVjdCIsIl9vYmplY3RTcHJlYWQiLCJpc0NsaWVudCIsIl9TeW5jaHJvbm91c1F1ZXVlIiwiX0FzeW5jaHJvbm91c1F1ZXVlIiwiY3JlYXRlIiwiX3NhdmVkT3JpZ2luYWxzIiwiY291bnREb2N1bWVudHMiLCJjb3VudEFzeW5jIiwiZXN0aW1hdGVkRG9jdW1lbnRDb3VudCIsImZpbmRPbmUiLCJmaW5kT25lQXN5bmMiLCJmZXRjaEFzeW5jIiwicHJlcGFyZUluc2VydCIsImFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyIsIl91c2VPSUQiLCJNb25nb0lEIiwiT2JqZWN0SUQiLCJSYW5kb20iLCJoYXMiLCJfc2F2ZU9yaWdpbmFsIiwiaW5zZXJ0IiwicXVlcmllc1RvUmVjb21wdXRlIiwiX2luc2VydEluUmVzdWx0c1N5bmMiLCJfcmVjb21wdXRlUmVzdWx0cyIsImRlZmVyIiwiaW5zZXJ0QXN5bmMiLCJfaW5zZXJ0SW5SZXN1bHRzQXN5bmMiLCJwYXVzZU9ic2VydmVycyIsImNsZWFyUmVzdWx0UXVlcmllcyIsInByZXBhcmVSZW1vdmUiLCJyZW1vdmUiLCJfZWFjaFBvc3NpYmx5TWF0Y2hpbmdEb2NTeW5jIiwicXVlcnlSZW1vdmUiLCJyZW1vdmVJZCIsInJlbW92ZURvYyIsImVxdWFscyIsIl9yZW1vdmVGcm9tUmVzdWx0c1N5bmMiLCJyZW1vdmVBc3luYyIsIl9yZW1vdmVGcm9tUmVzdWx0c0FzeW5jIiwiX3Jlc3VtZU9ic2VydmVycyIsIl9kaWZmUXVlcnlDaGFuZ2VzIiwicmVzdW1lT2JzZXJ2ZXJzU2VydmVyIiwicmVzdW1lT2JzZXJ2ZXJzQ2xpZW50IiwicmV0cmlldmVPcmlnaW5hbHMiLCJvcmlnaW5hbHMiLCJzYXZlT3JpZ2luYWxzIiwicHJlcGFyZVVwZGF0ZSIsInFpZFRvT3JpZ2luYWxSZXN1bHRzIiwiZG9jTWFwIiwiaWRzTWF0Y2hlZCIsIl9pZHNNYXRjaGVkQnlTZWxlY3RvciIsIm1lbW9pemVkQ2xvbmVJZk5lZWRlZCIsImRvY1RvTWVtb2l6ZSIsImZpbmlzaFVwZGF0ZSIsIl9yZWYiLCJ1cGRhdGVDb3VudCIsImluc2VydGVkSWQiLCJfcmV0dXJuT2JqZWN0IiwibnVtYmVyQWZmZWN0ZWQiLCJ1cGRhdGVBc3luYyIsInJlY29tcHV0ZVFpZHMiLCJfZWFjaFBvc3NpYmx5TWF0Y2hpbmdEb2NBc3luYyIsInF1ZXJ5UmVzdWx0IiwiX21vZGlmeUFuZE5vdGlmeUFzeW5jIiwibXVsdGkiLCJ1cHNlcnQiLCJfY3JlYXRlVXBzZXJ0RG9jdW1lbnQiLCJ1cGRhdGUiLCJfbW9kaWZ5QW5kTm90aWZ5U3luYyIsInVwc2VydEFzeW5jIiwic3BlY2lmaWNJZHMiLCJmb3JFYWNoQXN5bmMiLCJfZ2V0TWF0Y2hlZERvY0FuZE1vZGlmeSIsIm1hdGNoZWRfYmVmb3JlIiwib2xkX2RvYyIsImFmdGVyTWF0Y2giLCJhZnRlciIsImJlZm9yZSIsIl91cGRhdGVJblJlc3VsdHNTeW5jIiwiX3VwZGF0ZUluUmVzdWx0c0FzeW5jIiwib2xkUmVzdWx0cyIsIl9DYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIiLCJvcmRlcmVkRnJvbUNhbGxiYWNrcyIsImNhbGxiYWNrcyIsImRvY3MiLCJPcmRlcmVkRGljdCIsImlkU3RyaW5naWZ5IiwiYXBwbHlDaGFuZ2UiLCJwdXRCZWZvcmUiLCJtb3ZlQmVmb3JlIiwiRGlmZlNlcXVlbmNlIiwiYXBwbHlDaGFuZ2VzIiwiSWRNYXAiLCJpZFBhcnNlIiwiX193cmFwcGVkVHJhbnNmb3JtX18iLCJ3cmFwcGVkIiwidHJhbnNmb3JtZWQiLCJub25yZWFjdGl2ZSIsIl9iaW5hcnlTZWFyY2giLCJjbXAiLCJhcnJheSIsImZpcnN0IiwicmFuZ2UiLCJoYWxmUmFuZ2UiLCJmbG9vciIsIl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24iLCJfaWRQcm9qZWN0aW9uIiwicnVsZVRyZWUiLCJzdWJkb2MiLCJzZWxlY3RvckRvY3VtZW50IiwiaXNNb2RpZnkiLCJfaXNNb2RpZmljYXRpb25Nb2QiLCJuZXdEb2MiLCJpc0luc2VydCIsInJlcGxhY2VtZW50IiwiX2RpZmZPYmplY3RzIiwibGVmdCIsInJpZ2h0IiwiZGlmZk9iamVjdHMiLCJuZXdSZXN1bHRzIiwib2JzZXJ2ZXIiLCJkaWZmUXVlcnlDaGFuZ2VzIiwiX2RpZmZRdWVyeU9yZGVyZWRDaGFuZ2VzIiwiZGlmZlF1ZXJ5T3JkZXJlZENoYW5nZXMiLCJfZGlmZlF1ZXJ5VW5vcmRlcmVkQ2hhbmdlcyIsImRpZmZRdWVyeVVub3JkZXJlZENoYW5nZXMiLCJfZmluZEluT3JkZXJlZFJlc3VsdHMiLCJzdWJJZHMiLCJfaW5zZXJ0SW5Tb3J0ZWRMaXN0Iiwic3BsaWNlIiwiaXNSZXBsYWNlIiwiaXNNb2RpZmllciIsInNldE9uSW5zZXJ0IiwibW9kRnVuYyIsIk1PRElGSUVSUyIsImtleXBhdGgiLCJrZXlwYXJ0cyIsInRhcmdldCIsImZpbmRNb2RUYXJnZXQiLCJmb3JiaWRBcnJheSIsIm5vQ3JlYXRlIiwiTk9fQ1JFQVRFX01PRElGSUVSUyIsInBvcCIsIm9ic2VydmVDYWxsYmFja3MiLCJzdXBwcmVzc2VkIiwib2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3MiLCJfb2JzZXJ2ZUNhbGxiYWNrc0FyZU9yZGVyZWQiLCJpbmRpY2VzIiwiX25vX2luZGljZXMiLCJjaGVjayIsImFkZGVkQXQiLCJjaGFuZ2VkQXQiLCJvbGREb2MiLCJtb3ZlZFRvIiwiZnJvbSIsInRvIiwicmVtb3ZlZEF0IiwiY2hhbmdlT2JzZXJ2ZXIiLCJfZnJvbU9ic2VydmUiLCJub25NdXRhdGluZ0NhbGxiYWNrcyIsInNldFN1cHByZXNzZWQiLCJoIiwiX2gkaXNSZWFkeVByb21pc2UiLCJfaXNQcm9taXNlIiwiY2hhbmdlZEZpZWxkcyIsIm1ha2VDaGFuZ2VkRmllbGRzIiwib2xkX2lkeCIsIm5ld19pZHgiLCIkY3VycmVudERhdGUiLCJEYXRlIiwiJGluYyIsIiRtaW4iLCIkbWF4IiwiJG11bCIsIiRyZW5hbWUiLCJ0YXJnZXQyIiwiJHNldE9uSW5zZXJ0IiwiJHB1c2giLCIkZWFjaCIsInRvUHVzaCIsInBvc2l0aW9uIiwiJHBvc2l0aW9uIiwiJHNsaWNlIiwic29ydEZ1bmN0aW9uIiwiJHNvcnQiLCJzcGxpY2VBcmd1bWVudHMiLCIkcHVzaEFsbCIsIiRhZGRUb1NldCIsImlzRWFjaCIsInZhbHVlcyIsInRvQWRkIiwiJHBvcCIsInRvUG9wIiwiJHB1bGwiLCJ0b1B1bGwiLCJvdXQiLCIkcHVsbEFsbCIsIiRiaXQiLCIkdiIsImludmFsaWRDaGFyTXNnIiwiJCIsImFzc2VydElzVmFsaWRGaWVsZE5hbWUiLCJ1c2VkQXJyYXlJbmRleCIsImxhc3QiLCJrZXlwYXJ0IiwicGFyc2VJbnQiLCJEZWNpbWFsIiwiX1BhY2thZ2UkbW9uZ29EZWNpbWEiLCJEZWNpbWFsU3R1YiIsImlzVXBkYXRlIiwiX2RvY01hdGNoZXIiLCJfY29tcGlsZVNlbGVjdG9yIiwiaGFzV2hlcmUiLCJrZXlPcmRlclNlbnNpdGl2ZSIsIl90eXBlb3JkZXIiLCJ0IiwidGEiLCJ0YiIsIm9hIiwib2IiLCJ0b0hleFN0cmluZyIsImlzTmFOIiwiZ2V0VGltZSIsIm1pbnVzIiwidG9OdW1iZXIiLCJ0b0FycmF5IiwiTG9jYWxDb2xsZWN0aW9uXyIsInNwZWMiLCJfc29ydFNwZWNQYXJ0cyIsIl9zb3J0RnVuY3Rpb24iLCJhZGRTcGVjUGFydCIsImFzY2VuZGluZyIsImNoYXJBdCIsImxvb2t1cCIsIl9rZXlDb21wYXJhdG9yIiwiY29tcG9zZUNvbXBhcmF0b3JzIiwiX2tleUZpZWxkQ29tcGFyYXRvciIsIl9nZXRCYXNlQ29tcGFyYXRvciIsIl9jb21wYXJlS2V5cyIsImtleTEiLCJrZXkyIiwiX2dlbmVyYXRlS2V5c0Zyb21Eb2MiLCJjYiIsInBhdGhGcm9tSW5kaWNlcyIsImtub3duUGF0aHMiLCJ2YWx1ZXNCeUluZGV4QW5kUGF0aCIsInVzZWRQYXRocyIsInNvbGVLZXkiLCJkb2MxIiwiZG9jMiIsIl9nZXRNaW5LZXlGcm9tRG9jIiwibWluS2V5IiwiaW52ZXJ0IiwiY29tcGFyZSIsImNvbXBhcmF0b3JBcnJheSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUFBLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLHVCQUF1QixDQUFDO0lBQUMsSUFBSUMsTUFBTSxFQUFDQyxZQUFZLEVBQUNDLGdCQUFnQixFQUFDQyxXQUFXLEVBQUNDLGlCQUFpQjtJQUFDTixNQUFNLENBQUNDLElBQUksQ0FBQyxhQUFhLEVBQUM7TUFBQ0MsTUFBTUEsQ0FBQ0ssQ0FBQyxFQUFDO1FBQUNMLE1BQU0sR0FBQ0ssQ0FBQztNQUFBLENBQUM7TUFBQ0osWUFBWUEsQ0FBQ0ksQ0FBQyxFQUFDO1FBQUNKLFlBQVksR0FBQ0ksQ0FBQztNQUFBLENBQUM7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QixDQUFDLEVBQUU7UUFDckIsTUFBTXdvQixNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUN4QixjQUFjLENBQUNobkIsQ0FBQyxDQUFDLENBQUNtbkIsU0FBUztRQUVoRCxPQUFPLENBQUNRLElBQUksRUFBRUMsSUFBSSxLQUFLO1VBQ3JCLE1BQU1hLE9BQU8sR0FBRzNuQixlQUFlLENBQUN5RixFQUFFLENBQUN1SSxJQUFJLENBQUM2WSxJQUFJLENBQUMzbkIsQ0FBQyxDQUFDLEVBQUU0bkIsSUFBSSxDQUFDNW5CLENBQUMsQ0FBQyxDQUFDO1VBQ3pELE9BQU93b0IsTUFBTSxHQUFHLENBQUNDLE9BQU8sR0FBR0EsT0FBTztRQUNwQyxDQUFDO01BQ0g7SUFDRjtJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsU0FBU2xCLGtCQUFrQkEsQ0FBQ21CLGVBQWUsRUFBRTtNQUMzQyxPQUFPLENBQUM5Z0IsQ0FBQyxFQUFFQyxDQUFDLEtBQUs7UUFDZixLQUFLLElBQUk3SCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcwb0IsZUFBZSxDQUFDeG9CLE1BQU0sRUFBRSxFQUFFRixDQUFDLEVBQUU7VUFDL0MsTUFBTXlvQixPQUFPLEdBQUdDLGVBQWUsQ0FBQzFvQixDQUFDLENBQUMsQ0FBQzRILENBQUMsRUFBRUMsQ0FBQyxDQUFDO1VBQ3hDLElBQUk0Z0IsT0FBTyxLQUFLLENBQUMsRUFBRTtZQUNqQixPQUFPQSxPQUFPO1VBQ2hCO1FBQ0Y7UUFFQSxPQUFPLENBQUM7TUFDVixDQUFDO0lBQ0g7SUFBQ3prQixzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9taW5pbW9uZ28uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgJy4vbWluaW1vbmdvX2NvbW1vbi5qcyc7XG5pbXBvcnQge1xuICBoYXNPd24sXG4gIGlzTnVtZXJpY0tleSxcbiAgaXNPcGVyYXRvck9iamVjdCxcbiAgcGF0aHNUb1RyZWUsXG4gIHByb2plY3Rpb25EZXRhaWxzLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbk1pbmltb25nby5fcGF0aHNFbGlkaW5nTnVtZXJpY0tleXMgPSBwYXRocyA9PiBwYXRocy5tYXAocGF0aCA9PlxuICBwYXRoLnNwbGl0KCcuJykuZmlsdGVyKHBhcnQgPT4gIWlzTnVtZXJpY0tleShwYXJ0KSkuam9pbignLicpXG4pO1xuXG4vLyBSZXR1cm5zIHRydWUgaWYgdGhlIG1vZGlmaWVyIGFwcGxpZWQgdG8gc29tZSBkb2N1bWVudCBtYXkgY2hhbmdlIHRoZSByZXN1bHRcbi8vIG9mIG1hdGNoaW5nIHRoZSBkb2N1bWVudCBieSBzZWxlY3RvclxuLy8gVGhlIG1vZGlmaWVyIGlzIGFsd2F5cyBpbiBhIGZvcm0gb2YgT2JqZWN0OlxuLy8gIC0gJHNldFxuLy8gICAgLSAnYS5iLjIyLnonOiB2YWx1ZVxuLy8gICAgLSAnZm9vLmJhcic6IDQyXG4vLyAgLSAkdW5zZXRcbi8vICAgIC0gJ2FiYy5kJzogMVxuTWluaW1vbmdvLk1hdGNoZXIucHJvdG90eXBlLmFmZmVjdGVkQnlNb2RpZmllciA9IGZ1bmN0aW9uKG1vZGlmaWVyKSB7XG4gIC8vIHNhZmUgY2hlY2sgZm9yICRzZXQvJHVuc2V0IGJlaW5nIG9iamVjdHNcbiAgbW9kaWZpZXIgPSBPYmplY3QuYXNzaWduKHskc2V0OiB7fSwgJHVuc2V0OiB7fX0sIG1vZGlmaWVyKTtcblxuICBjb25zdCBtZWFuaW5nZnVsUGF0aHMgPSB0aGlzLl9nZXRQYXRocygpO1xuICBjb25zdCBtb2RpZmllZFBhdGhzID0gW10uY29uY2F0KFxuICAgIE9iamVjdC5rZXlzKG1vZGlmaWVyLiRzZXQpLFxuICAgIE9iamVjdC5rZXlzKG1vZGlmaWVyLiR1bnNldClcbiAgKTtcblxuICByZXR1cm4gbW9kaWZpZWRQYXRocy5zb21lKHBhdGggPT4ge1xuICAgIGNvbnN0IG1vZCA9IHBhdGguc3BsaXQoJy4nKTtcblxuICAgIHJldHVybiBtZWFuaW5nZnVsUGF0aHMuc29tZShtZWFuaW5nZnVsUGF0aCA9PiB7XG4gICAgICBjb25zdCBzZWwgPSBtZWFuaW5nZnVsUGF0aC5zcGxpdCgnLicpO1xuXG4gICAgICBsZXQgaSA9IDAsIGogPSAwO1xuXG4gICAgICB3aGlsZSAoaSA8IHNlbC5sZW5ndGggJiYgaiA8IG1vZC5sZW5ndGgpIHtcbiAgICAgICAgaWYgKGlzTnVtZXJpY0tleShzZWxbaV0pICYmIGlzTnVtZXJpY0tleShtb2Rbal0pKSB7XG4gICAgICAgICAgLy8gZm9vLjQuYmFyIHNlbGVjdG9yIGFmZmVjdGVkIGJ5IGZvby40IG1vZGlmaWVyXG4gICAgICAgICAgLy8gZm9vLjMuYmFyIHNlbGVjdG9yIHVuYWZmZWN0ZWQgYnkgZm9vLjQgbW9kaWZpZXJcbiAgICAgICAgICBpZiAoc2VsW2ldID09PSBtb2Rbal0pIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIGorKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChpc051bWVyaWNLZXkoc2VsW2ldKSkge1xuICAgICAgICAgIC8vIGZvby40LmJhciBzZWxlY3RvciB1bmFmZmVjdGVkIGJ5IGZvby5iYXIgbW9kaWZpZXJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNOdW1lcmljS2V5KG1vZFtqXSkpIHtcbiAgICAgICAgICBqKys7XG4gICAgICAgIH0gZWxzZSBpZiAoc2VsW2ldID09PSBtb2Rbal0pIHtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgaisrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBPbmUgaXMgYSBwcmVmaXggb2YgYW5vdGhlciwgdGFraW5nIG51bWVyaWMgZmllbGRzIGludG8gYWNjb3VudFxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH0pO1xufTtcblxuLy8gQHBhcmFtIG1vZGlmaWVyIC0gT2JqZWN0OiBNb25nb0RCLXN0eWxlZCBtb2RpZmllciB3aXRoIGAkc2V0YHMgYW5kIGAkdW5zZXRzYFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICBvbmx5LiAoYXNzdW1lZCB0byBjb21lIGZyb20gb3Bsb2cpXG4vLyBAcmV0dXJucyAtIEJvb2xlYW46IGlmIGFmdGVyIGFwcGx5aW5nIHRoZSBtb2RpZmllciwgc2VsZWN0b3IgY2FuIHN0YXJ0XG4vLyAgICAgICAgICAgICAgICAgICAgIGFjY2VwdGluZyB0aGUgbW9kaWZpZWQgdmFsdWUuXG4vLyBOT1RFOiBhc3N1bWVzIHRoYXQgZG9jdW1lbnQgYWZmZWN0ZWQgYnkgbW9kaWZpZXIgZGlkbid0IG1hdGNoIHRoaXMgTWF0Y2hlclxuLy8gYmVmb3JlLCBzbyBpZiBtb2RpZmllciBjYW4ndCBjb252aW5jZSBzZWxlY3RvciBpbiBhIHBvc2l0aXZlIGNoYW5nZSBpdCB3b3VsZFxuLy8gc3RheSAnZmFsc2UnLlxuLy8gQ3VycmVudGx5IGRvZXNuJ3Qgc3VwcG9ydCAkLW9wZXJhdG9ycyBhbmQgbnVtZXJpYyBpbmRpY2VzIHByZWNpc2VseS5cbk1pbmltb25nby5NYXRjaGVyLnByb3RvdHlwZS5jYW5CZWNvbWVUcnVlQnlNb2RpZmllciA9IGZ1bmN0aW9uKG1vZGlmaWVyKSB7XG4gIGlmICghdGhpcy5hZmZlY3RlZEJ5TW9kaWZpZXIobW9kaWZpZXIpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKCF0aGlzLmlzU2ltcGxlKCkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG1vZGlmaWVyID0gT2JqZWN0LmFzc2lnbih7JHNldDoge30sICR1bnNldDoge319LCBtb2RpZmllcik7XG5cbiAgY29uc3QgbW9kaWZpZXJQYXRocyA9IFtdLmNvbmNhdChcbiAgICBPYmplY3Qua2V5cyhtb2RpZmllci4kc2V0KSxcbiAgICBPYmplY3Qua2V5cyhtb2RpZmllci4kdW5zZXQpXG4gICk7XG5cbiAgaWYgKHRoaXMuX2dldFBhdGhzKCkuc29tZShwYXRoSGFzTnVtZXJpY0tleXMpIHx8XG4gICAgICBtb2RpZmllclBhdGhzLnNvbWUocGF0aEhhc051bWVyaWNLZXlzKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYSAkc2V0IG9yICR1bnNldCB0aGF0IGluZGljYXRlcyBzb21ldGhpbmcgaXMgYW5cbiAgLy8gb2JqZWN0IHJhdGhlciB0aGFuIGEgc2NhbGFyIGluIHRoZSBhY3R1YWwgb2JqZWN0IHdoZXJlIHdlIHNhdyAkLW9wZXJhdG9yXG4gIC8vIE5PVEU6IGl0IGlzIGNvcnJlY3Qgc2luY2Ugd2UgYWxsb3cgb25seSBzY2FsYXJzIGluICQtb3BlcmF0b3JzXG4gIC8vIEV4YW1wbGU6IGZvciBzZWxlY3RvciB7J2EuYic6IHskZ3Q6IDV9fSB0aGUgbW9kaWZpZXIgeydhLmIuYyc6N30gd291bGRcbiAgLy8gZGVmaW5pdGVseSBzZXQgdGhlIHJlc3VsdCB0byBmYWxzZSBhcyAnYS5iJyBhcHBlYXJzIHRvIGJlIGFuIG9iamVjdC5cbiAgY29uc3QgZXhwZWN0ZWRTY2FsYXJJc09iamVjdCA9IE9iamVjdC5rZXlzKHRoaXMuX3NlbGVjdG9yKS5zb21lKHBhdGggPT4ge1xuICAgIGlmICghaXNPcGVyYXRvck9iamVjdCh0aGlzLl9zZWxlY3RvcltwYXRoXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gbW9kaWZpZXJQYXRocy5zb21lKG1vZGlmaWVyUGF0aCA9PlxuICAgICAgbW9kaWZpZXJQYXRoLnN0YXJ0c1dpdGgoYCR7cGF0aH0uYClcbiAgICApO1xuICB9KTtcblxuICBpZiAoZXhwZWN0ZWRTY2FsYXJJc09iamVjdCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIFNlZSBpZiB3ZSBjYW4gYXBwbHkgdGhlIG1vZGlmaWVyIG9uIHRoZSBpZGVhbGx5IG1hdGNoaW5nIG9iamVjdC4gSWYgaXRcbiAgLy8gc3RpbGwgbWF0Y2hlcyB0aGUgc2VsZWN0b3IsIHRoZW4gdGhlIG1vZGlmaWVyIGNvdWxkIGhhdmUgdHVybmVkIHRoZSByZWFsXG4gIC8vIG9iamVjdCBpbiB0aGUgZGF0YWJhc2UgaW50byBzb21ldGhpbmcgbWF0Y2hpbmcuXG4gIGNvbnN0IG1hdGNoaW5nRG9jdW1lbnQgPSBFSlNPTi5jbG9uZSh0aGlzLm1hdGNoaW5nRG9jdW1lbnQoKSk7XG5cbiAgLy8gVGhlIHNlbGVjdG9yIGlzIHRvbyBjb21wbGV4LCBhbnl0aGluZyBjYW4gaGFwcGVuLlxuICBpZiAobWF0Y2hpbmdEb2N1bWVudCA9PT0gbnVsbCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBMb2NhbENvbGxlY3Rpb24uX21vZGlmeShtYXRjaGluZ0RvY3VtZW50LCBtb2RpZmllcik7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8gQ291bGRuJ3Qgc2V0IGEgcHJvcGVydHkgb24gYSBmaWVsZCB3aGljaCBpcyBhIHNjYWxhciBvciBudWxsIGluIHRoZVxuICAgIC8vIHNlbGVjdG9yLlxuICAgIC8vIEV4YW1wbGU6XG4gICAgLy8gcmVhbCBkb2N1bWVudDogeyAnYS5iJzogMyB9XG4gICAgLy8gc2VsZWN0b3I6IHsgJ2EnOiAxMiB9XG4gICAgLy8gY29udmVydGVkIHNlbGVjdG9yIChpZGVhbCBkb2N1bWVudCk6IHsgJ2EnOiAxMiB9XG4gICAgLy8gbW9kaWZpZXI6IHsgJHNldDogeyAnYS5iJzogNCB9IH1cbiAgICAvLyBXZSBkb24ndCBrbm93IHdoYXQgcmVhbCBkb2N1bWVudCB3YXMgbGlrZSBidXQgZnJvbSB0aGUgZXJyb3IgcmFpc2VkIGJ5XG4gICAgLy8gJHNldCBvbiBhIHNjYWxhciBmaWVsZCB3ZSBjYW4gcmVhc29uIHRoYXQgdGhlIHN0cnVjdHVyZSBvZiByZWFsIGRvY3VtZW50XG4gICAgLy8gaXMgY29tcGxldGVseSBkaWZmZXJlbnQuXG4gICAgaWYgKGVycm9yLm5hbWUgPT09ICdNaW5pbW9uZ29FcnJvcicgJiYgZXJyb3Iuc2V0UHJvcGVydHlFcnJvcikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgcmV0dXJuIHRoaXMuZG9jdW1lbnRNYXRjaGVzKG1hdGNoaW5nRG9jdW1lbnQpLnJlc3VsdDtcbn07XG5cbi8vIEtub3dzIGhvdyB0byBjb21iaW5lIGEgbW9uZ28gc2VsZWN0b3IgYW5kIGEgZmllbGRzIHByb2plY3Rpb24gdG8gYSBuZXcgZmllbGRzXG4vLyBwcm9qZWN0aW9uIHRha2luZyBpbnRvIGFjY291bnQgYWN0aXZlIGZpZWxkcyBmcm9tIHRoZSBwYXNzZWQgc2VsZWN0b3IuXG4vLyBAcmV0dXJucyBPYmplY3QgLSBwcm9qZWN0aW9uIG9iamVjdCAoc2FtZSBhcyBmaWVsZHMgb3B0aW9uIG9mIG1vbmdvIGN1cnNvcilcbk1pbmltb25nby5NYXRjaGVyLnByb3RvdHlwZS5jb21iaW5lSW50b1Byb2plY3Rpb24gPSBmdW5jdGlvbihwcm9qZWN0aW9uKSB7XG4gIGNvbnN0IHNlbGVjdG9yUGF0aHMgPSBNaW5pbW9uZ28uX3BhdGhzRWxpZGluZ051bWVyaWNLZXlzKHRoaXMuX2dldFBhdGhzKCkpO1xuXG4gIC8vIFNwZWNpYWwgY2FzZSBmb3IgJHdoZXJlIG9wZXJhdG9yIGluIHRoZSBzZWxlY3RvciAtIHByb2plY3Rpb24gc2hvdWxkIGRlcGVuZFxuICAvLyBvbiBhbGwgZmllbGRzIG9mIHRoZSBkb2N1bWVudC4gZ2V0U2VsZWN0b3JQYXRocyByZXR1cm5zIGEgbGlzdCBvZiBwYXRoc1xuICAvLyBzZWxlY3RvciBkZXBlbmRzIG9uLiBJZiBvbmUgb2YgdGhlIHBhdGhzIGlzICcnIChlbXB0eSBzdHJpbmcpIHJlcHJlc2VudGluZ1xuICAvLyB0aGUgcm9vdCBvciB0aGUgd2hvbGUgZG9jdW1lbnQsIGNvbXBsZXRlIHByb2plY3Rpb24gc2hvdWxkIGJlIHJldHVybmVkLlxuICBpZiAoc2VsZWN0b3JQYXRocy5pbmNsdWRlcygnJykpIHtcbiAgICByZXR1cm4ge307XG4gIH1cblxuICByZXR1cm4gY29tYmluZUltcG9ydGFudFBhdGhzSW50b1Byb2plY3Rpb24oc2VsZWN0b3JQYXRocywgcHJvamVjdGlvbik7XG59O1xuXG4vLyBSZXR1cm5zIGFuIG9iamVjdCB0aGF0IHdvdWxkIG1hdGNoIHRoZSBzZWxlY3RvciBpZiBwb3NzaWJsZSBvciBudWxsIGlmIHRoZVxuLy8gc2VsZWN0b3IgaXMgdG9vIGNvbXBsZXggZm9yIHVzIHRvIGFuYWx5emVcbi8vIHsgJ2EuYic6IHsgYW5zOiA0MiB9LCAnZm9vLmJhcic6IG51bGwsICdmb28uYmF6JzogXCJzb21ldGhpbmdcIiB9XG4vLyA9PiB7IGE6IHsgYjogeyBhbnM6IDQyIH0gfSwgZm9vOiB7IGJhcjogbnVsbCwgYmF6OiBcInNvbWV0aGluZ1wiIH0gfVxuTWluaW1vbmdvLk1hdGNoZXIucHJvdG90eXBlLm1hdGNoaW5nRG9jdW1lbnQgPSBmdW5jdGlvbigpIHtcbiAgLy8gY2hlY2sgaWYgaXQgd2FzIGNvbXB1dGVkIGJlZm9yZVxuICBpZiAodGhpcy5fbWF0Y2hpbmdEb2N1bWVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hdGNoaW5nRG9jdW1lbnQ7XG4gIH1cblxuICAvLyBJZiB0aGUgYW5hbHlzaXMgb2YgdGhpcyBzZWxlY3RvciBpcyB0b28gaGFyZCBmb3Igb3VyIGltcGxlbWVudGF0aW9uXG4gIC8vIGZhbGxiYWNrIHRvIFwiWUVTXCJcbiAgbGV0IGZhbGxiYWNrID0gZmFsc2U7XG5cbiAgdGhpcy5fbWF0Y2hpbmdEb2N1bWVudCA9IHBhdGhzVG9UcmVlKFxuICAgIHRoaXMuX2dldFBhdGhzKCksXG4gICAgcGF0aCA9PiB7XG4gICAgICBjb25zdCB2YWx1ZVNlbGVjdG9yID0gdGhpcy5fc2VsZWN0b3JbcGF0aF07XG5cbiAgICAgIGlmIChpc09wZXJhdG9yT2JqZWN0KHZhbHVlU2VsZWN0b3IpKSB7XG4gICAgICAgIC8vIGlmIHRoZXJlIGlzIGEgc3RyaWN0IGVxdWFsaXR5LCB0aGVyZSBpcyBhIGdvb2RcbiAgICAgICAgLy8gY2hhbmNlIHdlIGNhbiB1c2Ugb25lIG9mIHRob3NlIGFzIFwibWF0Y2hpbmdcIlxuICAgICAgICAvLyBkdW1teSB2YWx1ZVxuICAgICAgICBpZiAodmFsdWVTZWxlY3Rvci4kZXEpIHtcbiAgICAgICAgICByZXR1cm4gdmFsdWVTZWxlY3Rvci4kZXE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWVTZWxlY3Rvci4kaW4pIHtcbiAgICAgICAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHtwbGFjZWhvbGRlcjogdmFsdWVTZWxlY3Rvcn0pO1xuXG4gICAgICAgICAgLy8gUmV0dXJuIGFueXRoaW5nIGZyb20gJGluIHRoYXQgbWF0Y2hlcyB0aGUgd2hvbGUgc2VsZWN0b3IgZm9yIHRoaXNcbiAgICAgICAgICAvLyBwYXRoLiBJZiBub3RoaW5nIG1hdGNoZXMsIHJldHVybnMgYHVuZGVmaW5lZGAgYXMgbm90aGluZyBjYW4gbWFrZVxuICAgICAgICAgIC8vIHRoaXMgc2VsZWN0b3IgaW50byBgdHJ1ZWAuXG4gICAgICAgICAgcmV0dXJuIHZhbHVlU2VsZWN0b3IuJGluLmZpbmQocGxhY2Vob2xkZXIgPT5cbiAgICAgICAgICAgIG1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKHtwbGFjZWhvbGRlcn0pLnJlc3VsdFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob25seUNvbnRhaW5zS2V5cyh2YWx1ZVNlbGVjdG9yLCBbJyRndCcsICckZ3RlJywgJyRsdCcsICckbHRlJ10pKSB7XG4gICAgICAgICAgbGV0IGxvd2VyQm91bmQgPSAtSW5maW5pdHk7XG4gICAgICAgICAgbGV0IHVwcGVyQm91bmQgPSBJbmZpbml0eTtcblxuICAgICAgICAgIFsnJGx0ZScsICckbHQnXS5mb3JFYWNoKG9wID0+IHtcbiAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbCh2YWx1ZVNlbGVjdG9yLCBvcCkgJiZcbiAgICAgICAgICAgICAgICB2YWx1ZVNlbGVjdG9yW29wXSA8IHVwcGVyQm91bmQpIHtcbiAgICAgICAgICAgICAgdXBwZXJCb3VuZCA9IHZhbHVlU2VsZWN0b3Jbb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgWyckZ3RlJywgJyRndCddLmZvckVhY2gob3AgPT4ge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHZhbHVlU2VsZWN0b3IsIG9wKSAmJlxuICAgICAgICAgICAgICAgIHZhbHVlU2VsZWN0b3Jbb3BdID4gbG93ZXJCb3VuZCkge1xuICAgICAgICAgICAgICBsb3dlckJvdW5kID0gdmFsdWVTZWxlY3RvcltvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBjb25zdCBtaWRkbGUgPSAobG93ZXJCb3VuZCArIHVwcGVyQm91bmQpIC8gMjtcbiAgICAgICAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHtwbGFjZWhvbGRlcjogdmFsdWVTZWxlY3Rvcn0pO1xuXG4gICAgICAgICAgaWYgKCFtYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyh7cGxhY2Vob2xkZXI6IG1pZGRsZX0pLnJlc3VsdCAmJlxuICAgICAgICAgICAgICAobWlkZGxlID09PSBsb3dlckJvdW5kIHx8IG1pZGRsZSA9PT0gdXBwZXJCb3VuZCkpIHtcbiAgICAgICAgICAgIGZhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbWlkZGxlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9ubHlDb250YWluc0tleXModmFsdWVTZWxlY3RvciwgWyckbmluJywgJyRuZSddKSkge1xuICAgICAgICAgIC8vIFNpbmNlIHRoaXMuX2lzU2ltcGxlIG1ha2VzIHN1cmUgJG5pbiBhbmQgJG5lIGFyZSBub3QgY29tYmluZWQgd2l0aFxuICAgICAgICAgIC8vIG9iamVjdHMgb3IgYXJyYXlzLCB3ZSBjYW4gY29uZmlkZW50bHkgcmV0dXJuIGFuIGVtcHR5IG9iamVjdCBhcyBpdFxuICAgICAgICAgIC8vIG5ldmVyIG1hdGNoZXMgYW55IHNjYWxhci5cbiAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgIH1cblxuICAgICAgICBmYWxsYmFjayA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLl9zZWxlY3RvcltwYXRoXTtcbiAgICB9LFxuICAgIHggPT4geCk7XG5cbiAgaWYgKGZhbGxiYWNrKSB7XG4gICAgdGhpcy5fbWF0Y2hpbmdEb2N1bWVudCA9IG51bGw7XG4gIH1cblxuICByZXR1cm4gdGhpcy5fbWF0Y2hpbmdEb2N1bWVudDtcbn07XG5cbi8vIE1pbmltb25nby5Tb3J0ZXIgZ2V0cyBhIHNpbWlsYXIgbWV0aG9kLCB3aGljaCBkZWxlZ2F0ZXMgdG8gYSBNYXRjaGVyIGl0IG1hZGVcbi8vIGZvciB0aGlzIGV4YWN0IHB1cnBvc2UuXG5NaW5pbW9uZ28uU29ydGVyLnByb3RvdHlwZS5hZmZlY3RlZEJ5TW9kaWZpZXIgPSBmdW5jdGlvbihtb2RpZmllcikge1xuICByZXR1cm4gdGhpcy5fc2VsZWN0b3JGb3JBZmZlY3RlZEJ5TW9kaWZpZXIuYWZmZWN0ZWRCeU1vZGlmaWVyKG1vZGlmaWVyKTtcbn07XG5cbk1pbmltb25nby5Tb3J0ZXIucHJvdG90eXBlLmNvbWJpbmVJbnRvUHJvamVjdGlvbiA9IGZ1bmN0aW9uKHByb2plY3Rpb24pIHtcbiAgcmV0dXJuIGNvbWJpbmVJbXBvcnRhbnRQYXRoc0ludG9Qcm9qZWN0aW9uKFxuICAgIE1pbmltb25nby5fcGF0aHNFbGlkaW5nTnVtZXJpY0tleXModGhpcy5fZ2V0UGF0aHMoKSksXG4gICAgcHJvamVjdGlvblxuICApO1xufTtcblxuZnVuY3Rpb24gY29tYmluZUltcG9ydGFudFBhdGhzSW50b1Byb2plY3Rpb24ocGF0aHMsIHByb2plY3Rpb24pIHtcbiAgY29uc3QgZGV0YWlscyA9IHByb2plY3Rpb25EZXRhaWxzKHByb2plY3Rpb24pO1xuXG4gIC8vIG1lcmdlIHRoZSBwYXRocyB0byBpbmNsdWRlXG4gIGNvbnN0IHRyZWUgPSBwYXRoc1RvVHJlZShcbiAgICBwYXRocyxcbiAgICBwYXRoID0+IHRydWUsXG4gICAgKG5vZGUsIHBhdGgsIGZ1bGxQYXRoKSA9PiB0cnVlLFxuICAgIGRldGFpbHMudHJlZVxuICApO1xuICBjb25zdCBtZXJnZWRQcm9qZWN0aW9uID0gdHJlZVRvUGF0aHModHJlZSk7XG5cbiAgaWYgKGRldGFpbHMuaW5jbHVkaW5nKSB7XG4gICAgLy8gYm90aCBzZWxlY3RvciBhbmQgcHJvamVjdGlvbiBhcmUgcG9pbnRpbmcgb24gZmllbGRzIHRvIGluY2x1ZGVcbiAgICAvLyBzbyB3ZSBjYW4ganVzdCByZXR1cm4gdGhlIG1lcmdlZCB0cmVlXG4gICAgcmV0dXJuIG1lcmdlZFByb2plY3Rpb247XG4gIH1cblxuICAvLyBzZWxlY3RvciBpcyBwb2ludGluZyBhdCBmaWVsZHMgdG8gaW5jbHVkZVxuICAvLyBwcm9qZWN0aW9uIGlzIHBvaW50aW5nIGF0IGZpZWxkcyB0byBleGNsdWRlXG4gIC8vIG1ha2Ugc3VyZSB3ZSBkb24ndCBleGNsdWRlIGltcG9ydGFudCBwYXRoc1xuICBjb25zdCBtZXJnZWRFeGNsUHJvamVjdGlvbiA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKG1lcmdlZFByb2plY3Rpb24pLmZvckVhY2gocGF0aCA9PiB7XG4gICAgaWYgKCFtZXJnZWRQcm9qZWN0aW9uW3BhdGhdKSB7XG4gICAgICBtZXJnZWRFeGNsUHJvamVjdGlvbltwYXRoXSA9IGZhbHNlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIG1lcmdlZEV4Y2xQcm9qZWN0aW9uO1xufVxuXG5mdW5jdGlvbiBnZXRQYXRocyhzZWxlY3Rvcikge1xuICByZXR1cm4gT2JqZWN0LmtleXMobmV3IE1pbmltb25nby5NYXRjaGVyKHNlbGVjdG9yKS5fcGF0aHMpO1xuXG4gIC8vIFhYWCByZW1vdmUgaXQ/XG4gIC8vIHJldHVybiBPYmplY3Qua2V5cyhzZWxlY3RvcikubWFwKGsgPT4ge1xuICAvLyAgIC8vIHdlIGRvbid0IGtub3cgaG93IHRvIGhhbmRsZSAkd2hlcmUgYmVjYXVzZSBpdCBjYW4gYmUgYW55dGhpbmdcbiAgLy8gICBpZiAoayA9PT0gJyR3aGVyZScpIHtcbiAgLy8gICAgIHJldHVybiAnJzsgLy8gbWF0Y2hlcyBldmVyeXRoaW5nXG4gIC8vICAgfVxuXG4gIC8vICAgLy8gd2UgYnJhbmNoIGZyb20gJG9yLyRhbmQvJG5vciBvcGVyYXRvclxuICAvLyAgIGlmIChbJyRvcicsICckYW5kJywgJyRub3InXS5pbmNsdWRlcyhrKSkge1xuICAvLyAgICAgcmV0dXJuIHNlbGVjdG9yW2tdLm1hcChnZXRQYXRocyk7XG4gIC8vICAgfVxuXG4gIC8vICAgLy8gdGhlIHZhbHVlIGlzIGEgbGl0ZXJhbCBvciBzb21lIGNvbXBhcmlzb24gb3BlcmF0b3JcbiAgLy8gICByZXR1cm4gaztcbiAgLy8gfSlcbiAgLy8gICAucmVkdWNlKChhLCBiKSA9PiBhLmNvbmNhdChiKSwgW10pXG4gIC8vICAgLmZpbHRlcigoYSwgYiwgYykgPT4gYy5pbmRleE9mKGEpID09PSBiKTtcbn1cblxuLy8gQSBoZWxwZXIgdG8gZW5zdXJlIG9iamVjdCBoYXMgb25seSBjZXJ0YWluIGtleXNcbmZ1bmN0aW9uIG9ubHlDb250YWluc0tleXMob2JqLCBrZXlzKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhvYmopLmV2ZXJ5KGsgPT4ga2V5cy5pbmNsdWRlcyhrKSk7XG59XG5cbmZ1bmN0aW9uIHBhdGhIYXNOdW1lcmljS2V5cyhwYXRoKSB7XG4gIHJldHVybiBwYXRoLnNwbGl0KCcuJykuc29tZShpc051bWVyaWNLZXkpO1xufVxuXG4vLyBSZXR1cm5zIGEgc2V0IG9mIGtleSBwYXRocyBzaW1pbGFyIHRvXG4vLyB7ICdmb28uYmFyJzogMSwgJ2EuYi5jJzogMSB9XG5mdW5jdGlvbiB0cmVlVG9QYXRocyh0cmVlLCBwcmVmaXggPSAnJykge1xuICBjb25zdCByZXN1bHQgPSB7fTtcblxuICBPYmplY3Qua2V5cyh0cmVlKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSB0cmVlW2tleV07XG4gICAgaWYgKHZhbHVlID09PSBPYmplY3QodmFsdWUpKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHJlc3VsdCwgdHJlZVRvUGF0aHModmFsdWUsIGAke3ByZWZpeCArIGtleX0uYCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHRbcHJlZml4ICsga2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsImltcG9ydCBMb2NhbENvbGxlY3Rpb24gZnJvbSAnLi9sb2NhbF9jb2xsZWN0aW9uLmpzJztcblxuZXhwb3J0IGNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmV4cG9ydCBjbGFzcyBNaW5pTW9uZ29RdWVyeUVycm9yIGV4dGVuZHMgRXJyb3Ige31cbi8vIEVhY2ggZWxlbWVudCBzZWxlY3RvciBjb250YWluczpcbi8vICAtIGNvbXBpbGVFbGVtZW50U2VsZWN0b3IsIGEgZnVuY3Rpb24gd2l0aCBhcmdzOlxuLy8gICAgLSBvcGVyYW5kIC0gdGhlIFwicmlnaHQgaGFuZCBzaWRlXCIgb2YgdGhlIG9wZXJhdG9yXG4vLyAgICAtIHZhbHVlU2VsZWN0b3IgLSB0aGUgXCJjb250ZXh0XCIgZm9yIHRoZSBvcGVyYXRvciAoc28gdGhhdCAkcmVnZXggY2FuIGZpbmRcbi8vICAgICAgJG9wdGlvbnMpXG4vLyAgICAtIG1hdGNoZXIgLSB0aGUgTWF0Y2hlciB0aGlzIGlzIGdvaW5nIGludG8gKHNvIHRoYXQgJGVsZW1NYXRjaCBjYW4gY29tcGlsZVxuLy8gICAgICBtb3JlIHRoaW5ncylcbi8vICAgIHJldHVybmluZyBhIGZ1bmN0aW9uIG1hcHBpbmcgYSBzaW5nbGUgdmFsdWUgdG8gYm9vbC5cbi8vICAtIGRvbnRFeHBhbmRMZWFmQXJyYXlzLCBhIGJvb2wgd2hpY2ggcHJldmVudHMgZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyBmcm9tXG4vLyAgICBiZWluZyBjYWxsZWRcbi8vICAtIGRvbnRJbmNsdWRlTGVhZkFycmF5cywgYSBib29sIHdoaWNoIGNhdXNlcyBhbiBhcmd1bWVudCB0byBiZSBwYXNzZWQgdG9cbi8vICAgIGV4cGFuZEFycmF5c0luQnJhbmNoZXMgaWYgaXQgaXMgY2FsbGVkXG5leHBvcnQgY29uc3QgRUxFTUVOVF9PUEVSQVRPUlMgPSB7XG4gICRsdDogbWFrZUluZXF1YWxpdHkoY21wVmFsdWUgPT4gY21wVmFsdWUgPCAwKSxcbiAgJGd0OiBtYWtlSW5lcXVhbGl0eShjbXBWYWx1ZSA9PiBjbXBWYWx1ZSA+IDApLFxuICAkbHRlOiBtYWtlSW5lcXVhbGl0eShjbXBWYWx1ZSA9PiBjbXBWYWx1ZSA8PSAwKSxcbiAgJGd0ZTogbWFrZUluZXF1YWxpdHkoY21wVmFsdWUgPT4gY21wVmFsdWUgPj0gMCksXG4gICRtb2Q6IHtcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGlmICghKEFycmF5LmlzQXJyYXkob3BlcmFuZCkgJiYgb3BlcmFuZC5sZW5ndGggPT09IDJcbiAgICAgICAgICAgICYmIHR5cGVvZiBvcGVyYW5kWzBdID09PSAnbnVtYmVyJ1xuICAgICAgICAgICAgJiYgdHlwZW9mIG9wZXJhbmRbMV0gPT09ICdudW1iZXInKSkge1xuICAgICAgICB0aHJvdyBuZXcgTWluaU1vbmdvUXVlcnlFcnJvcignYXJndW1lbnQgdG8gJG1vZCBtdXN0IGJlIGFuIGFycmF5IG9mIHR3byBudW1iZXJzJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCBjb3VsZCByZXF1aXJlIHRvIGJlIGludHMgb3Igcm91bmQgb3Igc29tZXRoaW5nXG4gICAgICBjb25zdCBkaXZpc29yID0gb3BlcmFuZFswXTtcbiAgICAgIGNvbnN0IHJlbWFpbmRlciA9IG9wZXJhbmRbMV07XG4gICAgICByZXR1cm4gdmFsdWUgPT4gKFxuICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIHZhbHVlICUgZGl2aXNvciA9PT0gcmVtYWluZGVyXG4gICAgICApO1xuICAgIH0sXG4gIH0sXG4gICRpbjoge1xuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCkge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG9wZXJhbmQpKSB7XG4gICAgICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKCckaW4gbmVlZHMgYW4gYXJyYXknKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZWxlbWVudE1hdGNoZXJzID0gb3BlcmFuZC5tYXAob3B0aW9uID0+IHtcbiAgICAgICAgaWYgKG9wdGlvbiBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgIHJldHVybiByZWdleHBFbGVtZW50TWF0Y2hlcihvcHRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzT3BlcmF0b3JPYmplY3Qob3B0aW9uKSkge1xuICAgICAgICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKCdjYW5ub3QgbmVzdCAkIHVuZGVyICRpbicpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVxdWFsaXR5RWxlbWVudE1hdGNoZXIob3B0aW9uKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICAvLyBBbGxvdyB7YTogeyRpbjogW251bGxdfX0gdG8gbWF0Y2ggd2hlbiAnYScgZG9lcyBub3QgZXhpc3QuXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVsZW1lbnRNYXRjaGVycy5zb21lKG1hdGNoZXIgPT4gbWF0Y2hlcih2YWx1ZSkpO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxuICAkc2l6ZToge1xuICAgIC8vIHthOiBbWzUsIDVdXX0gbXVzdCBtYXRjaCB7YTogeyRzaXplOiAxfX0gYnV0IG5vdCB7YTogeyRzaXplOiAyfX0sIHNvIHdlXG4gICAgLy8gZG9uJ3Qgd2FudCB0byBjb25zaWRlciB0aGUgZWxlbWVudCBbNSw1XSBpbiB0aGUgbGVhZiBhcnJheSBbWzUsNV1dIGFzIGFcbiAgICAvLyBwb3NzaWJsZSB2YWx1ZS5cbiAgICBkb250RXhwYW5kTGVhZkFycmF5czogdHJ1ZSxcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3BlcmFuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gRG9uJ3QgYXNrIG1lIHdoeSwgYnV0IGJ5IGV4cGVyaW1lbnRhdGlvbiwgdGhpcyBzZWVtcyB0byBiZSB3aGF0IE1vbmdvXG4gICAgICAgIC8vIGRvZXMuXG4gICAgICAgIG9wZXJhbmQgPSAwO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3BlcmFuZCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgbmV3IE1pbmlNb25nb1F1ZXJ5RXJyb3IoJyRzaXplIG5lZWRzIGEgbnVtYmVyJyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB2YWx1ZSA9PiBBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IG9wZXJhbmQ7XG4gICAgfSxcbiAgfSxcbiAgJHR5cGU6IHtcbiAgICAvLyB7YTogWzVdfSBtdXN0IG5vdCBtYXRjaCB7YTogeyR0eXBlOiA0fX0gKDQgbWVhbnMgYXJyYXkpLCBidXQgaXQgc2hvdWxkXG4gICAgLy8gbWF0Y2gge2E6IHskdHlwZTogMX19ICgxIG1lYW5zIG51bWJlciksIGFuZCB7YTogW1s1XV19IG11c3QgbWF0Y2ggeyRhOlxuICAgIC8vIHskdHlwZTogNH19LiBUaHVzLCB3aGVuIHdlIHNlZSBhIGxlYWYgYXJyYXksIHdlICpzaG91bGQqIGV4cGFuZCBpdCBidXRcbiAgICAvLyBzaG91bGQgKm5vdCogaW5jbHVkZSBpdCBpdHNlbGYuXG4gICAgZG9udEluY2x1ZGVMZWFmQXJyYXlzOiB0cnVlLFxuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCkge1xuICAgICAgaWYgKHR5cGVvZiBvcGVyYW5kID09PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCBvcGVyYW5kQWxpYXNNYXAgPSB7XG4gICAgICAgICAgJ2RvdWJsZSc6IDEsXG4gICAgICAgICAgJ3N0cmluZyc6IDIsXG4gICAgICAgICAgJ29iamVjdCc6IDMsXG4gICAgICAgICAgJ2FycmF5JzogNCxcbiAgICAgICAgICAnYmluRGF0YSc6IDUsXG4gICAgICAgICAgJ3VuZGVmaW5lZCc6IDYsXG4gICAgICAgICAgJ29iamVjdElkJzogNyxcbiAgICAgICAgICAnYm9vbCc6IDgsXG4gICAgICAgICAgJ2RhdGUnOiA5LFxuICAgICAgICAgICdudWxsJzogMTAsXG4gICAgICAgICAgJ3JlZ2V4JzogMTEsXG4gICAgICAgICAgJ2RiUG9pbnRlcic6IDEyLFxuICAgICAgICAgICdqYXZhc2NyaXB0JzogMTMsXG4gICAgICAgICAgJ3N5bWJvbCc6IDE0LFxuICAgICAgICAgICdqYXZhc2NyaXB0V2l0aFNjb3BlJzogMTUsXG4gICAgICAgICAgJ2ludCc6IDE2LFxuICAgICAgICAgICd0aW1lc3RhbXAnOiAxNyxcbiAgICAgICAgICAnbG9uZyc6IDE4LFxuICAgICAgICAgICdkZWNpbWFsJzogMTksXG4gICAgICAgICAgJ21pbktleSc6IC0xLFxuICAgICAgICAgICdtYXhLZXknOiAxMjcsXG4gICAgICAgIH07XG4gICAgICAgIGlmICghaGFzT3duLmNhbGwob3BlcmFuZEFsaWFzTWFwLCBvcGVyYW5kKSkge1xuICAgICAgICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKGB1bmtub3duIHN0cmluZyBhbGlhcyBmb3IgJHR5cGU6ICR7b3BlcmFuZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBvcGVyYW5kID0gb3BlcmFuZEFsaWFzTWFwW29wZXJhbmRdO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3BlcmFuZCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgaWYgKG9wZXJhbmQgPT09IDAgfHwgb3BlcmFuZCA8IC0xXG4gICAgICAgICAgfHwgKG9wZXJhbmQgPiAxOSAmJiBvcGVyYW5kICE9PSAxMjcpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IE1pbmlNb25nb1F1ZXJ5RXJyb3IoYEludmFsaWQgbnVtZXJpY2FsICR0eXBlIGNvZGU6ICR7b3BlcmFuZH1gKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IE1pbmlNb25nb1F1ZXJ5RXJyb3IoJ2FyZ3VtZW50IHRvICR0eXBlIGlzIG5vdCBhIG51bWJlciBvciBhIHN0cmluZycpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdmFsdWUgPT4gKFxuICAgICAgICB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZSh2YWx1ZSkgPT09IG9wZXJhbmRcbiAgICAgICk7XG4gICAgfSxcbiAgfSxcbiAgJGJpdHNBbGxTZXQ6IHtcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGNvbnN0IG1hc2sgPSBnZXRPcGVyYW5kQml0bWFzayhvcGVyYW5kLCAnJGJpdHNBbGxTZXQnKTtcbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IGJpdG1hc2sgPSBnZXRWYWx1ZUJpdG1hc2sodmFsdWUsIG1hc2subGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIGJpdG1hc2sgJiYgbWFzay5ldmVyeSgoYnl0ZSwgaSkgPT4gKGJpdG1hc2tbaV0gJiBieXRlKSA9PT0gYnl0ZSk7XG4gICAgICB9O1xuICAgIH0sXG4gIH0sXG4gICRiaXRzQW55U2V0OiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBjb25zdCBtYXNrID0gZ2V0T3BlcmFuZEJpdG1hc2sob3BlcmFuZCwgJyRiaXRzQW55U2V0Jyk7XG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICBjb25zdCBiaXRtYXNrID0gZ2V0VmFsdWVCaXRtYXNrKHZhbHVlLCBtYXNrLmxlbmd0aCk7XG4gICAgICAgIHJldHVybiBiaXRtYXNrICYmIG1hc2suc29tZSgoYnl0ZSwgaSkgPT4gKH5iaXRtYXNrW2ldICYgYnl0ZSkgIT09IGJ5dGUpO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxuICAkYml0c0FsbENsZWFyOiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBjb25zdCBtYXNrID0gZ2V0T3BlcmFuZEJpdG1hc2sob3BlcmFuZCwgJyRiaXRzQWxsQ2xlYXInKTtcbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IGJpdG1hc2sgPSBnZXRWYWx1ZUJpdG1hc2sodmFsdWUsIG1hc2subGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIGJpdG1hc2sgJiYgbWFzay5ldmVyeSgoYnl0ZSwgaSkgPT4gIShiaXRtYXNrW2ldICYgYnl0ZSkpO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxuICAkYml0c0FueUNsZWFyOiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBjb25zdCBtYXNrID0gZ2V0T3BlcmFuZEJpdG1hc2sob3BlcmFuZCwgJyRiaXRzQW55Q2xlYXInKTtcbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IGJpdG1hc2sgPSBnZXRWYWx1ZUJpdG1hc2sodmFsdWUsIG1hc2subGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIGJpdG1hc2sgJiYgbWFzay5zb21lKChieXRlLCBpKSA9PiAoYml0bWFza1tpXSAmIGJ5dGUpICE9PSBieXRlKTtcbiAgICAgIH07XG4gICAgfSxcbiAgfSxcbiAgJHJlZ2V4OiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yKSB7XG4gICAgICBpZiAoISh0eXBlb2Ygb3BlcmFuZCA9PT0gJ3N0cmluZycgfHwgb3BlcmFuZCBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IE1pbmlNb25nb1F1ZXJ5RXJyb3IoJyRyZWdleCBoYXMgdG8gYmUgYSBzdHJpbmcgb3IgUmVnRXhwJyk7XG4gICAgICB9XG5cbiAgICAgIGxldCByZWdleHA7XG4gICAgICBpZiAodmFsdWVTZWxlY3Rvci4kb3B0aW9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIE9wdGlvbnMgcGFzc2VkIGluICRvcHRpb25zIChldmVuIHRoZSBlbXB0eSBzdHJpbmcpIGFsd2F5cyBvdmVycmlkZXNcbiAgICAgICAgLy8gb3B0aW9ucyBpbiB0aGUgUmVnRXhwIG9iamVjdCBpdHNlbGYuXG5cbiAgICAgICAgLy8gQmUgY2xlYXIgdGhhdCB3ZSBvbmx5IHN1cHBvcnQgdGhlIEpTLXN1cHBvcnRlZCBvcHRpb25zLCBub3QgZXh0ZW5kZWRcbiAgICAgICAgLy8gb25lcyAoZWcsIE1vbmdvIHN1cHBvcnRzIHggYW5kIHMpLiBJZGVhbGx5IHdlIHdvdWxkIGltcGxlbWVudCB4IGFuZCBzXG4gICAgICAgIC8vIGJ5IHRyYW5zZm9ybWluZyB0aGUgcmVnZXhwLCBidXQgbm90IHRvZGF5Li4uXG4gICAgICAgIGlmICgvW15naW1dLy50ZXN0KHZhbHVlU2VsZWN0b3IuJG9wdGlvbnMpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IE1pbmlNb25nb1F1ZXJ5RXJyb3IoJ09ubHkgdGhlIGksIG0sIGFuZCBnIHJlZ2V4cCBvcHRpb25zIGFyZSBzdXBwb3J0ZWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IG9wZXJhbmQgaW5zdGFuY2VvZiBSZWdFeHAgPyBvcGVyYW5kLnNvdXJjZSA6IG9wZXJhbmQ7XG4gICAgICAgIHJlZ2V4cCA9IG5ldyBSZWdFeHAoc291cmNlLCB2YWx1ZVNlbGVjdG9yLiRvcHRpb25zKTtcbiAgICAgIH0gZWxzZSBpZiAob3BlcmFuZCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICByZWdleHAgPSBvcGVyYW5kO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVnZXhwID0gbmV3IFJlZ0V4cChvcGVyYW5kKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlZ2V4cEVsZW1lbnRNYXRjaGVyKHJlZ2V4cCk7XG4gICAgfSxcbiAgfSxcbiAgJGVsZW1NYXRjaDoge1xuICAgIGRvbnRFeHBhbmRMZWFmQXJyYXlzOiB0cnVlLFxuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCwgdmFsdWVTZWxlY3RvciwgbWF0Y2hlcikge1xuICAgICAgaWYgKCFMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3Qob3BlcmFuZCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IE1pbmlNb25nb1F1ZXJ5RXJyb3IoJyRlbGVtTWF0Y2ggbmVlZCBhbiBvYmplY3QnKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgaXNEb2NNYXRjaGVyID0gIWlzT3BlcmF0b3JPYmplY3QoXG4gICAgICAgIE9iamVjdC5rZXlzKG9wZXJhbmQpXG4gICAgICAgICAgLmZpbHRlcihrZXkgPT4gIWhhc093bi5jYWxsKExPR0lDQUxfT1BFUkFUT1JTLCBrZXkpKVxuICAgICAgICAgIC5yZWR1Y2UoKGEsIGIpID0+IE9iamVjdC5hc3NpZ24oYSwge1tiXTogb3BlcmFuZFtiXX0pLCB7fSksXG4gICAgICAgIHRydWUpO1xuXG4gICAgICBsZXQgc3ViTWF0Y2hlcjtcbiAgICAgIGlmIChpc0RvY01hdGNoZXIpIHtcbiAgICAgICAgLy8gVGhpcyBpcyBOT1QgdGhlIHNhbWUgYXMgY29tcGlsZVZhbHVlU2VsZWN0b3Iob3BlcmFuZCksIGFuZCBub3QganVzdFxuICAgICAgICAvLyBiZWNhdXNlIG9mIHRoZSBzbGlnaHRseSBkaWZmZXJlbnQgY2FsbGluZyBjb252ZW50aW9uLlxuICAgICAgICAvLyB7JGVsZW1NYXRjaDoge3g6IDN9fSBtZWFucyBcImFuIGVsZW1lbnQgaGFzIGEgZmllbGQgeDozXCIsIG5vdFxuICAgICAgICAvLyBcImNvbnNpc3RzIG9ubHkgb2YgYSBmaWVsZCB4OjNcIi4gQWxzbywgcmVnZXhwcyBhbmQgc3ViLSQgYXJlIGFsbG93ZWQuXG4gICAgICAgIHN1Yk1hdGNoZXIgPVxuICAgICAgICAgIGNvbXBpbGVEb2N1bWVudFNlbGVjdG9yKG9wZXJhbmQsIG1hdGNoZXIsIHtpbkVsZW1NYXRjaDogdHJ1ZX0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3ViTWF0Y2hlciA9IGNvbXBpbGVWYWx1ZVNlbGVjdG9yKG9wZXJhbmQsIG1hdGNoZXIpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgIGNvbnN0IGFycmF5RWxlbWVudCA9IHZhbHVlW2ldO1xuICAgICAgICAgIGxldCBhcmc7XG4gICAgICAgICAgaWYgKGlzRG9jTWF0Y2hlcikge1xuICAgICAgICAgICAgLy8gV2UgY2FuIG9ubHkgbWF0Y2ggeyRlbGVtTWF0Y2g6IHtiOiAzfX0gYWdhaW5zdCBvYmplY3RzLlxuICAgICAgICAgICAgLy8gKFdlIGNhbiBhbHNvIG1hdGNoIGFnYWluc3QgYXJyYXlzLCBpZiB0aGVyZSdzIG51bWVyaWMgaW5kaWNlcyxcbiAgICAgICAgICAgIC8vIGVnIHskZWxlbU1hdGNoOiB7JzAuYic6IDN9fSBvciB7JGVsZW1NYXRjaDogezA6IDN9fS4pXG4gICAgICAgICAgICBpZiAoIWlzSW5kZXhhYmxlKGFycmF5RWxlbWVudCkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhcmcgPSBhcnJheUVsZW1lbnQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGRvbnRJdGVyYXRlIGVuc3VyZXMgdGhhdCB7YTogeyRlbGVtTWF0Y2g6IHskZ3Q6IDV9fX0gbWF0Y2hlc1xuICAgICAgICAgICAgLy8ge2E6IFs4XX0gYnV0IG5vdCB7YTogW1s4XV19XG4gICAgICAgICAgICBhcmcgPSBbe3ZhbHVlOiBhcnJheUVsZW1lbnQsIGRvbnRJdGVyYXRlOiB0cnVlfV07XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFhYWCBzdXBwb3J0ICRuZWFyIGluICRlbGVtTWF0Y2ggYnkgcHJvcGFnYXRpbmcgJGRpc3RhbmNlP1xuICAgICAgICAgIGlmIChzdWJNYXRjaGVyKGFyZykucmVzdWx0KSB7XG4gICAgICAgICAgICByZXR1cm4gaTsgLy8gc3BlY2lhbGx5IHVuZGVyc3Rvb2QgdG8gbWVhbiBcInVzZSBhcyBhcnJheUluZGljZXNcIlxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH07XG4gICAgfSxcbiAgfSxcbn07XG5cbi8vIE9wZXJhdG9ycyB0aGF0IGFwcGVhciBhdCB0aGUgdG9wIGxldmVsIG9mIGEgZG9jdW1lbnQgc2VsZWN0b3IuXG5jb25zdCBMT0dJQ0FMX09QRVJBVE9SUyA9IHtcbiAgJGFuZChzdWJTZWxlY3RvciwgbWF0Y2hlciwgaW5FbGVtTWF0Y2gpIHtcbiAgICByZXR1cm4gYW5kRG9jdW1lbnRNYXRjaGVycyhcbiAgICAgIGNvbXBpbGVBcnJheU9mRG9jdW1lbnRTZWxlY3RvcnMoc3ViU2VsZWN0b3IsIG1hdGNoZXIsIGluRWxlbU1hdGNoKVxuICAgICk7XG4gIH0sXG5cbiAgJG9yKHN1YlNlbGVjdG9yLCBtYXRjaGVyLCBpbkVsZW1NYXRjaCkge1xuICAgIGNvbnN0IG1hdGNoZXJzID0gY29tcGlsZUFycmF5T2ZEb2N1bWVudFNlbGVjdG9ycyhcbiAgICAgIHN1YlNlbGVjdG9yLFxuICAgICAgbWF0Y2hlcixcbiAgICAgIGluRWxlbU1hdGNoXG4gICAgKTtcblxuICAgIC8vIFNwZWNpYWwgY2FzZTogaWYgdGhlcmUgaXMgb25seSBvbmUgbWF0Y2hlciwgdXNlIGl0IGRpcmVjdGx5LCAqcHJlc2VydmluZypcbiAgICAvLyBhbnkgYXJyYXlJbmRpY2VzIGl0IHJldHVybnMuXG4gICAgaWYgKG1hdGNoZXJzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcmV0dXJuIG1hdGNoZXJzWzBdO1xuICAgIH1cblxuICAgIHJldHVybiBkb2MgPT4ge1xuICAgICAgY29uc3QgcmVzdWx0ID0gbWF0Y2hlcnMuc29tZShmbiA9PiBmbihkb2MpLnJlc3VsdCk7XG4gICAgICAvLyAkb3IgZG9lcyBOT1Qgc2V0IGFycmF5SW5kaWNlcyB3aGVuIGl0IGhhcyBtdWx0aXBsZVxuICAgICAgLy8gc3ViLWV4cHJlc3Npb25zLiAoVGVzdGVkIGFnYWluc3QgTW9uZ29EQi4pXG4gICAgICByZXR1cm4ge3Jlc3VsdH07XG4gICAgfTtcbiAgfSxcblxuICAkbm9yKHN1YlNlbGVjdG9yLCBtYXRjaGVyLCBpbkVsZW1NYXRjaCkge1xuICAgIGNvbnN0IG1hdGNoZXJzID0gY29tcGlsZUFycmF5T2ZEb2N1bWVudFNlbGVjdG9ycyhcbiAgICAgIHN1YlNlbGVjdG9yLFxuICAgICAgbWF0Y2hlcixcbiAgICAgIGluRWxlbU1hdGNoXG4gICAgKTtcbiAgICByZXR1cm4gZG9jID0+IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoZXJzLmV2ZXJ5KGZuID0+ICFmbihkb2MpLnJlc3VsdCk7XG4gICAgICAvLyBOZXZlciBzZXQgYXJyYXlJbmRpY2VzLCBiZWNhdXNlIHdlIG9ubHkgbWF0Y2ggaWYgbm90aGluZyBpbiBwYXJ0aWN1bGFyXG4gICAgICAvLyAnbWF0Y2hlZCcgKGFuZCBiZWNhdXNlIHRoaXMgaXMgY29uc2lzdGVudCB3aXRoIE1vbmdvREIpLlxuICAgICAgcmV0dXJuIHtyZXN1bHR9O1xuICAgIH07XG4gIH0sXG5cbiAgJHdoZXJlKHNlbGVjdG9yVmFsdWUsIG1hdGNoZXIpIHtcbiAgICAvLyBSZWNvcmQgdGhhdCAqYW55KiBwYXRoIG1heSBiZSB1c2VkLlxuICAgIG1hdGNoZXIuX3JlY29yZFBhdGhVc2VkKCcnKTtcbiAgICBtYXRjaGVyLl9oYXNXaGVyZSA9IHRydWU7XG5cbiAgICBpZiAoIShzZWxlY3RvclZhbHVlIGluc3RhbmNlb2YgRnVuY3Rpb24pKSB7XG4gICAgICAvLyBYWFggTW9uZ29EQiBzZWVtcyB0byBoYXZlIG1vcmUgY29tcGxleCBsb2dpYyB0byBkZWNpZGUgd2hlcmUgb3Igb3Igbm90XG4gICAgICAvLyB0byBhZGQgJ3JldHVybic7IG5vdCBzdXJlIGV4YWN0bHkgd2hhdCBpdCBpcy5cbiAgICAgIHNlbGVjdG9yVmFsdWUgPSBGdW5jdGlvbignb2JqJywgYHJldHVybiAke3NlbGVjdG9yVmFsdWV9YCk7XG4gICAgfVxuXG4gICAgLy8gV2UgbWFrZSB0aGUgZG9jdW1lbnQgYXZhaWxhYmxlIGFzIGJvdGggYHRoaXNgIGFuZCBgb2JqYC5cbiAgICAvLyAvLyBYWFggbm90IHN1cmUgd2hhdCB3ZSBzaG91bGQgZG8gaWYgdGhpcyB0aHJvd3NcbiAgICByZXR1cm4gZG9jID0+ICh7cmVzdWx0OiBzZWxlY3RvclZhbHVlLmNhbGwoZG9jLCBkb2MpfSk7XG4gIH0sXG5cbiAgLy8gVGhpcyBpcyBqdXN0IHVzZWQgYXMgYSBjb21tZW50IGluIHRoZSBxdWVyeSAoaW4gTW9uZ29EQiwgaXQgYWxzbyBlbmRzIHVwIGluXG4gIC8vIHF1ZXJ5IGxvZ3MpOyBpdCBoYXMgbm8gZWZmZWN0IG9uIHRoZSBhY3R1YWwgc2VsZWN0aW9uLlxuICAkY29tbWVudCgpIHtcbiAgICByZXR1cm4gKCkgPT4gKHtyZXN1bHQ6IHRydWV9KTtcbiAgfSxcbn07XG5cbi8vIE9wZXJhdG9ycyB0aGF0ICh1bmxpa2UgTE9HSUNBTF9PUEVSQVRPUlMpIHBlcnRhaW4gdG8gaW5kaXZpZHVhbCBwYXRocyBpbiBhXG4vLyBkb2N1bWVudCwgYnV0ICh1bmxpa2UgRUxFTUVOVF9PUEVSQVRPUlMpIGRvIG5vdCBoYXZlIGEgc2ltcGxlIGRlZmluaXRpb24gYXNcbi8vIFwibWF0Y2ggZWFjaCBicmFuY2hlZCB2YWx1ZSBpbmRlcGVuZGVudGx5IGFuZCBjb21iaW5lIHdpdGhcbi8vIGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyXCIuXG5jb25zdCBWQUxVRV9PUEVSQVRPUlMgPSB7XG4gICRlcShvcGVyYW5kKSB7XG4gICAgcmV0dXJuIGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyKFxuICAgICAgZXF1YWxpdHlFbGVtZW50TWF0Y2hlcihvcGVyYW5kKVxuICAgICk7XG4gIH0sXG4gICRub3Qob3BlcmFuZCwgdmFsdWVTZWxlY3RvciwgbWF0Y2hlcikge1xuICAgIHJldHVybiBpbnZlcnRCcmFuY2hlZE1hdGNoZXIoY29tcGlsZVZhbHVlU2VsZWN0b3Iob3BlcmFuZCwgbWF0Y2hlcikpO1xuICB9LFxuICAkbmUob3BlcmFuZCkge1xuICAgIHJldHVybiBpbnZlcnRCcmFuY2hlZE1hdGNoZXIoXG4gICAgICBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlcihlcXVhbGl0eUVsZW1lbnRNYXRjaGVyKG9wZXJhbmQpKVxuICAgICk7XG4gIH0sXG4gICRuaW4ob3BlcmFuZCkge1xuICAgIHJldHVybiBpbnZlcnRCcmFuY2hlZE1hdGNoZXIoXG4gICAgICBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlcihcbiAgICAgICAgRUxFTUVOVF9PUEVSQVRPUlMuJGluLmNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZClcbiAgICAgIClcbiAgICApO1xuICB9LFxuICAkZXhpc3RzKG9wZXJhbmQpIHtcbiAgICBjb25zdCBleGlzdHMgPSBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlcihcbiAgICAgIHZhbHVlID0+IHZhbHVlICE9PSB1bmRlZmluZWRcbiAgICApO1xuICAgIHJldHVybiBvcGVyYW5kID8gZXhpc3RzIDogaW52ZXJ0QnJhbmNoZWRNYXRjaGVyKGV4aXN0cyk7XG4gIH0sXG4gIC8vICRvcHRpb25zIGp1c3QgcHJvdmlkZXMgb3B0aW9ucyBmb3IgJHJlZ2V4OyBpdHMgbG9naWMgaXMgaW5zaWRlICRyZWdleFxuICAkb3B0aW9ucyhvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yKSB7XG4gICAgaWYgKCFoYXNPd24uY2FsbCh2YWx1ZVNlbGVjdG9yLCAnJHJlZ2V4JykpIHtcbiAgICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKCckb3B0aW9ucyBuZWVkcyBhICRyZWdleCcpO1xuICAgIH1cblxuICAgIHJldHVybiBldmVyeXRoaW5nTWF0Y2hlcjtcbiAgfSxcbiAgLy8gJG1heERpc3RhbmNlIGlzIGJhc2ljYWxseSBhbiBhcmd1bWVudCB0byAkbmVhclxuICAkbWF4RGlzdGFuY2Uob3BlcmFuZCwgdmFsdWVTZWxlY3Rvcikge1xuICAgIGlmICghdmFsdWVTZWxlY3Rvci4kbmVhcikge1xuICAgICAgdGhyb3cgbmV3IE1pbmlNb25nb1F1ZXJ5RXJyb3IoJyRtYXhEaXN0YW5jZSBuZWVkcyBhICRuZWFyJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGV2ZXJ5dGhpbmdNYXRjaGVyO1xuICB9LFxuICAkYWxsKG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkob3BlcmFuZCkpIHtcbiAgICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKCckYWxsIHJlcXVpcmVzIGFycmF5Jyk7XG4gICAgfVxuXG4gICAgLy8gTm90IHN1cmUgd2h5LCBidXQgdGhpcyBzZWVtcyB0byBiZSB3aGF0IE1vbmdvREIgZG9lcy5cbiAgICBpZiAob3BlcmFuZC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBub3RoaW5nTWF0Y2hlcjtcbiAgICB9XG5cbiAgICBjb25zdCBicmFuY2hlZE1hdGNoZXJzID0gb3BlcmFuZC5tYXAoY3JpdGVyaW9uID0+IHtcbiAgICAgIC8vIFhYWCBoYW5kbGUgJGFsbC8kZWxlbU1hdGNoIGNvbWJpbmF0aW9uXG4gICAgICBpZiAoaXNPcGVyYXRvck9iamVjdChjcml0ZXJpb24pKSB7XG4gICAgICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKCdubyAkIGV4cHJlc3Npb25zIGluICRhbGwnKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhpcyBpcyBhbHdheXMgYSByZWdleHAgb3IgZXF1YWxpdHkgc2VsZWN0b3IuXG4gICAgICByZXR1cm4gY29tcGlsZVZhbHVlU2VsZWN0b3IoY3JpdGVyaW9uLCBtYXRjaGVyKTtcbiAgICB9KTtcblxuICAgIC8vIGFuZEJyYW5jaGVkTWF0Y2hlcnMgZG9lcyBOT1QgcmVxdWlyZSBhbGwgc2VsZWN0b3JzIHRvIHJldHVybiB0cnVlIG9uIHRoZVxuICAgIC8vIFNBTUUgYnJhbmNoLlxuICAgIHJldHVybiBhbmRCcmFuY2hlZE1hdGNoZXJzKGJyYW5jaGVkTWF0Y2hlcnMpO1xuICB9LFxuICAkbmVhcihvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyLCBpc1Jvb3QpIHtcbiAgICBpZiAoIWlzUm9vdCkge1xuICAgICAgdGhyb3cgbmV3IE1pbmlNb25nb1F1ZXJ5RXJyb3IoJyRuZWFyIGNhblxcJ3QgYmUgaW5zaWRlIGFub3RoZXIgJCBvcGVyYXRvcicpO1xuICAgIH1cblxuICAgIG1hdGNoZXIuX2hhc0dlb1F1ZXJ5ID0gdHJ1ZTtcblxuICAgIC8vIFRoZXJlIGFyZSB0d28ga2luZHMgb2YgZ2VvZGF0YSBpbiBNb25nb0RCOiBsZWdhY3kgY29vcmRpbmF0ZSBwYWlycyBhbmRcbiAgICAvLyBHZW9KU09OLiBUaGV5IHVzZSBkaWZmZXJlbnQgZGlzdGFuY2UgbWV0cmljcywgdG9vLiBHZW9KU09OIHF1ZXJpZXMgYXJlXG4gICAgLy8gbWFya2VkIHdpdGggYSAkZ2VvbWV0cnkgcHJvcGVydHksIHRob3VnaCBsZWdhY3kgY29vcmRpbmF0ZXMgY2FuIGJlXG4gICAgLy8gbWF0Y2hlZCB1c2luZyAkZ2VvbWV0cnkuXG4gICAgbGV0IG1heERpc3RhbmNlLCBwb2ludCwgZGlzdGFuY2U7XG4gICAgaWYgKExvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdChvcGVyYW5kKSAmJiBoYXNPd24uY2FsbChvcGVyYW5kLCAnJGdlb21ldHJ5JykpIHtcbiAgICAgIC8vIEdlb0pTT04gXCIyZHNwaGVyZVwiIG1vZGUuXG4gICAgICBtYXhEaXN0YW5jZSA9IG9wZXJhbmQuJG1heERpc3RhbmNlO1xuICAgICAgcG9pbnQgPSBvcGVyYW5kLiRnZW9tZXRyeTtcbiAgICAgIGRpc3RhbmNlID0gdmFsdWUgPT4ge1xuICAgICAgICAvLyBYWFg6IGZvciBub3csIHdlIGRvbid0IGNhbGN1bGF0ZSB0aGUgYWN0dWFsIGRpc3RhbmNlIGJldHdlZW4sIHNheSxcbiAgICAgICAgLy8gcG9seWdvbiBhbmQgY2lyY2xlLiBJZiBwZW9wbGUgY2FyZSBhYm91dCB0aGlzIHVzZS1jYXNlIGl0IHdpbGwgZ2V0XG4gICAgICAgIC8vIGEgcHJpb3JpdHkuXG4gICAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdmFsdWUudHlwZSkge1xuICAgICAgICAgIHJldHVybiBHZW9KU09OLnBvaW50RGlzdGFuY2UoXG4gICAgICAgICAgICBwb2ludCxcbiAgICAgICAgICAgIHt0eXBlOiAnUG9pbnQnLCBjb29yZGluYXRlczogcG9pbnRUb0FycmF5KHZhbHVlKX1cbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlLnR5cGUgPT09ICdQb2ludCcpIHtcbiAgICAgICAgICByZXR1cm4gR2VvSlNPTi5wb2ludERpc3RhbmNlKHBvaW50LCB2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gR2VvSlNPTi5nZW9tZXRyeVdpdGhpblJhZGl1cyh2YWx1ZSwgcG9pbnQsIG1heERpc3RhbmNlKVxuICAgICAgICAgID8gMFxuICAgICAgICAgIDogbWF4RGlzdGFuY2UgKyAxO1xuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWF4RGlzdGFuY2UgPSB2YWx1ZVNlbGVjdG9yLiRtYXhEaXN0YW5jZTtcblxuICAgICAgaWYgKCFpc0luZGV4YWJsZShvcGVyYW5kKSkge1xuICAgICAgICB0aHJvdyBuZXcgTWluaU1vbmdvUXVlcnlFcnJvcignJG5lYXIgYXJndW1lbnQgbXVzdCBiZSBjb29yZGluYXRlIHBhaXIgb3IgR2VvSlNPTicpO1xuICAgICAgfVxuXG4gICAgICBwb2ludCA9IHBvaW50VG9BcnJheShvcGVyYW5kKTtcblxuICAgICAgZGlzdGFuY2UgPSB2YWx1ZSA9PiB7XG4gICAgICAgIGlmICghaXNJbmRleGFibGUodmFsdWUpKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGlzdGFuY2VDb29yZGluYXRlUGFpcnMocG9pbnQsIHZhbHVlKTtcbiAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGJyYW5jaGVkVmFsdWVzID0+IHtcbiAgICAgIC8vIFRoZXJlIG1pZ2h0IGJlIG11bHRpcGxlIHBvaW50cyBpbiB0aGUgZG9jdW1lbnQgdGhhdCBtYXRjaCB0aGUgZ2l2ZW5cbiAgICAgIC8vIGZpZWxkLiBPbmx5IG9uZSBvZiB0aGVtIG5lZWRzIHRvIGJlIHdpdGhpbiAkbWF4RGlzdGFuY2UsIGJ1dCB3ZSBuZWVkIHRvXG4gICAgICAvLyBldmFsdWF0ZSBhbGwgb2YgdGhlbSBhbmQgdXNlIHRoZSBuZWFyZXN0IG9uZSBmb3IgdGhlIGltcGxpY2l0IHNvcnRcbiAgICAgIC8vIHNwZWNpZmllci4gKFRoYXQncyB3aHkgd2UgY2FuJ3QganVzdCB1c2UgRUxFTUVOVF9PUEVSQVRPUlMgaGVyZS4pXG4gICAgICAvL1xuICAgICAgLy8gTm90ZTogVGhpcyBkaWZmZXJzIGZyb20gTW9uZ29EQidzIGltcGxlbWVudGF0aW9uLCB3aGVyZSBhIGRvY3VtZW50IHdpbGxcbiAgICAgIC8vIGFjdHVhbGx5IHNob3cgdXAgKm11bHRpcGxlIHRpbWVzKiBpbiB0aGUgcmVzdWx0IHNldCwgd2l0aCBvbmUgZW50cnkgZm9yXG4gICAgICAvLyBlYWNoIHdpdGhpbi0kbWF4RGlzdGFuY2UgYnJhbmNoaW5nIHBvaW50LlxuICAgICAgY29uc3QgcmVzdWx0ID0ge3Jlc3VsdDogZmFsc2V9O1xuICAgICAgZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyhicmFuY2hlZFZhbHVlcykuZXZlcnkoYnJhbmNoID0+IHtcbiAgICAgICAgLy8gaWYgb3BlcmF0aW9uIGlzIGFuIHVwZGF0ZSwgZG9uJ3Qgc2tpcCBicmFuY2hlcywganVzdCByZXR1cm4gdGhlIGZpcnN0XG4gICAgICAgIC8vIG9uZSAoIzM1OTkpXG4gICAgICAgIGxldCBjdXJEaXN0YW5jZTtcbiAgICAgICAgaWYgKCFtYXRjaGVyLl9pc1VwZGF0ZSkge1xuICAgICAgICAgIGlmICghKHR5cGVvZiBicmFuY2gudmFsdWUgPT09ICdvYmplY3QnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY3VyRGlzdGFuY2UgPSBkaXN0YW5jZShicmFuY2gudmFsdWUpO1xuXG4gICAgICAgICAgLy8gU2tpcCBicmFuY2hlcyB0aGF0IGFyZW4ndCByZWFsIHBvaW50cyBvciBhcmUgdG9vIGZhciBhd2F5LlxuICAgICAgICAgIGlmIChjdXJEaXN0YW5jZSA9PT0gbnVsbCB8fCBjdXJEaXN0YW5jZSA+IG1heERpc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBTa2lwIGFueXRoaW5nIHRoYXQncyBhIHRpZS5cbiAgICAgICAgICBpZiAocmVzdWx0LmRpc3RhbmNlICE9PSB1bmRlZmluZWQgJiYgcmVzdWx0LmRpc3RhbmNlIDw9IGN1ckRpc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHQucmVzdWx0ID0gdHJ1ZTtcbiAgICAgICAgcmVzdWx0LmRpc3RhbmNlID0gY3VyRGlzdGFuY2U7XG5cbiAgICAgICAgaWYgKGJyYW5jaC5hcnJheUluZGljZXMpIHtcbiAgICAgICAgICByZXN1bHQuYXJyYXlJbmRpY2VzID0gYnJhbmNoLmFycmF5SW5kaWNlcztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkZWxldGUgcmVzdWx0LmFycmF5SW5kaWNlcztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAhbWF0Y2hlci5faXNVcGRhdGU7XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9LFxufTtcblxuLy8gTkI6IFdlIGFyZSBjaGVhdGluZyBhbmQgdXNpbmcgdGhpcyBmdW5jdGlvbiB0byBpbXBsZW1lbnQgJ0FORCcgZm9yIGJvdGhcbi8vICdkb2N1bWVudCBtYXRjaGVycycgYW5kICdicmFuY2hlZCBtYXRjaGVycycuIFRoZXkgYm90aCByZXR1cm4gcmVzdWx0IG9iamVjdHNcbi8vIGJ1dCB0aGUgYXJndW1lbnQgaXMgZGlmZmVyZW50OiBmb3IgdGhlIGZvcm1lciBpdCdzIGEgd2hvbGUgZG9jLCB3aGVyZWFzIGZvclxuLy8gdGhlIGxhdHRlciBpdCdzIGFuIGFycmF5IG9mICdicmFuY2hlZCB2YWx1ZXMnLlxuZnVuY3Rpb24gYW5kU29tZU1hdGNoZXJzKHN1Yk1hdGNoZXJzKSB7XG4gIGlmIChzdWJNYXRjaGVycy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gZXZlcnl0aGluZ01hdGNoZXI7XG4gIH1cblxuICBpZiAoc3ViTWF0Y2hlcnMubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIHN1Yk1hdGNoZXJzWzBdO1xuICB9XG5cbiAgcmV0dXJuIGRvY09yQnJhbmNoZXMgPT4ge1xuICAgIGNvbnN0IG1hdGNoID0ge307XG4gICAgbWF0Y2gucmVzdWx0ID0gc3ViTWF0Y2hlcnMuZXZlcnkoZm4gPT4ge1xuICAgICAgY29uc3Qgc3ViUmVzdWx0ID0gZm4oZG9jT3JCcmFuY2hlcyk7XG5cbiAgICAgIC8vIENvcHkgYSAnZGlzdGFuY2UnIG51bWJlciBvdXQgb2YgdGhlIGZpcnN0IHN1Yi1tYXRjaGVyIHRoYXQgaGFzXG4gICAgICAvLyBvbmUuIFllcywgdGhpcyBtZWFucyB0aGF0IGlmIHRoZXJlIGFyZSBtdWx0aXBsZSAkbmVhciBmaWVsZHMgaW4gYVxuICAgICAgLy8gcXVlcnksIHNvbWV0aGluZyBhcmJpdHJhcnkgaGFwcGVuczsgdGhpcyBhcHBlYXJzIHRvIGJlIGNvbnNpc3RlbnQgd2l0aFxuICAgICAgLy8gTW9uZ28uXG4gICAgICBpZiAoc3ViUmVzdWx0LnJlc3VsdCAmJlxuICAgICAgICAgIHN1YlJlc3VsdC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgICAgbWF0Y2guZGlzdGFuY2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBtYXRjaC5kaXN0YW5jZSA9IHN1YlJlc3VsdC5kaXN0YW5jZTtcbiAgICAgIH1cblxuICAgICAgLy8gU2ltaWxhcmx5LCBwcm9wYWdhdGUgYXJyYXlJbmRpY2VzIGZyb20gc3ViLW1hdGNoZXJzLi4uIGJ1dCB0byBtYXRjaFxuICAgICAgLy8gTW9uZ29EQiBiZWhhdmlvciwgdGhpcyB0aW1lIHRoZSAqbGFzdCogc3ViLW1hdGNoZXIgd2l0aCBhcnJheUluZGljZXNcbiAgICAgIC8vIHdpbnMuXG4gICAgICBpZiAoc3ViUmVzdWx0LnJlc3VsdCAmJiBzdWJSZXN1bHQuYXJyYXlJbmRpY2VzKSB7XG4gICAgICAgIG1hdGNoLmFycmF5SW5kaWNlcyA9IHN1YlJlc3VsdC5hcnJheUluZGljZXM7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzdWJSZXN1bHQucmVzdWx0O1xuICAgIH0pO1xuXG4gICAgLy8gSWYgd2UgZGlkbid0IGFjdHVhbGx5IG1hdGNoLCBmb3JnZXQgYW55IGV4dHJhIG1ldGFkYXRhIHdlIGNhbWUgdXAgd2l0aC5cbiAgICBpZiAoIW1hdGNoLnJlc3VsdCkge1xuICAgICAgZGVsZXRlIG1hdGNoLmRpc3RhbmNlO1xuICAgICAgZGVsZXRlIG1hdGNoLmFycmF5SW5kaWNlcztcbiAgICB9XG5cbiAgICByZXR1cm4gbWF0Y2g7XG4gIH07XG59XG5cbmNvbnN0IGFuZERvY3VtZW50TWF0Y2hlcnMgPSBhbmRTb21lTWF0Y2hlcnM7XG5jb25zdCBhbmRCcmFuY2hlZE1hdGNoZXJzID0gYW5kU29tZU1hdGNoZXJzO1xuXG5mdW5jdGlvbiBjb21waWxlQXJyYXlPZkRvY3VtZW50U2VsZWN0b3JzKHNlbGVjdG9ycywgbWF0Y2hlciwgaW5FbGVtTWF0Y2gpIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KHNlbGVjdG9ycykgfHwgc2VsZWN0b3JzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKCckYW5kLyRvci8kbm9yIG11c3QgYmUgbm9uZW1wdHkgYXJyYXknKTtcbiAgfVxuXG4gIHJldHVybiBzZWxlY3RvcnMubWFwKHN1YlNlbGVjdG9yID0+IHtcbiAgICBpZiAoIUxvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdChzdWJTZWxlY3RvcikpIHtcbiAgICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKCckb3IvJGFuZC8kbm9yIGVudHJpZXMgbmVlZCB0byBiZSBmdWxsIG9iamVjdHMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29tcGlsZURvY3VtZW50U2VsZWN0b3Ioc3ViU2VsZWN0b3IsIG1hdGNoZXIsIHtpbkVsZW1NYXRjaH0pO1xuICB9KTtcbn1cblxuLy8gVGFrZXMgaW4gYSBzZWxlY3RvciB0aGF0IGNvdWxkIG1hdGNoIGEgZnVsbCBkb2N1bWVudCAoZWcsIHRoZSBvcmlnaW5hbFxuLy8gc2VsZWN0b3IpLiBSZXR1cm5zIGEgZnVuY3Rpb24gbWFwcGluZyBkb2N1bWVudC0+cmVzdWx0IG9iamVjdC5cbi8vXG4vLyBtYXRjaGVyIGlzIHRoZSBNYXRjaGVyIG9iamVjdCB3ZSBhcmUgY29tcGlsaW5nLlxuLy9cbi8vIElmIHRoaXMgaXMgdGhlIHJvb3QgZG9jdW1lbnQgc2VsZWN0b3IgKGllLCBub3Qgd3JhcHBlZCBpbiAkYW5kIG9yIHRoZSBsaWtlKSxcbi8vIHRoZW4gaXNSb290IGlzIHRydWUuIChUaGlzIGlzIHVzZWQgYnkgJG5lYXIuKVxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBpbGVEb2N1bWVudFNlbGVjdG9yKGRvY1NlbGVjdG9yLCBtYXRjaGVyLCBvcHRpb25zID0ge30pIHtcbiAgY29uc3QgZG9jTWF0Y2hlcnMgPSBPYmplY3Qua2V5cyhkb2NTZWxlY3RvcikubWFwKGtleSA9PiB7XG4gICAgY29uc3Qgc3ViU2VsZWN0b3IgPSBkb2NTZWxlY3RvcltrZXldO1xuXG4gICAgaWYgKGtleS5zdWJzdHIoMCwgMSkgPT09ICckJykge1xuICAgICAgLy8gT3V0ZXIgb3BlcmF0b3JzIGFyZSBlaXRoZXIgbG9naWNhbCBvcGVyYXRvcnMgKHRoZXkgcmVjdXJzZSBiYWNrIGludG9cbiAgICAgIC8vIHRoaXMgZnVuY3Rpb24pLCBvciAkd2hlcmUuXG4gICAgICBpZiAoIWhhc093bi5jYWxsKExPR0lDQUxfT1BFUkFUT1JTLCBrZXkpKSB7XG4gICAgICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKGBVbnJlY29nbml6ZWQgbG9naWNhbCBvcGVyYXRvcjogJHtrZXl9YCk7XG4gICAgICB9XG5cbiAgICAgIG1hdGNoZXIuX2lzU2ltcGxlID0gZmFsc2U7XG4gICAgICByZXR1cm4gTE9HSUNBTF9PUEVSQVRPUlNba2V5XShzdWJTZWxlY3RvciwgbWF0Y2hlciwgb3B0aW9ucy5pbkVsZW1NYXRjaCk7XG4gICAgfVxuXG4gICAgLy8gUmVjb3JkIHRoaXMgcGF0aCwgYnV0IG9ubHkgaWYgd2UgYXJlbid0IGluIGFuIGVsZW1NYXRjaGVyLCBzaW5jZSBpbiBhblxuICAgIC8vIGVsZW1NYXRjaCB0aGlzIGlzIGEgcGF0aCBpbnNpZGUgYW4gb2JqZWN0IGluIGFuIGFycmF5LCBub3QgaW4gdGhlIGRvY1xuICAgIC8vIHJvb3QuXG4gICAgaWYgKCFvcHRpb25zLmluRWxlbU1hdGNoKSB7XG4gICAgICBtYXRjaGVyLl9yZWNvcmRQYXRoVXNlZChrZXkpO1xuICAgIH1cblxuICAgIC8vIERvbid0IGFkZCBhIG1hdGNoZXIgaWYgc3ViU2VsZWN0b3IgaXMgYSBmdW5jdGlvbiAtLSB0aGlzIGlzIHRvIG1hdGNoXG4gICAgLy8gdGhlIGJlaGF2aW9yIG9mIE1ldGVvciBvbiB0aGUgc2VydmVyIChpbmhlcml0ZWQgZnJvbSB0aGUgbm9kZSBtb25nb2RiXG4gICAgLy8gZHJpdmVyKSwgd2hpY2ggaXMgdG8gaWdub3JlIGFueSBwYXJ0IG9mIGEgc2VsZWN0b3Igd2hpY2ggaXMgYSBmdW5jdGlvbi5cbiAgICBpZiAodHlwZW9mIHN1YlNlbGVjdG9yID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIGNvbnN0IGxvb2tVcEJ5SW5kZXggPSBtYWtlTG9va3VwRnVuY3Rpb24oa2V5KTtcbiAgICBjb25zdCB2YWx1ZU1hdGNoZXIgPSBjb21waWxlVmFsdWVTZWxlY3RvcihcbiAgICAgIHN1YlNlbGVjdG9yLFxuICAgICAgbWF0Y2hlcixcbiAgICAgIG9wdGlvbnMuaXNSb290XG4gICAgKTtcblxuICAgIHJldHVybiBkb2MgPT4gdmFsdWVNYXRjaGVyKGxvb2tVcEJ5SW5kZXgoZG9jKSk7XG4gIH0pLmZpbHRlcihCb29sZWFuKTtcblxuICByZXR1cm4gYW5kRG9jdW1lbnRNYXRjaGVycyhkb2NNYXRjaGVycyk7XG59XG5cbi8vIFRha2VzIGluIGEgc2VsZWN0b3IgdGhhdCBjb3VsZCBtYXRjaCBhIGtleS1pbmRleGVkIHZhbHVlIGluIGEgZG9jdW1lbnQ7IGVnLFxuLy8geyRndDogNSwgJGx0OiA5fSwgb3IgYSByZWd1bGFyIGV4cHJlc3Npb24sIG9yIGFueSBub24tZXhwcmVzc2lvbiBvYmplY3QgKHRvXG4vLyBpbmRpY2F0ZSBlcXVhbGl0eSkuICBSZXR1cm5zIGEgYnJhbmNoZWQgbWF0Y2hlcjogYSBmdW5jdGlvbiBtYXBwaW5nXG4vLyBbYnJhbmNoZWQgdmFsdWVdLT5yZXN1bHQgb2JqZWN0LlxuZnVuY3Rpb24gY29tcGlsZVZhbHVlU2VsZWN0b3IodmFsdWVTZWxlY3RvciwgbWF0Y2hlciwgaXNSb290KSB7XG4gIGlmICh2YWx1ZVNlbGVjdG9yIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgbWF0Y2hlci5faXNTaW1wbGUgPSBmYWxzZTtcbiAgICByZXR1cm4gY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoXG4gICAgICByZWdleHBFbGVtZW50TWF0Y2hlcih2YWx1ZVNlbGVjdG9yKVxuICAgICk7XG4gIH1cblxuICBpZiAoaXNPcGVyYXRvck9iamVjdCh2YWx1ZVNlbGVjdG9yKSkge1xuICAgIHJldHVybiBvcGVyYXRvckJyYW5jaGVkTWF0Y2hlcih2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyLCBpc1Jvb3QpO1xuICB9XG5cbiAgcmV0dXJuIGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyKFxuICAgIGVxdWFsaXR5RWxlbWVudE1hdGNoZXIodmFsdWVTZWxlY3RvcilcbiAgKTtcbn1cblxuLy8gR2l2ZW4gYW4gZWxlbWVudCBtYXRjaGVyICh3aGljaCBldmFsdWF0ZXMgYSBzaW5nbGUgdmFsdWUpLCByZXR1cm5zIGEgYnJhbmNoZWRcbi8vIHZhbHVlICh3aGljaCBldmFsdWF0ZXMgdGhlIGVsZW1lbnQgbWF0Y2hlciBvbiBhbGwgdGhlIGJyYW5jaGVzIGFuZCByZXR1cm5zIGFcbi8vIG1vcmUgc3RydWN0dXJlZCByZXR1cm4gdmFsdWUgcG9zc2libHkgaW5jbHVkaW5nIGFycmF5SW5kaWNlcykuXG5mdW5jdGlvbiBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlcihlbGVtZW50TWF0Y2hlciwgb3B0aW9ucyA9IHt9KSB7XG4gIHJldHVybiBicmFuY2hlcyA9PiB7XG4gICAgY29uc3QgZXhwYW5kZWQgPSBvcHRpb25zLmRvbnRFeHBhbmRMZWFmQXJyYXlzXG4gICAgICA/IGJyYW5jaGVzXG4gICAgICA6IGV4cGFuZEFycmF5c0luQnJhbmNoZXMoYnJhbmNoZXMsIG9wdGlvbnMuZG9udEluY2x1ZGVMZWFmQXJyYXlzKTtcblxuICAgIGNvbnN0IG1hdGNoID0ge307XG4gICAgbWF0Y2gucmVzdWx0ID0gZXhwYW5kZWQuc29tZShlbGVtZW50ID0+IHtcbiAgICAgIGxldCBtYXRjaGVkID0gZWxlbWVudE1hdGNoZXIoZWxlbWVudC52YWx1ZSk7XG5cbiAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgJGVsZW1NYXRjaDogaXQgbWVhbnMgXCJ0cnVlLCBhbmQgdXNlIHRoaXMgYXMgYW4gYXJyYXlcbiAgICAgIC8vIGluZGV4IGlmIEkgZGlkbid0IGFscmVhZHkgaGF2ZSBvbmVcIi5cbiAgICAgIGlmICh0eXBlb2YgbWF0Y2hlZCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgLy8gWFhYIFRoaXMgY29kZSBkYXRlcyBmcm9tIHdoZW4gd2Ugb25seSBzdG9yZWQgYSBzaW5nbGUgYXJyYXkgaW5kZXhcbiAgICAgICAgLy8gKGZvciB0aGUgb3V0ZXJtb3N0IGFycmF5KS4gU2hvdWxkIHdlIGJlIGFsc28gaW5jbHVkaW5nIGRlZXBlciBhcnJheVxuICAgICAgICAvLyBpbmRpY2VzIGZyb20gdGhlICRlbGVtTWF0Y2ggbWF0Y2g/XG4gICAgICAgIGlmICghZWxlbWVudC5hcnJheUluZGljZXMpIHtcbiAgICAgICAgICBlbGVtZW50LmFycmF5SW5kaWNlcyA9IFttYXRjaGVkXTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hdGNoZWQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiBzb21lIGVsZW1lbnQgbWF0Y2hlZCwgYW5kIGl0J3MgdGFnZ2VkIHdpdGggYXJyYXkgaW5kaWNlcywgaW5jbHVkZVxuICAgICAgLy8gdGhvc2UgaW5kaWNlcyBpbiBvdXIgcmVzdWx0IG9iamVjdC5cbiAgICAgIGlmIChtYXRjaGVkICYmIGVsZW1lbnQuYXJyYXlJbmRpY2VzKSB7XG4gICAgICAgIG1hdGNoLmFycmF5SW5kaWNlcyA9IGVsZW1lbnQuYXJyYXlJbmRpY2VzO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbWF0Y2hlZDtcbiAgICB9KTtcblxuICAgIHJldHVybiBtYXRjaDtcbiAgfTtcbn1cblxuLy8gSGVscGVycyBmb3IgJG5lYXIuXG5mdW5jdGlvbiBkaXN0YW5jZUNvb3JkaW5hdGVQYWlycyhhLCBiKSB7XG4gIGNvbnN0IHBvaW50QSA9IHBvaW50VG9BcnJheShhKTtcbiAgY29uc3QgcG9pbnRCID0gcG9pbnRUb0FycmF5KGIpO1xuXG4gIHJldHVybiBNYXRoLmh5cG90KHBvaW50QVswXSAtIHBvaW50QlswXSwgcG9pbnRBWzFdIC0gcG9pbnRCWzFdKTtcbn1cblxuLy8gVGFrZXMgc29tZXRoaW5nIHRoYXQgaXMgbm90IGFuIG9wZXJhdG9yIG9iamVjdCBhbmQgcmV0dXJucyBhbiBlbGVtZW50IG1hdGNoZXJcbi8vIGZvciBlcXVhbGl0eSB3aXRoIHRoYXQgdGhpbmcuXG5leHBvcnQgZnVuY3Rpb24gZXF1YWxpdHlFbGVtZW50TWF0Y2hlcihlbGVtZW50U2VsZWN0b3IpIHtcbiAgaWYgKGlzT3BlcmF0b3JPYmplY3QoZWxlbWVudFNlbGVjdG9yKSkge1xuICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKCdDYW5cXCd0IGNyZWF0ZSBlcXVhbGl0eVZhbHVlU2VsZWN0b3IgZm9yIG9wZXJhdG9yIG9iamVjdCcpO1xuICB9XG5cbiAgLy8gU3BlY2lhbC1jYXNlOiBudWxsIGFuZCB1bmRlZmluZWQgYXJlIGVxdWFsIChpZiB5b3UgZ290IHVuZGVmaW5lZCBpbiB0aGVyZVxuICAvLyBzb21ld2hlcmUsIG9yIGlmIHlvdSBnb3QgaXQgZHVlIHRvIHNvbWUgYnJhbmNoIGJlaW5nIG5vbi1leGlzdGVudCBpbiB0aGVcbiAgLy8gd2VpcmQgc3BlY2lhbCBjYXNlKSwgZXZlbiB0aG91Z2ggdGhleSBhcmVuJ3Qgd2l0aCBFSlNPTi5lcXVhbHMuXG4gIC8vIHVuZGVmaW5lZCBvciBudWxsXG4gIGlmIChlbGVtZW50U2VsZWN0b3IgPT0gbnVsbCkge1xuICAgIHJldHVybiB2YWx1ZSA9PiB2YWx1ZSA9PSBudWxsO1xuICB9XG5cbiAgcmV0dXJuIHZhbHVlID0+IExvY2FsQ29sbGVjdGlvbi5fZi5fZXF1YWwoZWxlbWVudFNlbGVjdG9yLCB2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGV2ZXJ5dGhpbmdNYXRjaGVyKGRvY09yQnJhbmNoZWRWYWx1ZXMpIHtcbiAgcmV0dXJuIHtyZXN1bHQ6IHRydWV9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyhicmFuY2hlcywgc2tpcFRoZUFycmF5cykge1xuICBjb25zdCBicmFuY2hlc091dCA9IFtdO1xuXG4gIGJyYW5jaGVzLmZvckVhY2goYnJhbmNoID0+IHtcbiAgICBjb25zdCB0aGlzSXNBcnJheSA9IEFycmF5LmlzQXJyYXkoYnJhbmNoLnZhbHVlKTtcblxuICAgIC8vIFdlIGluY2x1ZGUgdGhlIGJyYW5jaCBpdHNlbGYsICpVTkxFU1MqIHdlIGl0J3MgYW4gYXJyYXkgdGhhdCB3ZSdyZSBnb2luZ1xuICAgIC8vIHRvIGl0ZXJhdGUgYW5kIHdlJ3JlIHRvbGQgdG8gc2tpcCBhcnJheXMuICAoVGhhdCdzIHJpZ2h0LCB3ZSBpbmNsdWRlIHNvbWVcbiAgICAvLyBhcnJheXMgZXZlbiBza2lwVGhlQXJyYXlzIGlzIHRydWU6IHRoZXNlIGFyZSBhcnJheXMgdGhhdCB3ZXJlIGZvdW5kIHZpYVxuICAgIC8vIGV4cGxpY2l0IG51bWVyaWNhbCBpbmRpY2VzLilcbiAgICBpZiAoIShza2lwVGhlQXJyYXlzICYmIHRoaXNJc0FycmF5ICYmICFicmFuY2guZG9udEl0ZXJhdGUpKSB7XG4gICAgICBicmFuY2hlc091dC5wdXNoKHthcnJheUluZGljZXM6IGJyYW5jaC5hcnJheUluZGljZXMsIHZhbHVlOiBicmFuY2gudmFsdWV9KTtcbiAgICB9XG5cbiAgICBpZiAodGhpc0lzQXJyYXkgJiYgIWJyYW5jaC5kb250SXRlcmF0ZSkge1xuICAgICAgYnJhbmNoLnZhbHVlLmZvckVhY2goKHZhbHVlLCBpKSA9PiB7XG4gICAgICAgIGJyYW5jaGVzT3V0LnB1c2goe1xuICAgICAgICAgIGFycmF5SW5kaWNlczogKGJyYW5jaC5hcnJheUluZGljZXMgfHwgW10pLmNvbmNhdChpKSxcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGJyYW5jaGVzT3V0O1xufVxuXG4vLyBIZWxwZXJzIGZvciAkYml0c0FsbFNldC8kYml0c0FueVNldC8kYml0c0FsbENsZWFyLyRiaXRzQW55Q2xlYXIuXG5mdW5jdGlvbiBnZXRPcGVyYW5kQml0bWFzayhvcGVyYW5kLCBzZWxlY3Rvcikge1xuICAvLyBudW1lcmljIGJpdG1hc2tcbiAgLy8gWW91IGNhbiBwcm92aWRlIGEgbnVtZXJpYyBiaXRtYXNrIHRvIGJlIG1hdGNoZWQgYWdhaW5zdCB0aGUgb3BlcmFuZCBmaWVsZC5cbiAgLy8gSXQgbXVzdCBiZSByZXByZXNlbnRhYmxlIGFzIGEgbm9uLW5lZ2F0aXZlIDMyLWJpdCBzaWduZWQgaW50ZWdlci5cbiAgLy8gT3RoZXJ3aXNlLCAkYml0c0FsbFNldCB3aWxsIHJldHVybiBhbiBlcnJvci5cbiAgaWYgKE51bWJlci5pc0ludGVnZXIob3BlcmFuZCkgJiYgb3BlcmFuZCA+PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KG5ldyBJbnQzMkFycmF5KFtvcGVyYW5kXSkuYnVmZmVyKTtcbiAgfVxuXG4gIC8vIGJpbmRhdGEgYml0bWFza1xuICAvLyBZb3UgY2FuIGFsc28gdXNlIGFuIGFyYml0cmFyaWx5IGxhcmdlIEJpbkRhdGEgaW5zdGFuY2UgYXMgYSBiaXRtYXNrLlxuICBpZiAoRUpTT04uaXNCaW5hcnkob3BlcmFuZCkpIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkob3BlcmFuZC5idWZmZXIpO1xuICB9XG5cbiAgLy8gcG9zaXRpb24gbGlzdFxuICAvLyBJZiBxdWVyeWluZyBhIGxpc3Qgb2YgYml0IHBvc2l0aW9ucywgZWFjaCA8cG9zaXRpb24+IG11c3QgYmUgYSBub24tbmVnYXRpdmVcbiAgLy8gaW50ZWdlci4gQml0IHBvc2l0aW9ucyBzdGFydCBhdCAwIGZyb20gdGhlIGxlYXN0IHNpZ25pZmljYW50IGJpdC5cbiAgaWYgKEFycmF5LmlzQXJyYXkob3BlcmFuZCkgJiZcbiAgICAgIG9wZXJhbmQuZXZlcnkoeCA9PiBOdW1iZXIuaXNJbnRlZ2VyKHgpICYmIHggPj0gMCkpIHtcbiAgICBjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoKE1hdGgubWF4KC4uLm9wZXJhbmQpID4+IDMpICsgMSk7XG4gICAgY29uc3QgdmlldyA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG5cbiAgICBvcGVyYW5kLmZvckVhY2goeCA9PiB7XG4gICAgICB2aWV3W3ggPj4gM10gfD0gMSA8PCAoeCAmIDB4Nyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdmlldztcbiAgfVxuXG4gIC8vIGJhZCBvcGVyYW5kXG4gIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKFxuICAgIGBvcGVyYW5kIHRvICR7c2VsZWN0b3J9IG11c3QgYmUgYSBudW1lcmljIGJpdG1hc2sgKHJlcHJlc2VudGFibGUgYXMgYSBgICtcbiAgICAnbm9uLW5lZ2F0aXZlIDMyLWJpdCBzaWduZWQgaW50ZWdlciksIGEgYmluZGF0YSBiaXRtYXNrIG9yIGFuIGFycmF5IHdpdGggJyArXG4gICAgJ2JpdCBwb3NpdGlvbnMgKG5vbi1uZWdhdGl2ZSBpbnRlZ2VycyknXG4gICk7XG59XG5cbmZ1bmN0aW9uIGdldFZhbHVlQml0bWFzayh2YWx1ZSwgbGVuZ3RoKSB7XG4gIC8vIFRoZSBmaWVsZCB2YWx1ZSBtdXN0IGJlIGVpdGhlciBudW1lcmljYWwgb3IgYSBCaW5EYXRhIGluc3RhbmNlLiBPdGhlcndpc2UsXG4gIC8vICRiaXRzLi4uIHdpbGwgbm90IG1hdGNoIHRoZSBjdXJyZW50IGRvY3VtZW50LlxuXG4gIC8vIG51bWVyaWNhbFxuICBpZiAoTnVtYmVyLmlzU2FmZUludGVnZXIodmFsdWUpKSB7XG4gICAgLy8gJGJpdHMuLi4gd2lsbCBub3QgbWF0Y2ggbnVtZXJpY2FsIHZhbHVlcyB0aGF0IGNhbm5vdCBiZSByZXByZXNlbnRlZCBhcyBhXG4gICAgLy8gc2lnbmVkIDY0LWJpdCBpbnRlZ2VyLiBUaGlzIGNhbiBiZSB0aGUgY2FzZSBpZiBhIHZhbHVlIGlzIGVpdGhlciB0b29cbiAgICAvLyBsYXJnZSBvciBzbWFsbCB0byBmaXQgaW4gYSBzaWduZWQgNjQtYml0IGludGVnZXIsIG9yIGlmIGl0IGhhcyBhXG4gICAgLy8gZnJhY3Rpb25hbCBjb21wb25lbnQuXG4gICAgY29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKFxuICAgICAgTWF0aC5tYXgobGVuZ3RoLCAyICogVWludDMyQXJyYXkuQllURVNfUEVSX0VMRU1FTlQpXG4gICAgKTtcblxuICAgIGxldCB2aWV3ID0gbmV3IFVpbnQzMkFycmF5KGJ1ZmZlciwgMCwgMik7XG4gICAgdmlld1swXSA9IHZhbHVlICUgKCgxIDw8IDE2KSAqICgxIDw8IDE2KSkgfCAwO1xuICAgIHZpZXdbMV0gPSB2YWx1ZSAvICgoMSA8PCAxNikgKiAoMSA8PCAxNikpIHwgMDtcblxuICAgIC8vIHNpZ24gZXh0ZW5zaW9uXG4gICAgaWYgKHZhbHVlIDwgMCkge1xuICAgICAgdmlldyA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlciwgMik7XG4gICAgICB2aWV3LmZvckVhY2goKGJ5dGUsIGkpID0+IHtcbiAgICAgICAgdmlld1tpXSA9IDB4ZmY7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgfVxuXG4gIC8vIGJpbmRhdGFcbiAgaWYgKEVKU09OLmlzQmluYXJ5KHZhbHVlKSkge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheSh2YWx1ZS5idWZmZXIpO1xuICB9XG5cbiAgLy8gbm8gbWF0Y2hcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBBY3R1YWxseSBpbnNlcnRzIGEga2V5IHZhbHVlIGludG8gdGhlIHNlbGVjdG9yIGRvY3VtZW50XG4vLyBIb3dldmVyLCB0aGlzIGNoZWNrcyB0aGVyZSBpcyBubyBhbWJpZ3VpdHkgaW4gc2V0dGluZ1xuLy8gdGhlIHZhbHVlIGZvciB0aGUgZ2l2ZW4ga2V5LCB0aHJvd3Mgb3RoZXJ3aXNlXG5mdW5jdGlvbiBpbnNlcnRJbnRvRG9jdW1lbnQoZG9jdW1lbnQsIGtleSwgdmFsdWUpIHtcbiAgT2JqZWN0LmtleXMoZG9jdW1lbnQpLmZvckVhY2goZXhpc3RpbmdLZXkgPT4ge1xuICAgIGlmIChcbiAgICAgIChleGlzdGluZ0tleS5sZW5ndGggPiBrZXkubGVuZ3RoICYmIGV4aXN0aW5nS2V5LmluZGV4T2YoYCR7a2V5fS5gKSA9PT0gMCkgfHxcbiAgICAgIChrZXkubGVuZ3RoID4gZXhpc3RpbmdLZXkubGVuZ3RoICYmIGtleS5pbmRleE9mKGAke2V4aXN0aW5nS2V5fS5gKSA9PT0gMClcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKFxuICAgICAgICBgY2Fubm90IGluZmVyIHF1ZXJ5IGZpZWxkcyB0byBzZXQsIGJvdGggcGF0aHMgJyR7ZXhpc3RpbmdLZXl9JyBhbmQgJyR7a2V5fScgYXJlIG1hdGNoZWRgXG4gICAgICApO1xuICAgIH0gZWxzZSBpZiAoZXhpc3RpbmdLZXkgPT09IGtleSkge1xuICAgICAgdGhyb3cgbmV3IE1pbmlNb25nb1F1ZXJ5RXJyb3IoXG4gICAgICAgIGBjYW5ub3QgaW5mZXIgcXVlcnkgZmllbGRzIHRvIHNldCwgcGF0aCAnJHtrZXl9JyBpcyBtYXRjaGVkIHR3aWNlYFxuICAgICAgKTtcbiAgICB9XG4gIH0pO1xuXG4gIGRvY3VtZW50W2tleV0gPSB2YWx1ZTtcbn1cblxuLy8gUmV0dXJucyBhIGJyYW5jaGVkIG1hdGNoZXIgdGhhdCBtYXRjaGVzIGlmZiB0aGUgZ2l2ZW4gbWF0Y2hlciBkb2VzIG5vdC5cbi8vIE5vdGUgdGhhdCB0aGlzIGltcGxpY2l0bHkgXCJkZU1vcmdhbml6ZXNcIiB0aGUgd3JhcHBlZCBmdW5jdGlvbi4gIGllLCBpdFxuLy8gbWVhbnMgdGhhdCBBTEwgYnJhbmNoIHZhbHVlcyBuZWVkIHRvIGZhaWwgdG8gbWF0Y2ggaW5uZXJCcmFuY2hlZE1hdGNoZXIuXG5mdW5jdGlvbiBpbnZlcnRCcmFuY2hlZE1hdGNoZXIoYnJhbmNoZWRNYXRjaGVyKSB7XG4gIHJldHVybiBicmFuY2hWYWx1ZXMgPT4ge1xuICAgIC8vIFdlIGV4cGxpY2l0bHkgY2hvb3NlIHRvIHN0cmlwIGFycmF5SW5kaWNlcyBoZXJlOiBpdCBkb2Vzbid0IG1ha2Ugc2Vuc2UgdG9cbiAgICAvLyBzYXkgXCJ1cGRhdGUgdGhlIGFycmF5IGVsZW1lbnQgdGhhdCBkb2VzIG5vdCBtYXRjaCBzb21ldGhpbmdcIiwgYXQgbGVhc3RcbiAgICAvLyBpbiBtb25nby1sYW5kLlxuICAgIHJldHVybiB7cmVzdWx0OiAhYnJhbmNoZWRNYXRjaGVyKGJyYW5jaFZhbHVlcykucmVzdWx0fTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSW5kZXhhYmxlKG9iaikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShvYmopIHx8IExvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdChvYmopO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOdW1lcmljS2V5KHMpIHtcbiAgcmV0dXJuIC9eWzAtOV0rJC8udGVzdChzKTtcbn1cblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoaXMgaXMgYW4gb2JqZWN0IHdpdGggYXQgbGVhc3Qgb25lIGtleSBhbmQgYWxsIGtleXMgYmVnaW5cbi8vIHdpdGggJC4gIFVubGVzcyBpbmNvbnNpc3RlbnRPSyBpcyBzZXQsIHRocm93cyBpZiBzb21lIGtleXMgYmVnaW4gd2l0aCAkIGFuZFxuLy8gb3RoZXJzIGRvbid0LlxuZXhwb3J0IGZ1bmN0aW9uIGlzT3BlcmF0b3JPYmplY3QodmFsdWVTZWxlY3RvciwgaW5jb25zaXN0ZW50T0spIHtcbiAgaWYgKCFMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QodmFsdWVTZWxlY3RvcikpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBsZXQgdGhlc2VBcmVPcGVyYXRvcnMgPSB1bmRlZmluZWQ7XG4gIE9iamVjdC5rZXlzKHZhbHVlU2VsZWN0b3IpLmZvckVhY2goc2VsS2V5ID0+IHtcbiAgICBjb25zdCB0aGlzSXNPcGVyYXRvciA9IHNlbEtleS5zdWJzdHIoMCwgMSkgPT09ICckJyB8fCBzZWxLZXkgPT09ICdkaWZmJztcblxuICAgIGlmICh0aGVzZUFyZU9wZXJhdG9ycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGVzZUFyZU9wZXJhdG9ycyA9IHRoaXNJc09wZXJhdG9yO1xuICAgIH0gZWxzZSBpZiAodGhlc2VBcmVPcGVyYXRvcnMgIT09IHRoaXNJc09wZXJhdG9yKSB7XG4gICAgICBpZiAoIWluY29uc2lzdGVudE9LKSB7XG4gICAgICAgIHRocm93IG5ldyBNaW5pTW9uZ29RdWVyeUVycm9yKFxuICAgICAgICAgIGBJbmNvbnNpc3RlbnQgb3BlcmF0b3I6ICR7SlNPTi5zdHJpbmdpZnkodmFsdWVTZWxlY3Rvcil9YFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICB0aGVzZUFyZU9wZXJhdG9ycyA9IGZhbHNlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuICEhdGhlc2VBcmVPcGVyYXRvcnM7IC8vIHt9IGhhcyBubyBvcGVyYXRvcnNcbn1cblxuLy8gSGVscGVyIGZvciAkbHQvJGd0LyRsdGUvJGd0ZS5cbmZ1bmN0aW9uIG1ha2VJbmVxdWFsaXR5KGNtcFZhbHVlQ29tcGFyYXRvcikge1xuICByZXR1cm4ge1xuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCkge1xuICAgICAgLy8gQXJyYXlzIG5ldmVyIGNvbXBhcmUgZmFsc2Ugd2l0aCBub24tYXJyYXlzIGZvciBhbnkgaW5lcXVhbGl0eS5cbiAgICAgIC8vIFhYWCBUaGlzIHdhcyBiZWhhdmlvciB3ZSBvYnNlcnZlZCBpbiBwcmUtcmVsZWFzZSBNb25nb0RCIDIuNSwgYnV0XG4gICAgICAvLyAgICAgaXQgc2VlbXMgdG8gaGF2ZSBiZWVuIHJldmVydGVkLlxuICAgICAgLy8gICAgIFNlZSBodHRwczovL2ppcmEubW9uZ29kYi5vcmcvYnJvd3NlL1NFUlZFUi0xMTQ0NFxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob3BlcmFuZCkpIHtcbiAgICAgICAgcmV0dXJuICgpID0+IGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyBTcGVjaWFsIGNhc2U6IGNvbnNpZGVyIHVuZGVmaW5lZCBhbmQgbnVsbCB0aGUgc2FtZSAoc28gdHJ1ZSB3aXRoXG4gICAgICAvLyAkZ3RlLyRsdGUpLlxuICAgICAgaWYgKG9wZXJhbmQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBvcGVyYW5kID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgb3BlcmFuZFR5cGUgPSBMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUob3BlcmFuZCk7XG5cbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29tcGFyaXNvbnMgYXJlIG5ldmVyIHRydWUgYW1vbmcgdGhpbmdzIG9mIGRpZmZlcmVudCB0eXBlIChleGNlcHRcbiAgICAgICAgLy8gbnVsbCB2cyB1bmRlZmluZWQpLlxuICAgICAgICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9mLl90eXBlKHZhbHVlKSAhPT0gb3BlcmFuZFR5cGUpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY21wVmFsdWVDb21wYXJhdG9yKExvY2FsQ29sbGVjdGlvbi5fZi5fY21wKHZhbHVlLCBvcGVyYW5kKSk7XG4gICAgICB9O1xuICAgIH0sXG4gIH07XG59XG5cbi8vIG1ha2VMb29rdXBGdW5jdGlvbihrZXkpIHJldHVybnMgYSBsb29rdXAgZnVuY3Rpb24uXG4vL1xuLy8gQSBsb29rdXAgZnVuY3Rpb24gdGFrZXMgaW4gYSBkb2N1bWVudCBhbmQgcmV0dXJucyBhbiBhcnJheSBvZiBtYXRjaGluZ1xuLy8gYnJhbmNoZXMuICBJZiBubyBhcnJheXMgYXJlIGZvdW5kIHdoaWxlIGxvb2tpbmcgdXAgdGhlIGtleSwgdGhpcyBhcnJheSB3aWxsXG4vLyBoYXZlIGV4YWN0bHkgb25lIGJyYW5jaGVzIChwb3NzaWJseSAndW5kZWZpbmVkJywgaWYgc29tZSBzZWdtZW50IG9mIHRoZSBrZXlcbi8vIHdhcyBub3QgZm91bmQpLlxuLy9cbi8vIElmIGFycmF5cyBhcmUgZm91bmQgaW4gdGhlIG1pZGRsZSwgdGhpcyBjYW4gaGF2ZSBtb3JlIHRoYW4gb25lIGVsZW1lbnQsIHNpbmNlXG4vLyB3ZSAnYnJhbmNoJy4gV2hlbiB3ZSAnYnJhbmNoJywgaWYgdGhlcmUgYXJlIG1vcmUga2V5IHNlZ21lbnRzIHRvIGxvb2sgdXAsXG4vLyB0aGVuIHdlIG9ubHkgcHVyc3VlIGJyYW5jaGVzIHRoYXQgYXJlIHBsYWluIG9iamVjdHMgKG5vdCBhcnJheXMgb3Igc2NhbGFycykuXG4vLyBUaGlzIG1lYW5zIHdlIGNhbiBhY3R1YWxseSBlbmQgdXAgd2l0aCBubyBicmFuY2hlcyFcbi8vXG4vLyBXZSBkbyAqTk9UKiBicmFuY2ggb24gYXJyYXlzIHRoYXQgYXJlIGZvdW5kIGF0IHRoZSBlbmQgKGllLCBhdCB0aGUgbGFzdFxuLy8gZG90dGVkIG1lbWJlciBvZiB0aGUga2V5KS4gV2UganVzdCByZXR1cm4gdGhhdCBhcnJheTsgaWYgeW91IHdhbnQgdG9cbi8vIGVmZmVjdGl2ZWx5ICdicmFuY2gnIG92ZXIgdGhlIGFycmF5J3MgdmFsdWVzLCBwb3N0LXByb2Nlc3MgdGhlIGxvb2t1cFxuLy8gZnVuY3Rpb24gd2l0aCBleHBhbmRBcnJheXNJbkJyYW5jaGVzLlxuLy9cbi8vIEVhY2ggYnJhbmNoIGlzIGFuIG9iamVjdCB3aXRoIGtleXM6XG4vLyAgLSB2YWx1ZTogdGhlIHZhbHVlIGF0IHRoZSBicmFuY2hcbi8vICAtIGRvbnRJdGVyYXRlOiBhbiBvcHRpb25hbCBib29sOyBpZiB0cnVlLCBpdCBtZWFucyB0aGF0ICd2YWx1ZScgaXMgYW4gYXJyYXlcbi8vICAgIHRoYXQgZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyBzaG91bGQgTk9UIGV4cGFuZC4gVGhpcyBzcGVjaWZpY2FsbHkgaGFwcGVuc1xuLy8gICAgd2hlbiB0aGVyZSBpcyBhIG51bWVyaWMgaW5kZXggaW4gdGhlIGtleSwgYW5kIGVuc3VyZXMgdGhlXG4vLyAgICBwZXJoYXBzLXN1cnByaXNpbmcgTW9uZ29EQiBiZWhhdmlvciB3aGVyZSB7J2EuMCc6IDV9IGRvZXMgTk9UXG4vLyAgICBtYXRjaCB7YTogW1s1XV19LlxuLy8gIC0gYXJyYXlJbmRpY2VzOiBpZiBhbnkgYXJyYXkgaW5kZXhpbmcgd2FzIGRvbmUgZHVyaW5nIGxvb2t1cCAoZWl0aGVyIGR1ZSB0b1xuLy8gICAgZXhwbGljaXQgbnVtZXJpYyBpbmRpY2VzIG9yIGltcGxpY2l0IGJyYW5jaGluZyksIHRoaXMgd2lsbCBiZSBhbiBhcnJheSBvZlxuLy8gICAgdGhlIGFycmF5IGluZGljZXMgdXNlZCwgZnJvbSBvdXRlcm1vc3QgdG8gaW5uZXJtb3N0OyBpdCBpcyBmYWxzZXkgb3Jcbi8vICAgIGFic2VudCBpZiBubyBhcnJheSBpbmRleCBpcyB1c2VkLiBJZiBhbiBleHBsaWNpdCBudW1lcmljIGluZGV4IGlzIHVzZWQsXG4vLyAgICB0aGUgaW5kZXggd2lsbCBiZSBmb2xsb3dlZCBpbiBhcnJheUluZGljZXMgYnkgdGhlIHN0cmluZyAneCcuXG4vL1xuLy8gICAgTm90ZTogYXJyYXlJbmRpY2VzIGlzIHVzZWQgZm9yIHR3byBwdXJwb3Nlcy4gRmlyc3QsIGl0IGlzIHVzZWQgdG9cbi8vICAgIGltcGxlbWVudCB0aGUgJyQnIG1vZGlmaWVyIGZlYXR1cmUsIHdoaWNoIG9ubHkgZXZlciBsb29rcyBhdCBpdHMgZmlyc3Rcbi8vICAgIGVsZW1lbnQuXG4vL1xuLy8gICAgU2Vjb25kLCBpdCBpcyB1c2VkIGZvciBzb3J0IGtleSBnZW5lcmF0aW9uLCB3aGljaCBuZWVkcyB0byBiZSBhYmxlIHRvIHRlbGxcbi8vICAgIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gZGlmZmVyZW50IHBhdGhzLiBNb3Jlb3ZlciwgaXQgbmVlZHMgdG9cbi8vICAgIGRpZmZlcmVudGlhdGUgYmV0d2VlbiBleHBsaWNpdCBhbmQgaW1wbGljaXQgYnJhbmNoaW5nLCB3aGljaCBpcyB3aHlcbi8vICAgIHRoZXJlJ3MgdGhlIHNvbWV3aGF0IGhhY2t5ICd4JyBlbnRyeTogdGhpcyBtZWFucyB0aGF0IGV4cGxpY2l0IGFuZFxuLy8gICAgaW1wbGljaXQgYXJyYXkgbG9va3VwcyB3aWxsIGhhdmUgZGlmZmVyZW50IGZ1bGwgYXJyYXlJbmRpY2VzIHBhdGhzLiAoVGhhdFxuLy8gICAgY29kZSBvbmx5IHJlcXVpcmVzIHRoYXQgZGlmZmVyZW50IHBhdGhzIGhhdmUgZGlmZmVyZW50IGFycmF5SW5kaWNlczsgaXRcbi8vICAgIGRvZXNuJ3QgYWN0dWFsbHkgJ3BhcnNlJyBhcnJheUluZGljZXMuIEFzIGFuIGFsdGVybmF0aXZlLCBhcnJheUluZGljZXNcbi8vICAgIGNvdWxkIGNvbnRhaW4gb2JqZWN0cyB3aXRoIGZsYWdzIGxpa2UgJ2ltcGxpY2l0JywgYnV0IEkgdGhpbmsgdGhhdCBvbmx5XG4vLyAgICBtYWtlcyB0aGUgY29kZSBzdXJyb3VuZGluZyB0aGVtIG1vcmUgY29tcGxleC4pXG4vL1xuLy8gICAgKEJ5IHRoZSB3YXksIHRoaXMgZmllbGQgZW5kcyB1cCBnZXR0aW5nIHBhc3NlZCBhcm91bmQgYSBsb3Qgd2l0aG91dFxuLy8gICAgY2xvbmluZywgc28gbmV2ZXIgbXV0YXRlIGFueSBhcnJheUluZGljZXMgZmllbGQvdmFyIGluIHRoaXMgcGFja2FnZSEpXG4vL1xuLy9cbi8vIEF0IHRoZSB0b3AgbGV2ZWwsIHlvdSBtYXkgb25seSBwYXNzIGluIGEgcGxhaW4gb2JqZWN0IG9yIGFycmF5LlxuLy9cbi8vIFNlZSB0aGUgdGVzdCAnbWluaW1vbmdvIC0gbG9va3VwJyBmb3Igc29tZSBleGFtcGxlcyBvZiB3aGF0IGxvb2t1cCBmdW5jdGlvbnNcbi8vIHJldHVybi5cbmV4cG9ydCBmdW5jdGlvbiBtYWtlTG9va3VwRnVuY3Rpb24oa2V5LCBvcHRpb25zID0ge30pIHtcbiAgY29uc3QgcGFydHMgPSBrZXkuc3BsaXQoJy4nKTtcbiAgY29uc3QgZmlyc3RQYXJ0ID0gcGFydHMubGVuZ3RoID8gcGFydHNbMF0gOiAnJztcbiAgY29uc3QgbG9va3VwUmVzdCA9IChcbiAgICBwYXJ0cy5sZW5ndGggPiAxICYmXG4gICAgbWFrZUxvb2t1cEZ1bmN0aW9uKHBhcnRzLnNsaWNlKDEpLmpvaW4oJy4nKSwgb3B0aW9ucylcbiAgKTtcblxuICBmdW5jdGlvbiBidWlsZFJlc3VsdChhcnJheUluZGljZXMsIGRvbnRJdGVyYXRlLCB2YWx1ZSkge1xuICAgIHJldHVybiBhcnJheUluZGljZXMgJiYgYXJyYXlJbmRpY2VzLmxlbmd0aFxuICAgICAgPyBkb250SXRlcmF0ZVxuICAgICAgICA/IFt7IGFycmF5SW5kaWNlcywgZG9udEl0ZXJhdGUsIHZhbHVlIH1dXG4gICAgICAgIDogW3sgYXJyYXlJbmRpY2VzLCB2YWx1ZSB9XVxuICAgICAgOiBkb250SXRlcmF0ZVxuICAgICAgICA/IFt7IGRvbnRJdGVyYXRlLCB2YWx1ZSB9XVxuICAgICAgICA6IFt7IHZhbHVlIH1dO1xuICB9XG5cbiAgLy8gRG9jIHdpbGwgYWx3YXlzIGJlIGEgcGxhaW4gb2JqZWN0IG9yIGFuIGFycmF5LlxuICAvLyBhcHBseSBhbiBleHBsaWNpdCBudW1lcmljIGluZGV4LCBhbiBhcnJheS5cbiAgcmV0dXJuIChkb2MsIGFycmF5SW5kaWNlcykgPT4ge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGRvYykpIHtcbiAgICAgIC8vIElmIHdlJ3JlIGJlaW5nIGFza2VkIHRvIGRvIGFuIGludmFsaWQgbG9va3VwIGludG8gYW4gYXJyYXkgKG5vbi1pbnRlZ2VyXG4gICAgICAvLyBvciBvdXQtb2YtYm91bmRzKSwgcmV0dXJuIG5vIHJlc3VsdHMgKHdoaWNoIGlzIGRpZmZlcmVudCBmcm9tIHJldHVybmluZ1xuICAgICAgLy8gYSBzaW5nbGUgdW5kZWZpbmVkIHJlc3VsdCwgaW4gdGhhdCBgbnVsbGAgZXF1YWxpdHkgY2hlY2tzIHdvbid0IG1hdGNoKS5cbiAgICAgIGlmICghKGlzTnVtZXJpY0tleShmaXJzdFBhcnQpICYmIGZpcnN0UGFydCA8IGRvYy5sZW5ndGgpKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH1cblxuICAgICAgLy8gUmVtZW1iZXIgdGhhdCB3ZSB1c2VkIHRoaXMgYXJyYXkgaW5kZXguIEluY2x1ZGUgYW4gJ3gnIHRvIGluZGljYXRlIHRoYXRcbiAgICAgIC8vIHRoZSBwcmV2aW91cyBpbmRleCBjYW1lIGZyb20gYmVpbmcgY29uc2lkZXJlZCBhcyBhbiBleHBsaWNpdCBhcnJheVxuICAgICAgLy8gaW5kZXggKG5vdCBicmFuY2hpbmcpLlxuICAgICAgYXJyYXlJbmRpY2VzID0gYXJyYXlJbmRpY2VzID8gYXJyYXlJbmRpY2VzLmNvbmNhdCgrZmlyc3RQYXJ0LCAneCcpIDogWytmaXJzdFBhcnQsICd4J107XG4gICAgfVxuXG4gICAgLy8gRG8gb3VyIGZpcnN0IGxvb2t1cC5cbiAgICBjb25zdCBmaXJzdExldmVsID0gZG9jW2ZpcnN0UGFydF07XG5cbiAgICAvLyBJZiB0aGVyZSBpcyBubyBkZWVwZXIgdG8gZGlnLCByZXR1cm4gd2hhdCB3ZSBmb3VuZC5cbiAgICAvL1xuICAgIC8vIElmIHdoYXQgd2UgZm91bmQgaXMgYW4gYXJyYXksIG1vc3QgdmFsdWUgc2VsZWN0b3JzIHdpbGwgY2hvb3NlIHRvIHRyZWF0XG4gICAgLy8gdGhlIGVsZW1lbnRzIG9mIHRoZSBhcnJheSBhcyBtYXRjaGFibGUgdmFsdWVzIGluIHRoZWlyIG93biByaWdodCwgYnV0XG4gICAgLy8gdGhhdCdzIGRvbmUgb3V0c2lkZSBvZiB0aGUgbG9va3VwIGZ1bmN0aW9uLiAoRXhjZXB0aW9ucyB0byB0aGlzIGFyZSAkc2l6ZVxuICAgIC8vIGFuZCBzdHVmZiByZWxhdGluZyB0byAkZWxlbU1hdGNoLiAgZWcsIHthOiB7JHNpemU6IDJ9fSBkb2VzIG5vdCBtYXRjaCB7YTpcbiAgICAvLyBbWzEsIDJdXX0uKVxuICAgIC8vXG4gICAgLy8gVGhhdCBzYWlkLCBpZiB3ZSBqdXN0IGRpZCBhbiAqZXhwbGljaXQqIGFycmF5IGxvb2t1cCAob24gZG9jKSB0byBmaW5kXG4gICAgLy8gZmlyc3RMZXZlbCwgYW5kIGZpcnN0TGV2ZWwgaXMgYW4gYXJyYXkgdG9vLCB3ZSBkbyBOT1Qgd2FudCB2YWx1ZVxuICAgIC8vIHNlbGVjdG9ycyB0byBpdGVyYXRlIG92ZXIgaXQuICBlZywgeydhLjAnOiA1fSBkb2VzIG5vdCBtYXRjaCB7YTogW1s1XV19LlxuICAgIC8vIFNvIGluIHRoYXQgY2FzZSwgd2UgbWFyayB0aGUgcmV0dXJuIHZhbHVlIGFzICdkb24ndCBpdGVyYXRlJy5cbiAgICBpZiAoIWxvb2t1cFJlc3QpIHtcbiAgICAgIHJldHVybiBidWlsZFJlc3VsdChcbiAgICAgICAgYXJyYXlJbmRpY2VzLFxuICAgICAgICBBcnJheS5pc0FycmF5KGRvYykgJiYgQXJyYXkuaXNBcnJheShmaXJzdExldmVsKSxcbiAgICAgICAgZmlyc3RMZXZlbCxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gV2UgbmVlZCB0byBkaWcgZGVlcGVyLiAgQnV0IGlmIHdlIGNhbid0LCBiZWNhdXNlIHdoYXQgd2UndmUgZm91bmQgaXMgbm90XG4gICAgLy8gYW4gYXJyYXkgb3IgcGxhaW4gb2JqZWN0LCB3ZSdyZSBkb25lLiBJZiB3ZSBqdXN0IGRpZCBhIG51bWVyaWMgaW5kZXggaW50b1xuICAgIC8vIGFuIGFycmF5LCB3ZSByZXR1cm4gbm90aGluZyBoZXJlICh0aGlzIGlzIGEgY2hhbmdlIGluIE1vbmdvIDIuNSBmcm9tXG4gICAgLy8gTW9uZ28gMi40LCB3aGVyZSB7J2EuMC5iJzogbnVsbH0gc3RvcHBlZCBtYXRjaGluZyB7YTogWzVdfSkuIE90aGVyd2lzZSxcbiAgICAvLyByZXR1cm4gYSBzaW5nbGUgYHVuZGVmaW5lZGAgKHdoaWNoIGNhbiwgZm9yIGV4YW1wbGUsIG1hdGNoIHZpYSBlcXVhbGl0eVxuICAgIC8vIHdpdGggYG51bGxgKS5cbiAgICBpZiAoIWlzSW5kZXhhYmxlKGZpcnN0TGV2ZWwpKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShkb2MpKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGJ1aWxkUmVzdWx0KGFycmF5SW5kaWNlcywgZmFsc2UsIHVuZGVmaW5lZCk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgY29uc3QgYXBwZW5kVG9SZXN1bHQgPSBtb3JlID0+IHtcbiAgICAgIHJlc3VsdC5wdXNoKC4uLm1vcmUpO1xuICAgIH07XG5cbiAgICAvLyBEaWcgZGVlcGVyOiBsb29rIHVwIHRoZSByZXN0IG9mIHRoZSBwYXJ0cyBvbiB3aGF0ZXZlciB3ZSd2ZSBmb3VuZC5cbiAgICAvLyAobG9va3VwUmVzdCBpcyBzbWFydCBlbm91Z2ggdG8gbm90IHRyeSB0byBkbyBpbnZhbGlkIGxvb2t1cHMgaW50b1xuICAgIC8vIGZpcnN0TGV2ZWwgaWYgaXQncyBhbiBhcnJheS4pXG4gICAgYXBwZW5kVG9SZXN1bHQobG9va3VwUmVzdChmaXJzdExldmVsLCBhcnJheUluZGljZXMpKTtcblxuICAgIC8vIElmIHdlIGZvdW5kIGFuIGFycmF5LCB0aGVuIGluICphZGRpdGlvbiogdG8gcG90ZW50aWFsbHkgdHJlYXRpbmcgdGhlIG5leHRcbiAgICAvLyBwYXJ0IGFzIGEgbGl0ZXJhbCBpbnRlZ2VyIGxvb2t1cCwgd2Ugc2hvdWxkIGFsc28gJ2JyYW5jaCc6IHRyeSB0byBsb29rIHVwXG4gICAgLy8gdGhlIHJlc3Qgb2YgdGhlIHBhcnRzIG9uIGVhY2ggYXJyYXkgZWxlbWVudCBpbiBwYXJhbGxlbC5cbiAgICAvL1xuICAgIC8vIEluIHRoaXMgY2FzZSwgd2UgKm9ubHkqIGRpZyBkZWVwZXIgaW50byBhcnJheSBlbGVtZW50cyB0aGF0IGFyZSBwbGFpblxuICAgIC8vIG9iamVjdHMuIChSZWNhbGwgdGhhdCB3ZSBvbmx5IGdvdCB0aGlzIGZhciBpZiB3ZSBoYXZlIGZ1cnRoZXIgdG8gZGlnLilcbiAgICAvLyBUaGlzIG1ha2VzIHNlbnNlOiB3ZSBjZXJ0YWlubHkgZG9uJ3QgZGlnIGRlZXBlciBpbnRvIG5vbi1pbmRleGFibGVcbiAgICAvLyBvYmplY3RzLiBBbmQgaXQgd291bGQgYmUgd2VpcmQgdG8gZGlnIGludG8gYW4gYXJyYXk6IGl0J3Mgc2ltcGxlciB0byBoYXZlXG4gICAgLy8gYSBydWxlIHRoYXQgZXhwbGljaXQgaW50ZWdlciBpbmRleGVzIG9ubHkgYXBwbHkgdG8gYW4gb3V0ZXIgYXJyYXksIG5vdCB0b1xuICAgIC8vIGFuIGFycmF5IHlvdSBmaW5kIGFmdGVyIGEgYnJhbmNoaW5nIHNlYXJjaC5cbiAgICAvL1xuICAgIC8vIEluIHRoZSBzcGVjaWFsIGNhc2Ugb2YgYSBudW1lcmljIHBhcnQgaW4gYSAqc29ydCBzZWxlY3RvciogKG5vdCBhIHF1ZXJ5XG4gICAgLy8gc2VsZWN0b3IpLCB3ZSBza2lwIHRoZSBicmFuY2hpbmc6IHdlIE9OTFkgYWxsb3cgdGhlIG51bWVyaWMgcGFydCB0byBtZWFuXG4gICAgLy8gJ2xvb2sgdXAgdGhpcyBpbmRleCcgaW4gdGhhdCBjYXNlLCBub3QgJ2Fsc28gbG9vayB1cCB0aGlzIGluZGV4IGluIGFsbFxuICAgIC8vIHRoZSBlbGVtZW50cyBvZiB0aGUgYXJyYXknLlxuICAgIGlmIChBcnJheS5pc0FycmF5KGZpcnN0TGV2ZWwpICYmXG4gICAgICAgICEoaXNOdW1lcmljS2V5KHBhcnRzWzFdKSAmJiBvcHRpb25zLmZvclNvcnQpKSB7XG4gICAgICBmaXJzdExldmVsLmZvckVhY2goKGJyYW5jaCwgYXJyYXlJbmRleCkgPT4ge1xuICAgICAgICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KGJyYW5jaCkpIHtcbiAgICAgICAgICBhcHBlbmRUb1Jlc3VsdChsb29rdXBSZXN0KGJyYW5jaCwgYXJyYXlJbmRpY2VzID8gYXJyYXlJbmRpY2VzLmNvbmNhdChhcnJheUluZGV4KSA6IFthcnJheUluZGV4XSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuXG4vLyBPYmplY3QgZXhwb3J0ZWQgb25seSBmb3IgdW5pdCB0ZXN0aW5nLlxuLy8gVXNlIGl0IHRvIGV4cG9ydCBwcml2YXRlIGZ1bmN0aW9ucyB0byB0ZXN0IGluIFRpbnl0ZXN0LlxuTWluaW1vbmdvVGVzdCA9IHttYWtlTG9va3VwRnVuY3Rpb259O1xuTWluaW1vbmdvRXJyb3IgPSAobWVzc2FnZSwgb3B0aW9ucyA9IHt9KSA9PiB7XG4gIGlmICh0eXBlb2YgbWVzc2FnZSA9PT0gJ3N0cmluZycgJiYgb3B0aW9ucy5maWVsZCkge1xuICAgIG1lc3NhZ2UgKz0gYCBmb3IgZmllbGQgJyR7b3B0aW9ucy5maWVsZH0nYDtcbiAgfVxuXG4gIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBlcnJvci5uYW1lID0gJ01pbmltb25nb0Vycm9yJztcbiAgcmV0dXJuIGVycm9yO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIG5vdGhpbmdNYXRjaGVyKGRvY09yQnJhbmNoZWRWYWx1ZXMpIHtcbiAgcmV0dXJuIHtyZXN1bHQ6IGZhbHNlfTtcbn1cblxuLy8gVGFrZXMgYW4gb3BlcmF0b3Igb2JqZWN0IChhbiBvYmplY3Qgd2l0aCAkIGtleXMpIGFuZCByZXR1cm5zIGEgYnJhbmNoZWRcbi8vIG1hdGNoZXIgZm9yIGl0LlxuZnVuY3Rpb24gb3BlcmF0b3JCcmFuY2hlZE1hdGNoZXIodmFsdWVTZWxlY3RvciwgbWF0Y2hlciwgaXNSb290KSB7XG4gIC8vIEVhY2ggdmFsdWVTZWxlY3RvciB3b3JrcyBzZXBhcmF0ZWx5IG9uIHRoZSB2YXJpb3VzIGJyYW5jaGVzLiAgU28gb25lXG4gIC8vIG9wZXJhdG9yIGNhbiBtYXRjaCBvbmUgYnJhbmNoIGFuZCBhbm90aGVyIGNhbiBtYXRjaCBhbm90aGVyIGJyYW5jaC4gIFRoaXNcbiAgLy8gaXMgT0suXG4gIGNvbnN0IG9wZXJhdG9yTWF0Y2hlcnMgPSBPYmplY3Qua2V5cyh2YWx1ZVNlbGVjdG9yKS5tYXAob3BlcmF0b3IgPT4ge1xuICAgIGNvbnN0IG9wZXJhbmQgPSB2YWx1ZVNlbGVjdG9yW29wZXJhdG9yXTtcblxuICAgIGNvbnN0IHNpbXBsZVJhbmdlID0gKFxuICAgICAgWyckbHQnLCAnJGx0ZScsICckZ3QnLCAnJGd0ZSddLmluY2x1ZGVzKG9wZXJhdG9yKSAmJlxuICAgICAgdHlwZW9mIG9wZXJhbmQgPT09ICdudW1iZXInXG4gICAgKTtcblxuICAgIGNvbnN0IHNpbXBsZUVxdWFsaXR5ID0gKFxuICAgICAgWyckbmUnLCAnJGVxJ10uaW5jbHVkZXMob3BlcmF0b3IpICYmXG4gICAgICBvcGVyYW5kICE9PSBPYmplY3Qob3BlcmFuZClcbiAgICApO1xuXG4gICAgY29uc3Qgc2ltcGxlSW5jbHVzaW9uID0gKFxuICAgICAgWyckaW4nLCAnJG5pbiddLmluY2x1ZGVzKG9wZXJhdG9yKVxuICAgICAgJiYgQXJyYXkuaXNBcnJheShvcGVyYW5kKVxuICAgICAgJiYgIW9wZXJhbmQuc29tZSh4ID0+IHggPT09IE9iamVjdCh4KSlcbiAgICApO1xuXG4gICAgaWYgKCEoc2ltcGxlUmFuZ2UgfHwgc2ltcGxlSW5jbHVzaW9uIHx8IHNpbXBsZUVxdWFsaXR5KSkge1xuICAgICAgbWF0Y2hlci5faXNTaW1wbGUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoaGFzT3duLmNhbGwoVkFMVUVfT1BFUkFUT1JTLCBvcGVyYXRvcikpIHtcbiAgICAgIHJldHVybiBWQUxVRV9PUEVSQVRPUlNbb3BlcmF0b3JdKG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIsIGlzUm9vdCk7XG4gICAgfVxuXG4gICAgaWYgKGhhc093bi5jYWxsKEVMRU1FTlRfT1BFUkFUT1JTLCBvcGVyYXRvcikpIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSBFTEVNRU5UX09QRVJBVE9SU1tvcGVyYXRvcl07XG4gICAgICByZXR1cm4gY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoXG4gICAgICAgIG9wdGlvbnMuY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyKSxcbiAgICAgICAgb3B0aW9uc1xuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgTWluaU1vbmdvUXVlcnlFcnJvcihgVW5yZWNvZ25pemVkIG9wZXJhdG9yOiAke29wZXJhdG9yfWApO1xuICB9KTtcblxuICByZXR1cm4gYW5kQnJhbmNoZWRNYXRjaGVycyhvcGVyYXRvck1hdGNoZXJzKTtcbn1cblxuLy8gcGF0aHMgLSBBcnJheTogbGlzdCBvZiBtb25nbyBzdHlsZSBwYXRoc1xuLy8gbmV3TGVhZkZuIC0gRnVuY3Rpb246IG9mIGZvcm0gZnVuY3Rpb24ocGF0aCkgc2hvdWxkIHJldHVybiBhIHNjYWxhciB2YWx1ZSB0b1xuLy8gICAgICAgICAgICAgICAgICAgICAgIHB1dCBpbnRvIGxpc3QgY3JlYXRlZCBmb3IgdGhhdCBwYXRoXG4vLyBjb25mbGljdEZuIC0gRnVuY3Rpb246IG9mIGZvcm0gZnVuY3Rpb24obm9kZSwgcGF0aCwgZnVsbFBhdGgpIGlzIGNhbGxlZFxuLy8gICAgICAgICAgICAgICAgICAgICAgICB3aGVuIGJ1aWxkaW5nIGEgdHJlZSBwYXRoIGZvciAnZnVsbFBhdGgnIG5vZGUgb25cbi8vICAgICAgICAgICAgICAgICAgICAgICAgJ3BhdGgnIHdhcyBhbHJlYWR5IGEgbGVhZiB3aXRoIGEgdmFsdWUuIE11c3QgcmV0dXJuIGFcbi8vICAgICAgICAgICAgICAgICAgICAgICAgY29uZmxpY3QgcmVzb2x1dGlvbi5cbi8vIGluaXRpYWwgdHJlZSAtIE9wdGlvbmFsIE9iamVjdDogc3RhcnRpbmcgdHJlZS5cbi8vIEByZXR1cm5zIC0gT2JqZWN0OiB0cmVlIHJlcHJlc2VudGVkIGFzIGEgc2V0IG9mIG5lc3RlZCBvYmplY3RzXG5leHBvcnQgZnVuY3Rpb24gcGF0aHNUb1RyZWUocGF0aHMsIG5ld0xlYWZGbiwgY29uZmxpY3RGbiwgcm9vdCA9IHt9KSB7XG4gIHBhdGhzLmZvckVhY2gocGF0aCA9PiB7XG4gICAgY29uc3QgcGF0aEFycmF5ID0gcGF0aC5zcGxpdCgnLicpO1xuICAgIGxldCB0cmVlID0gcm9vdDtcblxuICAgIC8vIHVzZSAuZXZlcnkganVzdCBmb3IgaXRlcmF0aW9uIHdpdGggYnJlYWtcbiAgICBjb25zdCBzdWNjZXNzID0gcGF0aEFycmF5LnNsaWNlKDAsIC0xKS5ldmVyeSgoa2V5LCBpKSA9PiB7XG4gICAgICBpZiAoIWhhc093bi5jYWxsKHRyZWUsIGtleSkpIHtcbiAgICAgICAgdHJlZVtrZXldID0ge307XG4gICAgICB9IGVsc2UgaWYgKHRyZWVba2V5XSAhPT0gT2JqZWN0KHRyZWVba2V5XSkpIHtcbiAgICAgICAgdHJlZVtrZXldID0gY29uZmxpY3RGbihcbiAgICAgICAgICB0cmVlW2tleV0sXG4gICAgICAgICAgcGF0aEFycmF5LnNsaWNlKDAsIGkgKyAxKS5qb2luKCcuJyksXG4gICAgICAgICAgcGF0aFxuICAgICAgICApO1xuXG4gICAgICAgIC8vIGJyZWFrIG91dCBvZiBsb29wIGlmIHdlIGFyZSBmYWlsaW5nIGZvciB0aGlzIHBhdGhcbiAgICAgICAgaWYgKHRyZWVba2V5XSAhPT0gT2JqZWN0KHRyZWVba2V5XSkpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdHJlZSA9IHRyZWVba2V5XTtcblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG5cbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgY29uc3QgbGFzdEtleSA9IHBhdGhBcnJheVtwYXRoQXJyYXkubGVuZ3RoIC0gMV07XG4gICAgICBpZiAoaGFzT3duLmNhbGwodHJlZSwgbGFzdEtleSkpIHtcbiAgICAgICAgdHJlZVtsYXN0S2V5XSA9IGNvbmZsaWN0Rm4odHJlZVtsYXN0S2V5XSwgcGF0aCwgcGF0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0cmVlW2xhc3RLZXldID0gbmV3TGVhZkZuKHBhdGgpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJvb3Q7XG59XG5cbi8vIE1ha2VzIHN1cmUgd2UgZ2V0IDIgZWxlbWVudHMgYXJyYXkgYW5kIGFzc3VtZSB0aGUgZmlyc3Qgb25lIHRvIGJlIHggYW5kXG4vLyB0aGUgc2Vjb25kIG9uZSB0byB5IG5vIG1hdHRlciB3aGF0IHVzZXIgcGFzc2VzLlxuLy8gSW4gY2FzZSB1c2VyIHBhc3NlcyB7IGxvbjogeCwgbGF0OiB5IH0gcmV0dXJucyBbeCwgeV1cbmZ1bmN0aW9uIHBvaW50VG9BcnJheShwb2ludCkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShwb2ludCkgPyBwb2ludC5zbGljZSgpIDogW3BvaW50LngsIHBvaW50LnldO1xufVxuXG4vLyBDcmVhdGluZyBhIGRvY3VtZW50IGZyb20gYW4gdXBzZXJ0IGlzIHF1aXRlIHRyaWNreS5cbi8vIEUuZy4gdGhpcyBzZWxlY3Rvcjoge1wiJG9yXCI6IFt7XCJiLmZvb1wiOiB7XCIkYWxsXCI6IFtcImJhclwiXX19XX0sIHNob3VsZCByZXN1bHRcbi8vIGluOiB7XCJiLmZvb1wiOiBcImJhclwifVxuLy8gQnV0IHRoaXMgc2VsZWN0b3I6IHtcIiRvclwiOiBbe1wiYlwiOiB7XCJmb29cIjoge1wiJGFsbFwiOiBbXCJiYXJcIl19fX1dfSBzaG91bGQgdGhyb3dcbi8vIGFuIGVycm9yXG5cbi8vIFNvbWUgcnVsZXMgKGZvdW5kIG1haW5seSB3aXRoIHRyaWFsICYgZXJyb3IsIHNvIHRoZXJlIG1pZ2h0IGJlIG1vcmUpOlxuLy8gLSBoYW5kbGUgYWxsIGNoaWxkcyBvZiAkYW5kIChvciBpbXBsaWNpdCAkYW5kKVxuLy8gLSBoYW5kbGUgJG9yIG5vZGVzIHdpdGggZXhhY3RseSAxIGNoaWxkXG4vLyAtIGlnbm9yZSAkb3Igbm9kZXMgd2l0aCBtb3JlIHRoYW4gMSBjaGlsZFxuLy8gLSBpZ25vcmUgJG5vciBhbmQgJG5vdCBub2Rlc1xuLy8gLSB0aHJvdyB3aGVuIGEgdmFsdWUgY2FuIG5vdCBiZSBzZXQgdW5hbWJpZ3VvdXNseVxuLy8gLSBldmVyeSB2YWx1ZSBmb3IgJGFsbCBzaG91bGQgYmUgZGVhbHQgd2l0aCBhcyBzZXBhcmF0ZSAkZXEtc1xuLy8gLSB0aHJlYXQgYWxsIGNoaWxkcmVuIG9mICRhbGwgYXMgJGVxIHNldHRlcnMgKD0+IHNldCBpZiAkYWxsLmxlbmd0aCA9PT0gMSxcbi8vICAgb3RoZXJ3aXNlIHRocm93IGVycm9yKVxuLy8gLSB5b3UgY2FuIG5vdCBtaXggJyQnLXByZWZpeGVkIGtleXMgYW5kIG5vbi0nJCctcHJlZml4ZWQga2V5c1xuLy8gLSB5b3UgY2FuIG9ubHkgaGF2ZSBkb3R0ZWQga2V5cyBvbiBhIHJvb3QtbGV2ZWxcbi8vIC0geW91IGNhbiBub3QgaGF2ZSAnJCctcHJlZml4ZWQga2V5cyBtb3JlIHRoYW4gb25lLWxldmVsIGRlZXAgaW4gYW4gb2JqZWN0XG5cbi8vIEhhbmRsZXMgb25lIGtleS92YWx1ZSBwYWlyIHRvIHB1dCBpbiB0aGUgc2VsZWN0b3IgZG9jdW1lbnRcbmZ1bmN0aW9uIHBvcHVsYXRlRG9jdW1lbnRXaXRoS2V5VmFsdWUoZG9jdW1lbnQsIGtleSwgdmFsdWUpIHtcbiAgaWYgKHZhbHVlICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSkgPT09IE9iamVjdC5wcm90b3R5cGUpIHtcbiAgICBwb3B1bGF0ZURvY3VtZW50V2l0aE9iamVjdChkb2N1bWVudCwga2V5LCB2YWx1ZSk7XG4gIH0gZWxzZSBpZiAoISh2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcbiAgICBpbnNlcnRJbnRvRG9jdW1lbnQoZG9jdW1lbnQsIGtleSwgdmFsdWUpO1xuICB9XG59XG5cbi8vIEhhbmRsZXMgYSBrZXksIHZhbHVlIHBhaXIgdG8gcHV0IGluIHRoZSBzZWxlY3RvciBkb2N1bWVudFxuLy8gaWYgdGhlIHZhbHVlIGlzIGFuIG9iamVjdFxuZnVuY3Rpb24gcG9wdWxhdGVEb2N1bWVudFdpdGhPYmplY3QoZG9jdW1lbnQsIGtleSwgdmFsdWUpIHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHZhbHVlKTtcbiAgY29uc3QgdW5wcmVmaXhlZEtleXMgPSBrZXlzLmZpbHRlcihvcCA9PiBvcFswXSAhPT0gJyQnKTtcblxuICBpZiAodW5wcmVmaXhlZEtleXMubGVuZ3RoID4gMCB8fCAha2V5cy5sZW5ndGgpIHtcbiAgICAvLyBMaXRlcmFsIChwb3NzaWJseSBlbXB0eSkgb2JqZWN0ICggb3IgZW1wdHkgb2JqZWN0IClcbiAgICAvLyBEb24ndCBhbGxvdyBtaXhpbmcgJyQnLXByZWZpeGVkIHdpdGggbm9uLSckJy1wcmVmaXhlZCBmaWVsZHNcbiAgICBpZiAoa2V5cy5sZW5ndGggIT09IHVucHJlZml4ZWRLZXlzLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IE1pbmlNb25nb1F1ZXJ5RXJyb3IoYHVua25vd24gb3BlcmF0b3I6ICR7dW5wcmVmaXhlZEtleXNbMF19YCk7XG4gICAgfVxuXG4gICAgdmFsaWRhdGVPYmplY3QodmFsdWUsIGtleSk7XG4gICAgaW5zZXJ0SW50b0RvY3VtZW50KGRvY3VtZW50LCBrZXksIHZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICBPYmplY3Qua2V5cyh2YWx1ZSkuZm9yRWFjaChvcCA9PiB7XG4gICAgICBjb25zdCBvYmplY3QgPSB2YWx1ZVtvcF07XG5cbiAgICAgIGlmIChvcCA9PT0gJyRlcScpIHtcbiAgICAgICAgcG9wdWxhdGVEb2N1bWVudFdpdGhLZXlWYWx1ZShkb2N1bWVudCwga2V5LCBvYmplY3QpO1xuICAgICAgfSBlbHNlIGlmIChvcCA9PT0gJyRhbGwnKSB7XG4gICAgICAgIC8vIGV2ZXJ5IHZhbHVlIGZvciAkYWxsIHNob3VsZCBiZSBkZWFsdCB3aXRoIGFzIHNlcGFyYXRlICRlcS1zXG4gICAgICAgIG9iamVjdC5mb3JFYWNoKGVsZW1lbnQgPT5cbiAgICAgICAgICBwb3B1bGF0ZURvY3VtZW50V2l0aEtleVZhbHVlKGRvY3VtZW50LCBrZXksIGVsZW1lbnQpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gRmlsbHMgYSBkb2N1bWVudCB3aXRoIGNlcnRhaW4gZmllbGRzIGZyb20gYW4gdXBzZXJ0IHNlbGVjdG9yXG5leHBvcnQgZnVuY3Rpb24gcG9wdWxhdGVEb2N1bWVudFdpdGhRdWVyeUZpZWxkcyhxdWVyeSwgZG9jdW1lbnQgPSB7fSkge1xuICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKHF1ZXJ5KSA9PT0gT2JqZWN0LnByb3RvdHlwZSkge1xuICAgIC8vIGhhbmRsZSBpbXBsaWNpdCAkYW5kXG4gICAgT2JqZWN0LmtleXMocXVlcnkpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gcXVlcnlba2V5XTtcblxuICAgICAgaWYgKGtleSA9PT0gJyRhbmQnKSB7XG4gICAgICAgIC8vIGhhbmRsZSBleHBsaWNpdCAkYW5kXG4gICAgICAgIHZhbHVlLmZvckVhY2goZWxlbWVudCA9PlxuICAgICAgICAgIHBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHMoZWxlbWVudCwgZG9jdW1lbnQpXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gJyRvcicpIHtcbiAgICAgICAgLy8gaGFuZGxlICRvciBub2RlcyB3aXRoIGV4YWN0bHkgMSBjaGlsZFxuICAgICAgICBpZiAodmFsdWUubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgcG9wdWxhdGVEb2N1bWVudFdpdGhRdWVyeUZpZWxkcyh2YWx1ZVswXSwgZG9jdW1lbnQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGtleVswXSAhPT0gJyQnKSB7XG4gICAgICAgIC8vIElnbm9yZSBvdGhlciAnJCctcHJlZml4ZWQgbG9naWNhbCBzZWxlY3RvcnNcbiAgICAgICAgcG9wdWxhdGVEb2N1bWVudFdpdGhLZXlWYWx1ZShkb2N1bWVudCwga2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gSGFuZGxlIG1ldGVvci1zcGVjaWZpYyBzaG9ydGN1dCBmb3Igc2VsZWN0aW5nIF9pZFxuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChxdWVyeSkpIHtcbiAgICAgIGluc2VydEludG9Eb2N1bWVudChkb2N1bWVudCwgJ19pZCcsIHF1ZXJ5KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZG9jdW1lbnQ7XG59XG5cbi8vIFRyYXZlcnNlcyB0aGUga2V5cyBvZiBwYXNzZWQgcHJvamVjdGlvbiBhbmQgY29uc3RydWN0cyBhIHRyZWUgd2hlcmUgYWxsXG4vLyBsZWF2ZXMgYXJlIGVpdGhlciBhbGwgVHJ1ZSBvciBhbGwgRmFsc2Vcbi8vIEByZXR1cm5zIE9iamVjdDpcbi8vICAtIHRyZWUgLSBPYmplY3QgLSB0cmVlIHJlcHJlc2VudGF0aW9uIG9mIGtleXMgaW52b2x2ZWQgaW4gcHJvamVjdGlvblxuLy8gIChleGNlcHRpb24gZm9yICdfaWQnIGFzIGl0IGlzIGEgc3BlY2lhbCBjYXNlIGhhbmRsZWQgc2VwYXJhdGVseSlcbi8vICAtIGluY2x1ZGluZyAtIEJvb2xlYW4gLSBcInRha2Ugb25seSBjZXJ0YWluIGZpZWxkc1wiIHR5cGUgb2YgcHJvamVjdGlvblxuZXhwb3J0IGZ1bmN0aW9uIHByb2plY3Rpb25EZXRhaWxzKGZpZWxkcykge1xuICAvLyBGaW5kIHRoZSBub24tX2lkIGtleXMgKF9pZCBpcyBoYW5kbGVkIHNwZWNpYWxseSBiZWNhdXNlIGl0IGlzIGluY2x1ZGVkXG4gIC8vIHVubGVzcyBleHBsaWNpdGx5IGV4Y2x1ZGVkKS4gU29ydCB0aGUga2V5cywgc28gdGhhdCBvdXIgY29kZSB0byBkZXRlY3RcbiAgLy8gb3ZlcmxhcHMgbGlrZSAnZm9vJyBhbmQgJ2Zvby5iYXInIGNhbiBhc3N1bWUgdGhhdCAnZm9vJyBjb21lcyBmaXJzdC5cbiAgbGV0IGZpZWxkc0tleXMgPSBPYmplY3Qua2V5cyhmaWVsZHMpLnNvcnQoKTtcblxuICAvLyBJZiBfaWQgaXMgdGhlIG9ubHkgZmllbGQgaW4gdGhlIHByb2plY3Rpb24sIGRvIG5vdCByZW1vdmUgaXQsIHNpbmNlIGl0IGlzXG4gIC8vIHJlcXVpcmVkIHRvIGRldGVybWluZSBpZiB0aGlzIGlzIGFuIGV4Y2x1c2lvbiBvciBleGNsdXNpb24uIEFsc28ga2VlcCBhblxuICAvLyBpbmNsdXNpdmUgX2lkLCBzaW5jZSBpbmNsdXNpdmUgX2lkIGZvbGxvd3MgdGhlIG5vcm1hbCBydWxlcyBhYm91dCBtaXhpbmdcbiAgLy8gaW5jbHVzaXZlIGFuZCBleGNsdXNpdmUgZmllbGRzLiBJZiBfaWQgaXMgbm90IHRoZSBvbmx5IGZpZWxkIGluIHRoZVxuICAvLyBwcm9qZWN0aW9uIGFuZCBpcyBleGNsdXNpdmUsIHJlbW92ZSBpdCBzbyBpdCBjYW4gYmUgaGFuZGxlZCBsYXRlciBieSBhXG4gIC8vIHNwZWNpYWwgY2FzZSwgc2luY2UgZXhjbHVzaXZlIF9pZCBpcyBhbHdheXMgYWxsb3dlZC5cbiAgaWYgKCEoZmllbGRzS2V5cy5sZW5ndGggPT09IDEgJiYgZmllbGRzS2V5c1swXSA9PT0gJ19pZCcpICYmXG4gICAgICAhKGZpZWxkc0tleXMuaW5jbHVkZXMoJ19pZCcpICYmIGZpZWxkcy5faWQpKSB7XG4gICAgZmllbGRzS2V5cyA9IGZpZWxkc0tleXMuZmlsdGVyKGtleSA9PiBrZXkgIT09ICdfaWQnKTtcbiAgfVxuXG4gIGxldCBpbmNsdWRpbmcgPSBudWxsOyAvLyBVbmtub3duXG5cbiAgZmllbGRzS2V5cy5mb3JFYWNoKGtleVBhdGggPT4ge1xuICAgIGNvbnN0IHJ1bGUgPSAhIWZpZWxkc1trZXlQYXRoXTtcblxuICAgIGlmIChpbmNsdWRpbmcgPT09IG51bGwpIHtcbiAgICAgIGluY2x1ZGluZyA9IHJ1bGU7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBlcnJvciBtZXNzYWdlIGlzIGNvcGllZCBmcm9tIE1vbmdvREIgc2hlbGxcbiAgICBpZiAoaW5jbHVkaW5nICE9PSBydWxlKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ1lvdSBjYW5ub3QgY3VycmVudGx5IG1peCBpbmNsdWRpbmcgYW5kIGV4Y2x1ZGluZyBmaWVsZHMuJ1xuICAgICAgKTtcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IHByb2plY3Rpb25SdWxlc1RyZWUgPSBwYXRoc1RvVHJlZShcbiAgICBmaWVsZHNLZXlzLFxuICAgIHBhdGggPT4gaW5jbHVkaW5nLFxuICAgIChub2RlLCBwYXRoLCBmdWxsUGF0aCkgPT4ge1xuICAgICAgLy8gQ2hlY2sgcGFzc2VkIHByb2plY3Rpb24gZmllbGRzJyBrZXlzOiBJZiB5b3UgaGF2ZSB0d28gcnVsZXMgc3VjaCBhc1xuICAgICAgLy8gJ2Zvby5iYXInIGFuZCAnZm9vLmJhci5iYXonLCB0aGVuIHRoZSByZXN1bHQgYmVjb21lcyBhbWJpZ3VvdXMuIElmXG4gICAgICAvLyB0aGF0IGhhcHBlbnMsIHRoZXJlIGlzIGEgcHJvYmFiaWxpdHkgeW91IGFyZSBkb2luZyBzb21ldGhpbmcgd3JvbmcsXG4gICAgICAvLyBmcmFtZXdvcmsgc2hvdWxkIG5vdGlmeSB5b3UgYWJvdXQgc3VjaCBtaXN0YWtlIGVhcmxpZXIgb24gY3Vyc29yXG4gICAgICAvLyBjb21waWxhdGlvbiBzdGVwIHRoYW4gbGF0ZXIgZHVyaW5nIHJ1bnRpbWUuICBOb3RlLCB0aGF0IHJlYWwgbW9uZ29cbiAgICAgIC8vIGRvZXNuJ3QgZG8gYW55dGhpbmcgYWJvdXQgaXQgYW5kIHRoZSBsYXRlciBydWxlIGFwcGVhcnMgaW4gcHJvamVjdGlvblxuICAgICAgLy8gcHJvamVjdCwgbW9yZSBwcmlvcml0eSBpdCB0YWtlcy5cbiAgICAgIC8vXG4gICAgICAvLyBFeGFtcGxlLCBhc3N1bWUgZm9sbG93aW5nIGluIG1vbmdvIHNoZWxsOlxuICAgICAgLy8gPiBkYi5jb2xsLmluc2VydCh7IGE6IHsgYjogMjMsIGM6IDQ0IH0gfSlcbiAgICAgIC8vID4gZGIuY29sbC5maW5kKHt9LCB7ICdhJzogMSwgJ2EuYic6IDEgfSlcbiAgICAgIC8vIHtcIl9pZFwiOiBPYmplY3RJZChcIjUyMGJmZTQ1NjAyNDYwOGU4ZWYyNGFmM1wiKSwgXCJhXCI6IHtcImJcIjogMjN9fVxuICAgICAgLy8gPiBkYi5jb2xsLmZpbmQoe30sIHsgJ2EuYic6IDEsICdhJzogMSB9KVxuICAgICAgLy8ge1wiX2lkXCI6IE9iamVjdElkKFwiNTIwYmZlNDU2MDI0NjA4ZThlZjI0YWYzXCIpLCBcImFcIjoge1wiYlwiOiAyMywgXCJjXCI6IDQ0fX1cbiAgICAgIC8vXG4gICAgICAvLyBOb3RlLCBob3cgc2Vjb25kIHRpbWUgdGhlIHJldHVybiBzZXQgb2Yga2V5cyBpcyBkaWZmZXJlbnQuXG4gICAgICBjb25zdCBjdXJyZW50UGF0aCA9IGZ1bGxQYXRoO1xuICAgICAgY29uc3QgYW5vdGhlclBhdGggPSBwYXRoO1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgIGBib3RoICR7Y3VycmVudFBhdGh9IGFuZCAke2Fub3RoZXJQYXRofSBmb3VuZCBpbiBmaWVsZHMgb3B0aW9uLCBgICtcbiAgICAgICAgJ3VzaW5nIGJvdGggb2YgdGhlbSBtYXkgdHJpZ2dlciB1bmV4cGVjdGVkIGJlaGF2aW9yLiBEaWQgeW91IG1lYW4gdG8gJyArXG4gICAgICAgICd1c2Ugb25seSBvbmUgb2YgdGhlbT8nXG4gICAgICApO1xuICAgIH0pO1xuXG4gIHJldHVybiB7aW5jbHVkaW5nLCB0cmVlOiBwcm9qZWN0aW9uUnVsZXNUcmVlfTtcbn1cblxuLy8gVGFrZXMgYSBSZWdFeHAgb2JqZWN0IGFuZCByZXR1cm5zIGFuIGVsZW1lbnQgbWF0Y2hlci5cbmV4cG9ydCBmdW5jdGlvbiByZWdleHBFbGVtZW50TWF0Y2hlcihyZWdleHApIHtcbiAgcmV0dXJuIHZhbHVlID0+IHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIHJldHVybiB2YWx1ZS50b1N0cmluZygpID09PSByZWdleHAudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICAvLyBSZWdleHBzIG9ubHkgd29yayBhZ2FpbnN0IHN0cmluZ3MuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBSZXNldCByZWdleHAncyBzdGF0ZSB0byBhdm9pZCBpbmNvbnNpc3RlbnQgbWF0Y2hpbmcgZm9yIG9iamVjdHMgd2l0aCB0aGVcbiAgICAvLyBzYW1lIHZhbHVlIG9uIGNvbnNlY3V0aXZlIGNhbGxzIG9mIHJlZ2V4cC50ZXN0LiBUaGlzIGhhcHBlbnMgb25seSBpZiB0aGVcbiAgICAvLyByZWdleHAgaGFzIHRoZSAnZycgZmxhZy4gQWxzbyBub3RlIHRoYXQgRVM2IGludHJvZHVjZXMgYSBuZXcgZmxhZyAneScgZm9yXG4gICAgLy8gd2hpY2ggd2Ugc2hvdWxkICpub3QqIGNoYW5nZSB0aGUgbGFzdEluZGV4IGJ1dCBNb25nb0RCIGRvZXNuJ3Qgc3VwcG9ydFxuICAgIC8vIGVpdGhlciBvZiB0aGVzZSBmbGFncy5cbiAgICByZWdleHAubGFzdEluZGV4ID0gMDtcblxuICAgIHJldHVybiByZWdleHAudGVzdCh2YWx1ZSk7XG4gIH07XG59XG5cbi8vIFZhbGlkYXRlcyB0aGUga2V5IGluIGEgcGF0aC5cbi8vIE9iamVjdHMgdGhhdCBhcmUgbmVzdGVkIG1vcmUgdGhlbiAxIGxldmVsIGNhbm5vdCBoYXZlIGRvdHRlZCBmaWVsZHNcbi8vIG9yIGZpZWxkcyBzdGFydGluZyB3aXRoICckJ1xuZnVuY3Rpb24gdmFsaWRhdGVLZXlJblBhdGgoa2V5LCBwYXRoKSB7XG4gIGlmIChrZXkuaW5jbHVkZXMoJy4nKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBUaGUgZG90dGVkIGZpZWxkICcke2tleX0nIGluICcke3BhdGh9LiR7a2V5fSBpcyBub3QgdmFsaWQgZm9yIHN0b3JhZ2UuYFxuICAgICk7XG4gIH1cblxuICBpZiAoa2V5WzBdID09PSAnJCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgVGhlIGRvbGxhciAoJCkgcHJlZml4ZWQgZmllbGQgICcke3BhdGh9LiR7a2V5fSBpcyBub3QgdmFsaWQgZm9yIHN0b3JhZ2UuYFxuICAgICk7XG4gIH1cbn1cblxuLy8gUmVjdXJzaXZlbHkgdmFsaWRhdGVzIGFuIG9iamVjdCB0aGF0IGlzIG5lc3RlZCBtb3JlIHRoYW4gb25lIGxldmVsIGRlZXBcbmZ1bmN0aW9uIHZhbGlkYXRlT2JqZWN0KG9iamVjdCwgcGF0aCkge1xuICBpZiAob2JqZWN0ICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmplY3QpID09PSBPYmplY3QucHJvdG90eXBlKSB7XG4gICAgT2JqZWN0LmtleXMob2JqZWN0KS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICB2YWxpZGF0ZUtleUluUGF0aChrZXksIHBhdGgpO1xuICAgICAgdmFsaWRhdGVPYmplY3Qob2JqZWN0W2tleV0sIHBhdGggKyAnLicgKyBrZXkpO1xuICAgIH0pO1xuICB9XG59XG4iLCIvKiogRXhwb3J0ZWQgdmFsdWVzIGFyZSBhbHNvIHVzZWQgaW4gdGhlIG1vbmdvIHBhY2thZ2UuICovXG5cbi8qKiBAcGFyYW0ge3N0cmluZ30gbWV0aG9kICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXN5bmNNZXRob2ROYW1lKG1ldGhvZCkge1xuICByZXR1cm4gYCR7bWV0aG9kLnJlcGxhY2UoJ18nLCAnJyl9QXN5bmNgO1xufVxuXG5leHBvcnQgY29uc3QgQVNZTkNfQ09MTEVDVElPTl9NRVRIT0RTID0gW1xuICAnX2NyZWF0ZUNhcHBlZENvbGxlY3Rpb24nLFxuICAnZHJvcENvbGxlY3Rpb24nLFxuICAnZHJvcEluZGV4JyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENyZWF0ZXMgdGhlIHNwZWNpZmllZCBpbmRleCBvbiB0aGUgY29sbGVjdGlvbi5cbiAgICogQGxvY3VzIHNlcnZlclxuICAgKiBAbWV0aG9kIGNyZWF0ZUluZGV4QXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbmRleCBBIGRvY3VtZW50IHRoYXQgY29udGFpbnMgdGhlIGZpZWxkIGFuZCB2YWx1ZSBwYWlycyB3aGVyZSB0aGUgZmllbGQgaXMgdGhlIGluZGV4IGtleSBhbmQgdGhlIHZhbHVlIGRlc2NyaWJlcyB0aGUgdHlwZSBvZiBpbmRleCBmb3IgdGhhdCBmaWVsZC4gRm9yIGFuIGFzY2VuZGluZyBpbmRleCBvbiBhIGZpZWxkLCBzcGVjaWZ5IGEgdmFsdWUgb2YgYDFgOyBmb3IgZGVzY2VuZGluZyBpbmRleCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAtMWAuIFVzZSBgdGV4dGAgZm9yIHRleHQgaW5kZXhlcy5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL21ldGhvZC9kYi5jb2xsZWN0aW9uLmNyZWF0ZUluZGV4LyNvcHRpb25zKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5uYW1lIE5hbWUgb2YgdGhlIGluZGV4XG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51bmlxdWUgRGVmaW5lIHRoYXQgdGhlIGluZGV4IHZhbHVlcyBtdXN0IGJlIHVuaXF1ZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtdW5pcXVlLylcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnNwYXJzZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggaXMgc3BhcnNlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC1zcGFyc2UvKVxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gICdjcmVhdGVJbmRleCcsXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGaW5kcyB0aGUgZmlyc3QgZG9jdW1lbnQgdGhhdCBtYXRjaGVzIHRoZSBzZWxlY3RvciwgYXMgb3JkZXJlZCBieSBzb3J0IGFuZCBza2lwIG9wdGlvbnMuIFJldHVybnMgYHVuZGVmaW5lZGAgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnQgaXMgZm91bmQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGZpbmRPbmVBc3luY1xuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBbc2VsZWN0b3JdIEEgcXVlcnkgZGVzY3JpYmluZyB0aGUgZG9jdW1lbnRzIHRvIGZpbmRcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge01vbmdvU29ydFNwZWNpZmllcn0gb3B0aW9ucy5zb3J0IFNvcnQgb3JkZXIgKGRlZmF1bHQ6IG5hdHVyYWwgb3JkZXIpXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnNraXAgTnVtYmVyIG9mIHJlc3VsdHMgdG8gc2tpcCBhdCB0aGUgYmVnaW5uaW5nXG4gICAqIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gb3B0aW9ucy5maWVsZHMgRGljdGlvbmFyeSBvZiBmaWVsZHMgdG8gcmV0dXJuIG9yIGV4Y2x1ZGUuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZWFjdGl2ZSAoQ2xpZW50IG9ubHkpIERlZmF1bHQgdHJ1ZTsgcGFzcyBmYWxzZSB0byBkaXNhYmxlIHJlYWN0aXZpdHlcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy50cmFuc2Zvcm0gT3ZlcnJpZGVzIGB0cmFuc2Zvcm1gIG9uIHRoZSBbYENvbGxlY3Rpb25gXSgjY29sbGVjdGlvbnMpIGZvciB0aGlzIGN1cnNvci4gIFBhc3MgYG51bGxgIHRvIGRpc2FibGUgdHJhbnNmb3JtYXRpb24uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLnJlYWRQcmVmZXJlbmNlIChTZXJ2ZXIgb25seSkgU3BlY2lmaWVzIGEgY3VzdG9tIE1vbmdvREIgW2ByZWFkUHJlZmVyZW5jZWBdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9yZWFkLXByZWZlcmVuY2UpIGZvciBmZXRjaGluZyB0aGUgZG9jdW1lbnQuIFBvc3NpYmxlIHZhbHVlcyBhcmUgYHByaW1hcnlgLCBgcHJpbWFyeVByZWZlcnJlZGAsIGBzZWNvbmRhcnlgLCBgc2Vjb25kYXJ5UHJlZmVycmVkYCBhbmQgYG5lYXJlc3RgLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gICdmaW5kT25lJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEluc2VydCBhIGRvY3VtZW50IGluIHRoZSBjb2xsZWN0aW9uLiAgUmV0dXJucyBpdHMgdW5pcXVlIF9pZC5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgIGluc2VydEFzeW5jXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gZG9jIFRoZSBkb2N1bWVudCB0byBpbnNlcnQuIE1heSBub3QgeWV0IGhhdmUgYW4gX2lkIGF0dHJpYnV0ZSwgaW4gd2hpY2ggY2FzZSBNZXRlb3Igd2lsbCBnZW5lcmF0ZSBvbmUgZm9yIHlvdS5cbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICovXG4gICdpbnNlcnQnLFxuICAvKipcbiAgICogQHN1bW1hcnkgUmVtb3ZlIGRvY3VtZW50cyBmcm9tIHRoZSBjb2xsZWN0aW9uXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHJlbW92ZUFzeW5jXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gcmVtb3ZlXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICAncmVtb3ZlJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IE1vZGlmeSBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24uIFJldHVybnMgdGhlIG51bWJlciBvZiBtYXRjaGVkIGRvY3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBkYXRlQXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51cHNlcnQgVHJ1ZSB0byBpbnNlcnQgYSBkb2N1bWVudCBpZiBubyBtYXRjaGluZyBkb2N1bWVudHMgYXJlIGZvdW5kLlxuICAgKiBAcGFyYW0ge0FycmF5fSBvcHRpb25zLmFycmF5RmlsdGVycyBPcHRpb25hbC4gVXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIE1vbmdvREIgW2ZpbHRlcmVkIHBvc2l0aW9uYWwgb3BlcmF0b3JdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL29wZXJhdG9yL3VwZGF0ZS9wb3NpdGlvbmFsLWZpbHRlcmVkLykgdG8gc3BlY2lmeSB3aGljaCBlbGVtZW50cyB0byBtb2RpZnkgaW4gYW4gYXJyYXkgZmllbGQuXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICAndXBkYXRlJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IE1vZGlmeSBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24sIG9yIGluc2VydCBvbmUgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnRzIHdlcmUgZm91bmQuIFJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5cyBgbnVtYmVyQWZmZWN0ZWRgICh0aGUgbnVtYmVyIG9mIGRvY3VtZW50cyBtb2RpZmllZCkgIGFuZCBgaW5zZXJ0ZWRJZGAgKHRoZSB1bmlxdWUgX2lkIG9mIHRoZSBkb2N1bWVudCB0aGF0IHdhcyBpbnNlcnRlZCwgaWYgYW55KS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBzZXJ0QXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICAndXBzZXJ0Jyxcbl07XG5cbmV4cG9ydCBjb25zdCBBU1lOQ19DVVJTT1JfTUVUSE9EUyA9IFtcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIGluIDIuOVxuICAgKiBAc3VtbWFyeSBSZXR1cm5zIHRoZSBudW1iZXIgb2YgZG9jdW1lbnRzIHRoYXQgbWF0Y2ggYSBxdWVyeS4gVGhpcyBtZXRob2QgaXNcbiAgICogICAgICAgICAgW2RlcHJlY2F0ZWQgc2luY2UgTW9uZ29EQiA0LjBdKGh0dHBzOi8vd3d3Lm1vbmdvZGIuY29tL2RvY3MvdjQuNC9yZWZlcmVuY2UvY29tbWFuZC9jb3VudC8pO1xuICAgKiAgICAgICAgICBzZWUgYENvbGxlY3Rpb24uY291bnREb2N1bWVudHNgIGFuZFxuICAgKiAgICAgICAgICBgQ29sbGVjdGlvbi5lc3RpbWF0ZWREb2N1bWVudENvdW50YCBmb3IgYSByZXBsYWNlbWVudC5cbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAbWV0aG9kICBjb3VudEFzeW5jXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAqL1xuICAnY291bnQnLFxuICAvKipcbiAgICogQHN1bW1hcnkgUmV0dXJuIGFsbCBtYXRjaGluZyBkb2N1bWVudHMgYXMgYW4gQXJyYXkuXG4gICAqIEBtZW1iZXJPZiBNb25nby5DdXJzb3JcbiAgICogQG1ldGhvZCAgZmV0Y2hBc3luY1xuICAgKiBAaW5zdGFuY2VcbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgJ2ZldGNoJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgYGNhbGxiYWNrYCBvbmNlIGZvciBlYWNoIG1hdGNoaW5nIGRvY3VtZW50LCBzZXF1ZW50aWFsbHkgYW5kXG4gICAqICAgICAgICAgIHN5bmNocm9ub3VzbHkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kICBmb3JFYWNoQXN5bmNcbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBNb25nby5DdXJzb3JcbiAgICogQHBhcmFtIHtJdGVyYXRpb25DYWxsYmFja30gY2FsbGJhY2sgRnVuY3Rpb24gdG8gY2FsbC4gSXQgd2lsbCBiZSBjYWxsZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2l0aCB0aHJlZSBhcmd1bWVudHM6IHRoZSBkb2N1bWVudCwgYVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLWJhc2VkIGluZGV4LCBhbmQgPGVtPmN1cnNvcjwvZW0+XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0c2VsZi5cbiAgICogQHBhcmFtIHtBbnl9IFt0aGlzQXJnXSBBbiBvYmplY3Qgd2hpY2ggd2lsbCBiZSB0aGUgdmFsdWUgb2YgYHRoaXNgIGluc2lkZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgJ2ZvckVhY2gnLFxuICAvKipcbiAgICogQHN1bW1hcnkgTWFwIGNhbGxiYWNrIG92ZXIgYWxsIG1hdGNoaW5nIGRvY3VtZW50cy4gIFJldHVybnMgYW4gQXJyYXkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIG1hcEFzeW5jXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBwYXJhbSB7SXRlcmF0aW9uQ2FsbGJhY2t9IGNhbGxiYWNrIEZ1bmN0aW9uIHRvIGNhbGwuIEl0IHdpbGwgYmUgY2FsbGVkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpdGggdGhyZWUgYXJndW1lbnRzOiB0aGUgZG9jdW1lbnQsIGFcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMC1iYXNlZCBpbmRleCwgYW5kIDxlbT5jdXJzb3I8L2VtPlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdHNlbGYuXG4gICAqIEBwYXJhbSB7QW55fSBbdGhpc0FyZ10gQW4gb2JqZWN0IHdoaWNoIHdpbGwgYmUgdGhlIHZhbHVlIG9mIGB0aGlzYCBpbnNpZGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gICdtYXAnLFxuXTtcblxuZXhwb3J0IGNvbnN0IENMSUVOVF9PTkxZX01FVEhPRFMgPSBbXCJmaW5kT25lXCIsIFwiaW5zZXJ0XCIsIFwicmVtb3ZlXCIsIFwidXBkYXRlXCIsIFwidXBzZXJ0XCJdO1xuIiwiaW1wb3J0IExvY2FsQ29sbGVjdGlvbiBmcm9tICcuL2xvY2FsX2NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgaGFzT3duIH0gZnJvbSAnLi9jb21tb24uanMnO1xuaW1wb3J0IHsgQVNZTkNfQ1VSU09SX01FVEhPRFMsIGdldEFzeW5jTWV0aG9kTmFtZSB9IGZyb20gJy4vY29uc3RhbnRzJztcblxuLy8gQ3Vyc29yOiBhIHNwZWNpZmljYXRpb24gZm9yIGEgcGFydGljdWxhciBzdWJzZXQgb2YgZG9jdW1lbnRzLCB3LyBhIGRlZmluZWRcbi8vIG9yZGVyLCBsaW1pdCwgYW5kIG9mZnNldC4gIGNyZWF0aW5nIGEgQ3Vyc29yIHdpdGggTG9jYWxDb2xsZWN0aW9uLmZpbmQoKSxcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEN1cnNvciB7XG4gIC8vIGRvbid0IGNhbGwgdGhpcyBjdG9yIGRpcmVjdGx5LiAgdXNlIExvY2FsQ29sbGVjdGlvbi5maW5kKCkuXG4gIGNvbnN0cnVjdG9yKGNvbGxlY3Rpb24sIHNlbGVjdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLmNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uO1xuICAgIHRoaXMuc29ydGVyID0gbnVsbDtcbiAgICB0aGlzLm1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoc2VsZWN0b3IpO1xuXG4gICAgaWYgKExvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkUGVyaGFwc0FzT2JqZWN0KHNlbGVjdG9yKSkge1xuICAgICAgLy8gc3Rhc2ggZm9yIGZhc3QgX2lkIGFuZCB7IF9pZCB9XG4gICAgICB0aGlzLl9zZWxlY3RvcklkID0gaGFzT3duLmNhbGwoc2VsZWN0b3IsICdfaWQnKSA/IHNlbGVjdG9yLl9pZCA6IHNlbGVjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zZWxlY3RvcklkID0gdW5kZWZpbmVkO1xuXG4gICAgICBpZiAodGhpcy5tYXRjaGVyLmhhc0dlb1F1ZXJ5KCkgfHwgb3B0aW9ucy5zb3J0KSB7XG4gICAgICAgIHRoaXMuc29ydGVyID0gbmV3IE1pbmltb25nby5Tb3J0ZXIob3B0aW9ucy5zb3J0IHx8IFtdKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXAgPSBvcHRpb25zLnNraXAgfHwgMDtcbiAgICB0aGlzLmxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICB0aGlzLmZpZWxkcyA9IG9wdGlvbnMucHJvamVjdGlvbiB8fCBvcHRpb25zLmZpZWxkcztcblxuICAgIHRoaXMuX3Byb2plY3Rpb25GbiA9IExvY2FsQ29sbGVjdGlvbi5fY29tcGlsZVByb2plY3Rpb24odGhpcy5maWVsZHMgfHwge30pO1xuXG4gICAgdGhpcy5fdHJhbnNmb3JtID0gTG9jYWxDb2xsZWN0aW9uLndyYXBUcmFuc2Zvcm0ob3B0aW9ucy50cmFuc2Zvcm0pO1xuXG4gICAgLy8gYnkgZGVmYXVsdCwgcXVlcmllcyByZWdpc3RlciB3LyBUcmFja2VyIHdoZW4gaXQgaXMgYXZhaWxhYmxlLlxuICAgIGlmICh0eXBlb2YgVHJhY2tlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMucmVhY3RpdmUgPSBvcHRpb25zLnJlYWN0aXZlID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0aW9ucy5yZWFjdGl2ZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgaW4gMi45XG4gICAqIEBzdW1tYXJ5IFJldHVybnMgdGhlIG51bWJlciBvZiBkb2N1bWVudHMgdGhhdCBtYXRjaCBhIHF1ZXJ5LiBUaGlzIG1ldGhvZCBpc1xuICAgKiAgICAgICAgICBbZGVwcmVjYXRlZCBzaW5jZSBNb25nb0RCIDQuMF0oaHR0cHM6Ly93d3cubW9uZ29kYi5jb20vZG9jcy92NC40L3JlZmVyZW5jZS9jb21tYW5kL2NvdW50Lyk7XG4gICAqICAgICAgICAgIHNlZSBgQ29sbGVjdGlvbi5jb3VudERvY3VtZW50c2AgYW5kXG4gICAqICAgICAgICAgIGBDb2xsZWN0aW9uLmVzdGltYXRlZERvY3VtZW50Q291bnRgIGZvciBhIHJlcGxhY2VtZW50LlxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBtZXRob2QgIGNvdW50XG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHJldHVybnMge051bWJlcn1cbiAgICovXG4gIGNvdW50KCkge1xuICAgIGlmICh0aGlzLnJlYWN0aXZlKSB7XG4gICAgICAvLyBhbGxvdyB0aGUgb2JzZXJ2ZSB0byBiZSB1bm9yZGVyZWRcbiAgICAgIHRoaXMuX2RlcGVuZCh7IGFkZGVkOiB0cnVlLCByZW1vdmVkOiB0cnVlIH0sIHRydWUpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9nZXRSYXdPYmplY3RzKHtcbiAgICAgIG9yZGVyZWQ6IHRydWUsXG4gICAgfSkubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJldHVybiBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzIGFzIGFuIEFycmF5LlxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBtZXRob2QgIGZldGNoXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHJldHVybnMge09iamVjdFtdfVxuICAgKi9cbiAgZmV0Y2goKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICB0aGlzLmZvckVhY2goZG9jID0+IHtcbiAgICAgIHJlc3VsdC5wdXNoKGRvYyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgaWYgKHRoaXMucmVhY3RpdmUpIHtcbiAgICAgIHRoaXMuX2RlcGVuZCh7XG4gICAgICAgIGFkZGVkQmVmb3JlOiB0cnVlLFxuICAgICAgICByZW1vdmVkOiB0cnVlLFxuICAgICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgICAgICBtb3ZlZEJlZm9yZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3Qgb2JqZWN0cyA9IHRoaXMuX2dldFJhd09iamVjdHMoeyBvcmRlcmVkOiB0cnVlIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgaWYgKGluZGV4IDwgb2JqZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAvLyBUaGlzIGRvdWJsZXMgYXMgYSBjbG9uZSBvcGVyYXRpb24uXG4gICAgICAgICAgbGV0IGVsZW1lbnQgPSB0aGlzLl9wcm9qZWN0aW9uRm4ob2JqZWN0c1tpbmRleCsrXSk7XG5cbiAgICAgICAgICBpZiAodGhpcy5fdHJhbnNmb3JtKSBlbGVtZW50ID0gdGhpcy5fdHJhbnNmb3JtKGVsZW1lbnQpO1xuXG4gICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IGVsZW1lbnQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGRvbmU6IHRydWUgfTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgY29uc3Qgc3luY1Jlc3VsdCA9IHRoaXNbU3ltYm9sLml0ZXJhdG9yXSgpO1xuICAgIHJldHVybiB7XG4gICAgICBhc3luYyBuZXh0KCkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHN5bmNSZXN1bHQubmV4dCgpKTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAY2FsbGJhY2sgSXRlcmF0aW9uQ2FsbGJhY2tcbiAgICogQHBhcmFtIHtPYmplY3R9IGRvY1xuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICovXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGBjYWxsYmFja2Agb25jZSBmb3IgZWFjaCBtYXRjaGluZyBkb2N1bWVudCwgc2VxdWVudGlhbGx5IGFuZFxuICAgKiAgICAgICAgICBzeW5jaHJvbm91c2x5LlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCAgZm9yRWFjaFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAcGFyYW0ge0l0ZXJhdGlvbkNhbGxiYWNrfSBjYWxsYmFjayBGdW5jdGlvbiB0byBjYWxsLiBJdCB3aWxsIGJlIGNhbGxlZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRoIHRocmVlIGFyZ3VtZW50czogdGhlIGRvY3VtZW50LCBhXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAtYmFzZWQgaW5kZXgsIGFuZCA8ZW0+Y3Vyc29yPC9lbT5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRzZWxmLlxuICAgKiBAcGFyYW0ge0FueX0gW3RoaXNBcmddIEFuIG9iamVjdCB3aGljaCB3aWxsIGJlIHRoZSB2YWx1ZSBvZiBgdGhpc2AgaW5zaWRlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgYGNhbGxiYWNrYC5cbiAgICovXG4gIGZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBpZiAodGhpcy5yZWFjdGl2ZSkge1xuICAgICAgdGhpcy5fZGVwZW5kKHtcbiAgICAgICAgYWRkZWRCZWZvcmU6IHRydWUsXG4gICAgICAgIHJlbW92ZWQ6IHRydWUsXG4gICAgICAgIGNoYW5nZWQ6IHRydWUsXG4gICAgICAgIG1vdmVkQmVmb3JlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5fZ2V0UmF3T2JqZWN0cyh7IG9yZGVyZWQ6IHRydWUgfSkuZm9yRWFjaCgoZWxlbWVudCwgaSkgPT4ge1xuICAgICAgLy8gVGhpcyBkb3VibGVzIGFzIGEgY2xvbmUgb3BlcmF0aW9uLlxuICAgICAgZWxlbWVudCA9IHRoaXMuX3Byb2plY3Rpb25GbihlbGVtZW50KTtcblxuICAgICAgaWYgKHRoaXMuX3RyYW5zZm9ybSkge1xuICAgICAgICBlbGVtZW50ID0gdGhpcy5fdHJhbnNmb3JtKGVsZW1lbnQpO1xuICAgICAgfVxuXG4gICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGVsZW1lbnQsIGksIHRoaXMpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0VHJhbnNmb3JtKCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm07XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgTWFwIGNhbGxiYWNrIG92ZXIgYWxsIG1hdGNoaW5nIGRvY3VtZW50cy4gIFJldHVybnMgYW4gQXJyYXkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIG1hcFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAcGFyYW0ge0l0ZXJhdGlvbkNhbGxiYWNrfSBjYWxsYmFjayBGdW5jdGlvbiB0byBjYWxsLiBJdCB3aWxsIGJlIGNhbGxlZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRoIHRocmVlIGFyZ3VtZW50czogdGhlIGRvY3VtZW50LCBhXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAtYmFzZWQgaW5kZXgsIGFuZCA8ZW0+Y3Vyc29yPC9lbT5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRzZWxmLlxuICAgKiBAcGFyYW0ge0FueX0gW3RoaXNBcmddIEFuIG9iamVjdCB3aGljaCB3aWxsIGJlIHRoZSB2YWx1ZSBvZiBgdGhpc2AgaW5zaWRlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgYGNhbGxiYWNrYC5cbiAgICovXG4gIG1hcChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgdGhpcy5mb3JFYWNoKChkb2MsIGkpID0+IHtcbiAgICAgIHJlc3VsdC5wdXNoKGNhbGxiYWNrLmNhbGwodGhpc0FyZywgZG9jLCBpLCB0aGlzKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gb3B0aW9ucyB0byBjb250YWluOlxuICAvLyAgKiBjYWxsYmFja3MgZm9yIG9ic2VydmUoKTpcbiAgLy8gICAgLSBhZGRlZEF0IChkb2N1bWVudCwgYXRJbmRleClcbiAgLy8gICAgLSBhZGRlZCAoZG9jdW1lbnQpXG4gIC8vICAgIC0gY2hhbmdlZEF0IChuZXdEb2N1bWVudCwgb2xkRG9jdW1lbnQsIGF0SW5kZXgpXG4gIC8vICAgIC0gY2hhbmdlZCAobmV3RG9jdW1lbnQsIG9sZERvY3VtZW50KVxuICAvLyAgICAtIHJlbW92ZWRBdCAoZG9jdW1lbnQsIGF0SW5kZXgpXG4gIC8vICAgIC0gcmVtb3ZlZCAoZG9jdW1lbnQpXG4gIC8vICAgIC0gbW92ZWRUbyAoZG9jdW1lbnQsIG9sZEluZGV4LCBuZXdJbmRleClcbiAgLy9cbiAgLy8gYXR0cmlidXRlcyBhdmFpbGFibGUgb24gcmV0dXJuZWQgcXVlcnkgaGFuZGxlOlxuICAvLyAgKiBzdG9wKCk6IGVuZCB1cGRhdGVzXG4gIC8vICAqIGNvbGxlY3Rpb246IHRoZSBjb2xsZWN0aW9uIHRoaXMgcXVlcnkgaXMgcXVlcnlpbmdcbiAgLy9cbiAgLy8gaWZmIHggaXMgYSByZXR1cm5lZCBxdWVyeSBoYW5kbGUsICh4IGluc3RhbmNlb2ZcbiAgLy8gTG9jYWxDb2xsZWN0aW9uLk9ic2VydmVIYW5kbGUpIGlzIHRydWVcbiAgLy9cbiAgLy8gaW5pdGlhbCByZXN1bHRzIGRlbGl2ZXJlZCB0aHJvdWdoIGFkZGVkIGNhbGxiYWNrXG4gIC8vIFhYWCBtYXliZSBjYWxsYmFja3Mgc2hvdWxkIHRha2UgYSBsaXN0IG9mIG9iamVjdHMsIHRvIGV4cG9zZSB0cmFuc2FjdGlvbnM/XG4gIC8vIFhYWCBtYXliZSBzdXBwb3J0IGZpZWxkIGxpbWl0aW5nICh0byBsaW1pdCB3aGF0IHlvdSdyZSBub3RpZmllZCBvbilcblxuICAvKipcbiAgICogQHN1bW1hcnkgV2F0Y2ggYSBxdWVyeS4gIFJlY2VpdmUgY2FsbGJhY2tzIGFzIHRoZSByZXN1bHQgc2V0IGNoYW5nZXMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gY2FsbGJhY2tzIEZ1bmN0aW9ucyB0byBjYWxsIHRvIGRlbGl2ZXIgdGhlIHJlc3VsdCBzZXQgYXMgaXRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzXG4gICAqL1xuICBvYnNlcnZlKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlRnJvbU9ic2VydmVDaGFuZ2VzKHRoaXMsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFdhdGNoIGEgcXVlcnkuICBSZWNlaXZlIGNhbGxiYWNrcyBhcyB0aGUgcmVzdWx0IHNldCBjaGFuZ2VzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIG9ic2VydmVBc3luYyhvcHRpb25zKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gcmVzb2x2ZSh0aGlzLm9ic2VydmUob3B0aW9ucykpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBXYXRjaCBhIHF1ZXJ5LiBSZWNlaXZlIGNhbGxiYWNrcyBhcyB0aGUgcmVzdWx0IHNldCBjaGFuZ2VzLiBPbmx5XG4gICAqICAgICAgICAgIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIHRoZSBvbGQgYW5kIG5ldyBkb2N1bWVudHMgYXJlIHBhc3NlZCB0b1xuICAgKiAgICAgICAgICB0aGUgY2FsbGJhY2tzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtPYmplY3R9IGNhbGxiYWNrcyBGdW5jdGlvbnMgdG8gY2FsbCB0byBkZWxpdmVyIHRoZSByZXN1bHQgc2V0IGFzIGl0XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhbmdlc1xuICAgKi9cbiAgb2JzZXJ2ZUNoYW5nZXMob3B0aW9ucykge1xuICAgIGNvbnN0IG9yZGVyZWQgPSBMb2NhbENvbGxlY3Rpb24uX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZChvcHRpb25zKTtcblxuICAgIC8vIHRoZXJlIGFyZSBzZXZlcmFsIHBsYWNlcyB0aGF0IGFzc3VtZSB5b3UgYXJlbid0IGNvbWJpbmluZyBza2lwL2xpbWl0IHdpdGhcbiAgICAvLyB1bm9yZGVyZWQgb2JzZXJ2ZS4gIGVnLCB1cGRhdGUncyBFSlNPTi5jbG9uZSwgYW5kIHRoZSBcInRoZXJlIGFyZSBzZXZlcmFsXCJcbiAgICAvLyBjb21tZW50IGluIF9tb2RpZnlBbmROb3RpZnlcbiAgICAvLyBYWFggYWxsb3cgc2tpcC9saW1pdCB3aXRoIHVub3JkZXJlZCBvYnNlcnZlXG4gICAgaWYgKCFvcHRpb25zLl9hbGxvd191bm9yZGVyZWQgJiYgIW9yZGVyZWQgJiYgKHRoaXMuc2tpcCB8fCB0aGlzLmxpbWl0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIk11c3QgdXNlIGFuIG9yZGVyZWQgb2JzZXJ2ZSB3aXRoIHNraXAgb3IgbGltaXQgKGkuZS4gJ2FkZGVkQmVmb3JlJyBcIiArXG4gICAgICAgICAgXCJmb3Igb2JzZXJ2ZUNoYW5nZXMgb3IgJ2FkZGVkQXQnIGZvciBvYnNlcnZlLCBpbnN0ZWFkIG9mICdhZGRlZCcpLlwiXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmZpZWxkcyAmJiAodGhpcy5maWVsZHMuX2lkID09PSAwIHx8IHRoaXMuZmllbGRzLl9pZCA9PT0gZmFsc2UpKSB7XG4gICAgICB0aHJvdyBFcnJvcihcIllvdSBtYXkgbm90IG9ic2VydmUgYSBjdXJzb3Igd2l0aCB7ZmllbGRzOiB7X2lkOiAwfX1cIik7XG4gICAgfVxuXG4gICAgY29uc3QgZGlzdGFuY2VzID1cbiAgICAgIHRoaXMubWF0Y2hlci5oYXNHZW9RdWVyeSgpICYmIG9yZGVyZWQgJiYgbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXAoKTtcblxuICAgIGNvbnN0IHF1ZXJ5ID0ge1xuICAgICAgY3Vyc29yOiB0aGlzLFxuICAgICAgZGlydHk6IGZhbHNlLFxuICAgICAgZGlzdGFuY2VzLFxuICAgICAgbWF0Y2hlcjogdGhpcy5tYXRjaGVyLCAvLyBub3QgZmFzdCBwYXRoZWRcbiAgICAgIG9yZGVyZWQsXG4gICAgICBwcm9qZWN0aW9uRm46IHRoaXMuX3Byb2plY3Rpb25GbixcbiAgICAgIHJlc3VsdHNTbmFwc2hvdDogbnVsbCxcbiAgICAgIHNvcnRlcjogb3JkZXJlZCAmJiB0aGlzLnNvcnRlcixcbiAgICB9O1xuXG4gICAgbGV0IHFpZDtcblxuICAgIC8vIE5vbi1yZWFjdGl2ZSBxdWVyaWVzIGNhbGwgYWRkZWRbQmVmb3JlXSBhbmQgdGhlbiBuZXZlciBjYWxsIGFueXRoaW5nXG4gICAgLy8gZWxzZS5cbiAgICBpZiAodGhpcy5yZWFjdGl2ZSkge1xuICAgICAgcWlkID0gdGhpcy5jb2xsZWN0aW9uLm5leHRfcWlkKys7XG4gICAgICB0aGlzLmNvbGxlY3Rpb24ucXVlcmllc1txaWRdID0gcXVlcnk7XG4gICAgfVxuXG4gICAgcXVlcnkucmVzdWx0cyA9IHRoaXMuX2dldFJhd09iamVjdHMoe1xuICAgICAgb3JkZXJlZCxcbiAgICAgIGRpc3RhbmNlczogcXVlcnkuZGlzdGFuY2VzLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuY29sbGVjdGlvbi5wYXVzZWQpIHtcbiAgICAgIHF1ZXJ5LnJlc3VsdHNTbmFwc2hvdCA9IG9yZGVyZWQgPyBbXSA6IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwKCk7XG4gICAgfVxuXG4gICAgLy8gd3JhcCBjYWxsYmFja3Mgd2Ugd2VyZSBwYXNzZWQuIGNhbGxiYWNrcyBvbmx5IGZpcmUgd2hlbiBub3QgcGF1c2VkIGFuZFxuICAgIC8vIGFyZSBuZXZlciB1bmRlZmluZWRcbiAgICAvLyBGaWx0ZXJzIG91dCBibGFja2xpc3RlZCBmaWVsZHMgYWNjb3JkaW5nIHRvIGN1cnNvcidzIHByb2plY3Rpb24uXG4gICAgLy8gWFhYIHdyb25nIHBsYWNlIGZvciB0aGlzP1xuXG4gICAgLy8gZnVydGhlcm1vcmUsIGNhbGxiYWNrcyBlbnF1ZXVlIHVudGlsIHRoZSBvcGVyYXRpb24gd2UncmUgd29ya2luZyBvbiBpc1xuICAgIC8vIGRvbmUuXG4gICAgY29uc3Qgd3JhcENhbGxiYWNrID0gKGZuKSA9PiB7XG4gICAgICBpZiAoIWZuKSB7XG4gICAgICAgIHJldHVybiAoKSA9PiB7fTtcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAgIHJldHVybiBmdW5jdGlvbiAoLyogYXJncyovKSB7XG4gICAgICAgIGlmIChzZWxmLmNvbGxlY3Rpb24ucGF1c2VkKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXJncyA9IGFyZ3VtZW50cztcblxuICAgICAgICBzZWxmLmNvbGxlY3Rpb24uX29ic2VydmVRdWV1ZS5xdWV1ZVRhc2soKCkgPT4ge1xuICAgICAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9KTtcbiAgICAgIH07XG4gICAgfTtcblxuICAgIHF1ZXJ5LmFkZGVkID0gd3JhcENhbGxiYWNrKG9wdGlvbnMuYWRkZWQpO1xuICAgIHF1ZXJ5LmNoYW5nZWQgPSB3cmFwQ2FsbGJhY2sob3B0aW9ucy5jaGFuZ2VkKTtcbiAgICBxdWVyeS5yZW1vdmVkID0gd3JhcENhbGxiYWNrKG9wdGlvbnMucmVtb3ZlZCk7XG5cbiAgICBpZiAob3JkZXJlZCkge1xuICAgICAgcXVlcnkuYWRkZWRCZWZvcmUgPSB3cmFwQ2FsbGJhY2sob3B0aW9ucy5hZGRlZEJlZm9yZSk7XG4gICAgICBxdWVyeS5tb3ZlZEJlZm9yZSA9IHdyYXBDYWxsYmFjayhvcHRpb25zLm1vdmVkQmVmb3JlKTtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMuX3N1cHByZXNzX2luaXRpYWwgJiYgIXRoaXMuY29sbGVjdGlvbi5wYXVzZWQpIHtcbiAgICAgIGNvbnN0IGhhbmRsZXIgPSAoZG9jKSA9PiB7XG4gICAgICAgIGNvbnN0IGZpZWxkcyA9IEVKU09OLmNsb25lKGRvYyk7XG5cbiAgICAgICAgZGVsZXRlIGZpZWxkcy5faWQ7XG5cbiAgICAgICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgICAgICBxdWVyeS5hZGRlZEJlZm9yZShkb2MuX2lkLCB0aGlzLl9wcm9qZWN0aW9uRm4oZmllbGRzKSwgbnVsbCk7XG4gICAgICAgIH1cblxuICAgICAgICBxdWVyeS5hZGRlZChkb2MuX2lkLCB0aGlzLl9wcm9qZWN0aW9uRm4oZmllbGRzKSk7XG4gICAgICB9O1xuICAgICAgLy8gaXQgbWVhbnMgaXQncyBqdXN0IGFuIGFycmF5XG4gICAgICBpZiAocXVlcnkucmVzdWx0cy5sZW5ndGgpIHtcbiAgICAgICAgZm9yIChjb25zdCBkb2Mgb2YgcXVlcnkucmVzdWx0cykge1xuICAgICAgICAgIGhhbmRsZXIoZG9jKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gaXQgbWVhbnMgaXQncyBhbiBpZCBtYXBcbiAgICAgIGlmIChxdWVyeS5yZXN1bHRzPy5zaXplPy4oKSkge1xuICAgICAgICBxdWVyeS5yZXN1bHRzLmZvckVhY2goaGFuZGxlcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaGFuZGxlID0gT2JqZWN0LmFzc2lnbihuZXcgTG9jYWxDb2xsZWN0aW9uLk9ic2VydmVIYW5kbGUoKSwge1xuICAgICAgY29sbGVjdGlvbjogdGhpcy5jb2xsZWN0aW9uLFxuICAgICAgc3RvcDogKCkgPT4ge1xuICAgICAgICBpZiAodGhpcy5yZWFjdGl2ZSkge1xuICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbGxlY3Rpb24ucXVlcmllc1txaWRdO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgaXNSZWFkeTogZmFsc2UsXG4gICAgICBpc1JlYWR5UHJvbWlzZTogbnVsbCxcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLnJlYWN0aXZlICYmIFRyYWNrZXIuYWN0aXZlKSB7XG4gICAgICAvLyBYWFggaW4gbWFueSBjYXNlcywgdGhlIHNhbWUgb2JzZXJ2ZSB3aWxsIGJlIHJlY3JlYXRlZCB3aGVuXG4gICAgICAvLyB0aGUgY3VycmVudCBhdXRvcnVuIGlzIHJlcnVuLiAgd2UgY291bGQgc2F2ZSB3b3JrIGJ5XG4gICAgICAvLyBsZXR0aW5nIGl0IGxpbmdlciBhY3Jvc3MgcmVydW4gYW5kIHBvdGVudGlhbGx5IGdldFxuICAgICAgLy8gcmVwdXJwb3NlZCBpZiB0aGUgc2FtZSBvYnNlcnZlIGlzIHBlcmZvcm1lZCwgdXNpbmcgbG9naWNcbiAgICAgIC8vIHNpbWlsYXIgdG8gdGhhdCBvZiBNZXRlb3Iuc3Vic2NyaWJlLlxuICAgICAgVHJhY2tlci5vbkludmFsaWRhdGUoKCkgPT4ge1xuICAgICAgICBoYW5kbGUuc3RvcCgpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gcnVuIHRoZSBvYnNlcnZlIGNhbGxiYWNrcyByZXN1bHRpbmcgZnJvbSB0aGUgaW5pdGlhbCBjb250ZW50c1xuICAgIC8vIGJlZm9yZSB3ZSBsZWF2ZSB0aGUgb2JzZXJ2ZS5cbiAgICBjb25zdCBkcmFpblJlc3VsdCA9IHRoaXMuY29sbGVjdGlvbi5fb2JzZXJ2ZVF1ZXVlLmRyYWluKCk7XG5cbiAgICBpZiAoZHJhaW5SZXN1bHQgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICBoYW5kbGUuaXNSZWFkeVByb21pc2UgPSBkcmFpblJlc3VsdDtcbiAgICAgIGRyYWluUmVzdWx0LnRoZW4oKCkgPT4gKGhhbmRsZS5pc1JlYWR5ID0gdHJ1ZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBoYW5kbGUuaXNSZWFkeSA9IHRydWU7XG4gICAgICBoYW5kbGUuaXNSZWFkeVByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaGFuZGxlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFdhdGNoIGEgcXVlcnkuIFJlY2VpdmUgY2FsbGJhY2tzIGFzIHRoZSByZXN1bHQgc2V0IGNoYW5nZXMuIE9ubHlcbiAgICogICAgICAgICAgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gdGhlIG9sZCBhbmQgbmV3IGRvY3VtZW50cyBhcmUgcGFzc2VkIHRvXG4gICAqICAgICAgICAgIHRoZSBjYWxsYmFja3MuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gY2FsbGJhY2tzIEZ1bmN0aW9ucyB0byBjYWxsIHRvIGRlbGl2ZXIgdGhlIHJlc3VsdCBzZXQgYXMgaXRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzXG4gICAqL1xuICBvYnNlcnZlQ2hhbmdlc0FzeW5jKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgIGNvbnN0IGhhbmRsZSA9IHRoaXMub2JzZXJ2ZUNoYW5nZXMob3B0aW9ucyk7XG4gICAgICBoYW5kbGUuaXNSZWFkeVByb21pc2UudGhlbigoKSA9PiByZXNvbHZlKGhhbmRsZSkpO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gWFhYIE1heWJlIHdlIG5lZWQgYSB2ZXJzaW9uIG9mIG9ic2VydmUgdGhhdCBqdXN0IGNhbGxzIGEgY2FsbGJhY2sgaWZcbiAgLy8gYW55dGhpbmcgY2hhbmdlZC5cbiAgX2RlcGVuZChjaGFuZ2VycywgX2FsbG93X3Vub3JkZXJlZCkge1xuICAgIGlmIChUcmFja2VyLmFjdGl2ZSkge1xuICAgICAgY29uc3QgZGVwZW5kZW5jeSA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcbiAgICAgIGNvbnN0IG5vdGlmeSA9IGRlcGVuZGVuY3kuY2hhbmdlZC5iaW5kKGRlcGVuZGVuY3kpO1xuXG4gICAgICBkZXBlbmRlbmN5LmRlcGVuZCgpO1xuXG4gICAgICBjb25zdCBvcHRpb25zID0geyBfYWxsb3dfdW5vcmRlcmVkLCBfc3VwcHJlc3NfaW5pdGlhbDogdHJ1ZSB9O1xuXG4gICAgICBbJ2FkZGVkJywgJ2FkZGVkQmVmb3JlJywgJ2NoYW5nZWQnLCAnbW92ZWRCZWZvcmUnLCAncmVtb3ZlZCddLmZvckVhY2goXG4gICAgICAgIGZuID0+IHtcbiAgICAgICAgICBpZiAoY2hhbmdlcnNbZm5dKSB7XG4gICAgICAgICAgICBvcHRpb25zW2ZuXSA9IG5vdGlmeTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICk7XG5cbiAgICAgIC8vIG9ic2VydmVDaGFuZ2VzIHdpbGwgc3RvcCgpIHdoZW4gdGhpcyBjb21wdXRhdGlvbiBpcyBpbnZhbGlkYXRlZFxuICAgICAgdGhpcy5vYnNlcnZlQ2hhbmdlcyhvcHRpb25zKTtcbiAgICB9XG4gIH1cblxuICBfZ2V0Q29sbGVjdGlvbk5hbWUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbi5uYW1lO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIGNvbGxlY3Rpb24gb2YgbWF0Y2hpbmcgb2JqZWN0cywgYnV0IGRvZXNuJ3QgZGVlcCBjb3B5IHRoZW0uXG4gIC8vXG4gIC8vIElmIG9yZGVyZWQgaXMgc2V0LCByZXR1cm5zIGEgc29ydGVkIGFycmF5LCByZXNwZWN0aW5nIHNvcnRlciwgc2tpcCwgYW5kXG4gIC8vIGxpbWl0IHByb3BlcnRpZXMgb2YgdGhlIHF1ZXJ5IHByb3ZpZGVkIHRoYXQgb3B0aW9ucy5hcHBseVNraXBMaW1pdCBpc1xuICAvLyBub3Qgc2V0IHRvIGZhbHNlICgjMTIwMSkuIElmIHNvcnRlciBpcyBmYWxzZXksIG5vIHNvcnQgLS0geW91IGdldCB0aGVcbiAgLy8gbmF0dXJhbCBvcmRlci5cbiAgLy9cbiAgLy8gSWYgb3JkZXJlZCBpcyBub3Qgc2V0LCByZXR1cm5zIGFuIG9iamVjdCBtYXBwaW5nIGZyb20gSUQgdG8gZG9jIChzb3J0ZXIsXG4gIC8vIHNraXAgYW5kIGxpbWl0IHNob3VsZCBub3QgYmUgc2V0KS5cbiAgLy9cbiAgLy8gSWYgb3JkZXJlZCBpcyBzZXQgYW5kIHRoaXMgY3Vyc29yIGlzIGEgJG5lYXIgZ2VvcXVlcnksIHRoZW4gdGhpcyBmdW5jdGlvblxuICAvLyB3aWxsIHVzZSBhbiBfSWRNYXAgdG8gdHJhY2sgZWFjaCBkaXN0YW5jZSBmcm9tIHRoZSAkbmVhciBhcmd1bWVudCBwb2ludCBpblxuICAvLyBvcmRlciB0byB1c2UgaXQgYXMgYSBzb3J0IGtleS4gSWYgYW4gX0lkTWFwIGlzIHBhc3NlZCBpbiB0aGUgJ2Rpc3RhbmNlcydcbiAgLy8gYXJndW1lbnQsIHRoaXMgZnVuY3Rpb24gd2lsbCBjbGVhciBpdCBhbmQgdXNlIGl0IGZvciB0aGlzIHB1cnBvc2VcbiAgLy8gKG90aGVyd2lzZSBpdCB3aWxsIGp1c3QgY3JlYXRlIGl0cyBvd24gX0lkTWFwKS4gVGhlIG9ic2VydmVDaGFuZ2VzXG4gIC8vIGltcGxlbWVudGF0aW9uIHVzZXMgdGhpcyB0byByZW1lbWJlciB0aGUgZGlzdGFuY2VzIGFmdGVyIHRoaXMgZnVuY3Rpb25cbiAgLy8gcmV0dXJucy5cbiAgX2dldFJhd09iamVjdHMob3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gQnkgZGVmYXVsdCB0aGlzIG1ldGhvZCB3aWxsIHJlc3BlY3Qgc2tpcCBhbmQgbGltaXQgYmVjYXVzZSAuZmV0Y2goKSxcbiAgICAvLyAuZm9yRWFjaCgpIGV0Yy4uLiBleHBlY3QgdGhpcyBiZWhhdmlvdXIuIEl0IGNhbiBiZSBmb3JjZWQgdG8gaWdub3JlXG4gICAgLy8gc2tpcCBhbmQgbGltaXQgYnkgc2V0dGluZyBhcHBseVNraXBMaW1pdCB0byBmYWxzZSAoLmNvdW50KCkgZG9lcyB0aGlzLFxuICAgIC8vIGZvciBleGFtcGxlKVxuICAgIGNvbnN0IGFwcGx5U2tpcExpbWl0ID0gb3B0aW9ucy5hcHBseVNraXBMaW1pdCAhPT0gZmFsc2U7XG5cbiAgICAvLyBYWFggdXNlIE9yZGVyZWREaWN0IGluc3RlYWQgb2YgYXJyYXksIGFuZCBtYWtlIElkTWFwIGFuZCBPcmRlcmVkRGljdFxuICAgIC8vIGNvbXBhdGlibGVcbiAgICBjb25zdCByZXN1bHRzID0gb3B0aW9ucy5vcmRlcmVkID8gW10gOiBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcCgpO1xuXG4gICAgLy8gZmFzdCBwYXRoIGZvciBzaW5nbGUgSUQgdmFsdWVcbiAgICBpZiAodGhpcy5fc2VsZWN0b3JJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBJZiB5b3UgaGF2ZSBub24temVybyBza2lwIGFuZCBhc2sgZm9yIGEgc2luZ2xlIGlkLCB5b3UgZ2V0IG5vdGhpbmcuXG4gICAgICAvLyBUaGlzIGlzIHNvIGl0IG1hdGNoZXMgdGhlIGJlaGF2aW9yIG9mIHRoZSAne19pZDogZm9vfScgcGF0aC5cbiAgICAgIGlmIChhcHBseVNraXBMaW1pdCAmJiB0aGlzLnNraXApIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHNlbGVjdGVkRG9jID0gdGhpcy5jb2xsZWN0aW9uLl9kb2NzLmdldCh0aGlzLl9zZWxlY3RvcklkKTtcbiAgICAgIGlmIChzZWxlY3RlZERvYykge1xuICAgICAgICBpZiAob3B0aW9ucy5vcmRlcmVkKSB7XG4gICAgICAgICAgcmVzdWx0cy5wdXNoKHNlbGVjdGVkRG9jKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHRzLnNldCh0aGlzLl9zZWxlY3RvcklkLCBzZWxlY3RlZERvYyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIC8vIHNsb3cgcGF0aCBmb3IgYXJiaXRyYXJ5IHNlbGVjdG9yLCBzb3J0LCBza2lwLCBsaW1pdFxuXG4gICAgLy8gaW4gdGhlIG9ic2VydmVDaGFuZ2VzIGNhc2UsIGRpc3RhbmNlcyBpcyBhY3R1YWxseSBwYXJ0IG9mIHRoZSBcInF1ZXJ5XCJcbiAgICAvLyAoaWUsIGxpdmUgcmVzdWx0cyBzZXQpIG9iamVjdC4gIGluIG90aGVyIGNhc2VzLCBkaXN0YW5jZXMgaXMgb25seSB1c2VkXG4gICAgLy8gaW5zaWRlIHRoaXMgZnVuY3Rpb24uXG4gICAgbGV0IGRpc3RhbmNlcztcbiAgICBpZiAodGhpcy5tYXRjaGVyLmhhc0dlb1F1ZXJ5KCkgJiYgb3B0aW9ucy5vcmRlcmVkKSB7XG4gICAgICBpZiAob3B0aW9ucy5kaXN0YW5jZXMpIHtcbiAgICAgICAgZGlzdGFuY2VzID0gb3B0aW9ucy5kaXN0YW5jZXM7XG4gICAgICAgIGRpc3RhbmNlcy5jbGVhcigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGlzdGFuY2VzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXAoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBNZXRlb3IuX3J1bkZyZXNoKCgpID0+IHtcbiAgICAgIHRoaXMuY29sbGVjdGlvbi5fZG9jcy5mb3JFYWNoKChkb2MsIGlkKSA9PiB7XG4gICAgICAgIGNvbnN0IG1hdGNoUmVzdWx0ID0gdGhpcy5tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhkb2MpO1xuICAgICAgICBpZiAobWF0Y2hSZXN1bHQucmVzdWx0KSB7XG4gICAgICAgICAgaWYgKG9wdGlvbnMub3JkZXJlZCkge1xuICAgICAgICAgICAgcmVzdWx0cy5wdXNoKGRvYyk7XG5cbiAgICAgICAgICAgIGlmIChkaXN0YW5jZXMgJiYgbWF0Y2hSZXN1bHQuZGlzdGFuY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBkaXN0YW5jZXMuc2V0KGlkLCBtYXRjaFJlc3VsdC5kaXN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdHMuc2V0KGlkLCBkb2MpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE92ZXJyaWRlIHRvIGVuc3VyZSBhbGwgZG9jcyBhcmUgbWF0Y2hlZCBpZiBpZ25vcmluZyBza2lwICYgbGltaXRcbiAgICAgICAgaWYgKCFhcHBseVNraXBMaW1pdCkge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmFzdCBwYXRoIGZvciBsaW1pdGVkIHVuc29ydGVkIHF1ZXJpZXMuXG4gICAgICAgIC8vIFhYWCAnbGVuZ3RoJyBjaGVjayBoZXJlIHNlZW1zIHdyb25nIGZvciBvcmRlcmVkXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgIXRoaXMubGltaXQgfHwgdGhpcy5za2lwIHx8IHRoaXMuc29ydGVyIHx8IHJlc3VsdHMubGVuZ3RoICE9PSB0aGlzLmxpbWl0XG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGlmICghb3B0aW9ucy5vcmRlcmVkKSB7XG4gICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zb3J0ZXIpIHtcbiAgICAgIHJlc3VsdHMuc29ydCh0aGlzLnNvcnRlci5nZXRDb21wYXJhdG9yKHsgZGlzdGFuY2VzIH0pKTtcbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIGZ1bGwgc2V0IG9mIHJlc3VsdHMgaWYgdGhlcmUgaXMgbm8gc2tpcCBvciBsaW1pdCBvciBpZiB3ZSdyZVxuICAgIC8vIGlnbm9yaW5nIHRoZW1cbiAgICBpZiAoIWFwcGx5U2tpcExpbWl0IHx8ICghdGhpcy5saW1pdCAmJiAhdGhpcy5za2lwKSkge1xuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdHMuc2xpY2UoXG4gICAgICB0aGlzLnNraXAsXG4gICAgICB0aGlzLmxpbWl0ID8gdGhpcy5saW1pdCArIHRoaXMuc2tpcCA6IHJlc3VsdHMubGVuZ3RoXG4gICAgKTtcbiAgfVxuXG4gIF9wdWJsaXNoQ3Vyc29yKHN1YnNjcmlwdGlvbikge1xuICAgIC8vIFhYWCBtaW5pbW9uZ28gc2hvdWxkIG5vdCBkZXBlbmQgb24gbW9uZ28tbGl2ZWRhdGEhXG4gICAgaWYgKCFQYWNrYWdlLm1vbmdvKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiQ2FuJ3QgcHVibGlzaCBmcm9tIE1pbmltb25nbyB3aXRob3V0IHRoZSBgbW9uZ29gIHBhY2thZ2UuXCJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLmNvbGxlY3Rpb24ubmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIkNhbid0IHB1Ymxpc2ggYSBjdXJzb3IgZnJvbSBhIGNvbGxlY3Rpb24gd2l0aG91dCBhIG5hbWUuXCJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFBhY2thZ2UubW9uZ28uTW9uZ28uQ29sbGVjdGlvbi5fcHVibGlzaEN1cnNvcihcbiAgICAgIHRoaXMsXG4gICAgICBzdWJzY3JpcHRpb24sXG4gICAgICB0aGlzLmNvbGxlY3Rpb24ubmFtZVxuICAgICk7XG4gIH1cbn1cblxuLy8gSW1wbGVtZW50cyBhc3luYyB2ZXJzaW9uIG9mIGN1cnNvciBtZXRob2RzIHRvIGtlZXAgY29sbGVjdGlvbnMgaXNvbW9ycGhpY1xuQVNZTkNfQ1VSU09SX01FVEhPRFMuZm9yRWFjaChtZXRob2QgPT4ge1xuICBjb25zdCBhc3luY05hbWUgPSBnZXRBc3luY01ldGhvZE5hbWUobWV0aG9kKTtcbiAgQ3Vyc29yLnByb3RvdHlwZVthc3luY05hbWVdID0gZnVuY3Rpb24oLi4uYXJncykge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXNbbWV0aG9kXS5hcHBseSh0aGlzLCBhcmdzKSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gICAgfVxuICB9O1xufSk7XG4iLCJpbXBvcnQgQ3Vyc29yIGZyb20gJy4vY3Vyc29yLmpzJztcbmltcG9ydCBPYnNlcnZlSGFuZGxlIGZyb20gJy4vb2JzZXJ2ZV9oYW5kbGUuanMnO1xuaW1wb3J0IHtcbiAgaGFzT3duLFxuICBpc0luZGV4YWJsZSxcbiAgaXNOdW1lcmljS2V5LFxuICBpc09wZXJhdG9yT2JqZWN0LFxuICBwb3B1bGF0ZURvY3VtZW50V2l0aFF1ZXJ5RmllbGRzLFxuICBwcm9qZWN0aW9uRGV0YWlscyxcbn0gZnJvbSAnLi9jb21tb24uanMnO1xuXG5pbXBvcnQgeyBnZXRBc3luY01ldGhvZE5hbWUgfSBmcm9tICcuL2NvbnN0YW50cyc7XG5cbi8vIFhYWCB0eXBlIGNoZWNraW5nIG9uIHNlbGVjdG9ycyAoZ3JhY2VmdWwgZXJyb3IgaWYgbWFsZm9ybWVkKVxuXG4vLyBMb2NhbENvbGxlY3Rpb246IGEgc2V0IG9mIGRvY3VtZW50cyB0aGF0IHN1cHBvcnRzIHF1ZXJpZXMgYW5kIG1vZGlmaWVycy5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIExvY2FsQ29sbGVjdGlvbiB7XG4gIGNvbnN0cnVjdG9yKG5hbWUpIHtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIC8vIF9pZCAtPiBkb2N1bWVudCAoYWxzbyBjb250YWluaW5nIGlkKVxuICAgIHRoaXMuX2RvY3MgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcblxuICAgIHRoaXMuX29ic2VydmVRdWV1ZSA9IE1ldGVvci5pc0NsaWVudFxuICAgICAgPyBuZXcgTWV0ZW9yLl9TeW5jaHJvbm91c1F1ZXVlKClcbiAgICAgIDogbmV3IE1ldGVvci5fQXN5bmNocm9ub3VzUXVldWUoKTtcblxuICAgIHRoaXMubmV4dF9xaWQgPSAxOyAvLyBsaXZlIHF1ZXJ5IGlkIGdlbmVyYXRvclxuXG4gICAgLy8gcWlkIC0+IGxpdmUgcXVlcnkgb2JqZWN0LiBrZXlzOlxuICAgIC8vICBvcmRlcmVkOiBib29sLiBvcmRlcmVkIHF1ZXJpZXMgaGF2ZSBhZGRlZEJlZm9yZS9tb3ZlZEJlZm9yZSBjYWxsYmFja3MuXG4gICAgLy8gIHJlc3VsdHM6IGFycmF5IChvcmRlcmVkKSBvciBvYmplY3QgKHVub3JkZXJlZCkgb2YgY3VycmVudCByZXN1bHRzXG4gICAgLy8gICAgKGFsaWFzZWQgd2l0aCB0aGlzLl9kb2NzISlcbiAgICAvLyAgcmVzdWx0c1NuYXBzaG90OiBzbmFwc2hvdCBvZiByZXN1bHRzLiBudWxsIGlmIG5vdCBwYXVzZWQuXG4gICAgLy8gIGN1cnNvcjogQ3Vyc29yIG9iamVjdCBmb3IgdGhlIHF1ZXJ5LlxuICAgIC8vICBzZWxlY3Rvciwgc29ydGVyLCAoY2FsbGJhY2tzKTogZnVuY3Rpb25zXG4gICAgdGhpcy5xdWVyaWVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIC8vIG51bGwgaWYgbm90IHNhdmluZyBvcmlnaW5hbHM7IGFuIElkTWFwIGZyb20gaWQgdG8gb3JpZ2luYWwgZG9jdW1lbnQgdmFsdWVcbiAgICAvLyBpZiBzYXZpbmcgb3JpZ2luYWxzLiBTZWUgY29tbWVudHMgYmVmb3JlIHNhdmVPcmlnaW5hbHMoKS5cbiAgICB0aGlzLl9zYXZlZE9yaWdpbmFscyA9IG51bGw7XG5cbiAgICAvLyBUcnVlIHdoZW4gb2JzZXJ2ZXJzIGFyZSBwYXVzZWQgYW5kIHdlIHNob3VsZCBub3Qgc2VuZCBjYWxsYmFja3MuXG4gICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGNvdW50RG9jdW1lbnRzKHNlbGVjdG9yLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuZmluZChzZWxlY3RvciA/PyB7fSwgb3B0aW9ucykuY291bnRBc3luYygpO1xuICB9XG5cbiAgZXN0aW1hdGVkRG9jdW1lbnRDb3VudChvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuZmluZCh7fSwgb3B0aW9ucykuY291bnRBc3luYygpO1xuICB9XG5cbiAgLy8gb3B0aW9ucyBtYXkgaW5jbHVkZSBzb3J0LCBza2lwLCBsaW1pdCwgcmVhY3RpdmVcbiAgLy8gc29ydCBtYXkgYmUgYW55IG9mIHRoZXNlIGZvcm1zOlxuICAvLyAgICAge2E6IDEsIGI6IC0xfVxuICAvLyAgICAgW1tcImFcIiwgXCJhc2NcIl0sIFtcImJcIiwgXCJkZXNjXCJdXVxuICAvLyAgICAgW1wiYVwiLCBbXCJiXCIsIFwiZGVzY1wiXV1cbiAgLy8gICAoaW4gdGhlIGZpcnN0IGZvcm0geW91J3JlIGJlaG9sZGVuIHRvIGtleSBlbnVtZXJhdGlvbiBvcmRlciBpblxuICAvLyAgIHlvdXIgamF2YXNjcmlwdCBWTSlcbiAgLy9cbiAgLy8gcmVhY3RpdmU6IGlmIGdpdmVuLCBhbmQgZmFsc2UsIGRvbid0IHJlZ2lzdGVyIHdpdGggVHJhY2tlciAoZGVmYXVsdFxuICAvLyBpcyB0cnVlKVxuICAvL1xuICAvLyBYWFggcG9zc2libHkgc2hvdWxkIHN1cHBvcnQgcmV0cmlldmluZyBhIHN1YnNldCBvZiBmaWVsZHM/IGFuZFxuICAvLyBoYXZlIGl0IGJlIGEgaGludCAoaWdub3JlZCBvbiB0aGUgY2xpZW50LCB3aGVuIG5vdCBjb3B5aW5nIHRoZVxuICAvLyBkb2M/KVxuICAvL1xuICAvLyBYWFggc29ydCBkb2VzIG5vdCB5ZXQgc3VwcG9ydCBzdWJrZXlzICgnYS5iJykgLi4gZml4IHRoYXQhXG4gIC8vIFhYWCBhZGQgb25lIG1vcmUgc29ydCBmb3JtOiBcImtleVwiXG4gIC8vIFhYWCB0ZXN0c1xuICBmaW5kKHNlbGVjdG9yLCBvcHRpb25zKSB7XG4gICAgLy8gZGVmYXVsdCBzeW50YXggZm9yIGV2ZXJ5dGhpbmcgaXMgdG8gb21pdCB0aGUgc2VsZWN0b3IgYXJndW1lbnQuXG4gICAgLy8gYnV0IGlmIHNlbGVjdG9yIGlzIGV4cGxpY2l0bHkgcGFzc2VkIGluIGFzIGZhbHNlIG9yIHVuZGVmaW5lZCwgd2VcbiAgICAvLyB3YW50IGEgc2VsZWN0b3IgdGhhdCBtYXRjaGVzIG5vdGhpbmcuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHNlbGVjdG9yID0ge307XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBMb2NhbENvbGxlY3Rpb24uQ3Vyc29yKHRoaXMsIHNlbGVjdG9yLCBvcHRpb25zKTtcbiAgfVxuXG4gIGZpbmRPbmUoc2VsZWN0b3IsIG9wdGlvbnMgPSB7fSkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzZWxlY3RvciA9IHt9O1xuICAgIH1cblxuICAgIC8vIE5PVEU6IGJ5IHNldHRpbmcgbGltaXQgMSBoZXJlLCB3ZSBlbmQgdXAgdXNpbmcgdmVyeSBpbmVmZmljaWVudFxuICAgIC8vIGNvZGUgdGhhdCByZWNvbXB1dGVzIHRoZSB3aG9sZSBxdWVyeSBvbiBlYWNoIHVwZGF0ZS4gVGhlIHVwc2lkZSBpc1xuICAgIC8vIHRoYXQgd2hlbiB5b3UgcmVhY3RpdmVseSBkZXBlbmQgb24gYSBmaW5kT25lIHlvdSBvbmx5IGdldFxuICAgIC8vIGludmFsaWRhdGVkIHdoZW4gdGhlIGZvdW5kIG9iamVjdCBjaGFuZ2VzLCBub3QgYW55IG9iamVjdCBpbiB0aGVcbiAgICAvLyBjb2xsZWN0aW9uLiBNb3N0IGZpbmRPbmUgd2lsbCBiZSBieSBpZCwgd2hpY2ggaGFzIGEgZmFzdCBwYXRoLCBzb1xuICAgIC8vIHRoaXMgbWlnaHQgbm90IGJlIGEgYmlnIGRlYWwuIEluIG1vc3QgY2FzZXMsIGludmFsaWRhdGlvbiBjYXVzZXNcbiAgICAvLyB0aGUgY2FsbGVkIHRvIHJlLXF1ZXJ5IGFueXdheSwgc28gdGhpcyBzaG91bGQgYmUgYSBuZXQgcGVyZm9ybWFuY2VcbiAgICAvLyBpbXByb3ZlbWVudC5cbiAgICBvcHRpb25zLmxpbWl0ID0gMTtcblxuICAgIHJldHVybiB0aGlzLmZpbmQoc2VsZWN0b3IsIG9wdGlvbnMpLmZldGNoKClbMF07XG4gIH1cbiAgYXN5bmMgZmluZE9uZUFzeW5jKHNlbGVjdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgc2VsZWN0b3IgPSB7fTtcbiAgICB9XG4gICAgb3B0aW9ucy5saW1pdCA9IDE7XG4gICAgcmV0dXJuIChhd2FpdCB0aGlzLmZpbmQoc2VsZWN0b3IsIG9wdGlvbnMpLmZldGNoQXN5bmMoKSlbMF07XG4gIH1cbiAgcHJlcGFyZUluc2VydChkb2MpIHtcbiAgICBhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXMoZG9jKTtcblxuICAgIC8vIGlmIHlvdSByZWFsbHkgd2FudCB0byB1c2UgT2JqZWN0SURzLCBzZXQgdGhpcyBnbG9iYWwuXG4gICAgLy8gTW9uZ28uQ29sbGVjdGlvbiBzcGVjaWZpZXMgaXRzIG93biBpZHMgYW5kIGRvZXMgbm90IHVzZSB0aGlzIGNvZGUuXG4gICAgaWYgKCFoYXNPd24uY2FsbChkb2MsICdfaWQnKSkge1xuICAgICAgZG9jLl9pZCA9IExvY2FsQ29sbGVjdGlvbi5fdXNlT0lEID8gbmV3IE1vbmdvSUQuT2JqZWN0SUQoKSA6IFJhbmRvbS5pZCgpO1xuICAgIH1cblxuICAgIGNvbnN0IGlkID0gZG9jLl9pZDtcblxuICAgIGlmICh0aGlzLl9kb2NzLmhhcyhpZCkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKGBEdXBsaWNhdGUgX2lkICcke2lkfSdgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zYXZlT3JpZ2luYWwoaWQsIHVuZGVmaW5lZCk7XG4gICAgdGhpcy5fZG9jcy5zZXQoaWQsIGRvYyk7XG5cbiAgICByZXR1cm4gaWQ7XG4gIH1cblxuICAvLyBYWFggcG9zc2libHkgZW5mb3JjZSB0aGF0ICd1bmRlZmluZWQnIGRvZXMgbm90IGFwcGVhciAod2UgYXNzdW1lXG4gIC8vIHRoaXMgaW4gb3VyIGhhbmRsaW5nIG9mIG51bGwgYW5kICRleGlzdHMpXG4gIGluc2VydChkb2MsIGNhbGxiYWNrKSB7XG4gICAgZG9jID0gRUpTT04uY2xvbmUoZG9jKTtcbiAgICBjb25zdCBpZCA9IHRoaXMucHJlcGFyZUluc2VydChkb2MpO1xuICAgIGNvbnN0IHF1ZXJpZXNUb1JlY29tcHV0ZSA9IFtdO1xuXG4gICAgLy8gdHJpZ2dlciBsaXZlIHF1ZXJpZXMgdGhhdCBtYXRjaFxuICAgIGZvciAoY29uc3QgcWlkIG9mIE9iamVjdC5rZXlzKHRoaXMucXVlcmllcykpIHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeS5kaXJ0eSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbWF0Y2hSZXN1bHQgPSBxdWVyeS5tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhkb2MpO1xuXG4gICAgICBpZiAobWF0Y2hSZXN1bHQucmVzdWx0KSB7XG4gICAgICAgIGlmIChxdWVyeS5kaXN0YW5jZXMgJiYgbWF0Y2hSZXN1bHQuZGlzdGFuY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHF1ZXJ5LmRpc3RhbmNlcy5zZXQoaWQsIG1hdGNoUmVzdWx0LmRpc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChxdWVyeS5jdXJzb3Iuc2tpcCB8fCBxdWVyeS5jdXJzb3IubGltaXQpIHtcbiAgICAgICAgICBxdWVyaWVzVG9SZWNvbXB1dGUucHVzaChxaWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5SZXN1bHRzU3luYyhxdWVyeSwgZG9jKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBpZiAodGhpcy5xdWVyaWVzW3FpZF0pIHtcbiAgICAgICAgdGhpcy5fcmVjb21wdXRlUmVzdWx0cyh0aGlzLnF1ZXJpZXNbcWlkXSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGlkKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBpZDtcbiAgfVxuICBhc3luYyBpbnNlcnRBc3luYyhkb2MsIGNhbGxiYWNrKSB7XG4gICAgZG9jID0gRUpTT04uY2xvbmUoZG9jKTtcbiAgICBjb25zdCBpZCA9IHRoaXMucHJlcGFyZUluc2VydChkb2MpO1xuICAgIGNvbnN0IHF1ZXJpZXNUb1JlY29tcHV0ZSA9IFtdO1xuXG4gICAgLy8gdHJpZ2dlciBsaXZlIHF1ZXJpZXMgdGhhdCBtYXRjaFxuICAgIGZvciAoY29uc3QgcWlkIGluIHRoaXMucXVlcmllcykge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBtYXRjaFJlc3VsdCA9IHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG5cbiAgICAgIGlmIChtYXRjaFJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgaWYgKHF1ZXJ5LmRpc3RhbmNlcyAmJiBtYXRjaFJlc3VsdC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcXVlcnkuZGlzdGFuY2VzLnNldChpZCwgbWF0Y2hSZXN1bHQuZGlzdGFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5wdXNoKHFpZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXdhaXQgTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblJlc3VsdHNBc3luYyhxdWVyeSwgZG9jKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBpZiAodGhpcy5xdWVyaWVzW3FpZF0pIHtcbiAgICAgICAgdGhpcy5fcmVjb21wdXRlUmVzdWx0cyh0aGlzLnF1ZXJpZXNbcWlkXSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGlkKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIC8vIFBhdXNlIHRoZSBvYnNlcnZlcnMuIE5vIGNhbGxiYWNrcyBmcm9tIG9ic2VydmVycyB3aWxsIGZpcmUgdW50aWxcbiAgLy8gJ3Jlc3VtZU9ic2VydmVycycgaXMgY2FsbGVkLlxuICBwYXVzZU9ic2VydmVycygpIHtcbiAgICAvLyBOby1vcCBpZiBhbHJlYWR5IHBhdXNlZC5cbiAgICBpZiAodGhpcy5wYXVzZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTZXQgdGhlICdwYXVzZWQnIGZsYWcgc3VjaCB0aGF0IG5ldyBvYnNlcnZlciBtZXNzYWdlcyBkb24ndCBmaXJlLlxuICAgIHRoaXMucGF1c2VkID0gdHJ1ZTtcblxuICAgIC8vIFRha2UgYSBzbmFwc2hvdCBvZiB0aGUgcXVlcnkgcmVzdWx0cyBmb3IgZWFjaCBxdWVyeS5cbiAgICBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG4gICAgICBxdWVyeS5yZXN1bHRzU25hcHNob3QgPSBFSlNPTi5jbG9uZShxdWVyeS5yZXN1bHRzKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNsZWFyUmVzdWx0UXVlcmllcyhjYWxsYmFjaykge1xuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2RvY3Muc2l6ZSgpO1xuXG4gICAgdGhpcy5fZG9jcy5jbGVhcigpO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkub3JkZXJlZCkge1xuICAgICAgICBxdWVyeS5yZXN1bHRzID0gW107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBxdWVyeS5yZXN1bHRzLmNsZWFyKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cblxuICBwcmVwYXJlUmVtb3ZlKHNlbGVjdG9yKSB7XG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihzZWxlY3Rvcik7XG4gICAgY29uc3QgcmVtb3ZlID0gW107XG5cbiAgICB0aGlzLl9lYWNoUG9zc2libHlNYXRjaGluZ0RvY1N5bmMoc2VsZWN0b3IsIChkb2MsIGlkKSA9PiB7XG4gICAgICBpZiAobWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKS5yZXN1bHQpIHtcbiAgICAgICAgcmVtb3ZlLnB1c2goaWQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgcXVlcmllc1RvUmVjb21wdXRlID0gW107XG4gICAgY29uc3QgcXVlcnlSZW1vdmUgPSBbXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVtb3ZlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCByZW1vdmVJZCA9IHJlbW92ZVtpXTtcbiAgICAgIGNvbnN0IHJlbW92ZURvYyA9IHRoaXMuX2RvY3MuZ2V0KHJlbW92ZUlkKTtcblxuICAgICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKHJlbW92ZURvYykucmVzdWx0KSB7XG4gICAgICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAgICAgcXVlcmllc1RvUmVjb21wdXRlLnB1c2gocWlkKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcXVlcnlSZW1vdmUucHVzaCh7cWlkLCBkb2M6IHJlbW92ZURvY30pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX3NhdmVPcmlnaW5hbChyZW1vdmVJZCwgcmVtb3ZlRG9jKTtcbiAgICAgIHRoaXMuX2RvY3MucmVtb3ZlKHJlbW92ZUlkKTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBxdWVyaWVzVG9SZWNvbXB1dGUsIHF1ZXJ5UmVtb3ZlLCByZW1vdmUgfTtcbiAgfVxuXG4gIHJlbW92ZShzZWxlY3RvciwgY2FsbGJhY2spIHtcbiAgICAvLyBFYXN5IHNwZWNpYWwgY2FzZTogaWYgd2UncmUgbm90IGNhbGxpbmcgb2JzZXJ2ZUNoYW5nZXMgY2FsbGJhY2tzIGFuZFxuICAgIC8vIHdlJ3JlIG5vdCBzYXZpbmcgb3JpZ2luYWxzIGFuZCB3ZSBnb3QgYXNrZWQgdG8gcmVtb3ZlIGV2ZXJ5dGhpbmcsIHRoZW5cbiAgICAvLyBqdXN0IGVtcHR5IGV2ZXJ5dGhpbmcgZGlyZWN0bHkuXG4gICAgaWYgKHRoaXMucGF1c2VkICYmICF0aGlzLl9zYXZlZE9yaWdpbmFscyAmJiBFSlNPTi5lcXVhbHMoc2VsZWN0b3IsIHt9KSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2xlYXJSZXN1bHRRdWVyaWVzKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHF1ZXJpZXNUb1JlY29tcHV0ZSwgcXVlcnlSZW1vdmUsIHJlbW92ZSB9ID0gdGhpcy5wcmVwYXJlUmVtb3ZlKHNlbGVjdG9yKTtcblxuICAgIC8vIHJ1biBsaXZlIHF1ZXJ5IGNhbGxiYWNrcyBfYWZ0ZXJfIHdlJ3ZlIHJlbW92ZWQgdGhlIGRvY3VtZW50cy5cbiAgICBxdWVyeVJlbW92ZS5mb3JFYWNoKHJlbW92ZSA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1tyZW1vdmUucWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgIHF1ZXJ5LmRpc3RhbmNlcyAmJiBxdWVyeS5kaXN0YW5jZXMucmVtb3ZlKHJlbW92ZS5kb2MuX2lkKTtcbiAgICAgICAgTG9jYWxDb2xsZWN0aW9uLl9yZW1vdmVGcm9tUmVzdWx0c1N5bmMocXVlcnksIHJlbW92ZS5kb2MpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcXVlcmllc1RvUmVjb21wdXRlLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gcmVtb3ZlLmxlbmd0aDtcblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgTWV0ZW9yLmRlZmVyKCgpID0+IHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBhc3luYyByZW1vdmVBc3luYyhzZWxlY3RvciwgY2FsbGJhY2spIHtcbiAgICAvLyBFYXN5IHNwZWNpYWwgY2FzZTogaWYgd2UncmUgbm90IGNhbGxpbmcgb2JzZXJ2ZUNoYW5nZXMgY2FsbGJhY2tzIGFuZFxuICAgIC8vIHdlJ3JlIG5vdCBzYXZpbmcgb3JpZ2luYWxzIGFuZCB3ZSBnb3QgYXNrZWQgdG8gcmVtb3ZlIGV2ZXJ5dGhpbmcsIHRoZW5cbiAgICAvLyBqdXN0IGVtcHR5IGV2ZXJ5dGhpbmcgZGlyZWN0bHkuXG4gICAgaWYgKHRoaXMucGF1c2VkICYmICF0aGlzLl9zYXZlZE9yaWdpbmFscyAmJiBFSlNPTi5lcXVhbHMoc2VsZWN0b3IsIHt9KSkge1xuICAgICAgcmV0dXJuIHRoaXMuY2xlYXJSZXN1bHRRdWVyaWVzKGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBjb25zdCB7IHF1ZXJpZXNUb1JlY29tcHV0ZSwgcXVlcnlSZW1vdmUsIHJlbW92ZSB9ID0gdGhpcy5wcmVwYXJlUmVtb3ZlKHNlbGVjdG9yKTtcblxuICAgIC8vIHJ1biBsaXZlIHF1ZXJ5IGNhbGxiYWNrcyBfYWZ0ZXJfIHdlJ3ZlIHJlbW92ZWQgdGhlIGRvY3VtZW50cy5cbiAgICBmb3IgKGNvbnN0IHJlbW92ZSBvZiBxdWVyeVJlbW92ZSkge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcmVtb3ZlLnFpZF07XG5cbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICBxdWVyeS5kaXN0YW5jZXMgJiYgcXVlcnkuZGlzdGFuY2VzLnJlbW92ZShyZW1vdmUuZG9jLl9pZCk7XG4gICAgICAgIGF3YWl0IExvY2FsQ29sbGVjdGlvbi5fcmVtb3ZlRnJvbVJlc3VsdHNBc3luYyhxdWVyeSwgcmVtb3ZlLmRvYyk7XG4gICAgICB9XG4gICAgfVxuICAgIHF1ZXJpZXNUb1JlY29tcHV0ZS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgdGhpcy5fcmVjb21wdXRlUmVzdWx0cyhxdWVyeSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IHJlbW92ZS5sZW5ndGg7XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gUmVzdW1lIHRoZSBvYnNlcnZlcnMuIE9ic2VydmVycyBpbW1lZGlhdGVseSByZWNlaXZlIGNoYW5nZVxuICAvLyBub3RpZmljYXRpb25zIHRvIGJyaW5nIHRoZW0gdG8gdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlXG4gIC8vIGRhdGFiYXNlLiBOb3RlIHRoYXQgdGhpcyBpcyBub3QganVzdCByZXBsYXlpbmcgYWxsIHRoZSBjaGFuZ2VzIHRoYXRcbiAgLy8gaGFwcGVuZWQgZHVyaW5nIHRoZSBwYXVzZSwgaXQgaXMgYSBzbWFydGVyICdjb2FsZXNjZWQnIGRpZmYuXG4gIF9yZXN1bWVPYnNlcnZlcnMoKSB7XG4gICAgLy8gTm8tb3AgaWYgbm90IHBhdXNlZC5cbiAgICBpZiAoIXRoaXMucGF1c2VkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVW5zZXQgdGhlICdwYXVzZWQnIGZsYWcuIE1ha2Ugc3VyZSB0byBkbyB0aGlzIGZpcnN0LCBvdGhlcndpc2VcbiAgICAvLyBvYnNlcnZlciBtZXRob2RzIHdvbid0IGFjdHVhbGx5IGZpcmUgd2hlbiB3ZSB0cmlnZ2VyIHRoZW0uXG4gICAgdGhpcy5wYXVzZWQgPSBmYWxzZTtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMucXVlcmllcykuZm9yRWFjaChxaWQgPT4ge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5LmRpcnR5KSB7XG4gICAgICAgIHF1ZXJ5LmRpcnR5ID0gZmFsc2U7XG5cbiAgICAgICAgLy8gcmUtY29tcHV0ZSByZXN1bHRzIHdpbGwgcGVyZm9ybSBgTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlDaGFuZ2VzYFxuICAgICAgICAvLyBhdXRvbWF0aWNhbGx5LlxuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5LCBxdWVyeS5yZXN1bHRzU25hcHNob3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRGlmZiB0aGUgY3VycmVudCByZXN1bHRzIGFnYWluc3QgdGhlIHNuYXBzaG90IGFuZCBzZW5kIHRvIG9ic2VydmVycy5cbiAgICAgICAgLy8gcGFzcyB0aGUgcXVlcnkgb2JqZWN0IGZvciBpdHMgb2JzZXJ2ZXIgY2FsbGJhY2tzLlxuICAgICAgICBMb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeUNoYW5nZXMoXG4gICAgICAgICAgcXVlcnkub3JkZXJlZCxcbiAgICAgICAgICBxdWVyeS5yZXN1bHRzU25hcHNob3QsXG4gICAgICAgICAgcXVlcnkucmVzdWx0cyxcbiAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICB7cHJvamVjdGlvbkZuOiBxdWVyeS5wcm9qZWN0aW9uRm59XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHF1ZXJ5LnJlc3VsdHNTbmFwc2hvdCA9IG51bGw7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyByZXN1bWVPYnNlcnZlcnNTZXJ2ZXIoKSB7XG4gICAgdGhpcy5fcmVzdW1lT2JzZXJ2ZXJzKCk7XG4gICAgYXdhaXQgdGhpcy5fb2JzZXJ2ZVF1ZXVlLmRyYWluKCk7XG4gIH1cbiAgcmVzdW1lT2JzZXJ2ZXJzQ2xpZW50KCkge1xuICAgIHRoaXMuX3Jlc3VtZU9ic2VydmVycygpO1xuICAgIHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuICB9XG5cbiAgcmV0cmlldmVPcmlnaW5hbHMoKSB7XG4gICAgaWYgKCF0aGlzLl9zYXZlZE9yaWdpbmFscykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYWxsZWQgcmV0cmlldmVPcmlnaW5hbHMgd2l0aG91dCBzYXZlT3JpZ2luYWxzJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3JpZ2luYWxzID0gdGhpcy5fc2F2ZWRPcmlnaW5hbHM7XG5cbiAgICB0aGlzLl9zYXZlZE9yaWdpbmFscyA9IG51bGw7XG5cbiAgICByZXR1cm4gb3JpZ2luYWxzO1xuICB9XG5cbiAgLy8gVG8gdHJhY2sgd2hhdCBkb2N1bWVudHMgYXJlIGFmZmVjdGVkIGJ5IGEgcGllY2Ugb2YgY29kZSwgY2FsbFxuICAvLyBzYXZlT3JpZ2luYWxzKCkgYmVmb3JlIGl0IGFuZCByZXRyaWV2ZU9yaWdpbmFscygpIGFmdGVyIGl0LlxuICAvLyByZXRyaWV2ZU9yaWdpbmFscyByZXR1cm5zIGFuIG9iamVjdCB3aG9zZSBrZXlzIGFyZSB0aGUgaWRzIG9mIHRoZSBkb2N1bWVudHNcbiAgLy8gdGhhdCB3ZXJlIGFmZmVjdGVkIHNpbmNlIHRoZSBjYWxsIHRvIHNhdmVPcmlnaW5hbHMoKSwgYW5kIHRoZSB2YWx1ZXMgYXJlXG4gIC8vIGVxdWFsIHRvIHRoZSBkb2N1bWVudCdzIGNvbnRlbnRzIGF0IHRoZSB0aW1lIG9mIHNhdmVPcmlnaW5hbHMuIChJbiB0aGUgY2FzZVxuICAvLyBvZiBhbiBpbnNlcnRlZCBkb2N1bWVudCwgdW5kZWZpbmVkIGlzIHRoZSB2YWx1ZS4pIFlvdSBtdXN0IGFsdGVybmF0ZVxuICAvLyBiZXR3ZWVuIGNhbGxzIHRvIHNhdmVPcmlnaW5hbHMoKSBhbmQgcmV0cmlldmVPcmlnaW5hbHMoKS5cbiAgc2F2ZU9yaWdpbmFscygpIHtcbiAgICBpZiAodGhpcy5fc2F2ZWRPcmlnaW5hbHMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FsbGVkIHNhdmVPcmlnaW5hbHMgdHdpY2Ugd2l0aG91dCByZXRyaWV2ZU9yaWdpbmFscycpO1xuICAgIH1cblxuICAgIHRoaXMuX3NhdmVkT3JpZ2luYWxzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIH1cblxuICBwcmVwYXJlVXBkYXRlKHNlbGVjdG9yKSB7XG4gICAgLy8gU2F2ZSB0aGUgb3JpZ2luYWwgcmVzdWx0cyBvZiBhbnkgcXVlcnkgdGhhdCB3ZSBtaWdodCBuZWVkIHRvXG4gICAgLy8gX3JlY29tcHV0ZVJlc3VsdHMgb24sIGJlY2F1c2UgX21vZGlmeUFuZE5vdGlmeSB3aWxsIG11dGF0ZSB0aGUgb2JqZWN0cyBpblxuICAgIC8vIGl0LiAoV2UgZG9uJ3QgbmVlZCB0byBzYXZlIHRoZSBvcmlnaW5hbCByZXN1bHRzIG9mIHBhdXNlZCBxdWVyaWVzIGJlY2F1c2VcbiAgICAvLyB0aGV5IGFscmVhZHkgaGF2ZSBhIHJlc3VsdHNTbmFwc2hvdCBhbmQgd2Ugd29uJ3QgYmUgZGlmZmluZyBpblxuICAgIC8vIF9yZWNvbXB1dGVSZXN1bHRzLilcbiAgICBjb25zdCBxaWRUb09yaWdpbmFsUmVzdWx0cyA9IHt9O1xuXG4gICAgLy8gV2Ugc2hvdWxkIG9ubHkgY2xvbmUgZWFjaCBkb2N1bWVudCBvbmNlLCBldmVuIGlmIGl0IGFwcGVhcnMgaW4gbXVsdGlwbGVcbiAgICAvLyBxdWVyaWVzXG4gICAgY29uc3QgZG9jTWFwID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgY29uc3QgaWRzTWF0Y2hlZCA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAoKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkgJiYgISB0aGlzLnBhdXNlZCkge1xuICAgICAgICAvLyBDYXRjaCB0aGUgY2FzZSBvZiBhIHJlYWN0aXZlIGBjb3VudCgpYCBvbiBhIGN1cnNvciB3aXRoIHNraXBcbiAgICAgICAgLy8gb3IgbGltaXQsIHdoaWNoIHJlZ2lzdGVycyBhbiB1bm9yZGVyZWQgb2JzZXJ2ZS4gVGhpcyBpcyBhXG4gICAgICAgIC8vIHByZXR0eSByYXJlIGNhc2UsIHNvIHdlIGp1c3QgY2xvbmUgdGhlIGVudGlyZSByZXN1bHQgc2V0IHdpdGhcbiAgICAgICAgLy8gbm8gb3B0aW1pemF0aW9ucyBmb3IgZG9jdW1lbnRzIHRoYXQgYXBwZWFyIGluIHRoZXNlIHJlc3VsdFxuICAgICAgICAvLyBzZXRzIGFuZCBvdGhlciBxdWVyaWVzLlxuICAgICAgICBpZiAocXVlcnkucmVzdWx0cyBpbnN0YW5jZW9mIExvY2FsQ29sbGVjdGlvbi5fSWRNYXApIHtcbiAgICAgICAgICBxaWRUb09yaWdpbmFsUmVzdWx0c1txaWRdID0gcXVlcnkucmVzdWx0cy5jbG9uZSgpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghKHF1ZXJ5LnJlc3VsdHMgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Fzc2VydGlvbiBmYWlsZWQ6IHF1ZXJ5LnJlc3VsdHMgbm90IGFuIGFycmF5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDbG9uZXMgYSBkb2N1bWVudCB0byBiZSBzdG9yZWQgaW4gYHFpZFRvT3JpZ2luYWxSZXN1bHRzYFxuICAgICAgICAvLyBiZWNhdXNlIGl0IG1heSBiZSBtb2RpZmllZCBiZWZvcmUgdGhlIG5ldyBhbmQgb2xkIHJlc3VsdCBzZXRzXG4gICAgICAgIC8vIGFyZSBkaWZmZWQuIEJ1dCBpZiB3ZSBrbm93IGV4YWN0bHkgd2hpY2ggZG9jdW1lbnQgSURzIHdlJ3JlXG4gICAgICAgIC8vIGdvaW5nIHRvIG1vZGlmeSwgdGhlbiB3ZSBvbmx5IG5lZWQgdG8gY2xvbmUgdGhvc2UuXG4gICAgICAgIGNvbnN0IG1lbW9pemVkQ2xvbmVJZk5lZWRlZCA9IGRvYyA9PiB7XG4gICAgICAgICAgaWYgKGRvY01hcC5oYXMoZG9jLl9pZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBkb2NNYXAuZ2V0KGRvYy5faWQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGRvY1RvTWVtb2l6ZSA9IChcbiAgICAgICAgICAgIGlkc01hdGNoZWQgJiZcbiAgICAgICAgICAgICFpZHNNYXRjaGVkLnNvbWUoaWQgPT4gRUpTT04uZXF1YWxzKGlkLCBkb2MuX2lkKSlcbiAgICAgICAgICApID8gZG9jIDogRUpTT04uY2xvbmUoZG9jKTtcblxuICAgICAgICAgIGRvY01hcC5zZXQoZG9jLl9pZCwgZG9jVG9NZW1vaXplKTtcblxuICAgICAgICAgIHJldHVybiBkb2NUb01lbW9pemU7XG4gICAgICAgIH07XG5cbiAgICAgICAgcWlkVG9PcmlnaW5hbFJlc3VsdHNbcWlkXSA9IHF1ZXJ5LnJlc3VsdHMubWFwKG1lbW9pemVkQ2xvbmVJZk5lZWRlZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcWlkVG9PcmlnaW5hbFJlc3VsdHM7XG4gIH1cblxuICBmaW5pc2hVcGRhdGUoeyBvcHRpb25zLCB1cGRhdGVDb3VudCwgY2FsbGJhY2ssIGluc2VydGVkSWQgfSkge1xuXG5cbiAgICAvLyBSZXR1cm4gdGhlIG51bWJlciBvZiBhZmZlY3RlZCBkb2N1bWVudHMsIG9yIGluIHRoZSB1cHNlcnQgY2FzZSwgYW4gb2JqZWN0XG4gICAgLy8gY29udGFpbmluZyB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIGRvY3MgYW5kIHRoZSBpZCBvZiB0aGUgZG9jIHRoYXQgd2FzXG4gICAgLy8gaW5zZXJ0ZWQsIGlmIGFueS5cbiAgICBsZXQgcmVzdWx0O1xuICAgIGlmIChvcHRpb25zLl9yZXR1cm5PYmplY3QpIHtcbiAgICAgIHJlc3VsdCA9IHsgbnVtYmVyQWZmZWN0ZWQ6IHVwZGF0ZUNvdW50IH07XG5cbiAgICAgIGlmIChpbnNlcnRlZElkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVzdWx0Lmluc2VydGVkSWQgPSBpbnNlcnRlZElkO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSB1cGRhdGVDb3VudDtcbiAgICB9XG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIE1ldGVvci5kZWZlcigoKSA9PiB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gWFhYIGF0b21pY2l0eTogaWYgbXVsdGkgaXMgdHJ1ZSwgYW5kIG9uZSBtb2RpZmljYXRpb24gZmFpbHMsIGRvXG4gIC8vIHdlIHJvbGxiYWNrIHRoZSB3aG9sZSBvcGVyYXRpb24sIG9yIHdoYXQ/XG4gIGFzeW5jIHVwZGF0ZUFzeW5jKHNlbGVjdG9yLCBtb2QsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCEgY2FsbGJhY2sgJiYgb3B0aW9ucyBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICBvcHRpb25zID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9XG5cbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHNlbGVjdG9yLCB0cnVlKTtcblxuICAgIGNvbnN0IHFpZFRvT3JpZ2luYWxSZXN1bHRzID0gdGhpcy5wcmVwYXJlVXBkYXRlKHNlbGVjdG9yKTtcblxuICAgIGxldCByZWNvbXB1dGVRaWRzID0ge307XG5cbiAgICBsZXQgdXBkYXRlQ291bnQgPSAwO1xuXG4gICAgYXdhaXQgdGhpcy5fZWFjaFBvc3NpYmx5TWF0Y2hpbmdEb2NBc3luYyhzZWxlY3RvciwgYXN5bmMgKGRvYywgaWQpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5UmVzdWx0ID0gbWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKTtcblxuICAgICAgaWYgKHF1ZXJ5UmVzdWx0LnJlc3VsdCkge1xuICAgICAgICAvLyBYWFggU2hvdWxkIHdlIHNhdmUgdGhlIG9yaWdpbmFsIGV2ZW4gaWYgbW9kIGVuZHMgdXAgYmVpbmcgYSBuby1vcD9cbiAgICAgICAgdGhpcy5fc2F2ZU9yaWdpbmFsKGlkLCBkb2MpO1xuICAgICAgICByZWNvbXB1dGVRaWRzID0gYXdhaXQgdGhpcy5fbW9kaWZ5QW5kTm90aWZ5QXN5bmMoXG4gICAgICAgICAgZG9jLFxuICAgICAgICAgIG1vZCxcbiAgICAgICAgICBxdWVyeVJlc3VsdC5hcnJheUluZGljZXNcbiAgICAgICAgKTtcblxuICAgICAgICArK3VwZGF0ZUNvdW50O1xuXG4gICAgICAgIGlmICghb3B0aW9ucy5tdWx0aSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIE9iamVjdC5rZXlzKHJlY29tcHV0ZVFpZHMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5LCBxaWRUb09yaWdpbmFsUmVzdWx0c1txaWRdKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuXG4gICAgLy8gSWYgd2UgYXJlIGRvaW5nIGFuIHVwc2VydCwgYW5kIHdlIGRpZG4ndCBtb2RpZnkgYW55IGRvY3VtZW50cyB5ZXQsIHRoZW5cbiAgICAvLyBpdCdzIHRpbWUgdG8gZG8gYW4gaW5zZXJ0LiBGaWd1cmUgb3V0IHdoYXQgZG9jdW1lbnQgd2UgYXJlIGluc2VydGluZywgYW5kXG4gICAgLy8gZ2VuZXJhdGUgYW4gaWQgZm9yIGl0LlxuICAgIGxldCBpbnNlcnRlZElkO1xuICAgIGlmICh1cGRhdGVDb3VudCA9PT0gMCAmJiBvcHRpb25zLnVwc2VydCkge1xuICAgICAgY29uc3QgZG9jID0gTG9jYWxDb2xsZWN0aW9uLl9jcmVhdGVVcHNlcnREb2N1bWVudChzZWxlY3RvciwgbW9kKTtcbiAgICAgIGlmICghZG9jLl9pZCAmJiBvcHRpb25zLmluc2VydGVkSWQpIHtcbiAgICAgICAgZG9jLl9pZCA9IG9wdGlvbnMuaW5zZXJ0ZWRJZDtcbiAgICAgIH1cblxuICAgICAgaW5zZXJ0ZWRJZCA9IGF3YWl0IHRoaXMuaW5zZXJ0QXN5bmMoZG9jKTtcbiAgICAgIHVwZGF0ZUNvdW50ID0gMTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hVcGRhdGUoe1xuICAgICAgb3B0aW9ucyxcbiAgICAgIGluc2VydGVkSWQsXG4gICAgICB1cGRhdGVDb3VudCxcbiAgICAgIGNhbGxiYWNrLFxuICAgIH0pO1xuICB9XG4gIC8vIFhYWCBhdG9taWNpdHk6IGlmIG11bHRpIGlzIHRydWUsIGFuZCBvbmUgbW9kaWZpY2F0aW9uIGZhaWxzLCBkb1xuICAvLyB3ZSByb2xsYmFjayB0aGUgd2hvbGUgb3BlcmF0aW9uLCBvciB3aGF0P1xuICB1cGRhdGUoc2VsZWN0b3IsIG1vZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoISBjYWxsYmFjayAmJiBvcHRpb25zIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSBudWxsO1xuICAgIH1cblxuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoc2VsZWN0b3IsIHRydWUpO1xuXG4gICAgY29uc3QgcWlkVG9PcmlnaW5hbFJlc3VsdHMgPSB0aGlzLnByZXBhcmVVcGRhdGUoc2VsZWN0b3IpO1xuXG4gICAgbGV0IHJlY29tcHV0ZVFpZHMgPSB7fTtcblxuICAgIGxldCB1cGRhdGVDb3VudCA9IDA7XG5cbiAgICB0aGlzLl9lYWNoUG9zc2libHlNYXRjaGluZ0RvY1N5bmMoc2VsZWN0b3IsIChkb2MsIGlkKSA9PiB7XG4gICAgICBjb25zdCBxdWVyeVJlc3VsdCA9IG1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG5cbiAgICAgIGlmIChxdWVyeVJlc3VsdC5yZXN1bHQpIHtcbiAgICAgICAgLy8gWFhYIFNob3VsZCB3ZSBzYXZlIHRoZSBvcmlnaW5hbCBldmVuIGlmIG1vZCBlbmRzIHVwIGJlaW5nIGEgbm8tb3A/XG4gICAgICAgIHRoaXMuX3NhdmVPcmlnaW5hbChpZCwgZG9jKTtcbiAgICAgICAgcmVjb21wdXRlUWlkcyA9IHRoaXMuX21vZGlmeUFuZE5vdGlmeVN5bmMoXG4gICAgICAgICAgZG9jLFxuICAgICAgICAgIG1vZCxcbiAgICAgICAgICBxdWVyeVJlc3VsdC5hcnJheUluZGljZXNcbiAgICAgICAgKTtcblxuICAgICAgICArK3VwZGF0ZUNvdW50O1xuXG4gICAgICAgIGlmICghb3B0aW9ucy5tdWx0aSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIE9iamVjdC5rZXlzKHJlY29tcHV0ZVFpZHMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG4gICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgdGhpcy5fcmVjb21wdXRlUmVzdWx0cyhxdWVyeSwgcWlkVG9PcmlnaW5hbFJlc3VsdHNbcWlkXSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcblxuXG4gICAgLy8gSWYgd2UgYXJlIGRvaW5nIGFuIHVwc2VydCwgYW5kIHdlIGRpZG4ndCBtb2RpZnkgYW55IGRvY3VtZW50cyB5ZXQsIHRoZW5cbiAgICAvLyBpdCdzIHRpbWUgdG8gZG8gYW4gaW5zZXJ0LiBGaWd1cmUgb3V0IHdoYXQgZG9jdW1lbnQgd2UgYXJlIGluc2VydGluZywgYW5kXG4gICAgLy8gZ2VuZXJhdGUgYW4gaWQgZm9yIGl0LlxuICAgIGxldCBpbnNlcnRlZElkO1xuICAgIGlmICh1cGRhdGVDb3VudCA9PT0gMCAmJiBvcHRpb25zLnVwc2VydCkge1xuICAgICAgY29uc3QgZG9jID0gTG9jYWxDb2xsZWN0aW9uLl9jcmVhdGVVcHNlcnREb2N1bWVudChzZWxlY3RvciwgbW9kKTtcbiAgICAgIGlmICghZG9jLl9pZCAmJiBvcHRpb25zLmluc2VydGVkSWQpIHtcbiAgICAgICAgZG9jLl9pZCA9IG9wdGlvbnMuaW5zZXJ0ZWRJZDtcbiAgICAgIH1cblxuICAgICAgaW5zZXJ0ZWRJZCA9IHRoaXMuaW5zZXJ0KGRvYyk7XG4gICAgICB1cGRhdGVDb3VudCA9IDE7XG4gICAgfVxuXG5cbiAgICByZXR1cm4gdGhpcy5maW5pc2hVcGRhdGUoe1xuICAgICAgb3B0aW9ucyxcbiAgICAgIGluc2VydGVkSWQsXG4gICAgICB1cGRhdGVDb3VudCxcbiAgICAgIGNhbGxiYWNrLFxuICAgICAgc2VsZWN0b3IsXG4gICAgICBtb2QsXG4gICAgfSk7XG4gIH1cblxuICAvLyBBIGNvbnZlbmllbmNlIHdyYXBwZXIgb24gdXBkYXRlLiBMb2NhbENvbGxlY3Rpb24udXBzZXJ0KHNlbCwgbW9kKSBpc1xuICAvLyBlcXVpdmFsZW50IHRvIExvY2FsQ29sbGVjdGlvbi51cGRhdGUoc2VsLCBtb2QsIHt1cHNlcnQ6IHRydWUsXG4gIC8vIF9yZXR1cm5PYmplY3Q6IHRydWV9KS5cbiAgdXBzZXJ0KHNlbGVjdG9yLCBtb2QsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFjYWxsYmFjayAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnVwZGF0ZShcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgbW9kLFxuICAgICAgT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywge3Vwc2VydDogdHJ1ZSwgX3JldHVybk9iamVjdDogdHJ1ZX0pLFxuICAgICAgY2FsbGJhY2tcbiAgICApO1xuICB9XG5cbiAgdXBzZXJ0QXN5bmMoc2VsZWN0b3IsIG1vZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICBvcHRpb25zID0ge307XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudXBkYXRlQXN5bmMoXG4gICAgICBzZWxlY3RvcixcbiAgICAgIG1vZCxcbiAgICAgIE9iamVjdC5hc3NpZ24oe30sIG9wdGlvbnMsIHt1cHNlcnQ6IHRydWUsIF9yZXR1cm5PYmplY3Q6IHRydWV9KSxcbiAgICAgIGNhbGxiYWNrXG4gICAgKTtcbiAgfVxuXG4gIC8vIEl0ZXJhdGVzIG92ZXIgYSBzdWJzZXQgb2YgZG9jdW1lbnRzIHRoYXQgY291bGQgbWF0Y2ggc2VsZWN0b3I7IGNhbGxzXG4gIC8vIGZuKGRvYywgaWQpIG9uIGVhY2ggb2YgdGhlbS4gIFNwZWNpZmljYWxseSwgaWYgc2VsZWN0b3Igc3BlY2lmaWVzXG4gIC8vIHNwZWNpZmljIF9pZCdzLCBpdCBvbmx5IGxvb2tzIGF0IHRob3NlLiAgZG9jIGlzICpub3QqIGNsb25lZDogaXQgaXMgdGhlXG4gIC8vIHNhbWUgb2JqZWN0IHRoYXQgaXMgaW4gX2RvY3MuXG4gIGFzeW5jIF9lYWNoUG9zc2libHlNYXRjaGluZ0RvY0FzeW5jKHNlbGVjdG9yLCBmbikge1xuICAgIGNvbnN0IHNwZWNpZmljSWRzID0gTG9jYWxDb2xsZWN0aW9uLl9pZHNNYXRjaGVkQnlTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICBpZiAoc3BlY2lmaWNJZHMpIHtcbiAgICAgIGZvciAoY29uc3QgaWQgb2Ygc3BlY2lmaWNJZHMpIHtcbiAgICAgICAgY29uc3QgZG9jID0gdGhpcy5fZG9jcy5nZXQoaWQpO1xuXG4gICAgICAgIGlmIChkb2MgJiYgISAoYXdhaXQgZm4oZG9jLCBpZCkpKSB7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCB0aGlzLl9kb2NzLmZvckVhY2hBc3luYyhmbik7XG4gICAgfVxuICB9XG4gIF9lYWNoUG9zc2libHlNYXRjaGluZ0RvY1N5bmMoc2VsZWN0b3IsIGZuKSB7XG4gICAgY29uc3Qgc3BlY2lmaWNJZHMgPSBMb2NhbENvbGxlY3Rpb24uX2lkc01hdGNoZWRCeVNlbGVjdG9yKHNlbGVjdG9yKTtcblxuICAgIGlmIChzcGVjaWZpY0lkcykge1xuICAgICAgZm9yIChjb25zdCBpZCBvZiBzcGVjaWZpY0lkcykge1xuICAgICAgICBjb25zdCBkb2MgPSB0aGlzLl9kb2NzLmdldChpZCk7XG5cbiAgICAgICAgaWYgKGRvYyAmJiBmbihkb2MsIGlkKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2RvY3MuZm9yRWFjaChmbik7XG4gICAgfVxuICB9XG5cbiAgX2dldE1hdGNoZWREb2NBbmRNb2RpZnkoZG9jLCBtb2QsIGFycmF5SW5kaWNlcykge1xuICAgIGNvbnN0IG1hdGNoZWRfYmVmb3JlID0ge307XG5cbiAgICBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeS5kaXJ0eSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChxdWVyeS5vcmRlcmVkKSB7XG4gICAgICAgIG1hdGNoZWRfYmVmb3JlW3FpZF0gPSBxdWVyeS5tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhkb2MpLnJlc3VsdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJlY2F1c2Ugd2UgZG9uJ3Qgc3VwcG9ydCBza2lwIG9yIGxpbWl0ICh5ZXQpIGluIHVub3JkZXJlZCBxdWVyaWVzLCB3ZVxuICAgICAgICAvLyBjYW4ganVzdCBkbyBhIGRpcmVjdCBsb29rdXAuXG4gICAgICAgIG1hdGNoZWRfYmVmb3JlW3FpZF0gPSBxdWVyeS5yZXN1bHRzLmhhcyhkb2MuX2lkKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtYXRjaGVkX2JlZm9yZTtcbiAgfVxuXG4gIF9tb2RpZnlBbmROb3RpZnlTeW5jKGRvYywgbW9kLCBhcnJheUluZGljZXMpIHtcblxuICAgIGNvbnN0IG1hdGNoZWRfYmVmb3JlID0gdGhpcy5fZ2V0TWF0Y2hlZERvY0FuZE1vZGlmeShkb2MsIG1vZCwgYXJyYXlJbmRpY2VzKTtcblxuICAgIGNvbnN0IG9sZF9kb2MgPSBFSlNPTi5jbG9uZShkb2MpO1xuICAgIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5KGRvYywgbW9kLCB7YXJyYXlJbmRpY2VzfSk7XG5cbiAgICBjb25zdCByZWNvbXB1dGVRaWRzID0ge307XG5cbiAgICBmb3IgKGNvbnN0IHFpZCBvZiBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkuZGlydHkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGFmdGVyTWF0Y2ggPSBxdWVyeS5tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhkb2MpO1xuICAgICAgY29uc3QgYWZ0ZXIgPSBhZnRlck1hdGNoLnJlc3VsdDtcbiAgICAgIGNvbnN0IGJlZm9yZSA9IG1hdGNoZWRfYmVmb3JlW3FpZF07XG5cbiAgICAgIGlmIChhZnRlciAmJiBxdWVyeS5kaXN0YW5jZXMgJiYgYWZ0ZXJNYXRjaC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHF1ZXJ5LmRpc3RhbmNlcy5zZXQoZG9jLl9pZCwgYWZ0ZXJNYXRjaC5kaXN0YW5jZSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChxdWVyeS5jdXJzb3Iuc2tpcCB8fCBxdWVyeS5jdXJzb3IubGltaXQpIHtcbiAgICAgICAgLy8gV2UgbmVlZCB0byByZWNvbXB1dGUgYW55IHF1ZXJ5IHdoZXJlIHRoZSBkb2MgbWF5IGhhdmUgYmVlbiBpbiB0aGVcbiAgICAgICAgLy8gY3Vyc29yJ3Mgd2luZG93IGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdGhlIHVwZGF0ZS4gKE5vdGUgdGhhdCBpZiBza2lwXG4gICAgICAgIC8vIG9yIGxpbWl0IGlzIHNldCwgXCJiZWZvcmVcIiBhbmQgXCJhZnRlclwiIGJlaW5nIHRydWUgZG8gbm90IG5lY2Vzc2FyaWx5XG4gICAgICAgIC8vIG1lYW4gdGhhdCB0aGUgZG9jdW1lbnQgaXMgaW4gdGhlIGN1cnNvcidzIG91dHB1dCBhZnRlciBza2lwL2xpbWl0IGlzXG4gICAgICAgIC8vIGFwcGxpZWQuLi4gYnV0IGlmIHRoZXkgYXJlIGZhbHNlLCB0aGVuIHRoZSBkb2N1bWVudCBkZWZpbml0ZWx5IGlzIE5PVFxuICAgICAgICAvLyBpbiB0aGUgb3V0cHV0LiBTbyBpdCdzIHNhZmUgdG8gc2tpcCByZWNvbXB1dGUgaWYgbmVpdGhlciBiZWZvcmUgb3JcbiAgICAgICAgLy8gYWZ0ZXIgYXJlIHRydWUuKVxuICAgICAgICBpZiAoYmVmb3JlIHx8IGFmdGVyKSB7XG4gICAgICAgICAgcmVjb21wdXRlUWlkc1txaWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChiZWZvcmUgJiYgIWFmdGVyKSB7XG4gICAgICAgIExvY2FsQ29sbGVjdGlvbi5fcmVtb3ZlRnJvbVJlc3VsdHNTeW5jKHF1ZXJ5LCBkb2MpO1xuICAgICAgfSBlbHNlIGlmICghYmVmb3JlICYmIGFmdGVyKSB7XG4gICAgICAgIExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5SZXN1bHRzU3luYyhxdWVyeSwgZG9jKTtcbiAgICAgIH0gZWxzZSBpZiAoYmVmb3JlICYmIGFmdGVyKSB7XG4gICAgICAgIExvY2FsQ29sbGVjdGlvbi5fdXBkYXRlSW5SZXN1bHRzU3luYyhxdWVyeSwgZG9jLCBvbGRfZG9jKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlY29tcHV0ZVFpZHM7XG4gIH1cblxuICBhc3luYyBfbW9kaWZ5QW5kTm90aWZ5QXN5bmMoZG9jLCBtb2QsIGFycmF5SW5kaWNlcykge1xuXG4gICAgY29uc3QgbWF0Y2hlZF9iZWZvcmUgPSB0aGlzLl9nZXRNYXRjaGVkRG9jQW5kTW9kaWZ5KGRvYywgbW9kLCBhcnJheUluZGljZXMpO1xuXG4gICAgY29uc3Qgb2xkX2RvYyA9IEVKU09OLmNsb25lKGRvYyk7XG4gICAgTG9jYWxDb2xsZWN0aW9uLl9tb2RpZnkoZG9jLCBtb2QsIHthcnJheUluZGljZXN9KTtcblxuICAgIGNvbnN0IHJlY29tcHV0ZVFpZHMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IHFpZCBpbiB0aGlzLnF1ZXJpZXMpIHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeS5kaXJ0eSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYWZ0ZXJNYXRjaCA9IHF1ZXJ5Lm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG4gICAgICBjb25zdCBhZnRlciA9IGFmdGVyTWF0Y2gucmVzdWx0O1xuICAgICAgY29uc3QgYmVmb3JlID0gbWF0Y2hlZF9iZWZvcmVbcWlkXTtcblxuICAgICAgaWYgKGFmdGVyICYmIHF1ZXJ5LmRpc3RhbmNlcyAmJiBhZnRlck1hdGNoLmRpc3RhbmNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcXVlcnkuZGlzdGFuY2VzLnNldChkb2MuX2lkLCBhZnRlck1hdGNoLmRpc3RhbmNlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHF1ZXJ5LmN1cnNvci5za2lwIHx8IHF1ZXJ5LmN1cnNvci5saW1pdCkge1xuICAgICAgICAvLyBXZSBuZWVkIHRvIHJlY29tcHV0ZSBhbnkgcXVlcnkgd2hlcmUgdGhlIGRvYyBtYXkgaGF2ZSBiZWVuIGluIHRoZVxuICAgICAgICAvLyBjdXJzb3IncyB3aW5kb3cgZWl0aGVyIGJlZm9yZSBvciBhZnRlciB0aGUgdXBkYXRlLiAoTm90ZSB0aGF0IGlmIHNraXBcbiAgICAgICAgLy8gb3IgbGltaXQgaXMgc2V0LCBcImJlZm9yZVwiIGFuZCBcImFmdGVyXCIgYmVpbmcgdHJ1ZSBkbyBub3QgbmVjZXNzYXJpbHlcbiAgICAgICAgLy8gbWVhbiB0aGF0IHRoZSBkb2N1bWVudCBpcyBpbiB0aGUgY3Vyc29yJ3Mgb3V0cHV0IGFmdGVyIHNraXAvbGltaXQgaXNcbiAgICAgICAgLy8gYXBwbGllZC4uLiBidXQgaWYgdGhleSBhcmUgZmFsc2UsIHRoZW4gdGhlIGRvY3VtZW50IGRlZmluaXRlbHkgaXMgTk9UXG4gICAgICAgIC8vIGluIHRoZSBvdXRwdXQuIFNvIGl0J3Mgc2FmZSB0byBza2lwIHJlY29tcHV0ZSBpZiBuZWl0aGVyIGJlZm9yZSBvclxuICAgICAgICAvLyBhZnRlciBhcmUgdHJ1ZS4pXG4gICAgICAgIGlmIChiZWZvcmUgfHwgYWZ0ZXIpIHtcbiAgICAgICAgICByZWNvbXB1dGVRaWRzW3FpZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGJlZm9yZSAmJiAhYWZ0ZXIpIHtcbiAgICAgICAgYXdhaXQgTG9jYWxDb2xsZWN0aW9uLl9yZW1vdmVGcm9tUmVzdWx0c0FzeW5jKHF1ZXJ5LCBkb2MpO1xuICAgICAgfSBlbHNlIGlmICghYmVmb3JlICYmIGFmdGVyKSB7XG4gICAgICAgIGF3YWl0IExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5SZXN1bHRzQXN5bmMocXVlcnksIGRvYyk7XG4gICAgICB9IGVsc2UgaWYgKGJlZm9yZSAmJiBhZnRlcikge1xuICAgICAgICBhd2FpdCBMb2NhbENvbGxlY3Rpb24uX3VwZGF0ZUluUmVzdWx0c0FzeW5jKHF1ZXJ5LCBkb2MsIG9sZF9kb2MpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVjb21wdXRlUWlkcztcbiAgfVxuXG4gIC8vIFJlY29tcHV0ZXMgdGhlIHJlc3VsdHMgb2YgYSBxdWVyeSBhbmQgcnVucyBvYnNlcnZlIGNhbGxiYWNrcyBmb3IgdGhlXG4gIC8vIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgcHJldmlvdXMgcmVzdWx0cyBhbmQgdGhlIGN1cnJlbnQgcmVzdWx0cyAodW5sZXNzXG4gIC8vIHBhdXNlZCkuIFVzZWQgZm9yIHNraXAvbGltaXQgcXVlcmllcy5cbiAgLy9cbiAgLy8gV2hlbiB0aGlzIGlzIHVzZWQgYnkgaW5zZXJ0IG9yIHJlbW92ZSwgaXQgY2FuIGp1c3QgdXNlIHF1ZXJ5LnJlc3VsdHMgZm9yXG4gIC8vIHRoZSBvbGQgcmVzdWx0cyAoYW5kIHRoZXJlJ3Mgbm8gbmVlZCB0byBwYXNzIGluIG9sZFJlc3VsdHMpLCBiZWNhdXNlIHRoZXNlXG4gIC8vIG9wZXJhdGlvbnMgZG9uJ3QgbXV0YXRlIHRoZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24uIFVwZGF0ZSBuZWVkcyB0b1xuICAvLyBwYXNzIGluIGFuIG9sZFJlc3VsdHMgd2hpY2ggd2FzIGRlZXAtY29waWVkIGJlZm9yZSB0aGUgbW9kaWZpZXIgd2FzXG4gIC8vIGFwcGxpZWQuXG4gIC8vXG4gIC8vIG9sZFJlc3VsdHMgaXMgZ3VhcmFudGVlZCB0byBiZSBpZ25vcmVkIGlmIHRoZSBxdWVyeSBpcyBub3QgcGF1c2VkLlxuICBfcmVjb21wdXRlUmVzdWx0cyhxdWVyeSwgb2xkUmVzdWx0cykge1xuICAgIGlmICh0aGlzLnBhdXNlZCkge1xuICAgICAgLy8gVGhlcmUncyBubyByZWFzb24gdG8gcmVjb21wdXRlIHRoZSByZXN1bHRzIG5vdyBhcyB3ZSdyZSBzdGlsbCBwYXVzZWQuXG4gICAgICAvLyBCeSBmbGFnZ2luZyB0aGUgcXVlcnkgYXMgXCJkaXJ0eVwiLCB0aGUgcmVjb21wdXRlIHdpbGwgYmUgcGVyZm9ybWVkXG4gICAgICAvLyB3aGVuIHJlc3VtZU9ic2VydmVycyBpcyBjYWxsZWQuXG4gICAgICBxdWVyeS5kaXJ0eSA9IHRydWU7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLnBhdXNlZCAmJiAhb2xkUmVzdWx0cykge1xuICAgICAgb2xkUmVzdWx0cyA9IHF1ZXJ5LnJlc3VsdHM7XG4gICAgfVxuXG4gICAgaWYgKHF1ZXJ5LmRpc3RhbmNlcykge1xuICAgICAgcXVlcnkuZGlzdGFuY2VzLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgcXVlcnkucmVzdWx0cyA9IHF1ZXJ5LmN1cnNvci5fZ2V0UmF3T2JqZWN0cyh7XG4gICAgICBkaXN0YW5jZXM6IHF1ZXJ5LmRpc3RhbmNlcyxcbiAgICAgIG9yZGVyZWQ6IHF1ZXJ5Lm9yZGVyZWRcbiAgICB9KTtcblxuICAgIGlmICghdGhpcy5wYXVzZWQpIHtcbiAgICAgIExvY2FsQ29sbGVjdGlvbi5fZGlmZlF1ZXJ5Q2hhbmdlcyhcbiAgICAgICAgcXVlcnkub3JkZXJlZCxcbiAgICAgICAgb2xkUmVzdWx0cyxcbiAgICAgICAgcXVlcnkucmVzdWx0cyxcbiAgICAgICAgcXVlcnksXG4gICAgICAgIHtwcm9qZWN0aW9uRm46IHF1ZXJ5LnByb2plY3Rpb25Gbn1cbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgX3NhdmVPcmlnaW5hbChpZCwgZG9jKSB7XG4gICAgLy8gQXJlIHdlIGV2ZW4gdHJ5aW5nIHRvIHNhdmUgb3JpZ2luYWxzP1xuICAgIGlmICghdGhpcy5fc2F2ZWRPcmlnaW5hbHMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBIYXZlIHdlIHByZXZpb3VzbHkgbXV0YXRlZCB0aGUgb3JpZ2luYWwgKGFuZCBzbyAnZG9jJyBpcyBub3QgYWN0dWFsbHlcbiAgICAvLyBvcmlnaW5hbCk/ICAoTm90ZSB0aGUgJ2hhcycgY2hlY2sgcmF0aGVyIHRoYW4gdHJ1dGg6IHdlIHN0b3JlIHVuZGVmaW5lZFxuICAgIC8vIGhlcmUgZm9yIGluc2VydGVkIGRvY3MhKVxuICAgIGlmICh0aGlzLl9zYXZlZE9yaWdpbmFscy5oYXMoaWQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fc2F2ZWRPcmlnaW5hbHMuc2V0KGlkLCBFSlNPTi5jbG9uZShkb2MpKTtcbiAgfVxufVxuXG5Mb2NhbENvbGxlY3Rpb24uQ3Vyc29yID0gQ3Vyc29yO1xuXG5Mb2NhbENvbGxlY3Rpb24uT2JzZXJ2ZUhhbmRsZSA9IE9ic2VydmVIYW5kbGU7XG5cbi8vIFhYWCBtYXliZSBtb3ZlIHRoZXNlIGludG8gYW5vdGhlciBPYnNlcnZlSGVscGVycyBwYWNrYWdlIG9yIHNvbWV0aGluZ1xuXG4vLyBfQ2FjaGluZ0NoYW5nZU9ic2VydmVyIGlzIGFuIG9iamVjdCB3aGljaCByZWNlaXZlcyBvYnNlcnZlQ2hhbmdlcyBjYWxsYmFja3Ncbi8vIGFuZCBrZWVwcyBhIGNhY2hlIG9mIHRoZSBjdXJyZW50IGN1cnNvciBzdGF0ZSB1cCB0byBkYXRlIGluIHRoaXMuZG9jcy4gVXNlcnNcbi8vIG9mIHRoaXMgY2xhc3Mgc2hvdWxkIHJlYWQgdGhlIGRvY3MgZmllbGQgYnV0IG5vdCBtb2RpZnkgaXQuIFlvdSBzaG91bGQgcGFzc1xuLy8gdGhlIFwiYXBwbHlDaGFuZ2VcIiBmaWVsZCBhcyB0aGUgY2FsbGJhY2tzIHRvIHRoZSB1bmRlcmx5aW5nIG9ic2VydmVDaGFuZ2VzXG4vLyBjYWxsLiBPcHRpb25hbGx5LCB5b3UgY2FuIHNwZWNpZnkgeW91ciBvd24gb2JzZXJ2ZUNoYW5nZXMgY2FsbGJhY2tzIHdoaWNoIGFyZVxuLy8gaW52b2tlZCBpbW1lZGlhdGVseSBiZWZvcmUgdGhlIGRvY3MgZmllbGQgaXMgdXBkYXRlZDsgdGhpcyBvYmplY3QgaXMgbWFkZVxuLy8gYXZhaWxhYmxlIGFzIGB0aGlzYCB0byB0aG9zZSBjYWxsYmFja3MuXG5Mb2NhbENvbGxlY3Rpb24uX0NhY2hpbmdDaGFuZ2VPYnNlcnZlciA9IGNsYXNzIF9DYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCBvcmRlcmVkRnJvbUNhbGxiYWNrcyA9IChcbiAgICAgIG9wdGlvbnMuY2FsbGJhY2tzICYmXG4gICAgICBMb2NhbENvbGxlY3Rpb24uX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZChvcHRpb25zLmNhbGxiYWNrcylcbiAgICApO1xuXG4gICAgaWYgKGhhc093bi5jYWxsKG9wdGlvbnMsICdvcmRlcmVkJykpIHtcbiAgICAgIHRoaXMub3JkZXJlZCA9IG9wdGlvbnMub3JkZXJlZDtcblxuICAgICAgaWYgKG9wdGlvbnMuY2FsbGJhY2tzICYmIG9wdGlvbnMub3JkZXJlZCAhPT0gb3JkZXJlZEZyb21DYWxsYmFja3MpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ29yZGVyZWQgb3B0aW9uIGRvZXNuXFwndCBtYXRjaCBjYWxsYmFja3MnKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG9wdGlvbnMuY2FsbGJhY2tzKSB7XG4gICAgICB0aGlzLm9yZGVyZWQgPSBvcmRlcmVkRnJvbUNhbGxiYWNrcztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgRXJyb3IoJ211c3QgcHJvdmlkZSBvcmRlcmVkIG9yIGNhbGxiYWNrcycpO1xuICAgIH1cblxuICAgIGNvbnN0IGNhbGxiYWNrcyA9IG9wdGlvbnMuY2FsbGJhY2tzIHx8IHt9O1xuXG4gICAgaWYgKHRoaXMub3JkZXJlZCkge1xuICAgICAgdGhpcy5kb2NzID0gbmV3IE9yZGVyZWREaWN0KE1vbmdvSUQuaWRTdHJpbmdpZnkpO1xuICAgICAgdGhpcy5hcHBseUNoYW5nZSA9IHtcbiAgICAgICAgYWRkZWRCZWZvcmU6IChpZCwgZmllbGRzLCBiZWZvcmUpID0+IHtcbiAgICAgICAgICAvLyBUYWtlIGEgc2hhbGxvdyBjb3B5IHNpbmNlIHRoZSB0b3AtbGV2ZWwgcHJvcGVydGllcyBjYW4gYmUgY2hhbmdlZFxuICAgICAgICAgIGNvbnN0IGRvYyA9IHsgLi4uZmllbGRzIH07XG5cbiAgICAgICAgICBkb2MuX2lkID0gaWQ7XG5cbiAgICAgICAgICBpZiAoY2FsbGJhY2tzLmFkZGVkQmVmb3JlKSB7XG4gICAgICAgICAgICBjYWxsYmFja3MuYWRkZWRCZWZvcmUuY2FsbCh0aGlzLCBpZCwgRUpTT04uY2xvbmUoZmllbGRzKSwgYmVmb3JlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUaGlzIGxpbmUgdHJpZ2dlcnMgaWYgd2UgcHJvdmlkZSBhZGRlZCB3aXRoIG1vdmVkQmVmb3JlLlxuICAgICAgICAgIGlmIChjYWxsYmFja3MuYWRkZWQpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5hZGRlZC5jYWxsKHRoaXMsIGlkLCBFSlNPTi5jbG9uZShmaWVsZHMpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBYWFggY291bGQgYGJlZm9yZWAgYmUgYSBmYWxzeSBJRD8gIFRlY2huaWNhbGx5XG4gICAgICAgICAgLy8gaWRTdHJpbmdpZnkgc2VlbXMgdG8gYWxsb3cgZm9yIHRoZW0gLS0gdGhvdWdoXG4gICAgICAgICAgLy8gT3JkZXJlZERpY3Qgd29uJ3QgY2FsbCBzdHJpbmdpZnkgb24gYSBmYWxzeSBhcmcuXG4gICAgICAgICAgdGhpcy5kb2NzLnB1dEJlZm9yZShpZCwgZG9jLCBiZWZvcmUgfHwgbnVsbCk7XG4gICAgICAgIH0sXG4gICAgICAgIG1vdmVkQmVmb3JlOiAoaWQsIGJlZm9yZSkgPT4ge1xuICAgICAgICAgIGlmIChjYWxsYmFja3MubW92ZWRCZWZvcmUpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5tb3ZlZEJlZm9yZS5jYWxsKHRoaXMsIGlkLCBiZWZvcmUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuZG9jcy5tb3ZlQmVmb3JlKGlkLCBiZWZvcmUgfHwgbnVsbCk7XG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRvY3MgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIHRoaXMuYXBwbHlDaGFuZ2UgPSB7XG4gICAgICAgIGFkZGVkOiAoaWQsIGZpZWxkcykgPT4ge1xuICAgICAgICAgIC8vIFRha2UgYSBzaGFsbG93IGNvcHkgc2luY2UgdGhlIHRvcC1sZXZlbCBwcm9wZXJ0aWVzIGNhbiBiZSBjaGFuZ2VkXG4gICAgICAgICAgY29uc3QgZG9jID0geyAuLi5maWVsZHMgfTtcblxuICAgICAgICAgIGlmIChjYWxsYmFja3MuYWRkZWQpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5hZGRlZC5jYWxsKHRoaXMsIGlkLCBFSlNPTi5jbG9uZShmaWVsZHMpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBkb2MuX2lkID0gaWQ7XG5cbiAgICAgICAgICB0aGlzLmRvY3Muc2V0KGlkLCAgZG9jKTtcbiAgICAgICAgfSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gVGhlIG1ldGhvZHMgaW4gX0lkTWFwIGFuZCBPcmRlcmVkRGljdCB1c2VkIGJ5IHRoZXNlIGNhbGxiYWNrcyBhcmVcbiAgICAvLyBpZGVudGljYWwuXG4gICAgdGhpcy5hcHBseUNoYW5nZS5jaGFuZ2VkID0gKGlkLCBmaWVsZHMpID0+IHtcbiAgICAgIGNvbnN0IGRvYyA9IHRoaXMuZG9jcy5nZXQoaWQpO1xuXG4gICAgICBpZiAoIWRvYykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gaWQgZm9yIGNoYW5nZWQ6ICR7aWR9YCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChjYWxsYmFja3MuY2hhbmdlZCkge1xuICAgICAgICBjYWxsYmFja3MuY2hhbmdlZC5jYWxsKHRoaXMsIGlkLCBFSlNPTi5jbG9uZShmaWVsZHMpKTtcbiAgICAgIH1cblxuICAgICAgRGlmZlNlcXVlbmNlLmFwcGx5Q2hhbmdlcyhkb2MsIGZpZWxkcyk7XG4gICAgfTtcblxuICAgIHRoaXMuYXBwbHlDaGFuZ2UucmVtb3ZlZCA9IGlkID0+IHtcbiAgICAgIGlmIChjYWxsYmFja3MucmVtb3ZlZCkge1xuICAgICAgICBjYWxsYmFja3MucmVtb3ZlZC5jYWxsKHRoaXMsIGlkKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5kb2NzLnJlbW92ZShpZCk7XG4gICAgfTtcbiAgfVxufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9JZE1hcCA9IGNsYXNzIF9JZE1hcCBleHRlbmRzIElkTWFwIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoTW9uZ29JRC5pZFN0cmluZ2lmeSwgTW9uZ29JRC5pZFBhcnNlKTtcbiAgfVxufTtcblxuLy8gV3JhcCBhIHRyYW5zZm9ybSBmdW5jdGlvbiB0byByZXR1cm4gb2JqZWN0cyB0aGF0IGhhdmUgdGhlIF9pZCBmaWVsZFxuLy8gb2YgdGhlIHVudHJhbnNmb3JtZWQgZG9jdW1lbnQuIFRoaXMgZW5zdXJlcyB0aGF0IHN1YnN5c3RlbXMgc3VjaCBhc1xuLy8gdGhlIG9ic2VydmUtc2VxdWVuY2UgcGFja2FnZSB0aGF0IGNhbGwgYG9ic2VydmVgIGNhbiBrZWVwIHRyYWNrIG9mXG4vLyB0aGUgZG9jdW1lbnRzIGlkZW50aXRpZXMuXG4vL1xuLy8gLSBSZXF1aXJlIHRoYXQgaXQgcmV0dXJucyBvYmplY3RzXG4vLyAtIElmIHRoZSByZXR1cm4gdmFsdWUgaGFzIGFuIF9pZCBmaWVsZCwgdmVyaWZ5IHRoYXQgaXQgbWF0Y2hlcyB0aGVcbi8vICAgb3JpZ2luYWwgX2lkIGZpZWxkXG4vLyAtIElmIHRoZSByZXR1cm4gdmFsdWUgZG9lc24ndCBoYXZlIGFuIF9pZCBmaWVsZCwgYWRkIGl0IGJhY2suXG5Mb2NhbENvbGxlY3Rpb24ud3JhcFRyYW5zZm9ybSA9IHRyYW5zZm9ybSA9PiB7XG4gIGlmICghdHJhbnNmb3JtKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBObyBuZWVkIHRvIGRvdWJseS13cmFwIHRyYW5zZm9ybXMuXG4gIGlmICh0cmFuc2Zvcm0uX193cmFwcGVkVHJhbnNmb3JtX18pIHtcbiAgICByZXR1cm4gdHJhbnNmb3JtO1xuICB9XG5cbiAgY29uc3Qgd3JhcHBlZCA9IGRvYyA9PiB7XG4gICAgaWYgKCFoYXNPd24uY2FsbChkb2MsICdfaWQnKSkge1xuICAgICAgLy8gWFhYIGRvIHdlIGV2ZXIgaGF2ZSBhIHRyYW5zZm9ybSBvbiB0aGUgb3Bsb2cncyBjb2xsZWN0aW9uPyBiZWNhdXNlIHRoYXRcbiAgICAgIC8vIGNvbGxlY3Rpb24gaGFzIG5vIF9pZC5cbiAgICAgIHRocm93IG5ldyBFcnJvcignY2FuIG9ubHkgdHJhbnNmb3JtIGRvY3VtZW50cyB3aXRoIF9pZCcpO1xuICAgIH1cblxuICAgIGNvbnN0IGlkID0gZG9jLl9pZDtcblxuICAgIC8vIFhYWCBjb25zaWRlciBtYWtpbmcgdHJhY2tlciBhIHdlYWsgZGVwZW5kZW5jeSBhbmQgY2hlY2tpbmdcbiAgICAvLyBQYWNrYWdlLnRyYWNrZXIgaGVyZVxuICAgIGNvbnN0IHRyYW5zZm9ybWVkID0gVHJhY2tlci5ub25yZWFjdGl2ZSgoKSA9PiB0cmFuc2Zvcm0oZG9jKSk7XG5cbiAgICBpZiAoIUxvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdCh0cmFuc2Zvcm1lZCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcigndHJhbnNmb3JtIG11c3QgcmV0dXJuIG9iamVjdCcpO1xuICAgIH1cblxuICAgIGlmIChoYXNPd24uY2FsbCh0cmFuc2Zvcm1lZCwgJ19pZCcpKSB7XG4gICAgICBpZiAoIUVKU09OLmVxdWFscyh0cmFuc2Zvcm1lZC5faWQsIGlkKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RyYW5zZm9ybWVkIGRvY3VtZW50IGNhblxcJ3QgaGF2ZSBkaWZmZXJlbnQgX2lkJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyYW5zZm9ybWVkLl9pZCA9IGlkO1xuICAgIH1cblxuICAgIHJldHVybiB0cmFuc2Zvcm1lZDtcbiAgfTtcblxuICB3cmFwcGVkLl9fd3JhcHBlZFRyYW5zZm9ybV9fID0gdHJ1ZTtcblxuICByZXR1cm4gd3JhcHBlZDtcbn07XG5cbi8vIFhYWCB0aGUgc29ydGVkLXF1ZXJ5IGxvZ2ljIGJlbG93IGlzIGxhdWdoYWJseSBpbmVmZmljaWVudC4gd2UnbGxcbi8vIG5lZWQgdG8gY29tZSB1cCB3aXRoIGEgYmV0dGVyIGRhdGFzdHJ1Y3R1cmUgZm9yIHRoaXMuXG4vL1xuLy8gWFhYIHRoZSBsb2dpYyBmb3Igb2JzZXJ2aW5nIHdpdGggYSBza2lwIG9yIGEgbGltaXQgaXMgZXZlbiBtb3JlXG4vLyBsYXVnaGFibHkgaW5lZmZpY2llbnQuIHdlIHJlY29tcHV0ZSB0aGUgd2hvbGUgcmVzdWx0cyBldmVyeSB0aW1lIVxuXG4vLyBUaGlzIGJpbmFyeSBzZWFyY2ggcHV0cyBhIHZhbHVlIGJldHdlZW4gYW55IGVxdWFsIHZhbHVlcywgYW5kIHRoZSBmaXJzdFxuLy8gbGVzc2VyIHZhbHVlLlxuTG9jYWxDb2xsZWN0aW9uLl9iaW5hcnlTZWFyY2ggPSAoY21wLCBhcnJheSwgdmFsdWUpID0+IHtcbiAgbGV0IGZpcnN0ID0gMDtcbiAgbGV0IHJhbmdlID0gYXJyYXkubGVuZ3RoO1xuXG4gIHdoaWxlIChyYW5nZSA+IDApIHtcbiAgICBjb25zdCBoYWxmUmFuZ2UgPSBNYXRoLmZsb29yKHJhbmdlIC8gMik7XG5cbiAgICBpZiAoY21wKHZhbHVlLCBhcnJheVtmaXJzdCArIGhhbGZSYW5nZV0pID49IDApIHtcbiAgICAgIGZpcnN0ICs9IGhhbGZSYW5nZSArIDE7XG4gICAgICByYW5nZSAtPSBoYWxmUmFuZ2UgKyAxO1xuICAgIH0gZWxzZSB7XG4gICAgICByYW5nZSA9IGhhbGZSYW5nZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmlyc3Q7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX2NoZWNrU3VwcG9ydGVkUHJvamVjdGlvbiA9IGZpZWxkcyA9PiB7XG4gIGlmIChmaWVsZHMgIT09IE9iamVjdChmaWVsZHMpIHx8IEFycmF5LmlzQXJyYXkoZmllbGRzKSkge1xuICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdmaWVsZHMgb3B0aW9uIG11c3QgYmUgYW4gb2JqZWN0Jyk7XG4gIH1cblxuICBPYmplY3Qua2V5cyhmaWVsZHMpLmZvckVhY2goa2V5UGF0aCA9PiB7XG4gICAgaWYgKGtleVBhdGguc3BsaXQoJy4nKS5pbmNsdWRlcygnJCcpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ01pbmltb25nbyBkb2VzblxcJ3Qgc3VwcG9ydCAkIG9wZXJhdG9yIGluIHByb2plY3Rpb25zIHlldC4nXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IHZhbHVlID0gZmllbGRzW2tleVBhdGhdO1xuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgWyckZWxlbU1hdGNoJywgJyRtZXRhJywgJyRzbGljZSddLnNvbWUoa2V5ID0+XG4gICAgICAgICAgaGFzT3duLmNhbGwodmFsdWUsIGtleSlcbiAgICAgICAgKSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdNaW5pbW9uZ28gZG9lc25cXCd0IHN1cHBvcnQgb3BlcmF0b3JzIGluIHByb2plY3Rpb25zIHlldC4nXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICghWzEsIDAsIHRydWUsIGZhbHNlXS5pbmNsdWRlcyh2YWx1ZSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnUHJvamVjdGlvbiB2YWx1ZXMgc2hvdWxkIGJlIG9uZSBvZiAxLCAwLCB0cnVlLCBvciBmYWxzZSdcbiAgICAgICk7XG4gICAgfVxuICB9KTtcbn07XG5cbi8vIEtub3dzIGhvdyB0byBjb21waWxlIGEgZmllbGRzIHByb2plY3Rpb24gdG8gYSBwcmVkaWNhdGUgZnVuY3Rpb24uXG4vLyBAcmV0dXJucyAtIEZ1bmN0aW9uOiBhIGNsb3N1cmUgdGhhdCBmaWx0ZXJzIG91dCBhbiBvYmplY3QgYWNjb3JkaW5nIHRvIHRoZVxuLy8gICAgICAgICAgICBmaWVsZHMgcHJvamVjdGlvbiBydWxlczpcbi8vICAgICAgICAgICAgQHBhcmFtIG9iaiAtIE9iamVjdDogTW9uZ29EQi1zdHlsZWQgZG9jdW1lbnRcbi8vICAgICAgICAgICAgQHJldHVybnMgLSBPYmplY3Q6IGEgZG9jdW1lbnQgd2l0aCB0aGUgZmllbGRzIGZpbHRlcmVkIG91dFxuLy8gICAgICAgICAgICAgICAgICAgICAgIGFjY29yZGluZyB0byBwcm9qZWN0aW9uIHJ1bGVzLiBEb2Vzbid0IHJldGFpbiBzdWJmaWVsZHNcbi8vICAgICAgICAgICAgICAgICAgICAgICBvZiBwYXNzZWQgYXJndW1lbnQuXG5Mb2NhbENvbGxlY3Rpb24uX2NvbXBpbGVQcm9qZWN0aW9uID0gZmllbGRzID0+IHtcbiAgTG9jYWxDb2xsZWN0aW9uLl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24oZmllbGRzKTtcblxuICBjb25zdCBfaWRQcm9qZWN0aW9uID0gZmllbGRzLl9pZCA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IGZpZWxkcy5faWQ7XG4gIGNvbnN0IGRldGFpbHMgPSBwcm9qZWN0aW9uRGV0YWlscyhmaWVsZHMpO1xuXG4gIC8vIHJldHVybnMgdHJhbnNmb3JtZWQgZG9jIGFjY29yZGluZyB0byBydWxlVHJlZVxuICBjb25zdCB0cmFuc2Zvcm0gPSAoZG9jLCBydWxlVHJlZSkgPT4ge1xuICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgXCJzZXRzXCJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShkb2MpKSB7XG4gICAgICByZXR1cm4gZG9jLm1hcChzdWJkb2MgPT4gdHJhbnNmb3JtKHN1YmRvYywgcnVsZVRyZWUpKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBkZXRhaWxzLmluY2x1ZGluZyA/IHt9IDogRUpTT04uY2xvbmUoZG9jKTtcblxuICAgIE9iamVjdC5rZXlzKHJ1bGVUcmVlKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBpZiAoZG9jID09IG51bGwgfHwgIWhhc093bi5jYWxsKGRvYywga2V5KSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJ1bGUgPSBydWxlVHJlZVtrZXldO1xuXG4gICAgICBpZiAocnVsZSA9PT0gT2JqZWN0KHJ1bGUpKSB7XG4gICAgICAgIC8vIEZvciBzdWItb2JqZWN0cy9zdWJzZXRzIHdlIGJyYW5jaFxuICAgICAgICBpZiAoZG9jW2tleV0gPT09IE9iamVjdChkb2Nba2V5XSkpIHtcbiAgICAgICAgICByZXN1bHRba2V5XSA9IHRyYW5zZm9ybShkb2Nba2V5XSwgcnVsZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoZGV0YWlscy5pbmNsdWRpbmcpIHtcbiAgICAgICAgLy8gT3RoZXJ3aXNlIHdlIGRvbid0IGV2ZW4gdG91Y2ggdGhpcyBzdWJmaWVsZFxuICAgICAgICByZXN1bHRba2V5XSA9IEVKU09OLmNsb25lKGRvY1trZXldKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSByZXN1bHRba2V5XTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBkb2MgIT0gbnVsbCA/IHJlc3VsdCA6IGRvYztcbiAgfTtcblxuICByZXR1cm4gZG9jID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSB0cmFuc2Zvcm0oZG9jLCBkZXRhaWxzLnRyZWUpO1xuXG4gICAgaWYgKF9pZFByb2plY3Rpb24gJiYgaGFzT3duLmNhbGwoZG9jLCAnX2lkJykpIHtcbiAgICAgIHJlc3VsdC5faWQgPSBkb2MuX2lkO1xuICAgIH1cblxuICAgIGlmICghX2lkUHJvamVjdGlvbiAmJiBoYXNPd24uY2FsbChyZXN1bHQsICdfaWQnKSkge1xuICAgICAgZGVsZXRlIHJlc3VsdC5faWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbn07XG5cbi8vIENhbGN1bGF0ZXMgdGhlIGRvY3VtZW50IHRvIGluc2VydCBpbiBjYXNlIHdlJ3JlIGRvaW5nIGFuIHVwc2VydCBhbmQgdGhlXG4vLyBzZWxlY3RvciBkb2VzIG5vdCBtYXRjaCBhbnkgZWxlbWVudHNcbkxvY2FsQ29sbGVjdGlvbi5fY3JlYXRlVXBzZXJ0RG9jdW1lbnQgPSAoc2VsZWN0b3IsIG1vZGlmaWVyKSA9PiB7XG4gIGNvbnN0IHNlbGVjdG9yRG9jdW1lbnQgPSBwb3B1bGF0ZURvY3VtZW50V2l0aFF1ZXJ5RmllbGRzKHNlbGVjdG9yKTtcbiAgY29uc3QgaXNNb2RpZnkgPSBMb2NhbENvbGxlY3Rpb24uX2lzTW9kaWZpY2F0aW9uTW9kKG1vZGlmaWVyKTtcblxuICBjb25zdCBuZXdEb2MgPSB7fTtcblxuICBpZiAoc2VsZWN0b3JEb2N1bWVudC5faWQpIHtcbiAgICBuZXdEb2MuX2lkID0gc2VsZWN0b3JEb2N1bWVudC5faWQ7XG4gICAgZGVsZXRlIHNlbGVjdG9yRG9jdW1lbnQuX2lkO1xuICB9XG5cbiAgLy8gVGhpcyBkb3VibGUgX21vZGlmeSBjYWxsIGlzIG1hZGUgdG8gaGVscCB3aXRoIG5lc3RlZCBwcm9wZXJ0aWVzIChzZWUgaXNzdWVcbiAgLy8gIzg2MzEpLiBXZSBkbyB0aGlzIGV2ZW4gaWYgaXQncyBhIHJlcGxhY2VtZW50IGZvciB2YWxpZGF0aW9uIHB1cnBvc2VzIChlLmcuXG4gIC8vIGFtYmlndW91cyBpZCdzKVxuICBMb2NhbENvbGxlY3Rpb24uX21vZGlmeShuZXdEb2MsIHskc2V0OiBzZWxlY3RvckRvY3VtZW50fSk7XG4gIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5KG5ld0RvYywgbW9kaWZpZXIsIHtpc0luc2VydDogdHJ1ZX0pO1xuXG4gIGlmIChpc01vZGlmeSkge1xuICAgIHJldHVybiBuZXdEb2M7XG4gIH1cblxuICAvLyBSZXBsYWNlbWVudCBjYW4gdGFrZSBfaWQgZnJvbSBxdWVyeSBkb2N1bWVudFxuICBjb25zdCByZXBsYWNlbWVudCA9IE9iamVjdC5hc3NpZ24oe30sIG1vZGlmaWVyKTtcbiAgaWYgKG5ld0RvYy5faWQpIHtcbiAgICByZXBsYWNlbWVudC5faWQgPSBuZXdEb2MuX2lkO1xuICB9XG5cbiAgcmV0dXJuIHJlcGxhY2VtZW50O1xufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9kaWZmT2JqZWN0cyA9IChsZWZ0LCByaWdodCwgY2FsbGJhY2tzKSA9PiB7XG4gIHJldHVybiBEaWZmU2VxdWVuY2UuZGlmZk9iamVjdHMobGVmdCwgcmlnaHQsIGNhbGxiYWNrcyk7XG59O1xuXG4vLyBvcmRlcmVkOiBib29sLlxuLy8gb2xkX3Jlc3VsdHMgYW5kIG5ld19yZXN1bHRzOiBjb2xsZWN0aW9ucyBvZiBkb2N1bWVudHMuXG4vLyAgICBpZiBvcmRlcmVkLCB0aGV5IGFyZSBhcnJheXMuXG4vLyAgICBpZiB1bm9yZGVyZWQsIHRoZXkgYXJlIElkTWFwc1xuTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlDaGFuZ2VzID0gKG9yZGVyZWQsIG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIG9ic2VydmVyLCBvcHRpb25zKSA9PlxuICBEaWZmU2VxdWVuY2UuZGlmZlF1ZXJ5Q2hhbmdlcyhvcmRlcmVkLCBvbGRSZXN1bHRzLCBuZXdSZXN1bHRzLCBvYnNlcnZlciwgb3B0aW9ucylcbjtcblxuTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlPcmRlcmVkQ2hhbmdlcyA9IChvbGRSZXN1bHRzLCBuZXdSZXN1bHRzLCBvYnNlcnZlciwgb3B0aW9ucykgPT5cbiAgRGlmZlNlcXVlbmNlLmRpZmZRdWVyeU9yZGVyZWRDaGFuZ2VzKG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIG9ic2VydmVyLCBvcHRpb25zKVxuO1xuXG5Mb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeVVub3JkZXJlZENoYW5nZXMgPSAob2xkUmVzdWx0cywgbmV3UmVzdWx0cywgb2JzZXJ2ZXIsIG9wdGlvbnMpID0+XG4gIERpZmZTZXF1ZW5jZS5kaWZmUXVlcnlVbm9yZGVyZWRDaGFuZ2VzKG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIG9ic2VydmVyLCBvcHRpb25zKVxuO1xuXG5Mb2NhbENvbGxlY3Rpb24uX2ZpbmRJbk9yZGVyZWRSZXN1bHRzID0gKHF1ZXJ5LCBkb2MpID0+IHtcbiAgaWYgKCFxdWVyeS5vcmRlcmVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IGNhbGwgX2ZpbmRJbk9yZGVyZWRSZXN1bHRzIG9uIHVub3JkZXJlZCBxdWVyeScpO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWVyeS5yZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHF1ZXJ5LnJlc3VsdHNbaV0gPT09IGRvYykge1xuICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICB9XG5cbiAgdGhyb3cgRXJyb3IoJ29iamVjdCBtaXNzaW5nIGZyb20gcXVlcnknKTtcbn07XG5cbi8vIElmIHRoaXMgaXMgYSBzZWxlY3RvciB3aGljaCBleHBsaWNpdGx5IGNvbnN0cmFpbnMgdGhlIG1hdGNoIGJ5IElEIHRvIGEgZmluaXRlXG4vLyBudW1iZXIgb2YgZG9jdW1lbnRzLCByZXR1cm5zIGEgbGlzdCBvZiB0aGVpciBJRHMuICBPdGhlcndpc2UgcmV0dXJuc1xuLy8gbnVsbC4gTm90ZSB0aGF0IHRoZSBzZWxlY3RvciBtYXkgaGF2ZSBvdGhlciByZXN0cmljdGlvbnMgc28gaXQgbWF5IG5vdCBldmVuXG4vLyBtYXRjaCB0aG9zZSBkb2N1bWVudCEgIFdlIGNhcmUgYWJvdXQgJGluIGFuZCAkYW5kIHNpbmNlIHRob3NlIGFyZSBnZW5lcmF0ZWRcbi8vIGFjY2Vzcy1jb250cm9sbGVkIHVwZGF0ZSBhbmQgcmVtb3ZlLlxuTG9jYWxDb2xsZWN0aW9uLl9pZHNNYXRjaGVkQnlTZWxlY3RvciA9IHNlbGVjdG9yID0+IHtcbiAgLy8gSXMgdGhlIHNlbGVjdG9yIGp1c3QgYW4gSUQ/XG4gIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3RvcikpIHtcbiAgICByZXR1cm4gW3NlbGVjdG9yXTtcbiAgfVxuXG4gIGlmICghc2VsZWN0b3IpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIERvIHdlIGhhdmUgYW4gX2lkIGNsYXVzZT9cbiAgaWYgKGhhc093bi5jYWxsKHNlbGVjdG9yLCAnX2lkJykpIHtcbiAgICAvLyBJcyB0aGUgX2lkIGNsYXVzZSBqdXN0IGFuIElEP1xuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3Rvci5faWQpKSB7XG4gICAgICByZXR1cm4gW3NlbGVjdG9yLl9pZF07XG4gICAgfVxuXG4gICAgLy8gSXMgdGhlIF9pZCBjbGF1c2Uge19pZDogeyRpbjogW1wieFwiLCBcInlcIiwgXCJ6XCJdfX0/XG4gICAgaWYgKHNlbGVjdG9yLl9pZFxuICAgICAgICAmJiBBcnJheS5pc0FycmF5KHNlbGVjdG9yLl9pZC4kaW4pXG4gICAgICAgICYmIHNlbGVjdG9yLl9pZC4kaW4ubGVuZ3RoXG4gICAgICAgICYmIHNlbGVjdG9yLl9pZC4kaW4uZXZlcnkoTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQpKSB7XG4gICAgICByZXR1cm4gc2VsZWN0b3IuX2lkLiRpbjtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIElmIHRoaXMgaXMgYSB0b3AtbGV2ZWwgJGFuZCwgYW5kIGFueSBvZiB0aGUgY2xhdXNlcyBjb25zdHJhaW4gdGhlaXJcbiAgLy8gZG9jdW1lbnRzLCB0aGVuIHRoZSB3aG9sZSBzZWxlY3RvciBpcyBjb25zdHJhaW5lZCBieSBhbnkgb25lIGNsYXVzZSdzXG4gIC8vIGNvbnN0cmFpbnQuIChXZWxsLCBieSB0aGVpciBpbnRlcnNlY3Rpb24sIGJ1dCB0aGF0IHNlZW1zIHVubGlrZWx5LilcbiAgaWYgKEFycmF5LmlzQXJyYXkoc2VsZWN0b3IuJGFuZCkpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlbGVjdG9yLiRhbmQubGVuZ3RoOyArK2kpIHtcbiAgICAgIGNvbnN0IHN1YklkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3Ioc2VsZWN0b3IuJGFuZFtpXSk7XG5cbiAgICAgIGlmIChzdWJJZHMpIHtcbiAgICAgICAgcmV0dXJuIHN1YklkcztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5SZXN1bHRzU3luYyA9IChxdWVyeSwgZG9jKSA9PiB7XG4gIGNvbnN0IGZpZWxkcyA9IEVKU09OLmNsb25lKGRvYyk7XG5cbiAgZGVsZXRlIGZpZWxkcy5faWQ7XG5cbiAgaWYgKHF1ZXJ5Lm9yZGVyZWQpIHtcbiAgICBpZiAoIXF1ZXJ5LnNvcnRlcikge1xuICAgICAgcXVlcnkuYWRkZWRCZWZvcmUoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcyksIG51bGwpO1xuICAgICAgcXVlcnkucmVzdWx0cy5wdXNoKGRvYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGkgPSBMb2NhbENvbGxlY3Rpb24uX2luc2VydEluU29ydGVkTGlzdChcbiAgICAgICAgcXVlcnkuc29ydGVyLmdldENvbXBhcmF0b3Ioe2Rpc3RhbmNlczogcXVlcnkuZGlzdGFuY2VzfSksXG4gICAgICAgIHF1ZXJ5LnJlc3VsdHMsXG4gICAgICAgIGRvY1xuICAgICAgKTtcblxuICAgICAgbGV0IG5leHQgPSBxdWVyeS5yZXN1bHRzW2kgKyAxXTtcbiAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgIG5leHQgPSBuZXh0Ll9pZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5leHQgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICBxdWVyeS5hZGRlZEJlZm9yZShkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSwgbmV4dCk7XG4gICAgfVxuXG4gICAgcXVlcnkuYWRkZWQoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcykpO1xuICB9IGVsc2Uge1xuICAgIHF1ZXJ5LmFkZGVkKGRvYy5faWQsIHF1ZXJ5LnByb2plY3Rpb25GbihmaWVsZHMpKTtcbiAgICBxdWVyeS5yZXN1bHRzLnNldChkb2MuX2lkLCBkb2MpO1xuICB9XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX2luc2VydEluUmVzdWx0c0FzeW5jID0gYXN5bmMgKHF1ZXJ5LCBkb2MpID0+IHtcbiAgY29uc3QgZmllbGRzID0gRUpTT04uY2xvbmUoZG9jKTtcblxuICBkZWxldGUgZmllbGRzLl9pZDtcblxuICBpZiAocXVlcnkub3JkZXJlZCkge1xuICAgIGlmICghcXVlcnkuc29ydGVyKSB7XG4gICAgICBhd2FpdCBxdWVyeS5hZGRlZEJlZm9yZShkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSwgbnVsbCk7XG4gICAgICBxdWVyeS5yZXN1bHRzLnB1c2goZG9jKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaSA9IExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5Tb3J0ZWRMaXN0KFxuICAgICAgICBxdWVyeS5zb3J0ZXIuZ2V0Q29tcGFyYXRvcih7ZGlzdGFuY2VzOiBxdWVyeS5kaXN0YW5jZXN9KSxcbiAgICAgICAgcXVlcnkucmVzdWx0cyxcbiAgICAgICAgZG9jXG4gICAgICApO1xuXG4gICAgICBsZXQgbmV4dCA9IHF1ZXJ5LnJlc3VsdHNbaSArIDFdO1xuICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgbmV4dCA9IG5leHQuX2lkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV4dCA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHF1ZXJ5LmFkZGVkQmVmb3JlKGRvYy5faWQsIHF1ZXJ5LnByb2plY3Rpb25GbihmaWVsZHMpLCBuZXh0KTtcbiAgICB9XG5cbiAgICBhd2FpdCBxdWVyeS5hZGRlZChkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSk7XG4gIH0gZWxzZSB7XG4gICAgYXdhaXQgcXVlcnkuYWRkZWQoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcykpO1xuICAgIHF1ZXJ5LnJlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gIH1cbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5Tb3J0ZWRMaXN0ID0gKGNtcCwgYXJyYXksIHZhbHVlKSA9PiB7XG4gIGlmIChhcnJheS5sZW5ndGggPT09IDApIHtcbiAgICBhcnJheS5wdXNoKHZhbHVlKTtcbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIGNvbnN0IGkgPSBMb2NhbENvbGxlY3Rpb24uX2JpbmFyeVNlYXJjaChjbXAsIGFycmF5LCB2YWx1ZSk7XG5cbiAgYXJyYXkuc3BsaWNlKGksIDAsIHZhbHVlKTtcblxuICByZXR1cm4gaTtcbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5faXNNb2RpZmljYXRpb25Nb2QgPSBtb2QgPT4ge1xuICBsZXQgaXNNb2RpZnkgPSBmYWxzZTtcbiAgbGV0IGlzUmVwbGFjZSA9IGZhbHNlO1xuXG4gIE9iamVjdC5rZXlzKG1vZCkuZm9yRWFjaChrZXkgPT4ge1xuICAgIGlmIChrZXkuc3Vic3RyKDAsIDEpID09PSAnJCcpIHtcbiAgICAgIGlzTW9kaWZ5ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaXNSZXBsYWNlID0gdHJ1ZTtcbiAgICB9XG4gIH0pO1xuXG4gIGlmIChpc01vZGlmeSAmJiBpc1JlcGxhY2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnVXBkYXRlIHBhcmFtZXRlciBjYW5ub3QgaGF2ZSBib3RoIG1vZGlmaWVyIGFuZCBub24tbW9kaWZpZXIgZmllbGRzLidcbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIGlzTW9kaWZ5O1xufTtcblxuLy8gWFhYIG1heWJlIHRoaXMgc2hvdWxkIGJlIEVKU09OLmlzT2JqZWN0LCB0aG91Z2ggRUpTT04gZG9lc24ndCBrbm93IGFib3V0XG4vLyBSZWdFeHBcbi8vIFhYWCBub3RlIHRoYXQgX3R5cGUodW5kZWZpbmVkKSA9PT0gMyEhISFcbkxvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdCA9IHggPT4ge1xuICByZXR1cm4geCAmJiBMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUoeCkgPT09IDM7XG59O1xuXG4vLyBYWFggbmVlZCBhIHN0cmF0ZWd5IGZvciBwYXNzaW5nIHRoZSBiaW5kaW5nIG9mICQgaW50byB0aGlzXG4vLyBmdW5jdGlvbiwgZnJvbSB0aGUgY29tcGlsZWQgc2VsZWN0b3Jcbi8vXG4vLyBtYXliZSBqdXN0IHtrZXkudXAudG8uanVzdC5iZWZvcmUuZG9sbGFyc2lnbjogYXJyYXlfaW5kZXh9XG4vL1xuLy8gWFhYIGF0b21pY2l0eTogaWYgb25lIG1vZGlmaWNhdGlvbiBmYWlscywgZG8gd2Ugcm9sbCBiYWNrIHRoZSB3aG9sZVxuLy8gY2hhbmdlP1xuLy9cbi8vIG9wdGlvbnM6XG4vLyAgIC0gaXNJbnNlcnQgaXMgc2V0IHdoZW4gX21vZGlmeSBpcyBiZWluZyBjYWxsZWQgdG8gY29tcHV0ZSB0aGUgZG9jdW1lbnQgdG9cbi8vICAgICBpbnNlcnQgYXMgcGFydCBvZiBhbiB1cHNlcnQgb3BlcmF0aW9uLiBXZSB1c2UgdGhpcyBwcmltYXJpbHkgdG8gZmlndXJlXG4vLyAgICAgb3V0IHdoZW4gdG8gc2V0IHRoZSBmaWVsZHMgaW4gJHNldE9uSW5zZXJ0LCBpZiBwcmVzZW50LlxuTG9jYWxDb2xsZWN0aW9uLl9tb2RpZnkgPSAoZG9jLCBtb2RpZmllciwgb3B0aW9ucyA9IHt9KSA9PiB7XG4gIGlmICghTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KG1vZGlmaWVyKSkge1xuICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdNb2RpZmllciBtdXN0IGJlIGFuIG9iamVjdCcpO1xuICB9XG5cbiAgLy8gTWFrZSBzdXJlIHRoZSBjYWxsZXIgY2FuJ3QgbXV0YXRlIG91ciBkYXRhIHN0cnVjdHVyZXMuXG4gIG1vZGlmaWVyID0gRUpTT04uY2xvbmUobW9kaWZpZXIpO1xuXG4gIGNvbnN0IGlzTW9kaWZpZXIgPSBpc09wZXJhdG9yT2JqZWN0KG1vZGlmaWVyKTtcbiAgY29uc3QgbmV3RG9jID0gaXNNb2RpZmllciA/IEVKU09OLmNsb25lKGRvYykgOiBtb2RpZmllcjtcblxuICBpZiAoaXNNb2RpZmllcikge1xuICAgIC8vIGFwcGx5IG1vZGlmaWVycyB0byB0aGUgZG9jLlxuICAgIE9iamVjdC5rZXlzKG1vZGlmaWVyKS5mb3JFYWNoKG9wZXJhdG9yID0+IHtcbiAgICAgIC8vIFRyZWF0ICRzZXRPbkluc2VydCBhcyAkc2V0IGlmIHRoaXMgaXMgYW4gaW5zZXJ0LlxuICAgICAgY29uc3Qgc2V0T25JbnNlcnQgPSBvcHRpb25zLmlzSW5zZXJ0ICYmIG9wZXJhdG9yID09PSAnJHNldE9uSW5zZXJ0JztcbiAgICAgIGNvbnN0IG1vZEZ1bmMgPSBNT0RJRklFUlNbc2V0T25JbnNlcnQgPyAnJHNldCcgOiBvcGVyYXRvcl07XG4gICAgICBjb25zdCBvcGVyYW5kID0gbW9kaWZpZXJbb3BlcmF0b3JdO1xuXG4gICAgICBpZiAoIW1vZEZ1bmMpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoYEludmFsaWQgbW9kaWZpZXIgc3BlY2lmaWVkICR7b3BlcmF0b3J9YCk7XG4gICAgICB9XG5cbiAgICAgIE9iamVjdC5rZXlzKG9wZXJhbmQpLmZvckVhY2goa2V5cGF0aCA9PiB7XG4gICAgICAgIGNvbnN0IGFyZyA9IG9wZXJhbmRba2V5cGF0aF07XG5cbiAgICAgICAgaWYgKGtleXBhdGggPT09ICcnKSB7XG4gICAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ0FuIGVtcHR5IHVwZGF0ZSBwYXRoIGlzIG5vdCB2YWxpZC4nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGtleXBhcnRzID0ga2V5cGF0aC5zcGxpdCgnLicpO1xuXG4gICAgICAgIGlmICgha2V5cGFydHMuZXZlcnkoQm9vbGVhbikpIHtcbiAgICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAgIGBUaGUgdXBkYXRlIHBhdGggJyR7a2V5cGF0aH0nIGNvbnRhaW5zIGFuIGVtcHR5IGZpZWxkIG5hbWUsIGAgK1xuICAgICAgICAgICAgJ3doaWNoIGlzIG5vdCBhbGxvd2VkLidcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gZmluZE1vZFRhcmdldChuZXdEb2MsIGtleXBhcnRzLCB7XG4gICAgICAgICAgYXJyYXlJbmRpY2VzOiBvcHRpb25zLmFycmF5SW5kaWNlcyxcbiAgICAgICAgICBmb3JiaWRBcnJheTogb3BlcmF0b3IgPT09ICckcmVuYW1lJyxcbiAgICAgICAgICBub0NyZWF0ZTogTk9fQ1JFQVRFX01PRElGSUVSU1tvcGVyYXRvcl1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgbW9kRnVuYyh0YXJnZXQsIGtleXBhcnRzLnBvcCgpLCBhcmcsIGtleXBhdGgsIG5ld0RvYyk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGlmIChkb2MuX2lkICYmICFFSlNPTi5lcXVhbHMoZG9jLl9pZCwgbmV3RG9jLl9pZCkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICBgQWZ0ZXIgYXBwbHlpbmcgdGhlIHVwZGF0ZSB0byB0aGUgZG9jdW1lbnQge19pZDogXCIke2RvYy5faWR9XCIsIC4uLn0sYCArXG4gICAgICAgICcgdGhlIChpbW11dGFibGUpIGZpZWxkIFxcJ19pZFxcJyB3YXMgZm91bmQgdG8gaGF2ZSBiZWVuIGFsdGVyZWQgdG8gJyArXG4gICAgICAgIGBfaWQ6IFwiJHtuZXdEb2MuX2lkfVwiYFxuICAgICAgKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKGRvYy5faWQgJiYgbW9kaWZpZXIuX2lkICYmICFFSlNPTi5lcXVhbHMoZG9jLl9pZCwgbW9kaWZpZXIuX2lkKSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgIGBUaGUgX2lkIGZpZWxkIGNhbm5vdCBiZSBjaGFuZ2VkIGZyb20ge19pZDogXCIke2RvYy5faWR9XCJ9IHRvIGAgK1xuICAgICAgICBge19pZDogXCIke21vZGlmaWVyLl9pZH1cIn1gXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIHJlcGxhY2UgdGhlIHdob2xlIGRvY3VtZW50XG4gICAgYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzKG1vZGlmaWVyKTtcbiAgfVxuXG4gIC8vIG1vdmUgbmV3IGRvY3VtZW50IGludG8gcGxhY2UuXG4gIE9iamVjdC5rZXlzKGRvYykuZm9yRWFjaChrZXkgPT4ge1xuICAgIC8vIE5vdGU6IHRoaXMgdXNlZCB0byBiZSBmb3IgKHZhciBrZXkgaW4gZG9jKSBob3dldmVyLCB0aGlzIGRvZXMgbm90XG4gICAgLy8gd29yayByaWdodCBpbiBPcGVyYS4gRGVsZXRpbmcgZnJvbSBhIGRvYyB3aGlsZSBpdGVyYXRpbmcgb3ZlciBpdFxuICAgIC8vIHdvdWxkIHNvbWV0aW1lcyBjYXVzZSBvcGVyYSB0byBza2lwIHNvbWUga2V5cy5cbiAgICBpZiAoa2V5ICE9PSAnX2lkJykge1xuICAgICAgZGVsZXRlIGRvY1trZXldO1xuICAgIH1cbiAgfSk7XG5cbiAgT2JqZWN0LmtleXMobmV3RG9jKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgZG9jW2tleV0gPSBuZXdEb2Nba2V5XTtcbiAgfSk7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX29ic2VydmVGcm9tT2JzZXJ2ZUNoYW5nZXMgPSAoY3Vyc29yLCBvYnNlcnZlQ2FsbGJhY2tzKSA9PiB7XG4gIGNvbnN0IHRyYW5zZm9ybSA9IGN1cnNvci5nZXRUcmFuc2Zvcm0oKSB8fCAoZG9jID0+IGRvYyk7XG4gIGxldCBzdXBwcmVzc2VkID0gISFvYnNlcnZlQ2FsbGJhY2tzLl9zdXBwcmVzc19pbml0aWFsO1xuXG4gIGxldCBvYnNlcnZlQ2hhbmdlc0NhbGxiYWNrcztcbiAgaWYgKExvY2FsQ29sbGVjdGlvbi5fb2JzZXJ2ZUNhbGxiYWNrc0FyZU9yZGVyZWQob2JzZXJ2ZUNhbGxiYWNrcykpIHtcbiAgICAvLyBUaGUgXCJfbm9faW5kaWNlc1wiIG9wdGlvbiBzZXRzIGFsbCBpbmRleCBhcmd1bWVudHMgdG8gLTEgYW5kIHNraXBzIHRoZVxuICAgIC8vIGxpbmVhciBzY2FucyByZXF1aXJlZCB0byBnZW5lcmF0ZSB0aGVtLiAgVGhpcyBsZXRzIG9ic2VydmVycyB0aGF0IGRvbid0XG4gICAgLy8gbmVlZCBhYnNvbHV0ZSBpbmRpY2VzIGJlbmVmaXQgZnJvbSB0aGUgb3RoZXIgZmVhdHVyZXMgb2YgdGhpcyBBUEkgLS1cbiAgICAvLyByZWxhdGl2ZSBvcmRlciwgdHJhbnNmb3JtcywgYW5kIGFwcGx5Q2hhbmdlcyAtLSB3aXRob3V0IHRoZSBzcGVlZCBoaXQuXG4gICAgY29uc3QgaW5kaWNlcyA9ICFvYnNlcnZlQ2FsbGJhY2tzLl9ub19pbmRpY2VzO1xuXG4gICAgb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3MgPSB7XG4gICAgICBhZGRlZEJlZm9yZShpZCwgZmllbGRzLCBiZWZvcmUpIHtcbiAgICAgICAgY29uc3QgY2hlY2sgPSBzdXBwcmVzc2VkIHx8ICEob2JzZXJ2ZUNhbGxiYWNrcy5hZGRlZEF0IHx8IG9ic2VydmVDYWxsYmFja3MuYWRkZWQpXG4gICAgICAgIGlmIChjaGVjaykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRvYyA9IHRyYW5zZm9ybShPYmplY3QuYXNzaWduKGZpZWxkcywge19pZDogaWR9KSk7XG5cbiAgICAgICAgaWYgKG9ic2VydmVDYWxsYmFja3MuYWRkZWRBdCkge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MuYWRkZWRBdChcbiAgICAgICAgICAgICAgZG9jLFxuICAgICAgICAgICAgICBpbmRpY2VzXG4gICAgICAgICAgICAgICAgICA/IGJlZm9yZVxuICAgICAgICAgICAgICAgICAgICAgID8gdGhpcy5kb2NzLmluZGV4T2YoYmVmb3JlKVxuICAgICAgICAgICAgICAgICAgICAgIDogdGhpcy5kb2NzLnNpemUoKVxuICAgICAgICAgICAgICAgICAgOiAtMSxcbiAgICAgICAgICAgICAgYmVmb3JlXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLmFkZGVkKGRvYyk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBjaGFuZ2VkKGlkLCBmaWVsZHMpIHtcblxuICAgICAgICBpZiAoIShvYnNlcnZlQ2FsbGJhY2tzLmNoYW5nZWRBdCB8fCBvYnNlcnZlQ2FsbGJhY2tzLmNoYW5nZWQpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGRvYyA9IEVKU09OLmNsb25lKHRoaXMuZG9jcy5nZXQoaWQpKTtcbiAgICAgICAgaWYgKCFkb2MpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gaWQgZm9yIGNoYW5nZWQ6ICR7aWR9YCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvbGREb2MgPSB0cmFuc2Zvcm0oRUpTT04uY2xvbmUoZG9jKSk7XG5cbiAgICAgICAgRGlmZlNlcXVlbmNlLmFwcGx5Q2hhbmdlcyhkb2MsIGZpZWxkcyk7XG5cbiAgICAgICAgaWYgKG9ic2VydmVDYWxsYmFja3MuY2hhbmdlZEF0KSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkQXQoXG4gICAgICAgICAgICAgIHRyYW5zZm9ybShkb2MpLFxuICAgICAgICAgICAgICBvbGREb2MsXG4gICAgICAgICAgICAgIGluZGljZXMgPyB0aGlzLmRvY3MuaW5kZXhPZihpZCkgOiAtMVxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkKHRyYW5zZm9ybShkb2MpLCBvbGREb2MpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgbW92ZWRCZWZvcmUoaWQsIGJlZm9yZSkge1xuICAgICAgICBpZiAoIW9ic2VydmVDYWxsYmFja3MubW92ZWRUbykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZyb20gPSBpbmRpY2VzID8gdGhpcy5kb2NzLmluZGV4T2YoaWQpIDogLTE7XG4gICAgICAgIGxldCB0byA9IGluZGljZXNcbiAgICAgICAgICAgID8gYmVmb3JlXG4gICAgICAgICAgICAgICAgPyB0aGlzLmRvY3MuaW5kZXhPZihiZWZvcmUpXG4gICAgICAgICAgICAgICAgOiB0aGlzLmRvY3Muc2l6ZSgpXG4gICAgICAgICAgICA6IC0xO1xuXG4gICAgICAgIC8vIFdoZW4gbm90IG1vdmluZyBiYWNrd2FyZHMsIGFkanVzdCBmb3IgdGhlIGZhY3QgdGhhdCByZW1vdmluZyB0aGVcbiAgICAgICAgLy8gZG9jdW1lbnQgc2xpZGVzIGV2ZXJ5dGhpbmcgYmFjayBvbmUgc2xvdC5cbiAgICAgICAgaWYgKHRvID4gZnJvbSkge1xuICAgICAgICAgIC0tdG87XG4gICAgICAgIH1cblxuICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLm1vdmVkVG8oXG4gICAgICAgICAgICB0cmFuc2Zvcm0oRUpTT04uY2xvbmUodGhpcy5kb2NzLmdldChpZCkpKSxcbiAgICAgICAgICAgIGZyb20sXG4gICAgICAgICAgICB0byxcbiAgICAgICAgICAgIGJlZm9yZSB8fCBudWxsXG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICAgcmVtb3ZlZChpZCkge1xuICAgICAgICBpZiAoIShvYnNlcnZlQ2FsbGJhY2tzLnJlbW92ZWRBdCB8fCBvYnNlcnZlQ2FsbGJhY2tzLnJlbW92ZWQpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGVjaG5pY2FsbHkgbWF5YmUgdGhlcmUgc2hvdWxkIGJlIGFuIEVKU09OLmNsb25lIGhlcmUsIGJ1dCBpdCdzIGFib3V0XG4gICAgICAgIC8vIHRvIGJlIHJlbW92ZWQgZnJvbSB0aGlzLmRvY3MhXG4gICAgICAgIGNvbnN0IGRvYyA9IHRyYW5zZm9ybSh0aGlzLmRvY3MuZ2V0KGlkKSk7XG5cbiAgICAgICAgaWYgKG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZEF0KSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5yZW1vdmVkQXQoZG9jLCBpbmRpY2VzID8gdGhpcy5kb2NzLmluZGV4T2YoaWQpIDogLTEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZChkb2MpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3MgPSB7XG4gICAgICBhZGRlZChpZCwgZmllbGRzKSB7XG4gICAgICAgIGlmICghc3VwcHJlc3NlZCAmJiBvYnNlcnZlQ2FsbGJhY2tzLmFkZGVkKSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5hZGRlZCh0cmFuc2Zvcm0oT2JqZWN0LmFzc2lnbihmaWVsZHMsIHtfaWQ6IGlkfSkpKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGNoYW5nZWQoaWQsIGZpZWxkcykge1xuICAgICAgICBpZiAob2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkKSB7XG4gICAgICAgICAgY29uc3Qgb2xkRG9jID0gdGhpcy5kb2NzLmdldChpZCk7XG4gICAgICAgICAgY29uc3QgZG9jID0gRUpTT04uY2xvbmUob2xkRG9jKTtcblxuICAgICAgICAgIERpZmZTZXF1ZW5jZS5hcHBseUNoYW5nZXMoZG9jLCBmaWVsZHMpO1xuXG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkKFxuICAgICAgICAgICAgICB0cmFuc2Zvcm0oZG9jKSxcbiAgICAgICAgICAgICAgdHJhbnNmb3JtKEVKU09OLmNsb25lKG9sZERvYykpXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHJlbW92ZWQoaWQpIHtcbiAgICAgICAgaWYgKG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZCkge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZCh0cmFuc2Zvcm0odGhpcy5kb2NzLmdldChpZCkpKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgY29uc3QgY2hhbmdlT2JzZXJ2ZXIgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9DYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIoe1xuICAgIGNhbGxiYWNrczogb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3NcbiAgfSk7XG5cbiAgLy8gQ2FjaGluZ0NoYW5nZU9ic2VydmVyIGNsb25lcyBhbGwgcmVjZWl2ZWQgaW5wdXQgb24gaXRzIGNhbGxiYWNrc1xuICAvLyBTbyB3ZSBjYW4gbWFyayBpdCBhcyBzYWZlIHRvIHJlZHVjZSB0aGUgZWpzb24gY2xvbmVzLlxuICAvLyBUaGlzIGlzIHRlc3RlZCBieSB0aGUgYG1vbmdvLWxpdmVkYXRhIC0gKGV4dGVuZGVkKSBzY3JpYmJsaW5nYCB0ZXN0c1xuICBjaGFuZ2VPYnNlcnZlci5hcHBseUNoYW5nZS5fZnJvbU9ic2VydmUgPSB0cnVlO1xuICBjb25zdCBoYW5kbGUgPSBjdXJzb3Iub2JzZXJ2ZUNoYW5nZXMoY2hhbmdlT2JzZXJ2ZXIuYXBwbHlDaGFuZ2UsXG4gICAgICB7IG5vbk11dGF0aW5nQ2FsbGJhY2tzOiB0cnVlIH0pO1xuXG4gIC8vIElmIG5lZWRlZCwgcmUtZW5hYmxlIGNhbGxiYWNrcyBhcyBzb29uIGFzIHRoZSBpbml0aWFsIGJhdGNoIGlzIHJlYWR5LlxuICBjb25zdCBzZXRTdXBwcmVzc2VkID0gKGgpID0+IHtcbiAgICBpZiAoaC5pc1JlYWR5KSBzdXBwcmVzc2VkID0gZmFsc2U7XG4gICAgZWxzZSBoLmlzUmVhZHlQcm9taXNlPy50aGVuKCgpID0+IChzdXBwcmVzc2VkID0gZmFsc2UpKTtcbiAgfTtcbiAgLy8gV2hlbiB3ZSBjYWxsIGN1cnNvci5vYnNlcnZlQ2hhbmdlcygpIGl0IGNhbiBiZSB0aGUgb24gZnJvbVxuICAvLyB0aGUgbW9uZ28gcGFja2FnZSAoaW5zdGVhZCBvZiB0aGUgbWluaW1vbmdvIG9uZSkgYW5kIGl0IGRvZXNuJ3QgaGF2ZSBpc1JlYWR5IGFuZCBpc1JlYWR5UHJvbWlzZVxuICBpZiAoTWV0ZW9yLl9pc1Byb21pc2UoaGFuZGxlKSkge1xuICAgIGhhbmRsZS50aGVuKHNldFN1cHByZXNzZWQpO1xuICB9IGVsc2Uge1xuICAgIHNldFN1cHByZXNzZWQoaGFuZGxlKTtcbiAgfVxuICByZXR1cm4gaGFuZGxlO1xufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlQ2FsbGJhY2tzQXJlT3JkZXJlZCA9IGNhbGxiYWNrcyA9PiB7XG4gIGlmIChjYWxsYmFja3MuYWRkZWQgJiYgY2FsbGJhY2tzLmFkZGVkQXQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBzcGVjaWZ5IG9ubHkgb25lIG9mIGFkZGVkKCkgYW5kIGFkZGVkQXQoKScpO1xuICB9XG5cbiAgaWYgKGNhbGxiYWNrcy5jaGFuZ2VkICYmIGNhbGxiYWNrcy5jaGFuZ2VkQXQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBzcGVjaWZ5IG9ubHkgb25lIG9mIGNoYW5nZWQoKSBhbmQgY2hhbmdlZEF0KCknKTtcbiAgfVxuXG4gIGlmIChjYWxsYmFja3MucmVtb3ZlZCAmJiBjYWxsYmFja3MucmVtb3ZlZEF0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2Ugc3BlY2lmeSBvbmx5IG9uZSBvZiByZW1vdmVkKCkgYW5kIHJlbW92ZWRBdCgpJyk7XG4gIH1cblxuICByZXR1cm4gISEoXG4gICAgY2FsbGJhY2tzLmFkZGVkQXQgfHxcbiAgICBjYWxsYmFja3MuY2hhbmdlZEF0IHx8XG4gICAgY2FsbGJhY2tzLm1vdmVkVG8gfHxcbiAgICBjYWxsYmFja3MucmVtb3ZlZEF0XG4gICk7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZCA9IGNhbGxiYWNrcyA9PiB7XG4gIGlmIChjYWxsYmFja3MuYWRkZWQgJiYgY2FsbGJhY2tzLmFkZGVkQmVmb3JlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2Ugc3BlY2lmeSBvbmx5IG9uZSBvZiBhZGRlZCgpIGFuZCBhZGRlZEJlZm9yZSgpJyk7XG4gIH1cblxuICByZXR1cm4gISEoY2FsbGJhY2tzLmFkZGVkQmVmb3JlIHx8IGNhbGxiYWNrcy5tb3ZlZEJlZm9yZSk7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX3JlbW92ZUZyb21SZXN1bHRzU3luYyA9IChxdWVyeSwgZG9jKSA9PiB7XG4gIGlmIChxdWVyeS5vcmRlcmVkKSB7XG4gICAgY29uc3QgaSA9IExvY2FsQ29sbGVjdGlvbi5fZmluZEluT3JkZXJlZFJlc3VsdHMocXVlcnksIGRvYyk7XG5cbiAgICBxdWVyeS5yZW1vdmVkKGRvYy5faWQpO1xuICAgIHF1ZXJ5LnJlc3VsdHMuc3BsaWNlKGksIDEpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGlkID0gZG9jLl9pZDsgIC8vIGluIGNhc2UgY2FsbGJhY2sgbXV0YXRlcyBkb2NcblxuICAgIHF1ZXJ5LnJlbW92ZWQoZG9jLl9pZCk7XG4gICAgcXVlcnkucmVzdWx0cy5yZW1vdmUoaWQpO1xuICB9XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX3JlbW92ZUZyb21SZXN1bHRzQXN5bmMgPSBhc3luYyAocXVlcnksIGRvYykgPT4ge1xuICBpZiAocXVlcnkub3JkZXJlZCkge1xuICAgIGNvbnN0IGkgPSBMb2NhbENvbGxlY3Rpb24uX2ZpbmRJbk9yZGVyZWRSZXN1bHRzKHF1ZXJ5LCBkb2MpO1xuXG4gICAgYXdhaXQgcXVlcnkucmVtb3ZlZChkb2MuX2lkKTtcbiAgICBxdWVyeS5yZXN1bHRzLnNwbGljZShpLCAxKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBpZCA9IGRvYy5faWQ7ICAvLyBpbiBjYXNlIGNhbGxiYWNrIG11dGF0ZXMgZG9jXG5cbiAgICBhd2FpdCBxdWVyeS5yZW1vdmVkKGRvYy5faWQpO1xuICAgIHF1ZXJ5LnJlc3VsdHMucmVtb3ZlKGlkKTtcbiAgfVxufTtcblxuLy8gSXMgdGhpcyBzZWxlY3RvciBqdXN0IHNob3J0aGFuZCBmb3IgbG9va3VwIGJ5IF9pZD9cbkxvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkID0gc2VsZWN0b3IgPT5cbiAgdHlwZW9mIHNlbGVjdG9yID09PSAnbnVtYmVyJyB8fFxuICB0eXBlb2Ygc2VsZWN0b3IgPT09ICdzdHJpbmcnIHx8XG4gIHNlbGVjdG9yIGluc3RhbmNlb2YgTW9uZ29JRC5PYmplY3RJRFxuO1xuXG4vLyBJcyB0aGUgc2VsZWN0b3IganVzdCBsb29rdXAgYnkgX2lkIChzaG9ydGhhbmQgb3Igbm90KT9cbkxvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkUGVyaGFwc0FzT2JqZWN0ID0gc2VsZWN0b3IgPT5cbiAgTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQoc2VsZWN0b3IpIHx8XG4gIExvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkKHNlbGVjdG9yICYmIHNlbGVjdG9yLl9pZCkgJiZcbiAgT2JqZWN0LmtleXMoc2VsZWN0b3IpLmxlbmd0aCA9PT0gMVxuO1xuXG5Mb2NhbENvbGxlY3Rpb24uX3VwZGF0ZUluUmVzdWx0c1N5bmMgPSAocXVlcnksIGRvYywgb2xkX2RvYykgPT4ge1xuICBpZiAoIUVKU09OLmVxdWFscyhkb2MuX2lkLCBvbGRfZG9jLl9pZCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhblxcJ3QgY2hhbmdlIGEgZG9jXFwncyBfaWQgd2hpbGUgdXBkYXRpbmcnKTtcbiAgfVxuXG4gIGNvbnN0IHByb2plY3Rpb25GbiA9IHF1ZXJ5LnByb2plY3Rpb25GbjtcbiAgY29uc3QgY2hhbmdlZEZpZWxkcyA9IERpZmZTZXF1ZW5jZS5tYWtlQ2hhbmdlZEZpZWxkcyhcbiAgICBwcm9qZWN0aW9uRm4oZG9jKSxcbiAgICBwcm9qZWN0aW9uRm4ob2xkX2RvYylcbiAgKTtcblxuICBpZiAoIXF1ZXJ5Lm9yZGVyZWQpIHtcbiAgICBpZiAoT2JqZWN0LmtleXMoY2hhbmdlZEZpZWxkcykubGVuZ3RoKSB7XG4gICAgICBxdWVyeS5jaGFuZ2VkKGRvYy5faWQsIGNoYW5nZWRGaWVsZHMpO1xuICAgICAgcXVlcnkucmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICB9XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBvbGRfaWR4ID0gTG9jYWxDb2xsZWN0aW9uLl9maW5kSW5PcmRlcmVkUmVzdWx0cyhxdWVyeSwgZG9jKTtcblxuICBpZiAoT2JqZWN0LmtleXMoY2hhbmdlZEZpZWxkcykubGVuZ3RoKSB7XG4gICAgcXVlcnkuY2hhbmdlZChkb2MuX2lkLCBjaGFuZ2VkRmllbGRzKTtcbiAgfVxuXG4gIGlmICghcXVlcnkuc29ydGVyKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8ganVzdCB0YWtlIGl0IG91dCBhbmQgcHV0IGl0IGJhY2sgaW4gYWdhaW4sIGFuZCBzZWUgaWYgdGhlIGluZGV4IGNoYW5nZXNcbiAgcXVlcnkucmVzdWx0cy5zcGxpY2Uob2xkX2lkeCwgMSk7XG5cbiAgY29uc3QgbmV3X2lkeCA9IExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5Tb3J0ZWRMaXN0KFxuICAgIHF1ZXJ5LnNvcnRlci5nZXRDb21wYXJhdG9yKHtkaXN0YW5jZXM6IHF1ZXJ5LmRpc3RhbmNlc30pLFxuICAgIHF1ZXJ5LnJlc3VsdHMsXG4gICAgZG9jXG4gICk7XG5cbiAgaWYgKG9sZF9pZHggIT09IG5ld19pZHgpIHtcbiAgICBsZXQgbmV4dCA9IHF1ZXJ5LnJlc3VsdHNbbmV3X2lkeCArIDFdO1xuICAgIGlmIChuZXh0KSB7XG4gICAgICBuZXh0ID0gbmV4dC5faWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHQgPSBudWxsO1xuICAgIH1cblxuICAgIHF1ZXJ5Lm1vdmVkQmVmb3JlICYmIHF1ZXJ5Lm1vdmVkQmVmb3JlKGRvYy5faWQsIG5leHQpO1xuICB9XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX3VwZGF0ZUluUmVzdWx0c0FzeW5jID0gYXN5bmMgKHF1ZXJ5LCBkb2MsIG9sZF9kb2MpID0+IHtcbiAgaWYgKCFFSlNPTi5lcXVhbHMoZG9jLl9pZCwgb2xkX2RvYy5faWQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IGNoYW5nZSBhIGRvY1xcJ3MgX2lkIHdoaWxlIHVwZGF0aW5nJyk7XG4gIH1cblxuICBjb25zdCBwcm9qZWN0aW9uRm4gPSBxdWVyeS5wcm9qZWN0aW9uRm47XG4gIGNvbnN0IGNoYW5nZWRGaWVsZHMgPSBEaWZmU2VxdWVuY2UubWFrZUNoYW5nZWRGaWVsZHMoXG4gICAgcHJvamVjdGlvbkZuKGRvYyksXG4gICAgcHJvamVjdGlvbkZuKG9sZF9kb2MpXG4gICk7XG5cbiAgaWYgKCFxdWVyeS5vcmRlcmVkKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKGNoYW5nZWRGaWVsZHMpLmxlbmd0aCkge1xuICAgICAgYXdhaXQgcXVlcnkuY2hhbmdlZChkb2MuX2lkLCBjaGFuZ2VkRmllbGRzKTtcbiAgICAgIHF1ZXJ5LnJlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gICAgfVxuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qgb2xkX2lkeCA9IExvY2FsQ29sbGVjdGlvbi5fZmluZEluT3JkZXJlZFJlc3VsdHMocXVlcnksIGRvYyk7XG5cbiAgaWYgKE9iamVjdC5rZXlzKGNoYW5nZWRGaWVsZHMpLmxlbmd0aCkge1xuICAgIGF3YWl0IHF1ZXJ5LmNoYW5nZWQoZG9jLl9pZCwgY2hhbmdlZEZpZWxkcyk7XG4gIH1cblxuICBpZiAoIXF1ZXJ5LnNvcnRlcikge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIGp1c3QgdGFrZSBpdCBvdXQgYW5kIHB1dCBpdCBiYWNrIGluIGFnYWluLCBhbmQgc2VlIGlmIHRoZSBpbmRleCBjaGFuZ2VzXG4gIHF1ZXJ5LnJlc3VsdHMuc3BsaWNlKG9sZF9pZHgsIDEpO1xuXG4gIGNvbnN0IG5ld19pZHggPSBMb2NhbENvbGxlY3Rpb24uX2luc2VydEluU29ydGVkTGlzdChcbiAgICBxdWVyeS5zb3J0ZXIuZ2V0Q29tcGFyYXRvcih7ZGlzdGFuY2VzOiBxdWVyeS5kaXN0YW5jZXN9KSxcbiAgICBxdWVyeS5yZXN1bHRzLFxuICAgIGRvY1xuICApO1xuXG4gIGlmIChvbGRfaWR4ICE9PSBuZXdfaWR4KSB7XG4gICAgbGV0IG5leHQgPSBxdWVyeS5yZXN1bHRzW25ld19pZHggKyAxXTtcbiAgICBpZiAobmV4dCkge1xuICAgICAgbmV4dCA9IG5leHQuX2lkO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBxdWVyeS5tb3ZlZEJlZm9yZSAmJiBhd2FpdCBxdWVyeS5tb3ZlZEJlZm9yZShkb2MuX2lkLCBuZXh0KTtcbiAgfVxufTtcblxuY29uc3QgTU9ESUZJRVJTID0ge1xuICAkY3VycmVudERhdGUodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGhhc093bi5jYWxsKGFyZywgJyR0eXBlJykpIHtcbiAgICAgIGlmIChhcmcuJHR5cGUgIT09ICdkYXRlJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAnTWluaW1vbmdvIGRvZXMgY3VycmVudGx5IG9ubHkgc3VwcG9ydCB0aGUgZGF0ZSB0eXBlIGluICcgK1xuICAgICAgICAgICckY3VycmVudERhdGUgbW9kaWZpZXJzJyxcbiAgICAgICAgICB7ZmllbGR9XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChhcmcgIT09IHRydWUpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdJbnZhbGlkICRjdXJyZW50RGF0ZSBtb2RpZmllcicsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIHRhcmdldFtmaWVsZF0gPSBuZXcgRGF0ZSgpO1xuICB9LFxuICAkaW5jKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0eXBlb2YgYXJnICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ01vZGlmaWVyICRpbmMgYWxsb3dlZCBmb3IgbnVtYmVycyBvbmx5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKGZpZWxkIGluIHRhcmdldCkge1xuICAgICAgaWYgKHR5cGVvZiB0YXJnZXRbZmllbGRdICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAnQ2Fubm90IGFwcGx5ICRpbmMgbW9kaWZpZXIgdG8gbm9uLW51bWJlcicsXG4gICAgICAgICAge2ZpZWxkfVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICB0YXJnZXRbZmllbGRdICs9IGFyZztcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0W2ZpZWxkXSA9IGFyZztcbiAgICB9XG4gIH0sXG4gICRtaW4odGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHR5cGVvZiBhcmcgIT09ICdudW1iZXInKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignTW9kaWZpZXIgJG1pbiBhbGxvd2VkIGZvciBudW1iZXJzIG9ubHknLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAoZmllbGQgaW4gdGFyZ2V0KSB7XG4gICAgICBpZiAodHlwZW9mIHRhcmdldFtmaWVsZF0gIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICdDYW5ub3QgYXBwbHkgJG1pbiBtb2RpZmllciB0byBub24tbnVtYmVyJyxcbiAgICAgICAgICB7ZmllbGR9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0YXJnZXRbZmllbGRdID4gYXJnKSB7XG4gICAgICAgIHRhcmdldFtmaWVsZF0gPSBhcmc7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldFtmaWVsZF0gPSBhcmc7XG4gICAgfVxuICB9LFxuICAkbWF4KHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0eXBlb2YgYXJnICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ01vZGlmaWVyICRtYXggYWxsb3dlZCBmb3IgbnVtYmVycyBvbmx5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKGZpZWxkIGluIHRhcmdldCkge1xuICAgICAgaWYgKHR5cGVvZiB0YXJnZXRbZmllbGRdICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAnQ2Fubm90IGFwcGx5ICRtYXggbW9kaWZpZXIgdG8gbm9uLW51bWJlcicsXG4gICAgICAgICAge2ZpZWxkfVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAodGFyZ2V0W2ZpZWxkXSA8IGFyZykge1xuICAgICAgICB0YXJnZXRbZmllbGRdID0gYXJnO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRbZmllbGRdID0gYXJnO1xuICAgIH1cbiAgfSxcbiAgJG11bCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodHlwZW9mIGFyZyAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdNb2RpZmllciAkbXVsIGFsbG93ZWQgZm9yIG51bWJlcnMgb25seScsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmIChmaWVsZCBpbiB0YXJnZXQpIHtcbiAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2ZpZWxkXSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgJ0Nhbm5vdCBhcHBseSAkbXVsIG1vZGlmaWVyIHRvIG5vbi1udW1iZXInLFxuICAgICAgICAgIHtmaWVsZH1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgdGFyZ2V0W2ZpZWxkXSAqPSBhcmc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldFtmaWVsZF0gPSAwO1xuICAgIH1cbiAgfSxcbiAgJHJlbmFtZSh0YXJnZXQsIGZpZWxkLCBhcmcsIGtleXBhdGgsIGRvYykge1xuICAgIC8vIG5vIGlkZWEgd2h5IG1vbmdvIGhhcyB0aGlzIHJlc3RyaWN0aW9uLi5cbiAgICBpZiAoa2V5cGF0aCA9PT0gYXJnKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJHJlbmFtZSBzb3VyY2UgbXVzdCBkaWZmZXIgZnJvbSB0YXJnZXQnLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAodGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJHJlbmFtZSBzb3VyY2UgZmllbGQgaW52YWxpZCcsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgYXJnICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRyZW5hbWUgdGFyZ2V0IG11c3QgYmUgYSBzdHJpbmcnLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAoYXJnLmluY2x1ZGVzKCdcXDAnKSkge1xuICAgICAgLy8gTnVsbCBieXRlcyBhcmUgbm90IGFsbG93ZWQgaW4gTW9uZ28gZmllbGQgbmFtZXNcbiAgICAgIC8vIGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL2xpbWl0cy8jUmVzdHJpY3Rpb25zLW9uLUZpZWxkLU5hbWVzXG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ1RoZSBcXCd0b1xcJyBmaWVsZCBmb3IgJHJlbmFtZSBjYW5ub3QgY29udGFpbiBhbiBlbWJlZGRlZCBudWxsIGJ5dGUnLFxuICAgICAgICB7ZmllbGR9XG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG9iamVjdCA9IHRhcmdldFtmaWVsZF07XG5cbiAgICBkZWxldGUgdGFyZ2V0W2ZpZWxkXTtcblxuICAgIGNvbnN0IGtleXBhcnRzID0gYXJnLnNwbGl0KCcuJyk7XG4gICAgY29uc3QgdGFyZ2V0MiA9IGZpbmRNb2RUYXJnZXQoZG9jLCBrZXlwYXJ0cywge2ZvcmJpZEFycmF5OiB0cnVlfSk7XG5cbiAgICBpZiAodGFyZ2V0MiA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRyZW5hbWUgdGFyZ2V0IGZpZWxkIGludmFsaWQnLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICB0YXJnZXQyW2tleXBhcnRzLnBvcCgpXSA9IG9iamVjdDtcbiAgfSxcbiAgJHNldCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodGFyZ2V0ICE9PSBPYmplY3QodGFyZ2V0KSkgeyAvLyBub3QgYW4gYXJyYXkgb3IgYW4gb2JqZWN0XG4gICAgICBjb25zdCBlcnJvciA9IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnQ2Fubm90IHNldCBwcm9wZXJ0eSBvbiBub24tb2JqZWN0IGZpZWxkJyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICAgIGVycm9yLnNldFByb3BlcnR5RXJyb3IgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldCA9PT0gbnVsbCkge1xuICAgICAgY29uc3QgZXJyb3IgPSBNaW5pbW9uZ29FcnJvcignQ2Fubm90IHNldCBwcm9wZXJ0eSBvbiBudWxsJywge2ZpZWxkfSk7XG4gICAgICBlcnJvci5zZXRQcm9wZXJ0eUVycm9yID0gdHJ1ZTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cblxuICAgIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyhhcmcpO1xuXG4gICAgdGFyZ2V0W2ZpZWxkXSA9IGFyZztcbiAgfSxcbiAgJHNldE9uSW5zZXJ0KHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIC8vIGNvbnZlcnRlZCB0byBgJHNldGAgaW4gYF9tb2RpZnlgXG4gIH0sXG4gICR1bnNldCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodGFyZ2V0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICBpZiAoZmllbGQgaW4gdGFyZ2V0KSB7XG4gICAgICAgICAgdGFyZ2V0W2ZpZWxkXSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSB0YXJnZXRbZmllbGRdO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgJHB1c2godGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHRhcmdldFtmaWVsZF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGFyZ2V0W2ZpZWxkXSA9IFtdO1xuICAgIH1cblxuICAgIGlmICghKHRhcmdldFtmaWVsZF0gaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdDYW5ub3QgYXBwbHkgJHB1c2ggbW9kaWZpZXIgdG8gbm9uLWFycmF5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKCEoYXJnICYmIGFyZy4kZWFjaCkpIHtcbiAgICAgIC8vIFNpbXBsZSBtb2RlOiBub3QgJGVhY2hcbiAgICAgIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyhhcmcpO1xuXG4gICAgICB0YXJnZXRbZmllbGRdLnB1c2goYXJnKTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEZhbmN5IG1vZGU6ICRlYWNoIChhbmQgbWF5YmUgJHNsaWNlIGFuZCAkc29ydCBhbmQgJHBvc2l0aW9uKVxuICAgIGNvbnN0IHRvUHVzaCA9IGFyZy4kZWFjaDtcbiAgICBpZiAoISh0b1B1c2ggaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckZWFjaCBtdXN0IGJlIGFuIGFycmF5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzKHRvUHVzaCk7XG5cbiAgICAvLyBQYXJzZSAkcG9zaXRpb25cbiAgICBsZXQgcG9zaXRpb24gPSB1bmRlZmluZWQ7XG4gICAgaWYgKCckcG9zaXRpb24nIGluIGFyZykge1xuICAgICAgaWYgKHR5cGVvZiBhcmcuJHBvc2l0aW9uICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJHBvc2l0aW9uIG11c3QgYmUgYSBudW1lcmljIHZhbHVlJywge2ZpZWxkfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCBzaG91bGQgY2hlY2sgdG8gbWFrZSBzdXJlIGludGVnZXJcbiAgICAgIGlmIChhcmcuJHBvc2l0aW9uIDwgMCkge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAnJHBvc2l0aW9uIGluICRwdXNoIG11c3QgYmUgemVybyBvciBwb3NpdGl2ZScsXG4gICAgICAgICAge2ZpZWxkfVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBwb3NpdGlvbiA9IGFyZy4kcG9zaXRpb247XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgJHNsaWNlLlxuICAgIGxldCBzbGljZSA9IHVuZGVmaW5lZDtcbiAgICBpZiAoJyRzbGljZScgaW4gYXJnKSB7XG4gICAgICBpZiAodHlwZW9mIGFyZy4kc2xpY2UgIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckc2xpY2UgbXVzdCBiZSBhIG51bWVyaWMgdmFsdWUnLCB7ZmllbGR9KTtcbiAgICAgIH1cblxuICAgICAgLy8gWFhYIHNob3VsZCBjaGVjayB0byBtYWtlIHN1cmUgaW50ZWdlclxuICAgICAgc2xpY2UgPSBhcmcuJHNsaWNlO1xuICAgIH1cblxuICAgIC8vIFBhcnNlICRzb3J0LlxuICAgIGxldCBzb3J0RnVuY3Rpb24gPSB1bmRlZmluZWQ7XG4gICAgaWYgKGFyZy4kc29ydCkge1xuICAgICAgaWYgKHNsaWNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRzb3J0IHJlcXVpcmVzICRzbGljZSB0byBiZSBwcmVzZW50Jywge2ZpZWxkfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCB0aGlzIGFsbG93cyB1cyB0byB1c2UgYSAkc29ydCB3aG9zZSB2YWx1ZSBpcyBhbiBhcnJheSwgYnV0IHRoYXQnc1xuICAgICAgLy8gYWN0dWFsbHkgYW4gZXh0ZW5zaW9uIG9mIHRoZSBOb2RlIGRyaXZlciwgc28gaXQgd29uJ3Qgd29ya1xuICAgICAgLy8gc2VydmVyLXNpZGUuIENvdWxkIGJlIGNvbmZ1c2luZyFcbiAgICAgIC8vIFhYWCBpcyBpdCBjb3JyZWN0IHRoYXQgd2UgZG9uJ3QgZG8gZ2VvLXN0dWZmIGhlcmU/XG4gICAgICBzb3J0RnVuY3Rpb24gPSBuZXcgTWluaW1vbmdvLlNvcnRlcihhcmcuJHNvcnQpLmdldENvbXBhcmF0b3IoKTtcblxuICAgICAgdG9QdXNoLmZvckVhY2goZWxlbWVudCA9PiB7XG4gICAgICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUoZWxlbWVudCkgIT09IDMpIHtcbiAgICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAgICckcHVzaCBsaWtlIG1vZGlmaWVycyB1c2luZyAkc29ydCByZXF1aXJlIGFsbCBlbGVtZW50cyB0byBiZSAnICtcbiAgICAgICAgICAgICdvYmplY3RzJyxcbiAgICAgICAgICAgIHtmaWVsZH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBY3R1YWxseSBwdXNoLlxuICAgIGlmIChwb3NpdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0b1B1c2guZm9yRWFjaChlbGVtZW50ID0+IHtcbiAgICAgICAgdGFyZ2V0W2ZpZWxkXS5wdXNoKGVsZW1lbnQpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHNwbGljZUFyZ3VtZW50cyA9IFtwb3NpdGlvbiwgMF07XG5cbiAgICAgIHRvUHVzaC5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgICAgICBzcGxpY2VBcmd1bWVudHMucHVzaChlbGVtZW50KTtcbiAgICAgIH0pO1xuXG4gICAgICB0YXJnZXRbZmllbGRdLnNwbGljZSguLi5zcGxpY2VBcmd1bWVudHMpO1xuICAgIH1cblxuICAgIC8vIEFjdHVhbGx5IHNvcnQuXG4gICAgaWYgKHNvcnRGdW5jdGlvbikge1xuICAgICAgdGFyZ2V0W2ZpZWxkXS5zb3J0KHNvcnRGdW5jdGlvbik7XG4gICAgfVxuXG4gICAgLy8gQWN0dWFsbHkgc2xpY2UuXG4gICAgaWYgKHNsaWNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChzbGljZSA9PT0gMCkge1xuICAgICAgICB0YXJnZXRbZmllbGRdID0gW107IC8vIGRpZmZlcnMgZnJvbSBBcnJheS5zbGljZSFcbiAgICAgIH0gZWxzZSBpZiAoc2xpY2UgPCAwKSB7XG4gICAgICAgIHRhcmdldFtmaWVsZF0gPSB0YXJnZXRbZmllbGRdLnNsaWNlKHNsaWNlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhcmdldFtmaWVsZF0gPSB0YXJnZXRbZmllbGRdLnNsaWNlKDAsIHNsaWNlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICRwdXNoQWxsKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICghKHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ01vZGlmaWVyICRwdXNoQWxsL3B1bGxBbGwgYWxsb3dlZCBmb3IgYXJyYXlzIG9ubHknKTtcbiAgICB9XG5cbiAgICBhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXMoYXJnKTtcblxuICAgIGNvbnN0IHRvUHVzaCA9IHRhcmdldFtmaWVsZF07XG5cbiAgICBpZiAodG9QdXNoID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRhcmdldFtmaWVsZF0gPSBhcmc7XG4gICAgfSBlbHNlIGlmICghKHRvUHVzaCBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdDYW5ub3QgYXBwbHkgJHB1c2hBbGwgbW9kaWZpZXIgdG8gbm9uLWFycmF5JyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdG9QdXNoLnB1c2goLi4uYXJnKTtcbiAgICB9XG4gIH0sXG4gICRhZGRUb1NldCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBsZXQgaXNFYWNoID0gZmFsc2U7XG5cbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ29iamVjdCcpIHtcbiAgICAgIC8vIGNoZWNrIGlmIGZpcnN0IGtleSBpcyAnJGVhY2gnXG4gICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMoYXJnKTtcbiAgICAgIGlmIChrZXlzWzBdID09PSAnJGVhY2gnKSB7XG4gICAgICAgIGlzRWFjaCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdmFsdWVzID0gaXNFYWNoID8gYXJnLiRlYWNoIDogW2FyZ107XG5cbiAgICBhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXModmFsdWVzKTtcblxuICAgIGNvbnN0IHRvQWRkID0gdGFyZ2V0W2ZpZWxkXTtcbiAgICBpZiAodG9BZGQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGFyZ2V0W2ZpZWxkXSA9IHZhbHVlcztcbiAgICB9IGVsc2UgaWYgKCEodG9BZGQgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnQ2Fubm90IGFwcGx5ICRhZGRUb1NldCBtb2RpZmllciB0byBub24tYXJyYXknLFxuICAgICAgICB7ZmllbGR9XG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZXMuZm9yRWFjaCh2YWx1ZSA9PiB7XG4gICAgICAgIGlmICh0b0FkZC5zb21lKGVsZW1lbnQgPT4gTG9jYWxDb2xsZWN0aW9uLl9mLl9lcXVhbCh2YWx1ZSwgZWxlbWVudCkpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdG9BZGQucHVzaCh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG4gICRwb3AodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdG9Qb3AgPSB0YXJnZXRbZmllbGRdO1xuXG4gICAgaWYgKHRvUG9wID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoISh0b1BvcCBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ0Nhbm5vdCBhcHBseSAkcG9wIG1vZGlmaWVyIHRvIG5vbi1hcnJheScsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJyAmJiBhcmcgPCAwKSB7XG4gICAgICB0b1BvcC5zcGxpY2UoMCwgMSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRvUG9wLnBvcCgpO1xuICAgIH1cbiAgfSxcbiAgJHB1bGwodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdG9QdWxsID0gdGFyZ2V0W2ZpZWxkXTtcbiAgICBpZiAodG9QdWxsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoISh0b1B1bGwgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnQ2Fubm90IGFwcGx5ICRwdWxsL3B1bGxBbGwgbW9kaWZpZXIgdG8gbm9uLWFycmF5JyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBsZXQgb3V0O1xuICAgIGlmIChhcmcgIT0gbnVsbCAmJiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiAhKGFyZyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgLy8gWFhYIHdvdWxkIGJlIG11Y2ggbmljZXIgdG8gY29tcGlsZSB0aGlzIG9uY2UsIHJhdGhlciB0aGFuXG4gICAgICAvLyBmb3IgZWFjaCBkb2N1bWVudCB3ZSBtb2RpZnkuLiBidXQgdXN1YWxseSB3ZSdyZSBub3RcbiAgICAgIC8vIG1vZGlmeWluZyB0aGF0IG1hbnkgZG9jdW1lbnRzLCBzbyB3ZSdsbCBsZXQgaXQgc2xpZGUgZm9yXG4gICAgICAvLyBub3dcblxuICAgICAgLy8gWFhYIE1pbmltb25nby5NYXRjaGVyIGlzbid0IHVwIGZvciB0aGUgam9iLCBiZWNhdXNlIHdlIG5lZWRcbiAgICAgIC8vIHRvIHBlcm1pdCBzdHVmZiBsaWtlIHskcHVsbDoge2E6IHskZ3Q6IDR9fX0uLiBzb21ldGhpbmdcbiAgICAgIC8vIGxpa2UgeyRndDogNH0gaXMgbm90IG5vcm1hbGx5IGEgY29tcGxldGUgc2VsZWN0b3IuXG4gICAgICAvLyBzYW1lIGlzc3VlIGFzICRlbGVtTWF0Y2ggcG9zc2libHk/XG4gICAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKGFyZyk7XG5cbiAgICAgIG91dCA9IHRvUHVsbC5maWx0ZXIoZWxlbWVudCA9PiAhbWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZWxlbWVudCkucmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0ID0gdG9QdWxsLmZpbHRlcihlbGVtZW50ID0+ICFMb2NhbENvbGxlY3Rpb24uX2YuX2VxdWFsKGVsZW1lbnQsIGFyZykpO1xuICAgIH1cblxuICAgIHRhcmdldFtmaWVsZF0gPSBvdXQ7XG4gIH0sXG4gICRwdWxsQWxsKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICghKHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdNb2RpZmllciAkcHVzaEFsbC9wdWxsQWxsIGFsbG93ZWQgZm9yIGFycmF5cyBvbmx5JyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCB0b1B1bGwgPSB0YXJnZXRbZmllbGRdO1xuXG4gICAgaWYgKHRvUHVsbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCEodG9QdWxsIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ0Nhbm5vdCBhcHBseSAkcHVsbC9wdWxsQWxsIG1vZGlmaWVyIHRvIG5vbi1hcnJheScsXG4gICAgICAgIHtmaWVsZH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGFyZ2V0W2ZpZWxkXSA9IHRvUHVsbC5maWx0ZXIob2JqZWN0ID0+XG4gICAgICAhYXJnLnNvbWUoZWxlbWVudCA9PiBMb2NhbENvbGxlY3Rpb24uX2YuX2VxdWFsKG9iamVjdCwgZWxlbWVudCkpXG4gICAgKTtcbiAgfSxcbiAgJGJpdCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICAvLyBYWFggbW9uZ28gb25seSBzdXBwb3J0cyAkYml0IG9uIGludGVnZXJzLCBhbmQgd2Ugb25seSBzdXBwb3J0XG4gICAgLy8gbmF0aXZlIGphdmFzY3JpcHQgbnVtYmVycyAoZG91Ymxlcykgc28gZmFyLCBzbyB3ZSBjYW4ndCBzdXBwb3J0ICRiaXRcbiAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJGJpdCBpcyBub3Qgc3VwcG9ydGVkJywge2ZpZWxkfSk7XG4gIH0sXG4gICR2KCkge1xuICAgIC8vIEFzIGRpc2N1c3NlZCBpbiBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvOTYyMyxcbiAgICAvLyB0aGUgYCR2YCBvcGVyYXRvciBpcyBub3QgbmVlZGVkIGJ5IE1ldGVvciwgYnV0IHByb2JsZW1zIGNhbiBvY2N1ciBpZlxuICAgIC8vIGl0J3Mgbm90IGF0IGxlYXN0IGNhbGxhYmxlIChhcyBvZiBNb25nbyA+PSAzLjYpLiBJdCdzIGRlZmluZWQgaGVyZSBhc1xuICAgIC8vIGEgbm8tb3AgdG8gd29yayBhcm91bmQgdGhlc2UgcHJvYmxlbXMuXG4gIH1cbn07XG5cbmNvbnN0IE5PX0NSRUFURV9NT0RJRklFUlMgPSB7XG4gICRwb3A6IHRydWUsXG4gICRwdWxsOiB0cnVlLFxuICAkcHVsbEFsbDogdHJ1ZSxcbiAgJHJlbmFtZTogdHJ1ZSxcbiAgJHVuc2V0OiB0cnVlXG59O1xuXG4vLyBNYWtlIHN1cmUgZmllbGQgbmFtZXMgZG8gbm90IGNvbnRhaW4gTW9uZ28gcmVzdHJpY3RlZFxuLy8gY2hhcmFjdGVycyAoJyQnLCAnXFwwJykgb3IgaW52YWxpZCBkb3QgdXNhZ2UgKGxlYWRpbmcvdHJhaWxpbmcvY29uc2VjdXRpdmUgJy4nKS5cbi8vIGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL2xpbWl0cy8jUmVzdHJpY3Rpb25zLW9uLUZpZWxkLU5hbWVzXG5jb25zdCBpbnZhbGlkQ2hhck1zZyA9IHtcbiAgJDogJ3N0YXJ0IHdpdGggXFwnJFxcJycsXG4gICcuJzogJ3N0YXJ0IG9yIGVuZCB3aXRoIFxcJy5cXCcnLFxuICAnLi4nOiAnY29udGFpbiBjb25zZWN1dGl2ZSBkb3RzJyxcbiAgJ1xcMCc6ICdjb250YWluIG51bGwgYnl0ZXMnXG59O1xuXG4vLyBjaGVja3MgaWYgYWxsIGZpZWxkIG5hbWVzIGluIGFuIG9iamVjdCBhcmUgdmFsaWRcbmZ1bmN0aW9uIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyhkb2MpIHtcbiAgaWYgKGRvYyAmJiB0eXBlb2YgZG9jID09PSAnb2JqZWN0Jykge1xuICAgIEpTT04uc3RyaW5naWZ5KGRvYywgKGtleSwgdmFsdWUpID0+IHtcbiAgICAgIGFzc2VydElzVmFsaWRGaWVsZE5hbWUoa2V5KTtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NlcnRJc1ZhbGlkRmllbGROYW1lKGtleSkge1xuICBsZXQgbWF0Y2g7XG4gIGlmICh0eXBlb2Yga2V5ID09PSAnc3RyaW5nJyAmJiAobWF0Y2ggPSBrZXkubWF0Y2goL15cXCR8XlxcLnxcXC5cXC58XFwuJHxeXFwuJHxcXDAvKSkpIHtcbiAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihgS2V5ICR7a2V5fSBtdXN0IG5vdCAke2ludmFsaWRDaGFyTXNnW21hdGNoWzBdXX1gKTtcbiAgfVxufVxuXG4vLyBmb3IgYS5iLmMuMi5kLmUsIGtleXBhcnRzIHNob3VsZCBiZSBbJ2EnLCAnYicsICdjJywgJzInLCAnZCcsICdlJ10sXG4vLyBhbmQgdGhlbiB5b3Ugd291bGQgb3BlcmF0ZSBvbiB0aGUgJ2UnIHByb3BlcnR5IG9mIHRoZSByZXR1cm5lZFxuLy8gb2JqZWN0LlxuLy9cbi8vIGlmIG9wdGlvbnMubm9DcmVhdGUgaXMgZmFsc2V5LCBjcmVhdGVzIGludGVybWVkaWF0ZSBsZXZlbHMgb2Zcbi8vIHN0cnVjdHVyZSBhcyBuZWNlc3NhcnksIGxpa2UgbWtkaXIgLXAgKGFuZCByYWlzZXMgYW4gZXhjZXB0aW9uIGlmXG4vLyB0aGF0IHdvdWxkIG1lYW4gZ2l2aW5nIGEgbm9uLW51bWVyaWMgcHJvcGVydHkgdG8gYW4gYXJyYXkuKSBpZlxuLy8gb3B0aW9ucy5ub0NyZWF0ZSBpcyB0cnVlLCByZXR1cm4gdW5kZWZpbmVkIGluc3RlYWQuXG4vL1xuLy8gbWF5IG1vZGlmeSB0aGUgbGFzdCBlbGVtZW50IG9mIGtleXBhcnRzIHRvIHNpZ25hbCB0byB0aGUgY2FsbGVyIHRoYXQgaXQgbmVlZHNcbi8vIHRvIHVzZSBhIGRpZmZlcmVudCB2YWx1ZSB0byBpbmRleCBpbnRvIHRoZSByZXR1cm5lZCBvYmplY3QgKGZvciBleGFtcGxlLFxuLy8gWydhJywgJzAxJ10gLT4gWydhJywgMV0pLlxuLy9cbi8vIGlmIGZvcmJpZEFycmF5IGlzIHRydWUsIHJldHVybiBudWxsIGlmIHRoZSBrZXlwYXRoIGdvZXMgdGhyb3VnaCBhbiBhcnJheS5cbi8vXG4vLyBpZiBvcHRpb25zLmFycmF5SW5kaWNlcyBpcyBzZXQsIHVzZSBpdHMgZmlyc3QgZWxlbWVudCBmb3IgdGhlIChmaXJzdCkgJyQnIGluXG4vLyB0aGUgcGF0aC5cbmZ1bmN0aW9uIGZpbmRNb2RUYXJnZXQoZG9jLCBrZXlwYXJ0cywgb3B0aW9ucyA9IHt9KSB7XG4gIGxldCB1c2VkQXJyYXlJbmRleCA9IGZhbHNlO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBsYXN0ID0gaSA9PT0ga2V5cGFydHMubGVuZ3RoIC0gMTtcbiAgICBsZXQga2V5cGFydCA9IGtleXBhcnRzW2ldO1xuXG4gICAgaWYgKCFpc0luZGV4YWJsZShkb2MpKSB7XG4gICAgICBpZiAob3B0aW9ucy5ub0NyZWF0ZSkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBlcnJvciA9IE1pbmltb25nb0Vycm9yKFxuICAgICAgICBgY2Fubm90IHVzZSB0aGUgcGFydCAnJHtrZXlwYXJ0fScgdG8gdHJhdmVyc2UgJHtkb2N9YFxuICAgICAgKTtcbiAgICAgIGVycm9yLnNldFByb3BlcnR5RXJyb3IgPSB0cnVlO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuXG4gICAgaWYgKGRvYyBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICBpZiAob3B0aW9ucy5mb3JiaWRBcnJheSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cblxuICAgICAgaWYgKGtleXBhcnQgPT09ICckJykge1xuICAgICAgICBpZiAodXNlZEFycmF5SW5kZXgpIHtcbiAgICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignVG9vIG1hbnkgcG9zaXRpb25hbCAoaS5lLiBcXCckXFwnKSBlbGVtZW50cycpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLmFycmF5SW5kaWNlcyB8fCAhb3B0aW9ucy5hcnJheUluZGljZXMubGVuZ3RoKSB7XG4gICAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgICAnVGhlIHBvc2l0aW9uYWwgb3BlcmF0b3IgZGlkIG5vdCBmaW5kIHRoZSBtYXRjaCBuZWVkZWQgZnJvbSB0aGUgJyArXG4gICAgICAgICAgICAncXVlcnknXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGtleXBhcnQgPSBvcHRpb25zLmFycmF5SW5kaWNlc1swXTtcbiAgICAgICAgdXNlZEFycmF5SW5kZXggPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChpc051bWVyaWNLZXkoa2V5cGFydCkpIHtcbiAgICAgICAga2V5cGFydCA9IHBhcnNlSW50KGtleXBhcnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG9wdGlvbnMubm9DcmVhdGUpIHtcbiAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgYGNhbid0IGFwcGVuZCB0byBhcnJheSB1c2luZyBzdHJpbmcgZmllbGQgbmFtZSBbJHtrZXlwYXJ0fV1gXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChsYXN0KSB7XG4gICAgICAgIGtleXBhcnRzW2ldID0ga2V5cGFydDsgLy8gaGFuZGxlICdhLjAxJ1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0aW9ucy5ub0NyZWF0ZSAmJiBrZXlwYXJ0ID49IGRvYy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgd2hpbGUgKGRvYy5sZW5ndGggPCBrZXlwYXJ0KSB7XG4gICAgICAgIGRvYy5wdXNoKG51bGwpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWxhc3QpIHtcbiAgICAgICAgaWYgKGRvYy5sZW5ndGggPT09IGtleXBhcnQpIHtcbiAgICAgICAgICBkb2MucHVzaCh7fSk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRvY1trZXlwYXJ0XSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAgIGBjYW4ndCBtb2RpZnkgZmllbGQgJyR7a2V5cGFydHNbaSArIDFdfScgb2YgbGlzdCB2YWx1ZSBgICtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGRvY1trZXlwYXJ0XSlcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGFzc2VydElzVmFsaWRGaWVsZE5hbWUoa2V5cGFydCk7XG5cbiAgICAgIGlmICghKGtleXBhcnQgaW4gZG9jKSkge1xuICAgICAgICBpZiAob3B0aW9ucy5ub0NyZWF0ZSkge1xuICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWxhc3QpIHtcbiAgICAgICAgICBkb2Nba2V5cGFydF0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChsYXN0KSB7XG4gICAgICByZXR1cm4gZG9jO1xuICAgIH1cblxuICAgIGRvYyA9IGRvY1trZXlwYXJ0XTtcbiAgfVxuXG4gIC8vIG5vdHJlYWNoZWRcbn1cbiIsImltcG9ydCBMb2NhbENvbGxlY3Rpb24gZnJvbSAnLi9sb2NhbF9jb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7XG4gIGNvbXBpbGVEb2N1bWVudFNlbGVjdG9yLFxuICBoYXNPd24sXG4gIG5vdGhpbmdNYXRjaGVyLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbmNvbnN0IERlY2ltYWwgPSBQYWNrYWdlWydtb25nby1kZWNpbWFsJ10/LkRlY2ltYWwgfHwgY2xhc3MgRGVjaW1hbFN0dWIge31cblxuLy8gVGhlIG1pbmltb25nbyBzZWxlY3RvciBjb21waWxlciFcblxuLy8gVGVybWlub2xvZ3k6XG4vLyAgLSBhICdzZWxlY3RvcicgaXMgdGhlIEVKU09OIG9iamVjdCByZXByZXNlbnRpbmcgYSBzZWxlY3RvclxuLy8gIC0gYSAnbWF0Y2hlcicgaXMgaXRzIGNvbXBpbGVkIGZvcm0gKHdoZXRoZXIgYSBmdWxsIE1pbmltb25nby5NYXRjaGVyXG4vLyAgICBvYmplY3Qgb3Igb25lIG9mIHRoZSBjb21wb25lbnQgbGFtYmRhcyB0aGF0IG1hdGNoZXMgcGFydHMgb2YgaXQpXG4vLyAgLSBhICdyZXN1bHQgb2JqZWN0JyBpcyBhbiBvYmplY3Qgd2l0aCBhICdyZXN1bHQnIGZpZWxkIGFuZCBtYXliZVxuLy8gICAgZGlzdGFuY2UgYW5kIGFycmF5SW5kaWNlcy5cbi8vICAtIGEgJ2JyYW5jaGVkIHZhbHVlJyBpcyBhbiBvYmplY3Qgd2l0aCBhICd2YWx1ZScgZmllbGQgYW5kIG1heWJlXG4vLyAgICAnZG9udEl0ZXJhdGUnIGFuZCAnYXJyYXlJbmRpY2VzJy5cbi8vICAtIGEgJ2RvY3VtZW50JyBpcyBhIHRvcC1sZXZlbCBvYmplY3QgdGhhdCBjYW4gYmUgc3RvcmVkIGluIGEgY29sbGVjdGlvbi5cbi8vICAtIGEgJ2xvb2t1cCBmdW5jdGlvbicgaXMgYSBmdW5jdGlvbiB0aGF0IHRha2VzIGluIGEgZG9jdW1lbnQgYW5kIHJldHVybnNcbi8vICAgIGFuIGFycmF5IG9mICdicmFuY2hlZCB2YWx1ZXMnLlxuLy8gIC0gYSAnYnJhbmNoZWQgbWF0Y2hlcicgbWFwcyBmcm9tIGFuIGFycmF5IG9mIGJyYW5jaGVkIHZhbHVlcyB0byBhIHJlc3VsdFxuLy8gICAgb2JqZWN0LlxuLy8gIC0gYW4gJ2VsZW1lbnQgbWF0Y2hlcicgbWFwcyBmcm9tIGEgc2luZ2xlIHZhbHVlIHRvIGEgYm9vbC5cblxuLy8gTWFpbiBlbnRyeSBwb2ludC5cbi8vICAgdmFyIG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoe2E6IHskZ3Q6IDV9fSk7XG4vLyAgIGlmIChtYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyh7YTogN30pKSAuLi5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1hdGNoZXIge1xuICBjb25zdHJ1Y3RvcihzZWxlY3RvciwgaXNVcGRhdGUpIHtcbiAgICAvLyBBIHNldCAob2JqZWN0IG1hcHBpbmcgc3RyaW5nIC0+ICopIG9mIGFsbCBvZiB0aGUgZG9jdW1lbnQgcGF0aHMgbG9va2VkXG4gICAgLy8gYXQgYnkgdGhlIHNlbGVjdG9yLiBBbHNvIGluY2x1ZGVzIHRoZSBlbXB0eSBzdHJpbmcgaWYgaXQgbWF5IGxvb2sgYXQgYW55XG4gICAgLy8gcGF0aCAoZWcsICR3aGVyZSkuXG4gICAgdGhpcy5fcGF0aHMgPSB7fTtcbiAgICAvLyBTZXQgdG8gdHJ1ZSBpZiBjb21waWxhdGlvbiBmaW5kcyBhICRuZWFyLlxuICAgIHRoaXMuX2hhc0dlb1F1ZXJ5ID0gZmFsc2U7XG4gICAgLy8gU2V0IHRvIHRydWUgaWYgY29tcGlsYXRpb24gZmluZHMgYSAkd2hlcmUuXG4gICAgdGhpcy5faGFzV2hlcmUgPSBmYWxzZTtcbiAgICAvLyBTZXQgdG8gZmFsc2UgaWYgY29tcGlsYXRpb24gZmluZHMgYW55dGhpbmcgb3RoZXIgdGhhbiBhIHNpbXBsZSBlcXVhbGl0eVxuICAgIC8vIG9yIG9uZSBvciBtb3JlIG9mICckZ3QnLCAnJGd0ZScsICckbHQnLCAnJGx0ZScsICckbmUnLCAnJGluJywgJyRuaW4nIHVzZWRcbiAgICAvLyB3aXRoIHNjYWxhcnMgYXMgb3BlcmFuZHMuXG4gICAgdGhpcy5faXNTaW1wbGUgPSB0cnVlO1xuICAgIC8vIFNldCB0byBhIGR1bW15IGRvY3VtZW50IHdoaWNoIGFsd2F5cyBtYXRjaGVzIHRoaXMgTWF0Y2hlci4gT3Igc2V0IHRvIG51bGxcbiAgICAvLyBpZiBzdWNoIGRvY3VtZW50IGlzIHRvbyBoYXJkIHRvIGZpbmQuXG4gICAgdGhpcy5fbWF0Y2hpbmdEb2N1bWVudCA9IHVuZGVmaW5lZDtcbiAgICAvLyBBIGNsb25lIG9mIHRoZSBvcmlnaW5hbCBzZWxlY3Rvci4gSXQgbWF5IGp1c3QgYmUgYSBmdW5jdGlvbiBpZiB0aGUgdXNlclxuICAgIC8vIHBhc3NlZCBpbiBhIGZ1bmN0aW9uOyBvdGhlcndpc2UgaXMgZGVmaW5pdGVseSBhbiBvYmplY3QgKGVnLCBJRHMgYXJlXG4gICAgLy8gdHJhbnNsYXRlZCBpbnRvIHtfaWQ6IElEfSBmaXJzdC4gVXNlZCBieSBjYW5CZWNvbWVUcnVlQnlNb2RpZmllciBhbmRcbiAgICAvLyBTb3J0ZXIuX3VzZVdpdGhNYXRjaGVyLlxuICAgIHRoaXMuX3NlbGVjdG9yID0gbnVsbDtcbiAgICB0aGlzLl9kb2NNYXRjaGVyID0gdGhpcy5fY29tcGlsZVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICAvLyBTZXQgdG8gdHJ1ZSBpZiBzZWxlY3Rpb24gaXMgZG9uZSBmb3IgYW4gdXBkYXRlIG9wZXJhdGlvblxuICAgIC8vIERlZmF1bHQgaXMgZmFsc2VcbiAgICAvLyBVc2VkIGZvciAkbmVhciBhcnJheSB1cGRhdGUgKGlzc3VlICMzNTk5KVxuICAgIHRoaXMuX2lzVXBkYXRlID0gaXNVcGRhdGU7XG4gIH1cblxuICBkb2N1bWVudE1hdGNoZXMoZG9jKSB7XG4gICAgaWYgKGRvYyAhPT0gT2JqZWN0KGRvYykpIHtcbiAgICAgIHRocm93IEVycm9yKCdkb2N1bWVudE1hdGNoZXMgbmVlZHMgYSBkb2N1bWVudCcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9kb2NNYXRjaGVyKGRvYyk7XG4gIH1cblxuICBoYXNHZW9RdWVyeSgpIHtcbiAgICByZXR1cm4gdGhpcy5faGFzR2VvUXVlcnk7XG4gIH1cblxuICBoYXNXaGVyZSgpIHtcbiAgICByZXR1cm4gdGhpcy5faGFzV2hlcmU7XG4gIH1cblxuICBpc1NpbXBsZSgpIHtcbiAgICByZXR1cm4gdGhpcy5faXNTaW1wbGU7XG4gIH1cblxuICAvLyBHaXZlbiBhIHNlbGVjdG9yLCByZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHRha2VzIG9uZSBhcmd1bWVudCwgYVxuICAvLyBkb2N1bWVudC4gSXQgcmV0dXJucyBhIHJlc3VsdCBvYmplY3QuXG4gIF9jb21waWxlU2VsZWN0b3Ioc2VsZWN0b3IpIHtcbiAgICAvLyB5b3UgY2FuIHBhc3MgYSBsaXRlcmFsIGZ1bmN0aW9uIGluc3RlYWQgb2YgYSBzZWxlY3RvclxuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICB0aGlzLl9pc1NpbXBsZSA9IGZhbHNlO1xuICAgICAgdGhpcy5fc2VsZWN0b3IgPSBzZWxlY3RvcjtcbiAgICAgIHRoaXMuX3JlY29yZFBhdGhVc2VkKCcnKTtcblxuICAgICAgcmV0dXJuIGRvYyA9PiAoe3Jlc3VsdDogISFzZWxlY3Rvci5jYWxsKGRvYyl9KTtcbiAgICB9XG5cbiAgICAvLyBzaG9ydGhhbmQgLS0gc2NhbGFyIF9pZFxuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3RvcikpIHtcbiAgICAgIHRoaXMuX3NlbGVjdG9yID0ge19pZDogc2VsZWN0b3J9O1xuICAgICAgdGhpcy5fcmVjb3JkUGF0aFVzZWQoJ19pZCcpO1xuXG4gICAgICByZXR1cm4gZG9jID0+ICh7cmVzdWx0OiBFSlNPTi5lcXVhbHMoZG9jLl9pZCwgc2VsZWN0b3IpfSk7XG4gICAgfVxuXG4gICAgLy8gcHJvdGVjdCBhZ2FpbnN0IGRhbmdlcm91cyBzZWxlY3RvcnMuICBmYWxzZXkgYW5kIHtfaWQ6IGZhbHNleX0gYXJlIGJvdGhcbiAgICAvLyBsaWtlbHkgcHJvZ3JhbW1lciBlcnJvciwgYW5kIG5vdCB3aGF0IHlvdSB3YW50LCBwYXJ0aWN1bGFybHkgZm9yXG4gICAgLy8gZGVzdHJ1Y3RpdmUgb3BlcmF0aW9ucy5cbiAgICBpZiAoIXNlbGVjdG9yIHx8IGhhc093bi5jYWxsKHNlbGVjdG9yLCAnX2lkJykgJiYgIXNlbGVjdG9yLl9pZCkge1xuICAgICAgdGhpcy5faXNTaW1wbGUgPSBmYWxzZTtcbiAgICAgIHJldHVybiBub3RoaW5nTWF0Y2hlcjtcbiAgICB9XG5cbiAgICAvLyBUb3AgbGV2ZWwgY2FuJ3QgYmUgYW4gYXJyYXkgb3IgdHJ1ZSBvciBiaW5hcnkuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoc2VsZWN0b3IpIHx8XG4gICAgICAgIEVKU09OLmlzQmluYXJ5KHNlbGVjdG9yKSB8fFxuICAgICAgICB0eXBlb2Ygc2VsZWN0b3IgPT09ICdib29sZWFuJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yOiAke3NlbGVjdG9yfWApO1xuICAgIH1cblxuICAgIHRoaXMuX3NlbGVjdG9yID0gRUpTT04uY2xvbmUoc2VsZWN0b3IpO1xuXG4gICAgcmV0dXJuIGNvbXBpbGVEb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yLCB0aGlzLCB7aXNSb290OiB0cnVlfSk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgbGlzdCBvZiBrZXkgcGF0aHMgdGhlIGdpdmVuIHNlbGVjdG9yIGlzIGxvb2tpbmcgZm9yLiBJdCBpbmNsdWRlc1xuICAvLyB0aGUgZW1wdHkgc3RyaW5nIGlmIHRoZXJlIGlzIGEgJHdoZXJlLlxuICBfZ2V0UGF0aHMoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX3BhdGhzKTtcbiAgfVxuXG4gIF9yZWNvcmRQYXRoVXNlZChwYXRoKSB7XG4gICAgdGhpcy5fcGF0aHNbcGF0aF0gPSB0cnVlO1xuICB9XG59XG5cbi8vIGhlbHBlcnMgdXNlZCBieSBjb21waWxlZCBzZWxlY3RvciBjb2RlXG5Mb2NhbENvbGxlY3Rpb24uX2YgPSB7XG4gIC8vIFhYWCBmb3IgX2FsbCBhbmQgX2luLCBjb25zaWRlciBidWlsZGluZyAnaW5xdWVyeScgYXQgY29tcGlsZSB0aW1lLi5cbiAgX3R5cGUodikge1xuICAgIGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiAyO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICByZXR1cm4gODtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2KSkge1xuICAgICAgcmV0dXJuIDQ7XG4gICAgfVxuXG4gICAgaWYgKHYgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiAxMDtcbiAgICB9XG5cbiAgICAvLyBub3RlIHRoYXQgdHlwZW9mKC94LykgPT09IFwib2JqZWN0XCJcbiAgICBpZiAodiBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgcmV0dXJuIDExO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIDEzO1xuICAgIH1cblxuICAgIGlmICh2IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgcmV0dXJuIDk7XG4gICAgfVxuXG4gICAgaWYgKEVKU09OLmlzQmluYXJ5KHYpKSB7XG4gICAgICByZXR1cm4gNTtcbiAgICB9XG5cbiAgICBpZiAodiBpbnN0YW5jZW9mIE1vbmdvSUQuT2JqZWN0SUQpIHtcbiAgICAgIHJldHVybiA3O1xuICAgIH1cblxuICAgIGlmICh2IGluc3RhbmNlb2YgRGVjaW1hbCkge1xuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgLy8gb2JqZWN0XG4gICAgcmV0dXJuIDM7XG5cbiAgICAvLyBYWFggc3VwcG9ydCBzb21lL2FsbCBvZiB0aGVzZTpcbiAgICAvLyAxNCwgc3ltYm9sXG4gICAgLy8gMTUsIGphdmFzY3JpcHQgY29kZSB3aXRoIHNjb3BlXG4gICAgLy8gMTYsIDE4OiAzMi1iaXQvNjQtYml0IGludGVnZXJcbiAgICAvLyAxNywgdGltZXN0YW1wXG4gICAgLy8gMjU1LCBtaW5rZXlcbiAgICAvLyAxMjcsIG1heGtleVxuICB9LFxuXG4gIC8vIGRlZXAgZXF1YWxpdHkgdGVzdDogdXNlIGZvciBsaXRlcmFsIGRvY3VtZW50IGFuZCBhcnJheSBtYXRjaGVzXG4gIF9lcXVhbChhLCBiKSB7XG4gICAgcmV0dXJuIEVKU09OLmVxdWFscyhhLCBiLCB7a2V5T3JkZXJTZW5zaXRpdmU6IHRydWV9KTtcbiAgfSxcblxuICAvLyBtYXBzIGEgdHlwZSBjb2RlIHRvIGEgdmFsdWUgdGhhdCBjYW4gYmUgdXNlZCB0byBzb3J0IHZhbHVlcyBvZiBkaWZmZXJlbnRcbiAgLy8gdHlwZXNcbiAgX3R5cGVvcmRlcih0KSB7XG4gICAgLy8gaHR0cDovL3d3dy5tb25nb2RiLm9yZy9kaXNwbGF5L0RPQ1MvV2hhdCtpcyt0aGUrQ29tcGFyZStPcmRlcitmb3IrQlNPTitUeXBlc1xuICAgIC8vIFhYWCB3aGF0IGlzIHRoZSBjb3JyZWN0IHNvcnQgcG9zaXRpb24gZm9yIEphdmFzY3JpcHQgY29kZT9cbiAgICAvLyAoJzEwMCcgaW4gdGhlIG1hdHJpeCBiZWxvdylcbiAgICAvLyBYWFggbWlua2V5L21heGtleVxuICAgIHJldHVybiBbXG4gICAgICAtMSwgIC8vIChub3QgYSB0eXBlKVxuICAgICAgMSwgICAvLyBudW1iZXJcbiAgICAgIDIsICAgLy8gc3RyaW5nXG4gICAgICAzLCAgIC8vIG9iamVjdFxuICAgICAgNCwgICAvLyBhcnJheVxuICAgICAgNSwgICAvLyBiaW5hcnlcbiAgICAgIC0xLCAgLy8gZGVwcmVjYXRlZFxuICAgICAgNiwgICAvLyBPYmplY3RJRFxuICAgICAgNywgICAvLyBib29sXG4gICAgICA4LCAgIC8vIERhdGVcbiAgICAgIDAsICAgLy8gbnVsbFxuICAgICAgOSwgICAvLyBSZWdFeHBcbiAgICAgIC0xLCAgLy8gZGVwcmVjYXRlZFxuICAgICAgMTAwLCAvLyBKUyBjb2RlXG4gICAgICAyLCAgIC8vIGRlcHJlY2F0ZWQgKHN5bWJvbClcbiAgICAgIDEwMCwgLy8gSlMgY29kZVxuICAgICAgMSwgICAvLyAzMi1iaXQgaW50XG4gICAgICA4LCAgIC8vIE1vbmdvIHRpbWVzdGFtcFxuICAgICAgMSAgICAvLyA2NC1iaXQgaW50XG4gICAgXVt0XTtcbiAgfSxcblxuICAvLyBjb21wYXJlIHR3byB2YWx1ZXMgb2YgdW5rbm93biB0eXBlIGFjY29yZGluZyB0byBCU09OIG9yZGVyaW5nXG4gIC8vIHNlbWFudGljcy4gKGFzIGFuIGV4dGVuc2lvbiwgY29uc2lkZXIgJ3VuZGVmaW5lZCcgdG8gYmUgbGVzcyB0aGFuXG4gIC8vIGFueSBvdGhlciB2YWx1ZS4pIHJldHVybiBuZWdhdGl2ZSBpZiBhIGlzIGxlc3MsIHBvc2l0aXZlIGlmIGIgaXNcbiAgLy8gbGVzcywgb3IgMCBpZiBlcXVhbFxuICBfY21wKGEsIGIpIHtcbiAgICBpZiAoYSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYiA9PT0gdW5kZWZpbmVkID8gMCA6IC0xO1xuICAgIH1cblxuICAgIGlmIChiID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIGxldCB0YSA9IExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZShhKTtcbiAgICBsZXQgdGIgPSBMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUoYik7XG5cbiAgICBjb25zdCBvYSA9IExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZW9yZGVyKHRhKTtcbiAgICBjb25zdCBvYiA9IExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZW9yZGVyKHRiKTtcblxuICAgIGlmIChvYSAhPT0gb2IpIHtcbiAgICAgIHJldHVybiBvYSA8IG9iID8gLTEgOiAxO1xuICAgIH1cblxuICAgIC8vIFhYWCBuZWVkIHRvIGltcGxlbWVudCB0aGlzIGlmIHdlIGltcGxlbWVudCBTeW1ib2wgb3IgaW50ZWdlcnMsIG9yXG4gICAgLy8gVGltZXN0YW1wXG4gICAgaWYgKHRhICE9PSB0Yikge1xuICAgICAgdGhyb3cgRXJyb3IoJ01pc3NpbmcgdHlwZSBjb2VyY2lvbiBsb2dpYyBpbiBfY21wJyk7XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSA3KSB7IC8vIE9iamVjdElEXG4gICAgICAvLyBDb252ZXJ0IHRvIHN0cmluZy5cbiAgICAgIHRhID0gdGIgPSAyO1xuICAgICAgYSA9IGEudG9IZXhTdHJpbmcoKTtcbiAgICAgIGIgPSBiLnRvSGV4U3RyaW5nKCk7XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSA5KSB7IC8vIERhdGVcbiAgICAgIC8vIENvbnZlcnQgdG8gbWlsbGlzLlxuICAgICAgdGEgPSB0YiA9IDE7XG4gICAgICBhID0gaXNOYU4oYSkgPyAwIDogYS5nZXRUaW1lKCk7XG4gICAgICBiID0gaXNOYU4oYikgPyAwIDogYi5nZXRUaW1lKCk7XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSAxKSB7IC8vIGRvdWJsZVxuICAgICAgaWYgKGEgaW5zdGFuY2VvZiBEZWNpbWFsKSB7XG4gICAgICAgIHJldHVybiBhLm1pbnVzKGIpLnRvTnVtYmVyKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYSAtIGI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRiID09PSAyKSAvLyBzdHJpbmdcbiAgICAgIHJldHVybiBhIDwgYiA/IC0xIDogYSA9PT0gYiA/IDAgOiAxO1xuXG4gICAgaWYgKHRhID09PSAzKSB7IC8vIE9iamVjdFxuICAgICAgLy8gdGhpcyBjb3VsZCBiZSBtdWNoIG1vcmUgZWZmaWNpZW50IGluIHRoZSBleHBlY3RlZCBjYXNlIC4uLlxuICAgICAgY29uc3QgdG9BcnJheSA9IG9iamVjdCA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgICAgIE9iamVjdC5rZXlzKG9iamVjdCkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGtleSwgb2JqZWN0W2tleV0pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIExvY2FsQ29sbGVjdGlvbi5fZi5fY21wKHRvQXJyYXkoYSksIHRvQXJyYXkoYikpO1xuICAgIH1cblxuICAgIGlmICh0YSA9PT0gNCkgeyAvLyBBcnJheVxuICAgICAgZm9yIChsZXQgaSA9IDA7IDsgaSsrKSB7XG4gICAgICAgIGlmIChpID09PSBhLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiBpID09PSBiLmxlbmd0aCA/IDAgOiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpID09PSBiLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcyA9IExvY2FsQ29sbGVjdGlvbi5fZi5fY21wKGFbaV0sIGJbaV0pO1xuICAgICAgICBpZiAocyAhPT0gMCkge1xuICAgICAgICAgIHJldHVybiBzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSA1KSB7IC8vIGJpbmFyeVxuICAgICAgLy8gU3VycHJpc2luZ2x5LCBhIHNtYWxsIGJpbmFyeSBibG9iIGlzIGFsd2F5cyBsZXNzIHRoYW4gYSBsYXJnZSBvbmUgaW5cbiAgICAgIC8vIE1vbmdvLlxuICAgICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gYS5sZW5ndGggLSBiLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChhW2ldIDwgYltpXSkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhW2ldID4gYltpXSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmICh0YSA9PT0gOCkgeyAvLyBib29sZWFuXG4gICAgICBpZiAoYSkge1xuICAgICAgICByZXR1cm4gYiA/IDAgOiAxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYiA/IC0xIDogMDtcbiAgICB9XG5cbiAgICBpZiAodGEgPT09IDEwKSAvLyBudWxsXG4gICAgICByZXR1cm4gMDtcblxuICAgIGlmICh0YSA9PT0gMTEpIC8vIHJlZ2V4cFxuICAgICAgdGhyb3cgRXJyb3IoJ1NvcnRpbmcgbm90IHN1cHBvcnRlZCBvbiByZWd1bGFyIGV4cHJlc3Npb24nKTsgLy8gWFhYXG5cbiAgICAvLyAxMzogamF2YXNjcmlwdCBjb2RlXG4gICAgLy8gMTQ6IHN5bWJvbFxuICAgIC8vIDE1OiBqYXZhc2NyaXB0IGNvZGUgd2l0aCBzY29wZVxuICAgIC8vIDE2OiAzMi1iaXQgaW50ZWdlclxuICAgIC8vIDE3OiB0aW1lc3RhbXBcbiAgICAvLyAxODogNjQtYml0IGludGVnZXJcbiAgICAvLyAyNTU6IG1pbmtleVxuICAgIC8vIDEyNzogbWF4a2V5XG4gICAgaWYgKHRhID09PSAxMykgLy8gamF2YXNjcmlwdCBjb2RlXG4gICAgICB0aHJvdyBFcnJvcignU29ydGluZyBub3Qgc3VwcG9ydGVkIG9uIEphdmFzY3JpcHQgY29kZScpOyAvLyBYWFhcblxuICAgIHRocm93IEVycm9yKCdVbmtub3duIHR5cGUgdG8gc29ydCcpO1xuICB9LFxufTtcbiIsImltcG9ydCBMb2NhbENvbGxlY3Rpb25fIGZyb20gJy4vbG9jYWxfY29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgTWF0Y2hlciBmcm9tICcuL21hdGNoZXIuanMnO1xuaW1wb3J0IFNvcnRlciBmcm9tICcuL3NvcnRlci5qcyc7XG5cbkxvY2FsQ29sbGVjdGlvbiA9IExvY2FsQ29sbGVjdGlvbl87XG5NaW5pbW9uZ28gPSB7XG4gICAgTG9jYWxDb2xsZWN0aW9uOiBMb2NhbENvbGxlY3Rpb25fLFxuICAgIE1hdGNoZXIsXG4gICAgU29ydGVyXG59O1xuIiwiLy8gT2JzZXJ2ZUhhbmRsZTogdGhlIHJldHVybiB2YWx1ZSBvZiBhIGxpdmUgcXVlcnkuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBPYnNlcnZlSGFuZGxlIHt9XG4iLCJpbXBvcnQge1xuICBFTEVNRU5UX09QRVJBVE9SUyxcbiAgZXF1YWxpdHlFbGVtZW50TWF0Y2hlcixcbiAgZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyxcbiAgaGFzT3duLFxuICBpc09wZXJhdG9yT2JqZWN0LFxuICBtYWtlTG9va3VwRnVuY3Rpb24sXG4gIHJlZ2V4cEVsZW1lbnRNYXRjaGVyLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbi8vIEdpdmUgYSBzb3J0IHNwZWMsIHdoaWNoIGNhbiBiZSBpbiBhbnkgb2YgdGhlc2UgZm9ybXM6XG4vLyAgIHtcImtleTFcIjogMSwgXCJrZXkyXCI6IC0xfVxuLy8gICBbW1wia2V5MVwiLCBcImFzY1wiXSwgW1wia2V5MlwiLCBcImRlc2NcIl1dXG4vLyAgIFtcImtleTFcIiwgW1wia2V5MlwiLCBcImRlc2NcIl1dXG4vL1xuLy8gKC4uIHdpdGggdGhlIGZpcnN0IGZvcm0gYmVpbmcgZGVwZW5kZW50IG9uIHRoZSBrZXkgZW51bWVyYXRpb25cbi8vIGJlaGF2aW9yIG9mIHlvdXIgamF2YXNjcmlwdCBWTSwgd2hpY2ggdXN1YWxseSBkb2VzIHdoYXQgeW91IG1lYW4gaW5cbi8vIHRoaXMgY2FzZSBpZiB0aGUga2V5IG5hbWVzIGRvbid0IGxvb2sgbGlrZSBpbnRlZ2VycyAuLilcbi8vXG4vLyByZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHRha2VzIHR3byBvYmplY3RzLCBhbmQgcmV0dXJucyAtMSBpZiB0aGVcbi8vIGZpcnN0IG9iamVjdCBjb21lcyBmaXJzdCBpbiBvcmRlciwgMSBpZiB0aGUgc2Vjb25kIG9iamVjdCBjb21lc1xuLy8gZmlyc3QsIG9yIDAgaWYgbmVpdGhlciBvYmplY3QgY29tZXMgYmVmb3JlIHRoZSBvdGhlci5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU29ydGVyIHtcbiAgY29uc3RydWN0b3Ioc3BlYykge1xuICAgIHRoaXMuX3NvcnRTcGVjUGFydHMgPSBbXTtcbiAgICB0aGlzLl9zb3J0RnVuY3Rpb24gPSBudWxsO1xuXG4gICAgY29uc3QgYWRkU3BlY1BhcnQgPSAocGF0aCwgYXNjZW5kaW5nKSA9PiB7XG4gICAgICBpZiAoIXBhdGgpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ3NvcnQga2V5cyBtdXN0IGJlIG5vbi1lbXB0eScpO1xuICAgICAgfVxuXG4gICAgICBpZiAocGF0aC5jaGFyQXQoMCkgPT09ICckJykge1xuICAgICAgICB0aHJvdyBFcnJvcihgdW5zdXBwb3J0ZWQgc29ydCBrZXk6ICR7cGF0aH1gKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fc29ydFNwZWNQYXJ0cy5wdXNoKHtcbiAgICAgICAgYXNjZW5kaW5nLFxuICAgICAgICBsb29rdXA6IG1ha2VMb29rdXBGdW5jdGlvbihwYXRoLCB7Zm9yU29ydDogdHJ1ZX0pLFxuICAgICAgICBwYXRoXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgaWYgKHNwZWMgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgc3BlYy5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgYWRkU3BlY1BhcnQoZWxlbWVudCwgdHJ1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWRkU3BlY1BhcnQoZWxlbWVudFswXSwgZWxlbWVudFsxXSAhPT0gJ2Rlc2MnKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc3BlYyA9PT0gJ29iamVjdCcpIHtcbiAgICAgIE9iamVjdC5rZXlzKHNwZWMpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgYWRkU3BlY1BhcnQoa2V5LCBzcGVjW2tleV0gPj0gMCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzcGVjID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLl9zb3J0RnVuY3Rpb24gPSBzcGVjO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBFcnJvcihgQmFkIHNvcnQgc3BlY2lmaWNhdGlvbjogJHtKU09OLnN0cmluZ2lmeShzcGVjKX1gKTtcbiAgICB9XG5cbiAgICAvLyBJZiBhIGZ1bmN0aW9uIGlzIHNwZWNpZmllZCBmb3Igc29ydGluZywgd2Ugc2tpcCB0aGUgcmVzdC5cbiAgICBpZiAodGhpcy5fc29ydEZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVG8gaW1wbGVtZW50IGFmZmVjdGVkQnlNb2RpZmllciwgd2UgcGlnZ3ktYmFjayBvbiB0b3Agb2YgTWF0Y2hlcidzXG4gICAgLy8gYWZmZWN0ZWRCeU1vZGlmaWVyIGNvZGU7IHdlIGNyZWF0ZSBhIHNlbGVjdG9yIHRoYXQgaXMgYWZmZWN0ZWQgYnkgdGhlXG4gICAgLy8gc2FtZSBtb2RpZmllcnMgYXMgdGhpcyBzb3J0IG9yZGVyLiBUaGlzIGlzIG9ubHkgaW1wbGVtZW50ZWQgb24gdGhlXG4gICAgLy8gc2VydmVyLlxuICAgIGlmICh0aGlzLmFmZmVjdGVkQnlNb2RpZmllcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSB7fTtcblxuICAgICAgdGhpcy5fc29ydFNwZWNQYXJ0cy5mb3JFYWNoKHNwZWMgPT4ge1xuICAgICAgICBzZWxlY3RvcltzcGVjLnBhdGhdID0gMTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9zZWxlY3RvckZvckFmZmVjdGVkQnlNb2RpZmllciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihzZWxlY3Rvcik7XG4gICAgfVxuXG4gICAgdGhpcy5fa2V5Q29tcGFyYXRvciA9IGNvbXBvc2VDb21wYXJhdG9ycyhcbiAgICAgIHRoaXMuX3NvcnRTcGVjUGFydHMubWFwKChzcGVjLCBpKSA9PiB0aGlzLl9rZXlGaWVsZENvbXBhcmF0b3IoaSkpXG4gICAgKTtcbiAgfVxuXG4gIGdldENvbXBhcmF0b3Iob3B0aW9ucykge1xuICAgIC8vIElmIHNvcnQgaXMgc3BlY2lmaWVkIG9yIGhhdmUgbm8gZGlzdGFuY2VzLCBqdXN0IHVzZSB0aGUgY29tcGFyYXRvciBmcm9tXG4gICAgLy8gdGhlIHNvdXJjZSBzcGVjaWZpY2F0aW9uICh3aGljaCBkZWZhdWx0cyB0byBcImV2ZXJ5dGhpbmcgaXMgZXF1YWxcIi5cbiAgICAvLyBpc3N1ZSAjMzU5OVxuICAgIC8vIGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL29wZXJhdG9yL3F1ZXJ5L25lYXIvI3NvcnQtb3BlcmF0aW9uXG4gICAgLy8gc29ydCBlZmZlY3RpdmVseSBvdmVycmlkZXMgJG5lYXJcbiAgICBpZiAodGhpcy5fc29ydFNwZWNQYXJ0cy5sZW5ndGggfHwgIW9wdGlvbnMgfHwgIW9wdGlvbnMuZGlzdGFuY2VzKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0QmFzZUNvbXBhcmF0b3IoKTtcbiAgICB9XG5cbiAgICBjb25zdCBkaXN0YW5jZXMgPSBvcHRpb25zLmRpc3RhbmNlcztcblxuICAgIC8vIFJldHVybiBhIGNvbXBhcmF0b3Igd2hpY2ggY29tcGFyZXMgdXNpbmcgJG5lYXIgZGlzdGFuY2VzLlxuICAgIHJldHVybiAoYSwgYikgPT4ge1xuICAgICAgaWYgKCFkaXN0YW5jZXMuaGFzKGEuX2lkKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihgTWlzc2luZyBkaXN0YW5jZSBmb3IgJHthLl9pZH1gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFkaXN0YW5jZXMuaGFzKGIuX2lkKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihgTWlzc2luZyBkaXN0YW5jZSBmb3IgJHtiLl9pZH1gKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRpc3RhbmNlcy5nZXQoYS5faWQpIC0gZGlzdGFuY2VzLmdldChiLl9pZCk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIFRha2VzIGluIHR3byBrZXlzOiBhcnJheXMgd2hvc2UgbGVuZ3RocyBtYXRjaCB0aGUgbnVtYmVyIG9mIHNwZWNcbiAgLy8gcGFydHMuIFJldHVybnMgbmVnYXRpdmUsIDAsIG9yIHBvc2l0aXZlIGJhc2VkIG9uIHVzaW5nIHRoZSBzb3J0IHNwZWMgdG9cbiAgLy8gY29tcGFyZSBmaWVsZHMuXG4gIF9jb21wYXJlS2V5cyhrZXkxLCBrZXkyKSB7XG4gICAgaWYgKGtleTEubGVuZ3RoICE9PSB0aGlzLl9zb3J0U3BlY1BhcnRzLmxlbmd0aCB8fFxuICAgICAgICBrZXkyLmxlbmd0aCAhPT0gdGhpcy5fc29ydFNwZWNQYXJ0cy5sZW5ndGgpIHtcbiAgICAgIHRocm93IEVycm9yKCdLZXkgaGFzIHdyb25nIGxlbmd0aCcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9rZXlDb21wYXJhdG9yKGtleTEsIGtleTIpO1xuICB9XG5cbiAgLy8gSXRlcmF0ZXMgb3ZlciBlYWNoIHBvc3NpYmxlIFwia2V5XCIgZnJvbSBkb2MgKGllLCBvdmVyIGVhY2ggYnJhbmNoKSwgY2FsbGluZ1xuICAvLyAnY2InIHdpdGggdGhlIGtleS5cbiAgX2dlbmVyYXRlS2V5c0Zyb21Eb2MoZG9jLCBjYikge1xuICAgIGlmICh0aGlzLl9zb3J0U3BlY1BhcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjYW5cXCd0IGdlbmVyYXRlIGtleXMgd2l0aG91dCBhIHNwZWMnKTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXRoRnJvbUluZGljZXMgPSBpbmRpY2VzID0+IGAke2luZGljZXMuam9pbignLCcpfSxgO1xuXG4gICAgbGV0IGtub3duUGF0aHMgPSBudWxsO1xuXG4gICAgLy8gbWFwcyBpbmRleCAtPiAoeycnIC0+IHZhbHVlfSBvciB7cGF0aCAtPiB2YWx1ZX0pXG4gICAgY29uc3QgdmFsdWVzQnlJbmRleEFuZFBhdGggPSB0aGlzLl9zb3J0U3BlY1BhcnRzLm1hcChzcGVjID0+IHtcbiAgICAgIC8vIEV4cGFuZCBhbnkgbGVhZiBhcnJheXMgdGhhdCB3ZSBmaW5kLCBhbmQgaWdub3JlIHRob3NlIGFycmF5c1xuICAgICAgLy8gdGhlbXNlbHZlcy4gIChXZSBuZXZlciBzb3J0IGJhc2VkIG9uIGFuIGFycmF5IGl0c2VsZi4pXG4gICAgICBsZXQgYnJhbmNoZXMgPSBleHBhbmRBcnJheXNJbkJyYW5jaGVzKHNwZWMubG9va3VwKGRvYyksIHRydWUpO1xuXG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbm8gdmFsdWVzIGZvciBhIGtleSAoZWcsIGtleSBnb2VzIHRvIGFuIGVtcHR5IGFycmF5KSxcbiAgICAgIC8vIHByZXRlbmQgd2UgZm91bmQgb25lIHVuZGVmaW5lZCB2YWx1ZS5cbiAgICAgIGlmICghYnJhbmNoZXMubGVuZ3RoKSB7XG4gICAgICAgIGJyYW5jaGVzID0gW3sgdmFsdWU6IHZvaWQgMCB9XTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZWxlbWVudCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBsZXQgdXNlZFBhdGhzID0gZmFsc2U7XG5cbiAgICAgIGJyYW5jaGVzLmZvckVhY2goYnJhbmNoID0+IHtcbiAgICAgICAgaWYgKCFicmFuY2guYXJyYXlJbmRpY2VzKSB7XG4gICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIGFycmF5IGluZGljZXMgZm9yIGEgYnJhbmNoLCB0aGVuIGl0IG11c3QgYmUgdGhlXG4gICAgICAgICAgLy8gb25seSBicmFuY2gsIGJlY2F1c2UgdGhlIG9ubHkgdGhpbmcgdGhhdCBwcm9kdWNlcyBtdWx0aXBsZSBicmFuY2hlc1xuICAgICAgICAgIC8vIGlzIHRoZSB1c2Ugb2YgYXJyYXlzLlxuICAgICAgICAgIGlmIChicmFuY2hlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignbXVsdGlwbGUgYnJhbmNoZXMgYnV0IG5vIGFycmF5IHVzZWQ/Jyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZWxlbWVudFsnJ10gPSBicmFuY2gudmFsdWU7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdXNlZFBhdGhzID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBwYXRoID0gcGF0aEZyb21JbmRpY2VzKGJyYW5jaC5hcnJheUluZGljZXMpO1xuXG4gICAgICAgIGlmIChoYXNPd24uY2FsbChlbGVtZW50LCBwYXRoKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKGBkdXBsaWNhdGUgcGF0aDogJHtwYXRofWApO1xuICAgICAgICB9XG5cbiAgICAgICAgZWxlbWVudFtwYXRoXSA9IGJyYW5jaC52YWx1ZTtcblxuICAgICAgICAvLyBJZiB0d28gc29ydCBmaWVsZHMgYm90aCBnbyBpbnRvIGFycmF5cywgdGhleSBoYXZlIHRvIGdvIGludG8gdGhlXG4gICAgICAgIC8vIGV4YWN0IHNhbWUgYXJyYXlzIGFuZCB3ZSBoYXZlIHRvIGZpbmQgdGhlIHNhbWUgcGF0aHMuICBUaGlzIGlzXG4gICAgICAgIC8vIHJvdWdobHkgdGhlIHNhbWUgY29uZGl0aW9uIHRoYXQgbWFrZXMgTW9uZ29EQiB0aHJvdyB0aGlzIHN0cmFuZ2VcbiAgICAgICAgLy8gZXJyb3IgbWVzc2FnZS4gIGVnLCB0aGUgbWFpbiB0aGluZyBpcyB0aGF0IGlmIHNvcnQgc3BlYyBpcyB7YTogMSxcbiAgICAgICAgLy8gYjoxfSB0aGVuIGEgYW5kIGIgY2Fubm90IGJvdGggYmUgYXJyYXlzLlxuICAgICAgICAvL1xuICAgICAgICAvLyAoSW4gTW9uZ29EQiBpdCBzZWVtcyB0byBiZSBPSyB0byBoYXZlIHthOiAxLCAnYS54LnknOiAxfSB3aGVyZSAnYSdcbiAgICAgICAgLy8gYW5kICdhLngueScgYXJlIGJvdGggYXJyYXlzLCBidXQgd2UgZG9uJ3QgYWxsb3cgdGhpcyBmb3Igbm93LlxuICAgICAgICAvLyAjTmVzdGVkQXJyYXlTb3J0XG4gICAgICAgIC8vIFhYWCBhY2hpZXZlIGZ1bGwgY29tcGF0aWJpbGl0eSBoZXJlXG4gICAgICAgIGlmIChrbm93blBhdGhzICYmICFoYXNPd24uY2FsbChrbm93blBhdGhzLCBwYXRoKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdjYW5ub3QgaW5kZXggcGFyYWxsZWwgYXJyYXlzJyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoa25vd25QYXRocykge1xuICAgICAgICAvLyBTaW1pbGFybHkgdG8gYWJvdmUsIHBhdGhzIG11c3QgbWF0Y2ggZXZlcnl3aGVyZSwgdW5sZXNzIHRoaXMgaXMgYVxuICAgICAgICAvLyBub24tYXJyYXkgZmllbGQuXG4gICAgICAgIGlmICghaGFzT3duLmNhbGwoZWxlbWVudCwgJycpICYmXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhrbm93blBhdGhzKS5sZW5ndGggIT09IE9iamVjdC5rZXlzKGVsZW1lbnQpLmxlbmd0aCkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdjYW5ub3QgaW5kZXggcGFyYWxsZWwgYXJyYXlzIScpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHVzZWRQYXRocykge1xuICAgICAgICBrbm93blBhdGhzID0ge307XG5cbiAgICAgICAgT2JqZWN0LmtleXMoZWxlbWVudCkuZm9yRWFjaChwYXRoID0+IHtcbiAgICAgICAgICBrbm93blBhdGhzW3BhdGhdID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH0pO1xuXG4gICAgaWYgKCFrbm93blBhdGhzKSB7XG4gICAgICAvLyBFYXN5IGNhc2U6IG5vIHVzZSBvZiBhcnJheXMuXG4gICAgICBjb25zdCBzb2xlS2V5ID0gdmFsdWVzQnlJbmRleEFuZFBhdGgubWFwKHZhbHVlcyA9PiB7XG4gICAgICAgIGlmICghaGFzT3duLmNhbGwodmFsdWVzLCAnJykpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignbm8gdmFsdWUgaW4gc29sZSBrZXkgY2FzZT8nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2YWx1ZXNbJyddO1xuICAgICAgfSk7XG5cbiAgICAgIGNiKHNvbGVLZXkpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoa25vd25QYXRocykuZm9yRWFjaChwYXRoID0+IHtcbiAgICAgIGNvbnN0IGtleSA9IHZhbHVlc0J5SW5kZXhBbmRQYXRoLm1hcCh2YWx1ZXMgPT4ge1xuICAgICAgICBpZiAoaGFzT3duLmNhbGwodmFsdWVzLCAnJykpIHtcbiAgICAgICAgICByZXR1cm4gdmFsdWVzWycnXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaGFzT3duLmNhbGwodmFsdWVzLCBwYXRoKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdtaXNzaW5nIHBhdGg/Jyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsdWVzW3BhdGhdO1xuICAgICAgfSk7XG5cbiAgICAgIGNiKGtleSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgY29tcGFyYXRvciB0aGF0IHJlcHJlc2VudHMgdGhlIHNvcnQgc3BlY2lmaWNhdGlvbiAoYnV0IG5vdFxuICAvLyBpbmNsdWRpbmcgYSBwb3NzaWJsZSBnZW9xdWVyeSBkaXN0YW5jZSB0aWUtYnJlYWtlcikuXG4gIF9nZXRCYXNlQ29tcGFyYXRvcigpIHtcbiAgICBpZiAodGhpcy5fc29ydEZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc29ydEZ1bmN0aW9uO1xuICAgIH1cblxuICAgIC8vIElmIHdlJ3JlIG9ubHkgc29ydGluZyBvbiBnZW9xdWVyeSBkaXN0YW5jZSBhbmQgbm8gc3BlY3MsIGp1c3Qgc2F5XG4gICAgLy8gZXZlcnl0aGluZyBpcyBlcXVhbC5cbiAgICBpZiAoIXRoaXMuX3NvcnRTcGVjUGFydHMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gKGRvYzEsIGRvYzIpID0+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIChkb2MxLCBkb2MyKSA9PiB7XG4gICAgICBjb25zdCBrZXkxID0gdGhpcy5fZ2V0TWluS2V5RnJvbURvYyhkb2MxKTtcbiAgICAgIGNvbnN0IGtleTIgPSB0aGlzLl9nZXRNaW5LZXlGcm9tRG9jKGRvYzIpO1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbXBhcmVLZXlzKGtleTEsIGtleTIpO1xuICAgIH07XG4gIH1cblxuICAvLyBGaW5kcyB0aGUgbWluaW11bSBrZXkgZnJvbSB0aGUgZG9jLCBhY2NvcmRpbmcgdG8gdGhlIHNvcnQgc3BlY3MuICAoV2Ugc2F5XG4gIC8vIFwibWluaW11bVwiIGhlcmUgYnV0IHRoaXMgaXMgd2l0aCByZXNwZWN0IHRvIHRoZSBzb3J0IHNwZWMsIHNvIFwiZGVzY2VuZGluZ1wiXG4gIC8vIHNvcnQgZmllbGRzIG1lYW4gd2UncmUgZmluZGluZyB0aGUgbWF4IGZvciB0aGF0IGZpZWxkLilcbiAgLy9cbiAgLy8gTm90ZSB0aGF0IHRoaXMgaXMgTk9UIFwiZmluZCB0aGUgbWluaW11bSB2YWx1ZSBvZiB0aGUgZmlyc3QgZmllbGQsIHRoZVxuICAvLyBtaW5pbXVtIHZhbHVlIG9mIHRoZSBzZWNvbmQgZmllbGQsIGV0Y1wiLi4uIGl0J3MgXCJjaG9vc2UgdGhlXG4gIC8vIGxleGljb2dyYXBoaWNhbGx5IG1pbmltdW0gdmFsdWUgb2YgdGhlIGtleSB2ZWN0b3IsIGFsbG93aW5nIG9ubHkga2V5cyB3aGljaFxuICAvLyB5b3UgY2FuIGZpbmQgYWxvbmcgdGhlIHNhbWUgcGF0aHNcIi4gIGllLCBmb3IgYSBkb2Mge2E6IFt7eDogMCwgeTogNX0sIHt4OlxuICAvLyAxLCB5OiAzfV19IHdpdGggc29ydCBzcGVjIHsnYS54JzogMSwgJ2EueSc6IDF9LCB0aGUgb25seSBrZXlzIGFyZSBbMCw1XSBhbmRcbiAgLy8gWzEsM10sIGFuZCB0aGUgbWluaW11bSBrZXkgaXMgWzAsNV07IG5vdGFibHksIFswLDNdIGlzIE5PVCBhIGtleS5cbiAgX2dldE1pbktleUZyb21Eb2MoZG9jKSB7XG4gICAgbGV0IG1pbktleSA9IG51bGw7XG5cbiAgICB0aGlzLl9nZW5lcmF0ZUtleXNGcm9tRG9jKGRvYywga2V5ID0+IHtcbiAgICAgIGlmIChtaW5LZXkgPT09IG51bGwpIHtcbiAgICAgICAgbWluS2V5ID0ga2V5O1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9jb21wYXJlS2V5cyhrZXksIG1pbktleSkgPCAwKSB7XG4gICAgICAgIG1pbktleSA9IGtleTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtaW5LZXk7XG4gIH1cblxuICBfZ2V0UGF0aHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NvcnRTcGVjUGFydHMubWFwKHBhcnQgPT4gcGFydC5wYXRoKTtcbiAgfVxuXG4gIC8vIEdpdmVuIGFuIGluZGV4ICdpJywgcmV0dXJucyBhIGNvbXBhcmF0b3IgdGhhdCBjb21wYXJlcyB0d28ga2V5IGFycmF5cyBiYXNlZFxuICAvLyBvbiBmaWVsZCAnaScuXG4gIF9rZXlGaWVsZENvbXBhcmF0b3IoaSkge1xuICAgIGNvbnN0IGludmVydCA9ICF0aGlzLl9zb3J0U3BlY1BhcnRzW2ldLmFzY2VuZGluZztcblxuICAgIHJldHVybiAoa2V5MSwga2V5MikgPT4ge1xuICAgICAgY29uc3QgY29tcGFyZSA9IExvY2FsQ29sbGVjdGlvbi5fZi5fY21wKGtleTFbaV0sIGtleTJbaV0pO1xuICAgICAgcmV0dXJuIGludmVydCA/IC1jb21wYXJlIDogY29tcGFyZTtcbiAgICB9O1xuICB9XG59XG5cbi8vIEdpdmVuIGFuIGFycmF5IG9mIGNvbXBhcmF0b3JzXG4vLyAoZnVuY3Rpb25zIChhLGIpLT4obmVnYXRpdmUgb3IgcG9zaXRpdmUgb3IgemVybykpLCByZXR1cm5zIGEgc2luZ2xlXG4vLyBjb21wYXJhdG9yIHdoaWNoIHVzZXMgZWFjaCBjb21wYXJhdG9yIGluIG9yZGVyIGFuZCByZXR1cm5zIHRoZSBmaXJzdFxuLy8gbm9uLXplcm8gdmFsdWUuXG5mdW5jdGlvbiBjb21wb3NlQ29tcGFyYXRvcnMoY29tcGFyYXRvckFycmF5KSB7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcGFyYXRvckFycmF5Lmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBjb21wYXJlID0gY29tcGFyYXRvckFycmF5W2ldKGEsIGIpO1xuICAgICAgaWYgKGNvbXBhcmUgIT09IDApIHtcbiAgICAgICAgcmV0dXJuIGNvbXBhcmU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIDA7XG4gIH07XG59XG4iXX0=
