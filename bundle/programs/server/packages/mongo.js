Package["core-runtime"].queue("mongo",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var NpmModuleMongodb = Package['npm-mongo'].NpmModuleMongodb;
var NpmModuleMongodbVersion = Package['npm-mongo'].NpmModuleMongodbVersion;
var AllowDeny = Package['allow-deny'].AllowDeny;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var Decimal = Package['mongo-decimal'].Decimal;
var MaxHeap = Package['binary-heap'].MaxHeap;
var MinHeap = Package['binary-heap'].MinHeap;
var MinMaxHeap = Package['binary-heap'].MinMaxHeap;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var MongoInternals, callback, CollectionExtensions, Mongo, ObserveMultiplexer;

var require = meteorInstall({"node_modules":{"meteor":{"mongo":{"mongo_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_driver.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module1, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module1.export({
      listenAll: () => listenAll,
      forEachTrigger: () => forEachTrigger
    });
    let OplogHandle;
    module1.link("./oplog_tailing", {
      OplogHandle(v) {
        OplogHandle = v;
      }
    }, 0);
    let MongoConnection;
    module1.link("./mongo_connection", {
      MongoConnection(v) {
        MongoConnection = v;
      }
    }, 1);
    let OplogObserveDriver;
    module1.link("./oplog_observe_driver", {
      OplogObserveDriver(v) {
        OplogObserveDriver = v;
      }
    }, 2);
    let MongoDB;
    module1.link("./mongo_common", {
      MongoDB(v) {
        MongoDB = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    MongoInternals = global.MongoInternals = {};
    MongoInternals.__packageName = 'mongo';
    MongoInternals.NpmModules = {
      mongodb: {
        version: NpmModuleMongodbVersion,
        module: MongoDB
      }
    };

    // Older version of what is now available via
    // MongoInternals.NpmModules.mongodb.module.  It was never documented, but
    // people do use it.
    // XXX COMPAT WITH 1.0.3.2
    MongoInternals.NpmModule = new Proxy(MongoDB, {
      get(target, propertyKey, receiver) {
        if (propertyKey === 'ObjectID') {
          Meteor.deprecate("Accessing 'MongoInternals.NpmModule.ObjectID' directly is deprecated. " + "Use 'MongoInternals.NpmModule.ObjectId' instead.");
        }
        return Reflect.get(target, propertyKey, receiver);
      }
    });
    MongoInternals.OplogHandle = OplogHandle;
    MongoInternals.Connection = MongoConnection;
    MongoInternals.OplogObserveDriver = OplogObserveDriver;

    // This is used to add or remove EJSON from the beginning of everything nested
    // inside an EJSON custom type. It should only be called on pure JSON!

    // Ensure that EJSON.clone keeps a Timestamp as a Timestamp (instead of just
    // doing a structural clone).
    // XXX how ok is this? what if there are multiple copies of MongoDB loaded?
    MongoDB.Timestamp.prototype.clone = function () {
      // Timestamps should be immutable.
      return this;
    };

    // Listen for the invalidation messages that will trigger us to poll the
    // database for changes. If this selector specifies specific IDs, specify them
    // here, so that updates to different specific IDs don't cause us to poll.
    // listenCallback is the same kind of (notification, complete) callback passed
    // to InvalidationCrossbar.listen.

    const listenAll = async function (cursorDescription, listenCallback) {
      const listeners = [];
      await forEachTrigger(cursorDescription, function (trigger) {
        listeners.push(DDPServer._InvalidationCrossbar.listen(trigger, listenCallback));
      });
      return {
        stop: function () {
          listeners.forEach(function (listener) {
            listener.stop();
          });
        }
      };
    };
    const forEachTrigger = async function (cursorDescription, triggerCallback) {
      const key = {
        collection: cursorDescription.collectionName
      };
      const specificIds = LocalCollection._idsMatchedBySelector(cursorDescription.selector);
      if (specificIds) {
        for (const id of specificIds) {
          await triggerCallback(Object.assign({
            id: id
          }, key));
        }
        await triggerCallback(Object.assign({
          dropCollection: true,
          id: null
        }, key));
      } else {
        await triggerCallback(key);
      }
      // Everyone cares about the database being dropped.
      await triggerCallback({
        dropDatabase: true
      });
    };
    // XXX We probably need to find a better way to expose this. Right now
    // it's only used by tests, but in fact you need it in normal
    // operation to interact with capped collections.
    MongoInternals.MongoTimestamp = MongoDB.Timestamp;
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

},"oplog_tailing.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_tailing.ts                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      OPLOG_COLLECTION: () => OPLOG_COLLECTION,
      OplogHandle: () => OplogHandle,
      idForOp: () => idForOp
    });
    let isEmpty;
    module.link("lodash.isempty", {
      default(v) {
        isEmpty = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 1);
    let CursorDescription;
    module.link("./cursor_description", {
      CursorDescription(v) {
        CursorDescription = v;
      }
    }, 2);
    let MongoConnection;
    module.link("./mongo_connection", {
      MongoConnection(v) {
        MongoConnection = v;
      }
    }, 3);
    let NpmModuleMongodb;
    module.link("meteor/npm-mongo", {
      NpmModuleMongodb(v) {
        NpmModuleMongodb = v;
      }
    }, 4);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const {
      Long
    } = NpmModuleMongodb;
    const OPLOG_COLLECTION = 'oplog.rs';
    let TOO_FAR_BEHIND = +(process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000);
    const TAIL_TIMEOUT = +(process.env.METEOR_OPLOG_TAIL_TIMEOUT || 30000);
    class OplogHandle {
      constructor(oplogUrl, dbName) {
        var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2, _Meteor$settings2, _Meteor$settings2$pac, _Meteor$settings2$pac2;
        this._oplogUrl = void 0;
        this._dbName = void 0;
        this._oplogLastEntryConnection = void 0;
        this._oplogTailConnection = void 0;
        this._oplogOptions = void 0;
        this._includeNSRegex = void 0;
        this._excludeNSRegex = void 0;
        this._stopped = void 0;
        this._tailHandle = void 0;
        this._readyPromiseResolver = void 0;
        this._readyPromise = void 0;
        this._crossbar = void 0;
        this._catchingUpResolvers = void 0;
        this._lastProcessedTS = void 0;
        this._onSkippedEntriesHook = void 0;
        this._startTrailingPromise = void 0;
        this._resolveTimeout = void 0;
        this._entryQueue = new Meteor._DoubleEndedQueue();
        this._workerActive = false;
        this._workerPromise = null;
        this._oplogUrl = oplogUrl;
        this._dbName = dbName;
        this._resolveTimeout = null;
        this._oplogLastEntryConnection = null;
        this._oplogTailConnection = null;
        this._stopped = false;
        this._tailHandle = null;
        this._readyPromiseResolver = null;
        this._readyPromise = new Promise(r => this._readyPromiseResolver = r);
        this._crossbar = new DDPServer._Crossbar({
          factPackage: "mongo-livedata",
          factName: "oplog-watchers"
        });
        const includeCollections = (_Meteor$settings = Meteor.settings) === null || _Meteor$settings === void 0 ? void 0 : (_Meteor$settings$pack = _Meteor$settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2.oplogIncludeCollections;
        const excludeCollections = (_Meteor$settings2 = Meteor.settings) === null || _Meteor$settings2 === void 0 ? void 0 : (_Meteor$settings2$pac = _Meteor$settings2.packages) === null || _Meteor$settings2$pac === void 0 ? void 0 : (_Meteor$settings2$pac2 = _Meteor$settings2$pac.mongo) === null || _Meteor$settings2$pac2 === void 0 ? void 0 : _Meteor$settings2$pac2.oplogExcludeCollections;
        if (includeCollections !== null && includeCollections !== void 0 && includeCollections.length && excludeCollections !== null && excludeCollections !== void 0 && excludeCollections.length) {
          throw new Error("Can't use both mongo oplog settings oplogIncludeCollections and oplogExcludeCollections at the same time.");
        }
        this._oplogOptions = {
          includeCollections,
          excludeCollections
        };
        if (includeCollections !== null && includeCollections !== void 0 && includeCollections.length) {
          const incAlt = includeCollections.map(c => Meteor._escapeRegExp(c)).join('|');
          this._includeNSRegex = new RegExp("^".concat(Meteor._escapeRegExp(this._dbName), "\\.(?:").concat(incAlt, ")$"));
        }
        if (excludeCollections !== null && excludeCollections !== void 0 && excludeCollections.length) {
          const excAlt = excludeCollections.map(c => Meteor._escapeRegExp(c)).join('|');
          this._excludeNSRegex = new RegExp("^".concat(Meteor._escapeRegExp(this._dbName), "\\.(?:").concat(excAlt, ")$"));
        }
        this._catchingUpResolvers = [];
        this._lastProcessedTS = null;
        this._onSkippedEntriesHook = new Hook({
          debugPrintExceptions: "onSkippedEntries callback"
        });
        this._startTrailingPromise = this._startTailing();
      }
      _nsAllowed(ns) {
        if (!ns) return false;
        if (ns === 'admin.$cmd') return true;
        if (this._includeNSRegex && !this._includeNSRegex.test(ns)) return false;
        if (this._excludeNSRegex && this._excludeNSRegex.test(ns)) return false;
        return true;
      }
      _getOplogSelector(lastProcessedTS) {
        var _this$_oplogOptions$e, _this$_oplogOptions$i;
        const oplogCriteria = [{
          $or: [{
            op: {
              $in: ["i", "u", "d"]
            }
          }, {
            op: "c",
            "o.drop": {
              $exists: true
            }
          }, {
            op: "c",
            "o.dropDatabase": 1
          }, {
            op: "c",
            "o.applyOps": {
              $exists: true
            }
          }]
        }];
        if ((_this$_oplogOptions$e = this._oplogOptions.excludeCollections) !== null && _this$_oplogOptions$e !== void 0 && _this$_oplogOptions$e.length) {
          const nsRegex = new RegExp('^(?:' + [
          // @ts-ignore
          Meteor._escapeRegExp(this._dbName + '.')].join('|') + ')');
          const excludeNs = {
            $regex: nsRegex,
            $nin: this._oplogOptions.excludeCollections.map(collName => "".concat(this._dbName, ".").concat(collName))
          };
          oplogCriteria.push({
            $or: [{
              ns: excludeNs
            }, {
              ns: /^admin\.\$cmd/,
              'o.applyOps': {
                $elemMatch: {
                  ns: excludeNs
                }
              }
            }]
          });
        } else if ((_this$_oplogOptions$i = this._oplogOptions.includeCollections) !== null && _this$_oplogOptions$i !== void 0 && _this$_oplogOptions$i.length) {
          const includeNs = {
            $in: this._oplogOptions.includeCollections.map(collName => "".concat(this._dbName, ".").concat(collName))
          };
          oplogCriteria.push({
            $or: [{
              ns: includeNs
            }, {
              ns: /^admin\.\$cmd/,
              'o.applyOps.ns': includeNs
            }]
          });
        } else {
          const nsRegex = new RegExp("^(?:" + [
          // @ts-ignore
          Meteor._escapeRegExp(this._dbName + "."),
          // @ts-ignore
          Meteor._escapeRegExp("admin.$cmd")].join("|") + ")");
          oplogCriteria.push({
            ns: nsRegex
          });
        }
        if (lastProcessedTS) {
          oplogCriteria.push({
            ts: {
              $gt: lastProcessedTS
            }
          });
        }
        return {
          $and: oplogCriteria
        };
      }
      async stop() {
        if (this._stopped) return;
        this._stopped = true;
        if (this._tailHandle) {
          await this._tailHandle.stop();
        }
      }
      async _onOplogEntry(trigger, callback) {
        if (this._stopped) {
          throw new Error("Called onOplogEntry on stopped handle!");
        }
        await this._readyPromise;
        const originalCallback = callback;
        /**
         * This depends on AsynchronousQueue tasks being wrapped in `bindEnvironment` too.
         *
         * @todo Check after we simplify the `bindEnvironment` implementation if we can remove the second wrap.
         */
        callback = Meteor.bindEnvironment(function (notification) {
          originalCallback(notification);
        },
        // @ts-ignore
        function (err) {
          Meteor._debug("Error in oplog callback", err);
        });
        const listenHandle = this._crossbar.listen(trigger, callback);
        return {
          stop: async function () {
            await listenHandle.stop();
          }
        };
      }
      onOplogEntry(trigger, callback) {
        return this._onOplogEntry(trigger, callback);
      }
      onSkippedEntries(callback) {
        if (this._stopped) {
          throw new Error("Called onSkippedEntries on stopped handle!");
        }
        return this._onSkippedEntriesHook.register(callback);
      }
      async _waitUntilCaughtUp() {
        if (this._stopped) {
          throw new Error("Called waitUntilCaughtUp on stopped handle!");
        }
        await this._readyPromise;
        let lastEntry = null;
        while (!this._stopped) {
          const oplogSelector = this._getOplogSelector();
          try {
            lastEntry = await this._oplogLastEntryConnection.findOneAsync(OPLOG_COLLECTION, oplogSelector, {
              projection: {
                ts: 1
              },
              sort: {
                $natural: -1
              }
            });
            break;
          } catch (e) {
            Meteor._debug("Got exception while reading last entry", e);
            // @ts-ignore
            await Meteor.sleep(100);
          }
        }
        if (this._stopped) return;
        if (!lastEntry) return;
        const ts = lastEntry.ts;
        if (!ts) {
          throw Error("oplog entry without ts: " + JSON.stringify(lastEntry));
        }
        if (this._lastProcessedTS && ts.lessThanOrEqual(this._lastProcessedTS)) {
          return;
        }
        let insertAfter = this._catchingUpResolvers.length;
        while (insertAfter - 1 > 0 && this._catchingUpResolvers[insertAfter - 1].ts.greaterThan(ts)) {
          insertAfter--;
        }
        let promiseResolver = null;
        const promiseToAwait = new Promise(r => promiseResolver = r);
        clearTimeout(this._resolveTimeout);
        this._resolveTimeout = setTimeout(() => {
          console.error("Meteor: oplog catching up took too long", {
            ts
          });
        }, 10000);
        this._catchingUpResolvers.splice(insertAfter, 0, {
          ts,
          resolver: promiseResolver
        });
        await promiseToAwait;
        clearTimeout(this._resolveTimeout);
      }
      async waitUntilCaughtUp() {
        return this._waitUntilCaughtUp();
      }
      async _startTailing() {
        const mongodbUri = require('mongodb-uri');
        if (mongodbUri.parse(this._oplogUrl).database !== 'local') {
          throw new Error("$MONGO_OPLOG_URL must be set to the 'local' database of a Mongo replica set");
        }
        this._oplogTailConnection = new MongoConnection(this._oplogUrl, {
          maxPoolSize: 1,
          minPoolSize: 1
        });
        this._oplogLastEntryConnection = new MongoConnection(this._oplogUrl, {
          maxPoolSize: 1,
          minPoolSize: 1
        });
        try {
          const isMasterDoc = await this._oplogLastEntryConnection.db.admin().command({
            ismaster: 1
          });
          if (!(isMasterDoc && isMasterDoc.setName)) {
            throw new Error("$MONGO_OPLOG_URL must be set to the 'local' database of a Mongo replica set");
          }
          const lastOplogEntry = await this._oplogLastEntryConnection.findOneAsync(OPLOG_COLLECTION, {}, {
            sort: {
              $natural: -1
            },
            projection: {
              ts: 1
            }
          });
          const oplogSelector = this._getOplogSelector(lastOplogEntry === null || lastOplogEntry === void 0 ? void 0 : lastOplogEntry.ts);
          if (lastOplogEntry) {
            this._lastProcessedTS = lastOplogEntry.ts;
          }
          const cursorDescription = new CursorDescription(OPLOG_COLLECTION, oplogSelector, {
            tailable: true
          });
          this._tailHandle = this._oplogTailConnection.tail(cursorDescription, doc => {
            this._entryQueue.push(doc);
            this._maybeStartWorker();
          }, TAIL_TIMEOUT);
          this._readyPromiseResolver();
        } catch (error) {
          console.error('Error in _startTailing:', error);
          throw error;
        }
      }
      _maybeStartWorker() {
        if (this._workerPromise) return;
        this._workerActive = true;
        // Convert to a proper promise-based queue processor
        this._workerPromise = (async () => {
          try {
            while (!this._stopped && !this._entryQueue.isEmpty()) {
              // Are we too far behind? Just tell our observers that they need to
              // repoll, and drop our queue.
              if (this._entryQueue.length > TOO_FAR_BEHIND) {
                const lastEntry = this._entryQueue.pop();
                this._entryQueue.clear();
                this._onSkippedEntriesHook.each(callback => {
                  callback();
                  return true;
                });
                // Free any waitUntilCaughtUp() calls that were waiting for us to
                // pass something that we just skipped.
                this._setLastProcessedTS(lastEntry.ts);
                continue;
              }
              // Process next batch from the queue
              const doc = this._entryQueue.shift();
              try {
                await handleDoc(this, doc);
                // Process any waiting fence callbacks
                if (doc.ts) {
                  this._setLastProcessedTS(doc.ts);
                }
              } catch (e) {
                // Keep processing queue even if one entry fails
                console.error('Error processing oplog entry:', e);
              }
            }
          } finally {
            this._workerPromise = null;
            this._workerActive = false;
          }
        })();
      }
      _setLastProcessedTS(ts) {
        this._lastProcessedTS = ts;
        while (!isEmpty(this._catchingUpResolvers) && this._catchingUpResolvers[0].ts.lessThanOrEqual(this._lastProcessedTS)) {
          const sequencer = this._catchingUpResolvers.shift();
          sequencer.resolver();
        }
      }
      _defineTooFarBehind(value) {
        TOO_FAR_BEHIND = value;
      }
      _resetTooFarBehind() {
        TOO_FAR_BEHIND = +(process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000);
      }
    }
    function idForOp(op) {
      if (op.op === 'd' || op.op === 'i') {
        return op.o._id;
      } else if (op.op === 'u') {
        return op.o2._id;
      } else if (op.op === 'c') {
        throw Error("Operator 'c' doesn't supply an object with id: " + JSON.stringify(op));
      } else {
        throw Error("Unknown op: " + JSON.stringify(op));
      }
    }
    async function handleDoc(handle, doc) {
      if (doc.ns === "admin.$cmd") {
        if (doc.o.applyOps) {
          // This was a successful transaction, so we need to apply the
          // operations that were involved.
          let nextTimestamp = doc.ts;
          for (const op of doc.o.applyOps) {
            // See https://github.com/meteor/meteor/issues/10420.
            if (!op.ts) {
              op.ts = nextTimestamp;
              nextTimestamp = nextTimestamp.add(Long.ONE);
            }
            // Only forward sub-ops whose ns is allowed
            // See https://github.com/meteor/meteor/issues/13945
            if (!handle['_nsAllowed'](op.ns)) {
              continue;
            }
            await handleDoc(handle, op);
          }
          return;
        }
        throw new Error("Unknown command " + JSON.stringify(doc));
      }
      const trigger = {
        dropCollection: false,
        dropDatabase: false,
        op: doc
      };
      if (typeof doc.ns === "string" && doc.ns.startsWith(handle._dbName + ".")) {
        trigger.collection = doc.ns.slice(handle._dbName.length + 1);
      }
      // Is it a special command and the collection name is hidden
      // somewhere in operator?
      if (trigger.collection === "$cmd") {
        if (doc.o.dropDatabase) {
          delete trigger.collection;
          trigger.dropDatabase = true;
        } else if ("drop" in doc.o) {
          trigger.collection = doc.o.drop;
          trigger.dropCollection = true;
          trigger.id = null;
        } else if ("create" in doc.o && "idIndex" in doc.o) {
          // A collection got implicitly created within a transaction. There's
          // no need to do anything about it.
        } else {
          throw Error("Unknown command " + JSON.stringify(doc));
        }
      } else {
        // All other ops have an id.
        trigger.id = idForOp(doc);
      }
      await handle._crossbar.fire(trigger);
      await new Promise(resolve => setImmediate(resolve));
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

},"observe_multiplex.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/observe_multiplex.ts                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 0);
    const _excluded = ["_id"];
    module.export({
      ObserveMultiplexer: () => ObserveMultiplexer
    });
    let isEmpty;
    module.link("lodash.isempty", {
      default(v) {
        isEmpty = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class ObserveMultiplexer {
      constructor(_ref) {
        var _this = this;
        let {
          ordered,
          onStop = () => {}
        } = _ref;
        this._ordered = void 0;
        this._onStop = void 0;
        this._queue = void 0;
        this._handles = void 0;
        this._resolver = void 0;
        this._readyPromise = void 0;
        this._isReady = void 0;
        this._cache = void 0;
        this._addHandleTasksScheduledButNotPerformed = void 0;
        if (ordered === undefined) throw Error("must specify ordered");
        // @ts-ignore
        Package["facts-base"] && Package["facts-base"].Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", 1);
        this._ordered = ordered;
        this._onStop = onStop;
        this._queue = new Meteor._AsynchronousQueue();
        this._handles = {};
        this._resolver = null;
        this._isReady = false;
        this._readyPromise = new Promise(r => this._resolver = r).then(() => this._isReady = true);
        // @ts-ignore
        this._cache = new LocalCollection._CachingChangeObserver({
          ordered
        });
        this._addHandleTasksScheduledButNotPerformed = 0;
        this.callbackNames().forEach(callbackName => {
          this[callbackName] = function () {
            for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
              args[_key] = arguments[_key];
            }
            _this._applyCallback(callbackName, args);
          };
        });
      }
      addHandleAndSendInitialAdds(handle) {
        return this._addHandleAndSendInitialAdds(handle);
      }
      async _addHandleAndSendInitialAdds(handle) {
        ++this._addHandleTasksScheduledButNotPerformed;
        // @ts-ignore
        Package["facts-base"] && Package["facts-base"].Facts.incrementServerFact("mongo-livedata", "observe-handles", 1);
        await this._queue.runTask(async () => {
          this._handles[handle._id] = handle;
          await this._sendAdds(handle);
          --this._addHandleTasksScheduledButNotPerformed;
        });
        await this._readyPromise;
      }
      async removeHandle(id) {
        if (!this._ready()) throw new Error("Can't remove handles until the multiplex is ready");
        delete this._handles[id];
        // @ts-ignore
        Package["facts-base"] && Package["facts-base"].Facts.incrementServerFact("mongo-livedata", "observe-handles", -1);
        if (isEmpty(this._handles) && this._addHandleTasksScheduledButNotPerformed === 0) {
          await this._stop();
        }
      }
      async _stop() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        if (!this._ready() && !options.fromQueryError) throw Error("surprising _stop: not ready");
        await this._onStop();
        // @ts-ignore
        Package["facts-base"] && Package["facts-base"].Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", -1);
        this._handles = null;
      }
      async ready() {
        await this._queue.queueTask(() => {
          if (this._ready()) throw Error("can't make ObserveMultiplex ready twice!");
          if (!this._resolver) {
            throw new Error("Missing resolver");
          }
          this._resolver();
          this._isReady = true;
        });
      }
      async queryError(err) {
        await this._queue.runTask(() => {
          if (this._ready()) throw Error("can't claim query has an error after it worked!");
          this._stop({
            fromQueryError: true
          });
          throw err;
        });
      }
      async onFlush(cb) {
        await this._queue.queueTask(async () => {
          if (!this._ready()) throw Error("only call onFlush on a multiplexer that will be ready");
          await cb();
        });
      }
      callbackNames() {
        return this._ordered ? ["addedBefore", "changed", "movedBefore", "removed"] : ["added", "changed", "removed"];
      }
      _ready() {
        return !!this._isReady;
      }
      _applyCallback(callbackName, args) {
        this._queue.queueTask(async () => {
          if (!this._handles) return;
          await this._cache.applyChange[callbackName].apply(null, args);
          if (!this._ready() && callbackName !== "added" && callbackName !== "addedBefore") {
            throw new Error("Got ".concat(callbackName, " during initial adds"));
          }
          for (const handleId of Object.keys(this._handles)) {
            const handle = this._handles && this._handles[handleId];
            if (!handle) return;
            const callback = handle["_".concat(callbackName)];
            if (!callback) continue;
            const result = callback.apply(null, handle.nonMutatingCallbacks ? args : EJSON.clone(args));
            if (result && Meteor._isPromise(result)) {
              result.catch(error => {
                console.error("Error in observeChanges callback ".concat(callbackName, ":"), error);
              });
            }
            handle.initialAddsSent.then(result);
          }
        });
      }
      async _sendAdds(handle) {
        const add = this._ordered ? handle._addedBefore : handle._added;
        if (!add) return;
        const addPromises = [];
        // note: docs may be an _IdMap or an OrderedDict
        this._cache.docs.forEach((doc, id) => {
          if (!(handle._id in this._handles)) {
            throw Error("handle got removed before sending initial adds!");
          }
          const _ref2 = handle.nonMutatingCallbacks ? doc : EJSON.clone(doc),
            {
              _id
            } = _ref2,
            fields = _objectWithoutProperties(_ref2, _excluded);
          const promise = new Promise((resolve, reject) => {
            try {
              const r = this._ordered ? add(id, fields, null) : add(id, fields);
              resolve(r);
            } catch (error) {
              reject(error);
            }
          });
          addPromises.push(promise);
        });
        await Promise.allSettled(addPromises).then(p => {
          p.forEach(result => {
            if (result.status === "rejected") {
              console.error("Error in adds for handle: ".concat(result.reason));
            }
          });
        });
        handle.initialAddsSentResolver();
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

},"doc_fetcher.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/doc_fetcher.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DocFetcher: () => DocFetcher
});
class DocFetcher {
  constructor(mongoConnection) {
    this._mongoConnection = mongoConnection;
    // Map from op -> [callback]
    this._callbacksForOp = new Map();
  }

  // Fetches document "id" from collectionName, returning it or null if not
  // found.
  //
  // If you make multiple calls to fetch() with the same op reference,
  // DocFetcher may assume that they all return the same document. (It does
  // not check to see if collectionName/id match.)
  //
  // You may assume that callback is never called synchronously (and in fact
  // OplogObserveDriver does so).
  async fetch(collectionName, id, op, callback) {
    const self = this;
    check(collectionName, String);
    check(op, Object);

    // If there's already an in-progress fetch for this cache key, yield until
    // it's done and return whatever it returns.
    if (self._callbacksForOp.has(op)) {
      self._callbacksForOp.get(op).push(callback);
      return;
    }
    const callbacks = [callback];
    self._callbacksForOp.set(op, callbacks);
    try {
      var doc = (await self._mongoConnection.findOneAsync(collectionName, {
        _id: id
      })) || null;
      // Return doc to all relevant callbacks. Note that this array can
      // continue to grow during callback excecution.
      while (callbacks.length > 0) {
        // Clone the document so that the various calls to fetch don't return
        // objects that are intertwingled with each other. Clone before
        // popping the future, so that if clone throws, the error gets passed
        // to the next callback.
        callbacks.pop()(null, EJSON.clone(doc));
      }
    } catch (e) {
      while (callbacks.length > 0) {
        callbacks.pop()(e);
      }
    } finally {
      // XXX consider keeping the doc around for a period of time before
      // removing from the cache
      self._callbacksForOp.delete(op);
    }
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"polling_observe_driver.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/polling_observe_driver.ts                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      PollingObserveDriver: () => PollingObserveDriver
    });
    let throttle;
    module.link("lodash.throttle", {
      default(v) {
        throttle = v;
      }
    }, 0);
    let listenAll;
    module.link("./mongo_driver", {
      listenAll(v) {
        listenAll = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const POLLING_THROTTLE_MS = +(process.env.METEOR_POLLING_THROTTLE_MS || '') || 50;
    const POLLING_INTERVAL_MS = +(process.env.METEOR_POLLING_INTERVAL_MS || '') || 10 * 1000;
    /**
     * @class PollingObserveDriver
     *
     * One of two observe driver implementations.
     *
     * Characteristics:
     * - Caches the results of a query
     * - Reruns the query when necessary
     * - Suitable for cases where oplog tailing is not available or practical
     */
    class PollingObserveDriver {
      constructor(options) {
        this._options = void 0;
        this._cursorDescription = void 0;
        this._mongoHandle = void 0;
        this._ordered = void 0;
        this._multiplexer = void 0;
        this._stopCallbacks = void 0;
        this._stopped = void 0;
        this._cursor = void 0;
        this._results = void 0;
        this._pollsScheduledButNotStarted = void 0;
        this._pendingWrites = void 0;
        this._ensurePollIsScheduled = void 0;
        this._taskQueue = void 0;
        this._testOnlyPollCallback = void 0;
        this._options = options;
        this._cursorDescription = options.cursorDescription;
        this._mongoHandle = options.mongoHandle;
        this._ordered = options.ordered;
        this._multiplexer = options.multiplexer;
        this._stopCallbacks = [];
        this._stopped = false;
        this._cursor = this._mongoHandle._createAsynchronousCursor(this._cursorDescription);
        this._results = null;
        this._pollsScheduledButNotStarted = 0;
        this._pendingWrites = [];
        this._ensurePollIsScheduled = throttle(this._unthrottledEnsurePollIsScheduled.bind(this), this._cursorDescription.options.pollingThrottleMs || POLLING_THROTTLE_MS);
        this._taskQueue = new Meteor._AsynchronousQueue();
      }
      async _init() {
        var _Package$factsBase;
        const options = this._options;
        const listenersHandle = await listenAll(this._cursorDescription, notification => {
          const fence = DDPServer._getCurrentFence();
          if (fence) {
            this._pendingWrites.push(fence.beginWrite());
          }
          if (this._pollsScheduledButNotStarted === 0) {
            this._ensurePollIsScheduled();
          }
        });
        this._stopCallbacks.push(async () => {
          await listenersHandle.stop();
        });
        if (options._testOnlyPollCallback) {
          this._testOnlyPollCallback = options._testOnlyPollCallback;
        } else {
          const pollingInterval = this._cursorDescription.options.pollingIntervalMs || this._cursorDescription.options._pollingInterval || POLLING_INTERVAL_MS;
          const intervalHandle = Meteor.setInterval(this._ensurePollIsScheduled.bind(this), pollingInterval);
          this._stopCallbacks.push(() => {
            Meteor.clearInterval(intervalHandle);
          });
        }
        await this._unthrottledEnsurePollIsScheduled();
        (_Package$factsBase = Package['facts-base']) === null || _Package$factsBase === void 0 ? void 0 : _Package$factsBase.Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", 1);
      }
      async _unthrottledEnsurePollIsScheduled() {
        if (this._pollsScheduledButNotStarted > 0) return;
        ++this._pollsScheduledButNotStarted;
        await this._taskQueue.runTask(async () => {
          await this._pollMongo();
        });
      }
      _suspendPolling() {
        ++this._pollsScheduledButNotStarted;
        this._taskQueue.runTask(() => {});
        if (this._pollsScheduledButNotStarted !== 1) {
          throw new Error("_pollsScheduledButNotStarted is ".concat(this._pollsScheduledButNotStarted));
        }
      }
      async _resumePolling() {
        if (this._pollsScheduledButNotStarted !== 1) {
          throw new Error("_pollsScheduledButNotStarted is ".concat(this._pollsScheduledButNotStarted));
        }
        await this._taskQueue.runTask(async () => {
          await this._pollMongo();
        });
      }
      async _pollMongo() {
        var _this$_testOnlyPollCa;
        --this._pollsScheduledButNotStarted;
        if (this._stopped) return;
        let first = false;
        let newResults;
        let oldResults = this._results;
        if (!oldResults) {
          first = true;
          oldResults = this._ordered ? [] : new LocalCollection._IdMap();
        }
        (_this$_testOnlyPollCa = this._testOnlyPollCallback) === null || _this$_testOnlyPollCa === void 0 ? void 0 : _this$_testOnlyPollCa.call(this);
        const writesForCycle = this._pendingWrites;
        this._pendingWrites = [];
        try {
          newResults = await this._cursor.getRawObjects(this._ordered);
        } catch (e) {
          if (first && typeof e.code === 'number') {
            await this._multiplexer.queryError(new Error("Exception while polling query ".concat(JSON.stringify(this._cursorDescription), ": ").concat(e.message)));
          }
          Array.prototype.push.apply(this._pendingWrites, writesForCycle);
          Meteor._debug("Exception while polling query ".concat(JSON.stringify(this._cursorDescription)), e);
          return;
        }
        if (!this._stopped) {
          LocalCollection._diffQueryChanges(this._ordered, oldResults, newResults, this._multiplexer);
        }
        if (first) this._multiplexer.ready();
        this._results = newResults;
        await this._multiplexer.onFlush(async () => {
          for (const w of writesForCycle) {
            await w.committed();
          }
        });
      }
      async stop() {
        var _Package$factsBase2;
        this._stopped = true;
        for (const callback of this._stopCallbacks) {
          await callback();
        }
        for (const w of this._pendingWrites) {
          await w.committed();
        }
        (_Package$factsBase2 = Package['facts-base']) === null || _Package$factsBase2 === void 0 ? void 0 : _Package$factsBase2.Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", -1);
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

},"oplog_observe_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_observe_driver.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _asyncIterator;
    module.link("@babel/runtime/helpers/asyncIterator", {
      default(v) {
        _asyncIterator = v;
      }
    }, 0);
    module.export({
      OplogObserveDriver: () => OplogObserveDriver
    });
    let has;
    module.link("lodash.has", {
      default(v) {
        has = v;
      }
    }, 0);
    let isEmpty;
    module.link("lodash.isempty", {
      default(v) {
        isEmpty = v;
      }
    }, 1);
    let oplogV2V1Converter;
    module.link("./oplog_v2_converter", {
      oplogV2V1Converter(v) {
        oplogV2V1Converter = v;
      }
    }, 2);
    let check, Match;
    module.link("meteor/check", {
      check(v) {
        check = v;
      },
      Match(v) {
        Match = v;
      }
    }, 3);
    let CursorDescription;
    module.link("./cursor_description", {
      CursorDescription(v) {
        CursorDescription = v;
      }
    }, 4);
    let forEachTrigger, listenAll;
    module.link("./mongo_driver", {
      forEachTrigger(v) {
        forEachTrigger = v;
      },
      listenAll(v) {
        listenAll = v;
      }
    }, 5);
    let Cursor;
    module.link("./cursor", {
      Cursor(v) {
        Cursor = v;
      }
    }, 6);
    let LocalCollection;
    module.link("meteor/minimongo/local_collection", {
      default(v) {
        LocalCollection = v;
      }
    }, 7);
    let idForOp;
    module.link("./oplog_tailing", {
      idForOp(v) {
        idForOp = v;
      }
    }, 8);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var PHASE = {
      QUERYING: "QUERYING",
      FETCHING: "FETCHING",
      STEADY: "STEADY"
    };

    // Exception thrown by _needToPollQuery which unrolls the stack up to the
    // enclosing call to finishIfNeedToPollQuery.
    var SwitchedToQuery = function () {};
    var finishIfNeedToPollQuery = function (f) {
      return function () {
        try {
          f.apply(this, arguments);
        } catch (e) {
          if (!(e instanceof SwitchedToQuery)) throw e;
        }
      };
    };
    var currentId = 0;

    /**
     * @class OplogObserveDriver
     * An alternative to PollingObserveDriver which follows the MongoDB operation log
     * instead of re-polling the query.
     *
     * Characteristics:
     * - Follows the MongoDB operation log
     * - Directly observes database changes
     * - More efficient than polling for most use cases
     * - Requires access to MongoDB oplog
     *
     * Interface:
     * - Construction initiates observeChanges callbacks and ready() invocation to the ObserveMultiplexer
     * - Observation can be terminated via the stop() method
     */
    const OplogObserveDriver = function (options) {
      const self = this;
      self._usesOplog = true; // tests look at this

      self._id = currentId;
      currentId++;
      self._cursorDescription = options.cursorDescription;
      self._mongoHandle = options.mongoHandle;
      self._multiplexer = options.multiplexer;
      if (options.ordered) {
        throw Error("OplogObserveDriver only supports unordered observeChanges");
      }
      const sorter = options.sorter;
      // We don't support $near and other geo-queries so it's OK to initialize the
      // comparator only once in the constructor.
      const comparator = sorter && sorter.getComparator();
      if (options.cursorDescription.options.limit) {
        // There are several properties ordered driver implements:
        // - _limit is a positive number
        // - _comparator is a function-comparator by which the query is ordered
        // - _unpublishedBuffer is non-null Min/Max Heap,
        //                      the empty buffer in STEADY phase implies that the
        //                      everything that matches the queries selector fits
        //                      into published set.
        // - _published - Max Heap (also implements IdMap methods)

        const heapOptions = {
          IdMap: LocalCollection._IdMap
        };
        self._limit = self._cursorDescription.options.limit;
        self._comparator = comparator;
        self._sorter = sorter;
        self._unpublishedBuffer = new MinMaxHeap(comparator, heapOptions);
        // We need something that can find Max value in addition to IdMap interface
        self._published = new MaxHeap(comparator, heapOptions);
      } else {
        self._limit = 0;
        self._comparator = null;
        self._sorter = null;
        self._unpublishedBuffer = null;
        // Memory Growth
        self._published = new LocalCollection._IdMap();
      }

      // Indicates if it is safe to insert a new document at the end of the buffer
      // for this query. i.e. it is known that there are no documents matching the
      // selector those are not in published or buffer.
      self._safeAppendToBuffer = false;
      self._stopped = false;
      self._stopHandles = [];
      self._addStopHandles = function (newStopHandles) {
        const expectedPattern = Match.ObjectIncluding({
          stop: Function
        });
        // Single item or array
        check(newStopHandles, Match.OneOf([expectedPattern], expectedPattern));
        self._stopHandles.push(newStopHandles);
      };
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", 1);
      self._registerPhaseChange(PHASE.QUERYING);
      self._matcher = options.matcher;
      // we are now using projection, not fields in the cursor description even if you pass {fields}
      // in the cursor construction
      const projection = self._cursorDescription.options.fields || self._cursorDescription.options.projection || {};
      self._projectionFn = LocalCollection._compileProjection(projection);
      // Projection function, result of combining important fields for selector and
      // existing fields projection
      self._sharedProjection = self._matcher.combineIntoProjection(projection);
      if (sorter) self._sharedProjection = sorter.combineIntoProjection(self._sharedProjection);
      self._sharedProjectionFn = LocalCollection._compileProjection(self._sharedProjection);
      self._needToFetch = new LocalCollection._IdMap();
      self._currentlyFetching = null;
      self._fetchGeneration = 0;
      self._requeryWhenDoneThisQuery = false;
      self._writesToCommitWhenWeReachSteady = [];
    };
    Object.assign(OplogObserveDriver.prototype, {
      _init: async function () {
        const self = this;

        // If the oplog handle tells us that it skipped some entries (because it got
        // behind, say), re-poll.
        self._addStopHandles(self._mongoHandle._oplogHandle.onSkippedEntries(finishIfNeedToPollQuery(function () {
          return self._needToPollQuery();
        })));
        await forEachTrigger(self._cursorDescription, async function (trigger) {
          self._addStopHandles(await self._mongoHandle._oplogHandle.onOplogEntry(trigger, function (notification) {
            finishIfNeedToPollQuery(function () {
              const op = notification.op;
              if (notification.dropCollection || notification.dropDatabase) {
                // Note: this call is not allowed to block on anything (especially
                // on waiting for oplog entries to catch up) because that will block
                // onOplogEntry!
                return self._needToPollQuery();
              } else {
                // All other operators should be handled depending on phase
                if (self._phase === PHASE.QUERYING) {
                  return self._handleOplogEntryQuerying(op);
                } else {
                  return self._handleOplogEntrySteadyOrFetching(op);
                }
              }
            })();
          }));
        });

        // XXX ordering w.r.t. everything else?
        self._addStopHandles(await listenAll(self._cursorDescription, function () {
          // If we're not in a pre-fire write fence, we don't have to do anything.
          const fence = DDPServer._getCurrentFence();
          if (!fence || fence.fired) return;
          if (fence._oplogObserveDrivers) {
            fence._oplogObserveDrivers[self._id] = self;
            return;
          }
          fence._oplogObserveDrivers = {};
          fence._oplogObserveDrivers[self._id] = self;
          fence.onBeforeFire(async function () {
            const drivers = fence._oplogObserveDrivers;
            delete fence._oplogObserveDrivers;

            // This fence cannot fire until we've caught up to "this point" in the
            // oplog, and all observers made it back to the steady state.
            await self._mongoHandle._oplogHandle.waitUntilCaughtUp();
            for (const driver of Object.values(drivers)) {
              if (driver._stopped) continue;
              const write = await fence.beginWrite();
              if (driver._phase === PHASE.STEADY) {
                // Make sure that all of the callbacks have made it through the
                // multiplexer and been delivered to ObserveHandles before committing
                // writes.
                await driver._multiplexer.onFlush(write.committed);
              } else {
                driver._writesToCommitWhenWeReachSteady.push(write);
              }
            }
          });
        }));

        // When Mongo fails over, we need to repoll the query, in case we processed an
        // oplog entry that got rolled back.
        self._addStopHandles(self._mongoHandle._onFailover(finishIfNeedToPollQuery(function () {
          return self._needToPollQuery();
        })));

        // Give _observeChanges a chance to add the new ObserveHandle to our
        // multiplexer, so that the added calls get streamed.
        return self._runInitialQuery();
      },
      _addPublished: function (id, doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var fields = Object.assign({}, doc);
          delete fields._id;
          self._published.set(id, self._sharedProjectionFn(doc));
          self._multiplexer.added(id, self._projectionFn(fields));

          // After adding this document, the published set might be overflowed
          // (exceeding capacity specified by limit). If so, push the maximum
          // element to the buffer, we might want to save it in memory to reduce the
          // amount of Mongo lookups in the future.
          if (self._limit && self._published.size() > self._limit) {
            // XXX in theory the size of published is no more than limit+1
            if (self._published.size() !== self._limit + 1) {
              throw new Error("After adding to published, " + (self._published.size() - self._limit) + " documents are overflowing the set");
            }
            var overflowingDocId = self._published.maxElementId();
            var overflowingDoc = self._published.get(overflowingDocId);
            if (EJSON.equals(overflowingDocId, id)) {
              throw new Error("The document just added is overflowing the published set");
            }
            self._published.remove(overflowingDocId);
            self._multiplexer.removed(overflowingDocId);
            self._addBuffered(overflowingDocId, overflowingDoc);
          }
        });
      },
      _removePublished: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._published.remove(id);
          self._multiplexer.removed(id);
          if (!self._limit || self._published.size() === self._limit) return;
          if (self._published.size() > self._limit) throw Error("self._published got too big");

          // OK, we are publishing less than the limit. Maybe we should look in the
          // buffer to find the next element past what we were publishing before.

          if (!self._unpublishedBuffer.empty()) {
            // There's something in the buffer; move the first thing in it to
            // _published.
            var newDocId = self._unpublishedBuffer.minElementId();
            var newDoc = self._unpublishedBuffer.get(newDocId);
            self._removeBuffered(newDocId);
            self._addPublished(newDocId, newDoc);
            return;
          }

          // There's nothing in the buffer.  This could mean one of a few things.

          // (a) We could be in the middle of re-running the query (specifically, we
          // could be in _publishNewResults). In that case, _unpublishedBuffer is
          // empty because we clear it at the beginning of _publishNewResults. In
          // this case, our caller already knows the entire answer to the query and
          // we don't need to do anything fancy here.  Just return.
          if (self._phase === PHASE.QUERYING) return;

          // (b) We're pretty confident that the union of _published and
          // _unpublishedBuffer contain all documents that match selector. Because
          // _unpublishedBuffer is empty, that means we're confident that _published
          // contains all documents that match selector. So we have nothing to do.
          if (self._safeAppendToBuffer) return;

          // (c) Maybe there are other documents out there that should be in our
          // buffer. But in that case, when we emptied _unpublishedBuffer in
          // _removeBuffered, we should have called _needToPollQuery, which will
          // either put something in _unpublishedBuffer or set _safeAppendToBuffer
          // (or both), and it will put us in QUERYING for that whole time. So in
          // fact, we shouldn't be able to get here.

          throw new Error("Buffer inexplicably empty");
        });
      },
      _changePublished: function (id, oldDoc, newDoc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._published.set(id, self._sharedProjectionFn(newDoc));
          var projectedNew = self._projectionFn(newDoc);
          var projectedOld = self._projectionFn(oldDoc);
          var changed = DiffSequence.makeChangedFields(projectedNew, projectedOld);
          if (!isEmpty(changed)) self._multiplexer.changed(id, changed);
        });
      },
      _addBuffered: function (id, doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._unpublishedBuffer.set(id, self._sharedProjectionFn(doc));

          // If something is overflowing the buffer, we just remove it from cache
          if (self._unpublishedBuffer.size() > self._limit) {
            var maxBufferedId = self._unpublishedBuffer.maxElementId();
            self._unpublishedBuffer.remove(maxBufferedId);

            // Since something matching is removed from cache (both published set and
            // buffer), set flag to false
            self._safeAppendToBuffer = false;
          }
        });
      },
      // Is called either to remove the doc completely from matching set or to move
      // it to the published set later.
      _removeBuffered: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._unpublishedBuffer.remove(id);
          // To keep the contract "buffer is never empty in STEADY phase unless the
          // everything matching fits into published" true, we poll everything as
          // soon as we see the buffer becoming empty.
          if (!self._unpublishedBuffer.size() && !self._safeAppendToBuffer) self._needToPollQuery();
        });
      },
      // Called when a document has joined the "Matching" results set.
      // Takes responsibility of keeping _unpublishedBuffer in sync with _published
      // and the effect of limit enforced.
      _addMatching: function (doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var id = doc._id;
          if (self._published.has(id)) throw Error("tried to add something already published " + id);
          if (self._limit && self._unpublishedBuffer.has(id)) throw Error("tried to add something already existed in buffer " + id);
          var limit = self._limit;
          var comparator = self._comparator;
          var maxPublished = limit && self._published.size() > 0 ? self._published.get(self._published.maxElementId()) : null;
          var maxBuffered = limit && self._unpublishedBuffer.size() > 0 ? self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId()) : null;
          // The query is unlimited or didn't publish enough documents yet or the
          // new document would fit into published set pushing the maximum element
          // out, then we need to publish the doc.
          var toPublish = !limit || self._published.size() < limit || comparator(doc, maxPublished) < 0;

          // Otherwise we might need to buffer it (only in case of limited query).
          // Buffering is allowed if the buffer is not filled up yet and all
          // matching docs are either in the published set or in the buffer.
          var canAppendToBuffer = !toPublish && self._safeAppendToBuffer && self._unpublishedBuffer.size() < limit;

          // Or if it is small enough to be safely inserted to the middle or the
          // beginning of the buffer.
          var canInsertIntoBuffer = !toPublish && maxBuffered && comparator(doc, maxBuffered) <= 0;
          var toBuffer = canAppendToBuffer || canInsertIntoBuffer;
          if (toPublish) {
            self._addPublished(id, doc);
          } else if (toBuffer) {
            self._addBuffered(id, doc);
          } else {
            // dropping it and not saving to the cache
            self._safeAppendToBuffer = false;
          }
        });
      },
      // Called when a document leaves the "Matching" results set.
      // Takes responsibility of keeping _unpublishedBuffer in sync with _published
      // and the effect of limit enforced.
      _removeMatching: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (!self._published.has(id) && !self._limit) throw Error("tried to remove something matching but not cached " + id);
          if (self._published.has(id)) {
            self._removePublished(id);
          } else if (self._unpublishedBuffer.has(id)) {
            self._removeBuffered(id);
          }
        });
      },
      _handleDoc: function (id, newDoc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var matchesNow = newDoc && self._matcher.documentMatches(newDoc).result;
          var publishedBefore = self._published.has(id);
          var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);
          var cachedBefore = publishedBefore || bufferedBefore;
          if (matchesNow && !cachedBefore) {
            self._addMatching(newDoc);
          } else if (cachedBefore && !matchesNow) {
            self._removeMatching(id);
          } else if (cachedBefore && matchesNow) {
            var oldDoc = self._published.get(id);
            var comparator = self._comparator;
            var minBuffered = self._limit && self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.minElementId());
            var maxBuffered;
            if (publishedBefore) {
              // Unlimited case where the document stays in published once it
              // matches or the case when we don't have enough matching docs to
              // publish or the changed but matching doc will stay in published
              // anyways.
              //
              // XXX: We rely on the emptiness of buffer. Be sure to maintain the
              // fact that buffer can't be empty if there are matching documents not
              // published. Notably, we don't want to schedule repoll and continue
              // relying on this property.
              var staysInPublished = !self._limit || self._unpublishedBuffer.size() === 0 || comparator(newDoc, minBuffered) <= 0;
              if (staysInPublished) {
                self._changePublished(id, oldDoc, newDoc);
              } else {
                // after the change doc doesn't stay in the published, remove it
                self._removePublished(id);
                // but it can move into buffered now, check it
                maxBuffered = self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());
                var toBuffer = self._safeAppendToBuffer || maxBuffered && comparator(newDoc, maxBuffered) <= 0;
                if (toBuffer) {
                  self._addBuffered(id, newDoc);
                } else {
                  // Throw away from both published set and buffer
                  self._safeAppendToBuffer = false;
                }
              }
            } else if (bufferedBefore) {
              oldDoc = self._unpublishedBuffer.get(id);
              // remove the old version manually instead of using _removeBuffered so
              // we don't trigger the querying immediately.  if we end this block
              // with the buffer empty, we will need to trigger the query poll
              // manually too.
              self._unpublishedBuffer.remove(id);
              var maxPublished = self._published.get(self._published.maxElementId());
              maxBuffered = self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());

              // the buffered doc was updated, it could move to published
              var toPublish = comparator(newDoc, maxPublished) < 0;

              // or stays in buffer even after the change
              var staysInBuffer = !toPublish && self._safeAppendToBuffer || !toPublish && maxBuffered && comparator(newDoc, maxBuffered) <= 0;
              if (toPublish) {
                self._addPublished(id, newDoc);
              } else if (staysInBuffer) {
                // stays in buffer but changes
                self._unpublishedBuffer.set(id, newDoc);
              } else {
                // Throw away from both published set and buffer
                self._safeAppendToBuffer = false;
                // Normally this check would have been done in _removeBuffered but
                // we didn't use it, so we need to do it ourself now.
                if (!self._unpublishedBuffer.size()) {
                  self._needToPollQuery();
                }
              }
            } else {
              throw new Error("cachedBefore implies either of publishedBefore or bufferedBefore is true.");
            }
          }
        });
      },
      _fetchModifiedDocuments: function () {
        var self = this;
        self._registerPhaseChange(PHASE.FETCHING);
        // Defer, because nothing called from the oplog entry handler may yield,
        // but fetch() yields.
        Meteor.defer(finishIfNeedToPollQuery(async function () {
          while (!self._stopped && !self._needToFetch.empty()) {
            if (self._phase === PHASE.QUERYING) {
              // While fetching, we decided to go into QUERYING mode, and then we
              // saw another oplog entry, so _needToFetch is not empty. But we
              // shouldn't fetch these documents until AFTER the query is done.
              break;
            }

            // Being in steady phase here would be surprising.
            if (self._phase !== PHASE.FETCHING) throw new Error("phase in fetchModifiedDocuments: " + self._phase);
            self._currentlyFetching = self._needToFetch;
            var thisGeneration = ++self._fetchGeneration;
            self._needToFetch = new LocalCollection._IdMap();

            // Create an array of promises for all the fetch operations
            const fetchPromises = [];
            self._currentlyFetching.forEach(function (op, id) {
              const fetchPromise = new Promise((resolve, reject) => {
                self._mongoHandle._docFetcher.fetch(self._cursorDescription.collectionName, id, op, finishIfNeedToPollQuery(function (err, doc) {
                  if (err) {
                    Meteor._debug('Got exception while fetching documents', err);
                    // If we get an error from the fetcher (eg, trouble
                    // connecting to Mongo), let's just abandon the fetch phase
                    // altogether and fall back to polling. It's not like we're
                    // getting live updates anyway.
                    if (self._phase !== PHASE.QUERYING) {
                      self._needToPollQuery();
                    }
                    resolve();
                    return;
                  }
                  if (!self._stopped && self._phase === PHASE.FETCHING && self._fetchGeneration === thisGeneration) {
                    // We re-check the generation in case we've had an explicit
                    // _pollQuery call (eg, in another fiber) which should
                    // effectively cancel this round of fetches.  (_pollQuery
                    // increments the generation.)
                    try {
                      self._handleDoc(id, doc);
                      resolve();
                    } catch (err) {
                      reject(err);
                    }
                  } else {
                    resolve();
                  }
                }));
              });
              fetchPromises.push(fetchPromise);
            });
            // Wait for all fetch operations to complete
            try {
              const results = await Promise.allSettled(fetchPromises);
              const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
              if (errors.length > 0) {
                Meteor._debug('Some fetch queries failed:', errors);
              }
            } catch (err) {
              Meteor._debug('Got an exception in a fetch query', err);
            }
            // Exit now if we've had a _pollQuery call (here or in another fiber).
            if (self._phase === PHASE.QUERYING) return;
            self._currentlyFetching = null;
          }
          // We're done fetching, so we can be steady, unless we've had a
          // _pollQuery call (here or in another fiber).
          if (self._phase !== PHASE.QUERYING) await self._beSteady();
        }));
      },
      _beSteady: async function () {
        var self = this;
        self._registerPhaseChange(PHASE.STEADY);
        var writes = self._writesToCommitWhenWeReachSteady || [];
        self._writesToCommitWhenWeReachSteady = [];
        await self._multiplexer.onFlush(async function () {
          try {
            for (const w of writes) {
              await w.committed();
            }
          } catch (e) {
            console.error("_beSteady error", {
              writes
            }, e);
          }
        });
      },
      _handleOplogEntryQuerying: function (op) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._needToFetch.set(idForOp(op), op);
        });
      },
      _handleOplogEntrySteadyOrFetching: function (op) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var id = idForOp(op);
          // If we're already fetching this one, or about to, we can't optimize;
          // make sure that we fetch it again if necessary.

          if (self._phase === PHASE.FETCHING && (self._currentlyFetching && self._currentlyFetching.has(id) || self._needToFetch.has(id))) {
            self._needToFetch.set(id, op);
            return;
          }
          if (op.op === 'd') {
            if (self._published.has(id) || self._limit && self._unpublishedBuffer.has(id)) self._removeMatching(id);
          } else if (op.op === 'i') {
            if (self._published.has(id)) throw new Error("insert found for already-existing ID in published");
            if (self._unpublishedBuffer && self._unpublishedBuffer.has(id)) throw new Error("insert found for already-existing ID in buffer");

            // XXX what if selector yields?  for now it can't but later it could
            // have $where
            if (self._matcher.documentMatches(op.o).result) self._addMatching(op.o);
          } else if (op.op === 'u') {
            // we are mapping the new oplog format on mongo 5
            // to what we know better, $set
            op.o = oplogV2V1Converter(op.o);
            // Is this a modifier ($set/$unset, which may require us to poll the
            // database to figure out if the whole document matches the selector) or
            // a replacement (in which case we can just directly re-evaluate the
            // selector)?
            // oplog format has changed on mongodb 5, we have to support both now
            // diff is the format in Mongo 5+ (oplog v2)
            var isReplace = !has(op.o, '$set') && !has(op.o, 'diff') && !has(op.o, '$unset');
            // If this modifier modifies something inside an EJSON custom type (ie,
            // anything with EJSON$), then we can't try to use
            // LocalCollection._modify, since that just mutates the EJSON encoding,
            // not the actual object.
            var canDirectlyModifyDoc = !isReplace && modifierCanBeDirectlyApplied(op.o);
            var publishedBefore = self._published.has(id);
            var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);
            if (isReplace) {
              self._handleDoc(id, Object.assign({
                _id: id
              }, op.o));
            } else if ((publishedBefore || bufferedBefore) && canDirectlyModifyDoc) {
              // Oh great, we actually know what the document is, so we can apply
              // this directly.
              var newDoc = self._published.has(id) ? self._published.get(id) : self._unpublishedBuffer.get(id);
              newDoc = EJSON.clone(newDoc);
              newDoc._id = id;
              try {
                LocalCollection._modify(newDoc, op.o);
              } catch (e) {
                if (e.name !== "MinimongoError") throw e;
                // We didn't understand the modifier.  Re-fetch.
                self._needToFetch.set(id, op);
                if (self._phase === PHASE.STEADY) {
                  self._fetchModifiedDocuments();
                }
                return;
              }
              self._handleDoc(id, self._sharedProjectionFn(newDoc));
            } else if (!canDirectlyModifyDoc || self._matcher.canBecomeTrueByModifier(op.o) || self._sorter && self._sorter.affectedByModifier(op.o)) {
              self._needToFetch.set(id, op);
              if (self._phase === PHASE.STEADY) self._fetchModifiedDocuments();
            }
          } else {
            throw Error("XXX SURPRISING OPERATION: " + op);
          }
        });
      },
      async _runInitialQueryAsync() {
        var self = this;
        if (self._stopped) throw new Error("oplog stopped surprisingly early");
        await self._runQuery({
          initial: true
        }); // yields

        if (self._stopped) return; // can happen on queryError

        // Allow observeChanges calls to return. (After this, it's possible for
        // stop() to be called.)
        await self._multiplexer.ready();
        await self._doneQuerying(); // yields
      },
      // Yields!
      _runInitialQuery: function () {
        return this._runInitialQueryAsync();
      },
      // In various circumstances, we may just want to stop processing the oplog and
      // re-run the initial query, just as if we were a PollingObserveDriver.
      //
      // This function may not block, because it is called from an oplog entry
      // handler.
      //
      // XXX We should call this when we detect that we've been in FETCHING for "too
      // long".
      //
      // XXX We should call this when we detect Mongo failover (since that might
      // mean that some of the oplog entries we have processed have been rolled
      // back). The Node Mongo driver is in the middle of a bunch of huge
      // refactorings, including the way that it notifies you when primary
      // changes. Will put off implementing this until driver 1.4 is out.
      _pollQuery: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (self._stopped) return;

          // Yay, we get to forget about all the things we thought we had to fetch.
          self._needToFetch = new LocalCollection._IdMap();
          self._currentlyFetching = null;
          ++self._fetchGeneration; // ignore any in-flight fetches
          self._registerPhaseChange(PHASE.QUERYING);

          // Defer so that we don't yield.  We don't need finishIfNeedToPollQuery
          // here because SwitchedToQuery is not thrown in QUERYING mode.
          Meteor.defer(async function () {
            await self._runQuery();
            await self._doneQuerying();
          });
        });
      },
      // Yields!
      async _runQueryAsync(options) {
        var self = this;
        options = options || {};
        var newResults, newBuffer;

        // This while loop is just to retry failures.
        while (true) {
          // If we've been stopped, we don't have to run anything any more.
          if (self._stopped) return;
          newResults = new LocalCollection._IdMap();
          newBuffer = new LocalCollection._IdMap();

          // Query 2x documents as the half excluded from the original query will go
          // into unpublished buffer to reduce additional Mongo lookups in cases
          // when documents are removed from the published set and need a
          // replacement.
          // XXX needs more thought on non-zero skip
          // XXX 2 is a "magic number" meaning there is an extra chunk of docs for
          // buffer if such is needed.
          var cursor = self._cursorForQuery({
            limit: self._limit * 2
          });
          try {
            await cursor.forEach(function (doc, i) {
              // yields
              if (!self._limit || i < self._limit) {
                newResults.set(doc._id, doc);
              } else {
                newBuffer.set(doc._id, doc);
              }
            });
            break;
          } catch (e) {
            if (options.initial && typeof e.code === 'number') {
              // This is an error document sent to us by mongod, not a connection
              // error generated by the client. And we've never seen this query work
              // successfully. Probably it's a bad selector or something, so we
              // should NOT retry. Instead, we should halt the observe (which ends
              // up calling `stop` on us).
              await self._multiplexer.queryError(e);
              return;
            }

            // During failover (eg) if we get an exception we should log and retry
            // instead of crashing.
            Meteor._debug("Got exception while polling query", e);
            await Meteor._sleepForMs(100);
          }
        }
        if (self._stopped) return;
        self._publishNewResults(newResults, newBuffer);
      },
      // Yields!
      _runQuery: function (options) {
        return this._runQueryAsync(options);
      },
      // Transitions to QUERYING and runs another query, or (if already in QUERYING)
      // ensures that we will query again later.
      //
      // This function may not block, because it is called from an oplog entry
      // handler. However, if we were not already in the QUERYING phase, it throws
      // an exception that is caught by the closest surrounding
      // finishIfNeedToPollQuery call; this ensures that we don't continue running
      // close that was designed for another phase inside PHASE.QUERYING.
      //
      // (It's also necessary whenever logic in this file yields to check that other
      // phases haven't put us into QUERYING mode, though; eg,
      // _fetchModifiedDocuments does this.)
      _needToPollQuery: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (self._stopped) return;

          // If we're not already in the middle of a query, we can query now
          // (possibly pausing FETCHING).
          if (self._phase !== PHASE.QUERYING) {
            self._pollQuery();
            throw new SwitchedToQuery();
          }

          // We're currently in QUERYING. Set a flag to ensure that we run another
          // query when we're done.
          self._requeryWhenDoneThisQuery = true;
        });
      },
      // Yields!
      _doneQuerying: async function () {
        var self = this;
        if (self._stopped) return;
        await self._mongoHandle._oplogHandle.waitUntilCaughtUp();
        if (self._stopped) return;
        if (self._phase !== PHASE.QUERYING) throw Error("Phase unexpectedly " + self._phase);
        if (self._requeryWhenDoneThisQuery) {
          self._requeryWhenDoneThisQuery = false;
          self._pollQuery();
        } else if (self._needToFetch.empty()) {
          await self._beSteady();
        } else {
          self._fetchModifiedDocuments();
        }
      },
      _cursorForQuery: function (optionsOverwrite) {
        var self = this;
        return Meteor._noYieldsAllowed(function () {
          // The query we run is almost the same as the cursor we are observing,
          // with a few changes. We need to read all the fields that are relevant to
          // the selector, not just the fields we are going to publish (that's the
          // "shared" projection). And we don't want to apply any transform in the
          // cursor, because observeChanges shouldn't use the transform.
          var options = Object.assign({}, self._cursorDescription.options);

          // Allow the caller to modify the options. Useful to specify different
          // skip and limit values.
          Object.assign(options, optionsOverwrite);
          options.fields = self._sharedProjection;
          delete options.transform;
          // We are NOT deep cloning fields or selector here, which should be OK.
          var description = new CursorDescription(self._cursorDescription.collectionName, self._cursorDescription.selector, options);
          return new Cursor(self._mongoHandle, description);
        });
      },
      // Replace self._published with newResults (both are IdMaps), invoking observe
      // callbacks on the multiplexer.
      // Replace self._unpublishedBuffer with newBuffer.
      //
      // XXX This is very similar to LocalCollection._diffQueryUnorderedChanges. We
      // should really: (a) Unify IdMap and OrderedDict into Unordered/OrderedDict
      // (b) Rewrite diff.js to use these classes instead of arrays and objects.
      _publishNewResults: function (newResults, newBuffer) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          // If the query is limited and there is a buffer, shut down so it doesn't
          // stay in a way.
          if (self._limit) {
            self._unpublishedBuffer.clear();
          }

          // First remove anything that's gone. Be careful not to modify
          // self._published while iterating over it.
          var idsToRemove = [];
          self._published.forEach(function (doc, id) {
            if (!newResults.has(id)) idsToRemove.push(id);
          });
          idsToRemove.forEach(function (id) {
            self._removePublished(id);
          });

          // Now do adds and changes.
          // If self has a buffer and limit, the new fetched result will be
          // limited correctly as the query has sort specifier.
          newResults.forEach(function (doc, id) {
            self._handleDoc(id, doc);
          });

          // Sanity-check that everything we tried to put into _published ended up
          // there.
          // XXX if this is slow, remove it later
          if (self._published.size() !== newResults.size()) {
            Meteor._debug('The Mongo server and the Meteor query disagree on how ' + 'many documents match your query. Cursor description: ', self._cursorDescription);
          }
          self._published.forEach(function (doc, id) {
            if (!newResults.has(id)) throw Error("_published has a doc that newResults doesn't; " + id);
          });

          // Finally, replace the buffer
          newBuffer.forEach(function (doc, id) {
            self._addBuffered(id, doc);
          });
          self._safeAppendToBuffer = newBuffer.size() < self._limit;
        });
      },
      // This stop function is invoked from the onStop of the ObserveMultiplexer, so
      // it shouldn't actually be possible to call it until the multiplexer is
      // ready.
      //
      // It's important to check self._stopped after every call in this file that
      // can yield!
      _stop: async function () {
        var self = this;
        if (self._stopped) return;
        self._stopped = true;

        // Note: we *don't* use multiplexer.onFlush here because this stop
        // callback is actually invoked by the multiplexer itself when it has
        // determined that there are no handles left. So nothing is actually going
        // to get flushed (and it's probably not valid to call methods on the
        // dying multiplexer).
        for (const w of self._writesToCommitWhenWeReachSteady) {
          await w.committed();
        }
        self._writesToCommitWhenWeReachSteady = null;

        // Proactively drop references to potentially big things.
        self._published = null;
        self._unpublishedBuffer = null;
        self._needToFetch = null;
        self._currentlyFetching = null;
        self._oplogEntryHandle = null;
        self._listenersHandle = null;
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", -1);
        var _iteratorAbruptCompletion = false;
        var _didIteratorError = false;
        var _iteratorError;
        try {
          for (var _iterator = _asyncIterator(self._stopHandles), _step; _iteratorAbruptCompletion = !(_step = await _iterator.next()).done; _iteratorAbruptCompletion = false) {
            const handle = _step.value;
            {
              await handle.stop();
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (_iteratorAbruptCompletion && _iterator.return != null) {
              await _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      },
      stop: async function () {
        const self = this;
        return await self._stop();
      },
      _registerPhaseChange: function (phase) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var now = new Date();
          if (self._phase) {
            var timeDiff = now - self._phaseStartTime;
            Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "time-spent-in-" + self._phase + "-phase", timeDiff);
          }
          self._phase = phase;
          self._phaseStartTime = now;
        });
      }
    });

    // Does our oplog tailing code support this cursor? For now, we are being very
    // conservative and allowing only simple queries with simple options.
    // (This is a "static method".)
    OplogObserveDriver.cursorSupported = function (cursorDescription, matcher) {
      // First, check the options.
      var options = cursorDescription.options;

      // Did the user say no explicitly?
      // underscored version of the option is COMPAT with 1.2
      if (options.disableOplog || options._disableOplog) return false;

      // skip is not supported: to support it we would need to keep track of all
      // "skipped" documents or at least their ids.
      // limit w/o a sort specifier is not supported: current implementation needs a
      // deterministic way to order documents.
      if (options.skip || options.limit && !options.sort) return false;

      // If a fields projection option is given check if it is supported by
      // minimongo (some operators are not supported).
      const fields = options.fields || options.projection;
      if (fields) {
        try {
          LocalCollection._checkSupportedProjection(fields);
        } catch (e) {
          if (e.name === "MinimongoError") {
            return false;
          } else {
            throw e;
          }
        }
      }

      // We don't allow the following selectors:
      //   - $where (not confident that we provide the same JS environment
      //             as Mongo, and can yield!)
      //   - $near (has "interesting" properties in MongoDB, like the possibility
      //            of returning an ID multiple times, though even polling maybe
      //            have a bug there)
      //           XXX: once we support it, we would need to think more on how we
      //           initialize the comparators when we create the driver.
      return !matcher.hasWhere() && !matcher.hasGeoQuery();
    };
    var modifierCanBeDirectlyApplied = function (modifier) {
      return Object.entries(modifier).every(function (_ref) {
        let [operation, fields] = _ref;
        return Object.entries(fields).every(function (_ref2) {
          let [field, value] = _ref2;
          return !/EJSON\$/.test(field);
        });
      });
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

},"oplog_v2_converter.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_v2_converter.ts                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module1, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module1.export({
      oplogV2V1Converter: () => oplogV2V1Converter
    });
    let EJSON;
    module1.link("meteor/ejson", {
      EJSON(v) {
        EJSON = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const arrayOperatorKeyRegex = /^(a|[su]\d+)$/;
    /**
     * Checks if a field is an array operator key of form 'a' or 's1' or 'u1' etc
     */
    function isArrayOperatorKey(field) {
      return arrayOperatorKeyRegex.test(field);
    }
    /**
     * Type guard to check if an operator is a valid array operator.
     * Array operators have 'a: true' and keys that match the arrayOperatorKeyRegex
     */
    function isArrayOperator(operator) {
      return operator !== null && typeof operator === 'object' && 'a' in operator && operator.a === true && Object.keys(operator).every(isArrayOperatorKey);
    }
    /**
     * Joins two parts of a field path with a dot.
     * Returns the key itself if prefix is empty.
     */
    function join(prefix, key) {
      return prefix ? "".concat(prefix, ".").concat(key) : key;
    }
    /**
     * Recursively flattens an object into a target object with dot notation paths.
     * Handles special cases:
     * - Arrays are assigned directly
     * - Custom EJSON types are preserved
     * - Mongo.ObjectIDs are preserved
     * - Plain objects are recursively flattened
     * - Empty objects are assigned directly
     */
    function flattenObjectInto(target, source, prefix) {
      if (Array.isArray(source) || typeof source !== 'object' || source === null || source instanceof Mongo.ObjectID || EJSON._isCustomType(source)) {
        target[prefix] = source;
        return;
      }
      const entries = Object.entries(source);
      if (entries.length) {
        entries.forEach(_ref => {
          let [key, value] = _ref;
          flattenObjectInto(target, value, join(prefix, key));
        });
      } else {
        target[prefix] = source;
      }
    }
    /**
     * Converts an oplog diff to a series of $set and $unset operations.
     * Handles several types of operations:
     * - Direct unsets via 'd' field
     * - Nested sets via 'i' field
     * - Top-level sets via 'u' field
     * - Array operations and nested objects via 's' prefixed fields
     *
     * Preserves the structure of EJSON custom types and ObjectIDs while
     * flattening paths into dot notation for MongoDB updates.
     */
    function convertOplogDiff(oplogEntry, diff) {
      let prefix = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
      Object.entries(diff).forEach(_ref2 => {
        let [diffKey, value] = _ref2;
        if (diffKey === 'd') {
          var _oplogEntry$$unset;
          // Handle `$unset`s
          (_oplogEntry$$unset = oplogEntry.$unset) !== null && _oplogEntry$$unset !== void 0 ? _oplogEntry$$unset : oplogEntry.$unset = {};
          Object.keys(value).forEach(key => {
            oplogEntry.$unset[join(prefix, key)] = true;
          });
        } else if (diffKey === 'i') {
          var _oplogEntry$$set;
          // Handle (potentially) nested `$set`s
          (_oplogEntry$$set = oplogEntry.$set) !== null && _oplogEntry$$set !== void 0 ? _oplogEntry$$set : oplogEntry.$set = {};
          flattenObjectInto(oplogEntry.$set, value, prefix);
        } else if (diffKey === 'u') {
          var _oplogEntry$$set2;
          // Handle flat `$set`s
          (_oplogEntry$$set2 = oplogEntry.$set) !== null && _oplogEntry$$set2 !== void 0 ? _oplogEntry$$set2 : oplogEntry.$set = {};
          Object.entries(value).forEach(_ref3 => {
            let [key, fieldValue] = _ref3;
            oplogEntry.$set[join(prefix, key)] = fieldValue;
          });
        } else if (diffKey.startsWith('s')) {
          // Handle s-fields (array operations and nested objects)
          const key = diffKey.slice(1);
          if (isArrayOperator(value)) {
            // Array operator
            Object.entries(value).forEach(_ref4 => {
              let [position, fieldValue] = _ref4;
              if (position === 'a') return;
              const positionKey = join(prefix, "".concat(key, ".").concat(position.slice(1)));
              if (position[0] === 's') {
                convertOplogDiff(oplogEntry, fieldValue, positionKey);
              } else if (fieldValue === null) {
                var _oplogEntry$$unset2;
                (_oplogEntry$$unset2 = oplogEntry.$unset) !== null && _oplogEntry$$unset2 !== void 0 ? _oplogEntry$$unset2 : oplogEntry.$unset = {};
                oplogEntry.$unset[positionKey] = true;
              } else {
                var _oplogEntry$$set3;
                (_oplogEntry$$set3 = oplogEntry.$set) !== null && _oplogEntry$$set3 !== void 0 ? _oplogEntry$$set3 : oplogEntry.$set = {};
                oplogEntry.$set[positionKey] = fieldValue;
              }
            });
          } else if (key) {
            // Nested object
            convertOplogDiff(oplogEntry, value, join(prefix, key));
          }
        }
      });
    }
    /**
     * Converts a MongoDB v2 oplog entry to v1 format.
     * Returns the original entry unchanged if it's not a v2 oplog entry
     * or doesn't contain a diff field.
     *
     * The converted entry will contain $set and $unset operations that are
     * equivalent to the v2 diff format, with paths flattened to dot notation
     * and special handling for EJSON custom types and ObjectIDs.
     */
    function oplogV2V1Converter(oplogEntry) {
      if (oplogEntry.$v !== 2 || !oplogEntry.diff) {
        return oplogEntry;
      }
      const convertedOplogEntry = {
        $v: 2
      };
      convertOplogDiff(convertedOplogEntry, oplogEntry.diff);
      return convertedOplogEntry;
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

},"cursor_description.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/cursor_description.ts                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  CursorDescription: () => CursorDescription
});
class CursorDescription {
  constructor(collectionName, selector, options) {
    this.collectionName = void 0;
    this.selector = void 0;
    this.options = void 0;
    this.collectionName = collectionName;
    // @ts-ignore
    this.selector = Mongo.Collection._rewriteSelector(selector);
    this.options = options || {};
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"mongo_connection.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_connection.js                                                                                  //
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
      MongoConnection: () => MongoConnection
    });
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let CLIENT_ONLY_METHODS, getAsyncMethodName;
    module.link("meteor/minimongo/constants", {
      CLIENT_ONLY_METHODS(v) {
        CLIENT_ONLY_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 1);
    let MiniMongoQueryError;
    module.link("meteor/minimongo/common", {
      MiniMongoQueryError(v) {
        MiniMongoQueryError = v;
      }
    }, 2);
    let path;
    module.link("path", {
      default(v) {
        path = v;
      }
    }, 3);
    let AsynchronousCursor;
    module.link("./asynchronous_cursor", {
      AsynchronousCursor(v) {
        AsynchronousCursor = v;
      }
    }, 4);
    let Cursor;
    module.link("./cursor", {
      Cursor(v) {
        Cursor = v;
      }
    }, 5);
    let CursorDescription;
    module.link("./cursor_description", {
      CursorDescription(v) {
        CursorDescription = v;
      }
    }, 6);
    let DocFetcher;
    module.link("./doc_fetcher", {
      DocFetcher(v) {
        DocFetcher = v;
      }
    }, 7);
    let MongoDB, replaceMeteorAtomWithMongo, replaceTypes, transformResult;
    module.link("./mongo_common", {
      MongoDB(v) {
        MongoDB = v;
      },
      replaceMeteorAtomWithMongo(v) {
        replaceMeteorAtomWithMongo = v;
      },
      replaceTypes(v) {
        replaceTypes = v;
      },
      transformResult(v) {
        transformResult = v;
      }
    }, 8);
    let ObserveHandle;
    module.link("./observe_handle", {
      ObserveHandle(v) {
        ObserveHandle = v;
      }
    }, 9);
    let ObserveMultiplexer;
    module.link("./observe_multiplex", {
      ObserveMultiplexer(v) {
        ObserveMultiplexer = v;
      }
    }, 10);
    let OplogObserveDriver;
    module.link("./oplog_observe_driver", {
      OplogObserveDriver(v) {
        OplogObserveDriver = v;
      }
    }, 11);
    let OPLOG_COLLECTION, OplogHandle;
    module.link("./oplog_tailing", {
      OPLOG_COLLECTION(v) {
        OPLOG_COLLECTION = v;
      },
      OplogHandle(v) {
        OplogHandle = v;
      }
    }, 12);
    let PollingObserveDriver;
    module.link("./polling_observe_driver", {
      PollingObserveDriver(v) {
        PollingObserveDriver = v;
      }
    }, 13);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const FILE_ASSET_SUFFIX = 'Asset';
    const ASSETS_FOLDER = 'assets';
    const APP_FOLDER = 'app';
    const oplogCollectionWarnings = [];
    const MongoConnection = function (url, options) {
      var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
      var self = this;
      options = options || {};
      self._observeMultiplexers = {};
      self._onFailoverHook = new Hook();
      const userOptions = _objectSpread(_objectSpread({}, Mongo._connectionOptions || {}), ((_Meteor$settings = Meteor.settings) === null || _Meteor$settings === void 0 ? void 0 : (_Meteor$settings$pack = _Meteor$settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2.options) || {});
      var mongoOptions = Object.assign({
        ignoreUndefined: true
      }, userOptions);

      // Internally the oplog connections specify their own maxPoolSize
      // which we don't want to overwrite with any user defined value
      if ('maxPoolSize' in options) {
        // If we just set this for "server", replSet will override it. If we just
        // set it for replSet, it will be ignored if we're not using a replSet.
        mongoOptions.maxPoolSize = options.maxPoolSize;
      }
      if ('minPoolSize' in options) {
        mongoOptions.minPoolSize = options.minPoolSize;
      }

      // Transform options like "tlsCAFileAsset": "filename.pem" into
      // "tlsCAFile": "/<fullpath>/filename.pem"
      Object.entries(mongoOptions || {}).filter(_ref => {
        let [key] = _ref;
        return key && key.endsWith(FILE_ASSET_SUFFIX);
      }).forEach(_ref2 => {
        let [key, value] = _ref2;
        const optionName = key.replace(FILE_ASSET_SUFFIX, '');
        mongoOptions[optionName] = path.join(Assets.getServerDir(), ASSETS_FOLDER, APP_FOLDER, value);
        delete mongoOptions[key];
      });
      self.db = null;
      self._oplogHandle = null;
      self._docFetcher = null;
      mongoOptions.driverInfo = {
        name: 'Meteor',
        version: Meteor.release
      };
      self.client = new MongoDB.MongoClient(url, mongoOptions);
      self.db = self.client.db();
      self.client.on('serverDescriptionChanged', Meteor.bindEnvironment(event => {
        // When the connection is no longer against the primary node, execute all
        // failover hooks. This is important for the driver as it has to re-pool the
        // query when it happens.
        if (event.previousDescription.type !== 'RSPrimary' && event.newDescription.type === 'RSPrimary') {
          self._onFailoverHook.each(callback => {
            callback();
            return true;
          });
        }
      }));
      if (options.oplogUrl && !Package['disable-oplog']) {
        self._oplogHandle = new OplogHandle(options.oplogUrl, self.db.databaseName);
        self._docFetcher = new DocFetcher(self);
      }
    };
    MongoConnection.prototype._close = async function () {
      var self = this;
      if (!self.db) throw Error("close called before Connection created?");

      // XXX probably untested
      var oplogHandle = self._oplogHandle;
      self._oplogHandle = null;
      if (oplogHandle) await oplogHandle.stop();

      // Use Future.wrap so that errors get thrown. This happens to
      // work even outside a fiber since the 'close' method is not
      // actually asynchronous.
      await self.client.close();
    };
    MongoConnection.prototype.close = function () {
      return this._close();
    };
    MongoConnection.prototype._setOplogHandle = function (oplogHandle) {
      this._oplogHandle = oplogHandle;
      return this;
    };

    // Returns the Mongo Collection object; may yield.
    MongoConnection.prototype.rawCollection = function (collectionName) {
      var self = this;
      if (!self.db) throw Error("rawCollection called before Connection created?");
      return self.db.collection(collectionName);
    };
    MongoConnection.prototype.createCappedCollectionAsync = async function (collectionName, byteSize, maxDocuments) {
      var self = this;
      if (!self.db) throw Error("createCappedCollectionAsync called before Connection created?");
      await self.db.createCollection(collectionName, {
        capped: true,
        size: byteSize,
        max: maxDocuments
      });
    };

    // This should be called synchronously with a write, to create a
    // transaction on the current write fence, if any. After we can read
    // the write, and after observers have been notified (or at least,
    // after the observer notifiers have added themselves to the write
    // fence), you should call 'committed()' on the object returned.
    MongoConnection.prototype._maybeBeginWrite = function () {
      const fence = DDPServer._getCurrentFence();
      if (fence) {
        return fence.beginWrite();
      } else {
        return {
          committed: function () {}
        };
      }
    };

    // Internal interface: adds a callback which is called when the Mongo primary
    // changes. Returns a stop handle.
    MongoConnection.prototype._onFailover = function (callback) {
      return this._onFailoverHook.register(callback);
    };
    MongoConnection.prototype.insertAsync = async function (collection_name, document) {
      const self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        const e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }
      if (!(LocalCollection._isPlainObject(document) && !EJSON._isCustomType(document))) {
        throw new Error("Only plain objects may be inserted into MongoDB");
      }
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await Meteor.refresh({
          collection: collection_name,
          id: document._id
        });
      };
      return self.rawCollection(collection_name).insertOne(replaceTypes(document, replaceMeteorAtomWithMongo), {
        safe: true
      }).then(async _ref3 => {
        let {
          insertedId
        } = _ref3;
        await refresh();
        await write.committed();
        return insertedId;
      }).catch(async e => {
        await write.committed();
        throw e;
      });
    };

    // Cause queries that may be affected by the selector to poll in this write
    // fence.
    MongoConnection.prototype._refresh = async function (collectionName, selector) {
      var refreshKey = {
        collection: collectionName
      };
      // If we know which documents we're removing, don't poll queries that are
      // specific to other documents. (Note that multiple notifications here should
      // not cause multiple polls, since all our listener is doing is enqueueing a
      // poll.)
      var specificIds = LocalCollection._idsMatchedBySelector(selector);
      if (specificIds) {
        for (const id of specificIds) {
          await Meteor.refresh(Object.assign({
            id: id
          }, refreshKey));
        }
        ;
      } else {
        await Meteor.refresh(refreshKey);
      }
    };
    MongoConnection.prototype.removeAsync = async function (collection_name, selector) {
      var self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        var e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await self._refresh(collection_name, selector);
      };
      return self.rawCollection(collection_name).deleteMany(replaceTypes(selector, replaceMeteorAtomWithMongo), {
        safe: true
      }).then(async _ref4 => {
        let {
          deletedCount
        } = _ref4;
        await refresh();
        await write.committed();
        return transformResult({
          result: {
            modifiedCount: deletedCount
          }
        }).numberAffected;
      }).catch(async err => {
        await write.committed();
        throw err;
      });
    };
    MongoConnection.prototype.dropCollectionAsync = async function (collectionName) {
      var self = this;
      var write = self._maybeBeginWrite();
      var refresh = function () {
        return Meteor.refresh({
          collection: collectionName,
          id: null,
          dropCollection: true
        });
      };
      return self.rawCollection(collectionName).drop().then(async result => {
        await refresh();
        await write.committed();
        return result;
      }).catch(async e => {
        await write.committed();
        throw e;
      });
    };

    // For testing only.  Slightly better than `c.rawDatabase().dropDatabase()`
    // because it lets the test's fence wait for it to be complete.
    MongoConnection.prototype.dropDatabaseAsync = async function () {
      var self = this;
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await Meteor.refresh({
          dropDatabase: true
        });
      };
      try {
        await self.db._dropDatabase();
        await refresh();
        await write.committed();
      } catch (e) {
        await write.committed();
        throw e;
      }
    };
    MongoConnection.prototype.updateAsync = async function (collection_name, selector, mod, options) {
      var self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        var e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }

      // explicit safety check. null and undefined can crash the mongo
      // driver. Although the node driver and minimongo do 'support'
      // non-object modifier in that they don't crash, they are not
      // meaningful operations and do not do anything. Defensively throw an
      // error here.
      if (!mod || typeof mod !== 'object') {
        const error = new Error("Invalid modifier. Modifier must be an object.");
        throw error;
      }
      if (!(LocalCollection._isPlainObject(mod) && !EJSON._isCustomType(mod))) {
        const error = new Error("Only plain objects may be used as replacement" + " documents in MongoDB");
        throw error;
      }
      if (!options) options = {};
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await self._refresh(collection_name, selector);
      };
      var collection = self.rawCollection(collection_name);
      var mongoOpts = {
        safe: true
      };
      // Add support for filtered positional operator
      if (options.arrayFilters !== undefined) mongoOpts.arrayFilters = options.arrayFilters;
      // explictly enumerate options that minimongo supports
      if (options.upsert) mongoOpts.upsert = true;
      if (options.multi) mongoOpts.multi = true;
      // Lets you get a more more full result from MongoDB. Use with caution:
      // might not work with C.upsert (as opposed to C.update({upsert:true}) or
      // with simulated upsert.
      if (options.fullResult) mongoOpts.fullResult = true;
      var mongoSelector = replaceTypes(selector, replaceMeteorAtomWithMongo);
      var mongoMod = replaceTypes(mod, replaceMeteorAtomWithMongo);
      var isModify = LocalCollection._isModificationMod(mongoMod);
      if (options._forbidReplace && !isModify) {
        var err = new Error("Invalid modifier. Replacements are forbidden.");
        throw err;
      }

      // We've already run replaceTypes/replaceMeteorAtomWithMongo on
      // selector and mod.  We assume it doesn't matter, as far as
      // the behavior of modifiers is concerned, whether `_modify`
      // is run on EJSON or on mongo-converted EJSON.

      // Run this code up front so that it fails fast if someone uses
      // a Mongo update operator we don't support.
      let knownId;
      if (options.upsert) {
        try {
          let newDoc = LocalCollection._createUpsertDocument(selector, mod);
          knownId = newDoc._id;
        } catch (err) {
          throw err;
        }
      }
      if (options.upsert && !isModify && !knownId && options.insertedId && !(options.insertedId instanceof Mongo.ObjectID && options.generatedId)) {
        // In case of an upsert with a replacement, where there is no _id defined
        // in either the query or the replacement doc, mongo will generate an id itself.
        // Therefore we need this special strategy if we want to control the id ourselves.

        // We don't need to do this when:
        // - This is not a replacement, so we can add an _id to $setOnInsert
        // - The id is defined by query or mod we can just add it to the replacement doc
        // - The user did not specify any id preference and the id is a Mongo ObjectId,
        //     then we can just let Mongo generate the id
        return await simulateUpsertWithInsertedId(collection, mongoSelector, mongoMod, options).then(async result => {
          await refresh();
          await write.committed();
          if (result && !options._returnObject) {
            return result.numberAffected;
          } else {
            return result;
          }
        });
      } else {
        if (options.upsert && !knownId && options.insertedId && isModify) {
          if (!mongoMod.hasOwnProperty('$setOnInsert')) {
            mongoMod.$setOnInsert = {};
          }
          knownId = options.insertedId;
          Object.assign(mongoMod.$setOnInsert, replaceTypes({
            _id: options.insertedId
          }, replaceMeteorAtomWithMongo));
        }
        const strings = Object.keys(mongoMod).filter(key => !key.startsWith("$"));
        let updateMethod = strings.length > 0 ? 'replaceOne' : 'updateMany';
        updateMethod = updateMethod === 'updateMany' && !mongoOpts.multi ? 'updateOne' : updateMethod;
        return collection[updateMethod].bind(collection)(mongoSelector, mongoMod, mongoOpts).then(async result => {
          var meteorResult = transformResult({
            result
          });
          if (meteorResult && options._returnObject) {
            // If this was an upsertAsync() call, and we ended up
            // inserting a new doc and we know its id, then
            // return that id as well.
            if (options.upsert && meteorResult.insertedId) {
              if (knownId) {
                meteorResult.insertedId = knownId;
              } else if (meteorResult.insertedId instanceof MongoDB.ObjectId) {
                meteorResult.insertedId = new Mongo.ObjectID(meteorResult.insertedId.toHexString());
              }
            }
            await refresh();
            await write.committed();
            return meteorResult;
          } else {
            await refresh();
            await write.committed();
            return meteorResult.numberAffected;
          }
        }).catch(async err => {
          await write.committed();
          throw err;
        });
      }
    };

    // exposed for testing
    MongoConnection._isCannotChangeIdError = function (err) {
      // Mongo 3.2.* returns error as next Object:
      // {name: String, code: Number, errmsg: String}
      // Older Mongo returns:
      // {name: String, code: Number, err: String}
      var error = err.errmsg || err.err;

      // We don't use the error code here
      // because the error code we observed it producing (16837) appears to be
      // a far more generic error code based on examining the source.
      if (error.indexOf('The _id field cannot be changed') === 0 || error.indexOf("the (immutable) field '_id' was found to have been altered to _id") !== -1) {
        return true;
      }
      return false;
    };

    // XXX MongoConnection.upsertAsync() does not return the id of the inserted document
    // unless you set it explicitly in the selector or modifier (as a replacement
    // doc).
    MongoConnection.prototype.upsertAsync = async function (collectionName, selector, mod, options) {
      var self = this;
      if (typeof options === "function" && !callback) {
        callback = options;
        options = {};
      }
      return self.updateAsync(collectionName, selector, mod, Object.assign({}, options, {
        upsert: true,
        _returnObject: true
      }));
    };
    MongoConnection.prototype.find = function (collectionName, selector, options) {
      var self = this;
      if (arguments.length === 1) selector = {};
      return new Cursor(self, new CursorDescription(collectionName, selector, options));
    };
    MongoConnection.prototype.findOneAsync = async function (collection_name, selector, options) {
      var self = this;
      if (arguments.length === 1) {
        selector = {};
      }
      options = options || {};
      options.limit = 1;
      const results = await self.find(collection_name, selector, options).fetch();
      return results[0];
    };

    // We'll actually design an index API later. For now, we just pass through to
    // Mongo's, but make it synchronous.
    MongoConnection.prototype.createIndexAsync = async function (collectionName, index, options) {
      var self = this;

      // We expect this function to be called at startup, not from within a method,
      // so we don't interact with the write fence.
      var collection = self.rawCollection(collectionName);
      await collection.createIndex(index, options);
    };

    // just to be consistent with the other methods
    MongoConnection.prototype.createIndex = MongoConnection.prototype.createIndexAsync;
    MongoConnection.prototype.countDocuments = function (collectionName) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      args = args.map(arg => replaceTypes(arg, replaceMeteorAtomWithMongo));
      const collection = this.rawCollection(collectionName);
      return collection.countDocuments(...args);
    };
    MongoConnection.prototype.estimatedDocumentCount = function (collectionName) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      args = args.map(arg => replaceTypes(arg, replaceMeteorAtomWithMongo));
      const collection = this.rawCollection(collectionName);
      return collection.estimatedDocumentCount(...args);
    };
    MongoConnection.prototype.ensureIndexAsync = MongoConnection.prototype.createIndexAsync;
    MongoConnection.prototype.dropIndexAsync = async function (collectionName, index) {
      var self = this;

      // This function is only used by test code, not within a method, so we don't
      // interact with the write fence.
      var collection = self.rawCollection(collectionName);
      var indexName = await collection.dropIndex(index);
    };
    CLIENT_ONLY_METHODS.forEach(function (m) {
      MongoConnection.prototype[m] = function () {
        throw new Error("".concat(m, " +  is not available on the server. Please use ").concat(getAsyncMethodName(m), "() instead."));
      };
    });
    var NUM_OPTIMISTIC_TRIES = 3;
    var simulateUpsertWithInsertedId = async function (collection, selector, mod, options) {
      // STRATEGY: First try doing an upsert with a generated ID.
      // If this throws an error about changing the ID on an existing document
      // then without affecting the database, we know we should probably try
      // an update without the generated ID. If it affected 0 documents,
      // then without affecting the database, we the document that first
      // gave the error is probably removed and we need to try an insert again
      // We go back to step one and repeat.
      // Like all "optimistic write" schemes, we rely on the fact that it's
      // unlikely our writes will continue to be interfered with under normal
      // circumstances (though sufficiently heavy contention with writers
      // disagreeing on the existence of an object will cause writes to fail
      // in theory).

      var insertedId = options.insertedId; // must exist
      var mongoOptsForUpdate = {
        safe: true,
        multi: options.multi
      };
      var mongoOptsForInsert = {
        safe: true,
        upsert: true
      };
      var replacementWithId = Object.assign(replaceTypes({
        _id: insertedId
      }, replaceMeteorAtomWithMongo), mod);
      var tries = NUM_OPTIMISTIC_TRIES;
      var doUpdate = async function () {
        tries--;
        if (!tries) {
          throw new Error("Upsert failed after " + NUM_OPTIMISTIC_TRIES + " tries.");
        } else {
          let method = collection.updateMany;
          if (!Object.keys(mod).some(key => key.startsWith("$"))) {
            method = collection.replaceOne.bind(collection);
          }
          return method(selector, mod, mongoOptsForUpdate).then(result => {
            if (result && (result.modifiedCount || result.upsertedCount)) {
              return {
                numberAffected: result.modifiedCount || result.upsertedCount,
                insertedId: result.upsertedId || undefined
              };
            } else {
              return doConditionalInsert();
            }
          });
        }
      };
      var doConditionalInsert = function () {
        return collection.replaceOne(selector, replacementWithId, mongoOptsForInsert).then(result => ({
          numberAffected: result.upsertedCount,
          insertedId: result.upsertedId
        })).catch(err => {
          if (MongoConnection._isCannotChangeIdError(err)) {
            return doUpdate();
          } else {
            throw err;
          }
        });
      };
      return doUpdate();
    };

    // observeChanges for tailable cursors on capped collections.
    //
    // Some differences from normal cursors:
    //   - Will never produce anything other than 'added' or 'addedBefore'. If you
    //     do update a document that has already been produced, this will not notice
    //     it.
    //   - If you disconnect and reconnect from Mongo, it will essentially restart
    //     the query, which will lead to duplicate results. This is pretty bad,
    //     but if you include a field called 'ts' which is inserted as
    //     new MongoInternals.MongoTimestamp(0, 0) (which is initialized to the
    //     current Mongo-style timestamp), we'll be able to find the place to
    //     restart properly. (This field is specifically understood by Mongo with an
    //     optimization which allows it to find the right place to start without
    //     an index on ts. It's how the oplog works.)
    //   - No callbacks are triggered synchronously with the call (there's no
    //     differentiation between "initial data" and "later changes"; everything
    //     that matches the query gets sent asynchronously).
    //   - De-duplication is not implemented.
    //   - Does not yet interact with the write fence. Probably, this should work by
    //     ignoring removes (which don't work on capped collections) and updates
    //     (which don't affect tailable cursors), and just keeping track of the ID
    //     of the inserted object, and closing the write fence once you get to that
    //     ID (or timestamp?).  This doesn't work well if the document doesn't match
    //     the query, though.  On the other hand, the write fence can close
    //     immediately if it does not match the query. So if we trust minimongo
    //     enough to accurately evaluate the query against the write fence, we
    //     should be able to do this...  Of course, minimongo doesn't even support
    //     Mongo Timestamps yet.
    MongoConnection.prototype._observeChangesTailable = function (cursorDescription, ordered, callbacks) {
      var self = this;

      // Tailable cursors only ever call added/addedBefore callbacks, so it's an
      // error if you didn't provide them.
      if (ordered && !callbacks.addedBefore || !ordered && !callbacks.added) {
        throw new Error("Can't observe an " + (ordered ? "ordered" : "unordered") + " tailable cursor without a " + (ordered ? "addedBefore" : "added") + " callback");
      }
      return self.tail(cursorDescription, function (doc) {
        var id = doc._id;
        delete doc._id;
        // The ts is an implementation detail. Hide it.
        delete doc.ts;
        if (ordered) {
          callbacks.addedBefore(id, doc, null);
        } else {
          callbacks.added(id, doc);
        }
      });
    };
    MongoConnection.prototype._createAsynchronousCursor = function (cursorDescription) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var self = this;
      const {
        selfForIteration,
        useTransform
      } = options;
      options = {
        selfForIteration,
        useTransform
      };
      var collection = self.rawCollection(cursorDescription.collectionName);
      var cursorOptions = cursorDescription.options;
      var mongoOptions = {
        sort: cursorOptions.sort,
        limit: cursorOptions.limit,
        skip: cursorOptions.skip,
        projection: cursorOptions.fields || cursorOptions.projection,
        readPreference: cursorOptions.readPreference
      };

      // Do we want a tailable cursor (which only works on capped collections)?
      if (cursorOptions.tailable) {
        mongoOptions.numberOfRetries = -1;
      }
      var dbCursor = collection.find(replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo), mongoOptions);

      // Do we want a tailable cursor (which only works on capped collections)?
      if (cursorOptions.tailable) {
        // We want a tailable cursor...
        dbCursor.addCursorFlag("tailable", true);
        // ... and for the server to wait a bit if any getMore has no data (rather
        // than making us put the relevant sleeps in the client)...
        dbCursor.addCursorFlag("awaitData", true);

        // And if this is on the oplog collection and the cursor specifies a 'ts',
        // then set the undocumented oplog replay flag, which does a special scan to
        // find the first document (instead of creating an index on ts). This is a
        // very hard-coded Mongo flag which only works on the oplog collection and
        // only works with the ts field.
        if (cursorDescription.collectionName === OPLOG_COLLECTION && cursorDescription.selector.ts) {
          dbCursor.addCursorFlag("oplogReplay", true);
        }
      }
      if (typeof cursorOptions.maxTimeMs !== 'undefined') {
        dbCursor = dbCursor.maxTimeMS(cursorOptions.maxTimeMs);
      }
      if (typeof cursorOptions.hint !== 'undefined') {
        dbCursor = dbCursor.hint(cursorOptions.hint);
      }
      return new AsynchronousCursor(dbCursor, cursorDescription, options, collection);
    };

    // Tails the cursor described by cursorDescription, most likely on the
    // oplog. Calls docCallback with each document found. Ignores errors and just
    // restarts the tail on error.
    //
    // If timeoutMS is set, then if we don't get a new document every timeoutMS,
    // kill and restart the cursor. This is primarily a workaround for #8598.
    MongoConnection.prototype.tail = function (cursorDescription, docCallback, timeoutMS) {
      var self = this;
      if (!cursorDescription.options.tailable) throw new Error("Can only tail a tailable cursor");
      var cursor = self._createAsynchronousCursor(cursorDescription);
      var stopped = false;
      var lastTS;
      Meteor.defer(async function loop() {
        var doc = null;
        while (true) {
          if (stopped) return;
          try {
            doc = await cursor._nextObjectPromiseWithTimeout(timeoutMS);
          } catch (err) {
            // We should not ignore errors here unless we want to spend a lot of time debugging
            console.error(err);
            // There's no good way to figure out if this was actually an error from
            // Mongo, or just client-side (including our own timeout error). Ah
            // well. But either way, we need to retry the cursor (unless the failure
            // was because the observe got stopped).
            doc = null;
          }
          // Since we awaited a promise above, we need to check again to see if
          // we've been stopped before calling the callback.
          if (stopped) return;
          if (doc) {
            // If a tailable cursor contains a "ts" field, use it to recreate the
            // cursor on error. ("ts" is a standard that Mongo uses internally for
            // the oplog, and there's a special flag that lets you do binary search
            // on it instead of needing to use an index.)
            lastTS = doc.ts;
            docCallback(doc);
          } else {
            var newSelector = Object.assign({}, cursorDescription.selector);
            if (lastTS) {
              newSelector.ts = {
                $gt: lastTS
              };
            }
            cursor = self._createAsynchronousCursor(new CursorDescription(cursorDescription.collectionName, newSelector, cursorDescription.options));
            // Mongo failover takes many seconds.  Retry in a bit.  (Without this
            // setTimeout, we peg the CPU at 100% and never notice the actual
            // failover.
            setTimeout(loop, 100);
            break;
          }
        }
      });
      return {
        stop: function () {
          stopped = true;
          cursor.close();
        }
      };
    };
    Object.assign(MongoConnection.prototype, {
      _observeChanges: async function (cursorDescription, ordered, callbacks, nonMutatingCallbacks) {
        var _self$_oplogHandle;
        var self = this;
        const collectionName = cursorDescription.collectionName;
        if (cursorDescription.options.tailable) {
          return self._observeChangesTailable(cursorDescription, ordered, callbacks);
        }

        // You may not filter out _id when observing changes, because the id is a core
        // part of the observeChanges API.
        const fieldsOptions = cursorDescription.options.projection || cursorDescription.options.fields;
        if (fieldsOptions && (fieldsOptions._id === 0 || fieldsOptions._id === false)) {
          throw Error("You may not observe a cursor with {fields: {_id: 0}}");
        }
        var observeKey = EJSON.stringify(Object.assign({
          ordered: ordered
        }, cursorDescription));
        var multiplexer, observeDriver;
        var firstHandle = false;

        // Find a matching ObserveMultiplexer, or create a new one. This next block is
        // guaranteed to not yield (and it doesn't call anything that can observe a
        // new query), so no other calls to this function can interleave with it.
        if (observeKey in self._observeMultiplexers) {
          multiplexer = self._observeMultiplexers[observeKey];
        } else {
          firstHandle = true;
          // Create a new ObserveMultiplexer.
          multiplexer = new ObserveMultiplexer({
            ordered: ordered,
            onStop: function () {
              delete self._observeMultiplexers[observeKey];
              return observeDriver.stop();
            }
          });
        }
        var observeHandle = new ObserveHandle(multiplexer, callbacks, nonMutatingCallbacks);
        const oplogOptions = (self === null || self === void 0 ? void 0 : (_self$_oplogHandle = self._oplogHandle) === null || _self$_oplogHandle === void 0 ? void 0 : _self$_oplogHandle._oplogOptions) || {};
        const {
          includeCollections,
          excludeCollections
        } = oplogOptions;
        if (firstHandle) {
          var matcher, sorter;
          var canUseOplog = [function () {
            // At a bare minimum, using the oplog requires us to have an oplog, to
            // want unordered callbacks, and to not want a callback on the polls
            // that won't happen.
            return self._oplogHandle && !ordered && !callbacks._testOnlyPollCallback;
          }, function () {
            // We also need to check, if the collection of this Cursor is actually being "watched" by the Oplog handle
            // if not, we have to fallback to long polling
            if (excludeCollections !== null && excludeCollections !== void 0 && excludeCollections.length && excludeCollections.includes(collectionName)) {
              if (!oplogCollectionWarnings.includes(collectionName)) {
                console.warn("Meteor.settings.packages.mongo.oplogExcludeCollections includes the collection ".concat(collectionName, " - your subscriptions will only use long polling!"));
                oplogCollectionWarnings.push(collectionName); // we only want to show the warnings once per collection!
              }
              return false;
            }
            if (includeCollections !== null && includeCollections !== void 0 && includeCollections.length && !includeCollections.includes(collectionName)) {
              if (!oplogCollectionWarnings.includes(collectionName)) {
                console.warn("Meteor.settings.packages.mongo.oplogIncludeCollections does not include the collection ".concat(collectionName, " - your subscriptions will only use long polling!"));
                oplogCollectionWarnings.push(collectionName); // we only want to show the warnings once per collection!
              }
              return false;
            }
            return true;
          }, function () {
            // We need to be able to compile the selector. Fall back to polling for
            // some newfangled $selector that minimongo doesn't support yet.
            try {
              matcher = new Minimongo.Matcher(cursorDescription.selector);
              return true;
            } catch (e) {
              // XXX make all compilation errors MinimongoError or something
              //     so that this doesn't ignore unrelated exceptions
              if (Meteor.isClient && e instanceof MiniMongoQueryError) {
                throw e;
              }
              return false;
            }
          }, function () {
            // ... and the selector itself needs to support oplog.
            return OplogObserveDriver.cursorSupported(cursorDescription, matcher);
          }, function () {
            // And we need to be able to compile the sort, if any.  eg, can't be
            // {$natural: 1}.
            if (!cursorDescription.options.sort) return true;
            try {
              sorter = new Minimongo.Sorter(cursorDescription.options.sort);
              return true;
            } catch (e) {
              // XXX make all compilation errors MinimongoError or something
              //     so that this doesn't ignore unrelated exceptions
              return false;
            }
          }].every(f => f()); // invoke each function and check if all return true

          var driverClass = canUseOplog ? OplogObserveDriver : PollingObserveDriver;
          observeDriver = new driverClass({
            cursorDescription: cursorDescription,
            mongoHandle: self,
            multiplexer: multiplexer,
            ordered: ordered,
            matcher: matcher,
            // ignored by polling
            sorter: sorter,
            // ignored by polling
            _testOnlyPollCallback: callbacks._testOnlyPollCallback
          });
          if (observeDriver._init) {
            await observeDriver._init();
          }

          // This field is only set for use in tests.
          multiplexer._observeDriver = observeDriver;
        }
        self._observeMultiplexers[observeKey] = multiplexer;
        // Blocks until the initial adds have been sent.
        await multiplexer.addHandleAndSendInitialAdds(observeHandle);
        return observeHandle;
      }
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

},"mongo_common.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_common.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      MongoDB: () => MongoDB,
      writeCallback: () => writeCallback,
      transformResult: () => transformResult,
      replaceMeteorAtomWithMongo: () => replaceMeteorAtomWithMongo,
      replaceTypes: () => replaceTypes,
      replaceMongoAtomWithMeteor: () => replaceMongoAtomWithMeteor,
      replaceNames: () => replaceNames
    });
    let clone;
    module.link("lodash.clone", {
      default(v) {
        clone = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const MongoDB = Object.assign(NpmModuleMongodb, {
      ObjectID: NpmModuleMongodb.ObjectId
    });
    const writeCallback = function (write, refresh, callback) {
      return function (err, result) {
        if (!err) {
          // XXX We don't have to run this on error, right?
          try {
            refresh();
          } catch (refreshErr) {
            if (callback) {
              callback(refreshErr);
              return;
            } else {
              throw refreshErr;
            }
          }
        }
        write.committed();
        if (callback) {
          callback(err, result);
        } else if (err) {
          throw err;
        }
      };
    };
    const transformResult = function (driverResult) {
      var meteorResult = {
        numberAffected: 0
      };
      if (driverResult) {
        var mongoResult = driverResult.result;
        // On updates with upsert:true, the inserted values come as a list of
        // upserted values -- even with options.multi, when the upsert does insert,
        // it only inserts one element.
        if (mongoResult.upsertedCount) {
          meteorResult.numberAffected = mongoResult.upsertedCount;
          if (mongoResult.upsertedId) {
            meteorResult.insertedId = mongoResult.upsertedId;
          }
        } else {
          // n was used before Mongo 5.0, in Mongo 5.0 we are not receiving this n
          // field and so we are using modifiedCount instead
          meteorResult.numberAffected = mongoResult.n || mongoResult.matchedCount || mongoResult.modifiedCount;
        }
      }
      return meteorResult;
    };
    const replaceMeteorAtomWithMongo = function (document) {
      if (EJSON.isBinary(document)) {
        // This does more copies than we'd like, but is necessary because
        // MongoDB.BSON only looks like it takes a Uint8Array (and doesn't actually
        // serialize it correctly).
        return new MongoDB.Binary(Buffer.from(document));
      }
      if (document instanceof MongoDB.Binary) {
        return document;
      }
      if (document instanceof Mongo.ObjectID) {
        return new MongoDB.ObjectId(document.toHexString());
      }
      if (document instanceof MongoDB.ObjectId) {
        return new MongoDB.ObjectId(document.toHexString());
      }
      if (document instanceof MongoDB.Timestamp) {
        // For now, the Meteor representation of a Mongo timestamp type (not a date!
        // this is a weird internal thing used in the oplog!) is the same as the
        // Mongo representation. We need to do this explicitly or else we would do a
        // structural clone and lose the prototype.
        return document;
      }
      if (document instanceof Decimal) {
        return MongoDB.Decimal128.fromString(document.toString());
      }
      if (EJSON._isCustomType(document)) {
        return replaceNames(makeMongoLegal, EJSON.toJSONValue(document));
      }
      // It is not ordinarily possible to stick dollar-sign keys into mongo
      // so we don't bother checking for things that need escaping at this time.
      return undefined;
    };
    const replaceTypes = function (document, atomTransformer) {
      if (typeof document !== 'object' || document === null) return document;
      var replacedTopLevelAtom = atomTransformer(document);
      if (replacedTopLevelAtom !== undefined) return replacedTopLevelAtom;
      var ret = document;
      Object.entries(document).forEach(function (_ref) {
        let [key, val] = _ref;
        var valReplaced = replaceTypes(val, atomTransformer);
        if (val !== valReplaced) {
          // Lazy clone. Shallow copy.
          if (ret === document) ret = clone(document);
          ret[key] = valReplaced;
        }
      });
      return ret;
    };
    const replaceMongoAtomWithMeteor = function (document) {
      if (document instanceof MongoDB.Binary) {
        // for backwards compatibility
        if (document.sub_type !== 0) {
          return document;
        }
        var buffer = document.value(true);
        return new Uint8Array(buffer);
      }
      if (document instanceof MongoDB.ObjectId) {
        return new Mongo.ObjectID(document.toHexString());
      }
      if (document instanceof MongoDB.Decimal128) {
        return Decimal(document.toString());
      }
      if (document["EJSON$type"] && document["EJSON$value"] && Object.keys(document).length === 2) {
        return EJSON.fromJSONValue(replaceNames(unmakeMongoLegal, document));
      }
      if (document instanceof MongoDB.Timestamp) {
        // For now, the Meteor representation of a Mongo timestamp type (not a date!
        // this is a weird internal thing used in the oplog!) is the same as the
        // Mongo representation. We need to do this explicitly or else we would do a
        // structural clone and lose the prototype.
        return document;
      }
      return undefined;
    };
    const makeMongoLegal = name => "EJSON" + name;
    const unmakeMongoLegal = name => name.substr(5);
    function replaceNames(filter, thing) {
      if (typeof thing === "object" && thing !== null) {
        if (Array.isArray(thing)) {
          return thing.map(replaceNames.bind(null, filter));
        }
        var ret = {};
        Object.entries(thing).forEach(function (_ref2) {
          let [key, value] = _ref2;
          ret[filter(key)] = replaceNames(filter, value);
        });
        return ret;
      }
      return thing;
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

},"asynchronous_cursor.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/asynchronous_cursor.js                                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      AsynchronousCursor: () => AsynchronousCursor
    });
    let LocalCollection;
    module.link("meteor/minimongo/local_collection", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    let replaceMongoAtomWithMeteor, replaceTypes;
    module.link("./mongo_common", {
      replaceMongoAtomWithMeteor(v) {
        replaceMongoAtomWithMeteor = v;
      },
      replaceTypes(v) {
        replaceTypes = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class AsynchronousCursor {
      constructor(dbCursor, cursorDescription, options) {
        this._closing = false;
        this._pendingNext = null;
        this._dbCursor = dbCursor;
        this._cursorDescription = cursorDescription;
        this._selfForIteration = options.selfForIteration || this;
        if (options.useTransform && cursorDescription.options.transform) {
          this._transform = LocalCollection.wrapTransform(cursorDescription.options.transform);
        } else {
          this._transform = null;
        }
        this._visitedIds = new LocalCollection._IdMap();
      }
      [Symbol.asyncIterator]() {
        var cursor = this;
        return {
          async next() {
            const value = await cursor._nextObjectPromise();
            return {
              done: !value,
              value
            };
          }
        };
      }

      // Returns a Promise for the next object from the underlying cursor (before
      // the Mongo->Meteor type replacement).
      async _rawNextObjectPromise() {
        if (this._closing) {
          // Prevent next() after close is called
          return null;
        }
        try {
          this._pendingNext = this._dbCursor.next();
          const result = await this._pendingNext;
          this._pendingNext = null;
          return result;
        } catch (e) {
          console.error(e);
        } finally {
          this._pendingNext = null;
        }
      }

      // Returns a Promise for the next object from the cursor, skipping those whose
      // IDs we've already seen and replacing Mongo atoms with Meteor atoms.
      async _nextObjectPromise() {
        while (true) {
          var doc = await this._rawNextObjectPromise();
          if (!doc) return null;
          doc = replaceTypes(doc, replaceMongoAtomWithMeteor);
          if (!this._cursorDescription.options.tailable && '_id' in doc) {
            // Did Mongo give us duplicate documents in the same cursor? If so,
            // ignore this one. (Do this before the transform, since transform might
            // return some unrelated value.) We don't do this for tailable cursors,
            // because we want to maintain O(1) memory usage. And if there isn't _id
            // for some reason (maybe it's the oplog), then we don't do this either.
            // (Be careful to do this for falsey but existing _id, though.)
            if (this._visitedIds.has(doc._id)) continue;
            this._visitedIds.set(doc._id, true);
          }
          if (this._transform) doc = this._transform(doc);
          return doc;
        }
      }

      // Returns a promise which is resolved with the next object (like with
      // _nextObjectPromise) or rejected if the cursor doesn't return within
      // timeoutMS ms.
      _nextObjectPromiseWithTimeout(timeoutMS) {
        const nextObjectPromise = this._nextObjectPromise();
        if (!timeoutMS) {
          return nextObjectPromise;
        }
        const timeoutPromise = new Promise(resolve => {
          // On timeout, close the cursor.
          const timeoutId = setTimeout(() => {
            resolve(this.close());
          }, timeoutMS);

          // If the `_nextObjectPromise` returned first, cancel the timeout.
          nextObjectPromise.finally(() => {
            clearTimeout(timeoutId);
          });
        });
        return Promise.race([nextObjectPromise, timeoutPromise]);
      }
      async forEach(callback, thisArg) {
        // Get back to the beginning.
        this._rewind();
        let idx = 0;
        while (true) {
          const doc = await this._nextObjectPromise();
          if (!doc) return;
          await callback.call(thisArg, doc, idx++, this._selfForIteration);
        }
      }
      async map(callback, thisArg) {
        const results = [];
        await this.forEach(async (doc, index) => {
          results.push(await callback.call(thisArg, doc, index, this._selfForIteration));
        });
        return results;
      }
      _rewind() {
        // known to be synchronous
        this._dbCursor.rewind();
        this._visitedIds = new LocalCollection._IdMap();
      }

      // Mostly usable for tailable cursors.
      async close() {
        this._closing = true;
        // If there's a pending next(), wait for it to finish or abort
        if (this._pendingNext) {
          try {
            await this._pendingNext;
          } catch (e) {
            // ignore
          }
        }
        this._dbCursor.close();
      }
      fetch() {
        return this.map(doc => doc);
      }

      /**
       * FIXME: (node:34680) [MONGODB DRIVER] Warning: cursor.count is deprecated and will be
       *  removed in the next major version, please use `collection.estimatedDocumentCount` or
       *  `collection.countDocuments` instead.
       */
      count() {
        return this._dbCursor.count();
      }

      // This method is NOT wrapped in Cursor.
      async getRawObjects(ordered) {
        var self = this;
        if (ordered) {
          return self.fetch();
        } else {
          var results = new LocalCollection._IdMap();
          await self.forEach(function (doc) {
            results.set(doc._id, doc);
          });
          return results;
        }
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

},"cursor.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/cursor.ts                                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      Cursor: () => Cursor
    });
    let ASYNC_CURSOR_METHODS, getAsyncMethodName;
    module.link("meteor/minimongo/constants", {
      ASYNC_CURSOR_METHODS(v) {
        ASYNC_CURSOR_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 0);
    let replaceMeteorAtomWithMongo, replaceTypes;
    module.link("./mongo_common", {
      replaceMeteorAtomWithMongo(v) {
        replaceMeteorAtomWithMongo = v;
      },
      replaceTypes(v) {
        replaceTypes = v;
      }
    }, 1);
    let LocalCollection;
    module.link("meteor/minimongo/local_collection", {
      default(v) {
        LocalCollection = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class Cursor {
      constructor(mongo, cursorDescription) {
        this._mongo = void 0;
        this._cursorDescription = void 0;
        this._synchronousCursor = void 0;
        this._mongo = mongo;
        this._cursorDescription = cursorDescription;
        this._synchronousCursor = null;
      }
      async countAsync() {
        const collection = this._mongo.rawCollection(this._cursorDescription.collectionName);
        return await collection.countDocuments(replaceTypes(this._cursorDescription.selector, replaceMeteorAtomWithMongo), replaceTypes(this._cursorDescription.options, replaceMeteorAtomWithMongo));
      }
      count() {
        throw new Error("count() is not available on the server. Please use countAsync() instead.");
      }
      getTransform() {
        return this._cursorDescription.options.transform;
      }
      _publishCursor(sub) {
        const collection = this._cursorDescription.collectionName;
        return Mongo.Collection._publishCursor(this, sub, collection);
      }
      _getCollectionName() {
        return this._cursorDescription.collectionName;
      }
      observe(callbacks) {
        return LocalCollection._observeFromObserveChanges(this, callbacks);
      }
      async observeAsync(callbacks) {
        return new Promise(resolve => resolve(this.observe(callbacks)));
      }
      observeChanges(callbacks) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        const ordered = LocalCollection._observeChangesCallbacksAreOrdered(callbacks);
        return this._mongo._observeChanges(this._cursorDescription, ordered, callbacks, options.nonMutatingCallbacks);
      }
      async observeChangesAsync(callbacks) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        return this.observeChanges(callbacks, options);
      }
    }
    // Add cursor methods dynamically
    [...ASYNC_CURSOR_METHODS, Symbol.iterator, Symbol.asyncIterator].forEach(methodName => {
      if (methodName === 'count') return;
      Cursor.prototype[methodName] = function () {
        const cursor = setupAsynchronousCursor(this, methodName);
        return cursor[methodName](...arguments);
      };
      if (methodName === Symbol.iterator || methodName === Symbol.asyncIterator) return;
      const methodNameAsync = getAsyncMethodName(methodName);
      Cursor.prototype[methodNameAsync] = function () {
        return this[methodName](...arguments);
      };
    });
    function setupAsynchronousCursor(cursor, method) {
      if (cursor._cursorDescription.options.tailable) {
        throw new Error("Cannot call ".concat(String(method), " on a tailable cursor"));
      }
      if (!cursor._synchronousCursor) {
        cursor._synchronousCursor = cursor._mongo._createAsynchronousCursor(cursor._cursorDescription, {
          selfForIteration: cursor,
          useTransform: true
        });
      }
      return cursor._synchronousCursor;
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

},"local_collection_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/local_collection_driver.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  LocalCollectionDriver: () => LocalCollectionDriver
});
const LocalCollectionDriver = new class LocalCollectionDriver {
  constructor() {
    this.noConnCollections = Object.create(null);
  }
  open(name, conn) {
    if (!name) {
      return new LocalCollection();
    }
    if (!conn) {
      return ensureCollection(name, this.noConnCollections);
    }
    if (!conn._mongo_livedata_collections) {
      conn._mongo_livedata_collections = Object.create(null);
    }

    // XXX is there a way to keep track of a connection's collections without
    // dangling it off the connection object?
    return ensureCollection(name, conn._mongo_livedata_collections);
  }
}();
function ensureCollection(name, collections) {
  return name in collections ? collections[name] : collections[name] = new LocalCollection(name);
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"remote_collection_driver.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/remote_collection_driver.ts                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      RemoteCollectionDriver: () => RemoteCollectionDriver
    });
    let once;
    module.link("lodash.once", {
      default(v) {
        once = v;
      }
    }, 0);
    let ASYNC_COLLECTION_METHODS, getAsyncMethodName, CLIENT_ONLY_METHODS;
    module.link("meteor/minimongo/constants", {
      ASYNC_COLLECTION_METHODS(v) {
        ASYNC_COLLECTION_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      },
      CLIENT_ONLY_METHODS(v) {
        CLIENT_ONLY_METHODS = v;
      }
    }, 1);
    let MongoConnection;
    module.link("./mongo_connection", {
      MongoConnection(v) {
        MongoConnection = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class RemoteCollectionDriver {
      constructor(mongoUrl, options) {
        this.mongo = void 0;
        this.mongo = new MongoConnection(mongoUrl, options);
      }
      open(name) {
        const ret = {};
        // Handle remote collection methods
        RemoteCollectionDriver.REMOTE_COLLECTION_METHODS.forEach(method => {
          // Type assertion needed because we know these methods exist on MongoConnection
          const mongoMethod = this.mongo[method];
          ret[method] = mongoMethod.bind(this.mongo, name);
          if (!ASYNC_COLLECTION_METHODS.includes(method)) return;
          const asyncMethodName = getAsyncMethodName(method);
          ret[asyncMethodName] = function () {
            return ret[method](...arguments);
          };
        });
        // Handle client-only methods
        CLIENT_ONLY_METHODS.forEach(method => {
          ret[method] = function () {
            throw new Error("".concat(method, " is not available on the server. Please use ").concat(getAsyncMethodName(method), "() instead."));
          };
        });
        return ret;
      }
    }
    // Assign the class to MongoInternals
    RemoteCollectionDriver.REMOTE_COLLECTION_METHODS = ['createCappedCollectionAsync', 'dropIndexAsync', 'ensureIndexAsync', 'createIndexAsync', 'countDocuments', 'dropCollectionAsync', 'estimatedDocumentCount', 'find', 'findOneAsync', 'insertAsync', 'rawCollection', 'removeAsync', 'updateAsync', 'upsertAsync'];
    MongoInternals.RemoteCollectionDriver = RemoteCollectionDriver;
    // Create the singleton RemoteCollectionDriver only on demand
    MongoInternals.defaultRemoteCollectionDriver = once(() => {
      const connectionOptions = {};
      const mongoUrl = process.env.MONGO_URL;
      if (!mongoUrl) {
        throw new Error("MONGO_URL must be set in environment");
      }
      if (process.env.MONGO_OPLOG_URL) {
        connectionOptions.oplogUrl = process.env.MONGO_OPLOG_URL;
      }
      const driver = new RemoteCollectionDriver(mongoUrl, connectionOptions);
      // Initialize database connection on startup
      Meteor.startup(async () => {
        await driver.mongo.client.connect();
      });
      return driver;
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

},"collection":{"collection_extensions.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection/collection_extensions.js                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * Collection Extensions System
 * 
 * Provides a clean way to extend Mongo.Collection functionality
 * without monkey patching. Supports constructor extensions,
 * prototype methods, and static methods.
 */

if (Package['lai:collection-extensions']) {
  console.warn('lai:collection-extensions is not deprecated. Use Mongo.Collection.addExtension instead.');
}
CollectionExtensions = {
  _extensions: [],
  _prototypeMethods: new Map(),
  _staticMethods: new Map(),
  /**
   * Add a constructor extension function
   * Extension function is called with (name, options) and 'this' bound to collection instance
   */
  addExtension(extension) {
    if (typeof extension !== 'function') {
      throw new Error('Extension must be a function');
    }
    this._extensions.push(extension);
  },
  /**
   * Add a prototype method to all collection instances
   * Method is bound to the collection instance
   */
  addPrototypeMethod(name, method) {
    if (typeof name !== 'string' || !name) {
      throw new Error('Prototype method name must be a non-empty string');
    }
    if (typeof method !== 'function') {
      throw new Error('Prototype method must be a function');
    }
    this._prototypeMethods.set(name, method);
  },
  /**
   * Add a static method to the Mongo.Collection constructor
   */
  addStaticMethod(name, method) {
    if (typeof name !== 'string' || !name) {
      throw new Error('Static method name must be a non-empty string');
    }
    if (typeof method !== 'function') {
      throw new Error('Static method must be a function');
    }
    this._staticMethods.set(name, method);
  },
  /**
   * Remove an extension (useful for testing)
   */
  removeExtension(extension) {
    const index = this._extensions.indexOf(extension);
    if (index > -1) {
      this._extensions.splice(index, 1);
    }
  },
  /**
   * Remove a prototype method
   */
  removePrototypeMethod(name) {
    this._prototypeMethods.delete(name);
  },
  /**
   * Remove a static method
   */
  removeStaticMethod(name) {
    this._staticMethods.delete(name);
  },
  /**
   * Clear all extensions (useful for testing)
   */
  clearExtensions() {
    this._extensions.length = 0;
    this._prototypeMethods.clear();
    this._staticMethods.clear();
  },
  /**
   * Get all registered extensions (useful for debugging)
   */
  getExtensions() {
    return [...this._extensions];
  },
  /**
   * Get all registered prototype methods (useful for debugging)
   */
  getPrototypeMethods() {
    return new Map(this._prototypeMethods);
  },
  /**
   * Get all registered static methods (useful for debugging)
   */
  getStaticMethods() {
    return new Map(this._staticMethods);
  },
  /**
   * Apply all extensions to a collection instance
   * Called during collection construction
   */
  _applyExtensions(instance, name, options) {
    // Apply constructor extensions
    for (const extension of this._extensions) {
      try {
        extension.call(instance, name, options);
      } catch (error) {
        // Provide helpful error context
        throw new Error("Extension failed for collection '".concat(name, "': ").concat(error.message));
      }
    }

    // Apply prototype methods
    for (const [methodName, method] of this._prototypeMethods) {
      instance[methodName] = method.bind(instance);
    }
  },
  /**
   * Apply static methods to the Mongo.Collection constructor
   * Called during package initialization
   */
  _applyStaticMethods(CollectionConstructor) {
    for (const [methodName, method] of this._staticMethods) {
      CollectionConstructor[methodName] = method;
    }
  }
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"collection.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection/collection.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module1, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module1.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    let normalizeProjection;
    module1.link("../mongo_utils", {
      normalizeProjection(v) {
        normalizeProjection = v;
      }
    }, 0);
    let AsyncMethods;
    module1.link("./methods_async", {
      AsyncMethods(v) {
        AsyncMethods = v;
      }
    }, 1);
    let SyncMethods;
    module1.link("./methods_sync", {
      SyncMethods(v) {
        SyncMethods = v;
      }
    }, 2);
    let IndexMethods;
    module1.link("./methods_index", {
      IndexMethods(v) {
        IndexMethods = v;
      }
    }, 3);
    let ID_GENERATORS, normalizeOptions, setupAutopublish, setupConnection, setupDriver, setupMutationMethods, validateCollectionName;
    module1.link("./collection_utils", {
      ID_GENERATORS(v) {
        ID_GENERATORS = v;
      },
      normalizeOptions(v) {
        normalizeOptions = v;
      },
      setupAutopublish(v) {
        setupAutopublish = v;
      },
      setupConnection(v) {
        setupConnection = v;
      },
      setupDriver(v) {
        setupDriver = v;
      },
      setupMutationMethods(v) {
        setupMutationMethods = v;
      },
      validateCollectionName(v) {
        validateCollectionName = v;
      }
    }, 4);
    let ReplicationMethods;
    module1.link("./methods_replication", {
      ReplicationMethods(v) {
        ReplicationMethods = v;
      }
    }, 5);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * @summary Namespace for MongoDB-related items
     * @namespace
     */
    Mongo = {};

    /**
     * @summary Constructor for a Collection
     * @locus Anywhere
     * @instancename collection
     * @class
     * @param {String} name The name of the collection.  If null, creates an unmanaged (unsynchronized) local collection.
     * @param {Object} [options]
     * @param {Object} options.connection The server connection that will manage this collection. Uses the default connection if not specified.  Pass the return value of calling [`DDP.connect`](#DDP-connect) to specify a different server. Pass `null` to specify no connection. Unmanaged (`name` is null) collections cannot specify a connection.
     * @param {String} options.idGeneration The method of generating the `_id` fields of new documents in this collection.  Possible values:
    
     - **`'STRING'`**: random strings
     - **`'MONGO'`**:  random [`Mongo.ObjectID`](#mongo_object_id) values
    
    The default id generation technique is `'STRING'`.
     * @param {Function} options.transform An optional transformation function. Documents will be passed through this function before being returned from `fetch` or `findOneAsync`, and before being passed to callbacks of `observe`, `map`, `forEach`, `allow`, and `deny`. Transforms are *not* applied for the callbacks of `observeChanges` or to cursors returned from publish functions.
     * @param {Boolean} options.defineMutationMethods Set to `false` to skip setting up the mutation methods that enable insert/update/remove from client code. Default `true`.
     */
    // Main Collection constructor
    Mongo.Collection = function Collection(name, options) {
      var _ID_GENERATORS$option, _ID_GENERATORS;
      name = validateCollectionName(name);
      options = normalizeOptions(options);
      this._makeNewID = (_ID_GENERATORS$option = (_ID_GENERATORS = ID_GENERATORS)[options.idGeneration]) === null || _ID_GENERATORS$option === void 0 ? void 0 : _ID_GENERATORS$option.call(_ID_GENERATORS, name);
      this._transform = LocalCollection.wrapTransform(options.transform);
      this.resolverType = options.resolverType;
      this._connection = setupConnection(name, options);
      const driver = setupDriver(name, this._connection, options);
      this._driver = driver;
      this._collection = driver.open(name, this._connection);
      this._name = name;
      this._settingUpReplicationPromise = this._maybeSetUpReplication(name, options);
      setupMutationMethods(this, name, options);
      setupAutopublish(this, name, options);
      Mongo._collections.set(name, this);

      // Apply collection extensions
      CollectionExtensions._applyExtensions(this, name, options);
    };

    // Apply static methods to the Collection constructor
    CollectionExtensions._applyStaticMethods(Mongo.Collection);
    Object.assign(Mongo.Collection.prototype, {
      _getFindSelector(args) {
        if (args.length == 0) return {};else return args[0];
      },
      _getFindOptions(args) {
        const [, options] = args || [];
        const newOptions = normalizeProjection(options);
        var self = this;
        if (args.length < 2) {
          return {
            transform: self._transform
          };
        } else {
          check(newOptions, Match.Optional(Match.ObjectIncluding({
            projection: Match.Optional(Match.OneOf(Object, undefined)),
            sort: Match.Optional(Match.OneOf(Object, Array, Function, undefined)),
            limit: Match.Optional(Match.OneOf(Number, undefined)),
            skip: Match.Optional(Match.OneOf(Number, undefined))
          })));
          return _objectSpread({
            transform: self._transform
          }, newOptions);
        }
      }
    });
    Object.assign(Mongo.Collection, {
      async _publishCursor(cursor, sub, collection) {
        var observeHandle = await cursor.observeChanges({
          added: function (id, fields) {
            sub.added(collection, id, fields);
          },
          changed: function (id, fields) {
            sub.changed(collection, id, fields);
          },
          removed: function (id) {
            sub.removed(collection, id);
          }
        },
        // Publications don't mutate the documents
        // This is tested by the `livedata - publish callbacks clone` test
        {
          nonMutatingCallbacks: true
        });

        // We don't call sub.ready() here: it gets called in livedata_server, after
        // possibly calling _publishCursor on multiple returned cursors.

        // register stop callback (expects lambda w/ no args).
        sub.onStop(async function () {
          return await observeHandle.stop();
        });

        // return the observeHandle in case it needs to be stopped early
        return observeHandle;
      },
      // protect against dangerous selectors.  falsey and {_id: falsey} are both
      // likely programmer error, and not what you want, particularly for destructive
      // operations. If a falsey _id is sent in, a new string _id will be
      // generated and returned; if a fallbackId is provided, it will be returned
      // instead.
      _rewriteSelector(selector) {
        let {
          fallbackId
        } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // shorthand -- scalars match _id
        if (LocalCollection._selectorIsId(selector)) selector = {
          _id: selector
        };
        if (Array.isArray(selector)) {
          // This is consistent with the Mongo console itself; if we don't do this
          // check passing an empty array ends up selecting all items
          throw new Error("Mongo selector can't be an array.");
        }
        if (!selector || '_id' in selector && !selector._id) {
          // can't match anything
          return {
            _id: fallbackId || Random.id()
          };
        }
        return selector;
      },
      // Collection Extensions API - delegate to CollectionExtensions
      /**
       * @summary Add a constructor extension function that runs when collections are created.
       * @locus Anywhere
       * @memberof Mongo.Collection
       * @static
       * @param {Function} extension Extension function called with (name, options) and 'this' bound to collection instance
       */
      addExtension(extension) {
        return CollectionExtensions.addExtension(extension);
      },
      /**
       * @summary Add a prototype method to all collection instances.
       * @locus Anywhere
       * @memberof Mongo.Collection
       * @static
       * @param {String} name The name of the method to add
       * @param {Function} method The method function, bound to the collection instance
       */
      addPrototypeMethod(name, method) {
        return CollectionExtensions.addPrototypeMethod(name, method);
      },
      /**
       * @summary Add a static method to the Mongo.Collection constructor.
       * @locus Anywhere
       * @memberof Mongo.Collection
       * @static
       * @param {String} name The name of the static method to add
       * @param {Function} method The static method function
       */
      addStaticMethod(name, method) {
        return CollectionExtensions.addStaticMethod(name, method);
      },
      /**
       * @summary Remove a constructor extension (useful for testing).
       * @locus Anywhere
       * @memberof Mongo.Collection
       * @static
       * @param {Function} extension The extension function to remove
       */
      removeExtension(extension) {
        return CollectionExtensions.removeExtension(extension);
      },
      /**
       * @summary Remove a prototype method from all collection instances.
       * @locus Anywhere
       * @memberof Mongo.Collection
       * @static
       * @param {String} name The name of the method to remove
       */
      removePrototypeMethod(name) {
        return CollectionExtensions.removePrototypeMethod(name);
      },
      /**
       * @summary Remove a static method from the Mongo.Collection constructor.
       * @locus Anywhere
       * @memberof Mongo.Collection
       * @static
       * @param {String} name The name of the static method to remove
       */
      removeStaticMethod(name) {
        return CollectionExtensions.removeStaticMethod(name);
      },
      /**
       * @summary Clear all extensions, prototype methods, and static methods (useful for testing).
       * @locus Anywhere
       * @memberof Mongo.Collection
       * @static
       */
      clearExtensions() {
        return CollectionExtensions.clearExtensions();
      },
      /**
       * @summary Get all registered constructor extensions (useful for debugging).
       * @locus Anywhere
       * @memberof Mongo.Collection
       * @static
       * @returns {Array<Function>} Array of registered extension functions
       */
      getExtensions() {
        return CollectionExtensions.getExtensions();
      },
      /**
       * @summary Get all registered prototype methods (useful for debugging).
       * @locus Anywhere
       * @memberof Mongo.Collection
       * @static
       * @returns {Map<String, Function>} Map of method names to functions
       */
      getPrototypeMethods() {
        return CollectionExtensions.getPrototypeMethods();
      },
      /**
       * @summary Get all registered static methods (useful for debugging).
       * @locus Anywhere
       * @memberof Mongo.Collection
       * @static
       * @returns {Map<String, Function>} Map of method names to functions
       */
      getStaticMethods() {
        return CollectionExtensions.getStaticMethods();
      }
    });
    Object.assign(Mongo.Collection.prototype, ReplicationMethods, SyncMethods, AsyncMethods, IndexMethods);
    Object.assign(Mongo.Collection.prototype, {
      // Determine if this collection is simply a minimongo representation of a real
      // database on another server
      _isRemoteCollection() {
        // XXX see #MeteorServerNull
        return this._connection && this._connection !== Meteor.server;
      },
      async dropCollectionAsync() {
        var self = this;
        if (!self._collection.dropCollectionAsync) throw new Error('Can only call dropCollectionAsync on server collections');
        await self._collection.dropCollectionAsync();
      },
      async createCappedCollectionAsync(byteSize, maxDocuments) {
        var self = this;
        if (!(await self._collection.createCappedCollectionAsync)) throw new Error('Can only call createCappedCollectionAsync on server collections');
        await self._collection.createCappedCollectionAsync(byteSize, maxDocuments);
      },
      /**
       * @summary Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/3.0/api/Collection.html) object corresponding to this collection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
       * @locus Server
       * @memberof Mongo.Collection
       * @instance
       */
      rawCollection() {
        var self = this;
        if (!self._collection.rawCollection) {
          throw new Error('Can only call rawCollection on server collections');
        }
        return self._collection.rawCollection();
      },
      /**
       * @summary Returns the [`Db`](http://mongodb.github.io/node-mongodb-native/3.0/api/Db.html) object corresponding to this collection's database connection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
       * @locus Server
       * @memberof Mongo.Collection
       * @instance
       */
      rawDatabase() {
        var self = this;
        if (!(self._driver.mongo && self._driver.mongo.db)) {
          throw new Error('Can only call rawDatabase on server collections');
        }
        return self._driver.mongo.db;
      }
    });
    Object.assign(Mongo, {
      /**
       * @summary Retrieve a Meteor collection instance by name. Only collections defined with [`new Mongo.Collection(...)`](#collections) are available with this method. For plain MongoDB collections, you'll want to look at [`rawDatabase()`](#Mongo-Collection-rawDatabase).
       * @locus Anywhere
       * @memberof Mongo
       * @static
       * @param {string} name Name of your collection as it was defined with `new Mongo.Collection()`.
       * @returns {Mongo.Collection | undefined}
       */
      getCollection(name) {
        return this._collections.get(name);
      },
      /**
       * @summary A record of all defined Mongo.Collection instances, indexed by collection name.
       * @type {Map<string, Mongo.Collection>}
       * @memberof Mongo
       * @protected
       */
      _collections: new Map(),
      /**
       * @summary Collection Extensions API
       * @memberof Mongo
       * @static
       */
      CollectionExtensions: CollectionExtensions
    });

    /**
     * @summary Create a Mongo-style `ObjectID`.  If you don't specify a `hexString`, the `ObjectID` will be generated randomly (not using MongoDB's ID construction rules).
     * @locus Anywhere
     * @class
     * @param {String} [hexString] Optional.  The 24-character hexadecimal contents of the ObjectID to create
     */
    Mongo.ObjectID = MongoID.ObjectID;

    /**
     * @summary To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.
     * @class
     * @instanceName cursor
     */
    Mongo.Cursor = LocalCollection.Cursor;

    /**
     * @deprecated in 0.9.1
     */
    Mongo.Collection.Cursor = Mongo.Cursor;

    /**
     * @deprecated in 0.9.1
     */
    Mongo.Collection.ObjectID = Mongo.ObjectID;

    /**
     * @deprecated in 0.9.1
     */
    Meteor.Collection = Mongo.Collection;

    // Allow deny stuff is now in the allow-deny package
    Object.assign(Mongo.Collection.prototype, AllowDeny.CollectionPrototype);
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

},"collection_utils.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection/collection_utils.js                                                                       //
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
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    module.export({
      ID_GENERATORS: () => ID_GENERATORS,
      setupConnection: () => setupConnection,
      setupDriver: () => setupDriver,
      setupAutopublish: () => setupAutopublish,
      setupMutationMethods: () => setupMutationMethods,
      validateCollectionName: () => validateCollectionName,
      normalizeOptions: () => normalizeOptions
    });
    const ID_GENERATORS = {
      MONGO(name) {
        return function () {
          const src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;
          return new Mongo.ObjectID(src.hexString(24));
        };
      },
      STRING(name) {
        return function () {
          const src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;
          return src.id();
        };
      }
    };
    function setupConnection(name, options) {
      if (!name || options.connection === null) return null;
      if (options.connection) return options.connection;
      return Meteor.isClient ? Meteor.connection : Meteor.server;
    }
    function setupDriver(name, connection, options) {
      if (options._driver) return options._driver;
      if (name && connection === Meteor.server && typeof MongoInternals !== 'undefined' && MongoInternals.defaultRemoteCollectionDriver) {
        return MongoInternals.defaultRemoteCollectionDriver();
      }
      const {
        LocalCollectionDriver
      } = require('../local_collection_driver.js');
      return LocalCollectionDriver;
    }
    function setupAutopublish(collection, name, options) {
      if (Package.autopublish && !options._preventAutopublish && collection._connection && collection._connection.publish) {
        collection._connection.publish(null, () => collection.find(), {
          is_auto: true
        });
      }
    }
    function setupMutationMethods(collection, name, options) {
      if (options.defineMutationMethods === false) return;
      try {
        collection._defineMutationMethods({
          useExisting: options._suppressSameNameError === true
        });
      } catch (error) {
        if (error.message === "A method named '/".concat(name, "/insertAsync' is already defined")) {
          throw new Error("There is already a collection named \"".concat(name, "\""));
        }
        throw error;
      }
    }
    function validateCollectionName(name) {
      if (!name && name !== null) {
        Meteor._debug('Warning: creating anonymous collection. It will not be ' + 'saved or synchronized over the network. (Pass null for ' + 'the collection name to turn off this warning.)');
        name = null;
      }
      if (name !== null && typeof name !== 'string') {
        throw new Error('First argument to new Mongo.Collection must be a string or null');
      }
      return name;
    }
    function normalizeOptions(options) {
      if (options && options.methods) {
        // Backwards compatibility hack with original signature
        options = {
          connection: options
        };
      }
      // Backwards compatibility: "connection" used to be called "manager".
      if (options && options.manager && !options.connection) {
        options.connection = options.manager;
      }
      const cleanedOptions = Object.fromEntries(Object.entries(options || {}).filter(_ref => {
        let [_, v] = _ref;
        return v !== undefined;
      }));

      // 2) Spread defaults first, then only the defined overrides
      return _objectSpread({
        connection: undefined,
        idGeneration: 'STRING',
        transform: null,
        _driver: undefined,
        _preventAutopublish: false
      }, cleanedOptions);
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

},"methods_async.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection/methods_async.js                                                                          //
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
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    module.export({
      AsyncMethods: () => AsyncMethods
    });
    const AsyncMethods = {
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
       * @returns {Object}
       */
      findOneAsync() {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        return this._collection.findOneAsync(this._getFindSelector(args), this._getFindOptions(args));
      },
      _insertAsync(doc) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // Make sure we were passed a document to insert
        if (!doc) {
          throw new Error('insert requires an argument');
        }

        // Make a shallow clone of the document, preserving its prototype.
        doc = Object.create(Object.getPrototypeOf(doc), Object.getOwnPropertyDescriptors(doc));
        if ('_id' in doc) {
          if (!doc._id || !(typeof doc._id === 'string' || doc._id instanceof Mongo.ObjectID)) {
            throw new Error('Meteor requires document _id fields to be non-empty strings or ObjectIDs');
          }
        } else {
          let generateId = true;

          // Don't generate the id if we're the client and the 'outermost' call
          // This optimization saves us passing both the randomSeed and the id
          // Passing both is redundant.
          if (this._isRemoteCollection()) {
            const enclosing = DDP._CurrentMethodInvocation.get();
            if (!enclosing) {
              generateId = false;
            }
          }
          if (generateId) {
            doc._id = this._makeNewID();
          }
        }

        // On inserts, always return the id that we generated; on all other
        // operations, just return the result from the collection.
        var chooseReturnValueFromCollectionResult = function (result) {
          if (Meteor._isPromise(result)) return result;
          if (doc._id) {
            return doc._id;
          }

          // XXX what is this for??
          // It's some iteraction between the callback to _callMutatorMethod and
          // the return value conversion
          doc._id = result;
          return result;
        };
        if (this._isRemoteCollection()) {
          const promise = this._callMutatorMethodAsync('insertAsync', [doc], options);
          promise.then(chooseReturnValueFromCollectionResult);
          promise.stubPromise = promise.stubPromise.then(chooseReturnValueFromCollectionResult);
          promise.serverPromise = promise.serverPromise.then(chooseReturnValueFromCollectionResult);
          return promise;
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        return this._collection.insertAsync(doc).then(chooseReturnValueFromCollectionResult);
      },
      /**
       * @summary Insert a document in the collection.  Returns a promise that will return the document's unique _id when solved.
       * @locus Anywhere
       * @method  insert
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
       */
      insertAsync(doc, options) {
        return this._insertAsync(doc, options);
      },
      /**
       * @summary Modify one or more documents in the collection. Returns the number of matched documents.
       * @locus Anywhere
       * @method update
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
       * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
       */
      updateAsync(selector, modifier) {
        // We've already popped off the callback, so we are left with an array
        // of one or zero items
        const options = _objectSpread({}, (arguments.length <= 2 ? undefined : arguments[2]) || null);
        let insertedId;
        if (options && options.upsert) {
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.
          if (options.insertedId) {
            if (!(typeof options.insertedId === 'string' || options.insertedId instanceof Mongo.ObjectID)) throw new Error('insertedId must be string or ObjectID');
            insertedId = options.insertedId;
          } else if (!selector || !selector._id) {
            insertedId = this._makeNewID();
            options.generatedId = true;
            options.insertedId = insertedId;
          }
        }
        selector = Mongo.Collection._rewriteSelector(selector, {
          fallbackId: insertedId
        });
        if (this._isRemoteCollection()) {
          const args = [selector, modifier, options];
          return this._callMutatorMethodAsync('updateAsync', args, options);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.

        return this._collection.updateAsync(selector, modifier, options);
      },
      /**
       * @summary Asynchronously removes documents from the collection.
       * @locus Anywhere
       * @method remove
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to remove
       */
      removeAsync(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        selector = Mongo.Collection._rewriteSelector(selector);
        if (this._isRemoteCollection()) {
          return this._callMutatorMethodAsync('removeAsync', [selector], options);
        }

        // it's my collection.  descend into the collection1 object
        // and propagate any exception.
        return this._collection.removeAsync(selector);
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
       * @locus Anywhere
       * @method upsert
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       */
      async upsertAsync(selector, modifier, options) {
        return this.updateAsync(selector, modifier, _objectSpread(_objectSpread({}, options), {}, {
          _returnObject: true,
          upsert: true
        }));
      },
      /**
       * @summary Gets the number of documents matching the filter. For a fast count of the total documents in a collection see `estimatedDocumentCount`.
       * @locus Anywhere
       * @method countDocuments
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to count
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://mongodb.github.io/node-mongodb-native/4.11/interfaces/CountDocumentsOptions.html). Please note that not all of them are available on the client.
       * @returns {Promise<number>}
       */
      countDocuments() {
        return this._collection.countDocuments(...arguments);
      },
      /**
       * @summary Gets an estimate of the count of documents in a collection using collection metadata. For an exact count of the documents in a collection see `countDocuments`.
       * @locus Anywhere
       * @method estimatedDocumentCount
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://mongodb.github.io/node-mongodb-native/4.11/interfaces/EstimatedDocumentCountOptions.html). Please note that not all of them are available on the client.
       * @returns {Promise<number>}
       */
      estimatedDocumentCount() {
        return this._collection.estimatedDocumentCount(...arguments);
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

},"methods_index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection/methods_index.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      IndexMethods: () => IndexMethods
    });
    let Log;
    module.link("meteor/logging", {
      Log(v) {
        Log = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const IndexMethods = {
      // We'll actually design an index API later. For now, we just pass through to
      // Mongo's, but make it synchronous.
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method ensureIndexAsync
       * @deprecated in 3.0
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      async ensureIndexAsync(index, options) {
        var self = this;
        if (!self._collection.ensureIndexAsync || !self._collection.createIndexAsync) throw new Error('Can only call createIndexAsync on server collections');
        if (self._collection.createIndexAsync) {
          await self._collection.createIndexAsync(index, options);
        } else {
          Log.debug("ensureIndexAsync has been deprecated, please use the new 'createIndexAsync' instead".concat(options !== null && options !== void 0 && options.name ? ", index name: ".concat(options.name) : ", index: ".concat(JSON.stringify(index))));
          await self._collection.ensureIndexAsync(index, options);
        }
      },
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method createIndexAsync
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      async createIndexAsync(index, options) {
        var self = this;
        if (!self._collection.createIndexAsync) throw new Error('Can only call createIndexAsync on server collections');
        try {
          await self._collection.createIndexAsync(index, options);
        } catch (e) {
          var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
          if (e.message.includes('An equivalent index already exists with the same name but different options.') && (_Meteor$settings = Meteor.settings) !== null && _Meteor$settings !== void 0 && (_Meteor$settings$pack = _Meteor$settings.packages) !== null && _Meteor$settings$pack !== void 0 && (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) !== null && _Meteor$settings$pack2 !== void 0 && _Meteor$settings$pack2.reCreateIndexOnOptionMismatch) {
            Log.info("Re-creating index ".concat(index, " for ").concat(self._name, " due to options mismatch."));
            await self._collection.dropIndexAsync(index);
            await self._collection.createIndexAsync(index, options);
          } else {
            console.error(e);
            throw new Meteor.Error("An error occurred when creating an index for collection \"".concat(self._name, ": ").concat(e.message));
          }
        }
      },
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method createIndex
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      createIndex(index, options) {
        return this.createIndexAsync(index, options);
      },
      async dropIndexAsync(index) {
        var self = this;
        if (!self._collection.dropIndexAsync) throw new Error('Can only call dropIndexAsync on server collections');
        await self._collection.dropIndexAsync(index);
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

},"methods_replication.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection/methods_replication.js                                                                    //
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
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    module.export({
      ReplicationMethods: () => ReplicationMethods
    });
    const ReplicationMethods = {
      async _maybeSetUpReplication(name) {
        var _registerStoreResult, _registerStoreResult$;
        const self = this;
        if (!(self._connection && self._connection.registerStoreClient && self._connection.registerStoreServer)) {
          return;
        }
        const wrappedStoreCommon = {
          // Called around method stub invocations to capture the original versions
          // of modified documents.
          saveOriginals() {
            self._collection.saveOriginals();
          },
          retrieveOriginals() {
            return self._collection.retrieveOriginals();
          },
          // To be able to get back to the collection from the store.
          _getCollection() {
            return self;
          }
        };
        const wrappedStoreClient = _objectSpread({
          // Called at the beginning of a batch of updates. batchSize is the number
          // of update calls to expect.
          //
          // XXX This interface is pretty janky. reset probably ought to go back to
          // being its own function, and callers shouldn't have to calculate
          // batchSize. The optimization of not calling pause/remove should be
          // delayed until later: the first call to update() should buffer its
          // message, and then we can either directly apply it at endUpdate time if
          // it was the only update, or do pauseObservers/apply/apply at the next
          // update() if there's another one.
          async beginUpdate(batchSize, reset) {
            // pause observers so users don't see flicker when updating several
            // objects at once (including the post-reconnect reset-and-reapply
            // stage), and so that a re-sorting of a query can take advantage of the
            // full _diffQuery moved calculation instead of applying change one at a
            // time.
            if (batchSize > 1 || reset) self._collection.pauseObservers();
            if (reset) await self._collection.remove({});
          },
          // Apply an update.
          // XXX better specify this interface (not in terms of a wire message)?
          update(msg) {
            var mongoId = MongoID.idParse(msg.id);
            var doc = self._collection._docs.get(mongoId);

            //When the server's mergebox is disabled for a collection, the client must gracefully handle it when:
            // *We receive an added message for a document that is already there. Instead, it will be changed
            // *We reeive a change message for a document that is not there. Instead, it will be added
            // *We receive a removed messsage for a document that is not there. Instead, noting wil happen.

            //Code is derived from client-side code originally in peerlibrary:control-mergebox
            //https://github.com/peerlibrary/meteor-control-mergebox/blob/master/client.coffee

            //For more information, refer to discussion "Initial support for publication strategies in livedata server":
            //https://github.com/meteor/meteor/pull/11151
            if (Meteor.isClient) {
              if (msg.msg === 'added' && doc) {
                msg.msg = 'changed';
              } else if (msg.msg === 'removed' && !doc) {
                return;
              } else if (msg.msg === 'changed' && !doc) {
                msg.msg = 'added';
                const _ref = msg.fields;
                for (let field in _ref) {
                  const value = _ref[field];
                  if (value === void 0) {
                    delete msg.fields[field];
                  }
                }
              }
            }
            // Is this a "replace the whole doc" message coming from the quiescence
            // of method writes to an object? (Note that 'undefined' is a valid
            // value meaning "remove it".)
            if (msg.msg === 'replace') {
              var replace = msg.replace;
              if (!replace) {
                if (doc) self._collection.remove(mongoId);
              } else if (!doc) {
                self._collection.insert(replace);
              } else {
                // XXX check that replace has no $ ops
                self._collection.update(mongoId, replace);
              }
              return;
            } else if (msg.msg === 'added') {
              if (doc) {
                throw new Error('Expected not to find a document already present for an add');
              }
              self._collection.insert(_objectSpread({
                _id: mongoId
              }, msg.fields));
            } else if (msg.msg === 'removed') {
              if (!doc) throw new Error('Expected to find a document already present for removed');
              self._collection.remove(mongoId);
            } else if (msg.msg === 'changed') {
              if (!doc) throw new Error('Expected to find a document to change');
              const keys = Object.keys(msg.fields);
              if (keys.length > 0) {
                var modifier = {};
                keys.forEach(key => {
                  const value = msg.fields[key];
                  if (EJSON.equals(doc[key], value)) {
                    return;
                  }
                  if (typeof value === 'undefined') {
                    if (!modifier.$unset) {
                      modifier.$unset = {};
                    }
                    modifier.$unset[key] = 1;
                  } else {
                    if (!modifier.$set) {
                      modifier.$set = {};
                    }
                    modifier.$set[key] = value;
                  }
                });
                if (Object.keys(modifier).length > 0) {
                  self._collection.update(mongoId, modifier);
                }
              }
            } else {
              throw new Error("I don't know how to deal with this message");
            }
          },
          // Called at the end of a batch of updates.livedata_connection.js:1287
          endUpdate() {
            self._collection.resumeObserversClient();
          },
          // Used to preserve current versions of documents across a store reset.
          getDoc(id) {
            return self.findOne(id);
          }
        }, wrappedStoreCommon);
        const wrappedStoreServer = _objectSpread({
          async beginUpdate(batchSize, reset) {
            if (batchSize > 1 || reset) self._collection.pauseObservers();
            if (reset) await self._collection.removeAsync({});
          },
          async update(msg) {
            var mongoId = MongoID.idParse(msg.id);
            var doc = self._collection._docs.get(mongoId);

            // Is this a "replace the whole doc" message coming from the quiescence
            // of method writes to an object? (Note that 'undefined' is a valid
            // value meaning "remove it".)
            if (msg.msg === 'replace') {
              var replace = msg.replace;
              if (!replace) {
                if (doc) await self._collection.removeAsync(mongoId);
              } else if (!doc) {
                await self._collection.insertAsync(replace);
              } else {
                // XXX check that replace has no $ ops
                await self._collection.updateAsync(mongoId, replace);
              }
              return;
            } else if (msg.msg === 'added') {
              if (doc) {
                throw new Error('Expected not to find a document already present for an add');
              }
              await self._collection.insertAsync(_objectSpread({
                _id: mongoId
              }, msg.fields));
            } else if (msg.msg === 'removed') {
              if (!doc) throw new Error('Expected to find a document already present for removed');
              await self._collection.removeAsync(mongoId);
            } else if (msg.msg === 'changed') {
              if (!doc) throw new Error('Expected to find a document to change');
              const keys = Object.keys(msg.fields);
              if (keys.length > 0) {
                var modifier = {};
                keys.forEach(key => {
                  const value = msg.fields[key];
                  if (EJSON.equals(doc[key], value)) {
                    return;
                  }
                  if (typeof value === 'undefined') {
                    if (!modifier.$unset) {
                      modifier.$unset = {};
                    }
                    modifier.$unset[key] = 1;
                  } else {
                    if (!modifier.$set) {
                      modifier.$set = {};
                    }
                    modifier.$set[key] = value;
                  }
                });
                if (Object.keys(modifier).length > 0) {
                  await self._collection.updateAsync(mongoId, modifier);
                }
              }
            } else {
              throw new Error("I don't know how to deal with this message");
            }
          },
          // Called at the end of a batch of updates.
          async endUpdate() {
            await self._collection.resumeObserversServer();
          },
          // Used to preserve current versions of documents across a store reset.
          async getDoc(id) {
            return self.findOneAsync(id);
          }
        }, wrappedStoreCommon);

        // OK, we're going to be a slave, replicating some remote
        // database, except possibly with some temporary divergence while
        // we have unacknowledged RPC's.
        let registerStoreResult;
        if (Meteor.isClient) {
          registerStoreResult = self._connection.registerStoreClient(name, wrappedStoreClient);
        } else {
          registerStoreResult = self._connection.registerStoreServer(name, wrappedStoreServer);
        }
        const message = "There is already a collection named \"".concat(name, "\"");
        const logWarn = () => {
          console.warn ? console.warn(message) : console.log(message);
        };
        if (!registerStoreResult) {
          return logWarn();
        }
        return (_registerStoreResult = registerStoreResult) === null || _registerStoreResult === void 0 ? void 0 : (_registerStoreResult$ = _registerStoreResult.then) === null || _registerStoreResult$ === void 0 ? void 0 : _registerStoreResult$.call(_registerStoreResult, ok => {
          if (!ok) {
            logWarn();
          }
        });
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

},"methods_sync.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection/methods_sync.js                                                                           //
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
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    module.export({
      SyncMethods: () => SyncMethods
    });
    const SyncMethods = {
      /**
       * @summary Find the documents in a collection that match the selector.
       * @locus Anywhere
       * @method find
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to find
       * @param {Object} [options]
       * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
       * @param {Number} options.skip Number of results to skip at the beginning
       * @param {Number} options.limit Maximum number of results to return
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       * @param {Boolean} options.reactive (Client only) Default `true`; pass `false` to disable reactivity
       * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
       * @param {Boolean} options.disableOplog (Server only) Pass true to disable oplog-tailing on this query. This affects the way server processes calls to `observe` on this query. Disabling the oplog can be useful when working with data that updates in large batches.
       * @param {Number} options.pollingIntervalMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the frequency (in milliseconds) of how often to poll this query when observing on the server. Defaults to 10000ms (10 seconds).
       * @param {Number} options.pollingThrottleMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the minimum time (in milliseconds) to allow between re-polling when observing on the server. Increasing this will save CPU and mongo load at the expense of slower updates to users. Decreasing this is not recommended. Defaults to 50ms.
       * @param {Number} options.maxTimeMs (Server only) If set, instructs MongoDB to set a time limit for this cursor's operations. If the operation reaches the specified time limit (in milliseconds) without the having been completed, an exception will be thrown. Useful to prevent an (accidental or malicious) unoptimized query from causing a full collection scan that would disrupt other database users, at the expense of needing to handle the resulting error.
       * @param {String|Object} options.hint (Server only) Overrides MongoDB's default index selection and query optimization process. Specify an index to force its use, either by its name or index specification. You can also specify `{ $natural : 1 }` to force a forwards collection scan, or `{ $natural : -1 }` for a reverse collection scan. Setting this is only recommended for advanced users.
       * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for this particular cursor. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
       * @returns {Mongo.Cursor}
       */
      find() {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        // Collection.find() (return all docs) behaves differently
        // from Collection.find(undefined) (return 0 docs).  so be
        // careful about the length of arguments.
        return this._collection.find(this._getFindSelector(args), this._getFindOptions(args));
      },
      /**
       * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
       * @locus Anywhere
       * @method findOne
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
       * @returns {Object}
       */
      findOne() {
        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }
        return this._collection.findOne(this._getFindSelector(args), this._getFindOptions(args));
      },
      // 'insert' immediately returns the inserted document's new _id.
      // The others return values immediately if you are in a stub, an in-memory
      // unmanaged collection, or a mongo-backed collection and you don't pass a
      // callback. 'update' and 'remove' return the number of affected
      // documents. 'upsert' returns an object with keys 'numberAffected' and, if an
      // insert happened, 'insertedId'.
      //
      // Otherwise, the semantics are exactly like other methods: they take
      // a callback as an optional last argument; if no callback is
      // provided, they block until the operation is complete, and throw an
      // exception if it fails; if a callback is provided, then they don't
      // necessarily block, and they call the callback when they finish with error and
      // result arguments.  (The insert method provides the document ID as its result;
      // update and remove provide the number of affected docs as the result; upsert
      // provides an object with numberAffected and maybe insertedId.)
      //
      // On the client, blocking is impossible, so if a callback
      // isn't provided, they just return immediately and any error
      // information is lost.
      //
      // There's one more tweak. On the client, if you don't provide a
      // callback, then if there is an error, a message will be logged with
      // Meteor._debug.
      //
      // The intent (though this is actually determined by the underlying
      // drivers) is that the operations should be done synchronously, not
      // generating their result until the database has acknowledged
      // them. In the future maybe we should provide a flag to turn this
      // off.

      _insert(doc, callback) {
        // Make sure we were passed a document to insert
        if (!doc) {
          throw new Error('insert requires an argument');
        }

        // Make a shallow clone of the document, preserving its prototype.
        doc = Object.create(Object.getPrototypeOf(doc), Object.getOwnPropertyDescriptors(doc));
        if ('_id' in doc) {
          if (!doc._id || !(typeof doc._id === 'string' || doc._id instanceof Mongo.ObjectID)) {
            throw new Error('Meteor requires document _id fields to be non-empty strings or ObjectIDs');
          }
        } else {
          let generateId = true;

          // Don't generate the id if we're the client and the 'outermost' call
          // This optimization saves us passing both the randomSeed and the id
          // Passing both is redundant.
          if (this._isRemoteCollection()) {
            const enclosing = DDP._CurrentMethodInvocation.get();
            if (!enclosing) {
              generateId = false;
            }
          }
          if (generateId) {
            doc._id = this._makeNewID();
          }
        }

        // On inserts, always return the id that we generated; on all other
        // operations, just return the result from the collection.
        var chooseReturnValueFromCollectionResult = function (result) {
          if (Meteor._isPromise(result)) return result;
          if (doc._id) {
            return doc._id;
          }

          // XXX what is this for??
          // It's some iteraction between the callback to _callMutatorMethod and
          // the return value conversion
          doc._id = result;
          return result;
        };
        const wrappedCallback = wrapCallback(callback, chooseReturnValueFromCollectionResult);
        if (this._isRemoteCollection()) {
          const result = this._callMutatorMethod('insert', [doc], wrappedCallback);
          return chooseReturnValueFromCollectionResult(result);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        try {
          // If the user provided a callback and the collection implements this
          // operation asynchronously, then queryRet will be undefined, and the
          // result will be returned through the callback instead.
          let result;
          if (!!wrappedCallback) {
            this._collection.insert(doc, wrappedCallback);
          } else {
            // If we don't have the callback, we assume the user is using the promise.
            // We can't just pass this._collection.insert to the promisify because it would lose the context.
            result = this._collection.insert(doc);
          }
          return chooseReturnValueFromCollectionResult(result);
        } catch (e) {
          if (callback) {
            callback(e);
            return null;
          }
          throw e;
        }
      },
      /**
       * @summary Insert a document in the collection.  Returns its unique _id.
       * @locus Anywhere
       * @method  insert
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the _id as the second.
       */
      insert(doc, callback) {
        return this._insert(doc, callback);
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection. Returns the number of matched documents.
       * @locus Anywhere
       * @method update
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
       * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
       */
      update(selector, modifier) {
        for (var _len3 = arguments.length, optionsAndCallback = new Array(_len3 > 2 ? _len3 - 2 : 0), _key3 = 2; _key3 < _len3; _key3++) {
          optionsAndCallback[_key3 - 2] = arguments[_key3];
        }
        const callback = popCallbackFromArgs(optionsAndCallback);

        // We've already popped off the callback, so we are left with an array
        // of one or zero items
        const options = _objectSpread({}, optionsAndCallback[0] || null);
        let insertedId;
        if (options && options.upsert) {
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.
          if (options.insertedId) {
            if (!(typeof options.insertedId === 'string' || options.insertedId instanceof Mongo.ObjectID)) throw new Error('insertedId must be string or ObjectID');
            insertedId = options.insertedId;
          } else if (!selector || !selector._id) {
            insertedId = this._makeNewID();
            options.generatedId = true;
            options.insertedId = insertedId;
          }
        }
        selector = Mongo.Collection._rewriteSelector(selector, {
          fallbackId: insertedId
        });
        const wrappedCallback = wrapCallback(callback);
        if (this._isRemoteCollection()) {
          const args = [selector, modifier, options];
          return this._callMutatorMethod('update', args, callback);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.
        //console.log({callback, options, selector, modifier, coll: this._collection});
        try {
          // If the user provided a callback and the collection implements this
          // operation asynchronously, then queryRet will be undefined, and the
          // result will be returned through the callback instead.
          return this._collection.update(selector, modifier, options, wrappedCallback);
        } catch (e) {
          if (callback) {
            callback(e);
            return null;
          }
          throw e;
        }
      },
      /**
       * @summary Remove documents from the collection
       * @locus Anywhere
       * @method remove
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to remove
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
       */
      remove(selector, callback) {
        selector = Mongo.Collection._rewriteSelector(selector);
        if (this._isRemoteCollection()) {
          return this._callMutatorMethod('remove', [selector], callback);
        }

        // it's my collection.  descend into the collection1 object
        // and propagate any exception.
        return this._collection.remove(selector);
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
       * @locus Anywhere
       * @method upsert
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
       */
      upsert(selector, modifier, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.update(selector, modifier, _objectSpread(_objectSpread({}, options), {}, {
          _returnObject: true,
          upsert: true
        }));
      }
    };
    // Convert the callback to not return a result if there is an error
    function wrapCallback(callback, convertResult) {
      return callback && function (error, result) {
        if (error) {
          callback(error);
        } else if (typeof convertResult === 'function') {
          callback(error, convertResult(result));
        } else {
          callback(error, result);
        }
      };
    }
    function popCallbackFromArgs(args) {
      // Pull off any callback (or perhaps a 'callback' variable that was passed
      // in undefined, like how 'upsert' does it).
      if (args.length && (args[args.length - 1] === undefined || args[args.length - 1] instanceof Function)) {
        return args.pop();
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

}},"connection_options.ts":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/connection_options.ts                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * @summary Allows for user specified connection options
 * @example http://mongodb.github.io/node-mongodb-native/3.0/reference/connecting/connection-settings/
 * @locus Server
 * @param {Object} options User specified Mongo connection options
 */
Mongo.setConnectionOptions = function setConnectionOptions(options) {
  check(options, Object);
  Mongo._connectionOptions = options;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"mongo_utils.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_utils.js                                                                                       //
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
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const _excluded = ["fields", "projection"];
    module.export({
      normalizeProjection: () => normalizeProjection
    });
    const normalizeProjection = options => {
      // transform fields key in projection
      const _ref = options || {},
        {
          fields,
          projection
        } = _ref,
        otherOptions = _objectWithoutProperties(_ref, _excluded);
      // TODO: enable this comment when deprecating the fields option
      // Log.debug(`fields option has been deprecated, please use the new 'projection' instead`)

      return _objectSpread(_objectSpread({}, otherOptions), projection || fields ? {
        projection: fields || projection
      } : {});
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

},"observe_handle.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/observe_handle.ts                                                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  ObserveHandle: () => ObserveHandle
});
let nextObserveHandleId = 1;
/**
 * The "observe handle" returned from observeChanges.
 * Contains a reference to an ObserveMultiplexer.
 * Used to stop observation and clean up resources.
 */
class ObserveHandle {
  constructor(multiplexer, callbacks, nonMutatingCallbacks) {
    this._id = void 0;
    this._multiplexer = void 0;
    this.nonMutatingCallbacks = void 0;
    this._stopped = void 0;
    this.initialAddsSentResolver = () => {};
    this.initialAddsSent = void 0;
    this._added = void 0;
    this._addedBefore = void 0;
    this._changed = void 0;
    this._movedBefore = void 0;
    this._removed = void 0;
    /**
     * Using property syntax and arrow function syntax to avoid binding the wrong context on callbacks.
     */
    this.stop = async () => {
      if (this._stopped) return;
      this._stopped = true;
      await this._multiplexer.removeHandle(this._id);
    };
    this._multiplexer = multiplexer;
    multiplexer.callbackNames().forEach(name => {
      if (callbacks[name]) {
        this["_".concat(name)] = callbacks[name];
        return;
      }
      if (name === "addedBefore" && callbacks.added) {
        this._addedBefore = async function (id, fields, before) {
          await callbacks.added(id, fields);
        };
      }
    });
    this._stopped = false;
    this._id = nextObserveHandleId++;
    this.nonMutatingCallbacks = nonMutatingCallbacks;
    this.initialAddsSent = new Promise(resolve => {
      const ready = () => {
        resolve();
        this.initialAddsSent = Promise.resolve();
      };
      const timeout = setTimeout(ready, 30000);
      this.initialAddsSentResolver = () => {
        ready();
        clearTimeout(timeout);
      };
    });
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"lodash.isempty":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.isempty/package.json                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isempty",
  "version": "4.4.0"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.isempty/index.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.clone":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.clone/package.json                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.clone",
  "version": "4.5.0"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.clone/index.js                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.has":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.has/package.json                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.has",
  "version": "4.5.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.has/index.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.throttle":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.throttle/package.json                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.throttle",
  "version": "4.1.1"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.throttle/index.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"mongodb-uri":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/mongodb-uri/package.json                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "mongodb-uri",
  "version": "0.9.7",
  "main": "mongodb-uri"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"mongodb-uri.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/mongodb-uri/mongodb-uri.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.once":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.once/package.json                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.once",
  "version": "4.1.1"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/mongo/node_modules/lodash.once/index.js                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json",
    ".ts"
  ]
});


/* Exports */
return {
  export: function () { return {
      MongoInternals: MongoInternals,
      Mongo: Mongo,
      CollectionExtensions: CollectionExtensions,
      ObserveMultiplexer: ObserveMultiplexer
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/mongo/mongo_driver.js",
    "/node_modules/meteor/mongo/oplog_tailing.ts",
    "/node_modules/meteor/mongo/observe_multiplex.ts",
    "/node_modules/meteor/mongo/doc_fetcher.js",
    "/node_modules/meteor/mongo/polling_observe_driver.ts",
    "/node_modules/meteor/mongo/oplog_observe_driver.js",
    "/node_modules/meteor/mongo/oplog_v2_converter.ts",
    "/node_modules/meteor/mongo/cursor_description.ts",
    "/node_modules/meteor/mongo/mongo_connection.js",
    "/node_modules/meteor/mongo/mongo_common.js",
    "/node_modules/meteor/mongo/asynchronous_cursor.js",
    "/node_modules/meteor/mongo/cursor.ts",
    "/node_modules/meteor/mongo/local_collection_driver.js",
    "/node_modules/meteor/mongo/remote_collection_driver.ts",
    "/node_modules/meteor/mongo/collection/collection_extensions.js",
    "/node_modules/meteor/mongo/collection/collection.js",
    "/node_modules/meteor/mongo/connection_options.ts"
  ]
}});

//# sourceURL=meteor://💻app/packages/mongo.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vcGxvZ190YWlsaW5nLnRzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vYnNlcnZlX211bHRpcGxleC50cyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vZG9jX2ZldGNoZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL3BvbGxpbmdfb2JzZXJ2ZV9kcml2ZXIudHMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL29wbG9nX29ic2VydmVfZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vcGxvZ192Ml9jb252ZXJ0ZXIudHMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2N1cnNvcl9kZXNjcmlwdGlvbi50cyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fY29ubmVjdGlvbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fY29tbW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9hc3luY2hyb25vdXNfY3Vyc29yLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9jdXJzb3IudHMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2xvY2FsX2NvbGxlY3Rpb25fZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9yZW1vdGVfY29sbGVjdGlvbl9kcml2ZXIudHMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2NvbGxlY3Rpb24vY29sbGVjdGlvbl9leHRlbnNpb25zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9jb2xsZWN0aW9uL2NvbGxlY3Rpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2NvbGxlY3Rpb24vY29sbGVjdGlvbl91dGlscy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vY29sbGVjdGlvbi9tZXRob2RzX2FzeW5jLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9jb2xsZWN0aW9uL21ldGhvZHNfaW5kZXguanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2NvbGxlY3Rpb24vbWV0aG9kc19yZXBsaWNhdGlvbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vY29sbGVjdGlvbi9tZXRob2RzX3N5bmMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2Nvbm5lY3Rpb25fb3B0aW9ucy50cyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fdXRpbHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL29ic2VydmVfaGFuZGxlLnRzIl0sIm5hbWVzIjpbIm1vZHVsZTEiLCJleHBvcnQiLCJsaXN0ZW5BbGwiLCJmb3JFYWNoVHJpZ2dlciIsIk9wbG9nSGFuZGxlIiwibGluayIsInYiLCJNb25nb0Nvbm5lY3Rpb24iLCJPcGxvZ09ic2VydmVEcml2ZXIiLCJNb25nb0RCIiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJNb25nb0ludGVybmFscyIsImdsb2JhbCIsIl9fcGFja2FnZU5hbWUiLCJOcG1Nb2R1bGVzIiwibW9uZ29kYiIsInZlcnNpb24iLCJOcG1Nb2R1bGVNb25nb2RiVmVyc2lvbiIsIm1vZHVsZSIsIk5wbU1vZHVsZSIsIlByb3h5IiwiZ2V0IiwidGFyZ2V0IiwicHJvcGVydHlLZXkiLCJyZWNlaXZlciIsIk1ldGVvciIsImRlcHJlY2F0ZSIsIlJlZmxlY3QiLCJDb25uZWN0aW9uIiwiVGltZXN0YW1wIiwicHJvdG90eXBlIiwiY2xvbmUiLCJjdXJzb3JEZXNjcmlwdGlvbiIsImxpc3RlbkNhbGxiYWNrIiwibGlzdGVuZXJzIiwidHJpZ2dlciIsInB1c2giLCJERFBTZXJ2ZXIiLCJfSW52YWxpZGF0aW9uQ3Jvc3NiYXIiLCJsaXN0ZW4iLCJzdG9wIiwiZm9yRWFjaCIsImxpc3RlbmVyIiwidHJpZ2dlckNhbGxiYWNrIiwia2V5IiwiY29sbGVjdGlvbiIsImNvbGxlY3Rpb25OYW1lIiwic3BlY2lmaWNJZHMiLCJMb2NhbENvbGxlY3Rpb24iLCJfaWRzTWF0Y2hlZEJ5U2VsZWN0b3IiLCJzZWxlY3RvciIsImlkIiwiT2JqZWN0IiwiYXNzaWduIiwiZHJvcENvbGxlY3Rpb24iLCJkcm9wRGF0YWJhc2UiLCJNb25nb1RpbWVzdGFtcCIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsInNlbGYiLCJhc3luYyIsIk9QTE9HX0NPTExFQ1RJT04iLCJpZEZvck9wIiwiaXNFbXB0eSIsImRlZmF1bHQiLCJDdXJzb3JEZXNjcmlwdGlvbiIsIk5wbU1vZHVsZU1vbmdvZGIiLCJMb25nIiwiVE9PX0ZBUl9CRUhJTkQiLCJwcm9jZXNzIiwiZW52IiwiTUVURU9SX09QTE9HX1RPT19GQVJfQkVISU5EIiwiVEFJTF9USU1FT1VUIiwiTUVURU9SX09QTE9HX1RBSUxfVElNRU9VVCIsImNvbnN0cnVjdG9yIiwib3Bsb2dVcmwiLCJkYk5hbWUiLCJfTWV0ZW9yJHNldHRpbmdzIiwiX01ldGVvciRzZXR0aW5ncyRwYWNrIiwiX01ldGVvciRzZXR0aW5ncyRwYWNrMiIsIl9NZXRlb3Ikc2V0dGluZ3MyIiwiX01ldGVvciRzZXR0aW5nczIkcGFjIiwiX01ldGVvciRzZXR0aW5nczIkcGFjMiIsIl9vcGxvZ1VybCIsIl9kYk5hbWUiLCJfb3Bsb2dMYXN0RW50cnlDb25uZWN0aW9uIiwiX29wbG9nVGFpbENvbm5lY3Rpb24iLCJfb3Bsb2dPcHRpb25zIiwiX2luY2x1ZGVOU1JlZ2V4IiwiX2V4Y2x1ZGVOU1JlZ2V4IiwiX3N0b3BwZWQiLCJfdGFpbEhhbmRsZSIsIl9yZWFkeVByb21pc2VSZXNvbHZlciIsIl9yZWFkeVByb21pc2UiLCJfY3Jvc3NiYXIiLCJfY2F0Y2hpbmdVcFJlc29sdmVycyIsIl9sYXN0UHJvY2Vzc2VkVFMiLCJfb25Ta2lwcGVkRW50cmllc0hvb2siLCJfc3RhcnRUcmFpbGluZ1Byb21pc2UiLCJfcmVzb2x2ZVRpbWVvdXQiLCJfZW50cnlRdWV1ZSIsIl9Eb3VibGVFbmRlZFF1ZXVlIiwiX3dvcmtlckFjdGl2ZSIsIl93b3JrZXJQcm9taXNlIiwiUHJvbWlzZSIsInIiLCJfQ3Jvc3NiYXIiLCJmYWN0UGFja2FnZSIsImZhY3ROYW1lIiwiaW5jbHVkZUNvbGxlY3Rpb25zIiwic2V0dGluZ3MiLCJwYWNrYWdlcyIsIm1vbmdvIiwib3Bsb2dJbmNsdWRlQ29sbGVjdGlvbnMiLCJleGNsdWRlQ29sbGVjdGlvbnMiLCJvcGxvZ0V4Y2x1ZGVDb2xsZWN0aW9ucyIsImxlbmd0aCIsIkVycm9yIiwiaW5jQWx0IiwibWFwIiwiYyIsIl9lc2NhcGVSZWdFeHAiLCJqb2luIiwiUmVnRXhwIiwiY29uY2F0IiwiZXhjQWx0IiwiSG9vayIsImRlYnVnUHJpbnRFeGNlcHRpb25zIiwiX3N0YXJ0VGFpbGluZyIsIl9uc0FsbG93ZWQiLCJucyIsInRlc3QiLCJfZ2V0T3Bsb2dTZWxlY3RvciIsImxhc3RQcm9jZXNzZWRUUyIsIl90aGlzJF9vcGxvZ09wdGlvbnMkZSIsIl90aGlzJF9vcGxvZ09wdGlvbnMkaSIsIm9wbG9nQ3JpdGVyaWEiLCIkb3IiLCJvcCIsIiRpbiIsIiRleGlzdHMiLCJuc1JlZ2V4IiwiZXhjbHVkZU5zIiwiJHJlZ2V4IiwiJG5pbiIsImNvbGxOYW1lIiwiJGVsZW1NYXRjaCIsImluY2x1ZGVOcyIsInRzIiwiJGd0IiwiJGFuZCIsIl9vbk9wbG9nRW50cnkiLCJjYWxsYmFjayIsIm9yaWdpbmFsQ2FsbGJhY2siLCJiaW5kRW52aXJvbm1lbnQiLCJub3RpZmljYXRpb24iLCJlcnIiLCJfZGVidWciLCJsaXN0ZW5IYW5kbGUiLCJvbk9wbG9nRW50cnkiLCJvblNraXBwZWRFbnRyaWVzIiwicmVnaXN0ZXIiLCJfd2FpdFVudGlsQ2F1Z2h0VXAiLCJsYXN0RW50cnkiLCJvcGxvZ1NlbGVjdG9yIiwiZmluZE9uZUFzeW5jIiwicHJvamVjdGlvbiIsInNvcnQiLCIkbmF0dXJhbCIsImUiLCJzbGVlcCIsIkpTT04iLCJzdHJpbmdpZnkiLCJsZXNzVGhhbk9yRXF1YWwiLCJpbnNlcnRBZnRlciIsImdyZWF0ZXJUaGFuIiwicHJvbWlzZVJlc29sdmVyIiwicHJvbWlzZVRvQXdhaXQiLCJjbGVhclRpbWVvdXQiLCJzZXRUaW1lb3V0IiwiY29uc29sZSIsImVycm9yIiwic3BsaWNlIiwicmVzb2x2ZXIiLCJ3YWl0VW50aWxDYXVnaHRVcCIsIm1vbmdvZGJVcmkiLCJyZXF1aXJlIiwicGFyc2UiLCJkYXRhYmFzZSIsIm1heFBvb2xTaXplIiwibWluUG9vbFNpemUiLCJpc01hc3RlckRvYyIsImRiIiwiYWRtaW4iLCJjb21tYW5kIiwiaXNtYXN0ZXIiLCJzZXROYW1lIiwibGFzdE9wbG9nRW50cnkiLCJ0YWlsYWJsZSIsInRhaWwiLCJkb2MiLCJfbWF5YmVTdGFydFdvcmtlciIsInBvcCIsImNsZWFyIiwiZWFjaCIsIl9zZXRMYXN0UHJvY2Vzc2VkVFMiLCJzaGlmdCIsImhhbmRsZURvYyIsInNlcXVlbmNlciIsIl9kZWZpbmVUb29GYXJCZWhpbmQiLCJ2YWx1ZSIsIl9yZXNldFRvb0ZhckJlaGluZCIsIm8iLCJfaWQiLCJvMiIsImhhbmRsZSIsImFwcGx5T3BzIiwibmV4dFRpbWVzdGFtcCIsImFkZCIsIk9ORSIsInN0YXJ0c1dpdGgiLCJzbGljZSIsImRyb3AiLCJmaXJlIiwicmVzb2x2ZSIsInNldEltbWVkaWF0ZSIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllcyIsIl9leGNsdWRlZCIsIk9ic2VydmVNdWx0aXBsZXhlciIsIl9yZWYiLCJfdGhpcyIsIm9yZGVyZWQiLCJvblN0b3AiLCJfb3JkZXJlZCIsIl9vblN0b3AiLCJfcXVldWUiLCJfaGFuZGxlcyIsIl9yZXNvbHZlciIsIl9pc1JlYWR5IiwiX2NhY2hlIiwiX2FkZEhhbmRsZVRhc2tzU2NoZWR1bGVkQnV0Tm90UGVyZm9ybWVkIiwidW5kZWZpbmVkIiwiUGFja2FnZSIsIkZhY3RzIiwiaW5jcmVtZW50U2VydmVyRmFjdCIsIl9Bc3luY2hyb25vdXNRdWV1ZSIsInRoZW4iLCJfQ2FjaGluZ0NoYW5nZU9ic2VydmVyIiwiY2FsbGJhY2tOYW1lcyIsImNhbGxiYWNrTmFtZSIsIl9sZW4iLCJhcmd1bWVudHMiLCJhcmdzIiwiQXJyYXkiLCJfa2V5IiwiX2FwcGx5Q2FsbGJhY2siLCJhZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMiLCJfYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIiwicnVuVGFzayIsIl9zZW5kQWRkcyIsInJlbW92ZUhhbmRsZSIsIl9yZWFkeSIsIl9zdG9wIiwib3B0aW9ucyIsImZyb21RdWVyeUVycm9yIiwicmVhZHkiLCJxdWV1ZVRhc2siLCJxdWVyeUVycm9yIiwib25GbHVzaCIsImNiIiwiYXBwbHlDaGFuZ2UiLCJhcHBseSIsImhhbmRsZUlkIiwia2V5cyIsInJlc3VsdCIsIm5vbk11dGF0aW5nQ2FsbGJhY2tzIiwiRUpTT04iLCJfaXNQcm9taXNlIiwiY2F0Y2giLCJpbml0aWFsQWRkc1NlbnQiLCJfYWRkZWRCZWZvcmUiLCJfYWRkZWQiLCJhZGRQcm9taXNlcyIsImRvY3MiLCJfcmVmMiIsImZpZWxkcyIsInByb21pc2UiLCJyZWplY3QiLCJhbGxTZXR0bGVkIiwicCIsInN0YXR1cyIsInJlYXNvbiIsImluaXRpYWxBZGRzU2VudFJlc29sdmVyIiwiRG9jRmV0Y2hlciIsIm1vbmdvQ29ubmVjdGlvbiIsIl9tb25nb0Nvbm5lY3Rpb24iLCJfY2FsbGJhY2tzRm9yT3AiLCJNYXAiLCJmZXRjaCIsImNoZWNrIiwiU3RyaW5nIiwiaGFzIiwiY2FsbGJhY2tzIiwic2V0IiwiZGVsZXRlIiwiUG9sbGluZ09ic2VydmVEcml2ZXIiLCJ0aHJvdHRsZSIsIlBPTExJTkdfVEhST1RUTEVfTVMiLCJNRVRFT1JfUE9MTElOR19USFJPVFRMRV9NUyIsIlBPTExJTkdfSU5URVJWQUxfTVMiLCJNRVRFT1JfUE9MTElOR19JTlRFUlZBTF9NUyIsIl9vcHRpb25zIiwiX2N1cnNvckRlc2NyaXB0aW9uIiwiX21vbmdvSGFuZGxlIiwiX211bHRpcGxleGVyIiwiX3N0b3BDYWxsYmFja3MiLCJfY3Vyc29yIiwiX3Jlc3VsdHMiLCJfcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkIiwiX3BlbmRpbmdXcml0ZXMiLCJfZW5zdXJlUG9sbElzU2NoZWR1bGVkIiwiX3Rhc2tRdWV1ZSIsIl90ZXN0T25seVBvbGxDYWxsYmFjayIsIm1vbmdvSGFuZGxlIiwibXVsdGlwbGV4ZXIiLCJfY3JlYXRlQXN5bmNocm9ub3VzQ3Vyc29yIiwiX3VudGhyb3R0bGVkRW5zdXJlUG9sbElzU2NoZWR1bGVkIiwiYmluZCIsInBvbGxpbmdUaHJvdHRsZU1zIiwiX2luaXQiLCJfUGFja2FnZSRmYWN0c0Jhc2UiLCJsaXN0ZW5lcnNIYW5kbGUiLCJmZW5jZSIsIl9nZXRDdXJyZW50RmVuY2UiLCJiZWdpbldyaXRlIiwicG9sbGluZ0ludGVydmFsIiwicG9sbGluZ0ludGVydmFsTXMiLCJfcG9sbGluZ0ludGVydmFsIiwiaW50ZXJ2YWxIYW5kbGUiLCJzZXRJbnRlcnZhbCIsImNsZWFySW50ZXJ2YWwiLCJfcG9sbE1vbmdvIiwiX3N1c3BlbmRQb2xsaW5nIiwiX3Jlc3VtZVBvbGxpbmciLCJfdGhpcyRfdGVzdE9ubHlQb2xsQ2EiLCJmaXJzdCIsIm5ld1Jlc3VsdHMiLCJvbGRSZXN1bHRzIiwiX0lkTWFwIiwiY2FsbCIsIndyaXRlc0ZvckN5Y2xlIiwiZ2V0UmF3T2JqZWN0cyIsImNvZGUiLCJtZXNzYWdlIiwiX2RpZmZRdWVyeUNoYW5nZXMiLCJ3IiwiY29tbWl0dGVkIiwiX1BhY2thZ2UkZmFjdHNCYXNlMiIsIl9hc3luY0l0ZXJhdG9yIiwib3Bsb2dWMlYxQ29udmVydGVyIiwiTWF0Y2giLCJDdXJzb3IiLCJQSEFTRSIsIlFVRVJZSU5HIiwiRkVUQ0hJTkciLCJTVEVBRFkiLCJTd2l0Y2hlZFRvUXVlcnkiLCJmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeSIsImYiLCJjdXJyZW50SWQiLCJfdXNlc09wbG9nIiwic29ydGVyIiwiY29tcGFyYXRvciIsImdldENvbXBhcmF0b3IiLCJsaW1pdCIsImhlYXBPcHRpb25zIiwiSWRNYXAiLCJfbGltaXQiLCJfY29tcGFyYXRvciIsIl9zb3J0ZXIiLCJfdW5wdWJsaXNoZWRCdWZmZXIiLCJNaW5NYXhIZWFwIiwiX3B1Ymxpc2hlZCIsIk1heEhlYXAiLCJfc2FmZUFwcGVuZFRvQnVmZmVyIiwiX3N0b3BIYW5kbGVzIiwiX2FkZFN0b3BIYW5kbGVzIiwibmV3U3RvcEhhbmRsZXMiLCJleHBlY3RlZFBhdHRlcm4iLCJPYmplY3RJbmNsdWRpbmciLCJGdW5jdGlvbiIsIk9uZU9mIiwiX3JlZ2lzdGVyUGhhc2VDaGFuZ2UiLCJfbWF0Y2hlciIsIm1hdGNoZXIiLCJfcHJvamVjdGlvbkZuIiwiX2NvbXBpbGVQcm9qZWN0aW9uIiwiX3NoYXJlZFByb2plY3Rpb24iLCJjb21iaW5lSW50b1Byb2plY3Rpb24iLCJfc2hhcmVkUHJvamVjdGlvbkZuIiwiX25lZWRUb0ZldGNoIiwiX2N1cnJlbnRseUZldGNoaW5nIiwiX2ZldGNoR2VuZXJhdGlvbiIsIl9yZXF1ZXJ5V2hlbkRvbmVUaGlzUXVlcnkiLCJfd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSIsIl9vcGxvZ0hhbmRsZSIsIl9uZWVkVG9Qb2xsUXVlcnkiLCJfcGhhc2UiLCJfaGFuZGxlT3Bsb2dFbnRyeVF1ZXJ5aW5nIiwiX2hhbmRsZU9wbG9nRW50cnlTdGVhZHlPckZldGNoaW5nIiwiZmlyZWQiLCJfb3Bsb2dPYnNlcnZlRHJpdmVycyIsIm9uQmVmb3JlRmlyZSIsImRyaXZlcnMiLCJkcml2ZXIiLCJ2YWx1ZXMiLCJ3cml0ZSIsIl9vbkZhaWxvdmVyIiwiX3J1bkluaXRpYWxRdWVyeSIsIl9hZGRQdWJsaXNoZWQiLCJfbm9ZaWVsZHNBbGxvd2VkIiwiYWRkZWQiLCJzaXplIiwib3ZlcmZsb3dpbmdEb2NJZCIsIm1heEVsZW1lbnRJZCIsIm92ZXJmbG93aW5nRG9jIiwiZXF1YWxzIiwicmVtb3ZlIiwicmVtb3ZlZCIsIl9hZGRCdWZmZXJlZCIsIl9yZW1vdmVQdWJsaXNoZWQiLCJlbXB0eSIsIm5ld0RvY0lkIiwibWluRWxlbWVudElkIiwibmV3RG9jIiwiX3JlbW92ZUJ1ZmZlcmVkIiwiX2NoYW5nZVB1Ymxpc2hlZCIsIm9sZERvYyIsInByb2plY3RlZE5ldyIsInByb2plY3RlZE9sZCIsImNoYW5nZWQiLCJEaWZmU2VxdWVuY2UiLCJtYWtlQ2hhbmdlZEZpZWxkcyIsIm1heEJ1ZmZlcmVkSWQiLCJfYWRkTWF0Y2hpbmciLCJtYXhQdWJsaXNoZWQiLCJtYXhCdWZmZXJlZCIsInRvUHVibGlzaCIsImNhbkFwcGVuZFRvQnVmZmVyIiwiY2FuSW5zZXJ0SW50b0J1ZmZlciIsInRvQnVmZmVyIiwiX3JlbW92ZU1hdGNoaW5nIiwiX2hhbmRsZURvYyIsIm1hdGNoZXNOb3ciLCJkb2N1bWVudE1hdGNoZXMiLCJwdWJsaXNoZWRCZWZvcmUiLCJidWZmZXJlZEJlZm9yZSIsImNhY2hlZEJlZm9yZSIsIm1pbkJ1ZmZlcmVkIiwic3RheXNJblB1Ymxpc2hlZCIsInN0YXlzSW5CdWZmZXIiLCJfZmV0Y2hNb2RpZmllZERvY3VtZW50cyIsImRlZmVyIiwidGhpc0dlbmVyYXRpb24iLCJmZXRjaFByb21pc2VzIiwiZmV0Y2hQcm9taXNlIiwiX2RvY0ZldGNoZXIiLCJyZXN1bHRzIiwiZXJyb3JzIiwiZmlsdGVyIiwiX2JlU3RlYWR5Iiwid3JpdGVzIiwiaXNSZXBsYWNlIiwiY2FuRGlyZWN0bHlNb2RpZnlEb2MiLCJtb2RpZmllckNhbkJlRGlyZWN0bHlBcHBsaWVkIiwiX21vZGlmeSIsIm5hbWUiLCJjYW5CZWNvbWVUcnVlQnlNb2RpZmllciIsImFmZmVjdGVkQnlNb2RpZmllciIsIl9ydW5Jbml0aWFsUXVlcnlBc3luYyIsIl9ydW5RdWVyeSIsImluaXRpYWwiLCJfZG9uZVF1ZXJ5aW5nIiwiX3BvbGxRdWVyeSIsIl9ydW5RdWVyeUFzeW5jIiwibmV3QnVmZmVyIiwiY3Vyc29yIiwiX2N1cnNvckZvclF1ZXJ5IiwiaSIsIl9zbGVlcEZvck1zIiwiX3B1Ymxpc2hOZXdSZXN1bHRzIiwib3B0aW9uc092ZXJ3cml0ZSIsInRyYW5zZm9ybSIsImRlc2NyaXB0aW9uIiwiaWRzVG9SZW1vdmUiLCJfb3Bsb2dFbnRyeUhhbmRsZSIsIl9saXN0ZW5lcnNIYW5kbGUiLCJfaXRlcmF0b3JBYnJ1cHRDb21wbGV0aW9uIiwiX2RpZEl0ZXJhdG9yRXJyb3IiLCJfaXRlcmF0b3JFcnJvciIsIl9pdGVyYXRvciIsIl9zdGVwIiwibmV4dCIsImRvbmUiLCJyZXR1cm4iLCJwaGFzZSIsIm5vdyIsIkRhdGUiLCJ0aW1lRGlmZiIsIl9waGFzZVN0YXJ0VGltZSIsImN1cnNvclN1cHBvcnRlZCIsImRpc2FibGVPcGxvZyIsIl9kaXNhYmxlT3Bsb2ciLCJza2lwIiwiX2NoZWNrU3VwcG9ydGVkUHJvamVjdGlvbiIsImhhc1doZXJlIiwiaGFzR2VvUXVlcnkiLCJtb2RpZmllciIsImVudHJpZXMiLCJldmVyeSIsIm9wZXJhdGlvbiIsImZpZWxkIiwiYXJyYXlPcGVyYXRvcktleVJlZ2V4IiwiaXNBcnJheU9wZXJhdG9yS2V5IiwiaXNBcnJheU9wZXJhdG9yIiwib3BlcmF0b3IiLCJhIiwicHJlZml4IiwiZmxhdHRlbk9iamVjdEludG8iLCJzb3VyY2UiLCJpc0FycmF5IiwiTW9uZ28iLCJPYmplY3RJRCIsIl9pc0N1c3RvbVR5cGUiLCJjb252ZXJ0T3Bsb2dEaWZmIiwib3Bsb2dFbnRyeSIsImRpZmYiLCJkaWZmS2V5IiwiX29wbG9nRW50cnkkJHVuc2V0IiwiJHVuc2V0IiwiX29wbG9nRW50cnkkJHNldCIsIiRzZXQiLCJfb3Bsb2dFbnRyeSQkc2V0MiIsIl9yZWYzIiwiZmllbGRWYWx1ZSIsIl9yZWY0IiwicG9zaXRpb24iLCJwb3NpdGlvbktleSIsIl9vcGxvZ0VudHJ5JCR1bnNldDIiLCJfb3Bsb2dFbnRyeSQkc2V0MyIsIiR2IiwiY29udmVydGVkT3Bsb2dFbnRyeSIsIkNvbGxlY3Rpb24iLCJfcmV3cml0ZVNlbGVjdG9yIiwiX29iamVjdFNwcmVhZCIsIkNMSUVOVF9PTkxZX01FVEhPRFMiLCJnZXRBc3luY01ldGhvZE5hbWUiLCJNaW5pTW9uZ29RdWVyeUVycm9yIiwicGF0aCIsIkFzeW5jaHJvbm91c0N1cnNvciIsInJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvIiwicmVwbGFjZVR5cGVzIiwidHJhbnNmb3JtUmVzdWx0IiwiT2JzZXJ2ZUhhbmRsZSIsIkZJTEVfQVNTRVRfU1VGRklYIiwiQVNTRVRTX0ZPTERFUiIsIkFQUF9GT0xERVIiLCJvcGxvZ0NvbGxlY3Rpb25XYXJuaW5ncyIsInVybCIsIl9vYnNlcnZlTXVsdGlwbGV4ZXJzIiwiX29uRmFpbG92ZXJIb29rIiwidXNlck9wdGlvbnMiLCJfY29ubmVjdGlvbk9wdGlvbnMiLCJtb25nb09wdGlvbnMiLCJpZ25vcmVVbmRlZmluZWQiLCJlbmRzV2l0aCIsIm9wdGlvbk5hbWUiLCJyZXBsYWNlIiwiQXNzZXRzIiwiZ2V0U2VydmVyRGlyIiwiZHJpdmVySW5mbyIsInJlbGVhc2UiLCJjbGllbnQiLCJNb25nb0NsaWVudCIsIm9uIiwiZXZlbnQiLCJwcmV2aW91c0Rlc2NyaXB0aW9uIiwidHlwZSIsIm5ld0Rlc2NyaXB0aW9uIiwiZGF0YWJhc2VOYW1lIiwiX2Nsb3NlIiwib3Bsb2dIYW5kbGUiLCJjbG9zZSIsIl9zZXRPcGxvZ0hhbmRsZSIsInJhd0NvbGxlY3Rpb24iLCJjcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMiLCJieXRlU2l6ZSIsIm1heERvY3VtZW50cyIsImNyZWF0ZUNvbGxlY3Rpb24iLCJjYXBwZWQiLCJtYXgiLCJfbWF5YmVCZWdpbldyaXRlIiwiaW5zZXJ0QXN5bmMiLCJjb2xsZWN0aW9uX25hbWUiLCJkb2N1bWVudCIsIl9leHBlY3RlZEJ5VGVzdCIsIl9pc1BsYWluT2JqZWN0IiwicmVmcmVzaCIsImluc2VydE9uZSIsInNhZmUiLCJpbnNlcnRlZElkIiwiX3JlZnJlc2giLCJyZWZyZXNoS2V5IiwicmVtb3ZlQXN5bmMiLCJkZWxldGVNYW55IiwiZGVsZXRlZENvdW50IiwibW9kaWZpZWRDb3VudCIsIm51bWJlckFmZmVjdGVkIiwiZHJvcENvbGxlY3Rpb25Bc3luYyIsImRyb3BEYXRhYmFzZUFzeW5jIiwiX2Ryb3BEYXRhYmFzZSIsInVwZGF0ZUFzeW5jIiwibW9kIiwibW9uZ29PcHRzIiwiYXJyYXlGaWx0ZXJzIiwidXBzZXJ0IiwibXVsdGkiLCJmdWxsUmVzdWx0IiwibW9uZ29TZWxlY3RvciIsIm1vbmdvTW9kIiwiaXNNb2RpZnkiLCJfaXNNb2RpZmljYXRpb25Nb2QiLCJfZm9yYmlkUmVwbGFjZSIsImtub3duSWQiLCJfY3JlYXRlVXBzZXJ0RG9jdW1lbnQiLCJnZW5lcmF0ZWRJZCIsInNpbXVsYXRlVXBzZXJ0V2l0aEluc2VydGVkSWQiLCJfcmV0dXJuT2JqZWN0IiwiaGFzT3duUHJvcGVydHkiLCIkc2V0T25JbnNlcnQiLCJzdHJpbmdzIiwidXBkYXRlTWV0aG9kIiwibWV0ZW9yUmVzdWx0IiwiT2JqZWN0SWQiLCJ0b0hleFN0cmluZyIsIl9pc0Nhbm5vdENoYW5nZUlkRXJyb3IiLCJlcnJtc2ciLCJpbmRleE9mIiwidXBzZXJ0QXN5bmMiLCJmaW5kIiwiY3JlYXRlSW5kZXhBc3luYyIsImluZGV4IiwiY3JlYXRlSW5kZXgiLCJjb3VudERvY3VtZW50cyIsImFyZyIsImVzdGltYXRlZERvY3VtZW50Q291bnQiLCJfbGVuMiIsIl9rZXkyIiwiZW5zdXJlSW5kZXhBc3luYyIsImRyb3BJbmRleEFzeW5jIiwiaW5kZXhOYW1lIiwiZHJvcEluZGV4IiwibSIsIk5VTV9PUFRJTUlTVElDX1RSSUVTIiwibW9uZ29PcHRzRm9yVXBkYXRlIiwibW9uZ29PcHRzRm9ySW5zZXJ0IiwicmVwbGFjZW1lbnRXaXRoSWQiLCJ0cmllcyIsImRvVXBkYXRlIiwibWV0aG9kIiwidXBkYXRlTWFueSIsInNvbWUiLCJyZXBsYWNlT25lIiwidXBzZXJ0ZWRDb3VudCIsInVwc2VydGVkSWQiLCJkb0NvbmRpdGlvbmFsSW5zZXJ0IiwiX29ic2VydmVDaGFuZ2VzVGFpbGFibGUiLCJhZGRlZEJlZm9yZSIsInNlbGZGb3JJdGVyYXRpb24iLCJ1c2VUcmFuc2Zvcm0iLCJjdXJzb3JPcHRpb25zIiwicmVhZFByZWZlcmVuY2UiLCJudW1iZXJPZlJldHJpZXMiLCJkYkN1cnNvciIsImFkZEN1cnNvckZsYWciLCJtYXhUaW1lTXMiLCJtYXhUaW1lTVMiLCJoaW50IiwiZG9jQ2FsbGJhY2siLCJ0aW1lb3V0TVMiLCJzdG9wcGVkIiwibGFzdFRTIiwibG9vcCIsIl9uZXh0T2JqZWN0UHJvbWlzZVdpdGhUaW1lb3V0IiwibmV3U2VsZWN0b3IiLCJfb2JzZXJ2ZUNoYW5nZXMiLCJfc2VsZiRfb3Bsb2dIYW5kbGUiLCJmaWVsZHNPcHRpb25zIiwib2JzZXJ2ZUtleSIsIm9ic2VydmVEcml2ZXIiLCJmaXJzdEhhbmRsZSIsIm9ic2VydmVIYW5kbGUiLCJvcGxvZ09wdGlvbnMiLCJjYW5Vc2VPcGxvZyIsImluY2x1ZGVzIiwid2FybiIsIk1pbmltb25nbyIsIk1hdGNoZXIiLCJpc0NsaWVudCIsIlNvcnRlciIsImRyaXZlckNsYXNzIiwiX29ic2VydmVEcml2ZXIiLCJ3cml0ZUNhbGxiYWNrIiwicmVwbGFjZU1vbmdvQXRvbVdpdGhNZXRlb3IiLCJyZXBsYWNlTmFtZXMiLCJyZWZyZXNoRXJyIiwiZHJpdmVyUmVzdWx0IiwibW9uZ29SZXN1bHQiLCJuIiwibWF0Y2hlZENvdW50IiwiaXNCaW5hcnkiLCJCaW5hcnkiLCJCdWZmZXIiLCJmcm9tIiwiRGVjaW1hbCIsIkRlY2ltYWwxMjgiLCJmcm9tU3RyaW5nIiwidG9TdHJpbmciLCJtYWtlTW9uZ29MZWdhbCIsInRvSlNPTlZhbHVlIiwiYXRvbVRyYW5zZm9ybWVyIiwicmVwbGFjZWRUb3BMZXZlbEF0b20iLCJyZXQiLCJ2YWwiLCJ2YWxSZXBsYWNlZCIsInN1Yl90eXBlIiwiYnVmZmVyIiwiVWludDhBcnJheSIsImZyb21KU09OVmFsdWUiLCJ1bm1ha2VNb25nb0xlZ2FsIiwic3Vic3RyIiwidGhpbmciLCJfY2xvc2luZyIsIl9wZW5kaW5nTmV4dCIsIl9kYkN1cnNvciIsIl9zZWxmRm9ySXRlcmF0aW9uIiwiX3RyYW5zZm9ybSIsIndyYXBUcmFuc2Zvcm0iLCJfdmlzaXRlZElkcyIsIlN5bWJvbCIsImFzeW5jSXRlcmF0b3IiLCJfbmV4dE9iamVjdFByb21pc2UiLCJfcmF3TmV4dE9iamVjdFByb21pc2UiLCJuZXh0T2JqZWN0UHJvbWlzZSIsInRpbWVvdXRQcm9taXNlIiwidGltZW91dElkIiwiZmluYWxseSIsInJhY2UiLCJ0aGlzQXJnIiwiX3Jld2luZCIsImlkeCIsInJld2luZCIsImNvdW50IiwiQVNZTkNfQ1VSU09SX01FVEhPRFMiLCJfbW9uZ28iLCJfc3luY2hyb25vdXNDdXJzb3IiLCJjb3VudEFzeW5jIiwiZ2V0VHJhbnNmb3JtIiwiX3B1Ymxpc2hDdXJzb3IiLCJzdWIiLCJfZ2V0Q29sbGVjdGlvbk5hbWUiLCJvYnNlcnZlIiwiX29ic2VydmVGcm9tT2JzZXJ2ZUNoYW5nZXMiLCJvYnNlcnZlQXN5bmMiLCJvYnNlcnZlQ2hhbmdlcyIsIl9vYnNlcnZlQ2hhbmdlc0NhbGxiYWNrc0FyZU9yZGVyZWQiLCJvYnNlcnZlQ2hhbmdlc0FzeW5jIiwiaXRlcmF0b3IiLCJtZXRob2ROYW1lIiwic2V0dXBBc3luY2hyb25vdXNDdXJzb3IiLCJtZXRob2ROYW1lQXN5bmMiLCJMb2NhbENvbGxlY3Rpb25Ecml2ZXIiLCJub0Nvbm5Db2xsZWN0aW9ucyIsImNyZWF0ZSIsIm9wZW4iLCJjb25uIiwiZW5zdXJlQ29sbGVjdGlvbiIsIl9tb25nb19saXZlZGF0YV9jb2xsZWN0aW9ucyIsImNvbGxlY3Rpb25zIiwiUmVtb3RlQ29sbGVjdGlvbkRyaXZlciIsIm9uY2UiLCJBU1lOQ19DT0xMRUNUSU9OX01FVEhPRFMiLCJtb25nb1VybCIsIlJFTU9URV9DT0xMRUNUSU9OX01FVEhPRFMiLCJtb25nb01ldGhvZCIsImFzeW5jTWV0aG9kTmFtZSIsImRlZmF1bHRSZW1vdGVDb2xsZWN0aW9uRHJpdmVyIiwiY29ubmVjdGlvbk9wdGlvbnMiLCJNT05HT19VUkwiLCJNT05HT19PUExPR19VUkwiLCJzdGFydHVwIiwiY29ubmVjdCIsIkNvbGxlY3Rpb25FeHRlbnNpb25zIiwiX2V4dGVuc2lvbnMiLCJfcHJvdG90eXBlTWV0aG9kcyIsIl9zdGF0aWNNZXRob2RzIiwiYWRkRXh0ZW5zaW9uIiwiZXh0ZW5zaW9uIiwiYWRkUHJvdG90eXBlTWV0aG9kIiwiYWRkU3RhdGljTWV0aG9kIiwicmVtb3ZlRXh0ZW5zaW9uIiwicmVtb3ZlUHJvdG90eXBlTWV0aG9kIiwicmVtb3ZlU3RhdGljTWV0aG9kIiwiY2xlYXJFeHRlbnNpb25zIiwiZ2V0RXh0ZW5zaW9ucyIsImdldFByb3RvdHlwZU1ldGhvZHMiLCJnZXRTdGF0aWNNZXRob2RzIiwiX2FwcGx5RXh0ZW5zaW9ucyIsImluc3RhbmNlIiwiX2FwcGx5U3RhdGljTWV0aG9kcyIsIkNvbGxlY3Rpb25Db25zdHJ1Y3RvciIsIm5vcm1hbGl6ZVByb2plY3Rpb24iLCJBc3luY01ldGhvZHMiLCJTeW5jTWV0aG9kcyIsIkluZGV4TWV0aG9kcyIsIklEX0dFTkVSQVRPUlMiLCJub3JtYWxpemVPcHRpb25zIiwic2V0dXBBdXRvcHVibGlzaCIsInNldHVwQ29ubmVjdGlvbiIsInNldHVwRHJpdmVyIiwic2V0dXBNdXRhdGlvbk1ldGhvZHMiLCJ2YWxpZGF0ZUNvbGxlY3Rpb25OYW1lIiwiUmVwbGljYXRpb25NZXRob2RzIiwiX0lEX0dFTkVSQVRPUlMkb3B0aW9uIiwiX0lEX0dFTkVSQVRPUlMiLCJfbWFrZU5ld0lEIiwiaWRHZW5lcmF0aW9uIiwicmVzb2x2ZXJUeXBlIiwiX2Nvbm5lY3Rpb24iLCJfZHJpdmVyIiwiX2NvbGxlY3Rpb24iLCJfbmFtZSIsIl9zZXR0aW5nVXBSZXBsaWNhdGlvblByb21pc2UiLCJfbWF5YmVTZXRVcFJlcGxpY2F0aW9uIiwiX2NvbGxlY3Rpb25zIiwiX2dldEZpbmRTZWxlY3RvciIsIl9nZXRGaW5kT3B0aW9ucyIsIm5ld09wdGlvbnMiLCJPcHRpb25hbCIsIk51bWJlciIsImZhbGxiYWNrSWQiLCJfc2VsZWN0b3JJc0lkIiwiUmFuZG9tIiwiX2lzUmVtb3RlQ29sbGVjdGlvbiIsInNlcnZlciIsInJhd0RhdGFiYXNlIiwiZ2V0Q29sbGVjdGlvbiIsIk1vbmdvSUQiLCJBbGxvd0RlbnkiLCJDb2xsZWN0aW9uUHJvdG90eXBlIiwiTU9OR08iLCJzcmMiLCJERFAiLCJyYW5kb21TdHJlYW0iLCJpbnNlY3VyZSIsImhleFN0cmluZyIsIlNUUklORyIsImNvbm5lY3Rpb24iLCJhdXRvcHVibGlzaCIsIl9wcmV2ZW50QXV0b3B1Ymxpc2giLCJwdWJsaXNoIiwiaXNfYXV0byIsImRlZmluZU11dGF0aW9uTWV0aG9kcyIsIl9kZWZpbmVNdXRhdGlvbk1ldGhvZHMiLCJ1c2VFeGlzdGluZyIsIl9zdXBwcmVzc1NhbWVOYW1lRXJyb3IiLCJtZXRob2RzIiwibWFuYWdlciIsImNsZWFuZWRPcHRpb25zIiwiZnJvbUVudHJpZXMiLCJfIiwiX2luc2VydEFzeW5jIiwiZ2V0UHJvdG90eXBlT2YiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiZ2VuZXJhdGVJZCIsImVuY2xvc2luZyIsIl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiIsImNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQiLCJfY2FsbE11dGF0b3JNZXRob2RBc3luYyIsInN0dWJQcm9taXNlIiwic2VydmVyUHJvbWlzZSIsIkxvZyIsImRlYnVnIiwicmVDcmVhdGVJbmRleE9uT3B0aW9uTWlzbWF0Y2giLCJpbmZvIiwiX3JlZ2lzdGVyU3RvcmVSZXN1bHQiLCJfcmVnaXN0ZXJTdG9yZVJlc3VsdCQiLCJyZWdpc3RlclN0b3JlQ2xpZW50IiwicmVnaXN0ZXJTdG9yZVNlcnZlciIsIndyYXBwZWRTdG9yZUNvbW1vbiIsInNhdmVPcmlnaW5hbHMiLCJyZXRyaWV2ZU9yaWdpbmFscyIsIl9nZXRDb2xsZWN0aW9uIiwid3JhcHBlZFN0b3JlQ2xpZW50IiwiYmVnaW5VcGRhdGUiLCJiYXRjaFNpemUiLCJyZXNldCIsInBhdXNlT2JzZXJ2ZXJzIiwidXBkYXRlIiwibXNnIiwibW9uZ29JZCIsImlkUGFyc2UiLCJfZG9jcyIsImluc2VydCIsImVuZFVwZGF0ZSIsInJlc3VtZU9ic2VydmVyc0NsaWVudCIsImdldERvYyIsImZpbmRPbmUiLCJ3cmFwcGVkU3RvcmVTZXJ2ZXIiLCJyZXN1bWVPYnNlcnZlcnNTZXJ2ZXIiLCJyZWdpc3RlclN0b3JlUmVzdWx0IiwibG9nV2FybiIsImxvZyIsIm9rIiwiX2luc2VydCIsIndyYXBwZWRDYWxsYmFjayIsIndyYXBDYWxsYmFjayIsIl9jYWxsTXV0YXRvck1ldGhvZCIsIl9sZW4zIiwib3B0aW9uc0FuZENhbGxiYWNrIiwiX2tleTMiLCJwb3BDYWxsYmFja0Zyb21BcmdzIiwiY29udmVydFJlc3VsdCIsInNldENvbm5lY3Rpb25PcHRpb25zIiwib3RoZXJPcHRpb25zIiwibmV4dE9ic2VydmVIYW5kbGVJZCIsIl9jaGFuZ2VkIiwiX21vdmVkQmVmb3JlIiwiX3JlbW92ZWQiLCJiZWZvcmUiLCJ0aW1lb3V0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBQSxPQUFPLENBQUNDLE1BQU0sQ0FBQztNQUFDQyxTQUFTLEVBQUNBLENBQUEsS0FBSUEsU0FBUztNQUFDQyxjQUFjLEVBQUNBLENBQUEsS0FBSUE7SUFBYyxDQUFDLENBQUM7SUFBQyxJQUFJQyxXQUFXO0lBQUNKLE9BQU8sQ0FBQ0ssSUFBSSxDQUFDLGlCQUFpQixFQUFDO01BQUNELFdBQVdBLENBQUNFLENBQUMsRUFBQztRQUFDRixXQUFXLEdBQUNFLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJQyxlQUFlO0lBQUNQLE9BQU8sQ0FBQ0ssSUFBSSxDQUFDLG9CQUFvQixF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LENBQUEsS0FBSztRQUNqQnpDLE9BQU8sRUFBRTtRQUNULElBQUksQ0FBQ3VELGVBQWUsR0FBRy9LLE9BQU8sQ0FBQ3dILE9BQU8sRUFBRTtNQUMxQyxDQUFDO01BRUQsTUFBTTRzQixPQUFPLEdBQUd6dkIsVUFBVSxDQUFDc0YsS0FBSyxFQUFFLEtBQUssQ0FBQztNQUV4QyxJQUFJLENBQUMyQix1QkFBdUIsR0FBRyxNQUFLO1FBQ2xDM0IsS0FBSyxFQUFFO1FBQ1B2RixZQUFZLENBQUMwdkIsT0FBTyxDQUFDO01BQ3ZCLENBQUM7SUFDSCxDQUFDLENBQUM7RUFDSiIsImZpbGUiOiIvcGFja2FnZXMvbW9uZ28uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBPcGxvZ0hhbmRsZSB9IGZyb20gJy4vb3Bsb2dfdGFpbGluZyc7XG5pbXBvcnQgeyBNb25nb0Nvbm5lY3Rpb24gfSBmcm9tICcuL21vbmdvX2Nvbm5lY3Rpb24nO1xuaW1wb3J0IHsgT3Bsb2dPYnNlcnZlRHJpdmVyIH0gZnJvbSAnLi9vcGxvZ19vYnNlcnZlX2RyaXZlcic7XG5pbXBvcnQgeyBNb25nb0RCIH0gZnJvbSAnLi9tb25nb19jb21tb24nO1xuXG5Nb25nb0ludGVybmFscyA9IGdsb2JhbC5Nb25nb0ludGVybmFscyA9IHt9O1xuXG5Nb25nb0ludGVybmFscy5fX3BhY2thZ2VOYW1lID0gJ21vbmdvJztcblxuTW9uZ29JbnRlcm5hbHMuTnBtTW9kdWxlcyA9IHtcbiAgbW9uZ29kYjoge1xuICAgIHZlcnNpb246IE5wbU1vZHVsZU1vbmdvZGJWZXJzaW9uLFxuICAgIG1vZHVsZTogTW9uZ29EQlxuICB9XG59O1xuXG4vLyBPbGRlciB2ZXJzaW9uIG9mIHdoYXQgaXMgbm93IGF2YWlsYWJsZSB2aWFcbi8vIE1vbmdvSW50ZXJuYWxzLk5wbU1vZHVsZXMubW9uZ29kYi5tb2R1bGUuICBJdCB3YXMgbmV2ZXIgZG9jdW1lbnRlZCwgYnV0XG4vLyBwZW9wbGUgZG8gdXNlIGl0LlxuLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjJcbk1vbmdvSW50ZXJuYWxzLk5wbU1vZHVsZSA9IG5ldyBQcm94eShNb25nb0RCLCB7XG4gIGdldCh0YXJnZXQsIHByb3BlcnR5S2V5LCByZWNlaXZlcikge1xuICAgIGlmIChwcm9wZXJ0eUtleSA9PT0gJ09iamVjdElEJykge1xuICAgICAgTWV0ZW9yLmRlcHJlY2F0ZShcbiAgICAgICAgYEFjY2Vzc2luZyAnTW9uZ29JbnRlcm5hbHMuTnBtTW9kdWxlLk9iamVjdElEJyBkaXJlY3RseSBpcyBkZXByZWNhdGVkLiBgICtcbiAgICAgICAgYFVzZSAnTW9uZ29JbnRlcm5hbHMuTnBtTW9kdWxlLk9iamVjdElkJyBpbnN0ZWFkLmBcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBSZWZsZWN0LmdldCh0YXJnZXQsIHByb3BlcnR5S2V5LCByZWNlaXZlcik7XG4gIH0sXG59KTtcblxuTW9uZ29JbnRlcm5hbHMuT3Bsb2dIYW5kbGUgPSBPcGxvZ0hhbmRsZTtcblxuTW9uZ29JbnRlcm5hbHMuQ29ubmVjdGlvbiA9IE1vbmdvQ29ubmVjdGlvbjtcblxuTW9uZ29JbnRlcm5hbHMuT3Bsb2dPYnNlcnZlRHJpdmVyID0gT3Bsb2dPYnNlcnZlRHJpdmVyO1xuXG4vLyBUaGlzIGlzIHVzZWQgdG8gYWRkIG9yIHJlbW92ZSBFSlNPTiBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgZXZlcnl0aGluZyBuZXN0ZWRcbi8vIGluc2lkZSBhbiBFSlNPTiBjdXN0b20gdHlwZS4gSXQgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIG9uIHB1cmUgSlNPTiFcblxuXG4vLyBFbnN1cmUgdGhhdCBFSlNPTi5jbG9uZSBrZWVwcyBhIFRpbWVzdGFtcCBhcyBhIFRpbWVzdGFtcCAoaW5zdGVhZCBvZiBqdXN0XG4vLyBkb2luZyBhIHN0cnVjdHVyYWwgY2xvbmUpLlxuLy8gWFhYIGhvdyBvayBpcyB0aGlzPyB3aGF0IGlmIHRoZXJlIGFyZSBtdWx0aXBsZSBjb3BpZXMgb2YgTW9uZ29EQiBsb2FkZWQ/XG5Nb25nb0RCLlRpbWVzdGFtcC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAoKSB7XG4gIC8vIFRpbWVzdGFtcHMgc2hvdWxkIGJlIGltbXV0YWJsZS5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBMaXN0ZW4gZm9yIHRoZSBpbnZhbGlkYXRpb24gbWVzc2FnZXMgdGhhdCB3aWxsIHRyaWdnZXIgdXMgdG8gcG9sbCB0aGVcbi8vIGRhdGFiYXNlIGZvciBjaGFuZ2VzLiBJZiB0aGlzIHNlbGVjdG9yIHNwZWNpZmllcyBzcGVjaWZpYyBJRHMsIHNwZWNpZnkgdGhlbVxuLy8gaGVyZSwgc28gdGhhdCB1cGRhdGVzIHRvIGRpZmZlcmVudCBzcGVjaWZpYyBJRHMgZG9uJ3QgY2F1c2UgdXMgdG8gcG9sbC5cbi8vIGxpc3RlbkNhbGxiYWNrIGlzIHRoZSBzYW1lIGtpbmQgb2YgKG5vdGlmaWNhdGlvbiwgY29tcGxldGUpIGNhbGxiYWNrIHBhc3NlZFxuLy8gdG8gSW52YWxpZGF0aW9uQ3Jvc3NiYXIubGlzdGVuLlxuXG5leHBvcnQgY29uc3QgbGlzdGVuQWxsID0gYXN5bmMgZnVuY3Rpb24gKGN1cnNvckRlc2NyaXB0aW9uLCBsaXN0ZW5DYWxsYmFjaykge1xuICBjb25zdCBsaXN0ZW5lcnMgPSBbXTtcbiAgYXdhaXQgZm9yRWFjaFRyaWdnZXIoY3Vyc29yRGVzY3JpcHRpb24sIGZ1bmN0aW9uICh0cmlnZ2VyKSB7XG4gICAgbGlzdGVuZXJzLnB1c2goRERQU2VydmVyLl9JbnZhbGlkYXRpb25Dcm9zc2Jhci5saXN0ZW4oXG4gICAgICB0cmlnZ2VyLCBsaXN0ZW5DYWxsYmFjaykpO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICAgIGxpc3RlbmVycy5mb3JFYWNoKGZ1bmN0aW9uIChsaXN0ZW5lcikge1xuICAgICAgICBsaXN0ZW5lci5zdG9wKCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG59O1xuXG5leHBvcnQgY29uc3QgZm9yRWFjaFRyaWdnZXIgPSBhc3luYyBmdW5jdGlvbiAoY3Vyc29yRGVzY3JpcHRpb24sIHRyaWdnZXJDYWxsYmFjaykge1xuICBjb25zdCBrZXkgPSB7Y29sbGVjdGlvbjogY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWV9O1xuICBjb25zdCBzcGVjaWZpY0lkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3IoXG4gICAgY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpO1xuICBpZiAoc3BlY2lmaWNJZHMpIHtcbiAgICBmb3IgKGNvbnN0IGlkIG9mIHNwZWNpZmljSWRzKSB7XG4gICAgICBhd2FpdCB0cmlnZ2VyQ2FsbGJhY2soT2JqZWN0LmFzc2lnbih7aWQ6IGlkfSwga2V5KSk7XG4gICAgfVxuICAgIGF3YWl0IHRyaWdnZXJDYWxsYmFjayhPYmplY3QuYXNzaWduKHtkcm9wQ29sbGVjdGlvbjogdHJ1ZSwgaWQ6IG51bGx9LCBrZXkpKTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCB0cmlnZ2VyQ2FsbGJhY2soa2V5KTtcbiAgfVxuICAvLyBFdmVyeW9uZSBjYXJlcyBhYm91dCB0aGUgZGF0YWJhc2UgYmVpbmcgZHJvcHBlZC5cbiAgYXdhaXQgdHJpZ2dlckNhbGxiYWNrKHsgZHJvcERhdGFiYXNlOiB0cnVlIH0pO1xufTtcblxuXG5cbi8vIFhYWCBXZSBwcm9iYWJseSBuZWVkIHRvIGZpbmQgYSBiZXR0ZXIgd2F5IHRvIGV4cG9zZSB0aGlzLiBSaWdodCBub3dcbi8vIGl0J3Mgb25seSB1c2VkIGJ5IHRlc3RzLCBidXQgaW4gZmFjdCB5b3UgbmVlZCBpdCBpbiBub3JtYWxcbi8vIG9wZXJhdGlvbiB0byBpbnRlcmFjdCB3aXRoIGNhcHBlZCBjb2xsZWN0aW9ucy5cbk1vbmdvSW50ZXJuYWxzLk1vbmdvVGltZXN0YW1wID0gTW9uZ29EQi5UaW1lc3RhbXA7XG4iLCJpbXBvcnQgaXNFbXB0eSBmcm9tICdsb2Rhc2guaXNlbXB0eSc7XG5pbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IEN1cnNvckRlc2NyaXB0aW9uIH0gZnJvbSAnLi9jdXJzb3JfZGVzY3JpcHRpb24nO1xuaW1wb3J0IHsgTW9uZ29Db25uZWN0aW9uIH0gZnJvbSAnLi9tb25nb19jb25uZWN0aW9uJztcblxuaW1wb3J0IHsgTnBtTW9kdWxlTW9uZ29kYiB9IGZyb20gXCJtZXRlb3IvbnBtLW1vbmdvXCI7XG5jb25zdCB7IExvbmcgfSA9IE5wbU1vZHVsZU1vbmdvZGI7XG5cbmV4cG9ydCBjb25zdCBPUExPR19DT0xMRUNUSU9OID0gJ29wbG9nLnJzJztcblxubGV0IFRPT19GQVJfQkVISU5EID0gKyhwcm9jZXNzLmVudi5NRVRFT1JfT1BMT0dfVE9PX0ZBUl9CRUhJTkQgfHwgMjAwMCk7XG5jb25zdCBUQUlMX1RJTUVPVVQgPSArKHByb2Nlc3MuZW52Lk1FVEVPUl9PUExPR19UQUlMX1RJTUVPVVQgfHwgMzAwMDApO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9wbG9nRW50cnkge1xuICBvcDogc3RyaW5nO1xuICBvOiBhbnk7XG4gIG8yPzogYW55O1xuICB0czogYW55O1xuICBuczogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENhdGNoaW5nVXBSZXNvbHZlciB7XG4gIHRzOiBhbnk7XG4gIHJlc29sdmVyOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE9wbG9nVHJpZ2dlciB7XG4gIGRyb3BDb2xsZWN0aW9uOiBib29sZWFuO1xuICBkcm9wRGF0YWJhc2U6IGJvb2xlYW47XG4gIG9wOiBPcGxvZ0VudHJ5O1xuICBjb2xsZWN0aW9uPzogc3RyaW5nO1xuICBpZD86IHN0cmluZyB8IG51bGw7XG59XG5cbmV4cG9ydCBjbGFzcyBPcGxvZ0hhbmRsZSB7XG4gIHByaXZhdGUgX29wbG9nVXJsOiBzdHJpbmc7XG4gIHB1YmxpYyBfZGJOYW1lOiBzdHJpbmc7XG4gIHByaXZhdGUgX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbjogTW9uZ29Db25uZWN0aW9uIHwgbnVsbDtcbiAgcHJpdmF0ZSBfb3Bsb2dUYWlsQ29ubmVjdGlvbjogTW9uZ29Db25uZWN0aW9uIHwgbnVsbDtcbiAgcHJpdmF0ZSBfb3Bsb2dPcHRpb25zOiB7XG4gICAgZXhjbHVkZUNvbGxlY3Rpb25zPzogc3RyaW5nW107XG4gICAgaW5jbHVkZUNvbGxlY3Rpb25zPzogc3RyaW5nW107XG4gIH07XG4gIHByaXZhdGUgX2luY2x1ZGVOU1JlZ2V4PzogUmVnRXhwO1xuICBwcml2YXRlIF9leGNsdWRlTlNSZWdleD86IFJlZ0V4cDtcbiAgcHJpdmF0ZSBfc3RvcHBlZDogYm9vbGVhbjtcbiAgcHJpdmF0ZSBfdGFpbEhhbmRsZTogYW55O1xuICBwcml2YXRlIF9yZWFkeVByb21pc2VSZXNvbHZlcjogKCgpID0+IHZvaWQpIHwgbnVsbDtcbiAgcHJpdmF0ZSBfcmVhZHlQcm9taXNlOiBQcm9taXNlPHZvaWQ+O1xuICBwdWJsaWMgX2Nyb3NzYmFyOiBhbnk7XG4gIHByaXZhdGUgX2NhdGNoaW5nVXBSZXNvbHZlcnM6IENhdGNoaW5nVXBSZXNvbHZlcltdO1xuICBwcml2YXRlIF9sYXN0UHJvY2Vzc2VkVFM6IGFueTtcbiAgcHJpdmF0ZSBfb25Ta2lwcGVkRW50cmllc0hvb2s6IGFueTtcbiAgcHJpdmF0ZSBfc3RhcnRUcmFpbGluZ1Byb21pc2U6IFByb21pc2U8dm9pZD47XG4gIHByaXZhdGUgX3Jlc29sdmVUaW1lb3V0OiBhbnk7XG5cbiAgcHJpdmF0ZSBfZW50cnlRdWV1ZSA9IG5ldyBNZXRlb3IuX0RvdWJsZUVuZGVkUXVldWUoKTtcbiAgcHJpdmF0ZSBfd29ya2VyQWN0aXZlID0gZmFsc2U7XG4gIHByaXZhdGUgX3dvcmtlclByb21pc2U6IFByb21pc2U8dm9pZD4gfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihvcGxvZ1VybDogc3RyaW5nLCBkYk5hbWU6IHN0cmluZykge1xuICAgIHRoaXMuX29wbG9nVXJsID0gb3Bsb2dVcmw7XG4gICAgdGhpcy5fZGJOYW1lID0gZGJOYW1lO1xuXG4gICAgdGhpcy5fcmVzb2x2ZVRpbWVvdXQgPSBudWxsO1xuICAgIHRoaXMuX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbiA9IG51bGw7XG4gICAgdGhpcy5fb3Bsb2dUYWlsQ29ubmVjdGlvbiA9IG51bGw7XG4gICAgdGhpcy5fc3RvcHBlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3RhaWxIYW5kbGUgPSBudWxsO1xuICAgIHRoaXMuX3JlYWR5UHJvbWlzZVJlc29sdmVyID0gbnVsbDtcbiAgICB0aGlzLl9yZWFkeVByb21pc2UgPSBuZXcgUHJvbWlzZShyID0+IHRoaXMuX3JlYWR5UHJvbWlzZVJlc29sdmVyID0gcik7IFxuICAgIHRoaXMuX2Nyb3NzYmFyID0gbmV3IEREUFNlcnZlci5fQ3Jvc3NiYXIoe1xuICAgICAgZmFjdFBhY2thZ2U6IFwibW9uZ28tbGl2ZWRhdGFcIiwgZmFjdE5hbWU6IFwib3Bsb2ctd2F0Y2hlcnNcIlxuICAgIH0pO1xuXG4gICAgY29uc3QgaW5jbHVkZUNvbGxlY3Rpb25zID1cbiAgICAgIE1ldGVvci5zZXR0aW5ncz8ucGFja2FnZXM/Lm1vbmdvPy5vcGxvZ0luY2x1ZGVDb2xsZWN0aW9ucztcbiAgICBjb25zdCBleGNsdWRlQ29sbGVjdGlvbnMgPVxuICAgICAgTWV0ZW9yLnNldHRpbmdzPy5wYWNrYWdlcz8ubW9uZ28/Lm9wbG9nRXhjbHVkZUNvbGxlY3Rpb25zO1xuICAgIGlmIChpbmNsdWRlQ29sbGVjdGlvbnM/Lmxlbmd0aCAmJiBleGNsdWRlQ29sbGVjdGlvbnM/Lmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIkNhbid0IHVzZSBib3RoIG1vbmdvIG9wbG9nIHNldHRpbmdzIG9wbG9nSW5jbHVkZUNvbGxlY3Rpb25zIGFuZCBvcGxvZ0V4Y2x1ZGVDb2xsZWN0aW9ucyBhdCB0aGUgc2FtZSB0aW1lLlwiXG4gICAgICApO1xuICAgIH1cbiAgICB0aGlzLl9vcGxvZ09wdGlvbnMgPSB7IGluY2x1ZGVDb2xsZWN0aW9ucywgZXhjbHVkZUNvbGxlY3Rpb25zIH07XG5cbiAgICBpZiAoaW5jbHVkZUNvbGxlY3Rpb25zPy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGluY0FsdCA9IGluY2x1ZGVDb2xsZWN0aW9ucy5tYXAoKGMpID0+IE1ldGVvci5fZXNjYXBlUmVnRXhwKGMpKS5qb2luKCd8Jyk7XG5cbiAgICAgIHRoaXMuX2luY2x1ZGVOU1JlZ2V4ID0gbmV3IFJlZ0V4cChgXiR7TWV0ZW9yLl9lc2NhcGVSZWdFeHAodGhpcy5fZGJOYW1lKX1cXFxcLig/OiR7aW5jQWx0fSkkYCk7XG4gICAgfVxuXG4gICAgaWYgKGV4Y2x1ZGVDb2xsZWN0aW9ucz8ubGVuZ3RoKSB7XG4gICAgICBjb25zdCBleGNBbHQgPSBleGNsdWRlQ29sbGVjdGlvbnMubWFwKChjKSA9PiBNZXRlb3IuX2VzY2FwZVJlZ0V4cChjKSkuam9pbignfCcpO1xuXG4gICAgICB0aGlzLl9leGNsdWRlTlNSZWdleCA9IG5ldyBSZWdFeHAoYF4ke01ldGVvci5fZXNjYXBlUmVnRXhwKHRoaXMuX2RiTmFtZSl9XFxcXC4oPzoke2V4Y0FsdH0pJGApO1xuICAgIH1cblxuICAgIHRoaXMuX2NhdGNoaW5nVXBSZXNvbHZlcnMgPSBbXTtcbiAgICB0aGlzLl9sYXN0UHJvY2Vzc2VkVFMgPSBudWxsO1xuXG4gICAgdGhpcy5fb25Ta2lwcGVkRW50cmllc0hvb2sgPSBuZXcgSG9vayh7XG4gICAgICBkZWJ1Z1ByaW50RXhjZXB0aW9uczogXCJvblNraXBwZWRFbnRyaWVzIGNhbGxiYWNrXCJcbiAgICB9KTtcblxuICAgIHRoaXMuX3N0YXJ0VHJhaWxpbmdQcm9taXNlID0gdGhpcy5fc3RhcnRUYWlsaW5nKCk7XG4gIH1cblxuICAgIHByaXZhdGUgX25zQWxsb3dlZChuczogc3RyaW5nIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG4gICAgaWYgKCFucykgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChucyA9PT0gJ2FkbWluLiRjbWQnKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAodGhpcy5faW5jbHVkZU5TUmVnZXggJiYgIXRoaXMuX2luY2x1ZGVOU1JlZ2V4LnRlc3QobnMpKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHRoaXMuX2V4Y2x1ZGVOU1JlZ2V4ICYmIHRoaXMuX2V4Y2x1ZGVOU1JlZ2V4LnRlc3QobnMpKSByZXR1cm4gZmFsc2U7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHByaXZhdGUgX2dldE9wbG9nU2VsZWN0b3IobGFzdFByb2Nlc3NlZFRTPzogYW55KTogYW55IHtcbiAgICBjb25zdCBvcGxvZ0NyaXRlcmlhOiBhbnkgPSBbXG4gICAgICB7XG4gICAgICAgICRvcjogW1xuICAgICAgICAgIHsgb3A6IHsgJGluOiBbXCJpXCIsIFwidVwiLCBcImRcIl0gfSB9LFxuICAgICAgICAgIHsgb3A6IFwiY1wiLCBcIm8uZHJvcFwiOiB7ICRleGlzdHM6IHRydWUgfSB9LFxuICAgICAgICAgIHsgb3A6IFwiY1wiLCBcIm8uZHJvcERhdGFiYXNlXCI6IDEgfSxcbiAgICAgICAgICB7IG9wOiBcImNcIiwgXCJvLmFwcGx5T3BzXCI6IHsgJGV4aXN0czogdHJ1ZSB9IH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF07XG5cbiAgICBpZiAodGhpcy5fb3Bsb2dPcHRpb25zLmV4Y2x1ZGVDb2xsZWN0aW9ucz8ubGVuZ3RoKSB7XG4gICAgICBjb25zdCBuc1JlZ2V4ID0gbmV3IFJlZ0V4cChcbiAgICAgICAgJ14oPzonICtcbiAgICAgICAgICBbXG4gICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICBNZXRlb3IuX2VzY2FwZVJlZ0V4cCh0aGlzLl9kYk5hbWUgKyAnLicpLFxuICAgICAgICAgIF0uam9pbignfCcpICtcbiAgICAgICAgICAnKSdcbiAgICAgICk7XG4gICAgICBjb25zdCBleGNsdWRlTnMgPSB7XG4gICAgICAgICRyZWdleDogbnNSZWdleCxcbiAgICAgICAgJG5pbjogdGhpcy5fb3Bsb2dPcHRpb25zLmV4Y2x1ZGVDb2xsZWN0aW9ucy5tYXAoXG4gICAgICAgICAgKGNvbGxOYW1lOiBzdHJpbmcpID0+IGAke3RoaXMuX2RiTmFtZX0uJHtjb2xsTmFtZX1gXG4gICAgICAgICksXG4gICAgICB9O1xuICAgICAgb3Bsb2dDcml0ZXJpYS5wdXNoKHtcbiAgICAgICAgJG9yOiBbXG4gICAgICAgICAgeyBuczogZXhjbHVkZU5zIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbnM6IC9eYWRtaW5cXC5cXCRjbWQvLFxuICAgICAgICAgICAgJ28uYXBwbHlPcHMnOiB7ICRlbGVtTWF0Y2g6IHsgbnM6IGV4Y2x1ZGVOcyB9IH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fb3Bsb2dPcHRpb25zLmluY2x1ZGVDb2xsZWN0aW9ucz8ubGVuZ3RoKSB7XG4gICAgICBjb25zdCBpbmNsdWRlTnMgPSB7XG4gICAgICAgICRpbjogdGhpcy5fb3Bsb2dPcHRpb25zLmluY2x1ZGVDb2xsZWN0aW9ucy5tYXAoXG4gICAgICAgICAgKGNvbGxOYW1lOiBzdHJpbmcpID0+IGAke3RoaXMuX2RiTmFtZX0uJHtjb2xsTmFtZX1gXG4gICAgICAgICksXG4gICAgICB9O1xuICAgICAgb3Bsb2dDcml0ZXJpYS5wdXNoKHtcbiAgICAgICAgJG9yOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgbnM6IGluY2x1ZGVOcyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHsgbnM6IC9eYWRtaW5cXC5cXCRjbWQvLCAnby5hcHBseU9wcy5ucyc6IGluY2x1ZGVOcyB9LFxuICAgICAgICBdLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IG5zUmVnZXggPSBuZXcgUmVnRXhwKFxuICAgICAgICBcIl4oPzpcIiArXG4gICAgICAgICAgW1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgTWV0ZW9yLl9lc2NhcGVSZWdFeHAodGhpcy5fZGJOYW1lICsgXCIuXCIpLFxuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgTWV0ZW9yLl9lc2NhcGVSZWdFeHAoXCJhZG1pbi4kY21kXCIpLFxuICAgICAgICAgIF0uam9pbihcInxcIikgK1xuICAgICAgICAgIFwiKVwiXG4gICAgICApO1xuICAgICAgb3Bsb2dDcml0ZXJpYS5wdXNoKHtcbiAgICAgICAgbnM6IG5zUmVnZXgsXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYobGFzdFByb2Nlc3NlZFRTKSB7XG4gICAgICBvcGxvZ0NyaXRlcmlhLnB1c2goe1xuICAgICAgICB0czogeyAkZ3Q6IGxhc3RQcm9jZXNzZWRUUyB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICRhbmQ6IG9wbG9nQ3JpdGVyaWEsXG4gICAgfTtcbiAgfVxuXG4gIGFzeW5jIHN0b3AoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMuX3N0b3BwZWQpIHJldHVybjtcbiAgICB0aGlzLl9zdG9wcGVkID0gdHJ1ZTtcbiAgICBpZiAodGhpcy5fdGFpbEhhbmRsZSkge1xuICAgICAgYXdhaXQgdGhpcy5fdGFpbEhhbmRsZS5zdG9wKCk7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgX29uT3Bsb2dFbnRyeSh0cmlnZ2VyOiBPcGxvZ1RyaWdnZXIsIGNhbGxiYWNrOiBGdW5jdGlvbik6IFByb21pc2U8eyBzdG9wOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0+IHtcbiAgICBpZiAodGhpcy5fc3RvcHBlZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGVkIG9uT3Bsb2dFbnRyeSBvbiBzdG9wcGVkIGhhbmRsZSFcIik7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5fcmVhZHlQcm9taXNlO1xuXG4gICAgY29uc3Qgb3JpZ2luYWxDYWxsYmFjayA9IGNhbGxiYWNrO1xuXG4gICAgLyoqXG4gICAgICogVGhpcyBkZXBlbmRzIG9uIEFzeW5jaHJvbm91c1F1ZXVlIHRhc2tzIGJlaW5nIHdyYXBwZWQgaW4gYGJpbmRFbnZpcm9ubWVudGAgdG9vLlxuICAgICAqXG4gICAgICogQHRvZG8gQ2hlY2sgYWZ0ZXIgd2Ugc2ltcGxpZnkgdGhlIGBiaW5kRW52aXJvbm1lbnRgIGltcGxlbWVudGF0aW9uIGlmIHdlIGNhbiByZW1vdmUgdGhlIHNlY29uZCB3cmFwLlxuICAgICAqL1xuICAgIGNhbGxiYWNrID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgIGZ1bmN0aW9uIChub3RpZmljYXRpb246IGFueSkge1xuICAgICAgICBvcmlnaW5hbENhbGxiYWNrKG5vdGlmaWNhdGlvbik7XG4gICAgICB9LFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgZnVuY3Rpb24gKGVycikge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKFwiRXJyb3IgaW4gb3Bsb2cgY2FsbGJhY2tcIiwgZXJyKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgY29uc3QgbGlzdGVuSGFuZGxlID0gdGhpcy5fY3Jvc3NiYXIubGlzdGVuKHRyaWdnZXIsIGNhbGxiYWNrKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RvcDogYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBhd2FpdCBsaXN0ZW5IYW5kbGUuc3RvcCgpO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBvbk9wbG9nRW50cnkodHJpZ2dlcjogT3Bsb2dUcmlnZ2VyLCBjYWxsYmFjazogRnVuY3Rpb24pOiBQcm9taXNlPHsgc3RvcDogKCkgPT4gUHJvbWlzZTx2b2lkPiB9PiB7XG4gICAgcmV0dXJuIHRoaXMuX29uT3Bsb2dFbnRyeSh0cmlnZ2VyLCBjYWxsYmFjayk7XG4gIH1cblxuICBvblNraXBwZWRFbnRyaWVzKGNhbGxiYWNrOiBGdW5jdGlvbik6IHsgc3RvcDogKCkgPT4gdm9pZCB9IHtcbiAgICBpZiAodGhpcy5fc3RvcHBlZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FsbGVkIG9uU2tpcHBlZEVudHJpZXMgb24gc3RvcHBlZCBoYW5kbGUhXCIpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5fb25Ta2lwcGVkRW50cmllc0hvb2sucmVnaXN0ZXIoY2FsbGJhY2spO1xuICB9XG5cbiAgYXN5bmMgX3dhaXRVbnRpbENhdWdodFVwKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLl9zdG9wcGVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsZWQgd2FpdFVudGlsQ2F1Z2h0VXAgb24gc3RvcHBlZCBoYW5kbGUhXCIpO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuX3JlYWR5UHJvbWlzZTtcblxuICAgIGxldCBsYXN0RW50cnk6IE9wbG9nRW50cnkgfCBudWxsID0gbnVsbDtcblxuICAgIHdoaWxlICghdGhpcy5fc3RvcHBlZCkge1xuICAgICAgY29uc3Qgb3Bsb2dTZWxlY3RvciA9IHRoaXMuX2dldE9wbG9nU2VsZWN0b3IoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGxhc3RFbnRyeSA9IGF3YWl0IHRoaXMuX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbi5maW5kT25lQXN5bmMoXG4gICAgICAgICAgT1BMT0dfQ09MTEVDVElPTixcbiAgICAgICAgICBvcGxvZ1NlbGVjdG9yLFxuICAgICAgICAgIHsgcHJvamVjdGlvbjogeyB0czogMSB9LCBzb3J0OiB7ICRuYXR1cmFsOiAtMSB9IH1cbiAgICAgICAgKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJHb3QgZXhjZXB0aW9uIHdoaWxlIHJlYWRpbmcgbGFzdCBlbnRyeVwiLCBlKTtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBhd2FpdCBNZXRlb3Iuc2xlZXAoMTAwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5fc3RvcHBlZCkgcmV0dXJuO1xuXG4gICAgaWYgKCFsYXN0RW50cnkpIHJldHVybjtcblxuICAgIGNvbnN0IHRzID0gbGFzdEVudHJ5LnRzO1xuICAgIGlmICghdHMpIHtcbiAgICAgIHRocm93IEVycm9yKFwib3Bsb2cgZW50cnkgd2l0aG91dCB0czogXCIgKyBKU09OLnN0cmluZ2lmeShsYXN0RW50cnkpKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fbGFzdFByb2Nlc3NlZFRTICYmIHRzLmxlc3NUaGFuT3JFcXVhbCh0aGlzLl9sYXN0UHJvY2Vzc2VkVFMpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IGluc2VydEFmdGVyID0gdGhpcy5fY2F0Y2hpbmdVcFJlc29sdmVycy5sZW5ndGg7XG5cbiAgICB3aGlsZSAoaW5zZXJ0QWZ0ZXIgLSAxID4gMCAmJiB0aGlzLl9jYXRjaGluZ1VwUmVzb2x2ZXJzW2luc2VydEFmdGVyIC0gMV0udHMuZ3JlYXRlclRoYW4odHMpKSB7XG4gICAgICBpbnNlcnRBZnRlci0tO1xuICAgIH1cblxuICAgIGxldCBwcm9taXNlUmVzb2x2ZXIgPSBudWxsO1xuXG4gICAgY29uc3QgcHJvbWlzZVRvQXdhaXQgPSBuZXcgUHJvbWlzZShyID0+IHByb21pc2VSZXNvbHZlciA9IHIpO1xuXG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX3Jlc29sdmVUaW1lb3V0KTtcblxuICAgIHRoaXMuX3Jlc29sdmVUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiTWV0ZW9yOiBvcGxvZyBjYXRjaGluZyB1cCB0b29rIHRvbyBsb25nXCIsIHsgdHMgfSk7XG4gICAgfSwgMTAwMDApO1xuXG4gICAgdGhpcy5fY2F0Y2hpbmdVcFJlc29sdmVycy5zcGxpY2UoaW5zZXJ0QWZ0ZXIsIDAsIHsgdHMsIHJlc29sdmVyOiBwcm9taXNlUmVzb2x2ZXIhIH0pO1xuXG4gICAgYXdhaXQgcHJvbWlzZVRvQXdhaXQ7XG5cbiAgICBjbGVhclRpbWVvdXQodGhpcy5fcmVzb2x2ZVRpbWVvdXQpO1xuICB9XG5cbiAgYXN5bmMgd2FpdFVudGlsQ2F1Z2h0VXAoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMuX3dhaXRVbnRpbENhdWdodFVwKCk7XG4gIH1cblxuICBhc3luYyBfc3RhcnRUYWlsaW5nKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG1vbmdvZGJVcmkgPSByZXF1aXJlKCdtb25nb2RiLXVyaScpO1xuICAgIGlmIChtb25nb2RiVXJpLnBhcnNlKHRoaXMuX29wbG9nVXJsKS5kYXRhYmFzZSAhPT0gJ2xvY2FsJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiJE1PTkdPX09QTE9HX1VSTCBtdXN0IGJlIHNldCB0byB0aGUgJ2xvY2FsJyBkYXRhYmFzZSBvZiBhIE1vbmdvIHJlcGxpY2Egc2V0XCIpO1xuICAgIH1cblxuICAgIHRoaXMuX29wbG9nVGFpbENvbm5lY3Rpb24gPSBuZXcgTW9uZ29Db25uZWN0aW9uKFxuICAgICAgdGhpcy5fb3Bsb2dVcmwsIHsgbWF4UG9vbFNpemU6IDEsIG1pblBvb2xTaXplOiAxIH1cbiAgICApO1xuICAgIHRoaXMuX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbiA9IG5ldyBNb25nb0Nvbm5lY3Rpb24oXG4gICAgICB0aGlzLl9vcGxvZ1VybCwgeyBtYXhQb29sU2l6ZTogMSwgbWluUG9vbFNpemU6IDEgfVxuICAgICk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgaXNNYXN0ZXJEb2MgPSBhd2FpdCB0aGlzLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24hLmRiXG4gICAgICAgIC5hZG1pbigpXG4gICAgICAgIC5jb21tYW5kKHsgaXNtYXN0ZXI6IDEgfSk7XG5cbiAgICAgIGlmICghKGlzTWFzdGVyRG9jICYmIGlzTWFzdGVyRG9jLnNldE5hbWUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIiRNT05HT19PUExPR19VUkwgbXVzdCBiZSBzZXQgdG8gdGhlICdsb2NhbCcgZGF0YWJhc2Ugb2YgYSBNb25nbyByZXBsaWNhIHNldFwiKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbGFzdE9wbG9nRW50cnkgPSBhd2FpdCB0aGlzLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24uZmluZE9uZUFzeW5jKFxuICAgICAgICBPUExPR19DT0xMRUNUSU9OLFxuICAgICAgICB7fSxcbiAgICAgICAgeyBzb3J0OiB7ICRuYXR1cmFsOiAtMSB9LCBwcm9qZWN0aW9uOiB7IHRzOiAxIH0gfVxuICAgICAgKTtcblxuICAgICAgY29uc3Qgb3Bsb2dTZWxlY3RvciA9IHRoaXMuX2dldE9wbG9nU2VsZWN0b3IobGFzdE9wbG9nRW50cnk/LnRzKTtcbiAgICAgIGlmIChsYXN0T3Bsb2dFbnRyeSkge1xuICAgICAgICB0aGlzLl9sYXN0UHJvY2Vzc2VkVFMgPSBsYXN0T3Bsb2dFbnRyeS50cztcbiAgICAgIH1cblxuICAgICAgY29uc3QgY3Vyc29yRGVzY3JpcHRpb24gPSBuZXcgQ3Vyc29yRGVzY3JpcHRpb24oXG4gICAgICAgIE9QTE9HX0NPTExFQ1RJT04sXG4gICAgICAgIG9wbG9nU2VsZWN0b3IsXG4gICAgICAgIHsgdGFpbGFibGU6IHRydWUgfVxuICAgICAgKTtcblxuICAgICAgdGhpcy5fdGFpbEhhbmRsZSA9IHRoaXMuX29wbG9nVGFpbENvbm5lY3Rpb24udGFpbChcbiAgICAgICAgY3Vyc29yRGVzY3JpcHRpb24sXG4gICAgICAgIChkb2M6IGFueSkgPT4ge1xuICAgICAgICAgIHRoaXMuX2VudHJ5UXVldWUucHVzaChkb2MpO1xuICAgICAgICAgIHRoaXMuX21heWJlU3RhcnRXb3JrZXIoKTtcbiAgICAgICAgfSxcbiAgICAgICAgVEFJTF9USU1FT1VUXG4gICAgICApO1xuXG4gICAgICB0aGlzLl9yZWFkeVByb21pc2VSZXNvbHZlciEoKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgaW4gX3N0YXJ0VGFpbGluZzonLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9tYXliZVN0YXJ0V29ya2VyKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLl93b3JrZXJQcm9taXNlKSByZXR1cm47XG4gICAgdGhpcy5fd29ya2VyQWN0aXZlID0gdHJ1ZTtcblxuICAgIC8vIENvbnZlcnQgdG8gYSBwcm9wZXIgcHJvbWlzZS1iYXNlZCBxdWV1ZSBwcm9jZXNzb3JcbiAgICB0aGlzLl93b3JrZXJQcm9taXNlID0gKGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHdoaWxlICghdGhpcy5fc3RvcHBlZCAmJiAhdGhpcy5fZW50cnlRdWV1ZS5pc0VtcHR5KCkpIHtcbiAgICAgICAgICAvLyBBcmUgd2UgdG9vIGZhciBiZWhpbmQ/IEp1c3QgdGVsbCBvdXIgb2JzZXJ2ZXJzIHRoYXQgdGhleSBuZWVkIHRvXG4gICAgICAgICAgLy8gcmVwb2xsLCBhbmQgZHJvcCBvdXIgcXVldWUuXG4gICAgICAgICAgaWYgKHRoaXMuX2VudHJ5UXVldWUubGVuZ3RoID4gVE9PX0ZBUl9CRUhJTkQpIHtcbiAgICAgICAgICAgIGNvbnN0IGxhc3RFbnRyeSA9IHRoaXMuX2VudHJ5UXVldWUucG9wKCk7XG4gICAgICAgICAgICB0aGlzLl9lbnRyeVF1ZXVlLmNsZWFyKCk7XG5cbiAgICAgICAgICAgIHRoaXMuX29uU2tpcHBlZEVudHJpZXNIb29rLmVhY2goKGNhbGxiYWNrOiBGdW5jdGlvbikgPT4ge1xuICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBGcmVlIGFueSB3YWl0VW50aWxDYXVnaHRVcCgpIGNhbGxzIHRoYXQgd2VyZSB3YWl0aW5nIGZvciB1cyB0b1xuICAgICAgICAgICAgLy8gcGFzcyBzb21ldGhpbmcgdGhhdCB3ZSBqdXN0IHNraXBwZWQuXG4gICAgICAgICAgICB0aGlzLl9zZXRMYXN0UHJvY2Vzc2VkVFMobGFzdEVudHJ5LnRzKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFByb2Nlc3MgbmV4dCBiYXRjaCBmcm9tIHRoZSBxdWV1ZVxuICAgICAgICAgIGNvbnN0IGRvYyA9IHRoaXMuX2VudHJ5UXVldWUuc2hpZnQoKTtcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBoYW5kbGVEb2ModGhpcywgZG9jKTtcbiAgICAgICAgICAgIC8vIFByb2Nlc3MgYW55IHdhaXRpbmcgZmVuY2UgY2FsbGJhY2tzXG4gICAgICAgICAgICBpZiAoZG9jLnRzKSB7XG4gICAgICAgICAgICAgIHRoaXMuX3NldExhc3RQcm9jZXNzZWRUUyhkb2MudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIEtlZXAgcHJvY2Vzc2luZyBxdWV1ZSBldmVuIGlmIG9uZSBlbnRyeSBmYWlsc1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcHJvY2Vzc2luZyBvcGxvZyBlbnRyeTonLCBlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHRoaXMuX3dvcmtlclByb21pc2UgPSBudWxsO1xuICAgICAgICB0aGlzLl93b3JrZXJBY3RpdmUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KSgpO1xuICB9XG5cbiAgX3NldExhc3RQcm9jZXNzZWRUUyh0czogYW55KTogdm9pZCB7XG4gICAgdGhpcy5fbGFzdFByb2Nlc3NlZFRTID0gdHM7XG4gICAgd2hpbGUgKCFpc0VtcHR5KHRoaXMuX2NhdGNoaW5nVXBSZXNvbHZlcnMpICYmIHRoaXMuX2NhdGNoaW5nVXBSZXNvbHZlcnNbMF0udHMubGVzc1RoYW5PckVxdWFsKHRoaXMuX2xhc3RQcm9jZXNzZWRUUykpIHtcbiAgICAgIGNvbnN0IHNlcXVlbmNlciA9IHRoaXMuX2NhdGNoaW5nVXBSZXNvbHZlcnMuc2hpZnQoKSE7XG4gICAgICBzZXF1ZW5jZXIucmVzb2x2ZXIoKTtcbiAgICB9XG4gIH1cblxuICBfZGVmaW5lVG9vRmFyQmVoaW5kKHZhbHVlOiBudW1iZXIpOiB2b2lkIHtcbiAgICBUT09fRkFSX0JFSElORCA9IHZhbHVlO1xuICB9XG5cbiAgX3Jlc2V0VG9vRmFyQmVoaW5kKCk6IHZvaWQge1xuICAgIFRPT19GQVJfQkVISU5EID0gKyhwcm9jZXNzLmVudi5NRVRFT1JfT1BMT0dfVE9PX0ZBUl9CRUhJTkQgfHwgMjAwMCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlkRm9yT3Aob3A6IE9wbG9nRW50cnkpOiBzdHJpbmcge1xuICBpZiAob3Aub3AgPT09ICdkJyB8fCBvcC5vcCA9PT0gJ2knKSB7XG4gICAgcmV0dXJuIG9wLm8uX2lkO1xuICB9IGVsc2UgaWYgKG9wLm9wID09PSAndScpIHtcbiAgICByZXR1cm4gb3AubzIuX2lkO1xuICB9IGVsc2UgaWYgKG9wLm9wID09PSAnYycpIHtcbiAgICB0aHJvdyBFcnJvcihcIk9wZXJhdG9yICdjJyBkb2Vzbid0IHN1cHBseSBhbiBvYmplY3Qgd2l0aCBpZDogXCIgKyBKU09OLnN0cmluZ2lmeShvcCkpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IEVycm9yKFwiVW5rbm93biBvcDogXCIgKyBKU09OLnN0cmluZ2lmeShvcCkpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGhhbmRsZURvYyhoYW5kbGU6IE9wbG9nSGFuZGxlLCBkb2M6IE9wbG9nRW50cnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKGRvYy5ucyA9PT0gXCJhZG1pbi4kY21kXCIpIHtcbiAgICBpZiAoZG9jLm8uYXBwbHlPcHMpIHtcbiAgICAgIC8vIFRoaXMgd2FzIGEgc3VjY2Vzc2Z1bCB0cmFuc2FjdGlvbiwgc28gd2UgbmVlZCB0byBhcHBseSB0aGVcbiAgICAgIC8vIG9wZXJhdGlvbnMgdGhhdCB3ZXJlIGludm9sdmVkLlxuICAgICAgbGV0IG5leHRUaW1lc3RhbXAgPSBkb2MudHM7XG4gICAgICBmb3IgKGNvbnN0IG9wIG9mIGRvYy5vLmFwcGx5T3BzKSB7XG4gICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvMTA0MjAuXG4gICAgICAgIGlmICghb3AudHMpIHtcbiAgICAgICAgICBvcC50cyA9IG5leHRUaW1lc3RhbXA7XG4gICAgICAgICAgbmV4dFRpbWVzdGFtcCA9IG5leHRUaW1lc3RhbXAuYWRkKExvbmcuT05FKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBPbmx5IGZvcndhcmQgc3ViLW9wcyB3aG9zZSBucyBpcyBhbGxvd2VkXG4gICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvMTM5NDVcbiAgICAgICAgaWYgKCFoYW5kbGVbJ19uc0FsbG93ZWQnXShvcC5ucykpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBoYW5kbGVEb2MoaGFuZGxlLCBvcCk7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gY29tbWFuZCBcIiArIEpTT04uc3RyaW5naWZ5KGRvYykpO1xuICB9XG5cbiAgY29uc3QgdHJpZ2dlcjogT3Bsb2dUcmlnZ2VyID0ge1xuICAgIGRyb3BDb2xsZWN0aW9uOiBmYWxzZSxcbiAgICBkcm9wRGF0YWJhc2U6IGZhbHNlLFxuICAgIG9wOiBkb2MsXG4gIH07XG5cbiAgaWYgKHR5cGVvZiBkb2MubnMgPT09IFwic3RyaW5nXCIgJiYgZG9jLm5zLnN0YXJ0c1dpdGgoaGFuZGxlLl9kYk5hbWUgKyBcIi5cIikpIHtcbiAgICB0cmlnZ2VyLmNvbGxlY3Rpb24gPSBkb2MubnMuc2xpY2UoaGFuZGxlLl9kYk5hbWUubGVuZ3RoICsgMSk7XG4gIH1cblxuICAvLyBJcyBpdCBhIHNwZWNpYWwgY29tbWFuZCBhbmQgdGhlIGNvbGxlY3Rpb24gbmFtZSBpcyBoaWRkZW5cbiAgLy8gc29tZXdoZXJlIGluIG9wZXJhdG9yP1xuICBpZiAodHJpZ2dlci5jb2xsZWN0aW9uID09PSBcIiRjbWRcIikge1xuICAgIGlmIChkb2Muby5kcm9wRGF0YWJhc2UpIHtcbiAgICAgIGRlbGV0ZSB0cmlnZ2VyLmNvbGxlY3Rpb247XG4gICAgICB0cmlnZ2VyLmRyb3BEYXRhYmFzZSA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChcImRyb3BcIiBpbiBkb2Mubykge1xuICAgICAgdHJpZ2dlci5jb2xsZWN0aW9uID0gZG9jLm8uZHJvcDtcbiAgICAgIHRyaWdnZXIuZHJvcENvbGxlY3Rpb24gPSB0cnVlO1xuICAgICAgdHJpZ2dlci5pZCA9IG51bGw7XG4gICAgfSBlbHNlIGlmIChcImNyZWF0ZVwiIGluIGRvYy5vICYmIFwiaWRJbmRleFwiIGluIGRvYy5vKSB7XG4gICAgICAvLyBBIGNvbGxlY3Rpb24gZ290IGltcGxpY2l0bHkgY3JlYXRlZCB3aXRoaW4gYSB0cmFuc2FjdGlvbi4gVGhlcmUnc1xuICAgICAgLy8gbm8gbmVlZCB0byBkbyBhbnl0aGluZyBhYm91dCBpdC5cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgRXJyb3IoXCJVbmtub3duIGNvbW1hbmQgXCIgKyBKU09OLnN0cmluZ2lmeShkb2MpKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gQWxsIG90aGVyIG9wcyBoYXZlIGFuIGlkLlxuICAgIHRyaWdnZXIuaWQgPSBpZEZvck9wKGRvYyk7XG4gIH1cblxuICBhd2FpdCBoYW5kbGUuX2Nyb3NzYmFyLmZpcmUodHJpZ2dlcik7XG5cbiAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRJbW1lZGlhdGUocmVzb2x2ZSkpO1xufSIsImltcG9ydCBpc0VtcHR5IGZyb20gXCJsb2Rhc2guaXNlbXB0eVwiO1xuaW1wb3J0IHsgT2JzZXJ2ZUhhbmRsZSB9IGZyb20gXCIuL29ic2VydmVfaGFuZGxlXCI7XG5cbmludGVyZmFjZSBPYnNlcnZlTXVsdGlwbGV4ZXJPcHRpb25zIHtcbiAgb3JkZXJlZDogYm9vbGVhbjtcbiAgb25TdG9wPzogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IHR5cGUgT2JzZXJ2ZUhhbmRsZUNhbGxiYWNrID1cbiAgfCBcImFkZGVkXCJcbiAgfCBcImFkZGVkQmVmb3JlXCJcbiAgfCBcImNoYW5nZWRcIlxuICB8IFwibW92ZWRCZWZvcmVcIlxuICB8IFwicmVtb3ZlZFwiO1xuXG4vKipcbiAqIEFsbG93cyBtdWx0aXBsZSBpZGVudGljYWwgT2JzZXJ2ZUhhbmRsZXMgdG8gYmUgZHJpdmVuIGJ5IGEgc2luZ2xlIG9ic2VydmUgZHJpdmVyLlxuICpcbiAqIFRoaXMgb3B0aW1pemF0aW9uIGVuc3VyZXMgdGhhdCBtdWx0aXBsZSBpZGVudGljYWwgb2JzZXJ2YXRpb25zXG4gKiBkb24ndCByZXN1bHQgaW4gZHVwbGljYXRlIGRhdGFiYXNlIHF1ZXJpZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBPYnNlcnZlTXVsdGlwbGV4ZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IF9vcmRlcmVkOiBib29sZWFuO1xuICBwcml2YXRlIHJlYWRvbmx5IF9vblN0b3A6ICgpID0+IHZvaWQ7XG4gIHByaXZhdGUgX3F1ZXVlOiBhbnk7XG4gIHByaXZhdGUgX2hhbmRsZXM6IHsgW2tleTogc3RyaW5nXTogT2JzZXJ2ZUhhbmRsZSB9IHwgbnVsbDtcbiAgcHJpdmF0ZSBfcmVzb2x2ZXI6ICgodmFsdWU/OiB1bmtub3duKSA9PiB2b2lkKSB8IG51bGw7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3JlYWR5UHJvbWlzZTogUHJvbWlzZTxib29sZWFuIHwgdm9pZD47XG4gIHByaXZhdGUgX2lzUmVhZHk6IGJvb2xlYW47XG4gIHByaXZhdGUgX2NhY2hlOiBhbnk7XG4gIHByaXZhdGUgX2FkZEhhbmRsZVRhc2tzU2NoZWR1bGVkQnV0Tm90UGVyZm9ybWVkOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IoeyBvcmRlcmVkLCBvblN0b3AgPSAoKSA9PiB7fSB9OiBPYnNlcnZlTXVsdGlwbGV4ZXJPcHRpb25zKSB7XG4gICAgaWYgKG9yZGVyZWQgPT09IHVuZGVmaW5lZCkgdGhyb3cgRXJyb3IoXCJtdXN0IHNwZWNpZnkgb3JkZXJlZFwiKTtcblxuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBQYWNrYWdlW1wiZmFjdHMtYmFzZVwiXSAmJlxuICAgICAgUGFja2FnZVtcImZhY3RzLWJhc2VcIl0uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgXCJtb25nby1saXZlZGF0YVwiLFxuICAgICAgICBcIm9ic2VydmUtbXVsdGlwbGV4ZXJzXCIsXG4gICAgICAgIDFcbiAgICAgICk7XG5cbiAgICB0aGlzLl9vcmRlcmVkID0gb3JkZXJlZDtcbiAgICB0aGlzLl9vblN0b3AgPSBvblN0b3A7XG4gICAgdGhpcy5fcXVldWUgPSBuZXcgTWV0ZW9yLl9Bc3luY2hyb25vdXNRdWV1ZSgpO1xuICAgIHRoaXMuX2hhbmRsZXMgPSB7fTtcbiAgICB0aGlzLl9yZXNvbHZlciA9IG51bGw7XG4gICAgdGhpcy5faXNSZWFkeSA9IGZhbHNlO1xuICAgIHRoaXMuX3JlYWR5UHJvbWlzZSA9IG5ldyBQcm9taXNlKChyKSA9PiAodGhpcy5fcmVzb2x2ZXIgPSByKSkudGhlbihcbiAgICAgICgpID0+ICh0aGlzLl9pc1JlYWR5ID0gdHJ1ZSlcbiAgICApO1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICB0aGlzLl9jYWNoZSA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0NhY2hpbmdDaGFuZ2VPYnNlcnZlcih7IG9yZGVyZWQgfSk7XG4gICAgdGhpcy5fYWRkSGFuZGxlVGFza3NTY2hlZHVsZWRCdXROb3RQZXJmb3JtZWQgPSAwO1xuXG4gICAgdGhpcy5jYWxsYmFja05hbWVzKCkuZm9yRWFjaCgoY2FsbGJhY2tOYW1lKSA9PiB7XG4gICAgICAodGhpcyBhcyBhbnkpW2NhbGxiYWNrTmFtZV0gPSAoLi4uYXJnczogYW55W10pID0+IHtcbiAgICAgICAgdGhpcy5fYXBwbHlDYWxsYmFjayhjYWxsYmFja05hbWUsIGFyZ3MpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGFkZEhhbmRsZUFuZFNlbmRJbml0aWFsQWRkcyhoYW5kbGU6IE9ic2VydmVIYW5kbGUpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5fYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzKGhhbmRsZSk7XG4gIH1cblxuICBhc3luYyBfYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzKGhhbmRsZTogT2JzZXJ2ZUhhbmRsZSk6IFByb21pc2U8dm9pZD4ge1xuICAgICsrdGhpcy5fYWRkSGFuZGxlVGFza3NTY2hlZHVsZWRCdXROb3RQZXJmb3JtZWQ7XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgUGFja2FnZVtcImZhY3RzLWJhc2VcIl0gJiZcbiAgICAgIFBhY2thZ2VbXCJmYWN0cy1iYXNlXCJdLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIixcbiAgICAgICAgXCJvYnNlcnZlLWhhbmRsZXNcIixcbiAgICAgICAgMVxuICAgICAgKTtcblxuICAgIGF3YWl0IHRoaXMuX3F1ZXVlLnJ1blRhc2soYXN5bmMgKCkgPT4ge1xuICAgICAgdGhpcy5faGFuZGxlcyFbaGFuZGxlLl9pZF0gPSBoYW5kbGU7XG4gICAgICBhd2FpdCB0aGlzLl9zZW5kQWRkcyhoYW5kbGUpO1xuICAgICAgLS10aGlzLl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZDtcbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuX3JlYWR5UHJvbWlzZTtcbiAgfVxuXG4gIGFzeW5jIHJlbW92ZUhhbmRsZShpZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCF0aGlzLl9yZWFkeSgpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgcmVtb3ZlIGhhbmRsZXMgdW50aWwgdGhlIG11bHRpcGxleCBpcyByZWFkeVwiKTtcblxuICAgIGRlbGV0ZSB0aGlzLl9oYW5kbGVzIVtpZF07XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgUGFja2FnZVtcImZhY3RzLWJhc2VcIl0gJiZcbiAgICAgIFBhY2thZ2VbXCJmYWN0cy1iYXNlXCJdLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIixcbiAgICAgICAgXCJvYnNlcnZlLWhhbmRsZXNcIixcbiAgICAgICAgLTFcbiAgICAgICk7XG5cbiAgICBpZiAoXG4gICAgICBpc0VtcHR5KHRoaXMuX2hhbmRsZXMpICYmXG4gICAgICB0aGlzLl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZCA9PT0gMFxuICAgICkge1xuICAgICAgYXdhaXQgdGhpcy5fc3RvcCgpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIF9zdG9wKG9wdGlvbnM6IHsgZnJvbVF1ZXJ5RXJyb3I/OiBib29sZWFuIH0gPSB7fSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghdGhpcy5fcmVhZHkoKSAmJiAhb3B0aW9ucy5mcm9tUXVlcnlFcnJvcilcbiAgICAgIHRocm93IEVycm9yKFwic3VycHJpc2luZyBfc3RvcDogbm90IHJlYWR5XCIpO1xuXG4gICAgYXdhaXQgdGhpcy5fb25TdG9wKCk7XG5cbiAgICAvLyBAdHMtaWdub3JlXG4gICAgUGFja2FnZVtcImZhY3RzLWJhc2VcIl0gJiZcbiAgICAgIFBhY2thZ2VbXCJmYWN0cy1iYXNlXCJdLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIixcbiAgICAgICAgXCJvYnNlcnZlLW11bHRpcGxleGVyc1wiLFxuICAgICAgICAtMVxuICAgICAgKTtcblxuICAgIHRoaXMuX2hhbmRsZXMgPSBudWxsO1xuICB9XG5cbiAgYXN5bmMgcmVhZHkoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5fcXVldWUucXVldWVUYXNrKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLl9yZWFkeSgpKVxuICAgICAgICB0aHJvdyBFcnJvcihcImNhbid0IG1ha2UgT2JzZXJ2ZU11bHRpcGxleCByZWFkeSB0d2ljZSFcIik7XG5cbiAgICAgIGlmICghdGhpcy5fcmVzb2x2ZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWlzc2luZyByZXNvbHZlclwiKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fcmVzb2x2ZXIoKTtcbiAgICAgIHRoaXMuX2lzUmVhZHkgPSB0cnVlO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgcXVlcnlFcnJvcihlcnI6IEVycm9yKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5fcXVldWUucnVuVGFzaygoKSA9PiB7XG4gICAgICBpZiAodGhpcy5fcmVhZHkoKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJjYW4ndCBjbGFpbSBxdWVyeSBoYXMgYW4gZXJyb3IgYWZ0ZXIgaXQgd29ya2VkIVwiKTtcbiAgICAgIHRoaXMuX3N0b3AoeyBmcm9tUXVlcnlFcnJvcjogdHJ1ZSB9KTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIG9uRmx1c2goY2I6ICgpID0+IHZvaWQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCB0aGlzLl9xdWV1ZS5xdWV1ZVRhc2soYXN5bmMgKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLl9yZWFkeSgpKVxuICAgICAgICB0aHJvdyBFcnJvcihcIm9ubHkgY2FsbCBvbkZsdXNoIG9uIGEgbXVsdGlwbGV4ZXIgdGhhdCB3aWxsIGJlIHJlYWR5XCIpO1xuICAgICAgYXdhaXQgY2IoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNhbGxiYWNrTmFtZXMoKTogT2JzZXJ2ZUhhbmRsZUNhbGxiYWNrW10ge1xuICAgIHJldHVybiB0aGlzLl9vcmRlcmVkXG4gICAgICA/IFtcImFkZGVkQmVmb3JlXCIsIFwiY2hhbmdlZFwiLCBcIm1vdmVkQmVmb3JlXCIsIFwicmVtb3ZlZFwiXVxuICAgICAgOiBbXCJhZGRlZFwiLCBcImNoYW5nZWRcIiwgXCJyZW1vdmVkXCJdO1xuICB9XG5cbiAgX3JlYWR5KCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAhIXRoaXMuX2lzUmVhZHk7XG4gIH1cblxuICBfYXBwbHlDYWxsYmFjayhjYWxsYmFja05hbWU6IHN0cmluZywgYXJnczogYW55W10pIHtcbiAgICB0aGlzLl9xdWV1ZS5xdWV1ZVRhc2soYXN5bmMgKCkgPT4ge1xuICAgICAgaWYgKCF0aGlzLl9oYW5kbGVzKSByZXR1cm47XG5cbiAgICAgIGF3YWl0IHRoaXMuX2NhY2hlLmFwcGx5Q2hhbmdlW2NhbGxiYWNrTmFtZV0uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICBpZiAoXG4gICAgICAgICF0aGlzLl9yZWFkeSgpICYmXG4gICAgICAgIGNhbGxiYWNrTmFtZSAhPT0gXCJhZGRlZFwiICYmXG4gICAgICAgIGNhbGxiYWNrTmFtZSAhPT0gXCJhZGRlZEJlZm9yZVwiXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBHb3QgJHtjYWxsYmFja05hbWV9IGR1cmluZyBpbml0aWFsIGFkZHNgKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBoYW5kbGVJZCBvZiBPYmplY3Qua2V5cyh0aGlzLl9oYW5kbGVzKSkge1xuICAgICAgICBjb25zdCBoYW5kbGUgPSB0aGlzLl9oYW5kbGVzICYmIHRoaXMuX2hhbmRsZXNbaGFuZGxlSWRdO1xuXG4gICAgICAgIGlmICghaGFuZGxlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSAoaGFuZGxlIGFzIGFueSlbYF8ke2NhbGxiYWNrTmFtZX1gXTtcblxuICAgICAgICBpZiAoIWNhbGxiYWNrKSBjb250aW51ZTtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBjYWxsYmFjay5hcHBseShcbiAgICAgICAgICBudWxsLFxuICAgICAgICAgIGhhbmRsZS5ub25NdXRhdGluZ0NhbGxiYWNrcyA/IGFyZ3MgOiBFSlNPTi5jbG9uZShhcmdzKVxuICAgICAgICApO1xuXG4gICAgICAgIGlmIChyZXN1bHQgJiYgTWV0ZW9yLl9pc1Byb21pc2UocmVzdWx0KSkge1xuICAgICAgICAgIHJlc3VsdC5jYXRjaCgoZXJyb3IpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIGBFcnJvciBpbiBvYnNlcnZlQ2hhbmdlcyBjYWxsYmFjayAke2NhbGxiYWNrTmFtZX06YCxcbiAgICAgICAgICAgICAgZXJyb3JcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaGFuZGxlLmluaXRpYWxBZGRzU2VudC50aGVuKHJlc3VsdCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBfc2VuZEFkZHMoaGFuZGxlOiBPYnNlcnZlSGFuZGxlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYWRkID0gdGhpcy5fb3JkZXJlZCA/IGhhbmRsZS5fYWRkZWRCZWZvcmUgOiBoYW5kbGUuX2FkZGVkO1xuICAgIGlmICghYWRkKSByZXR1cm47XG5cbiAgICBjb25zdCBhZGRQcm9taXNlczogKFByb21pc2U8dm9pZD4gfCB2b2lkKVtdID0gW107XG5cbiAgICAvLyBub3RlOiBkb2NzIG1heSBiZSBhbiBfSWRNYXAgb3IgYW4gT3JkZXJlZERpY3RcbiAgICB0aGlzLl9jYWNoZS5kb2NzLmZvckVhY2goKGRvYzogYW55LCBpZDogc3RyaW5nKSA9PiB7XG4gICAgICBpZiAoIShoYW5kbGUuX2lkIGluIHRoaXMuX2hhbmRsZXMhKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihcImhhbmRsZSBnb3QgcmVtb3ZlZCBiZWZvcmUgc2VuZGluZyBpbml0aWFsIGFkZHMhXCIpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB7IF9pZCwgLi4uZmllbGRzIH0gPSBoYW5kbGUubm9uTXV0YXRpbmdDYWxsYmFja3NcbiAgICAgICAgPyBkb2NcbiAgICAgICAgOiBFSlNPTi5jbG9uZShkb2MpO1xuXG4gICAgICBjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHIgPSB0aGlzLl9vcmRlcmVkID8gYWRkKGlkLCBmaWVsZHMsIG51bGwpIDogYWRkKGlkLCBmaWVsZHMpO1xuICAgICAgICAgIHJlc29sdmUocik7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGFkZFByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgfSk7XG5cbiAgICBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoYWRkUHJvbWlzZXMpLnRoZW4oKHApID0+IHtcbiAgICAgIHAuZm9yRWFjaCgocmVzdWx0KSA9PiB7XG4gICAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSBcInJlamVjdGVkXCIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGBFcnJvciBpbiBhZGRzIGZvciBoYW5kbGU6ICR7cmVzdWx0LnJlYXNvbn1gKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBoYW5kbGUuaW5pdGlhbEFkZHNTZW50UmVzb2x2ZXIoKTtcbiAgfVxufVxuIiwiZXhwb3J0IGNsYXNzIERvY0ZldGNoZXIge1xuICBjb25zdHJ1Y3Rvcihtb25nb0Nvbm5lY3Rpb24pIHtcbiAgICB0aGlzLl9tb25nb0Nvbm5lY3Rpb24gPSBtb25nb0Nvbm5lY3Rpb247XG4gICAgLy8gTWFwIGZyb20gb3AgLT4gW2NhbGxiYWNrXVxuICAgIHRoaXMuX2NhbGxiYWNrc0Zvck9wID0gbmV3IE1hcCgpO1xuICB9XG5cbiAgLy8gRmV0Y2hlcyBkb2N1bWVudCBcImlkXCIgZnJvbSBjb2xsZWN0aW9uTmFtZSwgcmV0dXJuaW5nIGl0IG9yIG51bGwgaWYgbm90XG4gIC8vIGZvdW5kLlxuICAvL1xuICAvLyBJZiB5b3UgbWFrZSBtdWx0aXBsZSBjYWxscyB0byBmZXRjaCgpIHdpdGggdGhlIHNhbWUgb3AgcmVmZXJlbmNlLFxuICAvLyBEb2NGZXRjaGVyIG1heSBhc3N1bWUgdGhhdCB0aGV5IGFsbCByZXR1cm4gdGhlIHNhbWUgZG9jdW1lbnQuIChJdCBkb2VzXG4gIC8vIG5vdCBjaGVjayB0byBzZWUgaWYgY29sbGVjdGlvbk5hbWUvaWQgbWF0Y2guKVxuICAvL1xuICAvLyBZb3UgbWF5IGFzc3VtZSB0aGF0IGNhbGxiYWNrIGlzIG5ldmVyIGNhbGxlZCBzeW5jaHJvbm91c2x5IChhbmQgaW4gZmFjdFxuICAvLyBPcGxvZ09ic2VydmVEcml2ZXIgZG9lcyBzbykuXG4gIGFzeW5jIGZldGNoKGNvbGxlY3Rpb25OYW1lLCBpZCwgb3AsIGNhbGxiYWNrKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBcbiAgICBjaGVjayhjb2xsZWN0aW9uTmFtZSwgU3RyaW5nKTtcbiAgICBjaGVjayhvcCwgT2JqZWN0KTtcblxuXG4gICAgLy8gSWYgdGhlcmUncyBhbHJlYWR5IGFuIGluLXByb2dyZXNzIGZldGNoIGZvciB0aGlzIGNhY2hlIGtleSwgeWllbGQgdW50aWxcbiAgICAvLyBpdCdzIGRvbmUgYW5kIHJldHVybiB3aGF0ZXZlciBpdCByZXR1cm5zLlxuICAgIGlmIChzZWxmLl9jYWxsYmFja3NGb3JPcC5oYXMob3ApKSB7XG4gICAgICBzZWxmLl9jYWxsYmFja3NGb3JPcC5nZXQob3ApLnB1c2goY2FsbGJhY2spO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGNhbGxiYWNrcyA9IFtjYWxsYmFja107XG4gICAgc2VsZi5fY2FsbGJhY2tzRm9yT3Auc2V0KG9wLCBjYWxsYmFja3MpO1xuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBkb2MgPVxuICAgICAgICAoYXdhaXQgc2VsZi5fbW9uZ29Db25uZWN0aW9uLmZpbmRPbmVBc3luYyhjb2xsZWN0aW9uTmFtZSwge1xuICAgICAgICAgIF9pZDogaWQsXG4gICAgICAgIH0pKSB8fCBudWxsO1xuICAgICAgLy8gUmV0dXJuIGRvYyB0byBhbGwgcmVsZXZhbnQgY2FsbGJhY2tzLiBOb3RlIHRoYXQgdGhpcyBhcnJheSBjYW5cbiAgICAgIC8vIGNvbnRpbnVlIHRvIGdyb3cgZHVyaW5nIGNhbGxiYWNrIGV4Y2VjdXRpb24uXG4gICAgICB3aGlsZSAoY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gQ2xvbmUgdGhlIGRvY3VtZW50IHNvIHRoYXQgdGhlIHZhcmlvdXMgY2FsbHMgdG8gZmV0Y2ggZG9uJ3QgcmV0dXJuXG4gICAgICAgIC8vIG9iamVjdHMgdGhhdCBhcmUgaW50ZXJ0d2luZ2xlZCB3aXRoIGVhY2ggb3RoZXIuIENsb25lIGJlZm9yZVxuICAgICAgICAvLyBwb3BwaW5nIHRoZSBmdXR1cmUsIHNvIHRoYXQgaWYgY2xvbmUgdGhyb3dzLCB0aGUgZXJyb3IgZ2V0cyBwYXNzZWRcbiAgICAgICAgLy8gdG8gdGhlIG5leHQgY2FsbGJhY2suXG4gICAgICAgIGNhbGxiYWNrcy5wb3AoKShudWxsLCBFSlNPTi5jbG9uZShkb2MpKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB3aGlsZSAoY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY2FsbGJhY2tzLnBvcCgpKGUpO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICAvLyBYWFggY29uc2lkZXIga2VlcGluZyB0aGUgZG9jIGFyb3VuZCBmb3IgYSBwZXJpb2Qgb2YgdGltZSBiZWZvcmVcbiAgICAgIC8vIHJlbW92aW5nIGZyb20gdGhlIGNhY2hlXG4gICAgICBzZWxmLl9jYWxsYmFja3NGb3JPcC5kZWxldGUob3ApO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHRocm90dGxlIGZyb20gJ2xvZGFzaC50aHJvdHRsZSc7XG5pbXBvcnQgeyBsaXN0ZW5BbGwgfSBmcm9tICcuL21vbmdvX2RyaXZlcic7XG5pbXBvcnQgeyBPYnNlcnZlTXVsdGlwbGV4ZXIgfSBmcm9tICcuL29ic2VydmVfbXVsdGlwbGV4JztcblxuaW50ZXJmYWNlIFBvbGxpbmdPYnNlcnZlRHJpdmVyT3B0aW9ucyB7XG4gIGN1cnNvckRlc2NyaXB0aW9uOiBhbnk7XG4gIG1vbmdvSGFuZGxlOiBhbnk7XG4gIG9yZGVyZWQ6IGJvb2xlYW47XG4gIG11bHRpcGxleGVyOiBPYnNlcnZlTXVsdGlwbGV4ZXI7XG4gIF90ZXN0T25seVBvbGxDYWxsYmFjaz86ICgpID0+IHZvaWQ7XG59XG5cbmNvbnN0IFBPTExJTkdfVEhST1RUTEVfTVMgPSArKHByb2Nlc3MuZW52Lk1FVEVPUl9QT0xMSU5HX1RIUk9UVExFX01TIHx8ICcnKSB8fCA1MDtcbmNvbnN0IFBPTExJTkdfSU5URVJWQUxfTVMgPSArKHByb2Nlc3MuZW52Lk1FVEVPUl9QT0xMSU5HX0lOVEVSVkFMX01TIHx8ICcnKSB8fCAxMCAqIDEwMDA7XG5cbi8qKlxuICogQGNsYXNzIFBvbGxpbmdPYnNlcnZlRHJpdmVyXG4gKlxuICogT25lIG9mIHR3byBvYnNlcnZlIGRyaXZlciBpbXBsZW1lbnRhdGlvbnMuXG4gKlxuICogQ2hhcmFjdGVyaXN0aWNzOlxuICogLSBDYWNoZXMgdGhlIHJlc3VsdHMgb2YgYSBxdWVyeVxuICogLSBSZXJ1bnMgdGhlIHF1ZXJ5IHdoZW4gbmVjZXNzYXJ5XG4gKiAtIFN1aXRhYmxlIGZvciBjYXNlcyB3aGVyZSBvcGxvZyB0YWlsaW5nIGlzIG5vdCBhdmFpbGFibGUgb3IgcHJhY3RpY2FsXG4gKi9cbmV4cG9ydCBjbGFzcyBQb2xsaW5nT2JzZXJ2ZURyaXZlciB7XG4gIHByaXZhdGUgX29wdGlvbnM6IFBvbGxpbmdPYnNlcnZlRHJpdmVyT3B0aW9ucztcbiAgcHJpdmF0ZSBfY3Vyc29yRGVzY3JpcHRpb246IGFueTtcbiAgcHJpdmF0ZSBfbW9uZ29IYW5kbGU6IGFueTtcbiAgcHJpdmF0ZSBfb3JkZXJlZDogYm9vbGVhbjtcbiAgcHJpdmF0ZSBfbXVsdGlwbGV4ZXI6IGFueTtcbiAgcHJpdmF0ZSBfc3RvcENhbGxiYWNrczogQXJyYXk8KCkgPT4gUHJvbWlzZTx2b2lkPj47XG4gIHByaXZhdGUgX3N0b3BwZWQ6IGJvb2xlYW47XG4gIHByaXZhdGUgX2N1cnNvcjogYW55O1xuICBwcml2YXRlIF9yZXN1bHRzOiBhbnk7XG4gIHByaXZhdGUgX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZDogbnVtYmVyO1xuICBwcml2YXRlIF9wZW5kaW5nV3JpdGVzOiBhbnlbXTtcbiAgcHJpdmF0ZSBfZW5zdXJlUG9sbElzU2NoZWR1bGVkOiBGdW5jdGlvbjtcbiAgcHJpdmF0ZSBfdGFza1F1ZXVlOiBhbnk7XG4gIHByaXZhdGUgX3Rlc3RPbmx5UG9sbENhbGxiYWNrPzogKCkgPT4gdm9pZDtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBQb2xsaW5nT2JzZXJ2ZURyaXZlck9wdGlvbnMpIHtcbiAgICB0aGlzLl9vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbiA9IG9wdGlvbnMuY3Vyc29yRGVzY3JpcHRpb247XG4gICAgdGhpcy5fbW9uZ29IYW5kbGUgPSBvcHRpb25zLm1vbmdvSGFuZGxlO1xuICAgIHRoaXMuX29yZGVyZWQgPSBvcHRpb25zLm9yZGVyZWQ7XG4gICAgdGhpcy5fbXVsdGlwbGV4ZXIgPSBvcHRpb25zLm11bHRpcGxleGVyO1xuICAgIHRoaXMuX3N0b3BDYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLl9zdG9wcGVkID0gZmFsc2U7XG5cbiAgICB0aGlzLl9jdXJzb3IgPSB0aGlzLl9tb25nb0hhbmRsZS5fY3JlYXRlQXN5bmNocm9ub3VzQ3Vyc29yKFxuICAgICAgdGhpcy5fY3Vyc29yRGVzY3JpcHRpb24pO1xuXG4gICAgdGhpcy5fcmVzdWx0cyA9IG51bGw7XG4gICAgdGhpcy5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkID0gMDtcbiAgICB0aGlzLl9wZW5kaW5nV3JpdGVzID0gW107XG5cbiAgICB0aGlzLl9lbnN1cmVQb2xsSXNTY2hlZHVsZWQgPSB0aHJvdHRsZShcbiAgICAgIHRoaXMuX3VudGhyb3R0bGVkRW5zdXJlUG9sbElzU2NoZWR1bGVkLmJpbmQodGhpcyksXG4gICAgICB0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnBvbGxpbmdUaHJvdHRsZU1zIHx8IFBPTExJTkdfVEhST1RUTEVfTVNcbiAgICApO1xuXG4gICAgdGhpcy5fdGFza1F1ZXVlID0gbmV3IChNZXRlb3IgYXMgYW55KS5fQXN5bmNocm9ub3VzUXVldWUoKTtcbiAgfVxuXG4gIGFzeW5jIF9pbml0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLl9vcHRpb25zO1xuICAgIGNvbnN0IGxpc3RlbmVyc0hhbmRsZSA9IGF3YWl0IGxpc3RlbkFsbChcbiAgICAgIHRoaXMuX2N1cnNvckRlc2NyaXB0aW9uLFxuICAgICAgKG5vdGlmaWNhdGlvbjogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IGZlbmNlID0gKEREUFNlcnZlciBhcyBhbnkpLl9nZXRDdXJyZW50RmVuY2UoKTtcbiAgICAgICAgaWYgKGZlbmNlKSB7XG4gICAgICAgICAgdGhpcy5fcGVuZGluZ1dyaXRlcy5wdXNoKGZlbmNlLmJlZ2luV3JpdGUoKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCA9PT0gMCkge1xuICAgICAgICAgIHRoaXMuX2Vuc3VyZVBvbGxJc1NjaGVkdWxlZCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgKTtcblxuICAgIHRoaXMuX3N0b3BDYWxsYmFja3MucHVzaChhc3luYyAoKSA9PiB7IGF3YWl0IGxpc3RlbmVyc0hhbmRsZS5zdG9wKCk7IH0pO1xuXG4gICAgaWYgKG9wdGlvbnMuX3Rlc3RPbmx5UG9sbENhbGxiYWNrKSB7XG4gICAgICB0aGlzLl90ZXN0T25seVBvbGxDYWxsYmFjayA9IG9wdGlvbnMuX3Rlc3RPbmx5UG9sbENhbGxiYWNrO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwb2xsaW5nSW50ZXJ2YWwgPVxuICAgICAgICB0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnBvbGxpbmdJbnRlcnZhbE1zIHx8XG4gICAgICAgIHRoaXMuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMuX3BvbGxpbmdJbnRlcnZhbCB8fFxuICAgICAgICBQT0xMSU5HX0lOVEVSVkFMX01TO1xuXG4gICAgICBjb25zdCBpbnRlcnZhbEhhbmRsZSA9IE1ldGVvci5zZXRJbnRlcnZhbChcbiAgICAgICAgdGhpcy5fZW5zdXJlUG9sbElzU2NoZWR1bGVkLmJpbmQodGhpcyksXG4gICAgICAgIHBvbGxpbmdJbnRlcnZhbFxuICAgICAgKTtcblxuICAgICAgdGhpcy5fc3RvcENhbGxiYWNrcy5wdXNoKCgpID0+IHtcbiAgICAgICAgTWV0ZW9yLmNsZWFySW50ZXJ2YWwoaW50ZXJ2YWxIYW5kbGUpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgYXdhaXQgdGhpcy5fdW50aHJvdHRsZWRFbnN1cmVQb2xsSXNTY2hlZHVsZWQoKTtcblxuICAgIChQYWNrYWdlWydmYWN0cy1iYXNlJ10gYXMgYW55KT8uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtcG9sbGluZ1wiLCAxKTtcbiAgfVxuXG4gIGFzeW5jIF91bnRocm90dGxlZEVuc3VyZVBvbGxJc1NjaGVkdWxlZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkID4gMCkgcmV0dXJuO1xuICAgICsrdGhpcy5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkO1xuICAgIGF3YWl0IHRoaXMuX3Rhc2tRdWV1ZS5ydW5UYXNrKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHRoaXMuX3BvbGxNb25nbygpO1xuICAgIH0pO1xuICB9XG5cbiAgX3N1c3BlbmRQb2xsaW5nKCk6IHZvaWQge1xuICAgICsrdGhpcy5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkO1xuICAgIHRoaXMuX3Rhc2tRdWV1ZS5ydW5UYXNrKCgpID0+IHt9KTtcblxuICAgIGlmICh0aGlzLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgIT09IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCBpcyAke3RoaXMuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZH1gKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBfcmVzdW1lUG9sbGluZygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkICE9PSAxKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYF9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgaXMgJHt0aGlzLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWR9YCk7XG4gICAgfVxuICAgIGF3YWl0IHRoaXMuX3Rhc2tRdWV1ZS5ydW5UYXNrKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHRoaXMuX3BvbGxNb25nbygpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgX3BvbGxNb25nbygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAtLXRoaXMuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZDtcblxuICAgIGlmICh0aGlzLl9zdG9wcGVkKSByZXR1cm47XG5cbiAgICBsZXQgZmlyc3QgPSBmYWxzZTtcbiAgICBsZXQgbmV3UmVzdWx0cztcbiAgICBsZXQgb2xkUmVzdWx0cyA9IHRoaXMuX3Jlc3VsdHM7XG5cbiAgICBpZiAoIW9sZFJlc3VsdHMpIHtcbiAgICAgIGZpcnN0ID0gdHJ1ZTtcbiAgICAgIG9sZFJlc3VsdHMgPSB0aGlzLl9vcmRlcmVkID8gW10gOiBuZXcgKExvY2FsQ29sbGVjdGlvbiBhcyBhbnkpLl9JZE1hcDtcbiAgICB9XG5cbiAgICB0aGlzLl90ZXN0T25seVBvbGxDYWxsYmFjaz8uKCk7XG5cbiAgICBjb25zdCB3cml0ZXNGb3JDeWNsZSA9IHRoaXMuX3BlbmRpbmdXcml0ZXM7XG4gICAgdGhpcy5fcGVuZGluZ1dyaXRlcyA9IFtdO1xuXG4gICAgdHJ5IHtcbiAgICAgIG5ld1Jlc3VsdHMgPSBhd2FpdCB0aGlzLl9jdXJzb3IuZ2V0UmF3T2JqZWN0cyh0aGlzLl9vcmRlcmVkKTtcbiAgICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICAgIGlmIChmaXJzdCAmJiB0eXBlb2YoZS5jb2RlKSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5fbXVsdGlwbGV4ZXIucXVlcnlFcnJvcihcbiAgICAgICAgICBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgRXhjZXB0aW9uIHdoaWxlIHBvbGxpbmcgcXVlcnkgJHtcbiAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkodGhpcy5fY3Vyc29yRGVzY3JpcHRpb24pXG4gICAgICAgICAgICB9OiAke2UubWVzc2FnZX1gXG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseSh0aGlzLl9wZW5kaW5nV3JpdGVzLCB3cml0ZXNGb3JDeWNsZSk7XG4gICAgICBNZXRlb3IuX2RlYnVnKGBFeGNlcHRpb24gd2hpbGUgcG9sbGluZyBxdWVyeSAke1xuICAgICAgICBKU09OLnN0cmluZ2lmeSh0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbil9YCwgZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCF0aGlzLl9zdG9wcGVkKSB7XG4gICAgICAoTG9jYWxDb2xsZWN0aW9uIGFzIGFueSkuX2RpZmZRdWVyeUNoYW5nZXMoXG4gICAgICAgIHRoaXMuX29yZGVyZWQsIG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIHRoaXMuX211bHRpcGxleGVyKTtcbiAgICB9XG5cbiAgICBpZiAoZmlyc3QpIHRoaXMuX211bHRpcGxleGVyLnJlYWR5KCk7XG5cbiAgICB0aGlzLl9yZXN1bHRzID0gbmV3UmVzdWx0cztcblxuICAgIGF3YWl0IHRoaXMuX211bHRpcGxleGVyLm9uRmx1c2goYXN5bmMgKCkgPT4ge1xuICAgICAgZm9yIChjb25zdCB3IG9mIHdyaXRlc0ZvckN5Y2xlKSB7XG4gICAgICAgIGF3YWl0IHcuY29tbWl0dGVkKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBzdG9wKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuX3N0b3BwZWQgPSB0cnVlO1xuXG4gICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLl9zdG9wQ2FsbGJhY2tzKSB7XG4gICAgICBhd2FpdCBjYWxsYmFjaygpO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgdyBvZiB0aGlzLl9wZW5kaW5nV3JpdGVzKSB7XG4gICAgICBhd2FpdCB3LmNvbW1pdHRlZCgpO1xuICAgIH1cblxuICAgIChQYWNrYWdlWydmYWN0cy1iYXNlJ10gYXMgYW55KT8uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtcG9sbGluZ1wiLCAtMSk7XG4gIH1cbn0iLCJpbXBvcnQgaGFzIGZyb20gJ2xvZGFzaC5oYXMnO1xuaW1wb3J0IGlzRW1wdHkgZnJvbSAnbG9kYXNoLmlzZW1wdHknO1xuaW1wb3J0IHsgb3Bsb2dWMlYxQ29udmVydGVyIH0gZnJvbSBcIi4vb3Bsb2dfdjJfY29udmVydGVyXCI7XG5pbXBvcnQgeyBjaGVjaywgTWF0Y2ggfSBmcm9tICdtZXRlb3IvY2hlY2snO1xuaW1wb3J0IHsgQ3Vyc29yRGVzY3JpcHRpb24gfSBmcm9tICcuL2N1cnNvcl9kZXNjcmlwdGlvbic7XG5pbXBvcnQgeyBmb3JFYWNoVHJpZ2dlciwgbGlzdGVuQWxsIH0gZnJvbSAnLi9tb25nb19kcml2ZXInO1xuaW1wb3J0IHsgQ3Vyc29yIH0gZnJvbSAnLi9jdXJzb3InO1xuaW1wb3J0IExvY2FsQ29sbGVjdGlvbiBmcm9tICdtZXRlb3IvbWluaW1vbmdvL2xvY2FsX2NvbGxlY3Rpb24nO1xuaW1wb3J0IHsgaWRGb3JPcCB9IGZyb20gJy4vb3Bsb2dfdGFpbGluZyc7XG5cbnZhciBQSEFTRSA9IHtcbiAgUVVFUllJTkc6IFwiUVVFUllJTkdcIixcbiAgRkVUQ0hJTkc6IFwiRkVUQ0hJTkdcIixcbiAgU1RFQURZOiBcIlNURUFEWVwiXG59O1xuXG4vLyBFeGNlcHRpb24gdGhyb3duIGJ5IF9uZWVkVG9Qb2xsUXVlcnkgd2hpY2ggdW5yb2xscyB0aGUgc3RhY2sgdXAgdG8gdGhlXG4vLyBlbmNsb3NpbmcgY2FsbCB0byBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeS5cbnZhciBTd2l0Y2hlZFRvUXVlcnkgPSBmdW5jdGlvbiAoKSB7fTtcbnZhciBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeSA9IGZ1bmN0aW9uIChmKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGYuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoIShlIGluc3RhbmNlb2YgU3dpdGNoZWRUb1F1ZXJ5KSlcbiAgICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH07XG59O1xuXG52YXIgY3VycmVudElkID0gMDtcblxuLyoqXG4gKiBAY2xhc3MgT3Bsb2dPYnNlcnZlRHJpdmVyXG4gKiBBbiBhbHRlcm5hdGl2ZSB0byBQb2xsaW5nT2JzZXJ2ZURyaXZlciB3aGljaCBmb2xsb3dzIHRoZSBNb25nb0RCIG9wZXJhdGlvbiBsb2dcbiAqIGluc3RlYWQgb2YgcmUtcG9sbGluZyB0aGUgcXVlcnkuXG4gKlxuICogQ2hhcmFjdGVyaXN0aWNzOlxuICogLSBGb2xsb3dzIHRoZSBNb25nb0RCIG9wZXJhdGlvbiBsb2dcbiAqIC0gRGlyZWN0bHkgb2JzZXJ2ZXMgZGF0YWJhc2UgY2hhbmdlc1xuICogLSBNb3JlIGVmZmljaWVudCB0aGFuIHBvbGxpbmcgZm9yIG1vc3QgdXNlIGNhc2VzXG4gKiAtIFJlcXVpcmVzIGFjY2VzcyB0byBNb25nb0RCIG9wbG9nXG4gKlxuICogSW50ZXJmYWNlOlxuICogLSBDb25zdHJ1Y3Rpb24gaW5pdGlhdGVzIG9ic2VydmVDaGFuZ2VzIGNhbGxiYWNrcyBhbmQgcmVhZHkoKSBpbnZvY2F0aW9uIHRvIHRoZSBPYnNlcnZlTXVsdGlwbGV4ZXJcbiAqIC0gT2JzZXJ2YXRpb24gY2FuIGJlIHRlcm1pbmF0ZWQgdmlhIHRoZSBzdG9wKCkgbWV0aG9kXG4gKi9cbmV4cG9ydCBjb25zdCBPcGxvZ09ic2VydmVEcml2ZXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBjb25zdCBzZWxmID0gdGhpcztcbiAgc2VsZi5fdXNlc09wbG9nID0gdHJ1ZTsgIC8vIHRlc3RzIGxvb2sgYXQgdGhpc1xuXG4gIHNlbGYuX2lkID0gY3VycmVudElkO1xuICBjdXJyZW50SWQrKztcblxuICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiA9IG9wdGlvbnMuY3Vyc29yRGVzY3JpcHRpb247XG4gIHNlbGYuX21vbmdvSGFuZGxlID0gb3B0aW9ucy5tb25nb0hhbmRsZTtcbiAgc2VsZi5fbXVsdGlwbGV4ZXIgPSBvcHRpb25zLm11bHRpcGxleGVyO1xuXG4gIGlmIChvcHRpb25zLm9yZGVyZWQpIHtcbiAgICB0aHJvdyBFcnJvcihcIk9wbG9nT2JzZXJ2ZURyaXZlciBvbmx5IHN1cHBvcnRzIHVub3JkZXJlZCBvYnNlcnZlQ2hhbmdlc1wiKTtcbiAgfVxuXG4gIGNvbnN0IHNvcnRlciA9IG9wdGlvbnMuc29ydGVyO1xuICAvLyBXZSBkb24ndCBzdXBwb3J0ICRuZWFyIGFuZCBvdGhlciBnZW8tcXVlcmllcyBzbyBpdCdzIE9LIHRvIGluaXRpYWxpemUgdGhlXG4gIC8vIGNvbXBhcmF0b3Igb25seSBvbmNlIGluIHRoZSBjb25zdHJ1Y3Rvci5cbiAgY29uc3QgY29tcGFyYXRvciA9IHNvcnRlciAmJiBzb3J0ZXIuZ2V0Q29tcGFyYXRvcigpO1xuXG4gIGlmIChvcHRpb25zLmN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMubGltaXQpIHtcbiAgICAvLyBUaGVyZSBhcmUgc2V2ZXJhbCBwcm9wZXJ0aWVzIG9yZGVyZWQgZHJpdmVyIGltcGxlbWVudHM6XG4gICAgLy8gLSBfbGltaXQgaXMgYSBwb3NpdGl2ZSBudW1iZXJcbiAgICAvLyAtIF9jb21wYXJhdG9yIGlzIGEgZnVuY3Rpb24tY29tcGFyYXRvciBieSB3aGljaCB0aGUgcXVlcnkgaXMgb3JkZXJlZFxuICAgIC8vIC0gX3VucHVibGlzaGVkQnVmZmVyIGlzIG5vbi1udWxsIE1pbi9NYXggSGVhcCxcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgICB0aGUgZW1wdHkgYnVmZmVyIGluIFNURUFEWSBwaGFzZSBpbXBsaWVzIHRoYXQgdGhlXG4gICAgLy8gICAgICAgICAgICAgICAgICAgICAgZXZlcnl0aGluZyB0aGF0IG1hdGNoZXMgdGhlIHF1ZXJpZXMgc2VsZWN0b3IgZml0c1xuICAgIC8vICAgICAgICAgICAgICAgICAgICAgIGludG8gcHVibGlzaGVkIHNldC5cbiAgICAvLyAtIF9wdWJsaXNoZWQgLSBNYXggSGVhcCAoYWxzbyBpbXBsZW1lbnRzIElkTWFwIG1ldGhvZHMpXG5cbiAgICBjb25zdCBoZWFwT3B0aW9ucyA9IHsgSWRNYXA6IExvY2FsQ29sbGVjdGlvbi5fSWRNYXAgfTtcbiAgICBzZWxmLl9saW1pdCA9IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMubGltaXQ7XG4gICAgc2VsZi5fY29tcGFyYXRvciA9IGNvbXBhcmF0b3I7XG4gICAgc2VsZi5fc29ydGVyID0gc29ydGVyO1xuICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyID0gbmV3IE1pbk1heEhlYXAoY29tcGFyYXRvciwgaGVhcE9wdGlvbnMpO1xuICAgIC8vIFdlIG5lZWQgc29tZXRoaW5nIHRoYXQgY2FuIGZpbmQgTWF4IHZhbHVlIGluIGFkZGl0aW9uIHRvIElkTWFwIGludGVyZmFjZVxuICAgIHNlbGYuX3B1Ymxpc2hlZCA9IG5ldyBNYXhIZWFwKGNvbXBhcmF0b3IsIGhlYXBPcHRpb25zKTtcbiAgfSBlbHNlIHtcbiAgICBzZWxmLl9saW1pdCA9IDA7XG4gICAgc2VsZi5fY29tcGFyYXRvciA9IG51bGw7XG4gICAgc2VsZi5fc29ydGVyID0gbnVsbDtcbiAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlciA9IG51bGw7XG4gICAgLy8gTWVtb3J5IEdyb3d0aFxuICAgIHNlbGYuX3B1Ymxpc2hlZCA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICB9XG5cbiAgLy8gSW5kaWNhdGVzIGlmIGl0IGlzIHNhZmUgdG8gaW5zZXJ0IGEgbmV3IGRvY3VtZW50IGF0IHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICAvLyBmb3IgdGhpcyBxdWVyeS4gaS5lLiBpdCBpcyBrbm93biB0aGF0IHRoZXJlIGFyZSBubyBkb2N1bWVudHMgbWF0Y2hpbmcgdGhlXG4gIC8vIHNlbGVjdG9yIHRob3NlIGFyZSBub3QgaW4gcHVibGlzaGVkIG9yIGJ1ZmZlci5cbiAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gZmFsc2U7XG5cbiAgc2VsZi5fc3RvcHBlZCA9IGZhbHNlO1xuICBzZWxmLl9zdG9wSGFuZGxlcyA9IFtdO1xuICBzZWxmLl9hZGRTdG9wSGFuZGxlcyA9IGZ1bmN0aW9uIChuZXdTdG9wSGFuZGxlcykge1xuICAgIGNvbnN0IGV4cGVjdGVkUGF0dGVybiA9IE1hdGNoLk9iamVjdEluY2x1ZGluZyh7IHN0b3A6IEZ1bmN0aW9uIH0pO1xuICAgIC8vIFNpbmdsZSBpdGVtIG9yIGFycmF5XG4gICAgY2hlY2sobmV3U3RvcEhhbmRsZXMsIE1hdGNoLk9uZU9mKFtleHBlY3RlZFBhdHRlcm5dLCBleHBlY3RlZFBhdHRlcm4pKTtcbiAgICBzZWxmLl9zdG9wSGFuZGxlcy5wdXNoKG5ld1N0b3BIYW5kbGVzKTtcbiAgfVxuXG4gIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwib2JzZXJ2ZS1kcml2ZXJzLW9wbG9nXCIsIDEpO1xuXG4gIHNlbGYuX3JlZ2lzdGVyUGhhc2VDaGFuZ2UoUEhBU0UuUVVFUllJTkcpO1xuXG4gIHNlbGYuX21hdGNoZXIgPSBvcHRpb25zLm1hdGNoZXI7XG4gIC8vIHdlIGFyZSBub3cgdXNpbmcgcHJvamVjdGlvbiwgbm90IGZpZWxkcyBpbiB0aGUgY3Vyc29yIGRlc2NyaXB0aW9uIGV2ZW4gaWYgeW91IHBhc3Mge2ZpZWxkc31cbiAgLy8gaW4gdGhlIGN1cnNvciBjb25zdHJ1Y3Rpb25cbiAgY29uc3QgcHJvamVjdGlvbiA9IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMuZmllbGRzIHx8IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucHJvamVjdGlvbiB8fCB7fTtcbiAgc2VsZi5fcHJvamVjdGlvbkZuID0gTG9jYWxDb2xsZWN0aW9uLl9jb21waWxlUHJvamVjdGlvbihwcm9qZWN0aW9uKTtcbiAgLy8gUHJvamVjdGlvbiBmdW5jdGlvbiwgcmVzdWx0IG9mIGNvbWJpbmluZyBpbXBvcnRhbnQgZmllbGRzIGZvciBzZWxlY3RvciBhbmRcbiAgLy8gZXhpc3RpbmcgZmllbGRzIHByb2plY3Rpb25cbiAgc2VsZi5fc2hhcmVkUHJvamVjdGlvbiA9IHNlbGYuX21hdGNoZXIuY29tYmluZUludG9Qcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuICBpZiAoc29ydGVyKVxuICAgIHNlbGYuX3NoYXJlZFByb2plY3Rpb24gPSBzb3J0ZXIuY29tYmluZUludG9Qcm9qZWN0aW9uKHNlbGYuX3NoYXJlZFByb2plY3Rpb24pO1xuICBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4gPSBMb2NhbENvbGxlY3Rpb24uX2NvbXBpbGVQcm9qZWN0aW9uKFxuICAgIHNlbGYuX3NoYXJlZFByb2plY3Rpb24pO1xuXG4gIHNlbGYuX25lZWRUb0ZldGNoID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gbnVsbDtcbiAgc2VsZi5fZmV0Y2hHZW5lcmF0aW9uID0gMDtcblxuICBzZWxmLl9yZXF1ZXJ5V2hlbkRvbmVUaGlzUXVlcnkgPSBmYWxzZTtcbiAgc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSA9IFtdO1xuIH07XG5cbk9iamVjdC5hc3NpZ24oT3Bsb2dPYnNlcnZlRHJpdmVyLnByb3RvdHlwZSwge1xuICBfaW5pdDogYXN5bmMgZnVuY3Rpb24oKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBJZiB0aGUgb3Bsb2cgaGFuZGxlIHRlbGxzIHVzIHRoYXQgaXQgc2tpcHBlZCBzb21lIGVudHJpZXMgKGJlY2F1c2UgaXQgZ290XG4gICAgLy8gYmVoaW5kLCBzYXkpLCByZS1wb2xsLlxuICAgIHNlbGYuX2FkZFN0b3BIYW5kbGVzKHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS5vblNraXBwZWRFbnRyaWVzKFxuICAgICAgZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkoZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5fbmVlZFRvUG9sbFF1ZXJ5KCk7XG4gICAgICB9KVxuICAgICkpO1xuICAgIFxuICAgIGF3YWl0IGZvckVhY2hUcmlnZ2VyKHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLCBhc3luYyBmdW5jdGlvbiAodHJpZ2dlcikge1xuICAgICAgc2VsZi5fYWRkU3RvcEhhbmRsZXMoYXdhaXQgc2VsZi5fbW9uZ29IYW5kbGUuX29wbG9nSGFuZGxlLm9uT3Bsb2dFbnRyeShcbiAgICAgICAgdHJpZ2dlciwgZnVuY3Rpb24gKG5vdGlmaWNhdGlvbikge1xuICAgICAgICAgIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGNvbnN0IG9wID0gbm90aWZpY2F0aW9uLm9wO1xuICAgICAgICAgICAgaWYgKG5vdGlmaWNhdGlvbi5kcm9wQ29sbGVjdGlvbiB8fCBub3RpZmljYXRpb24uZHJvcERhdGFiYXNlKSB7XG4gICAgICAgICAgICAgIC8vIE5vdGU6IHRoaXMgY2FsbCBpcyBub3QgYWxsb3dlZCB0byBibG9jayBvbiBhbnl0aGluZyAoZXNwZWNpYWxseVxuICAgICAgICAgICAgICAvLyBvbiB3YWl0aW5nIGZvciBvcGxvZyBlbnRyaWVzIHRvIGNhdGNoIHVwKSBiZWNhdXNlIHRoYXQgd2lsbCBibG9ja1xuICAgICAgICAgICAgICAvLyBvbk9wbG9nRW50cnkhXG4gICAgICAgICAgICAgIHJldHVybiBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIEFsbCBvdGhlciBvcGVyYXRvcnMgc2hvdWxkIGJlIGhhbmRsZWQgZGVwZW5kaW5nIG9uIHBoYXNlXG4gICAgICAgICAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuUVVFUllJTkcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5faGFuZGxlT3Bsb2dFbnRyeVF1ZXJ5aW5nKG9wKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5faGFuZGxlT3Bsb2dFbnRyeVN0ZWFkeU9yRmV0Y2hpbmcob3ApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSkoKTtcbiAgICAgICAgfVxuICAgICAgKSk7XG4gICAgfSk7XG4gIFxuICAgIC8vIFhYWCBvcmRlcmluZyB3LnIudC4gZXZlcnl0aGluZyBlbHNlP1xuICAgIHNlbGYuX2FkZFN0b3BIYW5kbGVzKGF3YWl0IGxpc3RlbkFsbChcbiAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIElmIHdlJ3JlIG5vdCBpbiBhIHByZS1maXJlIHdyaXRlIGZlbmNlLCB3ZSBkb24ndCBoYXZlIHRvIGRvIGFueXRoaW5nLlxuICAgICAgICBjb25zdCBmZW5jZSA9IEREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlKCk7XG4gICAgICAgIGlmICghZmVuY2UgfHwgZmVuY2UuZmlyZWQpXG4gICAgICAgICAgcmV0dXJuO1xuICBcbiAgICAgICAgaWYgKGZlbmNlLl9vcGxvZ09ic2VydmVEcml2ZXJzKSB7XG4gICAgICAgICAgZmVuY2UuX29wbG9nT2JzZXJ2ZURyaXZlcnNbc2VsZi5faWRdID0gc2VsZjtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgXG4gICAgICAgIGZlbmNlLl9vcGxvZ09ic2VydmVEcml2ZXJzID0ge307XG4gICAgICAgIGZlbmNlLl9vcGxvZ09ic2VydmVEcml2ZXJzW3NlbGYuX2lkXSA9IHNlbGY7XG4gIFxuICAgICAgICBmZW5jZS5vbkJlZm9yZUZpcmUoYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNvbnN0IGRyaXZlcnMgPSBmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVycztcbiAgICAgICAgICBkZWxldGUgZmVuY2UuX29wbG9nT2JzZXJ2ZURyaXZlcnM7XG4gIFxuICAgICAgICAgIC8vIFRoaXMgZmVuY2UgY2Fubm90IGZpcmUgdW50aWwgd2UndmUgY2F1Z2h0IHVwIHRvIFwidGhpcyBwb2ludFwiIGluIHRoZVxuICAgICAgICAgIC8vIG9wbG9nLCBhbmQgYWxsIG9ic2VydmVycyBtYWRlIGl0IGJhY2sgdG8gdGhlIHN0ZWFkeSBzdGF0ZS5cbiAgICAgICAgICBhd2FpdCBzZWxmLl9tb25nb0hhbmRsZS5fb3Bsb2dIYW5kbGUud2FpdFVudGlsQ2F1Z2h0VXAoKTtcbiAgXG4gICAgICAgICAgZm9yIChjb25zdCBkcml2ZXIgb2YgT2JqZWN0LnZhbHVlcyhkcml2ZXJzKSkge1xuICAgICAgICAgICAgaWYgKGRyaXZlci5fc3RvcHBlZClcbiAgICAgICAgICAgICAgY29udGludWU7XG4gIFxuICAgICAgICAgICAgY29uc3Qgd3JpdGUgPSBhd2FpdCBmZW5jZS5iZWdpbldyaXRlKCk7XG4gICAgICAgICAgICBpZiAoZHJpdmVyLl9waGFzZSA9PT0gUEhBU0UuU1RFQURZKSB7XG4gICAgICAgICAgICAgIC8vIE1ha2Ugc3VyZSB0aGF0IGFsbCBvZiB0aGUgY2FsbGJhY2tzIGhhdmUgbWFkZSBpdCB0aHJvdWdoIHRoZVxuICAgICAgICAgICAgICAvLyBtdWx0aXBsZXhlciBhbmQgYmVlbiBkZWxpdmVyZWQgdG8gT2JzZXJ2ZUhhbmRsZXMgYmVmb3JlIGNvbW1pdHRpbmdcbiAgICAgICAgICAgICAgLy8gd3JpdGVzLlxuICAgICAgICAgICAgICBhd2FpdCBkcml2ZXIuX211bHRpcGxleGVyLm9uRmx1c2god3JpdGUuY29tbWl0dGVkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGRyaXZlci5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeS5wdXNoKHdyaXRlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICkpO1xuICBcbiAgICAvLyBXaGVuIE1vbmdvIGZhaWxzIG92ZXIsIHdlIG5lZWQgdG8gcmVwb2xsIHRoZSBxdWVyeSwgaW4gY2FzZSB3ZSBwcm9jZXNzZWQgYW5cbiAgICAvLyBvcGxvZyBlbnRyeSB0aGF0IGdvdCByb2xsZWQgYmFjay5cbiAgICBzZWxmLl9hZGRTdG9wSGFuZGxlcyhzZWxmLl9tb25nb0hhbmRsZS5fb25GYWlsb3ZlcihmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeShcbiAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuX25lZWRUb1BvbGxRdWVyeSgpO1xuICAgICAgfSkpKTtcbiAgXG4gICAgLy8gR2l2ZSBfb2JzZXJ2ZUNoYW5nZXMgYSBjaGFuY2UgdG8gYWRkIHRoZSBuZXcgT2JzZXJ2ZUhhbmRsZSB0byBvdXJcbiAgICAvLyBtdWx0aXBsZXhlciwgc28gdGhhdCB0aGUgYWRkZWQgY2FsbHMgZ2V0IHN0cmVhbWVkLlxuICAgIHJldHVybiBzZWxmLl9ydW5Jbml0aWFsUXVlcnkoKTtcbiAgfSxcbiAgX2FkZFB1Ymxpc2hlZDogZnVuY3Rpb24gKGlkLCBkb2MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGZpZWxkcyA9IE9iamVjdC5hc3NpZ24oe30sIGRvYyk7XG4gICAgICBkZWxldGUgZmllbGRzLl9pZDtcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5zZXQoaWQsIHNlbGYuX3NoYXJlZFByb2plY3Rpb25Gbihkb2MpKTtcbiAgICAgIHNlbGYuX211bHRpcGxleGVyLmFkZGVkKGlkLCBzZWxmLl9wcm9qZWN0aW9uRm4oZmllbGRzKSk7XG5cbiAgICAgIC8vIEFmdGVyIGFkZGluZyB0aGlzIGRvY3VtZW50LCB0aGUgcHVibGlzaGVkIHNldCBtaWdodCBiZSBvdmVyZmxvd2VkXG4gICAgICAvLyAoZXhjZWVkaW5nIGNhcGFjaXR5IHNwZWNpZmllZCBieSBsaW1pdCkuIElmIHNvLCBwdXNoIHRoZSBtYXhpbXVtXG4gICAgICAvLyBlbGVtZW50IHRvIHRoZSBidWZmZXIsIHdlIG1pZ2h0IHdhbnQgdG8gc2F2ZSBpdCBpbiBtZW1vcnkgdG8gcmVkdWNlIHRoZVxuICAgICAgLy8gYW1vdW50IG9mIE1vbmdvIGxvb2t1cHMgaW4gdGhlIGZ1dHVyZS5cbiAgICAgIGlmIChzZWxmLl9saW1pdCAmJiBzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpID4gc2VsZi5fbGltaXQpIHtcbiAgICAgICAgLy8gWFhYIGluIHRoZW9yeSB0aGUgc2l6ZSBvZiBwdWJsaXNoZWQgaXMgbm8gbW9yZSB0aGFuIGxpbWl0KzFcbiAgICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgIT09IHNlbGYuX2xpbWl0ICsgMSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkFmdGVyIGFkZGluZyB0byBwdWJsaXNoZWQsIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgLSBzZWxmLl9saW1pdCkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcIiBkb2N1bWVudHMgYXJlIG92ZXJmbG93aW5nIHRoZSBzZXRcIik7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb3ZlcmZsb3dpbmdEb2NJZCA9IHNlbGYuX3B1Ymxpc2hlZC5tYXhFbGVtZW50SWQoKTtcbiAgICAgICAgdmFyIG92ZXJmbG93aW5nRG9jID0gc2VsZi5fcHVibGlzaGVkLmdldChvdmVyZmxvd2luZ0RvY0lkKTtcblxuICAgICAgICBpZiAoRUpTT04uZXF1YWxzKG92ZXJmbG93aW5nRG9jSWQsIGlkKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBkb2N1bWVudCBqdXN0IGFkZGVkIGlzIG92ZXJmbG93aW5nIHRoZSBwdWJsaXNoZWQgc2V0XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5fcHVibGlzaGVkLnJlbW92ZShvdmVyZmxvd2luZ0RvY0lkKTtcbiAgICAgICAgc2VsZi5fbXVsdGlwbGV4ZXIucmVtb3ZlZChvdmVyZmxvd2luZ0RvY0lkKTtcbiAgICAgICAgc2VsZi5fYWRkQnVmZmVyZWQob3ZlcmZsb3dpbmdEb2NJZCwgb3ZlcmZsb3dpbmdEb2MpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBfcmVtb3ZlUHVibGlzaGVkOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fcHVibGlzaGVkLnJlbW92ZShpZCk7XG4gICAgICBzZWxmLl9tdWx0aXBsZXhlci5yZW1vdmVkKGlkKTtcbiAgICAgIGlmICghIHNlbGYuX2xpbWl0IHx8IHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgPT09IHNlbGYuX2xpbWl0KVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpID4gc2VsZi5fbGltaXQpXG4gICAgICAgIHRocm93IEVycm9yKFwic2VsZi5fcHVibGlzaGVkIGdvdCB0b28gYmlnXCIpO1xuXG4gICAgICAvLyBPSywgd2UgYXJlIHB1Ymxpc2hpbmcgbGVzcyB0aGFuIHRoZSBsaW1pdC4gTWF5YmUgd2Ugc2hvdWxkIGxvb2sgaW4gdGhlXG4gICAgICAvLyBidWZmZXIgdG8gZmluZCB0aGUgbmV4dCBlbGVtZW50IHBhc3Qgd2hhdCB3ZSB3ZXJlIHB1Ymxpc2hpbmcgYmVmb3JlLlxuXG4gICAgICBpZiAoIXNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmVtcHR5KCkpIHtcbiAgICAgICAgLy8gVGhlcmUncyBzb21ldGhpbmcgaW4gdGhlIGJ1ZmZlcjsgbW92ZSB0aGUgZmlyc3QgdGhpbmcgaW4gaXQgdG9cbiAgICAgICAgLy8gX3B1Ymxpc2hlZC5cbiAgICAgICAgdmFyIG5ld0RvY0lkID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWluRWxlbWVudElkKCk7XG4gICAgICAgIHZhciBuZXdEb2MgPSBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQobmV3RG9jSWQpO1xuICAgICAgICBzZWxmLl9yZW1vdmVCdWZmZXJlZChuZXdEb2NJZCk7XG4gICAgICAgIHNlbGYuX2FkZFB1Ymxpc2hlZChuZXdEb2NJZCwgbmV3RG9jKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGVyZSdzIG5vdGhpbmcgaW4gdGhlIGJ1ZmZlci4gIFRoaXMgY291bGQgbWVhbiBvbmUgb2YgYSBmZXcgdGhpbmdzLlxuXG4gICAgICAvLyAoYSkgV2UgY291bGQgYmUgaW4gdGhlIG1pZGRsZSBvZiByZS1ydW5uaW5nIHRoZSBxdWVyeSAoc3BlY2lmaWNhbGx5LCB3ZVxuICAgICAgLy8gY291bGQgYmUgaW4gX3B1Ymxpc2hOZXdSZXN1bHRzKS4gSW4gdGhhdCBjYXNlLCBfdW5wdWJsaXNoZWRCdWZmZXIgaXNcbiAgICAgIC8vIGVtcHR5IGJlY2F1c2Ugd2UgY2xlYXIgaXQgYXQgdGhlIGJlZ2lubmluZyBvZiBfcHVibGlzaE5ld1Jlc3VsdHMuIEluXG4gICAgICAvLyB0aGlzIGNhc2UsIG91ciBjYWxsZXIgYWxyZWFkeSBrbm93cyB0aGUgZW50aXJlIGFuc3dlciB0byB0aGUgcXVlcnkgYW5kXG4gICAgICAvLyB3ZSBkb24ndCBuZWVkIHRvIGRvIGFueXRoaW5nIGZhbmN5IGhlcmUuICBKdXN0IHJldHVybi5cbiAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuUVVFUllJTkcpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gKGIpIFdlJ3JlIHByZXR0eSBjb25maWRlbnQgdGhhdCB0aGUgdW5pb24gb2YgX3B1Ymxpc2hlZCBhbmRcbiAgICAgIC8vIF91bnB1Ymxpc2hlZEJ1ZmZlciBjb250YWluIGFsbCBkb2N1bWVudHMgdGhhdCBtYXRjaCBzZWxlY3Rvci4gQmVjYXVzZVxuICAgICAgLy8gX3VucHVibGlzaGVkQnVmZmVyIGlzIGVtcHR5LCB0aGF0IG1lYW5zIHdlJ3JlIGNvbmZpZGVudCB0aGF0IF9wdWJsaXNoZWRcbiAgICAgIC8vIGNvbnRhaW5zIGFsbCBkb2N1bWVudHMgdGhhdCBtYXRjaCBzZWxlY3Rvci4gU28gd2UgaGF2ZSBub3RoaW5nIHRvIGRvLlxuICAgICAgaWYgKHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlcilcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICAvLyAoYykgTWF5YmUgdGhlcmUgYXJlIG90aGVyIGRvY3VtZW50cyBvdXQgdGhlcmUgdGhhdCBzaG91bGQgYmUgaW4gb3VyXG4gICAgICAvLyBidWZmZXIuIEJ1dCBpbiB0aGF0IGNhc2UsIHdoZW4gd2UgZW1wdGllZCBfdW5wdWJsaXNoZWRCdWZmZXIgaW5cbiAgICAgIC8vIF9yZW1vdmVCdWZmZXJlZCwgd2Ugc2hvdWxkIGhhdmUgY2FsbGVkIF9uZWVkVG9Qb2xsUXVlcnksIHdoaWNoIHdpbGxcbiAgICAgIC8vIGVpdGhlciBwdXQgc29tZXRoaW5nIGluIF91bnB1Ymxpc2hlZEJ1ZmZlciBvciBzZXQgX3NhZmVBcHBlbmRUb0J1ZmZlclxuICAgICAgLy8gKG9yIGJvdGgpLCBhbmQgaXQgd2lsbCBwdXQgdXMgaW4gUVVFUllJTkcgZm9yIHRoYXQgd2hvbGUgdGltZS4gU28gaW5cbiAgICAgIC8vIGZhY3QsIHdlIHNob3VsZG4ndCBiZSBhYmxlIHRvIGdldCBoZXJlLlxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJCdWZmZXIgaW5leHBsaWNhYmx5IGVtcHR5XCIpO1xuICAgIH0pO1xuICB9LFxuICBfY2hhbmdlUHVibGlzaGVkOiBmdW5jdGlvbiAoaWQsIG9sZERvYywgbmV3RG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5zZXQoaWQsIHNlbGYuX3NoYXJlZFByb2plY3Rpb25GbihuZXdEb2MpKTtcbiAgICAgIHZhciBwcm9qZWN0ZWROZXcgPSBzZWxmLl9wcm9qZWN0aW9uRm4obmV3RG9jKTtcbiAgICAgIHZhciBwcm9qZWN0ZWRPbGQgPSBzZWxmLl9wcm9qZWN0aW9uRm4ob2xkRG9jKTtcbiAgICAgIHZhciBjaGFuZ2VkID0gRGlmZlNlcXVlbmNlLm1ha2VDaGFuZ2VkRmllbGRzKFxuICAgICAgICBwcm9qZWN0ZWROZXcsIHByb2plY3RlZE9sZCk7XG4gICAgICBpZiAoIWlzRW1wdHkoY2hhbmdlZCkpXG4gICAgICAgIHNlbGYuX211bHRpcGxleGVyLmNoYW5nZWQoaWQsIGNoYW5nZWQpO1xuICAgIH0pO1xuICB9LFxuICBfYWRkQnVmZmVyZWQ6IGZ1bmN0aW9uIChpZCwgZG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNldChpZCwgc2VsZi5fc2hhcmVkUHJvamVjdGlvbkZuKGRvYykpO1xuXG4gICAgICAvLyBJZiBzb21ldGhpbmcgaXMgb3ZlcmZsb3dpbmcgdGhlIGJ1ZmZlciwgd2UganVzdCByZW1vdmUgaXQgZnJvbSBjYWNoZVxuICAgICAgaWYgKHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSA+IHNlbGYuX2xpbWl0KSB7XG4gICAgICAgIHZhciBtYXhCdWZmZXJlZElkID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWF4RWxlbWVudElkKCk7XG5cbiAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIucmVtb3ZlKG1heEJ1ZmZlcmVkSWQpO1xuXG4gICAgICAgIC8vIFNpbmNlIHNvbWV0aGluZyBtYXRjaGluZyBpcyByZW1vdmVkIGZyb20gY2FjaGUgKGJvdGggcHVibGlzaGVkIHNldCBhbmRcbiAgICAgICAgLy8gYnVmZmVyKSwgc2V0IGZsYWcgdG8gZmFsc2VcbiAgICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIC8vIElzIGNhbGxlZCBlaXRoZXIgdG8gcmVtb3ZlIHRoZSBkb2MgY29tcGxldGVseSBmcm9tIG1hdGNoaW5nIHNldCBvciB0byBtb3ZlXG4gIC8vIGl0IHRvIHRoZSBwdWJsaXNoZWQgc2V0IGxhdGVyLlxuICBfcmVtb3ZlQnVmZmVyZWQ6IGZ1bmN0aW9uIChpZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5yZW1vdmUoaWQpO1xuICAgICAgLy8gVG8ga2VlcCB0aGUgY29udHJhY3QgXCJidWZmZXIgaXMgbmV2ZXIgZW1wdHkgaW4gU1RFQURZIHBoYXNlIHVubGVzcyB0aGVcbiAgICAgIC8vIGV2ZXJ5dGhpbmcgbWF0Y2hpbmcgZml0cyBpbnRvIHB1Ymxpc2hlZFwiIHRydWUsIHdlIHBvbGwgZXZlcnl0aGluZyBhc1xuICAgICAgLy8gc29vbiBhcyB3ZSBzZWUgdGhlIGJ1ZmZlciBiZWNvbWluZyBlbXB0eS5cbiAgICAgIGlmICghIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSAmJiAhIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlcilcbiAgICAgICAgc2VsZi5fbmVlZFRvUG9sbFF1ZXJ5KCk7XG4gICAgfSk7XG4gIH0sXG4gIC8vIENhbGxlZCB3aGVuIGEgZG9jdW1lbnQgaGFzIGpvaW5lZCB0aGUgXCJNYXRjaGluZ1wiIHJlc3VsdHMgc2V0LlxuICAvLyBUYWtlcyByZXNwb25zaWJpbGl0eSBvZiBrZWVwaW5nIF91bnB1Ymxpc2hlZEJ1ZmZlciBpbiBzeW5jIHdpdGggX3B1Ymxpc2hlZFxuICAvLyBhbmQgdGhlIGVmZmVjdCBvZiBsaW1pdCBlbmZvcmNlZC5cbiAgX2FkZE1hdGNoaW5nOiBmdW5jdGlvbiAoZG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBpZCA9IGRvYy5faWQ7XG4gICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLmhhcyhpZCkpXG4gICAgICAgIHRocm93IEVycm9yKFwidHJpZWQgdG8gYWRkIHNvbWV0aGluZyBhbHJlYWR5IHB1Ymxpc2hlZCBcIiArIGlkKTtcbiAgICAgIGlmIChzZWxmLl9saW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpKVxuICAgICAgICB0aHJvdyBFcnJvcihcInRyaWVkIHRvIGFkZCBzb21ldGhpbmcgYWxyZWFkeSBleGlzdGVkIGluIGJ1ZmZlciBcIiArIGlkKTtcblxuICAgICAgdmFyIGxpbWl0ID0gc2VsZi5fbGltaXQ7XG4gICAgICB2YXIgY29tcGFyYXRvciA9IHNlbGYuX2NvbXBhcmF0b3I7XG4gICAgICB2YXIgbWF4UHVibGlzaGVkID0gKGxpbWl0ICYmIHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgPiAwKSA/XG4gICAgICAgIHNlbGYuX3B1Ymxpc2hlZC5nZXQoc2VsZi5fcHVibGlzaGVkLm1heEVsZW1lbnRJZCgpKSA6IG51bGw7XG4gICAgICB2YXIgbWF4QnVmZmVyZWQgPSAobGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpID4gMClcbiAgICAgICAgPyBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQoc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWF4RWxlbWVudElkKCkpXG4gICAgICAgIDogbnVsbDtcbiAgICAgIC8vIFRoZSBxdWVyeSBpcyB1bmxpbWl0ZWQgb3IgZGlkbid0IHB1Ymxpc2ggZW5vdWdoIGRvY3VtZW50cyB5ZXQgb3IgdGhlXG4gICAgICAvLyBuZXcgZG9jdW1lbnQgd291bGQgZml0IGludG8gcHVibGlzaGVkIHNldCBwdXNoaW5nIHRoZSBtYXhpbXVtIGVsZW1lbnRcbiAgICAgIC8vIG91dCwgdGhlbiB3ZSBuZWVkIHRvIHB1Ymxpc2ggdGhlIGRvYy5cbiAgICAgIHZhciB0b1B1Ymxpc2ggPSAhIGxpbWl0IHx8IHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgPCBsaW1pdCB8fFxuICAgICAgICBjb21wYXJhdG9yKGRvYywgbWF4UHVibGlzaGVkKSA8IDA7XG5cbiAgICAgIC8vIE90aGVyd2lzZSB3ZSBtaWdodCBuZWVkIHRvIGJ1ZmZlciBpdCAob25seSBpbiBjYXNlIG9mIGxpbWl0ZWQgcXVlcnkpLlxuICAgICAgLy8gQnVmZmVyaW5nIGlzIGFsbG93ZWQgaWYgdGhlIGJ1ZmZlciBpcyBub3QgZmlsbGVkIHVwIHlldCBhbmQgYWxsXG4gICAgICAvLyBtYXRjaGluZyBkb2NzIGFyZSBlaXRoZXIgaW4gdGhlIHB1Ymxpc2hlZCBzZXQgb3IgaW4gdGhlIGJ1ZmZlci5cbiAgICAgIHZhciBjYW5BcHBlbmRUb0J1ZmZlciA9ICF0b1B1Ymxpc2ggJiYgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyICYmXG4gICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSA8IGxpbWl0O1xuXG4gICAgICAvLyBPciBpZiBpdCBpcyBzbWFsbCBlbm91Z2ggdG8gYmUgc2FmZWx5IGluc2VydGVkIHRvIHRoZSBtaWRkbGUgb3IgdGhlXG4gICAgICAvLyBiZWdpbm5pbmcgb2YgdGhlIGJ1ZmZlci5cbiAgICAgIHZhciBjYW5JbnNlcnRJbnRvQnVmZmVyID0gIXRvUHVibGlzaCAmJiBtYXhCdWZmZXJlZCAmJlxuICAgICAgICBjb21wYXJhdG9yKGRvYywgbWF4QnVmZmVyZWQpIDw9IDA7XG5cbiAgICAgIHZhciB0b0J1ZmZlciA9IGNhbkFwcGVuZFRvQnVmZmVyIHx8IGNhbkluc2VydEludG9CdWZmZXI7XG5cbiAgICAgIGlmICh0b1B1Ymxpc2gpIHtcbiAgICAgICAgc2VsZi5fYWRkUHVibGlzaGVkKGlkLCBkb2MpO1xuICAgICAgfSBlbHNlIGlmICh0b0J1ZmZlcikge1xuICAgICAgICBzZWxmLl9hZGRCdWZmZXJlZChpZCwgZG9jKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGRyb3BwaW5nIGl0IGFuZCBub3Qgc2F2aW5nIHRvIHRoZSBjYWNoZVxuICAgICAgICBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgLy8gQ2FsbGVkIHdoZW4gYSBkb2N1bWVudCBsZWF2ZXMgdGhlIFwiTWF0Y2hpbmdcIiByZXN1bHRzIHNldC5cbiAgLy8gVGFrZXMgcmVzcG9uc2liaWxpdHkgb2Yga2VlcGluZyBfdW5wdWJsaXNoZWRCdWZmZXIgaW4gc3luYyB3aXRoIF9wdWJsaXNoZWRcbiAgLy8gYW5kIHRoZSBlZmZlY3Qgb2YgbGltaXQgZW5mb3JjZWQuXG4gIF9yZW1vdmVNYXRjaGluZzogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghIHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpICYmICEgc2VsZi5fbGltaXQpXG4gICAgICAgIHRocm93IEVycm9yKFwidHJpZWQgdG8gcmVtb3ZlIHNvbWV0aGluZyBtYXRjaGluZyBidXQgbm90IGNhY2hlZCBcIiArIGlkKTtcblxuICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpKSB7XG4gICAgICAgIHNlbGYuX3JlbW92ZVB1Ymxpc2hlZChpZCk7XG4gICAgICB9IGVsc2UgaWYgKHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmhhcyhpZCkpIHtcbiAgICAgICAgc2VsZi5fcmVtb3ZlQnVmZmVyZWQoaWQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBfaGFuZGxlRG9jOiBmdW5jdGlvbiAoaWQsIG5ld0RvYykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgbWF0Y2hlc05vdyA9IG5ld0RvYyAmJiBzZWxmLl9tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhuZXdEb2MpLnJlc3VsdDtcblxuICAgICAgdmFyIHB1Ymxpc2hlZEJlZm9yZSA9IHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpO1xuICAgICAgdmFyIGJ1ZmZlcmVkQmVmb3JlID0gc2VsZi5fbGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKTtcbiAgICAgIHZhciBjYWNoZWRCZWZvcmUgPSBwdWJsaXNoZWRCZWZvcmUgfHwgYnVmZmVyZWRCZWZvcmU7XG5cbiAgICAgIGlmIChtYXRjaGVzTm93ICYmICFjYWNoZWRCZWZvcmUpIHtcbiAgICAgICAgc2VsZi5fYWRkTWF0Y2hpbmcobmV3RG9jKTtcbiAgICAgIH0gZWxzZSBpZiAoY2FjaGVkQmVmb3JlICYmICFtYXRjaGVzTm93KSB7XG4gICAgICAgIHNlbGYuX3JlbW92ZU1hdGNoaW5nKGlkKTtcbiAgICAgIH0gZWxzZSBpZiAoY2FjaGVkQmVmb3JlICYmIG1hdGNoZXNOb3cpIHtcbiAgICAgICAgdmFyIG9sZERvYyA9IHNlbGYuX3B1Ymxpc2hlZC5nZXQoaWQpO1xuICAgICAgICB2YXIgY29tcGFyYXRvciA9IHNlbGYuX2NvbXBhcmF0b3I7XG4gICAgICAgIHZhciBtaW5CdWZmZXJlZCA9IHNlbGYuX2xpbWl0ICYmIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSAmJlxuICAgICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmdldChzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5taW5FbGVtZW50SWQoKSk7XG4gICAgICAgIHZhciBtYXhCdWZmZXJlZDtcblxuICAgICAgICBpZiAocHVibGlzaGVkQmVmb3JlKSB7XG4gICAgICAgICAgLy8gVW5saW1pdGVkIGNhc2Ugd2hlcmUgdGhlIGRvY3VtZW50IHN0YXlzIGluIHB1Ymxpc2hlZCBvbmNlIGl0XG4gICAgICAgICAgLy8gbWF0Y2hlcyBvciB0aGUgY2FzZSB3aGVuIHdlIGRvbid0IGhhdmUgZW5vdWdoIG1hdGNoaW5nIGRvY3MgdG9cbiAgICAgICAgICAvLyBwdWJsaXNoIG9yIHRoZSBjaGFuZ2VkIGJ1dCBtYXRjaGluZyBkb2Mgd2lsbCBzdGF5IGluIHB1Ymxpc2hlZFxuICAgICAgICAgIC8vIGFueXdheXMuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBYWFg6IFdlIHJlbHkgb24gdGhlIGVtcHRpbmVzcyBvZiBidWZmZXIuIEJlIHN1cmUgdG8gbWFpbnRhaW4gdGhlXG4gICAgICAgICAgLy8gZmFjdCB0aGF0IGJ1ZmZlciBjYW4ndCBiZSBlbXB0eSBpZiB0aGVyZSBhcmUgbWF0Y2hpbmcgZG9jdW1lbnRzIG5vdFxuICAgICAgICAgIC8vIHB1Ymxpc2hlZC4gTm90YWJseSwgd2UgZG9uJ3Qgd2FudCB0byBzY2hlZHVsZSByZXBvbGwgYW5kIGNvbnRpbnVlXG4gICAgICAgICAgLy8gcmVseWluZyBvbiB0aGlzIHByb3BlcnR5LlxuICAgICAgICAgIHZhciBzdGF5c0luUHVibGlzaGVkID0gISBzZWxmLl9saW1pdCB8fFxuICAgICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpID09PSAwIHx8XG4gICAgICAgICAgICBjb21wYXJhdG9yKG5ld0RvYywgbWluQnVmZmVyZWQpIDw9IDA7XG5cbiAgICAgICAgICBpZiAoc3RheXNJblB1Ymxpc2hlZCkge1xuICAgICAgICAgICAgc2VsZi5fY2hhbmdlUHVibGlzaGVkKGlkLCBvbGREb2MsIG5ld0RvYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFmdGVyIHRoZSBjaGFuZ2UgZG9jIGRvZXNuJ3Qgc3RheSBpbiB0aGUgcHVibGlzaGVkLCByZW1vdmUgaXRcbiAgICAgICAgICAgIHNlbGYuX3JlbW92ZVB1Ymxpc2hlZChpZCk7XG4gICAgICAgICAgICAvLyBidXQgaXQgY2FuIG1vdmUgaW50byBidWZmZXJlZCBub3csIGNoZWNrIGl0XG4gICAgICAgICAgICBtYXhCdWZmZXJlZCA9IHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmdldChcbiAgICAgICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWF4RWxlbWVudElkKCkpO1xuXG4gICAgICAgICAgICB2YXIgdG9CdWZmZXIgPSBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgfHxcbiAgICAgICAgICAgICAgICAgIChtYXhCdWZmZXJlZCAmJiBjb21wYXJhdG9yKG5ld0RvYywgbWF4QnVmZmVyZWQpIDw9IDApO1xuXG4gICAgICAgICAgICBpZiAodG9CdWZmZXIpIHtcbiAgICAgICAgICAgICAgc2VsZi5fYWRkQnVmZmVyZWQoaWQsIG5ld0RvYyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBUaHJvdyBhd2F5IGZyb20gYm90aCBwdWJsaXNoZWQgc2V0IGFuZCBidWZmZXJcbiAgICAgICAgICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGJ1ZmZlcmVkQmVmb3JlKSB7XG4gICAgICAgICAgb2xkRG9jID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KGlkKTtcbiAgICAgICAgICAvLyByZW1vdmUgdGhlIG9sZCB2ZXJzaW9uIG1hbnVhbGx5IGluc3RlYWQgb2YgdXNpbmcgX3JlbW92ZUJ1ZmZlcmVkIHNvXG4gICAgICAgICAgLy8gd2UgZG9uJ3QgdHJpZ2dlciB0aGUgcXVlcnlpbmcgaW1tZWRpYXRlbHkuICBpZiB3ZSBlbmQgdGhpcyBibG9ja1xuICAgICAgICAgIC8vIHdpdGggdGhlIGJ1ZmZlciBlbXB0eSwgd2Ugd2lsbCBuZWVkIHRvIHRyaWdnZXIgdGhlIHF1ZXJ5IHBvbGxcbiAgICAgICAgICAvLyBtYW51YWxseSB0b28uXG4gICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIucmVtb3ZlKGlkKTtcblxuICAgICAgICAgIHZhciBtYXhQdWJsaXNoZWQgPSBzZWxmLl9wdWJsaXNoZWQuZ2V0KFxuICAgICAgICAgICAgc2VsZi5fcHVibGlzaGVkLm1heEVsZW1lbnRJZCgpKTtcbiAgICAgICAgICBtYXhCdWZmZXJlZCA9IHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnNpemUoKSAmJlxuICAgICAgICAgICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmdldChcbiAgICAgICAgICAgICAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLm1heEVsZW1lbnRJZCgpKTtcblxuICAgICAgICAgIC8vIHRoZSBidWZmZXJlZCBkb2Mgd2FzIHVwZGF0ZWQsIGl0IGNvdWxkIG1vdmUgdG8gcHVibGlzaGVkXG4gICAgICAgICAgdmFyIHRvUHVibGlzaCA9IGNvbXBhcmF0b3IobmV3RG9jLCBtYXhQdWJsaXNoZWQpIDwgMDtcblxuICAgICAgICAgIC8vIG9yIHN0YXlzIGluIGJ1ZmZlciBldmVuIGFmdGVyIHRoZSBjaGFuZ2VcbiAgICAgICAgICB2YXIgc3RheXNJbkJ1ZmZlciA9ICghIHRvUHVibGlzaCAmJiBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIpIHx8XG4gICAgICAgICAgICAgICAgKCF0b1B1Ymxpc2ggJiYgbWF4QnVmZmVyZWQgJiZcbiAgICAgICAgICAgICAgICAgY29tcGFyYXRvcihuZXdEb2MsIG1heEJ1ZmZlcmVkKSA8PSAwKTtcblxuICAgICAgICAgIGlmICh0b1B1Ymxpc2gpIHtcbiAgICAgICAgICAgIHNlbGYuX2FkZFB1Ymxpc2hlZChpZCwgbmV3RG9jKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHN0YXlzSW5CdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIHN0YXlzIGluIGJ1ZmZlciBidXQgY2hhbmdlc1xuICAgICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2V0KGlkLCBuZXdEb2MpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBUaHJvdyBhd2F5IGZyb20gYm90aCBwdWJsaXNoZWQgc2V0IGFuZCBidWZmZXJcbiAgICAgICAgICAgIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlciA9IGZhbHNlO1xuICAgICAgICAgICAgLy8gTm9ybWFsbHkgdGhpcyBjaGVjayB3b3VsZCBoYXZlIGJlZW4gZG9uZSBpbiBfcmVtb3ZlQnVmZmVyZWQgYnV0XG4gICAgICAgICAgICAvLyB3ZSBkaWRuJ3QgdXNlIGl0LCBzbyB3ZSBuZWVkIHRvIGRvIGl0IG91cnNlbGYgbm93LlxuICAgICAgICAgICAgaWYgKCEgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpKSB7XG4gICAgICAgICAgICAgIHNlbGYuX25lZWRUb1BvbGxRdWVyeSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYWNoZWRCZWZvcmUgaW1wbGllcyBlaXRoZXIgb2YgcHVibGlzaGVkQmVmb3JlIG9yIGJ1ZmZlcmVkQmVmb3JlIGlzIHRydWUuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIF9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuX3JlZ2lzdGVyUGhhc2VDaGFuZ2UoUEhBU0UuRkVUQ0hJTkcpO1xuICAgIC8vIERlZmVyLCBiZWNhdXNlIG5vdGhpbmcgY2FsbGVkIGZyb20gdGhlIG9wbG9nIGVudHJ5IGhhbmRsZXIgbWF5IHlpZWxkLFxuICAgIC8vIGJ1dCBmZXRjaCgpIHlpZWxkcy5cbiAgICBNZXRlb3IuZGVmZXIoZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkoYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgd2hpbGUgKCFzZWxmLl9zdG9wcGVkICYmICFzZWxmLl9uZWVkVG9GZXRjaC5lbXB0eSgpKSB7XG4gICAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuUVVFUllJTkcpIHtcbiAgICAgICAgICAvLyBXaGlsZSBmZXRjaGluZywgd2UgZGVjaWRlZCB0byBnbyBpbnRvIFFVRVJZSU5HIG1vZGUsIGFuZCB0aGVuIHdlXG4gICAgICAgICAgLy8gc2F3IGFub3RoZXIgb3Bsb2cgZW50cnksIHNvIF9uZWVkVG9GZXRjaCBpcyBub3QgZW1wdHkuIEJ1dCB3ZVxuICAgICAgICAgIC8vIHNob3VsZG4ndCBmZXRjaCB0aGVzZSBkb2N1bWVudHMgdW50aWwgQUZURVIgdGhlIHF1ZXJ5IGlzIGRvbmUuXG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBCZWluZyBpbiBzdGVhZHkgcGhhc2UgaGVyZSB3b3VsZCBiZSBzdXJwcmlzaW5nLlxuICAgICAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLkZFVENISU5HKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcInBoYXNlIGluIGZldGNoTW9kaWZpZWREb2N1bWVudHM6IFwiICsgc2VsZi5fcGhhc2UpO1xuXG4gICAgICAgIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gc2VsZi5fbmVlZFRvRmV0Y2g7XG4gICAgICAgIHZhciB0aGlzR2VuZXJhdGlvbiA9ICsrc2VsZi5fZmV0Y2hHZW5lcmF0aW9uO1xuICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaCA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuXG4gICAgICAgIC8vIENyZWF0ZSBhbiBhcnJheSBvZiBwcm9taXNlcyBmb3IgYWxsIHRoZSBmZXRjaCBvcGVyYXRpb25zXG4gICAgICAgIGNvbnN0IGZldGNoUHJvbWlzZXMgPSBbXTtcblxuICAgICAgICBzZWxmLl9jdXJyZW50bHlGZXRjaGluZy5mb3JFYWNoKGZ1bmN0aW9uIChvcCwgaWQpIHtcbiAgICAgICAgICBjb25zdCBmZXRjaFByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICBzZWxmLl9tb25nb0hhbmRsZS5fZG9jRmV0Y2hlci5mZXRjaChcbiAgICAgICAgICAgICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgICBvcCxcbiAgICAgICAgICAgICAgZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkoZnVuY3Rpb24oZXJyLCBkb2MpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICBNZXRlb3IuX2RlYnVnKCdHb3QgZXhjZXB0aW9uIHdoaWxlIGZldGNoaW5nIGRvY3VtZW50cycsIGVycik7XG4gICAgICAgICAgICAgICAgICAvLyBJZiB3ZSBnZXQgYW4gZXJyb3IgZnJvbSB0aGUgZmV0Y2hlciAoZWcsIHRyb3VibGVcbiAgICAgICAgICAgICAgICAgIC8vIGNvbm5lY3RpbmcgdG8gTW9uZ28pLCBsZXQncyBqdXN0IGFiYW5kb24gdGhlIGZldGNoIHBoYXNlXG4gICAgICAgICAgICAgICAgICAvLyBhbHRvZ2V0aGVyIGFuZCBmYWxsIGJhY2sgdG8gcG9sbGluZy4gSXQncyBub3QgbGlrZSB3ZSdyZVxuICAgICAgICAgICAgICAgICAgLy8gZ2V0dGluZyBsaXZlIHVwZGF0ZXMgYW55d2F5LlxuICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuX3BoYXNlICE9PSBQSEFTRS5RVUVSWUlORykge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAhc2VsZi5fc3RvcHBlZCAmJlxuICAgICAgICAgICAgICAgICAgc2VsZi5fcGhhc2UgPT09IFBIQVNFLkZFVENISU5HICYmXG4gICAgICAgICAgICAgICAgICBzZWxmLl9mZXRjaEdlbmVyYXRpb24gPT09IHRoaXNHZW5lcmF0aW9uXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAvLyBXZSByZS1jaGVjayB0aGUgZ2VuZXJhdGlvbiBpbiBjYXNlIHdlJ3ZlIGhhZCBhbiBleHBsaWNpdFxuICAgICAgICAgICAgICAgICAgLy8gX3BvbGxRdWVyeSBjYWxsIChlZywgaW4gYW5vdGhlciBmaWJlcikgd2hpY2ggc2hvdWxkXG4gICAgICAgICAgICAgICAgICAvLyBlZmZlY3RpdmVseSBjYW5jZWwgdGhpcyByb3VuZCBvZiBmZXRjaGVzLiAgKF9wb2xsUXVlcnlcbiAgICAgICAgICAgICAgICAgIC8vIGluY3JlbWVudHMgdGhlIGdlbmVyYXRpb24uKVxuICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5faGFuZGxlRG9jKGlkLCBkb2MpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApXG4gICAgICAgICAgfSlcbiAgICAgICAgICBmZXRjaFByb21pc2VzLnB1c2goZmV0Y2hQcm9taXNlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIFdhaXQgZm9yIGFsbCBmZXRjaCBvcGVyYXRpb25zIHRvIGNvbXBsZXRlXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChmZXRjaFByb21pc2VzKTtcbiAgICAgICAgICBjb25zdCBlcnJvcnMgPSByZXN1bHRzXG4gICAgICAgICAgICAuZmlsdGVyKHJlc3VsdCA9PiByZXN1bHQuc3RhdHVzID09PSAncmVqZWN0ZWQnKVxuICAgICAgICAgICAgLm1hcChyZXN1bHQgPT4gcmVzdWx0LnJlYXNvbik7XG5cbiAgICAgICAgICBpZiAoZXJyb3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIE1ldGVvci5fZGVidWcoJ1NvbWUgZmV0Y2ggcXVlcmllcyBmYWlsZWQ6JywgZXJyb3JzKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIE1ldGVvci5fZGVidWcoJ0dvdCBhbiBleGNlcHRpb24gaW4gYSBmZXRjaCBxdWVyeScsIGVycik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRXhpdCBub3cgaWYgd2UndmUgaGFkIGEgX3BvbGxRdWVyeSBjYWxsIChoZXJlIG9yIGluIGFub3RoZXIgZmliZXIpLlxuICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlFVRVJZSU5HKVxuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcgPSBudWxsO1xuICAgICAgfVxuICAgICAgLy8gV2UncmUgZG9uZSBmZXRjaGluZywgc28gd2UgY2FuIGJlIHN0ZWFkeSwgdW5sZXNzIHdlJ3ZlIGhhZCBhXG4gICAgICAvLyBfcG9sbFF1ZXJ5IGNhbGwgKGhlcmUgb3IgaW4gYW5vdGhlciBmaWJlcikuXG4gICAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLlFVRVJZSU5HKVxuICAgICAgICBhd2FpdCBzZWxmLl9iZVN0ZWFkeSgpO1xuICAgIH0pKTtcbiAgfSxcbiAgX2JlU3RlYWR5OiBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuX3JlZ2lzdGVyUGhhc2VDaGFuZ2UoUEhBU0UuU1RFQURZKTtcbiAgICB2YXIgd3JpdGVzID0gc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSB8fCBbXTtcbiAgICBzZWxmLl93cml0ZXNUb0NvbW1pdFdoZW5XZVJlYWNoU3RlYWR5ID0gW107XG4gICAgYXdhaXQgc2VsZi5fbXVsdGlwbGV4ZXIub25GbHVzaChhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICB0cnkge1xuICAgICAgICBmb3IgKGNvbnN0IHcgb2Ygd3JpdGVzKSB7XG4gICAgICAgICAgYXdhaXQgdy5jb21taXR0ZWQoKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiX2JlU3RlYWR5IGVycm9yXCIsIHt3cml0ZXN9LCBlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgX2hhbmRsZU9wbG9nRW50cnlRdWVyeWluZzogZnVuY3Rpb24gKG9wKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX25lZWRUb0ZldGNoLnNldChpZEZvck9wKG9wKSwgb3ApO1xuICAgIH0pO1xuICB9LFxuICBfaGFuZGxlT3Bsb2dFbnRyeVN0ZWFkeU9yRmV0Y2hpbmc6IGZ1bmN0aW9uIChvcCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgaWQgPSBpZEZvck9wKG9wKTtcbiAgICAgIC8vIElmIHdlJ3JlIGFscmVhZHkgZmV0Y2hpbmcgdGhpcyBvbmUsIG9yIGFib3V0IHRvLCB3ZSBjYW4ndCBvcHRpbWl6ZTtcbiAgICAgIC8vIG1ha2Ugc3VyZSB0aGF0IHdlIGZldGNoIGl0IGFnYWluIGlmIG5lY2Vzc2FyeS5cblxuICAgICAgaWYgKHNlbGYuX3BoYXNlID09PSBQSEFTRS5GRVRDSElORyAmJlxuICAgICAgICAgICgoc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcgJiYgc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcuaGFzKGlkKSkgfHxcbiAgICAgICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guaGFzKGlkKSkpIHtcbiAgICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guc2V0KGlkLCBvcCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKG9wLm9wID09PSAnZCcpIHtcbiAgICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpIHx8XG4gICAgICAgICAgICAoc2VsZi5fbGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKSkpXG4gICAgICAgICAgc2VsZi5fcmVtb3ZlTWF0Y2hpbmcoaWQpO1xuICAgICAgfSBlbHNlIGlmIChvcC5vcCA9PT0gJ2knKSB7XG4gICAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuaGFzKGlkKSlcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnNlcnQgZm91bmQgZm9yIGFscmVhZHktZXhpc3RpbmcgSUQgaW4gcHVibGlzaGVkXCIpO1xuICAgICAgICBpZiAoc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKSlcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpbnNlcnQgZm91bmQgZm9yIGFscmVhZHktZXhpc3RpbmcgSUQgaW4gYnVmZmVyXCIpO1xuXG4gICAgICAgIC8vIFhYWCB3aGF0IGlmIHNlbGVjdG9yIHlpZWxkcz8gIGZvciBub3cgaXQgY2FuJ3QgYnV0IGxhdGVyIGl0IGNvdWxkXG4gICAgICAgIC8vIGhhdmUgJHdoZXJlXG4gICAgICAgIGlmIChzZWxmLl9tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhvcC5vKS5yZXN1bHQpXG4gICAgICAgICAgc2VsZi5fYWRkTWF0Y2hpbmcob3Aubyk7XG4gICAgICB9IGVsc2UgaWYgKG9wLm9wID09PSAndScpIHtcbiAgICAgICAgLy8gd2UgYXJlIG1hcHBpbmcgdGhlIG5ldyBvcGxvZyBmb3JtYXQgb24gbW9uZ28gNVxuICAgICAgICAvLyB0byB3aGF0IHdlIGtub3cgYmV0dGVyLCAkc2V0XG4gICAgICAgIG9wLm8gPSBvcGxvZ1YyVjFDb252ZXJ0ZXIob3AubylcbiAgICAgICAgLy8gSXMgdGhpcyBhIG1vZGlmaWVyICgkc2V0LyR1bnNldCwgd2hpY2ggbWF5IHJlcXVpcmUgdXMgdG8gcG9sbCB0aGVcbiAgICAgICAgLy8gZGF0YWJhc2UgdG8gZmlndXJlIG91dCBpZiB0aGUgd2hvbGUgZG9jdW1lbnQgbWF0Y2hlcyB0aGUgc2VsZWN0b3IpIG9yXG4gICAgICAgIC8vIGEgcmVwbGFjZW1lbnQgKGluIHdoaWNoIGNhc2Ugd2UgY2FuIGp1c3QgZGlyZWN0bHkgcmUtZXZhbHVhdGUgdGhlXG4gICAgICAgIC8vIHNlbGVjdG9yKT9cbiAgICAgICAgLy8gb3Bsb2cgZm9ybWF0IGhhcyBjaGFuZ2VkIG9uIG1vbmdvZGIgNSwgd2UgaGF2ZSB0byBzdXBwb3J0IGJvdGggbm93XG4gICAgICAgIC8vIGRpZmYgaXMgdGhlIGZvcm1hdCBpbiBNb25nbyA1KyAob3Bsb2cgdjIpXG4gICAgICAgIHZhciBpc1JlcGxhY2UgPSAhaGFzKG9wLm8sICckc2V0JykgJiYgIWhhcyhvcC5vLCAnZGlmZicpICYmICFoYXMob3AubywgJyR1bnNldCcpO1xuICAgICAgICAvLyBJZiB0aGlzIG1vZGlmaWVyIG1vZGlmaWVzIHNvbWV0aGluZyBpbnNpZGUgYW4gRUpTT04gY3VzdG9tIHR5cGUgKGllLFxuICAgICAgICAvLyBhbnl0aGluZyB3aXRoIEVKU09OJCksIHRoZW4gd2UgY2FuJ3QgdHJ5IHRvIHVzZVxuICAgICAgICAvLyBMb2NhbENvbGxlY3Rpb24uX21vZGlmeSwgc2luY2UgdGhhdCBqdXN0IG11dGF0ZXMgdGhlIEVKU09OIGVuY29kaW5nLFxuICAgICAgICAvLyBub3QgdGhlIGFjdHVhbCBvYmplY3QuXG4gICAgICAgIHZhciBjYW5EaXJlY3RseU1vZGlmeURvYyA9XG4gICAgICAgICAgIWlzUmVwbGFjZSAmJiBtb2RpZmllckNhbkJlRGlyZWN0bHlBcHBsaWVkKG9wLm8pO1xuXG4gICAgICAgIHZhciBwdWJsaXNoZWRCZWZvcmUgPSBzZWxmLl9wdWJsaXNoZWQuaGFzKGlkKTtcbiAgICAgICAgdmFyIGJ1ZmZlcmVkQmVmb3JlID0gc2VsZi5fbGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKTtcblxuICAgICAgICBpZiAoaXNSZXBsYWNlKSB7XG4gICAgICAgICAgc2VsZi5faGFuZGxlRG9jKGlkLCBPYmplY3QuYXNzaWduKHtfaWQ6IGlkfSwgb3AubykpO1xuICAgICAgICB9IGVsc2UgaWYgKChwdWJsaXNoZWRCZWZvcmUgfHwgYnVmZmVyZWRCZWZvcmUpICYmXG4gICAgICAgICAgICAgICAgICAgY2FuRGlyZWN0bHlNb2RpZnlEb2MpIHtcbiAgICAgICAgICAvLyBPaCBncmVhdCwgd2UgYWN0dWFsbHkga25vdyB3aGF0IHRoZSBkb2N1bWVudCBpcywgc28gd2UgY2FuIGFwcGx5XG4gICAgICAgICAgLy8gdGhpcyBkaXJlY3RseS5cbiAgICAgICAgICB2YXIgbmV3RG9jID0gc2VsZi5fcHVibGlzaGVkLmhhcyhpZClcbiAgICAgICAgICAgID8gc2VsZi5fcHVibGlzaGVkLmdldChpZCkgOiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQoaWQpO1xuICAgICAgICAgIG5ld0RvYyA9IEVKU09OLmNsb25lKG5ld0RvYyk7XG5cbiAgICAgICAgICBuZXdEb2MuX2lkID0gaWQ7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5KG5ld0RvYywgb3Aubyk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgaWYgKGUubmFtZSAhPT0gXCJNaW5pbW9uZ29FcnJvclwiKVxuICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgLy8gV2UgZGlkbid0IHVuZGVyc3RhbmQgdGhlIG1vZGlmaWVyLiAgUmUtZmV0Y2guXG4gICAgICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaC5zZXQoaWQsIG9wKTtcbiAgICAgICAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuU1RFQURZKSB7XG4gICAgICAgICAgICAgIHNlbGYuX2ZldGNoTW9kaWZpZWREb2N1bWVudHMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2VsZi5faGFuZGxlRG9jKGlkLCBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4obmV3RG9jKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIWNhbkRpcmVjdGx5TW9kaWZ5RG9jIHx8XG4gICAgICAgICAgICAgICAgICAgc2VsZi5fbWF0Y2hlci5jYW5CZWNvbWVUcnVlQnlNb2RpZmllcihvcC5vKSB8fFxuICAgICAgICAgICAgICAgICAgIChzZWxmLl9zb3J0ZXIgJiYgc2VsZi5fc29ydGVyLmFmZmVjdGVkQnlNb2RpZmllcihvcC5vKSkpIHtcbiAgICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaC5zZXQoaWQsIG9wKTtcbiAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlNURUFEWSlcbiAgICAgICAgICAgIHNlbGYuX2ZldGNoTW9kaWZpZWREb2N1bWVudHMoKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJYWFggU1VSUFJJU0lORyBPUEVSQVRJT046IFwiICsgb3ApO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIGFzeW5jIF9ydW5Jbml0aWFsUXVlcnlBc3luYygpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJvcGxvZyBzdG9wcGVkIHN1cnByaXNpbmdseSBlYXJseVwiKTtcblxuICAgIGF3YWl0IHNlbGYuX3J1blF1ZXJ5KHtpbml0aWFsOiB0cnVlfSk7ICAvLyB5aWVsZHNcblxuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuOyAgLy8gY2FuIGhhcHBlbiBvbiBxdWVyeUVycm9yXG5cbiAgICAvLyBBbGxvdyBvYnNlcnZlQ2hhbmdlcyBjYWxscyB0byByZXR1cm4uIChBZnRlciB0aGlzLCBpdCdzIHBvc3NpYmxlIGZvclxuICAgIC8vIHN0b3AoKSB0byBiZSBjYWxsZWQuKVxuICAgIGF3YWl0IHNlbGYuX211bHRpcGxleGVyLnJlYWR5KCk7XG5cbiAgICBhd2FpdCBzZWxmLl9kb25lUXVlcnlpbmcoKTsgIC8vIHlpZWxkc1xuICB9LFxuXG4gIC8vIFlpZWxkcyFcbiAgX3J1bkluaXRpYWxRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9ydW5Jbml0aWFsUXVlcnlBc3luYygpO1xuICB9LFxuXG4gIC8vIEluIHZhcmlvdXMgY2lyY3Vtc3RhbmNlcywgd2UgbWF5IGp1c3Qgd2FudCB0byBzdG9wIHByb2Nlc3NpbmcgdGhlIG9wbG9nIGFuZFxuICAvLyByZS1ydW4gdGhlIGluaXRpYWwgcXVlcnksIGp1c3QgYXMgaWYgd2Ugd2VyZSBhIFBvbGxpbmdPYnNlcnZlRHJpdmVyLlxuICAvL1xuICAvLyBUaGlzIGZ1bmN0aW9uIG1heSBub3QgYmxvY2ssIGJlY2F1c2UgaXQgaXMgY2FsbGVkIGZyb20gYW4gb3Bsb2cgZW50cnlcbiAgLy8gaGFuZGxlci5cbiAgLy9cbiAgLy8gWFhYIFdlIHNob3VsZCBjYWxsIHRoaXMgd2hlbiB3ZSBkZXRlY3QgdGhhdCB3ZSd2ZSBiZWVuIGluIEZFVENISU5HIGZvciBcInRvb1xuICAvLyBsb25nXCIuXG4gIC8vXG4gIC8vIFhYWCBXZSBzaG91bGQgY2FsbCB0aGlzIHdoZW4gd2UgZGV0ZWN0IE1vbmdvIGZhaWxvdmVyIChzaW5jZSB0aGF0IG1pZ2h0XG4gIC8vIG1lYW4gdGhhdCBzb21lIG9mIHRoZSBvcGxvZyBlbnRyaWVzIHdlIGhhdmUgcHJvY2Vzc2VkIGhhdmUgYmVlbiByb2xsZWRcbiAgLy8gYmFjaykuIFRoZSBOb2RlIE1vbmdvIGRyaXZlciBpcyBpbiB0aGUgbWlkZGxlIG9mIGEgYnVuY2ggb2YgaHVnZVxuICAvLyByZWZhY3RvcmluZ3MsIGluY2x1ZGluZyB0aGUgd2F5IHRoYXQgaXQgbm90aWZpZXMgeW91IHdoZW4gcHJpbWFyeVxuICAvLyBjaGFuZ2VzLiBXaWxsIHB1dCBvZmYgaW1wbGVtZW50aW5nIHRoaXMgdW50aWwgZHJpdmVyIDEuNCBpcyBvdXQuXG4gIF9wb2xsUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gWWF5LCB3ZSBnZXQgdG8gZm9yZ2V0IGFib3V0IGFsbCB0aGUgdGhpbmdzIHdlIHRob3VnaHQgd2UgaGFkIHRvIGZldGNoLlxuICAgICAgc2VsZi5fbmVlZFRvRmV0Y2ggPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gbnVsbDtcbiAgICAgICsrc2VsZi5fZmV0Y2hHZW5lcmF0aW9uOyAgLy8gaWdub3JlIGFueSBpbi1mbGlnaHQgZmV0Y2hlc1xuICAgICAgc2VsZi5fcmVnaXN0ZXJQaGFzZUNoYW5nZShQSEFTRS5RVUVSWUlORyk7XG5cbiAgICAgIC8vIERlZmVyIHNvIHRoYXQgd2UgZG9uJ3QgeWllbGQuICBXZSBkb24ndCBuZWVkIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5XG4gICAgICAvLyBoZXJlIGJlY2F1c2UgU3dpdGNoZWRUb1F1ZXJ5IGlzIG5vdCB0aHJvd24gaW4gUVVFUllJTkcgbW9kZS5cbiAgICAgIE1ldGVvci5kZWZlcihhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX3J1blF1ZXJ5KCk7XG4gICAgICAgIGF3YWl0IHNlbGYuX2RvbmVRdWVyeWluZygpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gWWllbGRzIVxuICBhc3luYyBfcnVuUXVlcnlBc3luYyhvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBuZXdSZXN1bHRzLCBuZXdCdWZmZXI7XG5cbiAgICAvLyBUaGlzIHdoaWxlIGxvb3AgaXMganVzdCB0byByZXRyeSBmYWlsdXJlcy5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgLy8gSWYgd2UndmUgYmVlbiBzdG9wcGVkLCB3ZSBkb24ndCBoYXZlIHRvIHJ1biBhbnl0aGluZyBhbnkgbW9yZS5cbiAgICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIG5ld1Jlc3VsdHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIG5ld0J1ZmZlciA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuXG4gICAgICAvLyBRdWVyeSAyeCBkb2N1bWVudHMgYXMgdGhlIGhhbGYgZXhjbHVkZWQgZnJvbSB0aGUgb3JpZ2luYWwgcXVlcnkgd2lsbCBnb1xuICAgICAgLy8gaW50byB1bnB1Ymxpc2hlZCBidWZmZXIgdG8gcmVkdWNlIGFkZGl0aW9uYWwgTW9uZ28gbG9va3VwcyBpbiBjYXNlc1xuICAgICAgLy8gd2hlbiBkb2N1bWVudHMgYXJlIHJlbW92ZWQgZnJvbSB0aGUgcHVibGlzaGVkIHNldCBhbmQgbmVlZCBhXG4gICAgICAvLyByZXBsYWNlbWVudC5cbiAgICAgIC8vIFhYWCBuZWVkcyBtb3JlIHRob3VnaHQgb24gbm9uLXplcm8gc2tpcFxuICAgICAgLy8gWFhYIDIgaXMgYSBcIm1hZ2ljIG51bWJlclwiIG1lYW5pbmcgdGhlcmUgaXMgYW4gZXh0cmEgY2h1bmsgb2YgZG9jcyBmb3JcbiAgICAgIC8vIGJ1ZmZlciBpZiBzdWNoIGlzIG5lZWRlZC5cbiAgICAgIHZhciBjdXJzb3IgPSBzZWxmLl9jdXJzb3JGb3JRdWVyeSh7IGxpbWl0OiBzZWxmLl9saW1pdCAqIDIgfSk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBjdXJzb3IuZm9yRWFjaChmdW5jdGlvbiAoZG9jLCBpKSB7ICAvLyB5aWVsZHNcbiAgICAgICAgICBpZiAoIXNlbGYuX2xpbWl0IHx8IGkgPCBzZWxmLl9saW1pdCkge1xuICAgICAgICAgICAgbmV3UmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV3QnVmZmVyLnNldChkb2MuX2lkLCBkb2MpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAob3B0aW9ucy5pbml0aWFsICYmIHR5cGVvZihlLmNvZGUpID09PSAnbnVtYmVyJykge1xuICAgICAgICAgIC8vIFRoaXMgaXMgYW4gZXJyb3IgZG9jdW1lbnQgc2VudCB0byB1cyBieSBtb25nb2QsIG5vdCBhIGNvbm5lY3Rpb25cbiAgICAgICAgICAvLyBlcnJvciBnZW5lcmF0ZWQgYnkgdGhlIGNsaWVudC4gQW5kIHdlJ3ZlIG5ldmVyIHNlZW4gdGhpcyBxdWVyeSB3b3JrXG4gICAgICAgICAgLy8gc3VjY2Vzc2Z1bGx5LiBQcm9iYWJseSBpdCdzIGEgYmFkIHNlbGVjdG9yIG9yIHNvbWV0aGluZywgc28gd2VcbiAgICAgICAgICAvLyBzaG91bGQgTk9UIHJldHJ5LiBJbnN0ZWFkLCB3ZSBzaG91bGQgaGFsdCB0aGUgb2JzZXJ2ZSAod2hpY2ggZW5kc1xuICAgICAgICAgIC8vIHVwIGNhbGxpbmcgYHN0b3BgIG9uIHVzKS5cbiAgICAgICAgICBhd2FpdCBzZWxmLl9tdWx0aXBsZXhlci5xdWVyeUVycm9yKGUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIER1cmluZyBmYWlsb3ZlciAoZWcpIGlmIHdlIGdldCBhbiBleGNlcHRpb24gd2Ugc2hvdWxkIGxvZyBhbmQgcmV0cnlcbiAgICAgICAgLy8gaW5zdGVhZCBvZiBjcmFzaGluZy5cbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIkdvdCBleGNlcHRpb24gd2hpbGUgcG9sbGluZyBxdWVyeVwiLCBlKTtcbiAgICAgICAgYXdhaXQgTWV0ZW9yLl9zbGVlcEZvck1zKDEwMCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICBzZWxmLl9wdWJsaXNoTmV3UmVzdWx0cyhuZXdSZXN1bHRzLCBuZXdCdWZmZXIpO1xuICB9LFxuXG4gIC8vIFlpZWxkcyFcbiAgX3J1blF1ZXJ5OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLl9ydW5RdWVyeUFzeW5jKG9wdGlvbnMpO1xuICB9LFxuXG4gIC8vIFRyYW5zaXRpb25zIHRvIFFVRVJZSU5HIGFuZCBydW5zIGFub3RoZXIgcXVlcnksIG9yIChpZiBhbHJlYWR5IGluIFFVRVJZSU5HKVxuICAvLyBlbnN1cmVzIHRoYXQgd2Ugd2lsbCBxdWVyeSBhZ2FpbiBsYXRlci5cbiAgLy9cbiAgLy8gVGhpcyBmdW5jdGlvbiBtYXkgbm90IGJsb2NrLCBiZWNhdXNlIGl0IGlzIGNhbGxlZCBmcm9tIGFuIG9wbG9nIGVudHJ5XG4gIC8vIGhhbmRsZXIuIEhvd2V2ZXIsIGlmIHdlIHdlcmUgbm90IGFscmVhZHkgaW4gdGhlIFFVRVJZSU5HIHBoYXNlLCBpdCB0aHJvd3NcbiAgLy8gYW4gZXhjZXB0aW9uIHRoYXQgaXMgY2F1Z2h0IGJ5IHRoZSBjbG9zZXN0IHN1cnJvdW5kaW5nXG4gIC8vIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5IGNhbGw7IHRoaXMgZW5zdXJlcyB0aGF0IHdlIGRvbid0IGNvbnRpbnVlIHJ1bm5pbmdcbiAgLy8gY2xvc2UgdGhhdCB3YXMgZGVzaWduZWQgZm9yIGFub3RoZXIgcGhhc2UgaW5zaWRlIFBIQVNFLlFVRVJZSU5HLlxuICAvL1xuICAvLyAoSXQncyBhbHNvIG5lY2Vzc2FyeSB3aGVuZXZlciBsb2dpYyBpbiB0aGlzIGZpbGUgeWllbGRzIHRvIGNoZWNrIHRoYXQgb3RoZXJcbiAgLy8gcGhhc2VzIGhhdmVuJ3QgcHV0IHVzIGludG8gUVVFUllJTkcgbW9kZSwgdGhvdWdoOyBlZyxcbiAgLy8gX2ZldGNoTW9kaWZpZWREb2N1bWVudHMgZG9lcyB0aGlzLilcbiAgX25lZWRUb1BvbGxRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICAvLyBJZiB3ZSdyZSBub3QgYWxyZWFkeSBpbiB0aGUgbWlkZGxlIG9mIGEgcXVlcnksIHdlIGNhbiBxdWVyeSBub3dcbiAgICAgIC8vIChwb3NzaWJseSBwYXVzaW5nIEZFVENISU5HKS5cbiAgICAgIGlmIChzZWxmLl9waGFzZSAhPT0gUEhBU0UuUVVFUllJTkcpIHtcbiAgICAgICAgc2VsZi5fcG9sbFF1ZXJ5KCk7XG4gICAgICAgIHRocm93IG5ldyBTd2l0Y2hlZFRvUXVlcnk7XG4gICAgICB9XG5cbiAgICAgIC8vIFdlJ3JlIGN1cnJlbnRseSBpbiBRVUVSWUlORy4gU2V0IGEgZmxhZyB0byBlbnN1cmUgdGhhdCB3ZSBydW4gYW5vdGhlclxuICAgICAgLy8gcXVlcnkgd2hlbiB3ZSdyZSBkb25lLlxuICAgICAgc2VsZi5fcmVxdWVyeVdoZW5Eb25lVGhpc1F1ZXJ5ID0gdHJ1ZTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBZaWVsZHMhXG4gIF9kb25lUXVlcnlpbmc6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgIHJldHVybjtcblxuICAgIGF3YWl0IHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS53YWl0VW50aWxDYXVnaHRVcCgpO1xuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLlFVRVJZSU5HKVxuICAgICAgdGhyb3cgRXJyb3IoXCJQaGFzZSB1bmV4cGVjdGVkbHkgXCIgKyBzZWxmLl9waGFzZSk7XG5cbiAgICBpZiAoc2VsZi5fcmVxdWVyeVdoZW5Eb25lVGhpc1F1ZXJ5KSB7XG4gICAgICBzZWxmLl9yZXF1ZXJ5V2hlbkRvbmVUaGlzUXVlcnkgPSBmYWxzZTtcbiAgICAgIHNlbGYuX3BvbGxRdWVyeSgpO1xuICAgIH0gZWxzZSBpZiAoc2VsZi5fbmVlZFRvRmV0Y2guZW1wdHkoKSkge1xuICAgICAgYXdhaXQgc2VsZi5fYmVTdGVhZHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fZmV0Y2hNb2RpZmllZERvY3VtZW50cygpO1xuICAgIH1cbiAgfSxcblxuICBfY3Vyc29yRm9yUXVlcnk6IGZ1bmN0aW9uIChvcHRpb25zT3ZlcndyaXRlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBUaGUgcXVlcnkgd2UgcnVuIGlzIGFsbW9zdCB0aGUgc2FtZSBhcyB0aGUgY3Vyc29yIHdlIGFyZSBvYnNlcnZpbmcsXG4gICAgICAvLyB3aXRoIGEgZmV3IGNoYW5nZXMuIFdlIG5lZWQgdG8gcmVhZCBhbGwgdGhlIGZpZWxkcyB0aGF0IGFyZSByZWxldmFudCB0b1xuICAgICAgLy8gdGhlIHNlbGVjdG9yLCBub3QganVzdCB0aGUgZmllbGRzIHdlIGFyZSBnb2luZyB0byBwdWJsaXNoICh0aGF0J3MgdGhlXG4gICAgICAvLyBcInNoYXJlZFwiIHByb2plY3Rpb24pLiBBbmQgd2UgZG9uJ3Qgd2FudCB0byBhcHBseSBhbnkgdHJhbnNmb3JtIGluIHRoZVxuICAgICAgLy8gY3Vyc29yLCBiZWNhdXNlIG9ic2VydmVDaGFuZ2VzIHNob3VsZG4ndCB1c2UgdGhlIHRyYW5zZm9ybS5cbiAgICAgIHZhciBvcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucyk7XG5cbiAgICAgIC8vIEFsbG93IHRoZSBjYWxsZXIgdG8gbW9kaWZ5IHRoZSBvcHRpb25zLiBVc2VmdWwgdG8gc3BlY2lmeSBkaWZmZXJlbnRcbiAgICAgIC8vIHNraXAgYW5kIGxpbWl0IHZhbHVlcy5cbiAgICAgIE9iamVjdC5hc3NpZ24ob3B0aW9ucywgb3B0aW9uc092ZXJ3cml0ZSk7XG5cbiAgICAgIG9wdGlvbnMuZmllbGRzID0gc2VsZi5fc2hhcmVkUHJvamVjdGlvbjtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLnRyYW5zZm9ybTtcbiAgICAgIC8vIFdlIGFyZSBOT1QgZGVlcCBjbG9uaW5nIGZpZWxkcyBvciBzZWxlY3RvciBoZXJlLCB3aGljaCBzaG91bGQgYmUgT0suXG4gICAgICB2YXIgZGVzY3JpcHRpb24gPSBuZXcgQ3Vyc29yRGVzY3JpcHRpb24oXG4gICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3RvcixcbiAgICAgICAgb3B0aW9ucyk7XG4gICAgICByZXR1cm4gbmV3IEN1cnNvcihzZWxmLl9tb25nb0hhbmRsZSwgZGVzY3JpcHRpb24pO1xuICAgIH0pO1xuICB9LFxuXG5cbiAgLy8gUmVwbGFjZSBzZWxmLl9wdWJsaXNoZWQgd2l0aCBuZXdSZXN1bHRzIChib3RoIGFyZSBJZE1hcHMpLCBpbnZva2luZyBvYnNlcnZlXG4gIC8vIGNhbGxiYWNrcyBvbiB0aGUgbXVsdGlwbGV4ZXIuXG4gIC8vIFJlcGxhY2Ugc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIgd2l0aCBuZXdCdWZmZXIuXG4gIC8vXG4gIC8vIFhYWCBUaGlzIGlzIHZlcnkgc2ltaWxhciB0byBMb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeVVub3JkZXJlZENoYW5nZXMuIFdlXG4gIC8vIHNob3VsZCByZWFsbHk6IChhKSBVbmlmeSBJZE1hcCBhbmQgT3JkZXJlZERpY3QgaW50byBVbm9yZGVyZWQvT3JkZXJlZERpY3RcbiAgLy8gKGIpIFJld3JpdGUgZGlmZi5qcyB0byB1c2UgdGhlc2UgY2xhc3NlcyBpbnN0ZWFkIG9mIGFycmF5cyBhbmQgb2JqZWN0cy5cbiAgX3B1Ymxpc2hOZXdSZXN1bHRzOiBmdW5jdGlvbiAobmV3UmVzdWx0cywgbmV3QnVmZmVyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcblxuICAgICAgLy8gSWYgdGhlIHF1ZXJ5IGlzIGxpbWl0ZWQgYW5kIHRoZXJlIGlzIGEgYnVmZmVyLCBzaHV0IGRvd24gc28gaXQgZG9lc24ndFxuICAgICAgLy8gc3RheSBpbiBhIHdheS5cbiAgICAgIGlmIChzZWxmLl9saW1pdCkge1xuICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5jbGVhcigpO1xuICAgICAgfVxuXG4gICAgICAvLyBGaXJzdCByZW1vdmUgYW55dGhpbmcgdGhhdCdzIGdvbmUuIEJlIGNhcmVmdWwgbm90IHRvIG1vZGlmeVxuICAgICAgLy8gc2VsZi5fcHVibGlzaGVkIHdoaWxlIGl0ZXJhdGluZyBvdmVyIGl0LlxuICAgICAgdmFyIGlkc1RvUmVtb3ZlID0gW107XG4gICAgICBzZWxmLl9wdWJsaXNoZWQuZm9yRWFjaChmdW5jdGlvbiAoZG9jLCBpZCkge1xuICAgICAgICBpZiAoIW5ld1Jlc3VsdHMuaGFzKGlkKSlcbiAgICAgICAgICBpZHNUb1JlbW92ZS5wdXNoKGlkKTtcbiAgICAgIH0pO1xuICAgICAgaWRzVG9SZW1vdmUuZm9yRWFjaChmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgc2VsZi5fcmVtb3ZlUHVibGlzaGVkKGlkKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBOb3cgZG8gYWRkcyBhbmQgY2hhbmdlcy5cbiAgICAgIC8vIElmIHNlbGYgaGFzIGEgYnVmZmVyIGFuZCBsaW1pdCwgdGhlIG5ldyBmZXRjaGVkIHJlc3VsdCB3aWxsIGJlXG4gICAgICAvLyBsaW1pdGVkIGNvcnJlY3RseSBhcyB0aGUgcXVlcnkgaGFzIHNvcnQgc3BlY2lmaWVyLlxuICAgICAgbmV3UmVzdWx0cy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgIHNlbGYuX2hhbmRsZURvYyhpZCwgZG9jKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBTYW5pdHktY2hlY2sgdGhhdCBldmVyeXRoaW5nIHdlIHRyaWVkIHRvIHB1dCBpbnRvIF9wdWJsaXNoZWQgZW5kZWQgdXBcbiAgICAgIC8vIHRoZXJlLlxuICAgICAgLy8gWFhYIGlmIHRoaXMgaXMgc2xvdywgcmVtb3ZlIGl0IGxhdGVyXG4gICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLnNpemUoKSAhPT0gbmV3UmVzdWx0cy5zaXplKCkpIHtcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZygnVGhlIE1vbmdvIHNlcnZlciBhbmQgdGhlIE1ldGVvciBxdWVyeSBkaXNhZ3JlZSBvbiBob3cgJyArXG4gICAgICAgICAgJ21hbnkgZG9jdW1lbnRzIG1hdGNoIHlvdXIgcXVlcnkuIEN1cnNvciBkZXNjcmlwdGlvbjogJyxcbiAgICAgICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbik7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgIGlmICghbmV3UmVzdWx0cy5oYXMoaWQpKVxuICAgICAgICAgIHRocm93IEVycm9yKFwiX3B1Ymxpc2hlZCBoYXMgYSBkb2MgdGhhdCBuZXdSZXN1bHRzIGRvZXNuJ3Q7IFwiICsgaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEZpbmFsbHksIHJlcGxhY2UgdGhlIGJ1ZmZlclxuICAgICAgbmV3QnVmZmVyLmZvckVhY2goZnVuY3Rpb24gKGRvYywgaWQpIHtcbiAgICAgICAgc2VsZi5fYWRkQnVmZmVyZWQoaWQsIGRvYyk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gbmV3QnVmZmVyLnNpemUoKSA8IHNlbGYuX2xpbWl0O1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFRoaXMgc3RvcCBmdW5jdGlvbiBpcyBpbnZva2VkIGZyb20gdGhlIG9uU3RvcCBvZiB0aGUgT2JzZXJ2ZU11bHRpcGxleGVyLCBzb1xuICAvLyBpdCBzaG91bGRuJ3QgYWN0dWFsbHkgYmUgcG9zc2libGUgdG8gY2FsbCBpdCB1bnRpbCB0aGUgbXVsdGlwbGV4ZXIgaXNcbiAgLy8gcmVhZHkuXG4gIC8vXG4gIC8vIEl0J3MgaW1wb3J0YW50IHRvIGNoZWNrIHNlbGYuX3N0b3BwZWQgYWZ0ZXIgZXZlcnkgY2FsbCBpbiB0aGlzIGZpbGUgdGhhdFxuICAvLyBjYW4geWllbGQhXG4gIF9zdG9wOiBhc3luYyBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc3RvcHBlZCA9IHRydWU7XG5cbiAgICAvLyBOb3RlOiB3ZSAqZG9uJ3QqIHVzZSBtdWx0aXBsZXhlci5vbkZsdXNoIGhlcmUgYmVjYXVzZSB0aGlzIHN0b3BcbiAgICAvLyBjYWxsYmFjayBpcyBhY3R1YWxseSBpbnZva2VkIGJ5IHRoZSBtdWx0aXBsZXhlciBpdHNlbGYgd2hlbiBpdCBoYXNcbiAgICAvLyBkZXRlcm1pbmVkIHRoYXQgdGhlcmUgYXJlIG5vIGhhbmRsZXMgbGVmdC4gU28gbm90aGluZyBpcyBhY3R1YWxseSBnb2luZ1xuICAgIC8vIHRvIGdldCBmbHVzaGVkIChhbmQgaXQncyBwcm9iYWJseSBub3QgdmFsaWQgdG8gY2FsbCBtZXRob2RzIG9uIHRoZVxuICAgIC8vIGR5aW5nIG11bHRpcGxleGVyKS5cbiAgICBmb3IgKGNvbnN0IHcgb2Ygc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSkge1xuICAgICAgYXdhaXQgdy5jb21taXR0ZWQoKTtcbiAgICB9XG4gICAgc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSA9IG51bGw7XG5cbiAgICAvLyBQcm9hY3RpdmVseSBkcm9wIHJlZmVyZW5jZXMgdG8gcG90ZW50aWFsbHkgYmlnIHRoaW5ncy5cbiAgICBzZWxmLl9wdWJsaXNoZWQgPSBudWxsO1xuICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyID0gbnVsbDtcbiAgICBzZWxmLl9uZWVkVG9GZXRjaCA9IG51bGw7XG4gICAgc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcgPSBudWxsO1xuICAgIHNlbGYuX29wbG9nRW50cnlIYW5kbGUgPSBudWxsO1xuICAgIHNlbGYuX2xpc3RlbmVyc0hhbmRsZSA9IG51bGw7XG5cbiAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtb3Bsb2dcIiwgLTEpO1xuXG4gICAgZm9yIGF3YWl0IChjb25zdCBoYW5kbGUgb2Ygc2VsZi5fc3RvcEhhbmRsZXMpIHtcbiAgICAgIGF3YWl0IGhhbmRsZS5zdG9wKCk7XG4gICAgfVxuICB9LFxuICBzdG9wOiBhc3luYyBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gYXdhaXQgc2VsZi5fc3RvcCgpO1xuICB9LFxuXG4gIF9yZWdpc3RlclBoYXNlQ2hhbmdlOiBmdW5jdGlvbiAocGhhc2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG5vdyA9IG5ldyBEYXRlO1xuXG4gICAgICBpZiAoc2VsZi5fcGhhc2UpIHtcbiAgICAgICAgdmFyIHRpbWVEaWZmID0gbm93IC0gc2VsZi5fcGhhc2VTdGFydFRpbWU7XG4gICAgICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwidGltZS1zcGVudC1pbi1cIiArIHNlbGYuX3BoYXNlICsgXCItcGhhc2VcIiwgdGltZURpZmYpO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9waGFzZSA9IHBoYXNlO1xuICAgICAgc2VsZi5fcGhhc2VTdGFydFRpbWUgPSBub3c7XG4gICAgfSk7XG4gIH1cbn0pO1xuXG4vLyBEb2VzIG91ciBvcGxvZyB0YWlsaW5nIGNvZGUgc3VwcG9ydCB0aGlzIGN1cnNvcj8gRm9yIG5vdywgd2UgYXJlIGJlaW5nIHZlcnlcbi8vIGNvbnNlcnZhdGl2ZSBhbmQgYWxsb3dpbmcgb25seSBzaW1wbGUgcXVlcmllcyB3aXRoIHNpbXBsZSBvcHRpb25zLlxuLy8gKFRoaXMgaXMgYSBcInN0YXRpYyBtZXRob2RcIi4pXG5PcGxvZ09ic2VydmVEcml2ZXIuY3Vyc29yU3VwcG9ydGVkID0gZnVuY3Rpb24gKGN1cnNvckRlc2NyaXB0aW9uLCBtYXRjaGVyKSB7XG4gIC8vIEZpcnN0LCBjaGVjayB0aGUgb3B0aW9ucy5cbiAgdmFyIG9wdGlvbnMgPSBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zO1xuXG4gIC8vIERpZCB0aGUgdXNlciBzYXkgbm8gZXhwbGljaXRseT9cbiAgLy8gdW5kZXJzY29yZWQgdmVyc2lvbiBvZiB0aGUgb3B0aW9uIGlzIENPTVBBVCB3aXRoIDEuMlxuICBpZiAob3B0aW9ucy5kaXNhYmxlT3Bsb2cgfHwgb3B0aW9ucy5fZGlzYWJsZU9wbG9nKVxuICAgIHJldHVybiBmYWxzZTtcblxuICAvLyBza2lwIGlzIG5vdCBzdXBwb3J0ZWQ6IHRvIHN1cHBvcnQgaXQgd2Ugd291bGQgbmVlZCB0byBrZWVwIHRyYWNrIG9mIGFsbFxuICAvLyBcInNraXBwZWRcIiBkb2N1bWVudHMgb3IgYXQgbGVhc3QgdGhlaXIgaWRzLlxuICAvLyBsaW1pdCB3L28gYSBzb3J0IHNwZWNpZmllciBpcyBub3Qgc3VwcG9ydGVkOiBjdXJyZW50IGltcGxlbWVudGF0aW9uIG5lZWRzIGFcbiAgLy8gZGV0ZXJtaW5pc3RpYyB3YXkgdG8gb3JkZXIgZG9jdW1lbnRzLlxuICBpZiAob3B0aW9ucy5za2lwIHx8IChvcHRpb25zLmxpbWl0ICYmICFvcHRpb25zLnNvcnQpKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gSWYgYSBmaWVsZHMgcHJvamVjdGlvbiBvcHRpb24gaXMgZ2l2ZW4gY2hlY2sgaWYgaXQgaXMgc3VwcG9ydGVkIGJ5XG4gIC8vIG1pbmltb25nbyAoc29tZSBvcGVyYXRvcnMgYXJlIG5vdCBzdXBwb3J0ZWQpLlxuICBjb25zdCBmaWVsZHMgPSBvcHRpb25zLmZpZWxkcyB8fCBvcHRpb25zLnByb2plY3Rpb247XG4gIGlmIChmaWVsZHMpIHtcbiAgICB0cnkge1xuICAgICAgTG9jYWxDb2xsZWN0aW9uLl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24oZmllbGRzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5uYW1lID09PSBcIk1pbmltb25nb0Vycm9yXCIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBXZSBkb24ndCBhbGxvdyB0aGUgZm9sbG93aW5nIHNlbGVjdG9yczpcbiAgLy8gICAtICR3aGVyZSAobm90IGNvbmZpZGVudCB0aGF0IHdlIHByb3ZpZGUgdGhlIHNhbWUgSlMgZW52aXJvbm1lbnRcbiAgLy8gICAgICAgICAgICAgYXMgTW9uZ28sIGFuZCBjYW4geWllbGQhKVxuICAvLyAgIC0gJG5lYXIgKGhhcyBcImludGVyZXN0aW5nXCIgcHJvcGVydGllcyBpbiBNb25nb0RCLCBsaWtlIHRoZSBwb3NzaWJpbGl0eVxuICAvLyAgICAgICAgICAgIG9mIHJldHVybmluZyBhbiBJRCBtdWx0aXBsZSB0aW1lcywgdGhvdWdoIGV2ZW4gcG9sbGluZyBtYXliZVxuICAvLyAgICAgICAgICAgIGhhdmUgYSBidWcgdGhlcmUpXG4gIC8vICAgICAgICAgICBYWFg6IG9uY2Ugd2Ugc3VwcG9ydCBpdCwgd2Ugd291bGQgbmVlZCB0byB0aGluayBtb3JlIG9uIGhvdyB3ZVxuICAvLyAgICAgICAgICAgaW5pdGlhbGl6ZSB0aGUgY29tcGFyYXRvcnMgd2hlbiB3ZSBjcmVhdGUgdGhlIGRyaXZlci5cbiAgcmV0dXJuICFtYXRjaGVyLmhhc1doZXJlKCkgJiYgIW1hdGNoZXIuaGFzR2VvUXVlcnkoKTtcbn07XG5cbnZhciBtb2RpZmllckNhbkJlRGlyZWN0bHlBcHBsaWVkID0gZnVuY3Rpb24gKG1vZGlmaWVyKSB7XG4gIHJldHVybiBPYmplY3QuZW50cmllcyhtb2RpZmllcikuZXZlcnkoZnVuY3Rpb24gKFtvcGVyYXRpb24sIGZpZWxkc10pIHtcbiAgICByZXR1cm4gT2JqZWN0LmVudHJpZXMoZmllbGRzKS5ldmVyeShmdW5jdGlvbiAoW2ZpZWxkLCB2YWx1ZV0pIHtcbiAgICAgIHJldHVybiAhL0VKU09OXFwkLy50ZXN0KGZpZWxkKTtcbiAgICB9KTtcbiAgfSk7XG59OyIsIi8qKlxuICogQ29udmVydGVyIG1vZHVsZSBmb3IgdGhlIG5ldyBNb25nb0RCIE9wbG9nIGZvcm1hdCAoPj01LjApIHRvIHRoZSBvbmUgdGhhdCBNZXRlb3JcbiAqIGhhbmRsZXMgd2VsbCwgaS5lLiwgYCRzZXRgIGFuZCBgJHVuc2V0YC4gVGhlIG5ldyBmb3JtYXQgaXMgY29tcGxldGVseSBuZXcsXG4gKiBhbmQgbG9va3MgYXMgZm9sbG93czpcbiAqXG4gKiBgYGBqc1xuICogeyAkdjogMiwgZGlmZjogRGlmZiB9XG4gKiBgYGBcbiAqXG4gKiB3aGVyZSBgRGlmZmAgaXMgYSByZWN1cnNpdmUgc3RydWN0dXJlOlxuICogYGBganNcbiAqIHtcbiAqICAgLy8gTmVzdGVkIHVwZGF0ZXMgKHNvbWV0aW1lcyBhbHNvIHJlcHJlc2VudGVkIHdpdGggYW4gcy1maWVsZCkuXG4gKiAgIC8vIEV4YW1wbGU6IGB7ICRzZXQ6IHsgJ2Zvby5iYXInOiAxIH0gfWAuXG4gKiAgIGk6IHsgPGtleT46IDx2YWx1ZT4sIC4uLiB9LFxuICpcbiAqICAgLy8gVG9wLWxldmVsIHVwZGF0ZXMuXG4gKiAgIC8vIEV4YW1wbGU6IGB7ICRzZXQ6IHsgZm9vOiB7IGJhcjogMSB9IH0gfWAuXG4gKiAgIHU6IHsgPGtleT46IDx2YWx1ZT4sIC4uLiB9LFxuICpcbiAqICAgLy8gVW5zZXRzLlxuICogICAvLyBFeGFtcGxlOiBgeyAkdW5zZXQ6IHsgZm9vOiAnJyB9IH1gLlxuICogICBkOiB7IDxrZXk+OiBmYWxzZSwgLi4uIH0sXG4gKlxuICogICAvLyBBcnJheSBvcGVyYXRpb25zLlxuICogICAvLyBFeGFtcGxlOiBgeyAkcHVzaDogeyBmb286ICdiYXInIH0gfWAuXG4gKiAgIHM8a2V5PjogeyBhOiB0cnVlLCB1PGluZGV4PjogPHZhbHVlPiwgLi4uIH0sXG4gKiAgIC4uLlxuICpcbiAqICAgLy8gTmVzdGVkIG9wZXJhdGlvbnMgKHNvbWV0aW1lcyBhbHNvIHJlcHJlc2VudGVkIGluIHRoZSBgaWAgZmllbGQpLlxuICogICAvLyBFeGFtcGxlOiBgeyAkc2V0OiB7ICdmb28uYmFyJzogMSB9IH1gLlxuICogICBzPGtleT46IERpZmYsXG4gKiAgIC4uLlxuICogfVxuICogYGBgXG4gKlxuICogKGFsbCBmaWVsZHMgYXJlIG9wdGlvbmFsKVxuICovXG5cbmltcG9ydCB7IEVKU09OIH0gZnJvbSAnbWV0ZW9yL2Vqc29uJztcblxuaW50ZXJmYWNlIE9wbG9nRW50cnkge1xuICAkdjogbnVtYmVyO1xuICBkaWZmPzogT3Bsb2dEaWZmO1xuICAkc2V0PzogUmVjb3JkPHN0cmluZywgYW55PjtcbiAgJHVuc2V0PzogUmVjb3JkPHN0cmluZywgdHJ1ZT47XG59XG5cbmludGVyZmFjZSBPcGxvZ0RpZmYge1xuICBpPzogUmVjb3JkPHN0cmluZywgYW55PjtcbiAgdT86IFJlY29yZDxzdHJpbmcsIGFueT47XG4gIGQ/OiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPjtcbiAgW2tleTogYHMke3N0cmluZ31gXTogQXJyYXlPcGVyYXRvciB8IFJlY29yZDxzdHJpbmcsIGFueT47XG59XG5cbmludGVyZmFjZSBBcnJheU9wZXJhdG9yIHtcbiAgYTogdHJ1ZTtcbiAgW2tleTogYHUke251bWJlcn1gXTogYW55O1xufVxuXG5jb25zdCBhcnJheU9wZXJhdG9yS2V5UmVnZXggPSAvXihhfFtzdV1cXGQrKSQvO1xuXG4vKipcbiAqIENoZWNrcyBpZiBhIGZpZWxkIGlzIGFuIGFycmF5IG9wZXJhdG9yIGtleSBvZiBmb3JtICdhJyBvciAnczEnIG9yICd1MScgZXRjXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlPcGVyYXRvcktleShmaWVsZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBhcnJheU9wZXJhdG9yS2V5UmVnZXgudGVzdChmaWVsZCk7XG59XG5cbi8qKlxuICogVHlwZSBndWFyZCB0byBjaGVjayBpZiBhbiBvcGVyYXRvciBpcyBhIHZhbGlkIGFycmF5IG9wZXJhdG9yLlxuICogQXJyYXkgb3BlcmF0b3JzIGhhdmUgJ2E6IHRydWUnIGFuZCBrZXlzIHRoYXQgbWF0Y2ggdGhlIGFycmF5T3BlcmF0b3JLZXlSZWdleFxuICovXG5mdW5jdGlvbiBpc0FycmF5T3BlcmF0b3Iob3BlcmF0b3I6IHVua25vd24pOiBvcGVyYXRvciBpcyBBcnJheU9wZXJhdG9yIHtcbiAgcmV0dXJuIChcbiAgICBvcGVyYXRvciAhPT0gbnVsbCAmJlxuICAgIHR5cGVvZiBvcGVyYXRvciA9PT0gJ29iamVjdCcgJiZcbiAgICAnYScgaW4gb3BlcmF0b3IgJiZcbiAgICAob3BlcmF0b3IgYXMgQXJyYXlPcGVyYXRvcikuYSA9PT0gdHJ1ZSAmJlxuICAgIE9iamVjdC5rZXlzKG9wZXJhdG9yKS5ldmVyeShpc0FycmF5T3BlcmF0b3JLZXkpXG4gICk7XG59XG5cbi8qKlxuICogSm9pbnMgdHdvIHBhcnRzIG9mIGEgZmllbGQgcGF0aCB3aXRoIGEgZG90LlxuICogUmV0dXJucyB0aGUga2V5IGl0c2VsZiBpZiBwcmVmaXggaXMgZW1wdHkuXG4gKi9cbmZ1bmN0aW9uIGpvaW4ocHJlZml4OiBzdHJpbmcsIGtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHByZWZpeCA/IGAke3ByZWZpeH0uJHtrZXl9YCA6IGtleTtcbn1cblxuLyoqXG4gKiBSZWN1cnNpdmVseSBmbGF0dGVucyBhbiBvYmplY3QgaW50byBhIHRhcmdldCBvYmplY3Qgd2l0aCBkb3Qgbm90YXRpb24gcGF0aHMuXG4gKiBIYW5kbGVzIHNwZWNpYWwgY2FzZXM6XG4gKiAtIEFycmF5cyBhcmUgYXNzaWduZWQgZGlyZWN0bHlcbiAqIC0gQ3VzdG9tIEVKU09OIHR5cGVzIGFyZSBwcmVzZXJ2ZWRcbiAqIC0gTW9uZ28uT2JqZWN0SURzIGFyZSBwcmVzZXJ2ZWRcbiAqIC0gUGxhaW4gb2JqZWN0cyBhcmUgcmVjdXJzaXZlbHkgZmxhdHRlbmVkXG4gKiAtIEVtcHR5IG9iamVjdHMgYXJlIGFzc2lnbmVkIGRpcmVjdGx5XG4gKi9cbmZ1bmN0aW9uIGZsYXR0ZW5PYmplY3RJbnRvKFxuICB0YXJnZXQ6IFJlY29yZDxzdHJpbmcsIGFueT4sXG4gIHNvdXJjZTogYW55LFxuICBwcmVmaXg6IHN0cmluZ1xuKTogdm9pZCB7XG4gIGlmIChcbiAgICBBcnJheS5pc0FycmF5KHNvdXJjZSkgfHxcbiAgICB0eXBlb2Ygc291cmNlICE9PSAnb2JqZWN0JyB8fFxuICAgIHNvdXJjZSA9PT0gbnVsbCB8fFxuICAgIHNvdXJjZSBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEIHx8XG4gICAgRUpTT04uX2lzQ3VzdG9tVHlwZShzb3VyY2UpXG4gICkge1xuICAgIHRhcmdldFtwcmVmaXhdID0gc291cmNlO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyhzb3VyY2UpO1xuICBpZiAoZW50cmllcy5sZW5ndGgpIHtcbiAgICBlbnRyaWVzLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgZmxhdHRlbk9iamVjdEludG8odGFyZ2V0LCB2YWx1ZSwgam9pbihwcmVmaXgsIGtleSkpO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHRhcmdldFtwcmVmaXhdID0gc291cmNlO1xuICB9XG59XG5cbi8qKlxuICogQ29udmVydHMgYW4gb3Bsb2cgZGlmZiB0byBhIHNlcmllcyBvZiAkc2V0IGFuZCAkdW5zZXQgb3BlcmF0aW9ucy5cbiAqIEhhbmRsZXMgc2V2ZXJhbCB0eXBlcyBvZiBvcGVyYXRpb25zOlxuICogLSBEaXJlY3QgdW5zZXRzIHZpYSAnZCcgZmllbGRcbiAqIC0gTmVzdGVkIHNldHMgdmlhICdpJyBmaWVsZFxuICogLSBUb3AtbGV2ZWwgc2V0cyB2aWEgJ3UnIGZpZWxkXG4gKiAtIEFycmF5IG9wZXJhdGlvbnMgYW5kIG5lc3RlZCBvYmplY3RzIHZpYSAncycgcHJlZml4ZWQgZmllbGRzXG4gKlxuICogUHJlc2VydmVzIHRoZSBzdHJ1Y3R1cmUgb2YgRUpTT04gY3VzdG9tIHR5cGVzIGFuZCBPYmplY3RJRHMgd2hpbGVcbiAqIGZsYXR0ZW5pbmcgcGF0aHMgaW50byBkb3Qgbm90YXRpb24gZm9yIE1vbmdvREIgdXBkYXRlcy5cbiAqL1xuZnVuY3Rpb24gY29udmVydE9wbG9nRGlmZihcbiAgb3Bsb2dFbnRyeTogT3Bsb2dFbnRyeSxcbiAgZGlmZjogT3Bsb2dEaWZmLFxuICBwcmVmaXggPSAnJ1xuKTogdm9pZCB7XG4gIE9iamVjdC5lbnRyaWVzKGRpZmYpLmZvckVhY2goKFtkaWZmS2V5LCB2YWx1ZV0pID0+IHtcbiAgICBpZiAoZGlmZktleSA9PT0gJ2QnKSB7XG4gICAgICAvLyBIYW5kbGUgYCR1bnNldGBzXG4gICAgICBvcGxvZ0VudHJ5LiR1bnNldCA/Pz0ge307XG4gICAgICBPYmplY3Qua2V5cyh2YWx1ZSkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICBvcGxvZ0VudHJ5LiR1bnNldCFbam9pbihwcmVmaXgsIGtleSldID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoZGlmZktleSA9PT0gJ2knKSB7XG4gICAgICAvLyBIYW5kbGUgKHBvdGVudGlhbGx5KSBuZXN0ZWQgYCRzZXRgc1xuICAgICAgb3Bsb2dFbnRyeS4kc2V0ID8/PSB7fTtcbiAgICAgIGZsYXR0ZW5PYmplY3RJbnRvKG9wbG9nRW50cnkuJHNldCwgdmFsdWUsIHByZWZpeCk7XG4gICAgfSBlbHNlIGlmIChkaWZmS2V5ID09PSAndScpIHtcbiAgICAgIC8vIEhhbmRsZSBmbGF0IGAkc2V0YHNcbiAgICAgIG9wbG9nRW50cnkuJHNldCA/Pz0ge307XG4gICAgICBPYmplY3QuZW50cmllcyh2YWx1ZSkuZm9yRWFjaCgoW2tleSwgZmllbGRWYWx1ZV0pID0+IHtcbiAgICAgICAgb3Bsb2dFbnRyeS4kc2V0IVtqb2luKHByZWZpeCwga2V5KV0gPSBmaWVsZFZhbHVlO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChkaWZmS2V5LnN0YXJ0c1dpdGgoJ3MnKSkge1xuICAgICAgLy8gSGFuZGxlIHMtZmllbGRzIChhcnJheSBvcGVyYXRpb25zIGFuZCBuZXN0ZWQgb2JqZWN0cylcbiAgICAgIGNvbnN0IGtleSA9IGRpZmZLZXkuc2xpY2UoMSk7XG4gICAgICBpZiAoaXNBcnJheU9wZXJhdG9yKHZhbHVlKSkge1xuICAgICAgICAvLyBBcnJheSBvcGVyYXRvclxuICAgICAgICBPYmplY3QuZW50cmllcyh2YWx1ZSkuZm9yRWFjaCgoW3Bvc2l0aW9uLCBmaWVsZFZhbHVlXSkgPT4ge1xuICAgICAgICAgIGlmIChwb3NpdGlvbiA9PT0gJ2EnKSByZXR1cm47XG5cbiAgICAgICAgICBjb25zdCBwb3NpdGlvbktleSA9IGpvaW4ocHJlZml4LCBgJHtrZXl9LiR7cG9zaXRpb24uc2xpY2UoMSl9YCk7XG4gICAgICAgICAgaWYgKHBvc2l0aW9uWzBdID09PSAncycpIHtcbiAgICAgICAgICAgIGNvbnZlcnRPcGxvZ0RpZmYob3Bsb2dFbnRyeSwgZmllbGRWYWx1ZSwgcG9zaXRpb25LZXkpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZmllbGRWYWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgb3Bsb2dFbnRyeS4kdW5zZXQgPz89IHt9O1xuICAgICAgICAgICAgb3Bsb2dFbnRyeS4kdW5zZXRbcG9zaXRpb25LZXldID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3Bsb2dFbnRyeS4kc2V0ID8/PSB7fTtcbiAgICAgICAgICAgIG9wbG9nRW50cnkuJHNldFtwb3NpdGlvbktleV0gPSBmaWVsZFZhbHVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGtleSkge1xuICAgICAgICAvLyBOZXN0ZWQgb2JqZWN0XG4gICAgICAgIGNvbnZlcnRPcGxvZ0RpZmYob3Bsb2dFbnRyeSwgdmFsdWUsIGpvaW4ocHJlZml4LCBrZXkpKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGEgTW9uZ29EQiB2MiBvcGxvZyBlbnRyeSB0byB2MSBmb3JtYXQuXG4gKiBSZXR1cm5zIHRoZSBvcmlnaW5hbCBlbnRyeSB1bmNoYW5nZWQgaWYgaXQncyBub3QgYSB2MiBvcGxvZyBlbnRyeVxuICogb3IgZG9lc24ndCBjb250YWluIGEgZGlmZiBmaWVsZC5cbiAqXG4gKiBUaGUgY29udmVydGVkIGVudHJ5IHdpbGwgY29udGFpbiAkc2V0IGFuZCAkdW5zZXQgb3BlcmF0aW9ucyB0aGF0IGFyZVxuICogZXF1aXZhbGVudCB0byB0aGUgdjIgZGlmZiBmb3JtYXQsIHdpdGggcGF0aHMgZmxhdHRlbmVkIHRvIGRvdCBub3RhdGlvblxuICogYW5kIHNwZWNpYWwgaGFuZGxpbmcgZm9yIEVKU09OIGN1c3RvbSB0eXBlcyBhbmQgT2JqZWN0SURzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gb3Bsb2dWMlYxQ29udmVydGVyKG9wbG9nRW50cnk6IE9wbG9nRW50cnkpOiBPcGxvZ0VudHJ5IHtcbiAgaWYgKG9wbG9nRW50cnkuJHYgIT09IDIgfHwgIW9wbG9nRW50cnkuZGlmZikge1xuICAgIHJldHVybiBvcGxvZ0VudHJ5O1xuICB9XG5cbiAgY29uc3QgY29udmVydGVkT3Bsb2dFbnRyeTogT3Bsb2dFbnRyeSA9IHsgJHY6IDIgfTtcbiAgY29udmVydE9wbG9nRGlmZihjb252ZXJ0ZWRPcGxvZ0VudHJ5LCBvcGxvZ0VudHJ5LmRpZmYpO1xuICByZXR1cm4gY29udmVydGVkT3Bsb2dFbnRyeTtcbn0iLCJpbnRlcmZhY2UgQ3Vyc29yT3B0aW9ucyB7XG4gIGxpbWl0PzogbnVtYmVyO1xuICBza2lwPzogbnVtYmVyO1xuICBzb3J0PzogUmVjb3JkPHN0cmluZywgMSB8IC0xPjtcbiAgZmllbGRzPzogUmVjb3JkPHN0cmluZywgMSB8IDA+O1xuICBwcm9qZWN0aW9uPzogUmVjb3JkPHN0cmluZywgMSB8IDA+O1xuICBkaXNhYmxlT3Bsb2c/OiBib29sZWFuO1xuICBfZGlzYWJsZU9wbG9nPzogYm9vbGVhbjtcbiAgdGFpbGFibGU/OiBib29sZWFuO1xuICB0cmFuc2Zvcm0/OiAoZG9jOiBhbnkpID0+IGFueTtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSBhcmd1bWVudHMgdXNlZCB0byBjb25zdHJ1Y3QgYSBjdXJzb3IuXG4gKiBVc2VkIGFzIGEga2V5IGZvciBjdXJzb3IgZGUtZHVwbGljYXRpb24uXG4gKlxuICogQWxsIHByb3BlcnRpZXMgbXVzdCBiZSBlaXRoZXI6XG4gKiAtIEpTT04tc3RyaW5naWZpYWJsZSwgb3JcbiAqIC0gTm90IGFmZmVjdCBvYnNlcnZlQ2hhbmdlcyBvdXRwdXQgKGUuZy4sIG9wdGlvbnMudHJhbnNmb3JtIGZ1bmN0aW9ucylcbiAqL1xuZXhwb3J0IGNsYXNzIEN1cnNvckRlc2NyaXB0aW9uIHtcbiAgY29sbGVjdGlvbk5hbWU6IHN0cmluZztcbiAgc2VsZWN0b3I6IFJlY29yZDxzdHJpbmcsIGFueT47XG4gIG9wdGlvbnM6IEN1cnNvck9wdGlvbnM7XG5cbiAgY29uc3RydWN0b3IoY29sbGVjdGlvbk5hbWU6IHN0cmluZywgc2VsZWN0b3I6IGFueSwgb3B0aW9ucz86IEN1cnNvck9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbGxlY3Rpb25OYW1lID0gY29sbGVjdGlvbk5hbWU7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIHRoaXMuc2VsZWN0b3IgPSBNb25nby5Db2xsZWN0aW9uLl9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IpO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIH1cbn0iLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IENMSUVOVF9PTkxZX01FVEhPRFMsIGdldEFzeW5jTWV0aG9kTmFtZSB9IGZyb20gJ21ldGVvci9taW5pbW9uZ28vY29uc3RhbnRzJztcbmltcG9ydCB7IE1pbmlNb25nb1F1ZXJ5RXJyb3IgfSBmcm9tICdtZXRlb3IvbWluaW1vbmdvL2NvbW1vbic7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEFzeW5jaHJvbm91c0N1cnNvciB9IGZyb20gJy4vYXN5bmNocm9ub3VzX2N1cnNvcic7XG5pbXBvcnQgeyBDdXJzb3IgfSBmcm9tICcuL2N1cnNvcic7XG5pbXBvcnQgeyBDdXJzb3JEZXNjcmlwdGlvbiB9IGZyb20gJy4vY3Vyc29yX2Rlc2NyaXB0aW9uJztcbmltcG9ydCB7IERvY0ZldGNoZXIgfSBmcm9tICcuL2RvY19mZXRjaGVyJztcbmltcG9ydCB7IE1vbmdvREIsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvLCByZXBsYWNlVHlwZXMsIHRyYW5zZm9ybVJlc3VsdCB9IGZyb20gJy4vbW9uZ29fY29tbW9uJztcbmltcG9ydCB7IE9ic2VydmVIYW5kbGUgfSBmcm9tICcuL29ic2VydmVfaGFuZGxlJztcbmltcG9ydCB7IE9ic2VydmVNdWx0aXBsZXhlciB9IGZyb20gJy4vb2JzZXJ2ZV9tdWx0aXBsZXgnO1xuaW1wb3J0IHsgT3Bsb2dPYnNlcnZlRHJpdmVyIH0gZnJvbSAnLi9vcGxvZ19vYnNlcnZlX2RyaXZlcic7XG5pbXBvcnQgeyBPUExPR19DT0xMRUNUSU9OLCBPcGxvZ0hhbmRsZSB9IGZyb20gJy4vb3Bsb2dfdGFpbGluZyc7XG5pbXBvcnQgeyBQb2xsaW5nT2JzZXJ2ZURyaXZlciB9IGZyb20gJy4vcG9sbGluZ19vYnNlcnZlX2RyaXZlcic7XG5cbmNvbnN0IEZJTEVfQVNTRVRfU1VGRklYID0gJ0Fzc2V0JztcbmNvbnN0IEFTU0VUU19GT0xERVIgPSAnYXNzZXRzJztcbmNvbnN0IEFQUF9GT0xERVIgPSAnYXBwJztcblxuY29uc3Qgb3Bsb2dDb2xsZWN0aW9uV2FybmluZ3MgPSBbXTtcblxuZXhwb3J0IGNvbnN0IE1vbmdvQ29ubmVjdGlvbiA9IGZ1bmN0aW9uICh1cmwsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgc2VsZi5fb2JzZXJ2ZU11bHRpcGxleGVycyA9IHt9O1xuICBzZWxmLl9vbkZhaWxvdmVySG9vayA9IG5ldyBIb29rO1xuXG4gIGNvbnN0IHVzZXJPcHRpb25zID0ge1xuICAgIC4uLihNb25nby5fY29ubmVjdGlvbk9wdGlvbnMgfHwge30pLFxuICAgIC4uLihNZXRlb3Iuc2V0dGluZ3M/LnBhY2thZ2VzPy5tb25nbz8ub3B0aW9ucyB8fCB7fSlcbiAgfTtcblxuICB2YXIgbW9uZ29PcHRpb25zID0gT2JqZWN0LmFzc2lnbih7XG4gICAgaWdub3JlVW5kZWZpbmVkOiB0cnVlLFxuICB9LCB1c2VyT3B0aW9ucyk7XG5cblxuXG4gIC8vIEludGVybmFsbHkgdGhlIG9wbG9nIGNvbm5lY3Rpb25zIHNwZWNpZnkgdGhlaXIgb3duIG1heFBvb2xTaXplXG4gIC8vIHdoaWNoIHdlIGRvbid0IHdhbnQgdG8gb3ZlcndyaXRlIHdpdGggYW55IHVzZXIgZGVmaW5lZCB2YWx1ZVxuICBpZiAoJ21heFBvb2xTaXplJyBpbiBvcHRpb25zKSB7XG4gICAgLy8gSWYgd2UganVzdCBzZXQgdGhpcyBmb3IgXCJzZXJ2ZXJcIiwgcmVwbFNldCB3aWxsIG92ZXJyaWRlIGl0LiBJZiB3ZSBqdXN0XG4gICAgLy8gc2V0IGl0IGZvciByZXBsU2V0LCBpdCB3aWxsIGJlIGlnbm9yZWQgaWYgd2UncmUgbm90IHVzaW5nIGEgcmVwbFNldC5cbiAgICBtb25nb09wdGlvbnMubWF4UG9vbFNpemUgPSBvcHRpb25zLm1heFBvb2xTaXplO1xuICB9XG4gIGlmICgnbWluUG9vbFNpemUnIGluIG9wdGlvbnMpIHtcbiAgICBtb25nb09wdGlvbnMubWluUG9vbFNpemUgPSBvcHRpb25zLm1pblBvb2xTaXplO1xuICB9XG5cbiAgLy8gVHJhbnNmb3JtIG9wdGlvbnMgbGlrZSBcInRsc0NBRmlsZUFzc2V0XCI6IFwiZmlsZW5hbWUucGVtXCIgaW50b1xuICAvLyBcInRsc0NBRmlsZVwiOiBcIi88ZnVsbHBhdGg+L2ZpbGVuYW1lLnBlbVwiXG4gIE9iamVjdC5lbnRyaWVzKG1vbmdvT3B0aW9ucyB8fCB7fSlcbiAgICAuZmlsdGVyKChba2V5XSkgPT4ga2V5ICYmIGtleS5lbmRzV2l0aChGSUxFX0FTU0VUX1NVRkZJWCkpXG4gICAgLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY29uc3Qgb3B0aW9uTmFtZSA9IGtleS5yZXBsYWNlKEZJTEVfQVNTRVRfU1VGRklYLCAnJyk7XG4gICAgICBtb25nb09wdGlvbnNbb3B0aW9uTmFtZV0gPSBwYXRoLmpvaW4oQXNzZXRzLmdldFNlcnZlckRpcigpLFxuICAgICAgICBBU1NFVFNfRk9MREVSLCBBUFBfRk9MREVSLCB2YWx1ZSk7XG4gICAgICBkZWxldGUgbW9uZ29PcHRpb25zW2tleV07XG4gICAgfSk7XG5cbiAgc2VsZi5kYiA9IG51bGw7XG4gIHNlbGYuX29wbG9nSGFuZGxlID0gbnVsbDtcbiAgc2VsZi5fZG9jRmV0Y2hlciA9IG51bGw7XG5cbiAgbW9uZ29PcHRpb25zLmRyaXZlckluZm8gPSB7XG4gICAgbmFtZTogJ01ldGVvcicsXG4gICAgdmVyc2lvbjogTWV0ZW9yLnJlbGVhc2VcbiAgfVxuXG4gIHNlbGYuY2xpZW50ID0gbmV3IE1vbmdvREIuTW9uZ29DbGllbnQodXJsLCBtb25nb09wdGlvbnMpO1xuICBzZWxmLmRiID0gc2VsZi5jbGllbnQuZGIoKTtcblxuICBzZWxmLmNsaWVudC5vbignc2VydmVyRGVzY3JpcHRpb25DaGFuZ2VkJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChldmVudCA9PiB7XG4gICAgLy8gV2hlbiB0aGUgY29ubmVjdGlvbiBpcyBubyBsb25nZXIgYWdhaW5zdCB0aGUgcHJpbWFyeSBub2RlLCBleGVjdXRlIGFsbFxuICAgIC8vIGZhaWxvdmVyIGhvb2tzLiBUaGlzIGlzIGltcG9ydGFudCBmb3IgdGhlIGRyaXZlciBhcyBpdCBoYXMgdG8gcmUtcG9vbCB0aGVcbiAgICAvLyBxdWVyeSB3aGVuIGl0IGhhcHBlbnMuXG4gICAgaWYgKFxuICAgICAgZXZlbnQucHJldmlvdXNEZXNjcmlwdGlvbi50eXBlICE9PSAnUlNQcmltYXJ5JyAmJlxuICAgICAgZXZlbnQubmV3RGVzY3JpcHRpb24udHlwZSA9PT0gJ1JTUHJpbWFyeSdcbiAgICApIHtcbiAgICAgIHNlbGYuX29uRmFpbG92ZXJIb29rLmVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSkpO1xuXG4gIGlmIChvcHRpb25zLm9wbG9nVXJsICYmICEgUGFja2FnZVsnZGlzYWJsZS1vcGxvZyddKSB7XG4gICAgc2VsZi5fb3Bsb2dIYW5kbGUgPSBuZXcgT3Bsb2dIYW5kbGUob3B0aW9ucy5vcGxvZ1VybCwgc2VsZi5kYi5kYXRhYmFzZU5hbWUpO1xuICAgIHNlbGYuX2RvY0ZldGNoZXIgPSBuZXcgRG9jRmV0Y2hlcihzZWxmKTtcbiAgfVxuXG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9jbG9zZSA9IGFzeW5jIGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKCEgc2VsZi5kYilcbiAgICB0aHJvdyBFcnJvcihcImNsb3NlIGNhbGxlZCBiZWZvcmUgQ29ubmVjdGlvbiBjcmVhdGVkP1wiKTtcblxuICAvLyBYWFggcHJvYmFibHkgdW50ZXN0ZWRcbiAgdmFyIG9wbG9nSGFuZGxlID0gc2VsZi5fb3Bsb2dIYW5kbGU7XG4gIHNlbGYuX29wbG9nSGFuZGxlID0gbnVsbDtcbiAgaWYgKG9wbG9nSGFuZGxlKVxuICAgIGF3YWl0IG9wbG9nSGFuZGxlLnN0b3AoKTtcblxuICAvLyBVc2UgRnV0dXJlLndyYXAgc28gdGhhdCBlcnJvcnMgZ2V0IHRocm93bi4gVGhpcyBoYXBwZW5zIHRvXG4gIC8vIHdvcmsgZXZlbiBvdXRzaWRlIGEgZmliZXIgc2luY2UgdGhlICdjbG9zZScgbWV0aG9kIGlzIG5vdFxuICAvLyBhY3R1YWxseSBhc3luY2hyb25vdXMuXG4gIGF3YWl0IHNlbGYuY2xpZW50LmNsb3NlKCk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fY2xvc2UoKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX3NldE9wbG9nSGFuZGxlID0gZnVuY3Rpb24ob3Bsb2dIYW5kbGUpIHtcbiAgdGhpcy5fb3Bsb2dIYW5kbGUgPSBvcGxvZ0hhbmRsZTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBSZXR1cm5zIHRoZSBNb25nbyBDb2xsZWN0aW9uIG9iamVjdDsgbWF5IHlpZWxkLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5yYXdDb2xsZWN0aW9uID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoISBzZWxmLmRiKVxuICAgIHRocm93IEVycm9yKFwicmF3Q29sbGVjdGlvbiBjYWxsZWQgYmVmb3JlIENvbm5lY3Rpb24gY3JlYXRlZD9cIik7XG5cbiAgcmV0dXJuIHNlbGYuZGIuY29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChcbiAgY29sbGVjdGlvbk5hbWUsIGJ5dGVTaXplLCBtYXhEb2N1bWVudHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmICghIHNlbGYuZGIpXG4gICAgdGhyb3cgRXJyb3IoXCJjcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMgY2FsbGVkIGJlZm9yZSBDb25uZWN0aW9uIGNyZWF0ZWQ/XCIpO1xuXG5cbiAgYXdhaXQgc2VsZi5kYi5jcmVhdGVDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lLFxuICAgIHsgY2FwcGVkOiB0cnVlLCBzaXplOiBieXRlU2l6ZSwgbWF4OiBtYXhEb2N1bWVudHMgfSk7XG59O1xuXG4vLyBUaGlzIHNob3VsZCBiZSBjYWxsZWQgc3luY2hyb25vdXNseSB3aXRoIGEgd3JpdGUsIHRvIGNyZWF0ZSBhXG4vLyB0cmFuc2FjdGlvbiBvbiB0aGUgY3VycmVudCB3cml0ZSBmZW5jZSwgaWYgYW55LiBBZnRlciB3ZSBjYW4gcmVhZFxuLy8gdGhlIHdyaXRlLCBhbmQgYWZ0ZXIgb2JzZXJ2ZXJzIGhhdmUgYmVlbiBub3RpZmllZCAob3IgYXQgbGVhc3QsXG4vLyBhZnRlciB0aGUgb2JzZXJ2ZXIgbm90aWZpZXJzIGhhdmUgYWRkZWQgdGhlbXNlbHZlcyB0byB0aGUgd3JpdGVcbi8vIGZlbmNlKSwgeW91IHNob3VsZCBjYWxsICdjb21taXR0ZWQoKScgb24gdGhlIG9iamVjdCByZXR1cm5lZC5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX21heWJlQmVnaW5Xcml0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgY29uc3QgZmVuY2UgPSBERFBTZXJ2ZXIuX2dldEN1cnJlbnRGZW5jZSgpO1xuICBpZiAoZmVuY2UpIHtcbiAgICByZXR1cm4gZmVuY2UuYmVnaW5Xcml0ZSgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB7Y29tbWl0dGVkOiBmdW5jdGlvbiAoKSB7fX07XG4gIH1cbn07XG5cbi8vIEludGVybmFsIGludGVyZmFjZTogYWRkcyBhIGNhbGxiYWNrIHdoaWNoIGlzIGNhbGxlZCB3aGVuIHRoZSBNb25nbyBwcmltYXJ5XG4vLyBjaGFuZ2VzLiBSZXR1cm5zIGEgc3RvcCBoYW5kbGUuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9vbkZhaWxvdmVyID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHJldHVybiB0aGlzLl9vbkZhaWxvdmVySG9vay5yZWdpc3RlcihjYWxsYmFjayk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmluc2VydEFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb25fbmFtZSwgZG9jdW1lbnQpIHtcbiAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKGNvbGxlY3Rpb25fbmFtZSA9PT0gXCJfX19tZXRlb3JfZmFpbHVyZV90ZXN0X2NvbGxlY3Rpb25cIikge1xuICAgIGNvbnN0IGUgPSBuZXcgRXJyb3IoXCJGYWlsdXJlIHRlc3RcIik7XG4gICAgZS5fZXhwZWN0ZWRCeVRlc3QgPSB0cnVlO1xuICAgIHRocm93IGU7XG4gIH1cblxuICBpZiAoIShMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QoZG9jdW1lbnQpICYmXG4gICAgIUVKU09OLl9pc0N1c3RvbVR5cGUoZG9jdW1lbnQpKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIk9ubHkgcGxhaW4gb2JqZWN0cyBtYXkgYmUgaW5zZXJ0ZWQgaW50byBNb25nb0RCXCIpO1xuICB9XG5cbiAgdmFyIHdyaXRlID0gc2VsZi5fbWF5YmVCZWdpbldyaXRlKCk7XG4gIHZhciByZWZyZXNoID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIGF3YWl0IE1ldGVvci5yZWZyZXNoKHtjb2xsZWN0aW9uOiBjb2xsZWN0aW9uX25hbWUsIGlkOiBkb2N1bWVudC5faWQgfSk7XG4gIH07XG4gIHJldHVybiBzZWxmLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbl9uYW1lKS5pbnNlcnRPbmUoXG4gICAgcmVwbGFjZVR5cGVzKGRvY3VtZW50LCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksXG4gICAge1xuICAgICAgc2FmZTogdHJ1ZSxcbiAgICB9XG4gICkudGhlbihhc3luYyAoe2luc2VydGVkSWR9KSA9PiB7XG4gICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgIHJldHVybiBpbnNlcnRlZElkO1xuICB9KS5jYXRjaChhc3luYyBlID0+IHtcbiAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICB0aHJvdyBlO1xuICB9KTtcbn07XG5cblxuLy8gQ2F1c2UgcXVlcmllcyB0aGF0IG1heSBiZSBhZmZlY3RlZCBieSB0aGUgc2VsZWN0b3IgdG8gcG9sbCBpbiB0aGlzIHdyaXRlXG4vLyBmZW5jZS5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX3JlZnJlc2ggPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yKSB7XG4gIHZhciByZWZyZXNoS2V5ID0ge2NvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lfTtcbiAgLy8gSWYgd2Uga25vdyB3aGljaCBkb2N1bWVudHMgd2UncmUgcmVtb3ZpbmcsIGRvbid0IHBvbGwgcXVlcmllcyB0aGF0IGFyZVxuICAvLyBzcGVjaWZpYyB0byBvdGhlciBkb2N1bWVudHMuIChOb3RlIHRoYXQgbXVsdGlwbGUgbm90aWZpY2F0aW9ucyBoZXJlIHNob3VsZFxuICAvLyBub3QgY2F1c2UgbXVsdGlwbGUgcG9sbHMsIHNpbmNlIGFsbCBvdXIgbGlzdGVuZXIgaXMgZG9pbmcgaXMgZW5xdWV1ZWluZyBhXG4gIC8vIHBvbGwuKVxuICB2YXIgc3BlY2lmaWNJZHMgPSBMb2NhbENvbGxlY3Rpb24uX2lkc01hdGNoZWRCeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgaWYgKHNwZWNpZmljSWRzKSB7XG4gICAgZm9yIChjb25zdCBpZCBvZiBzcGVjaWZpY0lkcykge1xuICAgICAgYXdhaXQgTWV0ZW9yLnJlZnJlc2goT2JqZWN0LmFzc2lnbih7aWQ6IGlkfSwgcmVmcmVzaEtleSkpO1xuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgYXdhaXQgTWV0ZW9yLnJlZnJlc2gocmVmcmVzaEtleSk7XG4gIH1cbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUucmVtb3ZlQXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbl9uYW1lLCBzZWxlY3Rvcikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKGNvbGxlY3Rpb25fbmFtZSA9PT0gXCJfX19tZXRlb3JfZmFpbHVyZV90ZXN0X2NvbGxlY3Rpb25cIikge1xuICAgIHZhciBlID0gbmV3IEVycm9yKFwiRmFpbHVyZSB0ZXN0XCIpO1xuICAgIGUuX2V4cGVjdGVkQnlUZXN0ID0gdHJ1ZTtcbiAgICB0aHJvdyBlO1xuICB9XG5cbiAgdmFyIHdyaXRlID0gc2VsZi5fbWF5YmVCZWdpbldyaXRlKCk7XG4gIHZhciByZWZyZXNoID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIGF3YWl0IHNlbGYuX3JlZnJlc2goY29sbGVjdGlvbl9uYW1lLCBzZWxlY3Rvcik7XG4gIH07XG5cbiAgcmV0dXJuIHNlbGYucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uX25hbWUpXG4gICAgLmRlbGV0ZU1hbnkocmVwbGFjZVR5cGVzKHNlbGVjdG9yLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksIHtcbiAgICAgIHNhZmU6IHRydWUsXG4gICAgfSlcbiAgICAudGhlbihhc3luYyAoeyBkZWxldGVkQ291bnQgfSkgPT4ge1xuICAgICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICByZXR1cm4gdHJhbnNmb3JtUmVzdWx0KHsgcmVzdWx0IDoge21vZGlmaWVkQ291bnQgOiBkZWxldGVkQ291bnR9IH0pLm51bWJlckFmZmVjdGVkO1xuICAgIH0pLmNhdGNoKGFzeW5jIChlcnIpID0+IHtcbiAgICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH0pO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5kcm9wQ29sbGVjdGlvbkFzeW5jID0gYXN5bmMgZnVuY3Rpb24oY29sbGVjdGlvbk5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cbiAgdmFyIHdyaXRlID0gc2VsZi5fbWF5YmVCZWdpbldyaXRlKCk7XG4gIHZhciByZWZyZXNoID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIE1ldGVvci5yZWZyZXNoKHtcbiAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgaWQ6IG51bGwsXG4gICAgICBkcm9wQ29sbGVjdGlvbjogdHJ1ZSxcbiAgICB9KTtcbiAgfTtcblxuICByZXR1cm4gc2VsZlxuICAgIC5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKVxuICAgIC5kcm9wKClcbiAgICAudGhlbihhc3luYyByZXN1bHQgPT4ge1xuICAgICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0pXG4gICAgLmNhdGNoKGFzeW5jIGUgPT4ge1xuICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH0pO1xufTtcblxuLy8gRm9yIHRlc3Rpbmcgb25seS4gIFNsaWdodGx5IGJldHRlciB0aGFuIGBjLnJhd0RhdGFiYXNlKCkuZHJvcERhdGFiYXNlKClgXG4vLyBiZWNhdXNlIGl0IGxldHMgdGhlIHRlc3QncyBmZW5jZSB3YWl0IGZvciBpdCB0byBiZSBjb21wbGV0ZS5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZHJvcERhdGFiYXNlQXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICB2YXIgd3JpdGUgPSBzZWxmLl9tYXliZUJlZ2luV3JpdGUoKTtcbiAgdmFyIHJlZnJlc2ggPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgYXdhaXQgTWV0ZW9yLnJlZnJlc2goeyBkcm9wRGF0YWJhc2U6IHRydWUgfSk7XG4gIH07XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBzZWxmLmRiLl9kcm9wRGF0YWJhc2UoKTtcbiAgICBhd2FpdCByZWZyZXNoKCk7XG4gICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICB0aHJvdyBlO1xuICB9XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLnVwZGF0ZUFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IsIG1vZCwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKGNvbGxlY3Rpb25fbmFtZSA9PT0gXCJfX19tZXRlb3JfZmFpbHVyZV90ZXN0X2NvbGxlY3Rpb25cIikge1xuICAgIHZhciBlID0gbmV3IEVycm9yKFwiRmFpbHVyZSB0ZXN0XCIpO1xuICAgIGUuX2V4cGVjdGVkQnlUZXN0ID0gdHJ1ZTtcbiAgICB0aHJvdyBlO1xuICB9XG5cbiAgLy8gZXhwbGljaXQgc2FmZXR5IGNoZWNrLiBudWxsIGFuZCB1bmRlZmluZWQgY2FuIGNyYXNoIHRoZSBtb25nb1xuICAvLyBkcml2ZXIuIEFsdGhvdWdoIHRoZSBub2RlIGRyaXZlciBhbmQgbWluaW1vbmdvIGRvICdzdXBwb3J0J1xuICAvLyBub24tb2JqZWN0IG1vZGlmaWVyIGluIHRoYXQgdGhleSBkb24ndCBjcmFzaCwgdGhleSBhcmUgbm90XG4gIC8vIG1lYW5pbmdmdWwgb3BlcmF0aW9ucyBhbmQgZG8gbm90IGRvIGFueXRoaW5nLiBEZWZlbnNpdmVseSB0aHJvdyBhblxuICAvLyBlcnJvciBoZXJlLlxuICBpZiAoIW1vZCB8fCB0eXBlb2YgbW9kICE9PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFwiSW52YWxpZCBtb2RpZmllci4gTW9kaWZpZXIgbXVzdCBiZSBhbiBvYmplY3QuXCIpO1xuXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBpZiAoIShMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QobW9kKSAmJiAhRUpTT04uX2lzQ3VzdG9tVHlwZShtb2QpKSkge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgXCJPbmx5IHBsYWluIG9iamVjdHMgbWF5IGJlIHVzZWQgYXMgcmVwbGFjZW1lbnRcIiArXG4gICAgICBcIiBkb2N1bWVudHMgaW4gTW9uZ29EQlwiKTtcblxuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge307XG5cbiAgdmFyIHdyaXRlID0gc2VsZi5fbWF5YmVCZWdpbldyaXRlKCk7XG4gIHZhciByZWZyZXNoID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIGF3YWl0IHNlbGYuX3JlZnJlc2goY29sbGVjdGlvbl9uYW1lLCBzZWxlY3Rvcik7XG4gIH07XG5cbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbl9uYW1lKTtcbiAgdmFyIG1vbmdvT3B0cyA9IHtzYWZlOiB0cnVlfTtcbiAgLy8gQWRkIHN1cHBvcnQgZm9yIGZpbHRlcmVkIHBvc2l0aW9uYWwgb3BlcmF0b3JcbiAgaWYgKG9wdGlvbnMuYXJyYXlGaWx0ZXJzICE9PSB1bmRlZmluZWQpIG1vbmdvT3B0cy5hcnJheUZpbHRlcnMgPSBvcHRpb25zLmFycmF5RmlsdGVycztcbiAgLy8gZXhwbGljdGx5IGVudW1lcmF0ZSBvcHRpb25zIHRoYXQgbWluaW1vbmdvIHN1cHBvcnRzXG4gIGlmIChvcHRpb25zLnVwc2VydCkgbW9uZ29PcHRzLnVwc2VydCA9IHRydWU7XG4gIGlmIChvcHRpb25zLm11bHRpKSBtb25nb09wdHMubXVsdGkgPSB0cnVlO1xuICAvLyBMZXRzIHlvdSBnZXQgYSBtb3JlIG1vcmUgZnVsbCByZXN1bHQgZnJvbSBNb25nb0RCLiBVc2Ugd2l0aCBjYXV0aW9uOlxuICAvLyBtaWdodCBub3Qgd29yayB3aXRoIEMudXBzZXJ0IChhcyBvcHBvc2VkIHRvIEMudXBkYXRlKHt1cHNlcnQ6dHJ1ZX0pIG9yXG4gIC8vIHdpdGggc2ltdWxhdGVkIHVwc2VydC5cbiAgaWYgKG9wdGlvbnMuZnVsbFJlc3VsdCkgbW9uZ29PcHRzLmZ1bGxSZXN1bHQgPSB0cnVlO1xuXG4gIHZhciBtb25nb1NlbGVjdG9yID0gcmVwbGFjZVR5cGVzKHNlbGVjdG9yLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyk7XG4gIHZhciBtb25nb01vZCA9IHJlcGxhY2VUeXBlcyhtb2QsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKTtcblxuICB2YXIgaXNNb2RpZnkgPSBMb2NhbENvbGxlY3Rpb24uX2lzTW9kaWZpY2F0aW9uTW9kKG1vbmdvTW9kKTtcblxuICBpZiAob3B0aW9ucy5fZm9yYmlkUmVwbGFjZSAmJiAhaXNNb2RpZnkpIHtcbiAgICB2YXIgZXJyID0gbmV3IEVycm9yKFwiSW52YWxpZCBtb2RpZmllci4gUmVwbGFjZW1lbnRzIGFyZSBmb3JiaWRkZW4uXCIpO1xuICAgIHRocm93IGVycjtcbiAgfVxuXG4gIC8vIFdlJ3ZlIGFscmVhZHkgcnVuIHJlcGxhY2VUeXBlcy9yZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyBvblxuICAvLyBzZWxlY3RvciBhbmQgbW9kLiAgV2UgYXNzdW1lIGl0IGRvZXNuJ3QgbWF0dGVyLCBhcyBmYXIgYXNcbiAgLy8gdGhlIGJlaGF2aW9yIG9mIG1vZGlmaWVycyBpcyBjb25jZXJuZWQsIHdoZXRoZXIgYF9tb2RpZnlgXG4gIC8vIGlzIHJ1biBvbiBFSlNPTiBvciBvbiBtb25nby1jb252ZXJ0ZWQgRUpTT04uXG5cbiAgLy8gUnVuIHRoaXMgY29kZSB1cCBmcm9udCBzbyB0aGF0IGl0IGZhaWxzIGZhc3QgaWYgc29tZW9uZSB1c2VzXG4gIC8vIGEgTW9uZ28gdXBkYXRlIG9wZXJhdG9yIHdlIGRvbid0IHN1cHBvcnQuXG4gIGxldCBrbm93bklkO1xuICBpZiAob3B0aW9ucy51cHNlcnQpIHtcbiAgICB0cnkge1xuICAgICAgbGV0IG5ld0RvYyA9IExvY2FsQ29sbGVjdGlvbi5fY3JlYXRlVXBzZXJ0RG9jdW1lbnQoc2VsZWN0b3IsIG1vZCk7XG4gICAgICBrbm93bklkID0gbmV3RG9jLl9pZDtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH1cbiAgaWYgKG9wdGlvbnMudXBzZXJ0ICYmXG4gICAgISBpc01vZGlmeSAmJlxuICAgICEga25vd25JZCAmJlxuICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCAmJlxuICAgICEgKG9wdGlvbnMuaW5zZXJ0ZWRJZCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEICYmXG4gICAgICBvcHRpb25zLmdlbmVyYXRlZElkKSkge1xuICAgIC8vIEluIGNhc2Ugb2YgYW4gdXBzZXJ0IHdpdGggYSByZXBsYWNlbWVudCwgd2hlcmUgdGhlcmUgaXMgbm8gX2lkIGRlZmluZWRcbiAgICAvLyBpbiBlaXRoZXIgdGhlIHF1ZXJ5IG9yIHRoZSByZXBsYWNlbWVudCBkb2MsIG1vbmdvIHdpbGwgZ2VuZXJhdGUgYW4gaWQgaXRzZWxmLlxuICAgIC8vIFRoZXJlZm9yZSB3ZSBuZWVkIHRoaXMgc3BlY2lhbCBzdHJhdGVneSBpZiB3ZSB3YW50IHRvIGNvbnRyb2wgdGhlIGlkIG91cnNlbHZlcy5cblxuICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gZG8gdGhpcyB3aGVuOlxuICAgIC8vIC0gVGhpcyBpcyBub3QgYSByZXBsYWNlbWVudCwgc28gd2UgY2FuIGFkZCBhbiBfaWQgdG8gJHNldE9uSW5zZXJ0XG4gICAgLy8gLSBUaGUgaWQgaXMgZGVmaW5lZCBieSBxdWVyeSBvciBtb2Qgd2UgY2FuIGp1c3QgYWRkIGl0IHRvIHRoZSByZXBsYWNlbWVudCBkb2NcbiAgICAvLyAtIFRoZSB1c2VyIGRpZCBub3Qgc3BlY2lmeSBhbnkgaWQgcHJlZmVyZW5jZSBhbmQgdGhlIGlkIGlzIGEgTW9uZ28gT2JqZWN0SWQsXG4gICAgLy8gICAgIHRoZW4gd2UgY2FuIGp1c3QgbGV0IE1vbmdvIGdlbmVyYXRlIHRoZSBpZFxuICAgIHJldHVybiBhd2FpdCBzaW11bGF0ZVVwc2VydFdpdGhJbnNlcnRlZElkKGNvbGxlY3Rpb24sIG1vbmdvU2VsZWN0b3IsIG1vbmdvTW9kLCBvcHRpb25zKVxuICAgICAgLnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcbiAgICAgICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgICAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICAgICAgaWYgKHJlc3VsdCAmJiAhIG9wdGlvbnMuX3JldHVybk9iamVjdCkge1xuICAgICAgICAgIHJldHVybiByZXN1bHQubnVtYmVyQWZmZWN0ZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKG9wdGlvbnMudXBzZXJ0ICYmICFrbm93bklkICYmIG9wdGlvbnMuaW5zZXJ0ZWRJZCAmJiBpc01vZGlmeSkge1xuICAgICAgaWYgKCFtb25nb01vZC5oYXNPd25Qcm9wZXJ0eSgnJHNldE9uSW5zZXJ0JykpIHtcbiAgICAgICAgbW9uZ29Nb2QuJHNldE9uSW5zZXJ0ID0ge307XG4gICAgICB9XG4gICAgICBrbm93bklkID0gb3B0aW9ucy5pbnNlcnRlZElkO1xuICAgICAgT2JqZWN0LmFzc2lnbihtb25nb01vZC4kc2V0T25JbnNlcnQsIHJlcGxhY2VUeXBlcyh7X2lkOiBvcHRpb25zLmluc2VydGVkSWR9LCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbykpO1xuICAgIH1cblxuICAgIGNvbnN0IHN0cmluZ3MgPSBPYmplY3Qua2V5cyhtb25nb01vZCkuZmlsdGVyKChrZXkpID0+ICFrZXkuc3RhcnRzV2l0aChcIiRcIikpO1xuICAgIGxldCB1cGRhdGVNZXRob2QgPSBzdHJpbmdzLmxlbmd0aCA+IDAgPyAncmVwbGFjZU9uZScgOiAndXBkYXRlTWFueSc7XG4gICAgdXBkYXRlTWV0aG9kID1cbiAgICAgIHVwZGF0ZU1ldGhvZCA9PT0gJ3VwZGF0ZU1hbnknICYmICFtb25nb09wdHMubXVsdGlcbiAgICAgICAgPyAndXBkYXRlT25lJ1xuICAgICAgICA6IHVwZGF0ZU1ldGhvZDtcbiAgICByZXR1cm4gY29sbGVjdGlvblt1cGRhdGVNZXRob2RdXG4gICAgICAuYmluZChjb2xsZWN0aW9uKShtb25nb1NlbGVjdG9yLCBtb25nb01vZCwgbW9uZ29PcHRzKVxuICAgICAgLnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcbiAgICAgICAgdmFyIG1ldGVvclJlc3VsdCA9IHRyYW5zZm9ybVJlc3VsdCh7cmVzdWx0fSk7XG4gICAgICAgIGlmIChtZXRlb3JSZXN1bHQgJiYgb3B0aW9ucy5fcmV0dXJuT2JqZWN0KSB7XG4gICAgICAgICAgLy8gSWYgdGhpcyB3YXMgYW4gdXBzZXJ0QXN5bmMoKSBjYWxsLCBhbmQgd2UgZW5kZWQgdXBcbiAgICAgICAgICAvLyBpbnNlcnRpbmcgYSBuZXcgZG9jIGFuZCB3ZSBrbm93IGl0cyBpZCwgdGhlblxuICAgICAgICAgIC8vIHJldHVybiB0aGF0IGlkIGFzIHdlbGwuXG4gICAgICAgICAgaWYgKG9wdGlvbnMudXBzZXJ0ICYmIG1ldGVvclJlc3VsdC5pbnNlcnRlZElkKSB7XG4gICAgICAgICAgICBpZiAoa25vd25JZCkge1xuICAgICAgICAgICAgICBtZXRlb3JSZXN1bHQuaW5zZXJ0ZWRJZCA9IGtub3duSWQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG1ldGVvclJlc3VsdC5pbnNlcnRlZElkIGluc3RhbmNlb2YgTW9uZ29EQi5PYmplY3RJZCkge1xuICAgICAgICAgICAgICBtZXRlb3JSZXN1bHQuaW5zZXJ0ZWRJZCA9IG5ldyBNb25nby5PYmplY3RJRChtZXRlb3JSZXN1bHQuaW5zZXJ0ZWRJZC50b0hleFN0cmluZygpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgICAgICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgICAgICAgIHJldHVybiBtZXRlb3JSZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgICAgICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgICAgICAgIHJldHVybiBtZXRlb3JSZXN1bHQubnVtYmVyQWZmZWN0ZWQ7XG4gICAgICAgIH1cbiAgICAgIH0pLmNhdGNoKGFzeW5jIChlcnIpID0+IHtcbiAgICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH0pO1xuICB9XG59O1xuXG4vLyBleHBvc2VkIGZvciB0ZXN0aW5nXG5Nb25nb0Nvbm5lY3Rpb24uX2lzQ2Fubm90Q2hhbmdlSWRFcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcblxuICAvLyBNb25nbyAzLjIuKiByZXR1cm5zIGVycm9yIGFzIG5leHQgT2JqZWN0OlxuICAvLyB7bmFtZTogU3RyaW5nLCBjb2RlOiBOdW1iZXIsIGVycm1zZzogU3RyaW5nfVxuICAvLyBPbGRlciBNb25nbyByZXR1cm5zOlxuICAvLyB7bmFtZTogU3RyaW5nLCBjb2RlOiBOdW1iZXIsIGVycjogU3RyaW5nfVxuICB2YXIgZXJyb3IgPSBlcnIuZXJybXNnIHx8IGVyci5lcnI7XG5cbiAgLy8gV2UgZG9uJ3QgdXNlIHRoZSBlcnJvciBjb2RlIGhlcmVcbiAgLy8gYmVjYXVzZSB0aGUgZXJyb3IgY29kZSB3ZSBvYnNlcnZlZCBpdCBwcm9kdWNpbmcgKDE2ODM3KSBhcHBlYXJzIHRvIGJlXG4gIC8vIGEgZmFyIG1vcmUgZ2VuZXJpYyBlcnJvciBjb2RlIGJhc2VkIG9uIGV4YW1pbmluZyB0aGUgc291cmNlLlxuICBpZiAoZXJyb3IuaW5kZXhPZignVGhlIF9pZCBmaWVsZCBjYW5ub3QgYmUgY2hhbmdlZCcpID09PSAwXG4gICAgfHwgZXJyb3IuaW5kZXhPZihcInRoZSAoaW1tdXRhYmxlKSBmaWVsZCAnX2lkJyB3YXMgZm91bmQgdG8gaGF2ZSBiZWVuIGFsdGVyZWQgdG8gX2lkXCIpICE9PSAtMSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxuLy8gWFhYIE1vbmdvQ29ubmVjdGlvbi51cHNlcnRBc3luYygpIGRvZXMgbm90IHJldHVybiB0aGUgaWQgb2YgdGhlIGluc2VydGVkIGRvY3VtZW50XG4vLyB1bmxlc3MgeW91IHNldCBpdCBleHBsaWNpdGx5IGluIHRoZSBzZWxlY3RvciBvciBtb2RpZmllciAoYXMgYSByZXBsYWNlbWVudFxuLy8gZG9jKS5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUudXBzZXJ0QXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBtb2QsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cblxuICBpZiAodHlwZW9mIG9wdGlvbnMgPT09IFwiZnVuY3Rpb25cIiAmJiAhIGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgIG9wdGlvbnMgPSB7fTtcbiAgfVxuXG4gIHJldHVybiBzZWxmLnVwZGF0ZUFzeW5jKGNvbGxlY3Rpb25OYW1lLCBzZWxlY3RvciwgbW9kLFxuICAgIE9iamVjdC5hc3NpZ24oe30sIG9wdGlvbnMsIHtcbiAgICAgIHVwc2VydDogdHJ1ZSxcbiAgICAgIF9yZXR1cm5PYmplY3Q6IHRydWVcbiAgICB9KSk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSlcbiAgICBzZWxlY3RvciA9IHt9O1xuXG4gIHJldHVybiBuZXcgQ3Vyc29yKFxuICAgIHNlbGYsIG5ldyBDdXJzb3JEZXNjcmlwdGlvbihjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IsIG9wdGlvbnMpKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZmluZE9uZUFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgIHNlbGVjdG9yID0ge307XG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgb3B0aW9ucy5saW1pdCA9IDE7XG5cbiAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IHNlbGYuZmluZChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yLCBvcHRpb25zKS5mZXRjaCgpO1xuXG4gIHJldHVybiByZXN1bHRzWzBdO1xufTtcblxuLy8gV2UnbGwgYWN0dWFsbHkgZGVzaWduIGFuIGluZGV4IEFQSSBsYXRlci4gRm9yIG5vdywgd2UganVzdCBwYXNzIHRocm91Z2ggdG9cbi8vIE1vbmdvJ3MsIGJ1dCBtYWtlIGl0IHN5bmNocm9ub3VzLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVJbmRleEFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBpbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBXZSBleHBlY3QgdGhpcyBmdW5jdGlvbiB0byBiZSBjYWxsZWQgYXQgc3RhcnR1cCwgbm90IGZyb20gd2l0aGluIGEgbWV0aG9kLFxuICAvLyBzbyB3ZSBkb24ndCBpbnRlcmFjdCB3aXRoIHRoZSB3cml0ZSBmZW5jZS5cbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUpO1xuICBhd2FpdCBjb2xsZWN0aW9uLmNyZWF0ZUluZGV4KGluZGV4LCBvcHRpb25zKTtcbn07XG5cbi8vIGp1c3QgdG8gYmUgY29uc2lzdGVudCB3aXRoIHRoZSBvdGhlciBtZXRob2RzXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNyZWF0ZUluZGV4ID1cbiAgTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVJbmRleEFzeW5jO1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNvdW50RG9jdW1lbnRzID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCAuLi5hcmdzKSB7XG4gIGFyZ3MgPSBhcmdzLm1hcChhcmcgPT4gcmVwbGFjZVR5cGVzKGFyZywgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pKTtcbiAgY29uc3QgY29sbGVjdGlvbiA9IHRoaXMucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSk7XG4gIHJldHVybiBjb2xsZWN0aW9uLmNvdW50RG9jdW1lbnRzKC4uLmFyZ3MpO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5lc3RpbWF0ZWREb2N1bWVudENvdW50ID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCAuLi5hcmdzKSB7XG4gIGFyZ3MgPSBhcmdzLm1hcChhcmcgPT4gcmVwbGFjZVR5cGVzKGFyZywgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pKTtcbiAgY29uc3QgY29sbGVjdGlvbiA9IHRoaXMucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSk7XG4gIHJldHVybiBjb2xsZWN0aW9uLmVzdGltYXRlZERvY3VtZW50Q291bnQoLi4uYXJncyk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmVuc3VyZUluZGV4QXN5bmMgPSBNb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNyZWF0ZUluZGV4QXN5bmM7XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZHJvcEluZGV4QXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIGluZGV4KSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuXG4gIC8vIFRoaXMgZnVuY3Rpb24gaXMgb25seSB1c2VkIGJ5IHRlc3QgY29kZSwgbm90IHdpdGhpbiBhIG1ldGhvZCwgc28gd2UgZG9uJ3RcbiAgLy8gaW50ZXJhY3Qgd2l0aCB0aGUgd3JpdGUgZmVuY2UuXG4gIHZhciBjb2xsZWN0aW9uID0gc2VsZi5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKTtcbiAgdmFyIGluZGV4TmFtZSA9ICBhd2FpdCBjb2xsZWN0aW9uLmRyb3BJbmRleChpbmRleCk7XG59O1xuXG5cbkNMSUVOVF9PTkxZX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbiAobSkge1xuICBNb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlW21dID0gZnVuY3Rpb24gKCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGAke219ICsgIGlzIG5vdCBhdmFpbGFibGUgb24gdGhlIHNlcnZlci4gUGxlYXNlIHVzZSAke2dldEFzeW5jTWV0aG9kTmFtZShcbiAgICAgICAgbVxuICAgICAgKX0oKSBpbnN0ZWFkLmBcbiAgICApO1xuICB9O1xufSk7XG5cblxudmFyIE5VTV9PUFRJTUlTVElDX1RSSUVTID0gMztcblxuXG5cbnZhciBzaW11bGF0ZVVwc2VydFdpdGhJbnNlcnRlZElkID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb24sIHNlbGVjdG9yLCBtb2QsIG9wdGlvbnMpIHtcbiAgLy8gU1RSQVRFR1k6IEZpcnN0IHRyeSBkb2luZyBhbiB1cHNlcnQgd2l0aCBhIGdlbmVyYXRlZCBJRC5cbiAgLy8gSWYgdGhpcyB0aHJvd3MgYW4gZXJyb3IgYWJvdXQgY2hhbmdpbmcgdGhlIElEIG9uIGFuIGV4aXN0aW5nIGRvY3VtZW50XG4gIC8vIHRoZW4gd2l0aG91dCBhZmZlY3RpbmcgdGhlIGRhdGFiYXNlLCB3ZSBrbm93IHdlIHNob3VsZCBwcm9iYWJseSB0cnlcbiAgLy8gYW4gdXBkYXRlIHdpdGhvdXQgdGhlIGdlbmVyYXRlZCBJRC4gSWYgaXQgYWZmZWN0ZWQgMCBkb2N1bWVudHMsXG4gIC8vIHRoZW4gd2l0aG91dCBhZmZlY3RpbmcgdGhlIGRhdGFiYXNlLCB3ZSB0aGUgZG9jdW1lbnQgdGhhdCBmaXJzdFxuICAvLyBnYXZlIHRoZSBlcnJvciBpcyBwcm9iYWJseSByZW1vdmVkIGFuZCB3ZSBuZWVkIHRvIHRyeSBhbiBpbnNlcnQgYWdhaW5cbiAgLy8gV2UgZ28gYmFjayB0byBzdGVwIG9uZSBhbmQgcmVwZWF0LlxuICAvLyBMaWtlIGFsbCBcIm9wdGltaXN0aWMgd3JpdGVcIiBzY2hlbWVzLCB3ZSByZWx5IG9uIHRoZSBmYWN0IHRoYXQgaXQnc1xuICAvLyB1bmxpa2VseSBvdXIgd3JpdGVzIHdpbGwgY29udGludWUgdG8gYmUgaW50ZXJmZXJlZCB3aXRoIHVuZGVyIG5vcm1hbFxuICAvLyBjaXJjdW1zdGFuY2VzICh0aG91Z2ggc3VmZmljaWVudGx5IGhlYXZ5IGNvbnRlbnRpb24gd2l0aCB3cml0ZXJzXG4gIC8vIGRpc2FncmVlaW5nIG9uIHRoZSBleGlzdGVuY2Ugb2YgYW4gb2JqZWN0IHdpbGwgY2F1c2Ugd3JpdGVzIHRvIGZhaWxcbiAgLy8gaW4gdGhlb3J5KS5cblxuICB2YXIgaW5zZXJ0ZWRJZCA9IG9wdGlvbnMuaW5zZXJ0ZWRJZDsgLy8gbXVzdCBleGlzdFxuICB2YXIgbW9uZ29PcHRzRm9yVXBkYXRlID0ge1xuICAgIHNhZmU6IHRydWUsXG4gICAgbXVsdGk6IG9wdGlvbnMubXVsdGlcbiAgfTtcbiAgdmFyIG1vbmdvT3B0c0Zvckluc2VydCA9IHtcbiAgICBzYWZlOiB0cnVlLFxuICAgIHVwc2VydDogdHJ1ZVxuICB9O1xuXG4gIHZhciByZXBsYWNlbWVudFdpdGhJZCA9IE9iamVjdC5hc3NpZ24oXG4gICAgcmVwbGFjZVR5cGVzKHtfaWQ6IGluc2VydGVkSWR9LCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksXG4gICAgbW9kKTtcblxuICB2YXIgdHJpZXMgPSBOVU1fT1BUSU1JU1RJQ19UUklFUztcblxuICB2YXIgZG9VcGRhdGUgPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgdHJpZXMtLTtcbiAgICBpZiAoISB0cmllcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVXBzZXJ0IGZhaWxlZCBhZnRlciBcIiArIE5VTV9PUFRJTUlTVElDX1RSSUVTICsgXCIgdHJpZXMuXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgbWV0aG9kID0gY29sbGVjdGlvbi51cGRhdGVNYW55O1xuICAgICAgaWYoIU9iamVjdC5rZXlzKG1vZCkuc29tZShrZXkgPT4ga2V5LnN0YXJ0c1dpdGgoXCIkXCIpKSl7XG4gICAgICAgIG1ldGhvZCA9IGNvbGxlY3Rpb24ucmVwbGFjZU9uZS5iaW5kKGNvbGxlY3Rpb24pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG1ldGhvZChcbiAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgIG1vZCxcbiAgICAgICAgbW9uZ29PcHRzRm9yVXBkYXRlKS50aGVuKHJlc3VsdCA9PiB7XG4gICAgICAgIGlmIChyZXN1bHQgJiYgKHJlc3VsdC5tb2RpZmllZENvdW50IHx8IHJlc3VsdC51cHNlcnRlZENvdW50KSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBudW1iZXJBZmZlY3RlZDogcmVzdWx0Lm1vZGlmaWVkQ291bnQgfHwgcmVzdWx0LnVwc2VydGVkQ291bnQsXG4gICAgICAgICAgICBpbnNlcnRlZElkOiByZXN1bHQudXBzZXJ0ZWRJZCB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gZG9Db25kaXRpb25hbEluc2VydCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGRvQ29uZGl0aW9uYWxJbnNlcnQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gY29sbGVjdGlvbi5yZXBsYWNlT25lKHNlbGVjdG9yLCByZXBsYWNlbWVudFdpdGhJZCwgbW9uZ29PcHRzRm9ySW5zZXJ0KVxuICAgICAgLnRoZW4ocmVzdWx0ID0+ICh7XG4gICAgICAgIG51bWJlckFmZmVjdGVkOiByZXN1bHQudXBzZXJ0ZWRDb3VudCxcbiAgICAgICAgaW5zZXJ0ZWRJZDogcmVzdWx0LnVwc2VydGVkSWQsXG4gICAgICB9KSkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgaWYgKE1vbmdvQ29ubmVjdGlvbi5faXNDYW5ub3RDaGFuZ2VJZEVycm9yKGVycikpIHtcbiAgICAgICAgICByZXR1cm4gZG9VcGRhdGUoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gIH07XG4gIHJldHVybiBkb1VwZGF0ZSgpO1xufTtcblxuLy8gb2JzZXJ2ZUNoYW5nZXMgZm9yIHRhaWxhYmxlIGN1cnNvcnMgb24gY2FwcGVkIGNvbGxlY3Rpb25zLlxuLy9cbi8vIFNvbWUgZGlmZmVyZW5jZXMgZnJvbSBub3JtYWwgY3Vyc29yczpcbi8vICAgLSBXaWxsIG5ldmVyIHByb2R1Y2UgYW55dGhpbmcgb3RoZXIgdGhhbiAnYWRkZWQnIG9yICdhZGRlZEJlZm9yZScuIElmIHlvdVxuLy8gICAgIGRvIHVwZGF0ZSBhIGRvY3VtZW50IHRoYXQgaGFzIGFscmVhZHkgYmVlbiBwcm9kdWNlZCwgdGhpcyB3aWxsIG5vdCBub3RpY2Vcbi8vICAgICBpdC5cbi8vICAgLSBJZiB5b3UgZGlzY29ubmVjdCBhbmQgcmVjb25uZWN0IGZyb20gTW9uZ28sIGl0IHdpbGwgZXNzZW50aWFsbHkgcmVzdGFydFxuLy8gICAgIHRoZSBxdWVyeSwgd2hpY2ggd2lsbCBsZWFkIHRvIGR1cGxpY2F0ZSByZXN1bHRzLiBUaGlzIGlzIHByZXR0eSBiYWQsXG4vLyAgICAgYnV0IGlmIHlvdSBpbmNsdWRlIGEgZmllbGQgY2FsbGVkICd0cycgd2hpY2ggaXMgaW5zZXJ0ZWQgYXNcbi8vICAgICBuZXcgTW9uZ29JbnRlcm5hbHMuTW9uZ29UaW1lc3RhbXAoMCwgMCkgKHdoaWNoIGlzIGluaXRpYWxpemVkIHRvIHRoZVxuLy8gICAgIGN1cnJlbnQgTW9uZ28tc3R5bGUgdGltZXN0YW1wKSwgd2UnbGwgYmUgYWJsZSB0byBmaW5kIHRoZSBwbGFjZSB0b1xuLy8gICAgIHJlc3RhcnQgcHJvcGVybHkuIChUaGlzIGZpZWxkIGlzIHNwZWNpZmljYWxseSB1bmRlcnN0b29kIGJ5IE1vbmdvIHdpdGggYW5cbi8vICAgICBvcHRpbWl6YXRpb24gd2hpY2ggYWxsb3dzIGl0IHRvIGZpbmQgdGhlIHJpZ2h0IHBsYWNlIHRvIHN0YXJ0IHdpdGhvdXRcbi8vICAgICBhbiBpbmRleCBvbiB0cy4gSXQncyBob3cgdGhlIG9wbG9nIHdvcmtzLilcbi8vICAgLSBObyBjYWxsYmFja3MgYXJlIHRyaWdnZXJlZCBzeW5jaHJvbm91c2x5IHdpdGggdGhlIGNhbGwgKHRoZXJlJ3Mgbm9cbi8vICAgICBkaWZmZXJlbnRpYXRpb24gYmV0d2VlbiBcImluaXRpYWwgZGF0YVwiIGFuZCBcImxhdGVyIGNoYW5nZXNcIjsgZXZlcnl0aGluZ1xuLy8gICAgIHRoYXQgbWF0Y2hlcyB0aGUgcXVlcnkgZ2V0cyBzZW50IGFzeW5jaHJvbm91c2x5KS5cbi8vICAgLSBEZS1kdXBsaWNhdGlvbiBpcyBub3QgaW1wbGVtZW50ZWQuXG4vLyAgIC0gRG9lcyBub3QgeWV0IGludGVyYWN0IHdpdGggdGhlIHdyaXRlIGZlbmNlLiBQcm9iYWJseSwgdGhpcyBzaG91bGQgd29yayBieVxuLy8gICAgIGlnbm9yaW5nIHJlbW92ZXMgKHdoaWNoIGRvbid0IHdvcmsgb24gY2FwcGVkIGNvbGxlY3Rpb25zKSBhbmQgdXBkYXRlc1xuLy8gICAgICh3aGljaCBkb24ndCBhZmZlY3QgdGFpbGFibGUgY3Vyc29ycyksIGFuZCBqdXN0IGtlZXBpbmcgdHJhY2sgb2YgdGhlIElEXG4vLyAgICAgb2YgdGhlIGluc2VydGVkIG9iamVjdCwgYW5kIGNsb3NpbmcgdGhlIHdyaXRlIGZlbmNlIG9uY2UgeW91IGdldCB0byB0aGF0XG4vLyAgICAgSUQgKG9yIHRpbWVzdGFtcD8pLiAgVGhpcyBkb2Vzbid0IHdvcmsgd2VsbCBpZiB0aGUgZG9jdW1lbnQgZG9lc24ndCBtYXRjaFxuLy8gICAgIHRoZSBxdWVyeSwgdGhvdWdoLiAgT24gdGhlIG90aGVyIGhhbmQsIHRoZSB3cml0ZSBmZW5jZSBjYW4gY2xvc2Vcbi8vICAgICBpbW1lZGlhdGVseSBpZiBpdCBkb2VzIG5vdCBtYXRjaCB0aGUgcXVlcnkuIFNvIGlmIHdlIHRydXN0IG1pbmltb25nb1xuLy8gICAgIGVub3VnaCB0byBhY2N1cmF0ZWx5IGV2YWx1YXRlIHRoZSBxdWVyeSBhZ2FpbnN0IHRoZSB3cml0ZSBmZW5jZSwgd2Vcbi8vICAgICBzaG91bGQgYmUgYWJsZSB0byBkbyB0aGlzLi4uICBPZiBjb3Vyc2UsIG1pbmltb25nbyBkb2Vzbid0IGV2ZW4gc3VwcG9ydFxuLy8gICAgIE1vbmdvIFRpbWVzdGFtcHMgeWV0LlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fb2JzZXJ2ZUNoYW5nZXNUYWlsYWJsZSA9IGZ1bmN0aW9uIChcbiAgY3Vyc29yRGVzY3JpcHRpb24sIG9yZGVyZWQsIGNhbGxiYWNrcykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgLy8gVGFpbGFibGUgY3Vyc29ycyBvbmx5IGV2ZXIgY2FsbCBhZGRlZC9hZGRlZEJlZm9yZSBjYWxsYmFja3MsIHNvIGl0J3MgYW5cbiAgLy8gZXJyb3IgaWYgeW91IGRpZG4ndCBwcm92aWRlIHRoZW0uXG4gIGlmICgob3JkZXJlZCAmJiAhY2FsbGJhY2tzLmFkZGVkQmVmb3JlKSB8fFxuICAgICghb3JkZXJlZCAmJiAhY2FsbGJhY2tzLmFkZGVkKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IG9ic2VydmUgYW4gXCIgKyAob3JkZXJlZCA/IFwib3JkZXJlZFwiIDogXCJ1bm9yZGVyZWRcIilcbiAgICAgICsgXCIgdGFpbGFibGUgY3Vyc29yIHdpdGhvdXQgYSBcIlxuICAgICAgKyAob3JkZXJlZCA/IFwiYWRkZWRCZWZvcmVcIiA6IFwiYWRkZWRcIikgKyBcIiBjYWxsYmFja1wiKTtcbiAgfVxuXG4gIHJldHVybiBzZWxmLnRhaWwoY3Vyc29yRGVzY3JpcHRpb24sIGZ1bmN0aW9uIChkb2MpIHtcbiAgICB2YXIgaWQgPSBkb2MuX2lkO1xuICAgIGRlbGV0ZSBkb2MuX2lkO1xuICAgIC8vIFRoZSB0cyBpcyBhbiBpbXBsZW1lbnRhdGlvbiBkZXRhaWwuIEhpZGUgaXQuXG4gICAgZGVsZXRlIGRvYy50cztcbiAgICBpZiAob3JkZXJlZCkge1xuICAgICAgY2FsbGJhY2tzLmFkZGVkQmVmb3JlKGlkLCBkb2MsIG51bGwpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFja3MuYWRkZWQoaWQsIGRvYyk7XG4gICAgfVxuICB9KTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX2NyZWF0ZUFzeW5jaHJvbm91c0N1cnNvciA9IGZ1bmN0aW9uKFxuICBjdXJzb3JEZXNjcmlwdGlvbiwgb3B0aW9ucyA9IHt9KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY29uc3QgeyBzZWxmRm9ySXRlcmF0aW9uLCB1c2VUcmFuc2Zvcm0gfSA9IG9wdGlvbnM7XG4gIG9wdGlvbnMgPSB7IHNlbGZGb3JJdGVyYXRpb24sIHVzZVRyYW5zZm9ybSB9O1xuXG4gIHZhciBjb2xsZWN0aW9uID0gc2VsZi5yYXdDb2xsZWN0aW9uKGN1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lKTtcbiAgdmFyIGN1cnNvck9wdGlvbnMgPSBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zO1xuICB2YXIgbW9uZ29PcHRpb25zID0ge1xuICAgIHNvcnQ6IGN1cnNvck9wdGlvbnMuc29ydCxcbiAgICBsaW1pdDogY3Vyc29yT3B0aW9ucy5saW1pdCxcbiAgICBza2lwOiBjdXJzb3JPcHRpb25zLnNraXAsXG4gICAgcHJvamVjdGlvbjogY3Vyc29yT3B0aW9ucy5maWVsZHMgfHwgY3Vyc29yT3B0aW9ucy5wcm9qZWN0aW9uLFxuICAgIHJlYWRQcmVmZXJlbmNlOiBjdXJzb3JPcHRpb25zLnJlYWRQcmVmZXJlbmNlLFxuICB9O1xuXG4gIC8vIERvIHdlIHdhbnQgYSB0YWlsYWJsZSBjdXJzb3IgKHdoaWNoIG9ubHkgd29ya3Mgb24gY2FwcGVkIGNvbGxlY3Rpb25zKT9cbiAgaWYgKGN1cnNvck9wdGlvbnMudGFpbGFibGUpIHtcbiAgICBtb25nb09wdGlvbnMubnVtYmVyT2ZSZXRyaWVzID0gLTE7XG4gIH1cblxuICB2YXIgZGJDdXJzb3IgPSBjb2xsZWN0aW9uLmZpbmQoXG4gICAgcmVwbGFjZVR5cGVzKGN1cnNvckRlc2NyaXB0aW9uLnNlbGVjdG9yLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksXG4gICAgbW9uZ29PcHRpb25zKTtcblxuICAvLyBEbyB3ZSB3YW50IGEgdGFpbGFibGUgY3Vyc29yICh3aGljaCBvbmx5IHdvcmtzIG9uIGNhcHBlZCBjb2xsZWN0aW9ucyk/XG4gIGlmIChjdXJzb3JPcHRpb25zLnRhaWxhYmxlKSB7XG4gICAgLy8gV2Ugd2FudCBhIHRhaWxhYmxlIGN1cnNvci4uLlxuICAgIGRiQ3Vyc29yLmFkZEN1cnNvckZsYWcoXCJ0YWlsYWJsZVwiLCB0cnVlKVxuICAgIC8vIC4uLiBhbmQgZm9yIHRoZSBzZXJ2ZXIgdG8gd2FpdCBhIGJpdCBpZiBhbnkgZ2V0TW9yZSBoYXMgbm8gZGF0YSAocmF0aGVyXG4gICAgLy8gdGhhbiBtYWtpbmcgdXMgcHV0IHRoZSByZWxldmFudCBzbGVlcHMgaW4gdGhlIGNsaWVudCkuLi5cbiAgICBkYkN1cnNvci5hZGRDdXJzb3JGbGFnKFwiYXdhaXREYXRhXCIsIHRydWUpXG5cbiAgICAvLyBBbmQgaWYgdGhpcyBpcyBvbiB0aGUgb3Bsb2cgY29sbGVjdGlvbiBhbmQgdGhlIGN1cnNvciBzcGVjaWZpZXMgYSAndHMnLFxuICAgIC8vIHRoZW4gc2V0IHRoZSB1bmRvY3VtZW50ZWQgb3Bsb2cgcmVwbGF5IGZsYWcsIHdoaWNoIGRvZXMgYSBzcGVjaWFsIHNjYW4gdG9cbiAgICAvLyBmaW5kIHRoZSBmaXJzdCBkb2N1bWVudCAoaW5zdGVhZCBvZiBjcmVhdGluZyBhbiBpbmRleCBvbiB0cykuIFRoaXMgaXMgYVxuICAgIC8vIHZlcnkgaGFyZC1jb2RlZCBNb25nbyBmbGFnIHdoaWNoIG9ubHkgd29ya3Mgb24gdGhlIG9wbG9nIGNvbGxlY3Rpb24gYW5kXG4gICAgLy8gb25seSB3b3JrcyB3aXRoIHRoZSB0cyBmaWVsZC5cbiAgICBpZiAoY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWUgPT09IE9QTE9HX0NPTExFQ1RJT04gJiZcbiAgICAgIGN1cnNvckRlc2NyaXB0aW9uLnNlbGVjdG9yLnRzKSB7XG4gICAgICBkYkN1cnNvci5hZGRDdXJzb3JGbGFnKFwib3Bsb2dSZXBsYXlcIiwgdHJ1ZSlcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZW9mIGN1cnNvck9wdGlvbnMubWF4VGltZU1zICE9PSAndW5kZWZpbmVkJykge1xuICAgIGRiQ3Vyc29yID0gZGJDdXJzb3IubWF4VGltZU1TKGN1cnNvck9wdGlvbnMubWF4VGltZU1zKTtcbiAgfVxuICBpZiAodHlwZW9mIGN1cnNvck9wdGlvbnMuaGludCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBkYkN1cnNvciA9IGRiQ3Vyc29yLmhpbnQoY3Vyc29yT3B0aW9ucy5oaW50KTtcbiAgfVxuXG4gIHJldHVybiBuZXcgQXN5bmNocm9ub3VzQ3Vyc29yKGRiQ3Vyc29yLCBjdXJzb3JEZXNjcmlwdGlvbiwgb3B0aW9ucywgY29sbGVjdGlvbik7XG59O1xuXG4vLyBUYWlscyB0aGUgY3Vyc29yIGRlc2NyaWJlZCBieSBjdXJzb3JEZXNjcmlwdGlvbiwgbW9zdCBsaWtlbHkgb24gdGhlXG4vLyBvcGxvZy4gQ2FsbHMgZG9jQ2FsbGJhY2sgd2l0aCBlYWNoIGRvY3VtZW50IGZvdW5kLiBJZ25vcmVzIGVycm9ycyBhbmQganVzdFxuLy8gcmVzdGFydHMgdGhlIHRhaWwgb24gZXJyb3IuXG4vL1xuLy8gSWYgdGltZW91dE1TIGlzIHNldCwgdGhlbiBpZiB3ZSBkb24ndCBnZXQgYSBuZXcgZG9jdW1lbnQgZXZlcnkgdGltZW91dE1TLFxuLy8ga2lsbCBhbmQgcmVzdGFydCB0aGUgY3Vyc29yLiBUaGlzIGlzIHByaW1hcmlseSBhIHdvcmthcm91bmQgZm9yICM4NTk4LlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS50YWlsID0gZnVuY3Rpb24gKGN1cnNvckRlc2NyaXB0aW9uLCBkb2NDYWxsYmFjaywgdGltZW91dE1TKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgaWYgKCFjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbiBvbmx5IHRhaWwgYSB0YWlsYWJsZSBjdXJzb3JcIik7XG5cbiAgdmFyIGN1cnNvciA9IHNlbGYuX2NyZWF0ZUFzeW5jaHJvbm91c0N1cnNvcihjdXJzb3JEZXNjcmlwdGlvbik7XG5cbiAgdmFyIHN0b3BwZWQgPSBmYWxzZTtcbiAgdmFyIGxhc3RUUztcblxuICBNZXRlb3IuZGVmZXIoYXN5bmMgZnVuY3Rpb24gbG9vcCgpIHtcbiAgICB2YXIgZG9jID0gbnVsbDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHN0b3BwZWQpXG4gICAgICAgIHJldHVybjtcbiAgICAgIHRyeSB7XG4gICAgICAgIGRvYyA9IGF3YWl0IGN1cnNvci5fbmV4dE9iamVjdFByb21pc2VXaXRoVGltZW91dCh0aW1lb3V0TVMpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIC8vIFdlIHNob3VsZCBub3QgaWdub3JlIGVycm9ycyBoZXJlIHVubGVzcyB3ZSB3YW50IHRvIHNwZW5kIGEgbG90IG9mIHRpbWUgZGVidWdnaW5nXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgLy8gVGhlcmUncyBubyBnb29kIHdheSB0byBmaWd1cmUgb3V0IGlmIHRoaXMgd2FzIGFjdHVhbGx5IGFuIGVycm9yIGZyb21cbiAgICAgICAgLy8gTW9uZ28sIG9yIGp1c3QgY2xpZW50LXNpZGUgKGluY2x1ZGluZyBvdXIgb3duIHRpbWVvdXQgZXJyb3IpLiBBaFxuICAgICAgICAvLyB3ZWxsLiBCdXQgZWl0aGVyIHdheSwgd2UgbmVlZCB0byByZXRyeSB0aGUgY3Vyc29yICh1bmxlc3MgdGhlIGZhaWx1cmVcbiAgICAgICAgLy8gd2FzIGJlY2F1c2UgdGhlIG9ic2VydmUgZ290IHN0b3BwZWQpLlxuICAgICAgICBkb2MgPSBudWxsO1xuICAgICAgfVxuICAgICAgLy8gU2luY2Ugd2UgYXdhaXRlZCBhIHByb21pc2UgYWJvdmUsIHdlIG5lZWQgdG8gY2hlY2sgYWdhaW4gdG8gc2VlIGlmXG4gICAgICAvLyB3ZSd2ZSBiZWVuIHN0b3BwZWQgYmVmb3JlIGNhbGxpbmcgdGhlIGNhbGxiYWNrLlxuICAgICAgaWYgKHN0b3BwZWQpXG4gICAgICAgIHJldHVybjtcbiAgICAgIGlmIChkb2MpIHtcbiAgICAgICAgLy8gSWYgYSB0YWlsYWJsZSBjdXJzb3IgY29udGFpbnMgYSBcInRzXCIgZmllbGQsIHVzZSBpdCB0byByZWNyZWF0ZSB0aGVcbiAgICAgICAgLy8gY3Vyc29yIG9uIGVycm9yLiAoXCJ0c1wiIGlzIGEgc3RhbmRhcmQgdGhhdCBNb25nbyB1c2VzIGludGVybmFsbHkgZm9yXG4gICAgICAgIC8vIHRoZSBvcGxvZywgYW5kIHRoZXJlJ3MgYSBzcGVjaWFsIGZsYWcgdGhhdCBsZXRzIHlvdSBkbyBiaW5hcnkgc2VhcmNoXG4gICAgICAgIC8vIG9uIGl0IGluc3RlYWQgb2YgbmVlZGluZyB0byB1c2UgYW4gaW5kZXguKVxuICAgICAgICBsYXN0VFMgPSBkb2MudHM7XG4gICAgICAgIGRvY0NhbGxiYWNrKGRvYyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgbmV3U2VsZWN0b3IgPSBPYmplY3QuYXNzaWduKHt9LCBjdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3Rvcik7XG4gICAgICAgIGlmIChsYXN0VFMpIHtcbiAgICAgICAgICBuZXdTZWxlY3Rvci50cyA9IHskZ3Q6IGxhc3RUU307XG4gICAgICAgIH1cbiAgICAgICAgY3Vyc29yID0gc2VsZi5fY3JlYXRlQXN5bmNocm9ub3VzQ3Vyc29yKG5ldyBDdXJzb3JEZXNjcmlwdGlvbihcbiAgICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICBuZXdTZWxlY3RvcixcbiAgICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zKSk7XG4gICAgICAgIC8vIE1vbmdvIGZhaWxvdmVyIHRha2VzIG1hbnkgc2Vjb25kcy4gIFJldHJ5IGluIGEgYml0LiAgKFdpdGhvdXQgdGhpc1xuICAgICAgICAvLyBzZXRUaW1lb3V0LCB3ZSBwZWcgdGhlIENQVSBhdCAxMDAlIGFuZCBuZXZlciBub3RpY2UgdGhlIGFjdHVhbFxuICAgICAgICAvLyBmYWlsb3Zlci5cbiAgICAgICAgc2V0VGltZW91dChsb29wLCAxMDApO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgc3RvcHBlZCA9IHRydWU7XG4gICAgICBjdXJzb3IuY2xvc2UoKTtcbiAgICB9XG4gIH07XG59O1xuXG5PYmplY3QuYXNzaWduKE1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUsIHtcbiAgX29ic2VydmVDaGFuZ2VzOiBhc3luYyBmdW5jdGlvbiAoXG4gICAgY3Vyc29yRGVzY3JpcHRpb24sIG9yZGVyZWQsIGNhbGxiYWNrcywgbm9uTXV0YXRpbmdDYWxsYmFja3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgY29sbGVjdGlvbk5hbWUgPSBjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZTtcblxuICAgIGlmIChjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlKSB7XG4gICAgICByZXR1cm4gc2VsZi5fb2JzZXJ2ZUNoYW5nZXNUYWlsYWJsZShjdXJzb3JEZXNjcmlwdGlvbiwgb3JkZXJlZCwgY2FsbGJhY2tzKTtcbiAgICB9XG5cbiAgICAvLyBZb3UgbWF5IG5vdCBmaWx0ZXIgb3V0IF9pZCB3aGVuIG9ic2VydmluZyBjaGFuZ2VzLCBiZWNhdXNlIHRoZSBpZCBpcyBhIGNvcmVcbiAgICAvLyBwYXJ0IG9mIHRoZSBvYnNlcnZlQ2hhbmdlcyBBUEkuXG4gICAgY29uc3QgZmllbGRzT3B0aW9ucyA9IGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucHJvamVjdGlvbiB8fCBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLmZpZWxkcztcbiAgICBpZiAoZmllbGRzT3B0aW9ucyAmJlxuICAgICAgKGZpZWxkc09wdGlvbnMuX2lkID09PSAwIHx8XG4gICAgICAgIGZpZWxkc09wdGlvbnMuX2lkID09PSBmYWxzZSkpIHtcbiAgICAgIHRocm93IEVycm9yKFwiWW91IG1heSBub3Qgb2JzZXJ2ZSBhIGN1cnNvciB3aXRoIHtmaWVsZHM6IHtfaWQ6IDB9fVwiKTtcbiAgICB9XG5cbiAgICB2YXIgb2JzZXJ2ZUtleSA9IEVKU09OLnN0cmluZ2lmeShcbiAgICAgIE9iamVjdC5hc3NpZ24oe29yZGVyZWQ6IG9yZGVyZWR9LCBjdXJzb3JEZXNjcmlwdGlvbikpO1xuXG4gICAgdmFyIG11bHRpcGxleGVyLCBvYnNlcnZlRHJpdmVyO1xuICAgIHZhciBmaXJzdEhhbmRsZSA9IGZhbHNlO1xuXG4gICAgLy8gRmluZCBhIG1hdGNoaW5nIE9ic2VydmVNdWx0aXBsZXhlciwgb3IgY3JlYXRlIGEgbmV3IG9uZS4gVGhpcyBuZXh0IGJsb2NrIGlzXG4gICAgLy8gZ3VhcmFudGVlZCB0byBub3QgeWllbGQgKGFuZCBpdCBkb2Vzbid0IGNhbGwgYW55dGhpbmcgdGhhdCBjYW4gb2JzZXJ2ZSBhXG4gICAgLy8gbmV3IHF1ZXJ5KSwgc28gbm8gb3RoZXIgY2FsbHMgdG8gdGhpcyBmdW5jdGlvbiBjYW4gaW50ZXJsZWF2ZSB3aXRoIGl0LlxuICAgIGlmIChvYnNlcnZlS2V5IGluIHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnMpIHtcbiAgICAgIG11bHRpcGxleGVyID0gc2VsZi5fb2JzZXJ2ZU11bHRpcGxleGVyc1tvYnNlcnZlS2V5XTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmlyc3RIYW5kbGUgPSB0cnVlO1xuICAgICAgLy8gQ3JlYXRlIGEgbmV3IE9ic2VydmVNdWx0aXBsZXhlci5cbiAgICAgIG11bHRpcGxleGVyID0gbmV3IE9ic2VydmVNdWx0aXBsZXhlcih7XG4gICAgICAgIG9yZGVyZWQ6IG9yZGVyZWQsXG4gICAgICAgIG9uU3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLl9vYnNlcnZlTXVsdGlwbGV4ZXJzW29ic2VydmVLZXldO1xuICAgICAgICAgIHJldHVybiBvYnNlcnZlRHJpdmVyLnN0b3AoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdmFyIG9ic2VydmVIYW5kbGUgPSBuZXcgT2JzZXJ2ZUhhbmRsZShtdWx0aXBsZXhlcixcbiAgICAgIGNhbGxiYWNrcyxcbiAgICAgIG5vbk11dGF0aW5nQ2FsbGJhY2tzLFxuICAgICk7XG5cbiAgICBjb25zdCBvcGxvZ09wdGlvbnMgPSBzZWxmPy5fb3Bsb2dIYW5kbGU/Ll9vcGxvZ09wdGlvbnMgfHwge307XG4gICAgY29uc3QgeyBpbmNsdWRlQ29sbGVjdGlvbnMsIGV4Y2x1ZGVDb2xsZWN0aW9ucyB9ID0gb3Bsb2dPcHRpb25zO1xuICAgIGlmIChmaXJzdEhhbmRsZSkge1xuXG4gICAgICB2YXIgbWF0Y2hlciwgc29ydGVyO1xuICAgICAgdmFyIGNhblVzZU9wbG9nID0gW1xuICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgLy8gQXQgYSBiYXJlIG1pbmltdW0sIHVzaW5nIHRoZSBvcGxvZyByZXF1aXJlcyB1cyB0byBoYXZlIGFuIG9wbG9nLCB0b1xuICAgICAgICAgIC8vIHdhbnQgdW5vcmRlcmVkIGNhbGxiYWNrcywgYW5kIHRvIG5vdCB3YW50IGEgY2FsbGJhY2sgb24gdGhlIHBvbGxzXG4gICAgICAgICAgLy8gdGhhdCB3b24ndCBoYXBwZW4uXG4gICAgICAgICAgcmV0dXJuIHNlbGYuX29wbG9nSGFuZGxlICYmICFvcmRlcmVkICYmXG4gICAgICAgICAgICAhY2FsbGJhY2tzLl90ZXN0T25seVBvbGxDYWxsYmFjaztcbiAgICAgICAgfSxcbiAgICAgICAgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIC8vIFdlIGFsc28gbmVlZCB0byBjaGVjaywgaWYgdGhlIGNvbGxlY3Rpb24gb2YgdGhpcyBDdXJzb3IgaXMgYWN0dWFsbHkgYmVpbmcgXCJ3YXRjaGVkXCIgYnkgdGhlIE9wbG9nIGhhbmRsZVxuICAgICAgICAgIC8vIGlmIG5vdCwgd2UgaGF2ZSB0byBmYWxsYmFjayB0byBsb25nIHBvbGxpbmdcbiAgICAgICAgICBpZiAoZXhjbHVkZUNvbGxlY3Rpb25zPy5sZW5ndGggJiYgZXhjbHVkZUNvbGxlY3Rpb25zLmluY2x1ZGVzKGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgICAgICAgaWYgKCFvcGxvZ0NvbGxlY3Rpb25XYXJuaW5ncy5pbmNsdWRlcyhjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXMubW9uZ28ub3Bsb2dFeGNsdWRlQ29sbGVjdGlvbnMgaW5jbHVkZXMgdGhlIGNvbGxlY3Rpb24gJHtjb2xsZWN0aW9uTmFtZX0gLSB5b3VyIHN1YnNjcmlwdGlvbnMgd2lsbCBvbmx5IHVzZSBsb25nIHBvbGxpbmchYCk7XG4gICAgICAgICAgICAgIG9wbG9nQ29sbGVjdGlvbldhcm5pbmdzLnB1c2goY29sbGVjdGlvbk5hbWUpOyAvLyB3ZSBvbmx5IHdhbnQgdG8gc2hvdyB0aGUgd2FybmluZ3Mgb25jZSBwZXIgY29sbGVjdGlvbiFcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGluY2x1ZGVDb2xsZWN0aW9ucz8ubGVuZ3RoICYmICFpbmNsdWRlQ29sbGVjdGlvbnMuaW5jbHVkZXMoY29sbGVjdGlvbk5hbWUpKSB7XG4gICAgICAgICAgICBpZiAoIW9wbG9nQ29sbGVjdGlvbldhcm5pbmdzLmluY2x1ZGVzKGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYE1ldGVvci5zZXR0aW5ncy5wYWNrYWdlcy5tb25nby5vcGxvZ0luY2x1ZGVDb2xsZWN0aW9ucyBkb2VzIG5vdCBpbmNsdWRlIHRoZSBjb2xsZWN0aW9uICR7Y29sbGVjdGlvbk5hbWV9IC0geW91ciBzdWJzY3JpcHRpb25zIHdpbGwgb25seSB1c2UgbG9uZyBwb2xsaW5nIWApO1xuICAgICAgICAgICAgICBvcGxvZ0NvbGxlY3Rpb25XYXJuaW5ncy5wdXNoKGNvbGxlY3Rpb25OYW1lKTsgLy8gd2Ugb25seSB3YW50IHRvIHNob3cgdGhlIHdhcm5pbmdzIG9uY2UgcGVyIGNvbGxlY3Rpb24hXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9LFxuICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgLy8gV2UgbmVlZCB0byBiZSBhYmxlIHRvIGNvbXBpbGUgdGhlIHNlbGVjdG9yLiBGYWxsIGJhY2sgdG8gcG9sbGluZyBmb3JcbiAgICAgICAgICAvLyBzb21lIG5ld2ZhbmdsZWQgJHNlbGVjdG9yIHRoYXQgbWluaW1vbmdvIGRvZXNuJ3Qgc3VwcG9ydCB5ZXQuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gWFhYIG1ha2UgYWxsIGNvbXBpbGF0aW9uIGVycm9ycyBNaW5pbW9uZ29FcnJvciBvciBzb21ldGhpbmdcbiAgICAgICAgICAgIC8vICAgICBzbyB0aGF0IHRoaXMgZG9lc24ndCBpZ25vcmUgdW5yZWxhdGVkIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgIGlmIChNZXRlb3IuaXNDbGllbnQgJiYgZSBpbnN0YW5jZW9mIE1pbmlNb25nb1F1ZXJ5RXJyb3IpIHtcbiAgICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAvLyAuLi4gYW5kIHRoZSBzZWxlY3RvciBpdHNlbGYgbmVlZHMgdG8gc3VwcG9ydCBvcGxvZy5cbiAgICAgICAgICByZXR1cm4gT3Bsb2dPYnNlcnZlRHJpdmVyLmN1cnNvclN1cHBvcnRlZChjdXJzb3JEZXNjcmlwdGlvbiwgbWF0Y2hlcik7XG4gICAgICAgIH0sXG4gICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAvLyBBbmQgd2UgbmVlZCB0byBiZSBhYmxlIHRvIGNvbXBpbGUgdGhlIHNvcnQsIGlmIGFueS4gIGVnLCBjYW4ndCBiZVxuICAgICAgICAgIC8vIHskbmF0dXJhbDogMX0uXG4gICAgICAgICAgaWYgKCFjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnNvcnQpXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgc29ydGVyID0gbmV3IE1pbmltb25nby5Tb3J0ZXIoY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy5zb3J0KTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIFhYWCBtYWtlIGFsbCBjb21waWxhdGlvbiBlcnJvcnMgTWluaW1vbmdvRXJyb3Igb3Igc29tZXRoaW5nXG4gICAgICAgICAgICAvLyAgICAgc28gdGhhdCB0aGlzIGRvZXNuJ3QgaWdub3JlIHVucmVsYXRlZCBleGNlcHRpb25zXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICBdLmV2ZXJ5KGYgPT4gZigpKTsgIC8vIGludm9rZSBlYWNoIGZ1bmN0aW9uIGFuZCBjaGVjayBpZiBhbGwgcmV0dXJuIHRydWVcblxuICAgICAgdmFyIGRyaXZlckNsYXNzID0gY2FuVXNlT3Bsb2cgPyBPcGxvZ09ic2VydmVEcml2ZXIgOiBQb2xsaW5nT2JzZXJ2ZURyaXZlcjtcbiAgICAgIG9ic2VydmVEcml2ZXIgPSBuZXcgZHJpdmVyQ2xhc3Moe1xuICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbjogY3Vyc29yRGVzY3JpcHRpb24sXG4gICAgICAgIG1vbmdvSGFuZGxlOiBzZWxmLFxuICAgICAgICBtdWx0aXBsZXhlcjogbXVsdGlwbGV4ZXIsXG4gICAgICAgIG9yZGVyZWQ6IG9yZGVyZWQsXG4gICAgICAgIG1hdGNoZXI6IG1hdGNoZXIsICAvLyBpZ25vcmVkIGJ5IHBvbGxpbmdcbiAgICAgICAgc29ydGVyOiBzb3J0ZXIsICAvLyBpZ25vcmVkIGJ5IHBvbGxpbmdcbiAgICAgICAgX3Rlc3RPbmx5UG9sbENhbGxiYWNrOiBjYWxsYmFja3MuX3Rlc3RPbmx5UG9sbENhbGxiYWNrXG4gICAgICB9KTtcblxuICAgICAgaWYgKG9ic2VydmVEcml2ZXIuX2luaXQpIHtcbiAgICAgICAgYXdhaXQgb2JzZXJ2ZURyaXZlci5faW5pdCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGlzIGZpZWxkIGlzIG9ubHkgc2V0IGZvciB1c2UgaW4gdGVzdHMuXG4gICAgICBtdWx0aXBsZXhlci5fb2JzZXJ2ZURyaXZlciA9IG9ic2VydmVEcml2ZXI7XG4gICAgfVxuICAgIHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnNbb2JzZXJ2ZUtleV0gPSBtdWx0aXBsZXhlcjtcbiAgICAvLyBCbG9ja3MgdW50aWwgdGhlIGluaXRpYWwgYWRkcyBoYXZlIGJlZW4gc2VudC5cbiAgICBhd2FpdCBtdWx0aXBsZXhlci5hZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMob2JzZXJ2ZUhhbmRsZSk7XG5cbiAgICByZXR1cm4gb2JzZXJ2ZUhhbmRsZTtcbiAgfSxcblxufSk7XG4iLCJpbXBvcnQgY2xvbmUgZnJvbSAnbG9kYXNoLmNsb25lJ1xuXG4vKiogQHR5cGUge2ltcG9ydCgnbW9uZ29kYicpfSAqL1xuZXhwb3J0IGNvbnN0IE1vbmdvREIgPSBPYmplY3QuYXNzaWduKE5wbU1vZHVsZU1vbmdvZGIsIHtcbiAgT2JqZWN0SUQ6IE5wbU1vZHVsZU1vbmdvZGIuT2JqZWN0SWQsXG59KTtcblxuLy8gVGhlIHdyaXRlIG1ldGhvZHMgYmxvY2sgdW50aWwgdGhlIGRhdGFiYXNlIGhhcyBjb25maXJtZWQgdGhlIHdyaXRlIChpdCBtYXlcbi8vIG5vdCBiZSByZXBsaWNhdGVkIG9yIHN0YWJsZSBvbiBkaXNrLCBidXQgb25lIHNlcnZlciBoYXMgY29uZmlybWVkIGl0KSBpZiBub1xuLy8gY2FsbGJhY2sgaXMgcHJvdmlkZWQuIElmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWQsIHRoZW4gdGhleSBjYWxsIHRoZSBjYWxsYmFja1xuLy8gd2hlbiB0aGUgd3JpdGUgaXMgY29uZmlybWVkLiBUaGV5IHJldHVybiBub3RoaW5nIG9uIHN1Y2Nlc3MsIGFuZCByYWlzZSBhblxuLy8gZXhjZXB0aW9uIG9uIGZhaWx1cmUuXG4vL1xuLy8gQWZ0ZXIgbWFraW5nIGEgd3JpdGUgKHdpdGggaW5zZXJ0LCB1cGRhdGUsIHJlbW92ZSksIG9ic2VydmVycyBhcmVcbi8vIG5vdGlmaWVkIGFzeW5jaHJvbm91c2x5LiBJZiB5b3Ugd2FudCB0byByZWNlaXZlIGEgY2FsbGJhY2sgb25jZSBhbGxcbi8vIG9mIHRoZSBvYnNlcnZlciBub3RpZmljYXRpb25zIGhhdmUgbGFuZGVkIGZvciB5b3VyIHdyaXRlLCBkbyB0aGVcbi8vIHdyaXRlcyBpbnNpZGUgYSB3cml0ZSBmZW5jZSAoc2V0IEREUFNlcnZlci5fQ3VycmVudFdyaXRlRmVuY2UgdG8gYSBuZXdcbi8vIF9Xcml0ZUZlbmNlLCBhbmQgdGhlbiBzZXQgYSBjYWxsYmFjayBvbiB0aGUgd3JpdGUgZmVuY2UuKVxuLy9cbi8vIFNpbmNlIG91ciBleGVjdXRpb24gZW52aXJvbm1lbnQgaXMgc2luZ2xlLXRocmVhZGVkLCB0aGlzIGlzXG4vLyB3ZWxsLWRlZmluZWQgLS0gYSB3cml0ZSBcImhhcyBiZWVuIG1hZGVcIiBpZiBpdCdzIHJldHVybmVkLCBhbmQgYW5cbi8vIG9ic2VydmVyIFwiaGFzIGJlZW4gbm90aWZpZWRcIiBpZiBpdHMgY2FsbGJhY2sgaGFzIHJldHVybmVkLlxuXG5leHBvcnQgY29uc3Qgd3JpdGVDYWxsYmFjayA9IGZ1bmN0aW9uICh3cml0ZSwgcmVmcmVzaCwgY2FsbGJhY2spIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChlcnIsIHJlc3VsdCkge1xuICAgIGlmICghIGVycikge1xuICAgICAgLy8gWFhYIFdlIGRvbid0IGhhdmUgdG8gcnVuIHRoaXMgb24gZXJyb3IsIHJpZ2h0P1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVmcmVzaCgpO1xuICAgICAgfSBjYXRjaCAocmVmcmVzaEVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICBjYWxsYmFjayhyZWZyZXNoRXJyKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgcmVmcmVzaEVycjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0KTtcbiAgICB9IGVsc2UgaWYgKGVycikge1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfTtcbn07XG5cblxuZXhwb3J0IGNvbnN0IHRyYW5zZm9ybVJlc3VsdCA9IGZ1bmN0aW9uIChkcml2ZXJSZXN1bHQpIHtcbiAgdmFyIG1ldGVvclJlc3VsdCA9IHsgbnVtYmVyQWZmZWN0ZWQ6IDAgfTtcbiAgaWYgKGRyaXZlclJlc3VsdCkge1xuICAgIHZhciBtb25nb1Jlc3VsdCA9IGRyaXZlclJlc3VsdC5yZXN1bHQ7XG4gICAgLy8gT24gdXBkYXRlcyB3aXRoIHVwc2VydDp0cnVlLCB0aGUgaW5zZXJ0ZWQgdmFsdWVzIGNvbWUgYXMgYSBsaXN0IG9mXG4gICAgLy8gdXBzZXJ0ZWQgdmFsdWVzIC0tIGV2ZW4gd2l0aCBvcHRpb25zLm11bHRpLCB3aGVuIHRoZSB1cHNlcnQgZG9lcyBpbnNlcnQsXG4gICAgLy8gaXQgb25seSBpbnNlcnRzIG9uZSBlbGVtZW50LlxuICAgIGlmIChtb25nb1Jlc3VsdC51cHNlcnRlZENvdW50KSB7XG4gICAgICBtZXRlb3JSZXN1bHQubnVtYmVyQWZmZWN0ZWQgPSBtb25nb1Jlc3VsdC51cHNlcnRlZENvdW50O1xuXG4gICAgICBpZiAobW9uZ29SZXN1bHQudXBzZXJ0ZWRJZCkge1xuICAgICAgICBtZXRlb3JSZXN1bHQuaW5zZXJ0ZWRJZCA9IG1vbmdvUmVzdWx0LnVwc2VydGVkSWQ7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG4gd2FzIHVzZWQgYmVmb3JlIE1vbmdvIDUuMCwgaW4gTW9uZ28gNS4wIHdlIGFyZSBub3QgcmVjZWl2aW5nIHRoaXMgblxuICAgICAgLy8gZmllbGQgYW5kIHNvIHdlIGFyZSB1c2luZyBtb2RpZmllZENvdW50IGluc3RlYWRcbiAgICAgIG1ldGVvclJlc3VsdC5udW1iZXJBZmZlY3RlZCA9IG1vbmdvUmVzdWx0Lm4gfHwgbW9uZ29SZXN1bHQubWF0Y2hlZENvdW50IHx8IG1vbmdvUmVzdWx0Lm1vZGlmaWVkQ291bnQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG1ldGVvclJlc3VsdDtcbn07XG5cbmV4cG9ydCBjb25zdCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyA9IGZ1bmN0aW9uIChkb2N1bWVudCkge1xuICBpZiAoRUpTT04uaXNCaW5hcnkoZG9jdW1lbnQpKSB7XG4gICAgLy8gVGhpcyBkb2VzIG1vcmUgY29waWVzIHRoYW4gd2UnZCBsaWtlLCBidXQgaXMgbmVjZXNzYXJ5IGJlY2F1c2VcbiAgICAvLyBNb25nb0RCLkJTT04gb25seSBsb29rcyBsaWtlIGl0IHRha2VzIGEgVWludDhBcnJheSAoYW5kIGRvZXNuJ3QgYWN0dWFsbHlcbiAgICAvLyBzZXJpYWxpemUgaXQgY29ycmVjdGx5KS5cbiAgICByZXR1cm4gbmV3IE1vbmdvREIuQmluYXJ5KEJ1ZmZlci5mcm9tKGRvY3VtZW50KSk7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ29EQi5CaW5hcnkpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQ7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SUQpIHtcbiAgICByZXR1cm4gbmV3IE1vbmdvREIuT2JqZWN0SWQoZG9jdW1lbnQudG9IZXhTdHJpbmcoKSk7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ29EQi5PYmplY3RJZCkge1xuICAgIHJldHVybiBuZXcgTW9uZ29EQi5PYmplY3RJZChkb2N1bWVudC50b0hleFN0cmluZygpKTtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLlRpbWVzdGFtcCkge1xuICAgIC8vIEZvciBub3csIHRoZSBNZXRlb3IgcmVwcmVzZW50YXRpb24gb2YgYSBNb25nbyB0aW1lc3RhbXAgdHlwZSAobm90IGEgZGF0ZSFcbiAgICAvLyB0aGlzIGlzIGEgd2VpcmQgaW50ZXJuYWwgdGhpbmcgdXNlZCBpbiB0aGUgb3Bsb2chKSBpcyB0aGUgc2FtZSBhcyB0aGVcbiAgICAvLyBNb25nbyByZXByZXNlbnRhdGlvbi4gV2UgbmVlZCB0byBkbyB0aGlzIGV4cGxpY2l0bHkgb3IgZWxzZSB3ZSB3b3VsZCBkbyBhXG4gICAgLy8gc3RydWN0dXJhbCBjbG9uZSBhbmQgbG9zZSB0aGUgcHJvdG90eXBlLlxuICAgIHJldHVybiBkb2N1bWVudDtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBEZWNpbWFsKSB7XG4gICAgcmV0dXJuIE1vbmdvREIuRGVjaW1hbDEyOC5mcm9tU3RyaW5nKGRvY3VtZW50LnRvU3RyaW5nKCkpO1xuICB9XG4gIGlmIChFSlNPTi5faXNDdXN0b21UeXBlKGRvY3VtZW50KSkge1xuICAgIHJldHVybiByZXBsYWNlTmFtZXMobWFrZU1vbmdvTGVnYWwsIEVKU09OLnRvSlNPTlZhbHVlKGRvY3VtZW50KSk7XG4gIH1cbiAgLy8gSXQgaXMgbm90IG9yZGluYXJpbHkgcG9zc2libGUgdG8gc3RpY2sgZG9sbGFyLXNpZ24ga2V5cyBpbnRvIG1vbmdvXG4gIC8vIHNvIHdlIGRvbid0IGJvdGhlciBjaGVja2luZyBmb3IgdGhpbmdzIHRoYXQgbmVlZCBlc2NhcGluZyBhdCB0aGlzIHRpbWUuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59O1xuXG5leHBvcnQgY29uc3QgcmVwbGFjZVR5cGVzID0gZnVuY3Rpb24gKGRvY3VtZW50LCBhdG9tVHJhbnNmb3JtZXIpIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ29iamVjdCcgfHwgZG9jdW1lbnQgPT09IG51bGwpXG4gICAgcmV0dXJuIGRvY3VtZW50O1xuXG4gIHZhciByZXBsYWNlZFRvcExldmVsQXRvbSA9IGF0b21UcmFuc2Zvcm1lcihkb2N1bWVudCk7XG4gIGlmIChyZXBsYWNlZFRvcExldmVsQXRvbSAhPT0gdW5kZWZpbmVkKVxuICAgIHJldHVybiByZXBsYWNlZFRvcExldmVsQXRvbTtcblxuICB2YXIgcmV0ID0gZG9jdW1lbnQ7XG4gIE9iamVjdC5lbnRyaWVzKGRvY3VtZW50KS5mb3JFYWNoKGZ1bmN0aW9uIChba2V5LCB2YWxdKSB7XG4gICAgdmFyIHZhbFJlcGxhY2VkID0gcmVwbGFjZVR5cGVzKHZhbCwgYXRvbVRyYW5zZm9ybWVyKTtcbiAgICBpZiAodmFsICE9PSB2YWxSZXBsYWNlZCkge1xuICAgICAgLy8gTGF6eSBjbG9uZS4gU2hhbGxvdyBjb3B5LlxuICAgICAgaWYgKHJldCA9PT0gZG9jdW1lbnQpXG4gICAgICAgIHJldCA9IGNsb25lKGRvY3VtZW50KTtcbiAgICAgIHJldFtrZXldID0gdmFsUmVwbGFjZWQ7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmV4cG9ydCBjb25zdCByZXBsYWNlTW9uZ29BdG9tV2l0aE1ldGVvciA9IGZ1bmN0aW9uIChkb2N1bWVudCkge1xuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLkJpbmFyeSkge1xuICAgIC8vIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICAgIGlmIChkb2N1bWVudC5zdWJfdHlwZSAhPT0gMCkge1xuICAgICAgcmV0dXJuIGRvY3VtZW50O1xuICAgIH1cbiAgICB2YXIgYnVmZmVyID0gZG9jdW1lbnQudmFsdWUodHJ1ZSk7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ29EQi5PYmplY3RJZCkge1xuICAgIHJldHVybiBuZXcgTW9uZ28uT2JqZWN0SUQoZG9jdW1lbnQudG9IZXhTdHJpbmcoKSk7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ29EQi5EZWNpbWFsMTI4KSB7XG4gICAgcmV0dXJuIERlY2ltYWwoZG9jdW1lbnQudG9TdHJpbmcoKSk7XG4gIH1cbiAgaWYgKGRvY3VtZW50W1wiRUpTT04kdHlwZVwiXSAmJiBkb2N1bWVudFtcIkVKU09OJHZhbHVlXCJdICYmIE9iamVjdC5rZXlzKGRvY3VtZW50KS5sZW5ndGggPT09IDIpIHtcbiAgICByZXR1cm4gRUpTT04uZnJvbUpTT05WYWx1ZShyZXBsYWNlTmFtZXModW5tYWtlTW9uZ29MZWdhbCwgZG9jdW1lbnQpKTtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLlRpbWVzdGFtcCkge1xuICAgIC8vIEZvciBub3csIHRoZSBNZXRlb3IgcmVwcmVzZW50YXRpb24gb2YgYSBNb25nbyB0aW1lc3RhbXAgdHlwZSAobm90IGEgZGF0ZSFcbiAgICAvLyB0aGlzIGlzIGEgd2VpcmQgaW50ZXJuYWwgdGhpbmcgdXNlZCBpbiB0aGUgb3Bsb2chKSBpcyB0aGUgc2FtZSBhcyB0aGVcbiAgICAvLyBNb25nbyByZXByZXNlbnRhdGlvbi4gV2UgbmVlZCB0byBkbyB0aGlzIGV4cGxpY2l0bHkgb3IgZWxzZSB3ZSB3b3VsZCBkbyBhXG4gICAgLy8gc3RydWN0dXJhbCBjbG9uZSBhbmQgbG9zZSB0aGUgcHJvdG90eXBlLlxuICAgIHJldHVybiBkb2N1bWVudDtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufTtcblxuY29uc3QgbWFrZU1vbmdvTGVnYWwgPSBuYW1lID0+IFwiRUpTT05cIiArIG5hbWU7XG5jb25zdCB1bm1ha2VNb25nb0xlZ2FsID0gbmFtZSA9PiBuYW1lLnN1YnN0cig1KTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlcGxhY2VOYW1lcyhmaWx0ZXIsIHRoaW5nKSB7XG4gIGlmICh0eXBlb2YgdGhpbmcgPT09IFwib2JqZWN0XCIgJiYgdGhpbmcgIT09IG51bGwpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheSh0aGluZykpIHtcbiAgICAgIHJldHVybiB0aGluZy5tYXAocmVwbGFjZU5hbWVzLmJpbmQobnVsbCwgZmlsdGVyKSk7XG4gICAgfVxuICAgIHZhciByZXQgPSB7fTtcbiAgICBPYmplY3QuZW50cmllcyh0aGluZykuZm9yRWFjaChmdW5jdGlvbiAoW2tleSwgdmFsdWVdKSB7XG4gICAgICByZXRbZmlsdGVyKGtleSldID0gcmVwbGFjZU5hbWVzKGZpbHRlciwgdmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXQ7XG4gIH1cbiAgcmV0dXJuIHRoaW5nO1xufVxuIiwiaW1wb3J0IExvY2FsQ29sbGVjdGlvbiBmcm9tICdtZXRlb3IvbWluaW1vbmdvL2xvY2FsX2NvbGxlY3Rpb24nO1xuaW1wb3J0IHsgcmVwbGFjZU1vbmdvQXRvbVdpdGhNZXRlb3IsIHJlcGxhY2VUeXBlcyB9IGZyb20gJy4vbW9uZ29fY29tbW9uJztcblxuLyoqXG4gKiBUaGlzIGlzIGp1c3QgYSBsaWdodCB3cmFwcGVyIGZvciB0aGUgY3Vyc29yLiBUaGUgZ29hbCBoZXJlIGlzIHRvIGVuc3VyZSBjb21wYXRpYmlsaXR5IGV2ZW4gaWZcbiAqIHRoZXJlIGFyZSBicmVha2luZyBjaGFuZ2VzIG9uIHRoZSBNb25nb0RCIGRyaXZlci5cbiAqXG4gKiBUaGlzIGlzIGFuIGludGVybmFsIGltcGxlbWVudGF0aW9uIGRldGFpbCBhbmQgaXMgY3JlYXRlZCBsYXppbHkgYnkgdGhlIG1haW4gQ3Vyc29yIGNsYXNzLlxuICovXG5leHBvcnQgY2xhc3MgQXN5bmNocm9ub3VzQ3Vyc29yIHtcbiAgX2Nsb3NpbmcgPSBmYWxzZTtcbiAgX3BlbmRpbmdOZXh0ID0gbnVsbDtcbiAgY29uc3RydWN0b3IoZGJDdXJzb3IsIGN1cnNvckRlc2NyaXB0aW9uLCBvcHRpb25zKSB7XG4gICAgdGhpcy5fZGJDdXJzb3IgPSBkYkN1cnNvcjtcbiAgICB0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbiA9IGN1cnNvckRlc2NyaXB0aW9uO1xuXG4gICAgdGhpcy5fc2VsZkZvckl0ZXJhdGlvbiA9IG9wdGlvbnMuc2VsZkZvckl0ZXJhdGlvbiB8fCB0aGlzO1xuICAgIGlmIChvcHRpb25zLnVzZVRyYW5zZm9ybSAmJiBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRyYW5zZm9ybSkge1xuICAgICAgdGhpcy5fdHJhbnNmb3JtID0gTG9jYWxDb2xsZWN0aW9uLndyYXBUcmFuc2Zvcm0oXG4gICAgICAgIGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudHJhbnNmb3JtKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fdHJhbnNmb3JtID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLl92aXNpdGVkSWRzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIH1cblxuICBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgIHZhciBjdXJzb3IgPSB0aGlzO1xuICAgIHJldHVybiB7XG4gICAgICBhc3luYyBuZXh0KCkge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IGN1cnNvci5fbmV4dE9iamVjdFByb21pc2UoKTtcbiAgICAgICAgcmV0dXJuIHsgZG9uZTogIXZhbHVlLCB2YWx1ZSB9O1xuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIFByb21pc2UgZm9yIHRoZSBuZXh0IG9iamVjdCBmcm9tIHRoZSB1bmRlcmx5aW5nIGN1cnNvciAoYmVmb3JlXG4gIC8vIHRoZSBNb25nby0+TWV0ZW9yIHR5cGUgcmVwbGFjZW1lbnQpLlxuICBhc3luYyBfcmF3TmV4dE9iamVjdFByb21pc2UoKSB7XG4gICAgaWYgKHRoaXMuX2Nsb3NpbmcpIHtcbiAgICAgIC8vIFByZXZlbnQgbmV4dCgpIGFmdGVyIGNsb3NlIGlzIGNhbGxlZFxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICB0aGlzLl9wZW5kaW5nTmV4dCA9IHRoaXMuX2RiQ3Vyc29yLm5leHQoKTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuX3BlbmRpbmdOZXh0O1xuICAgICAgdGhpcy5fcGVuZGluZ05leHQgPSBudWxsO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICB0aGlzLl9wZW5kaW5nTmV4dCA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gUmV0dXJucyBhIFByb21pc2UgZm9yIHRoZSBuZXh0IG9iamVjdCBmcm9tIHRoZSBjdXJzb3IsIHNraXBwaW5nIHRob3NlIHdob3NlXG4gIC8vIElEcyB3ZSd2ZSBhbHJlYWR5IHNlZW4gYW5kIHJlcGxhY2luZyBNb25nbyBhdG9tcyB3aXRoIE1ldGVvciBhdG9tcy5cbiAgYXN5bmMgX25leHRPYmplY3RQcm9taXNlICgpIHtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgdmFyIGRvYyA9IGF3YWl0IHRoaXMuX3Jhd05leHRPYmplY3RQcm9taXNlKCk7XG5cbiAgICAgIGlmICghZG9jKSByZXR1cm4gbnVsbDtcbiAgICAgIGRvYyA9IHJlcGxhY2VUeXBlcyhkb2MsIHJlcGxhY2VNb25nb0F0b21XaXRoTWV0ZW9yKTtcblxuICAgICAgaWYgKCF0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlICYmICdfaWQnIGluIGRvYykge1xuICAgICAgICAvLyBEaWQgTW9uZ28gZ2l2ZSB1cyBkdXBsaWNhdGUgZG9jdW1lbnRzIGluIHRoZSBzYW1lIGN1cnNvcj8gSWYgc28sXG4gICAgICAgIC8vIGlnbm9yZSB0aGlzIG9uZS4gKERvIHRoaXMgYmVmb3JlIHRoZSB0cmFuc2Zvcm0sIHNpbmNlIHRyYW5zZm9ybSBtaWdodFxuICAgICAgICAvLyByZXR1cm4gc29tZSB1bnJlbGF0ZWQgdmFsdWUuKSBXZSBkb24ndCBkbyB0aGlzIGZvciB0YWlsYWJsZSBjdXJzb3JzLFxuICAgICAgICAvLyBiZWNhdXNlIHdlIHdhbnQgdG8gbWFpbnRhaW4gTygxKSBtZW1vcnkgdXNhZ2UuIEFuZCBpZiB0aGVyZSBpc24ndCBfaWRcbiAgICAgICAgLy8gZm9yIHNvbWUgcmVhc29uIChtYXliZSBpdCdzIHRoZSBvcGxvZyksIHRoZW4gd2UgZG9uJ3QgZG8gdGhpcyBlaXRoZXIuXG4gICAgICAgIC8vIChCZSBjYXJlZnVsIHRvIGRvIHRoaXMgZm9yIGZhbHNleSBidXQgZXhpc3RpbmcgX2lkLCB0aG91Z2guKVxuICAgICAgICBpZiAodGhpcy5fdmlzaXRlZElkcy5oYXMoZG9jLl9pZCkpIGNvbnRpbnVlO1xuICAgICAgICB0aGlzLl92aXNpdGVkSWRzLnNldChkb2MuX2lkLCB0cnVlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX3RyYW5zZm9ybSlcbiAgICAgICAgZG9jID0gdGhpcy5fdHJhbnNmb3JtKGRvYyk7XG5cbiAgICAgIHJldHVybiBkb2M7XG4gICAgfVxuICB9XG5cbiAgLy8gUmV0dXJucyBhIHByb21pc2Ugd2hpY2ggaXMgcmVzb2x2ZWQgd2l0aCB0aGUgbmV4dCBvYmplY3QgKGxpa2Ugd2l0aFxuICAvLyBfbmV4dE9iamVjdFByb21pc2UpIG9yIHJlamVjdGVkIGlmIHRoZSBjdXJzb3IgZG9lc24ndCByZXR1cm4gd2l0aGluXG4gIC8vIHRpbWVvdXRNUyBtcy5cbiAgX25leHRPYmplY3RQcm9taXNlV2l0aFRpbWVvdXQodGltZW91dE1TKSB7XG4gICAgY29uc3QgbmV4dE9iamVjdFByb21pc2UgPSB0aGlzLl9uZXh0T2JqZWN0UHJvbWlzZSgpO1xuICAgIGlmICghdGltZW91dE1TKSB7XG4gICAgICByZXR1cm4gbmV4dE9iamVjdFByb21pc2U7XG4gICAgfVxuXG4gICAgY29uc3QgdGltZW91dFByb21pc2UgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgIC8vIE9uIHRpbWVvdXQsIGNsb3NlIHRoZSBjdXJzb3IuXG4gICAgICBjb25zdCB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgcmVzb2x2ZSh0aGlzLmNsb3NlKCkpO1xuICAgICAgfSwgdGltZW91dE1TKTtcblxuICAgICAgLy8gSWYgdGhlIGBfbmV4dE9iamVjdFByb21pc2VgIHJldHVybmVkIGZpcnN0LCBjYW5jZWwgdGhlIHRpbWVvdXQuXG4gICAgICBuZXh0T2JqZWN0UHJvbWlzZS5maW5hbGx5KCgpID0+IHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiBQcm9taXNlLnJhY2UoW25leHRPYmplY3RQcm9taXNlLCB0aW1lb3V0UHJvbWlzZV0pO1xuICB9XG5cbiAgYXN5bmMgZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIC8vIEdldCBiYWNrIHRvIHRoZSBiZWdpbm5pbmcuXG4gICAgdGhpcy5fcmV3aW5kKCk7XG5cbiAgICBsZXQgaWR4ID0gMDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgZG9jID0gYXdhaXQgdGhpcy5fbmV4dE9iamVjdFByb21pc2UoKTtcbiAgICAgIGlmICghZG9jKSByZXR1cm47XG4gICAgICBhd2FpdCBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGRvYywgaWR4KyssIHRoaXMuX3NlbGZGb3JJdGVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG1hcChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICBhd2FpdCB0aGlzLmZvckVhY2goYXN5bmMgKGRvYywgaW5kZXgpID0+IHtcbiAgICAgIHJlc3VsdHMucHVzaChhd2FpdCBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGRvYywgaW5kZXgsIHRoaXMuX3NlbGZGb3JJdGVyYXRpb24pKTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgX3Jld2luZCgpIHtcbiAgICAvLyBrbm93biB0byBiZSBzeW5jaHJvbm91c1xuICAgIHRoaXMuX2RiQ3Vyc29yLnJld2luZCgpO1xuXG4gICAgdGhpcy5fdmlzaXRlZElkcyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICB9XG5cbiAgLy8gTW9zdGx5IHVzYWJsZSBmb3IgdGFpbGFibGUgY3Vyc29ycy5cbiAgYXN5bmMgY2xvc2UoKSB7XG4gICAgdGhpcy5fY2xvc2luZyA9IHRydWU7XG4gICAgLy8gSWYgdGhlcmUncyBhIHBlbmRpbmcgbmV4dCgpLCB3YWl0IGZvciBpdCB0byBmaW5pc2ggb3IgYWJvcnRcbiAgICBpZiAodGhpcy5fcGVuZGluZ05leHQpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHRoaXMuX3BlbmRpbmdOZXh0O1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBpZ25vcmVcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5fZGJDdXJzb3IuY2xvc2UoKTtcbiAgfVxuXG4gIGZldGNoKCkge1xuICAgIHJldHVybiB0aGlzLm1hcChkb2MgPT4gZG9jKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGSVhNRTogKG5vZGU6MzQ2ODApIFtNT05HT0RCIERSSVZFUl0gV2FybmluZzogY3Vyc29yLmNvdW50IGlzIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmVcbiAgICogIHJlbW92ZWQgaW4gdGhlIG5leHQgbWFqb3IgdmVyc2lvbiwgcGxlYXNlIHVzZSBgY29sbGVjdGlvbi5lc3RpbWF0ZWREb2N1bWVudENvdW50YCBvclxuICAgKiAgYGNvbGxlY3Rpb24uY291bnREb2N1bWVudHNgIGluc3RlYWQuXG4gICAqL1xuICBjb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGJDdXJzb3IuY291bnQoKTtcbiAgfVxuXG4gIC8vIFRoaXMgbWV0aG9kIGlzIE5PVCB3cmFwcGVkIGluIEN1cnNvci5cbiAgYXN5bmMgZ2V0UmF3T2JqZWN0cyhvcmRlcmVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChvcmRlcmVkKSB7XG4gICAgICByZXR1cm4gc2VsZi5mZXRjaCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcmVzdWx0cyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICAgICAgYXdhaXQgc2VsZi5mb3JFYWNoKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgcmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuICB9XG59IiwiaW1wb3J0IHsgQVNZTkNfQ1VSU09SX01FVEhPRFMsIGdldEFzeW5jTWV0aG9kTmFtZSB9IGZyb20gJ21ldGVvci9taW5pbW9uZ28vY29uc3RhbnRzJztcbmltcG9ydCB7IHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvLCByZXBsYWNlVHlwZXMgfSBmcm9tICcuL21vbmdvX2NvbW1vbic7XG5pbXBvcnQgTG9jYWxDb2xsZWN0aW9uIGZyb20gJ21ldGVvci9taW5pbW9uZ28vbG9jYWxfY29sbGVjdGlvbic7XG5pbXBvcnQgeyBDdXJzb3JEZXNjcmlwdGlvbiB9IGZyb20gJy4vY3Vyc29yX2Rlc2NyaXB0aW9uJztcbmltcG9ydCB7IE9ic2VydmVDYWxsYmFja3MsIE9ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzIH0gZnJvbSAnLi90eXBlcyc7XG5cbmludGVyZmFjZSBNb25nb0ludGVyZmFjZSB7XG4gIHJhd0NvbGxlY3Rpb246IChjb2xsZWN0aW9uTmFtZTogc3RyaW5nKSA9PiBhbnk7XG4gIF9jcmVhdGVBc3luY2hyb25vdXNDdXJzb3I6IChjdXJzb3JEZXNjcmlwdGlvbjogQ3Vyc29yRGVzY3JpcHRpb24sIG9wdGlvbnM6IEN1cnNvck9wdGlvbnMpID0+IGFueTtcbiAgX29ic2VydmVDaGFuZ2VzOiAoY3Vyc29yRGVzY3JpcHRpb246IEN1cnNvckRlc2NyaXB0aW9uLCBvcmRlcmVkOiBib29sZWFuLCBjYWxsYmFja3M6IGFueSwgbm9uTXV0YXRpbmdDYWxsYmFja3M/OiBib29sZWFuKSA9PiBhbnk7XG59XG5cbmludGVyZmFjZSBDdXJzb3JPcHRpb25zIHtcbiAgc2VsZkZvckl0ZXJhdGlvbjogQ3Vyc29yPGFueT47XG4gIHVzZVRyYW5zZm9ybTogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBAY2xhc3MgQ3Vyc29yXG4gKlxuICogVGhlIG1haW4gY3Vyc29yIG9iamVjdCByZXR1cm5lZCBmcm9tIGZpbmQoKSwgaW1wbGVtZW50aW5nIHRoZSBkb2N1bWVudGVkXG4gKiBNb25nby5Db2xsZWN0aW9uIGN1cnNvciBBUEkuXG4gKlxuICogV3JhcHMgYSBDdXJzb3JEZXNjcmlwdGlvbiBhbmQgbGF6aWx5IGNyZWF0ZXMgYW4gQXN5bmNocm9ub3VzQ3Vyc29yXG4gKiAob25seSBjb250YWN0cyBNb25nb0RCIHdoZW4gbWV0aG9kcyBsaWtlIGZldGNoIG9yIGZvckVhY2ggYXJlIGNhbGxlZCkuXG4gKi9cbmV4cG9ydCBjbGFzcyBDdXJzb3I8VCwgVSA9IFQ+IHtcbiAgcHVibGljIF9tb25nbzogTW9uZ29JbnRlcmZhY2U7XG4gIHB1YmxpYyBfY3Vyc29yRGVzY3JpcHRpb246IEN1cnNvckRlc2NyaXB0aW9uO1xuICBwdWJsaWMgX3N5bmNocm9ub3VzQ3Vyc29yOiBhbnkgfCBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKG1vbmdvOiBNb25nb0ludGVyZmFjZSwgY3Vyc29yRGVzY3JpcHRpb246IEN1cnNvckRlc2NyaXB0aW9uKSB7XG4gICAgdGhpcy5fbW9uZ28gPSBtb25nbztcbiAgICB0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbiA9IGN1cnNvckRlc2NyaXB0aW9uO1xuICAgIHRoaXMuX3N5bmNocm9ub3VzQ3Vyc29yID0gbnVsbDtcbiAgfVxuXG4gIGFzeW5jIGNvdW50QXN5bmMoKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBjb25zdCBjb2xsZWN0aW9uID0gdGhpcy5fbW9uZ28ucmF3Q29sbGVjdGlvbih0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZSk7XG4gICAgcmV0dXJuIGF3YWl0IGNvbGxlY3Rpb24uY291bnREb2N1bWVudHMoXG4gICAgICByZXBsYWNlVHlwZXModGhpcy5fY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICAgIHJlcGxhY2VUeXBlcyh0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksXG4gICAgKTtcbiAgfVxuXG4gIGNvdW50KCk6IG5ldmVyIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcImNvdW50KCkgaXMgbm90IGF2YWlsYWJsZSBvbiB0aGUgc2VydmVyLiBQbGVhc2UgdXNlIGNvdW50QXN5bmMoKSBpbnN0ZWFkLlwiXG4gICAgKTtcbiAgfVxuXG4gIGdldFRyYW5zZm9ybSgpOiAoKGRvYzogYW55KSA9PiBhbnkpIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5fY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy50cmFuc2Zvcm07XG4gIH1cblxuICBfcHVibGlzaEN1cnNvcihzdWI6IGFueSk6IGFueSB7XG4gICAgY29uc3QgY29sbGVjdGlvbiA9IHRoaXMuX2N1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lO1xuICAgIHJldHVybiBNb25nby5Db2xsZWN0aW9uLl9wdWJsaXNoQ3Vyc29yKHRoaXMsIHN1YiwgY29sbGVjdGlvbik7XG4gIH1cblxuICBfZ2V0Q29sbGVjdGlvbk5hbWUoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWU7XG4gIH1cblxuICBvYnNlcnZlKGNhbGxiYWNrczogT2JzZXJ2ZUNhbGxiYWNrczxVPik6IGFueSB7XG4gICAgcmV0dXJuIExvY2FsQ29sbGVjdGlvbi5fb2JzZXJ2ZUZyb21PYnNlcnZlQ2hhbmdlcyh0aGlzLCBjYWxsYmFja3MpO1xuICB9XG5cbiAgYXN5bmMgb2JzZXJ2ZUFzeW5jKGNhbGxiYWNrczogT2JzZXJ2ZUNhbGxiYWNrczxVPik6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gcmVzb2x2ZSh0aGlzLm9ic2VydmUoY2FsbGJhY2tzKSkpO1xuICB9XG5cbiAgb2JzZXJ2ZUNoYW5nZXMoY2FsbGJhY2tzOiBPYnNlcnZlQ2hhbmdlc0NhbGxiYWNrczxVPiwgb3B0aW9uczogeyBub25NdXRhdGluZ0NhbGxiYWNrcz86IGJvb2xlYW4gfSA9IHt9KTogYW55IHtcbiAgICBjb25zdCBvcmRlcmVkID0gTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlQ2hhbmdlc0NhbGxiYWNrc0FyZU9yZGVyZWQoY2FsbGJhY2tzKTtcbiAgICByZXR1cm4gdGhpcy5fbW9uZ28uX29ic2VydmVDaGFuZ2VzKFxuICAgICAgdGhpcy5fY3Vyc29yRGVzY3JpcHRpb24sXG4gICAgICBvcmRlcmVkLFxuICAgICAgY2FsbGJhY2tzLFxuICAgICAgb3B0aW9ucy5ub25NdXRhdGluZ0NhbGxiYWNrc1xuICAgICk7XG4gIH1cblxuICBhc3luYyBvYnNlcnZlQ2hhbmdlc0FzeW5jKGNhbGxiYWNrczogT2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3M8VT4sIG9wdGlvbnM6IHsgbm9uTXV0YXRpbmdDYWxsYmFja3M/OiBib29sZWFuIH0gPSB7fSk6IFByb21pc2U8YW55PiB7XG4gICAgcmV0dXJuIHRoaXMub2JzZXJ2ZUNoYW5nZXMoY2FsbGJhY2tzLCBvcHRpb25zKTtcbiAgfVxufVxuXG4vLyBBZGQgY3Vyc29yIG1ldGhvZHMgZHluYW1pY2FsbHlcblsuLi5BU1lOQ19DVVJTT1JfTUVUSE9EUywgU3ltYm9sLml0ZXJhdG9yLCBTeW1ib2wuYXN5bmNJdGVyYXRvcl0uZm9yRWFjaChtZXRob2ROYW1lID0+IHtcbiAgaWYgKG1ldGhvZE5hbWUgPT09ICdjb3VudCcpIHJldHVybjtcblxuICAoQ3Vyc29yLnByb3RvdHlwZSBhcyBhbnkpW21ldGhvZE5hbWVdID0gZnVuY3Rpb24odGhpczogQ3Vyc29yPGFueT4sIC4uLmFyZ3M6IGFueVtdKTogYW55IHtcbiAgICBjb25zdCBjdXJzb3IgPSBzZXR1cEFzeW5jaHJvbm91c0N1cnNvcih0aGlzLCBtZXRob2ROYW1lKTtcbiAgICByZXR1cm4gY3Vyc29yW21ldGhvZE5hbWVdKC4uLmFyZ3MpO1xuICB9O1xuXG4gIGlmIChtZXRob2ROYW1lID09PSBTeW1ib2wuaXRlcmF0b3IgfHwgbWV0aG9kTmFtZSA9PT0gU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHJldHVybjtcblxuICBjb25zdCBtZXRob2ROYW1lQXN5bmMgPSBnZXRBc3luY01ldGhvZE5hbWUobWV0aG9kTmFtZSk7XG5cbiAgKEN1cnNvci5wcm90b3R5cGUgYXMgYW55KVttZXRob2ROYW1lQXN5bmNdID0gZnVuY3Rpb24odGhpczogQ3Vyc29yPGFueT4sIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gdGhpc1ttZXRob2ROYW1lXSguLi5hcmdzKTtcbiAgfTtcbn0pO1xuXG5mdW5jdGlvbiBzZXR1cEFzeW5jaHJvbm91c0N1cnNvcihjdXJzb3I6IEN1cnNvcjxhbnk+LCBtZXRob2Q6IHN0cmluZyB8IHN5bWJvbCk6IGFueSB7XG4gIGlmIChjdXJzb3IuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudGFpbGFibGUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBjYWxsICR7U3RyaW5nKG1ldGhvZCl9IG9uIGEgdGFpbGFibGUgY3Vyc29yYCk7XG4gIH1cblxuICBpZiAoIWN1cnNvci5fc3luY2hyb25vdXNDdXJzb3IpIHtcbiAgICBjdXJzb3IuX3N5bmNocm9ub3VzQ3Vyc29yID0gY3Vyc29yLl9tb25nby5fY3JlYXRlQXN5bmNocm9ub3VzQ3Vyc29yKFxuICAgICAgY3Vyc29yLl9jdXJzb3JEZXNjcmlwdGlvbixcbiAgICAgIHtcbiAgICAgICAgc2VsZkZvckl0ZXJhdGlvbjogY3Vyc29yLFxuICAgICAgICB1c2VUcmFuc2Zvcm06IHRydWUsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBjdXJzb3IuX3N5bmNocm9ub3VzQ3Vyc29yO1xufSIsIi8vIHNpbmdsZXRvblxuZXhwb3J0IGNvbnN0IExvY2FsQ29sbGVjdGlvbkRyaXZlciA9IG5ldyAoY2xhc3MgTG9jYWxDb2xsZWN0aW9uRHJpdmVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5ub0Nvbm5Db2xsZWN0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIH1cblxuICBvcGVuKG5hbWUsIGNvbm4pIHtcbiAgICBpZiAoISBuYW1lKSB7XG4gICAgICByZXR1cm4gbmV3IExvY2FsQ29sbGVjdGlvbjtcbiAgICB9XG5cbiAgICBpZiAoISBjb25uKSB7XG4gICAgICByZXR1cm4gZW5zdXJlQ29sbGVjdGlvbihuYW1lLCB0aGlzLm5vQ29ubkNvbGxlY3Rpb25zKTtcbiAgICB9XG5cbiAgICBpZiAoISBjb25uLl9tb25nb19saXZlZGF0YV9jb2xsZWN0aW9ucykge1xuICAgICAgY29ubi5fbW9uZ29fbGl2ZWRhdGFfY29sbGVjdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIH1cblxuICAgIC8vIFhYWCBpcyB0aGVyZSBhIHdheSB0byBrZWVwIHRyYWNrIG9mIGEgY29ubmVjdGlvbidzIGNvbGxlY3Rpb25zIHdpdGhvdXRcbiAgICAvLyBkYW5nbGluZyBpdCBvZmYgdGhlIGNvbm5lY3Rpb24gb2JqZWN0P1xuICAgIHJldHVybiBlbnN1cmVDb2xsZWN0aW9uKG5hbWUsIGNvbm4uX21vbmdvX2xpdmVkYXRhX2NvbGxlY3Rpb25zKTtcbiAgfVxufSk7XG5cbmZ1bmN0aW9uIGVuc3VyZUNvbGxlY3Rpb24obmFtZSwgY29sbGVjdGlvbnMpIHtcbiAgcmV0dXJuIChuYW1lIGluIGNvbGxlY3Rpb25zKVxuICAgID8gY29sbGVjdGlvbnNbbmFtZV1cbiAgICA6IGNvbGxlY3Rpb25zW25hbWVdID0gbmV3IExvY2FsQ29sbGVjdGlvbihuYW1lKTtcbn1cbiIsImltcG9ydCBvbmNlIGZyb20gJ2xvZGFzaC5vbmNlJztcbmltcG9ydCB7XG4gIEFTWU5DX0NPTExFQ1RJT05fTUVUSE9EUyxcbiAgZ2V0QXN5bmNNZXRob2ROYW1lLFxuICBDTElFTlRfT05MWV9NRVRIT0RTXG59IGZyb20gXCJtZXRlb3IvbWluaW1vbmdvL2NvbnN0YW50c1wiO1xuaW1wb3J0IHsgTW9uZ29Db25uZWN0aW9uIH0gZnJvbSAnLi9tb25nb19jb25uZWN0aW9uJztcblxuLy8gRGVmaW5lIGludGVyZmFjZXMgYW5kIHR5cGVzXG5pbnRlcmZhY2UgSUNvbm5lY3Rpb25PcHRpb25zIHtcbiAgb3Bsb2dVcmw/OiBzdHJpbmc7XG4gIFtrZXk6IHN0cmluZ106IHVua25vd247ICAvLyBDaGFuZ2VkIGZyb20gJ2FueScgdG8gJ3Vua25vd24nIGZvciBiZXR0ZXIgdHlwZSBzYWZldHlcbn1cblxuaW50ZXJmYWNlIElNb25nb0ludGVybmFscyB7XG4gIFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXI6IHR5cGVvZiBSZW1vdGVDb2xsZWN0aW9uRHJpdmVyO1xuICBkZWZhdWx0UmVtb3RlQ29sbGVjdGlvbkRyaXZlcjogKCkgPT4gUmVtb3RlQ29sbGVjdGlvbkRyaXZlcjtcbn1cblxuLy8gTW9yZSBzcGVjaWZpYyB0eXBpbmcgZm9yIGNvbGxlY3Rpb24gbWV0aG9kc1xudHlwZSBNb25nb01ldGhvZEZ1bmN0aW9uID0gKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gdW5rbm93bjtcbmludGVyZmFjZSBJQ29sbGVjdGlvbk1ldGhvZHMge1xuICBba2V5OiBzdHJpbmddOiBNb25nb01ldGhvZEZ1bmN0aW9uO1xufVxuXG4vLyBUeXBlIGZvciBNb25nb0Nvbm5lY3Rpb25cbmludGVyZmFjZSBJTW9uZ29DbGllbnQge1xuICBjb25uZWN0OiAoKSA9PiBQcm9taXNlPHZvaWQ+O1xufVxuXG5pbnRlcmZhY2UgSU1vbmdvQ29ubmVjdGlvbiB7XG4gIGNsaWVudDogSU1vbmdvQ2xpZW50O1xuICBba2V5OiBzdHJpbmddOiBNb25nb01ldGhvZEZ1bmN0aW9uIHwgSU1vbmdvQ2xpZW50O1xufVxuXG5kZWNsYXJlIGdsb2JhbCB7XG4gIG5hbWVzcGFjZSBOb2RlSlMge1xuICAgIGludGVyZmFjZSBQcm9jZXNzRW52IHtcbiAgICAgIE1PTkdPX1VSTDogc3RyaW5nO1xuICAgICAgTU9OR09fT1BMT0dfVVJMPzogc3RyaW5nO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IE1vbmdvSW50ZXJuYWxzOiBJTW9uZ29JbnRlcm5hbHM7XG4gIGNvbnN0IE1ldGVvcjoge1xuICAgIHN0YXJ0dXA6IChjYWxsYmFjazogKCkgPT4gUHJvbWlzZTx2b2lkPikgPT4gdm9pZDtcbiAgfTtcbn1cblxuY2xhc3MgUmVtb3RlQ29sbGVjdGlvbkRyaXZlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgbW9uZ286IE1vbmdvQ29ubmVjdGlvbjtcblxuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBSRU1PVEVfQ09MTEVDVElPTl9NRVRIT0RTID0gW1xuICAgICdjcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMnLFxuICAgICdkcm9wSW5kZXhBc3luYycsXG4gICAgJ2Vuc3VyZUluZGV4QXN5bmMnLFxuICAgICdjcmVhdGVJbmRleEFzeW5jJyxcbiAgICAnY291bnREb2N1bWVudHMnLFxuICAgICdkcm9wQ29sbGVjdGlvbkFzeW5jJyxcbiAgICAnZXN0aW1hdGVkRG9jdW1lbnRDb3VudCcsXG4gICAgJ2ZpbmQnLFxuICAgICdmaW5kT25lQXN5bmMnLFxuICAgICdpbnNlcnRBc3luYycsXG4gICAgJ3Jhd0NvbGxlY3Rpb24nLFxuICAgICdyZW1vdmVBc3luYycsXG4gICAgJ3VwZGF0ZUFzeW5jJyxcbiAgICAndXBzZXJ0QXN5bmMnLFxuICBdIGFzIGNvbnN0O1xuXG4gIGNvbnN0cnVjdG9yKG1vbmdvVXJsOiBzdHJpbmcsIG9wdGlvbnM6IElDb25uZWN0aW9uT3B0aW9ucykge1xuICAgIHRoaXMubW9uZ28gPSBuZXcgTW9uZ29Db25uZWN0aW9uKG1vbmdvVXJsLCBvcHRpb25zKTtcbiAgfVxuXG4gIHB1YmxpYyBvcGVuKG5hbWU6IHN0cmluZyk6IElDb2xsZWN0aW9uTWV0aG9kcyB7XG4gICAgY29uc3QgcmV0OiBJQ29sbGVjdGlvbk1ldGhvZHMgPSB7fTtcblxuICAgIC8vIEhhbmRsZSByZW1vdGUgY29sbGVjdGlvbiBtZXRob2RzXG4gICAgUmVtb3RlQ29sbGVjdGlvbkRyaXZlci5SRU1PVEVfQ09MTEVDVElPTl9NRVRIT0RTLmZvckVhY2goKG1ldGhvZCkgPT4ge1xuICAgICAgLy8gVHlwZSBhc3NlcnRpb24gbmVlZGVkIGJlY2F1c2Ugd2Uga25vdyB0aGVzZSBtZXRob2RzIGV4aXN0IG9uIE1vbmdvQ29ubmVjdGlvblxuICAgICAgY29uc3QgbW9uZ29NZXRob2QgPSB0aGlzLm1vbmdvW21ldGhvZF0gYXMgTW9uZ29NZXRob2RGdW5jdGlvbjtcbiAgICAgIHJldFttZXRob2RdID0gbW9uZ29NZXRob2QuYmluZCh0aGlzLm1vbmdvLCBuYW1lKTtcblxuICAgICAgaWYgKCFBU1lOQ19DT0xMRUNUSU9OX01FVEhPRFMuaW5jbHVkZXMobWV0aG9kKSkgcmV0dXJuO1xuXG4gICAgICBjb25zdCBhc3luY01ldGhvZE5hbWUgPSBnZXRBc3luY01ldGhvZE5hbWUobWV0aG9kKTtcbiAgICAgIHJldFthc3luY01ldGhvZE5hbWVdID0gKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gcmV0W21ldGhvZF0oLi4uYXJncyk7XG4gICAgfSk7XG5cbiAgICAvLyBIYW5kbGUgY2xpZW50LW9ubHkgbWV0aG9kc1xuICAgIENMSUVOVF9PTkxZX01FVEhPRFMuZm9yRWFjaCgobWV0aG9kKSA9PiB7XG4gICAgICByZXRbbWV0aG9kXSA9ICguLi5hcmdzOiB1bmtub3duW10pOiBuZXZlciA9PiB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgJHttZXRob2R9IGlzIG5vdCBhdmFpbGFibGUgb24gdGhlIHNlcnZlci4gUGxlYXNlIHVzZSAke2dldEFzeW5jTWV0aG9kTmFtZShcbiAgICAgICAgICAgIG1ldGhvZFxuICAgICAgICAgICl9KCkgaW5zdGVhZC5gXG4gICAgICAgICk7XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJldDtcbiAgfVxufVxuXG4vLyBBc3NpZ24gdGhlIGNsYXNzIHRvIE1vbmdvSW50ZXJuYWxzXG5Nb25nb0ludGVybmFscy5SZW1vdGVDb2xsZWN0aW9uRHJpdmVyID0gUmVtb3RlQ29sbGVjdGlvbkRyaXZlcjtcblxuLy8gQ3JlYXRlIHRoZSBzaW5nbGV0b24gUmVtb3RlQ29sbGVjdGlvbkRyaXZlciBvbmx5IG9uIGRlbWFuZFxuTW9uZ29JbnRlcm5hbHMuZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIgPSBvbmNlKCgpOiBSZW1vdGVDb2xsZWN0aW9uRHJpdmVyID0+IHtcbiAgY29uc3QgY29ubmVjdGlvbk9wdGlvbnM6IElDb25uZWN0aW9uT3B0aW9ucyA9IHt9O1xuICBjb25zdCBtb25nb1VybCA9IHByb2Nlc3MuZW52Lk1PTkdPX1VSTDtcblxuICBpZiAoIW1vbmdvVXJsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTU9OR09fVVJMIG11c3QgYmUgc2V0IGluIGVudmlyb25tZW50XCIpO1xuICB9XG5cbiAgaWYgKHByb2Nlc3MuZW52Lk1PTkdPX09QTE9HX1VSTCkge1xuICAgIGNvbm5lY3Rpb25PcHRpb25zLm9wbG9nVXJsID0gcHJvY2Vzcy5lbnYuTU9OR09fT1BMT0dfVVJMO1xuICB9XG5cbiAgY29uc3QgZHJpdmVyID0gbmV3IFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIobW9uZ29VcmwsIGNvbm5lY3Rpb25PcHRpb25zKTtcblxuICAvLyBJbml0aWFsaXplIGRhdGFiYXNlIGNvbm5lY3Rpb24gb24gc3RhcnR1cFxuICBNZXRlb3Iuc3RhcnR1cChhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgYXdhaXQgZHJpdmVyLm1vbmdvLmNsaWVudC5jb25uZWN0KCk7XG4gIH0pO1xuXG4gIHJldHVybiBkcml2ZXI7XG59KTtcblxuZXhwb3J0IHsgUmVtb3RlQ29sbGVjdGlvbkRyaXZlciwgSUNvbm5lY3Rpb25PcHRpb25zLCBJQ29sbGVjdGlvbk1ldGhvZHMgfTsiLCIvKipcbiAqIENvbGxlY3Rpb24gRXh0ZW5zaW9ucyBTeXN0ZW1cbiAqIFxuICogUHJvdmlkZXMgYSBjbGVhbiB3YXkgdG8gZXh0ZW5kIE1vbmdvLkNvbGxlY3Rpb24gZnVuY3Rpb25hbGl0eVxuICogd2l0aG91dCBtb25rZXkgcGF0Y2hpbmcuIFN1cHBvcnRzIGNvbnN0cnVjdG9yIGV4dGVuc2lvbnMsXG4gKiBwcm90b3R5cGUgbWV0aG9kcywgYW5kIHN0YXRpYyBtZXRob2RzLlxuICovXG5cbmlmIChQYWNrYWdlWydsYWk6Y29sbGVjdGlvbi1leHRlbnNpb25zJ10pIHtcbiAgY29uc29sZS53YXJuKCdsYWk6Y29sbGVjdGlvbi1leHRlbnNpb25zIGlzIG5vdCBkZXByZWNhdGVkLiBVc2UgTW9uZ28uQ29sbGVjdGlvbi5hZGRFeHRlbnNpb24gaW5zdGVhZC4nKTtcbn1cblxuQ29sbGVjdGlvbkV4dGVuc2lvbnMgPSB7XG4gIF9leHRlbnNpb25zOiBbXSxcbiAgX3Byb3RvdHlwZU1ldGhvZHM6IG5ldyBNYXAoKSxcbiAgX3N0YXRpY01ldGhvZHM6IG5ldyBNYXAoKSxcbiAgXG4gIC8qKlxuICAgKiBBZGQgYSBjb25zdHJ1Y3RvciBleHRlbnNpb24gZnVuY3Rpb25cbiAgICogRXh0ZW5zaW9uIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIChuYW1lLCBvcHRpb25zKSBhbmQgJ3RoaXMnIGJvdW5kIHRvIGNvbGxlY3Rpb24gaW5zdGFuY2VcbiAgICovXG4gIGFkZEV4dGVuc2lvbihleHRlbnNpb24pIHtcbiAgICBpZiAodHlwZW9mIGV4dGVuc2lvbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHRlbnNpb24gbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIHRoaXMuX2V4dGVuc2lvbnMucHVzaChleHRlbnNpb24pO1xuICB9LFxuICBcbiAgLyoqXG4gICAqIEFkZCBhIHByb3RvdHlwZSBtZXRob2QgdG8gYWxsIGNvbGxlY3Rpb24gaW5zdGFuY2VzXG4gICAqIE1ldGhvZCBpcyBib3VuZCB0byB0aGUgY29sbGVjdGlvbiBpbnN0YW5jZVxuICAgKi9cbiAgYWRkUHJvdG90eXBlTWV0aG9kKG5hbWUsIG1ldGhvZCkge1xuICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycgfHwgIW5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUHJvdG90eXBlIG1ldGhvZCBuYW1lIG11c3QgYmUgYSBub24tZW1wdHkgc3RyaW5nJyk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbWV0aG9kICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb3RvdHlwZSBtZXRob2QgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIFxuICAgIHRoaXMuX3Byb3RvdHlwZU1ldGhvZHMuc2V0KG5hbWUsIG1ldGhvZCk7XG4gIH0sXG4gIFxuICAvKipcbiAgICogQWRkIGEgc3RhdGljIG1ldGhvZCB0byB0aGUgTW9uZ28uQ29sbGVjdGlvbiBjb25zdHJ1Y3RvclxuICAgKi9cbiAgYWRkU3RhdGljTWV0aG9kKG5hbWUsIG1ldGhvZCkge1xuICAgIGlmICh0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycgfHwgIW5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU3RhdGljIG1ldGhvZCBuYW1lIG11c3QgYmUgYSBub24tZW1wdHkgc3RyaW5nJyk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbWV0aG9kICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0YXRpYyBtZXRob2QgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIFxuICAgIHRoaXMuX3N0YXRpY01ldGhvZHMuc2V0KG5hbWUsIG1ldGhvZCk7XG4gIH0sXG4gIFxuICAvKipcbiAgICogUmVtb3ZlIGFuIGV4dGVuc2lvbiAodXNlZnVsIGZvciB0ZXN0aW5nKVxuICAgKi9cbiAgcmVtb3ZlRXh0ZW5zaW9uKGV4dGVuc2lvbikge1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZXh0ZW5zaW9ucy5pbmRleE9mKGV4dGVuc2lvbik7XG4gICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgIHRoaXMuX2V4dGVuc2lvbnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG4gIH0sXG4gIFxuICAvKipcbiAgICogUmVtb3ZlIGEgcHJvdG90eXBlIG1ldGhvZFxuICAgKi9cbiAgcmVtb3ZlUHJvdG90eXBlTWV0aG9kKG5hbWUpIHtcbiAgICB0aGlzLl9wcm90b3R5cGVNZXRob2RzLmRlbGV0ZShuYW1lKTtcbiAgfSxcbiAgXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBzdGF0aWMgbWV0aG9kXG4gICAqL1xuICByZW1vdmVTdGF0aWNNZXRob2QobmFtZSkge1xuICAgIHRoaXMuX3N0YXRpY01ldGhvZHMuZGVsZXRlKG5hbWUpO1xuICB9LFxuICBcbiAgLyoqXG4gICAqIENsZWFyIGFsbCBleHRlbnNpb25zICh1c2VmdWwgZm9yIHRlc3RpbmcpXG4gICAqL1xuICBjbGVhckV4dGVuc2lvbnMoKSB7XG4gICAgdGhpcy5fZXh0ZW5zaW9ucy5sZW5ndGggPSAwO1xuICAgIHRoaXMuX3Byb3RvdHlwZU1ldGhvZHMuY2xlYXIoKTtcbiAgICB0aGlzLl9zdGF0aWNNZXRob2RzLmNsZWFyKCk7XG4gIH0sXG4gIFxuICAvKipcbiAgICogR2V0IGFsbCByZWdpc3RlcmVkIGV4dGVuc2lvbnMgKHVzZWZ1bCBmb3IgZGVidWdnaW5nKVxuICAgKi9cbiAgZ2V0RXh0ZW5zaW9ucygpIHtcbiAgICByZXR1cm4gWy4uLnRoaXMuX2V4dGVuc2lvbnNdO1xuICB9LFxuICBcbiAgLyoqXG4gICAqIEdldCBhbGwgcmVnaXN0ZXJlZCBwcm90b3R5cGUgbWV0aG9kcyAodXNlZnVsIGZvciBkZWJ1Z2dpbmcpXG4gICAqL1xuICBnZXRQcm90b3R5cGVNZXRob2RzKCkge1xuICAgIHJldHVybiBuZXcgTWFwKHRoaXMuX3Byb3RvdHlwZU1ldGhvZHMpO1xuICB9LFxuICBcbiAgLyoqXG4gICAqIEdldCBhbGwgcmVnaXN0ZXJlZCBzdGF0aWMgbWV0aG9kcyAodXNlZnVsIGZvciBkZWJ1Z2dpbmcpXG4gICAqL1xuICBnZXRTdGF0aWNNZXRob2RzKCkge1xuICAgIHJldHVybiBuZXcgTWFwKHRoaXMuX3N0YXRpY01ldGhvZHMpO1xuICB9LFxuICBcblxuICBcbiAgLyoqXG4gICAqIEFwcGx5IGFsbCBleHRlbnNpb25zIHRvIGEgY29sbGVjdGlvbiBpbnN0YW5jZVxuICAgKiBDYWxsZWQgZHVyaW5nIGNvbGxlY3Rpb24gY29uc3RydWN0aW9uXG4gICAqL1xuICBfYXBwbHlFeHRlbnNpb25zKGluc3RhbmNlLCBuYW1lLCBvcHRpb25zKSB7XG4gICAgLy8gQXBwbHkgY29uc3RydWN0b3IgZXh0ZW5zaW9uc1xuICAgIGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIHRoaXMuX2V4dGVuc2lvbnMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGV4dGVuc2lvbi5jYWxsKGluc3RhbmNlLCBuYW1lLCBvcHRpb25zKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIC8vIFByb3ZpZGUgaGVscGZ1bCBlcnJvciBjb250ZXh0XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRXh0ZW5zaW9uIGZhaWxlZCBmb3IgY29sbGVjdGlvbiAnJHtuYW1lfSc6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgLy8gQXBwbHkgcHJvdG90eXBlIG1ldGhvZHNcbiAgICBmb3IgKGNvbnN0IFttZXRob2ROYW1lLCBtZXRob2RdIG9mIHRoaXMuX3Byb3RvdHlwZU1ldGhvZHMpIHtcbiAgICAgIGluc3RhbmNlW21ldGhvZE5hbWVdID0gbWV0aG9kLmJpbmQoaW5zdGFuY2UpO1xuICAgIH1cbiAgfSxcbiAgXG4gIC8qKlxuICAgKiBBcHBseSBzdGF0aWMgbWV0aG9kcyB0byB0aGUgTW9uZ28uQ29sbGVjdGlvbiBjb25zdHJ1Y3RvclxuICAgKiBDYWxsZWQgZHVyaW5nIHBhY2thZ2UgaW5pdGlhbGl6YXRpb25cbiAgICovXG4gIF9hcHBseVN0YXRpY01ldGhvZHMoQ29sbGVjdGlvbkNvbnN0cnVjdG9yKSB7XG4gICAgZm9yIChjb25zdCBbbWV0aG9kTmFtZSwgbWV0aG9kXSBvZiB0aGlzLl9zdGF0aWNNZXRob2RzKSB7XG4gICAgICBDb2xsZWN0aW9uQ29uc3RydWN0b3JbbWV0aG9kTmFtZV0gPSBtZXRob2Q7XG4gICAgfVxuICB9LFxuICBcblxufTsgIiwiaW1wb3J0IHsgbm9ybWFsaXplUHJvamVjdGlvbiB9IGZyb20gXCIuLi9tb25nb191dGlsc1wiO1xuaW1wb3J0IHsgQXN5bmNNZXRob2RzIH0gZnJvbSAnLi9tZXRob2RzX2FzeW5jJztcbmltcG9ydCB7IFN5bmNNZXRob2RzIH0gZnJvbSAnLi9tZXRob2RzX3N5bmMnO1xuaW1wb3J0IHsgSW5kZXhNZXRob2RzIH0gZnJvbSAnLi9tZXRob2RzX2luZGV4JztcbmltcG9ydCB7XG4gIElEX0dFTkVSQVRPUlMsXG4gIG5vcm1hbGl6ZU9wdGlvbnMsXG4gIHNldHVwQXV0b3B1Ymxpc2gsXG4gIHNldHVwQ29ubmVjdGlvbixcbiAgc2V0dXBEcml2ZXIsXG4gIHNldHVwTXV0YXRpb25NZXRob2RzLFxuICB2YWxpZGF0ZUNvbGxlY3Rpb25OYW1lXG59IGZyb20gJy4vY29sbGVjdGlvbl91dGlscyc7XG5pbXBvcnQgeyBSZXBsaWNhdGlvbk1ldGhvZHMgfSBmcm9tICcuL21ldGhvZHNfcmVwbGljYXRpb24nO1xuXG4vKipcbiAqIEBzdW1tYXJ5IE5hbWVzcGFjZSBmb3IgTW9uZ29EQi1yZWxhdGVkIGl0ZW1zXG4gKiBAbmFtZXNwYWNlXG4gKi9cbk1vbmdvID0ge307XG5cbi8qKlxuICogQHN1bW1hcnkgQ29uc3RydWN0b3IgZm9yIGEgQ29sbGVjdGlvblxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW5zdGFuY2VuYW1lIGNvbGxlY3Rpb25cbiAqIEBjbGFzc1xuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24uICBJZiBudWxsLCBjcmVhdGVzIGFuIHVubWFuYWdlZCAodW5zeW5jaHJvbml6ZWQpIGxvY2FsIGNvbGxlY3Rpb24uXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5jb25uZWN0aW9uIFRoZSBzZXJ2ZXIgY29ubmVjdGlvbiB0aGF0IHdpbGwgbWFuYWdlIHRoaXMgY29sbGVjdGlvbi4gVXNlcyB0aGUgZGVmYXVsdCBjb25uZWN0aW9uIGlmIG5vdCBzcGVjaWZpZWQuICBQYXNzIHRoZSByZXR1cm4gdmFsdWUgb2YgY2FsbGluZyBbYEREUC5jb25uZWN0YF0oI0REUC1jb25uZWN0KSB0byBzcGVjaWZ5IGEgZGlmZmVyZW50IHNlcnZlci4gUGFzcyBgbnVsbGAgdG8gc3BlY2lmeSBubyBjb25uZWN0aW9uLiBVbm1hbmFnZWQgKGBuYW1lYCBpcyBudWxsKSBjb2xsZWN0aW9ucyBjYW5ub3Qgc3BlY2lmeSBhIGNvbm5lY3Rpb24uXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5pZEdlbmVyYXRpb24gVGhlIG1ldGhvZCBvZiBnZW5lcmF0aW5nIHRoZSBgX2lkYCBmaWVsZHMgb2YgbmV3IGRvY3VtZW50cyBpbiB0aGlzIGNvbGxlY3Rpb24uICBQb3NzaWJsZSB2YWx1ZXM6XG5cbiAtICoqYCdTVFJJTkcnYCoqOiByYW5kb20gc3RyaW5nc1xuIC0gKipgJ01PTkdPJ2AqKjogIHJhbmRvbSBbYE1vbmdvLk9iamVjdElEYF0oI21vbmdvX29iamVjdF9pZCkgdmFsdWVzXG5cblRoZSBkZWZhdWx0IGlkIGdlbmVyYXRpb24gdGVjaG5pcXVlIGlzIGAnU1RSSU5HJ2AuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBBbiBvcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbi4gRG9jdW1lbnRzIHdpbGwgYmUgcGFzc2VkIHRocm91Z2ggdGhpcyBmdW5jdGlvbiBiZWZvcmUgYmVpbmcgcmV0dXJuZWQgZnJvbSBgZmV0Y2hgIG9yIGBmaW5kT25lQXN5bmNgLCBhbmQgYmVmb3JlIGJlaW5nIHBhc3NlZCB0byBjYWxsYmFja3Mgb2YgYG9ic2VydmVgLCBgbWFwYCwgYGZvckVhY2hgLCBgYWxsb3dgLCBhbmQgYGRlbnlgLiBUcmFuc2Zvcm1zIGFyZSAqbm90KiBhcHBsaWVkIGZvciB0aGUgY2FsbGJhY2tzIG9mIGBvYnNlcnZlQ2hhbmdlc2Agb3IgdG8gY3Vyc29ycyByZXR1cm5lZCBmcm9tIHB1Ymxpc2ggZnVuY3Rpb25zLlxuICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLmRlZmluZU11dGF0aW9uTWV0aG9kcyBTZXQgdG8gYGZhbHNlYCB0byBza2lwIHNldHRpbmcgdXAgdGhlIG11dGF0aW9uIG1ldGhvZHMgdGhhdCBlbmFibGUgaW5zZXJ0L3VwZGF0ZS9yZW1vdmUgZnJvbSBjbGllbnQgY29kZS4gRGVmYXVsdCBgdHJ1ZWAuXG4gKi9cbi8vIE1haW4gQ29sbGVjdGlvbiBjb25zdHJ1Y3RvclxuTW9uZ28uQ29sbGVjdGlvbiA9IGZ1bmN0aW9uIENvbGxlY3Rpb24obmFtZSwgb3B0aW9ucykge1xuICBuYW1lID0gdmFsaWRhdGVDb2xsZWN0aW9uTmFtZShuYW1lKTtcblxuICBvcHRpb25zID0gbm9ybWFsaXplT3B0aW9ucyhvcHRpb25zKTtcblxuICB0aGlzLl9tYWtlTmV3SUQgPSBJRF9HRU5FUkFUT1JTW29wdGlvbnMuaWRHZW5lcmF0aW9uXT8uKG5hbWUpO1xuXG4gIHRoaXMuX3RyYW5zZm9ybSA9IExvY2FsQ29sbGVjdGlvbi53cmFwVHJhbnNmb3JtKG9wdGlvbnMudHJhbnNmb3JtKTtcbiAgdGhpcy5yZXNvbHZlclR5cGUgPSBvcHRpb25zLnJlc29sdmVyVHlwZTtcblxuICB0aGlzLl9jb25uZWN0aW9uID0gc2V0dXBDb25uZWN0aW9uKG5hbWUsIG9wdGlvbnMpO1xuXG4gIGNvbnN0IGRyaXZlciA9IHNldHVwRHJpdmVyKG5hbWUsIHRoaXMuX2Nvbm5lY3Rpb24sIG9wdGlvbnMpO1xuICB0aGlzLl9kcml2ZXIgPSBkcml2ZXI7XG5cbiAgdGhpcy5fY29sbGVjdGlvbiA9IGRyaXZlci5vcGVuKG5hbWUsIHRoaXMuX2Nvbm5lY3Rpb24pO1xuICB0aGlzLl9uYW1lID0gbmFtZTtcblxuICB0aGlzLl9zZXR0aW5nVXBSZXBsaWNhdGlvblByb21pc2UgPSB0aGlzLl9tYXliZVNldFVwUmVwbGljYXRpb24obmFtZSwgb3B0aW9ucyk7XG5cbiAgc2V0dXBNdXRhdGlvbk1ldGhvZHModGhpcywgbmFtZSwgb3B0aW9ucyk7XG5cbiAgc2V0dXBBdXRvcHVibGlzaCh0aGlzLCBuYW1lLCBvcHRpb25zKTtcblxuICBNb25nby5fY29sbGVjdGlvbnMuc2V0KG5hbWUsIHRoaXMpO1xuICBcbiAgLy8gQXBwbHkgY29sbGVjdGlvbiBleHRlbnNpb25zXG4gIENvbGxlY3Rpb25FeHRlbnNpb25zLl9hcHBseUV4dGVuc2lvbnModGhpcywgbmFtZSwgb3B0aW9ucyk7XG59O1xuXG4vLyBBcHBseSBzdGF0aWMgbWV0aG9kcyB0byB0aGUgQ29sbGVjdGlvbiBjb25zdHJ1Y3RvclxuQ29sbGVjdGlvbkV4dGVuc2lvbnMuX2FwcGx5U3RhdGljTWV0aG9kcyhNb25nby5Db2xsZWN0aW9uKTtcblxuXG5PYmplY3QuYXNzaWduKE1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlLCB7XG4gIF9nZXRGaW5kU2VsZWN0b3IoYXJncykge1xuICAgIGlmIChhcmdzLmxlbmd0aCA9PSAwKSByZXR1cm4ge307XG4gICAgZWxzZSByZXR1cm4gYXJnc1swXTtcbiAgfSxcblxuICBfZ2V0RmluZE9wdGlvbnMoYXJncykge1xuICAgIGNvbnN0IFssIG9wdGlvbnNdID0gYXJncyB8fCBbXTtcbiAgICBjb25zdCBuZXdPcHRpb25zID0gbm9ybWFsaXplUHJvamVjdGlvbihvcHRpb25zKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoYXJncy5sZW5ndGggPCAyKSB7XG4gICAgICByZXR1cm4geyB0cmFuc2Zvcm06IHNlbGYuX3RyYW5zZm9ybSB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjaGVjayhcbiAgICAgICAgbmV3T3B0aW9ucyxcbiAgICAgICAgTWF0Y2guT3B0aW9uYWwoXG4gICAgICAgICAgTWF0Y2guT2JqZWN0SW5jbHVkaW5nKHtcbiAgICAgICAgICAgIHByb2plY3Rpb246IE1hdGNoLk9wdGlvbmFsKE1hdGNoLk9uZU9mKE9iamVjdCwgdW5kZWZpbmVkKSksXG4gICAgICAgICAgICBzb3J0OiBNYXRjaC5PcHRpb25hbChcbiAgICAgICAgICAgICAgTWF0Y2guT25lT2YoT2JqZWN0LCBBcnJheSwgRnVuY3Rpb24sIHVuZGVmaW5lZClcbiAgICAgICAgICAgICksXG4gICAgICAgICAgICBsaW1pdDogTWF0Y2guT3B0aW9uYWwoTWF0Y2guT25lT2YoTnVtYmVyLCB1bmRlZmluZWQpKSxcbiAgICAgICAgICAgIHNraXA6IE1hdGNoLk9wdGlvbmFsKE1hdGNoLk9uZU9mKE51bWJlciwgdW5kZWZpbmVkKSksXG4gICAgICAgICAgfSlcbiAgICAgICAgKVxuICAgICAgKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHJhbnNmb3JtOiBzZWxmLl90cmFuc2Zvcm0sXG4gICAgICAgIC4uLm5ld09wdGlvbnMsXG4gICAgICB9O1xuICAgIH1cbiAgfSxcbn0pO1xuXG5PYmplY3QuYXNzaWduKE1vbmdvLkNvbGxlY3Rpb24sIHtcbiAgYXN5bmMgX3B1Ymxpc2hDdXJzb3IoY3Vyc29yLCBzdWIsIGNvbGxlY3Rpb24pIHtcbiAgICB2YXIgb2JzZXJ2ZUhhbmRsZSA9IGF3YWl0IGN1cnNvci5vYnNlcnZlQ2hhbmdlcyhcbiAgICAgICAge1xuICAgICAgICAgIGFkZGVkOiBmdW5jdGlvbihpZCwgZmllbGRzKSB7XG4gICAgICAgICAgICBzdWIuYWRkZWQoY29sbGVjdGlvbiwgaWQsIGZpZWxkcyk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBjaGFuZ2VkOiBmdW5jdGlvbihpZCwgZmllbGRzKSB7XG4gICAgICAgICAgICBzdWIuY2hhbmdlZChjb2xsZWN0aW9uLCBpZCwgZmllbGRzKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJlbW92ZWQ6IGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgICAgICBzdWIucmVtb3ZlZChjb2xsZWN0aW9uLCBpZCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gUHVibGljYXRpb25zIGRvbid0IG11dGF0ZSB0aGUgZG9jdW1lbnRzXG4gICAgICAgIC8vIFRoaXMgaXMgdGVzdGVkIGJ5IHRoZSBgbGl2ZWRhdGEgLSBwdWJsaXNoIGNhbGxiYWNrcyBjbG9uZWAgdGVzdFxuICAgICAgICB7IG5vbk11dGF0aW5nQ2FsbGJhY2tzOiB0cnVlIH1cbiAgICApO1xuXG4gICAgLy8gV2UgZG9uJ3QgY2FsbCBzdWIucmVhZHkoKSBoZXJlOiBpdCBnZXRzIGNhbGxlZCBpbiBsaXZlZGF0YV9zZXJ2ZXIsIGFmdGVyXG4gICAgLy8gcG9zc2libHkgY2FsbGluZyBfcHVibGlzaEN1cnNvciBvbiBtdWx0aXBsZSByZXR1cm5lZCBjdXJzb3JzLlxuXG4gICAgLy8gcmVnaXN0ZXIgc3RvcCBjYWxsYmFjayAoZXhwZWN0cyBsYW1iZGEgdy8gbm8gYXJncykuXG4gICAgc3ViLm9uU3RvcChhc3luYyBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBhd2FpdCBvYnNlcnZlSGFuZGxlLnN0b3AoKTtcbiAgICB9KTtcblxuICAgIC8vIHJldHVybiB0aGUgb2JzZXJ2ZUhhbmRsZSBpbiBjYXNlIGl0IG5lZWRzIHRvIGJlIHN0b3BwZWQgZWFybHlcbiAgICByZXR1cm4gb2JzZXJ2ZUhhbmRsZTtcbiAgfSxcblxuICAvLyBwcm90ZWN0IGFnYWluc3QgZGFuZ2Vyb3VzIHNlbGVjdG9ycy4gIGZhbHNleSBhbmQge19pZDogZmFsc2V5fSBhcmUgYm90aFxuICAvLyBsaWtlbHkgcHJvZ3JhbW1lciBlcnJvciwgYW5kIG5vdCB3aGF0IHlvdSB3YW50LCBwYXJ0aWN1bGFybHkgZm9yIGRlc3RydWN0aXZlXG4gIC8vIG9wZXJhdGlvbnMuIElmIGEgZmFsc2V5IF9pZCBpcyBzZW50IGluLCBhIG5ldyBzdHJpbmcgX2lkIHdpbGwgYmVcbiAgLy8gZ2VuZXJhdGVkIGFuZCByZXR1cm5lZDsgaWYgYSBmYWxsYmFja0lkIGlzIHByb3ZpZGVkLCBpdCB3aWxsIGJlIHJldHVybmVkXG4gIC8vIGluc3RlYWQuXG4gIF9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IsIHsgZmFsbGJhY2tJZCB9ID0ge30pIHtcbiAgICAvLyBzaG9ydGhhbmQgLS0gc2NhbGFycyBtYXRjaCBfaWRcbiAgICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQoc2VsZWN0b3IpKSBzZWxlY3RvciA9IHsgX2lkOiBzZWxlY3RvciB9O1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoc2VsZWN0b3IpKSB7XG4gICAgICAvLyBUaGlzIGlzIGNvbnNpc3RlbnQgd2l0aCB0aGUgTW9uZ28gY29uc29sZSBpdHNlbGY7IGlmIHdlIGRvbid0IGRvIHRoaXNcbiAgICAgIC8vIGNoZWNrIHBhc3NpbmcgYW4gZW1wdHkgYXJyYXkgZW5kcyB1cCBzZWxlY3RpbmcgYWxsIGl0ZW1zXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNb25nbyBzZWxlY3RvciBjYW4ndCBiZSBhbiBhcnJheS5cIik7XG4gICAgfVxuXG4gICAgaWYgKCFzZWxlY3RvciB8fCAoJ19pZCcgaW4gc2VsZWN0b3IgJiYgIXNlbGVjdG9yLl9pZCkpIHtcbiAgICAgIC8vIGNhbid0IG1hdGNoIGFueXRoaW5nXG4gICAgICByZXR1cm4geyBfaWQ6IGZhbGxiYWNrSWQgfHwgUmFuZG9tLmlkKCkgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2VsZWN0b3I7XG4gIH0sXG5cbiAgLy8gQ29sbGVjdGlvbiBFeHRlbnNpb25zIEFQSSAtIGRlbGVnYXRlIHRvIENvbGxlY3Rpb25FeHRlbnNpb25zXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBZGQgYSBjb25zdHJ1Y3RvciBleHRlbnNpb24gZnVuY3Rpb24gdGhhdCBydW5zIHdoZW4gY29sbGVjdGlvbnMgYXJlIGNyZWF0ZWQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGV4dGVuc2lvbiBFeHRlbnNpb24gZnVuY3Rpb24gY2FsbGVkIHdpdGggKG5hbWUsIG9wdGlvbnMpIGFuZCAndGhpcycgYm91bmQgdG8gY29sbGVjdGlvbiBpbnN0YW5jZVxuICAgKi9cbiAgYWRkRXh0ZW5zaW9uKGV4dGVuc2lvbikge1xuICAgIHJldHVybiBDb2xsZWN0aW9uRXh0ZW5zaW9ucy5hZGRFeHRlbnNpb24oZXh0ZW5zaW9uKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQWRkIGEgcHJvdG90eXBlIG1ldGhvZCB0byBhbGwgY29sbGVjdGlvbiBpbnN0YW5jZXMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBtZXRob2QgdG8gYWRkXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG1ldGhvZCBUaGUgbWV0aG9kIGZ1bmN0aW9uLCBib3VuZCB0byB0aGUgY29sbGVjdGlvbiBpbnN0YW5jZVxuICAgKi9cbiAgYWRkUHJvdG90eXBlTWV0aG9kKG5hbWUsIG1ldGhvZCkge1xuICAgIHJldHVybiBDb2xsZWN0aW9uRXh0ZW5zaW9ucy5hZGRQcm90b3R5cGVNZXRob2QobmFtZSwgbWV0aG9kKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQWRkIGEgc3RhdGljIG1ldGhvZCB0byB0aGUgTW9uZ28uQ29sbGVjdGlvbiBjb25zdHJ1Y3Rvci5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIHN0YXRpYyBtZXRob2QgdG8gYWRkXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG1ldGhvZCBUaGUgc3RhdGljIG1ldGhvZCBmdW5jdGlvblxuICAgKi9cbiAgYWRkU3RhdGljTWV0aG9kKG5hbWUsIG1ldGhvZCkge1xuICAgIHJldHVybiBDb2xsZWN0aW9uRXh0ZW5zaW9ucy5hZGRTdGF0aWNNZXRob2QobmFtZSwgbWV0aG9kKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVtb3ZlIGEgY29uc3RydWN0b3IgZXh0ZW5zaW9uICh1c2VmdWwgZm9yIHRlc3RpbmcpLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBleHRlbnNpb24gVGhlIGV4dGVuc2lvbiBmdW5jdGlvbiB0byByZW1vdmVcbiAgICovXG4gIHJlbW92ZUV4dGVuc2lvbihleHRlbnNpb24pIHtcbiAgICByZXR1cm4gQ29sbGVjdGlvbkV4dGVuc2lvbnMucmVtb3ZlRXh0ZW5zaW9uKGV4dGVuc2lvbik7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJlbW92ZSBhIHByb3RvdHlwZSBtZXRob2QgZnJvbSBhbGwgY29sbGVjdGlvbiBpbnN0YW5jZXMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBtZXRob2QgdG8gcmVtb3ZlXG4gICAqL1xuICByZW1vdmVQcm90b3R5cGVNZXRob2QobmFtZSkge1xuICAgIHJldHVybiBDb2xsZWN0aW9uRXh0ZW5zaW9ucy5yZW1vdmVQcm90b3R5cGVNZXRob2QobmFtZSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJlbW92ZSBhIHN0YXRpYyBtZXRob2QgZnJvbSB0aGUgTW9uZ28uQ29sbGVjdGlvbiBjb25zdHJ1Y3Rvci5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBzdGF0aWNcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIHN0YXRpYyBtZXRob2QgdG8gcmVtb3ZlXG4gICAqL1xuICByZW1vdmVTdGF0aWNNZXRob2QobmFtZSkge1xuICAgIHJldHVybiBDb2xsZWN0aW9uRXh0ZW5zaW9ucy5yZW1vdmVTdGF0aWNNZXRob2QobmFtZSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENsZWFyIGFsbCBleHRlbnNpb25zLCBwcm90b3R5cGUgbWV0aG9kcywgYW5kIHN0YXRpYyBtZXRob2RzICh1c2VmdWwgZm9yIHRlc3RpbmcpLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQHN0YXRpY1xuICAgKi9cbiAgY2xlYXJFeHRlbnNpb25zKCkge1xuICAgIHJldHVybiBDb2xsZWN0aW9uRXh0ZW5zaW9ucy5jbGVhckV4dGVuc2lvbnMoKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgR2V0IGFsbCByZWdpc3RlcmVkIGNvbnN0cnVjdG9yIGV4dGVuc2lvbnMgKHVzZWZ1bCBmb3IgZGVidWdnaW5nKS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBzdGF0aWNcbiAgICogQHJldHVybnMge0FycmF5PEZ1bmN0aW9uPn0gQXJyYXkgb2YgcmVnaXN0ZXJlZCBleHRlbnNpb24gZnVuY3Rpb25zXG4gICAqL1xuICBnZXRFeHRlbnNpb25zKCkge1xuICAgIHJldHVybiBDb2xsZWN0aW9uRXh0ZW5zaW9ucy5nZXRFeHRlbnNpb25zKCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldCBhbGwgcmVnaXN0ZXJlZCBwcm90b3R5cGUgbWV0aG9kcyAodXNlZnVsIGZvciBkZWJ1Z2dpbmcpLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQHN0YXRpY1xuICAgKiBAcmV0dXJucyB7TWFwPFN0cmluZywgRnVuY3Rpb24+fSBNYXAgb2YgbWV0aG9kIG5hbWVzIHRvIGZ1bmN0aW9uc1xuICAgKi9cbiAgZ2V0UHJvdG90eXBlTWV0aG9kcygpIHtcbiAgICByZXR1cm4gQ29sbGVjdGlvbkV4dGVuc2lvbnMuZ2V0UHJvdG90eXBlTWV0aG9kcygpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBHZXQgYWxsIHJlZ2lzdGVyZWQgc3RhdGljIG1ldGhvZHMgKHVzZWZ1bCBmb3IgZGVidWdnaW5nKS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBzdGF0aWNcbiAgICogQHJldHVybnMge01hcDxTdHJpbmcsIEZ1bmN0aW9uPn0gTWFwIG9mIG1ldGhvZCBuYW1lcyB0byBmdW5jdGlvbnNcbiAgICovXG4gIGdldFN0YXRpY01ldGhvZHMoKSB7XG4gICAgcmV0dXJuIENvbGxlY3Rpb25FeHRlbnNpb25zLmdldFN0YXRpY01ldGhvZHMoKTtcbiAgfVxufSk7XG5cbk9iamVjdC5hc3NpZ24oTW9uZ28uQ29sbGVjdGlvbi5wcm90b3R5cGUsIFJlcGxpY2F0aW9uTWV0aG9kcywgU3luY01ldGhvZHMsIEFzeW5jTWV0aG9kcywgSW5kZXhNZXRob2RzKTtcblxuT2JqZWN0LmFzc2lnbihNb25nby5Db2xsZWN0aW9uLnByb3RvdHlwZSwge1xuICAvLyBEZXRlcm1pbmUgaWYgdGhpcyBjb2xsZWN0aW9uIGlzIHNpbXBseSBhIG1pbmltb25nbyByZXByZXNlbnRhdGlvbiBvZiBhIHJlYWxcbiAgLy8gZGF0YWJhc2Ugb24gYW5vdGhlciBzZXJ2ZXJcbiAgX2lzUmVtb3RlQ29sbGVjdGlvbigpIHtcbiAgICAvLyBYWFggc2VlICNNZXRlb3JTZXJ2ZXJOdWxsXG4gICAgcmV0dXJuIHRoaXMuX2Nvbm5lY3Rpb24gJiYgdGhpcy5fY29ubmVjdGlvbiAhPT0gTWV0ZW9yLnNlcnZlcjtcbiAgfSxcblxuICBhc3luYyBkcm9wQ29sbGVjdGlvbkFzeW5jKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuX2NvbGxlY3Rpb24uZHJvcENvbGxlY3Rpb25Bc3luYylcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCBkcm9wQ29sbGVjdGlvbkFzeW5jIG9uIHNlcnZlciBjb2xsZWN0aW9ucycpO1xuICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5kcm9wQ29sbGVjdGlvbkFzeW5jKCk7XG4gIH0sXG5cbiAgYXN5bmMgY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbkFzeW5jKGJ5dGVTaXplLCBtYXhEb2N1bWVudHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCEgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5jcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdDYW4gb25seSBjYWxsIGNyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYyBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnXG4gICAgICApO1xuICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbkFzeW5jKGJ5dGVTaXplLCBtYXhEb2N1bWVudHMpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZXR1cm5zIHRoZSBbYENvbGxlY3Rpb25gXShodHRwOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS8zLjAvYXBpL0NvbGxlY3Rpb24uaHRtbCkgb2JqZWN0IGNvcnJlc3BvbmRpbmcgdG8gdGhpcyBjb2xsZWN0aW9uIGZyb20gdGhlIFtucG0gYG1vbmdvZGJgIGRyaXZlciBtb2R1bGVdKGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL21vbmdvZGIpIHdoaWNoIGlzIHdyYXBwZWQgYnkgYE1vbmdvLkNvbGxlY3Rpb25gLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgcmF3Q29sbGVjdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLl9jb2xsZWN0aW9uLnJhd0NvbGxlY3Rpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCByYXdDb2xsZWN0aW9uIG9uIHNlcnZlciBjb2xsZWN0aW9ucycpO1xuICAgIH1cbiAgICByZXR1cm4gc2VsZi5fY29sbGVjdGlvbi5yYXdDb2xsZWN0aW9uKCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJldHVybnMgdGhlIFtgRGJgXShodHRwOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS8zLjAvYXBpL0RiLmh0bWwpIG9iamVjdCBjb3JyZXNwb25kaW5nIHRvIHRoaXMgY29sbGVjdGlvbidzIGRhdGFiYXNlIGNvbm5lY3Rpb24gZnJvbSB0aGUgW25wbSBgbW9uZ29kYmAgZHJpdmVyIG1vZHVsZV0oaHR0cHM6Ly93d3cubnBtanMuY29tL3BhY2thZ2UvbW9uZ29kYikgd2hpY2ggaXMgd3JhcHBlZCBieSBgTW9uZ28uQ29sbGVjdGlvbmAuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqL1xuICByYXdEYXRhYmFzZSgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCEoc2VsZi5fZHJpdmVyLm1vbmdvICYmIHNlbGYuX2RyaXZlci5tb25nby5kYikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCByYXdEYXRhYmFzZSBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlbGYuX2RyaXZlci5tb25nby5kYjtcbiAgfSxcbn0pO1xuXG5PYmplY3QuYXNzaWduKE1vbmdvLCB7XG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZXRyaWV2ZSBhIE1ldGVvciBjb2xsZWN0aW9uIGluc3RhbmNlIGJ5IG5hbWUuIE9ubHkgY29sbGVjdGlvbnMgZGVmaW5lZCB3aXRoIFtgbmV3IE1vbmdvLkNvbGxlY3Rpb24oLi4uKWBdKCNjb2xsZWN0aW9ucykgYXJlIGF2YWlsYWJsZSB3aXRoIHRoaXMgbWV0aG9kLiBGb3IgcGxhaW4gTW9uZ29EQiBjb2xsZWN0aW9ucywgeW91J2xsIHdhbnQgdG8gbG9vayBhdCBbYHJhd0RhdGFiYXNlKClgXSgjTW9uZ28tQ29sbGVjdGlvbi1yYXdEYXRhYmFzZSkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyb2YgTW9uZ29cbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSBOYW1lIG9mIHlvdXIgY29sbGVjdGlvbiBhcyBpdCB3YXMgZGVmaW5lZCB3aXRoIGBuZXcgTW9uZ28uQ29sbGVjdGlvbigpYC5cbiAgICogQHJldHVybnMge01vbmdvLkNvbGxlY3Rpb24gfCB1bmRlZmluZWR9XG4gICAqL1xuICBnZXRDb2xsZWN0aW9uKG5hbWUpIHtcbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbnMuZ2V0KG5hbWUpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBIHJlY29yZCBvZiBhbGwgZGVmaW5lZCBNb25nby5Db2xsZWN0aW9uIGluc3RhbmNlcywgaW5kZXhlZCBieSBjb2xsZWN0aW9uIG5hbWUuXG4gICAqIEB0eXBlIHtNYXA8c3RyaW5nLCBNb25nby5Db2xsZWN0aW9uPn1cbiAgICogQG1lbWJlcm9mIE1vbmdvXG4gICAqIEBwcm90ZWN0ZWRcbiAgICovXG4gIF9jb2xsZWN0aW9uczogbmV3IE1hcCgpLFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDb2xsZWN0aW9uIEV4dGVuc2lvbnMgQVBJXG4gICAqIEBtZW1iZXJvZiBNb25nb1xuICAgKiBAc3RhdGljXG4gICAqL1xuICBDb2xsZWN0aW9uRXh0ZW5zaW9uczogQ29sbGVjdGlvbkV4dGVuc2lvbnNcbn0pXG5cblxuXG4vKipcbiAqIEBzdW1tYXJ5IENyZWF0ZSBhIE1vbmdvLXN0eWxlIGBPYmplY3RJRGAuICBJZiB5b3UgZG9uJ3Qgc3BlY2lmeSBhIGBoZXhTdHJpbmdgLCB0aGUgYE9iamVjdElEYCB3aWxsIGJlIGdlbmVyYXRlZCByYW5kb21seSAobm90IHVzaW5nIE1vbmdvREIncyBJRCBjb25zdHJ1Y3Rpb24gcnVsZXMpLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7U3RyaW5nfSBbaGV4U3RyaW5nXSBPcHRpb25hbC4gIFRoZSAyNC1jaGFyYWN0ZXIgaGV4YWRlY2ltYWwgY29udGVudHMgb2YgdGhlIE9iamVjdElEIHRvIGNyZWF0ZVxuICovXG5Nb25nby5PYmplY3RJRCA9IE1vbmdvSUQuT2JqZWN0SUQ7XG5cbi8qKlxuICogQHN1bW1hcnkgVG8gY3JlYXRlIGEgY3Vyc29yLCB1c2UgZmluZC4gVG8gYWNjZXNzIHRoZSBkb2N1bWVudHMgaW4gYSBjdXJzb3IsIHVzZSBmb3JFYWNoLCBtYXAsIG9yIGZldGNoLlxuICogQGNsYXNzXG4gKiBAaW5zdGFuY2VOYW1lIGN1cnNvclxuICovXG5Nb25nby5DdXJzb3IgPSBMb2NhbENvbGxlY3Rpb24uQ3Vyc29yO1xuXG4vKipcbiAqIEBkZXByZWNhdGVkIGluIDAuOS4xXG4gKi9cbk1vbmdvLkNvbGxlY3Rpb24uQ3Vyc29yID0gTW9uZ28uQ3Vyc29yO1xuXG4vKipcbiAqIEBkZXByZWNhdGVkIGluIDAuOS4xXG4gKi9cbk1vbmdvLkNvbGxlY3Rpb24uT2JqZWN0SUQgPSBNb25nby5PYmplY3RJRDtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZCBpbiAwLjkuMVxuICovXG5NZXRlb3IuQ29sbGVjdGlvbiA9IE1vbmdvLkNvbGxlY3Rpb247XG5cblxuLy8gQWxsb3cgZGVueSBzdHVmZiBpcyBub3cgaW4gdGhlIGFsbG93LWRlbnkgcGFja2FnZVxuT2JqZWN0LmFzc2lnbihNb25nby5Db2xsZWN0aW9uLnByb3RvdHlwZSwgQWxsb3dEZW55LkNvbGxlY3Rpb25Qcm90b3R5cGUpO1xuIiwiZXhwb3J0IGNvbnN0IElEX0dFTkVSQVRPUlMgPSB7XG4gIE1PTkdPKG5hbWUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBjb25zdCBzcmMgPSBuYW1lID8gRERQLnJhbmRvbVN0cmVhbSgnL2NvbGxlY3Rpb24vJyArIG5hbWUpIDogUmFuZG9tLmluc2VjdXJlO1xuICAgICAgcmV0dXJuIG5ldyBNb25nby5PYmplY3RJRChzcmMuaGV4U3RyaW5nKDI0KSk7XG4gICAgfVxuICB9LFxuICBTVFJJTkcobmFtZSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IHNyYyA9IG5hbWUgPyBERFAucmFuZG9tU3RyZWFtKCcvY29sbGVjdGlvbi8nICsgbmFtZSkgOiBSYW5kb20uaW5zZWN1cmU7XG4gICAgICByZXR1cm4gc3JjLmlkKCk7XG4gICAgfVxuICB9XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBDb25uZWN0aW9uKG5hbWUsIG9wdGlvbnMpIHtcbiAgaWYgKCFuYW1lIHx8IG9wdGlvbnMuY29ubmVjdGlvbiA9PT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gIGlmIChvcHRpb25zLmNvbm5lY3Rpb24pIHJldHVybiBvcHRpb25zLmNvbm5lY3Rpb247XG4gIHJldHVybiBNZXRlb3IuaXNDbGllbnQgPyBNZXRlb3IuY29ubmVjdGlvbiA6IE1ldGVvci5zZXJ2ZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cERyaXZlcihuYW1lLCBjb25uZWN0aW9uLCBvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zLl9kcml2ZXIpIHJldHVybiBvcHRpb25zLl9kcml2ZXI7XG5cbiAgaWYgKG5hbWUgJiZcbiAgICBjb25uZWN0aW9uID09PSBNZXRlb3Iuc2VydmVyICYmXG4gICAgdHlwZW9mIE1vbmdvSW50ZXJuYWxzICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIE1vbmdvSW50ZXJuYWxzLmRlZmF1bHRSZW1vdGVDb2xsZWN0aW9uRHJpdmVyKSB7XG4gICAgcmV0dXJuIE1vbmdvSW50ZXJuYWxzLmRlZmF1bHRSZW1vdGVDb2xsZWN0aW9uRHJpdmVyKCk7XG4gIH1cblxuICBjb25zdCB7IExvY2FsQ29sbGVjdGlvbkRyaXZlciB9ID0gcmVxdWlyZSgnLi4vbG9jYWxfY29sbGVjdGlvbl9kcml2ZXIuanMnKTtcbiAgcmV0dXJuIExvY2FsQ29sbGVjdGlvbkRyaXZlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldHVwQXV0b3B1Ymxpc2goY29sbGVjdGlvbiwgbmFtZSwgb3B0aW9ucykge1xuICBpZiAoUGFja2FnZS5hdXRvcHVibGlzaCAmJlxuICAgICFvcHRpb25zLl9wcmV2ZW50QXV0b3B1Ymxpc2ggJiZcbiAgICBjb2xsZWN0aW9uLl9jb25uZWN0aW9uICYmXG4gICAgY29sbGVjdGlvbi5fY29ubmVjdGlvbi5wdWJsaXNoKSB7XG4gICAgY29sbGVjdGlvbi5fY29ubmVjdGlvbi5wdWJsaXNoKG51bGwsICgpID0+IGNvbGxlY3Rpb24uZmluZCgpLCB7XG4gICAgICBpc19hdXRvOiB0cnVlXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNldHVwTXV0YXRpb25NZXRob2RzKGNvbGxlY3Rpb24sIG5hbWUsIG9wdGlvbnMpIHtcbiAgaWYgKG9wdGlvbnMuZGVmaW5lTXV0YXRpb25NZXRob2RzID09PSBmYWxzZSkgcmV0dXJuO1xuXG4gIHRyeSB7XG4gICAgY29sbGVjdGlvbi5fZGVmaW5lTXV0YXRpb25NZXRob2RzKHtcbiAgICAgIHVzZUV4aXN0aW5nOiBvcHRpb25zLl9zdXBwcmVzc1NhbWVOYW1lRXJyb3IgPT09IHRydWVcbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBpZiAoZXJyb3IubWVzc2FnZSA9PT0gYEEgbWV0aG9kIG5hbWVkICcvJHtuYW1lfS9pbnNlcnRBc3luYycgaXMgYWxyZWFkeSBkZWZpbmVkYCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBUaGVyZSBpcyBhbHJlYWR5IGEgY29sbGVjdGlvbiBuYW1lZCBcIiR7bmFtZX1cImApO1xuICAgIH1cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVDb2xsZWN0aW9uTmFtZShuYW1lKSB7XG4gIGlmICghbmFtZSAmJiBuYW1lICE9PSBudWxsKSB7XG4gICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICAgICdXYXJuaW5nOiBjcmVhdGluZyBhbm9ueW1vdXMgY29sbGVjdGlvbi4gSXQgd2lsbCBub3QgYmUgJyArXG4gICAgICAnc2F2ZWQgb3Igc3luY2hyb25pemVkIG92ZXIgdGhlIG5ldHdvcmsuIChQYXNzIG51bGwgZm9yICcgK1xuICAgICAgJ3RoZSBjb2xsZWN0aW9uIG5hbWUgdG8gdHVybiBvZmYgdGhpcyB3YXJuaW5nLiknXG4gICAgKTtcbiAgICBuYW1lID0gbnVsbDtcbiAgfVxuXG4gIGlmIChuYW1lICE9PSBudWxsICYmIHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdGaXJzdCBhcmd1bWVudCB0byBuZXcgTW9uZ28uQ29sbGVjdGlvbiBtdXN0IGJlIGEgc3RyaW5nIG9yIG51bGwnXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBuYW1lO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplT3B0aW9ucyhvcHRpb25zKSB7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMubWV0aG9kcykge1xuICAgIC8vIEJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IGhhY2sgd2l0aCBvcmlnaW5hbCBzaWduYXR1cmVcbiAgICBvcHRpb25zID0geyBjb25uZWN0aW9uOiBvcHRpb25zIH07XG4gIH1cbiAgLy8gQmFja3dhcmRzIGNvbXBhdGliaWxpdHk6IFwiY29ubmVjdGlvblwiIHVzZWQgdG8gYmUgY2FsbGVkIFwibWFuYWdlclwiLlxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm1hbmFnZXIgJiYgIW9wdGlvbnMuY29ubmVjdGlvbikge1xuICAgIG9wdGlvbnMuY29ubmVjdGlvbiA9IG9wdGlvbnMubWFuYWdlcjtcbiAgfVxuXG4gIGNvbnN0IGNsZWFuZWRPcHRpb25zID0gT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgIE9iamVjdC5lbnRyaWVzKG9wdGlvbnMgfHwge30pLmZpbHRlcigoW18sIHZdKSA9PiB2ICE9PSB1bmRlZmluZWQpLFxuICApO1xuXG4gIC8vIDIpIFNwcmVhZCBkZWZhdWx0cyBmaXJzdCwgdGhlbiBvbmx5IHRoZSBkZWZpbmVkIG92ZXJyaWRlc1xuICByZXR1cm4ge1xuICAgIGNvbm5lY3Rpb246IHVuZGVmaW5lZCxcbiAgICBpZEdlbmVyYXRpb246ICdTVFJJTkcnLFxuICAgIHRyYW5zZm9ybTogbnVsbCxcbiAgICBfZHJpdmVyOiB1bmRlZmluZWQsXG4gICAgX3ByZXZlbnRBdXRvcHVibGlzaDogZmFsc2UsXG4gICAgLi4uY2xlYW5lZE9wdGlvbnMsXG4gIH07XG59XG4iLCJleHBvcnQgY29uc3QgQXN5bmNNZXRob2RzID0ge1xuICAvKipcbiAgICogQHN1bW1hcnkgRmluZHMgdGhlIGZpcnN0IGRvY3VtZW50IHRoYXQgbWF0Y2hlcyB0aGUgc2VsZWN0b3IsIGFzIG9yZGVyZWQgYnkgc29ydCBhbmQgc2tpcCBvcHRpb25zLiBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIG5vIG1hdGNoaW5nIGRvY3VtZW50IGlzIGZvdW5kLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCBmaW5kT25lQXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gW3NlbGVjdG9yXSBBIHF1ZXJ5IGRlc2NyaWJpbmcgdGhlIGRvY3VtZW50cyB0byBmaW5kXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtNb25nb1NvcnRTcGVjaWZpZXJ9IG9wdGlvbnMuc29ydCBTb3J0IG9yZGVyIChkZWZhdWx0OiBuYXR1cmFsIG9yZGVyKVxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5za2lwIE51bWJlciBvZiByZXN1bHRzIHRvIHNraXAgYXQgdGhlIGJlZ2lubmluZ1xuICAgKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmVhY3RpdmUgKENsaWVudCBvbmx5KSBEZWZhdWx0IHRydWU7IHBhc3MgZmFsc2UgdG8gZGlzYWJsZSByZWFjdGl2aXR5XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMudHJhbnNmb3JtIE92ZXJyaWRlcyBgdHJhbnNmb3JtYCBvbiB0aGUgW2BDb2xsZWN0aW9uYF0oI2NvbGxlY3Rpb25zKSBmb3IgdGhpcyBjdXJzb3IuICBQYXNzIGBudWxsYCB0byBkaXNhYmxlIHRyYW5zZm9ybWF0aW9uLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5yZWFkUHJlZmVyZW5jZSAoU2VydmVyIG9ubHkpIFNwZWNpZmllcyBhIGN1c3RvbSBNb25nb0RCIFtgcmVhZFByZWZlcmVuY2VgXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvcmVhZC1wcmVmZXJlbmNlKSBmb3IgZmV0Y2hpbmcgdGhlIGRvY3VtZW50LiBQb3NzaWJsZSB2YWx1ZXMgYXJlIGBwcmltYXJ5YCwgYHByaW1hcnlQcmVmZXJyZWRgLCBgc2Vjb25kYXJ5YCwgYHNlY29uZGFyeVByZWZlcnJlZGAgYW5kIGBuZWFyZXN0YC5cbiAgICogQHJldHVybnMge09iamVjdH1cbiAgICovXG4gIGZpbmRPbmVBc3luYyguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24uZmluZE9uZUFzeW5jKFxuICAgICAgdGhpcy5fZ2V0RmluZFNlbGVjdG9yKGFyZ3MpLFxuICAgICAgdGhpcy5fZ2V0RmluZE9wdGlvbnMoYXJncylcbiAgICApO1xuICB9LFxuXG4gIF9pbnNlcnRBc3luYyhkb2MsIG9wdGlvbnMgPSB7fSkge1xuICAgIC8vIE1ha2Ugc3VyZSB3ZSB3ZXJlIHBhc3NlZCBhIGRvY3VtZW50IHRvIGluc2VydFxuICAgIGlmICghZG9jKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2luc2VydCByZXF1aXJlcyBhbiBhcmd1bWVudCcpO1xuICAgIH1cblxuICAgIC8vIE1ha2UgYSBzaGFsbG93IGNsb25lIG9mIHRoZSBkb2N1bWVudCwgcHJlc2VydmluZyBpdHMgcHJvdG90eXBlLlxuICAgIGRvYyA9IE9iamVjdC5jcmVhdGUoXG4gICAgICBPYmplY3QuZ2V0UHJvdG90eXBlT2YoZG9jKSxcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKGRvYylcbiAgICApO1xuXG4gICAgaWYgKCdfaWQnIGluIGRvYykge1xuICAgICAgaWYgKFxuICAgICAgICAhZG9jLl9pZCB8fFxuICAgICAgICAhKHR5cGVvZiBkb2MuX2lkID09PSAnc3RyaW5nJyB8fCBkb2MuX2lkIGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SUQpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdNZXRlb3IgcmVxdWlyZXMgZG9jdW1lbnQgX2lkIGZpZWxkcyB0byBiZSBub24tZW1wdHkgc3RyaW5ncyBvciBPYmplY3RJRHMnXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBnZW5lcmF0ZUlkID0gdHJ1ZTtcblxuICAgICAgLy8gRG9uJ3QgZ2VuZXJhdGUgdGhlIGlkIGlmIHdlJ3JlIHRoZSBjbGllbnQgYW5kIHRoZSAnb3V0ZXJtb3N0JyBjYWxsXG4gICAgICAvLyBUaGlzIG9wdGltaXphdGlvbiBzYXZlcyB1cyBwYXNzaW5nIGJvdGggdGhlIHJhbmRvbVNlZWQgYW5kIHRoZSBpZFxuICAgICAgLy8gUGFzc2luZyBib3RoIGlzIHJlZHVuZGFudC5cbiAgICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgICBjb25zdCBlbmNsb3NpbmcgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICAgICAgICBpZiAoIWVuY2xvc2luZykge1xuICAgICAgICAgIGdlbmVyYXRlSWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZ2VuZXJhdGVJZCkge1xuICAgICAgICBkb2MuX2lkID0gdGhpcy5fbWFrZU5ld0lEKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gT24gaW5zZXJ0cywgYWx3YXlzIHJldHVybiB0aGUgaWQgdGhhdCB3ZSBnZW5lcmF0ZWQ7IG9uIGFsbCBvdGhlclxuICAgIC8vIG9wZXJhdGlvbnMsIGp1c3QgcmV0dXJuIHRoZSByZXN1bHQgZnJvbSB0aGUgY29sbGVjdGlvbi5cbiAgICB2YXIgY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdCA9IGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgaWYgKE1ldGVvci5faXNQcm9taXNlKHJlc3VsdCkpIHJldHVybiByZXN1bHQ7XG5cbiAgICAgIGlmIChkb2MuX2lkKSB7XG4gICAgICAgIHJldHVybiBkb2MuX2lkO1xuICAgICAgfVxuXG4gICAgICAvLyBYWFggd2hhdCBpcyB0aGlzIGZvcj8/XG4gICAgICAvLyBJdCdzIHNvbWUgaXRlcmFjdGlvbiBiZXR3ZWVuIHRoZSBjYWxsYmFjayB0byBfY2FsbE11dGF0b3JNZXRob2QgYW5kXG4gICAgICAvLyB0aGUgcmV0dXJuIHZhbHVlIGNvbnZlcnNpb25cbiAgICAgIGRvYy5faWQgPSByZXN1bHQ7XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgY29uc3QgcHJvbWlzZSA9IHRoaXMuX2NhbGxNdXRhdG9yTWV0aG9kQXN5bmMoJ2luc2VydEFzeW5jJywgW2RvY10sIG9wdGlvbnMpO1xuICAgICAgcHJvbWlzZS50aGVuKGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQpO1xuICAgICAgcHJvbWlzZS5zdHViUHJvbWlzZSA9IHByb21pc2Uuc3R1YlByb21pc2UudGhlbihjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0KTtcbiAgICAgIHByb21pc2Uuc2VydmVyUHJvbWlzZSA9IHByb21pc2Uuc2VydmVyUHJvbWlzZS50aGVuKGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQpO1xuICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuXG4gICAgLy8gaXQncyBteSBjb2xsZWN0aW9uLiAgZGVzY2VuZCBpbnRvIHRoZSBjb2xsZWN0aW9uIG9iamVjdFxuICAgIC8vIGFuZCBwcm9wYWdhdGUgYW55IGV4Y2VwdGlvbi5cbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi5pbnNlcnRBc3luYyhkb2MpXG4gICAgICAudGhlbihjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0KTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgSW5zZXJ0IGEgZG9jdW1lbnQgaW4gdGhlIGNvbGxlY3Rpb24uICBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgcmV0dXJuIHRoZSBkb2N1bWVudCdzIHVuaXF1ZSBfaWQgd2hlbiBzb2x2ZWQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kICBpbnNlcnRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBkb2MgVGhlIGRvY3VtZW50IHRvIGluc2VydC4gTWF5IG5vdCB5ZXQgaGF2ZSBhbiBfaWQgYXR0cmlidXRlLCBpbiB3aGljaCBjYXNlIE1ldGVvciB3aWxsIGdlbmVyYXRlIG9uZSBmb3IgeW91LlxuICAgKi9cbiAgaW5zZXJ0QXN5bmMoZG9jLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuX2luc2VydEFzeW5jKGRvYywgb3B0aW9ucyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHN1bW1hcnkgTW9kaWZ5IG9uZSBvciBtb3JlIGRvY3VtZW50cyBpbiB0aGUgY29sbGVjdGlvbi4gUmV0dXJucyB0aGUgbnVtYmVyIG9mIG1hdGNoZWQgZG9jdW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCB1cGRhdGVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51cHNlcnQgVHJ1ZSB0byBpbnNlcnQgYSBkb2N1bWVudCBpZiBubyBtYXRjaGluZyBkb2N1bWVudHMgYXJlIGZvdW5kLlxuICAgKiBAcGFyYW0ge0FycmF5fSBvcHRpb25zLmFycmF5RmlsdGVycyBPcHRpb25hbC4gVXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIE1vbmdvREIgW2ZpbHRlcmVkIHBvc2l0aW9uYWwgb3BlcmF0b3JdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL29wZXJhdG9yL3VwZGF0ZS9wb3NpdGlvbmFsLWZpbHRlcmVkLykgdG8gc3BlY2lmeSB3aGljaCBlbGVtZW50cyB0byBtb2RpZnkgaW4gYW4gYXJyYXkgZmllbGQuXG4gICAqL1xuICB1cGRhdGVBc3luYyhzZWxlY3RvciwgbW9kaWZpZXIsIC4uLm9wdGlvbnNBbmRDYWxsYmFjaykge1xuXG4gICAgLy8gV2UndmUgYWxyZWFkeSBwb3BwZWQgb2ZmIHRoZSBjYWxsYmFjaywgc28gd2UgYXJlIGxlZnQgd2l0aCBhbiBhcnJheVxuICAgIC8vIG9mIG9uZSBvciB6ZXJvIGl0ZW1zXG4gICAgY29uc3Qgb3B0aW9ucyA9IHsgLi4uKG9wdGlvbnNBbmRDYWxsYmFja1swXSB8fCBudWxsKSB9O1xuICAgIGxldCBpbnNlcnRlZElkO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMudXBzZXJ0KSB7XG4gICAgICAvLyBzZXQgYGluc2VydGVkSWRgIGlmIGFic2VudC4gIGBpbnNlcnRlZElkYCBpcyBhIE1ldGVvciBleHRlbnNpb24uXG4gICAgICBpZiAob3B0aW9ucy5pbnNlcnRlZElkKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAhKFxuICAgICAgICAgICAgdHlwZW9mIG9wdGlvbnMuaW5zZXJ0ZWRJZCA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEXG4gICAgICAgICAgKVxuICAgICAgICApXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnNlcnRlZElkIG11c3QgYmUgc3RyaW5nIG9yIE9iamVjdElEJyk7XG4gICAgICAgIGluc2VydGVkSWQgPSBvcHRpb25zLmluc2VydGVkSWQ7XG4gICAgICB9IGVsc2UgaWYgKCFzZWxlY3RvciB8fCAhc2VsZWN0b3IuX2lkKSB7XG4gICAgICAgIGluc2VydGVkSWQgPSB0aGlzLl9tYWtlTmV3SUQoKTtcbiAgICAgICAgb3B0aW9ucy5nZW5lcmF0ZWRJZCA9IHRydWU7XG4gICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCA9IGluc2VydGVkSWQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VsZWN0b3IgPSBNb25nby5Db2xsZWN0aW9uLl9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IsIHtcbiAgICAgIGZhbGxiYWNrSWQ6IGluc2VydGVkSWQsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIGNvbnN0IGFyZ3MgPSBbc2VsZWN0b3IsIG1vZGlmaWVyLCBvcHRpb25zXTtcblxuICAgICAgcmV0dXJuIHRoaXMuX2NhbGxNdXRhdG9yTWV0aG9kQXN5bmMoJ3VwZGF0ZUFzeW5jJywgYXJncywgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLy8gaXQncyBteSBjb2xsZWN0aW9uLiAgZGVzY2VuZCBpbnRvIHRoZSBjb2xsZWN0aW9uIG9iamVjdFxuICAgIC8vIGFuZCBwcm9wYWdhdGUgYW55IGV4Y2VwdGlvbi5cbiAgICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhIGNhbGxiYWNrIGFuZCB0aGUgY29sbGVjdGlvbiBpbXBsZW1lbnRzIHRoaXNcbiAgICAvLyBvcGVyYXRpb24gYXN5bmNocm9ub3VzbHksIHRoZW4gcXVlcnlSZXQgd2lsbCBiZSB1bmRlZmluZWQsIGFuZCB0aGVcbiAgICAvLyByZXN1bHQgd2lsbCBiZSByZXR1cm5lZCB0aHJvdWdoIHRoZSBjYWxsYmFjayBpbnN0ZWFkLlxuXG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24udXBkYXRlQXN5bmMoXG4gICAgICBzZWxlY3RvcixcbiAgICAgIG1vZGlmaWVyLFxuICAgICAgb3B0aW9uc1xuICAgICk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IHJlbW92ZXMgZG9jdW1lbnRzIGZyb20gdGhlIGNvbGxlY3Rpb24uXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHJlbW92ZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBzZWxlY3RvciBTcGVjaWZpZXMgd2hpY2ggZG9jdW1lbnRzIHRvIHJlbW92ZVxuICAgKi9cbiAgcmVtb3ZlQXN5bmMoc2VsZWN0b3IsIG9wdGlvbnMgPSB7fSkge1xuICAgIHNlbGVjdG9yID0gTW9uZ28uQ29sbGVjdGlvbi5fcmV3cml0ZVNlbGVjdG9yKHNlbGVjdG9yKTtcblxuICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgcmV0dXJuIHRoaXMuX2NhbGxNdXRhdG9yTWV0aG9kQXN5bmMoJ3JlbW92ZUFzeW5jJywgW3NlbGVjdG9yXSwgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLy8gaXQncyBteSBjb2xsZWN0aW9uLiAgZGVzY2VuZCBpbnRvIHRoZSBjb2xsZWN0aW9uMSBvYmplY3RcbiAgICAvLyBhbmQgcHJvcGFnYXRlIGFueSBleGNlcHRpb24uXG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24ucmVtb3ZlQXN5bmMoc2VsZWN0b3IpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSBtb2RpZmllcyBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24sIG9yIGluc2VydCBvbmUgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnRzIHdlcmUgZm91bmQuIFJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5cyBgbnVtYmVyQWZmZWN0ZWRgICh0aGUgbnVtYmVyIG9mIGRvY3VtZW50cyBtb2RpZmllZCkgIGFuZCBgaW5zZXJ0ZWRJZGAgKHRoZSB1bmlxdWUgX2lkIG9mIHRoZSBkb2N1bWVudCB0aGF0IHdhcyBpbnNlcnRlZCwgaWYgYW55KS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBzZXJ0XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gbW9kaWZ5XG4gICAqIEBwYXJhbSB7TW9uZ29Nb2RpZmllcn0gbW9kaWZpZXIgU3BlY2lmaWVzIGhvdyB0byBtb2RpZnkgdGhlIGRvY3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5tdWx0aSBUcnVlIHRvIG1vZGlmeSBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzOyBmYWxzZSB0byBvbmx5IG1vZGlmeSBvbmUgb2YgdGhlIG1hdGNoaW5nIGRvY3VtZW50cyAodGhlIGRlZmF1bHQpLlxuICAgKi9cbiAgYXN5bmMgdXBzZXJ0QXN5bmMoc2VsZWN0b3IsIG1vZGlmaWVyLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlQXN5bmMoXG4gICAgICBzZWxlY3RvcixcbiAgICAgIG1vZGlmaWVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBfcmV0dXJuT2JqZWN0OiB0cnVlLFxuICAgICAgICB1cHNlcnQ6IHRydWUsXG4gICAgICB9KTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgR2V0cyB0aGUgbnVtYmVyIG9mIGRvY3VtZW50cyBtYXRjaGluZyB0aGUgZmlsdGVyLiBGb3IgYSBmYXN0IGNvdW50IG9mIHRoZSB0b3RhbCBkb2N1bWVudHMgaW4gYSBjb2xsZWN0aW9uIHNlZSBgZXN0aW1hdGVkRG9jdW1lbnRDb3VudGAuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGNvdW50RG9jdW1lbnRzXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IFtzZWxlY3Rvcl0gQSBxdWVyeSBkZXNjcmliaW5nIHRoZSBkb2N1bWVudHMgdG8gY291bnRcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS80LjExL2ludGVyZmFjZXMvQ291bnREb2N1bWVudHNPcHRpb25zLmh0bWwpLiBQbGVhc2Ugbm90ZSB0aGF0IG5vdCBhbGwgb2YgdGhlbSBhcmUgYXZhaWxhYmxlIG9uIHRoZSBjbGllbnQuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcj59XG4gICAqL1xuICBjb3VudERvY3VtZW50cyguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24uY291bnREb2N1bWVudHMoLi4uYXJncyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldHMgYW4gZXN0aW1hdGUgb2YgdGhlIGNvdW50IG9mIGRvY3VtZW50cyBpbiBhIGNvbGxlY3Rpb24gdXNpbmcgY29sbGVjdGlvbiBtZXRhZGF0YS4gRm9yIGFuIGV4YWN0IGNvdW50IG9mIHRoZSBkb2N1bWVudHMgaW4gYSBjb2xsZWN0aW9uIHNlZSBgY291bnREb2N1bWVudHNgLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCBlc3RpbWF0ZWREb2N1bWVudENvdW50XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIEFsbCBvcHRpb25zIGFyZSBsaXN0ZWQgaW4gW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9tb25nb2RiLmdpdGh1Yi5pby9ub2RlLW1vbmdvZGItbmF0aXZlLzQuMTEvaW50ZXJmYWNlcy9Fc3RpbWF0ZWREb2N1bWVudENvdW50T3B0aW9ucy5odG1sKS4gUGxlYXNlIG5vdGUgdGhhdCBub3QgYWxsIG9mIHRoZW0gYXJlIGF2YWlsYWJsZSBvbiB0aGUgY2xpZW50LlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXI+fVxuICAgKi9cbiAgZXN0aW1hdGVkRG9jdW1lbnRDb3VudCguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24uZXN0aW1hdGVkRG9jdW1lbnRDb3VudCguLi5hcmdzKTtcbiAgfSxcbn0iLCJpbXBvcnQgeyBMb2cgfSBmcm9tICdtZXRlb3IvbG9nZ2luZyc7XG5cbmV4cG9ydCBjb25zdCBJbmRleE1ldGhvZHMgPSB7XG4gIC8vIFdlJ2xsIGFjdHVhbGx5IGRlc2lnbiBhbiBpbmRleCBBUEkgbGF0ZXIuIEZvciBub3csIHdlIGp1c3QgcGFzcyB0aHJvdWdoIHRvXG4gIC8vIE1vbmdvJ3MsIGJ1dCBtYWtlIGl0IHN5bmNocm9ub3VzLlxuICAvKipcbiAgICogQHN1bW1hcnkgQXN5bmNocm9ub3VzbHkgY3JlYXRlcyB0aGUgc3BlY2lmaWVkIGluZGV4IG9uIHRoZSBjb2xsZWN0aW9uLlxuICAgKiBAbG9jdXMgc2VydmVyXG4gICAqIEBtZXRob2QgZW5zdXJlSW5kZXhBc3luY1xuICAgKiBAZGVwcmVjYXRlZCBpbiAzLjBcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbmRleCBBIGRvY3VtZW50IHRoYXQgY29udGFpbnMgdGhlIGZpZWxkIGFuZCB2YWx1ZSBwYWlycyB3aGVyZSB0aGUgZmllbGQgaXMgdGhlIGluZGV4IGtleSBhbmQgdGhlIHZhbHVlIGRlc2NyaWJlcyB0aGUgdHlwZSBvZiBpbmRleCBmb3IgdGhhdCBmaWVsZC4gRm9yIGFuIGFzY2VuZGluZyBpbmRleCBvbiBhIGZpZWxkLCBzcGVjaWZ5IGEgdmFsdWUgb2YgYDFgOyBmb3IgZGVzY2VuZGluZyBpbmRleCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAtMWAuIFVzZSBgdGV4dGAgZm9yIHRleHQgaW5kZXhlcy5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL21ldGhvZC9kYi5jb2xsZWN0aW9uLmNyZWF0ZUluZGV4LyNvcHRpb25zKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5uYW1lIE5hbWUgb2YgdGhlIGluZGV4XG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51bmlxdWUgRGVmaW5lIHRoYXQgdGhlIGluZGV4IHZhbHVlcyBtdXN0IGJlIHVuaXF1ZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtdW5pcXVlLylcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnNwYXJzZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggaXMgc3BhcnNlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC1zcGFyc2UvKVxuICAgKi9cbiAgYXN5bmMgZW5zdXJlSW5kZXhBc3luYyhpbmRleCwgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuX2NvbGxlY3Rpb24uZW5zdXJlSW5kZXhBc3luYyB8fCAhc2VsZi5fY29sbGVjdGlvbi5jcmVhdGVJbmRleEFzeW5jKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW4gb25seSBjYWxsIGNyZWF0ZUluZGV4QXN5bmMgb24gc2VydmVyIGNvbGxlY3Rpb25zJyk7XG4gICAgaWYgKHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXhBc3luYykge1xuICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5jcmVhdGVJbmRleEFzeW5jKGluZGV4LCBvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgTG9nLmRlYnVnKGBlbnN1cmVJbmRleEFzeW5jIGhhcyBiZWVuIGRlcHJlY2F0ZWQsIHBsZWFzZSB1c2UgdGhlIG5ldyAnY3JlYXRlSW5kZXhBc3luYycgaW5zdGVhZCR7IG9wdGlvbnM/Lm5hbWUgPyBgLCBpbmRleCBuYW1lOiAkeyBvcHRpb25zLm5hbWUgfWAgOiBgLCBpbmRleDogJHsgSlNPTi5zdHJpbmdpZnkoaW5kZXgpIH1gIH1gKVxuICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5lbnN1cmVJbmRleEFzeW5jKGluZGV4LCBvcHRpb25zKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IGNyZWF0ZXMgdGhlIHNwZWNpZmllZCBpbmRleCBvbiB0aGUgY29sbGVjdGlvbi5cbiAgICogQGxvY3VzIHNlcnZlclxuICAgKiBAbWV0aG9kIGNyZWF0ZUluZGV4QXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbmRleCBBIGRvY3VtZW50IHRoYXQgY29udGFpbnMgdGhlIGZpZWxkIGFuZCB2YWx1ZSBwYWlycyB3aGVyZSB0aGUgZmllbGQgaXMgdGhlIGluZGV4IGtleSBhbmQgdGhlIHZhbHVlIGRlc2NyaWJlcyB0aGUgdHlwZSBvZiBpbmRleCBmb3IgdGhhdCBmaWVsZC4gRm9yIGFuIGFzY2VuZGluZyBpbmRleCBvbiBhIGZpZWxkLCBzcGVjaWZ5IGEgdmFsdWUgb2YgYDFgOyBmb3IgZGVzY2VuZGluZyBpbmRleCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAtMWAuIFVzZSBgdGV4dGAgZm9yIHRleHQgaW5kZXhlcy5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL21ldGhvZC9kYi5jb2xsZWN0aW9uLmNyZWF0ZUluZGV4LyNvcHRpb25zKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5uYW1lIE5hbWUgb2YgdGhlIGluZGV4XG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51bmlxdWUgRGVmaW5lIHRoYXQgdGhlIGluZGV4IHZhbHVlcyBtdXN0IGJlIHVuaXF1ZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtdW5pcXVlLylcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnNwYXJzZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggaXMgc3BhcnNlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC1zcGFyc2UvKVxuICAgKi9cbiAgYXN5bmMgY3JlYXRlSW5kZXhBc3luYyhpbmRleCwgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXhBc3luYylcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCBjcmVhdGVJbmRleEFzeW5jIG9uIHNlcnZlciBjb2xsZWN0aW9ucycpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXhBc3luYyhpbmRleCwgb3B0aW9ucyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKFxuICAgICAgICBlLm1lc3NhZ2UuaW5jbHVkZXMoXG4gICAgICAgICAgJ0FuIGVxdWl2YWxlbnQgaW5kZXggYWxyZWFkeSBleGlzdHMgd2l0aCB0aGUgc2FtZSBuYW1lIGJ1dCBkaWZmZXJlbnQgb3B0aW9ucy4nXG4gICAgICAgICkgJiZcbiAgICAgICAgTWV0ZW9yLnNldHRpbmdzPy5wYWNrYWdlcz8ubW9uZ28/LnJlQ3JlYXRlSW5kZXhPbk9wdGlvbk1pc21hdGNoXG4gICAgICApIHtcbiAgICAgICAgTG9nLmluZm8oYFJlLWNyZWF0aW5nIGluZGV4ICR7IGluZGV4IH0gZm9yICR7IHNlbGYuX25hbWUgfSBkdWUgdG8gb3B0aW9ucyBtaXNtYXRjaC5gKTtcbiAgICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5kcm9wSW5kZXhBc3luYyhpbmRleCk7XG4gICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXhBc3luYyhpbmRleCwgb3B0aW9ucyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKGBBbiBlcnJvciBvY2N1cnJlZCB3aGVuIGNyZWF0aW5nIGFuIGluZGV4IGZvciBjb2xsZWN0aW9uIFwiJHsgc2VsZi5fbmFtZSB9OiAkeyBlLm1lc3NhZ2UgfWApO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQXN5bmNocm9ub3VzbHkgY3JlYXRlcyB0aGUgc3BlY2lmaWVkIGluZGV4IG9uIHRoZSBjb2xsZWN0aW9uLlxuICAgKiBAbG9jdXMgc2VydmVyXG4gICAqIEBtZXRob2QgY3JlYXRlSW5kZXhcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbmRleCBBIGRvY3VtZW50IHRoYXQgY29udGFpbnMgdGhlIGZpZWxkIGFuZCB2YWx1ZSBwYWlycyB3aGVyZSB0aGUgZmllbGQgaXMgdGhlIGluZGV4IGtleSBhbmQgdGhlIHZhbHVlIGRlc2NyaWJlcyB0aGUgdHlwZSBvZiBpbmRleCBmb3IgdGhhdCBmaWVsZC4gRm9yIGFuIGFzY2VuZGluZyBpbmRleCBvbiBhIGZpZWxkLCBzcGVjaWZ5IGEgdmFsdWUgb2YgYDFgOyBmb3IgZGVzY2VuZGluZyBpbmRleCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAtMWAuIFVzZSBgdGV4dGAgZm9yIHRleHQgaW5kZXhlcy5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL21ldGhvZC9kYi5jb2xsZWN0aW9uLmNyZWF0ZUluZGV4LyNvcHRpb25zKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5uYW1lIE5hbWUgb2YgdGhlIGluZGV4XG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51bmlxdWUgRGVmaW5lIHRoYXQgdGhlIGluZGV4IHZhbHVlcyBtdXN0IGJlIHVuaXF1ZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtdW5pcXVlLylcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnNwYXJzZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggaXMgc3BhcnNlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC1zcGFyc2UvKVxuICAgKi9cbiAgY3JlYXRlSW5kZXgoaW5kZXgsIG9wdGlvbnMpe1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZUluZGV4QXN5bmMoaW5kZXgsIG9wdGlvbnMpO1xuICB9LFxuXG4gIGFzeW5jIGRyb3BJbmRleEFzeW5jKGluZGV4KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5fY29sbGVjdGlvbi5kcm9wSW5kZXhBc3luYylcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCBkcm9wSW5kZXhBc3luYyBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmRyb3BJbmRleEFzeW5jKGluZGV4KTtcbiAgfSxcbn1cbiIsImV4cG9ydCBjb25zdCBSZXBsaWNhdGlvbk1ldGhvZHMgPSB7XG4gIGFzeW5jIF9tYXliZVNldFVwUmVwbGljYXRpb24obmFtZSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChcbiAgICAgICEoXG4gICAgICAgIHNlbGYuX2Nvbm5lY3Rpb24gJiZcbiAgICAgICAgc2VsZi5fY29ubmVjdGlvbi5yZWdpc3RlclN0b3JlQ2xpZW50ICYmXG4gICAgICAgIHNlbGYuX2Nvbm5lY3Rpb24ucmVnaXN0ZXJTdG9yZVNlcnZlclxuICAgICAgKVxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuXG4gICAgY29uc3Qgd3JhcHBlZFN0b3JlQ29tbW9uID0ge1xuICAgICAgLy8gQ2FsbGVkIGFyb3VuZCBtZXRob2Qgc3R1YiBpbnZvY2F0aW9ucyB0byBjYXB0dXJlIHRoZSBvcmlnaW5hbCB2ZXJzaW9uc1xuICAgICAgLy8gb2YgbW9kaWZpZWQgZG9jdW1lbnRzLlxuICAgICAgc2F2ZU9yaWdpbmFscygpIHtcbiAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9LFxuICAgICAgcmV0cmlldmVPcmlnaW5hbHMoKSB7XG4gICAgICAgIHJldHVybiBzZWxmLl9jb2xsZWN0aW9uLnJldHJpZXZlT3JpZ2luYWxzKCk7XG4gICAgICB9LFxuICAgICAgLy8gVG8gYmUgYWJsZSB0byBnZXQgYmFjayB0byB0aGUgY29sbGVjdGlvbiBmcm9tIHRoZSBzdG9yZS5cbiAgICAgIF9nZXRDb2xsZWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZjtcbiAgICAgIH0sXG4gICAgfTtcbiAgICBjb25zdCB3cmFwcGVkU3RvcmVDbGllbnQgPSB7XG4gICAgICAvLyBDYWxsZWQgYXQgdGhlIGJlZ2lubmluZyBvZiBhIGJhdGNoIG9mIHVwZGF0ZXMuIGJhdGNoU2l6ZSBpcyB0aGUgbnVtYmVyXG4gICAgICAvLyBvZiB1cGRhdGUgY2FsbHMgdG8gZXhwZWN0LlxuICAgICAgLy9cbiAgICAgIC8vIFhYWCBUaGlzIGludGVyZmFjZSBpcyBwcmV0dHkgamFua3kuIHJlc2V0IHByb2JhYmx5IG91Z2h0IHRvIGdvIGJhY2sgdG9cbiAgICAgIC8vIGJlaW5nIGl0cyBvd24gZnVuY3Rpb24sIGFuZCBjYWxsZXJzIHNob3VsZG4ndCBoYXZlIHRvIGNhbGN1bGF0ZVxuICAgICAgLy8gYmF0Y2hTaXplLiBUaGUgb3B0aW1pemF0aW9uIG9mIG5vdCBjYWxsaW5nIHBhdXNlL3JlbW92ZSBzaG91bGQgYmVcbiAgICAgIC8vIGRlbGF5ZWQgdW50aWwgbGF0ZXI6IHRoZSBmaXJzdCBjYWxsIHRvIHVwZGF0ZSgpIHNob3VsZCBidWZmZXIgaXRzXG4gICAgICAvLyBtZXNzYWdlLCBhbmQgdGhlbiB3ZSBjYW4gZWl0aGVyIGRpcmVjdGx5IGFwcGx5IGl0IGF0IGVuZFVwZGF0ZSB0aW1lIGlmXG4gICAgICAvLyBpdCB3YXMgdGhlIG9ubHkgdXBkYXRlLCBvciBkbyBwYXVzZU9ic2VydmVycy9hcHBseS9hcHBseSBhdCB0aGUgbmV4dFxuICAgICAgLy8gdXBkYXRlKCkgaWYgdGhlcmUncyBhbm90aGVyIG9uZS5cbiAgICAgIGFzeW5jIGJlZ2luVXBkYXRlKGJhdGNoU2l6ZSwgcmVzZXQpIHtcbiAgICAgICAgLy8gcGF1c2Ugb2JzZXJ2ZXJzIHNvIHVzZXJzIGRvbid0IHNlZSBmbGlja2VyIHdoZW4gdXBkYXRpbmcgc2V2ZXJhbFxuICAgICAgICAvLyBvYmplY3RzIGF0IG9uY2UgKGluY2x1ZGluZyB0aGUgcG9zdC1yZWNvbm5lY3QgcmVzZXQtYW5kLXJlYXBwbHlcbiAgICAgICAgLy8gc3RhZ2UpLCBhbmQgc28gdGhhdCBhIHJlLXNvcnRpbmcgb2YgYSBxdWVyeSBjYW4gdGFrZSBhZHZhbnRhZ2Ugb2YgdGhlXG4gICAgICAgIC8vIGZ1bGwgX2RpZmZRdWVyeSBtb3ZlZCBjYWxjdWxhdGlvbiBpbnN0ZWFkIG9mIGFwcGx5aW5nIGNoYW5nZSBvbmUgYXQgYVxuICAgICAgICAvLyB0aW1lLlxuICAgICAgICBpZiAoYmF0Y2hTaXplID4gMSB8fCByZXNldCkgc2VsZi5fY29sbGVjdGlvbi5wYXVzZU9ic2VydmVycygpO1xuXG4gICAgICAgIGlmIChyZXNldCkgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5yZW1vdmUoe30pO1xuICAgICAgfSxcblxuICAgICAgLy8gQXBwbHkgYW4gdXBkYXRlLlxuICAgICAgLy8gWFhYIGJldHRlciBzcGVjaWZ5IHRoaXMgaW50ZXJmYWNlIChub3QgaW4gdGVybXMgb2YgYSB3aXJlIG1lc3NhZ2UpP1xuICAgICAgdXBkYXRlKG1zZykge1xuICAgICAgICB2YXIgbW9uZ29JZCA9IE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpO1xuICAgICAgICB2YXIgZG9jID0gc2VsZi5fY29sbGVjdGlvbi5fZG9jcy5nZXQobW9uZ29JZCk7XG5cbiAgICAgICAgLy9XaGVuIHRoZSBzZXJ2ZXIncyBtZXJnZWJveCBpcyBkaXNhYmxlZCBmb3IgYSBjb2xsZWN0aW9uLCB0aGUgY2xpZW50IG11c3QgZ3JhY2VmdWxseSBoYW5kbGUgaXQgd2hlbjpcbiAgICAgICAgLy8gKldlIHJlY2VpdmUgYW4gYWRkZWQgbWVzc2FnZSBmb3IgYSBkb2N1bWVudCB0aGF0IGlzIGFscmVhZHkgdGhlcmUuIEluc3RlYWQsIGl0IHdpbGwgYmUgY2hhbmdlZFxuICAgICAgICAvLyAqV2UgcmVlaXZlIGEgY2hhbmdlIG1lc3NhZ2UgZm9yIGEgZG9jdW1lbnQgdGhhdCBpcyBub3QgdGhlcmUuIEluc3RlYWQsIGl0IHdpbGwgYmUgYWRkZWRcbiAgICAgICAgLy8gKldlIHJlY2VpdmUgYSByZW1vdmVkIG1lc3NzYWdlIGZvciBhIGRvY3VtZW50IHRoYXQgaXMgbm90IHRoZXJlLiBJbnN0ZWFkLCBub3Rpbmcgd2lsIGhhcHBlbi5cblxuICAgICAgICAvL0NvZGUgaXMgZGVyaXZlZCBmcm9tIGNsaWVudC1zaWRlIGNvZGUgb3JpZ2luYWxseSBpbiBwZWVybGlicmFyeTpjb250cm9sLW1lcmdlYm94XG4gICAgICAgIC8vaHR0cHM6Ly9naXRodWIuY29tL3BlZXJsaWJyYXJ5L21ldGVvci1jb250cm9sLW1lcmdlYm94L2Jsb2IvbWFzdGVyL2NsaWVudC5jb2ZmZWVcblxuICAgICAgICAvL0ZvciBtb3JlIGluZm9ybWF0aW9uLCByZWZlciB0byBkaXNjdXNzaW9uIFwiSW5pdGlhbCBzdXBwb3J0IGZvciBwdWJsaWNhdGlvbiBzdHJhdGVnaWVzIGluIGxpdmVkYXRhIHNlcnZlclwiOlxuICAgICAgICAvL2h0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL3B1bGwvMTExNTFcbiAgICAgICAgaWYgKE1ldGVvci5pc0NsaWVudCkge1xuICAgICAgICAgIGlmIChtc2cubXNnID09PSAnYWRkZWQnICYmIGRvYykge1xuICAgICAgICAgICAgbXNnLm1zZyA9ICdjaGFuZ2VkJztcbiAgICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdyZW1vdmVkJyAmJiAhZG9jKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnY2hhbmdlZCcgJiYgIWRvYykge1xuICAgICAgICAgICAgbXNnLm1zZyA9ICdhZGRlZCc7XG4gICAgICAgICAgICBjb25zdCBfcmVmID0gbXNnLmZpZWxkcztcbiAgICAgICAgICAgIGZvciAobGV0IGZpZWxkIGluIF9yZWYpIHtcbiAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBfcmVmW2ZpZWxkXTtcbiAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSB2b2lkIDApIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgbXNnLmZpZWxkc1tmaWVsZF07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gSXMgdGhpcyBhIFwicmVwbGFjZSB0aGUgd2hvbGUgZG9jXCIgbWVzc2FnZSBjb21pbmcgZnJvbSB0aGUgcXVpZXNjZW5jZVxuICAgICAgICAvLyBvZiBtZXRob2Qgd3JpdGVzIHRvIGFuIG9iamVjdD8gKE5vdGUgdGhhdCAndW5kZWZpbmVkJyBpcyBhIHZhbGlkXG4gICAgICAgIC8vIHZhbHVlIG1lYW5pbmcgXCJyZW1vdmUgaXRcIi4pXG4gICAgICAgIGlmIChtc2cubXNnID09PSAncmVwbGFjZScpIHtcbiAgICAgICAgICB2YXIgcmVwbGFjZSA9IG1zZy5yZXBsYWNlO1xuICAgICAgICAgIGlmICghcmVwbGFjZSkge1xuICAgICAgICAgICAgaWYgKGRvYykgc2VsZi5fY29sbGVjdGlvbi5yZW1vdmUobW9uZ29JZCk7XG4gICAgICAgICAgfSBlbHNlIGlmICghZG9jKSB7XG4gICAgICAgICAgICBzZWxmLl9jb2xsZWN0aW9uLmluc2VydChyZXBsYWNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gWFhYIGNoZWNrIHRoYXQgcmVwbGFjZSBoYXMgbm8gJCBvcHNcbiAgICAgICAgICAgIHNlbGYuX2NvbGxlY3Rpb24udXBkYXRlKG1vbmdvSWQsIHJlcGxhY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2FkZGVkJykge1xuICAgICAgICAgIGlmIChkb2MpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIG5vdCB0byBmaW5kIGEgZG9jdW1lbnQgYWxyZWFkeSBwcmVzZW50IGZvciBhbiBhZGQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZWxmLl9jb2xsZWN0aW9uLmluc2VydCh7IF9pZDogbW9uZ29JZCwgLi4ubXNnLmZpZWxkcyB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVtb3ZlZCcpIHtcbiAgICAgICAgICBpZiAoIWRvYylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCBhbHJlYWR5IHByZXNlbnQgZm9yIHJlbW92ZWQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlKG1vbmdvSWQpO1xuICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdjaGFuZ2VkJykge1xuICAgICAgICAgIGlmICghZG9jKSB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCB0byBjaGFuZ2UnKTtcbiAgICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMobXNnLmZpZWxkcyk7XG4gICAgICAgICAgaWYgKGtleXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdmFyIG1vZGlmaWVyID0ge307XG4gICAgICAgICAgICBrZXlzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBtc2cuZmllbGRzW2tleV07XG4gICAgICAgICAgICAgIGlmIChFSlNPTi5lcXVhbHMoZG9jW2tleV0sIHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGlmICghbW9kaWZpZXIuJHVuc2V0KSB7XG4gICAgICAgICAgICAgICAgICBtb2RpZmllci4kdW5zZXQgPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbW9kaWZpZXIuJHVuc2V0W2tleV0gPSAxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghbW9kaWZpZXIuJHNldCkge1xuICAgICAgICAgICAgICAgICAgbW9kaWZpZXIuJHNldCA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtb2RpZmllci4kc2V0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMobW9kaWZpZXIpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgc2VsZi5fY29sbGVjdGlvbi51cGRhdGUobW9uZ29JZCwgbW9kaWZpZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJIGRvbid0IGtub3cgaG93IHRvIGRlYWwgd2l0aCB0aGlzIG1lc3NhZ2VcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8vIENhbGxlZCBhdCB0aGUgZW5kIG9mIGEgYmF0Y2ggb2YgdXBkYXRlcy5saXZlZGF0YV9jb25uZWN0aW9uLmpzOjEyODdcbiAgICAgIGVuZFVwZGF0ZSgpIHtcbiAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5yZXN1bWVPYnNlcnZlcnNDbGllbnQoKTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIFVzZWQgdG8gcHJlc2VydmUgY3VycmVudCB2ZXJzaW9ucyBvZiBkb2N1bWVudHMgYWNyb3NzIGEgc3RvcmUgcmVzZXQuXG4gICAgICBnZXREb2MoaWQpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuZmluZE9uZShpZCk7XG4gICAgICB9LFxuXG4gICAgICAuLi53cmFwcGVkU3RvcmVDb21tb24sXG4gICAgfTtcbiAgICBjb25zdCB3cmFwcGVkU3RvcmVTZXJ2ZXIgPSB7XG4gICAgICBhc3luYyBiZWdpblVwZGF0ZShiYXRjaFNpemUsIHJlc2V0KSB7XG4gICAgICAgIGlmIChiYXRjaFNpemUgPiAxIHx8IHJlc2V0KSBzZWxmLl9jb2xsZWN0aW9uLnBhdXNlT2JzZXJ2ZXJzKCk7XG5cbiAgICAgICAgaWYgKHJlc2V0KSBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLnJlbW92ZUFzeW5jKHt9KTtcbiAgICAgIH0sXG5cbiAgICAgIGFzeW5jIHVwZGF0ZShtc2cpIHtcbiAgICAgICAgdmFyIG1vbmdvSWQgPSBNb25nb0lELmlkUGFyc2UobXNnLmlkKTtcbiAgICAgICAgdmFyIGRvYyA9IHNlbGYuX2NvbGxlY3Rpb24uX2RvY3MuZ2V0KG1vbmdvSWQpO1xuXG4gICAgICAgIC8vIElzIHRoaXMgYSBcInJlcGxhY2UgdGhlIHdob2xlIGRvY1wiIG1lc3NhZ2UgY29taW5nIGZyb20gdGhlIHF1aWVzY2VuY2VcbiAgICAgICAgLy8gb2YgbWV0aG9kIHdyaXRlcyB0byBhbiBvYmplY3Q/IChOb3RlIHRoYXQgJ3VuZGVmaW5lZCcgaXMgYSB2YWxpZFxuICAgICAgICAvLyB2YWx1ZSBtZWFuaW5nIFwicmVtb3ZlIGl0XCIuKVxuICAgICAgICBpZiAobXNnLm1zZyA9PT0gJ3JlcGxhY2UnKSB7XG4gICAgICAgICAgdmFyIHJlcGxhY2UgPSBtc2cucmVwbGFjZTtcbiAgICAgICAgICBpZiAoIXJlcGxhY2UpIHtcbiAgICAgICAgICAgIGlmIChkb2MpIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlQXN5bmMobW9uZ29JZCk7XG4gICAgICAgICAgfSBlbHNlIGlmICghZG9jKSB7XG4gICAgICAgICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmluc2VydEFzeW5jKHJlcGxhY2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBYWFggY2hlY2sgdGhhdCByZXBsYWNlIGhhcyBubyAkIG9wc1xuICAgICAgICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi51cGRhdGVBc3luYyhtb25nb0lkLCByZXBsYWNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdhZGRlZCcpIHtcbiAgICAgICAgICBpZiAoZG9jKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICdFeHBlY3RlZCBub3QgdG8gZmluZCBhIGRvY3VtZW50IGFscmVhZHkgcHJlc2VudCBmb3IgYW4gYWRkJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5pbnNlcnRBc3luYyh7IF9pZDogbW9uZ29JZCwgLi4ubXNnLmZpZWxkcyB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVtb3ZlZCcpIHtcbiAgICAgICAgICBpZiAoIWRvYylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCBhbHJlYWR5IHByZXNlbnQgZm9yIHJlbW92ZWQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlQXN5bmMobW9uZ29JZCk7XG4gICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2NoYW5nZWQnKSB7XG4gICAgICAgICAgaWYgKCFkb2MpIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgdG8gZmluZCBhIGRvY3VtZW50IHRvIGNoYW5nZScpO1xuICAgICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhtc2cuZmllbGRzKTtcbiAgICAgICAgICBpZiAoa2V5cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB2YXIgbW9kaWZpZXIgPSB7fTtcbiAgICAgICAgICAgIGtleXMuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IG1zZy5maWVsZHNba2V5XTtcbiAgICAgICAgICAgICAgaWYgKEVKU09OLmVxdWFscyhkb2Nba2V5XSwgdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtb2RpZmllci4kdW5zZXQpIHtcbiAgICAgICAgICAgICAgICAgIG1vZGlmaWVyLiR1bnNldCA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtb2RpZmllci4kdW5zZXRba2V5XSA9IDE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtb2RpZmllci4kc2V0KSB7XG4gICAgICAgICAgICAgICAgICBtb2RpZmllci4kc2V0ID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1vZGlmaWVyLiRzZXRba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhtb2RpZmllcikubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLnVwZGF0ZUFzeW5jKG1vbmdvSWQsIG1vZGlmaWVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSSBkb24ndCBrbm93IGhvdyB0byBkZWFsIHdpdGggdGhpcyBtZXNzYWdlXCIpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvLyBDYWxsZWQgYXQgdGhlIGVuZCBvZiBhIGJhdGNoIG9mIHVwZGF0ZXMuXG4gICAgICBhc3luYyBlbmRVcGRhdGUoKSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24ucmVzdW1lT2JzZXJ2ZXJzU2VydmVyKCk7XG4gICAgICB9LFxuXG4gICAgICAvLyBVc2VkIHRvIHByZXNlcnZlIGN1cnJlbnQgdmVyc2lvbnMgb2YgZG9jdW1lbnRzIGFjcm9zcyBhIHN0b3JlIHJlc2V0LlxuICAgICAgYXN5bmMgZ2V0RG9jKGlkKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZpbmRPbmVBc3luYyhpZCk7XG4gICAgICB9LFxuICAgICAgLi4ud3JhcHBlZFN0b3JlQ29tbW9uLFxuICAgIH07XG5cblxuICAgIC8vIE9LLCB3ZSdyZSBnb2luZyB0byBiZSBhIHNsYXZlLCByZXBsaWNhdGluZyBzb21lIHJlbW90ZVxuICAgIC8vIGRhdGFiYXNlLCBleGNlcHQgcG9zc2libHkgd2l0aCBzb21lIHRlbXBvcmFyeSBkaXZlcmdlbmNlIHdoaWxlXG4gICAgLy8gd2UgaGF2ZSB1bmFja25vd2xlZGdlZCBSUEMncy5cbiAgICBsZXQgcmVnaXN0ZXJTdG9yZVJlc3VsdDtcbiAgICBpZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XG4gICAgICByZWdpc3RlclN0b3JlUmVzdWx0ID0gc2VsZi5fY29ubmVjdGlvbi5yZWdpc3RlclN0b3JlQ2xpZW50KFxuICAgICAgICBuYW1lLFxuICAgICAgICB3cmFwcGVkU3RvcmVDbGllbnRcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZ2lzdGVyU3RvcmVSZXN1bHQgPSBzZWxmLl9jb25uZWN0aW9uLnJlZ2lzdGVyU3RvcmVTZXJ2ZXIoXG4gICAgICAgIG5hbWUsXG4gICAgICAgIHdyYXBwZWRTdG9yZVNlcnZlclxuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlID0gYFRoZXJlIGlzIGFscmVhZHkgYSBjb2xsZWN0aW9uIG5hbWVkIFwiJHtuYW1lfVwiYDtcbiAgICBjb25zdCBsb2dXYXJuID0gKCkgPT4ge1xuICAgICAgY29uc29sZS53YXJuID8gY29uc29sZS53YXJuKG1lc3NhZ2UpIDogY29uc29sZS5sb2cobWVzc2FnZSk7XG4gICAgfTtcblxuICAgIGlmICghcmVnaXN0ZXJTdG9yZVJlc3VsdCkge1xuICAgICAgcmV0dXJuIGxvZ1dhcm4oKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVnaXN0ZXJTdG9yZVJlc3VsdD8udGhlbj8uKG9rID0+IHtcbiAgICAgIGlmICghb2spIHtcbiAgICAgICAgbG9nV2FybigpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxufSIsImV4cG9ydCBjb25zdCBTeW5jTWV0aG9kcyA9IHtcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEZpbmQgdGhlIGRvY3VtZW50cyBpbiBhIGNvbGxlY3Rpb24gdGhhdCBtYXRjaCB0aGUgc2VsZWN0b3IuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGZpbmRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gW3NlbGVjdG9yXSBBIHF1ZXJ5IGRlc2NyaWJpbmcgdGhlIGRvY3VtZW50cyB0byBmaW5kXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtNb25nb1NvcnRTcGVjaWZpZXJ9IG9wdGlvbnMuc29ydCBTb3J0IG9yZGVyIChkZWZhdWx0OiBuYXR1cmFsIG9yZGVyKVxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5za2lwIE51bWJlciBvZiByZXN1bHRzIHRvIHNraXAgYXQgdGhlIGJlZ2lubmluZ1xuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5saW1pdCBNYXhpbXVtIG51bWJlciBvZiByZXN1bHRzIHRvIHJldHVyblxuICAgKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmVhY3RpdmUgKENsaWVudCBvbmx5KSBEZWZhdWx0IGB0cnVlYDsgcGFzcyBgZmFsc2VgIHRvIGRpc2FibGUgcmVhY3Rpdml0eVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBPdmVycmlkZXMgYHRyYW5zZm9ybWAgb24gdGhlICBbYENvbGxlY3Rpb25gXSgjY29sbGVjdGlvbnMpIGZvciB0aGlzIGN1cnNvci4gIFBhc3MgYG51bGxgIHRvIGRpc2FibGUgdHJhbnNmb3JtYXRpb24uXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5kaXNhYmxlT3Bsb2cgKFNlcnZlciBvbmx5KSBQYXNzIHRydWUgdG8gZGlzYWJsZSBvcGxvZy10YWlsaW5nIG9uIHRoaXMgcXVlcnkuIFRoaXMgYWZmZWN0cyB0aGUgd2F5IHNlcnZlciBwcm9jZXNzZXMgY2FsbHMgdG8gYG9ic2VydmVgIG9uIHRoaXMgcXVlcnkuIERpc2FibGluZyB0aGUgb3Bsb2cgY2FuIGJlIHVzZWZ1bCB3aGVuIHdvcmtpbmcgd2l0aCBkYXRhIHRoYXQgdXBkYXRlcyBpbiBsYXJnZSBiYXRjaGVzLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5wb2xsaW5nSW50ZXJ2YWxNcyAoU2VydmVyIG9ubHkpIFdoZW4gb3Bsb2cgaXMgZGlzYWJsZWQgKHRocm91Z2ggdGhlIHVzZSBvZiBgZGlzYWJsZU9wbG9nYCBvciB3aGVuIG90aGVyd2lzZSBub3QgYXZhaWxhYmxlKSwgdGhlIGZyZXF1ZW5jeSAoaW4gbWlsbGlzZWNvbmRzKSBvZiBob3cgb2Z0ZW4gdG8gcG9sbCB0aGlzIHF1ZXJ5IHdoZW4gb2JzZXJ2aW5nIG9uIHRoZSBzZXJ2ZXIuIERlZmF1bHRzIHRvIDEwMDAwbXMgKDEwIHNlY29uZHMpLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5wb2xsaW5nVGhyb3R0bGVNcyAoU2VydmVyIG9ubHkpIFdoZW4gb3Bsb2cgaXMgZGlzYWJsZWQgKHRocm91Z2ggdGhlIHVzZSBvZiBgZGlzYWJsZU9wbG9nYCBvciB3aGVuIG90aGVyd2lzZSBub3QgYXZhaWxhYmxlKSwgdGhlIG1pbmltdW0gdGltZSAoaW4gbWlsbGlzZWNvbmRzKSB0byBhbGxvdyBiZXR3ZWVuIHJlLXBvbGxpbmcgd2hlbiBvYnNlcnZpbmcgb24gdGhlIHNlcnZlci4gSW5jcmVhc2luZyB0aGlzIHdpbGwgc2F2ZSBDUFUgYW5kIG1vbmdvIGxvYWQgYXQgdGhlIGV4cGVuc2Ugb2Ygc2xvd2VyIHVwZGF0ZXMgdG8gdXNlcnMuIERlY3JlYXNpbmcgdGhpcyBpcyBub3QgcmVjb21tZW5kZWQuIERlZmF1bHRzIHRvIDUwbXMuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLm1heFRpbWVNcyAoU2VydmVyIG9ubHkpIElmIHNldCwgaW5zdHJ1Y3RzIE1vbmdvREIgdG8gc2V0IGEgdGltZSBsaW1pdCBmb3IgdGhpcyBjdXJzb3IncyBvcGVyYXRpb25zLiBJZiB0aGUgb3BlcmF0aW9uIHJlYWNoZXMgdGhlIHNwZWNpZmllZCB0aW1lIGxpbWl0IChpbiBtaWxsaXNlY29uZHMpIHdpdGhvdXQgdGhlIGhhdmluZyBiZWVuIGNvbXBsZXRlZCwgYW4gZXhjZXB0aW9uIHdpbGwgYmUgdGhyb3duLiBVc2VmdWwgdG8gcHJldmVudCBhbiAoYWNjaWRlbnRhbCBvciBtYWxpY2lvdXMpIHVub3B0aW1pemVkIHF1ZXJ5IGZyb20gY2F1c2luZyBhIGZ1bGwgY29sbGVjdGlvbiBzY2FuIHRoYXQgd291bGQgZGlzcnVwdCBvdGhlciBkYXRhYmFzZSB1c2VycywgYXQgdGhlIGV4cGVuc2Ugb2YgbmVlZGluZyB0byBoYW5kbGUgdGhlIHJlc3VsdGluZyBlcnJvci5cbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBvcHRpb25zLmhpbnQgKFNlcnZlciBvbmx5KSBPdmVycmlkZXMgTW9uZ29EQidzIGRlZmF1bHQgaW5kZXggc2VsZWN0aW9uIGFuZCBxdWVyeSBvcHRpbWl6YXRpb24gcHJvY2Vzcy4gU3BlY2lmeSBhbiBpbmRleCB0byBmb3JjZSBpdHMgdXNlLCBlaXRoZXIgYnkgaXRzIG5hbWUgb3IgaW5kZXggc3BlY2lmaWNhdGlvbi4gWW91IGNhbiBhbHNvIHNwZWNpZnkgYHsgJG5hdHVyYWwgOiAxIH1gIHRvIGZvcmNlIGEgZm9yd2FyZHMgY29sbGVjdGlvbiBzY2FuLCBvciBgeyAkbmF0dXJhbCA6IC0xIH1gIGZvciBhIHJldmVyc2UgY29sbGVjdGlvbiBzY2FuLiBTZXR0aW5nIHRoaXMgaXMgb25seSByZWNvbW1lbmRlZCBmb3IgYWR2YW5jZWQgdXNlcnMuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLnJlYWRQcmVmZXJlbmNlIChTZXJ2ZXIgb25seSkgU3BlY2lmaWVzIGEgY3VzdG9tIE1vbmdvREIgW2ByZWFkUHJlZmVyZW5jZWBdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9yZWFkLXByZWZlcmVuY2UpIGZvciB0aGlzIHBhcnRpY3VsYXIgY3Vyc29yLiBQb3NzaWJsZSB2YWx1ZXMgYXJlIGBwcmltYXJ5YCwgYHByaW1hcnlQcmVmZXJyZWRgLCBgc2Vjb25kYXJ5YCwgYHNlY29uZGFyeVByZWZlcnJlZGAgYW5kIGBuZWFyZXN0YC5cbiAgICogQHJldHVybnMge01vbmdvLkN1cnNvcn1cbiAgICovXG4gIGZpbmQoLi4uYXJncykge1xuICAgIC8vIENvbGxlY3Rpb24uZmluZCgpIChyZXR1cm4gYWxsIGRvY3MpIGJlaGF2ZXMgZGlmZmVyZW50bHlcbiAgICAvLyBmcm9tIENvbGxlY3Rpb24uZmluZCh1bmRlZmluZWQpIChyZXR1cm4gMCBkb2NzKS4gIHNvIGJlXG4gICAgLy8gY2FyZWZ1bCBhYm91dCB0aGUgbGVuZ3RoIG9mIGFyZ3VtZW50cy5cbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi5maW5kKFxuICAgICAgdGhpcy5fZ2V0RmluZFNlbGVjdG9yKGFyZ3MpLFxuICAgICAgdGhpcy5fZ2V0RmluZE9wdGlvbnMoYXJncylcbiAgICApO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGaW5kcyB0aGUgZmlyc3QgZG9jdW1lbnQgdGhhdCBtYXRjaGVzIHRoZSBzZWxlY3RvciwgYXMgb3JkZXJlZCBieSBzb3J0IGFuZCBza2lwIG9wdGlvbnMuIFJldHVybnMgYHVuZGVmaW5lZGAgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnQgaXMgZm91bmQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGZpbmRPbmVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gW3NlbGVjdG9yXSBBIHF1ZXJ5IGRlc2NyaWJpbmcgdGhlIGRvY3VtZW50cyB0byBmaW5kXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtNb25nb1NvcnRTcGVjaWZpZXJ9IG9wdGlvbnMuc29ydCBTb3J0IG9yZGVyIChkZWZhdWx0OiBuYXR1cmFsIG9yZGVyKVxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5za2lwIE51bWJlciBvZiByZXN1bHRzIHRvIHNraXAgYXQgdGhlIGJlZ2lubmluZ1xuICAgKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmVhY3RpdmUgKENsaWVudCBvbmx5KSBEZWZhdWx0IHRydWU7IHBhc3MgZmFsc2UgdG8gZGlzYWJsZSByZWFjdGl2aXR5XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMudHJhbnNmb3JtIE92ZXJyaWRlcyBgdHJhbnNmb3JtYCBvbiB0aGUgW2BDb2xsZWN0aW9uYF0oI2NvbGxlY3Rpb25zKSBmb3IgdGhpcyBjdXJzb3IuICBQYXNzIGBudWxsYCB0byBkaXNhYmxlIHRyYW5zZm9ybWF0aW9uLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5yZWFkUHJlZmVyZW5jZSAoU2VydmVyIG9ubHkpIFNwZWNpZmllcyBhIGN1c3RvbSBNb25nb0RCIFtgcmVhZFByZWZlcmVuY2VgXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvcmVhZC1wcmVmZXJlbmNlKSBmb3IgZmV0Y2hpbmcgdGhlIGRvY3VtZW50LiBQb3NzaWJsZSB2YWx1ZXMgYXJlIGBwcmltYXJ5YCwgYHByaW1hcnlQcmVmZXJyZWRgLCBgc2Vjb25kYXJ5YCwgYHNlY29uZGFyeVByZWZlcnJlZGAgYW5kIGBuZWFyZXN0YC5cbiAgICogQHJldHVybnMge09iamVjdH1cbiAgICovXG4gIGZpbmRPbmUoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLmZpbmRPbmUoXG4gICAgICB0aGlzLl9nZXRGaW5kU2VsZWN0b3IoYXJncyksXG4gICAgICB0aGlzLl9nZXRGaW5kT3B0aW9ucyhhcmdzKVxuICAgICk7XG4gIH0sXG5cblxuICAvLyAnaW5zZXJ0JyBpbW1lZGlhdGVseSByZXR1cm5zIHRoZSBpbnNlcnRlZCBkb2N1bWVudCdzIG5ldyBfaWQuXG4gIC8vIFRoZSBvdGhlcnMgcmV0dXJuIHZhbHVlcyBpbW1lZGlhdGVseSBpZiB5b3UgYXJlIGluIGEgc3R1YiwgYW4gaW4tbWVtb3J5XG4gIC8vIHVubWFuYWdlZCBjb2xsZWN0aW9uLCBvciBhIG1vbmdvLWJhY2tlZCBjb2xsZWN0aW9uIGFuZCB5b3UgZG9uJ3QgcGFzcyBhXG4gIC8vIGNhbGxiYWNrLiAndXBkYXRlJyBhbmQgJ3JlbW92ZScgcmV0dXJuIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWRcbiAgLy8gZG9jdW1lbnRzLiAndXBzZXJ0JyByZXR1cm5zIGFuIG9iamVjdCB3aXRoIGtleXMgJ251bWJlckFmZmVjdGVkJyBhbmQsIGlmIGFuXG4gIC8vIGluc2VydCBoYXBwZW5lZCwgJ2luc2VydGVkSWQnLlxuICAvL1xuICAvLyBPdGhlcndpc2UsIHRoZSBzZW1hbnRpY3MgYXJlIGV4YWN0bHkgbGlrZSBvdGhlciBtZXRob2RzOiB0aGV5IHRha2VcbiAgLy8gYSBjYWxsYmFjayBhcyBhbiBvcHRpb25hbCBsYXN0IGFyZ3VtZW50OyBpZiBubyBjYWxsYmFjayBpc1xuICAvLyBwcm92aWRlZCwgdGhleSBibG9jayB1bnRpbCB0aGUgb3BlcmF0aW9uIGlzIGNvbXBsZXRlLCBhbmQgdGhyb3cgYW5cbiAgLy8gZXhjZXB0aW9uIGlmIGl0IGZhaWxzOyBpZiBhIGNhbGxiYWNrIGlzIHByb3ZpZGVkLCB0aGVuIHRoZXkgZG9uJ3RcbiAgLy8gbmVjZXNzYXJpbHkgYmxvY2ssIGFuZCB0aGV5IGNhbGwgdGhlIGNhbGxiYWNrIHdoZW4gdGhleSBmaW5pc2ggd2l0aCBlcnJvciBhbmRcbiAgLy8gcmVzdWx0IGFyZ3VtZW50cy4gIChUaGUgaW5zZXJ0IG1ldGhvZCBwcm92aWRlcyB0aGUgZG9jdW1lbnQgSUQgYXMgaXRzIHJlc3VsdDtcbiAgLy8gdXBkYXRlIGFuZCByZW1vdmUgcHJvdmlkZSB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIGRvY3MgYXMgdGhlIHJlc3VsdDsgdXBzZXJ0XG4gIC8vIHByb3ZpZGVzIGFuIG9iamVjdCB3aXRoIG51bWJlckFmZmVjdGVkIGFuZCBtYXliZSBpbnNlcnRlZElkLilcbiAgLy9cbiAgLy8gT24gdGhlIGNsaWVudCwgYmxvY2tpbmcgaXMgaW1wb3NzaWJsZSwgc28gaWYgYSBjYWxsYmFja1xuICAvLyBpc24ndCBwcm92aWRlZCwgdGhleSBqdXN0IHJldHVybiBpbW1lZGlhdGVseSBhbmQgYW55IGVycm9yXG4gIC8vIGluZm9ybWF0aW9uIGlzIGxvc3QuXG4gIC8vXG4gIC8vIFRoZXJlJ3Mgb25lIG1vcmUgdHdlYWsuIE9uIHRoZSBjbGllbnQsIGlmIHlvdSBkb24ndCBwcm92aWRlIGFcbiAgLy8gY2FsbGJhY2ssIHRoZW4gaWYgdGhlcmUgaXMgYW4gZXJyb3IsIGEgbWVzc2FnZSB3aWxsIGJlIGxvZ2dlZCB3aXRoXG4gIC8vIE1ldGVvci5fZGVidWcuXG4gIC8vXG4gIC8vIFRoZSBpbnRlbnQgKHRob3VnaCB0aGlzIGlzIGFjdHVhbGx5IGRldGVybWluZWQgYnkgdGhlIHVuZGVybHlpbmdcbiAgLy8gZHJpdmVycykgaXMgdGhhdCB0aGUgb3BlcmF0aW9ucyBzaG91bGQgYmUgZG9uZSBzeW5jaHJvbm91c2x5LCBub3RcbiAgLy8gZ2VuZXJhdGluZyB0aGVpciByZXN1bHQgdW50aWwgdGhlIGRhdGFiYXNlIGhhcyBhY2tub3dsZWRnZWRcbiAgLy8gdGhlbS4gSW4gdGhlIGZ1dHVyZSBtYXliZSB3ZSBzaG91bGQgcHJvdmlkZSBhIGZsYWcgdG8gdHVybiB0aGlzXG4gIC8vIG9mZi5cblxuICBfaW5zZXJ0KGRvYywgY2FsbGJhY2spIHtcbiAgICAvLyBNYWtlIHN1cmUgd2Ugd2VyZSBwYXNzZWQgYSBkb2N1bWVudCB0byBpbnNlcnRcbiAgICBpZiAoIWRvYykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnNlcnQgcmVxdWlyZXMgYW4gYXJndW1lbnQnKTtcbiAgICB9XG5cblxuICAgIC8vIE1ha2UgYSBzaGFsbG93IGNsb25lIG9mIHRoZSBkb2N1bWVudCwgcHJlc2VydmluZyBpdHMgcHJvdG90eXBlLlxuICAgIGRvYyA9IE9iamVjdC5jcmVhdGUoXG4gICAgICBPYmplY3QuZ2V0UHJvdG90eXBlT2YoZG9jKSxcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKGRvYylcbiAgICApO1xuXG4gICAgaWYgKCdfaWQnIGluIGRvYykge1xuICAgICAgaWYgKFxuICAgICAgICAhZG9jLl9pZCB8fFxuICAgICAgICAhKHR5cGVvZiBkb2MuX2lkID09PSAnc3RyaW5nJyB8fCBkb2MuX2lkIGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SUQpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdNZXRlb3IgcmVxdWlyZXMgZG9jdW1lbnQgX2lkIGZpZWxkcyB0byBiZSBub24tZW1wdHkgc3RyaW5ncyBvciBPYmplY3RJRHMnXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBnZW5lcmF0ZUlkID0gdHJ1ZTtcblxuICAgICAgLy8gRG9uJ3QgZ2VuZXJhdGUgdGhlIGlkIGlmIHdlJ3JlIHRoZSBjbGllbnQgYW5kIHRoZSAnb3V0ZXJtb3N0JyBjYWxsXG4gICAgICAvLyBUaGlzIG9wdGltaXphdGlvbiBzYXZlcyB1cyBwYXNzaW5nIGJvdGggdGhlIHJhbmRvbVNlZWQgYW5kIHRoZSBpZFxuICAgICAgLy8gUGFzc2luZyBib3RoIGlzIHJlZHVuZGFudC5cbiAgICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgICBjb25zdCBlbmNsb3NpbmcgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICAgICAgICBpZiAoIWVuY2xvc2luZykge1xuICAgICAgICAgIGdlbmVyYXRlSWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZ2VuZXJhdGVJZCkge1xuICAgICAgICBkb2MuX2lkID0gdGhpcy5fbWFrZU5ld0lEKCk7XG4gICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyBPbiBpbnNlcnRzLCBhbHdheXMgcmV0dXJuIHRoZSBpZCB0aGF0IHdlIGdlbmVyYXRlZDsgb24gYWxsIG90aGVyXG4gICAgLy8gb3BlcmF0aW9ucywganVzdCByZXR1cm4gdGhlIHJlc3VsdCBmcm9tIHRoZSBjb2xsZWN0aW9uLlxuICAgIHZhciBjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0ID0gZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICBpZiAoTWV0ZW9yLl9pc1Byb21pc2UocmVzdWx0KSkgcmV0dXJuIHJlc3VsdDtcblxuICAgICAgaWYgKGRvYy5faWQpIHtcbiAgICAgICAgcmV0dXJuIGRvYy5faWQ7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCB3aGF0IGlzIHRoaXMgZm9yPz9cbiAgICAgIC8vIEl0J3Mgc29tZSBpdGVyYWN0aW9uIGJldHdlZW4gdGhlIGNhbGxiYWNrIHRvIF9jYWxsTXV0YXRvck1ldGhvZCBhbmRcbiAgICAgIC8vIHRoZSByZXR1cm4gdmFsdWUgY29udmVyc2lvblxuICAgICAgZG9jLl9pZCA9IHJlc3VsdDtcblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gICAgY29uc3Qgd3JhcHBlZENhbGxiYWNrID0gd3JhcENhbGxiYWNrKFxuICAgICAgY2FsbGJhY2ssXG4gICAgICBjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0XG4gICAgKTtcblxuICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fY2FsbE11dGF0b3JNZXRob2QoJ2luc2VydCcsIFtkb2NdLCB3cmFwcGVkQ2FsbGJhY2spO1xuICAgICAgcmV0dXJuIGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQocmVzdWx0KTtcbiAgICB9XG5cbiAgICAvLyBpdCdzIG15IGNvbGxlY3Rpb24uICBkZXNjZW5kIGludG8gdGhlIGNvbGxlY3Rpb24gb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIHRyeSB7XG4gICAgICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhIGNhbGxiYWNrIGFuZCB0aGUgY29sbGVjdGlvbiBpbXBsZW1lbnRzIHRoaXNcbiAgICAgIC8vIG9wZXJhdGlvbiBhc3luY2hyb25vdXNseSwgdGhlbiBxdWVyeVJldCB3aWxsIGJlIHVuZGVmaW5lZCwgYW5kIHRoZVxuICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgcmV0dXJuZWQgdGhyb3VnaCB0aGUgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgIGxldCByZXN1bHQ7XG4gICAgICBpZiAoISF3cmFwcGVkQ2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5fY29sbGVjdGlvbi5pbnNlcnQoZG9jLCB3cmFwcGVkQ2FsbGJhY2spO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gSWYgd2UgZG9uJ3QgaGF2ZSB0aGUgY2FsbGJhY2ssIHdlIGFzc3VtZSB0aGUgdXNlciBpcyB1c2luZyB0aGUgcHJvbWlzZS5cbiAgICAgICAgLy8gV2UgY2FuJ3QganVzdCBwYXNzIHRoaXMuX2NvbGxlY3Rpb24uaW5zZXJ0IHRvIHRoZSBwcm9taXNpZnkgYmVjYXVzZSBpdCB3b3VsZCBsb3NlIHRoZSBjb250ZXh0LlxuICAgICAgICByZXN1bHQgPSB0aGlzLl9jb2xsZWN0aW9uLmluc2VydChkb2MpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdChyZXN1bHQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhlKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgSW5zZXJ0IGEgZG9jdW1lbnQgaW4gdGhlIGNvbGxlY3Rpb24uICBSZXR1cm5zIGl0cyB1bmlxdWUgX2lkLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCAgaW5zZXJ0XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gZG9jIFRoZSBkb2N1bWVudCB0byBpbnNlcnQuIE1heSBub3QgeWV0IGhhdmUgYW4gX2lkIGF0dHJpYnV0ZSwgaW4gd2hpY2ggY2FzZSBNZXRlb3Igd2lsbCBnZW5lcmF0ZSBvbmUgZm9yIHlvdS5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBPcHRpb25hbC4gIElmIHByZXNlbnQsIGNhbGxlZCB3aXRoIGFuIGVycm9yIG9iamVjdCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgYW5kLCBpZiBubyBlcnJvciwgdGhlIF9pZCBhcyB0aGUgc2Vjb25kLlxuICAgKi9cbiAgaW5zZXJ0KGRvYywgY2FsbGJhY2spIHtcbiAgICByZXR1cm4gdGhpcy5faW5zZXJ0KGRvYywgY2FsbGJhY2spO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSBtb2RpZmllcyBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24uIFJldHVybnMgdGhlIG51bWJlciBvZiBtYXRjaGVkIGRvY3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBkYXRlXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gbW9kaWZ5XG4gICAqIEBwYXJhbSB7TW9uZ29Nb2RpZmllcn0gbW9kaWZpZXIgU3BlY2lmaWVzIGhvdyB0byBtb2RpZnkgdGhlIGRvY3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5tdWx0aSBUcnVlIHRvIG1vZGlmeSBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzOyBmYWxzZSB0byBvbmx5IG1vZGlmeSBvbmUgb2YgdGhlIG1hdGNoaW5nIGRvY3VtZW50cyAodGhlIGRlZmF1bHQpLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudXBzZXJ0IFRydWUgdG8gaW5zZXJ0IGEgZG9jdW1lbnQgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnRzIGFyZSBmb3VuZC5cbiAgICogQHBhcmFtIHtBcnJheX0gb3B0aW9ucy5hcnJheUZpbHRlcnMgT3B0aW9uYWwuIFVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBNb25nb0RCIFtmaWx0ZXJlZCBwb3NpdGlvbmFsIG9wZXJhdG9yXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9vcGVyYXRvci91cGRhdGUvcG9zaXRpb25hbC1maWx0ZXJlZC8pIHRvIHNwZWNpZnkgd2hpY2ggZWxlbWVudHMgdG8gbW9kaWZ5IGluIGFuIGFycmF5IGZpZWxkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIE9wdGlvbmFsLiAgSWYgcHJlc2VudCwgY2FsbGVkIHdpdGggYW4gZXJyb3Igb2JqZWN0IGFzIHRoZSBmaXJzdCBhcmd1bWVudCBhbmQsIGlmIG5vIGVycm9yLCB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIGRvY3VtZW50cyBhcyB0aGUgc2Vjb25kLlxuICAgKi9cbiAgdXBkYXRlKHNlbGVjdG9yLCBtb2RpZmllciwgLi4ub3B0aW9uc0FuZENhbGxiYWNrKSB7XG4gICAgY29uc3QgY2FsbGJhY2sgPSBwb3BDYWxsYmFja0Zyb21BcmdzKG9wdGlvbnNBbmRDYWxsYmFjayk7XG5cbiAgICAvLyBXZSd2ZSBhbHJlYWR5IHBvcHBlZCBvZmYgdGhlIGNhbGxiYWNrLCBzbyB3ZSBhcmUgbGVmdCB3aXRoIGFuIGFycmF5XG4gICAgLy8gb2Ygb25lIG9yIHplcm8gaXRlbXNcbiAgICBjb25zdCBvcHRpb25zID0geyAuLi4ob3B0aW9uc0FuZENhbGxiYWNrWzBdIHx8IG51bGwpIH07XG4gICAgbGV0IGluc2VydGVkSWQ7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy51cHNlcnQpIHtcbiAgICAgIC8vIHNldCBgaW5zZXJ0ZWRJZGAgaWYgYWJzZW50LiAgYGluc2VydGVkSWRgIGlzIGEgTWV0ZW9yIGV4dGVuc2lvbi5cbiAgICAgIGlmIChvcHRpb25zLmluc2VydGVkSWQpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICEoXG4gICAgICAgICAgICB0eXBlb2Ygb3B0aW9ucy5pbnNlcnRlZElkID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgICAgb3B0aW9ucy5pbnNlcnRlZElkIGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SURcbiAgICAgICAgICApXG4gICAgICAgIClcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2luc2VydGVkSWQgbXVzdCBiZSBzdHJpbmcgb3IgT2JqZWN0SUQnKTtcbiAgICAgICAgaW5zZXJ0ZWRJZCA9IG9wdGlvbnMuaW5zZXJ0ZWRJZDtcbiAgICAgIH0gZWxzZSBpZiAoIXNlbGVjdG9yIHx8ICFzZWxlY3Rvci5faWQpIHtcbiAgICAgICAgaW5zZXJ0ZWRJZCA9IHRoaXMuX21ha2VOZXdJRCgpO1xuICAgICAgICBvcHRpb25zLmdlbmVyYXRlZElkID0gdHJ1ZTtcbiAgICAgICAgb3B0aW9ucy5pbnNlcnRlZElkID0gaW5zZXJ0ZWRJZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzZWxlY3RvciA9IE1vbmdvLkNvbGxlY3Rpb24uX3Jld3JpdGVTZWxlY3RvcihzZWxlY3Rvciwge1xuICAgICAgZmFsbGJhY2tJZDogaW5zZXJ0ZWRJZCxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdyYXBwZWRDYWxsYmFjayA9IHdyYXBDYWxsYmFjayhjYWxsYmFjayk7XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIGNvbnN0IGFyZ3MgPSBbc2VsZWN0b3IsIG1vZGlmaWVyLCBvcHRpb25zXTtcbiAgICAgIHJldHVybiB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZCgndXBkYXRlJywgYXJncywgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8vIGl0J3MgbXkgY29sbGVjdGlvbi4gIGRlc2NlbmQgaW50byB0aGUgY29sbGVjdGlvbiBvYmplY3RcbiAgICAvLyBhbmQgcHJvcGFnYXRlIGFueSBleGNlcHRpb24uXG4gICAgLy8gSWYgdGhlIHVzZXIgcHJvdmlkZWQgYSBjYWxsYmFjayBhbmQgdGhlIGNvbGxlY3Rpb24gaW1wbGVtZW50cyB0aGlzXG4gICAgLy8gb3BlcmF0aW9uIGFzeW5jaHJvbm91c2x5LCB0aGVuIHF1ZXJ5UmV0IHdpbGwgYmUgdW5kZWZpbmVkLCBhbmQgdGhlXG4gICAgLy8gcmVzdWx0IHdpbGwgYmUgcmV0dXJuZWQgdGhyb3VnaCB0aGUgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAvL2NvbnNvbGUubG9nKHtjYWxsYmFjaywgb3B0aW9ucywgc2VsZWN0b3IsIG1vZGlmaWVyLCBjb2xsOiB0aGlzLl9jb2xsZWN0aW9ufSk7XG4gICAgdHJ5IHtcbiAgICAgIC8vIElmIHRoZSB1c2VyIHByb3ZpZGVkIGEgY2FsbGJhY2sgYW5kIHRoZSBjb2xsZWN0aW9uIGltcGxlbWVudHMgdGhpc1xuICAgICAgLy8gb3BlcmF0aW9uIGFzeW5jaHJvbm91c2x5LCB0aGVuIHF1ZXJ5UmV0IHdpbGwgYmUgdW5kZWZpbmVkLCBhbmQgdGhlXG4gICAgICAvLyByZXN1bHQgd2lsbCBiZSByZXR1cm5lZCB0aHJvdWdoIHRoZSBjYWxsYmFjayBpbnN0ZWFkLlxuICAgICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24udXBkYXRlKFxuICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgbW9kaWZpZXIsXG4gICAgICAgIG9wdGlvbnMsXG4gICAgICAgIHdyYXBwZWRDYWxsYmFja1xuICAgICAgKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJlbW92ZSBkb2N1bWVudHMgZnJvbSB0aGUgY29sbGVjdGlvblxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCByZW1vdmVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byByZW1vdmVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBPcHRpb25hbC4gIElmIHByZXNlbnQsIGNhbGxlZCB3aXRoIGFuIGVycm9yIG9iamVjdCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgYW5kLCBpZiBubyBlcnJvciwgdGhlIG51bWJlciBvZiBhZmZlY3RlZCBkb2N1bWVudHMgYXMgdGhlIHNlY29uZC5cbiAgICovXG4gIHJlbW92ZShzZWxlY3RvciwgY2FsbGJhY2spIHtcbiAgICBzZWxlY3RvciA9IE1vbmdvLkNvbGxlY3Rpb24uX3Jld3JpdGVTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZCgncmVtb3ZlJywgW3NlbGVjdG9yXSwgY2FsbGJhY2spO1xuICAgIH1cblxuXG4gICAgLy8gaXQncyBteSBjb2xsZWN0aW9uLiAgZGVzY2VuZCBpbnRvIHRoZSBjb2xsZWN0aW9uMSBvYmplY3RcbiAgICAvLyBhbmQgcHJvcGFnYXRlIGFueSBleGNlcHRpb24uXG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24ucmVtb3ZlKHNlbGVjdG9yKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQXN5bmNocm9ub3VzbHkgbW9kaWZpZXMgb25lIG9yIG1vcmUgZG9jdW1lbnRzIGluIHRoZSBjb2xsZWN0aW9uLCBvciBpbnNlcnQgb25lIGlmIG5vIG1hdGNoaW5nIGRvY3VtZW50cyB3ZXJlIGZvdW5kLiBSZXR1cm5zIGFuIG9iamVjdCB3aXRoIGtleXMgYG51bWJlckFmZmVjdGVkYCAodGhlIG51bWJlciBvZiBkb2N1bWVudHMgbW9kaWZpZWQpICBhbmQgYGluc2VydGVkSWRgICh0aGUgdW5pcXVlIF9pZCBvZiB0aGUgZG9jdW1lbnQgdGhhdCB3YXMgaW5zZXJ0ZWQsIGlmIGFueSkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHVwc2VydFxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBzZWxlY3RvciBTcGVjaWZpZXMgd2hpY2ggZG9jdW1lbnRzIHRvIG1vZGlmeVxuICAgKiBAcGFyYW0ge01vbmdvTW9kaWZpZXJ9IG1vZGlmaWVyIFNwZWNpZmllcyBob3cgdG8gbW9kaWZ5IHRoZSBkb2N1bWVudHNcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMubXVsdGkgVHJ1ZSB0byBtb2RpZnkgYWxsIG1hdGNoaW5nIGRvY3VtZW50czsgZmFsc2UgdG8gb25seSBtb2RpZnkgb25lIG9mIHRoZSBtYXRjaGluZyBkb2N1bWVudHMgKHRoZSBkZWZhdWx0KS5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBPcHRpb25hbC4gIElmIHByZXNlbnQsIGNhbGxlZCB3aXRoIGFuIGVycm9yIG9iamVjdCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgYW5kLCBpZiBubyBlcnJvciwgdGhlIG51bWJlciBvZiBhZmZlY3RlZCBkb2N1bWVudHMgYXMgdGhlIHNlY29uZC5cbiAgICovXG4gIHVwc2VydChzZWxlY3RvciwgbW9kaWZpZXIsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFjYWxsYmFjayAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnVwZGF0ZShcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgbW9kaWZpZXIsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIF9yZXR1cm5PYmplY3Q6IHRydWUsXG4gICAgICAgIHVwc2VydDogdHJ1ZSxcbiAgICAgIH0pO1xuICB9LFxufVxuXG4vLyBDb252ZXJ0IHRoZSBjYWxsYmFjayB0byBub3QgcmV0dXJuIGEgcmVzdWx0IGlmIHRoZXJlIGlzIGFuIGVycm9yXG5mdW5jdGlvbiB3cmFwQ2FsbGJhY2soY2FsbGJhY2ssIGNvbnZlcnRSZXN1bHQpIHtcbiAgcmV0dXJuIChcbiAgICBjYWxsYmFjayAmJlxuICAgIGZ1bmN0aW9uKGVycm9yLCByZXN1bHQpIHtcbiAgICAgIGlmIChlcnJvcikge1xuICAgICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb252ZXJ0UmVzdWx0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBjb252ZXJ0UmVzdWx0KHJlc3VsdCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIHJlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuICApO1xufVxuXG5mdW5jdGlvbiBwb3BDYWxsYmFja0Zyb21BcmdzKGFyZ3MpIHtcbiAgLy8gUHVsbCBvZmYgYW55IGNhbGxiYWNrIChvciBwZXJoYXBzIGEgJ2NhbGxiYWNrJyB2YXJpYWJsZSB0aGF0IHdhcyBwYXNzZWRcbiAgLy8gaW4gdW5kZWZpbmVkLCBsaWtlIGhvdyAndXBzZXJ0JyBkb2VzIGl0KS5cbiAgaWYgKFxuICAgIGFyZ3MubGVuZ3RoICYmXG4gICAgKGFyZ3NbYXJncy5sZW5ndGggLSAxXSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gaW5zdGFuY2VvZiBGdW5jdGlvbilcbiAgKSB7XG4gICAgcmV0dXJuIGFyZ3MucG9wKCk7XG4gIH1cbn1cbiIsIi8qKlxuICogQHN1bW1hcnkgQWxsb3dzIGZvciB1c2VyIHNwZWNpZmllZCBjb25uZWN0aW9uIG9wdGlvbnNcbiAqIEBleGFtcGxlIGh0dHA6Ly9tb25nb2RiLmdpdGh1Yi5pby9ub2RlLW1vbmdvZGItbmF0aXZlLzMuMC9yZWZlcmVuY2UvY29ubmVjdGluZy9jb25uZWN0aW9uLXNldHRpbmdzL1xuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgVXNlciBzcGVjaWZpZWQgTW9uZ28gY29ubmVjdGlvbiBvcHRpb25zXG4gKi9cbk1vbmdvLnNldENvbm5lY3Rpb25PcHRpb25zID0gZnVuY3Rpb24gc2V0Q29ubmVjdGlvbk9wdGlvbnMgKG9wdGlvbnMpIHtcbiAgY2hlY2sob3B0aW9ucywgT2JqZWN0KTtcbiAgTW9uZ28uX2Nvbm5lY3Rpb25PcHRpb25zID0gb3B0aW9ucztcbn07IiwiZXhwb3J0IGNvbnN0IG5vcm1hbGl6ZVByb2plY3Rpb24gPSBvcHRpb25zID0+IHtcbiAgLy8gdHJhbnNmb3JtIGZpZWxkcyBrZXkgaW4gcHJvamVjdGlvblxuICBjb25zdCB7IGZpZWxkcywgcHJvamVjdGlvbiwgLi4ub3RoZXJPcHRpb25zIH0gPSBvcHRpb25zIHx8IHt9O1xuICAvLyBUT0RPOiBlbmFibGUgdGhpcyBjb21tZW50IHdoZW4gZGVwcmVjYXRpbmcgdGhlIGZpZWxkcyBvcHRpb25cbiAgLy8gTG9nLmRlYnVnKGBmaWVsZHMgb3B0aW9uIGhhcyBiZWVuIGRlcHJlY2F0ZWQsIHBsZWFzZSB1c2UgdGhlIG5ldyAncHJvamVjdGlvbicgaW5zdGVhZGApXG5cbiAgcmV0dXJuIHtcbiAgICAuLi5vdGhlck9wdGlvbnMsXG4gICAgLi4uKHByb2plY3Rpb24gfHwgZmllbGRzID8geyBwcm9qZWN0aW9uOiBmaWVsZHMgfHwgcHJvamVjdGlvbiB9IDoge30pLFxuICB9O1xufTtcbiIsImltcG9ydCB7IE9ic2VydmVIYW5kbGVDYWxsYmFjaywgT2JzZXJ2ZU11bHRpcGxleGVyIH0gZnJvbSAnLi9vYnNlcnZlX211bHRpcGxleCc7XG5cbmxldCBuZXh0T2JzZXJ2ZUhhbmRsZUlkID0gMTtcblxuZXhwb3J0IHR5cGUgT2JzZXJ2ZUhhbmRsZUNhbGxiYWNrSW50ZXJuYWwgPSAnX2FkZGVkJyB8ICdfYWRkZWRCZWZvcmUnIHwgJ19jaGFuZ2VkJyB8ICdfbW92ZWRCZWZvcmUnIHwgJ19yZW1vdmVkJztcblxuXG5leHBvcnQgdHlwZSBDYWxsYmFjazxUID0gYW55PiA9ICguLi5hcmdzOiBUW10pID0+IFByb21pc2U8dm9pZD4gfCB2b2lkO1xuXG4vKipcbiAqIFRoZSBcIm9ic2VydmUgaGFuZGxlXCIgcmV0dXJuZWQgZnJvbSBvYnNlcnZlQ2hhbmdlcy5cbiAqIENvbnRhaW5zIGEgcmVmZXJlbmNlIHRvIGFuIE9ic2VydmVNdWx0aXBsZXhlci5cbiAqIFVzZWQgdG8gc3RvcCBvYnNlcnZhdGlvbiBhbmQgY2xlYW4gdXAgcmVzb3VyY2VzLlxuICovXG5leHBvcnQgY2xhc3MgT2JzZXJ2ZUhhbmRsZTxUID0gYW55PiB7XG4gIF9pZDogbnVtYmVyO1xuICBfbXVsdGlwbGV4ZXI6IE9ic2VydmVNdWx0aXBsZXhlcjtcbiAgbm9uTXV0YXRpbmdDYWxsYmFja3M6IGJvb2xlYW47XG4gIF9zdG9wcGVkOiBib29sZWFuO1xuXG4gIHB1YmxpYyBpbml0aWFsQWRkc1NlbnRSZXNvbHZlcjogKHZhbHVlOiB2b2lkKSA9PiB2b2lkID0gKCkgPT4ge307XG4gIHB1YmxpYyBpbml0aWFsQWRkc1NlbnQ6IFByb21pc2U8dm9pZD5cblxuICBfYWRkZWQ/OiBDYWxsYmFjazxUPjtcbiAgX2FkZGVkQmVmb3JlPzogQ2FsbGJhY2s8VD47XG4gIF9jaGFuZ2VkPzogQ2FsbGJhY2s8VD47XG4gIF9tb3ZlZEJlZm9yZT86IENhbGxiYWNrPFQ+O1xuICBfcmVtb3ZlZD86IENhbGxiYWNrPFQ+O1xuXG4gIGNvbnN0cnVjdG9yKG11bHRpcGxleGVyOiBPYnNlcnZlTXVsdGlwbGV4ZXIsIGNhbGxiYWNrczogUmVjb3JkPE9ic2VydmVIYW5kbGVDYWxsYmFjaywgQ2FsbGJhY2s8VD4+LCBub25NdXRhdGluZ0NhbGxiYWNrczogYm9vbGVhbikge1xuICAgIHRoaXMuX211bHRpcGxleGVyID0gbXVsdGlwbGV4ZXI7XG5cbiAgICBtdWx0aXBsZXhlci5jYWxsYmFja05hbWVzKCkuZm9yRWFjaCgobmFtZTogT2JzZXJ2ZUhhbmRsZUNhbGxiYWNrKSA9PiB7XG4gICAgICBpZiAoY2FsbGJhY2tzW25hbWVdKSB7XG4gICAgICAgIHRoaXNbYF8ke25hbWV9YCBhcyBPYnNlcnZlSGFuZGxlQ2FsbGJhY2tJbnRlcm5hbF0gPSBjYWxsYmFja3NbbmFtZV07XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKG5hbWUgPT09IFwiYWRkZWRCZWZvcmVcIiAmJiBjYWxsYmFja3MuYWRkZWQpIHtcbiAgICAgICAgdGhpcy5fYWRkZWRCZWZvcmUgPSBhc3luYyBmdW5jdGlvbiAoaWQsIGZpZWxkcywgYmVmb3JlKSB7XG4gICAgICAgICAgYXdhaXQgY2FsbGJhY2tzLmFkZGVkKGlkLCBmaWVsZHMpO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5fc3RvcHBlZCA9IGZhbHNlO1xuICAgIHRoaXMuX2lkID0gbmV4dE9ic2VydmVIYW5kbGVJZCsrO1xuICAgIHRoaXMubm9uTXV0YXRpbmdDYWxsYmFja3MgPSBub25NdXRhdGluZ0NhbGxiYWNrcztcblxuICAgIHRoaXMuaW5pdGlhbEFkZHNTZW50ID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICBjb25zdCByZWFkeSA9ICgpID0+IHtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB0aGlzLmluaXRpYWxBZGRzU2VudCA9IFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dChyZWFkeSwgMzAwMDApXG5cbiAgICAgIHRoaXMuaW5pdGlhbEFkZHNTZW50UmVzb2x2ZXIgPSAoKSA9PiB7XG4gICAgICAgIHJlYWR5KCk7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVXNpbmcgcHJvcGVydHkgc3ludGF4IGFuZCBhcnJvdyBmdW5jdGlvbiBzeW50YXggdG8gYXZvaWQgYmluZGluZyB0aGUgd3JvbmcgY29udGV4dCBvbiBjYWxsYmFja3MuXG4gICAqL1xuICBzdG9wID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmICh0aGlzLl9zdG9wcGVkKSByZXR1cm47XG4gICAgdGhpcy5fc3RvcHBlZCA9IHRydWU7XG4gICAgYXdhaXQgdGhpcy5fbXVsdGlwbGV4ZXIucmVtb3ZlSGFuZGxlKHRoaXMuX2lkKTtcbiAgfVxufSJdfQ==
