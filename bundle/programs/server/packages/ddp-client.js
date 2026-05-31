Package["core-runtime"].queue("ddp-client",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Retry = Package.retry.Retry;
var IdMap = Package['id-map'].IdMap;
var ECMAScript = Package.ecmascript.ECMAScript;
var Hook = Package['callback-hook'].Hook;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var DDP;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-client":{"server":{"server.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/ddp-client/server/server.js                                                                           //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("../common/namespace.js", {
      DDP: "DDP"
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"common":{"connection_stream_handlers.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/ddp-client/common/connection_stream_handlers.js                                                       //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      ConnectionStreamHandlers: () => ConnectionStreamHandlers
    });
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class ConnectionStreamHandlers {
      constructor(connection) {
        this._connection = connection;
      }

      /**
       * Handles incoming raw messages from the DDP stream
       * @param {String} raw_msg The raw message received from the stream
       */
      async onMessage(raw_msg) {
        let msg;
        try {
          msg = DDPCommon.parseDDP(raw_msg);
        } catch (e) {
          Meteor._debug('Exception while parsing DDP', e);
          return;
        }

        // Any message counts as receiving a pong, as it demonstrates that
        // the server is still alive.
        if (this._connection._heartbeat) {
          this._connection._heartbeat.messageReceived();
        }
        if (msg === null || !msg.msg) {
          if (!msg || !msg.testMessageOnConnect) {
            if (Object.keys(msg).length === 1 && msg.server_id) return;
            Meteor._debug('discarding invalid livedata message', msg);
          }
          return;
        }

        // Important: This was missing from previous version
        // We need to set the current version before routing the message
        if (msg.msg === 'connected') {
          this._connection._version = this._connection._versionSuggestion;
        }
        await this._routeMessage(msg);
      }

      /**
       * Routes messages to their appropriate handlers based on message type
       * @private
       * @param {Object} msg The parsed DDP message
       */
      async _routeMessage(msg) {
        switch (msg.msg) {
          case 'connected':
            await this._connection._livedata_connected(msg);
            this._connection.options.onConnected();
            break;
          case 'failed':
            await this._handleFailedMessage(msg);
            break;
          case 'ping':
            if (this._connection.options.respondToPings) {
              this._connection._send({
                msg: 'pong',
                id: msg.id
              });
            }
            break;
          case 'pong':
            // noop, as we assume everything's a pong
            break;
          case 'added':
          case 'changed':
          case 'removed':
          case 'ready':
          case 'updated':
            await this._connection._livedata_data(msg);
            break;
          case 'nosub':
            await this._connection._livedata_nosub(msg);
            break;
          case 'result':
            await this._connection._livedata_result(msg);
            break;
          case 'error':
            this._connection._livedata_error(msg);
            break;
          default:
            Meteor._debug('discarding unknown livedata message type', msg);
        }
      }

      /**
       * Handles failed connection messages
       * @private
       * @param {Object} msg The failed message object
       */
      _handleFailedMessage(msg) {
        if (this._connection._supportedDDPVersions.indexOf(msg.version) >= 0) {
          this._connection._versionSuggestion = msg.version;
          this._connection._stream.reconnect({
            _force: true
          });
        } else {
          const description = 'DDP version negotiation failed; server requested version ' + msg.version;
          this._connection._stream.disconnect({
            _permanent: true,
            _error: description
          });
          this._connection.options.onDDPVersionNegotiationFailure(description);
        }
      }

      /**
       * Handles connection reset events
       */
      onReset() {
        // Reset is called even on the first connection, so this is
        // the only place we send this message.
        const msg = this._buildConnectMessage();
        this._connection._send(msg);

        // Mark non-retry calls as failed and handle outstanding methods
        this._handleOutstandingMethodsOnReset();

        // Now, to minimize setup latency, go ahead and blast out all of
        // our pending methods ands subscriptions before we've even taken
        // the necessary RTT to know if we successfully reconnected.
        this._connection._callOnReconnectAndSendAppropriateOutstandingMethods();
        this._resendSubscriptions();
      }

      /**
       * Builds the initial connect message
       * @private
       * @returns {Object} The connect message object
       */
      _buildConnectMessage() {
        const msg = {
          msg: 'connect'
        };
        if (this._connection._lastSessionId) {
          msg.session = this._connection._lastSessionId;
        }
        msg.version = this._connection._versionSuggestion || this._connection._supportedDDPVersions[0];
        this._connection._versionSuggestion = msg.version;
        msg.support = this._connection._supportedDDPVersions;
        return msg;
      }

      /**
       * Handles outstanding methods during a reset
       * @private
       */
      _handleOutstandingMethodsOnReset() {
        const blocks = this._connection._outstandingMethodBlocks;
        if (blocks.length === 0) return;
        const currentMethodBlock = blocks[0].methods;
        blocks[0].methods = currentMethodBlock.filter(methodInvoker => {
          // Methods with 'noRetry' option set are not allowed to re-send after
          // recovering dropped connection.
          if (methodInvoker.sentMessage && methodInvoker.noRetry) {
            methodInvoker.receiveResult(new Meteor.Error('invocation-failed', 'Method invocation might have failed due to dropped connection. ' + 'Failing because `noRetry` option was passed to Meteor.apply.'));
          }

          // Only keep a method if it wasn't sent or it's allowed to retry.
          return !(methodInvoker.sentMessage && methodInvoker.noRetry);
        });

        // Clear empty blocks
        if (blocks.length > 0 && blocks[0].methods.length === 0) {
          blocks.shift();
        }

        // Reset all method invokers as unsent
        Object.values(this._connection._methodInvokers).forEach(invoker => {
          invoker.sentMessage = false;
        });
      }

      /**
       * Resends all active subscriptions
       * @private
       */
      _resendSubscriptions() {
        Object.entries(this._connection._subscriptions).forEach(_ref => {
          let [id, sub] = _ref;
          this._connection._sendQueued({
            msg: 'sub',
            id: id,
            name: sub.name,
            params: sub.params
          });
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"document_processors.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/ddp-client/common/document_processors.js                                                              //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      DocumentProcessors: () => DocumentProcessors
    });
    let MongoID;
    module.link("meteor/mongo-id", {
      MongoID(v) {
        MongoID = v;
      }
    }, 0);
    let DiffSequence;
    module.link("meteor/diff-sequence", {
      DiffSequence(v) {
        DiffSequence = v;
      }
    }, 1);
    let hasOwn;
    module.link("meteor/ddp-common/utils", {
      hasOwn(v) {
        hasOwn = v;
      }
    }, 2);
    let isEmpty;
    module.link("meteor/ddp-common/utils", {
      isEmpty(v) {
        isEmpty = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class DocumentProcessors {
      constructor(connection) {
        this._connection = connection;
      }

      /**
       * @summary Process an 'added' message from the server
       * @param {Object} msg The added message
       * @param {Object} updates The updates accumulator
       */
      async _process_added(msg, updates) {
        const self = this._connection;
        const id = MongoID.idParse(msg.id);
        const serverDoc = self._getServerDoc(msg.collection, id);
        if (serverDoc) {
          // Some outstanding stub wrote here.
          const isExisting = serverDoc.document !== undefined;
          serverDoc.document = msg.fields || Object.create(null);
          serverDoc.document._id = id;
          if (self._resetStores) {
            // During reconnect the server is sending adds for existing ids.
            // Always push an update so that document stays in the store after
            // reset. Use current version of the document for this update, so
            // that stub-written values are preserved.
            const currentDoc = await self._stores[msg.collection].getDoc(msg.id);
            if (currentDoc !== undefined) msg.fields = currentDoc;
            self._pushUpdate(updates, msg.collection, msg);
          } else if (isExisting) {
            throw new Error('Server sent add for existing id: ' + msg.id);
          }
        } else {
          self._pushUpdate(updates, msg.collection, msg);
        }
      }

      /**
       * @summary Process a 'changed' message from the server
       * @param {Object} msg The changed message
       * @param {Object} updates The updates accumulator
       */
      _process_changed(msg, updates) {
        const self = this._connection;
        const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
        if (serverDoc) {
          if (serverDoc.document === undefined) {
            throw new Error('Server sent changed for nonexisting id: ' + msg.id);
          }
          DiffSequence.applyChanges(serverDoc.document, msg.fields);
        } else {
          self._pushUpdate(updates, msg.collection, msg);
        }
      }

      /**
       * @summary Process a 'removed' message from the server
       * @param {Object} msg The removed message
       * @param {Object} updates The updates accumulator
       */
      _process_removed(msg, updates) {
        const self = this._connection;
        const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
        if (serverDoc) {
          // Some outstanding stub wrote here.
          if (serverDoc.document === undefined) {
            throw new Error('Server sent removed for nonexisting id:' + msg.id);
          }
          serverDoc.document = undefined;
        } else {
          self._pushUpdate(updates, msg.collection, {
            msg: 'removed',
            collection: msg.collection,
            id: msg.id
          });
        }
      }

      /**
       * @summary Process a 'ready' message from the server
       * @param {Object} msg The ready message
       * @param {Object} updates The updates accumulator
       */
      _process_ready(msg, updates) {
        const self = this._connection;

        // Process "sub ready" messages. "sub ready" messages don't take effect
        // until all current server documents have been flushed to the local
        // database. We can use a write fence to implement this.
        msg.subs.forEach(subId => {
          self._runWhenAllServerDocsAreFlushed(() => {
            const subRecord = self._subscriptions[subId];
            // Did we already unsubscribe?
            if (!subRecord) return;
            // Did we already receive a ready message? (Oops!)
            if (subRecord.ready) return;
            subRecord.ready = true;
            subRecord.readyCallback && subRecord.readyCallback();
            subRecord.readyDeps.changed();
          });
        });
      }

      /**
       * @summary Process an 'updated' message from the server
       * @param {Object} msg The updated message
       * @param {Object} updates The updates accumulator
       */
      _process_updated(msg, updates) {
        const self = this._connection;
        // Process "method done" messages.
        msg.methods.forEach(methodId => {
          const docs = self._documentsWrittenByStub[methodId] || {};
          Object.values(docs).forEach(written => {
            const serverDoc = self._getServerDoc(written.collection, written.id);
            if (!serverDoc) {
              throw new Error('Lost serverDoc for ' + JSON.stringify(written));
            }
            if (!serverDoc.writtenByStubs[methodId]) {
              throw new Error('Doc ' + JSON.stringify(written) + ' not written by method ' + methodId);
            }
            delete serverDoc.writtenByStubs[methodId];
            if (isEmpty(serverDoc.writtenByStubs)) {
              // All methods whose stubs wrote this method have completed! We can
              // now copy the saved document to the database (reverting the stub's
              // change if the server did not write to this object, or applying the
              // server's writes if it did).

              // This is a fake ddp 'replace' message.  It's just for talking
              // between livedata connections and minimongo.  (We have to stringify
              // the ID because it's supposed to look like a wire message.)
              self._pushUpdate(updates, written.collection, {
                msg: 'replace',
                id: MongoID.idStringify(written.id),
                replace: serverDoc.document
              });
              // Call all flush callbacks.
              serverDoc.flushCallbacks.forEach(c => {
                c();
              });

              // Delete this completed serverDocument. Don't bother to GC empty
              // IdMaps inside self._serverDocuments, since there probably aren't
              // many collections and they'll be written repeatedly.
              self._serverDocuments[written.collection].remove(written.id);
            }
          });
          delete self._documentsWrittenByStub[methodId];

          // We want to call the data-written callback, but we can't do so until all
          // currently buffered messages are flushed.
          const callbackInvoker = self._methodInvokers[methodId];
          if (!callbackInvoker) {
            throw new Error('No callback invoker for method ' + methodId);
          }
          self._runWhenAllServerDocsAreFlushed(function () {
            return callbackInvoker.dataVisible(...arguments);
          });
        });
      }

      /**
       * @summary Push an update to the buffer
       * @private
       * @param {Object} updates The updates accumulator
       * @param {String} collection The collection name
       * @param {Object} msg The update message
       */
      _pushUpdate(updates, collection, msg) {
        if (!hasOwn.call(updates, collection)) {
          updates[collection] = [];
        }
        updates[collection].push(msg);
      }

      /**
       * @summary Get a server document by collection and id
       * @private
       * @param {String} collection The collection name
       * @param {String} id The document id
       * @returns {Object|null} The server document or null
       */
      _getServerDoc(collection, id) {
        const self = this._connection;
        if (!hasOwn.call(self._serverDocuments, collection)) {
          return null;
        }
        const serverDocsForCollection = self._serverDocuments[collection];
        return serverDocsForCollection.get(id) || null;
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_connection.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/ddp-client/common/livedata_connection.js                                                              //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 1);
    const _excluded = ["stubInvocation", "invocation"],
      _excluded2 = ["stubInvocation", "invocation"];
    module.export({
      Connection: () => Connection
    });
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 1);
    let Tracker;
    module.link("meteor/tracker", {
      Tracker(v) {
        Tracker = v;
      }
    }, 2);
    let EJSON;
    module.link("meteor/ejson", {
      EJSON(v) {
        EJSON = v;
      }
    }, 3);
    let Random;
    module.link("meteor/random", {
      Random(v) {
        Random = v;
      }
    }, 4);
    let MongoID;
    module.link("meteor/mongo-id", {
      MongoID(v) {
        MongoID = v;
      }
    }, 5);
    let DDP;
    module.link("./namespace.js", {
      DDP(v) {
        DDP = v;
      }
    }, 6);
    let MethodInvoker;
    module.link("./method_invoker", {
      MethodInvoker(v) {
        MethodInvoker = v;
      }
    }, 7);
    let hasOwn, slice, keys, isEmpty, last;
    module.link("meteor/ddp-common/utils", {
      hasOwn(v) {
        hasOwn = v;
      },
      slice(v) {
        slice = v;
      },
      keys(v) {
        keys = v;
      },
      isEmpty(v) {
        isEmpty = v;
      },
      last(v) {
        last = v;
      }
    }, 8);
    let ConnectionStreamHandlers;
    module.link("./connection_stream_handlers", {
      ConnectionStreamHandlers(v) {
        ConnectionStreamHandlers = v;
      }
    }, 9);
    let MongoIDMap;
    module.link("./mongo_id_map", {
      MongoIDMap(v) {
        MongoIDMap = v;
      }
    }, 10);
    let MessageProcessors;
    module.link("./message_processors", {
      MessageProcessors(v) {
        MessageProcessors = v;
      }
    }, 11);
    let DocumentProcessors;
    module.link("./document_processors", {
      DocumentProcessors(v) {
        DocumentProcessors = v;
      }
    }, 12);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class Connection {
      constructor(url, options) {
        const self = this;
        this.options = options = _objectSpread({
          onConnected() {},
          onDDPVersionNegotiationFailure(description) {
            Meteor._debug(description);
          },
          heartbeatInterval: 17500,
          heartbeatTimeout: 15000,
          npmFayeOptions: Object.create(null),
          // These options are only for testing.
          reloadWithOutstanding: false,
          supportedDDPVersions: DDPCommon.SUPPORTED_DDP_VERSIONS,
          retry: true,
          respondToPings: true,
          // When updates are coming within this ms interval, batch them together.
          bufferedWritesInterval: 5,
          // Flush buffers immediately if writes are happening continuously for more than this many ms.
          bufferedWritesMaxAge: 500
        }, options);

        // If set, called when we reconnect, queuing method calls _before_ the
        // existing outstanding ones.
        // NOTE: This feature has been preserved for backwards compatibility. The
        // preferred method of setting a callback on reconnect is to use
        // DDP.onReconnect.
        self.onReconnect = null;

        // as a test hook, allow passing a stream instead of a url.
        if (typeof url === 'object') {
          self._stream = url;
        } else {
          const {
            ClientStream
          } = require("meteor/socket-stream-client");
          self._stream = new ClientStream(url, {
            retry: options.retry,
            ConnectionError: DDP.ConnectionError,
            headers: options.headers,
            _sockjsOptions: options._sockjsOptions,
            // Used to keep some tests quiet, or for other cases in which
            // the right thing to do with connection errors is to silently
            // fail (e.g. sending package usage stats). At some point we
            // should have a real API for handling client-stream-level
            // errors.
            _dontPrintErrors: options._dontPrintErrors,
            connectTimeoutMs: options.connectTimeoutMs,
            npmFayeOptions: options.npmFayeOptions
          });
        }
        self._lastSessionId = null;
        self._versionSuggestion = null; // The last proposed DDP version.
        self._version = null; // The DDP version agreed on by client and server.
        self._stores = Object.create(null); // name -> object with methods
        self._methodHandlers = Object.create(null); // name -> func
        self._nextMethodId = 1;
        self._supportedDDPVersions = options.supportedDDPVersions;
        self._heartbeatInterval = options.heartbeatInterval;
        self._heartbeatTimeout = options.heartbeatTimeout;

        // Tracks methods which the user has tried to call but which have not yet
        // called their user callback (ie, they are waiting on their result or for all
        // of their writes to be written to the local cache). Map from method ID to
        // MethodInvoker object.
        self._methodInvokers = Object.create(null);

        // Tracks methods which the user has called but whose result messages have not
        // arrived yet.
        //
        // _outstandingMethodBlocks is an array of blocks of methods. Each block
        // represents a set of methods that can run at the same time. The first block
        // represents the methods which are currently in flight; subsequent blocks
        // must wait for previous blocks to be fully finished before they can be sent
        // to the server.
        //
        // Each block is an object with the following fields:
        // - methods: a list of MethodInvoker objects
        // - wait: a boolean; if true, this block had a single method invoked with
        //         the "wait" option
        //
        // There will never be adjacent blocks with wait=false, because the only thing
        // that makes methods need to be serialized is a wait method.
        //
        // Methods are removed from the first block when their "result" is
        // received. The entire first block is only removed when all of the in-flight
        // methods have received their results (so the "methods" list is empty) *AND*
        // all of the data written by those methods are visible in the local cache. So
        // it is possible for the first block's methods list to be empty, if we are
        // still waiting for some objects to quiesce.
        //
        // Example:
        //  _outstandingMethodBlocks = [
        //    {wait: false, methods: []},
        //    {wait: true, methods: [<MethodInvoker for 'login'>]},
        //    {wait: false, methods: [<MethodInvoker for 'foo'>,
        //                            <MethodInvoker for 'bar'>]}]
        // This means that there were some methods which were sent to the server and
        // which have returned their results, but some of the data written by
        // the methods may not be visible in the local cache. Once all that data is
        // visible, we will send a 'login' method. Once the login method has returned
        // and all the data is visible (including re-running subs if userId changes),
        // we will send the 'foo' and 'bar' methods in parallel.
        self._outstandingMethodBlocks = [];

        // method ID -> array of objects with keys 'collection' and 'id', listing
        // documents written by a given method's stub. keys are associated with
        // methods whose stub wrote at least one document, and whose data-done message
        // has not yet been received.
        self._documentsWrittenByStub = {};
        // collection -> IdMap of "server document" object. A "server document" has:
        // - "document": the version of the document according the
        //   server (ie, the snapshot before a stub wrote it, amended by any changes
        //   received from the server)
        //   It is undefined if we think the document does not exist
        // - "writtenByStubs": a set of method IDs whose stubs wrote to the document
        //   whose "data done" messages have not yet been processed
        self._serverDocuments = {};

        // Array of callbacks to be called after the next update of the local
        // cache. Used for:
        //  - Calling methodInvoker.dataVisible and sub ready callbacks after
        //    the relevant data is flushed.
        //  - Invoking the callbacks of "half-finished" methods after reconnect
        //    quiescence. Specifically, methods whose result was received over the old
        //    connection (so we don't re-send it) but whose data had not been made
        //    visible.
        self._afterUpdateCallbacks = [];

        // In two contexts, we buffer all incoming data messages and then process them
        // all at once in a single update:
        //   - During reconnect, we buffer all data messages until all subs that had
        //     been ready before reconnect are ready again, and all methods that are
        //     active have returned their "data done message"; then
        //   - During the execution of a "wait" method, we buffer all data messages
        //     until the wait method gets its "data done" message. (If the wait method
        //     occurs during reconnect, it doesn't get any special handling.)
        // all data messages are processed in one update.
        //
        // The following fields are used for this "quiescence" process.

        // This buffers the messages that aren't being processed yet.
        self._messagesBufferedUntilQuiescence = [];
        // Map from method ID -> true. Methods are removed from this when their
        // "data done" message is received, and we will not quiesce until it is
        // empty.
        self._methodsBlockingQuiescence = {};
        // map from sub ID -> true for subs that were ready (ie, called the sub
        // ready callback) before reconnect but haven't become ready again yet
        self._subsBeingRevived = {}; // map from sub._id -> true
        // if true, the next data update should reset all stores. (set during
        // reconnect.)
        self._resetStores = false;

        // name -> array of updates for (yet to be created) collections
        self._updatesForUnknownStores = {};
        // if we're blocking a migration, the retry func
        self._retryMigrate = null;
        // Collection name -> array of messages.
        self._bufferedWrites = {};
        // When current buffer of updates must be flushed at, in ms timestamp.
        self._bufferedWritesFlushAt = null;
        // Timeout handle for the next processing of all pending writes
        self._bufferedWritesFlushHandle = null;
        self._bufferedWritesInterval = options.bufferedWritesInterval;
        self._bufferedWritesMaxAge = options.bufferedWritesMaxAge;

        // metadata for subscriptions.  Map from sub ID to object with keys:
        //   - id
        //   - name
        //   - params
        //   - inactive (if true, will be cleaned up if not reused in re-run)
        //   - ready (has the 'ready' message been received?)
        //   - readyCallback (an optional callback to call when ready)
        //   - errorCallback (an optional callback to call if the sub terminates with
        //                    an error, XXX COMPAT WITH 1.0.3.1)
        //   - stopCallback (an optional callback to call when the sub terminates
        //     for any reason, with an error argument if an error triggered the stop)
        self._subscriptions = {};

        // Reactive userId.
        self._userId = null;
        self._userIdDeps = new Tracker.Dependency();

        // Block auto-reload while we're waiting for method responses.
        if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {
          Package.reload.Reload._onMigrate(retry => {
            if (!self._readyToMigrate()) {
              self._retryMigrate = retry;
              return [false];
            } else {
              return [true];
            }
          });
        }
        this._streamHandlers = new ConnectionStreamHandlers(this);
        const onDisconnect = () => {
          if (this._heartbeat) {
            this._heartbeat.stop();
            this._heartbeat = null;
          }
        };
        if (Meteor.isServer) {
          this._stream.on('message', Meteor.bindEnvironment(msg => this._streamHandlers.onMessage(msg), 'handling DDP message'));
          this._stream.on('reset', Meteor.bindEnvironment(() => this._streamHandlers.onReset(), 'handling DDP reset'));
          this._stream.on('disconnect', Meteor.bindEnvironment(onDisconnect, 'handling DDP disconnect'));
        } else {
          this._stream.on('message', msg => this._streamHandlers.onMessage(msg));
          this._stream.on('reset', () => this._streamHandlers.onReset());
          this._stream.on('disconnect', onDisconnect);
        }
        this._messageProcessors = new MessageProcessors(this);

        // Expose message processor methods to maintain backward compatibility
        this._livedata_connected = msg => this._messageProcessors._livedata_connected(msg);
        this._livedata_data = msg => this._messageProcessors._livedata_data(msg);
        this._livedata_nosub = msg => this._messageProcessors._livedata_nosub(msg);
        this._livedata_result = msg => this._messageProcessors._livedata_result(msg);
        this._livedata_error = msg => this._messageProcessors._livedata_error(msg);
        this._documentProcessors = new DocumentProcessors(this);

        // Expose document processor methods to maintain backward compatibility
        this._process_added = (msg, updates) => this._documentProcessors._process_added(msg, updates);
        this._process_changed = (msg, updates) => this._documentProcessors._process_changed(msg, updates);
        this._process_removed = (msg, updates) => this._documentProcessors._process_removed(msg, updates);
        this._process_ready = (msg, updates) => this._documentProcessors._process_ready(msg, updates);
        this._process_updated = (msg, updates) => this._documentProcessors._process_updated(msg, updates);

        // Also expose utility methods used by other parts of the system
        this._pushUpdate = (updates, collection, msg) => this._documentProcessors._pushUpdate(updates, collection, msg);
        this._getServerDoc = (collection, id) => this._documentProcessors._getServerDoc(collection, id);
      }

      // 'name' is the name of the data on the wire that should go in the
      // store. 'wrappedStore' should be an object with methods beginUpdate, update,
      // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.
      createStoreMethods(name, wrappedStore) {
        const self = this;
        if (name in self._stores) return false;

        // Wrap the input object in an object which makes any store method not
        // implemented by 'store' into a no-op.
        const store = Object.create(null);
        const keysOfStore = ['update', 'beginUpdate', 'endUpdate', 'saveOriginals', 'retrieveOriginals', 'getDoc', '_getCollection'];
        keysOfStore.forEach(method => {
          store[method] = function () {
            if (wrappedStore[method]) {
              return wrappedStore[method](...arguments);
            }
          };
        });
        self._stores[name] = store;
        return store;
      }
      registerStoreClient(name, wrappedStore) {
        const self = this;
        const store = self.createStoreMethods(name, wrappedStore);
        const queued = self._updatesForUnknownStores[name];
        if (Array.isArray(queued)) {
          store.beginUpdate(queued.length, false);
          queued.forEach(msg => {
            store.update(msg);
          });
          store.endUpdate();
          delete self._updatesForUnknownStores[name];
        }
        return true;
      }
      async registerStoreServer(name, wrappedStore) {
        const self = this;
        const store = self.createStoreMethods(name, wrappedStore);
        const queued = self._updatesForUnknownStores[name];
        if (Array.isArray(queued)) {
          await store.beginUpdate(queued.length, false);
          for (const msg of queued) {
            await store.update(msg);
          }
          await store.endUpdate();
          delete self._updatesForUnknownStores[name];
        }
        return true;
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.subscribe
       * @summary Subscribe to a record set.  Returns a handle that provides
       * `stop()` and `ready()` methods.
       * @locus Client
       * @param {String} name Name of the subscription.  Matches the name of the
       * server's `publish()` call.
       * @param {EJSONable} [arg1,arg2...] Optional arguments passed to publisher
       * function on server.
       * @param {Function|Object} [callbacks] Optional. May include `onStop`
       * and `onReady` callbacks. If there is an error, it is passed as an
       * argument to `onStop`. If a function is passed instead of an object, it
       * is interpreted as an `onReady` callback.
       */
      subscribe(name /* .. [arguments] .. (callback|callbacks) */) {
        const self = this;
        const params = slice.call(arguments, 1);
        let callbacks = Object.create(null);
        if (params.length) {
          const lastParam = params[params.length - 1];
          if (typeof lastParam === 'function') {
            callbacks.onReady = params.pop();
          } else if (lastParam && [lastParam.onReady,
          // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
          // onStop with an error callback instead.
          lastParam.onError, lastParam.onStop].some(f => typeof f === "function")) {
            callbacks = params.pop();
          }
        }

        // Is there an existing sub with the same name and param, run in an
        // invalidated Computation? This will happen if we are rerunning an
        // existing computation.
        //
        // For example, consider a rerun of:
        //
        //     Tracker.autorun(function () {
        //       Meteor.subscribe("foo", Session.get("foo"));
        //       Meteor.subscribe("bar", Session.get("bar"));
        //     });
        //
        // If "foo" has changed but "bar" has not, we will match the "bar"
        // subcribe to an existing inactive subscription in order to not
        // unsub and resub the subscription unnecessarily.
        //
        // We only look for one such sub; if there are N apparently-identical subs
        // being invalidated, we will require N matching subscribe calls to keep
        // them all active.
        const existing = Object.values(self._subscriptions).find(sub => sub.inactive && sub.name === name && EJSON.equals(sub.params, params));
        let id;
        if (existing) {
          id = existing.id;
          existing.inactive = false; // reactivate

          if (callbacks.onReady) {
            // If the sub is not already ready, replace any ready callback with the
            // one provided now. (It's not really clear what users would expect for
            // an onReady callback inside an autorun; the semantics we provide is
            // that at the time the sub first becomes ready, we call the last
            // onReady callback provided, if any.)
            // If the sub is already ready, run the ready callback right away.
            // It seems that users would expect an onReady callback inside an
            // autorun to trigger once the sub first becomes ready and also
            // when re-subs happens.
            if (existing.ready) {
              callbacks.onReady();
            } else {
              existing.readyCallback = callbacks.onReady;
            }
          }

          // XXX COMPAT WITH 1.0.3.1 we used to have onError but now we call
          // onStop with an optional error argument
          if (callbacks.onError) {
            // Replace existing callback if any, so that errors aren't
            // double-reported.
            existing.errorCallback = callbacks.onError;
          }
          if (callbacks.onStop) {
            existing.stopCallback = callbacks.onStop;
          }
        } else {
          // New sub! Generate an id, save it locally, and send message.
          id = Random.id();
          self._subscriptions[id] = {
            id: id,
            name: name,
            params: EJSON.clone(params),
            inactive: false,
            ready: false,
            readyDeps: new Tracker.Dependency(),
            readyCallback: callbacks.onReady,
            // XXX COMPAT WITH 1.0.3.1 #errorCallback
            errorCallback: callbacks.onError,
            stopCallback: callbacks.onStop,
            connection: self,
            remove() {
              delete this.connection._subscriptions[this.id];
              this.ready && this.readyDeps.changed();
            },
            stop() {
              this.connection._sendQueued({
                msg: 'unsub',
                id: id
              });
              this.remove();
              if (callbacks.onStop) {
                callbacks.onStop();
              }
            }
          };
          self._send({
            msg: 'sub',
            id: id,
            name: name,
            params: params
          });
        }

        // return a handle to the application.
        const handle = {
          stop() {
            if (!hasOwn.call(self._subscriptions, id)) {
              return;
            }
            self._subscriptions[id].stop();
          },
          ready() {
            // return false if we've unsubscribed.
            if (!hasOwn.call(self._subscriptions, id)) {
              return false;
            }
            const record = self._subscriptions[id];
            record.readyDeps.depend();
            return record.ready;
          },
          subscriptionId: id
        };
        if (Tracker.active) {
          // We're in a reactive computation, so we'd like to unsubscribe when the
          // computation is invalidated... but not if the rerun just re-subscribes
          // to the same subscription!  When a rerun happens, we use onInvalidate
          // as a change to mark the subscription "inactive" so that it can
          // be reused from the rerun.  If it isn't reused, it's killed from
          // an afterFlush.
          Tracker.onInvalidate(c => {
            if (hasOwn.call(self._subscriptions, id)) {
              self._subscriptions[id].inactive = true;
            }
            Tracker.afterFlush(() => {
              if (hasOwn.call(self._subscriptions, id) && self._subscriptions[id].inactive) {
                handle.stop();
              }
            });
          });
        }
        return handle;
      }

      /**
       * @summary Tells if the method call came from a call or a callAsync.
       * @alias Meteor.isAsyncCall
       * @locus Anywhere
       * @memberOf Meteor
       * @importFromPackage meteor
       * @returns boolean
       */
      isAsyncCall() {
        return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      }
      methods(methods) {
        Object.entries(methods).forEach(_ref => {
          let [name, func] = _ref;
          if (typeof func !== 'function') {
            throw new Error("Method '" + name + "' must be a function");
          }
          if (this._methodHandlers[name]) {
            throw new Error("A method named '" + name + "' is already defined");
          }
          this._methodHandlers[name] = func;
        });
      }
      _getIsSimulation(_ref2) {
        let {
          isFromCallAsync,
          alreadyInSimulation
        } = _ref2;
        if (!isFromCallAsync) {
          return alreadyInSimulation;
        }
        return alreadyInSimulation && DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.call
       * @summary Invokes a method with a sync stub, passing any number of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable} [arg1,arg2...] Optional method arguments
       * @param {Function} [asyncCallback] Optional callback, which is called asynchronously with the error or result after the method is complete. If not provided, the method runs synchronously if possible (see below).
       */
      call(name /* .. [arguments] .. callback */) {
        // if it's a function, the last argument is the result callback,
        // not a parameter to the remote method.
        const args = slice.call(arguments, 1);
        let callback;
        if (args.length && typeof args[args.length - 1] === 'function') {
          callback = args.pop();
        }
        return this.apply(name, args, callback);
      }
      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.callAsync
       * @summary Invokes a method with an async stub, passing any number of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable} [arg1,arg2...] Optional method arguments
       * @returns {Promise}
       */
      callAsync(name /* .. [arguments] .. */) {
        const args = slice.call(arguments, 1);
        if (args.length && typeof args[args.length - 1] === 'function') {
          throw new Error("Meteor.callAsync() does not accept a callback. You should 'await' the result, or use .then().");
        }
        return this.applyAsync(name, args, {
          returnServerResultPromise: true
        });
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.apply
       * @summary Invoke a method passing an array of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable[]} args Method arguments
       * @param {Object} [options]
       * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
       * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
       * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
       * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
       * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
       * @param {Function} [asyncCallback] Optional callback; same semantics as in [`Meteor.call`](#meteor_call).
       */
      apply(name, args, options, callback) {
        const _this$_stubCall = this._stubCall(name, EJSON.clone(args)),
          {
            stubInvocation,
            invocation
          } = _this$_stubCall,
          stubOptions = _objectWithoutProperties(_this$_stubCall, _excluded);
        if (stubOptions.hasStub) {
          if (!this._getIsSimulation({
            alreadyInSimulation: stubOptions.alreadyInSimulation,
            isFromCallAsync: stubOptions.isFromCallAsync
          })) {
            this._saveOriginals();
          }
          try {
            stubOptions.stubReturnValue = DDP._CurrentMethodInvocation.withValue(invocation, stubInvocation);
            if (Meteor._isPromise(stubOptions.stubReturnValue)) {
              Meteor._debug("Method ".concat(name, ": Calling a method that has an async method stub with call/apply can lead to unexpected behaviors. Use callAsync/applyAsync instead."));
            }
          } catch (e) {
            stubOptions.exception = e;
          }
        }
        return this._apply(name, stubOptions, args, options, callback);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.applyAsync
       * @summary Invoke a method passing an array of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable[]} args Method arguments
       * @param {Object} [options]
       * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
       * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
       * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
       * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
       * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
       * @param {Boolean} options.returnServerResultPromise (Client only) If true, the promise returned by applyAsync will resolve to the server's return value, rather than the stub's return value. This is useful when you want to ensure that the server's return value is used, even if the stub returns a promise. The same behavior as `callAsync`.
       */
      applyAsync(name, args, options) {
        let callback = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
        const stubPromise = this._applyAsyncStubInvocation(name, args, options);
        const promise = this._applyAsync({
          name,
          args,
          options,
          callback,
          stubPromise
        });
        if (Meteor.isClient) {
          // only return the stubReturnValue
          promise.stubPromise = stubPromise.then(o => {
            if (o.exception) {
              throw o.exception;
            }
            return o.stubReturnValue;
          });
          // this avoids attribute recursion
          promise.serverPromise = new Promise((resolve, reject) => promise.then(resolve).catch(reject));
        }
        return promise;
      }
      async _applyAsyncStubInvocation(name, args, options) {
        const _this$_stubCall2 = this._stubCall(name, EJSON.clone(args), options),
          {
            stubInvocation,
            invocation
          } = _this$_stubCall2,
          stubOptions = _objectWithoutProperties(_this$_stubCall2, _excluded2);
        if (stubOptions.hasStub) {
          if (!this._getIsSimulation({
            alreadyInSimulation: stubOptions.alreadyInSimulation,
            isFromCallAsync: stubOptions.isFromCallAsync
          })) {
            this._saveOriginals();
          }
          try {
            /*
             * The code below follows the same logic as the function withValues().
             *
             * But as the Meteor package is not compiled by ecmascript, it is unable to use newer syntax in the browser,
             * such as, the async/await.
             *
             * So, to keep supporting old browsers, like IE 11, we're creating the logic one level above.
             */
            const currentContext = DDP._CurrentMethodInvocation._setNewContextAndGetCurrent(invocation);
            try {
              stubOptions.stubReturnValue = await stubInvocation();
            } catch (e) {
              stubOptions.exception = e;
            } finally {
              DDP._CurrentMethodInvocation._set(currentContext);
            }
          } catch (e) {
            stubOptions.exception = e;
          }
        }
        return stubOptions;
      }
      async _applyAsync(_ref3) {
        let {
          name,
          args,
          options,
          callback,
          stubPromise
        } = _ref3;
        const stubOptions = await stubPromise;
        return this._apply(name, stubOptions, args, options, callback);
      }
      _apply(name, stubCallValue, args, options, callback) {
        const self = this;

        // We were passed 3 arguments. They may be either (name, args, options)
        // or (name, args, callback)
        if (!callback && typeof options === 'function') {
          callback = options;
          options = Object.create(null);
        }
        options = options || Object.create(null);
        if (callback) {
          // XXX would it be better form to do the binding in stream.on,
          // or caller, instead of here?
          // XXX improve error message (and how we report it)
          callback = Meteor.bindEnvironment(callback, "delivering result of invoking '" + name + "'");
        }
        const {
          hasStub,
          exception,
          stubReturnValue,
          alreadyInSimulation,
          randomSeed
        } = stubCallValue;

        // Keep our args safe from mutation (eg if we don't send the message for a
        // while because of a wait method).
        args = EJSON.clone(args);
        // If we're in a simulation, stop and return the result we have,
        // rather than going on to do an RPC. If there was no stub,
        // we'll end up returning undefined.
        if (this._getIsSimulation({
          alreadyInSimulation,
          isFromCallAsync: stubCallValue.isFromCallAsync
        })) {
          let result;
          if (callback) {
            callback(exception, stubReturnValue);
          } else {
            if (exception) throw exception;
            result = stubReturnValue;
          }
          return options._returnMethodInvoker ? {
            result
          } : result;
        }

        // We only create the methodId here because we don't actually need one if
        // we're already in a simulation
        const methodId = '' + self._nextMethodId++;
        if (hasStub) {
          self._retrieveAndStoreOriginals(methodId);
        }

        // Generate the DDP message for the method call. Note that on the client,
        // it is important that the stub have finished before we send the RPC, so
        // that we know we have a complete list of which local documents the stub
        // wrote.
        const message = {
          msg: 'method',
          id: methodId,
          method: name,
          params: args
        };

        // If an exception occurred in a stub, and we're ignoring it
        // because we're doing an RPC and want to use what the server
        // returns instead, log it so the developer knows
        // (unless they explicitly ask to see the error).
        //
        // Tests can set the '_expectedByTest' flag on an exception so it won't
        // go to log.
        if (exception) {
          if (options.throwStubExceptions) {
            throw exception;
          } else if (!exception._expectedByTest) {
            Meteor._debug("Exception while simulating the effect of invoking '" + name + "'", exception);
          }
        }

        // At this point we're definitely doing an RPC, and we're going to
        // return the value of the RPC to the caller.

        // If the caller didn't give a callback, decide what to do.
        let promise;
        if (!callback) {
          if (Meteor.isClient && !options.returnServerResultPromise && (!options.isFromCallAsync || options.returnStubValue)) {
            callback = err => {
              err && Meteor._debug("Error invoking Method '" + name + "'", err);
            };
          } else {
            promise = new Promise((resolve, reject) => {
              callback = function () {
                for (var _len = arguments.length, allArgs = new Array(_len), _key = 0; _key < _len; _key++) {
                  allArgs[_key] = arguments[_key];
                }
                let args = Array.from(allArgs);
                let err = args.shift();
                if (err) {
                  reject(err);
                  return;
                }
                resolve(...args);
              };
            });
          }
        }

        // Send the randomSeed only if we used it
        if (randomSeed.value !== null) {
          message.randomSeed = randomSeed.value;
        }
        const methodInvoker = new MethodInvoker({
          methodId,
          callback: callback,
          connection: self,
          onResultReceived: options.onResultReceived,
          wait: !!options.wait,
          message: message,
          noRetry: !!options.noRetry
        });
        let result;
        if (promise) {
          result = options.returnStubValue ? promise.then(() => stubReturnValue) : promise;
        } else {
          result = options.returnStubValue ? stubReturnValue : undefined;
        }
        if (options._returnMethodInvoker) {
          return {
            methodInvoker,
            result
          };
        }
        self._addOutstandingMethod(methodInvoker, options);
        return result;
      }
      _stubCall(name, args, options) {
        // Run the stub, if we have one. The stub is supposed to make some
        // temporary writes to the database to give the user a smooth experience
        // until the actual result of executing the method comes back from the
        // server (whereupon the temporary writes to the database will be reversed
        // during the beginUpdate/endUpdate process.)
        //
        // Normally, we ignore the return value of the stub (even if it is an
        // exception), in favor of the real return value from the server. The
        // exception is if the *caller* is a stub. In that case, we're not going
        // to do a RPC, so we use the return value of the stub as our return
        // value.
        const self = this;
        const enclosing = DDP._CurrentMethodInvocation.get();
        const stub = self._methodHandlers[name];
        const alreadyInSimulation = enclosing === null || enclosing === void 0 ? void 0 : enclosing.isSimulation;
        const isFromCallAsync = enclosing === null || enclosing === void 0 ? void 0 : enclosing._isFromCallAsync;
        const randomSeed = {
          value: null
        };
        const defaultReturn = {
          alreadyInSimulation,
          randomSeed,
          isFromCallAsync
        };
        if (!stub) {
          return _objectSpread(_objectSpread({}, defaultReturn), {}, {
            hasStub: false
          });
        }

        // Lazily generate a randomSeed, only if it is requested by the stub.
        // The random streams only have utility if they're used on both the client
        // and the server; if the client doesn't generate any 'random' values
        // then we don't expect the server to generate any either.
        // Less commonly, the server may perform different actions from the client,
        // and may in fact generate values where the client did not, but we don't
        // have any client-side values to match, so even here we may as well just
        // use a random seed on the server.  In that case, we don't pass the
        // randomSeed to save bandwidth, and we don't even generate it to save a
        // bit of CPU and to avoid consuming entropy.

        const randomSeedGenerator = () => {
          if (randomSeed.value === null) {
            randomSeed.value = DDPCommon.makeRpcSeed(enclosing, name);
          }
          return randomSeed.value;
        };
        const setUserId = userId => {
          self.setUserId(userId);
        };
        const invocation = new DDPCommon.MethodInvocation({
          name,
          isSimulation: true,
          userId: self.userId(),
          isFromCallAsync: options === null || options === void 0 ? void 0 : options.isFromCallAsync,
          setUserId: setUserId,
          randomSeed() {
            return randomSeedGenerator();
          }
        });

        // Note that unlike in the corresponding server code, we never audit
        // that stubs check() their arguments.
        const stubInvocation = () => {
          if (Meteor.isServer) {
            // Because saveOriginals and retrieveOriginals aren't reentrant,
            // don't allow stubs to yield.
            return Meteor._noYieldsAllowed(() => {
              // re-clone, so that the stub can't affect our caller's values
              return stub.apply(invocation, EJSON.clone(args));
            });
          } else {
            return stub.apply(invocation, EJSON.clone(args));
          }
        };
        return _objectSpread(_objectSpread({}, defaultReturn), {}, {
          hasStub: true,
          stubInvocation,
          invocation
        });
      }

      // Before calling a method stub, prepare all stores to track changes and allow
      // _retrieveAndStoreOriginals to get the original versions of changed
      // documents.
      _saveOriginals() {
        if (!this._waitingForQuiescence()) {
          this._flushBufferedWrites();
        }
        Object.values(this._stores).forEach(store => {
          store.saveOriginals();
        });
      }

      // Retrieves the original versions of all documents modified by the stub for
      // method 'methodId' from all stores and saves them to _serverDocuments (keyed
      // by document) and _documentsWrittenByStub (keyed by method ID).
      _retrieveAndStoreOriginals(methodId) {
        const self = this;
        if (self._documentsWrittenByStub[methodId]) throw new Error('Duplicate methodId in _retrieveAndStoreOriginals');
        const docsWritten = [];
        Object.entries(self._stores).forEach(_ref4 => {
          let [collection, store] = _ref4;
          const originals = store.retrieveOriginals();
          // not all stores define retrieveOriginals
          if (!originals) return;
          originals.forEach((doc, id) => {
            docsWritten.push({
              collection,
              id
            });
            if (!hasOwn.call(self._serverDocuments, collection)) {
              self._serverDocuments[collection] = new MongoIDMap();
            }
            const serverDoc = self._serverDocuments[collection].setDefault(id, Object.create(null));
            if (serverDoc.writtenByStubs) {
              // We're not the first stub to write this doc. Just add our method ID
              // to the record.
              serverDoc.writtenByStubs[methodId] = true;
            } else {
              // First stub! Save the original value and our method ID.
              serverDoc.document = doc;
              serverDoc.flushCallbacks = [];
              serverDoc.writtenByStubs = Object.create(null);
              serverDoc.writtenByStubs[methodId] = true;
            }
          });
        });
        if (!isEmpty(docsWritten)) {
          self._documentsWrittenByStub[methodId] = docsWritten;
        }
      }

      // This is very much a private function we use to make the tests
      // take up fewer server resources after they complete.
      _unsubscribeAll() {
        Object.values(this._subscriptions).forEach(sub => {
          // Avoid killing the autoupdate subscription so that developers
          // still get hot code pushes when writing tests.
          //
          // XXX it's a hack to encode knowledge about autoupdate here,
          // but it doesn't seem worth it yet to have a special API for
          // subscriptions to preserve after unit tests.
          if (sub.name !== 'meteor_autoupdate_clientVersions') {
            sub.stop();
          }
        });
      }

      // Sends the DDP stringification of the given message object
      _send(obj) {
        this._stream.send(DDPCommon.stringifyDDP(obj));
      }

      // Always queues the call before sending the message
      // Used, for example, on subscription.[id].stop() to make sure a "sub" message is always called before an "unsub" message
      // https://github.com/meteor/meteor/issues/13212
      //
      // This is part of the actual fix for the rest check:
      // https://github.com/meteor/meteor/pull/13236
      _sendQueued(obj) {
        this._send(obj, true);
      }

      // We detected via DDP-level heartbeats that we've lost the
      // connection.  Unlike `disconnect` or `close`, a lost connection
      // will be automatically retried.
      _lostConnection(error) {
        this._stream._lostConnection(error);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.status
       * @summary Get the current connection status. A reactive data source.
       * @locus Client
       */
      status() {
        return this._stream.status(...arguments);
      }

      /**
       * @summary Force an immediate reconnection attempt if the client is not connected to the server.
       This method does nothing if the client is already connected.
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.reconnect
       * @locus Client
       */
      reconnect() {
        return this._stream.reconnect(...arguments);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.disconnect
       * @summary Disconnect the client from the server.
       * @locus Client
       */
      disconnect() {
        return this._stream.disconnect(...arguments);
      }
      close() {
        return this._stream.disconnect({
          _permanent: true
        });
      }

      ///
      /// Reactive user system
      ///
      userId() {
        if (this._userIdDeps) this._userIdDeps.depend();
        return this._userId;
      }
      setUserId(userId) {
        // Avoid invalidating dependents if setUserId is called with current value.
        if (this._userId === userId) return;
        this._userId = userId;
        if (this._userIdDeps) this._userIdDeps.changed();
      }

      // Returns true if we are in a state after reconnect of waiting for subs to be
      // revived or early methods to finish their data, or we are waiting for a
      // "wait" method to finish.
      _waitingForQuiescence() {
        return !isEmpty(this._subsBeingRevived) || !isEmpty(this._methodsBlockingQuiescence);
      }

      // Returns true if any method whose message has been sent to the server has
      // not yet invoked its user callback.
      _anyMethodsAreOutstanding() {
        const invokers = this._methodInvokers;
        return Object.values(invokers).some(invoker => !!invoker.sentMessage);
      }
      _prepareBuffersToFlush() {
        const self = this;
        if (self._bufferedWritesFlushHandle) {
          clearTimeout(self._bufferedWritesFlushHandle);
          self._bufferedWritesFlushHandle = null;
        }
        self._bufferedWritesFlushAt = null;
        // We need to clear the buffer before passing it to
        //  performWrites. As there's no guarantee that it
        //  will exit cleanly.
        const writes = self._bufferedWrites;
        self._bufferedWrites = Object.create(null);
        return writes;
      }

      /**
       * Server-side store updates handled asynchronously
       * @private
       */
      async _performWritesServer(updates) {
        const self = this;
        if (self._resetStores || !isEmpty(updates)) {
          // Start all store updates - keeping original loop structure
          for (const store of Object.values(self._stores)) {
            var _updates$store$_name;
            await store.beginUpdate(((_updates$store$_name = updates[store._name]) === null || _updates$store$_name === void 0 ? void 0 : _updates$store$_name.length) || 0, self._resetStores);
          }
          self._resetStores = false;

          // Process each store's updates sequentially as before
          for (const [storeName, messages] of Object.entries(updates)) {
            const store = self._stores[storeName];
            if (store) {
              // Batch each store's messages in modest chunks to prevent event loop blocking
              // while maintaining operation order
              const CHUNK_SIZE = 100;
              for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
                const chunk = messages.slice(i, Math.min(i + CHUNK_SIZE, messages.length));
                for (const msg of chunk) {
                  await store.update(msg);
                }
                await new Promise(resolve => process.nextTick(resolve));
              }
            } else {
              // Queue updates for uninitialized stores
              self._updatesForUnknownStores[storeName] = self._updatesForUnknownStores[storeName] || [];
              self._updatesForUnknownStores[storeName].push(...messages);
            }
          }

          // Complete all updates
          for (const store of Object.values(self._stores)) {
            await store.endUpdate();
          }
        }
        self._runAfterUpdateCallbacks();
      }

      /**
       * Client-side store updates handled synchronously for optimistic UI
       * @private
       */
      _performWritesClient(updates) {
        const self = this;
        if (self._resetStores || !isEmpty(updates)) {
          // Synchronous store updates for client
          Object.values(self._stores).forEach(store => {
            var _updates$store$_name2;
            store.beginUpdate(((_updates$store$_name2 = updates[store._name]) === null || _updates$store$_name2 === void 0 ? void 0 : _updates$store$_name2.length) || 0, self._resetStores);
          });
          self._resetStores = false;
          Object.entries(updates).forEach(_ref5 => {
            let [storeName, messages] = _ref5;
            const store = self._stores[storeName];
            if (store) {
              messages.forEach(msg => store.update(msg));
            } else {
              self._updatesForUnknownStores[storeName] = self._updatesForUnknownStores[storeName] || [];
              self._updatesForUnknownStores[storeName].push(...messages);
            }
          });
          Object.values(self._stores).forEach(store => store.endUpdate());
        }
        self._runAfterUpdateCallbacks();
      }

      /**
       * Executes buffered writes either synchronously (client) or async (server)
       * @private
       */
      async _flushBufferedWrites() {
        const self = this;
        const writes = self._prepareBuffersToFlush();
        return Meteor.isClient ? self._performWritesClient(writes) : self._performWritesServer(writes);
      }

      // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose
      // relevant docs have been flushed, as well as dataVisible callbacks at
      // reconnect-quiescence time.
      _runAfterUpdateCallbacks() {
        const self = this;
        const callbacks = self._afterUpdateCallbacks;
        self._afterUpdateCallbacks = [];
        callbacks.forEach(c => {
          c();
        });
      }

      // Ensures that "f" will be called after all documents currently in
      // _serverDocuments have been written to the local cache. f will not be called
      // if the connection is lost before then!
      _runWhenAllServerDocsAreFlushed(f) {
        const self = this;
        const runFAfterUpdates = () => {
          self._afterUpdateCallbacks.push(f);
        };
        let unflushedServerDocCount = 0;
        const onServerDocFlush = () => {
          --unflushedServerDocCount;
          if (unflushedServerDocCount === 0) {
            // This was the last doc to flush! Arrange to run f after the updates
            // have been applied.
            runFAfterUpdates();
          }
        };
        Object.values(self._serverDocuments).forEach(serverDocuments => {
          serverDocuments.forEach(serverDoc => {
            const writtenByStubForAMethodWithSentMessage = keys(serverDoc.writtenByStubs).some(methodId => {
              const invoker = self._methodInvokers[methodId];
              return invoker && invoker.sentMessage;
            });
            if (writtenByStubForAMethodWithSentMessage) {
              ++unflushedServerDocCount;
              serverDoc.flushCallbacks.push(onServerDocFlush);
            }
          });
        });
        if (unflushedServerDocCount === 0) {
          // There aren't any buffered docs --- we can call f as soon as the current
          // round of updates is applied!
          runFAfterUpdates();
        }
      }
      _addOutstandingMethod(methodInvoker, options) {
        if (options !== null && options !== void 0 && options.wait) {
          // It's a wait method! Wait methods go in their own block.
          this._outstandingMethodBlocks.push({
            wait: true,
            methods: [methodInvoker]
          });
        } else {
          // Not a wait method. Start a new block if the previous block was a wait
          // block, and add it to the last block of methods.
          if (isEmpty(this._outstandingMethodBlocks) || last(this._outstandingMethodBlocks).wait) {
            this._outstandingMethodBlocks.push({
              wait: false,
              methods: []
            });
          }
          last(this._outstandingMethodBlocks).methods.push(methodInvoker);
        }

        // If we added it to the first block, send it out now.
        if (this._outstandingMethodBlocks.length === 1) {
          methodInvoker.sendMessage();
        }
      }

      // Called by MethodInvoker after a method's callback is invoked.  If this was
      // the last outstanding method in the current block, runs the next block. If
      // there are no more methods, consider accepting a hot code push.
      _outstandingMethodFinished() {
        const self = this;
        if (self._anyMethodsAreOutstanding()) return;

        // No methods are outstanding. This should mean that the first block of
        // methods is empty. (Or it might not exist, if this was a method that
        // half-finished before disconnect/reconnect.)
        if (!isEmpty(self._outstandingMethodBlocks)) {
          const firstBlock = self._outstandingMethodBlocks.shift();
          if (!isEmpty(firstBlock.methods)) throw new Error('No methods outstanding but nonempty block: ' + JSON.stringify(firstBlock));

          // Send the outstanding methods now in the first block.
          if (!isEmpty(self._outstandingMethodBlocks)) self._sendOutstandingMethods();
        }

        // Maybe accept a hot code push.
        self._maybeMigrate();
      }

      // Sends messages for all the methods in the first block in
      // _outstandingMethodBlocks.
      _sendOutstandingMethods() {
        const self = this;
        if (isEmpty(self._outstandingMethodBlocks)) {
          return;
        }
        self._outstandingMethodBlocks[0].methods.forEach(m => {
          m.sendMessage();
        });
      }
      _sendOutstandingMethodBlocksMessages(oldOutstandingMethodBlocks) {
        const self = this;
        if (isEmpty(oldOutstandingMethodBlocks)) return;

        // We have at least one block worth of old outstanding methods to try
        // again. First: did onReconnect actually send anything? If not, we just
        // restore all outstanding methods and run the first block.
        if (isEmpty(self._outstandingMethodBlocks)) {
          self._outstandingMethodBlocks = oldOutstandingMethodBlocks;
          self._sendOutstandingMethods();
          return;
        }

        // OK, there are blocks on both sides. Special case: merge the last block of
        // the reconnect methods with the first block of the original methods, if
        // neither of them are "wait" blocks.
        if (!last(self._outstandingMethodBlocks).wait && !oldOutstandingMethodBlocks[0].wait) {
          oldOutstandingMethodBlocks[0].methods.forEach(m => {
            last(self._outstandingMethodBlocks).methods.push(m);

            // If this "last block" is also the first block, send the message.
            if (self._outstandingMethodBlocks.length === 1) {
              m.sendMessage();
            }
          });
          oldOutstandingMethodBlocks.shift();
        }

        // Now add the rest of the original blocks on.
        self._outstandingMethodBlocks.push(...oldOutstandingMethodBlocks);
      }
      _callOnReconnectAndSendAppropriateOutstandingMethods() {
        const self = this;
        const oldOutstandingMethodBlocks = self._outstandingMethodBlocks;
        self._outstandingMethodBlocks = [];
        self.onReconnect && self.onReconnect();
        DDP._reconnectHook.each(callback => {
          callback(self);
          return true;
        });
        self._sendOutstandingMethodBlocksMessages(oldOutstandingMethodBlocks);
      }

      // We can accept a hot code push if there are no methods in flight.
      _readyToMigrate() {
        return isEmpty(this._methodInvokers);
      }

      // If we were blocking a migration, see if it's now possible to continue.
      // Call whenever the set of outstanding/blocked methods shrinks.
      _maybeMigrate() {
        const self = this;
        if (self._retryMigrate && self._readyToMigrate()) {
          self._retryMigrate();
          self._retryMigrate = null;
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"message_processors.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/ddp-client/common/message_processors.js                                                               //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      MessageProcessors: () => MessageProcessors
    });
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 1);
    let DDP;
    module.link("./namespace.js", {
      DDP(v) {
        DDP = v;
      }
    }, 2);
    let EJSON;
    module.link("meteor/ejson", {
      EJSON(v) {
        EJSON = v;
      }
    }, 3);
    let isEmpty, hasOwn;
    module.link("meteor/ddp-common/utils", {
      isEmpty(v) {
        isEmpty = v;
      },
      hasOwn(v) {
        hasOwn = v;
      }
    }, 4);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class MessageProcessors {
      constructor(connection) {
        this._connection = connection;
      }

      /**
       * @summary Process the connection message and set up the session
       * @param {Object} msg The connection message
       */
      async _livedata_connected(msg) {
        const self = this._connection;
        if (self._version !== 'pre1' && self._heartbeatInterval !== 0) {
          self._heartbeat = new DDPCommon.Heartbeat({
            heartbeatInterval: self._heartbeatInterval,
            heartbeatTimeout: self._heartbeatTimeout,
            onTimeout() {
              self._lostConnection(new DDP.ConnectionError('DDP heartbeat timed out'));
            },
            sendPing() {
              self._send({
                msg: 'ping'
              });
            }
          });
          self._heartbeat.start();
        }

        // If this is a reconnect, we'll have to reset all stores.
        if (self._lastSessionId) self._resetStores = true;
        let reconnectedToPreviousSession;
        if (typeof msg.session === 'string') {
          reconnectedToPreviousSession = self._lastSessionId === msg.session;
          self._lastSessionId = msg.session;
        }
        if (reconnectedToPreviousSession) {
          // Successful reconnection -- pick up where we left off.
          return;
        }

        // Server doesn't have our data anymore. Re-sync a new session.

        // Forget about messages we were buffering for unknown collections. They'll
        // be resent if still relevant.
        self._updatesForUnknownStores = Object.create(null);
        if (self._resetStores) {
          // Forget about the effects of stubs. We'll be resetting all collections
          // anyway.
          self._documentsWrittenByStub = Object.create(null);
          self._serverDocuments = Object.create(null);
        }

        // Clear _afterUpdateCallbacks.
        self._afterUpdateCallbacks = [];

        // Mark all named subscriptions which are ready as needing to be revived.
        self._subsBeingRevived = Object.create(null);
        Object.entries(self._subscriptions).forEach(_ref => {
          let [id, sub] = _ref;
          if (sub.ready) {
            self._subsBeingRevived[id] = true;
          }
        });

        // Arrange for "half-finished" methods to have their callbacks run, and
        // track methods that were sent on this connection so that we don't
        // quiesce until they are all done.
        //
        // Start by clearing _methodsBlockingQuiescence: methods sent before
        // reconnect don't matter, and any "wait" methods sent on the new connection
        // that we drop here will be restored by the loop below.
        self._methodsBlockingQuiescence = Object.create(null);
        if (self._resetStores) {
          const invokers = self._methodInvokers;
          Object.keys(invokers).forEach(id => {
            const invoker = invokers[id];
            if (invoker.gotResult()) {
              // This method already got its result, but it didn't call its callback
              // because its data didn't become visible. We did not resend the
              // method RPC. We'll call its callback when we get a full quiesce,
              // since that's as close as we'll get to "data must be visible".
              self._afterUpdateCallbacks.push(function () {
                return invoker.dataVisible(...arguments);
              });
            } else if (invoker.sentMessage) {
              // This method has been sent on this connection (maybe as a resend
              // from the last connection, maybe from onReconnect, maybe just very
              // quickly before processing the connected message).
              //
              // We don't need to do anything special to ensure its callbacks get
              // called, but we'll count it as a method which is preventing
              // reconnect quiescence. (eg, it might be a login method that was run
              // from onReconnect, and we don't want to see flicker by seeing a
              // logged-out state.)
              self._methodsBlockingQuiescence[invoker.methodId] = true;
            }
          });
        }
        self._messagesBufferedUntilQuiescence = [];

        // If we're not waiting on any methods or subs, we can reset the stores and
        // call the callbacks immediately.
        if (!self._waitingForQuiescence()) {
          if (self._resetStores) {
            for (const store of Object.values(self._stores)) {
              await store.beginUpdate(0, true);
              await store.endUpdate();
            }
            self._resetStores = false;
          }
          self._runAfterUpdateCallbacks();
        }
      }

      /**
       * @summary Process various data messages from the server
       * @param {Object} msg The data message
       */
      async _livedata_data(msg) {
        const self = this._connection;
        if (self._waitingForQuiescence()) {
          self._messagesBufferedUntilQuiescence.push(msg);
          if (msg.msg === 'nosub') {
            delete self._subsBeingRevived[msg.id];
          }
          if (msg.subs) {
            msg.subs.forEach(subId => {
              delete self._subsBeingRevived[subId];
            });
          }
          if (msg.methods) {
            msg.methods.forEach(methodId => {
              delete self._methodsBlockingQuiescence[methodId];
            });
          }
          if (self._waitingForQuiescence()) {
            return;
          }

          // No methods or subs are blocking quiescence!
          // We'll now process and all of our buffered messages, reset all stores,
          // and apply them all at once.
          const bufferedMessages = self._messagesBufferedUntilQuiescence;
          for (const bufferedMessage of Object.values(bufferedMessages)) {
            await this._processOneDataMessage(bufferedMessage, self._bufferedWrites);
          }
          self._messagesBufferedUntilQuiescence = [];
        } else {
          await this._processOneDataMessage(msg, self._bufferedWrites);
        }

        // Immediately flush writes when:
        //  1. Buffering is disabled. Or;
        //  2. any non-(added/changed/removed) message arrives.
        const standardWrite = msg.msg === "added" || msg.msg === "changed" || msg.msg === "removed";
        if (self._bufferedWritesInterval === 0 || !standardWrite) {
          await self._flushBufferedWrites();
          return;
        }
        if (self._bufferedWritesFlushAt === null) {
          self._bufferedWritesFlushAt = new Date().valueOf() + self._bufferedWritesMaxAge;
        } else if (self._bufferedWritesFlushAt < new Date().valueOf()) {
          await self._flushBufferedWrites();
          return;
        }
        if (self._bufferedWritesFlushHandle) {
          clearTimeout(self._bufferedWritesFlushHandle);
        }
        self._bufferedWritesFlushHandle = setTimeout(() => {
          self._liveDataWritesPromise = self._flushBufferedWrites();
          if (Meteor._isPromise(self._liveDataWritesPromise)) {
            self._liveDataWritesPromise.finally(() => self._liveDataWritesPromise = undefined);
          }
        }, self._bufferedWritesInterval);
      }

      /**
       * @summary Process individual data messages by type
       * @private
       */
      async _processOneDataMessage(msg, updates) {
        const messageType = msg.msg;
        switch (messageType) {
          case 'added':
            await this._connection._process_added(msg, updates);
            break;
          case 'changed':
            this._connection._process_changed(msg, updates);
            break;
          case 'removed':
            this._connection._process_removed(msg, updates);
            break;
          case 'ready':
            this._connection._process_ready(msg, updates);
            break;
          case 'updated':
            this._connection._process_updated(msg, updates);
            break;
          case 'nosub':
            // ignore this
            break;
          default:
            Meteor._debug('discarding unknown livedata data message type', msg);
        }
      }

      /**
       * @summary Handle method results arriving from the server
       * @param {Object} msg The method result message
       */
      async _livedata_result(msg) {
        const self = this._connection;

        // Lets make sure there are no buffered writes before returning result.
        if (!isEmpty(self._bufferedWrites)) {
          await self._flushBufferedWrites();
        }

        // find the outstanding request
        // should be O(1) in nearly all realistic use cases
        if (isEmpty(self._outstandingMethodBlocks)) {
          Meteor._debug('Received method result but no methods outstanding');
          return;
        }
        const currentMethodBlock = self._outstandingMethodBlocks[0].methods;
        let i;
        const m = currentMethodBlock.find((method, idx) => {
          const found = method.methodId === msg.id;
          if (found) i = idx;
          return found;
        });
        if (!m) {
          Meteor._debug("Can't match method response to original method call", msg);
          return;
        }

        // Remove from current method block. This may leave the block empty, but we
        // don't move on to the next block until the callback has been delivered, in
        // _outstandingMethodFinished.
        currentMethodBlock.splice(i, 1);
        if (hasOwn.call(msg, 'error')) {
          m.receiveResult(new Meteor.Error(msg.error.error, msg.error.reason, msg.error.details));
        } else {
          // msg.result may be undefined if the method didn't return a value
          m.receiveResult(undefined, msg.result);
        }
      }

      /**
       * @summary Handle "nosub" messages arriving from the server
       * @param {Object} msg The nosub message
       */
      async _livedata_nosub(msg) {
        const self = this._connection;

        // First pass it through _livedata_data, which only uses it to help get
        // towards quiescence.
        await this._livedata_data(msg);

        // Do the rest of our processing immediately, with no
        // buffering-until-quiescence.

        // we weren't subbed anyway, or we initiated the unsub.
        if (!hasOwn.call(self._subscriptions, msg.id)) {
          return;
        }

        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        const errorCallback = self._subscriptions[msg.id].errorCallback;
        const stopCallback = self._subscriptions[msg.id].stopCallback;
        self._subscriptions[msg.id].remove();
        const meteorErrorFromMsg = msgArg => {
          return msgArg && msgArg.error && new Meteor.Error(msgArg.error.error, msgArg.error.reason, msgArg.error.details);
        };

        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        if (errorCallback && msg.error) {
          errorCallback(meteorErrorFromMsg(msg));
        }
        if (stopCallback) {
          stopCallback(meteorErrorFromMsg(msg));
        }
      }

      /**
       * @summary Handle errors from the server
       * @param {Object} msg The error message
       */
      _livedata_error(msg) {
        Meteor._debug('Received error from server: ', msg.reason);
        if (msg.offendingMessage) Meteor._debug('For: ', msg.offendingMessage);
      }

      // Document change message processors will be defined in a separate class
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"method_invoker.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/ddp-client/common/method_invoker.js                                                                   //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  MethodInvoker: () => MethodInvoker
});
class MethodInvoker {
  constructor(options) {
    // Public (within this file) fields.
    this.methodId = options.methodId;
    this.sentMessage = false;
    this._callback = options.callback;
    this._connection = options.connection;
    this._message = options.message;
    this._onResultReceived = options.onResultReceived || (() => {});
    this._wait = options.wait;
    this.noRetry = options.noRetry;
    this._methodResult = null;
    this._dataVisible = false;

    // Register with the connection.
    this._connection._methodInvokers[this.methodId] = this;
  }
  // Sends the method message to the server. May be called additional times if
  // we lose the connection and reconnect before receiving a result.
  sendMessage() {
    // This function is called before sending a method (including resending on
    // reconnect). We should only (re)send methods where we don't already have a
    // result!
    if (this.gotResult()) throw new Error('sendingMethod is called on method with result');

    // If we're re-sending it, it doesn't matter if data was written the first
    // time.
    this._dataVisible = false;
    this.sentMessage = true;

    // If this is a wait method, make all data messages be buffered until it is
    // done.
    if (this._wait) this._connection._methodsBlockingQuiescence[this.methodId] = true;

    // Actually send the message.
    this._connection._send(this._message);
  }
  // Invoke the callback, if we have both a result and know that all data has
  // been written to the local cache.
  _maybeInvokeCallback() {
    if (this._methodResult && this._dataVisible) {
      // Call the callback. (This won't throw: the callback was wrapped with
      // bindEnvironment.)
      this._callback(this._methodResult[0], this._methodResult[1]);

      // Forget about this method.
      delete this._connection._methodInvokers[this.methodId];

      // Let the connection know that this method is finished, so it can try to
      // move on to the next block of methods.
      this._connection._outstandingMethodFinished();
    }
  }
  // Call with the result of the method from the server. Only may be called
  // once; once it is called, you should not call sendMessage again.
  // If the user provided an onResultReceived callback, call it immediately.
  // Then invoke the main callback if data is also visible.
  receiveResult(err, result) {
    if (this.gotResult()) throw new Error('Methods should only receive results once');
    this._methodResult = [err, result];
    this._onResultReceived(err, result);
    this._maybeInvokeCallback();
  }
  // Call this when all data written by the method is visible. This means that
  // the method has returns its "data is done" message *AND* all server
  // documents that are buffered at that time have been written to the local
  // cache. Invokes the main callback if the result has been received.
  dataVisible() {
    this._dataVisible = true;
    this._maybeInvokeCallback();
  }
  // True if receiveResult has been called.
  gotResult() {
    return !!this._methodResult;
  }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"mongo_id_map.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/ddp-client/common/mongo_id_map.js                                                                     //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      MongoIDMap: () => MongoIDMap
    });
    let MongoID;
    module.link("meteor/mongo-id", {
      MongoID(v) {
        MongoID = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class MongoIDMap extends IdMap {
      constructor() {
        super(MongoID.idStringify, MongoID.idParse);
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"namespace.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/ddp-client/common/namespace.js                                                                        //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      DDP: () => DDP
    });
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 1);
    let Connection;
    module.link("./livedata_connection.js", {
      Connection(v) {
        Connection = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // This array allows the `_allSubscriptionsReady` method below, which
    // is used by the `spiderable` package, to keep track of whether all
    // data is ready.
    const allConnections = [];

    /**
     * @namespace DDP
     * @summary Namespace for DDP-related methods/classes.
     */
    const DDP = {};
    // This is private but it's used in a few places. accounts-base uses
    // it to get the current user. Meteor.setTimeout and friends clear
    // it. We can probably find a better way to factor this.
    DDP._CurrentMethodInvocation = new Meteor.EnvironmentVariable();
    DDP._CurrentPublicationInvocation = new Meteor.EnvironmentVariable();

    // XXX: Keep DDP._CurrentInvocation for backwards-compatibility.
    DDP._CurrentInvocation = DDP._CurrentMethodInvocation;
    DDP._CurrentCallAsyncInvocation = new Meteor.EnvironmentVariable();

    // This is passed into a weird `makeErrorType` function that expects its thing
    // to be a constructor
    function connectionErrorConstructor(message) {
      this.message = message;
    }
    DDP.ConnectionError = Meteor.makeErrorType('DDP.ConnectionError', connectionErrorConstructor);
    DDP.ForcedReconnectError = Meteor.makeErrorType('DDP.ForcedReconnectError', () => {});

    // Returns the named sequence of pseudo-random values.
    // The scope will be DDP._CurrentMethodInvocation.get(), so the stream will produce
    // consistent values for method calls on the client and server.
    DDP.randomStream = name => {
      const scope = DDP._CurrentMethodInvocation.get();
      return DDPCommon.RandomStream.get(scope, name);
    };

    // @param url {String} URL to Meteor app,
    //     e.g.:
    //     "subdomain.meteor.com",
    //     "http://subdomain.meteor.com",
    //     "/",
    //     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"

    /**
     * @summary Connect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.
     * @locus Anywhere
     * @param {String} url The URL of another Meteor application.
     * @param {Object} [options]
     * @param {Boolean} options.reloadWithOutstanding is it OK to reload if there are outstanding methods?
     * @param {Object} options.headers extra headers to send on the websockets connection, for server-to-server DDP only
     * @param {Object} options._sockjsOptions Specifies options to pass through to the sockjs client
     * @param {Function} options.onDDPNegotiationVersionFailure callback when version negotiation fails.
     */
    DDP.connect = (url, options) => {
      const ret = new Connection(url, options);
      allConnections.push(ret); // hack. see below.
      return ret;
    };
    DDP._reconnectHook = new Hook({
      bindEnvironment: false
    });

    /**
     * @summary Register a function to call as the first step of
     * reconnecting. This function can call methods which will be executed before
     * any other outstanding methods. For example, this can be used to re-establish
     * the appropriate authentication context on the connection.
     * @locus Anywhere
     * @param {Function} callback The function to call. It will be called with a
     * single argument, the [connection object](#ddp_connect) that is reconnecting.
     */
    DDP.onReconnect = callback => DDP._reconnectHook.register(callback);

    // Hack for `spiderable` package: a way to see if the page is done
    // loading all the data it needs.
    //
    DDP._allSubscriptionsReady = () => allConnections.every(conn => Object.values(conn._subscriptions).every(sub => sub.ready));
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      DDP: DDP
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-client/server/server.js"
  ],
  mainModulePath: "/node_modules/meteor/ddp-client/server/server.js"
}});

//# sourceURL=meteor://💻app/packages/ddp-client.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9jb25uZWN0aW9uX3N0cmVhbV9oYW5kbGVycy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9jb21tb24vZG9jdW1lbnRfcHJvY2Vzc29ycy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9jb21tb24vbGl2ZWRhdGFfY29ubmVjdGlvbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9jb21tb24vbWVzc2FnZV9wcm9jZXNzb3JzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9tZXRob2RfaW52b2tlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9jb21tb24vbW9uZ29faWRfbWFwLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9uYW1lc3BhY2UuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsIkREUCIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiZXhwb3J0IiwiQ29ubmVjdGlvblN0cmVhbUhhbmRsZXJzIiwiRERQQ29tbW9uIiwidiIsIk1ldGVvciIsImNvbnN0cnVjdG9yIiwiY29ubmVjdGlvbiIsIl9jb25uZWN0aW9uIiwib25NZXNzYWdlIiwicmF3X21zZyIsIm1zZyIsInBhcnNlRERQIiwiZSIsIl9kZWJ1ZyIsIl9oZWFydGJlYXQiLCJtZXNzYWdlUmVjZWl2ZWQiLCJ0ZXN0TWVzc2FnZU9uQ29ubmVjdCIsIk9iamVjdCIsImtleXMiLCJsZW5ndGgiLCJzZXJ2ZXJfaWQiLCJfdmVyc2lvbiIsIl92ZXJzaW9uU3VnZ2VzdGlvbiIsIl9yb3V0ZU1lc3NhZ2UiLCJfbGl2ZWRhdGFfY29ubmVjdGVkIiwib3B0aW9ucyIsIm9uQ29ubmVjdGVkIiwiX2hhbmRsZUZhaWxlZE1lc3NhZ2UiLCJyZXNwb25kVG9QaW5ncyIsIl9zZW5kIiwiaWQiLCJfbGl2ZWRhdGFfZGF0YSIsIl9saXZlZGF0YV9ub3N1YiIsIl9saXZlZGF0YV9yZXN1bHQiLCJfbGl2ZWRhdGFfZXJyb3IiLCJfc3VwcG9ydGVkRERQVmVyc2lvbnMiLCJpbmRleE9mIiwidmVyc2lvbiIsIl9zdHJlYW0iLCJyZWNvbm5lY3QiLCJfZm9yY2UiLCJkZXNjcmlwdGlvbiIsImRpc2Nvbm5lY3QiLCJfcGVybWFuZW50IiwiX2Vycm9yIiwib25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlIiwib25SZXNldCIsIl9idWlsZENvbm5lY3RNZXNzYWdlIiwiX2hhbmRsZU91dHN0YW5kaW5nTWV0aG9kc09uUmVzZXQiLCJfY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzIiwiX3Jlc2VuZFN1YnNjcmlwdGlvbnMiLCJfbGFzdFNlc3Npb25JZCIsInNlc3Npb24iLCJzdXBwb3J0IiwiYmxvY2tzIiwiX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzIiwiY3VycmVudE1ldGhvZEJsb2NrIiwibWV0aG9kcyIsImZpbHRlciIsIm1ldGhvZEludm9rZXIiLCJzZW50TWVzc2FnZSIsIm5vUmV0cnkiLCJyZWNlaXZlUmVzdWx0IiwiRXJyb3IiLCJzaGlmdCIsInZhbHVlcyIsIl9tZXRob2RJbnZva2VycyIsImZvckVhY2giLCJpbnZva2VyIiwiZW50cmllcyIsIl9zdWJzY3JpcHRpb25zIiwiX3JlZiIsInN1YiIsIl9zZW5kUXVldWVkIiwibmFtZSIsInBhcmFtcyIsIkRvY3VtZW50UHJvY2Vzc29ycyIsIk1vbmdvSUQiLCJEaWZmU2VxdWVuY2UiLCJoYXNPd24iLCJpc0VtcHR5IiwiX3Byb2Nlc3NfYWRkZWQiLCJ1cGRhdGVzIiwiaWRQYXJzZSIsInNlcnZlckRvYyIsIl9nZXRTZXJ2ZXJEb2MiLCJjb2xsZWN0aW9uIiwiaXNFeGlzdGluZyIsImRvY3VtZW50IiwidW5kZWZpbmVkIiwiZmllbGRzIiwiY3JlYXRlIiwiX2lkIiwiX3Jlc2V0U3RvcmVzIiwiY3VycmVudERvYyIsIl9zdG9yZXMiLCJnZXREb2MiLCJfcHVzaFVwZGF0ZSIsIl9wcm9jZXNzX2NoYW5nZWQiLCJhcHBseUNoYW5nZXMiLCJfcHJvY2Vzc19yZW1vdmVkIiwiX3Byb2Nlc3NfcmVhZHkiLCJzdWJzIiwic3ViSWQiLCJfcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkIiwic3ViUmVjb3JkIiwicmVhZHkiLCJyZWFkeUNhbGxiYWNrIiwicmVhZHlEZXBzIiwiY2hhbmdlZCIsIl9wcm9jZXNzX3VwZGF0ZWQiLCJtZXRob2RJZCIsImRvY3MiLCJfZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiIsIndyaXR0ZW4iLCJKU09OIiwic3RyaW5naWZ5Iiwid3JpdHRlbkJ5U3R1YnMiLCJpZFN0cmluZ2lmeSIsInJlcGxhY2UiLCJmbHVzaENhbGxiYWNrcyIsImMiLCJfc2VydmVyRG9jdW1lbnRzIiwicmVtb3ZlIiwiY2FsbGJhY2tJbnZva2VyIiwiZGF0YVZpc2libGUiLCJhcmd1bWVudHMiLCJjYWxsIiwicHVzaCIsInNlcnZlckRvY3NGb3JDb2xsZWN0aW9uIiwiZ2V0IiwiX29iamVjdFdpdGhvdXRQcm9wZXJ0aWVzIiwiZGVmYXVsdCIsIl9vYmplY3RTcHJlYWQiLCJfZXhjbHVkZWQiLCJfZXhjbHVkZWQyIiwiQ29ubmVjdGlvbiIsIlRyYWNrZXIiLCJFSlNPTiIsIlJhbmRvbSIsIk1ldGhvZEludm9rZXIiLCJzbGljZSIsImxhc3QiLCJNb25nb0lETWFwIiwiTWVzc2FnZVByb2Nlc3NvcnMiLCJ1cmwiLCJoZWFydGJlYXRJbnRlcnZhbCIsImhlYXJ0YmVhdFRpbWVvdXQiLCJucG1GYXllT3B0aW9ucyIsInJlbG9hZFdpdGhPdXRzdGFuZGluZyIsInN1cHBvcnRlZEREUFZlcnNpb25zIiwiU1VQUE9SVEVEX0REUF9WRVJTSU9OUyIsInJldHJ5IiwiYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCIsImJ1ZmZlcmVkV3JpdGVzTWF4QWdlIiwib25SZWNvbm5lY3QiLCJDbGllbnRTdHJlYW0iLCJyZXF1aXJlIiwiQ29ubmVjdGlvbkVycm9yIiwiaGVhZGVycyIsIl9zb2NranNPcHRpb25zIiwiX2RvbnRQcmludEVycm9ycyIsImNvbm5lY3RUaW1lb3V0TXMiLCJfbWV0aG9kSGFuZGxlcnMiLCJfbmV4dE1ldGhvZElkIiwiX2hlYXJ0YmVhdEludGVydmFsIiwiX2hlYXJ0YmVhdFRpbWVvdXQiLCJfYWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSIsIl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlIiwiX3N1YnNCZWluZ1Jldml2ZWQiLCJfdXBkYXRlc0ZvclVua25vd25TdG9yZXMiLCJfcmV0cnlNaWdyYXRlIiwiX2J1ZmZlcmVkV3JpdGVzIiwiX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCIsIl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlIiwiX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJfYnVmZmVyZWRXcml0ZXNNYXhBZ2UiLCJfdXNlcklkIiwiX3VzZXJJZERlcHMiLCJEZXBlbmRlbmN5IiwiaXNDbGllbnQiLCJQYWNrYWdlIiwicmVsb2FkIiwiUmVsb2FkIiwiX29uTWlncmF0ZSIsIl9yZWFkeVRvTWlncmF0ZSIsIl9zdHJlYW1IYW5kbGVycyIsIm9uRGlzY29ubmVjdCIsInN0b3AiLCJpc1NlcnZlciIsIm9uIiwiYmluZEVudmlyb25tZW50IiwiX21lc3NhZ2VQcm9jZXNzb3JzIiwiX2RvY3VtZW50UHJvY2Vzc29ycyIsImNyZWF0ZVN0b3JlTWV0aG9kcyIsIndyYXBwZWRTdG9yZSIsInN0b3JlIiwia2V5c09mU3RvcmUiLCJtZXRob2QiLCJyZWdpc3RlclN0b3JlQ2xpZW50IiwicXVldWVkIiwiQXJyYXkiLCJpc0FycmF5IiwiYmVnaW5VcGRhdGUiLCJ1cGRhdGUiLCJlbmRVcGRhdGUiLCJyZWdpc3RlclN0b3JlU2VydmVyIiwic3Vic2NyaWJlIiwiY2FsbGJhY2tzIiwibGFzdFBhcmFtIiwib25SZWFkeSIsInBvcCIsIm9uRXJyb3IiLCJvblN0b3AiLCJzb21lIiwiZiIsImV4aXN0aW5nIiwiZmluZCIsImluYWN0aXZlIiwiZXF1YWxzIiwiZXJyb3JDYWxsYmFjayIsInN0b3BDYWxsYmFjayIsImNsb25lIiwiaGFuZGxlIiwicmVjb3JkIiwiZGVwZW5kIiwic3Vic2NyaXB0aW9uSWQiLCJhY3RpdmUiLCJvbkludmFsaWRhdGUiLCJhZnRlckZsdXNoIiwiaXNBc3luY0NhbGwiLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJfaXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nIiwiZnVuYyIsIl9nZXRJc1NpbXVsYXRpb24iLCJfcmVmMiIsImlzRnJvbUNhbGxBc3luYyIsImFscmVhZHlJblNpbXVsYXRpb24iLCJhcmdzIiwiY2FsbGJhY2siLCJhcHBseSIsImNhbGxBc3luYyIsImFwcGx5QXN5bmMiLCJyZXR1cm5TZXJ2ZXJSZXN1bHRQcm9taXNlIiwiX3RoaXMkX3N0dWJDYWxsIiwiX3N0dWJDYWxsIiwic3R1Ykludm9jYXRpb24iLCJpbnZvY2F0aW9uIiwic3R1Yk9wdGlvbnMiLCJoYXNTdHViIiwiX3NhdmVPcmlnaW5hbHMiLCJzdHViUmV0dXJuVmFsdWUiLCJ3aXRoVmFsdWUiLCJfaXNQcm9taXNlIiwiY29uY2F0IiwiZXhjZXB0aW9uIiwiX2FwcGx5Iiwic3R1YlByb21pc2UiLCJfYXBwbHlBc3luY1N0dWJJbnZvY2F0aW9uIiwicHJvbWlzZSIsIl9hcHBseUFzeW5jIiwidGhlbiIsIm8iLCJzZXJ2ZXJQcm9taXNlIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJjYXRjaCIsIl90aGlzJF9zdHViQ2FsbDIiLCJjdXJyZW50Q29udGV4dCIsIl9zZXROZXdDb250ZXh0QW5kR2V0Q3VycmVudCIsIl9zZXQiLCJfcmVmMyIsInN0dWJDYWxsVmFsdWUiLCJyYW5kb21TZWVkIiwicmVzdWx0IiwiX3JldHVybk1ldGhvZEludm9rZXIiLCJfcmV0cmlldmVBbmRTdG9yZU9yaWdpbmFscyIsIm1lc3NhZ2UiLCJ0aHJvd1N0dWJFeGNlcHRpb25zIiwiX2V4cGVjdGVkQnlUZXN0IiwicmV0dXJuU3R1YlZhbHVlIiwiZXJyIiwiX2xlbiIsImFsbEFyZ3MiLCJfa2V5IiwiZnJvbSIsInZhbHVlIiwib25SZXN1bHRSZWNlaXZlZCIsIndhaXQiLCJfYWRkT3V0c3RhbmRpbmdNZXRob2QiLCJlbmNsb3NpbmciLCJzdHViIiwiaXNTaW11bGF0aW9uIiwiX2lzRnJvbUNhbGxBc3luYyIsImRlZmF1bHRSZXR1cm4iLCJyYW5kb21TZWVkR2VuZXJhdG9yIiwibWFrZVJwY1NlZWQiLCJzZXRVc2VySWQiLCJ1c2VySWQiLCJNZXRob2RJbnZvY2F0aW9uIiwiX25vWWllbGRzQWxsb3dlZCIsIl93YWl0aW5nRm9yUXVpZXNjZW5jZSIsIl9mbHVzaEJ1ZmZlcmVkV3JpdGVzIiwic2F2ZU9yaWdpbmFscyIsImRvY3NXcml0dGVuIiwiX3JlZjQiLCJvcmlnaW5hbHMiLCJyZXRyaWV2ZU9yaWdpbmFscyIsImRvYyIsInNldERlZmF1bHQiLCJfdW5zdWJzY3JpYmVBbGwiLCJvYmoiLCJzZW5kIiwic3RyaW5naWZ5RERQIiwiX2xvc3RDb25uZWN0aW9uIiwiZXJyb3IiLCJzdGF0dXMiLCJjbG9zZSIsIl9hbnlNZXRob2RzQXJlT3V0c3RhbmRpbmciLCJpbnZva2VycyIsIl9wcmVwYXJlQnVmZmVyc1RvRmx1c2giLCJjbGVhclRpbWVvdXQiLCJ3cml0ZXMiLCJfcGVyZm9ybVdyaXRlc1NlcnZlciIsIl91cGRhdGVzJHN0b3JlJF9uYW1lIiwiX25hbWUiLCJzdG9yZU5hbWUiLCJtZXNzYWdlcyIsIkNIVU5LX1NJWkUiLCJpIiwiY2h1bmsiLCJNYXRoIiwibWluIiwicHJvY2VzcyIsIm5leHRUaWNrIiwiX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzIiwiX3BlcmZvcm1Xcml0ZXNDbGllbnQiLCJfdXBkYXRlcyRzdG9yZSRfbmFtZTIiLCJfcmVmNSIsInJ1bkZBZnRlclVwZGF0ZXMiLCJ1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCIsIm9uU2VydmVyRG9jRmx1c2giLCJzZXJ2ZXJEb2N1bWVudHMiLCJ3cml0dGVuQnlTdHViRm9yQU1ldGhvZFdpdGhTZW50TWVzc2FnZSIsInNlbmRNZXNzYWdlIiwiX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQiLCJmaXJzdEJsb2NrIiwiX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMiLCJfbWF5YmVNaWdyYXRlIiwibSIsIl9zZW5kT3V0c3RhbmRpbmdNZXRob2RCbG9ja3NNZXNzYWdlcyIsIm9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzIiwiX3JlY29ubmVjdEhvb2siLCJlYWNoIiwiSGVhcnRiZWF0Iiwib25UaW1lb3V0Iiwic2VuZFBpbmciLCJzdGFydCIsInJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb24iLCJnb3RSZXN1bHQiLCJidWZmZXJlZE1lc3NhZ2VzIiwiYnVmZmVyZWRNZXNzYWdlIiwiX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZSIsInN0YW5kYXJkV3JpdGUiLCJEYXRlIiwidmFsdWVPZiIsInNldFRpbWVvdXQiLCJfbGl2ZURhdGFXcml0ZXNQcm9taXNlIiwiZmluYWxseSIsIm1lc3NhZ2VUeXBlIiwiaWR4IiwiZm91bmQiLCJzcGxpY2UiLCJyZWFzb24iLCJkZXRhaWxzIiwibWV0ZW9yRXJyb3JGcm9tTXNnIiwibXNnQXJnIiwib2ZmZW5kaW5nTWVzc2FnZSIsIl9jYWxsYmFjayIsIl9tZXNzYWdlIiwiX29uUmVzdWx0UmVjZWl2ZWQiLCJfd2FpdCIsIl9tZXRob2RSZXN1bHQiLCJfZGF0YVZpc2libGUiLCJfbWF5YmVJbnZva2VDYWxsYmFjayIsIklkTWFwIiwiYWxsQ29ubmVjdGlvbnMiLCJFbnZpcm9ubWVudFZhcmlhYmxlIiwiX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24iLCJfQ3VycmVudEludm9jYXRpb24iLCJfQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24iLCJjb25uZWN0aW9uRXJyb3JDb25zdHJ1Y3RvciIsIm1ha2VFcnJvclR5cGUiLCJGb3JjZWRSZWNvbm5lY3RFcnJvciIsInJhbmRvbVN0cmVhbSIsInNjb3BlIiwiUmFuZG9tU3RyZWFtIiwiY29ubmVjdCIsInJldCIsIkhvb2siLCJyZWdpc3RlciIsIl9hbGxTdWJzY3JpcHRpb25zUmVhZHkiLCJldmVyeSIsImNvbm4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUFBLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLHdCQUF3QixFQUFDO01BQUNDLEdBQUcsRUFBQztJQUFLLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJQyxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNQSxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUFDQyxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHOzs7Ozs7Ozs7Ozs7OztJQ0FqSFAsTUFBTSxDQUFDUSxNQUFNLENBQUM7TUFBQ0Msd0JBQXdCLEVBQUNBLENBQUEsS0FBSUE7SUFBd0IsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsU0FBUztJQUFDVixNQUFNLENBQUNDLElBQUksQ0FBQyxtQkFBbUIsRUFBQztNQUFDUyxTQUFTQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0QsU0FBUyxHQUFDQyxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsTUFBTTtJQUFDWixNQUFNLENBQUNDLElBQUksQ0FBQyxlQUFlLEVBQUM7TUFBQ1csTUFBTUEsQ0FBQ0QsQ0FBQyxFQUFDO1FBQUNDLE1BQU0sR0FBQ0QsQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJ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O0lBQ0FoRixHQUFHLENBQUNxWixPQUFPLEdBQUcsQ0FBQzlQLEdBQUcsRUFBRXhILE9BQU8sS0FBSztNQUM5QixNQUFNdVgsR0FBRyxHQUFHLElBQUl4USxVQUFVLENBQUNTLEdBQUcsRUFBRXhILE9BQU8sQ0FBQztNQUN4QzJXLGNBQWMsQ0FBQ3BRLElBQUksQ0FBQ2dSLEdBQUcsQ0FBQyxDQUFDLENBQUM7TUFDMUIsT0FBT0EsR0FBRztJQUNaLENBQUM7SUFFRHRaLEdBQUcsQ0FBQ3dXLGNBQWMsR0FBRyxJQUFJK0MsSUFBSSxDQUFDO01BQUVqTixlQUFlLEVBQUU7SUFBTSxDQUFDLENBQUM7O0lBRXpEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNBdE0sR0FBRyxDQUFDaUssV0FBVyxHQUFHcUYsUUFBUSxJQUFJdFAsR0FBRyxDQUFDd1csY0FBYyxDQUFDZ0QsUUFBUSxDQUFDbEssUUFBUSxDQUFDOztJQUVuRTtJQUNBO0lBQ0E7SUFDQXRQLEdBQUcsQ0FBQ3laLHNCQUFzQixHQUFHLE1BQU1mLGNBQWMsQ0FBQ2dCLEtBQUssQ0FDckRDLElBQUksSUFBSXBZLE1BQU0sQ0FBQ2dELE1BQU0sQ0FBQ29WLElBQUksQ0FBQy9VLGNBQWMsQ0FBQyxDQUFDOFUsS0FBSyxDQUFDNVUsR0FBRyxJQUFJQSxHQUFHLENBQUNrQyxLQUFLLENBQ25FLENBQUM7SUFBQzlHLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUFFLElBQUE7RUFBQUMsS0FBQTtBQUFBLEciLCJmaWxlIjoiL3BhY2thZ2VzL2RkcC1jbGllbnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgeyBERFAgfSBmcm9tICcuLi9jb21tb24vbmFtZXNwYWNlLmpzJztcbiIsImltcG9ydCB7IEREUENvbW1vbiB9IGZyb20gJ21ldGVvci9kZHAtY29tbW9uJztcbmltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuXG5leHBvcnQgY2xhc3MgQ29ubmVjdGlvblN0cmVhbUhhbmRsZXJzIHtcbiAgY29uc3RydWN0b3IoY29ubmVjdGlvbikge1xuICAgIHRoaXMuX2Nvbm5lY3Rpb24gPSBjb25uZWN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMgaW5jb21pbmcgcmF3IG1lc3NhZ2VzIGZyb20gdGhlIEREUCBzdHJlYW1cbiAgICogQHBhcmFtIHtTdHJpbmd9IHJhd19tc2cgVGhlIHJhdyBtZXNzYWdlIHJlY2VpdmVkIGZyb20gdGhlIHN0cmVhbVxuICAgKi9cbiAgYXN5bmMgb25NZXNzYWdlKHJhd19tc2cpIHtcbiAgICBsZXQgbXNnO1xuICAgIHRyeSB7XG4gICAgICBtc2cgPSBERFBDb21tb24ucGFyc2VERFAocmF3X21zZyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnRXhjZXB0aW9uIHdoaWxlIHBhcnNpbmcgRERQJywgZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQW55IG1lc3NhZ2UgY291bnRzIGFzIHJlY2VpdmluZyBhIHBvbmcsIGFzIGl0IGRlbW9uc3RyYXRlcyB0aGF0XG4gICAgLy8gdGhlIHNlcnZlciBpcyBzdGlsbCBhbGl2ZS5cbiAgICBpZiAodGhpcy5fY29ubmVjdGlvbi5faGVhcnRiZWF0KSB7XG4gICAgICB0aGlzLl9jb25uZWN0aW9uLl9oZWFydGJlYXQubWVzc2FnZVJlY2VpdmVkKCk7XG4gICAgfVxuXG4gICAgaWYgKG1zZyA9PT0gbnVsbCB8fCAhbXNnLm1zZykge1xuICAgICAgaWYoIW1zZyB8fCAhbXNnLnRlc3RNZXNzYWdlT25Db25uZWN0KSB7XG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhtc2cpLmxlbmd0aCA9PT0gMSAmJiBtc2cuc2VydmVyX2lkKSByZXR1cm47XG4gICAgICAgIE1ldGVvci5fZGVidWcoJ2Rpc2NhcmRpbmcgaW52YWxpZCBsaXZlZGF0YSBtZXNzYWdlJywgbXNnKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJbXBvcnRhbnQ6IFRoaXMgd2FzIG1pc3NpbmcgZnJvbSBwcmV2aW91cyB2ZXJzaW9uXG4gICAgLy8gV2UgbmVlZCB0byBzZXQgdGhlIGN1cnJlbnQgdmVyc2lvbiBiZWZvcmUgcm91dGluZyB0aGUgbWVzc2FnZVxuICAgIGlmIChtc2cubXNnID09PSAnY29ubmVjdGVkJykge1xuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fdmVyc2lvbiA9IHRoaXMuX2Nvbm5lY3Rpb24uX3ZlcnNpb25TdWdnZXN0aW9uO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuX3JvdXRlTWVzc2FnZShtc2cpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJvdXRlcyBtZXNzYWdlcyB0byB0aGVpciBhcHByb3ByaWF0ZSBoYW5kbGVycyBiYXNlZCBvbiBtZXNzYWdlIHR5cGVcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IG1zZyBUaGUgcGFyc2VkIEREUCBtZXNzYWdlXG4gICAqL1xuICBhc3luYyBfcm91dGVNZXNzYWdlKG1zZykge1xuICAgIHN3aXRjaCAobXNnLm1zZykge1xuICAgICAgY2FzZSAnY29ubmVjdGVkJzpcbiAgICAgICAgYXdhaXQgdGhpcy5fY29ubmVjdGlvbi5fbGl2ZWRhdGFfY29ubmVjdGVkKG1zZyk7XG4gICAgICAgIHRoaXMuX2Nvbm5lY3Rpb24ub3B0aW9ucy5vbkNvbm5lY3RlZCgpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnZmFpbGVkJzpcbiAgICAgICAgYXdhaXQgdGhpcy5faGFuZGxlRmFpbGVkTWVzc2FnZShtc2cpO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAncGluZyc6XG4gICAgICAgIGlmICh0aGlzLl9jb25uZWN0aW9uLm9wdGlvbnMucmVzcG9uZFRvUGluZ3MpIHtcbiAgICAgICAgICB0aGlzLl9jb25uZWN0aW9uLl9zZW5kKHsgbXNnOiAncG9uZycsIGlkOiBtc2cuaWQgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ3BvbmcnOlxuICAgICAgICAvLyBub29wLCBhcyB3ZSBhc3N1bWUgZXZlcnl0aGluZydzIGEgcG9uZ1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAnYWRkZWQnOlxuICAgICAgY2FzZSAnY2hhbmdlZCc6XG4gICAgICBjYXNlICdyZW1vdmVkJzpcbiAgICAgIGNhc2UgJ3JlYWR5JzpcbiAgICAgIGNhc2UgJ3VwZGF0ZWQnOlxuICAgICAgICBhd2FpdCB0aGlzLl9jb25uZWN0aW9uLl9saXZlZGF0YV9kYXRhKG1zZyk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdub3N1Yic6XG4gICAgICAgIGF3YWl0IHRoaXMuX2Nvbm5lY3Rpb24uX2xpdmVkYXRhX25vc3ViKG1zZyk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdyZXN1bHQnOlxuICAgICAgICBhd2FpdCB0aGlzLl9jb25uZWN0aW9uLl9saXZlZGF0YV9yZXN1bHQobXNnKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ2Vycm9yJzpcbiAgICAgICAgdGhpcy5fY29ubmVjdGlvbi5fbGl2ZWRhdGFfZXJyb3IobXNnKTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIE1ldGVvci5fZGVidWcoJ2Rpc2NhcmRpbmcgdW5rbm93biBsaXZlZGF0YSBtZXNzYWdlIHR5cGUnLCBtc2cpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGVzIGZhaWxlZCBjb25uZWN0aW9uIG1lc3NhZ2VzXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBtc2cgVGhlIGZhaWxlZCBtZXNzYWdlIG9iamVjdFxuICAgKi9cbiAgX2hhbmRsZUZhaWxlZE1lc3NhZ2UobXNnKSB7XG4gICAgaWYgKHRoaXMuX2Nvbm5lY3Rpb24uX3N1cHBvcnRlZEREUFZlcnNpb25zLmluZGV4T2YobXNnLnZlcnNpb24pID49IDApIHtcbiAgICAgIHRoaXMuX2Nvbm5lY3Rpb24uX3ZlcnNpb25TdWdnZXN0aW9uID0gbXNnLnZlcnNpb247XG4gICAgICB0aGlzLl9jb25uZWN0aW9uLl9zdHJlYW0ucmVjb25uZWN0KHsgX2ZvcmNlOiB0cnVlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBkZXNjcmlwdGlvbiA9XG4gICAgICAgICdERFAgdmVyc2lvbiBuZWdvdGlhdGlvbiBmYWlsZWQ7IHNlcnZlciByZXF1ZXN0ZWQgdmVyc2lvbiAnICtcbiAgICAgICAgbXNnLnZlcnNpb247XG4gICAgICB0aGlzLl9jb25uZWN0aW9uLl9zdHJlYW0uZGlzY29ubmVjdCh7IF9wZXJtYW5lbnQ6IHRydWUsIF9lcnJvcjogZGVzY3JpcHRpb24gfSk7XG4gICAgICB0aGlzLl9jb25uZWN0aW9uLm9wdGlvbnMub25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlKGRlc2NyaXB0aW9uKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSGFuZGxlcyBjb25uZWN0aW9uIHJlc2V0IGV2ZW50c1xuICAgKi9cbiAgb25SZXNldCgpIHtcbiAgICAvLyBSZXNldCBpcyBjYWxsZWQgZXZlbiBvbiB0aGUgZmlyc3QgY29ubmVjdGlvbiwgc28gdGhpcyBpc1xuICAgIC8vIHRoZSBvbmx5IHBsYWNlIHdlIHNlbmQgdGhpcyBtZXNzYWdlLlxuICAgIGNvbnN0IG1zZyA9IHRoaXMuX2J1aWxkQ29ubmVjdE1lc3NhZ2UoKTtcbiAgICB0aGlzLl9jb25uZWN0aW9uLl9zZW5kKG1zZyk7XG5cbiAgICAvLyBNYXJrIG5vbi1yZXRyeSBjYWxscyBhcyBmYWlsZWQgYW5kIGhhbmRsZSBvdXRzdGFuZGluZyBtZXRob2RzXG4gICAgdGhpcy5faGFuZGxlT3V0c3RhbmRpbmdNZXRob2RzT25SZXNldCgpO1xuXG4gICAgLy8gTm93LCB0byBtaW5pbWl6ZSBzZXR1cCBsYXRlbmN5LCBnbyBhaGVhZCBhbmQgYmxhc3Qgb3V0IGFsbCBvZlxuICAgIC8vIG91ciBwZW5kaW5nIG1ldGhvZHMgYW5kcyBzdWJzY3JpcHRpb25zIGJlZm9yZSB3ZSd2ZSBldmVuIHRha2VuXG4gICAgLy8gdGhlIG5lY2Vzc2FyeSBSVFQgdG8ga25vdyBpZiB3ZSBzdWNjZXNzZnVsbHkgcmVjb25uZWN0ZWQuXG4gICAgdGhpcy5fY29ubmVjdGlvbi5fY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzKCk7XG4gICAgdGhpcy5fcmVzZW5kU3Vic2NyaXB0aW9ucygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEJ1aWxkcyB0aGUgaW5pdGlhbCBjb25uZWN0IG1lc3NhZ2VcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybnMge09iamVjdH0gVGhlIGNvbm5lY3QgbWVzc2FnZSBvYmplY3RcbiAgICovXG4gIF9idWlsZENvbm5lY3RNZXNzYWdlKCkge1xuICAgIGNvbnN0IG1zZyA9IHsgbXNnOiAnY29ubmVjdCcgfTtcbiAgICBpZiAodGhpcy5fY29ubmVjdGlvbi5fbGFzdFNlc3Npb25JZCkge1xuICAgICAgbXNnLnNlc3Npb24gPSB0aGlzLl9jb25uZWN0aW9uLl9sYXN0U2Vzc2lvbklkO1xuICAgIH1cbiAgICBtc2cudmVyc2lvbiA9IHRoaXMuX2Nvbm5lY3Rpb24uX3ZlcnNpb25TdWdnZXN0aW9uIHx8IHRoaXMuX2Nvbm5lY3Rpb24uX3N1cHBvcnRlZEREUFZlcnNpb25zWzBdO1xuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX3ZlcnNpb25TdWdnZXN0aW9uID0gbXNnLnZlcnNpb247XG4gICAgbXNnLnN1cHBvcnQgPSB0aGlzLl9jb25uZWN0aW9uLl9zdXBwb3J0ZWRERFBWZXJzaW9ucztcbiAgICByZXR1cm4gbXNnO1xuICB9XG5cbiAgLyoqXG4gICAqIEhhbmRsZXMgb3V0c3RhbmRpbmcgbWV0aG9kcyBkdXJpbmcgYSByZXNldFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX2hhbmRsZU91dHN0YW5kaW5nTWV0aG9kc09uUmVzZXQoKSB7XG4gICAgY29uc3QgYmxvY2tzID0gdGhpcy5fY29ubmVjdGlvbi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3M7XG4gICAgaWYgKGJsb2Nrcy5sZW5ndGggPT09IDApIHJldHVybjtcblxuICAgIGNvbnN0IGN1cnJlbnRNZXRob2RCbG9jayA9IGJsb2Nrc1swXS5tZXRob2RzO1xuICAgIGJsb2Nrc1swXS5tZXRob2RzID0gY3VycmVudE1ldGhvZEJsb2NrLmZpbHRlcihcbiAgICAgIG1ldGhvZEludm9rZXIgPT4ge1xuICAgICAgICAvLyBNZXRob2RzIHdpdGggJ25vUmV0cnknIG9wdGlvbiBzZXQgYXJlIG5vdCBhbGxvd2VkIHRvIHJlLXNlbmQgYWZ0ZXJcbiAgICAgICAgLy8gcmVjb3ZlcmluZyBkcm9wcGVkIGNvbm5lY3Rpb24uXG4gICAgICAgIGlmIChtZXRob2RJbnZva2VyLnNlbnRNZXNzYWdlICYmIG1ldGhvZEludm9rZXIubm9SZXRyeSkge1xuICAgICAgICAgIG1ldGhvZEludm9rZXIucmVjZWl2ZVJlc3VsdChcbiAgICAgICAgICAgIG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgICAgICdpbnZvY2F0aW9uLWZhaWxlZCcsXG4gICAgICAgICAgICAgICdNZXRob2QgaW52b2NhdGlvbiBtaWdodCBoYXZlIGZhaWxlZCBkdWUgdG8gZHJvcHBlZCBjb25uZWN0aW9uLiAnICtcbiAgICAgICAgICAgICAgJ0ZhaWxpbmcgYmVjYXVzZSBgbm9SZXRyeWAgb3B0aW9uIHdhcyBwYXNzZWQgdG8gTWV0ZW9yLmFwcGx5LidcbiAgICAgICAgICAgIClcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gT25seSBrZWVwIGEgbWV0aG9kIGlmIGl0IHdhc24ndCBzZW50IG9yIGl0J3MgYWxsb3dlZCB0byByZXRyeS5cbiAgICAgICAgcmV0dXJuICEobWV0aG9kSW52b2tlci5zZW50TWVzc2FnZSAmJiBtZXRob2RJbnZva2VyLm5vUmV0cnkpO1xuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBDbGVhciBlbXB0eSBibG9ja3NcbiAgICBpZiAoYmxvY2tzLmxlbmd0aCA+IDAgJiYgYmxvY2tzWzBdLm1ldGhvZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBibG9ja3Muc2hpZnQoKTtcbiAgICB9XG5cbiAgICAvLyBSZXNldCBhbGwgbWV0aG9kIGludm9rZXJzIGFzIHVuc2VudFxuICAgIE9iamVjdC52YWx1ZXModGhpcy5fY29ubmVjdGlvbi5fbWV0aG9kSW52b2tlcnMpLmZvckVhY2goaW52b2tlciA9PiB7XG4gICAgICBpbnZva2VyLnNlbnRNZXNzYWdlID0gZmFsc2U7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVzZW5kcyBhbGwgYWN0aXZlIHN1YnNjcmlwdGlvbnNcbiAgICogQHByaXZhdGVcbiAgICovXG4gIF9yZXNlbmRTdWJzY3JpcHRpb25zKCkge1xuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuX2Nvbm5lY3Rpb24uX3N1YnNjcmlwdGlvbnMpLmZvckVhY2goKFtpZCwgc3ViXSkgPT4ge1xuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fc2VuZFF1ZXVlZCh7XG4gICAgICAgIG1zZzogJ3N1YicsXG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgbmFtZTogc3ViLm5hbWUsXG4gICAgICAgIHBhcmFtczogc3ViLnBhcmFtc1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn0iLCJpbXBvcnQgeyBNb25nb0lEIH0gZnJvbSAnbWV0ZW9yL21vbmdvLWlkJztcbmltcG9ydCB7IERpZmZTZXF1ZW5jZSB9IGZyb20gJ21ldGVvci9kaWZmLXNlcXVlbmNlJztcbmltcG9ydCB7IGhhc093biB9IGZyb20gXCJtZXRlb3IvZGRwLWNvbW1vbi91dGlsc1wiO1xuaW1wb3J0IHsgaXNFbXB0eSB9IGZyb20gXCJtZXRlb3IvZGRwLWNvbW1vbi91dGlsc1wiO1xuXG5leHBvcnQgY2xhc3MgRG9jdW1lbnRQcm9jZXNzb3JzIHtcbiAgY29uc3RydWN0b3IoY29ubmVjdGlvbikge1xuICAgIHRoaXMuX2Nvbm5lY3Rpb24gPSBjb25uZWN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFByb2Nlc3MgYW4gJ2FkZGVkJyBtZXNzYWdlIGZyb20gdGhlIHNlcnZlclxuICAgKiBAcGFyYW0ge09iamVjdH0gbXNnIFRoZSBhZGRlZCBtZXNzYWdlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSB1cGRhdGVzIFRoZSB1cGRhdGVzIGFjY3VtdWxhdG9yXG4gICAqL1xuICBhc3luYyBfcHJvY2Vzc19hZGRlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcy5fY29ubmVjdGlvbjtcbiAgICBjb25zdCBpZCA9IE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpO1xuICAgIGNvbnN0IHNlcnZlckRvYyA9IHNlbGYuX2dldFNlcnZlckRvYyhtc2cuY29sbGVjdGlvbiwgaWQpO1xuXG4gICAgaWYgKHNlcnZlckRvYykge1xuICAgICAgLy8gU29tZSBvdXRzdGFuZGluZyBzdHViIHdyb3RlIGhlcmUuXG4gICAgICBjb25zdCBpc0V4aXN0aW5nID0gc2VydmVyRG9jLmRvY3VtZW50ICE9PSB1bmRlZmluZWQ7XG5cbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IG1zZy5maWVsZHMgfHwgT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICAgIHNlcnZlckRvYy5kb2N1bWVudC5faWQgPSBpZDtcblxuICAgICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICAgIC8vIER1cmluZyByZWNvbm5lY3QgdGhlIHNlcnZlciBpcyBzZW5kaW5nIGFkZHMgZm9yIGV4aXN0aW5nIGlkcy5cbiAgICAgICAgLy8gQWx3YXlzIHB1c2ggYW4gdXBkYXRlIHNvIHRoYXQgZG9jdW1lbnQgc3RheXMgaW4gdGhlIHN0b3JlIGFmdGVyXG4gICAgICAgIC8vIHJlc2V0LiBVc2UgY3VycmVudCB2ZXJzaW9uIG9mIHRoZSBkb2N1bWVudCBmb3IgdGhpcyB1cGRhdGUsIHNvXG4gICAgICAgIC8vIHRoYXQgc3R1Yi13cml0dGVuIHZhbHVlcyBhcmUgcHJlc2VydmVkLlxuICAgICAgICBjb25zdCBjdXJyZW50RG9jID0gYXdhaXQgc2VsZi5fc3RvcmVzW21zZy5jb2xsZWN0aW9uXS5nZXREb2MobXNnLmlkKTtcbiAgICAgICAgaWYgKGN1cnJlbnREb2MgIT09IHVuZGVmaW5lZCkgbXNnLmZpZWxkcyA9IGN1cnJlbnREb2M7XG5cbiAgICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNFeGlzdGluZykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IGFkZCBmb3IgZXhpc3RpbmcgaWQ6ICcgKyBtc2cuaWQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCBtc2cpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBQcm9jZXNzIGEgJ2NoYW5nZWQnIG1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBtc2cgVGhlIGNoYW5nZWQgbWVzc2FnZVxuICAgKiBAcGFyYW0ge09iamVjdH0gdXBkYXRlcyBUaGUgdXBkYXRlcyBhY2N1bXVsYXRvclxuICAgKi9cbiAgX3Byb2Nlc3NfY2hhbmdlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcy5fY29ubmVjdGlvbjtcbiAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9nZXRTZXJ2ZXJEb2MobXNnLmNvbGxlY3Rpb24sIE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpKTtcblxuICAgIGlmIChzZXJ2ZXJEb2MpIHtcbiAgICAgIGlmIChzZXJ2ZXJEb2MuZG9jdW1lbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IGNoYW5nZWQgZm9yIG5vbmV4aXN0aW5nIGlkOiAnICsgbXNnLmlkKTtcbiAgICAgIH1cbiAgICAgIERpZmZTZXF1ZW5jZS5hcHBseUNoYW5nZXMoc2VydmVyRG9jLmRvY3VtZW50LCBtc2cuZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBtc2cuY29sbGVjdGlvbiwgbXNnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgUHJvY2VzcyBhICdyZW1vdmVkJyBtZXNzYWdlIGZyb20gdGhlIHNlcnZlclxuICAgKiBAcGFyYW0ge09iamVjdH0gbXNnIFRoZSByZW1vdmVkIG1lc3NhZ2VcbiAgICogQHBhcmFtIHtPYmplY3R9IHVwZGF0ZXMgVGhlIHVwZGF0ZXMgYWNjdW11bGF0b3JcbiAgICovXG4gIF9wcm9jZXNzX3JlbW92ZWQobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXMuX2Nvbm5lY3Rpb247XG4gICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKG1zZy5jb2xsZWN0aW9uLCBNb25nb0lELmlkUGFyc2UobXNnLmlkKSk7XG5cbiAgICBpZiAoc2VydmVyRG9jKSB7XG4gICAgICAvLyBTb21lIG91dHN0YW5kaW5nIHN0dWIgd3JvdGUgaGVyZS5cbiAgICAgIGlmIChzZXJ2ZXJEb2MuZG9jdW1lbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciBzZW50IHJlbW92ZWQgZm9yIG5vbmV4aXN0aW5nIGlkOicgKyBtc2cuaWQpO1xuICAgICAgfVxuICAgICAgc2VydmVyRG9jLmRvY3VtZW50ID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCB7XG4gICAgICAgIG1zZzogJ3JlbW92ZWQnLFxuICAgICAgICBjb2xsZWN0aW9uOiBtc2cuY29sbGVjdGlvbixcbiAgICAgICAgaWQ6IG1zZy5pZFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFByb2Nlc3MgYSAncmVhZHknIG1lc3NhZ2UgZnJvbSB0aGUgc2VydmVyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBtc2cgVGhlIHJlYWR5IG1lc3NhZ2VcbiAgICogQHBhcmFtIHtPYmplY3R9IHVwZGF0ZXMgVGhlIHVwZGF0ZXMgYWNjdW11bGF0b3JcbiAgICovXG4gIF9wcm9jZXNzX3JlYWR5KG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzLl9jb25uZWN0aW9uO1xuXG4gICAgLy8gUHJvY2VzcyBcInN1YiByZWFkeVwiIG1lc3NhZ2VzLiBcInN1YiByZWFkeVwiIG1lc3NhZ2VzIGRvbid0IHRha2UgZWZmZWN0XG4gICAgLy8gdW50aWwgYWxsIGN1cnJlbnQgc2VydmVyIGRvY3VtZW50cyBoYXZlIGJlZW4gZmx1c2hlZCB0byB0aGUgbG9jYWxcbiAgICAvLyBkYXRhYmFzZS4gV2UgY2FuIHVzZSBhIHdyaXRlIGZlbmNlIHRvIGltcGxlbWVudCB0aGlzLlxuICAgIG1zZy5zdWJzLmZvckVhY2goKHN1YklkKSA9PiB7XG4gICAgICBzZWxmLl9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQoKCkgPT4ge1xuICAgICAgICBjb25zdCBzdWJSZWNvcmQgPSBzZWxmLl9zdWJzY3JpcHRpb25zW3N1YklkXTtcbiAgICAgICAgLy8gRGlkIHdlIGFscmVhZHkgdW5zdWJzY3JpYmU/XG4gICAgICAgIGlmICghc3ViUmVjb3JkKSByZXR1cm47XG4gICAgICAgIC8vIERpZCB3ZSBhbHJlYWR5IHJlY2VpdmUgYSByZWFkeSBtZXNzYWdlPyAoT29wcyEpXG4gICAgICAgIGlmIChzdWJSZWNvcmQucmVhZHkpIHJldHVybjtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5Q2FsbGJhY2sgJiYgc3ViUmVjb3JkLnJlYWR5Q2FsbGJhY2soKTtcbiAgICAgICAgc3ViUmVjb3JkLnJlYWR5RGVwcy5jaGFuZ2VkKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBQcm9jZXNzIGFuICd1cGRhdGVkJyBtZXNzYWdlIGZyb20gdGhlIHNlcnZlclxuICAgKiBAcGFyYW0ge09iamVjdH0gbXNnIFRoZSB1cGRhdGVkIG1lc3NhZ2VcbiAgICogQHBhcmFtIHtPYmplY3R9IHVwZGF0ZXMgVGhlIHVwZGF0ZXMgYWNjdW11bGF0b3JcbiAgICovXG4gIF9wcm9jZXNzX3VwZGF0ZWQobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXMuX2Nvbm5lY3Rpb247XG4gICAgLy8gUHJvY2VzcyBcIm1ldGhvZCBkb25lXCIgbWVzc2FnZXMuXG4gICAgbXNnLm1ldGhvZHMuZm9yRWFjaCgobWV0aG9kSWQpID0+IHtcbiAgICAgIGNvbnN0IGRvY3MgPSBzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViW21ldGhvZElkXSB8fCB7fTtcbiAgICAgIE9iamVjdC52YWx1ZXMoZG9jcykuZm9yRWFjaCgod3JpdHRlbikgPT4ge1xuICAgICAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9nZXRTZXJ2ZXJEb2Mod3JpdHRlbi5jb2xsZWN0aW9uLCB3cml0dGVuLmlkKTtcbiAgICAgICAgaWYgKCFzZXJ2ZXJEb2MpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0xvc3Qgc2VydmVyRG9jIGZvciAnICsgSlNPTi5zdHJpbmdpZnkod3JpdHRlbikpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzW21ldGhvZElkXSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdEb2MgJyArXG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh3cml0dGVuKSArXG4gICAgICAgICAgICAnIG5vdCB3cml0dGVuIGJ5IG1ldGhvZCAnICtcbiAgICAgICAgICAgIG1ldGhvZElkXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzW21ldGhvZElkXTtcbiAgICAgICAgaWYgKGlzRW1wdHkoc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzKSkge1xuICAgICAgICAgIC8vIEFsbCBtZXRob2RzIHdob3NlIHN0dWJzIHdyb3RlIHRoaXMgbWV0aG9kIGhhdmUgY29tcGxldGVkISBXZSBjYW5cbiAgICAgICAgICAvLyBub3cgY29weSB0aGUgc2F2ZWQgZG9jdW1lbnQgdG8gdGhlIGRhdGFiYXNlIChyZXZlcnRpbmcgdGhlIHN0dWInc1xuICAgICAgICAgIC8vIGNoYW5nZSBpZiB0aGUgc2VydmVyIGRpZCBub3Qgd3JpdGUgdG8gdGhpcyBvYmplY3QsIG9yIGFwcGx5aW5nIHRoZVxuICAgICAgICAgIC8vIHNlcnZlcidzIHdyaXRlcyBpZiBpdCBkaWQpLlxuXG4gICAgICAgICAgLy8gVGhpcyBpcyBhIGZha2UgZGRwICdyZXBsYWNlJyBtZXNzYWdlLiAgSXQncyBqdXN0IGZvciB0YWxraW5nXG4gICAgICAgICAgLy8gYmV0d2VlbiBsaXZlZGF0YSBjb25uZWN0aW9ucyBhbmQgbWluaW1vbmdvLiAgKFdlIGhhdmUgdG8gc3RyaW5naWZ5XG4gICAgICAgICAgLy8gdGhlIElEIGJlY2F1c2UgaXQncyBzdXBwb3NlZCB0byBsb29rIGxpa2UgYSB3aXJlIG1lc3NhZ2UuKVxuICAgICAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgd3JpdHRlbi5jb2xsZWN0aW9uLCB7XG4gICAgICAgICAgICBtc2c6ICdyZXBsYWNlJyxcbiAgICAgICAgICAgIGlkOiBNb25nb0lELmlkU3RyaW5naWZ5KHdyaXR0ZW4uaWQpLFxuICAgICAgICAgICAgcmVwbGFjZTogc2VydmVyRG9jLmRvY3VtZW50XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgLy8gQ2FsbCBhbGwgZmx1c2ggY2FsbGJhY2tzLlxuICAgICAgICAgIHNlcnZlckRvYy5mbHVzaENhbGxiYWNrcy5mb3JFYWNoKChjKSA9PiB7XG4gICAgICAgICAgICBjKCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAvLyBEZWxldGUgdGhpcyBjb21wbGV0ZWQgc2VydmVyRG9jdW1lbnQuIERvbid0IGJvdGhlciB0byBHQyBlbXB0eVxuICAgICAgICAgIC8vIElkTWFwcyBpbnNpZGUgc2VsZi5fc2VydmVyRG9jdW1lbnRzLCBzaW5jZSB0aGVyZSBwcm9iYWJseSBhcmVuJ3RcbiAgICAgICAgICAvLyBtYW55IGNvbGxlY3Rpb25zIGFuZCB0aGV5J2xsIGJlIHdyaXR0ZW4gcmVwZWF0ZWRseS5cbiAgICAgICAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbd3JpdHRlbi5jb2xsZWN0aW9uXS5yZW1vdmUod3JpdHRlbi5pZCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgZGVsZXRlIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdO1xuXG4gICAgICAvLyBXZSB3YW50IHRvIGNhbGwgdGhlIGRhdGEtd3JpdHRlbiBjYWxsYmFjaywgYnV0IHdlIGNhbid0IGRvIHNvIHVudGlsIGFsbFxuICAgICAgLy8gY3VycmVudGx5IGJ1ZmZlcmVkIG1lc3NhZ2VzIGFyZSBmbHVzaGVkLlxuICAgICAgY29uc3QgY2FsbGJhY2tJbnZva2VyID0gc2VsZi5fbWV0aG9kSW52b2tlcnNbbWV0aG9kSWRdO1xuICAgICAgaWYgKCFjYWxsYmFja0ludm9rZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBjYWxsYmFjayBpbnZva2VyIGZvciBtZXRob2QgJyArIG1ldGhvZElkKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5fcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkKFxuICAgICAgICAoLi4uYXJncykgPT4gY2FsbGJhY2tJbnZva2VyLmRhdGFWaXNpYmxlKC4uLmFyZ3MpXG4gICAgICApO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFB1c2ggYW4gdXBkYXRlIHRvIHRoZSBidWZmZXJcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtPYmplY3R9IHVwZGF0ZXMgVGhlIHVwZGF0ZXMgYWNjdW11bGF0b3JcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gbmFtZVxuICAgKiBAcGFyYW0ge09iamVjdH0gbXNnIFRoZSB1cGRhdGUgbWVzc2FnZVxuICAgKi9cbiAgX3B1c2hVcGRhdGUodXBkYXRlcywgY29sbGVjdGlvbiwgbXNnKSB7XG4gICAgaWYgKCFoYXNPd24uY2FsbCh1cGRhdGVzLCBjb2xsZWN0aW9uKSkge1xuICAgICAgdXBkYXRlc1tjb2xsZWN0aW9uXSA9IFtdO1xuICAgIH1cbiAgICB1cGRhdGVzW2NvbGxlY3Rpb25dLnB1c2gobXNnKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBHZXQgYSBzZXJ2ZXIgZG9jdW1lbnQgYnkgY29sbGVjdGlvbiBhbmQgaWRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gbmFtZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgVGhlIGRvY3VtZW50IGlkXG4gICAqIEByZXR1cm5zIHtPYmplY3R8bnVsbH0gVGhlIHNlcnZlciBkb2N1bWVudCBvciBudWxsXG4gICAqL1xuICBfZ2V0U2VydmVyRG9jKGNvbGxlY3Rpb24sIGlkKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXMuX2Nvbm5lY3Rpb247XG4gICAgaWYgKCFoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3Qgc2VydmVyRG9jc0ZvckNvbGxlY3Rpb24gPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl07XG4gICAgcmV0dXJuIHNlcnZlckRvY3NGb3JDb2xsZWN0aW9uLmdldChpZCkgfHwgbnVsbDtcbiAgfVxufSIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgRERQQ29tbW9uIH0gZnJvbSAnbWV0ZW9yL2RkcC1jb21tb24nO1xuaW1wb3J0IHsgVHJhY2tlciB9IGZyb20gJ21ldGVvci90cmFja2VyJztcbmltcG9ydCB7IEVKU09OIH0gZnJvbSAnbWV0ZW9yL2Vqc29uJztcbmltcG9ydCB7IFJhbmRvbSB9IGZyb20gJ21ldGVvci9yYW5kb20nO1xuaW1wb3J0IHsgTW9uZ29JRCB9IGZyb20gJ21ldGVvci9tb25nby1pZCc7XG5pbXBvcnQgeyBERFAgfSBmcm9tICcuL25hbWVzcGFjZS5qcyc7XG5pbXBvcnQgeyBNZXRob2RJbnZva2VyIH0gZnJvbSAnLi9tZXRob2RfaW52b2tlcic7XG5pbXBvcnQge1xuICBoYXNPd24sXG4gIHNsaWNlLFxuICBrZXlzLFxuICBpc0VtcHR5LFxuICBsYXN0LFxufSBmcm9tIFwibWV0ZW9yL2RkcC1jb21tb24vdXRpbHNcIjtcbmltcG9ydCB7IENvbm5lY3Rpb25TdHJlYW1IYW5kbGVycyB9IGZyb20gJy4vY29ubmVjdGlvbl9zdHJlYW1faGFuZGxlcnMnO1xuaW1wb3J0IHsgTW9uZ29JRE1hcCB9IGZyb20gJy4vbW9uZ29faWRfbWFwJztcbmltcG9ydCB7IE1lc3NhZ2VQcm9jZXNzb3JzIH0gZnJvbSAnLi9tZXNzYWdlX3Byb2Nlc3NvcnMnO1xuaW1wb3J0IHsgRG9jdW1lbnRQcm9jZXNzb3JzIH0gZnJvbSAnLi9kb2N1bWVudF9wcm9jZXNzb3JzJztcblxuLy8gQHBhcmFtIHVybCB7U3RyaW5nfE9iamVjdH0gVVJMIHRvIE1ldGVvciBhcHAsXG4vLyAgIG9yIGFuIG9iamVjdCBhcyBhIHRlc3QgaG9vayAoc2VlIGNvZGUpXG4vLyBPcHRpb25zOlxuLy8gICByZWxvYWRXaXRoT3V0c3RhbmRpbmc6IGlzIGl0IE9LIHRvIHJlbG9hZCBpZiB0aGVyZSBhcmUgb3V0c3RhbmRpbmcgbWV0aG9kcz9cbi8vICAgaGVhZGVyczogZXh0cmEgaGVhZGVycyB0byBzZW5kIG9uIHRoZSB3ZWJzb2NrZXRzIGNvbm5lY3Rpb24sIGZvclxuLy8gICAgIHNlcnZlci10by1zZXJ2ZXIgRERQIG9ubHlcbi8vICAgX3NvY2tqc09wdGlvbnM6IFNwZWNpZmllcyBvcHRpb25zIHRvIHBhc3MgdGhyb3VnaCB0byB0aGUgc29ja2pzIGNsaWVudFxuLy8gICBvbkREUE5lZ290aWF0aW9uVmVyc2lvbkZhaWx1cmU6IGNhbGxiYWNrIHdoZW4gdmVyc2lvbiBuZWdvdGlhdGlvbiBmYWlscy5cbi8vXG4vLyBYWFggVGhlcmUgc2hvdWxkIGJlIGEgd2F5IHRvIGRlc3Ryb3kgYSBERFAgY29ubmVjdGlvbiwgY2F1c2luZyBhbGxcbi8vIG91dHN0YW5kaW5nIG1ldGhvZCBjYWxscyB0byBmYWlsLlxuLy9cbi8vIFhYWCBPdXIgY3VycmVudCB3YXkgb2YgaGFuZGxpbmcgZmFpbHVyZSBhbmQgcmVjb25uZWN0aW9uIGlzIGdyZWF0XG4vLyBmb3IgYW4gYXBwICh3aGVyZSB3ZSB3YW50IHRvIHRvbGVyYXRlIGJlaW5nIGRpc2Nvbm5lY3RlZCBhcyBhblxuLy8gZXhwZWN0IHN0YXRlLCBhbmQga2VlcCB0cnlpbmcgZm9yZXZlciB0byByZWNvbm5lY3QpIGJ1dCBjdW1iZXJzb21lXG4vLyBmb3Igc29tZXRoaW5nIGxpa2UgYSBjb21tYW5kIGxpbmUgdG9vbCB0aGF0IHdhbnRzIHRvIG1ha2UgYVxuLy8gY29ubmVjdGlvbiwgY2FsbCBhIG1ldGhvZCwgYW5kIHByaW50IGFuIGVycm9yIGlmIGNvbm5lY3Rpb25cbi8vIGZhaWxzLiBXZSBzaG91bGQgaGF2ZSBiZXR0ZXIgdXNhYmlsaXR5IGluIHRoZSBsYXR0ZXIgY2FzZSAod2hpbGVcbi8vIHN0aWxsIHRyYW5zcGFyZW50bHkgcmVjb25uZWN0aW5nIGlmIGl0J3MganVzdCBhIHRyYW5zaWVudCBmYWlsdXJlXG4vLyBvciB0aGUgc2VydmVyIG1pZ3JhdGluZyB1cykuXG5leHBvcnQgY2xhc3MgQ29ubmVjdGlvbiB7XG4gIGNvbnN0cnVjdG9yKHVybCwgb3B0aW9ucykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyA9IHtcbiAgICAgIG9uQ29ubmVjdGVkKCkge30sXG4gICAgICBvbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUoZGVzY3JpcHRpb24pIHtcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhkZXNjcmlwdGlvbik7XG4gICAgICB9LFxuICAgICAgaGVhcnRiZWF0SW50ZXJ2YWw6IDE3NTAwLFxuICAgICAgaGVhcnRiZWF0VGltZW91dDogMTUwMDAsXG4gICAgICBucG1GYXllT3B0aW9uczogT2JqZWN0LmNyZWF0ZShudWxsKSxcbiAgICAgIC8vIFRoZXNlIG9wdGlvbnMgYXJlIG9ubHkgZm9yIHRlc3RpbmcuXG4gICAgICByZWxvYWRXaXRoT3V0c3RhbmRpbmc6IGZhbHNlLFxuICAgICAgc3VwcG9ydGVkRERQVmVyc2lvbnM6IEREUENvbW1vbi5TVVBQT1JURURfRERQX1ZFUlNJT05TLFxuICAgICAgcmV0cnk6IHRydWUsXG4gICAgICByZXNwb25kVG9QaW5nczogdHJ1ZSxcbiAgICAgIC8vIFdoZW4gdXBkYXRlcyBhcmUgY29taW5nIHdpdGhpbiB0aGlzIG1zIGludGVydmFsLCBiYXRjaCB0aGVtIHRvZ2V0aGVyLlxuICAgICAgYnVmZmVyZWRXcml0ZXNJbnRlcnZhbDogNSxcbiAgICAgIC8vIEZsdXNoIGJ1ZmZlcnMgaW1tZWRpYXRlbHkgaWYgd3JpdGVzIGFyZSBoYXBwZW5pbmcgY29udGludW91c2x5IGZvciBtb3JlIHRoYW4gdGhpcyBtYW55IG1zLlxuICAgICAgYnVmZmVyZWRXcml0ZXNNYXhBZ2U6IDUwMCxcblxuICAgICAgLi4ub3B0aW9uc1xuICAgIH07XG5cbiAgICAvLyBJZiBzZXQsIGNhbGxlZCB3aGVuIHdlIHJlY29ubmVjdCwgcXVldWluZyBtZXRob2QgY2FsbHMgX2JlZm9yZV8gdGhlXG4gICAgLy8gZXhpc3Rpbmcgb3V0c3RhbmRpbmcgb25lcy5cbiAgICAvLyBOT1RFOiBUaGlzIGZlYXR1cmUgaGFzIGJlZW4gcHJlc2VydmVkIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eS4gVGhlXG4gICAgLy8gcHJlZmVycmVkIG1ldGhvZCBvZiBzZXR0aW5nIGEgY2FsbGJhY2sgb24gcmVjb25uZWN0IGlzIHRvIHVzZVxuICAgIC8vIEREUC5vblJlY29ubmVjdC5cbiAgICBzZWxmLm9uUmVjb25uZWN0ID0gbnVsbDtcblxuICAgIC8vIGFzIGEgdGVzdCBob29rLCBhbGxvdyBwYXNzaW5nIGEgc3RyZWFtIGluc3RlYWQgb2YgYSB1cmwuXG4gICAgaWYgKHR5cGVvZiB1cmwgPT09ICdvYmplY3QnKSB7XG4gICAgICBzZWxmLl9zdHJlYW0gPSB1cmw7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHsgQ2xpZW50U3RyZWFtIH0gPSByZXF1aXJlKFwibWV0ZW9yL3NvY2tldC1zdHJlYW0tY2xpZW50XCIpO1xuXG4gICAgICBzZWxmLl9zdHJlYW0gPSBuZXcgQ2xpZW50U3RyZWFtKHVybCwge1xuICAgICAgICByZXRyeTogb3B0aW9ucy5yZXRyeSxcbiAgICAgICAgQ29ubmVjdGlvbkVycm9yOiBERFAuQ29ubmVjdGlvbkVycm9yLFxuICAgICAgICBoZWFkZXJzOiBvcHRpb25zLmhlYWRlcnMsXG4gICAgICAgIF9zb2NranNPcHRpb25zOiBvcHRpb25zLl9zb2NranNPcHRpb25zLFxuICAgICAgICAvLyBVc2VkIHRvIGtlZXAgc29tZSB0ZXN0cyBxdWlldCwgb3IgZm9yIG90aGVyIGNhc2VzIGluIHdoaWNoXG4gICAgICAgIC8vIHRoZSByaWdodCB0aGluZyB0byBkbyB3aXRoIGNvbm5lY3Rpb24gZXJyb3JzIGlzIHRvIHNpbGVudGx5XG4gICAgICAgIC8vIGZhaWwgKGUuZy4gc2VuZGluZyBwYWNrYWdlIHVzYWdlIHN0YXRzKS4gQXQgc29tZSBwb2ludCB3ZVxuICAgICAgICAvLyBzaG91bGQgaGF2ZSBhIHJlYWwgQVBJIGZvciBoYW5kbGluZyBjbGllbnQtc3RyZWFtLWxldmVsXG4gICAgICAgIC8vIGVycm9ycy5cbiAgICAgICAgX2RvbnRQcmludEVycm9yczogb3B0aW9ucy5fZG9udFByaW50RXJyb3JzLFxuICAgICAgICBjb25uZWN0VGltZW91dE1zOiBvcHRpb25zLmNvbm5lY3RUaW1lb3V0TXMsXG4gICAgICAgIG5wbUZheWVPcHRpb25zOiBvcHRpb25zLm5wbUZheWVPcHRpb25zXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzZWxmLl9sYXN0U2Vzc2lvbklkID0gbnVsbDtcbiAgICBzZWxmLl92ZXJzaW9uU3VnZ2VzdGlvbiA9IG51bGw7IC8vIFRoZSBsYXN0IHByb3Bvc2VkIEREUCB2ZXJzaW9uLlxuICAgIHNlbGYuX3ZlcnNpb24gPSBudWxsOyAvLyBUaGUgRERQIHZlcnNpb24gYWdyZWVkIG9uIGJ5IGNsaWVudCBhbmQgc2VydmVyLlxuICAgIHNlbGYuX3N0b3JlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7IC8vIG5hbWUgLT4gb2JqZWN0IHdpdGggbWV0aG9kc1xuICAgIHNlbGYuX21ldGhvZEhhbmRsZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTsgLy8gbmFtZSAtPiBmdW5jXG4gICAgc2VsZi5fbmV4dE1ldGhvZElkID0gMTtcbiAgICBzZWxmLl9zdXBwb3J0ZWRERFBWZXJzaW9ucyA9IG9wdGlvbnMuc3VwcG9ydGVkRERQVmVyc2lvbnM7XG5cbiAgICBzZWxmLl9oZWFydGJlYXRJbnRlcnZhbCA9IG9wdGlvbnMuaGVhcnRiZWF0SW50ZXJ2YWw7XG4gICAgc2VsZi5faGVhcnRiZWF0VGltZW91dCA9IG9wdGlvbnMuaGVhcnRiZWF0VGltZW91dDtcblxuICAgIC8vIFRyYWNrcyBtZXRob2RzIHdoaWNoIHRoZSB1c2VyIGhhcyB0cmllZCB0byBjYWxsIGJ1dCB3aGljaCBoYXZlIG5vdCB5ZXRcbiAgICAvLyBjYWxsZWQgdGhlaXIgdXNlciBjYWxsYmFjayAoaWUsIHRoZXkgYXJlIHdhaXRpbmcgb24gdGhlaXIgcmVzdWx0IG9yIGZvciBhbGxcbiAgICAvLyBvZiB0aGVpciB3cml0ZXMgdG8gYmUgd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUpLiBNYXAgZnJvbSBtZXRob2QgSUQgdG9cbiAgICAvLyBNZXRob2RJbnZva2VyIG9iamVjdC5cbiAgICBzZWxmLl9tZXRob2RJbnZva2VycyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBUcmFja3MgbWV0aG9kcyB3aGljaCB0aGUgdXNlciBoYXMgY2FsbGVkIGJ1dCB3aG9zZSByZXN1bHQgbWVzc2FnZXMgaGF2ZSBub3RcbiAgICAvLyBhcnJpdmVkIHlldC5cbiAgICAvL1xuICAgIC8vIF9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyBpcyBhbiBhcnJheSBvZiBibG9ja3Mgb2YgbWV0aG9kcy4gRWFjaCBibG9ja1xuICAgIC8vIHJlcHJlc2VudHMgYSBzZXQgb2YgbWV0aG9kcyB0aGF0IGNhbiBydW4gYXQgdGhlIHNhbWUgdGltZS4gVGhlIGZpcnN0IGJsb2NrXG4gICAgLy8gcmVwcmVzZW50cyB0aGUgbWV0aG9kcyB3aGljaCBhcmUgY3VycmVudGx5IGluIGZsaWdodDsgc3Vic2VxdWVudCBibG9ja3NcbiAgICAvLyBtdXN0IHdhaXQgZm9yIHByZXZpb3VzIGJsb2NrcyB0byBiZSBmdWxseSBmaW5pc2hlZCBiZWZvcmUgdGhleSBjYW4gYmUgc2VudFxuICAgIC8vIHRvIHRoZSBzZXJ2ZXIuXG4gICAgLy9cbiAgICAvLyBFYWNoIGJsb2NrIGlzIGFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgZmllbGRzOlxuICAgIC8vIC0gbWV0aG9kczogYSBsaXN0IG9mIE1ldGhvZEludm9rZXIgb2JqZWN0c1xuICAgIC8vIC0gd2FpdDogYSBib29sZWFuOyBpZiB0cnVlLCB0aGlzIGJsb2NrIGhhZCBhIHNpbmdsZSBtZXRob2QgaW52b2tlZCB3aXRoXG4gICAgLy8gICAgICAgICB0aGUgXCJ3YWl0XCIgb3B0aW9uXG4gICAgLy9cbiAgICAvLyBUaGVyZSB3aWxsIG5ldmVyIGJlIGFkamFjZW50IGJsb2NrcyB3aXRoIHdhaXQ9ZmFsc2UsIGJlY2F1c2UgdGhlIG9ubHkgdGhpbmdcbiAgICAvLyB0aGF0IG1ha2VzIG1ldGhvZHMgbmVlZCB0byBiZSBzZXJpYWxpemVkIGlzIGEgd2FpdCBtZXRob2QuXG4gICAgLy9cbiAgICAvLyBNZXRob2RzIGFyZSByZW1vdmVkIGZyb20gdGhlIGZpcnN0IGJsb2NrIHdoZW4gdGhlaXIgXCJyZXN1bHRcIiBpc1xuICAgIC8vIHJlY2VpdmVkLiBUaGUgZW50aXJlIGZpcnN0IGJsb2NrIGlzIG9ubHkgcmVtb3ZlZCB3aGVuIGFsbCBvZiB0aGUgaW4tZmxpZ2h0XG4gICAgLy8gbWV0aG9kcyBoYXZlIHJlY2VpdmVkIHRoZWlyIHJlc3VsdHMgKHNvIHRoZSBcIm1ldGhvZHNcIiBsaXN0IGlzIGVtcHR5KSAqQU5EKlxuICAgIC8vIGFsbCBvZiB0aGUgZGF0YSB3cml0dGVuIGJ5IHRob3NlIG1ldGhvZHMgYXJlIHZpc2libGUgaW4gdGhlIGxvY2FsIGNhY2hlLiBTb1xuICAgIC8vIGl0IGlzIHBvc3NpYmxlIGZvciB0aGUgZmlyc3QgYmxvY2sncyBtZXRob2RzIGxpc3QgdG8gYmUgZW1wdHksIGlmIHdlIGFyZVxuICAgIC8vIHN0aWxsIHdhaXRpbmcgZm9yIHNvbWUgb2JqZWN0cyB0byBxdWllc2NlLlxuICAgIC8vXG4gICAgLy8gRXhhbXBsZTpcbiAgICAvLyAgX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gW1xuICAgIC8vICAgIHt3YWl0OiBmYWxzZSwgbWV0aG9kczogW119LFxuICAgIC8vICAgIHt3YWl0OiB0cnVlLCBtZXRob2RzOiBbPE1ldGhvZEludm9rZXIgZm9yICdsb2dpbic+XX0sXG4gICAgLy8gICAge3dhaXQ6IGZhbHNlLCBtZXRob2RzOiBbPE1ldGhvZEludm9rZXIgZm9yICdmb28nPixcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICA8TWV0aG9kSW52b2tlciBmb3IgJ2Jhcic+XX1dXG4gICAgLy8gVGhpcyBtZWFucyB0aGF0IHRoZXJlIHdlcmUgc29tZSBtZXRob2RzIHdoaWNoIHdlcmUgc2VudCB0byB0aGUgc2VydmVyIGFuZFxuICAgIC8vIHdoaWNoIGhhdmUgcmV0dXJuZWQgdGhlaXIgcmVzdWx0cywgYnV0IHNvbWUgb2YgdGhlIGRhdGEgd3JpdHRlbiBieVxuICAgIC8vIHRoZSBtZXRob2RzIG1heSBub3QgYmUgdmlzaWJsZSBpbiB0aGUgbG9jYWwgY2FjaGUuIE9uY2UgYWxsIHRoYXQgZGF0YSBpc1xuICAgIC8vIHZpc2libGUsIHdlIHdpbGwgc2VuZCBhICdsb2dpbicgbWV0aG9kLiBPbmNlIHRoZSBsb2dpbiBtZXRob2QgaGFzIHJldHVybmVkXG4gICAgLy8gYW5kIGFsbCB0aGUgZGF0YSBpcyB2aXNpYmxlIChpbmNsdWRpbmcgcmUtcnVubmluZyBzdWJzIGlmIHVzZXJJZCBjaGFuZ2VzKSxcbiAgICAvLyB3ZSB3aWxsIHNlbmQgdGhlICdmb28nIGFuZCAnYmFyJyBtZXRob2RzIGluIHBhcmFsbGVsLlxuICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gW107XG5cbiAgICAvLyBtZXRob2QgSUQgLT4gYXJyYXkgb2Ygb2JqZWN0cyB3aXRoIGtleXMgJ2NvbGxlY3Rpb24nIGFuZCAnaWQnLCBsaXN0aW5nXG4gICAgLy8gZG9jdW1lbnRzIHdyaXR0ZW4gYnkgYSBnaXZlbiBtZXRob2QncyBzdHViLiBrZXlzIGFyZSBhc3NvY2lhdGVkIHdpdGhcbiAgICAvLyBtZXRob2RzIHdob3NlIHN0dWIgd3JvdGUgYXQgbGVhc3Qgb25lIGRvY3VtZW50LCBhbmQgd2hvc2UgZGF0YS1kb25lIG1lc3NhZ2VcbiAgICAvLyBoYXMgbm90IHlldCBiZWVuIHJlY2VpdmVkLlxuICAgIHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgPSB7fTtcbiAgICAvLyBjb2xsZWN0aW9uIC0+IElkTWFwIG9mIFwic2VydmVyIGRvY3VtZW50XCIgb2JqZWN0LiBBIFwic2VydmVyIGRvY3VtZW50XCIgaGFzOlxuICAgIC8vIC0gXCJkb2N1bWVudFwiOiB0aGUgdmVyc2lvbiBvZiB0aGUgZG9jdW1lbnQgYWNjb3JkaW5nIHRoZVxuICAgIC8vICAgc2VydmVyIChpZSwgdGhlIHNuYXBzaG90IGJlZm9yZSBhIHN0dWIgd3JvdGUgaXQsIGFtZW5kZWQgYnkgYW55IGNoYW5nZXNcbiAgICAvLyAgIHJlY2VpdmVkIGZyb20gdGhlIHNlcnZlcilcbiAgICAvLyAgIEl0IGlzIHVuZGVmaW5lZCBpZiB3ZSB0aGluayB0aGUgZG9jdW1lbnQgZG9lcyBub3QgZXhpc3RcbiAgICAvLyAtIFwid3JpdHRlbkJ5U3R1YnNcIjogYSBzZXQgb2YgbWV0aG9kIElEcyB3aG9zZSBzdHVicyB3cm90ZSB0byB0aGUgZG9jdW1lbnRcbiAgICAvLyAgIHdob3NlIFwiZGF0YSBkb25lXCIgbWVzc2FnZXMgaGF2ZSBub3QgeWV0IGJlZW4gcHJvY2Vzc2VkXG4gICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzID0ge307XG5cbiAgICAvLyBBcnJheSBvZiBjYWxsYmFja3MgdG8gYmUgY2FsbGVkIGFmdGVyIHRoZSBuZXh0IHVwZGF0ZSBvZiB0aGUgbG9jYWxcbiAgICAvLyBjYWNoZS4gVXNlZCBmb3I6XG4gICAgLy8gIC0gQ2FsbGluZyBtZXRob2RJbnZva2VyLmRhdGFWaXNpYmxlIGFuZCBzdWIgcmVhZHkgY2FsbGJhY2tzIGFmdGVyXG4gICAgLy8gICAgdGhlIHJlbGV2YW50IGRhdGEgaXMgZmx1c2hlZC5cbiAgICAvLyAgLSBJbnZva2luZyB0aGUgY2FsbGJhY2tzIG9mIFwiaGFsZi1maW5pc2hlZFwiIG1ldGhvZHMgYWZ0ZXIgcmVjb25uZWN0XG4gICAgLy8gICAgcXVpZXNjZW5jZS4gU3BlY2lmaWNhbGx5LCBtZXRob2RzIHdob3NlIHJlc3VsdCB3YXMgcmVjZWl2ZWQgb3ZlciB0aGUgb2xkXG4gICAgLy8gICAgY29ubmVjdGlvbiAoc28gd2UgZG9uJ3QgcmUtc2VuZCBpdCkgYnV0IHdob3NlIGRhdGEgaGFkIG5vdCBiZWVuIG1hZGVcbiAgICAvLyAgICB2aXNpYmxlLlxuICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzID0gW107XG5cbiAgICAvLyBJbiB0d28gY29udGV4dHMsIHdlIGJ1ZmZlciBhbGwgaW5jb21pbmcgZGF0YSBtZXNzYWdlcyBhbmQgdGhlbiBwcm9jZXNzIHRoZW1cbiAgICAvLyBhbGwgYXQgb25jZSBpbiBhIHNpbmdsZSB1cGRhdGU6XG4gICAgLy8gICAtIER1cmluZyByZWNvbm5lY3QsIHdlIGJ1ZmZlciBhbGwgZGF0YSBtZXNzYWdlcyB1bnRpbCBhbGwgc3VicyB0aGF0IGhhZFxuICAgIC8vICAgICBiZWVuIHJlYWR5IGJlZm9yZSByZWNvbm5lY3QgYXJlIHJlYWR5IGFnYWluLCBhbmQgYWxsIG1ldGhvZHMgdGhhdCBhcmVcbiAgICAvLyAgICAgYWN0aXZlIGhhdmUgcmV0dXJuZWQgdGhlaXIgXCJkYXRhIGRvbmUgbWVzc2FnZVwiOyB0aGVuXG4gICAgLy8gICAtIER1cmluZyB0aGUgZXhlY3V0aW9uIG9mIGEgXCJ3YWl0XCIgbWV0aG9kLCB3ZSBidWZmZXIgYWxsIGRhdGEgbWVzc2FnZXNcbiAgICAvLyAgICAgdW50aWwgdGhlIHdhaXQgbWV0aG9kIGdldHMgaXRzIFwiZGF0YSBkb25lXCIgbWVzc2FnZS4gKElmIHRoZSB3YWl0IG1ldGhvZFxuICAgIC8vICAgICBvY2N1cnMgZHVyaW5nIHJlY29ubmVjdCwgaXQgZG9lc24ndCBnZXQgYW55IHNwZWNpYWwgaGFuZGxpbmcuKVxuICAgIC8vIGFsbCBkYXRhIG1lc3NhZ2VzIGFyZSBwcm9jZXNzZWQgaW4gb25lIHVwZGF0ZS5cbiAgICAvL1xuICAgIC8vIFRoZSBmb2xsb3dpbmcgZmllbGRzIGFyZSB1c2VkIGZvciB0aGlzIFwicXVpZXNjZW5jZVwiIHByb2Nlc3MuXG5cbiAgICAvLyBUaGlzIGJ1ZmZlcnMgdGhlIG1lc3NhZ2VzIHRoYXQgYXJlbid0IGJlaW5nIHByb2Nlc3NlZCB5ZXQuXG4gICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuICAgIC8vIE1hcCBmcm9tIG1ldGhvZCBJRCAtPiB0cnVlLiBNZXRob2RzIGFyZSByZW1vdmVkIGZyb20gdGhpcyB3aGVuIHRoZWlyXG4gICAgLy8gXCJkYXRhIGRvbmVcIiBtZXNzYWdlIGlzIHJlY2VpdmVkLCBhbmQgd2Ugd2lsbCBub3QgcXVpZXNjZSB1bnRpbCBpdCBpc1xuICAgIC8vIGVtcHR5LlxuICAgIHNlbGYuX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2UgPSB7fTtcbiAgICAvLyBtYXAgZnJvbSBzdWIgSUQgLT4gdHJ1ZSBmb3Igc3VicyB0aGF0IHdlcmUgcmVhZHkgKGllLCBjYWxsZWQgdGhlIHN1YlxuICAgIC8vIHJlYWR5IGNhbGxiYWNrKSBiZWZvcmUgcmVjb25uZWN0IGJ1dCBoYXZlbid0IGJlY29tZSByZWFkeSBhZ2FpbiB5ZXRcbiAgICBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkID0ge307IC8vIG1hcCBmcm9tIHN1Yi5faWQgLT4gdHJ1ZVxuICAgIC8vIGlmIHRydWUsIHRoZSBuZXh0IGRhdGEgdXBkYXRlIHNob3VsZCByZXNldCBhbGwgc3RvcmVzLiAoc2V0IGR1cmluZ1xuICAgIC8vIHJlY29ubmVjdC4pXG4gICAgc2VsZi5fcmVzZXRTdG9yZXMgPSBmYWxzZTtcblxuICAgIC8vIG5hbWUgLT4gYXJyYXkgb2YgdXBkYXRlcyBmb3IgKHlldCB0byBiZSBjcmVhdGVkKSBjb2xsZWN0aW9uc1xuICAgIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzID0ge307XG4gICAgLy8gaWYgd2UncmUgYmxvY2tpbmcgYSBtaWdyYXRpb24sIHRoZSByZXRyeSBmdW5jXG4gICAgc2VsZi5fcmV0cnlNaWdyYXRlID0gbnVsbDtcbiAgICAvLyBDb2xsZWN0aW9uIG5hbWUgLT4gYXJyYXkgb2YgbWVzc2FnZXMuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXMgPSB7fTtcbiAgICAvLyBXaGVuIGN1cnJlbnQgYnVmZmVyIG9mIHVwZGF0ZXMgbXVzdCBiZSBmbHVzaGVkIGF0LCBpbiBtcyB0aW1lc3RhbXAuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEF0ID0gbnVsbDtcbiAgICAvLyBUaW1lb3V0IGhhbmRsZSBmb3IgdGhlIG5leHQgcHJvY2Vzc2luZyBvZiBhbGwgcGVuZGluZyB3cml0ZXNcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlID0gbnVsbDtcblxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwgPSBvcHRpb25zLmJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWw7XG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNNYXhBZ2UgPSBvcHRpb25zLmJ1ZmZlcmVkV3JpdGVzTWF4QWdlO1xuXG4gICAgLy8gbWV0YWRhdGEgZm9yIHN1YnNjcmlwdGlvbnMuICBNYXAgZnJvbSBzdWIgSUQgdG8gb2JqZWN0IHdpdGgga2V5czpcbiAgICAvLyAgIC0gaWRcbiAgICAvLyAgIC0gbmFtZVxuICAgIC8vICAgLSBwYXJhbXNcbiAgICAvLyAgIC0gaW5hY3RpdmUgKGlmIHRydWUsIHdpbGwgYmUgY2xlYW5lZCB1cCBpZiBub3QgcmV1c2VkIGluIHJlLXJ1bilcbiAgICAvLyAgIC0gcmVhZHkgKGhhcyB0aGUgJ3JlYWR5JyBtZXNzYWdlIGJlZW4gcmVjZWl2ZWQ/KVxuICAgIC8vICAgLSByZWFkeUNhbGxiYWNrIChhbiBvcHRpb25hbCBjYWxsYmFjayB0byBjYWxsIHdoZW4gcmVhZHkpXG4gICAgLy8gICAtIGVycm9yQ2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgaWYgdGhlIHN1YiB0ZXJtaW5hdGVzIHdpdGhcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgYW4gZXJyb3IsIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xKVxuICAgIC8vICAgLSBzdG9wQ2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgd2hlbiB0aGUgc3ViIHRlcm1pbmF0ZXNcbiAgICAvLyAgICAgZm9yIGFueSByZWFzb24sIHdpdGggYW4gZXJyb3IgYXJndW1lbnQgaWYgYW4gZXJyb3IgdHJpZ2dlcmVkIHRoZSBzdG9wKVxuICAgIHNlbGYuX3N1YnNjcmlwdGlvbnMgPSB7fTtcblxuICAgIC8vIFJlYWN0aXZlIHVzZXJJZC5cbiAgICBzZWxmLl91c2VySWQgPSBudWxsO1xuICAgIHNlbGYuX3VzZXJJZERlcHMgPSBuZXcgVHJhY2tlci5EZXBlbmRlbmN5KCk7XG5cbiAgICAvLyBCbG9jayBhdXRvLXJlbG9hZCB3aGlsZSB3ZSdyZSB3YWl0aW5nIGZvciBtZXRob2QgcmVzcG9uc2VzLlxuICAgIGlmIChNZXRlb3IuaXNDbGllbnQgJiZcbiAgICAgIFBhY2thZ2UucmVsb2FkICYmXG4gICAgICAhIG9wdGlvbnMucmVsb2FkV2l0aE91dHN0YW5kaW5nKSB7XG4gICAgICBQYWNrYWdlLnJlbG9hZC5SZWxvYWQuX29uTWlncmF0ZShyZXRyeSA9PiB7XG4gICAgICAgIGlmICghIHNlbGYuX3JlYWR5VG9NaWdyYXRlKCkpIHtcbiAgICAgICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSByZXRyeTtcbiAgICAgICAgICByZXR1cm4gW2ZhbHNlXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gW3RydWVdO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLl9zdHJlYW1IYW5kbGVycyA9IG5ldyBDb25uZWN0aW9uU3RyZWFtSGFuZGxlcnModGhpcyk7XG5cbiAgICBjb25zdCBvbkRpc2Nvbm5lY3QgPSAoKSA9PiB7XG4gICAgICBpZiAodGhpcy5faGVhcnRiZWF0KSB7XG4gICAgICAgIHRoaXMuX2hlYXJ0YmVhdC5zdG9wKCk7XG4gICAgICAgIHRoaXMuX2hlYXJ0YmVhdCA9IG51bGw7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgIHRoaXMuX3N0cmVhbS5vbihcbiAgICAgICAgJ21lc3NhZ2UnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgICAgIG1zZyA9PiB0aGlzLl9zdHJlYW1IYW5kbGVycy5vbk1lc3NhZ2UobXNnKSxcbiAgICAgICAgICAnaGFuZGxpbmcgRERQIG1lc3NhZ2UnXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgICB0aGlzLl9zdHJlYW0ub24oXG4gICAgICAgICdyZXNldCcsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoXG4gICAgICAgICAgKCkgPT4gdGhpcy5fc3RyZWFtSGFuZGxlcnMub25SZXNldCgpLFxuICAgICAgICAgICdoYW5kbGluZyBERFAgcmVzZXQnXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgICB0aGlzLl9zdHJlYW0ub24oXG4gICAgICAgICdkaXNjb25uZWN0JyxcbiAgICAgICAgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChvbkRpc2Nvbm5lY3QsICdoYW5kbGluZyBERFAgZGlzY29ubmVjdCcpXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zdHJlYW0ub24oJ21lc3NhZ2UnLCBtc2cgPT4gdGhpcy5fc3RyZWFtSGFuZGxlcnMub25NZXNzYWdlKG1zZykpO1xuICAgICAgdGhpcy5fc3RyZWFtLm9uKCdyZXNldCcsICgpID0+IHRoaXMuX3N0cmVhbUhhbmRsZXJzLm9uUmVzZXQoKSk7XG4gICAgICB0aGlzLl9zdHJlYW0ub24oJ2Rpc2Nvbm5lY3QnLCBvbkRpc2Nvbm5lY3QpO1xuICAgIH1cblxuICAgIHRoaXMuX21lc3NhZ2VQcm9jZXNzb3JzID0gbmV3IE1lc3NhZ2VQcm9jZXNzb3JzKHRoaXMpO1xuXG4gICAgLy8gRXhwb3NlIG1lc3NhZ2UgcHJvY2Vzc29yIG1ldGhvZHMgdG8gbWFpbnRhaW4gYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICAgIHRoaXMuX2xpdmVkYXRhX2Nvbm5lY3RlZCA9IChtc2cpID0+IHRoaXMuX21lc3NhZ2VQcm9jZXNzb3JzLl9saXZlZGF0YV9jb25uZWN0ZWQobXNnKTtcbiAgICB0aGlzLl9saXZlZGF0YV9kYXRhID0gKG1zZykgPT4gdGhpcy5fbWVzc2FnZVByb2Nlc3NvcnMuX2xpdmVkYXRhX2RhdGEobXNnKTtcbiAgICB0aGlzLl9saXZlZGF0YV9ub3N1YiA9IChtc2cpID0+IHRoaXMuX21lc3NhZ2VQcm9jZXNzb3JzLl9saXZlZGF0YV9ub3N1Yihtc2cpO1xuICAgIHRoaXMuX2xpdmVkYXRhX3Jlc3VsdCA9IChtc2cpID0+IHRoaXMuX21lc3NhZ2VQcm9jZXNzb3JzLl9saXZlZGF0YV9yZXN1bHQobXNnKTtcbiAgICB0aGlzLl9saXZlZGF0YV9lcnJvciA9IChtc2cpID0+IHRoaXMuX21lc3NhZ2VQcm9jZXNzb3JzLl9saXZlZGF0YV9lcnJvcihtc2cpO1xuXG4gICAgdGhpcy5fZG9jdW1lbnRQcm9jZXNzb3JzID0gbmV3IERvY3VtZW50UHJvY2Vzc29ycyh0aGlzKTtcblxuICAgIC8vIEV4cG9zZSBkb2N1bWVudCBwcm9jZXNzb3IgbWV0aG9kcyB0byBtYWludGFpbiBiYWNrd2FyZCBjb21wYXRpYmlsaXR5XG4gICAgdGhpcy5fcHJvY2Vzc19hZGRlZCA9IChtc2csIHVwZGF0ZXMpID0+IHRoaXMuX2RvY3VtZW50UHJvY2Vzc29ycy5fcHJvY2Vzc19hZGRlZChtc2csIHVwZGF0ZXMpO1xuICAgIHRoaXMuX3Byb2Nlc3NfY2hhbmdlZCA9IChtc2csIHVwZGF0ZXMpID0+IHRoaXMuX2RvY3VtZW50UHJvY2Vzc29ycy5fcHJvY2Vzc19jaGFuZ2VkKG1zZywgdXBkYXRlcyk7XG4gICAgdGhpcy5fcHJvY2Vzc19yZW1vdmVkID0gKG1zZywgdXBkYXRlcykgPT4gdGhpcy5fZG9jdW1lbnRQcm9jZXNzb3JzLl9wcm9jZXNzX3JlbW92ZWQobXNnLCB1cGRhdGVzKTtcbiAgICB0aGlzLl9wcm9jZXNzX3JlYWR5ID0gKG1zZywgdXBkYXRlcykgPT4gdGhpcy5fZG9jdW1lbnRQcm9jZXNzb3JzLl9wcm9jZXNzX3JlYWR5KG1zZywgdXBkYXRlcyk7XG4gICAgdGhpcy5fcHJvY2Vzc191cGRhdGVkID0gKG1zZywgdXBkYXRlcykgPT4gdGhpcy5fZG9jdW1lbnRQcm9jZXNzb3JzLl9wcm9jZXNzX3VwZGF0ZWQobXNnLCB1cGRhdGVzKTtcblxuICAgIC8vIEFsc28gZXhwb3NlIHV0aWxpdHkgbWV0aG9kcyB1c2VkIGJ5IG90aGVyIHBhcnRzIG9mIHRoZSBzeXN0ZW1cbiAgICB0aGlzLl9wdXNoVXBkYXRlID0gKHVwZGF0ZXMsIGNvbGxlY3Rpb24sIG1zZykgPT5cbiAgICAgIHRoaXMuX2RvY3VtZW50UHJvY2Vzc29ycy5fcHVzaFVwZGF0ZSh1cGRhdGVzLCBjb2xsZWN0aW9uLCBtc2cpO1xuICAgIHRoaXMuX2dldFNlcnZlckRvYyA9IChjb2xsZWN0aW9uLCBpZCkgPT5cbiAgICAgIHRoaXMuX2RvY3VtZW50UHJvY2Vzc29ycy5fZ2V0U2VydmVyRG9jKGNvbGxlY3Rpb24sIGlkKTtcbiAgfVxuXG4gIC8vICduYW1lJyBpcyB0aGUgbmFtZSBvZiB0aGUgZGF0YSBvbiB0aGUgd2lyZSB0aGF0IHNob3VsZCBnbyBpbiB0aGVcbiAgLy8gc3RvcmUuICd3cmFwcGVkU3RvcmUnIHNob3VsZCBiZSBhbiBvYmplY3Qgd2l0aCBtZXRob2RzIGJlZ2luVXBkYXRlLCB1cGRhdGUsXG4gIC8vIGVuZFVwZGF0ZSwgc2F2ZU9yaWdpbmFscywgcmV0cmlldmVPcmlnaW5hbHMuIHNlZSBDb2xsZWN0aW9uIGZvciBhbiBleGFtcGxlLlxuICBjcmVhdGVTdG9yZU1ldGhvZHMobmFtZSwgd3JhcHBlZFN0b3JlKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAobmFtZSBpbiBzZWxmLl9zdG9yZXMpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIFdyYXAgdGhlIGlucHV0IG9iamVjdCBpbiBhbiBvYmplY3Qgd2hpY2ggbWFrZXMgYW55IHN0b3JlIG1ldGhvZCBub3RcbiAgICAvLyBpbXBsZW1lbnRlZCBieSAnc3RvcmUnIGludG8gYSBuby1vcC5cbiAgICBjb25zdCBzdG9yZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgY29uc3Qga2V5c09mU3RvcmUgPSBbXG4gICAgICAndXBkYXRlJyxcbiAgICAgICdiZWdpblVwZGF0ZScsXG4gICAgICAnZW5kVXBkYXRlJyxcbiAgICAgICdzYXZlT3JpZ2luYWxzJyxcbiAgICAgICdyZXRyaWV2ZU9yaWdpbmFscycsXG4gICAgICAnZ2V0RG9jJyxcbiAgICAgICdfZ2V0Q29sbGVjdGlvbidcbiAgICBdO1xuICAgIGtleXNPZlN0b3JlLmZvckVhY2goKG1ldGhvZCkgPT4ge1xuICAgICAgc3RvcmVbbWV0aG9kXSA9ICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGlmICh3cmFwcGVkU3RvcmVbbWV0aG9kXSkge1xuICAgICAgICAgIHJldHVybiB3cmFwcGVkU3RvcmVbbWV0aG9kXSguLi5hcmdzKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgICBzZWxmLl9zdG9yZXNbbmFtZV0gPSBzdG9yZTtcbiAgICByZXR1cm4gc3RvcmU7XG4gIH1cblxuICByZWdpc3RlclN0b3JlQ2xpZW50KG5hbWUsIHdyYXBwZWRTdG9yZSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgY29uc3Qgc3RvcmUgPSBzZWxmLmNyZWF0ZVN0b3JlTWV0aG9kcyhuYW1lLCB3cmFwcGVkU3RvcmUpO1xuXG4gICAgY29uc3QgcXVldWVkID0gc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXNbbmFtZV07XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocXVldWVkKSkge1xuICAgICAgc3RvcmUuYmVnaW5VcGRhdGUocXVldWVkLmxlbmd0aCwgZmFsc2UpO1xuICAgICAgcXVldWVkLmZvckVhY2gobXNnID0+IHtcbiAgICAgICAgc3RvcmUudXBkYXRlKG1zZyk7XG4gICAgICB9KTtcbiAgICAgIHN0b3JlLmVuZFVwZGF0ZSgpO1xuICAgICAgZGVsZXRlIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW25hbWVdO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGFzeW5jIHJlZ2lzdGVyU3RvcmVTZXJ2ZXIobmFtZSwgd3JhcHBlZFN0b3JlKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBjb25zdCBzdG9yZSA9IHNlbGYuY3JlYXRlU3RvcmVNZXRob2RzKG5hbWUsIHdyYXBwZWRTdG9yZSk7XG5cbiAgICBjb25zdCBxdWV1ZWQgPSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tuYW1lXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShxdWV1ZWQpKSB7XG4gICAgICBhd2FpdCBzdG9yZS5iZWdpblVwZGF0ZShxdWV1ZWQubGVuZ3RoLCBmYWxzZSk7XG4gICAgICBmb3IgKGNvbnN0IG1zZyBvZiBxdWV1ZWQpIHtcbiAgICAgICAgYXdhaXQgc3RvcmUudXBkYXRlKG1zZyk7XG4gICAgICB9XG4gICAgICBhd2FpdCBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgIGRlbGV0ZSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tuYW1lXTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5zdWJzY3JpYmVcbiAgICogQHN1bW1hcnkgU3Vic2NyaWJlIHRvIGEgcmVjb3JkIHNldC4gIFJldHVybnMgYSBoYW5kbGUgdGhhdCBwcm92aWRlc1xuICAgKiBgc3RvcCgpYCBhbmQgYHJlYWR5KClgIG1ldGhvZHMuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgc3Vic2NyaXB0aW9uLiAgTWF0Y2hlcyB0aGUgbmFtZSBvZiB0aGVcbiAgICogc2VydmVyJ3MgYHB1Ymxpc2goKWAgY2FsbC5cbiAgICogQHBhcmFtIHtFSlNPTmFibGV9IFthcmcxLGFyZzIuLi5dIE9wdGlvbmFsIGFyZ3VtZW50cyBwYXNzZWQgdG8gcHVibGlzaGVyXG4gICAqIGZ1bmN0aW9uIG9uIHNlcnZlci5cbiAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R9IFtjYWxsYmFja3NdIE9wdGlvbmFsLiBNYXkgaW5jbHVkZSBgb25TdG9wYFxuICAgKiBhbmQgYG9uUmVhZHlgIGNhbGxiYWNrcy4gSWYgdGhlcmUgaXMgYW4gZXJyb3IsIGl0IGlzIHBhc3NlZCBhcyBhblxuICAgKiBhcmd1bWVudCB0byBgb25TdG9wYC4gSWYgYSBmdW5jdGlvbiBpcyBwYXNzZWQgaW5zdGVhZCBvZiBhbiBvYmplY3QsIGl0XG4gICAqIGlzIGludGVycHJldGVkIGFzIGFuIGBvblJlYWR5YCBjYWxsYmFjay5cbiAgICovXG4gIHN1YnNjcmliZShuYW1lIC8qIC4uIFthcmd1bWVudHNdIC4uIChjYWxsYmFja3xjYWxsYmFja3MpICovKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBjb25zdCBwYXJhbXMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGV0IGNhbGxiYWNrcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgaWYgKHBhcmFtcy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IGxhc3RQYXJhbSA9IHBhcmFtc1twYXJhbXMubGVuZ3RoIC0gMV07XG4gICAgICBpZiAodHlwZW9mIGxhc3RQYXJhbSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFja3Mub25SZWFkeSA9IHBhcmFtcy5wb3AoKTtcbiAgICAgIH0gZWxzZSBpZiAobGFzdFBhcmFtICYmIFtcbiAgICAgICAgbGFzdFBhcmFtLm9uUmVhZHksXG4gICAgICAgIC8vIFhYWCBDT01QQVQgV0lUSCAxLjAuMy4xIG9uRXJyb3IgdXNlZCB0byBleGlzdCwgYnV0IG5vdyB3ZSB1c2VcbiAgICAgICAgLy8gb25TdG9wIHdpdGggYW4gZXJyb3IgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgICAgbGFzdFBhcmFtLm9uRXJyb3IsXG4gICAgICAgIGxhc3RQYXJhbS5vblN0b3BcbiAgICAgIF0uc29tZShmID0+IHR5cGVvZiBmID09PSBcImZ1bmN0aW9uXCIpKSB7XG4gICAgICAgIGNhbGxiYWNrcyA9IHBhcmFtcy5wb3AoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBJcyB0aGVyZSBhbiBleGlzdGluZyBzdWIgd2l0aCB0aGUgc2FtZSBuYW1lIGFuZCBwYXJhbSwgcnVuIGluIGFuXG4gICAgLy8gaW52YWxpZGF0ZWQgQ29tcHV0YXRpb24/IFRoaXMgd2lsbCBoYXBwZW4gaWYgd2UgYXJlIHJlcnVubmluZyBhblxuICAgIC8vIGV4aXN0aW5nIGNvbXB1dGF0aW9uLlxuICAgIC8vXG4gICAgLy8gRm9yIGV4YW1wbGUsIGNvbnNpZGVyIGEgcmVydW4gb2Y6XG4gICAgLy9cbiAgICAvLyAgICAgVHJhY2tlci5hdXRvcnVuKGZ1bmN0aW9uICgpIHtcbiAgICAvLyAgICAgICBNZXRlb3Iuc3Vic2NyaWJlKFwiZm9vXCIsIFNlc3Npb24uZ2V0KFwiZm9vXCIpKTtcbiAgICAvLyAgICAgICBNZXRlb3Iuc3Vic2NyaWJlKFwiYmFyXCIsIFNlc3Npb24uZ2V0KFwiYmFyXCIpKTtcbiAgICAvLyAgICAgfSk7XG4gICAgLy9cbiAgICAvLyBJZiBcImZvb1wiIGhhcyBjaGFuZ2VkIGJ1dCBcImJhclwiIGhhcyBub3QsIHdlIHdpbGwgbWF0Y2ggdGhlIFwiYmFyXCJcbiAgICAvLyBzdWJjcmliZSB0byBhbiBleGlzdGluZyBpbmFjdGl2ZSBzdWJzY3JpcHRpb24gaW4gb3JkZXIgdG8gbm90XG4gICAgLy8gdW5zdWIgYW5kIHJlc3ViIHRoZSBzdWJzY3JpcHRpb24gdW5uZWNlc3NhcmlseS5cbiAgICAvL1xuICAgIC8vIFdlIG9ubHkgbG9vayBmb3Igb25lIHN1Y2ggc3ViOyBpZiB0aGVyZSBhcmUgTiBhcHBhcmVudGx5LWlkZW50aWNhbCBzdWJzXG4gICAgLy8gYmVpbmcgaW52YWxpZGF0ZWQsIHdlIHdpbGwgcmVxdWlyZSBOIG1hdGNoaW5nIHN1YnNjcmliZSBjYWxscyB0byBrZWVwXG4gICAgLy8gdGhlbSBhbGwgYWN0aXZlLlxuICAgIGNvbnN0IGV4aXN0aW5nID0gT2JqZWN0LnZhbHVlcyhzZWxmLl9zdWJzY3JpcHRpb25zKS5maW5kKFxuICAgICAgc3ViID0+IChzdWIuaW5hY3RpdmUgJiYgc3ViLm5hbWUgPT09IG5hbWUgJiYgRUpTT04uZXF1YWxzKHN1Yi5wYXJhbXMsIHBhcmFtcykpXG4gICAgKTtcblxuICAgIGxldCBpZDtcbiAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgIGlkID0gZXhpc3RpbmcuaWQ7XG4gICAgICBleGlzdGluZy5pbmFjdGl2ZSA9IGZhbHNlOyAvLyByZWFjdGl2YXRlXG5cbiAgICAgIGlmIChjYWxsYmFja3Mub25SZWFkeSkge1xuICAgICAgICAvLyBJZiB0aGUgc3ViIGlzIG5vdCBhbHJlYWR5IHJlYWR5LCByZXBsYWNlIGFueSByZWFkeSBjYWxsYmFjayB3aXRoIHRoZVxuICAgICAgICAvLyBvbmUgcHJvdmlkZWQgbm93LiAoSXQncyBub3QgcmVhbGx5IGNsZWFyIHdoYXQgdXNlcnMgd291bGQgZXhwZWN0IGZvclxuICAgICAgICAvLyBhbiBvblJlYWR5IGNhbGxiYWNrIGluc2lkZSBhbiBhdXRvcnVuOyB0aGUgc2VtYW50aWNzIHdlIHByb3ZpZGUgaXNcbiAgICAgICAgLy8gdGhhdCBhdCB0aGUgdGltZSB0aGUgc3ViIGZpcnN0IGJlY29tZXMgcmVhZHksIHdlIGNhbGwgdGhlIGxhc3RcbiAgICAgICAgLy8gb25SZWFkeSBjYWxsYmFjayBwcm92aWRlZCwgaWYgYW55LilcbiAgICAgICAgLy8gSWYgdGhlIHN1YiBpcyBhbHJlYWR5IHJlYWR5LCBydW4gdGhlIHJlYWR5IGNhbGxiYWNrIHJpZ2h0IGF3YXkuXG4gICAgICAgIC8vIEl0IHNlZW1zIHRoYXQgdXNlcnMgd291bGQgZXhwZWN0IGFuIG9uUmVhZHkgY2FsbGJhY2sgaW5zaWRlIGFuXG4gICAgICAgIC8vIGF1dG9ydW4gdG8gdHJpZ2dlciBvbmNlIHRoZSBzdWIgZmlyc3QgYmVjb21lcyByZWFkeSBhbmQgYWxzb1xuICAgICAgICAvLyB3aGVuIHJlLXN1YnMgaGFwcGVucy5cbiAgICAgICAgaWYgKGV4aXN0aW5nLnJlYWR5KSB7XG4gICAgICAgICAgY2FsbGJhY2tzLm9uUmVhZHkoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBleGlzdGluZy5yZWFkeUNhbGxiYWNrID0gY2FsbGJhY2tzLm9uUmVhZHk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgd2UgdXNlZCB0byBoYXZlIG9uRXJyb3IgYnV0IG5vdyB3ZSBjYWxsXG4gICAgICAvLyBvblN0b3Agd2l0aCBhbiBvcHRpb25hbCBlcnJvciBhcmd1bWVudFxuICAgICAgaWYgKGNhbGxiYWNrcy5vbkVycm9yKSB7XG4gICAgICAgIC8vIFJlcGxhY2UgZXhpc3RpbmcgY2FsbGJhY2sgaWYgYW55LCBzbyB0aGF0IGVycm9ycyBhcmVuJ3RcbiAgICAgICAgLy8gZG91YmxlLXJlcG9ydGVkLlxuICAgICAgICBleGlzdGluZy5lcnJvckNhbGxiYWNrID0gY2FsbGJhY2tzLm9uRXJyb3I7XG4gICAgICB9XG5cbiAgICAgIGlmIChjYWxsYmFja3Mub25TdG9wKSB7XG4gICAgICAgIGV4aXN0aW5nLnN0b3BDYWxsYmFjayA9IGNhbGxiYWNrcy5vblN0b3A7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5ldyBzdWIhIEdlbmVyYXRlIGFuIGlkLCBzYXZlIGl0IGxvY2FsbHksIGFuZCBzZW5kIG1lc3NhZ2UuXG4gICAgICBpZCA9IFJhbmRvbS5pZCgpO1xuICAgICAgc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF0gPSB7XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgcGFyYW1zOiBFSlNPTi5jbG9uZShwYXJhbXMpLFxuICAgICAgICBpbmFjdGl2ZTogZmFsc2UsXG4gICAgICAgIHJlYWR5OiBmYWxzZSxcbiAgICAgICAgcmVhZHlEZXBzOiBuZXcgVHJhY2tlci5EZXBlbmRlbmN5KCksXG4gICAgICAgIHJlYWR5Q2FsbGJhY2s6IGNhbGxiYWNrcy5vblJlYWR5LFxuICAgICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSAjZXJyb3JDYWxsYmFja1xuICAgICAgICBlcnJvckNhbGxiYWNrOiBjYWxsYmFja3Mub25FcnJvcixcbiAgICAgICAgc3RvcENhbGxiYWNrOiBjYWxsYmFja3Mub25TdG9wLFxuICAgICAgICBjb25uZWN0aW9uOiBzZWxmLFxuICAgICAgICByZW1vdmUoKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbi5fc3Vic2NyaXB0aW9uc1t0aGlzLmlkXTtcbiAgICAgICAgICB0aGlzLnJlYWR5ICYmIHRoaXMucmVhZHlEZXBzLmNoYW5nZWQoKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3RvcCgpIHtcbiAgICAgICAgICB0aGlzLmNvbm5lY3Rpb24uX3NlbmRRdWV1ZWQoeyBtc2c6ICd1bnN1YicsIGlkOiBpZCB9KTtcbiAgICAgICAgICB0aGlzLnJlbW92ZSgpO1xuXG4gICAgICAgICAgaWYgKGNhbGxiYWNrcy5vblN0b3ApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5vblN0b3AoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzZWxmLl9zZW5kKHsgbXNnOiAnc3ViJywgaWQ6IGlkLCBuYW1lOiBuYW1lLCBwYXJhbXM6IHBhcmFtcyB9KTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gYSBoYW5kbGUgdG8gdGhlIGFwcGxpY2F0aW9uLlxuICAgIGNvbnN0IGhhbmRsZSA9IHtcbiAgICAgIHN0b3AoKSB7XG4gICAgICAgIGlmICghIGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXS5zdG9wKCk7XG4gICAgICB9LFxuICAgICAgcmVhZHkoKSB7XG4gICAgICAgIC8vIHJldHVybiBmYWxzZSBpZiB3ZSd2ZSB1bnN1YnNjcmliZWQuXG4gICAgICAgIGlmICghaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlY29yZCA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdO1xuICAgICAgICByZWNvcmQucmVhZHlEZXBzLmRlcGVuZCgpO1xuICAgICAgICByZXR1cm4gcmVjb3JkLnJlYWR5O1xuICAgICAgfSxcbiAgICAgIHN1YnNjcmlwdGlvbklkOiBpZFxuICAgIH07XG5cbiAgICBpZiAoVHJhY2tlci5hY3RpdmUpIHtcbiAgICAgIC8vIFdlJ3JlIGluIGEgcmVhY3RpdmUgY29tcHV0YXRpb24sIHNvIHdlJ2QgbGlrZSB0byB1bnN1YnNjcmliZSB3aGVuIHRoZVxuICAgICAgLy8gY29tcHV0YXRpb24gaXMgaW52YWxpZGF0ZWQuLi4gYnV0IG5vdCBpZiB0aGUgcmVydW4ganVzdCByZS1zdWJzY3JpYmVzXG4gICAgICAvLyB0byB0aGUgc2FtZSBzdWJzY3JpcHRpb24hICBXaGVuIGEgcmVydW4gaGFwcGVucywgd2UgdXNlIG9uSW52YWxpZGF0ZVxuICAgICAgLy8gYXMgYSBjaGFuZ2UgdG8gbWFyayB0aGUgc3Vic2NyaXB0aW9uIFwiaW5hY3RpdmVcIiBzbyB0aGF0IGl0IGNhblxuICAgICAgLy8gYmUgcmV1c2VkIGZyb20gdGhlIHJlcnVuLiAgSWYgaXQgaXNuJ3QgcmV1c2VkLCBpdCdzIGtpbGxlZCBmcm9tXG4gICAgICAvLyBhbiBhZnRlckZsdXNoLlxuICAgICAgVHJhY2tlci5vbkludmFsaWRhdGUoKGMpID0+IHtcbiAgICAgICAgaWYgKGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSkge1xuICAgICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLmluYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIFRyYWNrZXIuYWZ0ZXJGbHVzaCgoKSA9PiB7XG4gICAgICAgICAgaWYgKGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSAmJlxuICAgICAgICAgICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXS5pbmFjdGl2ZSkge1xuICAgICAgICAgICAgaGFuZGxlLnN0b3AoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhbmRsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBUZWxscyBpZiB0aGUgbWV0aG9kIGNhbGwgY2FtZSBmcm9tIGEgY2FsbCBvciBhIGNhbGxBc3luYy5cbiAgICogQGFsaWFzIE1ldGVvci5pc0FzeW5jQ2FsbFxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEByZXR1cm5zIGJvb2xlYW5cbiAgICovXG4gIGlzQXN5bmNDYWxsKCl7XG4gICAgcmV0dXJuIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpXG4gIH1cbiAgbWV0aG9kcyhtZXRob2RzKSB7XG4gICAgT2JqZWN0LmVudHJpZXMobWV0aG9kcykuZm9yRWFjaCgoW25hbWUsIGZ1bmNdKSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdcIiArIG5hbWUgKyBcIicgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX21ldGhvZEhhbmRsZXJzW25hbWVdKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbWV0aG9kIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkXCIpO1xuICAgICAgfVxuICAgICAgdGhpcy5fbWV0aG9kSGFuZGxlcnNbbmFtZV0gPSBmdW5jO1xuICAgIH0pO1xuICB9XG5cbiAgX2dldElzU2ltdWxhdGlvbih7aXNGcm9tQ2FsbEFzeW5jLCBhbHJlYWR5SW5TaW11bGF0aW9ufSkge1xuICAgIGlmICghaXNGcm9tQ2FsbEFzeW5jKSB7XG4gICAgICByZXR1cm4gYWxyZWFkeUluU2ltdWxhdGlvbjtcbiAgICB9XG4gICAgcmV0dXJuIGFscmVhZHlJblNpbXVsYXRpb24gJiYgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5faXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nKCk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuY2FsbFxuICAgKiBAc3VtbWFyeSBJbnZva2VzIGEgbWV0aG9kIHdpdGggYSBzeW5jIHN0dWIsIHBhc3NpbmcgYW55IG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGV9IFthcmcxLGFyZzIuLi5dIE9wdGlvbmFsIG1ldGhvZCBhcmd1bWVudHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2FzeW5jQ2FsbGJhY2tdIE9wdGlvbmFsIGNhbGxiYWNrLCB3aGljaCBpcyBjYWxsZWQgYXN5bmNocm9ub3VzbHkgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IGFmdGVyIHRoZSBtZXRob2QgaXMgY29tcGxldGUuIElmIG5vdCBwcm92aWRlZCwgdGhlIG1ldGhvZCBydW5zIHN5bmNocm9ub3VzbHkgaWYgcG9zc2libGUgKHNlZSBiZWxvdykuXG4gICAqL1xuICBjYWxsKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gY2FsbGJhY2sgKi8pIHtcbiAgICAvLyBpZiBpdCdzIGEgZnVuY3Rpb24sIHRoZSBsYXN0IGFyZ3VtZW50IGlzIHRoZSByZXN1bHQgY2FsbGJhY2ssXG4gICAgLy8gbm90IGEgcGFyYW1ldGVyIHRvIHRoZSByZW1vdGUgbWV0aG9kLlxuICAgIGNvbnN0IGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGV0IGNhbGxiYWNrO1xuICAgIGlmIChhcmdzLmxlbmd0aCAmJiB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFwcGx5KG5hbWUsIGFyZ3MsIGNhbGxiYWNrKTtcbiAgfVxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuY2FsbEFzeW5jXG4gICAqIEBzdW1tYXJ5IEludm9rZXMgYSBtZXRob2Qgd2l0aCBhbiBhc3luYyBzdHViLCBwYXNzaW5nIGFueSBudW1iZXIgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlfSBbYXJnMSxhcmcyLi4uXSBPcHRpb25hbCBtZXRob2QgYXJndW1lbnRzXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgY2FsbEFzeW5jKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gKi8pIHtcbiAgICBjb25zdCBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGlmIChhcmdzLmxlbmd0aCAmJiB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiTWV0ZW9yLmNhbGxBc3luYygpIGRvZXMgbm90IGFjY2VwdCBhIGNhbGxiYWNrLiBZb3Ugc2hvdWxkICdhd2FpdCcgdGhlIHJlc3VsdCwgb3IgdXNlIC50aGVuKCkuXCJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCB7IHJldHVyblNlcnZlclJlc3VsdFByb21pc2U6IHRydWUgfSk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuYXBwbHlcbiAgICogQHN1bW1hcnkgSW52b2tlIGEgbWV0aG9kIHBhc3NpbmcgYW4gYXJyYXkgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlW119IGFyZ3MgTWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy53YWl0IChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCB1bnRpbCBhbGwgcHJldmlvdXMgbWV0aG9kIGNhbGxzIGhhdmUgY29tcGxldGVkLCBhbmQgZG9uJ3Qgc2VuZCBhbnkgc3Vic2VxdWVudCBtZXRob2QgY2FsbHMgdW50aWwgdGhpcyBvbmUgaXMgY29tcGxldGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgKENsaWVudCBvbmx5KSBUaGlzIGNhbGxiYWNrIGlzIGludm9rZWQgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IG9mIHRoZSBtZXRob2QgKGp1c3QgbGlrZSBgYXN5bmNDYWxsYmFja2ApIGFzIHNvb24gYXMgdGhlIGVycm9yIG9yIHJlc3VsdCBpcyBhdmFpbGFibGUuIFRoZSBsb2NhbCBjYWNoZSBtYXkgbm90IHlldCByZWZsZWN0IHRoZSB3cml0ZXMgcGVyZm9ybWVkIGJ5IHRoZSBtZXRob2QuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5ub1JldHJ5IChDbGllbnQgb25seSkgaWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCBhZ2FpbiBvbiByZWxvYWQsIHNpbXBseSBjYWxsIHRoZSBjYWxsYmFjayBhbiBlcnJvciB3aXRoIHRoZSBlcnJvciBjb2RlICdpbnZvY2F0aW9uLWZhaWxlZCcuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy50aHJvd1N0dWJFeGNlcHRpb25zIChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZXhjZXB0aW9ucyB0aHJvd24gYnkgbWV0aG9kIHN0dWJzIHdpbGwgYmUgdGhyb3duIGluc3RlYWQgb2YgbG9nZ2VkLCBhbmQgdGhlIG1ldGhvZCB3aWxsIG5vdCBiZSBpbnZva2VkIG9uIHRoZSBzZXJ2ZXIuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZXR1cm5TdHViVmFsdWUgKENsaWVudCBvbmx5KSBJZiB0cnVlIHRoZW4gaW4gY2FzZXMgd2hlcmUgd2Ugd291bGQgaGF2ZSBvdGhlcndpc2UgZGlzY2FyZGVkIHRoZSBzdHViJ3MgcmV0dXJuIHZhbHVlIGFuZCByZXR1cm5lZCB1bmRlZmluZWQsIGluc3RlYWQgd2UgZ28gYWhlYWQgYW5kIHJldHVybiBpdC4gU3BlY2lmaWNhbGx5LCB0aGlzIGlzIGFueSB0aW1lIG90aGVyIHRoYW4gd2hlbiAoYSkgd2UgYXJlIGFscmVhZHkgaW5zaWRlIGEgc3R1YiBvciAoYikgd2UgYXJlIGluIE5vZGUgYW5kIG5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZC4gQ3VycmVudGx5IHdlIHJlcXVpcmUgdGhpcyBmbGFnIHRvIGJlIGV4cGxpY2l0bHkgcGFzc2VkIHRvIHJlZHVjZSB0aGUgbGlrZWxpaG9vZCB0aGF0IHN0dWIgcmV0dXJuIHZhbHVlcyB3aWxsIGJlIGNvbmZ1c2VkIHdpdGggc2VydmVyIHJldHVybiB2YWx1ZXM7IHdlIG1heSBpbXByb3ZlIHRoaXMgaW4gZnV0dXJlLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbYXN5bmNDYWxsYmFja10gT3B0aW9uYWwgY2FsbGJhY2s7IHNhbWUgc2VtYW50aWNzIGFzIGluIFtgTWV0ZW9yLmNhbGxgXSgjbWV0ZW9yX2NhbGwpLlxuICAgKi9cbiAgYXBwbHkobmFtZSwgYXJncywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCB7IHN0dWJJbnZvY2F0aW9uLCBpbnZvY2F0aW9uLCAuLi5zdHViT3B0aW9ucyB9ID0gdGhpcy5fc3R1YkNhbGwobmFtZSwgRUpTT04uY2xvbmUoYXJncykpO1xuXG4gICAgaWYgKHN0dWJPcHRpb25zLmhhc1N0dWIpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbjogc3R1Yk9wdGlvbnMuYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgICAgICBpc0Zyb21DYWxsQXN5bmM6IHN0dWJPcHRpb25zLmlzRnJvbUNhbGxBc3luYyxcbiAgICAgICAgfSlcbiAgICAgICkge1xuICAgICAgICB0aGlzLl9zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBzdHViT3B0aW9ucy5zdHViUmV0dXJuVmFsdWUgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uXG4gICAgICAgICAgLndpdGhWYWx1ZShpbnZvY2F0aW9uLCBzdHViSW52b2NhdGlvbik7XG4gICAgICAgIGlmIChNZXRlb3IuX2lzUHJvbWlzZShzdHViT3B0aW9ucy5zdHViUmV0dXJuVmFsdWUpKSB7XG4gICAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICAgICAgICAgIGBNZXRob2QgJHtuYW1lfTogQ2FsbGluZyBhIG1ldGhvZCB0aGF0IGhhcyBhbiBhc3luYyBtZXRob2Qgc3R1YiB3aXRoIGNhbGwvYXBwbHkgY2FuIGxlYWQgdG8gdW5leHBlY3RlZCBiZWhhdmlvcnMuIFVzZSBjYWxsQXN5bmMvYXBwbHlBc3luYyBpbnN0ZWFkLmBcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHN0dWJPcHRpb25zLmV4Y2VwdGlvbiA9IGU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9hcHBseShuYW1lLCBzdHViT3B0aW9ucywgYXJncywgb3B0aW9ucywgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLmFwcGx5QXN5bmNcbiAgICogQHN1bW1hcnkgSW52b2tlIGEgbWV0aG9kIHBhc3NpbmcgYW4gYXJyYXkgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlW119IGFyZ3MgTWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy53YWl0IChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCB1bnRpbCBhbGwgcHJldmlvdXMgbWV0aG9kIGNhbGxzIGhhdmUgY29tcGxldGVkLCBhbmQgZG9uJ3Qgc2VuZCBhbnkgc3Vic2VxdWVudCBtZXRob2QgY2FsbHMgdW50aWwgdGhpcyBvbmUgaXMgY29tcGxldGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgKENsaWVudCBvbmx5KSBUaGlzIGNhbGxiYWNrIGlzIGludm9rZWQgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IG9mIHRoZSBtZXRob2QgKGp1c3QgbGlrZSBgYXN5bmNDYWxsYmFja2ApIGFzIHNvb24gYXMgdGhlIGVycm9yIG9yIHJlc3VsdCBpcyBhdmFpbGFibGUuIFRoZSBsb2NhbCBjYWNoZSBtYXkgbm90IHlldCByZWZsZWN0IHRoZSB3cml0ZXMgcGVyZm9ybWVkIGJ5IHRoZSBtZXRob2QuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5ub1JldHJ5IChDbGllbnQgb25seSkgaWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCBhZ2FpbiBvbiByZWxvYWQsIHNpbXBseSBjYWxsIHRoZSBjYWxsYmFjayBhbiBlcnJvciB3aXRoIHRoZSBlcnJvciBjb2RlICdpbnZvY2F0aW9uLWZhaWxlZCcuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy50aHJvd1N0dWJFeGNlcHRpb25zIChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZXhjZXB0aW9ucyB0aHJvd24gYnkgbWV0aG9kIHN0dWJzIHdpbGwgYmUgdGhyb3duIGluc3RlYWQgb2YgbG9nZ2VkLCBhbmQgdGhlIG1ldGhvZCB3aWxsIG5vdCBiZSBpbnZva2VkIG9uIHRoZSBzZXJ2ZXIuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZXR1cm5TdHViVmFsdWUgKENsaWVudCBvbmx5KSBJZiB0cnVlIHRoZW4gaW4gY2FzZXMgd2hlcmUgd2Ugd291bGQgaGF2ZSBvdGhlcndpc2UgZGlzY2FyZGVkIHRoZSBzdHViJ3MgcmV0dXJuIHZhbHVlIGFuZCByZXR1cm5lZCB1bmRlZmluZWQsIGluc3RlYWQgd2UgZ28gYWhlYWQgYW5kIHJldHVybiBpdC4gU3BlY2lmaWNhbGx5LCB0aGlzIGlzIGFueSB0aW1lIG90aGVyIHRoYW4gd2hlbiAoYSkgd2UgYXJlIGFscmVhZHkgaW5zaWRlIGEgc3R1YiBvciAoYikgd2UgYXJlIGluIE5vZGUgYW5kIG5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZC4gQ3VycmVudGx5IHdlIHJlcXVpcmUgdGhpcyBmbGFnIHRvIGJlIGV4cGxpY2l0bHkgcGFzc2VkIHRvIHJlZHVjZSB0aGUgbGlrZWxpaG9vZCB0aGF0IHN0dWIgcmV0dXJuIHZhbHVlcyB3aWxsIGJlIGNvbmZ1c2VkIHdpdGggc2VydmVyIHJldHVybiB2YWx1ZXM7IHdlIG1heSBpbXByb3ZlIHRoaXMgaW4gZnV0dXJlLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmV0dXJuU2VydmVyUmVzdWx0UHJvbWlzZSAoQ2xpZW50IG9ubHkpIElmIHRydWUsIHRoZSBwcm9taXNlIHJldHVybmVkIGJ5IGFwcGx5QXN5bmMgd2lsbCByZXNvbHZlIHRvIHRoZSBzZXJ2ZXIncyByZXR1cm4gdmFsdWUsIHJhdGhlciB0aGFuIHRoZSBzdHViJ3MgcmV0dXJuIHZhbHVlLiBUaGlzIGlzIHVzZWZ1bCB3aGVuIHlvdSB3YW50IHRvIGVuc3VyZSB0aGF0IHRoZSBzZXJ2ZXIncyByZXR1cm4gdmFsdWUgaXMgdXNlZCwgZXZlbiBpZiB0aGUgc3R1YiByZXR1cm5zIGEgcHJvbWlzZS4gVGhlIHNhbWUgYmVoYXZpb3IgYXMgYGNhbGxBc3luY2AuXG4gICAqL1xuICBhcHBseUFzeW5jKG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrID0gbnVsbCkge1xuICAgIGNvbnN0IHN0dWJQcm9taXNlID0gdGhpcy5fYXBwbHlBc3luY1N0dWJJbnZvY2F0aW9uKG5hbWUsIGFyZ3MsIG9wdGlvbnMpO1xuXG4gICAgY29uc3QgcHJvbWlzZSA9IHRoaXMuX2FwcGx5QXN5bmMoe1xuICAgICAgbmFtZSxcbiAgICAgIGFyZ3MsXG4gICAgICBvcHRpb25zLFxuICAgICAgY2FsbGJhY2ssXG4gICAgICBzdHViUHJvbWlzZSxcbiAgICB9KTtcbiAgICBpZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XG4gICAgICAvLyBvbmx5IHJldHVybiB0aGUgc3R1YlJldHVyblZhbHVlXG4gICAgICBwcm9taXNlLnN0dWJQcm9taXNlID0gc3R1YlByb21pc2UudGhlbihvID0+IHtcbiAgICAgICAgaWYgKG8uZXhjZXB0aW9uKSB7XG4gICAgICAgICAgdGhyb3cgby5leGNlcHRpb247XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG8uc3R1YlJldHVyblZhbHVlO1xuICAgICAgfSk7XG4gICAgICAvLyB0aGlzIGF2b2lkcyBhdHRyaWJ1dGUgcmVjdXJzaW9uXG4gICAgICBwcm9taXNlLnNlcnZlclByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgICAgICBwcm9taXNlLnRoZW4ocmVzb2x2ZSkuY2F0Y2gocmVqZWN0KSxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBwcm9taXNlO1xuICB9XG4gIGFzeW5jIF9hcHBseUFzeW5jU3R1Ykludm9jYXRpb24obmFtZSwgYXJncywgb3B0aW9ucykge1xuICAgIGNvbnN0IHsgc3R1Ykludm9jYXRpb24sIGludm9jYXRpb24sIC4uLnN0dWJPcHRpb25zIH0gPSB0aGlzLl9zdHViQ2FsbChuYW1lLCBFSlNPTi5jbG9uZShhcmdzKSwgb3B0aW9ucyk7XG4gICAgaWYgKHN0dWJPcHRpb25zLmhhc1N0dWIpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbjogc3R1Yk9wdGlvbnMuYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgICAgICBpc0Zyb21DYWxsQXN5bmM6IHN0dWJPcHRpb25zLmlzRnJvbUNhbGxBc3luYyxcbiAgICAgICAgfSlcbiAgICAgICkge1xuICAgICAgICB0aGlzLl9zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICAvKlxuICAgICAgICAgKiBUaGUgY29kZSBiZWxvdyBmb2xsb3dzIHRoZSBzYW1lIGxvZ2ljIGFzIHRoZSBmdW5jdGlvbiB3aXRoVmFsdWVzKCkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEJ1dCBhcyB0aGUgTWV0ZW9yIHBhY2thZ2UgaXMgbm90IGNvbXBpbGVkIGJ5IGVjbWFzY3JpcHQsIGl0IGlzIHVuYWJsZSB0byB1c2UgbmV3ZXIgc3ludGF4IGluIHRoZSBicm93c2VyLFxuICAgICAgICAgKiBzdWNoIGFzLCB0aGUgYXN5bmMvYXdhaXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIFNvLCB0byBrZWVwIHN1cHBvcnRpbmcgb2xkIGJyb3dzZXJzLCBsaWtlIElFIDExLCB3ZSdyZSBjcmVhdGluZyB0aGUgbG9naWMgb25lIGxldmVsIGFib3ZlLlxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3QgY3VycmVudENvbnRleHQgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLl9zZXROZXdDb250ZXh0QW5kR2V0Q3VycmVudChcbiAgICAgICAgICBpbnZvY2F0aW9uXG4gICAgICAgICk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgc3R1Yk9wdGlvbnMuc3R1YlJldHVyblZhbHVlID0gYXdhaXQgc3R1Ykludm9jYXRpb24oKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIHN0dWJPcHRpb25zLmV4Y2VwdGlvbiA9IGU7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5fc2V0KGN1cnJlbnRDb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzdHViT3B0aW9ucy5leGNlcHRpb24gPSBlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3R1Yk9wdGlvbnM7XG4gIH1cbiAgYXN5bmMgX2FwcGx5QXN5bmMoeyBuYW1lLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjaywgc3R1YlByb21pc2UgfSkge1xuICAgIGNvbnN0IHN0dWJPcHRpb25zID0gYXdhaXQgc3R1YlByb21pc2U7XG4gICAgcmV0dXJuIHRoaXMuX2FwcGx5KG5hbWUsIHN0dWJPcHRpb25zLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjayk7XG4gIH1cblxuICBfYXBwbHkobmFtZSwgc3R1YkNhbGxWYWx1ZSwgYXJncywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIC8vIFdlIHdlcmUgcGFzc2VkIDMgYXJndW1lbnRzLiBUaGV5IG1heSBiZSBlaXRoZXIgKG5hbWUsIGFyZ3MsIG9wdGlvbnMpXG4gICAgLy8gb3IgKG5hbWUsIGFyZ3MsIGNhbGxiYWNrKVxuICAgIGlmICghY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIH1cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAvLyBYWFggd291bGQgaXQgYmUgYmV0dGVyIGZvcm0gdG8gZG8gdGhlIGJpbmRpbmcgaW4gc3RyZWFtLm9uLFxuICAgICAgLy8gb3IgY2FsbGVyLCBpbnN0ZWFkIG9mIGhlcmU/XG4gICAgICAvLyBYWFggaW1wcm92ZSBlcnJvciBtZXNzYWdlIChhbmQgaG93IHdlIHJlcG9ydCBpdClcbiAgICAgIGNhbGxiYWNrID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgICAgY2FsbGJhY2ssXG4gICAgICAgIFwiZGVsaXZlcmluZyByZXN1bHQgb2YgaW52b2tpbmcgJ1wiICsgbmFtZSArIFwiJ1wiXG4gICAgICApO1xuICAgIH1cbiAgICBjb25zdCB7XG4gICAgICBoYXNTdHViLFxuICAgICAgZXhjZXB0aW9uLFxuICAgICAgc3R1YlJldHVyblZhbHVlLFxuICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgIHJhbmRvbVNlZWQsXG4gICAgfSA9IHN0dWJDYWxsVmFsdWU7XG5cbiAgICAvLyBLZWVwIG91ciBhcmdzIHNhZmUgZnJvbSBtdXRhdGlvbiAoZWcgaWYgd2UgZG9uJ3Qgc2VuZCB0aGUgbWVzc2FnZSBmb3IgYVxuICAgIC8vIHdoaWxlIGJlY2F1c2Ugb2YgYSB3YWl0IG1ldGhvZCkuXG4gICAgYXJncyA9IEVKU09OLmNsb25lKGFyZ3MpO1xuICAgIC8vIElmIHdlJ3JlIGluIGEgc2ltdWxhdGlvbiwgc3RvcCBhbmQgcmV0dXJuIHRoZSByZXN1bHQgd2UgaGF2ZSxcbiAgICAvLyByYXRoZXIgdGhhbiBnb2luZyBvbiB0byBkbyBhbiBSUEMuIElmIHRoZXJlIHdhcyBubyBzdHViLFxuICAgIC8vIHdlJ2xsIGVuZCB1cCByZXR1cm5pbmcgdW5kZWZpbmVkLlxuICAgIGlmIChcbiAgICAgIHRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgIGFscmVhZHlJblNpbXVsYXRpb24sXG4gICAgICAgIGlzRnJvbUNhbGxBc3luYzogc3R1YkNhbGxWYWx1ZS5pc0Zyb21DYWxsQXN5bmMsXG4gICAgICB9KVxuICAgICkge1xuICAgICAgbGV0IHJlc3VsdDtcblxuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGV4Y2VwdGlvbiwgc3R1YlJldHVyblZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChleGNlcHRpb24pIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgICAgcmVzdWx0ID0gc3R1YlJldHVyblZhbHVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gb3B0aW9ucy5fcmV0dXJuTWV0aG9kSW52b2tlciA/IHsgcmVzdWx0IH0gOiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLy8gV2Ugb25seSBjcmVhdGUgdGhlIG1ldGhvZElkIGhlcmUgYmVjYXVzZSB3ZSBkb24ndCBhY3R1YWxseSBuZWVkIG9uZSBpZlxuICAgIC8vIHdlJ3JlIGFscmVhZHkgaW4gYSBzaW11bGF0aW9uXG4gICAgY29uc3QgbWV0aG9kSWQgPSAnJyArIHNlbGYuX25leHRNZXRob2RJZCsrO1xuICAgIGlmIChoYXNTdHViKSB7XG4gICAgICBzZWxmLl9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSB0aGUgRERQIG1lc3NhZ2UgZm9yIHRoZSBtZXRob2QgY2FsbC4gTm90ZSB0aGF0IG9uIHRoZSBjbGllbnQsXG4gICAgLy8gaXQgaXMgaW1wb3J0YW50IHRoYXQgdGhlIHN0dWIgaGF2ZSBmaW5pc2hlZCBiZWZvcmUgd2Ugc2VuZCB0aGUgUlBDLCBzb1xuICAgIC8vIHRoYXQgd2Uga25vdyB3ZSBoYXZlIGEgY29tcGxldGUgbGlzdCBvZiB3aGljaCBsb2NhbCBkb2N1bWVudHMgdGhlIHN0dWJcbiAgICAvLyB3cm90ZS5cbiAgICBjb25zdCBtZXNzYWdlID0ge1xuICAgICAgbXNnOiAnbWV0aG9kJyxcbiAgICAgIGlkOiBtZXRob2RJZCxcbiAgICAgIG1ldGhvZDogbmFtZSxcbiAgICAgIHBhcmFtczogYXJnc1xuICAgIH07XG5cbiAgICAvLyBJZiBhbiBleGNlcHRpb24gb2NjdXJyZWQgaW4gYSBzdHViLCBhbmQgd2UncmUgaWdub3JpbmcgaXRcbiAgICAvLyBiZWNhdXNlIHdlJ3JlIGRvaW5nIGFuIFJQQyBhbmQgd2FudCB0byB1c2Ugd2hhdCB0aGUgc2VydmVyXG4gICAgLy8gcmV0dXJucyBpbnN0ZWFkLCBsb2cgaXQgc28gdGhlIGRldmVsb3BlciBrbm93c1xuICAgIC8vICh1bmxlc3MgdGhleSBleHBsaWNpdGx5IGFzayB0byBzZWUgdGhlIGVycm9yKS5cbiAgICAvL1xuICAgIC8vIFRlc3RzIGNhbiBzZXQgdGhlICdfZXhwZWN0ZWRCeVRlc3QnIGZsYWcgb24gYW4gZXhjZXB0aW9uIHNvIGl0IHdvbid0XG4gICAgLy8gZ28gdG8gbG9nLlxuICAgIGlmIChleGNlcHRpb24pIHtcbiAgICAgIGlmIChvcHRpb25zLnRocm93U3R1YkV4Y2VwdGlvbnMpIHtcbiAgICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgICAgfSBlbHNlIGlmICghZXhjZXB0aW9uLl9leHBlY3RlZEJ5VGVzdCkge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKFxuICAgICAgICAgIFwiRXhjZXB0aW9uIHdoaWxlIHNpbXVsYXRpbmcgdGhlIGVmZmVjdCBvZiBpbnZva2luZyAnXCIgKyBuYW1lICsgXCInXCIsXG4gICAgICAgICAgZXhjZXB0aW9uXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQXQgdGhpcyBwb2ludCB3ZSdyZSBkZWZpbml0ZWx5IGRvaW5nIGFuIFJQQywgYW5kIHdlJ3JlIGdvaW5nIHRvXG4gICAgLy8gcmV0dXJuIHRoZSB2YWx1ZSBvZiB0aGUgUlBDIHRvIHRoZSBjYWxsZXIuXG5cbiAgICAvLyBJZiB0aGUgY2FsbGVyIGRpZG4ndCBnaXZlIGEgY2FsbGJhY2ssIGRlY2lkZSB3aGF0IHRvIGRvLlxuICAgIGxldCBwcm9taXNlO1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGlmIChcbiAgICAgICAgTWV0ZW9yLmlzQ2xpZW50ICYmXG4gICAgICAgICFvcHRpb25zLnJldHVyblNlcnZlclJlc3VsdFByb21pc2UgJiZcbiAgICAgICAgKCFvcHRpb25zLmlzRnJvbUNhbGxBc3luYyB8fCBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSlcbiAgICAgICkge1xuICAgICAgICBjYWxsYmFjayA9IChlcnIpID0+IHtcbiAgICAgICAgICBlcnIgJiYgTWV0ZW9yLl9kZWJ1ZyhcIkVycm9yIGludm9raW5nIE1ldGhvZCAnXCIgKyBuYW1lICsgXCInXCIsIGVycik7XG4gICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGNhbGxiYWNrID0gKC4uLmFsbEFyZ3MpID0+IHtcbiAgICAgICAgICAgIGxldCBhcmdzID0gQXJyYXkuZnJvbShhbGxBcmdzKTtcbiAgICAgICAgICAgIGxldCBlcnIgPSBhcmdzLnNoaWZ0KCk7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXNvbHZlKC4uLmFyZ3MpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNlbmQgdGhlIHJhbmRvbVNlZWQgb25seSBpZiB3ZSB1c2VkIGl0XG4gICAgaWYgKHJhbmRvbVNlZWQudmFsdWUgIT09IG51bGwpIHtcbiAgICAgIG1lc3NhZ2UucmFuZG9tU2VlZCA9IHJhbmRvbVNlZWQudmFsdWU7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kSW52b2tlciA9IG5ldyBNZXRob2RJbnZva2VyKHtcbiAgICAgIG1ldGhvZElkLFxuICAgICAgY2FsbGJhY2s6IGNhbGxiYWNrLFxuICAgICAgY29ubmVjdGlvbjogc2VsZixcbiAgICAgIG9uUmVzdWx0UmVjZWl2ZWQ6IG9wdGlvbnMub25SZXN1bHRSZWNlaXZlZCxcbiAgICAgIHdhaXQ6ICEhb3B0aW9ucy53YWl0LFxuICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgIG5vUmV0cnk6ICEhb3B0aW9ucy5ub1JldHJ5XG4gICAgfSk7XG5cbiAgICBsZXQgcmVzdWx0O1xuXG4gICAgaWYgKHByb21pc2UpIHtcbiAgICAgIHJlc3VsdCA9IG9wdGlvbnMucmV0dXJuU3R1YlZhbHVlID8gcHJvbWlzZS50aGVuKCgpID0+IHN0dWJSZXR1cm5WYWx1ZSkgOiBwcm9taXNlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSA/IHN0dWJSZXR1cm5WYWx1ZSA6IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5fcmV0dXJuTWV0aG9kSW52b2tlcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWV0aG9kSW52b2tlcixcbiAgICAgICAgcmVzdWx0LFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBzZWxmLl9hZGRPdXRzdGFuZGluZ01ldGhvZChtZXRob2RJbnZva2VyLCBvcHRpb25zKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgX3N0dWJDYWxsKG5hbWUsIGFyZ3MsIG9wdGlvbnMpIHtcbiAgICAvLyBSdW4gdGhlIHN0dWIsIGlmIHdlIGhhdmUgb25lLiBUaGUgc3R1YiBpcyBzdXBwb3NlZCB0byBtYWtlIHNvbWVcbiAgICAvLyB0ZW1wb3Jhcnkgd3JpdGVzIHRvIHRoZSBkYXRhYmFzZSB0byBnaXZlIHRoZSB1c2VyIGEgc21vb3RoIGV4cGVyaWVuY2VcbiAgICAvLyB1bnRpbCB0aGUgYWN0dWFsIHJlc3VsdCBvZiBleGVjdXRpbmcgdGhlIG1ldGhvZCBjb21lcyBiYWNrIGZyb20gdGhlXG4gICAgLy8gc2VydmVyICh3aGVyZXVwb24gdGhlIHRlbXBvcmFyeSB3cml0ZXMgdG8gdGhlIGRhdGFiYXNlIHdpbGwgYmUgcmV2ZXJzZWRcbiAgICAvLyBkdXJpbmcgdGhlIGJlZ2luVXBkYXRlL2VuZFVwZGF0ZSBwcm9jZXNzLilcbiAgICAvL1xuICAgIC8vIE5vcm1hbGx5LCB3ZSBpZ25vcmUgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgc3R1YiAoZXZlbiBpZiBpdCBpcyBhblxuICAgIC8vIGV4Y2VwdGlvbiksIGluIGZhdm9yIG9mIHRoZSByZWFsIHJldHVybiB2YWx1ZSBmcm9tIHRoZSBzZXJ2ZXIuIFRoZVxuICAgIC8vIGV4Y2VwdGlvbiBpcyBpZiB0aGUgKmNhbGxlciogaXMgYSBzdHViLiBJbiB0aGF0IGNhc2UsIHdlJ3JlIG5vdCBnb2luZ1xuICAgIC8vIHRvIGRvIGEgUlBDLCBzbyB3ZSB1c2UgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgc3R1YiBhcyBvdXIgcmV0dXJuXG4gICAgLy8gdmFsdWUuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgZW5jbG9zaW5nID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgICBjb25zdCBzdHViID0gc2VsZi5fbWV0aG9kSGFuZGxlcnNbbmFtZV07XG4gICAgY29uc3QgYWxyZWFkeUluU2ltdWxhdGlvbiA9IGVuY2xvc2luZz8uaXNTaW11bGF0aW9uO1xuICAgIGNvbnN0IGlzRnJvbUNhbGxBc3luYyA9IGVuY2xvc2luZz8uX2lzRnJvbUNhbGxBc3luYztcbiAgICBjb25zdCByYW5kb21TZWVkID0geyB2YWx1ZTogbnVsbH07XG5cbiAgICBjb25zdCBkZWZhdWx0UmV0dXJuID0ge1xuICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgIHJhbmRvbVNlZWQsXG4gICAgICBpc0Zyb21DYWxsQXN5bmMsXG4gICAgfTtcbiAgICBpZiAoIXN0dWIpIHtcbiAgICAgIHJldHVybiB7IC4uLmRlZmF1bHRSZXR1cm4sIGhhc1N0dWI6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgLy8gTGF6aWx5IGdlbmVyYXRlIGEgcmFuZG9tU2VlZCwgb25seSBpZiBpdCBpcyByZXF1ZXN0ZWQgYnkgdGhlIHN0dWIuXG4gICAgLy8gVGhlIHJhbmRvbSBzdHJlYW1zIG9ubHkgaGF2ZSB1dGlsaXR5IGlmIHRoZXkncmUgdXNlZCBvbiBib3RoIHRoZSBjbGllbnRcbiAgICAvLyBhbmQgdGhlIHNlcnZlcjsgaWYgdGhlIGNsaWVudCBkb2Vzbid0IGdlbmVyYXRlIGFueSAncmFuZG9tJyB2YWx1ZXNcbiAgICAvLyB0aGVuIHdlIGRvbid0IGV4cGVjdCB0aGUgc2VydmVyIHRvIGdlbmVyYXRlIGFueSBlaXRoZXIuXG4gICAgLy8gTGVzcyBjb21tb25seSwgdGhlIHNlcnZlciBtYXkgcGVyZm9ybSBkaWZmZXJlbnQgYWN0aW9ucyBmcm9tIHRoZSBjbGllbnQsXG4gICAgLy8gYW5kIG1heSBpbiBmYWN0IGdlbmVyYXRlIHZhbHVlcyB3aGVyZSB0aGUgY2xpZW50IGRpZCBub3QsIGJ1dCB3ZSBkb24ndFxuICAgIC8vIGhhdmUgYW55IGNsaWVudC1zaWRlIHZhbHVlcyB0byBtYXRjaCwgc28gZXZlbiBoZXJlIHdlIG1heSBhcyB3ZWxsIGp1c3RcbiAgICAvLyB1c2UgYSByYW5kb20gc2VlZCBvbiB0aGUgc2VydmVyLiAgSW4gdGhhdCBjYXNlLCB3ZSBkb24ndCBwYXNzIHRoZVxuICAgIC8vIHJhbmRvbVNlZWQgdG8gc2F2ZSBiYW5kd2lkdGgsIGFuZCB3ZSBkb24ndCBldmVuIGdlbmVyYXRlIGl0IHRvIHNhdmUgYVxuICAgIC8vIGJpdCBvZiBDUFUgYW5kIHRvIGF2b2lkIGNvbnN1bWluZyBlbnRyb3B5LlxuXG4gICAgY29uc3QgcmFuZG9tU2VlZEdlbmVyYXRvciA9ICgpID0+IHtcbiAgICAgIGlmIChyYW5kb21TZWVkLnZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIHJhbmRvbVNlZWQudmFsdWUgPSBERFBDb21tb24ubWFrZVJwY1NlZWQoZW5jbG9zaW5nLCBuYW1lKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByYW5kb21TZWVkLnZhbHVlO1xuICAgIH07XG5cbiAgICBjb25zdCBzZXRVc2VySWQgPSB1c2VySWQgPT4ge1xuICAgICAgc2VsZi5zZXRVc2VySWQodXNlcklkKTtcbiAgICB9O1xuXG4gICAgY29uc3QgaW52b2NhdGlvbiA9IG5ldyBERFBDb21tb24uTWV0aG9kSW52b2NhdGlvbih7XG4gICAgICBuYW1lLFxuICAgICAgaXNTaW11bGF0aW9uOiB0cnVlLFxuICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCgpLFxuICAgICAgaXNGcm9tQ2FsbEFzeW5jOiBvcHRpb25zPy5pc0Zyb21DYWxsQXN5bmMsXG4gICAgICBzZXRVc2VySWQ6IHNldFVzZXJJZCxcbiAgICAgIHJhbmRvbVNlZWQoKSB7XG4gICAgICAgIHJldHVybiByYW5kb21TZWVkR2VuZXJhdG9yKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBOb3RlIHRoYXQgdW5saWtlIGluIHRoZSBjb3JyZXNwb25kaW5nIHNlcnZlciBjb2RlLCB3ZSBuZXZlciBhdWRpdFxuICAgIC8vIHRoYXQgc3R1YnMgY2hlY2soKSB0aGVpciBhcmd1bWVudHMuXG4gICAgY29uc3Qgc3R1Ykludm9jYXRpb24gPSAoKSA9PiB7XG4gICAgICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgICAgICAvLyBCZWNhdXNlIHNhdmVPcmlnaW5hbHMgYW5kIHJldHJpZXZlT3JpZ2luYWxzIGFyZW4ndCByZWVudHJhbnQsXG4gICAgICAgICAgLy8gZG9uJ3QgYWxsb3cgc3R1YnMgdG8geWllbGQuXG4gICAgICAgICAgcmV0dXJuIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+IHtcbiAgICAgICAgICAgIC8vIHJlLWNsb25lLCBzbyB0aGF0IHRoZSBzdHViIGNhbid0IGFmZmVjdCBvdXIgY2FsbGVyJ3MgdmFsdWVzXG4gICAgICAgICAgICByZXR1cm4gc3R1Yi5hcHBseShpbnZvY2F0aW9uLCBFSlNPTi5jbG9uZShhcmdzKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHN0dWIuYXBwbHkoaW52b2NhdGlvbiwgRUpTT04uY2xvbmUoYXJncykpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4geyAuLi5kZWZhdWx0UmV0dXJuLCBoYXNTdHViOiB0cnVlLCBzdHViSW52b2NhdGlvbiwgaW52b2NhdGlvbiB9O1xuICB9XG5cbiAgLy8gQmVmb3JlIGNhbGxpbmcgYSBtZXRob2Qgc3R1YiwgcHJlcGFyZSBhbGwgc3RvcmVzIHRvIHRyYWNrIGNoYW5nZXMgYW5kIGFsbG93XG4gIC8vIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIHRvIGdldCB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgY2hhbmdlZFxuICAvLyBkb2N1bWVudHMuXG4gIF9zYXZlT3JpZ2luYWxzKCkge1xuICAgIGlmICghIHRoaXMuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICB9XG5cbiAgICBPYmplY3QudmFsdWVzKHRoaXMuX3N0b3JlcykuZm9yRWFjaCgoc3RvcmUpID0+IHtcbiAgICAgIHN0b3JlLnNhdmVPcmlnaW5hbHMoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHJpZXZlcyB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgYWxsIGRvY3VtZW50cyBtb2RpZmllZCBieSB0aGUgc3R1YiBmb3JcbiAgLy8gbWV0aG9kICdtZXRob2RJZCcgZnJvbSBhbGwgc3RvcmVzIGFuZCBzYXZlcyB0aGVtIHRvIF9zZXJ2ZXJEb2N1bWVudHMgKGtleWVkXG4gIC8vIGJ5IGRvY3VtZW50KSBhbmQgX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgKGtleWVkIGJ5IG1ldGhvZCBJRCkuXG4gIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEdXBsaWNhdGUgbWV0aG9kSWQgaW4gX3JldHJpZXZlQW5kU3RvcmVPcmlnaW5hbHMnKTtcblxuICAgIGNvbnN0IGRvY3NXcml0dGVuID0gW107XG5cbiAgICBPYmplY3QuZW50cmllcyhzZWxmLl9zdG9yZXMpLmZvckVhY2goKFtjb2xsZWN0aW9uLCBzdG9yZV0pID0+IHtcbiAgICAgIGNvbnN0IG9yaWdpbmFscyA9IHN0b3JlLnJldHJpZXZlT3JpZ2luYWxzKCk7XG4gICAgICAvLyBub3QgYWxsIHN0b3JlcyBkZWZpbmUgcmV0cmlldmVPcmlnaW5hbHNcbiAgICAgIGlmICghIG9yaWdpbmFscykgcmV0dXJuO1xuICAgICAgb3JpZ2luYWxzLmZvckVhY2goKGRvYywgaWQpID0+IHtcbiAgICAgICAgZG9jc1dyaXR0ZW4ucHVzaCh7IGNvbGxlY3Rpb24sIGlkIH0pO1xuICAgICAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dID0gbmV3IE1vbmdvSURNYXAoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl0uc2V0RGVmYXVsdChcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBPYmplY3QuY3JlYXRlKG51bGwpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpIHtcbiAgICAgICAgICAvLyBXZSdyZSBub3QgdGhlIGZpcnN0IHN0dWIgdG8gd3JpdGUgdGhpcyBkb2MuIEp1c3QgYWRkIG91ciBtZXRob2QgSURcbiAgICAgICAgICAvLyB0byB0aGUgcmVjb3JkLlxuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZpcnN0IHN0dWIhIFNhdmUgdGhlIG9yaWdpbmFsIHZhbHVlIGFuZCBvdXIgbWV0aG9kIElELlxuICAgICAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IGRvYztcbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MgPSBbXTtcbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAoISBpc0VtcHR5KGRvY3NXcml0dGVuKSkge1xuICAgICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YlttZXRob2RJZF0gPSBkb2NzV3JpdHRlbjtcbiAgICB9XG4gIH1cblxuICAvLyBUaGlzIGlzIHZlcnkgbXVjaCBhIHByaXZhdGUgZnVuY3Rpb24gd2UgdXNlIHRvIG1ha2UgdGhlIHRlc3RzXG4gIC8vIHRha2UgdXAgZmV3ZXIgc2VydmVyIHJlc291cmNlcyBhZnRlciB0aGV5IGNvbXBsZXRlLlxuICBfdW5zdWJzY3JpYmVBbGwoKSB7XG4gICAgT2JqZWN0LnZhbHVlcyh0aGlzLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChzdWIpID0+IHtcbiAgICAgIC8vIEF2b2lkIGtpbGxpbmcgdGhlIGF1dG91cGRhdGUgc3Vic2NyaXB0aW9uIHNvIHRoYXQgZGV2ZWxvcGVyc1xuICAgICAgLy8gc3RpbGwgZ2V0IGhvdCBjb2RlIHB1c2hlcyB3aGVuIHdyaXRpbmcgdGVzdHMuXG4gICAgICAvL1xuICAgICAgLy8gWFhYIGl0J3MgYSBoYWNrIHRvIGVuY29kZSBrbm93bGVkZ2UgYWJvdXQgYXV0b3VwZGF0ZSBoZXJlLFxuICAgICAgLy8gYnV0IGl0IGRvZXNuJ3Qgc2VlbSB3b3J0aCBpdCB5ZXQgdG8gaGF2ZSBhIHNwZWNpYWwgQVBJIGZvclxuICAgICAgLy8gc3Vic2NyaXB0aW9ucyB0byBwcmVzZXJ2ZSBhZnRlciB1bml0IHRlc3RzLlxuICAgICAgaWYgKHN1Yi5uYW1lICE9PSAnbWV0ZW9yX2F1dG91cGRhdGVfY2xpZW50VmVyc2lvbnMnKSB7XG4gICAgICAgIHN1Yi5zdG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBTZW5kcyB0aGUgRERQIHN0cmluZ2lmaWNhdGlvbiBvZiB0aGUgZ2l2ZW4gbWVzc2FnZSBvYmplY3RcbiAgX3NlbmQob2JqKSB7XG4gICAgdGhpcy5fc3RyZWFtLnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChvYmopKTtcbiAgfVxuXG4gIC8vIEFsd2F5cyBxdWV1ZXMgdGhlIGNhbGwgYmVmb3JlIHNlbmRpbmcgdGhlIG1lc3NhZ2VcbiAgLy8gVXNlZCwgZm9yIGV4YW1wbGUsIG9uIHN1YnNjcmlwdGlvbi5baWRdLnN0b3AoKSB0byBtYWtlIHN1cmUgYSBcInN1YlwiIG1lc3NhZ2UgaXMgYWx3YXlzIGNhbGxlZCBiZWZvcmUgYW4gXCJ1bnN1YlwiIG1lc3NhZ2VcbiAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzEzMjEyXG4gIC8vXG4gIC8vIFRoaXMgaXMgcGFydCBvZiB0aGUgYWN0dWFsIGZpeCBmb3IgdGhlIHJlc3QgY2hlY2s6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL3B1bGwvMTMyMzZcbiAgX3NlbmRRdWV1ZWQob2JqKSB7XG4gICAgdGhpcy5fc2VuZChvYmosIHRydWUpO1xuICB9XG5cbiAgLy8gV2UgZGV0ZWN0ZWQgdmlhIEREUC1sZXZlbCBoZWFydGJlYXRzIHRoYXQgd2UndmUgbG9zdCB0aGVcbiAgLy8gY29ubmVjdGlvbi4gIFVubGlrZSBgZGlzY29ubmVjdGAgb3IgYGNsb3NlYCwgYSBsb3N0IGNvbm5lY3Rpb25cbiAgLy8gd2lsbCBiZSBhdXRvbWF0aWNhbGx5IHJldHJpZWQuXG4gIF9sb3N0Q29ubmVjdGlvbihlcnJvcikge1xuICAgIHRoaXMuX3N0cmVhbS5fbG9zdENvbm5lY3Rpb24oZXJyb3IpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLnN0YXR1c1xuICAgKiBAc3VtbWFyeSBHZXQgdGhlIGN1cnJlbnQgY29ubmVjdGlvbiBzdGF0dXMuIEEgcmVhY3RpdmUgZGF0YSBzb3VyY2UuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIHN0YXR1cyguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5zdGF0dXMoLi4uYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgRm9yY2UgYW4gaW1tZWRpYXRlIHJlY29ubmVjdGlvbiBhdHRlbXB0IGlmIHRoZSBjbGllbnQgaXMgbm90IGNvbm5lY3RlZCB0byB0aGUgc2VydmVyLlxuXG4gIFRoaXMgbWV0aG9kIGRvZXMgbm90aGluZyBpZiB0aGUgY2xpZW50IGlzIGFscmVhZHkgY29ubmVjdGVkLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5yZWNvbm5lY3RcbiAgICogQGxvY3VzIENsaWVudFxuICAgKi9cbiAgcmVjb25uZWN0KC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLnJlY29ubmVjdCguLi5hcmdzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5kaXNjb25uZWN0XG4gICAqIEBzdW1tYXJ5IERpc2Nvbm5lY3QgdGhlIGNsaWVudCBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIGRpc2Nvbm5lY3QoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0uZGlzY29ubmVjdCguLi5hcmdzKTtcbiAgfVxuXG4gIGNsb3NlKCkge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0uZGlzY29ubmVjdCh7IF9wZXJtYW5lbnQ6IHRydWUgfSk7XG4gIH1cblxuICAvLy9cbiAgLy8vIFJlYWN0aXZlIHVzZXIgc3lzdGVtXG4gIC8vL1xuICB1c2VySWQoKSB7XG4gICAgaWYgKHRoaXMuX3VzZXJJZERlcHMpIHRoaXMuX3VzZXJJZERlcHMuZGVwZW5kKCk7XG4gICAgcmV0dXJuIHRoaXMuX3VzZXJJZDtcbiAgfVxuXG4gIHNldFVzZXJJZCh1c2VySWQpIHtcbiAgICAvLyBBdm9pZCBpbnZhbGlkYXRpbmcgZGVwZW5kZW50cyBpZiBzZXRVc2VySWQgaXMgY2FsbGVkIHdpdGggY3VycmVudCB2YWx1ZS5cbiAgICBpZiAodGhpcy5fdXNlcklkID09PSB1c2VySWQpIHJldHVybjtcbiAgICB0aGlzLl91c2VySWQgPSB1c2VySWQ7XG4gICAgaWYgKHRoaXMuX3VzZXJJZERlcHMpIHRoaXMuX3VzZXJJZERlcHMuY2hhbmdlZCgpO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0cnVlIGlmIHdlIGFyZSBpbiBhIHN0YXRlIGFmdGVyIHJlY29ubmVjdCBvZiB3YWl0aW5nIGZvciBzdWJzIHRvIGJlXG4gIC8vIHJldml2ZWQgb3IgZWFybHkgbWV0aG9kcyB0byBmaW5pc2ggdGhlaXIgZGF0YSwgb3Igd2UgYXJlIHdhaXRpbmcgZm9yIGFcbiAgLy8gXCJ3YWl0XCIgbWV0aG9kIHRvIGZpbmlzaC5cbiAgX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkge1xuICAgIHJldHVybiAoXG4gICAgICAhIGlzRW1wdHkodGhpcy5fc3Vic0JlaW5nUmV2aXZlZCkgfHxcbiAgICAgICEgaXNFbXB0eSh0aGlzLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlKVxuICAgICk7XG4gIH1cblxuICAvLyBSZXR1cm5zIHRydWUgaWYgYW55IG1ldGhvZCB3aG9zZSBtZXNzYWdlIGhhcyBiZWVuIHNlbnQgdG8gdGhlIHNlcnZlciBoYXNcbiAgLy8gbm90IHlldCBpbnZva2VkIGl0cyB1c2VyIGNhbGxiYWNrLlxuICBfYW55TWV0aG9kc0FyZU91dHN0YW5kaW5nKCkge1xuICAgIGNvbnN0IGludm9rZXJzID0gdGhpcy5fbWV0aG9kSW52b2tlcnM7XG4gICAgcmV0dXJuIE9iamVjdC52YWx1ZXMoaW52b2tlcnMpLnNvbWUoKGludm9rZXIpID0+ICEhaW52b2tlci5zZW50TWVzc2FnZSk7XG4gIH1cblxuICBfcHJlcGFyZUJ1ZmZlcnNUb0ZsdXNoKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSk7XG4gICAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlID0gbnVsbDtcbiAgICB9XG5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFdlIG5lZWQgdG8gY2xlYXIgdGhlIGJ1ZmZlciBiZWZvcmUgcGFzc2luZyBpdCB0b1xuICAgIC8vICBwZXJmb3JtV3JpdGVzLiBBcyB0aGVyZSdzIG5vIGd1YXJhbnRlZSB0aGF0IGl0XG4gICAgLy8gIHdpbGwgZXhpdCBjbGVhbmx5LlxuICAgIGNvbnN0IHdyaXRlcyA9IHNlbGYuX2J1ZmZlcmVkV3JpdGVzO1xuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICByZXR1cm4gd3JpdGVzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcnZlci1zaWRlIHN0b3JlIHVwZGF0ZXMgaGFuZGxlZCBhc3luY2hyb25vdXNseVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgX3BlcmZvcm1Xcml0ZXNTZXJ2ZXIodXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzIHx8ICFpc0VtcHR5KHVwZGF0ZXMpKSB7XG4gICAgICAvLyBTdGFydCBhbGwgc3RvcmUgdXBkYXRlcyAtIGtlZXBpbmcgb3JpZ2luYWwgbG9vcCBzdHJ1Y3R1cmVcbiAgICAgIGZvciAoY29uc3Qgc3RvcmUgb2YgT2JqZWN0LnZhbHVlcyhzZWxmLl9zdG9yZXMpKSB7XG4gICAgICAgIGF3YWl0IHN0b3JlLmJlZ2luVXBkYXRlKFxuICAgICAgICAgIHVwZGF0ZXNbc3RvcmUuX25hbWVdPy5sZW5ndGggfHwgMCxcbiAgICAgICAgICBzZWxmLl9yZXNldFN0b3Jlc1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgICAvLyBQcm9jZXNzIGVhY2ggc3RvcmUncyB1cGRhdGVzIHNlcXVlbnRpYWxseSBhcyBiZWZvcmVcbiAgICAgIGZvciAoY29uc3QgW3N0b3JlTmFtZSwgbWVzc2FnZXNdIG9mIE9iamVjdC5lbnRyaWVzKHVwZGF0ZXMpKSB7XG4gICAgICAgIGNvbnN0IHN0b3JlID0gc2VsZi5fc3RvcmVzW3N0b3JlTmFtZV07XG4gICAgICAgIGlmIChzdG9yZSkge1xuICAgICAgICAgIC8vIEJhdGNoIGVhY2ggc3RvcmUncyBtZXNzYWdlcyBpbiBtb2Rlc3QgY2h1bmtzIHRvIHByZXZlbnQgZXZlbnQgbG9vcCBibG9ja2luZ1xuICAgICAgICAgIC8vIHdoaWxlIG1haW50YWluaW5nIG9wZXJhdGlvbiBvcmRlclxuICAgICAgICAgIGNvbnN0IENIVU5LX1NJWkUgPSAxMDA7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNzYWdlcy5sZW5ndGg7IGkgKz0gQ0hVTktfU0laRSkge1xuICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBtZXNzYWdlcy5zbGljZShpLCBNYXRoLm1pbihpICsgQ0hVTktfU0laRSwgbWVzc2FnZXMubGVuZ3RoKSk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgbXNnIG9mIGNodW5rKSB7XG4gICAgICAgICAgICAgIGF3YWl0IHN0b3JlLnVwZGF0ZShtc2cpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHByb2Nlc3MubmV4dFRpY2socmVzb2x2ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBRdWV1ZSB1cGRhdGVzIGZvciB1bmluaXRpYWxpemVkIHN0b3Jlc1xuICAgICAgICAgIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW3N0b3JlTmFtZV0gPVxuICAgICAgICAgICAgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXNbc3RvcmVOYW1lXSB8fCBbXTtcbiAgICAgICAgICBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tzdG9yZU5hbWVdLnB1c2goLi4ubWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIENvbXBsZXRlIGFsbCB1cGRhdGVzXG4gICAgICBmb3IgKGNvbnN0IHN0b3JlIG9mIE9iamVjdC52YWx1ZXMoc2VsZi5fc3RvcmVzKSkge1xuICAgICAgICBhd2FpdCBzdG9yZS5lbmRVcGRhdGUoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICB9XG5cbiAgLyoqXG4gICAqIENsaWVudC1zaWRlIHN0b3JlIHVwZGF0ZXMgaGFuZGxlZCBzeW5jaHJvbm91c2x5IGZvciBvcHRpbWlzdGljIFVJXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcGVyZm9ybVdyaXRlc0NsaWVudCh1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMgfHwgIWlzRW1wdHkodXBkYXRlcykpIHtcbiAgICAgIC8vIFN5bmNocm9ub3VzIHN0b3JlIHVwZGF0ZXMgZm9yIGNsaWVudFxuICAgICAgT2JqZWN0LnZhbHVlcyhzZWxmLl9zdG9yZXMpLmZvckVhY2goc3RvcmUgPT4ge1xuICAgICAgICBzdG9yZS5iZWdpblVwZGF0ZShcbiAgICAgICAgICB1cGRhdGVzW3N0b3JlLl9uYW1lXT8ubGVuZ3RoIHx8IDAsXG4gICAgICAgICAgc2VsZi5fcmVzZXRTdG9yZXNcbiAgICAgICAgKTtcbiAgICAgIH0pO1xuXG4gICAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgICBPYmplY3QuZW50cmllcyh1cGRhdGVzKS5mb3JFYWNoKChbc3RvcmVOYW1lLCBtZXNzYWdlc10pID0+IHtcbiAgICAgICAgY29uc3Qgc3RvcmUgPSBzZWxmLl9zdG9yZXNbc3RvcmVOYW1lXTtcbiAgICAgICAgaWYgKHN0b3JlKSB7XG4gICAgICAgICAgbWVzc2FnZXMuZm9yRWFjaChtc2cgPT4gc3RvcmUudXBkYXRlKG1zZykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW3N0b3JlTmFtZV0gPVxuICAgICAgICAgICAgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXNbc3RvcmVOYW1lXSB8fCBbXTtcbiAgICAgICAgICBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tzdG9yZU5hbWVdLnB1c2goLi4ubWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgT2JqZWN0LnZhbHVlcyhzZWxmLl9zdG9yZXMpLmZvckVhY2goc3RvcmUgPT4gc3RvcmUuZW5kVXBkYXRlKCkpO1xuICAgIH1cblxuICAgIHNlbGYuX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzKCk7XG4gIH1cblxuICAvKipcbiAgICogRXhlY3V0ZXMgYnVmZmVyZWQgd3JpdGVzIGVpdGhlciBzeW5jaHJvbm91c2x5IChjbGllbnQpIG9yIGFzeW5jIChzZXJ2ZXIpXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBhc3luYyBfZmx1c2hCdWZmZXJlZFdyaXRlcygpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCB3cml0ZXMgPSBzZWxmLl9wcmVwYXJlQnVmZmVyc1RvRmx1c2goKTtcblxuICAgIHJldHVybiBNZXRlb3IuaXNDbGllbnRcbiAgICAgID8gc2VsZi5fcGVyZm9ybVdyaXRlc0NsaWVudCh3cml0ZXMpXG4gICAgICA6IHNlbGYuX3BlcmZvcm1Xcml0ZXNTZXJ2ZXIod3JpdGVzKTtcbiAgfVxuXG4gIC8vIENhbGwgYW55IGNhbGxiYWNrcyBkZWZlcnJlZCB3aXRoIF9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQgd2hvc2VcbiAgLy8gcmVsZXZhbnQgZG9jcyBoYXZlIGJlZW4gZmx1c2hlZCwgYXMgd2VsbCBhcyBkYXRhVmlzaWJsZSBjYWxsYmFja3MgYXRcbiAgLy8gcmVjb25uZWN0LXF1aWVzY2VuY2UgdGltZS5cbiAgX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IGNhbGxiYWNrcyA9IHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzO1xuICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzID0gW107XG4gICAgY2FsbGJhY2tzLmZvckVhY2goKGMpID0+IHtcbiAgICAgIGMoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEVuc3VyZXMgdGhhdCBcImZcIiB3aWxsIGJlIGNhbGxlZCBhZnRlciBhbGwgZG9jdW1lbnRzIGN1cnJlbnRseSBpblxuICAvLyBfc2VydmVyRG9jdW1lbnRzIGhhdmUgYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZS4gZiB3aWxsIG5vdCBiZSBjYWxsZWRcbiAgLy8gaWYgdGhlIGNvbm5lY3Rpb24gaXMgbG9zdCBiZWZvcmUgdGhlbiFcbiAgX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZChmKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgcnVuRkFmdGVyVXBkYXRlcyA9ICgpID0+IHtcbiAgICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzLnB1c2goZik7XG4gICAgfTtcbiAgICBsZXQgdW5mbHVzaGVkU2VydmVyRG9jQ291bnQgPSAwO1xuICAgIGNvbnN0IG9uU2VydmVyRG9jRmx1c2ggPSAoKSA9PiB7XG4gICAgICAtLXVuZmx1c2hlZFNlcnZlckRvY0NvdW50O1xuICAgICAgaWYgKHVuZmx1c2hlZFNlcnZlckRvY0NvdW50ID09PSAwKSB7XG4gICAgICAgIC8vIFRoaXMgd2FzIHRoZSBsYXN0IGRvYyB0byBmbHVzaCEgQXJyYW5nZSB0byBydW4gZiBhZnRlciB0aGUgdXBkYXRlc1xuICAgICAgICAvLyBoYXZlIGJlZW4gYXBwbGllZC5cbiAgICAgICAgcnVuRkFmdGVyVXBkYXRlcygpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBPYmplY3QudmFsdWVzKHNlbGYuX3NlcnZlckRvY3VtZW50cykuZm9yRWFjaCgoc2VydmVyRG9jdW1lbnRzKSA9PiB7XG4gICAgICBzZXJ2ZXJEb2N1bWVudHMuZm9yRWFjaCgoc2VydmVyRG9jKSA9PiB7XG4gICAgICAgIGNvbnN0IHdyaXR0ZW5CeVN0dWJGb3JBTWV0aG9kV2l0aFNlbnRNZXNzYWdlID1cbiAgICAgICAgICBrZXlzKHNlcnZlckRvYy53cml0dGVuQnlTdHVicykuc29tZShtZXRob2RJZCA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnZva2VyID0gc2VsZi5fbWV0aG9kSW52b2tlcnNbbWV0aG9kSWRdO1xuICAgICAgICAgICAgcmV0dXJuIGludm9rZXIgJiYgaW52b2tlci5zZW50TWVzc2FnZTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICBpZiAod3JpdHRlbkJ5U3R1YkZvckFNZXRob2RXaXRoU2VudE1lc3NhZ2UpIHtcbiAgICAgICAgICArK3VuZmx1c2hlZFNlcnZlckRvY0NvdW50O1xuICAgICAgICAgIHNlcnZlckRvYy5mbHVzaENhbGxiYWNrcy5wdXNoKG9uU2VydmVyRG9jRmx1c2gpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAodW5mbHVzaGVkU2VydmVyRG9jQ291bnQgPT09IDApIHtcbiAgICAgIC8vIFRoZXJlIGFyZW4ndCBhbnkgYnVmZmVyZWQgZG9jcyAtLS0gd2UgY2FuIGNhbGwgZiBhcyBzb29uIGFzIHRoZSBjdXJyZW50XG4gICAgICAvLyByb3VuZCBvZiB1cGRhdGVzIGlzIGFwcGxpZWQhXG4gICAgICBydW5GQWZ0ZXJVcGRhdGVzKCk7XG4gICAgfVxuICB9XG5cbiAgX2FkZE91dHN0YW5kaW5nTWV0aG9kKG1ldGhvZEludm9rZXIsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucz8ud2FpdCkge1xuICAgICAgLy8gSXQncyBhIHdhaXQgbWV0aG9kISBXYWl0IG1ldGhvZHMgZ28gaW4gdGhlaXIgb3duIGJsb2NrLlxuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MucHVzaCh7XG4gICAgICAgIHdhaXQ6IHRydWUsXG4gICAgICAgIG1ldGhvZHM6IFttZXRob2RJbnZva2VyXVxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vdCBhIHdhaXQgbWV0aG9kLiBTdGFydCBhIG5ldyBibG9jayBpZiB0aGUgcHJldmlvdXMgYmxvY2sgd2FzIGEgd2FpdFxuICAgICAgLy8gYmxvY2ssIGFuZCBhZGQgaXQgdG8gdGhlIGxhc3QgYmxvY2sgb2YgbWV0aG9kcy5cbiAgICAgIGlmIChpc0VtcHR5KHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSB8fFxuICAgICAgICAgIGxhc3QodGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpLndhaXQpIHtcbiAgICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MucHVzaCh7XG4gICAgICAgICAgd2FpdDogZmFsc2UsXG4gICAgICAgICAgbWV0aG9kczogW10sXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBsYXN0KHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS5tZXRob2RzLnB1c2gobWV0aG9kSW52b2tlcik7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgYWRkZWQgaXQgdG8gdGhlIGZpcnN0IGJsb2NrLCBzZW5kIGl0IG91dCBub3cuXG4gICAgaWYgKHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgbWV0aG9kSW52b2tlci5zZW5kTWVzc2FnZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIENhbGxlZCBieSBNZXRob2RJbnZva2VyIGFmdGVyIGEgbWV0aG9kJ3MgY2FsbGJhY2sgaXMgaW52b2tlZC4gIElmIHRoaXMgd2FzXG4gIC8vIHRoZSBsYXN0IG91dHN0YW5kaW5nIG1ldGhvZCBpbiB0aGUgY3VycmVudCBibG9jaywgcnVucyB0aGUgbmV4dCBibG9jay4gSWZcbiAgLy8gdGhlcmUgYXJlIG5vIG1vcmUgbWV0aG9kcywgY29uc2lkZXIgYWNjZXB0aW5nIGEgaG90IGNvZGUgcHVzaC5cbiAgX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2FueU1ldGhvZHNBcmVPdXRzdGFuZGluZygpKSByZXR1cm47XG5cbiAgICAvLyBObyBtZXRob2RzIGFyZSBvdXRzdGFuZGluZy4gVGhpcyBzaG91bGQgbWVhbiB0aGF0IHRoZSBmaXJzdCBibG9jayBvZlxuICAgIC8vIG1ldGhvZHMgaXMgZW1wdHkuIChPciBpdCBtaWdodCBub3QgZXhpc3QsIGlmIHRoaXMgd2FzIGEgbWV0aG9kIHRoYXRcbiAgICAvLyBoYWxmLWZpbmlzaGVkIGJlZm9yZSBkaXNjb25uZWN0L3JlY29ubmVjdC4pXG4gICAgaWYgKCEgaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIGNvbnN0IGZpcnN0QmxvY2sgPSBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgICAgaWYgKCEgaXNFbXB0eShmaXJzdEJsb2NrLm1ldGhvZHMpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ05vIG1ldGhvZHMgb3V0c3RhbmRpbmcgYnV0IG5vbmVtcHR5IGJsb2NrOiAnICtcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGZpcnN0QmxvY2spXG4gICAgICAgICk7XG5cbiAgICAgIC8vIFNlbmQgdGhlIG91dHN0YW5kaW5nIG1ldGhvZHMgbm93IGluIHRoZSBmaXJzdCBibG9jay5cbiAgICAgIGlmICghIGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKVxuICAgICAgICBzZWxmLl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzKCk7XG4gICAgfVxuXG4gICAgLy8gTWF5YmUgYWNjZXB0IGEgaG90IGNvZGUgcHVzaC5cbiAgICBzZWxmLl9tYXliZU1pZ3JhdGUoKTtcbiAgfVxuXG4gIC8vIFNlbmRzIG1lc3NhZ2VzIGZvciBhbGwgdGhlIG1ldGhvZHMgaW4gdGhlIGZpcnN0IGJsb2NrIGluXG4gIC8vIF9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5cbiAgX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzLmZvckVhY2gobSA9PiB7XG4gICAgICBtLnNlbmRNZXNzYWdlKCk7XG4gICAgfSk7XG4gIH1cblxuICBfc2VuZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzTWVzc2FnZXMob2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoaXNFbXB0eShvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2NrcykpIHJldHVybjtcblxuICAgIC8vIFdlIGhhdmUgYXQgbGVhc3Qgb25lIGJsb2NrIHdvcnRoIG9mIG9sZCBvdXRzdGFuZGluZyBtZXRob2RzIHRvIHRyeVxuICAgIC8vIGFnYWluLiBGaXJzdDogZGlkIG9uUmVjb25uZWN0IGFjdHVhbGx5IHNlbmQgYW55dGhpbmc/IElmIG5vdCwgd2UganVzdFxuICAgIC8vIHJlc3RvcmUgYWxsIG91dHN0YW5kaW5nIG1ldGhvZHMgYW5kIHJ1biB0aGUgZmlyc3QgYmxvY2suXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyA9IG9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzO1xuICAgICAgc2VsZi5fc2VuZE91dHN0YW5kaW5nTWV0aG9kcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE9LLCB0aGVyZSBhcmUgYmxvY2tzIG9uIGJvdGggc2lkZXMuIFNwZWNpYWwgY2FzZTogbWVyZ2UgdGhlIGxhc3QgYmxvY2sgb2ZcbiAgICAvLyB0aGUgcmVjb25uZWN0IG1ldGhvZHMgd2l0aCB0aGUgZmlyc3QgYmxvY2sgb2YgdGhlIG9yaWdpbmFsIG1ldGhvZHMsIGlmXG4gICAgLy8gbmVpdGhlciBvZiB0aGVtIGFyZSBcIndhaXRcIiBibG9ja3MuXG4gICAgaWYgKFxuICAgICAgIWxhc3Qoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpLndhaXQgJiZcbiAgICAgICFvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS53YWl0XG4gICAgKSB7XG4gICAgICBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzLmZvckVhY2goKG0pID0+IHtcbiAgICAgICAgbGFzdChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykubWV0aG9kcy5wdXNoKG0pO1xuXG4gICAgICAgIC8vIElmIHRoaXMgXCJsYXN0IGJsb2NrXCIgaXMgYWxzbyB0aGUgZmlyc3QgYmxvY2ssIHNlbmQgdGhlIG1lc3NhZ2UuXG4gICAgICAgIGlmIChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICBtLnNlbmRNZXNzYWdlKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5zaGlmdCgpO1xuICAgIH1cblxuICAgIC8vIE5vdyBhZGQgdGhlIHJlc3Qgb2YgdGhlIG9yaWdpbmFsIGJsb2NrcyBvbi5cbiAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5wdXNoKC4uLm9sZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzKTtcbiAgfVxuXG4gIF9jYWxsT25SZWNvbm5lY3RBbmRTZW5kQXBwcm9wcmlhdGVPdXRzdGFuZGluZ01ldGhvZHMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcztcbiAgICBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcyA9IFtdO1xuXG4gICAgc2VsZi5vblJlY29ubmVjdCAmJiBzZWxmLm9uUmVjb25uZWN0KCk7XG4gICAgRERQLl9yZWNvbm5lY3RIb29rLmVhY2goKGNhbGxiYWNrKSA9PiB7XG4gICAgICBjYWxsYmFjayhzZWxmKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuXG4gICAgc2VsZi5fc2VuZE91dHN0YW5kaW5nTWV0aG9kQmxvY2tzTWVzc2FnZXMob2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpO1xuICB9XG5cbiAgLy8gV2UgY2FuIGFjY2VwdCBhIGhvdCBjb2RlIHB1c2ggaWYgdGhlcmUgYXJlIG5vIG1ldGhvZHMgaW4gZmxpZ2h0LlxuICBfcmVhZHlUb01pZ3JhdGUoKSB7XG4gICAgcmV0dXJuIGlzRW1wdHkodGhpcy5fbWV0aG9kSW52b2tlcnMpO1xuICB9XG5cbiAgLy8gSWYgd2Ugd2VyZSBibG9ja2luZyBhIG1pZ3JhdGlvbiwgc2VlIGlmIGl0J3Mgbm93IHBvc3NpYmxlIHRvIGNvbnRpbnVlLlxuICAvLyBDYWxsIHdoZW5ldmVyIHRoZSBzZXQgb2Ygb3V0c3RhbmRpbmcvYmxvY2tlZCBtZXRob2RzIHNocmlua3MuXG4gIF9tYXliZU1pZ3JhdGUoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3JldHJ5TWlncmF0ZSAmJiBzZWxmLl9yZWFkeVRvTWlncmF0ZSgpKSB7XG4gICAgICBzZWxmLl9yZXRyeU1pZ3JhdGUoKTtcbiAgICAgIHNlbGYuX3JldHJ5TWlncmF0ZSA9IG51bGw7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBERFBDb21tb24gfSBmcm9tICdtZXRlb3IvZGRwLWNvbW1vbic7XG5pbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IEREUCB9IGZyb20gJy4vbmFtZXNwYWNlLmpzJztcbmltcG9ydCB7IEVKU09OIH0gZnJvbSAnbWV0ZW9yL2Vqc29uJztcbmltcG9ydCB7IGlzRW1wdHksIGhhc093biB9IGZyb20gXCJtZXRlb3IvZGRwLWNvbW1vbi91dGlsc1wiO1xuXG5leHBvcnQgY2xhc3MgTWVzc2FnZVByb2Nlc3NvcnMge1xuICBjb25zdHJ1Y3Rvcihjb25uZWN0aW9uKSB7XG4gICAgdGhpcy5fY29ubmVjdGlvbiA9IGNvbm5lY3Rpb247XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgUHJvY2VzcyB0aGUgY29ubmVjdGlvbiBtZXNzYWdlIGFuZCBzZXQgdXAgdGhlIHNlc3Npb25cbiAgICogQHBhcmFtIHtPYmplY3R9IG1zZyBUaGUgY29ubmVjdGlvbiBtZXNzYWdlXG4gICAqL1xuICBhc3luYyBfbGl2ZWRhdGFfY29ubmVjdGVkKG1zZykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzLl9jb25uZWN0aW9uO1xuXG4gICAgaWYgKHNlbGYuX3ZlcnNpb24gIT09ICdwcmUxJyAmJiBzZWxmLl9oZWFydGJlYXRJbnRlcnZhbCAhPT0gMCkge1xuICAgICAgc2VsZi5faGVhcnRiZWF0ID0gbmV3IEREUENvbW1vbi5IZWFydGJlYXQoe1xuICAgICAgICBoZWFydGJlYXRJbnRlcnZhbDogc2VsZi5faGVhcnRiZWF0SW50ZXJ2YWwsXG4gICAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IHNlbGYuX2hlYXJ0YmVhdFRpbWVvdXQsXG4gICAgICAgIG9uVGltZW91dCgpIHtcbiAgICAgICAgICBzZWxmLl9sb3N0Q29ubmVjdGlvbihcbiAgICAgICAgICAgIG5ldyBERFAuQ29ubmVjdGlvbkVycm9yKCdERFAgaGVhcnRiZWF0IHRpbWVkIG91dCcpXG4gICAgICAgICAgKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2VuZFBpbmcoKSB7XG4gICAgICAgICAgc2VsZi5fc2VuZCh7IG1zZzogJ3BpbmcnIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHNlbGYuX2hlYXJ0YmVhdC5zdGFydCgpO1xuICAgIH1cblxuICAgIC8vIElmIHRoaXMgaXMgYSByZWNvbm5lY3QsIHdlJ2xsIGhhdmUgdG8gcmVzZXQgYWxsIHN0b3Jlcy5cbiAgICBpZiAoc2VsZi5fbGFzdFNlc3Npb25JZCkgc2VsZi5fcmVzZXRTdG9yZXMgPSB0cnVlO1xuXG4gICAgbGV0IHJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb247XG4gICAgaWYgKHR5cGVvZiBtc2cuc2Vzc2lvbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb24gPSBzZWxmLl9sYXN0U2Vzc2lvbklkID09PSBtc2cuc2Vzc2lvbjtcbiAgICAgIHNlbGYuX2xhc3RTZXNzaW9uSWQgPSBtc2cuc2Vzc2lvbjtcbiAgICB9XG5cbiAgICBpZiAocmVjb25uZWN0ZWRUb1ByZXZpb3VzU2Vzc2lvbikge1xuICAgICAgLy8gU3VjY2Vzc2Z1bCByZWNvbm5lY3Rpb24gLS0gcGljayB1cCB3aGVyZSB3ZSBsZWZ0IG9mZi5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTZXJ2ZXIgZG9lc24ndCBoYXZlIG91ciBkYXRhIGFueW1vcmUuIFJlLXN5bmMgYSBuZXcgc2Vzc2lvbi5cblxuICAgIC8vIEZvcmdldCBhYm91dCBtZXNzYWdlcyB3ZSB3ZXJlIGJ1ZmZlcmluZyBmb3IgdW5rbm93biBjb2xsZWN0aW9ucy4gVGhleSdsbFxuICAgIC8vIGJlIHJlc2VudCBpZiBzdGlsbCByZWxldmFudC5cbiAgICBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3JlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMpIHtcbiAgICAgIC8vIEZvcmdldCBhYm91dCB0aGUgZWZmZWN0cyBvZiBzdHVicy4gV2UnbGwgYmUgcmVzZXR0aW5nIGFsbCBjb2xsZWN0aW9uc1xuICAgICAgLy8gYW55d2F5LlxuICAgICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIH1cblxuICAgIC8vIENsZWFyIF9hZnRlclVwZGF0ZUNhbGxiYWNrcy5cbiAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcyA9IFtdO1xuXG4gICAgLy8gTWFyayBhbGwgbmFtZWQgc3Vic2NyaXB0aW9ucyB3aGljaCBhcmUgcmVhZHkgYXMgbmVlZGluZyB0byBiZSByZXZpdmVkLlxuICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIE9iamVjdC5lbnRyaWVzKHNlbGYuX3N1YnNjcmlwdGlvbnMpLmZvckVhY2goKFtpZCwgc3ViXSkgPT4ge1xuICAgICAgaWYgKHN1Yi5yZWFkeSkge1xuICAgICAgICBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW2lkXSA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBcnJhbmdlIGZvciBcImhhbGYtZmluaXNoZWRcIiBtZXRob2RzIHRvIGhhdmUgdGhlaXIgY2FsbGJhY2tzIHJ1biwgYW5kXG4gICAgLy8gdHJhY2sgbWV0aG9kcyB0aGF0IHdlcmUgc2VudCBvbiB0aGlzIGNvbm5lY3Rpb24gc28gdGhhdCB3ZSBkb24ndFxuICAgIC8vIHF1aWVzY2UgdW50aWwgdGhleSBhcmUgYWxsIGRvbmUuXG4gICAgLy9cbiAgICAvLyBTdGFydCBieSBjbGVhcmluZyBfbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZTogbWV0aG9kcyBzZW50IGJlZm9yZVxuICAgIC8vIHJlY29ubmVjdCBkb24ndCBtYXR0ZXIsIGFuZCBhbnkgXCJ3YWl0XCIgbWV0aG9kcyBzZW50IG9uIHRoZSBuZXcgY29ubmVjdGlvblxuICAgIC8vIHRoYXQgd2UgZHJvcCBoZXJlIHdpbGwgYmUgcmVzdG9yZWQgYnkgdGhlIGxvb3AgYmVsb3cuXG4gICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICBjb25zdCBpbnZva2VycyA9IHNlbGYuX21ldGhvZEludm9rZXJzO1xuICAgICAgT2JqZWN0LmtleXMoaW52b2tlcnMpLmZvckVhY2goaWQgPT4ge1xuICAgICAgICBjb25zdCBpbnZva2VyID0gaW52b2tlcnNbaWRdO1xuICAgICAgICBpZiAoaW52b2tlci5nb3RSZXN1bHQoKSkge1xuICAgICAgICAgIC8vIFRoaXMgbWV0aG9kIGFscmVhZHkgZ290IGl0cyByZXN1bHQsIGJ1dCBpdCBkaWRuJ3QgY2FsbCBpdHMgY2FsbGJhY2tcbiAgICAgICAgICAvLyBiZWNhdXNlIGl0cyBkYXRhIGRpZG4ndCBiZWNvbWUgdmlzaWJsZS4gV2UgZGlkIG5vdCByZXNlbmQgdGhlXG4gICAgICAgICAgLy8gbWV0aG9kIFJQQy4gV2UnbGwgY2FsbCBpdHMgY2FsbGJhY2sgd2hlbiB3ZSBnZXQgYSBmdWxsIHF1aWVzY2UsXG4gICAgICAgICAgLy8gc2luY2UgdGhhdCdzIGFzIGNsb3NlIGFzIHdlJ2xsIGdldCB0byBcImRhdGEgbXVzdCBiZSB2aXNpYmxlXCIuXG4gICAgICAgICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MucHVzaChcbiAgICAgICAgICAgICguLi5hcmdzKSA9PiBpbnZva2VyLmRhdGFWaXNpYmxlKC4uLmFyZ3MpXG4gICAgICAgICAgKTtcbiAgICAgICAgfSBlbHNlIGlmIChpbnZva2VyLnNlbnRNZXNzYWdlKSB7XG4gICAgICAgICAgLy8gVGhpcyBtZXRob2QgaGFzIGJlZW4gc2VudCBvbiB0aGlzIGNvbm5lY3Rpb24gKG1heWJlIGFzIGEgcmVzZW5kXG4gICAgICAgICAgLy8gZnJvbSB0aGUgbGFzdCBjb25uZWN0aW9uLCBtYXliZSBmcm9tIG9uUmVjb25uZWN0LCBtYXliZSBqdXN0IHZlcnlcbiAgICAgICAgICAvLyBxdWlja2x5IGJlZm9yZSBwcm9jZXNzaW5nIHRoZSBjb25uZWN0ZWQgbWVzc2FnZSkuXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBXZSBkb24ndCBuZWVkIHRvIGRvIGFueXRoaW5nIHNwZWNpYWwgdG8gZW5zdXJlIGl0cyBjYWxsYmFja3MgZ2V0XG4gICAgICAgICAgLy8gY2FsbGVkLCBidXQgd2UnbGwgY291bnQgaXQgYXMgYSBtZXRob2Qgd2hpY2ggaXMgcHJldmVudGluZ1xuICAgICAgICAgIC8vIHJlY29ubmVjdCBxdWllc2NlbmNlLiAoZWcsIGl0IG1pZ2h0IGJlIGEgbG9naW4gbWV0aG9kIHRoYXQgd2FzIHJ1blxuICAgICAgICAgIC8vIGZyb20gb25SZWNvbm5lY3QsIGFuZCB3ZSBkb24ndCB3YW50IHRvIHNlZSBmbGlja2VyIGJ5IHNlZWluZyBhXG4gICAgICAgICAgLy8gbG9nZ2VkLW91dCBzdGF0ZS4pXG4gICAgICAgICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVtpbnZva2VyLm1ldGhvZElkXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UgPSBbXTtcblxuICAgIC8vIElmIHdlJ3JlIG5vdCB3YWl0aW5nIG9uIGFueSBtZXRob2RzIG9yIHN1YnMsIHdlIGNhbiByZXNldCB0aGUgc3RvcmVzIGFuZFxuICAgIC8vIGNhbGwgdGhlIGNhbGxiYWNrcyBpbW1lZGlhdGVseS5cbiAgICBpZiAoIXNlbGYuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgICBmb3IgKGNvbnN0IHN0b3JlIG9mIE9iamVjdC52YWx1ZXMoc2VsZi5fc3RvcmVzKSkge1xuICAgICAgICAgIGF3YWl0IHN0b3JlLmJlZ2luVXBkYXRlKDAsIHRydWUpO1xuICAgICAgICAgIGF3YWl0IHN0b3JlLmVuZFVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBQcm9jZXNzIHZhcmlvdXMgZGF0YSBtZXNzYWdlcyBmcm9tIHRoZSBzZXJ2ZXJcbiAgICogQHBhcmFtIHtPYmplY3R9IG1zZyBUaGUgZGF0YSBtZXNzYWdlXG4gICAqL1xuICBhc3luYyBfbGl2ZWRhdGFfZGF0YShtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcy5fY29ubmVjdGlvbjtcblxuICAgIGlmIChzZWxmLl93YWl0aW5nRm9yUXVpZXNjZW5jZSgpKSB7XG4gICAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlLnB1c2gobXNnKTtcblxuICAgICAgaWYgKG1zZy5tc2cgPT09ICdub3N1YicpIHtcbiAgICAgICAgZGVsZXRlIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWRbbXNnLmlkXTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1zZy5zdWJzKSB7XG4gICAgICAgIG1zZy5zdWJzLmZvckVhY2goc3ViSWQgPT4ge1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW3N1YklkXTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChtc2cubWV0aG9kcykge1xuICAgICAgICBtc2cubWV0aG9kcy5mb3JFYWNoKG1ldGhvZElkID0+IHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVttZXRob2RJZF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi5fd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIE5vIG1ldGhvZHMgb3Igc3VicyBhcmUgYmxvY2tpbmcgcXVpZXNjZW5jZSFcbiAgICAgIC8vIFdlJ2xsIG5vdyBwcm9jZXNzIGFuZCBhbGwgb2Ygb3VyIGJ1ZmZlcmVkIG1lc3NhZ2VzLCByZXNldCBhbGwgc3RvcmVzLFxuICAgICAgLy8gYW5kIGFwcGx5IHRoZW0gYWxsIGF0IG9uY2UuXG4gICAgICBjb25zdCBidWZmZXJlZE1lc3NhZ2VzID0gc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZTtcbiAgICAgIGZvciAoY29uc3QgYnVmZmVyZWRNZXNzYWdlIG9mIE9iamVjdC52YWx1ZXMoYnVmZmVyZWRNZXNzYWdlcykpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5fcHJvY2Vzc09uZURhdGFNZXNzYWdlKFxuICAgICAgICAgIGJ1ZmZlcmVkTWVzc2FnZSxcbiAgICAgICAgICBzZWxmLl9idWZmZXJlZFdyaXRlc1xuICAgICAgICApO1xuICAgICAgfVxuICAgICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCB0aGlzLl9wcm9jZXNzT25lRGF0YU1lc3NhZ2UobXNnLCBzZWxmLl9idWZmZXJlZFdyaXRlcyk7XG4gICAgfVxuXG4gICAgLy8gSW1tZWRpYXRlbHkgZmx1c2ggd3JpdGVzIHdoZW46XG4gICAgLy8gIDEuIEJ1ZmZlcmluZyBpcyBkaXNhYmxlZC4gT3I7XG4gICAgLy8gIDIuIGFueSBub24tKGFkZGVkL2NoYW5nZWQvcmVtb3ZlZCkgbWVzc2FnZSBhcnJpdmVzLlxuICAgIGNvbnN0IHN0YW5kYXJkV3JpdGUgPVxuICAgICAgbXNnLm1zZyA9PT0gXCJhZGRlZFwiIHx8XG4gICAgICBtc2cubXNnID09PSBcImNoYW5nZWRcIiB8fFxuICAgICAgbXNnLm1zZyA9PT0gXCJyZW1vdmVkXCI7XG5cbiAgICBpZiAoc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCA9PT0gMCB8fCAhc3RhbmRhcmRXcml0ZSkge1xuICAgICAgYXdhaXQgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPT09IG51bGwpIHtcbiAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hBdCA9XG4gICAgICAgIG5ldyBEYXRlKCkudmFsdWVPZigpICsgc2VsZi5fYnVmZmVyZWRXcml0ZXNNYXhBZ2U7XG4gICAgfSBlbHNlIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPCBuZXcgRGF0ZSgpLnZhbHVlT2YoKSkge1xuICAgICAgYXdhaXQgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSk7XG4gICAgfVxuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIHNlbGYuX2xpdmVEYXRhV3JpdGVzUHJvbWlzZSA9IHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICAgIGlmIChNZXRlb3IuX2lzUHJvbWlzZShzZWxmLl9saXZlRGF0YVdyaXRlc1Byb21pc2UpKSB7XG4gICAgICAgIHNlbGYuX2xpdmVEYXRhV3JpdGVzUHJvbWlzZS5maW5hbGx5KFxuICAgICAgICAgICgpID0+IChzZWxmLl9saXZlRGF0YVdyaXRlc1Byb21pc2UgPSB1bmRlZmluZWQpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSwgc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCk7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgUHJvY2VzcyBpbmRpdmlkdWFsIGRhdGEgbWVzc2FnZXMgYnkgdHlwZVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgYXN5bmMgX3Byb2Nlc3NPbmVEYXRhTWVzc2FnZShtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBtZXNzYWdlVHlwZSA9IG1zZy5tc2c7XG5cbiAgICBzd2l0Y2ggKG1lc3NhZ2VUeXBlKSB7XG4gICAgICBjYXNlICdhZGRlZCc6XG4gICAgICAgIGF3YWl0IHRoaXMuX2Nvbm5lY3Rpb24uX3Byb2Nlc3NfYWRkZWQobXNnLCB1cGRhdGVzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdjaGFuZ2VkJzpcbiAgICAgICAgdGhpcy5fY29ubmVjdGlvbi5fcHJvY2Vzc19jaGFuZ2VkKG1zZywgdXBkYXRlcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAncmVtb3ZlZCc6XG4gICAgICAgIHRoaXMuX2Nvbm5lY3Rpb24uX3Byb2Nlc3NfcmVtb3ZlZChtc2csIHVwZGF0ZXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3JlYWR5JzpcbiAgICAgICAgdGhpcy5fY29ubmVjdGlvbi5fcHJvY2Vzc19yZWFkeShtc2csIHVwZGF0ZXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3VwZGF0ZWQnOlxuICAgICAgICB0aGlzLl9jb25uZWN0aW9uLl9wcm9jZXNzX3VwZGF0ZWQobXNnLCB1cGRhdGVzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdub3N1Yic6XG4gICAgICAgIC8vIGlnbm9yZSB0aGlzXG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZygnZGlzY2FyZGluZyB1bmtub3duIGxpdmVkYXRhIGRhdGEgbWVzc2FnZSB0eXBlJywgbXNnKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgSGFuZGxlIG1ldGhvZCByZXN1bHRzIGFycml2aW5nIGZyb20gdGhlIHNlcnZlclxuICAgKiBAcGFyYW0ge09iamVjdH0gbXNnIFRoZSBtZXRob2QgcmVzdWx0IG1lc3NhZ2VcbiAgICovXG4gIGFzeW5jIF9saXZlZGF0YV9yZXN1bHQobXNnKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXMuX2Nvbm5lY3Rpb247XG5cbiAgICAvLyBMZXRzIG1ha2Ugc3VyZSB0aGVyZSBhcmUgbm8gYnVmZmVyZWQgd3JpdGVzIGJlZm9yZSByZXR1cm5pbmcgcmVzdWx0LlxuICAgIGlmICghaXNFbXB0eShzZWxmLl9idWZmZXJlZFdyaXRlcykpIHtcbiAgICAgIGF3YWl0IHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICB9XG5cbiAgICAvLyBmaW5kIHRoZSBvdXRzdGFuZGluZyByZXF1ZXN0XG4gICAgLy8gc2hvdWxkIGJlIE8oMSkgaW4gbmVhcmx5IGFsbCByZWFsaXN0aWMgdXNlIGNhc2VzXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdSZWNlaXZlZCBtZXRob2QgcmVzdWx0IGJ1dCBubyBtZXRob2RzIG91dHN0YW5kaW5nJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGN1cnJlbnRNZXRob2RCbG9jayA9IHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHM7XG4gICAgbGV0IGk7XG4gICAgY29uc3QgbSA9IGN1cnJlbnRNZXRob2RCbG9jay5maW5kKChtZXRob2QsIGlkeCkgPT4ge1xuICAgICAgY29uc3QgZm91bmQgPSBtZXRob2QubWV0aG9kSWQgPT09IG1zZy5pZDtcbiAgICAgIGlmIChmb3VuZCkgaSA9IGlkeDtcbiAgICAgIHJldHVybiBmb3VuZDtcbiAgICB9KTtcbiAgICBpZiAoIW0pIHtcbiAgICAgIE1ldGVvci5fZGVidWcoXCJDYW4ndCBtYXRjaCBtZXRob2QgcmVzcG9uc2UgdG8gb3JpZ2luYWwgbWV0aG9kIGNhbGxcIiwgbXNnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgZnJvbSBjdXJyZW50IG1ldGhvZCBibG9jay4gVGhpcyBtYXkgbGVhdmUgdGhlIGJsb2NrIGVtcHR5LCBidXQgd2VcbiAgICAvLyBkb24ndCBtb3ZlIG9uIHRvIHRoZSBuZXh0IGJsb2NrIHVudGlsIHRoZSBjYWxsYmFjayBoYXMgYmVlbiBkZWxpdmVyZWQsIGluXG4gICAgLy8gX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQuXG4gICAgY3VycmVudE1ldGhvZEJsb2NrLnNwbGljZShpLCAxKTtcblxuICAgIGlmIChoYXNPd24uY2FsbChtc2csICdlcnJvcicpKSB7XG4gICAgICBtLnJlY2VpdmVSZXN1bHQoXG4gICAgICAgIG5ldyBNZXRlb3IuRXJyb3IobXNnLmVycm9yLmVycm9yLCBtc2cuZXJyb3IucmVhc29uLCBtc2cuZXJyb3IuZGV0YWlscylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIG1zZy5yZXN1bHQgbWF5IGJlIHVuZGVmaW5lZCBpZiB0aGUgbWV0aG9kIGRpZG4ndCByZXR1cm4gYSB2YWx1ZVxuICAgICAgbS5yZWNlaXZlUmVzdWx0KHVuZGVmaW5lZCwgbXNnLnJlc3VsdCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEhhbmRsZSBcIm5vc3ViXCIgbWVzc2FnZXMgYXJyaXZpbmcgZnJvbSB0aGUgc2VydmVyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBtc2cgVGhlIG5vc3ViIG1lc3NhZ2VcbiAgICovXG4gIGFzeW5jIF9saXZlZGF0YV9ub3N1Yihtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcy5fY29ubmVjdGlvbjtcblxuICAgIC8vIEZpcnN0IHBhc3MgaXQgdGhyb3VnaCBfbGl2ZWRhdGFfZGF0YSwgd2hpY2ggb25seSB1c2VzIGl0IHRvIGhlbHAgZ2V0XG4gICAgLy8gdG93YXJkcyBxdWllc2NlbmNlLlxuICAgIGF3YWl0IHRoaXMuX2xpdmVkYXRhX2RhdGEobXNnKTtcblxuICAgIC8vIERvIHRoZSByZXN0IG9mIG91ciBwcm9jZXNzaW5nIGltbWVkaWF0ZWx5LCB3aXRoIG5vXG4gICAgLy8gYnVmZmVyaW5nLXVudGlsLXF1aWVzY2VuY2UuXG5cbiAgICAvLyB3ZSB3ZXJlbid0IHN1YmJlZCBhbnl3YXksIG9yIHdlIGluaXRpYXRlZCB0aGUgdW5zdWIuXG4gICAgaWYgKCFoYXNPd24uY2FsbChzZWxmLl9zdWJzY3JpcHRpb25zLCBtc2cuaWQpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICBjb25zdCBlcnJvckNhbGxiYWNrID0gc2VsZi5fc3Vic2NyaXB0aW9uc1ttc2cuaWRdLmVycm9yQ2FsbGJhY2s7XG4gICAgY29uc3Qgc3RvcENhbGxiYWNrID0gc2VsZi5fc3Vic2NyaXB0aW9uc1ttc2cuaWRdLnN0b3BDYWxsYmFjaztcblxuICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbbXNnLmlkXS5yZW1vdmUoKTtcblxuICAgIGNvbnN0IG1ldGVvckVycm9yRnJvbU1zZyA9IG1zZ0FyZyA9PiB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICBtc2dBcmcgJiZcbiAgICAgICAgbXNnQXJnLmVycm9yICYmXG4gICAgICAgIG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgbXNnQXJnLmVycm9yLmVycm9yLFxuICAgICAgICAgIG1zZ0FyZy5lcnJvci5yZWFzb24sXG4gICAgICAgICAgbXNnQXJnLmVycm9yLmRldGFpbHNcbiAgICAgICAgKVxuICAgICAgKTtcbiAgICB9O1xuXG4gICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgI2Vycm9yQ2FsbGJhY2tcbiAgICBpZiAoZXJyb3JDYWxsYmFjayAmJiBtc2cuZXJyb3IpIHtcbiAgICAgIGVycm9yQ2FsbGJhY2sobWV0ZW9yRXJyb3JGcm9tTXNnKG1zZykpO1xuICAgIH1cblxuICAgIGlmIChzdG9wQ2FsbGJhY2spIHtcbiAgICAgIHN0b3BDYWxsYmFjayhtZXRlb3JFcnJvckZyb21Nc2cobXNnKSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEhhbmRsZSBlcnJvcnMgZnJvbSB0aGUgc2VydmVyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBtc2cgVGhlIGVycm9yIG1lc3NhZ2VcbiAgICovXG4gIF9saXZlZGF0YV9lcnJvcihtc2cpIHtcbiAgICBNZXRlb3IuX2RlYnVnKCdSZWNlaXZlZCBlcnJvciBmcm9tIHNlcnZlcjogJywgbXNnLnJlYXNvbik7XG4gICAgaWYgKG1zZy5vZmZlbmRpbmdNZXNzYWdlKSBNZXRlb3IuX2RlYnVnKCdGb3I6ICcsIG1zZy5vZmZlbmRpbmdNZXNzYWdlKTtcbiAgfVxuXG4gIC8vIERvY3VtZW50IGNoYW5nZSBtZXNzYWdlIHByb2Nlc3NvcnMgd2lsbCBiZSBkZWZpbmVkIGluIGEgc2VwYXJhdGUgY2xhc3Ncbn0iLCIvLyBBIE1ldGhvZEludm9rZXIgbWFuYWdlcyBzZW5kaW5nIGEgbWV0aG9kIHRvIHRoZSBzZXJ2ZXIgYW5kIGNhbGxpbmcgdGhlIHVzZXInc1xuLy8gY2FsbGJhY2tzLiBPbiBjb25zdHJ1Y3Rpb24sIGl0IHJlZ2lzdGVycyBpdHNlbGYgaW4gdGhlIGNvbm5lY3Rpb24nc1xuLy8gX21ldGhvZEludm9rZXJzIG1hcDsgaXQgcmVtb3ZlcyBpdHNlbGYgb25jZSB0aGUgbWV0aG9kIGlzIGZ1bGx5IGZpbmlzaGVkIGFuZFxuLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQuIFRoaXMgb2NjdXJzIHdoZW4gaXQgaGFzIGJvdGggcmVjZWl2ZWQgYSByZXN1bHQsXG4vLyBhbmQgdGhlIGRhdGEgd3JpdHRlbiBieSBpdCBpcyBmdWxseSB2aXNpYmxlLlxuZXhwb3J0IGNsYXNzIE1ldGhvZEludm9rZXIge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgLy8gUHVibGljICh3aXRoaW4gdGhpcyBmaWxlKSBmaWVsZHMuXG4gICAgdGhpcy5tZXRob2RJZCA9IG9wdGlvbnMubWV0aG9kSWQ7XG4gICAgdGhpcy5zZW50TWVzc2FnZSA9IGZhbHNlO1xuXG4gICAgdGhpcy5fY2FsbGJhY2sgPSBvcHRpb25zLmNhbGxiYWNrO1xuICAgIHRoaXMuX2Nvbm5lY3Rpb24gPSBvcHRpb25zLmNvbm5lY3Rpb247XG4gICAgdGhpcy5fbWVzc2FnZSA9IG9wdGlvbnMubWVzc2FnZTtcbiAgICB0aGlzLl9vblJlc3VsdFJlY2VpdmVkID0gb3B0aW9ucy5vblJlc3VsdFJlY2VpdmVkIHx8ICgoKSA9PiB7fSk7XG4gICAgdGhpcy5fd2FpdCA9IG9wdGlvbnMud2FpdDtcbiAgICB0aGlzLm5vUmV0cnkgPSBvcHRpb25zLm5vUmV0cnk7XG4gICAgdGhpcy5fbWV0aG9kUmVzdWx0ID0gbnVsbDtcbiAgICB0aGlzLl9kYXRhVmlzaWJsZSA9IGZhbHNlO1xuXG4gICAgLy8gUmVnaXN0ZXIgd2l0aCB0aGUgY29ubmVjdGlvbi5cbiAgICB0aGlzLl9jb25uZWN0aW9uLl9tZXRob2RJbnZva2Vyc1t0aGlzLm1ldGhvZElkXSA9IHRoaXM7XG4gIH1cbiAgLy8gU2VuZHMgdGhlIG1ldGhvZCBtZXNzYWdlIHRvIHRoZSBzZXJ2ZXIuIE1heSBiZSBjYWxsZWQgYWRkaXRpb25hbCB0aW1lcyBpZlxuICAvLyB3ZSBsb3NlIHRoZSBjb25uZWN0aW9uIGFuZCByZWNvbm5lY3QgYmVmb3JlIHJlY2VpdmluZyBhIHJlc3VsdC5cbiAgc2VuZE1lc3NhZ2UoKSB7XG4gICAgLy8gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgYmVmb3JlIHNlbmRpbmcgYSBtZXRob2QgKGluY2x1ZGluZyByZXNlbmRpbmcgb25cbiAgICAvLyByZWNvbm5lY3QpLiBXZSBzaG91bGQgb25seSAocmUpc2VuZCBtZXRob2RzIHdoZXJlIHdlIGRvbid0IGFscmVhZHkgaGF2ZSBhXG4gICAgLy8gcmVzdWx0IVxuICAgIGlmICh0aGlzLmdvdFJlc3VsdCgpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdzZW5kaW5nTWV0aG9kIGlzIGNhbGxlZCBvbiBtZXRob2Qgd2l0aCByZXN1bHQnKTtcblxuICAgIC8vIElmIHdlJ3JlIHJlLXNlbmRpbmcgaXQsIGl0IGRvZXNuJ3QgbWF0dGVyIGlmIGRhdGEgd2FzIHdyaXR0ZW4gdGhlIGZpcnN0XG4gICAgLy8gdGltZS5cbiAgICB0aGlzLl9kYXRhVmlzaWJsZSA9IGZhbHNlO1xuICAgIHRoaXMuc2VudE1lc3NhZ2UgPSB0cnVlO1xuXG4gICAgLy8gSWYgdGhpcyBpcyBhIHdhaXQgbWV0aG9kLCBtYWtlIGFsbCBkYXRhIG1lc3NhZ2VzIGJlIGJ1ZmZlcmVkIHVudGlsIGl0IGlzXG4gICAgLy8gZG9uZS5cbiAgICBpZiAodGhpcy5fd2FpdClcbiAgICAgIHRoaXMuX2Nvbm5lY3Rpb24uX21ldGhvZHNCbG9ja2luZ1F1aWVzY2VuY2VbdGhpcy5tZXRob2RJZF0gPSB0cnVlO1xuXG4gICAgLy8gQWN0dWFsbHkgc2VuZCB0aGUgbWVzc2FnZS5cbiAgICB0aGlzLl9jb25uZWN0aW9uLl9zZW5kKHRoaXMuX21lc3NhZ2UpO1xuICB9XG4gIC8vIEludm9rZSB0aGUgY2FsbGJhY2ssIGlmIHdlIGhhdmUgYm90aCBhIHJlc3VsdCBhbmQga25vdyB0aGF0IGFsbCBkYXRhIGhhc1xuICAvLyBiZWVuIHdyaXR0ZW4gdG8gdGhlIGxvY2FsIGNhY2hlLlxuICBfbWF5YmVJbnZva2VDYWxsYmFjaygpIHtcbiAgICBpZiAodGhpcy5fbWV0aG9kUmVzdWx0ICYmIHRoaXMuX2RhdGFWaXNpYmxlKSB7XG4gICAgICAvLyBDYWxsIHRoZSBjYWxsYmFjay4gKFRoaXMgd29uJ3QgdGhyb3c6IHRoZSBjYWxsYmFjayB3YXMgd3JhcHBlZCB3aXRoXG4gICAgICAvLyBiaW5kRW52aXJvbm1lbnQuKVxuICAgICAgdGhpcy5fY2FsbGJhY2sodGhpcy5fbWV0aG9kUmVzdWx0WzBdLCB0aGlzLl9tZXRob2RSZXN1bHRbMV0pO1xuXG4gICAgICAvLyBGb3JnZXQgYWJvdXQgdGhpcyBtZXRob2QuXG4gICAgICBkZWxldGUgdGhpcy5fY29ubmVjdGlvbi5fbWV0aG9kSW52b2tlcnNbdGhpcy5tZXRob2RJZF07XG5cbiAgICAgIC8vIExldCB0aGUgY29ubmVjdGlvbiBrbm93IHRoYXQgdGhpcyBtZXRob2QgaXMgZmluaXNoZWQsIHNvIGl0IGNhbiB0cnkgdG9cbiAgICAgIC8vIG1vdmUgb24gdG8gdGhlIG5leHQgYmxvY2sgb2YgbWV0aG9kcy5cbiAgICAgIHRoaXMuX2Nvbm5lY3Rpb24uX291dHN0YW5kaW5nTWV0aG9kRmluaXNoZWQoKTtcbiAgICB9XG4gIH1cbiAgLy8gQ2FsbCB3aXRoIHRoZSByZXN1bHQgb2YgdGhlIG1ldGhvZCBmcm9tIHRoZSBzZXJ2ZXIuIE9ubHkgbWF5IGJlIGNhbGxlZFxuICAvLyBvbmNlOyBvbmNlIGl0IGlzIGNhbGxlZCwgeW91IHNob3VsZCBub3QgY2FsbCBzZW5kTWVzc2FnZSBhZ2Fpbi5cbiAgLy8gSWYgdGhlIHVzZXIgcHJvdmlkZWQgYW4gb25SZXN1bHRSZWNlaXZlZCBjYWxsYmFjaywgY2FsbCBpdCBpbW1lZGlhdGVseS5cbiAgLy8gVGhlbiBpbnZva2UgdGhlIG1haW4gY2FsbGJhY2sgaWYgZGF0YSBpcyBhbHNvIHZpc2libGUuXG4gIHJlY2VpdmVSZXN1bHQoZXJyLCByZXN1bHQpIHtcbiAgICBpZiAodGhpcy5nb3RSZXN1bHQoKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kcyBzaG91bGQgb25seSByZWNlaXZlIHJlc3VsdHMgb25jZScpO1xuICAgIHRoaXMuX21ldGhvZFJlc3VsdCA9IFtlcnIsIHJlc3VsdF07XG4gICAgdGhpcy5fb25SZXN1bHRSZWNlaXZlZChlcnIsIHJlc3VsdCk7XG4gICAgdGhpcy5fbWF5YmVJbnZva2VDYWxsYmFjaygpO1xuICB9XG4gIC8vIENhbGwgdGhpcyB3aGVuIGFsbCBkYXRhIHdyaXR0ZW4gYnkgdGhlIG1ldGhvZCBpcyB2aXNpYmxlLiBUaGlzIG1lYW5zIHRoYXRcbiAgLy8gdGhlIG1ldGhvZCBoYXMgcmV0dXJucyBpdHMgXCJkYXRhIGlzIGRvbmVcIiBtZXNzYWdlICpBTkQqIGFsbCBzZXJ2ZXJcbiAgLy8gZG9jdW1lbnRzIHRoYXQgYXJlIGJ1ZmZlcmVkIGF0IHRoYXQgdGltZSBoYXZlIGJlZW4gd3JpdHRlbiB0byB0aGUgbG9jYWxcbiAgLy8gY2FjaGUuIEludm9rZXMgdGhlIG1haW4gY2FsbGJhY2sgaWYgdGhlIHJlc3VsdCBoYXMgYmVlbiByZWNlaXZlZC5cbiAgZGF0YVZpc2libGUoKSB7XG4gICAgdGhpcy5fZGF0YVZpc2libGUgPSB0cnVlO1xuICAgIHRoaXMuX21heWJlSW52b2tlQ2FsbGJhY2soKTtcbiAgfVxuICAvLyBUcnVlIGlmIHJlY2VpdmVSZXN1bHQgaGFzIGJlZW4gY2FsbGVkLlxuICBnb3RSZXN1bHQoKSB7XG4gICAgcmV0dXJuICEhdGhpcy5fbWV0aG9kUmVzdWx0O1xuICB9XG59XG4iLCJpbXBvcnQgeyBNb25nb0lEIH0gZnJvbSAnbWV0ZW9yL21vbmdvLWlkJztcblxuZXhwb3J0IGNsYXNzIE1vbmdvSURNYXAgZXh0ZW5kcyBJZE1hcCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKE1vbmdvSUQuaWRTdHJpbmdpZnksIE1vbmdvSUQuaWRQYXJzZSk7XG4gIH1cbn0iLCJpbXBvcnQgeyBERFBDb21tb24gfSBmcm9tICdtZXRlb3IvZGRwLWNvbW1vbic7XG5pbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcblxuaW1wb3J0IHsgQ29ubmVjdGlvbiB9IGZyb20gJy4vbGl2ZWRhdGFfY29ubmVjdGlvbi5qcyc7XG5cbi8vIFRoaXMgYXJyYXkgYWxsb3dzIHRoZSBgX2FsbFN1YnNjcmlwdGlvbnNSZWFkeWAgbWV0aG9kIGJlbG93LCB3aGljaFxuLy8gaXMgdXNlZCBieSB0aGUgYHNwaWRlcmFibGVgIHBhY2thZ2UsIHRvIGtlZXAgdHJhY2sgb2Ygd2hldGhlciBhbGxcbi8vIGRhdGEgaXMgcmVhZHkuXG5jb25zdCBhbGxDb25uZWN0aW9ucyA9IFtdO1xuXG4vKipcbiAqIEBuYW1lc3BhY2UgRERQXG4gKiBAc3VtbWFyeSBOYW1lc3BhY2UgZm9yIEREUC1yZWxhdGVkIG1ldGhvZHMvY2xhc3Nlcy5cbiAqL1xuZXhwb3J0IGNvbnN0IEREUCA9IHt9O1xuXG4vLyBUaGlzIGlzIHByaXZhdGUgYnV0IGl0J3MgdXNlZCBpbiBhIGZldyBwbGFjZXMuIGFjY291bnRzLWJhc2UgdXNlc1xuLy8gaXQgdG8gZ2V0IHRoZSBjdXJyZW50IHVzZXIuIE1ldGVvci5zZXRUaW1lb3V0IGFuZCBmcmllbmRzIGNsZWFyXG4vLyBpdC4gV2UgY2FuIHByb2JhYmx5IGZpbmQgYSBiZXR0ZXIgd2F5IHRvIGZhY3RvciB0aGlzLlxuRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiA9IG5ldyBNZXRlb3IuRW52aXJvbm1lbnRWYXJpYWJsZSgpO1xuRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlKCk7XG5cbi8vIFhYWDogS2VlcCBERFAuX0N1cnJlbnRJbnZvY2F0aW9uIGZvciBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eS5cbkREUC5fQ3VycmVudEludm9jYXRpb24gPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uO1xuXG5ERFAuX0N1cnJlbnRDYWxsQXN5bmNJbnZvY2F0aW9uID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlKCk7XG5cbi8vIFRoaXMgaXMgcGFzc2VkIGludG8gYSB3ZWlyZCBgbWFrZUVycm9yVHlwZWAgZnVuY3Rpb24gdGhhdCBleHBlY3RzIGl0cyB0aGluZ1xuLy8gdG8gYmUgYSBjb25zdHJ1Y3RvclxuZnVuY3Rpb24gY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3IobWVzc2FnZSkge1xuICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuXG5ERFAuQ29ubmVjdGlvbkVycm9yID0gTWV0ZW9yLm1ha2VFcnJvclR5cGUoXG4gICdERFAuQ29ubmVjdGlvbkVycm9yJyxcbiAgY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3Jcbik7XG5cbkREUC5Gb3JjZWRSZWNvbm5lY3RFcnJvciA9IE1ldGVvci5tYWtlRXJyb3JUeXBlKFxuICAnRERQLkZvcmNlZFJlY29ubmVjdEVycm9yJyxcbiAgKCkgPT4ge31cbik7XG5cbi8vIFJldHVybnMgdGhlIG5hbWVkIHNlcXVlbmNlIG9mIHBzZXVkby1yYW5kb20gdmFsdWVzLlxuLy8gVGhlIHNjb3BlIHdpbGwgYmUgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKSwgc28gdGhlIHN0cmVhbSB3aWxsIHByb2R1Y2Vcbi8vIGNvbnNpc3RlbnQgdmFsdWVzIGZvciBtZXRob2QgY2FsbHMgb24gdGhlIGNsaWVudCBhbmQgc2VydmVyLlxuRERQLnJhbmRvbVN0cmVhbSA9IG5hbWUgPT4ge1xuICBjb25zdCBzY29wZSA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCk7XG4gIHJldHVybiBERFBDb21tb24uUmFuZG9tU3RyZWFtLmdldChzY29wZSwgbmFtZSk7XG59O1xuXG4vLyBAcGFyYW0gdXJsIHtTdHJpbmd9IFVSTCB0byBNZXRlb3IgYXBwLFxuLy8gICAgIGUuZy46XG4vLyAgICAgXCJzdWJkb21haW4ubWV0ZW9yLmNvbVwiLFxuLy8gICAgIFwiaHR0cDovL3N1YmRvbWFpbi5tZXRlb3IuY29tXCIsXG4vLyAgICAgXCIvXCIsXG4vLyAgICAgXCJkZHArc29ja2pzOi8vZGRwLS0qKioqLWZvby5tZXRlb3IuY29tL3NvY2tqc1wiXG5cbi8qKlxuICogQHN1bW1hcnkgQ29ubmVjdCB0byB0aGUgc2VydmVyIG9mIGEgZGlmZmVyZW50IE1ldGVvciBhcHBsaWNhdGlvbiB0byBzdWJzY3JpYmUgdG8gaXRzIGRvY3VtZW50IHNldHMgYW5kIGludm9rZSBpdHMgcmVtb3RlIG1ldGhvZHMuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7U3RyaW5nfSB1cmwgVGhlIFVSTCBvZiBhbm90aGVyIE1ldGVvciBhcHBsaWNhdGlvbi5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZWxvYWRXaXRoT3V0c3RhbmRpbmcgaXMgaXQgT0sgdG8gcmVsb2FkIGlmIHRoZXJlIGFyZSBvdXRzdGFuZGluZyBtZXRob2RzP1xuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuaGVhZGVycyBleHRyYSBoZWFkZXJzIHRvIHNlbmQgb24gdGhlIHdlYnNvY2tldHMgY29ubmVjdGlvbiwgZm9yIHNlcnZlci10by1zZXJ2ZXIgRERQIG9ubHlcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLl9zb2NranNPcHRpb25zIFNwZWNpZmllcyBvcHRpb25zIHRvIHBhc3MgdGhyb3VnaCB0byB0aGUgc29ja2pzIGNsaWVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy5vbkREUE5lZ290aWF0aW9uVmVyc2lvbkZhaWx1cmUgY2FsbGJhY2sgd2hlbiB2ZXJzaW9uIG5lZ290aWF0aW9uIGZhaWxzLlxuICovXG5ERFAuY29ubmVjdCA9ICh1cmwsIG9wdGlvbnMpID0+IHtcbiAgY29uc3QgcmV0ID0gbmV3IENvbm5lY3Rpb24odXJsLCBvcHRpb25zKTtcbiAgYWxsQ29ubmVjdGlvbnMucHVzaChyZXQpOyAvLyBoYWNrLiBzZWUgYmVsb3cuXG4gIHJldHVybiByZXQ7XG59O1xuXG5ERFAuX3JlY29ubmVjdEhvb2sgPSBuZXcgSG9vayh7IGJpbmRFbnZpcm9ubWVudDogZmFsc2UgfSk7XG5cbi8qKlxuICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBmdW5jdGlvbiB0byBjYWxsIGFzIHRoZSBmaXJzdCBzdGVwIG9mXG4gKiByZWNvbm5lY3RpbmcuIFRoaXMgZnVuY3Rpb24gY2FuIGNhbGwgbWV0aG9kcyB3aGljaCB3aWxsIGJlIGV4ZWN1dGVkIGJlZm9yZVxuICogYW55IG90aGVyIG91dHN0YW5kaW5nIG1ldGhvZHMuIEZvciBleGFtcGxlLCB0aGlzIGNhbiBiZSB1c2VkIHRvIHJlLWVzdGFibGlzaFxuICogdGhlIGFwcHJvcHJpYXRlIGF1dGhlbnRpY2F0aW9uIGNvbnRleHQgb24gdGhlIGNvbm5lY3Rpb24uXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjYWxsLiBJdCB3aWxsIGJlIGNhbGxlZCB3aXRoIGFcbiAqIHNpbmdsZSBhcmd1bWVudCwgdGhlIFtjb25uZWN0aW9uIG9iamVjdF0oI2RkcF9jb25uZWN0KSB0aGF0IGlzIHJlY29ubmVjdGluZy5cbiAqL1xuRERQLm9uUmVjb25uZWN0ID0gY2FsbGJhY2sgPT4gRERQLl9yZWNvbm5lY3RIb29rLnJlZ2lzdGVyKGNhbGxiYWNrKTtcblxuLy8gSGFjayBmb3IgYHNwaWRlcmFibGVgIHBhY2thZ2U6IGEgd2F5IHRvIHNlZSBpZiB0aGUgcGFnZSBpcyBkb25lXG4vLyBsb2FkaW5nIGFsbCB0aGUgZGF0YSBpdCBuZWVkcy5cbi8vXG5ERFAuX2FsbFN1YnNjcmlwdGlvbnNSZWFkeSA9ICgpID0+IGFsbENvbm5lY3Rpb25zLmV2ZXJ5KFxuICBjb25uID0+IE9iamVjdC52YWx1ZXMoY29ubi5fc3Vic2NyaXB0aW9ucykuZXZlcnkoc3ViID0+IHN1Yi5yZWFkeSlcbik7XG4iXX0=
