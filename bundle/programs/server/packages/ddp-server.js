Package["core-runtime"].queue("ddp-server",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Retry = Package.retry.Retry;
var MongoID = Package['mongo-id'].MongoID;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DDP = Package['ddp-client'].DDP;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var StreamServer, DDPServer, Server;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-server":{"stream_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/stream_server.js                                                                                //
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
    let once;
    module.link("lodash.once", {
      default(v) {
        once = v;
      }
    }, 0);
    let zlib;
    module.link("node:zlib", {
      default(v) {
        zlib = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // By default, we use the permessage-deflate extension with default
    // configuration. If $SERVER_WEBSOCKET_COMPRESSION is set, then it must be valid
    // JSON. If it represents a falsey value, then we do not use permessage-deflate
    // at all; otherwise, the JSON value is used as an argument to deflate's
    // configure method; see
    // https://github.com/faye/permessage-deflate-node/blob/master/README.md
    //
    // (We do this in an _.once instead of at startup, because we don't want to
    // crash the tool during isopacket load if your JSON doesn't parse. This is only
    // a problem because the tool has to load the DDP server code just in order to
    // be a DDP client; see https://github.com/meteor/meteor/issues/3452 .)
    var websocketExtensions = once(function () {
      var extensions = [];
      var websocketCompressionConfig = process.env.SERVER_WEBSOCKET_COMPRESSION ? JSON.parse(process.env.SERVER_WEBSOCKET_COMPRESSION) : {};
      if (websocketCompressionConfig) {
        extensions.push(Npm.require('permessage-deflate2').configure(_objectSpread({
          threshold: 1024,
          level: zlib.constants.Z_BEST_SPEED,
          memLevel: zlib.constants.Z_MIN_MEMLEVEL,
          noContextTakeover: true,
          maxWindowBits: zlib.constants.Z_MIN_WINDOWBITS
        }, websocketCompressionConfig || {})));
      }
      return extensions;
    });
    var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || "";
    StreamServer = function () {
      var self = this;
      self.registration_callbacks = [];
      self.open_sockets = [];

      // Because we are installing directly onto WebApp.httpServer instead of using
      // WebApp.app, we have to process the path prefix ourselves.
      self.prefix = pathPrefix + '/sockjs';
      RoutePolicy.declare(self.prefix + '/', 'network');

      // set up sockjs
      var sockjs = Npm.require('sockjs');
      var serverOptions = {
        prefix: self.prefix,
        log: function () {},
        // this is the default, but we code it explicitly because we depend
        // on it in stream_client:HEARTBEAT_TIMEOUT
        heartbeat_delay: 45000,
        // The default disconnect_delay is 5 seconds, but if the server ends up CPU
        // bound for that much time, SockJS might not notice that the user has
        // reconnected because the timer (of disconnect_delay ms) can fire before
        // SockJS processes the new connection. Eventually we'll fix this by not
        // combining CPU-heavy processing with SockJS termination (eg a proxy which
        // converts to Unix sockets) but for now, raise the delay.
        disconnect_delay: 60 * 1000,
        // Allow disabling of CORS requests to address
        // https://github.com/meteor/meteor/issues/8317.
        disable_cors: !!process.env.DISABLE_SOCKJS_CORS,
        // Set the USE_JSESSIONID environment variable to enable setting the
        // JSESSIONID cookie. This is useful for setting up proxies with
        // session affinity.
        jsessionid: !!process.env.USE_JSESSIONID
      };

      // If you know your server environment (eg, proxies) will prevent websockets
      // from ever working, set $DISABLE_WEBSOCKETS and SockJS clients (ie,
      // browsers) will not waste time attempting to use them.
      // (Your server will still have a /websocket endpoint.)
      if (process.env.DISABLE_WEBSOCKETS) {
        serverOptions.websocket = false;
      } else {
        serverOptions.faye_server_options = {
          extensions: websocketExtensions()
        };
      }
      self.server = sockjs.createServer(serverOptions);

      // Install the sockjs handlers, but we want to keep around our own particular
      // request handler that adjusts idle timeouts while we have an outstanding
      // request.  This compensates for the fact that sockjs removes all listeners
      // for "request" to add its own.
      WebApp.httpServer.removeListener('request', WebApp._timeoutAdjustmentRequestCallback);
      self.server.installHandlers(WebApp.httpServer);
      WebApp.httpServer.addListener('request', WebApp._timeoutAdjustmentRequestCallback);

      // Support the /websocket endpoint
      self._redirectWebsocketEndpoint();
      self.server.on('connection', function (socket) {
        // sockjs sometimes passes us null instead of a socket object
        // so we need to guard against that. see:
        // https://github.com/sockjs/sockjs-node/issues/121
        // https://github.com/meteor/meteor/issues/10468
        if (!socket) return;

        // We want to make sure that if a client connects to us and does the initial
        // Websocket handshake but never gets to the DDP handshake, that we
        // eventually kill the socket.  Once the DDP handshake happens, DDP
        // heartbeating will work. And before the Websocket handshake, the timeouts
        // we set at the server level in webapp_server.js will work. But
        // faye-websocket calls setTimeout(0) on any socket it takes over, so there
        // is an "in between" state where this doesn't happen.  We work around this
        // by explicitly setting the socket timeout to a relatively large time here,
        // and setting it back to zero when we set up the heartbeat in
        // livedata_server.js.
        socket.setWebsocketTimeout = function (timeout) {
          if ((socket.protocol === 'websocket' || socket.protocol === 'websocket-raw') && socket._session.recv) {
            socket._session.recv.connection.setTimeout(timeout);
          }
        };
        socket.setWebsocketTimeout(45 * 1000);
        socket.send = function (data) {
          socket.write(data);
        };
        socket.on('close', function () {
          self.open_sockets = self.open_sockets.filter(function (value) {
            return value !== socket;
          });
        });
        self.open_sockets.push(socket);

        // only to send a message after connection on tests, useful for
        // socket-stream-client/server-tests.js
        if (process.env.TEST_METADATA && process.env.TEST_METADATA !== "{}") {
          socket.send(JSON.stringify({
            testMessageOnConnect: true
          }));
        }

        // call all our callbacks when we get a new socket. they will do the
        // work of setting up handlers and such for specific messages.
        self.registration_callbacks.forEach(function (callback) {
          callback(socket);
        });
      });
    };
    Object.assign(StreamServer.prototype, {
      // call my callback when a new socket connects.
      // also call it for all current connections.
      register: function (callback) {
        var self = this;
        self.registration_callbacks.push(callback);
        self.all_sockets().forEach(function (socket) {
          callback(socket);
        });
      },
      // get a list of all sockets
      all_sockets: function () {
        var self = this;
        return Object.values(self.open_sockets);
      },
      // Redirect /websocket to /sockjs/websocket in order to not expose
      // sockjs to clients that want to use raw websockets
      _redirectWebsocketEndpoint: function () {
        var self = this;
        // Unfortunately we can't use a connect middleware here since
        // sockjs installs itself prior to all existing listeners
        // (meaning prior to any connect middlewares) so we need to take
        // an approach similar to overshadowListeners in
        // https://github.com/sockjs/sockjs-node/blob/cf820c55af6a9953e16558555a31decea554f70e/src/utils.coffee
        ['request', 'upgrade'].forEach(event => {
          var httpServer = WebApp.httpServer;
          var oldHttpServerListeners = httpServer.listeners(event).slice(0);
          httpServer.removeAllListeners(event);

          // request and upgrade have different arguments passed but
          // we only care about the first one which is always request
          var newListener = function (request /*, moreArguments */) {
            // Store arguments for use within the closure below
            var args = arguments;

            // TODO replace with url package
            var url = Npm.require('url');

            // Rewrite /websocket and /websocket/ urls to /sockjs/websocket while
            // preserving query string.
            var parsedUrl = url.parse(request.url);
            if (parsedUrl.pathname === pathPrefix + '/websocket' || parsedUrl.pathname === pathPrefix + '/websocket/') {
              parsedUrl.pathname = self.prefix + '/websocket';
              request.url = url.format(parsedUrl);
            }
            oldHttpServerListeners.forEach(function (oldListener) {
              oldListener.apply(httpServer, args);
            });
          };
          httpServer.addListener(event, newListener);
        });
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

},"livedata_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/livedata_server.js                                                                              //
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
    let isEmpty;
    module.link("lodash.isempty", {
      default(v) {
        isEmpty = v;
      }
    }, 0);
    let isObject;
    module.link("lodash.isobject", {
      default(v) {
        isObject = v;
      }
    }, 1);
    let isString;
    module.link("lodash.isstring", {
      default(v) {
        isString = v;
      }
    }, 2);
    let SessionCollectionView;
    module.link("./session_collection_view", {
      SessionCollectionView(v) {
        SessionCollectionView = v;
      }
    }, 3);
    let SessionDocumentView;
    module.link("./session_document_view", {
      SessionDocumentView(v) {
        SessionDocumentView = v;
      }
    }, 4);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    DDPServer = {};

    // Publication strategies define how we handle data from published cursors at the collection level
    // This allows someone to:
    // - Choose a trade-off between client-server bandwidth and server memory usage
    // - Implement special (non-mongo) collections like volatile message queues
    const publicationStrategies = {
      // SERVER_MERGE is the default strategy.
      // When using this strategy, the server maintains a copy of all data a connection is subscribed to.
      // This allows us to only send deltas over multiple publications.
      SERVER_MERGE: {
        useDummyDocumentView: false,
        useCollectionView: true,
        doAccountingForCollection: true
      },
      // The NO_MERGE_NO_HISTORY strategy results in the server sending all publication data
      // directly to the client. It does not remember what it has previously sent
      // to it will not trigger removed messages when a subscription is stopped.
      // This should only be chosen for special use cases like send-and-forget queues.
      NO_MERGE_NO_HISTORY: {
        useDummyDocumentView: false,
        useCollectionView: false,
        doAccountingForCollection: false
      },
      // NO_MERGE is similar to NO_MERGE_NO_HISTORY but the server will remember the IDs it has
      // sent to the client so it can remove them when a subscription is stopped.
      // This strategy can be used when a collection is only used in a single publication.
      NO_MERGE: {
        useDummyDocumentView: false,
        useCollectionView: false,
        doAccountingForCollection: true
      },
      // NO_MERGE_MULTI is similar to `NO_MERGE`, but it does track whether a document is
      // used by multiple publications. This has some memory overhead, but it still does not do
      // diffing so it's faster and slimmer than SERVER_MERGE.
      NO_MERGE_MULTI: {
        useDummyDocumentView: true,
        useCollectionView: true,
        doAccountingForCollection: true
      }
    };
    DDPServer.publicationStrategies = publicationStrategies;

    // This file contains classes:
    // * Session - The server's connection to a single DDP client
    // * Subscription - A single subscription for a single client
    // * Server - An entire server that may talk to > 1 client. A DDP endpoint.
    //
    // Session and Subscription are file scope. For now, until we freeze
    // the interface, Server is package scope (in the future it should be
    // exported).

    DDPServer._SessionDocumentView = SessionDocumentView;
    DDPServer._getCurrentFence = function () {
      let currentInvocation = this._CurrentWriteFence.get();
      if (currentInvocation) {
        return currentInvocation;
      }
      currentInvocation = DDP._CurrentMethodInvocation.get();
      return currentInvocation ? currentInvocation.fence : undefined;
    };
    DDPServer._SessionCollectionView = SessionCollectionView;

    /******************************************************************************/
    /* Session                                                                    */
    /******************************************************************************/

    var Session = function (server, version, socket, options) {
      var self = this;
      self.id = Random.id();
      self.server = server;
      self.version = version;
      self.initialized = false;
      self.socket = socket;

      // Set to null when the session is destroyed. Multiple places below
      // use this to determine if the session is alive or not.
      self.inQueue = new Meteor._DoubleEndedQueue();
      self.blocked = false;
      self.workerRunning = false;
      self.cachedUnblock = null;

      // Sub objects for active subscriptions
      self._namedSubs = new Map();
      self._universalSubs = [];
      self.userId = null;
      self.collectionViews = new Map();

      // Set this to false to not send messages when collectionViews are
      // modified. This is done when rerunning subs in _setUserId and those messages
      // are calculated via a diff instead.
      self._isSending = true;

      // If this is true, don't start a newly-created universal publisher on this
      // session. The session will take care of starting it when appropriate.
      self._dontStartNewUniversalSubs = false;

      // When we are rerunning subscriptions, any ready messages
      // we want to buffer up for when we are done rerunning subscriptions
      self._pendingReady = [];

      // List of callbacks to call when this connection is closed.
      self._closeCallbacks = [];

      // XXX HACK: If a sockjs connection, save off the URL. This is
      // temporary and will go away in the near future.
      self._socketUrl = socket.url;

      // Allow tests to disable responding to pings.
      self._respondToPings = options.respondToPings;

      // This object is the public interface to the session. In the public
      // API, it is called the `connection` object.  Internally we call it
      // a `connectionHandle` to avoid ambiguity.
      self.connectionHandle = {
        id: self.id,
        close: function () {
          self.close();
        },
        onClose: function (fn) {
          var cb = Meteor.bindEnvironment(fn, "connection onClose callback");
          if (self.inQueue) {
            self._closeCallbacks.push(cb);
          } else {
            // if we're already closed, call the callback.
            Meteor.defer(cb);
          }
        },
        clientAddress: self._clientAddress(),
        httpHeaders: self.socket.headers
      };
      self.send({
        msg: 'connected',
        session: self.id
      });

      // On initial connect, spin up all the universal publishers.
      self.startUniversalSubs();
      if (version !== 'pre1' && options.heartbeatInterval !== 0) {
        // We no longer need the low level timeout because we have heartbeats.
        socket.setWebsocketTimeout(0);
        self.heartbeat = new DDPCommon.Heartbeat({
          heartbeatInterval: options.heartbeatInterval,
          heartbeatTimeout: options.heartbeatTimeout,
          onTimeout: function () {
            self.close();
          },
          sendPing: function () {
            self.send({
              msg: 'ping'
            });
          }
        });
        self.heartbeat.start();
      }
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", 1);
    };
    Object.assign(Session.prototype, {
      sendReady: function (subscriptionIds) {
        var self = this;
        if (self._isSending) {
          self.send({
            msg: "ready",
            subs: subscriptionIds
          });
        } else {
          subscriptionIds.forEach(function (subscriptionId) {
            self._pendingReady.push(subscriptionId);
          });
        }
      },
      _canSend(collectionName) {
        return this._isSending || !this.server.getPublicationStrategy(collectionName).useCollectionView;
      },
      sendAdded(collectionName, id, fields) {
        if (this._canSend(collectionName)) {
          this.send({
            msg: 'added',
            collection: collectionName,
            id,
            fields
          });
        }
      },
      sendChanged(collectionName, id, fields) {
        if (isEmpty(fields)) return;
        if (this._canSend(collectionName)) {
          this.send({
            msg: "changed",
            collection: collectionName,
            id,
            fields
          });
        }
      },
      sendRemoved(collectionName, id) {
        if (this._canSend(collectionName)) {
          this.send({
            msg: "removed",
            collection: collectionName,
            id
          });
        }
      },
      getSendCallbacks: function () {
        var self = this;
        return {
          added: self.sendAdded.bind(self),
          changed: self.sendChanged.bind(self),
          removed: self.sendRemoved.bind(self)
        };
      },
      getCollectionView: function (collectionName) {
        var self = this;
        var ret = self.collectionViews.get(collectionName);
        if (!ret) {
          ret = new SessionCollectionView(collectionName, self.getSendCallbacks());
          self.collectionViews.set(collectionName, ret);
        }
        return ret;
      },
      added(subscriptionHandle, collectionName, id, fields) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.added(subscriptionHandle, id, fields);
        } else {
          this.sendAdded(collectionName, id, fields);
        }
      },
      removed(subscriptionHandle, collectionName, id) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.removed(subscriptionHandle, id);
          if (view.isEmpty()) {
            this.collectionViews.delete(collectionName);
          }
        } else {
          this.sendRemoved(collectionName, id);
        }
      },
      changed(subscriptionHandle, collectionName, id, fields) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.changed(subscriptionHandle, id, fields);
        } else {
          this.sendChanged(collectionName, id, fields);
        }
      },
      startUniversalSubs: function () {
        var self = this;
        // Make a shallow copy of the set of universal handlers and start them. If
        // additional universal publishers start while we're running them (due to
        // yielding), they will run separately as part of Server.publish.
        var handlers = [...self.server.universal_publish_handlers];
        handlers.forEach(function (handler) {
          self._startSubscription(handler);
        });
      },
      // Destroy this session and unregister it at the server.
      close: function () {
        var self = this;

        // Destroy this session, even if it's not registered at the
        // server. Stop all processing and tear everything down. If a socket
        // was attached, close it.

        // Already destroyed.
        if (!self.inQueue) return;

        // Drop the merge box data immediately.
        self.inQueue = null;
        self.collectionViews = new Map();
        if (self.heartbeat) {
          self.heartbeat.stop();
          self.heartbeat = null;
        }
        if (self.socket) {
          self.socket.close();
          self.socket._meteorSession = null;
        }
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", -1);
        Meteor.defer(function () {
          // Stop callbacks can yield, so we defer this on close.
          // sub._isDeactivated() detects that we set inQueue to null and
          // treats it as semi-deactivated (it will ignore incoming callbacks, etc).
          self._deactivateAllSubscriptions();

          // Defer calling the close callbacks, so that the caller closing
          // the session isn't waiting for all the callbacks to complete.
          self._closeCallbacks.forEach(function (callback) {
            callback();
          });
        });

        // Unregister the session.
        self.server._removeSession(self);
      },
      // Send a message (doing nothing if no socket is connected right now).
      // It should be a JSON object (it will be stringified).
      send: function (msg) {
        const self = this;
        if (self.socket) {
          if (Meteor._printSentDDP) Meteor._debug("Sent DDP", DDPCommon.stringifyDDP(msg));
          self.socket.send(DDPCommon.stringifyDDP(msg));
        }
      },
      // Send a connection error.
      sendError: function (reason, offendingMessage) {
        var self = this;
        var msg = {
          msg: 'error',
          reason: reason
        };
        if (offendingMessage) msg.offendingMessage = offendingMessage;
        self.send(msg);
      },
      // Process 'msg' as an incoming message. As a guard against
      // race conditions during reconnection, ignore the message if
      // 'socket' is not the currently connected socket.
      //
      // We run the messages from the client one at a time, in the order
      // given by the client. The message handler is passed an idempotent
      // function 'unblock' which it may call to allow other messages to
      // begin running in parallel in another fiber (for example, a method
      // that wants to yield). Otherwise, it is automatically unblocked
      // when it returns.
      //
      // Actually, we don't have to 'totally order' the messages in this
      // way, but it's the easiest thing that's correct. (unsub needs to
      // be ordered against sub, methods need to be ordered against each
      // other).
      processMessage: function (msg_in) {
        var self = this;
        if (!self.inQueue)
          // we have been destroyed.
          return;

        // Respond to ping and pong messages immediately without queuing.
        // If the negotiated DDP version is "pre1" which didn't support
        // pings, preserve the "pre1" behavior of responding with a "bad
        // request" for the unknown messages.
        //
        // Fibers are needed because heartbeats use Meteor.setTimeout, which
        // needs a Fiber. We could actually use regular setTimeout and avoid
        // these new fibers, but it is easier to just make everything use
        // Meteor.setTimeout and not think too hard.
        //
        // Any message counts as receiving a pong, as it demonstrates that
        // the client is still alive.
        if (self.heartbeat) {
          self.heartbeat.messageReceived();
        }
        ;
        if (self.version !== 'pre1' && msg_in.msg === 'ping') {
          if (self._respondToPings) self.send({
            msg: "pong",
            id: msg_in.id
          });
          return;
        }
        if (self.version !== 'pre1' && msg_in.msg === 'pong') {
          // Since everything is a pong, there is nothing to do
          return;
        }
        self.inQueue.push(msg_in);
        if (self.workerRunning) return;
        self.workerRunning = true;
        var processNext = function () {
          var msg = self.inQueue && self.inQueue.shift();
          if (!msg) {
            self.workerRunning = false;
            return;
          }
          function runHandlers() {
            var blocked = true;
            var unblock = function () {
              if (!blocked) return; // idempotent
              blocked = false;
              setImmediate(processNext);
            };
            self.server.onMessageHook.each(function (callback) {
              callback(msg, self);
              return true;
            });
            if (msg.msg in self.protocol_handlers) {
              const result = self.protocol_handlers[msg.msg].call(self, msg, unblock);
              if (Meteor._isPromise(result)) {
                result.finally(() => unblock());
              } else {
                unblock();
              }
            } else {
              self.sendError('Bad request', msg);
              unblock(); // in case the handler didn't already do it
            }
          }
          runHandlers();
        };
        processNext();
      },
      protocol_handlers: {
        sub: async function (msg, unblock) {
          var self = this;

          // cacheUnblock temporarly, so we can capture it later
          // we will use unblock in current eventLoop, so this is safe
          self.cachedUnblock = unblock;

          // reject malformed messages
          if (typeof msg.id !== "string" || typeof msg.name !== "string" || 'params' in msg && !(msg.params instanceof Array)) {
            self.sendError("Malformed subscription", msg);
            return;
          }
          if (!self.server.publish_handlers[msg.name]) {
            self.send({
              msg: 'nosub',
              id: msg.id,
              error: new Meteor.Error(404, "Subscription '".concat(msg.name, "' not found"))
            });
            return;
          }
          if (self._namedSubs.has(msg.id))
            // subs are idempotent, or rather, they are ignored if a sub
            // with that id already exists. this is important during
            // reconnect.
            return;

          // XXX It'd be much better if we had generic hooks where any package can
          // hook into subscription handling, but in the mean while we special case
          // ddp-rate-limiter package. This is also done for weak requirements to
          // add the ddp-rate-limiter package in case we don't have Accounts. A
          // user trying to use the ddp-rate-limiter must explicitly require it.
          if (Package['ddp-rate-limiter']) {
            var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
            var rateLimiterInput = {
              userId: self.userId,
              clientAddress: self.connectionHandle.clientAddress,
              type: "subscription",
              name: msg.name,
              connectionId: self.id
            };
            DDPRateLimiter._increment(rateLimiterInput);
            var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
            if (!rateLimitResult.allowed) {
              self.send({
                msg: 'nosub',
                id: msg.id,
                error: new Meteor.Error('too-many-requests', DDPRateLimiter.getErrorMessage(rateLimitResult), {
                  timeToReset: rateLimitResult.timeToReset
                })
              });
              return;
            }
          }
          var handler = self.server.publish_handlers[msg.name];
          await self._startSubscription(handler, msg.id, msg.params, msg.name);

          // cleaning cached unblock
          self.cachedUnblock = null;
        },
        unsub: function (msg) {
          var self = this;
          self._stopSubscription(msg.id);
        },
        method: async function (msg, unblock) {
          var self = this;

          // Reject malformed messages.
          // For now, we silently ignore unknown attributes,
          // for forwards compatibility.
          if (typeof msg.id !== "string" || typeof msg.method !== "string" || 'params' in msg && !(msg.params instanceof Array) || 'randomSeed' in msg && typeof msg.randomSeed !== "string") {
            self.sendError("Malformed method invocation", msg);
            return;
          }
          var randomSeed = msg.randomSeed || null;

          // Set up to mark the method as satisfied once all observers
          // (and subscriptions) have reacted to any writes that were
          // done.
          var fence = new DDPServer._WriteFence();
          fence.onAllCommitted(function () {
            // Retire the fence so that future writes are allowed.
            // This means that callbacks like timers are free to use
            // the fence, and if they fire before it's armed (for
            // example, because the method waits for them) their
            // writes will be included in the fence.
            fence.retire();
            self.send({
              msg: 'updated',
              methods: [msg.id]
            });
          });

          // Find the handler
          var handler = self.server.method_handlers[msg.method];
          if (!handler) {
            self.send({
              msg: 'result',
              id: msg.id,
              error: new Meteor.Error(404, "Method '".concat(msg.method, "' not found"))
            });
            await fence.arm();
            return;
          }
          var invocation = new DDPCommon.MethodInvocation({
            name: msg.method,
            isSimulation: false,
            userId: self.userId,
            setUserId(userId) {
              return self._setUserId(userId);
            },
            unblock: unblock,
            connection: self.connectionHandle,
            randomSeed: randomSeed,
            fence
          });
          const promise = new Promise((resolve, reject) => {
            // XXX It'd be better if we could hook into method handlers better but
            // for now, we need to check if the ddp-rate-limiter exists since we
            // have a weak requirement for the ddp-rate-limiter package to be added
            // to our application.
            if (Package['ddp-rate-limiter']) {
              var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
              var rateLimiterInput = {
                userId: self.userId,
                clientAddress: self.connectionHandle.clientAddress,
                type: "method",
                name: msg.method,
                connectionId: self.id
              };
              DDPRateLimiter._increment(rateLimiterInput);
              var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
              if (!rateLimitResult.allowed) {
                reject(new Meteor.Error("too-many-requests", DDPRateLimiter.getErrorMessage(rateLimitResult), {
                  timeToReset: rateLimitResult.timeToReset
                }));
                return;
              }
            }
            resolve(DDPServer._CurrentWriteFence.withValue(fence, () => DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, msg.params, "call to '" + msg.method + "'"))));
          });
          async function finish() {
            await fence.arm();
            unblock();
          }
          const payload = {
            msg: "result",
            id: msg.id
          };
          return promise.then(async result => {
            await finish();
            if (result !== undefined) {
              payload.result = result;
            }
            self.send(payload);
          }, async exception => {
            await finish();
            payload.error = wrapInternalException(exception, "while invoking method '".concat(msg.method, "'"));
            self.send(payload);
          });
        }
      },
      _eachSub: function (f) {
        var self = this;
        self._namedSubs.forEach(f);
        self._universalSubs.forEach(f);
      },
      _diffCollectionViews: function (beforeCVs) {
        var self = this;
        DiffSequence.diffMaps(beforeCVs, self.collectionViews, {
          both: function (collectionName, leftValue, rightValue) {
            rightValue.diff(leftValue);
          },
          rightOnly: function (collectionName, rightValue) {
            rightValue.documents.forEach(function (docView, id) {
              self.sendAdded(collectionName, id, docView.getFields());
            });
          },
          leftOnly: function (collectionName, leftValue) {
            leftValue.documents.forEach(function (doc, id) {
              self.sendRemoved(collectionName, id);
            });
          }
        });
      },
      // Sets the current user id in all appropriate contexts and reruns
      // all subscriptions
      async _setUserId(userId) {
        var self = this;
        if (userId !== null && typeof userId !== "string") throw new Error("setUserId must be called on string or null, not " + typeof userId);

        // Prevent newly-created universal subscriptions from being added to our
        // session. They will be found below when we call startUniversalSubs.
        //
        // (We don't have to worry about named subscriptions, because we only add
        // them when we process a 'sub' message. We are currently processing a
        // 'method' message, and the method did not unblock, because it is illegal
        // to call setUserId after unblock. Thus we cannot be concurrently adding a
        // new named subscription).
        self._dontStartNewUniversalSubs = true;

        // Prevent current subs from updating our collectionViews and call their
        // stop callbacks. This may yield.
        self._eachSub(function (sub) {
          sub._deactivate();
        });

        // All subs should now be deactivated. Stop sending messages to the client,
        // save the state of the published collections, reset to an empty view, and
        // update the userId.
        self._isSending = false;
        var beforeCVs = self.collectionViews;
        self.collectionViews = new Map();
        self.userId = userId;

        // _setUserId is normally called from a Meteor method with
        // DDP._CurrentMethodInvocation set. But DDP._CurrentMethodInvocation is not
        // expected to be set inside a publish function, so we temporary unset it.
        // Inside a publish function DDP._CurrentPublicationInvocation is set.
        await DDP._CurrentMethodInvocation.withValue(undefined, async function () {
          // Save the old named subs, and reset to having no subscriptions.
          var oldNamedSubs = self._namedSubs;
          self._namedSubs = new Map();
          self._universalSubs = [];
          await Promise.all([...oldNamedSubs].map(async _ref => {
            let [subscriptionId, sub] = _ref;
            const newSub = sub._recreate();
            self._namedSubs.set(subscriptionId, newSub);
            // nb: if the handler throws or calls this.error(), it will in fact
            // immediately send its 'nosub'. This is OK, though.
            await newSub._runHandler();
          }));

          // Allow newly-created universal subs to be started on our connection in
          // parallel with the ones we're spinning up here, and spin up universal
          // subs.
          self._dontStartNewUniversalSubs = false;
          self.startUniversalSubs();
        }, {
          name: '_setUserId'
        });

        // Start sending messages again, beginning with the diff from the previous
        // state of the world to the current state. No yields are allowed during
        // this diff, so that other changes cannot interleave.
        Meteor._noYieldsAllowed(function () {
          self._isSending = true;
          self._diffCollectionViews(beforeCVs);
          if (!isEmpty(self._pendingReady)) {
            self.sendReady(self._pendingReady);
            self._pendingReady = [];
          }
        });
      },
      _startSubscription: function (handler, subId, params, name) {
        var self = this;
        var sub = new Subscription(self, handler, subId, params, name);
        let unblockHander = self.cachedUnblock;
        // _startSubscription may call from a lot places
        // so cachedUnblock might be null in somecases
        // assign the cachedUnblock
        sub.unblock = unblockHander || (() => {});
        if (subId) self._namedSubs.set(subId, sub);else self._universalSubs.push(sub);
        return sub._runHandler();
      },
      // Tear down specified subscription
      _stopSubscription: function (subId, error) {
        var self = this;
        var subName = null;
        if (subId) {
          var maybeSub = self._namedSubs.get(subId);
          if (maybeSub) {
            subName = maybeSub._name;
            maybeSub._removeAllDocuments();
            maybeSub._deactivate();
            self._namedSubs.delete(subId);
          }
        }
        var response = {
          msg: 'nosub',
          id: subId
        };
        if (error) {
          response.error = wrapInternalException(error, subName ? "from sub " + subName + " id " + subId : "from sub id " + subId);
        }
        self.send(response);
      },
      // Tear down all subscriptions. Note that this does NOT send removed or nosub
      // messages, since we assume the client is gone.
      _deactivateAllSubscriptions: function () {
        var self = this;
        self._namedSubs.forEach(function (sub, id) {
          sub._deactivate();
        });
        self._namedSubs = new Map();
        self._universalSubs.forEach(function (sub) {
          sub._deactivate();
        });
        self._universalSubs = [];
      },
      // Determine the remote client's IP address, based on the
      // HTTP_FORWARDED_COUNT environment variable representing how many
      // proxies the server is behind.
      _clientAddress: function () {
        var self = this;

        // For the reported client address for a connection to be correct,
        // the developer must set the HTTP_FORWARDED_COUNT environment
        // variable to an integer representing the number of hops they
        // expect in the `x-forwarded-for` header. E.g., set to "1" if the
        // server is behind one proxy.
        //
        // This could be computed once at startup instead of every time.
        var httpForwardedCount = parseInt(process.env['HTTP_FORWARDED_COUNT']) || 0;
        if (httpForwardedCount === 0) return self.socket.remoteAddress;
        var forwardedFor = self.socket.headers["x-forwarded-for"];
        if (!isString(forwardedFor)) return null;
        forwardedFor = forwardedFor.split(',');

        // Typically the first value in the `x-forwarded-for` header is
        // the original IP address of the client connecting to the first
        // proxy.  However, the end user can easily spoof the header, in
        // which case the first value(s) will be the fake IP address from
        // the user pretending to be a proxy reporting the original IP
        // address value.  By counting HTTP_FORWARDED_COUNT back from the
        // end of the list, we ensure that we get the IP address being
        // reported by *our* first proxy.

        if (httpForwardedCount < 0 || httpForwardedCount !== forwardedFor.length) return null;
        forwardedFor = forwardedFor.map(ip => ip.trim());
        return forwardedFor[forwardedFor.length - httpForwardedCount];
      }
    });

    /******************************************************************************/
    /* Subscription                                                               */
    /******************************************************************************/

    // Ctor for a sub handle: the input to each publish function

    // Instance name is this because it's usually referred to as this inside a
    // publish
    /**
     * @summary The server's side of a subscription
     * @class Subscription
     * @instanceName this
     * @showInstanceName true
     */
    var Subscription = function (session, handler, subscriptionId, params, name) {
      var self = this;
      self._session = session; // type is Session

      /**
       * @summary Access inside the publish function. The incoming [connection](#meteor_onconnection) for this subscription.
       * @locus Server
       * @name  connection
       * @memberOf Subscription
       * @instance
       */
      self.connection = session.connectionHandle; // public API object

      self._handler = handler;

      // My subscription ID (generated by client, undefined for universal subs).
      self._subscriptionId = subscriptionId;
      // Undefined for universal subs
      self._name = name;
      self._params = params || [];

      // Only named subscriptions have IDs, but we need some sort of string
      // internally to keep track of all subscriptions inside
      // SessionDocumentViews. We use this subscriptionHandle for that.
      if (self._subscriptionId) {
        self._subscriptionHandle = 'N' + self._subscriptionId;
      } else {
        self._subscriptionHandle = 'U' + Random.id();
      }

      // Has _deactivate been called?
      self._deactivated = false;

      // Stop callbacks to g/c this sub.  called w/ zero arguments.
      self._stopCallbacks = [];

      // The set of (collection, documentid) that this subscription has
      // an opinion about.
      self._documents = new Map();

      // Remember if we are ready.
      self._ready = false;

      // Part of the public API: the user of this sub.

      /**
       * @summary Access inside the publish function. The id of the logged-in user, or `null` if no user is logged in.
       * @locus Server
       * @memberOf Subscription
       * @name  userId
       * @instance
       */
      self.userId = session.userId;

      // For now, the id filter is going to default to
      // the to/from DDP methods on MongoID, to
      // specifically deal with mongo/minimongo ObjectIds.

      // Later, you will be able to make this be "raw"
      // if you want to publish a collection that you know
      // just has strings for keys and no funny business, to
      // a DDP consumer that isn't minimongo.

      self._idFilter = {
        idStringify: MongoID.idStringify,
        idParse: MongoID.idParse
      };
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", 1);
    };
    Object.assign(Subscription.prototype, {
      _runHandler: async function () {
        // XXX should we unblock() here? Either before running the publish
        // function, or before running _publishCursor.
        //
        // Right now, each publish function blocks all future publishes and
        // methods waiting on data from Mongo (or whatever else the function
        // blocks on). This probably slows page load in common cases.

        if (!this.unblock) {
          this.unblock = () => {};
        }
        const self = this;
        let resultOrThenable = null;
        try {
          resultOrThenable = DDP._CurrentPublicationInvocation.withValue(self, () => maybeAuditArgumentChecks(self._handler, self, EJSON.clone(self._params),
          // It's OK that this would look weird for universal subscriptions,
          // because they have no arguments so there can never be an
          // audit-argument-checks failure.
          "publisher '" + self._name + "'"), {
            name: self._name
          });
        } catch (e) {
          self.error(e);
          return;
        }

        // Did the handler call this.error or this.stop?
        if (self._isDeactivated()) return;

        // Both conventional and async publish handler functions are supported.
        // If an object is returned with a then() function, it is either a promise
        // or thenable and will be resolved asynchronously.
        const isThenable = resultOrThenable && typeof resultOrThenable.then === 'function';
        if (isThenable) {
          try {
            await self._publishHandlerResult(await resultOrThenable);
          } catch (e) {
            self.error(e);
          }
        } else {
          await self._publishHandlerResult(resultOrThenable);
        }
      },
      async _publishHandlerResult(res) {
        // SPECIAL CASE: Instead of writing their own callbacks that invoke
        // this.added/changed/ready/etc, the user can just return a collection
        // cursor or array of cursors from the publish function; we call their
        // _publishCursor method which starts observing the cursor and publishes the
        // results. Note that _publishCursor does NOT call ready().
        //
        // XXX This uses an undocumented interface which only the Mongo cursor
        // interface publishes. Should we make this interface public and encourage
        // users to implement it themselves? Arguably, it's unnecessary; users can
        // already write their own functions like
        //   var publishMyReactiveThingy = function (name, handler) {
        //     Meteor.publish(name, function () {
        //       var reactiveThingy = handler();
        //       reactiveThingy.publishMe();
        //     });
        //   };

        var self = this;
        var isCursor = function (c) {
          return c && c._publishCursor;
        };
        if (isCursor(res)) {
          try {
            await res._publishCursor(self);
          } catch (e) {
            self.error(e);
            return;
          }
          // _publishCursor only returns after the initial added callbacks have run.
          // mark subscription as ready.
          self.ready();
        } else if (Array.isArray(res)) {
          // Check all the elements are cursors
          if (!res.every(isCursor)) {
            self.error(new Error("Publish function returned an array of non-Cursors"));
            return;
          }
          // Find duplicate collection names
          // XXX we should support overlapping cursors, but that would require the
          // merge box to allow overlap within a subscription
          var collectionNames = {};
          for (var i = 0; i < res.length; ++i) {
            var collectionName = res[i]._getCollectionName();
            if (collectionNames[collectionName]) {
              self.error(new Error("Publish function returned multiple cursors for collection " + collectionName));
              return;
            }
            collectionNames[collectionName] = true;
          }
          try {
            await Promise.all(res.map(cur => cur._publishCursor(self)));
          } catch (e) {
            self.error(e);
            return;
          }
          self.ready();
        } else if (res) {
          // Truthy values other than cursors or arrays are probably a
          // user mistake (possible returning a Mongo document via, say,
          // `coll.findOne()`).
          self.error(new Error("Publish function can only return a Cursor or " + "an array of Cursors"));
        }
      },
      // This calls all stop callbacks and prevents the handler from updating any
      // SessionCollectionViews further. It's used when the user unsubscribes or
      // disconnects, as well as during setUserId re-runs. It does *NOT* send
      // removed messages for the published objects; if that is necessary, call
      // _removeAllDocuments first.
      _deactivate: function () {
        if (this._deactivated) return;
        this._deactivated = true;
        this._callStopCallbacks().then(() => {
          // Break reference chains to allow GC of the Session and its data.
          // Without this, deactivated subscriptions retain live references
          // to the (now-closed) session indefinitely.
          this._session = null;
          this._documents = new Map();
        });
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", -1);
      },
      _callStopCallbacks: async function () {
        // In Meteor 3, onStop callbacks can be async (e.g. observeHandle.stop()
        // returns a Promise). We must await each one so that observer teardown
        // completes before the subscription is considered fully deactivated.
        const callbacks = this._stopCallbacks;
        this._stopCallbacks = [];
        for (const callback of callbacks) {
          try {
            await callback();
          } catch (e) {
            Meteor._debug("Exception in onStop callback:", e);
          }
        }
      },
      // Send remove messages for every document.
      _removeAllDocuments: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._documents.forEach(function (collectionDocs, collectionName) {
            collectionDocs.forEach(function (strId) {
              self.removed(collectionName, self._idFilter.idParse(strId));
            });
          });
        });
      },
      // Returns a new Subscription for the same session with the same
      // initial creation parameters. This isn't a clone: it doesn't have
      // the same _documents cache, stopped state or callbacks; may have a
      // different _subscriptionHandle, and gets its userId from the
      // session, not from this object.
      _recreate: function () {
        var self = this;
        return new Subscription(self._session, self._handler, self._subscriptionId, self._params, self._name);
      },
      /**
       * @summary Call inside the publish function.  Stops this client's subscription, triggering a call on the client to the `onStop` callback passed to [`Meteor.subscribe`](#meteor_subscribe), if any. If `error` is not a [`Meteor.Error`](#meteor_error), it will be [sanitized](#meteor_error).
       * @locus Server
       * @param {Error} error The error to pass to the client.
       * @instance
       * @memberOf Subscription
       */
      error: function (error) {
        var self = this;
        if (self._isDeactivated()) return;
        self._session._stopSubscription(self._subscriptionId, error);
      },
      // Note that while our DDP client will notice that you've called stop() on the
      // server (and clean up its _subscriptions table) we don't actually provide a
      // mechanism for an app to notice this (the subscribe onError callback only
      // triggers if there is an error).

      /**
       * @summary Call inside the publish function.  Stops this client's subscription and invokes the client's `onStop` callback with no error.
       * @locus Server
       * @instance
       * @memberOf Subscription
       */
      stop: function () {
        var self = this;
        if (self._isDeactivated()) return;
        self._session._stopSubscription(self._subscriptionId);
      },
      /**
       * @summary Call inside the publish function.  Registers a callback function to run when the subscription is stopped.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {Function} func The callback function
       */
      onStop: function (callback) {
        var self = this;
        callback = Meteor.bindEnvironment(callback, 'onStop callback', self);
        if (self._isDeactivated()) callback();else self._stopCallbacks.push(callback);
      },
      // This returns true if the sub has been deactivated, *OR* if the session was
      // destroyed but the deferred call to _deactivateAllSubscriptions hasn't
      // happened yet.
      _isDeactivated: function () {
        return this._deactivated || !this._session || this._session.inQueue === null;
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document has been added to the record set.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that contains the new document.
       * @param {String} id The new document's ID.
       * @param {Object} fields The fields in the new document.  If `_id` is present it is ignored.
       */
      added(collectionName, id, fields) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
          let ids = this._documents.get(collectionName);
          if (ids == null) {
            ids = new Set();
            this._documents.set(collectionName, ids);
          }
          ids.add(id);
        }
        this._session.added(this._subscriptionHandle, collectionName, id, fields);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document in the record set has been modified.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that contains the changed document.
       * @param {String} id The changed document's ID.
       * @param {Object} fields The fields in the document that have changed, together with their new values.  If a field is not present in `fields` it was left unchanged; if it is present in `fields` and has a value of `undefined` it was removed from the document.  If `_id` is present it is ignored.
       */
      changed(collectionName, id, fields) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        this._session.changed(this._subscriptionHandle, collectionName, id, fields);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document has been removed from the record set.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that the document has been removed from.
       * @param {String} id The ID of the document that has been removed.
       */
      removed(collectionName, id) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
          // We don't bother to delete sets of things in a collection if the
          // collection is empty.  It could break _removeAllDocuments.
          this._documents.get(collectionName).delete(id);
        }
        this._session.removed(this._subscriptionHandle, collectionName, id);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that an initial, complete snapshot of the record set has been sent.  This will trigger a call on the client to the `onReady` callback passed to  [`Meteor.subscribe`](#meteor_subscribe), if any.
       * @locus Server
       * @memberOf Subscription
       * @instance
       */
      ready: function () {
        var self = this;
        if (self._isDeactivated()) return;
        if (!self._subscriptionId) return; // Unnecessary but ignored for universal sub
        if (!self._ready) {
          self._session.sendReady([self._subscriptionId]);
          self._ready = true;
        }
      }
    });

    /******************************************************************************/
    /* Server                                                                     */
    /******************************************************************************/

    Server = function () {
      let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var self = this;

      // The default heartbeat interval is 30 seconds on the server and 35
      // seconds on the client.  Since the client doesn't need to send a
      // ping as long as it is receiving pings, this means that pings
      // normally go from the server to the client.
      //
      // Note: Troposphere depends on the ability to mutate
      // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
      self.options = _objectSpread({
        heartbeatInterval: 15000,
        heartbeatTimeout: 15000,
        // For testing, allow responding to pings to be disabled.
        respondToPings: true,
        defaultPublicationStrategy: publicationStrategies.SERVER_MERGE
      }, options);

      // Map of callbacks to call when a new connection comes in to the
      // server and completes DDP version negotiation. Use an object instead
      // of an array so we can safely remove one from the list while
      // iterating over it.
      self.onConnectionHook = new Hook({
        debugPrintExceptions: "onConnection callback"
      });

      // Map of callbacks to call when a new message comes in.
      self.onMessageHook = new Hook({
        debugPrintExceptions: "onMessage callback"
      });
      self.publish_handlers = {};
      self.universal_publish_handlers = [];
      self.method_handlers = {};
      self._publicationStrategies = {};
      self.sessions = new Map(); // map from id to session

      self.stream_server = new StreamServer();
      self.stream_server.register(function (socket) {
        // socket implements the SockJSConnection interface
        socket._meteorSession = null;
        var sendError = function (reason, offendingMessage) {
          var msg = {
            msg: 'error',
            reason: reason
          };
          if (offendingMessage) msg.offendingMessage = offendingMessage;
          socket.send(DDPCommon.stringifyDDP(msg));
        };
        socket.on('data', function (raw_msg) {
          if (Meteor._printReceivedDDP) {
            Meteor._debug("Received DDP", raw_msg);
          }
          try {
            try {
              var msg = DDPCommon.parseDDP(raw_msg);
            } catch (err) {
              sendError('Parse error');
              return;
            }
            if (msg === null || !msg.msg) {
              sendError('Bad request', msg);
              return;
            }
            if (msg.msg === 'connect') {
              if (socket._meteorSession) {
                sendError("Already connected", msg);
                return;
              }
              self._handleConnect(socket, msg);
              return;
            }
            if (!socket._meteorSession) {
              sendError('Must connect first', msg);
              return;
            }
            socket._meteorSession.processMessage(msg);
          } catch (e) {
            // XXX print stack nicely
            Meteor._debug("Internal exception while processing message", msg, e);
          }
        });
        socket.on('close', function () {
          if (socket._meteorSession) {
            socket._meteorSession.close();
          }
        });
      });
    };
    Object.assign(Server.prototype, {
      /**
       * @summary Register a callback to be called when a new DDP connection is made to the server.
       * @locus Server
       * @param {function} callback The function to call when a new DDP connection is established.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      onConnection: function (fn) {
        var self = this;
        return self.onConnectionHook.register(fn);
      },
      /**
       * @summary Set publication strategy for the given collection. Publications strategies are available from `DDPServer.publicationStrategies`. You call this method from `Meteor.server`, like `Meteor.server.setPublicationStrategy()`
       * @locus Server
       * @alias setPublicationStrategy
       * @param collectionName {String}
       * @param strategy {{useCollectionView: boolean, doAccountingForCollection: boolean}}
       * @memberOf Meteor.server
       * @importFromPackage meteor
       */
      setPublicationStrategy(collectionName, strategy) {
        if (!Object.values(publicationStrategies).includes(strategy)) {
          throw new Error("Invalid merge strategy: ".concat(strategy, " \n        for collection ").concat(collectionName));
        }
        this._publicationStrategies[collectionName] = strategy;
      },
      /**
       * @summary Gets the publication strategy for the requested collection. You call this method from `Meteor.server`, like `Meteor.server.getPublicationStrategy()`
       * @locus Server
       * @alias getPublicationStrategy
       * @param collectionName {String}
       * @memberOf Meteor.server
       * @importFromPackage meteor
       * @return {{useCollectionView: boolean, doAccountingForCollection: boolean}}
       */
      getPublicationStrategy(collectionName) {
        return this._publicationStrategies[collectionName] || this.options.defaultPublicationStrategy;
      },
      /**
       * @summary Register a callback to be called when a new DDP message is received.
       * @locus Server
       * @param {function} callback The function to call when a new DDP message is received.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      onMessage: function (fn) {
        var self = this;
        return self.onMessageHook.register(fn);
      },
      _handleConnect: function (socket, msg) {
        var self = this;

        // The connect message must specify a version and an array of supported
        // versions, and it must claim to support what it is proposing.
        if (!(typeof msg.version === 'string' && Array.isArray(msg.support) && msg.support.every(isString) && msg.support.includes(msg.version))) {
          socket.send(DDPCommon.stringifyDDP({
            msg: 'failed',
            version: DDPCommon.SUPPORTED_DDP_VERSIONS[0]
          }));
          socket.close();
          return;
        }

        // In the future, handle session resumption: something like:
        //  socket._meteorSession = self.sessions[msg.session]
        var version = calculateVersion(msg.support, DDPCommon.SUPPORTED_DDP_VERSIONS);
        if (msg.version !== version) {
          // The best version to use (according to the client's stated preferences)
          // is not the one the client is trying to use. Inform them about the best
          // version to use.
          socket.send(DDPCommon.stringifyDDP({
            msg: 'failed',
            version: version
          }));
          socket.close();
          return;
        }

        // Yay, version matches! Create a new session.
        // Note: Troposphere depends on the ability to mutate
        // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
        socket._meteorSession = new Session(self, version, socket, self.options);
        self.sessions.set(socket._meteorSession.id, socket._meteorSession);
        self.onConnectionHook.each(function (callback) {
          if (socket._meteorSession) callback(socket._meteorSession.connectionHandle);
          return true;
        });
      },
      /**
       * Register a publish handler function.
       *
       * @param name {String} identifier for query
       * @param handler {Function} publish handler
       * @param options {Object}
       *
       * Server will call handler function on each new subscription,
       * either when receiving DDP sub message for a named subscription, or on
       * DDP connect for a universal subscription.
       *
       * If name is null, this will be a subscription that is
       * automatically established and permanently on for all connected
       * client, instead of a subscription that can be turned on and off
       * with subscribe().
       *
       * options to contain:
       *  - (mostly internal) is_auto: true if generated automatically
       *    from an autopublish hook. this is for cosmetic purposes only
       *    (it lets us determine whether to print a warning suggesting
       *    that you turn off autopublish).
       */

      /**
       * @summary Publish a record set.
       * @memberOf Meteor
       * @importFromPackage meteor
       * @locus Server
       * @param {String|Object} name If String, name of the record set.  If Object, publications Dictionary of publish functions by name.  If `null`, the set has no name, and the record set is automatically sent to all connected clients.
       * @param {Function} func Function called on the server each time a client subscribes.  Inside the function, `this` is the publish handler object, described below.  If the client passed arguments to `subscribe`, the function is called with the same arguments.
       */
      publish: function (name, handler, options) {
        var self = this;
        if (!isObject(name)) {
          options = options || {};
          if (name && name in self.publish_handlers) {
            Meteor._debug("Ignoring duplicate publish named '" + name + "'");
            return;
          }
          if (Package.autopublish && !options.is_auto) {
            // They have autopublish on, yet they're trying to manually
            // pick stuff to publish. They probably should turn off
            // autopublish. (This check isn't perfect -- if you create a
            // publish before you turn on autopublish, it won't catch
            // it, but this will definitely handle the simple case where
            // you've added the autopublish package to your app, and are
            // calling publish from your app code).
            if (!self.warned_about_autopublish) {
              self.warned_about_autopublish = true;
              Meteor._debug("** You've set up some data subscriptions with Meteor.publish(), but\n" + "** you still have autopublish turned on. Because autopublish is still\n" + "** on, your Meteor.publish() calls won't have much effect. All data\n" + "** will still be sent to all clients.\n" + "**\n" + "** Turn off autopublish by removing the autopublish package:\n" + "**\n" + "**   $ meteor remove autopublish\n" + "**\n" + "** .. and make sure you have Meteor.publish() and Meteor.subscribe() calls\n" + "** for each collection that you want clients to see.\n");
            }
          }
          if (name) self.publish_handlers[name] = handler;else {
            self.universal_publish_handlers.push(handler);
            // Spin up the new publisher on any existing session too. Run each
            // session's subscription in a new Fiber, so that there's no change for
            // self.sessions to change while we're running this loop.
            self.sessions.forEach(function (session) {
              if (!session._dontStartNewUniversalSubs) {
                session._startSubscription(handler);
              }
            });
          }
        } else {
          Object.entries(name).forEach(function (_ref2) {
            let [key, value] = _ref2;
            self.publish(key, value, {});
          });
        }
      },
      _removeSession: function (session) {
        var self = this;
        self.sessions.delete(session.id);
      },
      /**
       * @summary Tells if the method call came from a call or a callAsync.
       * @locus Anywhere
       * @memberOf Meteor
       * @importFromPackage meteor
       * @returns boolean
       */
      isAsyncCall: function () {
        return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      },
      /**
       * @summary Defines functions that can be invoked over the network by clients.
       * @locus Anywhere
       * @param {Object} methods Dictionary whose keys are method names and values are functions.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      methods: function (methods) {
        var self = this;
        Object.entries(methods).forEach(function (_ref3) {
          let [name, func] = _ref3;
          if (typeof func !== 'function') throw new Error("Method '" + name + "' must be a function");
          if (self.method_handlers[name]) throw new Error("A method named '" + name + "' is already defined");
          self.method_handlers[name] = func;
        });
      },
      call: function (name) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        if (args.length && typeof args[args.length - 1] === "function") {
          // If it's a function, the last argument is the result callback, not
          // a parameter to the remote method.
          var callback = args.pop();
        }
        return this.apply(name, args, callback);
      },
      // A version of the call method that always returns a Promise.
      callAsync: function (name) {
        var _args$;
        for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
          args[_key2 - 1] = arguments[_key2];
        }
        const options = (_args$ = args[0]) !== null && _args$ !== void 0 && _args$.hasOwnProperty('returnStubValue') ? args.shift() : {};
        DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(true);
        const promise = new Promise((resolve, reject) => {
          DDP._CurrentCallAsyncInvocation._set({
            name,
            hasCallAsyncParent: true
          });
          this.applyAsync(name, args, _objectSpread({
            isFromCallAsync: true
          }, options)).then(resolve).catch(reject).finally(() => {
            DDP._CurrentCallAsyncInvocation._set();
          });
        });
        return promise.finally(() => DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(false));
      },
      apply: function (name, args, options, callback) {
        // We were passed 3 arguments. They may be either (name, args, options)
        // or (name, args, callback)
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        } else {
          options = options || {};
        }
        const promise = this.applyAsync(name, args, options);

        // Return the result in whichever way the caller asked for it. Note that we
        // do NOT block on the write fence in an analogous way to how the client
        // blocks on the relevant data being visible, so you are NOT guaranteed that
        // cursor observe callbacks have fired when your callback is invoked. (We
        // can change this if there's a real use case).
        if (callback) {
          promise.then(result => callback(undefined, result), exception => callback(exception));
        } else {
          return promise;
        }
      },
      // @param options {Optional Object}
      applyAsync: function (name, args, options) {
        // Run the handler
        var handler = this.method_handlers[name];
        if (!handler) {
          return Promise.reject(new Meteor.Error(404, "Method '".concat(name, "' not found")));
        }
        // If this is a method call from within another method or publish function,
        // get the user state from the outer method or publish function, otherwise
        // don't allow setUserId to be called
        var userId = null;
        let setUserId = () => {
          throw new Error("Can't call setUserId on a server initiated method call");
        };
        var connection = null;
        var currentMethodInvocation = DDP._CurrentMethodInvocation.get();
        var currentPublicationInvocation = DDP._CurrentPublicationInvocation.get();
        var randomSeed = null;
        if (currentMethodInvocation) {
          userId = currentMethodInvocation.userId;
          setUserId = userId => currentMethodInvocation.setUserId(userId);
          connection = currentMethodInvocation.connection;
          randomSeed = DDPCommon.makeRpcSeed(currentMethodInvocation, name);
        } else if (currentPublicationInvocation) {
          userId = currentPublicationInvocation.userId;
          setUserId = userId => currentPublicationInvocation._session._setUserId(userId);
          connection = currentPublicationInvocation.connection;
        }
        var invocation = new DDPCommon.MethodInvocation({
          isSimulation: false,
          userId,
          setUserId,
          connection,
          randomSeed
        });
        return new Promise((resolve, reject) => {
          let result;
          try {
            result = DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, EJSON.clone(args), "internal call to '" + name + "'"));
          } catch (e) {
            return reject(e);
          }
          if (!Meteor._isPromise(result)) {
            return resolve(result);
          }
          result.then(r => resolve(r)).catch(reject);
        }).then(EJSON.clone);
      },
      _urlForSession: function (sessionId) {
        var self = this;
        var session = self.sessions.get(sessionId);
        if (session) return session._socketUrl;else return null;
      }
    });
    var calculateVersion = function (clientSupportedVersions, serverSupportedVersions) {
      var correctVersion = clientSupportedVersions.find(function (version) {
        return serverSupportedVersions.includes(version);
      });
      if (!correctVersion) {
        correctVersion = serverSupportedVersions[0];
      }
      return correctVersion;
    };
    DDPServer._calculateVersion = calculateVersion;

    // "blind" exceptions other than those that were deliberately thrown to signal
    // errors to the client
    var wrapInternalException = function (exception, context) {
      if (!exception) return exception;

      // To allow packages to throw errors intended for the client but not have to
      // depend on the Meteor.Error class, `isClientSafe` can be set to true on any
      // error before it is thrown.
      if (exception.isClientSafe) {
        if (!(exception instanceof Meteor.Error)) {
          const originalMessage = exception.message;
          exception = new Meteor.Error(exception.error, exception.reason, exception.details);
          exception.message = originalMessage;
        }
        return exception;
      }

      // Tests can set the '_expectedByTest' flag on an exception so it won't go to
      // the server log.
      if (!exception._expectedByTest) {
        Meteor._debug("Exception " + context, exception.stack);
        if (exception.sanitizedError) {
          Meteor._debug("Sanitized and reported to the client as:", exception.sanitizedError);
          Meteor._debug();
        }
      }

      // Did the error contain more details that could have been useful if caught in
      // server code (or if thrown from non-client-originated code), but also
      // provided a "sanitized" version with more context than 500 Internal server error? Use that.
      if (exception.sanitizedError) {
        if (exception.sanitizedError.isClientSafe) return exception.sanitizedError;
        Meteor._debug("Exception " + context + " provides a sanitizedError that " + "does not have isClientSafe property set; ignoring");
      }
      return new Meteor.Error(500, "Internal server error");
    };

    // Audit argument checks, if the audit-argument-checks package exists (it is a
    // weak dependency of this package).
    var maybeAuditArgumentChecks = function (f, context, args, description) {
      args = args || [];
      if (Package['audit-argument-checks']) {
        return Match._failIfArgumentsAreNotAllChecked(f, context, args, description);
      }
      return f.apply(context, args);
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

},"writefence.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/writefence.js                                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
DDPServer._WriteFence = class {
  constructor() {
    this.armed = false;
    this.fired = false;
    this.retired = false;
    this.outstanding_writes = 0;
    this.before_fire_callbacks = [];
    this.completion_callbacks = [];
  }
  beginWrite() {
    if (this.retired) {
      return {
        committed: () => {}
      };
    }
    if (this.fired) {
      throw new Error("fence has already activated -- too late to add writes");
    }
    this.outstanding_writes++;
    let committed = false;
    return {
      committed: async () => {
        if (committed) {
          throw new Error("committed called twice on the same write");
        }
        committed = true;
        this.outstanding_writes--;
        await this._maybeFire();
      }
    };
  }
  arm() {
    if (this === DDPServer._getCurrentFence()) {
      throw Error("Can't arm the current fence");
    }
    this.armed = true;
    return this._maybeFire();
  }
  onBeforeFire(func) {
    if (this.fired) {
      throw new Error("fence has already activated -- too late to add a callback");
    }
    this.before_fire_callbacks.push(func);
  }
  onAllCommitted(func) {
    if (this.fired) {
      throw new Error("fence has already activated -- too late to add a callback");
    }
    this.completion_callbacks.push(func);
  }
  async _armAndWait() {
    let resolver;
    const returnValue = new Promise(r => resolver = r);
    this.onAllCommitted(resolver);
    await this.arm();
    return returnValue;
  }
  armAndWait() {
    return this._armAndWait();
  }
  async _maybeFire() {
    if (this.fired) {
      throw new Error("write fence already activated?");
    }
    if (!this.armed || this.outstanding_writes > 0) {
      return;
    }
    const invokeCallback = async func => {
      try {
        await func(this);
      } catch (err) {
        Meteor._debug("exception in write fence callback:", err);
      }
    };
    this.outstanding_writes++;

    // Process all before_fire callbacks in parallel
    const beforeCallbacks = [...this.before_fire_callbacks];
    this.before_fire_callbacks = [];
    await Promise.all(beforeCallbacks.map(cb => invokeCallback(cb)));
    this.outstanding_writes--;
    if (this.outstanding_writes === 0) {
      this.fired = true;
      // Process all completion callbacks in parallel
      const callbacks = [...this.completion_callbacks];
      this.completion_callbacks = [];
      await Promise.all(callbacks.map(cb => invokeCallback(cb)));
    }
  }
  retire() {
    if (!this.fired) {
      throw new Error("Can't retire a fence that hasn't fired.");
    }
    this.retired = true;
  }
};
DDPServer._CurrentWriteFence = new Meteor.EnvironmentVariable();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"crossbar.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/crossbar.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A "crossbar" is a class that provides structured notification registration.
// See _match for the definition of how a notification matches a trigger.
// All notifications and triggers must have a string key named 'collection'.

DDPServer._Crossbar = function (options) {
  var self = this;
  options = options || {};
  self.nextId = 1;
  // map from collection name (string) -> listener id -> object. each object has
  // keys 'trigger', 'callback'.  As a hack, the empty string means "no
  // collection".
  self.listenersByCollection = {};
  self.listenersByCollectionCount = {};
  self.factPackage = options.factPackage || "livedata";
  self.factName = options.factName || null;
};
Object.assign(DDPServer._Crossbar.prototype, {
  // msg is a trigger or a notification
  _collectionForMessage: function (msg) {
    var self = this;
    if (!('collection' in msg)) {
      return '';
    } else if (typeof msg.collection === 'string') {
      if (msg.collection === '') throw Error("Message has empty collection!");
      return msg.collection;
    } else {
      throw Error("Message has non-string collection!");
    }
  },
  // Listen for notification that match 'trigger'. A notification
  // matches if it has the key-value pairs in trigger as a
  // subset. When a notification matches, call 'callback', passing
  // the actual notification.
  //
  // Returns a listen handle, which is an object with a method
  // stop(). Call stop() to stop listening.
  //
  // XXX It should be legal to call fire() from inside a listen()
  // callback?
  listen: function (trigger, callback) {
    var self = this;
    var id = self.nextId++;
    var collection = self._collectionForMessage(trigger);
    var record = {
      trigger: EJSON.clone(trigger),
      callback: callback
    };
    if (!(collection in self.listenersByCollection)) {
      self.listenersByCollection[collection] = {};
      self.listenersByCollectionCount[collection] = 0;
    }
    self.listenersByCollection[collection][id] = record;
    self.listenersByCollectionCount[collection]++;
    if (self.factName && Package['facts-base']) {
      Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, 1);
    }
    return {
      stop: function () {
        if (self.factName && Package['facts-base']) {
          Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, -1);
        }
        delete self.listenersByCollection[collection][id];
        self.listenersByCollectionCount[collection]--;
        if (self.listenersByCollectionCount[collection] === 0) {
          delete self.listenersByCollection[collection];
          delete self.listenersByCollectionCount[collection];
        }
      }
    };
  },
  // Fire the provided 'notification' (an object whose attribute
  // values are all JSON-compatibile) -- inform all matching listeners
  // (registered with listen()).
  //
  // If fire() is called inside a write fence, then each of the
  // listener callbacks will be called inside the write fence as well.
  //
  // The listeners may be invoked in parallel, rather than serially.
  fire: async function (notification) {
    var self = this;
    var collection = self._collectionForMessage(notification);
    if (!(collection in self.listenersByCollection)) {
      return;
    }
    var listenersForCollection = self.listenersByCollection[collection];
    var callbackIds = [];
    Object.entries(listenersForCollection).forEach(function (_ref) {
      let [id, l] = _ref;
      if (self._matches(notification, l.trigger)) {
        callbackIds.push(id);
      }
    });

    // Listener callbacks can yield, so we need to first find all the ones that
    // match in a single iteration over self.listenersByCollection (which can't
    // be mutated during this iteration), and then invoke the matching
    // callbacks, checking before each call to ensure they haven't stopped.
    // Note that we don't have to check that
    // self.listenersByCollection[collection] still === listenersForCollection,
    // because the only way that stops being true is if listenersForCollection
    // first gets reduced down to the empty object (and then never gets
    // increased again).
    for (const id of callbackIds) {
      if (id in listenersForCollection) {
        await listenersForCollection[id].callback(notification);
      }
    }
  },
  // A notification matches a trigger if all keys that exist in both are equal.
  //
  // Examples:
  //  N:{collection: "C"} matches T:{collection: "C"}
  //    (a non-targeted write to a collection matches a
  //     non-targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C"}
  //    (a targeted write to a collection matches a non-targeted query)
  //  N:{collection: "C"} matches T:{collection: "C", id: "X"}
  //    (a non-targeted write to a collection matches a
  //     targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C", id: "X"}
  //    (a targeted write to a collection matches a targeted query targeted
  //     at the same document)
  //  N:{collection: "C", id: "X"} does not match T:{collection: "C", id: "Y"}
  //    (a targeted write to a collection does not match a targeted query
  //     targeted at a different document)
  _matches: function (notification, trigger) {
    // Most notifications that use the crossbar have a string `collection` and
    // maybe an `id` that is a string or ObjectID. We're already dividing up
    // triggers by collection, but let's fast-track "nope, different ID" (and
    // avoid the overly generic EJSON.equals). This makes a noticeable
    // performance difference; see https://github.com/meteor/meteor/pull/3697
    if (typeof notification.id === 'string' && typeof trigger.id === 'string' && notification.id !== trigger.id) {
      return false;
    }
    if (notification.id instanceof MongoID.ObjectID && trigger.id instanceof MongoID.ObjectID && !notification.id.equals(trigger.id)) {
      return false;
    }
    return Object.keys(trigger).every(function (key) {
      return !(key in notification) || EJSON.equals(trigger[key], notification[key]);
    });
  }
});

// The "invalidation crossbar" is a specific instance used by the DDP server to
// implement write fence notifications. Listener callbacks on this crossbar
// should call beginWrite on the current write fence before they return, if they
// want to delay the write fence from firing (ie, the DDP method-data-updated
// message from being sent).
DDPServer._InvalidationCrossbar = new DDPServer._Crossbar({
  factName: "invalidation-crossbar-listeners"
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server_convenience.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/server_convenience.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
if (process.env.DDP_DEFAULT_CONNECTION_URL) {
  __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL = process.env.DDP_DEFAULT_CONNECTION_URL;
}
Meteor.server = new Server();
Meteor.refresh = async function (notification) {
  await DDPServer._InvalidationCrossbar.fire(notification);
};

// Proxy the public methods of Meteor.server so they can
// be called directly on Meteor.

['publish', 'isAsyncCall', 'methods', 'call', 'callAsync', 'apply', 'applyAsync', 'onConnection', 'onMessage'].forEach(function (name) {
  Meteor[name] = Meteor.server[name].bind(Meteor.server);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"dummy_document_view.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/dummy_document_view.ts                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DummyDocumentView: () => DummyDocumentView
});
class DummyDocumentView {
  constructor() {
    this.existsIn = void 0;
    this.dataByKey = void 0;
    this.existsIn = new Set(); // set of subscriptionHandle
    this.dataByKey = new Map(); // key-> [ {subscriptionHandle, value} by precedence]
  }
  getFields() {
    return {};
  }
  clearField(subscriptionHandle, key, changeCollector) {
    changeCollector[key] = undefined;
  }
  changeField(subscriptionHandle, key, value, changeCollector, isAdd) {
    changeCollector[key] = value;
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"session_collection_view.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/session_collection_view.ts                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      SessionCollectionView: () => SessionCollectionView
    });
    let DummyDocumentView;
    module.link("./dummy_document_view", {
      DummyDocumentView(v) {
        DummyDocumentView = v;
      }
    }, 0);
    let SessionDocumentView;
    module.link("./session_document_view", {
      SessionDocumentView(v) {
        SessionDocumentView = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class SessionCollectionView {
      /**
       * Represents a client's view of a single collection
       * @param collectionName - Name of the collection it represents
       * @param sessionCallbacks - The callbacks for added, changed, removed
       */
      constructor(collectionName, sessionCallbacks) {
        this.collectionName = void 0;
        this.documents = void 0;
        this.callbacks = void 0;
        this.collectionName = collectionName;
        this.documents = new Map();
        this.callbacks = sessionCallbacks;
      }
      isEmpty() {
        return this.documents.size === 0;
      }
      diff(previous) {
        DiffSequence.diffMaps(previous.documents, this.documents, {
          both: this.diffDocument.bind(this),
          rightOnly: (id, nowDV) => {
            this.callbacks.added(this.collectionName, id, nowDV.getFields());
          },
          leftOnly: (id, prevDV) => {
            this.callbacks.removed(this.collectionName, id);
          }
        });
      }
      diffDocument(id, prevDV, nowDV) {
        const fields = {};
        DiffSequence.diffObjects(prevDV.getFields(), nowDV.getFields(), {
          both: (key, prev, now) => {
            if (!EJSON.equals(prev, now)) {
              fields[key] = now;
            }
          },
          rightOnly: (key, now) => {
            fields[key] = now;
          },
          leftOnly: (key, prev) => {
            fields[key] = undefined;
          }
        });
        this.callbacks.changed(this.collectionName, id, fields);
      }
      added(subscriptionHandle, id, fields) {
        let docView = this.documents.get(id);
        let added = false;
        if (!docView) {
          added = true;
          if (Meteor.server.getPublicationStrategy(this.collectionName).useDummyDocumentView) {
            docView = new DummyDocumentView();
          } else {
            docView = new SessionDocumentView();
          }
          this.documents.set(id, docView);
        }
        docView.existsIn.add(subscriptionHandle);
        const changeCollector = {};
        Object.entries(fields).forEach(_ref => {
          let [key, value] = _ref;
          docView.changeField(subscriptionHandle, key, value, changeCollector, true);
        });
        if (added) {
          this.callbacks.added(this.collectionName, id, changeCollector);
        } else {
          this.callbacks.changed(this.collectionName, id, changeCollector);
        }
      }
      changed(subscriptionHandle, id, changed) {
        const changedResult = {};
        const docView = this.documents.get(id);
        if (!docView) {
          throw new Error("Could not find element with id ".concat(id, " to change"));
        }
        Object.entries(changed).forEach(_ref2 => {
          let [key, value] = _ref2;
          if (value === undefined) {
            docView.clearField(subscriptionHandle, key, changedResult);
          } else {
            docView.changeField(subscriptionHandle, key, value, changedResult);
          }
        });
        this.callbacks.changed(this.collectionName, id, changedResult);
      }
      removed(subscriptionHandle, id) {
        const docView = this.documents.get(id);
        if (!docView) {
          throw new Error("Removed nonexistent document ".concat(id));
        }
        docView.existsIn.delete(subscriptionHandle);
        if (docView.existsIn.size === 0) {
          // it is gone from everyone
          this.callbacks.removed(this.collectionName, id);
          this.documents.delete(id);
        } else {
          const changed = {};
          // remove this subscription from every precedence list
          // and record the changes
          docView.dataByKey.forEach((precedenceList, key) => {
            docView.clearField(subscriptionHandle, key, changed);
          });
          this.callbacks.changed(this.collectionName, id, changed);
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

},"session_document_view.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/session_document_view.ts                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  SessionDocumentView: () => SessionDocumentView
});
class SessionDocumentView {
  constructor() {
    this.existsIn = void 0;
    this.dataByKey = void 0;
    this.existsIn = new Set(); // set of subscriptionHandle
    // Memory Growth
    this.dataByKey = new Map(); // key-> [ {subscriptionHandle, value} by precedence]
  }
  getFields() {
    const ret = {};
    this.dataByKey.forEach((precedenceList, key) => {
      ret[key] = precedenceList[0].value;
    });
    return ret;
  }
  clearField(subscriptionHandle, key, changeCollector) {
    // Publish API ignores _id if present in fields
    if (key === "_id") return;
    const precedenceList = this.dataByKey.get(key);
    // It's okay to clear fields that didn't exist. No need to throw
    // an error.
    if (!precedenceList) return;
    let removedValue = undefined;
    for (let i = 0; i < precedenceList.length; i++) {
      const precedence = precedenceList[i];
      if (precedence.subscriptionHandle === subscriptionHandle) {
        // The view's value can only change if this subscription is the one that
        // used to have precedence.
        if (i === 0) removedValue = precedence.value;
        precedenceList.splice(i, 1);
        break;
      }
    }
    if (precedenceList.length === 0) {
      this.dataByKey.delete(key);
      changeCollector[key] = undefined;
    } else if (removedValue !== undefined && !EJSON.equals(removedValue, precedenceList[0].value)) {
      changeCollector[key] = precedenceList[0].value;
    }
  }
  changeField(subscriptionHandle, key, value, changeCollector) {
    let isAdd = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
    // Publish API ignores _id if present in fields
    if (key === "_id") return;
    // Don't share state with the data passed in by the user.
    value = EJSON.clone(value);
    if (!this.dataByKey.has(key)) {
      this.dataByKey.set(key, [{
        subscriptionHandle: subscriptionHandle,
        value: value
      }]);
      changeCollector[key] = value;
      return;
    }
    const precedenceList = this.dataByKey.get(key);
    let elt;
    if (!isAdd) {
      elt = precedenceList.find(precedence => precedence.subscriptionHandle === subscriptionHandle);
    }
    if (elt) {
      if (elt === precedenceList[0] && !EJSON.equals(value, elt.value)) {
        // this subscription is changing the value of this field.
        changeCollector[key] = value;
      }
      elt.value = value;
    } else {
      // this subscription is newly caring about this field
      precedenceList.push({
        subscriptionHandle: subscriptionHandle,
        value: value
      });
    }
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"lodash.once":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.once/package.json                                                //
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
// node_modules/meteor/ddp-server/node_modules/lodash.once/index.js                                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isempty":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isempty/package.json                                             //
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
// node_modules/meteor/ddp-server/node_modules/lodash.isempty/index.js                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isobject":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isobject/package.json                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isobject",
  "version": "3.0.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isobject/index.js                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isstring":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isstring/package.json                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isstring",
  "version": "4.0.1"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/ddp-server/node_modules/lodash.isstring/index.js                                                //
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
      DDPServer: DDPServer
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-server/stream_server.js",
    "/node_modules/meteor/ddp-server/livedata_server.js",
    "/node_modules/meteor/ddp-server/writefence.js",
    "/node_modules/meteor/ddp-server/crossbar.js",
    "/node_modules/meteor/ddp-server/server_convenience.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/ddp-server.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci9zdHJlYW1fc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2xpdmVkYXRhX3NlcnZlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci93cml0ZWZlbmNlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2Nyb3NzYmFyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL3NlcnZlcl9jb252ZW5pZW5jZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci9kdW1teV9kb2N1bWVudF92aWV3LnRzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL3Nlc3Npb25fY29sbGVjdGlvbl92aWV3LnRzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL3Nlc3Npb25fZG9jdW1lbnRfdmlldy50cyJdLCJuYW1lcyI6WyJfb2JqZWN0U3ByZWFkIiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJ2Iiwib25jZSIsInpsaWIiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsIndlYnNvY2tldEV4dGVuc2lvbnMiLCJleHRlbnNpb25zIiwid2Vic29ja2V0Q29tcHJlc3Npb25Db25maWciLCJwcm9jZXNzIiwiZW52IiwiU0VSVkVSX1dFQlNPQ0tFVF9DT01QUkVTU0lPTiIsIkpTT04iLCJwYXJzZSIsInB1c2giLCJOcG0iLCJyZXF1aXJlIiwiY29uZmlndXJlIiwidGhyZXNob2xkIiwibGV2ZWwiLCJjb25zdGFudHMiLCJaX0JFU1RfU1BFRUQiLCJtZW1MZXZlbCIsIlpfTUlOX01FTUxFVkVMIiwibm9Db250ZXh0VGFrZW92ZXIiLCJtYXhXaW5kb3dCaXRzIiwiWl9NSU5fV0lORE9XQklUUyIsInBhdGhQcmVmaXgiLCJfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIiwiUk9PVF9VUkxfUEFUSF9QUkVGSVgiLCJTdHJlYW1TZXJ2ZXIiLCJzZWxmIiwicmVnaXN0cmF0aW9uX2NhbGxiYWNrcyIsIm9wZW5fc29ja2V0cyIsInByZWZpeCIsIlJvdXRlUG9saWN5IiwiZGVjbGFyZSIsInNvY2tqcyIsInNlcnZlck9wdGlvbnMiLCJsb2ciLCJoZWFydGJlYXRfZGVsYXkiLCJkaXNjb25uZWN0X2RlbGF5IiwiZGlzYWJsZV9jb3JzIiwiRElTQUJMRV9TT0NLSlNfQ09SUyIsImpzZXNzaW9uaWQiLCJVU0VfSlNFU1NJT05JRCIsIkRJU0FCTEVfV0VCU09DS0VUUyIsIndlYnNvY2tldCIsImZheWVfc2VydmVyX29wdGlvbnMiLCJzZXJ2ZXIiLCJjcmVhdGVTZXJ2ZXIiLCJXZWJBcHAiLCJodHRwU2VydmVyIiwicmVtb3ZlTGlzdGVuZXIiLCJfdGltZW91dEFkanVzdG1lbnRSZXF1ZXN0Q2FsbGJhY2siLCJpbnN0YWxsSGFuZGxlcnMiLCJhZGRMaXN0ZW5lciIsIl9yZWRpcmVjdFdlYnNvY2tldEVuZHBvaW50Iiwib24iLCJzb2NrZXQiLCJzZXRXZWJzb2NrZXRUaW1lb3V0IiwidGltZW91dCIsInByb3RvY29sIiwiX3Nlc3Npb24iLCJyZWN2IiwiY29ubmVjdGlvbiIsInNldFRpbWVvdXQiLCJzZW5kIiwiZGF0YSIsIndyaXRlIiwiZmlsdGVyIiwidmFsdWUiLCJURVNUX01FVEFEQVRBIiwic3RyaW5naWZ5IiwidGVzdE1lc3NhZ2VPbkNvbm5lY3QiLCJmb3JFYWNoIiwiY2FsbGJhY2siLCJPYmplY3QiLCJhc3NpZ24iLCJwcm90b3R5cGUiLCJyZWdpc3RlciIsImFsbF9zb2NrZXRzIiwidmFsdWVzIiwiZXZlbnQiLCJvbGRIdHRwU2VydmVyTGlzdGVuZXJzIiwibGlzdGVuZXJzIiwic2xpY2UiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJuZXdMaXN0ZW5lciIsInJlcXVlc3QiLCJhcmdzIiwiYXJndW1lbnRzIiwidXJsIiwicGFyc2VkVXJsIiwicGF0aG5hbWUiLCJmb3JtYXQiLCJvbGRMaXN0ZW5lciIsImFwcGx5IiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwiYXN5bmMiLCJpc0VtcHR5IiwiaXNPYmplY3QiLCJpc1N0cmluZyIsIlNlc3Npb25Db2xsZWN0aW9uVmlldyIsIlNlc3Npb25Eb2N1bWVudFZpZXciLCJERFBTZXJ2ZXIiLCJwdWJsaWNhdGlvblN0cmF0ZWdpZXMiLCJTRVJWRVJfTUVSR0UiLCJ1c2VEdW1teURvY3VtZW50VmlldyIsInVzZUNvbGxlY3Rpb25WaWV3IiwiZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbiIsIk5PX01FUkdFX05PX0hJU1RPUlkiLCJOT19NRVJHRSIsIk5PX01FUkdFX01VTFRJIiwiX1Nlc3Npb25Eb2N1bWVudFZpZXciLCJfZ2V0Q3VycmVudEZlbmNlIiwiY3VycmVudEludm9jYXRpb24iLCJfQ3VycmVudFdyaXRlRmVuY2UiLCJnZXQiLCJERFAiLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJmZW5jZSIsInVuZGVmaW5lZCIsIl9TZXNzaW9uQ29sbGVjdGlvblZpZXciLCJTZXNzaW9uIiwidmVyc2lvbiIsIm9wdGlvbnMiLCJpZCIsIlJhbmRvbSIsImluaXRpYWxpemVkIiwiaW5RdWV1ZSIsIk1ldGVvciIsIl9Eb3VibGVFbmRlZFF1ZXVlIiwiYmxvY2tlZCIsIndvcmtlclJ1bm5pbmciLCJjYWNoZWRVbmJsb2NrIiwiX25hbWVkU3VicyIsIk1hcCIsIl91bml2ZXJzYWxTdWJzIiwidXNlcklkIiwiY29sbGVjdGlvblZpZXdzIiwiX2lzU2VuZGluZyIsIl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzIiwiX3BlbmRpbmdSZWFkeSIsIl9jbG9zZUNhbGxiYWNrcyIsIl9zb2NrZXRVcmwiLCJfcmVzcG9uZFRvUGluZ3MiLCJyZXNwb25kVG9QaW5ncyIsImNvbm5lY3Rpb25IYW5kbGUiLCJjbG9zZSIsIm9uQ2xvc2UiLCJmbiIsImNiIiwiYmluZEVudmlyb25tZW50IiwiZGVmZXIiLCJjbGllbnRBZGRyZXNzIiwiX2NsaWVudEFkZHJlc3MiLCJodHRwSGVhZGVycyIsImhlYWRlcnMiLCJtc2ciLCJzZXNzaW9uIiwic3RhcnRVbml2ZXJzYWxTdWJzIiwiaGVhcnRiZWF0SW50ZXJ2YWwiLCJoZWFydGJlYXQiLCJERFBDb21tb24iLCJIZWFydGJlYXQiLCJoZWFydGJlYXRUaW1lb3V0Iiwib25UaW1lb3V0Iiwic2VuZFBpbmciLCJzdGFydCIsIlBhY2thZ2UiLCJGYWN0cyIsImluY3JlbWVudFNlcnZlckZhY3QiLCJzZW5kUmVhZHkiLCJzdWJzY3JpcHRpb25JZHMiLCJzdWJzIiwic3Vic2NyaXB0aW9uSWQiLCJfY2FuU2VuZCIsImNvbGxlY3Rpb25OYW1lIiwiZ2V0UHVibGljYXRpb25TdHJhdGVneSIsInNlbmRBZGRlZCIsImZpZWxkcyIsImNvbGxlY3Rpb24iLCJzZW5kQ2hhbmdlZCIsInNlbmRSZW1vdmVkIiwiZ2V0U2VuZENhbGxiYWNrcyIsImFkZGVkIiwiYmluZCIsImNoYW5nZWQiLCJyZW1vdmVkIiwiZ2V0Q29sbGVjdGlvblZpZXciLCJyZXQiLCJzZXQiLCJzdWJzY3JpcHRpb25IYW5kbGUiLCJ2aWV3IiwiZGVsZXRlIiwiaGFuZGxlcnMiLCJ1bml2ZXJzYWxfcHVibGlzaF9oYW5kbGVycyIsImhhbmRsZXIiLCJfc3RhcnRTdWJzY3JpcHRpb24iLCJzdG9wIiwiX21ldGVvclNlc3Npb24iLCJfZGVhY3RpdmF0ZUFsbFN1YnNjcmlwdGlvbnMiLCJfcmVtb3ZlU2Vzc2lvbiIsIl9wcmludFNlbnRERFAiLCJfZGVidWciLCJzdHJpbmdpZnlERFAiLCJzZW5kRXJyb3IiLCJyZWFzb24iLCJvZmZlbmRpbmdNZXNzYWdlIiwicHJvY2Vzc01lc3NhZ2UiLCJtc2dfaW4iLCJtZXNzYWdlUmVjZWl2ZWQiLCJwcm9jZXNzTmV4dCIsInNoaWZ0IiwicnVuSGFuZGxlcnMiLCJ1bmJsb2NrIiwic2V0SW1tZWRpYXRlIiwib25NZXNzYWdlSG9vayIsImVhY2giLCJwcm90b2NvbF9oYW5kbGVycyIsInJlc3VsdCIsImNhbGwiLCJfaXNQcm9taXNlIiwiZmluYWxseSIsInN1YiIsIm5hbWUiLCJwYXJhbXMiLCJBcnJheSIsInB1Ymxpc2hfaGFuZGxlcnMiLCJlcnJvciIsIkVycm9yIiwiY29uY2F0IiwiaGFzIiwiRERQUmF0ZUxpbWl0ZXIiLCJyYXRlTGltaXRlcklucHV0IiwidHlwZSIsImNvbm5lY3Rpb25JZCIsIl9pbmNyZW1lbnQiLCJyYXRlTGltaXRSZXN1bHQiLCJfY2hlY2siLCJhbGxvd2VkIiwiZ2V0RXJyb3JNZXNzYWdlIiwidGltZVRvUmVzZXQiLCJ1bnN1YiIsIl9zdG9wU3Vic2NyaXB0aW9uIiwibWV0aG9kIiwicmFuZG9tU2VlZCIsIl9Xcml0ZUZlbmNlIiwib25BbGxDb21taXR0ZWQiLCJyZXRpcmUiLCJtZXRob2RzIiwibWV0aG9kX2hhbmRsZXJzIiwiYXJtIiwiaW52b2NhdGlvbiIsIk1ldGhvZEludm9jYXRpb24iLCJpc1NpbXVsYXRpb24iLCJzZXRVc2VySWQiLCJfc2V0VXNlcklkIiwicHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0Iiwid2l0aFZhbHVlIiwibWF5YmVBdWRpdEFyZ3VtZW50Q2hlY2tzIiwiZmluaXNoIiwicGF5bG9hZCIsInRoZW4iLCJleGNlcHRpb24iLCJ3cmFwSW50ZXJuYWxFeGNlcHRpb24iLCJfZWFjaFN1YiIsImYiLCJfZGlmZkNvbGxlY3Rpb25WaWV3cyIsImJlZm9yZUNWcyIsIkRpZmZTZXF1ZW5jZSIsImRpZmZNYXBzIiwiYm90aCIsImxlZnRWYWx1ZSIsInJpZ2h0VmFsdWUiLCJkaWZmIiwicmlnaHRPbmx5IiwiZG9jdW1lbnRzIiwiZG9jVmlldyIsImdldEZpZWxkcyIsImxlZnRPbmx5IiwiZG9jIiwiX2RlYWN0aXZhdGUiLCJvbGROYW1lZFN1YnMiLCJhbGwiLCJtYXAiLCJfcmVmIiwibmV3U3ViIiwiX3JlY3JlYXRlIiwiX3J1bkhhbmRsZXIiLCJfbm9ZaWVsZHNBbGxvd2VkIiwic3ViSWQiLCJTdWJzY3JpcHRpb24iLCJ1bmJsb2NrSGFuZGVyIiwic3ViTmFtZSIsIm1heWJlU3ViIiwiX25hbWUiLCJfcmVtb3ZlQWxsRG9jdW1lbnRzIiwicmVzcG9uc2UiLCJodHRwRm9yd2FyZGVkQ291bnQiLCJwYXJzZUludCIsInJlbW90ZUFkZHJlc3MiLCJmb3J3YXJkZWRGb3IiLCJzcGxpdCIsImxlbmd0aCIsImlwIiwidHJpbSIsIl9oYW5kbGVyIiwiX3N1YnNjcmlwdGlvbklkIiwiX3BhcmFtcyIsIl9zdWJzY3JpcHRpb25IYW5kbGUiLCJfZGVhY3RpdmF0ZWQiLCJfc3RvcENhbGxiYWNrcyIsIl9kb2N1bWVudHMiLCJfcmVhZHkiLCJfaWRGaWx0ZXIiLCJpZFN0cmluZ2lmeSIsIk1vbmdvSUQiLCJpZFBhcnNlIiwicmVzdWx0T3JUaGVuYWJsZSIsIl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIiwiRUpTT04iLCJjbG9uZSIsImUiLCJfaXNEZWFjdGl2YXRlZCIsImlzVGhlbmFibGUiLCJfcHVibGlzaEhhbmRsZXJSZXN1bHQiLCJyZXMiLCJpc0N1cnNvciIsImMiLCJfcHVibGlzaEN1cnNvciIsInJlYWR5IiwiaXNBcnJheSIsImV2ZXJ5IiwiY29sbGVjdGlvbk5hbWVzIiwiaSIsIl9nZXRDb2xsZWN0aW9uTmFtZSIsImN1ciIsIl9jYWxsU3RvcENhbGxiYWNrcyIsImNhbGxiYWNrcyIsImNvbGxlY3Rpb25Eb2NzIiwic3RySWQiLCJvblN0b3AiLCJpZHMiLCJTZXQiLCJhZGQiLCJTZXJ2ZXIiLCJkZWZhdWx0UHVibGljYXRpb25TdHJhdGVneSIsIm9uQ29ubmVjdGlvbkhvb2siLCJIb29rIiwiZGVidWdQcmludEV4Y2VwdGlvbnMiLCJfcHVibGljYXRpb25TdHJhdGVnaWVzIiwic2Vzc2lvbnMiLCJzdHJlYW1fc2VydmVyIiwicmF3X21zZyIsIl9wcmludFJlY2VpdmVkRERQIiwicGFyc2VERFAiLCJlcnIiLCJfaGFuZGxlQ29ubmVjdCIsIm9uQ29ubmVjdGlvbiIsInNldFB1YmxpY2F0aW9uU3RyYXRlZ3kiLCJzdHJhdGVneSIsImluY2x1ZGVzIiwib25NZXNzYWdlIiwic3VwcG9ydCIsIlNVUFBPUlRFRF9ERFBfVkVSU0lPTlMiLCJjYWxjdWxhdGVWZXJzaW9uIiwicHVibGlzaCIsImF1dG9wdWJsaXNoIiwiaXNfYXV0byIsIndhcm5lZF9hYm91dF9hdXRvcHVibGlzaCIsImVudHJpZXMiLCJfcmVmMiIsImtleSIsImlzQXN5bmNDYWxsIiwiX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZyIsIl9yZWYzIiwiZnVuYyIsIl9sZW4iLCJfa2V5IiwicG9wIiwiY2FsbEFzeW5jIiwiX2FyZ3MkIiwiX2xlbjIiLCJfa2V5MiIsImhhc093blByb3BlcnR5IiwiX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmciLCJfQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24iLCJfc2V0IiwiaGFzQ2FsbEFzeW5jUGFyZW50IiwiYXBwbHlBc3luYyIsImlzRnJvbUNhbGxBc3luYyIsImNhdGNoIiwiY3VycmVudE1ldGhvZEludm9jYXRpb24iLCJjdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIiwibWFrZVJwY1NlZWQiLCJyIiwiX3VybEZvclNlc3Npb24iLCJzZXNzaW9uSWQiLCJjbGllbnRTdXBwb3J0ZWRWZXJzaW9ucyIsInNlcnZlclN1cHBvcnRlZFZlcnNpb25zIiwiY29ycmVjdFZlcnNpb24iLCJmaW5kIiwiX2NhbGN1bGF0ZVZlcnNpb24iLCJjb250ZXh0IiwiaXNDbGllbnRTYWZlIiwib3JpZ2luYWxNZXNzYWdlIiwibWVzc2FnZSIsImRldGFpbHMiLCJfZXhwZWN0ZWRCeVRlc3QiLCJzdGFjayIsInNhbml0aXplZEVycm9yIiwiZGVzY3JpcHRpb24iLCJNYXRjaCIsIl9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkIiwiY29uc3RydWN0b3IiLCJhcm1lZCIsImZpcmVkIiwicmV0aXJlZCIsIm91dHN0YW5kaW5nX3dyaXRlcyIsImJlZm9yZV9maXJlX2NhbGxiYWNrcyIsImNvbXBsZXRpb25fY2FsbGJhY2tzIiwiYmVnaW5Xcml0ZSIsImNvbW1pdHRlZCIsIl9tYXliZUZpcmUiLCJvbkJlZm9yZUZpcmUiLCJfYXJtQW5kV2FpdCIsInJlc29sdmVyIiwicmV0dXJuVmFsdWUiLCJhcm1BbmRXYWl0IiwiaW52b2tlQ2FsbGJhY2siLCJiZWZvcmVDYWxsYmFja3MiLCJFbnZpcm9ubWVudFZhcmlhYmxlIiwiX0Nyb3NzYmFyIiwibmV4dElkIiwibGlzdGVuZXJzQnlDb2xsZWN0aW9uIiwibGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnQiLCJmYWN0UGFja2FnZSIsImZhY3ROYW1lIiwiX2NvbGxlY3Rpb25Gb3JNZXNzYWdlIiwibGlzdGVuIiwidHJpZ2dlciIsInJlY29yZCIsImZpcmUiLCJub3RpZmljYXRpb24iLCJsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uIiwiY2FsbGJhY2tJZHMiLCJsIiwiX21hdGNoZXMiLCJPYmplY3RJRCIsImVxdWFscyIsImtleXMiLCJfSW52YWxpZGF0aW9uQ3Jvc3NiYXIiLCJERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCIsInJlZnJlc2giLCJleHBvcnQiLCJEdW1teURvY3VtZW50VmlldyIsImV4aXN0c0luIiwiZGF0YUJ5S2V5IiwiY2xlYXJGaWVsZCIsImNoYW5nZUNvbGxlY3RvciIsImNoYW5nZUZpZWxkIiwiaXNBZGQiLCJzZXNzaW9uQ2FsbGJhY2tzIiwic2l6ZSIsInByZXZpb3VzIiwiZGlmZkRvY3VtZW50Iiwibm93RFYiLCJwcmV2RFYiLCJkaWZmT2JqZWN0cyIsInByZXYiLCJub3ciLCJjaGFuZ2VkUmVzdWx0IiwicHJlY2VkZW5jZUxpc3QiLCJyZW1vdmVkVmFsdWUiLCJwcmVjZWRlbmNlIiwic3BsaWNlIiwiZWx0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsYUFBYTtJQUFDQyxNQUFNLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztNQUFDQyxPQUFPQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0osYUFB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QUNMO01BQ0F1WixjQUFjLENBQUNoZCxJQUFJLENBQUM7UUFBRW9MLGtCQUFrQixFQUFFQSxrQkFBa0I7UUFBRTNILEtBQUssRUFBRUE7TUFBSyxDQUFFLENBQUM7SUFDL0U7RUFDRiIsImZpbGUiOiIvcGFja2FnZXMvZGRwLXNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBvbmNlIGZyb20gJ2xvZGFzaC5vbmNlJztcbmltcG9ydCB6bGliIGZyb20gJ25vZGU6emxpYic7XG5cbi8vIEJ5IGRlZmF1bHQsIHdlIHVzZSB0aGUgcGVybWVzc2FnZS1kZWZsYXRlIGV4dGVuc2lvbiB3aXRoIGRlZmF1bHRcbi8vIGNvbmZpZ3VyYXRpb24uIElmICRTRVJWRVJfV0VCU09DS0VUX0NPTVBSRVNTSU9OIGlzIHNldCwgdGhlbiBpdCBtdXN0IGJlIHZhbGlkXG4vLyBKU09OLiBJZiBpdCByZXByZXNlbnRzIGEgZmFsc2V5IHZhbHVlLCB0aGVuIHdlIGRvIG5vdCB1c2UgcGVybWVzc2FnZS1kZWZsYXRlXG4vLyBhdCBhbGw7IG90aGVyd2lzZSwgdGhlIEpTT04gdmFsdWUgaXMgdXNlZCBhcyBhbiBhcmd1bWVudCB0byBkZWZsYXRlJ3Ncbi8vIGNvbmZpZ3VyZSBtZXRob2Q7IHNlZVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2ZheWUvcGVybWVzc2FnZS1kZWZsYXRlLW5vZGUvYmxvYi9tYXN0ZXIvUkVBRE1FLm1kXG4vL1xuLy8gKFdlIGRvIHRoaXMgaW4gYW4gXy5vbmNlIGluc3RlYWQgb2YgYXQgc3RhcnR1cCwgYmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvXG4vLyBjcmFzaCB0aGUgdG9vbCBkdXJpbmcgaXNvcGFja2V0IGxvYWQgaWYgeW91ciBKU09OIGRvZXNuJ3QgcGFyc2UuIFRoaXMgaXMgb25seVxuLy8gYSBwcm9ibGVtIGJlY2F1c2UgdGhlIHRvb2wgaGFzIHRvIGxvYWQgdGhlIEREUCBzZXJ2ZXIgY29kZSBqdXN0IGluIG9yZGVyIHRvXG4vLyBiZSBhIEREUCBjbGllbnQ7IHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvMzQ1MiAuKVxudmFyIHdlYnNvY2tldEV4dGVuc2lvbnMgPSBvbmNlKGZ1bmN0aW9uICgpIHtcbiAgdmFyIGV4dGVuc2lvbnMgPSBbXTtcblxuICB2YXIgd2Vic29ja2V0Q29tcHJlc3Npb25Db25maWcgPSBwcm9jZXNzLmVudi5TRVJWRVJfV0VCU09DS0VUX0NPTVBSRVNTSU9OID9cbiAgICBKU09OLnBhcnNlKHByb2Nlc3MuZW52LlNFUlZFUl9XRUJTT0NLRVRfQ09NUFJFU1NJT04pIDoge307XG5cbiAgaWYgKHdlYnNvY2tldENvbXByZXNzaW9uQ29uZmlnKSB7XG4gICAgZXh0ZW5zaW9ucy5wdXNoKE5wbS5yZXF1aXJlKCdwZXJtZXNzYWdlLWRlZmxhdGUyJykuY29uZmlndXJlKHtcbiAgICAgIHRocmVzaG9sZDogMTAyNCxcbiAgICAgIGxldmVsOiB6bGliLmNvbnN0YW50cy5aX0JFU1RfU1BFRUQsXG4gICAgICBtZW1MZXZlbDogemxpYi5jb25zdGFudHMuWl9NSU5fTUVNTEVWRUwsXG4gICAgICBub0NvbnRleHRUYWtlb3ZlcjogdHJ1ZSxcbiAgICAgIG1heFdpbmRvd0JpdHM6IHpsaWIuY29uc3RhbnRzLlpfTUlOX1dJTkRPV0JJVFMsXG4gICAgICAuLi4od2Vic29ja2V0Q29tcHJlc3Npb25Db25maWcgfHwge30pXG4gICAgfSkpO1xuICB9XG5cbiAgcmV0dXJuIGV4dGVuc2lvbnM7XG59KTtcblxudmFyIHBhdGhQcmVmaXggPSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMX1BBVEhfUFJFRklYIHx8ICBcIlwiO1xuXG5TdHJlYW1TZXJ2ZXIgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5yZWdpc3RyYXRpb25fY2FsbGJhY2tzID0gW107XG4gIHNlbGYub3Blbl9zb2NrZXRzID0gW107XG5cbiAgLy8gQmVjYXVzZSB3ZSBhcmUgaW5zdGFsbGluZyBkaXJlY3RseSBvbnRvIFdlYkFwcC5odHRwU2VydmVyIGluc3RlYWQgb2YgdXNpbmdcbiAgLy8gV2ViQXBwLmFwcCwgd2UgaGF2ZSB0byBwcm9jZXNzIHRoZSBwYXRoIHByZWZpeCBvdXJzZWx2ZXMuXG4gIHNlbGYucHJlZml4ID0gcGF0aFByZWZpeCArICcvc29ja2pzJztcbiAgUm91dGVQb2xpY3kuZGVjbGFyZShzZWxmLnByZWZpeCArICcvJywgJ25ldHdvcmsnKTtcblxuICAvLyBzZXQgdXAgc29ja2pzXG4gIHZhciBzb2NranMgPSBOcG0ucmVxdWlyZSgnc29ja2pzJyk7XG4gIHZhciBzZXJ2ZXJPcHRpb25zID0ge1xuICAgIHByZWZpeDogc2VsZi5wcmVmaXgsXG4gICAgbG9nOiBmdW5jdGlvbigpIHt9LFxuICAgIC8vIHRoaXMgaXMgdGhlIGRlZmF1bHQsIGJ1dCB3ZSBjb2RlIGl0IGV4cGxpY2l0bHkgYmVjYXVzZSB3ZSBkZXBlbmRcbiAgICAvLyBvbiBpdCBpbiBzdHJlYW1fY2xpZW50OkhFQVJUQkVBVF9USU1FT1VUXG4gICAgaGVhcnRiZWF0X2RlbGF5OiA0NTAwMCxcbiAgICAvLyBUaGUgZGVmYXVsdCBkaXNjb25uZWN0X2RlbGF5IGlzIDUgc2Vjb25kcywgYnV0IGlmIHRoZSBzZXJ2ZXIgZW5kcyB1cCBDUFVcbiAgICAvLyBib3VuZCBmb3IgdGhhdCBtdWNoIHRpbWUsIFNvY2tKUyBtaWdodCBub3Qgbm90aWNlIHRoYXQgdGhlIHVzZXIgaGFzXG4gICAgLy8gcmVjb25uZWN0ZWQgYmVjYXVzZSB0aGUgdGltZXIgKG9mIGRpc2Nvbm5lY3RfZGVsYXkgbXMpIGNhbiBmaXJlIGJlZm9yZVxuICAgIC8vIFNvY2tKUyBwcm9jZXNzZXMgdGhlIG5ldyBjb25uZWN0aW9uLiBFdmVudHVhbGx5IHdlJ2xsIGZpeCB0aGlzIGJ5IG5vdFxuICAgIC8vIGNvbWJpbmluZyBDUFUtaGVhdnkgcHJvY2Vzc2luZyB3aXRoIFNvY2tKUyB0ZXJtaW5hdGlvbiAoZWcgYSBwcm94eSB3aGljaFxuICAgIC8vIGNvbnZlcnRzIHRvIFVuaXggc29ja2V0cykgYnV0IGZvciBub3csIHJhaXNlIHRoZSBkZWxheS5cbiAgICBkaXNjb25uZWN0X2RlbGF5OiA2MCAqIDEwMDAsXG4gICAgLy8gQWxsb3cgZGlzYWJsaW5nIG9mIENPUlMgcmVxdWVzdHMgdG8gYWRkcmVzc1xuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy84MzE3LlxuICAgIGRpc2FibGVfY29yczogISFwcm9jZXNzLmVudi5ESVNBQkxFX1NPQ0tKU19DT1JTLFxuICAgIC8vIFNldCB0aGUgVVNFX0pTRVNTSU9OSUQgZW52aXJvbm1lbnQgdmFyaWFibGUgdG8gZW5hYmxlIHNldHRpbmcgdGhlXG4gICAgLy8gSlNFU1NJT05JRCBjb29raWUuIFRoaXMgaXMgdXNlZnVsIGZvciBzZXR0aW5nIHVwIHByb3hpZXMgd2l0aFxuICAgIC8vIHNlc3Npb24gYWZmaW5pdHkuXG4gICAganNlc3Npb25pZDogISFwcm9jZXNzLmVudi5VU0VfSlNFU1NJT05JRFxuICB9O1xuXG4gIC8vIElmIHlvdSBrbm93IHlvdXIgc2VydmVyIGVudmlyb25tZW50IChlZywgcHJveGllcykgd2lsbCBwcmV2ZW50IHdlYnNvY2tldHNcbiAgLy8gZnJvbSBldmVyIHdvcmtpbmcsIHNldCAkRElTQUJMRV9XRUJTT0NLRVRTIGFuZCBTb2NrSlMgY2xpZW50cyAoaWUsXG4gIC8vIGJyb3dzZXJzKSB3aWxsIG5vdCB3YXN0ZSB0aW1lIGF0dGVtcHRpbmcgdG8gdXNlIHRoZW0uXG4gIC8vIChZb3VyIHNlcnZlciB3aWxsIHN0aWxsIGhhdmUgYSAvd2Vic29ja2V0IGVuZHBvaW50LilcbiAgaWYgKHByb2Nlc3MuZW52LkRJU0FCTEVfV0VCU09DS0VUUykge1xuICAgIHNlcnZlck9wdGlvbnMud2Vic29ja2V0ID0gZmFsc2U7XG4gIH0gZWxzZSB7XG4gICAgc2VydmVyT3B0aW9ucy5mYXllX3NlcnZlcl9vcHRpb25zID0ge1xuICAgICAgZXh0ZW5zaW9uczogd2Vic29ja2V0RXh0ZW5zaW9ucygpXG4gICAgfTtcbiAgfVxuXG4gIHNlbGYuc2VydmVyID0gc29ja2pzLmNyZWF0ZVNlcnZlcihzZXJ2ZXJPcHRpb25zKTtcblxuICAvLyBJbnN0YWxsIHRoZSBzb2NranMgaGFuZGxlcnMsIGJ1dCB3ZSB3YW50IHRvIGtlZXAgYXJvdW5kIG91ciBvd24gcGFydGljdWxhclxuICAvLyByZXF1ZXN0IGhhbmRsZXIgdGhhdCBhZGp1c3RzIGlkbGUgdGltZW91dHMgd2hpbGUgd2UgaGF2ZSBhbiBvdXRzdGFuZGluZ1xuICAvLyByZXF1ZXN0LiAgVGhpcyBjb21wZW5zYXRlcyBmb3IgdGhlIGZhY3QgdGhhdCBzb2NranMgcmVtb3ZlcyBhbGwgbGlzdGVuZXJzXG4gIC8vIGZvciBcInJlcXVlc3RcIiB0byBhZGQgaXRzIG93bi5cbiAgV2ViQXBwLmh0dHBTZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoXG4gICAgJ3JlcXVlc3QnLCBXZWJBcHAuX3RpbWVvdXRBZGp1c3RtZW50UmVxdWVzdENhbGxiYWNrKTtcbiAgc2VsZi5zZXJ2ZXIuaW5zdGFsbEhhbmRsZXJzKFdlYkFwcC5odHRwU2VydmVyKTtcbiAgV2ViQXBwLmh0dHBTZXJ2ZXIuYWRkTGlzdGVuZXIoXG4gICAgJ3JlcXVlc3QnLCBXZWJBcHAuX3RpbWVvdXRBZGp1c3RtZW50UmVxdWVzdENhbGxiYWNrKTtcblxuICAvLyBTdXBwb3J0IHRoZSAvd2Vic29ja2V0IGVuZHBvaW50XG4gIHNlbGYuX3JlZGlyZWN0V2Vic29ja2V0RW5kcG9pbnQoKTtcblxuICBzZWxmLnNlcnZlci5vbignY29ubmVjdGlvbicsIGZ1bmN0aW9uIChzb2NrZXQpIHtcbiAgICAvLyBzb2NranMgc29tZXRpbWVzIHBhc3NlcyB1cyBudWxsIGluc3RlYWQgb2YgYSBzb2NrZXQgb2JqZWN0XG4gICAgLy8gc28gd2UgbmVlZCB0byBndWFyZCBhZ2FpbnN0IHRoYXQuIHNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vc29ja2pzL3NvY2tqcy1ub2RlL2lzc3Vlcy8xMjFcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvMTA0NjhcbiAgICBpZiAoIXNvY2tldCkgcmV0dXJuO1xuXG4gICAgLy8gV2Ugd2FudCB0byBtYWtlIHN1cmUgdGhhdCBpZiBhIGNsaWVudCBjb25uZWN0cyB0byB1cyBhbmQgZG9lcyB0aGUgaW5pdGlhbFxuICAgIC8vIFdlYnNvY2tldCBoYW5kc2hha2UgYnV0IG5ldmVyIGdldHMgdG8gdGhlIEREUCBoYW5kc2hha2UsIHRoYXQgd2VcbiAgICAvLyBldmVudHVhbGx5IGtpbGwgdGhlIHNvY2tldC4gIE9uY2UgdGhlIEREUCBoYW5kc2hha2UgaGFwcGVucywgRERQXG4gICAgLy8gaGVhcnRiZWF0aW5nIHdpbGwgd29yay4gQW5kIGJlZm9yZSB0aGUgV2Vic29ja2V0IGhhbmRzaGFrZSwgdGhlIHRpbWVvdXRzXG4gICAgLy8gd2Ugc2V0IGF0IHRoZSBzZXJ2ZXIgbGV2ZWwgaW4gd2ViYXBwX3NlcnZlci5qcyB3aWxsIHdvcmsuIEJ1dFxuICAgIC8vIGZheWUtd2Vic29ja2V0IGNhbGxzIHNldFRpbWVvdXQoMCkgb24gYW55IHNvY2tldCBpdCB0YWtlcyBvdmVyLCBzbyB0aGVyZVxuICAgIC8vIGlzIGFuIFwiaW4gYmV0d2VlblwiIHN0YXRlIHdoZXJlIHRoaXMgZG9lc24ndCBoYXBwZW4uICBXZSB3b3JrIGFyb3VuZCB0aGlzXG4gICAgLy8gYnkgZXhwbGljaXRseSBzZXR0aW5nIHRoZSBzb2NrZXQgdGltZW91dCB0byBhIHJlbGF0aXZlbHkgbGFyZ2UgdGltZSBoZXJlLFxuICAgIC8vIGFuZCBzZXR0aW5nIGl0IGJhY2sgdG8gemVybyB3aGVuIHdlIHNldCB1cCB0aGUgaGVhcnRiZWF0IGluXG4gICAgLy8gbGl2ZWRhdGFfc2VydmVyLmpzLlxuICAgIHNvY2tldC5zZXRXZWJzb2NrZXRUaW1lb3V0ID0gZnVuY3Rpb24gKHRpbWVvdXQpIHtcbiAgICAgIGlmICgoc29ja2V0LnByb3RvY29sID09PSAnd2Vic29ja2V0JyB8fFxuICAgICAgICAgICBzb2NrZXQucHJvdG9jb2wgPT09ICd3ZWJzb2NrZXQtcmF3JylcbiAgICAgICAgICAmJiBzb2NrZXQuX3Nlc3Npb24ucmVjdikge1xuICAgICAgICBzb2NrZXQuX3Nlc3Npb24ucmVjdi5jb25uZWN0aW9uLnNldFRpbWVvdXQodGltZW91dCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBzb2NrZXQuc2V0V2Vic29ja2V0VGltZW91dCg0NSAqIDEwMDApO1xuXG4gICAgc29ja2V0LnNlbmQgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgc29ja2V0LndyaXRlKGRhdGEpO1xuICAgIH07XG4gICAgc29ja2V0Lm9uKCdjbG9zZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYub3Blbl9zb2NrZXRzID0gc2VsZi5vcGVuX3NvY2tldHMuZmlsdGVyKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAhPT0gc29ja2V0O1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgc2VsZi5vcGVuX3NvY2tldHMucHVzaChzb2NrZXQpO1xuXG4gICAgLy8gb25seSB0byBzZW5kIGEgbWVzc2FnZSBhZnRlciBjb25uZWN0aW9uIG9uIHRlc3RzLCB1c2VmdWwgZm9yXG4gICAgLy8gc29ja2V0LXN0cmVhbS1jbGllbnQvc2VydmVyLXRlc3RzLmpzXG4gICAgaWYgKHByb2Nlc3MuZW52LlRFU1RfTUVUQURBVEEgJiYgcHJvY2Vzcy5lbnYuVEVTVF9NRVRBREFUQSAhPT0gXCJ7fVwiKSB7XG4gICAgICBzb2NrZXQuc2VuZChKU09OLnN0cmluZ2lmeSh7IHRlc3RNZXNzYWdlT25Db25uZWN0OiB0cnVlIH0pKTtcbiAgICB9XG5cbiAgICAvLyBjYWxsIGFsbCBvdXIgY2FsbGJhY2tzIHdoZW4gd2UgZ2V0IGEgbmV3IHNvY2tldC4gdGhleSB3aWxsIGRvIHRoZVxuICAgIC8vIHdvcmsgb2Ygc2V0dGluZyB1cCBoYW5kbGVycyBhbmQgc3VjaCBmb3Igc3BlY2lmaWMgbWVzc2FnZXMuXG4gICAgc2VsZi5yZWdpc3RyYXRpb25fY2FsbGJhY2tzLmZvckVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayhzb2NrZXQpO1xuICAgIH0pO1xuICB9KTtcblxufTtcblxuT2JqZWN0LmFzc2lnbihTdHJlYW1TZXJ2ZXIucHJvdG90eXBlLCB7XG4gIC8vIGNhbGwgbXkgY2FsbGJhY2sgd2hlbiBhIG5ldyBzb2NrZXQgY29ubmVjdHMuXG4gIC8vIGFsc28gY2FsbCBpdCBmb3IgYWxsIGN1cnJlbnQgY29ubmVjdGlvbnMuXG4gIHJlZ2lzdGVyOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5yZWdpc3RyYXRpb25fY2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICAgIHNlbGYuYWxsX3NvY2tldHMoKS5mb3JFYWNoKGZ1bmN0aW9uIChzb2NrZXQpIHtcbiAgICAgIGNhbGxiYWNrKHNvY2tldCk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gZ2V0IGEgbGlzdCBvZiBhbGwgc29ja2V0c1xuICBhbGxfc29ja2V0czogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhzZWxmLm9wZW5fc29ja2V0cyk7XG4gIH0sXG5cbiAgLy8gUmVkaXJlY3QgL3dlYnNvY2tldCB0byAvc29ja2pzL3dlYnNvY2tldCBpbiBvcmRlciB0byBub3QgZXhwb3NlXG4gIC8vIHNvY2tqcyB0byBjbGllbnRzIHRoYXQgd2FudCB0byB1c2UgcmF3IHdlYnNvY2tldHNcbiAgX3JlZGlyZWN0V2Vic29ja2V0RW5kcG9pbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBVbmZvcnR1bmF0ZWx5IHdlIGNhbid0IHVzZSBhIGNvbm5lY3QgbWlkZGxld2FyZSBoZXJlIHNpbmNlXG4gICAgLy8gc29ja2pzIGluc3RhbGxzIGl0c2VsZiBwcmlvciB0byBhbGwgZXhpc3RpbmcgbGlzdGVuZXJzXG4gICAgLy8gKG1lYW5pbmcgcHJpb3IgdG8gYW55IGNvbm5lY3QgbWlkZGxld2FyZXMpIHNvIHdlIG5lZWQgdG8gdGFrZVxuICAgIC8vIGFuIGFwcHJvYWNoIHNpbWlsYXIgdG8gb3ZlcnNoYWRvd0xpc3RlbmVycyBpblxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9zb2NranMvc29ja2pzLW5vZGUvYmxvYi9jZjgyMGM1NWFmNmE5OTUzZTE2NTU4NTU1YTMxZGVjZWE1NTRmNzBlL3NyYy91dGlscy5jb2ZmZWVcbiAgICBbJ3JlcXVlc3QnLCAndXBncmFkZSddLmZvckVhY2goKGV2ZW50KSA9PiB7XG4gICAgICB2YXIgaHR0cFNlcnZlciA9IFdlYkFwcC5odHRwU2VydmVyO1xuICAgICAgdmFyIG9sZEh0dHBTZXJ2ZXJMaXN0ZW5lcnMgPSBodHRwU2VydmVyLmxpc3RlbmVycyhldmVudCkuc2xpY2UoMCk7XG4gICAgICBodHRwU2VydmVyLnJlbW92ZUFsbExpc3RlbmVycyhldmVudCk7XG5cbiAgICAgIC8vIHJlcXVlc3QgYW5kIHVwZ3JhZGUgaGF2ZSBkaWZmZXJlbnQgYXJndW1lbnRzIHBhc3NlZCBidXRcbiAgICAgIC8vIHdlIG9ubHkgY2FyZSBhYm91dCB0aGUgZmlyc3Qgb25lIHdoaWNoIGlzIGFsd2F5cyByZXF1ZXN0XG4gICAgICB2YXIgbmV3TGlzdGVuZXIgPSBmdW5jdGlvbihyZXF1ZXN0IC8qLCBtb3JlQXJndW1lbnRzICovKSB7XG4gICAgICAgIC8vIFN0b3JlIGFyZ3VtZW50cyBmb3IgdXNlIHdpdGhpbiB0aGUgY2xvc3VyZSBiZWxvd1xuICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcblxuICAgICAgICAvLyBUT0RPIHJlcGxhY2Ugd2l0aCB1cmwgcGFja2FnZVxuICAgICAgICB2YXIgdXJsID0gTnBtLnJlcXVpcmUoJ3VybCcpO1xuXG4gICAgICAgIC8vIFJld3JpdGUgL3dlYnNvY2tldCBhbmQgL3dlYnNvY2tldC8gdXJscyB0byAvc29ja2pzL3dlYnNvY2tldCB3aGlsZVxuICAgICAgICAvLyBwcmVzZXJ2aW5nIHF1ZXJ5IHN0cmluZy5cbiAgICAgICAgdmFyIHBhcnNlZFVybCA9IHVybC5wYXJzZShyZXF1ZXN0LnVybCk7XG4gICAgICAgIGlmIChwYXJzZWRVcmwucGF0aG5hbWUgPT09IHBhdGhQcmVmaXggKyAnL3dlYnNvY2tldCcgfHxcbiAgICAgICAgICAgIHBhcnNlZFVybC5wYXRobmFtZSA9PT0gcGF0aFByZWZpeCArICcvd2Vic29ja2V0LycpIHtcbiAgICAgICAgICBwYXJzZWRVcmwucGF0aG5hbWUgPSBzZWxmLnByZWZpeCArICcvd2Vic29ja2V0JztcbiAgICAgICAgICByZXF1ZXN0LnVybCA9IHVybC5mb3JtYXQocGFyc2VkVXJsKTtcbiAgICAgICAgfVxuICAgICAgICBvbGRIdHRwU2VydmVyTGlzdGVuZXJzLmZvckVhY2goZnVuY3Rpb24ob2xkTGlzdGVuZXIpIHtcbiAgICAgICAgICBvbGRMaXN0ZW5lci5hcHBseShodHRwU2VydmVyLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgaHR0cFNlcnZlci5hZGRMaXN0ZW5lcihldmVudCwgbmV3TGlzdGVuZXIpO1xuICAgIH0pO1xuICB9XG59KTsiLCJpbXBvcnQgaXNFbXB0eSBmcm9tICdsb2Rhc2guaXNlbXB0eSc7XG5pbXBvcnQgaXNPYmplY3QgZnJvbSAnbG9kYXNoLmlzb2JqZWN0JztcbmltcG9ydCBpc1N0cmluZyBmcm9tICdsb2Rhc2guaXNzdHJpbmcnO1xuaW1wb3J0IHsgU2Vzc2lvbkNvbGxlY3Rpb25WaWV3IH0gZnJvbSAnLi9zZXNzaW9uX2NvbGxlY3Rpb25fdmlldyc7XG5pbXBvcnQgeyBTZXNzaW9uRG9jdW1lbnRWaWV3IH0gZnJvbSAnLi9zZXNzaW9uX2RvY3VtZW50X3ZpZXcnO1xuXG5ERFBTZXJ2ZXIgPSB7fTtcblxuXG4vLyBQdWJsaWNhdGlvbiBzdHJhdGVnaWVzIGRlZmluZSBob3cgd2UgaGFuZGxlIGRhdGEgZnJvbSBwdWJsaXNoZWQgY3Vyc29ycyBhdCB0aGUgY29sbGVjdGlvbiBsZXZlbFxuLy8gVGhpcyBhbGxvd3Mgc29tZW9uZSB0bzpcbi8vIC0gQ2hvb3NlIGEgdHJhZGUtb2ZmIGJldHdlZW4gY2xpZW50LXNlcnZlciBiYW5kd2lkdGggYW5kIHNlcnZlciBtZW1vcnkgdXNhZ2Vcbi8vIC0gSW1wbGVtZW50IHNwZWNpYWwgKG5vbi1tb25nbykgY29sbGVjdGlvbnMgbGlrZSB2b2xhdGlsZSBtZXNzYWdlIHF1ZXVlc1xuY29uc3QgcHVibGljYXRpb25TdHJhdGVnaWVzID0ge1xuICAvLyBTRVJWRVJfTUVSR0UgaXMgdGhlIGRlZmF1bHQgc3RyYXRlZ3kuXG4gIC8vIFdoZW4gdXNpbmcgdGhpcyBzdHJhdGVneSwgdGhlIHNlcnZlciBtYWludGFpbnMgYSBjb3B5IG9mIGFsbCBkYXRhIGEgY29ubmVjdGlvbiBpcyBzdWJzY3JpYmVkIHRvLlxuICAvLyBUaGlzIGFsbG93cyB1cyB0byBvbmx5IHNlbmQgZGVsdGFzIG92ZXIgbXVsdGlwbGUgcHVibGljYXRpb25zLlxuICBTRVJWRVJfTUVSR0U6IHtcbiAgICB1c2VEdW1teURvY3VtZW50VmlldzogZmFsc2UsXG4gICAgdXNlQ29sbGVjdGlvblZpZXc6IHRydWUsXG4gICAgZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbjogdHJ1ZSxcbiAgfSxcbiAgLy8gVGhlIE5PX01FUkdFX05PX0hJU1RPUlkgc3RyYXRlZ3kgcmVzdWx0cyBpbiB0aGUgc2VydmVyIHNlbmRpbmcgYWxsIHB1YmxpY2F0aW9uIGRhdGFcbiAgLy8gZGlyZWN0bHkgdG8gdGhlIGNsaWVudC4gSXQgZG9lcyBub3QgcmVtZW1iZXIgd2hhdCBpdCBoYXMgcHJldmlvdXNseSBzZW50XG4gIC8vIHRvIGl0IHdpbGwgbm90IHRyaWdnZXIgcmVtb3ZlZCBtZXNzYWdlcyB3aGVuIGEgc3Vic2NyaXB0aW9uIGlzIHN0b3BwZWQuXG4gIC8vIFRoaXMgc2hvdWxkIG9ubHkgYmUgY2hvc2VuIGZvciBzcGVjaWFsIHVzZSBjYXNlcyBsaWtlIHNlbmQtYW5kLWZvcmdldCBxdWV1ZXMuXG4gIE5PX01FUkdFX05PX0hJU1RPUlk6IHtcbiAgICB1c2VEdW1teURvY3VtZW50VmlldzogZmFsc2UsXG4gICAgdXNlQ29sbGVjdGlvblZpZXc6IGZhbHNlLFxuICAgIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IGZhbHNlLFxuICB9LFxuICAvLyBOT19NRVJHRSBpcyBzaW1pbGFyIHRvIE5PX01FUkdFX05PX0hJU1RPUlkgYnV0IHRoZSBzZXJ2ZXIgd2lsbCByZW1lbWJlciB0aGUgSURzIGl0IGhhc1xuICAvLyBzZW50IHRvIHRoZSBjbGllbnQgc28gaXQgY2FuIHJlbW92ZSB0aGVtIHdoZW4gYSBzdWJzY3JpcHRpb24gaXMgc3RvcHBlZC5cbiAgLy8gVGhpcyBzdHJhdGVneSBjYW4gYmUgdXNlZCB3aGVuIGEgY29sbGVjdGlvbiBpcyBvbmx5IHVzZWQgaW4gYSBzaW5nbGUgcHVibGljYXRpb24uXG4gIE5PX01FUkdFOiB7XG4gICAgdXNlRHVtbXlEb2N1bWVudFZpZXc6IGZhbHNlLFxuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiBmYWxzZSxcbiAgICBkb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uOiB0cnVlLFxuICB9LFxuICAvLyBOT19NRVJHRV9NVUxUSSBpcyBzaW1pbGFyIHRvIGBOT19NRVJHRWAsIGJ1dCBpdCBkb2VzIHRyYWNrIHdoZXRoZXIgYSBkb2N1bWVudCBpc1xuICAvLyB1c2VkIGJ5IG11bHRpcGxlIHB1YmxpY2F0aW9ucy4gVGhpcyBoYXMgc29tZSBtZW1vcnkgb3ZlcmhlYWQsIGJ1dCBpdCBzdGlsbCBkb2VzIG5vdCBkb1xuICAvLyBkaWZmaW5nIHNvIGl0J3MgZmFzdGVyIGFuZCBzbGltbWVyIHRoYW4gU0VSVkVSX01FUkdFLlxuICBOT19NRVJHRV9NVUxUSToge1xuICAgIHVzZUR1bW15RG9jdW1lbnRWaWV3OiB0cnVlLFxuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiB0cnVlLFxuICAgIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IHRydWVcbiAgfVxufTtcblxuRERQU2VydmVyLnB1YmxpY2F0aW9uU3RyYXRlZ2llcyA9IHB1YmxpY2F0aW9uU3RyYXRlZ2llcztcblxuLy8gVGhpcyBmaWxlIGNvbnRhaW5zIGNsYXNzZXM6XG4vLyAqIFNlc3Npb24gLSBUaGUgc2VydmVyJ3MgY29ubmVjdGlvbiB0byBhIHNpbmdsZSBERFAgY2xpZW50XG4vLyAqIFN1YnNjcmlwdGlvbiAtIEEgc2luZ2xlIHN1YnNjcmlwdGlvbiBmb3IgYSBzaW5nbGUgY2xpZW50XG4vLyAqIFNlcnZlciAtIEFuIGVudGlyZSBzZXJ2ZXIgdGhhdCBtYXkgdGFsayB0byA+IDEgY2xpZW50LiBBIEREUCBlbmRwb2ludC5cbi8vXG4vLyBTZXNzaW9uIGFuZCBTdWJzY3JpcHRpb24gYXJlIGZpbGUgc2NvcGUuIEZvciBub3csIHVudGlsIHdlIGZyZWV6ZVxuLy8gdGhlIGludGVyZmFjZSwgU2VydmVyIGlzIHBhY2thZ2Ugc2NvcGUgKGluIHRoZSBmdXR1cmUgaXQgc2hvdWxkIGJlXG4vLyBleHBvcnRlZCkuXG5cblxuRERQU2VydmVyLl9TZXNzaW9uRG9jdW1lbnRWaWV3ID0gU2Vzc2lvbkRvY3VtZW50VmlldztcblxuRERQU2VydmVyLl9nZXRDdXJyZW50RmVuY2UgPSBmdW5jdGlvbiAoKSB7XG4gIGxldCBjdXJyZW50SW52b2NhdGlvbiA9IHRoaXMuX0N1cnJlbnRXcml0ZUZlbmNlLmdldCgpO1xuICBpZiAoY3VycmVudEludm9jYXRpb24pIHtcbiAgICByZXR1cm4gY3VycmVudEludm9jYXRpb247XG4gIH1cbiAgY3VycmVudEludm9jYXRpb24gPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICByZXR1cm4gY3VycmVudEludm9jYXRpb24gPyBjdXJyZW50SW52b2NhdGlvbi5mZW5jZSA6IHVuZGVmaW5lZDtcbn07XG5cblxuRERQU2VydmVyLl9TZXNzaW9uQ29sbGVjdGlvblZpZXcgPSBTZXNzaW9uQ29sbGVjdGlvblZpZXc7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKiBTZXNzaW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxudmFyIFNlc3Npb24gPSBmdW5jdGlvbiAoc2VydmVyLCB2ZXJzaW9uLCBzb2NrZXQsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmlkID0gUmFuZG9tLmlkKCk7XG5cbiAgc2VsZi5zZXJ2ZXIgPSBzZXJ2ZXI7XG4gIHNlbGYudmVyc2lvbiA9IHZlcnNpb247XG5cbiAgc2VsZi5pbml0aWFsaXplZCA9IGZhbHNlO1xuICBzZWxmLnNvY2tldCA9IHNvY2tldDtcblxuICAvLyBTZXQgdG8gbnVsbCB3aGVuIHRoZSBzZXNzaW9uIGlzIGRlc3Ryb3llZC4gTXVsdGlwbGUgcGxhY2VzIGJlbG93XG4gIC8vIHVzZSB0aGlzIHRvIGRldGVybWluZSBpZiB0aGUgc2Vzc2lvbiBpcyBhbGl2ZSBvciBub3QuXG4gIHNlbGYuaW5RdWV1ZSA9IG5ldyBNZXRlb3IuX0RvdWJsZUVuZGVkUXVldWUoKTtcblxuICBzZWxmLmJsb2NrZWQgPSBmYWxzZTtcbiAgc2VsZi53b3JrZXJSdW5uaW5nID0gZmFsc2U7XG5cbiAgc2VsZi5jYWNoZWRVbmJsb2NrID0gbnVsbDtcblxuICAvLyBTdWIgb2JqZWN0cyBmb3IgYWN0aXZlIHN1YnNjcmlwdGlvbnNcbiAgc2VsZi5fbmFtZWRTdWJzID0gbmV3IE1hcCgpO1xuICBzZWxmLl91bml2ZXJzYWxTdWJzID0gW107XG5cbiAgc2VsZi51c2VySWQgPSBudWxsO1xuXG4gIHNlbGYuY29sbGVjdGlvblZpZXdzID0gbmV3IE1hcCgpO1xuXG4gIC8vIFNldCB0aGlzIHRvIGZhbHNlIHRvIG5vdCBzZW5kIG1lc3NhZ2VzIHdoZW4gY29sbGVjdGlvblZpZXdzIGFyZVxuICAvLyBtb2RpZmllZC4gVGhpcyBpcyBkb25lIHdoZW4gcmVydW5uaW5nIHN1YnMgaW4gX3NldFVzZXJJZCBhbmQgdGhvc2UgbWVzc2FnZXNcbiAgLy8gYXJlIGNhbGN1bGF0ZWQgdmlhIGEgZGlmZiBpbnN0ZWFkLlxuICBzZWxmLl9pc1NlbmRpbmcgPSB0cnVlO1xuXG4gIC8vIElmIHRoaXMgaXMgdHJ1ZSwgZG9uJ3Qgc3RhcnQgYSBuZXdseS1jcmVhdGVkIHVuaXZlcnNhbCBwdWJsaXNoZXIgb24gdGhpc1xuICAvLyBzZXNzaW9uLiBUaGUgc2Vzc2lvbiB3aWxsIHRha2UgY2FyZSBvZiBzdGFydGluZyBpdCB3aGVuIGFwcHJvcHJpYXRlLlxuICBzZWxmLl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzID0gZmFsc2U7XG5cbiAgLy8gV2hlbiB3ZSBhcmUgcmVydW5uaW5nIHN1YnNjcmlwdGlvbnMsIGFueSByZWFkeSBtZXNzYWdlc1xuICAvLyB3ZSB3YW50IHRvIGJ1ZmZlciB1cCBmb3Igd2hlbiB3ZSBhcmUgZG9uZSByZXJ1bm5pbmcgc3Vic2NyaXB0aW9uc1xuICBzZWxmLl9wZW5kaW5nUmVhZHkgPSBbXTtcblxuICAvLyBMaXN0IG9mIGNhbGxiYWNrcyB0byBjYWxsIHdoZW4gdGhpcyBjb25uZWN0aW9uIGlzIGNsb3NlZC5cbiAgc2VsZi5fY2xvc2VDYWxsYmFja3MgPSBbXTtcblxuXG4gIC8vIFhYWCBIQUNLOiBJZiBhIHNvY2tqcyBjb25uZWN0aW9uLCBzYXZlIG9mZiB0aGUgVVJMLiBUaGlzIGlzXG4gIC8vIHRlbXBvcmFyeSBhbmQgd2lsbCBnbyBhd2F5IGluIHRoZSBuZWFyIGZ1dHVyZS5cbiAgc2VsZi5fc29ja2V0VXJsID0gc29ja2V0LnVybDtcblxuICAvLyBBbGxvdyB0ZXN0cyB0byBkaXNhYmxlIHJlc3BvbmRpbmcgdG8gcGluZ3MuXG4gIHNlbGYuX3Jlc3BvbmRUb1BpbmdzID0gb3B0aW9ucy5yZXNwb25kVG9QaW5ncztcblxuICAvLyBUaGlzIG9iamVjdCBpcyB0aGUgcHVibGljIGludGVyZmFjZSB0byB0aGUgc2Vzc2lvbi4gSW4gdGhlIHB1YmxpY1xuICAvLyBBUEksIGl0IGlzIGNhbGxlZCB0aGUgYGNvbm5lY3Rpb25gIG9iamVjdC4gIEludGVybmFsbHkgd2UgY2FsbCBpdFxuICAvLyBhIGBjb25uZWN0aW9uSGFuZGxlYCB0byBhdm9pZCBhbWJpZ3VpdHkuXG4gIHNlbGYuY29ubmVjdGlvbkhhbmRsZSA9IHtcbiAgICBpZDogc2VsZi5pZCxcbiAgICBjbG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5jbG9zZSgpO1xuICAgIH0sXG4gICAgb25DbG9zZTogZnVuY3Rpb24gKGZuKSB7XG4gICAgICB2YXIgY2IgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KGZuLCBcImNvbm5lY3Rpb24gb25DbG9zZSBjYWxsYmFja1wiKTtcbiAgICAgIGlmIChzZWxmLmluUXVldWUpIHtcbiAgICAgICAgc2VsZi5fY2xvc2VDYWxsYmFja3MucHVzaChjYik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpZiB3ZSdyZSBhbHJlYWR5IGNsb3NlZCwgY2FsbCB0aGUgY2FsbGJhY2suXG4gICAgICAgIE1ldGVvci5kZWZlcihjYik7XG4gICAgICB9XG4gICAgfSxcbiAgICBjbGllbnRBZGRyZXNzOiBzZWxmLl9jbGllbnRBZGRyZXNzKCksXG4gICAgaHR0cEhlYWRlcnM6IHNlbGYuc29ja2V0LmhlYWRlcnNcbiAgfTtcblxuICBzZWxmLnNlbmQoeyBtc2c6ICdjb25uZWN0ZWQnLCBzZXNzaW9uOiBzZWxmLmlkIH0pO1xuXG4gIC8vIE9uIGluaXRpYWwgY29ubmVjdCwgc3BpbiB1cCBhbGwgdGhlIHVuaXZlcnNhbCBwdWJsaXNoZXJzLlxuICBzZWxmLnN0YXJ0VW5pdmVyc2FsU3VicygpO1xuXG4gIGlmICh2ZXJzaW9uICE9PSAncHJlMScgJiYgb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbCAhPT0gMCkge1xuICAgIC8vIFdlIG5vIGxvbmdlciBuZWVkIHRoZSBsb3cgbGV2ZWwgdGltZW91dCBiZWNhdXNlIHdlIGhhdmUgaGVhcnRiZWF0cy5cbiAgICBzb2NrZXQuc2V0V2Vic29ja2V0VGltZW91dCgwKTtcblxuICAgIHNlbGYuaGVhcnRiZWF0ID0gbmV3IEREUENvbW1vbi5IZWFydGJlYXQoe1xuICAgICAgaGVhcnRiZWF0SW50ZXJ2YWw6IG9wdGlvbnMuaGVhcnRiZWF0SW50ZXJ2YWwsXG4gICAgICBoZWFydGJlYXRUaW1lb3V0OiBvcHRpb25zLmhlYXJ0YmVhdFRpbWVvdXQsXG4gICAgICBvblRpbWVvdXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5jbG9zZSgpO1xuICAgICAgfSxcbiAgICAgIHNlbmRQaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYuc2VuZCh7bXNnOiAncGluZyd9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBzZWxmLmhlYXJ0YmVhdC5zdGFydCgpO1xuICB9XG5cbiAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgIFwibGl2ZWRhdGFcIiwgXCJzZXNzaW9uc1wiLCAxKTtcbn07XG5cbk9iamVjdC5hc3NpZ24oU2Vzc2lvbi5wcm90b3R5cGUsIHtcbiAgc2VuZFJlYWR5OiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSWRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc1NlbmRpbmcpIHtcbiAgICAgIHNlbGYuc2VuZCh7bXNnOiBcInJlYWR5XCIsIHN1YnM6IHN1YnNjcmlwdGlvbklkc30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdWJzY3JpcHRpb25JZHMuZm9yRWFjaChmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSWQpIHtcbiAgICAgICAgc2VsZi5fcGVuZGluZ1JlYWR5LnB1c2goc3Vic2NyaXB0aW9uSWQpO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIF9jYW5TZW5kKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuX2lzU2VuZGluZyB8fCAhdGhpcy5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkudXNlQ29sbGVjdGlvblZpZXc7XG4gIH0sXG5cblxuICBzZW5kQWRkZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5fY2FuU2VuZChjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgIHRoaXMuc2VuZCh7IG1zZzogJ2FkZGVkJywgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMgfSk7XG4gICAgfVxuICB9LFxuXG4gIHNlbmRDaGFuZ2VkKGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKSB7XG4gICAgaWYgKGlzRW1wdHkoZmllbGRzKSlcbiAgICAgIHJldHVybjtcblxuICAgIGlmICh0aGlzLl9jYW5TZW5kKGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgdGhpcy5zZW5kKHtcbiAgICAgICAgbXNnOiBcImNoYW5nZWRcIixcbiAgICAgICAgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsXG4gICAgICAgIGlkLFxuICAgICAgICBmaWVsZHNcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcblxuICBzZW5kUmVtb3ZlZChjb2xsZWN0aW9uTmFtZSwgaWQpIHtcbiAgICBpZiAodGhpcy5fY2FuU2VuZChjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgIHRoaXMuc2VuZCh7bXNnOiBcInJlbW92ZWRcIiwgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsIGlkfSk7XG4gICAgfVxuICB9LFxuXG4gIGdldFNlbmRDYWxsYmFja3M6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIHtcbiAgICAgIGFkZGVkOiBzZWxmLnNlbmRBZGRlZC5iaW5kKHNlbGYpLFxuICAgICAgY2hhbmdlZDogc2VsZi5zZW5kQ2hhbmdlZC5iaW5kKHNlbGYpLFxuICAgICAgcmVtb3ZlZDogc2VsZi5zZW5kUmVtb3ZlZC5iaW5kKHNlbGYpXG4gICAgfTtcbiAgfSxcblxuICBnZXRDb2xsZWN0aW9uVmlldzogZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciByZXQgPSBzZWxmLmNvbGxlY3Rpb25WaWV3cy5nZXQoY29sbGVjdGlvbk5hbWUpO1xuICAgIGlmICghcmV0KSB7XG4gICAgICByZXQgPSBuZXcgU2Vzc2lvbkNvbGxlY3Rpb25WaWV3KGNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuZ2V0U2VuZENhbGxiYWNrcygpKTtcbiAgICAgIHNlbGYuY29sbGVjdGlvblZpZXdzLnNldChjb2xsZWN0aW9uTmFtZSwgcmV0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfSxcblxuICBhZGRlZChzdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKSB7XG4gICAgaWYgKHRoaXMuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLnVzZUNvbGxlY3Rpb25WaWV3KSB7XG4gICAgICBjb25zdCB2aWV3ID0gdGhpcy5nZXRDb2xsZWN0aW9uVmlldyhjb2xsZWN0aW9uTmFtZSk7XG4gICAgICB2aWV3LmFkZGVkKHN1YnNjcmlwdGlvbkhhbmRsZSwgaWQsIGZpZWxkcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2VuZEFkZGVkKGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKTtcbiAgICB9XG4gIH0sXG5cbiAgcmVtb3ZlZChzdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCkge1xuICAgIGlmICh0aGlzLnNlcnZlci5nZXRQdWJsaWNhdGlvblN0cmF0ZWd5KGNvbGxlY3Rpb25OYW1lKS51c2VDb2xsZWN0aW9uVmlldykge1xuICAgICAgY29uc3QgdmlldyA9IHRoaXMuZ2V0Q29sbGVjdGlvblZpZXcoY29sbGVjdGlvbk5hbWUpO1xuICAgICAgdmlldy5yZW1vdmVkKHN1YnNjcmlwdGlvbkhhbmRsZSwgaWQpO1xuICAgICAgaWYgKHZpZXcuaXNFbXB0eSgpKSB7XG4gICAgICAgICB0aGlzLmNvbGxlY3Rpb25WaWV3cy5kZWxldGUoY29sbGVjdGlvbk5hbWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNlbmRSZW1vdmVkKGNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgfVxuICB9LFxuXG4gIGNoYW5nZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLnNlcnZlci5nZXRQdWJsaWNhdGlvblN0cmF0ZWd5KGNvbGxlY3Rpb25OYW1lKS51c2VDb2xsZWN0aW9uVmlldykge1xuICAgICAgY29uc3QgdmlldyA9IHRoaXMuZ2V0Q29sbGVjdGlvblZpZXcoY29sbGVjdGlvbk5hbWUpO1xuICAgICAgdmlldy5jaGFuZ2VkKHN1YnNjcmlwdGlvbkhhbmRsZSwgaWQsIGZpZWxkcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2VuZENoYW5nZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpO1xuICAgIH1cbiAgfSxcblxuICBzdGFydFVuaXZlcnNhbFN1YnM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gTWFrZSBhIHNoYWxsb3cgY29weSBvZiB0aGUgc2V0IG9mIHVuaXZlcnNhbCBoYW5kbGVycyBhbmQgc3RhcnQgdGhlbS4gSWZcbiAgICAvLyBhZGRpdGlvbmFsIHVuaXZlcnNhbCBwdWJsaXNoZXJzIHN0YXJ0IHdoaWxlIHdlJ3JlIHJ1bm5pbmcgdGhlbSAoZHVlIHRvXG4gICAgLy8geWllbGRpbmcpLCB0aGV5IHdpbGwgcnVuIHNlcGFyYXRlbHkgYXMgcGFydCBvZiBTZXJ2ZXIucHVibGlzaC5cbiAgICB2YXIgaGFuZGxlcnMgPSBbLi4uc2VsZi5zZXJ2ZXIudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnNdO1xuICAgIGhhbmRsZXJzLmZvckVhY2goZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgICAgIHNlbGYuX3N0YXJ0U3Vic2NyaXB0aW9uKGhhbmRsZXIpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIERlc3Ryb3kgdGhpcyBzZXNzaW9uIGFuZCB1bnJlZ2lzdGVyIGl0IGF0IHRoZSBzZXJ2ZXIuXG4gIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gRGVzdHJveSB0aGlzIHNlc3Npb24sIGV2ZW4gaWYgaXQncyBub3QgcmVnaXN0ZXJlZCBhdCB0aGVcbiAgICAvLyBzZXJ2ZXIuIFN0b3AgYWxsIHByb2Nlc3NpbmcgYW5kIHRlYXIgZXZlcnl0aGluZyBkb3duLiBJZiBhIHNvY2tldFxuICAgIC8vIHdhcyBhdHRhY2hlZCwgY2xvc2UgaXQuXG5cbiAgICAvLyBBbHJlYWR5IGRlc3Ryb3llZC5cbiAgICBpZiAoISBzZWxmLmluUXVldWUpXG4gICAgICByZXR1cm47XG5cbiAgICAvLyBEcm9wIHRoZSBtZXJnZSBib3ggZGF0YSBpbW1lZGlhdGVseS5cbiAgICBzZWxmLmluUXVldWUgPSBudWxsO1xuICAgIHNlbGYuY29sbGVjdGlvblZpZXdzID0gbmV3IE1hcCgpO1xuXG4gICAgaWYgKHNlbGYuaGVhcnRiZWF0KSB7XG4gICAgICBzZWxmLmhlYXJ0YmVhdC5zdG9wKCk7XG4gICAgICBzZWxmLmhlYXJ0YmVhdCA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuc29ja2V0KSB7XG4gICAgICBzZWxmLnNvY2tldC5jbG9zZSgpO1xuICAgICAgc2VsZi5zb2NrZXQuX21ldGVvclNlc3Npb24gPSBudWxsO1xuICAgIH1cblxuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgIFwibGl2ZWRhdGFcIiwgXCJzZXNzaW9uc1wiLCAtMSk7XG5cbiAgICBNZXRlb3IuZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgLy8gU3RvcCBjYWxsYmFja3MgY2FuIHlpZWxkLCBzbyB3ZSBkZWZlciB0aGlzIG9uIGNsb3NlLlxuICAgICAgLy8gc3ViLl9pc0RlYWN0aXZhdGVkKCkgZGV0ZWN0cyB0aGF0IHdlIHNldCBpblF1ZXVlIHRvIG51bGwgYW5kXG4gICAgICAvLyB0cmVhdHMgaXQgYXMgc2VtaS1kZWFjdGl2YXRlZCAoaXQgd2lsbCBpZ25vcmUgaW5jb21pbmcgY2FsbGJhY2tzLCBldGMpLlxuICAgICAgc2VsZi5fZGVhY3RpdmF0ZUFsbFN1YnNjcmlwdGlvbnMoKTtcblxuICAgICAgLy8gRGVmZXIgY2FsbGluZyB0aGUgY2xvc2UgY2FsbGJhY2tzLCBzbyB0aGF0IHRoZSBjYWxsZXIgY2xvc2luZ1xuICAgICAgLy8gdGhlIHNlc3Npb24gaXNuJ3Qgd2FpdGluZyBmb3IgYWxsIHRoZSBjYWxsYmFja3MgdG8gY29tcGxldGUuXG4gICAgICBzZWxmLl9jbG9zZUNhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBVbnJlZ2lzdGVyIHRoZSBzZXNzaW9uLlxuICAgIHNlbGYuc2VydmVyLl9yZW1vdmVTZXNzaW9uKHNlbGYpO1xuICB9LFxuXG4gIC8vIFNlbmQgYSBtZXNzYWdlIChkb2luZyBub3RoaW5nIGlmIG5vIHNvY2tldCBpcyBjb25uZWN0ZWQgcmlnaHQgbm93KS5cbiAgLy8gSXQgc2hvdWxkIGJlIGEgSlNPTiBvYmplY3QgKGl0IHdpbGwgYmUgc3RyaW5naWZpZWQpLlxuICBzZW5kOiBmdW5jdGlvbiAobXNnKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuc29ja2V0KSB7XG4gICAgICBpZiAoTWV0ZW9yLl9wcmludFNlbnRERFApXG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJTZW50IEREUFwiLCBERFBDb21tb24uc3RyaW5naWZ5RERQKG1zZykpO1xuICAgICAgc2VsZi5zb2NrZXQuc2VuZChERFBDb21tb24uc3RyaW5naWZ5RERQKG1zZykpO1xuICAgIH1cbiAgfSxcblxuICAvLyBTZW5kIGEgY29ubmVjdGlvbiBlcnJvci5cbiAgc2VuZEVycm9yOiBmdW5jdGlvbiAocmVhc29uLCBvZmZlbmRpbmdNZXNzYWdlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBtc2cgPSB7bXNnOiAnZXJyb3InLCByZWFzb246IHJlYXNvbn07XG4gICAgaWYgKG9mZmVuZGluZ01lc3NhZ2UpXG4gICAgICBtc2cub2ZmZW5kaW5nTWVzc2FnZSA9IG9mZmVuZGluZ01lc3NhZ2U7XG4gICAgc2VsZi5zZW5kKG1zZyk7XG4gIH0sXG5cbiAgLy8gUHJvY2VzcyAnbXNnJyBhcyBhbiBpbmNvbWluZyBtZXNzYWdlLiBBcyBhIGd1YXJkIGFnYWluc3RcbiAgLy8gcmFjZSBjb25kaXRpb25zIGR1cmluZyByZWNvbm5lY3Rpb24sIGlnbm9yZSB0aGUgbWVzc2FnZSBpZlxuICAvLyAnc29ja2V0JyBpcyBub3QgdGhlIGN1cnJlbnRseSBjb25uZWN0ZWQgc29ja2V0LlxuICAvL1xuICAvLyBXZSBydW4gdGhlIG1lc3NhZ2VzIGZyb20gdGhlIGNsaWVudCBvbmUgYXQgYSB0aW1lLCBpbiB0aGUgb3JkZXJcbiAgLy8gZ2l2ZW4gYnkgdGhlIGNsaWVudC4gVGhlIG1lc3NhZ2UgaGFuZGxlciBpcyBwYXNzZWQgYW4gaWRlbXBvdGVudFxuICAvLyBmdW5jdGlvbiAndW5ibG9jaycgd2hpY2ggaXQgbWF5IGNhbGwgdG8gYWxsb3cgb3RoZXIgbWVzc2FnZXMgdG9cbiAgLy8gYmVnaW4gcnVubmluZyBpbiBwYXJhbGxlbCBpbiBhbm90aGVyIGZpYmVyIChmb3IgZXhhbXBsZSwgYSBtZXRob2RcbiAgLy8gdGhhdCB3YW50cyB0byB5aWVsZCkuIE90aGVyd2lzZSwgaXQgaXMgYXV0b21hdGljYWxseSB1bmJsb2NrZWRcbiAgLy8gd2hlbiBpdCByZXR1cm5zLlxuICAvL1xuICAvLyBBY3R1YWxseSwgd2UgZG9uJ3QgaGF2ZSB0byAndG90YWxseSBvcmRlcicgdGhlIG1lc3NhZ2VzIGluIHRoaXNcbiAgLy8gd2F5LCBidXQgaXQncyB0aGUgZWFzaWVzdCB0aGluZyB0aGF0J3MgY29ycmVjdC4gKHVuc3ViIG5lZWRzIHRvXG4gIC8vIGJlIG9yZGVyZWQgYWdhaW5zdCBzdWIsIG1ldGhvZHMgbmVlZCB0byBiZSBvcmRlcmVkIGFnYWluc3QgZWFjaFxuICAvLyBvdGhlcikuXG4gIHByb2Nlc3NNZXNzYWdlOiBmdW5jdGlvbiAobXNnX2luKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5pblF1ZXVlKSAvLyB3ZSBoYXZlIGJlZW4gZGVzdHJveWVkLlxuICAgICAgcmV0dXJuO1xuXG4gICAgLy8gUmVzcG9uZCB0byBwaW5nIGFuZCBwb25nIG1lc3NhZ2VzIGltbWVkaWF0ZWx5IHdpdGhvdXQgcXVldWluZy5cbiAgICAvLyBJZiB0aGUgbmVnb3RpYXRlZCBERFAgdmVyc2lvbiBpcyBcInByZTFcIiB3aGljaCBkaWRuJ3Qgc3VwcG9ydFxuICAgIC8vIHBpbmdzLCBwcmVzZXJ2ZSB0aGUgXCJwcmUxXCIgYmVoYXZpb3Igb2YgcmVzcG9uZGluZyB3aXRoIGEgXCJiYWRcbiAgICAvLyByZXF1ZXN0XCIgZm9yIHRoZSB1bmtub3duIG1lc3NhZ2VzLlxuICAgIC8vXG4gICAgLy8gRmliZXJzIGFyZSBuZWVkZWQgYmVjYXVzZSBoZWFydGJlYXRzIHVzZSBNZXRlb3Iuc2V0VGltZW91dCwgd2hpY2hcbiAgICAvLyBuZWVkcyBhIEZpYmVyLiBXZSBjb3VsZCBhY3R1YWxseSB1c2UgcmVndWxhciBzZXRUaW1lb3V0IGFuZCBhdm9pZFxuICAgIC8vIHRoZXNlIG5ldyBmaWJlcnMsIGJ1dCBpdCBpcyBlYXNpZXIgdG8ganVzdCBtYWtlIGV2ZXJ5dGhpbmcgdXNlXG4gICAgLy8gTWV0ZW9yLnNldFRpbWVvdXQgYW5kIG5vdCB0aGluayB0b28gaGFyZC5cbiAgICAvL1xuICAgIC8vIEFueSBtZXNzYWdlIGNvdW50cyBhcyByZWNlaXZpbmcgYSBwb25nLCBhcyBpdCBkZW1vbnN0cmF0ZXMgdGhhdFxuICAgIC8vIHRoZSBjbGllbnQgaXMgc3RpbGwgYWxpdmUuXG4gICAgaWYgKHNlbGYuaGVhcnRiZWF0KSB7XG4gICAgICBzZWxmLmhlYXJ0YmVhdC5tZXNzYWdlUmVjZWl2ZWQoKTtcbiAgICB9O1xuXG4gICAgaWYgKHNlbGYudmVyc2lvbiAhPT0gJ3ByZTEnICYmIG1zZ19pbi5tc2cgPT09ICdwaW5nJykge1xuICAgICAgaWYgKHNlbGYuX3Jlc3BvbmRUb1BpbmdzKVxuICAgICAgICBzZWxmLnNlbmQoe21zZzogXCJwb25nXCIsIGlkOiBtc2dfaW4uaWR9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHNlbGYudmVyc2lvbiAhPT0gJ3ByZTEnICYmIG1zZ19pbi5tc2cgPT09ICdwb25nJykge1xuICAgICAgLy8gU2luY2UgZXZlcnl0aGluZyBpcyBhIHBvbmcsIHRoZXJlIGlzIG5vdGhpbmcgdG8gZG9cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZWxmLmluUXVldWUucHVzaChtc2dfaW4pO1xuICAgIGlmIChzZWxmLndvcmtlclJ1bm5pbmcpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi53b3JrZXJSdW5uaW5nID0gdHJ1ZTtcblxuICAgIHZhciBwcm9jZXNzTmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBtc2cgPSBzZWxmLmluUXVldWUgJiYgc2VsZi5pblF1ZXVlLnNoaWZ0KCk7XG5cbiAgICAgIGlmICghbXNnKSB7XG4gICAgICAgIHNlbGYud29ya2VyUnVubmluZyA9IGZhbHNlO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIHJ1bkhhbmRsZXJzKCkge1xuICAgICAgICB2YXIgYmxvY2tlZCA9IHRydWU7XG5cbiAgICAgICAgdmFyIHVuYmxvY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKCFibG9ja2VkKVxuICAgICAgICAgICAgcmV0dXJuOyAvLyBpZGVtcG90ZW50XG4gICAgICAgICAgYmxvY2tlZCA9IGZhbHNlO1xuICAgICAgICAgIHNldEltbWVkaWF0ZShwcm9jZXNzTmV4dCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2VsZi5zZXJ2ZXIub25NZXNzYWdlSG9vay5lYWNoKGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgIGNhbGxiYWNrKG1zZywgc2VsZik7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChtc2cubXNnIGluIHNlbGYucHJvdG9jb2xfaGFuZGxlcnMpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBzZWxmLnByb3RvY29sX2hhbmRsZXJzW21zZy5tc2ddLmNhbGwoXG4gICAgICAgICAgICBzZWxmLFxuICAgICAgICAgICAgbXNnLFxuICAgICAgICAgICAgdW5ibG9ja1xuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpZiAoTWV0ZW9yLl9pc1Byb21pc2UocmVzdWx0KSkge1xuICAgICAgICAgICAgcmVzdWx0LmZpbmFsbHkoKCkgPT4gdW5ibG9jaygpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdW5ibG9jaygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzZWxmLnNlbmRFcnJvcignQmFkIHJlcXVlc3QnLCBtc2cpO1xuICAgICAgICAgIHVuYmxvY2soKTsgLy8gaW4gY2FzZSB0aGUgaGFuZGxlciBkaWRuJ3QgYWxyZWFkeSBkbyBpdFxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJ1bkhhbmRsZXJzKCk7XG4gICAgfTtcblxuICAgIHByb2Nlc3NOZXh0KCk7XG4gIH0sXG5cbiAgcHJvdG9jb2xfaGFuZGxlcnM6IHtcbiAgICBzdWI6IGFzeW5jIGZ1bmN0aW9uIChtc2csIHVuYmxvY2spIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgLy8gY2FjaGVVbmJsb2NrIHRlbXBvcmFybHksIHNvIHdlIGNhbiBjYXB0dXJlIGl0IGxhdGVyXG4gICAgICAvLyB3ZSB3aWxsIHVzZSB1bmJsb2NrIGluIGN1cnJlbnQgZXZlbnRMb29wLCBzbyB0aGlzIGlzIHNhZmVcbiAgICAgIHNlbGYuY2FjaGVkVW5ibG9jayA9IHVuYmxvY2s7XG5cbiAgICAgIC8vIHJlamVjdCBtYWxmb3JtZWQgbWVzc2FnZXNcbiAgICAgIGlmICh0eXBlb2YgKG1zZy5pZCkgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgICAgICB0eXBlb2YgKG1zZy5uYW1lKSAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgICAgICgncGFyYW1zJyBpbiBtc2cgJiYgIShtc2cucGFyYW1zIGluc3RhbmNlb2YgQXJyYXkpKSkge1xuICAgICAgICBzZWxmLnNlbmRFcnJvcihcIk1hbGZvcm1lZCBzdWJzY3JpcHRpb25cIiwgbXNnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXNlbGYuc2VydmVyLnB1Ymxpc2hfaGFuZGxlcnNbbXNnLm5hbWVdKSB7XG4gICAgICAgIHNlbGYuc2VuZCh7XG4gICAgICAgICAgbXNnOiAnbm9zdWInLCBpZDogbXNnLmlkLFxuICAgICAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgYFN1YnNjcmlwdGlvbiAnJHttc2cubmFtZX0nIG5vdCBmb3VuZGApfSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHNlbGYuX25hbWVkU3Vicy5oYXMobXNnLmlkKSlcbiAgICAgICAgLy8gc3VicyBhcmUgaWRlbXBvdGVudCwgb3IgcmF0aGVyLCB0aGV5IGFyZSBpZ25vcmVkIGlmIGEgc3ViXG4gICAgICAgIC8vIHdpdGggdGhhdCBpZCBhbHJlYWR5IGV4aXN0cy4gdGhpcyBpcyBpbXBvcnRhbnQgZHVyaW5nXG4gICAgICAgIC8vIHJlY29ubmVjdC5cbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICAvLyBYWFggSXQnZCBiZSBtdWNoIGJldHRlciBpZiB3ZSBoYWQgZ2VuZXJpYyBob29rcyB3aGVyZSBhbnkgcGFja2FnZSBjYW5cbiAgICAgIC8vIGhvb2sgaW50byBzdWJzY3JpcHRpb24gaGFuZGxpbmcsIGJ1dCBpbiB0aGUgbWVhbiB3aGlsZSB3ZSBzcGVjaWFsIGNhc2VcbiAgICAgIC8vIGRkcC1yYXRlLWxpbWl0ZXIgcGFja2FnZS4gVGhpcyBpcyBhbHNvIGRvbmUgZm9yIHdlYWsgcmVxdWlyZW1lbnRzIHRvXG4gICAgICAvLyBhZGQgdGhlIGRkcC1yYXRlLWxpbWl0ZXIgcGFja2FnZSBpbiBjYXNlIHdlIGRvbid0IGhhdmUgQWNjb3VudHMuIEFcbiAgICAgIC8vIHVzZXIgdHJ5aW5nIHRvIHVzZSB0aGUgZGRwLXJhdGUtbGltaXRlciBtdXN0IGV4cGxpY2l0bHkgcmVxdWlyZSBpdC5cbiAgICAgIGlmIChQYWNrYWdlWydkZHAtcmF0ZS1saW1pdGVyJ10pIHtcbiAgICAgICAgdmFyIEREUFJhdGVMaW1pdGVyID0gUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddLkREUFJhdGVMaW1pdGVyO1xuICAgICAgICB2YXIgcmF0ZUxpbWl0ZXJJbnB1dCA9IHtcbiAgICAgICAgICB1c2VySWQ6IHNlbGYudXNlcklkLFxuICAgICAgICAgIGNsaWVudEFkZHJlc3M6IHNlbGYuY29ubmVjdGlvbkhhbmRsZS5jbGllbnRBZGRyZXNzLFxuICAgICAgICAgIHR5cGU6IFwic3Vic2NyaXB0aW9uXCIsXG4gICAgICAgICAgbmFtZTogbXNnLm5hbWUsXG4gICAgICAgICAgY29ubmVjdGlvbklkOiBzZWxmLmlkXG4gICAgICAgIH07XG5cbiAgICAgICAgRERQUmF0ZUxpbWl0ZXIuX2luY3JlbWVudChyYXRlTGltaXRlcklucHV0KTtcbiAgICAgICAgdmFyIHJhdGVMaW1pdFJlc3VsdCA9IEREUFJhdGVMaW1pdGVyLl9jaGVjayhyYXRlTGltaXRlcklucHV0KTtcbiAgICAgICAgaWYgKCFyYXRlTGltaXRSZXN1bHQuYWxsb3dlZCkge1xuICAgICAgICAgIHNlbGYuc2VuZCh7XG4gICAgICAgICAgICBtc2c6ICdub3N1YicsIGlkOiBtc2cuaWQsXG4gICAgICAgICAgICBlcnJvcjogbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgICAgICAgJ3Rvby1tYW55LXJlcXVlc3RzJyxcbiAgICAgICAgICAgICAgRERQUmF0ZUxpbWl0ZXIuZ2V0RXJyb3JNZXNzYWdlKHJhdGVMaW1pdFJlc3VsdCksXG4gICAgICAgICAgICAgIHt0aW1lVG9SZXNldDogcmF0ZUxpbWl0UmVzdWx0LnRpbWVUb1Jlc2V0fSlcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIGhhbmRsZXIgPSBzZWxmLnNlcnZlci5wdWJsaXNoX2hhbmRsZXJzW21zZy5uYW1lXTtcblxuICAgICAgYXdhaXQgc2VsZi5fc3RhcnRTdWJzY3JpcHRpb24oaGFuZGxlciwgbXNnLmlkLCBtc2cucGFyYW1zLCBtc2cubmFtZSk7XG5cbiAgICAgIC8vIGNsZWFuaW5nIGNhY2hlZCB1bmJsb2NrXG4gICAgICBzZWxmLmNhY2hlZFVuYmxvY2sgPSBudWxsO1xuICAgIH0sXG5cbiAgICB1bnN1YjogZnVuY3Rpb24gKG1zZykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICBzZWxmLl9zdG9wU3Vic2NyaXB0aW9uKG1zZy5pZCk7XG4gICAgfSxcblxuICAgIG1ldGhvZDogYXN5bmMgZnVuY3Rpb24gKG1zZywgdW5ibG9jaykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAvLyBSZWplY3QgbWFsZm9ybWVkIG1lc3NhZ2VzLlxuICAgICAgLy8gRm9yIG5vdywgd2Ugc2lsZW50bHkgaWdub3JlIHVua25vd24gYXR0cmlidXRlcyxcbiAgICAgIC8vIGZvciBmb3J3YXJkcyBjb21wYXRpYmlsaXR5LlxuICAgICAgaWYgKHR5cGVvZiAobXNnLmlkKSAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgICAgIHR5cGVvZiAobXNnLm1ldGhvZCkgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgICAgICAoJ3BhcmFtcycgaW4gbXNnICYmICEobXNnLnBhcmFtcyBpbnN0YW5jZW9mIEFycmF5KSkgfHxcbiAgICAgICAgICAoKCdyYW5kb21TZWVkJyBpbiBtc2cpICYmICh0eXBlb2YgbXNnLnJhbmRvbVNlZWQgIT09IFwic3RyaW5nXCIpKSkge1xuICAgICAgICBzZWxmLnNlbmRFcnJvcihcIk1hbGZvcm1lZCBtZXRob2QgaW52b2NhdGlvblwiLCBtc2cpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciByYW5kb21TZWVkID0gbXNnLnJhbmRvbVNlZWQgfHwgbnVsbDtcblxuICAgICAgLy8gU2V0IHVwIHRvIG1hcmsgdGhlIG1ldGhvZCBhcyBzYXRpc2ZpZWQgb25jZSBhbGwgb2JzZXJ2ZXJzXG4gICAgICAvLyAoYW5kIHN1YnNjcmlwdGlvbnMpIGhhdmUgcmVhY3RlZCB0byBhbnkgd3JpdGVzIHRoYXQgd2VyZVxuICAgICAgLy8gZG9uZS5cbiAgICAgIHZhciBmZW5jZSA9IG5ldyBERFBTZXJ2ZXIuX1dyaXRlRmVuY2U7XG4gICAgICBmZW5jZS5vbkFsbENvbW1pdHRlZChmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFJldGlyZSB0aGUgZmVuY2Ugc28gdGhhdCBmdXR1cmUgd3JpdGVzIGFyZSBhbGxvd2VkLlxuICAgICAgICAvLyBUaGlzIG1lYW5zIHRoYXQgY2FsbGJhY2tzIGxpa2UgdGltZXJzIGFyZSBmcmVlIHRvIHVzZVxuICAgICAgICAvLyB0aGUgZmVuY2UsIGFuZCBpZiB0aGV5IGZpcmUgYmVmb3JlIGl0J3MgYXJtZWQgKGZvclxuICAgICAgICAvLyBleGFtcGxlLCBiZWNhdXNlIHRoZSBtZXRob2Qgd2FpdHMgZm9yIHRoZW0pIHRoZWlyXG4gICAgICAgIC8vIHdyaXRlcyB3aWxsIGJlIGluY2x1ZGVkIGluIHRoZSBmZW5jZS5cbiAgICAgICAgZmVuY2UucmV0aXJlKCk7XG4gICAgICAgIHNlbGYuc2VuZCh7bXNnOiAndXBkYXRlZCcsIG1ldGhvZHM6IFttc2cuaWRdfSk7XG4gICAgICB9KTtcblxuICAgICAgLy8gRmluZCB0aGUgaGFuZGxlclxuICAgICAgdmFyIGhhbmRsZXIgPSBzZWxmLnNlcnZlci5tZXRob2RfaGFuZGxlcnNbbXNnLm1ldGhvZF07XG4gICAgICBpZiAoIWhhbmRsZXIpIHtcbiAgICAgICAgc2VsZi5zZW5kKHtcbiAgICAgICAgICBtc2c6ICdyZXN1bHQnLCBpZDogbXNnLmlkLFxuICAgICAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgYE1ldGhvZCAnJHttc2cubWV0aG9kfScgbm90IGZvdW5kYCl9KTtcbiAgICAgICAgYXdhaXQgZmVuY2UuYXJtKCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIGludm9jYXRpb24gPSBuZXcgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb24oe1xuICAgICAgICBuYW1lOiBtc2cubWV0aG9kLFxuICAgICAgICBpc1NpbXVsYXRpb246IGZhbHNlLFxuICAgICAgICB1c2VySWQ6IHNlbGYudXNlcklkLFxuICAgICAgICBzZXRVc2VySWQodXNlcklkKSB7XG4gICAgICAgICAgcmV0dXJuIHNlbGYuX3NldFVzZXJJZCh1c2VySWQpO1xuICAgICAgICB9LFxuICAgICAgICB1bmJsb2NrOiB1bmJsb2NrLFxuICAgICAgICBjb25uZWN0aW9uOiBzZWxmLmNvbm5lY3Rpb25IYW5kbGUsXG4gICAgICAgIHJhbmRvbVNlZWQ6IHJhbmRvbVNlZWQsXG4gICAgICAgIGZlbmNlLFxuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vIFhYWCBJdCdkIGJlIGJldHRlciBpZiB3ZSBjb3VsZCBob29rIGludG8gbWV0aG9kIGhhbmRsZXJzIGJldHRlciBidXRcbiAgICAgICAgLy8gZm9yIG5vdywgd2UgbmVlZCB0byBjaGVjayBpZiB0aGUgZGRwLXJhdGUtbGltaXRlciBleGlzdHMgc2luY2Ugd2VcbiAgICAgICAgLy8gaGF2ZSBhIHdlYWsgcmVxdWlyZW1lbnQgZm9yIHRoZSBkZHAtcmF0ZS1saW1pdGVyIHBhY2thZ2UgdG8gYmUgYWRkZWRcbiAgICAgICAgLy8gdG8gb3VyIGFwcGxpY2F0aW9uLlxuICAgICAgICBpZiAoUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddKSB7XG4gICAgICAgICAgdmFyIEREUFJhdGVMaW1pdGVyID0gUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddLkREUFJhdGVMaW1pdGVyO1xuICAgICAgICAgIHZhciByYXRlTGltaXRlcklucHV0ID0ge1xuICAgICAgICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCxcbiAgICAgICAgICAgIGNsaWVudEFkZHJlc3M6IHNlbGYuY29ubmVjdGlvbkhhbmRsZS5jbGllbnRBZGRyZXNzLFxuICAgICAgICAgICAgdHlwZTogXCJtZXRob2RcIixcbiAgICAgICAgICAgIG5hbWU6IG1zZy5tZXRob2QsXG4gICAgICAgICAgICBjb25uZWN0aW9uSWQ6IHNlbGYuaWRcbiAgICAgICAgICB9O1xuICAgICAgICAgIEREUFJhdGVMaW1pdGVyLl9pbmNyZW1lbnQocmF0ZUxpbWl0ZXJJbnB1dCk7XG4gICAgICAgICAgdmFyIHJhdGVMaW1pdFJlc3VsdCA9IEREUFJhdGVMaW1pdGVyLl9jaGVjayhyYXRlTGltaXRlcklucHV0KVxuICAgICAgICAgIGlmICghcmF0ZUxpbWl0UmVzdWx0LmFsbG93ZWQpIHtcbiAgICAgICAgICAgIHJlamVjdChuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgICAgICBcInRvby1tYW55LXJlcXVlc3RzXCIsXG4gICAgICAgICAgICAgIEREUFJhdGVMaW1pdGVyLmdldEVycm9yTWVzc2FnZShyYXRlTGltaXRSZXN1bHQpLFxuICAgICAgICAgICAgICB7dGltZVRvUmVzZXQ6IHJhdGVMaW1pdFJlc3VsdC50aW1lVG9SZXNldH1cbiAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlc29sdmUoRERQU2VydmVyLl9DdXJyZW50V3JpdGVGZW5jZS53aXRoVmFsdWUoXG4gICAgICAgICAgZmVuY2UsXG4gICAgICAgICAgKCkgPT4gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi53aXRoVmFsdWUoXG4gICAgICAgICAgICBpbnZvY2F0aW9uLFxuICAgICAgICAgICAgKCkgPT4gbWF5YmVBdWRpdEFyZ3VtZW50Q2hlY2tzKFxuICAgICAgICAgICAgICBoYW5kbGVyLCBpbnZvY2F0aW9uLCBtc2cucGFyYW1zLFxuICAgICAgICAgICAgICBcImNhbGwgdG8gJ1wiICsgbXNnLm1ldGhvZCArIFwiJ1wiXG4gICAgICAgICAgICApXG4gICAgICAgICAgKVxuICAgICAgICApKTtcbiAgICAgIH0pO1xuXG4gICAgICBhc3luYyBmdW5jdGlvbiBmaW5pc2goKSB7XG4gICAgICAgIGF3YWl0IGZlbmNlLmFybSgpO1xuICAgICAgICB1bmJsb2NrKCk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHBheWxvYWQgPSB7XG4gICAgICAgIG1zZzogXCJyZXN1bHRcIixcbiAgICAgICAgaWQ6IG1zZy5pZFxuICAgICAgfTtcbiAgICAgIHJldHVybiBwcm9taXNlLnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcbiAgICAgICAgYXdhaXQgZmluaXNoKCk7XG4gICAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHBheWxvYWQucmVzdWx0ID0gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuc2VuZChwYXlsb2FkKTtcbiAgICAgIH0sIGFzeW5jIChleGNlcHRpb24pID0+IHtcbiAgICAgICAgYXdhaXQgZmluaXNoKCk7XG4gICAgICAgIHBheWxvYWQuZXJyb3IgPSB3cmFwSW50ZXJuYWxFeGNlcHRpb24oXG4gICAgICAgICAgZXhjZXB0aW9uLFxuICAgICAgICAgIGB3aGlsZSBpbnZva2luZyBtZXRob2QgJyR7bXNnLm1ldGhvZH0nYFxuICAgICAgICApO1xuICAgICAgICBzZWxmLnNlbmQocGF5bG9hZCk7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sXG5cbiAgX2VhY2hTdWI6IGZ1bmN0aW9uIChmKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuX25hbWVkU3Vicy5mb3JFYWNoKGYpO1xuICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMuZm9yRWFjaChmKTtcbiAgfSxcblxuICBfZGlmZkNvbGxlY3Rpb25WaWV3czogZnVuY3Rpb24gKGJlZm9yZUNWcykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBEaWZmU2VxdWVuY2UuZGlmZk1hcHMoYmVmb3JlQ1ZzLCBzZWxmLmNvbGxlY3Rpb25WaWV3cywge1xuICAgICAgYm90aDogZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBsZWZ0VmFsdWUsIHJpZ2h0VmFsdWUpIHtcbiAgICAgICAgcmlnaHRWYWx1ZS5kaWZmKGxlZnRWYWx1ZSk7XG4gICAgICB9LFxuICAgICAgcmlnaHRPbmx5OiBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHJpZ2h0VmFsdWUpIHtcbiAgICAgICAgcmlnaHRWYWx1ZS5kb2N1bWVudHMuZm9yRWFjaChmdW5jdGlvbiAoZG9jVmlldywgaWQpIHtcbiAgICAgICAgICBzZWxmLnNlbmRBZGRlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGRvY1ZpZXcuZ2V0RmllbGRzKCkpO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBsZWZ0VmFsdWUpIHtcbiAgICAgICAgbGVmdFZhbHVlLmRvY3VtZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgICAgc2VsZi5zZW5kUmVtb3ZlZChjb2xsZWN0aW9uTmFtZSwgaWQpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICAvLyBTZXRzIHRoZSBjdXJyZW50IHVzZXIgaWQgaW4gYWxsIGFwcHJvcHJpYXRlIGNvbnRleHRzIGFuZCByZXJ1bnNcbiAgLy8gYWxsIHN1YnNjcmlwdGlvbnNcbiAgYXN5bmMgX3NldFVzZXJJZCh1c2VySWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAodXNlcklkICE9PSBudWxsICYmIHR5cGVvZiB1c2VySWQgIT09IFwic3RyaW5nXCIpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzZXRVc2VySWQgbXVzdCBiZSBjYWxsZWQgb24gc3RyaW5nIG9yIG51bGwsIG5vdCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgdHlwZW9mIHVzZXJJZCk7XG5cbiAgICAvLyBQcmV2ZW50IG5ld2x5LWNyZWF0ZWQgdW5pdmVyc2FsIHN1YnNjcmlwdGlvbnMgZnJvbSBiZWluZyBhZGRlZCB0byBvdXJcbiAgICAvLyBzZXNzaW9uLiBUaGV5IHdpbGwgYmUgZm91bmQgYmVsb3cgd2hlbiB3ZSBjYWxsIHN0YXJ0VW5pdmVyc2FsU3Vicy5cbiAgICAvL1xuICAgIC8vIChXZSBkb24ndCBoYXZlIHRvIHdvcnJ5IGFib3V0IG5hbWVkIHN1YnNjcmlwdGlvbnMsIGJlY2F1c2Ugd2Ugb25seSBhZGRcbiAgICAvLyB0aGVtIHdoZW4gd2UgcHJvY2VzcyBhICdzdWInIG1lc3NhZ2UuIFdlIGFyZSBjdXJyZW50bHkgcHJvY2Vzc2luZyBhXG4gICAgLy8gJ21ldGhvZCcgbWVzc2FnZSwgYW5kIHRoZSBtZXRob2QgZGlkIG5vdCB1bmJsb2NrLCBiZWNhdXNlIGl0IGlzIGlsbGVnYWxcbiAgICAvLyB0byBjYWxsIHNldFVzZXJJZCBhZnRlciB1bmJsb2NrLiBUaHVzIHdlIGNhbm5vdCBiZSBjb25jdXJyZW50bHkgYWRkaW5nIGFcbiAgICAvLyBuZXcgbmFtZWQgc3Vic2NyaXB0aW9uKS5cbiAgICBzZWxmLl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzID0gdHJ1ZTtcblxuICAgIC8vIFByZXZlbnQgY3VycmVudCBzdWJzIGZyb20gdXBkYXRpbmcgb3VyIGNvbGxlY3Rpb25WaWV3cyBhbmQgY2FsbCB0aGVpclxuICAgIC8vIHN0b3AgY2FsbGJhY2tzLiBUaGlzIG1heSB5aWVsZC5cbiAgICBzZWxmLl9lYWNoU3ViKGZ1bmN0aW9uIChzdWIpIHtcbiAgICAgIHN1Yi5fZGVhY3RpdmF0ZSgpO1xuICAgIH0pO1xuXG4gICAgLy8gQWxsIHN1YnMgc2hvdWxkIG5vdyBiZSBkZWFjdGl2YXRlZC4gU3RvcCBzZW5kaW5nIG1lc3NhZ2VzIHRvIHRoZSBjbGllbnQsXG4gICAgLy8gc2F2ZSB0aGUgc3RhdGUgb2YgdGhlIHB1Ymxpc2hlZCBjb2xsZWN0aW9ucywgcmVzZXQgdG8gYW4gZW1wdHkgdmlldywgYW5kXG4gICAgLy8gdXBkYXRlIHRoZSB1c2VySWQuXG4gICAgc2VsZi5faXNTZW5kaW5nID0gZmFsc2U7XG4gICAgdmFyIGJlZm9yZUNWcyA9IHNlbGYuY29sbGVjdGlvblZpZXdzO1xuICAgIHNlbGYuY29sbGVjdGlvblZpZXdzID0gbmV3IE1hcCgpO1xuICAgIHNlbGYudXNlcklkID0gdXNlcklkO1xuXG4gICAgLy8gX3NldFVzZXJJZCBpcyBub3JtYWxseSBjYWxsZWQgZnJvbSBhIE1ldGVvciBtZXRob2Qgd2l0aFxuICAgIC8vIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24gc2V0LiBCdXQgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiBpcyBub3RcbiAgICAvLyBleHBlY3RlZCB0byBiZSBzZXQgaW5zaWRlIGEgcHVibGlzaCBmdW5jdGlvbiwgc28gd2UgdGVtcG9yYXJ5IHVuc2V0IGl0LlxuICAgIC8vIEluc2lkZSBhIHB1Ymxpc2ggZnVuY3Rpb24gRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIGlzIHNldC5cbiAgICBhd2FpdCBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLndpdGhWYWx1ZSh1bmRlZmluZWQsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIFNhdmUgdGhlIG9sZCBuYW1lZCBzdWJzLCBhbmQgcmVzZXQgdG8gaGF2aW5nIG5vIHN1YnNjcmlwdGlvbnMuXG4gICAgICB2YXIgb2xkTmFtZWRTdWJzID0gc2VsZi5fbmFtZWRTdWJzO1xuICAgICAgc2VsZi5fbmFtZWRTdWJzID0gbmV3IE1hcCgpO1xuICAgICAgc2VsZi5fdW5pdmVyc2FsU3VicyA9IFtdO1xuXG5cblxuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoWy4uLm9sZE5hbWVkU3Vic10ubWFwKGFzeW5jIChbc3Vic2NyaXB0aW9uSWQsIHN1Yl0pID0+IHtcbiAgICAgICAgY29uc3QgbmV3U3ViID0gc3ViLl9yZWNyZWF0ZSgpO1xuICAgICAgICBzZWxmLl9uYW1lZFN1YnMuc2V0KHN1YnNjcmlwdGlvbklkLCBuZXdTdWIpO1xuICAgICAgICAvLyBuYjogaWYgdGhlIGhhbmRsZXIgdGhyb3dzIG9yIGNhbGxzIHRoaXMuZXJyb3IoKSwgaXQgd2lsbCBpbiBmYWN0XG4gICAgICAgIC8vIGltbWVkaWF0ZWx5IHNlbmQgaXRzICdub3N1YicuIFRoaXMgaXMgT0ssIHRob3VnaC5cbiAgICAgICAgYXdhaXQgbmV3U3ViLl9ydW5IYW5kbGVyKCk7XG4gICAgICB9KSk7XG5cbiAgICAgIC8vIEFsbG93IG5ld2x5LWNyZWF0ZWQgdW5pdmVyc2FsIHN1YnMgdG8gYmUgc3RhcnRlZCBvbiBvdXIgY29ubmVjdGlvbiBpblxuICAgICAgLy8gcGFyYWxsZWwgd2l0aCB0aGUgb25lcyB3ZSdyZSBzcGlubmluZyB1cCBoZXJlLCBhbmQgc3BpbiB1cCB1bml2ZXJzYWxcbiAgICAgIC8vIHN1YnMuXG4gICAgICBzZWxmLl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzID0gZmFsc2U7XG4gICAgICBzZWxmLnN0YXJ0VW5pdmVyc2FsU3VicygpO1xuICAgIH0sIHsgbmFtZTogJ19zZXRVc2VySWQnIH0pO1xuXG4gICAgLy8gU3RhcnQgc2VuZGluZyBtZXNzYWdlcyBhZ2FpbiwgYmVnaW5uaW5nIHdpdGggdGhlIGRpZmYgZnJvbSB0aGUgcHJldmlvdXNcbiAgICAvLyBzdGF0ZSBvZiB0aGUgd29ybGQgdG8gdGhlIGN1cnJlbnQgc3RhdGUuIE5vIHlpZWxkcyBhcmUgYWxsb3dlZCBkdXJpbmdcbiAgICAvLyB0aGlzIGRpZmYsIHNvIHRoYXQgb3RoZXIgY2hhbmdlcyBjYW5ub3QgaW50ZXJsZWF2ZS5cbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9pc1NlbmRpbmcgPSB0cnVlO1xuICAgICAgc2VsZi5fZGlmZkNvbGxlY3Rpb25WaWV3cyhiZWZvcmVDVnMpO1xuICAgICAgaWYgKCFpc0VtcHR5KHNlbGYuX3BlbmRpbmdSZWFkeSkpIHtcbiAgICAgICAgc2VsZi5zZW5kUmVhZHkoc2VsZi5fcGVuZGluZ1JlYWR5KTtcbiAgICAgICAgc2VsZi5fcGVuZGluZ1JlYWR5ID0gW107XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgX3N0YXJ0U3Vic2NyaXB0aW9uOiBmdW5jdGlvbiAoaGFuZGxlciwgc3ViSWQsIHBhcmFtcywgbmFtZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBzdWIgPSBuZXcgU3Vic2NyaXB0aW9uKFxuICAgICAgc2VsZiwgaGFuZGxlciwgc3ViSWQsIHBhcmFtcywgbmFtZSk7XG5cbiAgICBsZXQgdW5ibG9ja0hhbmRlciA9IHNlbGYuY2FjaGVkVW5ibG9jaztcbiAgICAvLyBfc3RhcnRTdWJzY3JpcHRpb24gbWF5IGNhbGwgZnJvbSBhIGxvdCBwbGFjZXNcbiAgICAvLyBzbyBjYWNoZWRVbmJsb2NrIG1pZ2h0IGJlIG51bGwgaW4gc29tZWNhc2VzXG4gICAgLy8gYXNzaWduIHRoZSBjYWNoZWRVbmJsb2NrXG4gICAgc3ViLnVuYmxvY2sgPSB1bmJsb2NrSGFuZGVyIHx8ICgoKSA9PiB7fSk7XG5cbiAgICBpZiAoc3ViSWQpXG4gICAgICBzZWxmLl9uYW1lZFN1YnMuc2V0KHN1YklkLCBzdWIpO1xuICAgIGVsc2VcbiAgICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMucHVzaChzdWIpO1xuXG4gICAgcmV0dXJuIHN1Yi5fcnVuSGFuZGxlcigpO1xuICB9LFxuXG4gIC8vIFRlYXIgZG93biBzcGVjaWZpZWQgc3Vic2NyaXB0aW9uXG4gIF9zdG9wU3Vic2NyaXB0aW9uOiBmdW5jdGlvbiAoc3ViSWQsIGVycm9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIHN1Yk5hbWUgPSBudWxsO1xuICAgIGlmIChzdWJJZCkge1xuICAgICAgdmFyIG1heWJlU3ViID0gc2VsZi5fbmFtZWRTdWJzLmdldChzdWJJZCk7XG4gICAgICBpZiAobWF5YmVTdWIpIHtcbiAgICAgICAgc3ViTmFtZSA9IG1heWJlU3ViLl9uYW1lO1xuICAgICAgICBtYXliZVN1Yi5fcmVtb3ZlQWxsRG9jdW1lbnRzKCk7XG4gICAgICAgIG1heWJlU3ViLl9kZWFjdGl2YXRlKCk7XG4gICAgICAgIHNlbGYuX25hbWVkU3Vicy5kZWxldGUoc3ViSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciByZXNwb25zZSA9IHttc2c6ICdub3N1YicsIGlkOiBzdWJJZH07XG5cbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIHJlc3BvbnNlLmVycm9yID0gd3JhcEludGVybmFsRXhjZXB0aW9uKFxuICAgICAgICBlcnJvcixcbiAgICAgICAgc3ViTmFtZSA/IChcImZyb20gc3ViIFwiICsgc3ViTmFtZSArIFwiIGlkIFwiICsgc3ViSWQpXG4gICAgICAgICAgOiAoXCJmcm9tIHN1YiBpZCBcIiArIHN1YklkKSk7XG4gICAgfVxuXG4gICAgc2VsZi5zZW5kKHJlc3BvbnNlKTtcbiAgfSxcblxuICAvLyBUZWFyIGRvd24gYWxsIHN1YnNjcmlwdGlvbnMuIE5vdGUgdGhhdCB0aGlzIGRvZXMgTk9UIHNlbmQgcmVtb3ZlZCBvciBub3N1YlxuICAvLyBtZXNzYWdlcywgc2luY2Ugd2UgYXNzdW1lIHRoZSBjbGllbnQgaXMgZ29uZS5cbiAgX2RlYWN0aXZhdGVBbGxTdWJzY3JpcHRpb25zOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgc2VsZi5fbmFtZWRTdWJzLmZvckVhY2goZnVuY3Rpb24gKHN1YiwgaWQpIHtcbiAgICAgIHN1Yi5fZGVhY3RpdmF0ZSgpO1xuICAgIH0pO1xuICAgIHNlbGYuX25hbWVkU3VicyA9IG5ldyBNYXAoKTtcblxuICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMuZm9yRWFjaChmdW5jdGlvbiAoc3ViKSB7XG4gICAgICBzdWIuX2RlYWN0aXZhdGUoKTtcbiAgICB9KTtcbiAgICBzZWxmLl91bml2ZXJzYWxTdWJzID0gW107XG4gIH0sXG5cbiAgLy8gRGV0ZXJtaW5lIHRoZSByZW1vdGUgY2xpZW50J3MgSVAgYWRkcmVzcywgYmFzZWQgb24gdGhlXG4gIC8vIEhUVFBfRk9SV0FSREVEX0NPVU5UIGVudmlyb25tZW50IHZhcmlhYmxlIHJlcHJlc2VudGluZyBob3cgbWFueVxuICAvLyBwcm94aWVzIHRoZSBzZXJ2ZXIgaXMgYmVoaW5kLlxuICBfY2xpZW50QWRkcmVzczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIEZvciB0aGUgcmVwb3J0ZWQgY2xpZW50IGFkZHJlc3MgZm9yIGEgY29ubmVjdGlvbiB0byBiZSBjb3JyZWN0LFxuICAgIC8vIHRoZSBkZXZlbG9wZXIgbXVzdCBzZXQgdGhlIEhUVFBfRk9SV0FSREVEX0NPVU5UIGVudmlyb25tZW50XG4gICAgLy8gdmFyaWFibGUgdG8gYW4gaW50ZWdlciByZXByZXNlbnRpbmcgdGhlIG51bWJlciBvZiBob3BzIHRoZXlcbiAgICAvLyBleHBlY3QgaW4gdGhlIGB4LWZvcndhcmRlZC1mb3JgIGhlYWRlci4gRS5nLiwgc2V0IHRvIFwiMVwiIGlmIHRoZVxuICAgIC8vIHNlcnZlciBpcyBiZWhpbmQgb25lIHByb3h5LlxuICAgIC8vXG4gICAgLy8gVGhpcyBjb3VsZCBiZSBjb21wdXRlZCBvbmNlIGF0IHN0YXJ0dXAgaW5zdGVhZCBvZiBldmVyeSB0aW1lLlxuICAgIHZhciBodHRwRm9yd2FyZGVkQ291bnQgPSBwYXJzZUludChwcm9jZXNzLmVudlsnSFRUUF9GT1JXQVJERURfQ09VTlQnXSkgfHwgMDtcblxuICAgIGlmIChodHRwRm9yd2FyZGVkQ291bnQgPT09IDApXG4gICAgICByZXR1cm4gc2VsZi5zb2NrZXQucmVtb3RlQWRkcmVzcztcblxuICAgIHZhciBmb3J3YXJkZWRGb3IgPSBzZWxmLnNvY2tldC5oZWFkZXJzW1wieC1mb3J3YXJkZWQtZm9yXCJdO1xuICAgIGlmICghaXNTdHJpbmcoZm9yd2FyZGVkRm9yKSlcbiAgICAgIHJldHVybiBudWxsO1xuICAgIGZvcndhcmRlZEZvciA9IGZvcndhcmRlZEZvci5zcGxpdCgnLCcpXG5cbiAgICAvLyBUeXBpY2FsbHkgdGhlIGZpcnN0IHZhbHVlIGluIHRoZSBgeC1mb3J3YXJkZWQtZm9yYCBoZWFkZXIgaXNcbiAgICAvLyB0aGUgb3JpZ2luYWwgSVAgYWRkcmVzcyBvZiB0aGUgY2xpZW50IGNvbm5lY3RpbmcgdG8gdGhlIGZpcnN0XG4gICAgLy8gcHJveHkuICBIb3dldmVyLCB0aGUgZW5kIHVzZXIgY2FuIGVhc2lseSBzcG9vZiB0aGUgaGVhZGVyLCBpblxuICAgIC8vIHdoaWNoIGNhc2UgdGhlIGZpcnN0IHZhbHVlKHMpIHdpbGwgYmUgdGhlIGZha2UgSVAgYWRkcmVzcyBmcm9tXG4gICAgLy8gdGhlIHVzZXIgcHJldGVuZGluZyB0byBiZSBhIHByb3h5IHJlcG9ydGluZyB0aGUgb3JpZ2luYWwgSVBcbiAgICAvLyBhZGRyZXNzIHZhbHVlLiAgQnkgY291bnRpbmcgSFRUUF9GT1JXQVJERURfQ09VTlQgYmFjayBmcm9tIHRoZVxuICAgIC8vIGVuZCBvZiB0aGUgbGlzdCwgd2UgZW5zdXJlIHRoYXQgd2UgZ2V0IHRoZSBJUCBhZGRyZXNzIGJlaW5nXG4gICAgLy8gcmVwb3J0ZWQgYnkgKm91ciogZmlyc3QgcHJveHkuXG5cbiAgICBpZiAoaHR0cEZvcndhcmRlZENvdW50IDwgMCB8fCBodHRwRm9yd2FyZGVkQ291bnQgIT09IGZvcndhcmRlZEZvci5sZW5ndGgpXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICBmb3J3YXJkZWRGb3IgPSBmb3J3YXJkZWRGb3IubWFwKChpcCkgPT4gaXAudHJpbSgpKTtcbiAgICByZXR1cm4gZm9yd2FyZGVkRm9yW2ZvcndhcmRlZEZvci5sZW5ndGggLSBodHRwRm9yd2FyZGVkQ291bnRdO1xuICB9XG59KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qIFN1YnNjcmlwdGlvbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4vLyBDdG9yIGZvciBhIHN1YiBoYW5kbGU6IHRoZSBpbnB1dCB0byBlYWNoIHB1Ymxpc2ggZnVuY3Rpb25cblxuLy8gSW5zdGFuY2UgbmFtZSBpcyB0aGlzIGJlY2F1c2UgaXQncyB1c3VhbGx5IHJlZmVycmVkIHRvIGFzIHRoaXMgaW5zaWRlIGFcbi8vIHB1Ymxpc2hcbi8qKlxuICogQHN1bW1hcnkgVGhlIHNlcnZlcidzIHNpZGUgb2YgYSBzdWJzY3JpcHRpb25cbiAqIEBjbGFzcyBTdWJzY3JpcHRpb25cbiAqIEBpbnN0YW5jZU5hbWUgdGhpc1xuICogQHNob3dJbnN0YW5jZU5hbWUgdHJ1ZVxuICovXG52YXIgU3Vic2NyaXB0aW9uID0gZnVuY3Rpb24gKFxuICAgIHNlc3Npb24sIGhhbmRsZXIsIHN1YnNjcmlwdGlvbklkLCBwYXJhbXMsIG5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLl9zZXNzaW9uID0gc2Vzc2lvbjsgLy8gdHlwZSBpcyBTZXNzaW9uXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFjY2VzcyBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uIFRoZSBpbmNvbWluZyBbY29ubmVjdGlvbl0oI21ldGVvcl9vbmNvbm5lY3Rpb24pIGZvciB0aGlzIHN1YnNjcmlwdGlvbi5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbmFtZSAgY29ubmVjdGlvblxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgc2VsZi5jb25uZWN0aW9uID0gc2Vzc2lvbi5jb25uZWN0aW9uSGFuZGxlOyAvLyBwdWJsaWMgQVBJIG9iamVjdFxuXG4gIHNlbGYuX2hhbmRsZXIgPSBoYW5kbGVyO1xuXG4gIC8vIE15IHN1YnNjcmlwdGlvbiBJRCAoZ2VuZXJhdGVkIGJ5IGNsaWVudCwgdW5kZWZpbmVkIGZvciB1bml2ZXJzYWwgc3VicykuXG4gIHNlbGYuX3N1YnNjcmlwdGlvbklkID0gc3Vic2NyaXB0aW9uSWQ7XG4gIC8vIFVuZGVmaW5lZCBmb3IgdW5pdmVyc2FsIHN1YnNcbiAgc2VsZi5fbmFtZSA9IG5hbWU7XG5cbiAgc2VsZi5fcGFyYW1zID0gcGFyYW1zIHx8IFtdO1xuXG4gIC8vIE9ubHkgbmFtZWQgc3Vic2NyaXB0aW9ucyBoYXZlIElEcywgYnV0IHdlIG5lZWQgc29tZSBzb3J0IG9mIHN0cmluZ1xuICAvLyBpbnRlcm5hbGx5IHRvIGtlZXAgdHJhY2sgb2YgYWxsIHN1YnNjcmlwdGlvbnMgaW5zaWRlXG4gIC8vIFNlc3Npb25Eb2N1bWVudFZpZXdzLiBXZSB1c2UgdGhpcyBzdWJzY3JpcHRpb25IYW5kbGUgZm9yIHRoYXQuXG4gIGlmIChzZWxmLl9zdWJzY3JpcHRpb25JZCkge1xuICAgIHNlbGYuX3N1YnNjcmlwdGlvbkhhbmRsZSA9ICdOJyArIHNlbGYuX3N1YnNjcmlwdGlvbklkO1xuICB9IGVsc2Uge1xuICAgIHNlbGYuX3N1YnNjcmlwdGlvbkhhbmRsZSA9ICdVJyArIFJhbmRvbS5pZCgpO1xuICB9XG5cbiAgLy8gSGFzIF9kZWFjdGl2YXRlIGJlZW4gY2FsbGVkP1xuICBzZWxmLl9kZWFjdGl2YXRlZCA9IGZhbHNlO1xuXG4gIC8vIFN0b3AgY2FsbGJhY2tzIHRvIGcvYyB0aGlzIHN1Yi4gIGNhbGxlZCB3LyB6ZXJvIGFyZ3VtZW50cy5cbiAgc2VsZi5fc3RvcENhbGxiYWNrcyA9IFtdO1xuXG4gIC8vIFRoZSBzZXQgb2YgKGNvbGxlY3Rpb24sIGRvY3VtZW50aWQpIHRoYXQgdGhpcyBzdWJzY3JpcHRpb24gaGFzXG4gIC8vIGFuIG9waW5pb24gYWJvdXQuXG4gIHNlbGYuX2RvY3VtZW50cyA9IG5ldyBNYXAoKTtcblxuICAvLyBSZW1lbWJlciBpZiB3ZSBhcmUgcmVhZHkuXG4gIHNlbGYuX3JlYWR5ID0gZmFsc2U7XG5cbiAgLy8gUGFydCBvZiB0aGUgcHVibGljIEFQSTogdGhlIHVzZXIgb2YgdGhpcyBzdWIuXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFjY2VzcyBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uIFRoZSBpZCBvZiB0aGUgbG9nZ2VkLWluIHVzZXIsIG9yIGBudWxsYCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbi5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBuYW1lICB1c2VySWRcbiAgICogQGluc3RhbmNlXG4gICAqL1xuICBzZWxmLnVzZXJJZCA9IHNlc3Npb24udXNlcklkO1xuXG4gIC8vIEZvciBub3csIHRoZSBpZCBmaWx0ZXIgaXMgZ29pbmcgdG8gZGVmYXVsdCB0b1xuICAvLyB0aGUgdG8vZnJvbSBERFAgbWV0aG9kcyBvbiBNb25nb0lELCB0b1xuICAvLyBzcGVjaWZpY2FsbHkgZGVhbCB3aXRoIG1vbmdvL21pbmltb25nbyBPYmplY3RJZHMuXG5cbiAgLy8gTGF0ZXIsIHlvdSB3aWxsIGJlIGFibGUgdG8gbWFrZSB0aGlzIGJlIFwicmF3XCJcbiAgLy8gaWYgeW91IHdhbnQgdG8gcHVibGlzaCBhIGNvbGxlY3Rpb24gdGhhdCB5b3Uga25vd1xuICAvLyBqdXN0IGhhcyBzdHJpbmdzIGZvciBrZXlzIGFuZCBubyBmdW5ueSBidXNpbmVzcywgdG9cbiAgLy8gYSBERFAgY29uc3VtZXIgdGhhdCBpc24ndCBtaW5pbW9uZ28uXG5cbiAgc2VsZi5faWRGaWx0ZXIgPSB7XG4gICAgaWRTdHJpbmdpZnk6IE1vbmdvSUQuaWRTdHJpbmdpZnksXG4gICAgaWRQYXJzZTogTW9uZ29JRC5pZFBhcnNlXG4gIH07XG5cbiAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgIFwibGl2ZWRhdGFcIiwgXCJzdWJzY3JpcHRpb25zXCIsIDEpO1xufTtcblxuT2JqZWN0LmFzc2lnbihTdWJzY3JpcHRpb24ucHJvdG90eXBlLCB7XG4gIF9ydW5IYW5kbGVyOiBhc3luYyBmdW5jdGlvbigpIHtcbiAgICAvLyBYWFggc2hvdWxkIHdlIHVuYmxvY2soKSBoZXJlPyBFaXRoZXIgYmVmb3JlIHJ1bm5pbmcgdGhlIHB1Ymxpc2hcbiAgICAvLyBmdW5jdGlvbiwgb3IgYmVmb3JlIHJ1bm5pbmcgX3B1Ymxpc2hDdXJzb3IuXG4gICAgLy9cbiAgICAvLyBSaWdodCBub3csIGVhY2ggcHVibGlzaCBmdW5jdGlvbiBibG9ja3MgYWxsIGZ1dHVyZSBwdWJsaXNoZXMgYW5kXG4gICAgLy8gbWV0aG9kcyB3YWl0aW5nIG9uIGRhdGEgZnJvbSBNb25nbyAob3Igd2hhdGV2ZXIgZWxzZSB0aGUgZnVuY3Rpb25cbiAgICAvLyBibG9ja3Mgb24pLiBUaGlzIHByb2JhYmx5IHNsb3dzIHBhZ2UgbG9hZCBpbiBjb21tb24gY2FzZXMuXG5cbiAgICBpZiAoIXRoaXMudW5ibG9jaykge1xuICAgICAgdGhpcy51bmJsb2NrID0gKCkgPT4ge307XG4gICAgfVxuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgbGV0IHJlc3VsdE9yVGhlbmFibGUgPSBudWxsO1xuICAgIHRyeSB7XG4gICAgICByZXN1bHRPclRoZW5hYmxlID0gRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uLndpdGhWYWx1ZShcbiAgICAgICAgc2VsZixcbiAgICAgICAgKCkgPT5cbiAgICAgICAgICBtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MoXG4gICAgICAgICAgICBzZWxmLl9oYW5kbGVyLFxuICAgICAgICAgICAgc2VsZixcbiAgICAgICAgICAgIEVKU09OLmNsb25lKHNlbGYuX3BhcmFtcyksXG4gICAgICAgICAgICAvLyBJdCdzIE9LIHRoYXQgdGhpcyB3b3VsZCBsb29rIHdlaXJkIGZvciB1bml2ZXJzYWwgc3Vic2NyaXB0aW9ucyxcbiAgICAgICAgICAgIC8vIGJlY2F1c2UgdGhleSBoYXZlIG5vIGFyZ3VtZW50cyBzbyB0aGVyZSBjYW4gbmV2ZXIgYmUgYW5cbiAgICAgICAgICAgIC8vIGF1ZGl0LWFyZ3VtZW50LWNoZWNrcyBmYWlsdXJlLlxuICAgICAgICAgICAgXCJwdWJsaXNoZXIgJ1wiICsgc2VsZi5fbmFtZSArIFwiJ1wiXG4gICAgICAgICAgKSxcbiAgICAgICAgeyBuYW1lOiBzZWxmLl9uYW1lIH1cbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgc2VsZi5lcnJvcihlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBEaWQgdGhlIGhhbmRsZXIgY2FsbCB0aGlzLmVycm9yIG9yIHRoaXMuc3RvcD9cbiAgICBpZiAoc2VsZi5faXNEZWFjdGl2YXRlZCgpKSByZXR1cm47XG5cbiAgICAvLyBCb3RoIGNvbnZlbnRpb25hbCBhbmQgYXN5bmMgcHVibGlzaCBoYW5kbGVyIGZ1bmN0aW9ucyBhcmUgc3VwcG9ydGVkLlxuICAgIC8vIElmIGFuIG9iamVjdCBpcyByZXR1cm5lZCB3aXRoIGEgdGhlbigpIGZ1bmN0aW9uLCBpdCBpcyBlaXRoZXIgYSBwcm9taXNlXG4gICAgLy8gb3IgdGhlbmFibGUgYW5kIHdpbGwgYmUgcmVzb2x2ZWQgYXN5bmNocm9ub3VzbHkuXG4gICAgY29uc3QgaXNUaGVuYWJsZSA9XG4gICAgICByZXN1bHRPclRoZW5hYmxlICYmIHR5cGVvZiByZXN1bHRPclRoZW5hYmxlLnRoZW4gPT09ICdmdW5jdGlvbic7XG4gICAgaWYgKGlzVGhlbmFibGUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX3B1Ymxpc2hIYW5kbGVyUmVzdWx0KGF3YWl0IHJlc3VsdE9yVGhlbmFibGUpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHNlbGYuZXJyb3IoZSlcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgc2VsZi5fcHVibGlzaEhhbmRsZXJSZXN1bHQocmVzdWx0T3JUaGVuYWJsZSk7XG4gICAgfVxuICB9LFxuXG4gIGFzeW5jIF9wdWJsaXNoSGFuZGxlclJlc3VsdCAocmVzKSB7XG4gICAgLy8gU1BFQ0lBTCBDQVNFOiBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlaXIgb3duIGNhbGxiYWNrcyB0aGF0IGludm9rZVxuICAgIC8vIHRoaXMuYWRkZWQvY2hhbmdlZC9yZWFkeS9ldGMsIHRoZSB1c2VyIGNhbiBqdXN0IHJldHVybiBhIGNvbGxlY3Rpb25cbiAgICAvLyBjdXJzb3Igb3IgYXJyYXkgb2YgY3Vyc29ycyBmcm9tIHRoZSBwdWJsaXNoIGZ1bmN0aW9uOyB3ZSBjYWxsIHRoZWlyXG4gICAgLy8gX3B1Ymxpc2hDdXJzb3IgbWV0aG9kIHdoaWNoIHN0YXJ0cyBvYnNlcnZpbmcgdGhlIGN1cnNvciBhbmQgcHVibGlzaGVzIHRoZVxuICAgIC8vIHJlc3VsdHMuIE5vdGUgdGhhdCBfcHVibGlzaEN1cnNvciBkb2VzIE5PVCBjYWxsIHJlYWR5KCkuXG4gICAgLy9cbiAgICAvLyBYWFggVGhpcyB1c2VzIGFuIHVuZG9jdW1lbnRlZCBpbnRlcmZhY2Ugd2hpY2ggb25seSB0aGUgTW9uZ28gY3Vyc29yXG4gICAgLy8gaW50ZXJmYWNlIHB1Ymxpc2hlcy4gU2hvdWxkIHdlIG1ha2UgdGhpcyBpbnRlcmZhY2UgcHVibGljIGFuZCBlbmNvdXJhZ2VcbiAgICAvLyB1c2VycyB0byBpbXBsZW1lbnQgaXQgdGhlbXNlbHZlcz8gQXJndWFibHksIGl0J3MgdW5uZWNlc3Nhcnk7IHVzZXJzIGNhblxuICAgIC8vIGFscmVhZHkgd3JpdGUgdGhlaXIgb3duIGZ1bmN0aW9ucyBsaWtlXG4gICAgLy8gICB2YXIgcHVibGlzaE15UmVhY3RpdmVUaGluZ3kgPSBmdW5jdGlvbiAobmFtZSwgaGFuZGxlcikge1xuICAgIC8vICAgICBNZXRlb3IucHVibGlzaChuYW1lLCBmdW5jdGlvbiAoKSB7XG4gICAgLy8gICAgICAgdmFyIHJlYWN0aXZlVGhpbmd5ID0gaGFuZGxlcigpO1xuICAgIC8vICAgICAgIHJlYWN0aXZlVGhpbmd5LnB1Ymxpc2hNZSgpO1xuICAgIC8vICAgICB9KTtcbiAgICAvLyAgIH07XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGlzQ3Vyc29yID0gZnVuY3Rpb24gKGMpIHtcbiAgICAgIHJldHVybiBjICYmIGMuX3B1Ymxpc2hDdXJzb3I7XG4gICAgfTtcbiAgICBpZiAoaXNDdXJzb3IocmVzKSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgcmVzLl9wdWJsaXNoQ3Vyc29yKHNlbGYpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzZWxmLmVycm9yKGUpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyBfcHVibGlzaEN1cnNvciBvbmx5IHJldHVybnMgYWZ0ZXIgdGhlIGluaXRpYWwgYWRkZWQgY2FsbGJhY2tzIGhhdmUgcnVuLlxuICAgICAgLy8gbWFyayBzdWJzY3JpcHRpb24gYXMgcmVhZHkuXG4gICAgICBzZWxmLnJlYWR5KCk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHJlcykpIHtcbiAgICAgIC8vIENoZWNrIGFsbCB0aGUgZWxlbWVudHMgYXJlIGN1cnNvcnNcbiAgICAgIGlmICghIHJlcy5ldmVyeShpc0N1cnNvcikpIHtcbiAgICAgICAgc2VsZi5lcnJvcihuZXcgRXJyb3IoXCJQdWJsaXNoIGZ1bmN0aW9uIHJldHVybmVkIGFuIGFycmF5IG9mIG5vbi1DdXJzb3JzXCIpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gRmluZCBkdXBsaWNhdGUgY29sbGVjdGlvbiBuYW1lc1xuICAgICAgLy8gWFhYIHdlIHNob3VsZCBzdXBwb3J0IG92ZXJsYXBwaW5nIGN1cnNvcnMsIGJ1dCB0aGF0IHdvdWxkIHJlcXVpcmUgdGhlXG4gICAgICAvLyBtZXJnZSBib3ggdG8gYWxsb3cgb3ZlcmxhcCB3aXRoaW4gYSBzdWJzY3JpcHRpb25cbiAgICAgIHZhciBjb2xsZWN0aW9uTmFtZXMgPSB7fTtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIGNvbGxlY3Rpb25OYW1lID0gcmVzW2ldLl9nZXRDb2xsZWN0aW9uTmFtZSgpO1xuICAgICAgICBpZiAoY29sbGVjdGlvbk5hbWVzW2NvbGxlY3Rpb25OYW1lXSkge1xuICAgICAgICAgIHNlbGYuZXJyb3IobmV3IEVycm9yKFxuICAgICAgICAgICAgXCJQdWJsaXNoIGZ1bmN0aW9uIHJldHVybmVkIG11bHRpcGxlIGN1cnNvcnMgZm9yIGNvbGxlY3Rpb24gXCIgK1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uTmFtZSkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb2xsZWN0aW9uTmFtZXNbY29sbGVjdGlvbk5hbWVdID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwocmVzLm1hcChjdXIgPT4gY3VyLl9wdWJsaXNoQ3Vyc29yKHNlbGYpKSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHNlbGYuZXJyb3IoZSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHNlbGYucmVhZHkoKTtcbiAgICB9IGVsc2UgaWYgKHJlcykge1xuICAgICAgLy8gVHJ1dGh5IHZhbHVlcyBvdGhlciB0aGFuIGN1cnNvcnMgb3IgYXJyYXlzIGFyZSBwcm9iYWJseSBhXG4gICAgICAvLyB1c2VyIG1pc3Rha2UgKHBvc3NpYmxlIHJldHVybmluZyBhIE1vbmdvIGRvY3VtZW50IHZpYSwgc2F5LFxuICAgICAgLy8gYGNvbGwuZmluZE9uZSgpYCkuXG4gICAgICBzZWxmLmVycm9yKG5ldyBFcnJvcihcIlB1Ymxpc2ggZnVuY3Rpb24gY2FuIG9ubHkgcmV0dXJuIGEgQ3Vyc29yIG9yIFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICArIFwiYW4gYXJyYXkgb2YgQ3Vyc29yc1wiKSk7XG4gICAgfVxuICB9LFxuXG4gIC8vIFRoaXMgY2FsbHMgYWxsIHN0b3AgY2FsbGJhY2tzIGFuZCBwcmV2ZW50cyB0aGUgaGFuZGxlciBmcm9tIHVwZGF0aW5nIGFueVxuICAvLyBTZXNzaW9uQ29sbGVjdGlvblZpZXdzIGZ1cnRoZXIuIEl0J3MgdXNlZCB3aGVuIHRoZSB1c2VyIHVuc3Vic2NyaWJlcyBvclxuICAvLyBkaXNjb25uZWN0cywgYXMgd2VsbCBhcyBkdXJpbmcgc2V0VXNlcklkIHJlLXJ1bnMuIEl0IGRvZXMgKk5PVCogc2VuZFxuICAvLyByZW1vdmVkIG1lc3NhZ2VzIGZvciB0aGUgcHVibGlzaGVkIG9iamVjdHM7IGlmIHRoYXQgaXMgbmVjZXNzYXJ5LCBjYWxsXG4gIC8vIF9yZW1vdmVBbGxEb2N1bWVudHMgZmlyc3QuXG4gIF9kZWFjdGl2YXRlOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5fZGVhY3RpdmF0ZWQpXG4gICAgICByZXR1cm47XG4gICAgdGhpcy5fZGVhY3RpdmF0ZWQgPSB0cnVlO1xuICAgIHRoaXMuX2NhbGxTdG9wQ2FsbGJhY2tzKCkudGhlbigoKSA9PiB7XG4gICAgICAvLyBCcmVhayByZWZlcmVuY2UgY2hhaW5zIHRvIGFsbG93IEdDIG9mIHRoZSBTZXNzaW9uIGFuZCBpdHMgZGF0YS5cbiAgICAgIC8vIFdpdGhvdXQgdGhpcywgZGVhY3RpdmF0ZWQgc3Vic2NyaXB0aW9ucyByZXRhaW4gbGl2ZSByZWZlcmVuY2VzXG4gICAgICAvLyB0byB0aGUgKG5vdy1jbG9zZWQpIHNlc3Npb24gaW5kZWZpbml0ZWx5LlxuICAgICAgdGhpcy5fc2Vzc2lvbiA9IG51bGw7XG4gICAgICB0aGlzLl9kb2N1bWVudHMgPSBuZXcgTWFwKCk7XG4gICAgfSk7XG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgXCJsaXZlZGF0YVwiLCBcInN1YnNjcmlwdGlvbnNcIiwgLTEpO1xuICB9LFxuXG4gIF9jYWxsU3RvcENhbGxiYWNrczogYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIC8vIEluIE1ldGVvciAzLCBvblN0b3AgY2FsbGJhY2tzIGNhbiBiZSBhc3luYyAoZS5nLiBvYnNlcnZlSGFuZGxlLnN0b3AoKVxuICAgIC8vIHJldHVybnMgYSBQcm9taXNlKS4gV2UgbXVzdCBhd2FpdCBlYWNoIG9uZSBzbyB0aGF0IG9ic2VydmVyIHRlYXJkb3duXG4gICAgLy8gY29tcGxldGVzIGJlZm9yZSB0aGUgc3Vic2NyaXB0aW9uIGlzIGNvbnNpZGVyZWQgZnVsbHkgZGVhY3RpdmF0ZWQuXG4gICAgY29uc3QgY2FsbGJhY2tzID0gdGhpcy5fc3RvcENhbGxiYWNrcztcbiAgICB0aGlzLl9zdG9wQ2FsbGJhY2tzID0gW107XG4gICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiBjYWxsYmFja3MpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IGNhbGxiYWNrKCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJFeGNlcHRpb24gaW4gb25TdG9wIGNhbGxiYWNrOlwiLCBlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLy8gU2VuZCByZW1vdmUgbWVzc2FnZXMgZm9yIGV2ZXJ5IGRvY3VtZW50LlxuICBfcmVtb3ZlQWxsRG9jdW1lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX2RvY3VtZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChjb2xsZWN0aW9uRG9jcywgY29sbGVjdGlvbk5hbWUpIHtcbiAgICAgICAgY29sbGVjdGlvbkRvY3MuZm9yRWFjaChmdW5jdGlvbiAoc3RySWQpIHtcbiAgICAgICAgICBzZWxmLnJlbW92ZWQoY29sbGVjdGlvbk5hbWUsIHNlbGYuX2lkRmlsdGVyLmlkUGFyc2Uoc3RySWQpKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBSZXR1cm5zIGEgbmV3IFN1YnNjcmlwdGlvbiBmb3IgdGhlIHNhbWUgc2Vzc2lvbiB3aXRoIHRoZSBzYW1lXG4gIC8vIGluaXRpYWwgY3JlYXRpb24gcGFyYW1ldGVycy4gVGhpcyBpc24ndCBhIGNsb25lOiBpdCBkb2Vzbid0IGhhdmVcbiAgLy8gdGhlIHNhbWUgX2RvY3VtZW50cyBjYWNoZSwgc3RvcHBlZCBzdGF0ZSBvciBjYWxsYmFja3M7IG1heSBoYXZlIGFcbiAgLy8gZGlmZmVyZW50IF9zdWJzY3JpcHRpb25IYW5kbGUsIGFuZCBnZXRzIGl0cyB1c2VySWQgZnJvbSB0aGVcbiAgLy8gc2Vzc2lvbiwgbm90IGZyb20gdGhpcyBvYmplY3QuXG4gIF9yZWNyZWF0ZTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gbmV3IFN1YnNjcmlwdGlvbihcbiAgICAgIHNlbGYuX3Nlc3Npb24sIHNlbGYuX2hhbmRsZXIsIHNlbGYuX3N1YnNjcmlwdGlvbklkLCBzZWxmLl9wYXJhbXMsXG4gICAgICBzZWxmLl9uYW1lKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBTdG9wcyB0aGlzIGNsaWVudCdzIHN1YnNjcmlwdGlvbiwgdHJpZ2dlcmluZyBhIGNhbGwgb24gdGhlIGNsaWVudCB0byB0aGUgYG9uU3RvcGAgY2FsbGJhY2sgcGFzc2VkIHRvIFtgTWV0ZW9yLnN1YnNjcmliZWBdKCNtZXRlb3Jfc3Vic2NyaWJlKSwgaWYgYW55LiBJZiBgZXJyb3JgIGlzIG5vdCBhIFtgTWV0ZW9yLkVycm9yYF0oI21ldGVvcl9lcnJvciksIGl0IHdpbGwgYmUgW3Nhbml0aXplZF0oI21ldGVvcl9lcnJvcikuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgVGhlIGVycm9yIHRvIHBhc3MgdG8gdGhlIGNsaWVudC5cbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICovXG4gIGVycm9yOiBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2lzRGVhY3RpdmF0ZWQoKSlcbiAgICAgIHJldHVybjtcbiAgICBzZWxmLl9zZXNzaW9uLl9zdG9wU3Vic2NyaXB0aW9uKHNlbGYuX3N1YnNjcmlwdGlvbklkLCBlcnJvcik7XG4gIH0sXG5cbiAgLy8gTm90ZSB0aGF0IHdoaWxlIG91ciBERFAgY2xpZW50IHdpbGwgbm90aWNlIHRoYXQgeW91J3ZlIGNhbGxlZCBzdG9wKCkgb24gdGhlXG4gIC8vIHNlcnZlciAoYW5kIGNsZWFuIHVwIGl0cyBfc3Vic2NyaXB0aW9ucyB0YWJsZSkgd2UgZG9uJ3QgYWN0dWFsbHkgcHJvdmlkZSBhXG4gIC8vIG1lY2hhbmlzbSBmb3IgYW4gYXBwIHRvIG5vdGljZSB0aGlzICh0aGUgc3Vic2NyaWJlIG9uRXJyb3IgY2FsbGJhY2sgb25seVxuICAvLyB0cmlnZ2VycyBpZiB0aGVyZSBpcyBhbiBlcnJvcikuXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgU3RvcHMgdGhpcyBjbGllbnQncyBzdWJzY3JpcHRpb24gYW5kIGludm9rZXMgdGhlIGNsaWVudCdzIGBvblN0b3BgIGNhbGxiYWNrIHdpdGggbm8gZXJyb3IuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICovXG4gIHN0b3A6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2lzRGVhY3RpdmF0ZWQoKSlcbiAgICAgIHJldHVybjtcbiAgICBzZWxmLl9zZXNzaW9uLl9zdG9wU3Vic2NyaXB0aW9uKHNlbGYuX3N1YnNjcmlwdGlvbklkKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBSZWdpc3RlcnMgYSBjYWxsYmFjayBmdW5jdGlvbiB0byBydW4gd2hlbiB0aGUgc3Vic2NyaXB0aW9uIGlzIHN0b3BwZWQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICovXG4gIG9uU3RvcDogZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGNhbGxiYWNrID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChjYWxsYmFjaywgJ29uU3RvcCBjYWxsYmFjaycsIHNlbGYpO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICBjYWxsYmFjaygpO1xuICAgIGVsc2VcbiAgICAgIHNlbGYuX3N0b3BDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gIH0sXG5cbiAgLy8gVGhpcyByZXR1cm5zIHRydWUgaWYgdGhlIHN1YiBoYXMgYmVlbiBkZWFjdGl2YXRlZCwgKk9SKiBpZiB0aGUgc2Vzc2lvbiB3YXNcbiAgLy8gZGVzdHJveWVkIGJ1dCB0aGUgZGVmZXJyZWQgY2FsbCB0byBfZGVhY3RpdmF0ZUFsbFN1YnNjcmlwdGlvbnMgaGFzbid0XG4gIC8vIGhhcHBlbmVkIHlldC5cbiAgX2lzRGVhY3RpdmF0ZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVhY3RpdmF0ZWQgfHwgIXRoaXMuX3Nlc3Npb24gfHwgdGhpcy5fc2Vzc2lvbi5pblF1ZXVlID09PSBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIEluZm9ybXMgdGhlIHN1YnNjcmliZXIgdGhhdCBhIGRvY3VtZW50IGhhcyBiZWVuIGFkZGVkIHRvIHRoZSByZWNvcmQgc2V0LlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBuYW1lIG9mIHRoZSBjb2xsZWN0aW9uIHRoYXQgY29udGFpbnMgdGhlIG5ldyBkb2N1bWVudC5cbiAgICogQHBhcmFtIHtTdHJpbmd9IGlkIFRoZSBuZXcgZG9jdW1lbnQncyBJRC5cbiAgICogQHBhcmFtIHtPYmplY3R9IGZpZWxkcyBUaGUgZmllbGRzIGluIHRoZSBuZXcgZG9jdW1lbnQuICBJZiBgX2lkYCBpcyBwcmVzZW50IGl0IGlzIGlnbm9yZWQuXG4gICAqL1xuICBhZGRlZCAoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIGlkID0gdGhpcy5faWRGaWx0ZXIuaWRTdHJpbmdpZnkoaWQpO1xuXG4gICAgaWYgKHRoaXMuX3Nlc3Npb24uc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLmRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb24pIHtcbiAgICAgIGxldCBpZHMgPSB0aGlzLl9kb2N1bWVudHMuZ2V0KGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIGlmIChpZHMgPT0gbnVsbCkge1xuICAgICAgICBpZHMgPSBuZXcgU2V0KCk7XG4gICAgICAgIHRoaXMuX2RvY3VtZW50cy5zZXQoY29sbGVjdGlvbk5hbWUsIGlkcyk7XG4gICAgICB9XG4gICAgICBpZHMuYWRkKGlkKTtcbiAgICB9XG5cbiAgICB0aGlzLl9zZXNzaW9uLmFkZGVkKHRoaXMuX3N1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIEluZm9ybXMgdGhlIHN1YnNjcmliZXIgdGhhdCBhIGRvY3VtZW50IGluIHRoZSByZWNvcmQgc2V0IGhhcyBiZWVuIG1vZGlmaWVkLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBuYW1lIG9mIHRoZSBjb2xsZWN0aW9uIHRoYXQgY29udGFpbnMgdGhlIGNoYW5nZWQgZG9jdW1lbnQuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpZCBUaGUgY2hhbmdlZCBkb2N1bWVudCdzIElELlxuICAgKiBAcGFyYW0ge09iamVjdH0gZmllbGRzIFRoZSBmaWVsZHMgaW4gdGhlIGRvY3VtZW50IHRoYXQgaGF2ZSBjaGFuZ2VkLCB0b2dldGhlciB3aXRoIHRoZWlyIG5ldyB2YWx1ZXMuICBJZiBhIGZpZWxkIGlzIG5vdCBwcmVzZW50IGluIGBmaWVsZHNgIGl0IHdhcyBsZWZ0IHVuY2hhbmdlZDsgaWYgaXQgaXMgcHJlc2VudCBpbiBgZmllbGRzYCBhbmQgaGFzIGEgdmFsdWUgb2YgYHVuZGVmaW5lZGAgaXQgd2FzIHJlbW92ZWQgZnJvbSB0aGUgZG9jdW1lbnQuICBJZiBgX2lkYCBpcyBwcmVzZW50IGl0IGlzIGlnbm9yZWQuXG4gICAqL1xuICBjaGFuZ2VkIChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgaWQgPSB0aGlzLl9pZEZpbHRlci5pZFN0cmluZ2lmeShpZCk7XG4gICAgdGhpcy5fc2Vzc2lvbi5jaGFuZ2VkKHRoaXMuX3N1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIEluZm9ybXMgdGhlIHN1YnNjcmliZXIgdGhhdCBhIGRvY3VtZW50IGhhcyBiZWVuIHJlbW92ZWQgZnJvbSB0aGUgcmVjb3JkIHNldC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29sbGVjdGlvbiBUaGUgbmFtZSBvZiB0aGUgY29sbGVjdGlvbiB0aGF0IHRoZSBkb2N1bWVudCBoYXMgYmVlbiByZW1vdmVkIGZyb20uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpZCBUaGUgSUQgb2YgdGhlIGRvY3VtZW50IHRoYXQgaGFzIGJlZW4gcmVtb3ZlZC5cbiAgICovXG4gIHJlbW92ZWQgKGNvbGxlY3Rpb25OYW1lLCBpZCkge1xuICAgIGlmICh0aGlzLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgaWQgPSB0aGlzLl9pZEZpbHRlci5pZFN0cmluZ2lmeShpZCk7XG5cbiAgICBpZiAodGhpcy5fc2Vzc2lvbi5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkuZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbikge1xuICAgICAgLy8gV2UgZG9uJ3QgYm90aGVyIHRvIGRlbGV0ZSBzZXRzIG9mIHRoaW5ncyBpbiBhIGNvbGxlY3Rpb24gaWYgdGhlXG4gICAgICAvLyBjb2xsZWN0aW9uIGlzIGVtcHR5LiAgSXQgY291bGQgYnJlYWsgX3JlbW92ZUFsbERvY3VtZW50cy5cbiAgICAgIHRoaXMuX2RvY3VtZW50cy5nZXQoY29sbGVjdGlvbk5hbWUpLmRlbGV0ZShpZCk7XG4gICAgfVxuXG4gICAgdGhpcy5fc2Vzc2lvbi5yZW1vdmVkKHRoaXMuX3N1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBJbmZvcm1zIHRoZSBzdWJzY3JpYmVyIHRoYXQgYW4gaW5pdGlhbCwgY29tcGxldGUgc25hcHNob3Qgb2YgdGhlIHJlY29yZCBzZXQgaGFzIGJlZW4gc2VudC4gIFRoaXMgd2lsbCB0cmlnZ2VyIGEgY2FsbCBvbiB0aGUgY2xpZW50IHRvIHRoZSBgb25SZWFkeWAgY2FsbGJhY2sgcGFzc2VkIHRvICBbYE1ldGVvci5zdWJzY3JpYmVgXSgjbWV0ZW9yX3N1YnNjcmliZSksIGlmIGFueS5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgcmVhZHk6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2lzRGVhY3RpdmF0ZWQoKSlcbiAgICAgIHJldHVybjtcbiAgICBpZiAoIXNlbGYuX3N1YnNjcmlwdGlvbklkKVxuICAgICAgcmV0dXJuOyAgLy8gVW5uZWNlc3NhcnkgYnV0IGlnbm9yZWQgZm9yIHVuaXZlcnNhbCBzdWJcbiAgICBpZiAoIXNlbGYuX3JlYWR5KSB7XG4gICAgICBzZWxmLl9zZXNzaW9uLnNlbmRSZWFkeShbc2VsZi5fc3Vic2NyaXB0aW9uSWRdKTtcbiAgICAgIHNlbGYuX3JlYWR5ID0gdHJ1ZTtcbiAgICB9XG4gIH1cbn0pO1xuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuLyogU2VydmVyICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKi9cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cblNlcnZlciA9IGZ1bmN0aW9uIChvcHRpb25zID0ge30pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIFRoZSBkZWZhdWx0IGhlYXJ0YmVhdCBpbnRlcnZhbCBpcyAzMCBzZWNvbmRzIG9uIHRoZSBzZXJ2ZXIgYW5kIDM1XG4gIC8vIHNlY29uZHMgb24gdGhlIGNsaWVudC4gIFNpbmNlIHRoZSBjbGllbnQgZG9lc24ndCBuZWVkIHRvIHNlbmQgYVxuICAvLyBwaW5nIGFzIGxvbmcgYXMgaXQgaXMgcmVjZWl2aW5nIHBpbmdzLCB0aGlzIG1lYW5zIHRoYXQgcGluZ3NcbiAgLy8gbm9ybWFsbHkgZ28gZnJvbSB0aGUgc2VydmVyIHRvIHRoZSBjbGllbnQuXG4gIC8vXG4gIC8vIE5vdGU6IFRyb3Bvc3BoZXJlIGRlcGVuZHMgb24gdGhlIGFiaWxpdHkgdG8gbXV0YXRlXG4gIC8vIE1ldGVvci5zZXJ2ZXIub3B0aW9ucy5oZWFydGJlYXRUaW1lb3V0ISBUaGlzIGlzIGEgaGFjaywgYnV0IGl0J3MgbGlmZS5cbiAgc2VsZi5vcHRpb25zID0ge1xuICAgIGhlYXJ0YmVhdEludGVydmFsOiAxNTAwMCxcbiAgICBoZWFydGJlYXRUaW1lb3V0OiAxNTAwMCxcbiAgICAvLyBGb3IgdGVzdGluZywgYWxsb3cgcmVzcG9uZGluZyB0byBwaW5ncyB0byBiZSBkaXNhYmxlZC5cbiAgICByZXNwb25kVG9QaW5nczogdHJ1ZSxcbiAgICBkZWZhdWx0UHVibGljYXRpb25TdHJhdGVneTogcHVibGljYXRpb25TdHJhdGVnaWVzLlNFUlZFUl9NRVJHRSxcbiAgICAuLi5vcHRpb25zLFxuICB9O1xuXG4gIC8vIE1hcCBvZiBjYWxsYmFja3MgdG8gY2FsbCB3aGVuIGEgbmV3IGNvbm5lY3Rpb24gY29tZXMgaW4gdG8gdGhlXG4gIC8vIHNlcnZlciBhbmQgY29tcGxldGVzIEREUCB2ZXJzaW9uIG5lZ290aWF0aW9uLiBVc2UgYW4gb2JqZWN0IGluc3RlYWRcbiAgLy8gb2YgYW4gYXJyYXkgc28gd2UgY2FuIHNhZmVseSByZW1vdmUgb25lIGZyb20gdGhlIGxpc3Qgd2hpbGVcbiAgLy8gaXRlcmF0aW5nIG92ZXIgaXQuXG4gIHNlbGYub25Db25uZWN0aW9uSG9vayA9IG5ldyBIb29rKHtcbiAgICBkZWJ1Z1ByaW50RXhjZXB0aW9uczogXCJvbkNvbm5lY3Rpb24gY2FsbGJhY2tcIlxuICB9KTtcblxuICAvLyBNYXAgb2YgY2FsbGJhY2tzIHRvIGNhbGwgd2hlbiBhIG5ldyBtZXNzYWdlIGNvbWVzIGluLlxuICBzZWxmLm9uTWVzc2FnZUhvb2sgPSBuZXcgSG9vayh7XG4gICAgZGVidWdQcmludEV4Y2VwdGlvbnM6IFwib25NZXNzYWdlIGNhbGxiYWNrXCJcbiAgfSk7XG5cbiAgc2VsZi5wdWJsaXNoX2hhbmRsZXJzID0ge307XG4gIHNlbGYudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMgPSBbXTtcblxuICBzZWxmLm1ldGhvZF9oYW5kbGVycyA9IHt9O1xuXG4gIHNlbGYuX3B1YmxpY2F0aW9uU3RyYXRlZ2llcyA9IHt9O1xuXG4gIHNlbGYuc2Vzc2lvbnMgPSBuZXcgTWFwKCk7IC8vIG1hcCBmcm9tIGlkIHRvIHNlc3Npb25cblxuICBzZWxmLnN0cmVhbV9zZXJ2ZXIgPSBuZXcgU3RyZWFtU2VydmVyKCk7XG5cbiAgc2VsZi5zdHJlYW1fc2VydmVyLnJlZ2lzdGVyKGZ1bmN0aW9uIChzb2NrZXQpIHtcbiAgICAvLyBzb2NrZXQgaW1wbGVtZW50cyB0aGUgU29ja0pTQ29ubmVjdGlvbiBpbnRlcmZhY2VcbiAgICBzb2NrZXQuX21ldGVvclNlc3Npb24gPSBudWxsO1xuXG4gICAgdmFyIHNlbmRFcnJvciA9IGZ1bmN0aW9uIChyZWFzb24sIG9mZmVuZGluZ01lc3NhZ2UpIHtcbiAgICAgIHZhciBtc2cgPSB7bXNnOiAnZXJyb3InLCByZWFzb246IHJlYXNvbn07XG4gICAgICBpZiAob2ZmZW5kaW5nTWVzc2FnZSlcbiAgICAgICAgbXNnLm9mZmVuZGluZ01lc3NhZ2UgPSBvZmZlbmRpbmdNZXNzYWdlO1xuICAgICAgc29ja2V0LnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChtc2cpKTtcbiAgICB9O1xuXG4gICAgc29ja2V0Lm9uKCdkYXRhJywgZnVuY3Rpb24gKHJhd19tc2cpIHtcbiAgICAgIGlmIChNZXRlb3IuX3ByaW50UmVjZWl2ZWRERFApIHtcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIlJlY2VpdmVkIEREUFwiLCByYXdfbXNnKTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIG1zZyA9IEREUENvbW1vbi5wYXJzZUREUChyYXdfbXNnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgc2VuZEVycm9yKCdQYXJzZSBlcnJvcicpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobXNnID09PSBudWxsIHx8ICFtc2cubXNnKSB7XG4gICAgICAgICAgc2VuZEVycm9yKCdCYWQgcmVxdWVzdCcsIG1zZyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1zZy5tc2cgPT09ICdjb25uZWN0Jykge1xuICAgICAgICAgIGlmIChzb2NrZXQuX21ldGVvclNlc3Npb24pIHtcbiAgICAgICAgICAgIHNlbmRFcnJvcihcIkFscmVhZHkgY29ubmVjdGVkXCIsIG1zZyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc2VsZi5faGFuZGxlQ29ubmVjdChzb2NrZXQsIG1zZyk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXNvY2tldC5fbWV0ZW9yU2Vzc2lvbikge1xuICAgICAgICAgIHNlbmRFcnJvcignTXVzdCBjb25uZWN0IGZpcnN0JywgbXNnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uLnByb2Nlc3NNZXNzYWdlKG1zZyk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIFhYWCBwcmludCBzdGFjayBuaWNlbHlcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIkludGVybmFsIGV4Y2VwdGlvbiB3aGlsZSBwcm9jZXNzaW5nIG1lc3NhZ2VcIiwgbXNnLCBlKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHNvY2tldC5vbignY2xvc2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKSB7XG4gICAgICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbi5jbG9zZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn07XG5cbk9iamVjdC5hc3NpZ24oU2VydmVyLnByb3RvdHlwZSwge1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZWdpc3RlciBhIGNhbGxiYWNrIHRvIGJlIGNhbGxlZCB3aGVuIGEgbmV3IEREUCBjb25uZWN0aW9uIGlzIG1hZGUgdG8gdGhlIHNlcnZlci5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gY2FsbCB3aGVuIGEgbmV3IEREUCBjb25uZWN0aW9uIGlzIGVzdGFibGlzaGVkLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIG9uQ29ubmVjdGlvbjogZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLm9uQ29ubmVjdGlvbkhvb2sucmVnaXN0ZXIoZm4pO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBTZXQgcHVibGljYXRpb24gc3RyYXRlZ3kgZm9yIHRoZSBnaXZlbiBjb2xsZWN0aW9uLiBQdWJsaWNhdGlvbnMgc3RyYXRlZ2llcyBhcmUgYXZhaWxhYmxlIGZyb20gYEREUFNlcnZlci5wdWJsaWNhdGlvblN0cmF0ZWdpZXNgLiBZb3UgY2FsbCB0aGlzIG1ldGhvZCBmcm9tIGBNZXRlb3Iuc2VydmVyYCwgbGlrZSBgTWV0ZW9yLnNlcnZlci5zZXRQdWJsaWNhdGlvblN0cmF0ZWd5KClgXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQGFsaWFzIHNldFB1YmxpY2F0aW9uU3RyYXRlZ3lcbiAgICogQHBhcmFtIGNvbGxlY3Rpb25OYW1lIHtTdHJpbmd9XG4gICAqIEBwYXJhbSBzdHJhdGVneSB7e3VzZUNvbGxlY3Rpb25WaWV3OiBib29sZWFuLCBkb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uOiBib29sZWFufX1cbiAgICogQG1lbWJlck9mIE1ldGVvci5zZXJ2ZXJcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKi9cbiAgc2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSwgc3RyYXRlZ3kpIHtcbiAgICBpZiAoIU9iamVjdC52YWx1ZXMocHVibGljYXRpb25TdHJhdGVnaWVzKS5pbmNsdWRlcyhzdHJhdGVneSkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBtZXJnZSBzdHJhdGVneTogJHtzdHJhdGVneX0gXG4gICAgICAgIGZvciBjb2xsZWN0aW9uICR7Y29sbGVjdGlvbk5hbWV9YCk7XG4gICAgfVxuICAgIHRoaXMuX3B1YmxpY2F0aW9uU3RyYXRlZ2llc1tjb2xsZWN0aW9uTmFtZV0gPSBzdHJhdGVneTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgR2V0cyB0aGUgcHVibGljYXRpb24gc3RyYXRlZ3kgZm9yIHRoZSByZXF1ZXN0ZWQgY29sbGVjdGlvbi4gWW91IGNhbGwgdGhpcyBtZXRob2QgZnJvbSBgTWV0ZW9yLnNlcnZlcmAsIGxpa2UgYE1ldGVvci5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneSgpYFxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBhbGlhcyBnZXRQdWJsaWNhdGlvblN0cmF0ZWd5XG4gICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yLnNlcnZlclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEByZXR1cm4ge3t1c2VDb2xsZWN0aW9uVmlldzogYm9vbGVhbiwgZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbjogYm9vbGVhbn19XG4gICAqL1xuICBnZXRQdWJsaWNhdGlvblN0cmF0ZWd5KGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuX3B1YmxpY2F0aW9uU3RyYXRlZ2llc1tjb2xsZWN0aW9uTmFtZV1cbiAgICAgIHx8IHRoaXMub3B0aW9ucy5kZWZhdWx0UHVibGljYXRpb25TdHJhdGVneTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiBhIG5ldyBERFAgbWVzc2FnZSBpcyByZWNlaXZlZC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdG8gY2FsbCB3aGVuIGEgbmV3IEREUCBtZXNzYWdlIGlzIHJlY2VpdmVkLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIG9uTWVzc2FnZTogZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLm9uTWVzc2FnZUhvb2sucmVnaXN0ZXIoZm4pO1xuICB9LFxuXG4gIF9oYW5kbGVDb25uZWN0OiBmdW5jdGlvbiAoc29ja2V0LCBtc2cpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBUaGUgY29ubmVjdCBtZXNzYWdlIG11c3Qgc3BlY2lmeSBhIHZlcnNpb24gYW5kIGFuIGFycmF5IG9mIHN1cHBvcnRlZFxuICAgIC8vIHZlcnNpb25zLCBhbmQgaXQgbXVzdCBjbGFpbSB0byBzdXBwb3J0IHdoYXQgaXQgaXMgcHJvcG9zaW5nLlxuICAgIGlmICghKHR5cGVvZiAobXNnLnZlcnNpb24pID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgIEFycmF5LmlzQXJyYXkobXNnLnN1cHBvcnQpICYmXG4gICAgICAgICAgbXNnLnN1cHBvcnQuZXZlcnkoaXNTdHJpbmcpICYmXG4gICAgICAgICAgbXNnLnN1cHBvcnQuaW5jbHVkZXMobXNnLnZlcnNpb24pKSkge1xuICAgICAgc29ja2V0LnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUCh7bXNnOiAnZmFpbGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbjogRERQQ29tbW9uLlNVUFBPUlRFRF9ERFBfVkVSU0lPTlNbMF19KSk7XG4gICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJbiB0aGUgZnV0dXJlLCBoYW5kbGUgc2Vzc2lvbiByZXN1bXB0aW9uOiBzb21ldGhpbmcgbGlrZTpcbiAgICAvLyAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uID0gc2VsZi5zZXNzaW9uc1ttc2cuc2Vzc2lvbl1cbiAgICB2YXIgdmVyc2lvbiA9IGNhbGN1bGF0ZVZlcnNpb24obXNnLnN1cHBvcnQsIEREUENvbW1vbi5TVVBQT1JURURfRERQX1ZFUlNJT05TKTtcblxuICAgIGlmIChtc2cudmVyc2lvbiAhPT0gdmVyc2lvbikge1xuICAgICAgLy8gVGhlIGJlc3QgdmVyc2lvbiB0byB1c2UgKGFjY29yZGluZyB0byB0aGUgY2xpZW50J3Mgc3RhdGVkIHByZWZlcmVuY2VzKVxuICAgICAgLy8gaXMgbm90IHRoZSBvbmUgdGhlIGNsaWVudCBpcyB0cnlpbmcgdG8gdXNlLiBJbmZvcm0gdGhlbSBhYm91dCB0aGUgYmVzdFxuICAgICAgLy8gdmVyc2lvbiB0byB1c2UuXG4gICAgICBzb2NrZXQuc2VuZChERFBDb21tb24uc3RyaW5naWZ5RERQKHttc2c6ICdmYWlsZWQnLCB2ZXJzaW9uOiB2ZXJzaW9ufSkpO1xuICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWWF5LCB2ZXJzaW9uIG1hdGNoZXMhIENyZWF0ZSBhIG5ldyBzZXNzaW9uLlxuICAgIC8vIE5vdGU6IFRyb3Bvc3BoZXJlIGRlcGVuZHMgb24gdGhlIGFiaWxpdHkgdG8gbXV0YXRlXG4gICAgLy8gTWV0ZW9yLnNlcnZlci5vcHRpb25zLmhlYXJ0YmVhdFRpbWVvdXQhIFRoaXMgaXMgYSBoYWNrLCBidXQgaXQncyBsaWZlLlxuICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbiA9IG5ldyBTZXNzaW9uKHNlbGYsIHZlcnNpb24sIHNvY2tldCwgc2VsZi5vcHRpb25zKTtcbiAgICBzZWxmLnNlc3Npb25zLnNldChzb2NrZXQuX21ldGVvclNlc3Npb24uaWQsIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbik7XG4gICAgc2VsZi5vbkNvbm5lY3Rpb25Ib29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKVxuICAgICAgICBjYWxsYmFjayhzb2NrZXQuX21ldGVvclNlc3Npb24uY29ubmVjdGlvbkhhbmRsZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgcHVibGlzaCBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfSBpZGVudGlmaWVyIGZvciBxdWVyeVxuICAgKiBAcGFyYW0gaGFuZGxlciB7RnVuY3Rpb259IHB1Ymxpc2ggaGFuZGxlclxuICAgKiBAcGFyYW0gb3B0aW9ucyB7T2JqZWN0fVxuICAgKlxuICAgKiBTZXJ2ZXIgd2lsbCBjYWxsIGhhbmRsZXIgZnVuY3Rpb24gb24gZWFjaCBuZXcgc3Vic2NyaXB0aW9uLFxuICAgKiBlaXRoZXIgd2hlbiByZWNlaXZpbmcgRERQIHN1YiBtZXNzYWdlIGZvciBhIG5hbWVkIHN1YnNjcmlwdGlvbiwgb3Igb25cbiAgICogRERQIGNvbm5lY3QgZm9yIGEgdW5pdmVyc2FsIHN1YnNjcmlwdGlvbi5cbiAgICpcbiAgICogSWYgbmFtZSBpcyBudWxsLCB0aGlzIHdpbGwgYmUgYSBzdWJzY3JpcHRpb24gdGhhdCBpc1xuICAgKiBhdXRvbWF0aWNhbGx5IGVzdGFibGlzaGVkIGFuZCBwZXJtYW5lbnRseSBvbiBmb3IgYWxsIGNvbm5lY3RlZFxuICAgKiBjbGllbnQsIGluc3RlYWQgb2YgYSBzdWJzY3JpcHRpb24gdGhhdCBjYW4gYmUgdHVybmVkIG9uIGFuZCBvZmZcbiAgICogd2l0aCBzdWJzY3JpYmUoKS5cbiAgICpcbiAgICogb3B0aW9ucyB0byBjb250YWluOlxuICAgKiAgLSAobW9zdGx5IGludGVybmFsKSBpc19hdXRvOiB0cnVlIGlmIGdlbmVyYXRlZCBhdXRvbWF0aWNhbGx5XG4gICAqICAgIGZyb20gYW4gYXV0b3B1Ymxpc2ggaG9vay4gdGhpcyBpcyBmb3IgY29zbWV0aWMgcHVycG9zZXMgb25seVxuICAgKiAgICAoaXQgbGV0cyB1cyBkZXRlcm1pbmUgd2hldGhlciB0byBwcmludCBhIHdhcm5pbmcgc3VnZ2VzdGluZ1xuICAgKiAgICB0aGF0IHlvdSB0dXJuIG9mZiBhdXRvcHVibGlzaCkuXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBQdWJsaXNoIGEgcmVjb3JkIHNldC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBuYW1lIElmIFN0cmluZywgbmFtZSBvZiB0aGUgcmVjb3JkIHNldC4gIElmIE9iamVjdCwgcHVibGljYXRpb25zIERpY3Rpb25hcnkgb2YgcHVibGlzaCBmdW5jdGlvbnMgYnkgbmFtZS4gIElmIGBudWxsYCwgdGhlIHNldCBoYXMgbm8gbmFtZSwgYW5kIHRoZSByZWNvcmQgc2V0IGlzIGF1dG9tYXRpY2FsbHkgc2VudCB0byBhbGwgY29ubmVjdGVkIGNsaWVudHMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgRnVuY3Rpb24gY2FsbGVkIG9uIHRoZSBzZXJ2ZXIgZWFjaCB0aW1lIGEgY2xpZW50IHN1YnNjcmliZXMuICBJbnNpZGUgdGhlIGZ1bmN0aW9uLCBgdGhpc2AgaXMgdGhlIHB1Ymxpc2ggaGFuZGxlciBvYmplY3QsIGRlc2NyaWJlZCBiZWxvdy4gIElmIHRoZSBjbGllbnQgcGFzc2VkIGFyZ3VtZW50cyB0byBgc3Vic2NyaWJlYCwgdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIHRoZSBzYW1lIGFyZ3VtZW50cy5cbiAgICovXG4gIHB1Ymxpc2g6IGZ1bmN0aW9uIChuYW1lLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKCFpc09iamVjdChuYW1lKSkge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgIGlmIChuYW1lICYmIG5hbWUgaW4gc2VsZi5wdWJsaXNoX2hhbmRsZXJzKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJJZ25vcmluZyBkdXBsaWNhdGUgcHVibGlzaCBuYW1lZCAnXCIgKyBuYW1lICsgXCInXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChQYWNrYWdlLmF1dG9wdWJsaXNoICYmICFvcHRpb25zLmlzX2F1dG8pIHtcbiAgICAgICAgLy8gVGhleSBoYXZlIGF1dG9wdWJsaXNoIG9uLCB5ZXQgdGhleSdyZSB0cnlpbmcgdG8gbWFudWFsbHlcbiAgICAgICAgLy8gcGljayBzdHVmZiB0byBwdWJsaXNoLiBUaGV5IHByb2JhYmx5IHNob3VsZCB0dXJuIG9mZlxuICAgICAgICAvLyBhdXRvcHVibGlzaC4gKFRoaXMgY2hlY2sgaXNuJ3QgcGVyZmVjdCAtLSBpZiB5b3UgY3JlYXRlIGFcbiAgICAgICAgLy8gcHVibGlzaCBiZWZvcmUgeW91IHR1cm4gb24gYXV0b3B1Ymxpc2gsIGl0IHdvbid0IGNhdGNoXG4gICAgICAgIC8vIGl0LCBidXQgdGhpcyB3aWxsIGRlZmluaXRlbHkgaGFuZGxlIHRoZSBzaW1wbGUgY2FzZSB3aGVyZVxuICAgICAgICAvLyB5b3UndmUgYWRkZWQgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2UgdG8geW91ciBhcHAsIGFuZCBhcmVcbiAgICAgICAgLy8gY2FsbGluZyBwdWJsaXNoIGZyb20geW91ciBhcHAgY29kZSkuXG4gICAgICAgIGlmICghc2VsZi53YXJuZWRfYWJvdXRfYXV0b3B1Ymxpc2gpIHtcbiAgICAgICAgICBzZWxmLndhcm5lZF9hYm91dF9hdXRvcHVibGlzaCA9IHRydWU7XG4gICAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICBcIioqIFlvdSd2ZSBzZXQgdXAgc29tZSBkYXRhIHN1YnNjcmlwdGlvbnMgd2l0aCBNZXRlb3IucHVibGlzaCgpLCBidXRcXG5cIiArXG4gICAgXCIqKiB5b3Ugc3RpbGwgaGF2ZSBhdXRvcHVibGlzaCB0dXJuZWQgb24uIEJlY2F1c2UgYXV0b3B1Ymxpc2ggaXMgc3RpbGxcXG5cIiArXG4gICAgXCIqKiBvbiwgeW91ciBNZXRlb3IucHVibGlzaCgpIGNhbGxzIHdvbid0IGhhdmUgbXVjaCBlZmZlY3QuIEFsbCBkYXRhXFxuXCIgK1xuICAgIFwiKiogd2lsbCBzdGlsbCBiZSBzZW50IHRvIGFsbCBjbGllbnRzLlxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogVHVybiBvZmYgYXV0b3B1Ymxpc2ggYnkgcmVtb3ZpbmcgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2U6XFxuXCIgK1xuICAgIFwiKipcXG5cIiArXG4gICAgXCIqKiAgICQgbWV0ZW9yIHJlbW92ZSBhdXRvcHVibGlzaFxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogLi4gYW5kIG1ha2Ugc3VyZSB5b3UgaGF2ZSBNZXRlb3IucHVibGlzaCgpIGFuZCBNZXRlb3Iuc3Vic2NyaWJlKCkgY2FsbHNcXG5cIiArXG4gICAgXCIqKiBmb3IgZWFjaCBjb2xsZWN0aW9uIHRoYXQgeW91IHdhbnQgY2xpZW50cyB0byBzZWUuXFxuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChuYW1lKVxuICAgICAgICBzZWxmLnB1Ymxpc2hfaGFuZGxlcnNbbmFtZV0gPSBoYW5kbGVyO1xuICAgICAgZWxzZSB7XG4gICAgICAgIHNlbGYudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMucHVzaChoYW5kbGVyKTtcbiAgICAgICAgLy8gU3BpbiB1cCB0aGUgbmV3IHB1Ymxpc2hlciBvbiBhbnkgZXhpc3Rpbmcgc2Vzc2lvbiB0b28uIFJ1biBlYWNoXG4gICAgICAgIC8vIHNlc3Npb24ncyBzdWJzY3JpcHRpb24gaW4gYSBuZXcgRmliZXIsIHNvIHRoYXQgdGhlcmUncyBubyBjaGFuZ2UgZm9yXG4gICAgICAgIC8vIHNlbGYuc2Vzc2lvbnMgdG8gY2hhbmdlIHdoaWxlIHdlJ3JlIHJ1bm5pbmcgdGhpcyBsb29wLlxuICAgICAgICBzZWxmLnNlc3Npb25zLmZvckVhY2goZnVuY3Rpb24gKHNlc3Npb24pIHtcbiAgICAgICAgICBpZiAoIXNlc3Npb24uX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMpIHtcbiAgICAgICAgICAgIHNlc3Npb24uX3N0YXJ0U3Vic2NyaXB0aW9uKGhhbmRsZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2V7XG4gICAgICBPYmplY3QuZW50cmllcyhuYW1lKS5mb3JFYWNoKGZ1bmN0aW9uKFtrZXksIHZhbHVlXSkge1xuICAgICAgICBzZWxmLnB1Ymxpc2goa2V5LCB2YWx1ZSwge30pO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIF9yZW1vdmVTZXNzaW9uOiBmdW5jdGlvbiAoc2Vzc2lvbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnNlc3Npb25zLmRlbGV0ZShzZXNzaW9uLmlkKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgVGVsbHMgaWYgdGhlIG1ldGhvZCBjYWxsIGNhbWUgZnJvbSBhIGNhbGwgb3IgYSBjYWxsQXN5bmMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQHJldHVybnMgYm9vbGVhblxuICAgKi9cbiAgaXNBc3luY0NhbGw6IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpXG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IERlZmluZXMgZnVuY3Rpb25zIHRoYXQgY2FuIGJlIGludm9rZWQgb3ZlciB0aGUgbmV0d29yayBieSBjbGllbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtPYmplY3R9IG1ldGhvZHMgRGljdGlvbmFyeSB3aG9zZSBrZXlzIGFyZSBtZXRob2QgbmFtZXMgYW5kIHZhbHVlcyBhcmUgZnVuY3Rpb25zLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIG1ldGhvZHM6IGZ1bmN0aW9uIChtZXRob2RzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE9iamVjdC5lbnRyaWVzKG1ldGhvZHMpLmZvckVhY2goZnVuY3Rpb24gKFtuYW1lLCBmdW5jXSkge1xuICAgICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgJ1wiICsgbmFtZSArIFwiJyBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgICBpZiAoc2VsZi5tZXRob2RfaGFuZGxlcnNbbmFtZV0pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbWV0aG9kIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkXCIpO1xuICAgICAgc2VsZi5tZXRob2RfaGFuZGxlcnNbbmFtZV0gPSBmdW5jO1xuICAgIH0pO1xuICB9LFxuXG4gIGNhbGw6IGZ1bmN0aW9uIChuYW1lLCAuLi5hcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgLy8gSWYgaXQncyBhIGZ1bmN0aW9uLCB0aGUgbGFzdCBhcmd1bWVudCBpcyB0aGUgcmVzdWx0IGNhbGxiYWNrLCBub3RcbiAgICAgIC8vIGEgcGFyYW1ldGVyIHRvIHRoZSByZW1vdGUgbWV0aG9kLlxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5hcHBseShuYW1lLCBhcmdzLCBjYWxsYmFjayk7XG4gIH0sXG5cbiAgLy8gQSB2ZXJzaW9uIG9mIHRoZSBjYWxsIG1ldGhvZCB0aGF0IGFsd2F5cyByZXR1cm5zIGEgUHJvbWlzZS5cbiAgY2FsbEFzeW5jOiBmdW5jdGlvbiAobmFtZSwgLi4uYXJncykge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzWzBdPy5oYXNPd25Qcm9wZXJ0eSgncmV0dXJuU3R1YlZhbHVlJylcbiAgICAgID8gYXJncy5zaGlmdCgpXG4gICAgICA6IHt9O1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcodHJ1ZSk7XG4gICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIEREUC5fQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24uX3NldCh7IG5hbWUsIGhhc0NhbGxBc3luY1BhcmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCB7IGlzRnJvbUNhbGxBc3luYzogdHJ1ZSwgLi4ub3B0aW9ucyB9KVxuICAgICAgICAudGhlbihyZXNvbHZlKVxuICAgICAgICAuY2F0Y2gocmVqZWN0KVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgRERQLl9DdXJyZW50Q2FsbEFzeW5jSW52b2NhdGlvbi5fc2V0KCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBwcm9taXNlLmZpbmFsbHkoKCkgPT5cbiAgICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcoZmFsc2UpXG4gICAgKTtcbiAgfSxcblxuICBhcHBseTogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgLy8gV2Ugd2VyZSBwYXNzZWQgMyBhcmd1bWVudHMuIFRoZXkgbWF5IGJlIGVpdGhlciAobmFtZSwgYXJncywgb3B0aW9ucylcbiAgICAvLyBvciAobmFtZSwgYXJncywgY2FsbGJhY2spXG4gICAgaWYgKCEgY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgfVxuICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLmFwcGx5QXN5bmMobmFtZSwgYXJncywgb3B0aW9ucyk7XG5cbiAgICAvLyBSZXR1cm4gdGhlIHJlc3VsdCBpbiB3aGljaGV2ZXIgd2F5IHRoZSBjYWxsZXIgYXNrZWQgZm9yIGl0LiBOb3RlIHRoYXQgd2VcbiAgICAvLyBkbyBOT1QgYmxvY2sgb24gdGhlIHdyaXRlIGZlbmNlIGluIGFuIGFuYWxvZ291cyB3YXkgdG8gaG93IHRoZSBjbGllbnRcbiAgICAvLyBibG9ja3Mgb24gdGhlIHJlbGV2YW50IGRhdGEgYmVpbmcgdmlzaWJsZSwgc28geW91IGFyZSBOT1QgZ3VhcmFudGVlZCB0aGF0XG4gICAgLy8gY3Vyc29yIG9ic2VydmUgY2FsbGJhY2tzIGhhdmUgZmlyZWQgd2hlbiB5b3VyIGNhbGxiYWNrIGlzIGludm9rZWQuIChXZVxuICAgIC8vIGNhbiBjaGFuZ2UgdGhpcyBpZiB0aGVyZSdzIGEgcmVhbCB1c2UgY2FzZSkuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgIHJlc3VsdCA9PiBjYWxsYmFjayh1bmRlZmluZWQsIHJlc3VsdCksXG4gICAgICAgIGV4Y2VwdGlvbiA9PiBjYWxsYmFjayhleGNlcHRpb24pXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gQHBhcmFtIG9wdGlvbnMge09wdGlvbmFsIE9iamVjdH1cbiAgYXBwbHlBc3luYzogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMpIHtcbiAgICAvLyBSdW4gdGhlIGhhbmRsZXJcbiAgICB2YXIgaGFuZGxlciA9IHRoaXMubWV0aG9kX2hhbmRsZXJzW25hbWVdO1xuXG4gICAgaWYgKCEgaGFuZGxlcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KFxuICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgYE1ldGhvZCAnJHtuYW1lfScgbm90IGZvdW5kYClcbiAgICAgICk7XG4gICAgfVxuICAgIC8vIElmIHRoaXMgaXMgYSBtZXRob2QgY2FsbCBmcm9tIHdpdGhpbiBhbm90aGVyIG1ldGhvZCBvciBwdWJsaXNoIGZ1bmN0aW9uLFxuICAgIC8vIGdldCB0aGUgdXNlciBzdGF0ZSBmcm9tIHRoZSBvdXRlciBtZXRob2Qgb3IgcHVibGlzaCBmdW5jdGlvbiwgb3RoZXJ3aXNlXG4gICAgLy8gZG9uJ3QgYWxsb3cgc2V0VXNlcklkIHRvIGJlIGNhbGxlZFxuICAgIHZhciB1c2VySWQgPSBudWxsO1xuICAgIGxldCBzZXRVc2VySWQgPSAoKSA9PiB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIHNldFVzZXJJZCBvbiBhIHNlcnZlciBpbml0aWF0ZWQgbWV0aG9kIGNhbGxcIik7XG4gICAgfTtcbiAgICB2YXIgY29ubmVjdGlvbiA9IG51bGw7XG4gICAgdmFyIGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgICB2YXIgY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiA9IEREUC5fQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5nZXQoKTtcbiAgICB2YXIgcmFuZG9tU2VlZCA9IG51bGw7XG5cbiAgICBpZiAoY3VycmVudE1ldGhvZEludm9jYXRpb24pIHtcbiAgICAgIHVzZXJJZCA9IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLnVzZXJJZDtcbiAgICAgIHNldFVzZXJJZCA9ICh1c2VySWQpID0+IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLnNldFVzZXJJZCh1c2VySWQpO1xuICAgICAgY29ubmVjdGlvbiA9IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmNvbm5lY3Rpb247XG4gICAgICByYW5kb21TZWVkID0gRERQQ29tbW9uLm1ha2VScGNTZWVkKGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLCBuYW1lKTtcbiAgICB9IGVsc2UgaWYgKGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24pIHtcbiAgICAgIHVzZXJJZCA9IGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24udXNlcklkO1xuICAgICAgc2V0VXNlcklkID0gKHVzZXJJZCkgPT4gY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5fc2Vzc2lvbi5fc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgICBjb25uZWN0aW9uID0gY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5jb25uZWN0aW9uO1xuICAgIH1cblxuICAgIHZhciBpbnZvY2F0aW9uID0gbmV3IEREUENvbW1vbi5NZXRob2RJbnZvY2F0aW9uKHtcbiAgICAgIGlzU2ltdWxhdGlvbjogZmFsc2UsXG4gICAgICB1c2VySWQsXG4gICAgICBzZXRVc2VySWQsXG4gICAgICBjb25uZWN0aW9uLFxuICAgICAgcmFuZG9tU2VlZFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxldCByZXN1bHQ7XG4gICAgICB0cnkge1xuICAgICAgICByZXN1bHQgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLndpdGhWYWx1ZShpbnZvY2F0aW9uLCAoKSA9PlxuICAgICAgICAgIG1heWJlQXVkaXRBcmd1bWVudENoZWNrcyhcbiAgICAgICAgICAgIGhhbmRsZXIsXG4gICAgICAgICAgICBpbnZvY2F0aW9uLFxuICAgICAgICAgICAgRUpTT04uY2xvbmUoYXJncyksXG4gICAgICAgICAgICBcImludGVybmFsIGNhbGwgdG8gJ1wiICsgbmFtZSArIFwiJ1wiXG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gcmVqZWN0KGUpO1xuICAgICAgfVxuICAgICAgaWYgKCFNZXRlb3IuX2lzUHJvbWlzZShyZXN1bHQpKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKHJlc3VsdCk7XG4gICAgICB9XG4gICAgICByZXN1bHQudGhlbihyID0+IHJlc29sdmUocikpLmNhdGNoKHJlamVjdCk7XG4gICAgfSkudGhlbihFSlNPTi5jbG9uZSk7XG4gIH0sXG5cbiAgX3VybEZvclNlc3Npb246IGZ1bmN0aW9uIChzZXNzaW9uSWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHNlc3Npb24gPSBzZWxmLnNlc3Npb25zLmdldChzZXNzaW9uSWQpO1xuICAgIGlmIChzZXNzaW9uKVxuICAgICAgcmV0dXJuIHNlc3Npb24uX3NvY2tldFVybDtcbiAgICBlbHNlXG4gICAgICByZXR1cm4gbnVsbDtcbiAgfVxufSk7XG5cbnZhciBjYWxjdWxhdGVWZXJzaW9uID0gZnVuY3Rpb24gKGNsaWVudFN1cHBvcnRlZFZlcnNpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyU3VwcG9ydGVkVmVyc2lvbnMpIHtcbiAgdmFyIGNvcnJlY3RWZXJzaW9uID0gY2xpZW50U3VwcG9ydGVkVmVyc2lvbnMuZmluZChmdW5jdGlvbiAodmVyc2lvbikge1xuICAgIHJldHVybiBzZXJ2ZXJTdXBwb3J0ZWRWZXJzaW9ucy5pbmNsdWRlcyh2ZXJzaW9uKTtcbiAgfSk7XG4gIGlmICghY29ycmVjdFZlcnNpb24pIHtcbiAgICBjb3JyZWN0VmVyc2lvbiA9IHNlcnZlclN1cHBvcnRlZFZlcnNpb25zWzBdO1xuICB9XG4gIHJldHVybiBjb3JyZWN0VmVyc2lvbjtcbn07XG5cbkREUFNlcnZlci5fY2FsY3VsYXRlVmVyc2lvbiA9IGNhbGN1bGF0ZVZlcnNpb247XG5cblxuLy8gXCJibGluZFwiIGV4Y2VwdGlvbnMgb3RoZXIgdGhhbiB0aG9zZSB0aGF0IHdlcmUgZGVsaWJlcmF0ZWx5IHRocm93biB0byBzaWduYWxcbi8vIGVycm9ycyB0byB0aGUgY2xpZW50XG52YXIgd3JhcEludGVybmFsRXhjZXB0aW9uID0gZnVuY3Rpb24gKGV4Y2VwdGlvbiwgY29udGV4dCkge1xuICBpZiAoIWV4Y2VwdGlvbikgcmV0dXJuIGV4Y2VwdGlvbjtcblxuICAvLyBUbyBhbGxvdyBwYWNrYWdlcyB0byB0aHJvdyBlcnJvcnMgaW50ZW5kZWQgZm9yIHRoZSBjbGllbnQgYnV0IG5vdCBoYXZlIHRvXG4gIC8vIGRlcGVuZCBvbiB0aGUgTWV0ZW9yLkVycm9yIGNsYXNzLCBgaXNDbGllbnRTYWZlYCBjYW4gYmUgc2V0IHRvIHRydWUgb24gYW55XG4gIC8vIGVycm9yIGJlZm9yZSBpdCBpcyB0aHJvd24uXG4gIGlmIChleGNlcHRpb24uaXNDbGllbnRTYWZlKSB7XG4gICAgaWYgKCEoZXhjZXB0aW9uIGluc3RhbmNlb2YgTWV0ZW9yLkVycm9yKSkge1xuICAgICAgY29uc3Qgb3JpZ2luYWxNZXNzYWdlID0gZXhjZXB0aW9uLm1lc3NhZ2U7XG4gICAgICBleGNlcHRpb24gPSBuZXcgTWV0ZW9yLkVycm9yKGV4Y2VwdGlvbi5lcnJvciwgZXhjZXB0aW9uLnJlYXNvbiwgZXhjZXB0aW9uLmRldGFpbHMpO1xuICAgICAgZXhjZXB0aW9uLm1lc3NhZ2UgPSBvcmlnaW5hbE1lc3NhZ2U7XG4gICAgfVxuICAgIHJldHVybiBleGNlcHRpb247XG4gIH1cblxuICAvLyBUZXN0cyBjYW4gc2V0IHRoZSAnX2V4cGVjdGVkQnlUZXN0JyBmbGFnIG9uIGFuIGV4Y2VwdGlvbiBzbyBpdCB3b24ndCBnbyB0b1xuICAvLyB0aGUgc2VydmVyIGxvZy5cbiAgaWYgKCFleGNlcHRpb24uX2V4cGVjdGVkQnlUZXN0KSB7XG4gICAgTWV0ZW9yLl9kZWJ1ZyhcIkV4Y2VwdGlvbiBcIiArIGNvbnRleHQsIGV4Y2VwdGlvbi5zdGFjayk7XG4gICAgaWYgKGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcikge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIlNhbml0aXplZCBhbmQgcmVwb3J0ZWQgdG8gdGhlIGNsaWVudCBhczpcIiwgZXhjZXB0aW9uLnNhbml0aXplZEVycm9yKTtcbiAgICAgIE1ldGVvci5fZGVidWcoKTtcbiAgICB9XG4gIH1cblxuICAvLyBEaWQgdGhlIGVycm9yIGNvbnRhaW4gbW9yZSBkZXRhaWxzIHRoYXQgY291bGQgaGF2ZSBiZWVuIHVzZWZ1bCBpZiBjYXVnaHQgaW5cbiAgLy8gc2VydmVyIGNvZGUgKG9yIGlmIHRocm93biBmcm9tIG5vbi1jbGllbnQtb3JpZ2luYXRlZCBjb2RlKSwgYnV0IGFsc29cbiAgLy8gcHJvdmlkZWQgYSBcInNhbml0aXplZFwiIHZlcnNpb24gd2l0aCBtb3JlIGNvbnRleHQgdGhhbiA1MDAgSW50ZXJuYWwgc2VydmVyIGVycm9yPyBVc2UgdGhhdC5cbiAgaWYgKGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcikge1xuICAgIGlmIChleGNlcHRpb24uc2FuaXRpemVkRXJyb3IuaXNDbGllbnRTYWZlKVxuICAgICAgcmV0dXJuIGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcjtcbiAgICBNZXRlb3IuX2RlYnVnKFwiRXhjZXB0aW9uIFwiICsgY29udGV4dCArIFwiIHByb3ZpZGVzIGEgc2FuaXRpemVkRXJyb3IgdGhhdCBcIiArXG4gICAgICAgICAgICAgICAgICBcImRvZXMgbm90IGhhdmUgaXNDbGllbnRTYWZlIHByb3BlcnR5IHNldDsgaWdub3JpbmdcIik7XG4gIH1cblxuICByZXR1cm4gbmV3IE1ldGVvci5FcnJvcig1MDAsIFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIpO1xufTtcblxuXG4vLyBBdWRpdCBhcmd1bWVudCBjaGVja3MsIGlmIHRoZSBhdWRpdC1hcmd1bWVudC1jaGVja3MgcGFja2FnZSBleGlzdHMgKGl0IGlzIGFcbi8vIHdlYWsgZGVwZW5kZW5jeSBvZiB0aGlzIHBhY2thZ2UpLlxudmFyIG1heWJlQXVkaXRBcmd1bWVudENoZWNrcyA9IGZ1bmN0aW9uIChmLCBjb250ZXh0LCBhcmdzLCBkZXNjcmlwdGlvbikge1xuICBhcmdzID0gYXJncyB8fCBbXTtcbiAgaWYgKFBhY2thZ2VbJ2F1ZGl0LWFyZ3VtZW50LWNoZWNrcyddKSB7XG4gICAgcmV0dXJuIE1hdGNoLl9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkKFxuICAgICAgZiwgY29udGV4dCwgYXJncywgZGVzY3JpcHRpb24pO1xuICB9XG4gIHJldHVybiBmLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xufTsiLCJERFBTZXJ2ZXIuX1dyaXRlRmVuY2UgPSBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuYXJtZWQgPSBmYWxzZTtcbiAgICB0aGlzLmZpcmVkID0gZmFsc2U7XG4gICAgdGhpcy5yZXRpcmVkID0gZmFsc2U7XG4gICAgdGhpcy5vdXRzdGFuZGluZ193cml0ZXMgPSAwO1xuICAgIHRoaXMuYmVmb3JlX2ZpcmVfY2FsbGJhY2tzID0gW107XG4gICAgdGhpcy5jb21wbGV0aW9uX2NhbGxiYWNrcyA9IFtdO1xuICB9XG5cbiAgYmVnaW5Xcml0ZSgpIHtcbiAgICBpZiAodGhpcy5yZXRpcmVkKSB7XG4gICAgICByZXR1cm4geyBjb21taXR0ZWQ6ICgpID0+IHt9IH07XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZmlyZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImZlbmNlIGhhcyBhbHJlYWR5IGFjdGl2YXRlZCAtLSB0b28gbGF0ZSB0byBhZGQgd3JpdGVzXCIpO1xuICAgIH1cblxuICAgIHRoaXMub3V0c3RhbmRpbmdfd3JpdGVzKys7XG4gICAgbGV0IGNvbW1pdHRlZCA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbW1pdHRlZDogYXN5bmMgKCkgPT4ge1xuICAgICAgICBpZiAoY29tbWl0dGVkKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY29tbWl0dGVkIGNhbGxlZCB0d2ljZSBvbiB0aGUgc2FtZSB3cml0ZVwiKTtcbiAgICAgICAgfVxuICAgICAgICBjb21taXR0ZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcy0tO1xuICAgICAgICBhd2FpdCB0aGlzLl9tYXliZUZpcmUoKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgYXJtKCkge1xuICAgIGlmICh0aGlzID09PSBERFBTZXJ2ZXIuX2dldEN1cnJlbnRGZW5jZSgpKSB7XG4gICAgICB0aHJvdyBFcnJvcihcIkNhbid0IGFybSB0aGUgY3VycmVudCBmZW5jZVwiKTtcbiAgICB9XG4gICAgdGhpcy5hcm1lZCA9IHRydWU7XG4gICAgcmV0dXJuIHRoaXMuX21heWJlRmlyZSgpO1xuICB9XG5cbiAgb25CZWZvcmVGaXJlKGZ1bmMpIHtcbiAgICBpZiAodGhpcy5maXJlZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZmVuY2UgaGFzIGFscmVhZHkgYWN0aXZhdGVkIC0tIHRvbyBsYXRlIHRvIGFkZCBhIGNhbGxiYWNrXCIpO1xuICAgIH1cbiAgICB0aGlzLmJlZm9yZV9maXJlX2NhbGxiYWNrcy5wdXNoKGZ1bmMpO1xuICB9XG5cbiAgb25BbGxDb21taXR0ZWQoZnVuYykge1xuICAgIGlmICh0aGlzLmZpcmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJmZW5jZSBoYXMgYWxyZWFkeSBhY3RpdmF0ZWQgLS0gdG9vIGxhdGUgdG8gYWRkIGEgY2FsbGJhY2tcIik7XG4gICAgfVxuICAgIHRoaXMuY29tcGxldGlvbl9jYWxsYmFja3MucHVzaChmdW5jKTtcbiAgfVxuXG4gIGFzeW5jIF9hcm1BbmRXYWl0KCkge1xuICAgIGxldCByZXNvbHZlcjtcbiAgICBjb25zdCByZXR1cm5WYWx1ZSA9IG5ldyBQcm9taXNlKHIgPT4gcmVzb2x2ZXIgPSByKTtcbiAgICB0aGlzLm9uQWxsQ29tbWl0dGVkKHJlc29sdmVyKTtcbiAgICBhd2FpdCB0aGlzLmFybSgpO1xuICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgfVxuXG4gIGFybUFuZFdhaXQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2FybUFuZFdhaXQoKTtcbiAgfVxuXG4gIGFzeW5jIF9tYXliZUZpcmUoKSB7XG4gICAgaWYgKHRoaXMuZmlyZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIndyaXRlIGZlbmNlIGFscmVhZHkgYWN0aXZhdGVkP1wiKTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuYXJtZWQgfHwgdGhpcy5vdXRzdGFuZGluZ193cml0ZXMgPiAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgaW52b2tlQ2FsbGJhY2sgPSBhc3luYyAoZnVuYykgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZnVuYyh0aGlzKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKFwiZXhjZXB0aW9uIGluIHdyaXRlIGZlbmNlIGNhbGxiYWNrOlwiLCBlcnIpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcysrO1xuXG4gICAgLy8gUHJvY2VzcyBhbGwgYmVmb3JlX2ZpcmUgY2FsbGJhY2tzIGluIHBhcmFsbGVsXG4gICAgY29uc3QgYmVmb3JlQ2FsbGJhY2tzID0gWy4uLnRoaXMuYmVmb3JlX2ZpcmVfY2FsbGJhY2tzXTtcbiAgICB0aGlzLmJlZm9yZV9maXJlX2NhbGxiYWNrcyA9IFtdO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKGJlZm9yZUNhbGxiYWNrcy5tYXAoY2IgPT4gaW52b2tlQ2FsbGJhY2soY2IpKSk7XG5cbiAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcy0tO1xuXG4gICAgaWYgKHRoaXMub3V0c3RhbmRpbmdfd3JpdGVzID09PSAwKSB7XG4gICAgICB0aGlzLmZpcmVkID0gdHJ1ZTtcbiAgICAgIC8vIFByb2Nlc3MgYWxsIGNvbXBsZXRpb24gY2FsbGJhY2tzIGluIHBhcmFsbGVsXG4gICAgICBjb25zdCBjYWxsYmFja3MgPSBbLi4udGhpcy5jb21wbGV0aW9uX2NhbGxiYWNrc107XG4gICAgICB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzID0gW107XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChjYWxsYmFja3MubWFwKGNiID0+IGludm9rZUNhbGxiYWNrKGNiKSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldGlyZSgpIHtcbiAgICBpZiAoIXRoaXMuZmlyZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHJldGlyZSBhIGZlbmNlIHRoYXQgaGFzbid0IGZpcmVkLlwiKTtcbiAgICB9XG4gICAgdGhpcy5yZXRpcmVkID0gdHJ1ZTtcbiAgfVxufTtcblxuRERQU2VydmVyLl9DdXJyZW50V3JpdGVGZW5jZSA9IG5ldyBNZXRlb3IuRW52aXJvbm1lbnRWYXJpYWJsZTsiLCIvLyBBIFwiY3Jvc3NiYXJcIiBpcyBhIGNsYXNzIHRoYXQgcHJvdmlkZXMgc3RydWN0dXJlZCBub3RpZmljYXRpb24gcmVnaXN0cmF0aW9uLlxuLy8gU2VlIF9tYXRjaCBmb3IgdGhlIGRlZmluaXRpb24gb2YgaG93IGEgbm90aWZpY2F0aW9uIG1hdGNoZXMgYSB0cmlnZ2VyLlxuLy8gQWxsIG5vdGlmaWNhdGlvbnMgYW5kIHRyaWdnZXJzIG11c3QgaGF2ZSBhIHN0cmluZyBrZXkgbmFtZWQgJ2NvbGxlY3Rpb24nLlxuXG5ERFBTZXJ2ZXIuX0Nyb3NzYmFyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICBzZWxmLm5leHRJZCA9IDE7XG4gIC8vIG1hcCBmcm9tIGNvbGxlY3Rpb24gbmFtZSAoc3RyaW5nKSAtPiBsaXN0ZW5lciBpZCAtPiBvYmplY3QuIGVhY2ggb2JqZWN0IGhhc1xuICAvLyBrZXlzICd0cmlnZ2VyJywgJ2NhbGxiYWNrJy4gIEFzIGEgaGFjaywgdGhlIGVtcHR5IHN0cmluZyBtZWFucyBcIm5vXG4gIC8vIGNvbGxlY3Rpb25cIi5cbiAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb24gPSB7fTtcbiAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudCA9IHt9O1xuICBzZWxmLmZhY3RQYWNrYWdlID0gb3B0aW9ucy5mYWN0UGFja2FnZSB8fCBcImxpdmVkYXRhXCI7XG4gIHNlbGYuZmFjdE5hbWUgPSBvcHRpb25zLmZhY3ROYW1lIHx8IG51bGw7XG59O1xuXG5PYmplY3QuYXNzaWduKEREUFNlcnZlci5fQ3Jvc3NiYXIucHJvdG90eXBlLCB7XG4gIC8vIG1zZyBpcyBhIHRyaWdnZXIgb3IgYSBub3RpZmljYXRpb25cbiAgX2NvbGxlY3Rpb25Gb3JNZXNzYWdlOiBmdW5jdGlvbiAobXNnKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghKCdjb2xsZWN0aW9uJyBpbiBtc2cpKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YobXNnLmNvbGxlY3Rpb24pID09PSAnc3RyaW5nJykge1xuICAgICAgaWYgKG1zZy5jb2xsZWN0aW9uID09PSAnJylcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJNZXNzYWdlIGhhcyBlbXB0eSBjb2xsZWN0aW9uIVwiKTtcbiAgICAgIHJldHVybiBtc2cuY29sbGVjdGlvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgRXJyb3IoXCJNZXNzYWdlIGhhcyBub24tc3RyaW5nIGNvbGxlY3Rpb24hXCIpO1xuICAgIH1cbiAgfSxcblxuICAvLyBMaXN0ZW4gZm9yIG5vdGlmaWNhdGlvbiB0aGF0IG1hdGNoICd0cmlnZ2VyJy4gQSBub3RpZmljYXRpb25cbiAgLy8gbWF0Y2hlcyBpZiBpdCBoYXMgdGhlIGtleS12YWx1ZSBwYWlycyBpbiB0cmlnZ2VyIGFzIGFcbiAgLy8gc3Vic2V0LiBXaGVuIGEgbm90aWZpY2F0aW9uIG1hdGNoZXMsIGNhbGwgJ2NhbGxiYWNrJywgcGFzc2luZ1xuICAvLyB0aGUgYWN0dWFsIG5vdGlmaWNhdGlvbi5cbiAgLy9cbiAgLy8gUmV0dXJucyBhIGxpc3RlbiBoYW5kbGUsIHdoaWNoIGlzIGFuIG9iamVjdCB3aXRoIGEgbWV0aG9kXG4gIC8vIHN0b3AoKS4gQ2FsbCBzdG9wKCkgdG8gc3RvcCBsaXN0ZW5pbmcuXG4gIC8vXG4gIC8vIFhYWCBJdCBzaG91bGQgYmUgbGVnYWwgdG8gY2FsbCBmaXJlKCkgZnJvbSBpbnNpZGUgYSBsaXN0ZW4oKVxuICAvLyBjYWxsYmFjaz9cbiAgbGlzdGVuOiBmdW5jdGlvbiAodHJpZ2dlciwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGlkID0gc2VsZi5uZXh0SWQrKztcblxuICAgIHZhciBjb2xsZWN0aW9uID0gc2VsZi5fY29sbGVjdGlvbkZvck1lc3NhZ2UodHJpZ2dlcik7XG4gICAgdmFyIHJlY29yZCA9IHt0cmlnZ2VyOiBFSlNPTi5jbG9uZSh0cmlnZ2VyKSwgY2FsbGJhY2s6IGNhbGxiYWNrfTtcbiAgICBpZiAoISAoY29sbGVjdGlvbiBpbiBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbikpIHtcbiAgICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dID0ge307XG4gICAgICBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbkNvdW50W2NvbGxlY3Rpb25dID0gMDtcbiAgICB9XG4gICAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbl1baWRdID0gcmVjb3JkO1xuICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0rKztcblxuICAgIGlmIChzZWxmLmZhY3ROYW1lICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSkge1xuICAgICAgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIHNlbGYuZmFjdFBhY2thZ2UsIHNlbGYuZmFjdE5hbWUsIDEpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChzZWxmLmZhY3ROYW1lICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSkge1xuICAgICAgICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgICAgICAgc2VsZi5mYWN0UGFja2FnZSwgc2VsZi5mYWN0TmFtZSwgLTEpO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXVtpZF07XG4gICAgICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0tLTtcbiAgICAgICAgaWYgKHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0gPT09IDApIHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbl07XG4gICAgICAgICAgZGVsZXRlIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9LFxuXG4gIC8vIEZpcmUgdGhlIHByb3ZpZGVkICdub3RpZmljYXRpb24nIChhbiBvYmplY3Qgd2hvc2UgYXR0cmlidXRlXG4gIC8vIHZhbHVlcyBhcmUgYWxsIEpTT04tY29tcGF0aWJpbGUpIC0tIGluZm9ybSBhbGwgbWF0Y2hpbmcgbGlzdGVuZXJzXG4gIC8vIChyZWdpc3RlcmVkIHdpdGggbGlzdGVuKCkpLlxuICAvL1xuICAvLyBJZiBmaXJlKCkgaXMgY2FsbGVkIGluc2lkZSBhIHdyaXRlIGZlbmNlLCB0aGVuIGVhY2ggb2YgdGhlXG4gIC8vIGxpc3RlbmVyIGNhbGxiYWNrcyB3aWxsIGJlIGNhbGxlZCBpbnNpZGUgdGhlIHdyaXRlIGZlbmNlIGFzIHdlbGwuXG4gIC8vXG4gIC8vIFRoZSBsaXN0ZW5lcnMgbWF5IGJlIGludm9rZWQgaW4gcGFyYWxsZWwsIHJhdGhlciB0aGFuIHNlcmlhbGx5LlxuICBmaXJlOiBhc3luYyBmdW5jdGlvbiAobm90aWZpY2F0aW9uKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLl9jb2xsZWN0aW9uRm9yTWVzc2FnZShub3RpZmljYXRpb24pO1xuXG4gICAgaWYgKCEoY29sbGVjdGlvbiBpbiBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbikpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgbGlzdGVuZXJzRm9yQ29sbGVjdGlvbiA9IHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dO1xuICAgIHZhciBjYWxsYmFja0lkcyA9IFtdO1xuICAgIE9iamVjdC5lbnRyaWVzKGxpc3RlbmVyc0ZvckNvbGxlY3Rpb24pLmZvckVhY2goZnVuY3Rpb24gKFtpZCwgbF0pIHtcbiAgICAgIGlmIChzZWxmLl9tYXRjaGVzKG5vdGlmaWNhdGlvbiwgbC50cmlnZ2VyKSkge1xuICAgICAgICBjYWxsYmFja0lkcy5wdXNoKGlkKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIExpc3RlbmVyIGNhbGxiYWNrcyBjYW4geWllbGQsIHNvIHdlIG5lZWQgdG8gZmlyc3QgZmluZCBhbGwgdGhlIG9uZXMgdGhhdFxuICAgIC8vIG1hdGNoIGluIGEgc2luZ2xlIGl0ZXJhdGlvbiBvdmVyIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uICh3aGljaCBjYW4ndFxuICAgIC8vIGJlIG11dGF0ZWQgZHVyaW5nIHRoaXMgaXRlcmF0aW9uKSwgYW5kIHRoZW4gaW52b2tlIHRoZSBtYXRjaGluZ1xuICAgIC8vIGNhbGxiYWNrcywgY2hlY2tpbmcgYmVmb3JlIGVhY2ggY2FsbCB0byBlbnN1cmUgdGhleSBoYXZlbid0IHN0b3BwZWQuXG4gICAgLy8gTm90ZSB0aGF0IHdlIGRvbid0IGhhdmUgdG8gY2hlY2sgdGhhdFxuICAgIC8vIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dIHN0aWxsID09PSBsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uLFxuICAgIC8vIGJlY2F1c2UgdGhlIG9ubHkgd2F5IHRoYXQgc3RvcHMgYmVpbmcgdHJ1ZSBpcyBpZiBsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uXG4gICAgLy8gZmlyc3QgZ2V0cyByZWR1Y2VkIGRvd24gdG8gdGhlIGVtcHR5IG9iamVjdCAoYW5kIHRoZW4gbmV2ZXIgZ2V0c1xuICAgIC8vIGluY3JlYXNlZCBhZ2FpbikuXG4gICAgZm9yIChjb25zdCBpZCBvZiBjYWxsYmFja0lkcykge1xuICAgICAgaWYgKGlkIGluIGxpc3RlbmVyc0ZvckNvbGxlY3Rpb24pIHtcbiAgICAgICAgYXdhaXQgbGlzdGVuZXJzRm9yQ29sbGVjdGlvbltpZF0uY2FsbGJhY2sobm90aWZpY2F0aW9uKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLy8gQSBub3RpZmljYXRpb24gbWF0Y2hlcyBhIHRyaWdnZXIgaWYgYWxsIGtleXMgdGhhdCBleGlzdCBpbiBib3RoIGFyZSBlcXVhbC5cbiAgLy9cbiAgLy8gRXhhbXBsZXM6XG4gIC8vICBOOntjb2xsZWN0aW9uOiBcIkNcIn0gbWF0Y2hlcyBUOntjb2xsZWN0aW9uOiBcIkNcIn1cbiAgLy8gICAgKGEgbm9uLXRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGFcbiAgLy8gICAgIG5vbi10YXJnZXRlZCBxdWVyeSlcbiAgLy8gIE46e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJYXCJ9IG1hdGNoZXMgVDp7Y29sbGVjdGlvbjogXCJDXCJ9XG4gIC8vICAgIChhIHRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGEgbm9uLXRhcmdldGVkIHF1ZXJ5KVxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCJ9IG1hdGNoZXMgVDp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn1cbiAgLy8gICAgKGEgbm9uLXRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGFcbiAgLy8gICAgIHRhcmdldGVkIHF1ZXJ5KVxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn0gbWF0Y2hlcyBUOntjb2xsZWN0aW9uOiBcIkNcIiwgaWQ6IFwiWFwifVxuICAvLyAgICAoYSB0YXJnZXRlZCB3cml0ZSB0byBhIGNvbGxlY3Rpb24gbWF0Y2hlcyBhIHRhcmdldGVkIHF1ZXJ5IHRhcmdldGVkXG4gIC8vICAgICBhdCB0aGUgc2FtZSBkb2N1bWVudClcbiAgLy8gIE46e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJYXCJ9IGRvZXMgbm90IG1hdGNoIFQ6e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJZXCJ9XG4gIC8vICAgIChhIHRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBkb2VzIG5vdCBtYXRjaCBhIHRhcmdldGVkIHF1ZXJ5XG4gIC8vICAgICB0YXJnZXRlZCBhdCBhIGRpZmZlcmVudCBkb2N1bWVudClcbiAgX21hdGNoZXM6IGZ1bmN0aW9uIChub3RpZmljYXRpb24sIHRyaWdnZXIpIHtcbiAgICAvLyBNb3N0IG5vdGlmaWNhdGlvbnMgdGhhdCB1c2UgdGhlIGNyb3NzYmFyIGhhdmUgYSBzdHJpbmcgYGNvbGxlY3Rpb25gIGFuZFxuICAgIC8vIG1heWJlIGFuIGBpZGAgdGhhdCBpcyBhIHN0cmluZyBvciBPYmplY3RJRC4gV2UncmUgYWxyZWFkeSBkaXZpZGluZyB1cFxuICAgIC8vIHRyaWdnZXJzIGJ5IGNvbGxlY3Rpb24sIGJ1dCBsZXQncyBmYXN0LXRyYWNrIFwibm9wZSwgZGlmZmVyZW50IElEXCIgKGFuZFxuICAgIC8vIGF2b2lkIHRoZSBvdmVybHkgZ2VuZXJpYyBFSlNPTi5lcXVhbHMpLiBUaGlzIG1ha2VzIGEgbm90aWNlYWJsZVxuICAgIC8vIHBlcmZvcm1hbmNlIGRpZmZlcmVuY2U7IHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9wdWxsLzM2OTdcbiAgICBpZiAodHlwZW9mKG5vdGlmaWNhdGlvbi5pZCkgPT09ICdzdHJpbmcnICYmXG4gICAgICAgIHR5cGVvZih0cmlnZ2VyLmlkKSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgbm90aWZpY2F0aW9uLmlkICE9PSB0cmlnZ2VyLmlkKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChub3RpZmljYXRpb24uaWQgaW5zdGFuY2VvZiBNb25nb0lELk9iamVjdElEICYmXG4gICAgICAgIHRyaWdnZXIuaWQgaW5zdGFuY2VvZiBNb25nb0lELk9iamVjdElEICYmXG4gICAgICAgICEgbm90aWZpY2F0aW9uLmlkLmVxdWFscyh0cmlnZ2VyLmlkKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3Qua2V5cyh0cmlnZ2VyKS5ldmVyeShmdW5jdGlvbiAoa2V5KSB7XG4gICAgICByZXR1cm4gIShrZXkgaW4gbm90aWZpY2F0aW9uKSB8fCBFSlNPTi5lcXVhbHModHJpZ2dlcltrZXldLCBub3RpZmljYXRpb25ba2V5XSk7XG4gICAgIH0pO1xuICB9XG59KTtcblxuLy8gVGhlIFwiaW52YWxpZGF0aW9uIGNyb3NzYmFyXCIgaXMgYSBzcGVjaWZpYyBpbnN0YW5jZSB1c2VkIGJ5IHRoZSBERFAgc2VydmVyIHRvXG4vLyBpbXBsZW1lbnQgd3JpdGUgZmVuY2Ugbm90aWZpY2F0aW9ucy4gTGlzdGVuZXIgY2FsbGJhY2tzIG9uIHRoaXMgY3Jvc3NiYXJcbi8vIHNob3VsZCBjYWxsIGJlZ2luV3JpdGUgb24gdGhlIGN1cnJlbnQgd3JpdGUgZmVuY2UgYmVmb3JlIHRoZXkgcmV0dXJuLCBpZiB0aGV5XG4vLyB3YW50IHRvIGRlbGF5IHRoZSB3cml0ZSBmZW5jZSBmcm9tIGZpcmluZyAoaWUsIHRoZSBERFAgbWV0aG9kLWRhdGEtdXBkYXRlZFxuLy8gbWVzc2FnZSBmcm9tIGJlaW5nIHNlbnQpLlxuRERQU2VydmVyLl9JbnZhbGlkYXRpb25Dcm9zc2JhciA9IG5ldyBERFBTZXJ2ZXIuX0Nyb3NzYmFyKHtcbiAgZmFjdE5hbWU6IFwiaW52YWxpZGF0aW9uLWNyb3NzYmFyLWxpc3RlbmVyc1wiXG59KTsiLCJpZiAocHJvY2Vzcy5lbnYuRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkwpIHtcbiAgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCA9XG4gICAgcHJvY2Vzcy5lbnYuRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkw7XG59XG5cbk1ldGVvci5zZXJ2ZXIgPSBuZXcgU2VydmVyKCk7XG5cbk1ldGVvci5yZWZyZXNoID0gYXN5bmMgZnVuY3Rpb24gKG5vdGlmaWNhdGlvbikge1xuICBhd2FpdCBERFBTZXJ2ZXIuX0ludmFsaWRhdGlvbkNyb3NzYmFyLmZpcmUobm90aWZpY2F0aW9uKTtcbn07XG5cbi8vIFByb3h5IHRoZSBwdWJsaWMgbWV0aG9kcyBvZiBNZXRlb3Iuc2VydmVyIHNvIHRoZXkgY2FuXG4vLyBiZSBjYWxsZWQgZGlyZWN0bHkgb24gTWV0ZW9yLlxuXG4gIFtcbiAgICAncHVibGlzaCcsXG4gICAgJ2lzQXN5bmNDYWxsJyxcbiAgICAnbWV0aG9kcycsXG4gICAgJ2NhbGwnLFxuICAgICdjYWxsQXN5bmMnLFxuICAgICdhcHBseScsXG4gICAgJ2FwcGx5QXN5bmMnLFxuICAgICdvbkNvbm5lY3Rpb24nLFxuICAgICdvbk1lc3NhZ2UnLFxuICBdLmZvckVhY2goXG4gIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBNZXRlb3JbbmFtZV0gPSBNZXRlb3Iuc2VydmVyW25hbWVdLmJpbmQoTWV0ZW9yLnNlcnZlcik7XG4gIH1cbik7XG4iLCJpbnRlcmZhY2UgQ2hhbmdlQ29sbGVjdG9yIHtcbiAgW2tleTogc3RyaW5nXTogYW55O1xufVxuXG5pbnRlcmZhY2UgRGF0YUVudHJ5IHtcbiAgc3Vic2NyaXB0aW9uSGFuZGxlOiBzdHJpbmc7XG4gIHZhbHVlOiBhbnk7XG59XG5cbmV4cG9ydCBjbGFzcyBEdW1teURvY3VtZW50VmlldyB7XG4gIHByaXZhdGUgZXhpc3RzSW46IFNldDxzdHJpbmc+O1xuICBwcml2YXRlIGRhdGFCeUtleTogTWFwPHN0cmluZywgRGF0YUVudHJ5W10+O1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuZXhpc3RzSW4gPSBuZXcgU2V0PHN0cmluZz4oKTsgLy8gc2V0IG9mIHN1YnNjcmlwdGlvbkhhbmRsZVxuICAgIHRoaXMuZGF0YUJ5S2V5ID0gbmV3IE1hcDxzdHJpbmcsIERhdGFFbnRyeVtdPigpOyAvLyBrZXktPiBbIHtzdWJzY3JpcHRpb25IYW5kbGUsIHZhbHVlfSBieSBwcmVjZWRlbmNlXVxuICB9XG5cbiAgZ2V0RmllbGRzKCk6IFJlY29yZDxzdHJpbmcsIG5ldmVyPiB7XG4gICAgcmV0dXJuIHt9O1xuICB9XG5cbiAgY2xlYXJGaWVsZChcbiAgICBzdWJzY3JpcHRpb25IYW5kbGU6IHN0cmluZywgXG4gICAga2V5OiBzdHJpbmcsIFxuICAgIGNoYW5nZUNvbGxlY3RvcjogQ2hhbmdlQ29sbGVjdG9yXG4gICk6IHZvaWQge1xuICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgY2hhbmdlRmllbGQoXG4gICAgc3Vic2NyaXB0aW9uSGFuZGxlOiBzdHJpbmcsXG4gICAga2V5OiBzdHJpbmcsXG4gICAgdmFsdWU6IGFueSxcbiAgICBjaGFuZ2VDb2xsZWN0b3I6IENoYW5nZUNvbGxlY3RvcixcbiAgICBpc0FkZD86IGJvb2xlYW5cbiAgKTogdm9pZCB7XG4gICAgY2hhbmdlQ29sbGVjdG9yW2tleV0gPSB2YWx1ZTtcbiAgfVxufSIsImltcG9ydCB7IER1bW15RG9jdW1lbnRWaWV3IH0gZnJvbSBcIi4vZHVtbXlfZG9jdW1lbnRfdmlld1wiO1xuaW1wb3J0IHsgU2Vzc2lvbkRvY3VtZW50VmlldyB9IGZyb20gXCIuL3Nlc3Npb25fZG9jdW1lbnRfdmlld1wiO1xuXG5pbnRlcmZhY2UgU2Vzc2lvbkNhbGxiYWNrcyB7XG4gIGFkZGVkOiAoY29sbGVjdGlvbk5hbWU6IHN0cmluZywgaWQ6IHN0cmluZywgZmllbGRzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiB2b2lkO1xuICBjaGFuZ2VkOiAoY29sbGVjdGlvbk5hbWU6IHN0cmluZywgaWQ6IHN0cmluZywgZmllbGRzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiB2b2lkO1xuICByZW1vdmVkOiAoY29sbGVjdGlvbk5hbWU6IHN0cmluZywgaWQ6IHN0cmluZykgPT4gdm9pZDtcbn1cblxudHlwZSBEb2N1bWVudFZpZXcgPSBTZXNzaW9uRG9jdW1lbnRWaWV3IHwgRHVtbXlEb2N1bWVudFZpZXc7XG5cbmV4cG9ydCBjbGFzcyBTZXNzaW9uQ29sbGVjdGlvblZpZXcge1xuICBwcml2YXRlIHJlYWRvbmx5IGNvbGxlY3Rpb25OYW1lOiBzdHJpbmc7XG4gIHByaXZhdGUgcmVhZG9ubHkgZG9jdW1lbnRzOiBNYXA8c3RyaW5nLCBEb2N1bWVudFZpZXc+O1xuICBwcml2YXRlIHJlYWRvbmx5IGNhbGxiYWNrczogU2Vzc2lvbkNhbGxiYWNrcztcblxuICAvKipcbiAgICogUmVwcmVzZW50cyBhIGNsaWVudCdzIHZpZXcgb2YgYSBzaW5nbGUgY29sbGVjdGlvblxuICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUgLSBOYW1lIG9mIHRoZSBjb2xsZWN0aW9uIGl0IHJlcHJlc2VudHNcbiAgICogQHBhcmFtIHNlc3Npb25DYWxsYmFja3MgLSBUaGUgY2FsbGJhY2tzIGZvciBhZGRlZCwgY2hhbmdlZCwgcmVtb3ZlZFxuICAgKi9cbiAgY29uc3RydWN0b3IoY29sbGVjdGlvbk5hbWU6IHN0cmluZywgc2Vzc2lvbkNhbGxiYWNrczogU2Vzc2lvbkNhbGxiYWNrcykge1xuICAgIHRoaXMuY29sbGVjdGlvbk5hbWUgPSBjb2xsZWN0aW9uTmFtZTtcbiAgICB0aGlzLmRvY3VtZW50cyA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLmNhbGxiYWNrcyA9IHNlc3Npb25DYWxsYmFja3M7XG4gIH1cblxuICBwdWJsaWMgaXNFbXB0eSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5kb2N1bWVudHMuc2l6ZSA9PT0gMDtcbiAgfVxuXG4gIHB1YmxpYyBkaWZmKHByZXZpb3VzOiBTZXNzaW9uQ29sbGVjdGlvblZpZXcpOiB2b2lkIHtcbiAgICBEaWZmU2VxdWVuY2UuZGlmZk1hcHMocHJldmlvdXMuZG9jdW1lbnRzLCB0aGlzLmRvY3VtZW50cywge1xuICAgICAgYm90aDogdGhpcy5kaWZmRG9jdW1lbnQuYmluZCh0aGlzKSxcbiAgICAgIHJpZ2h0T25seTogKGlkOiBzdHJpbmcsIG5vd0RWOiBEb2N1bWVudFZpZXcpID0+IHtcbiAgICAgICAgdGhpcy5jYWxsYmFja3MuYWRkZWQodGhpcy5jb2xsZWN0aW9uTmFtZSwgaWQsIG5vd0RWLmdldEZpZWxkcygpKTtcbiAgICAgIH0sXG4gICAgICBsZWZ0T25seTogKGlkOiBzdHJpbmcsIHByZXZEVjogRG9jdW1lbnRWaWV3KSA9PiB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tzLnJlbW92ZWQodGhpcy5jb2xsZWN0aW9uTmFtZSwgaWQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBkaWZmRG9jdW1lbnQoaWQ6IHN0cmluZywgcHJldkRWOiBEb2N1bWVudFZpZXcsIG5vd0RWOiBEb2N1bWVudFZpZXcpOiB2b2lkIHtcbiAgICBjb25zdCBmaWVsZHM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICBcbiAgICBEaWZmU2VxdWVuY2UuZGlmZk9iamVjdHMocHJldkRWLmdldEZpZWxkcygpLCBub3dEVi5nZXRGaWVsZHMoKSwge1xuICAgICAgYm90aDogKGtleTogc3RyaW5nLCBwcmV2OiBhbnksIG5vdzogYW55KSA9PiB7XG4gICAgICAgIGlmICghRUpTT04uZXF1YWxzKHByZXYsIG5vdykpIHtcbiAgICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHJpZ2h0T25seTogKGtleTogc3RyaW5nLCBub3c6IGFueSkgPT4ge1xuICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICBsZWZ0T25seTogKGtleTogc3RyaW5nLCBwcmV2OiBhbnkpID0+IHtcbiAgICAgICAgZmllbGRzW2tleV0gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgdGhpcy5jYWxsYmFja3MuY2hhbmdlZCh0aGlzLmNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKTtcbiAgfVxuXG4gIHB1YmxpYyBhZGRlZChzdWJzY3JpcHRpb25IYW5kbGU6IHN0cmluZywgaWQ6IHN0cmluZywgZmllbGRzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogdm9pZCB7XG4gICAgbGV0IGRvY1ZpZXc6IERvY3VtZW50VmlldyB8IHVuZGVmaW5lZCA9IHRoaXMuZG9jdW1lbnRzLmdldChpZCk7XG4gICAgbGV0IGFkZGVkID0gZmFsc2U7XG5cbiAgICBpZiAoIWRvY1ZpZXcpIHtcbiAgICAgIGFkZGVkID0gdHJ1ZTtcbiAgICAgIGlmIChNZXRlb3Iuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3kodGhpcy5jb2xsZWN0aW9uTmFtZSkudXNlRHVtbXlEb2N1bWVudFZpZXcpIHtcbiAgICAgICAgZG9jVmlldyA9IG5ldyBEdW1teURvY3VtZW50VmlldygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jVmlldyA9IG5ldyBTZXNzaW9uRG9jdW1lbnRWaWV3KCk7XG4gICAgICB9XG4gICAgICB0aGlzLmRvY3VtZW50cy5zZXQoaWQsIGRvY1ZpZXcpO1xuICAgIH1cblxuICAgIGRvY1ZpZXcuZXhpc3RzSW4uYWRkKHN1YnNjcmlwdGlvbkhhbmRsZSk7XG4gICAgY29uc3QgY2hhbmdlQ29sbGVjdG9yOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG5cbiAgICBPYmplY3QuZW50cmllcyhmaWVsZHMpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgZG9jVmlldyEuY2hhbmdlRmllbGQoXG4gICAgICAgIHN1YnNjcmlwdGlvbkhhbmRsZSxcbiAgICAgICAga2V5LFxuICAgICAgICB2YWx1ZSxcbiAgICAgICAgY2hhbmdlQ29sbGVjdG9yLFxuICAgICAgICB0cnVlXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgaWYgKGFkZGVkKSB7XG4gICAgICB0aGlzLmNhbGxiYWNrcy5hZGRlZCh0aGlzLmNvbGxlY3Rpb25OYW1lLCBpZCwgY2hhbmdlQ29sbGVjdG9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jYWxsYmFja3MuY2hhbmdlZCh0aGlzLmNvbGxlY3Rpb25OYW1lLCBpZCwgY2hhbmdlQ29sbGVjdG9yKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgY2hhbmdlZChzdWJzY3JpcHRpb25IYW5kbGU6IHN0cmluZywgaWQ6IHN0cmluZywgY2hhbmdlZDogUmVjb3JkPHN0cmluZywgYW55Pik6IHZvaWQge1xuICAgIGNvbnN0IGNoYW5nZWRSZXN1bHQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICBjb25zdCBkb2NWaWV3ID0gdGhpcy5kb2N1bWVudHMuZ2V0KGlkKTtcblxuICAgIGlmICghZG9jVmlldykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCBlbGVtZW50IHdpdGggaWQgJHtpZH0gdG8gY2hhbmdlYCk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmVudHJpZXMoY2hhbmdlZCkuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBkb2NWaWV3LmNsZWFyRmllbGQoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIGNoYW5nZWRSZXN1bHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZG9jVmlldy5jaGFuZ2VGaWVsZChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgdmFsdWUsIGNoYW5nZWRSZXN1bHQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5jYWxsYmFja3MuY2hhbmdlZCh0aGlzLmNvbGxlY3Rpb25OYW1lLCBpZCwgY2hhbmdlZFJlc3VsdCk7XG4gIH1cblxuICBwdWJsaWMgcmVtb3ZlZChzdWJzY3JpcHRpb25IYW5kbGU6IHN0cmluZywgaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IGRvY1ZpZXcgPSB0aGlzLmRvY3VtZW50cy5nZXQoaWQpO1xuXG4gICAgaWYgKCFkb2NWaWV3KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFJlbW92ZWQgbm9uZXhpc3RlbnQgZG9jdW1lbnQgJHtpZH1gKTtcbiAgICB9XG5cbiAgICBkb2NWaWV3LmV4aXN0c0luLmRlbGV0ZShzdWJzY3JpcHRpb25IYW5kbGUpO1xuXG4gICAgaWYgKGRvY1ZpZXcuZXhpc3RzSW4uc2l6ZSA9PT0gMCkge1xuICAgICAgLy8gaXQgaXMgZ29uZSBmcm9tIGV2ZXJ5b25lXG4gICAgICB0aGlzLmNhbGxiYWNrcy5yZW1vdmVkKHRoaXMuY29sbGVjdGlvbk5hbWUsIGlkKTtcbiAgICAgIHRoaXMuZG9jdW1lbnRzLmRlbGV0ZShpZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNoYW5nZWQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgIC8vIHJlbW92ZSB0aGlzIHN1YnNjcmlwdGlvbiBmcm9tIGV2ZXJ5IHByZWNlZGVuY2UgbGlzdFxuICAgICAgLy8gYW5kIHJlY29yZCB0aGUgY2hhbmdlc1xuICAgICAgZG9jVmlldy5kYXRhQnlLZXkuZm9yRWFjaCgocHJlY2VkZW5jZUxpc3QsIGtleSkgPT4ge1xuICAgICAgICBkb2NWaWV3LmNsZWFyRmllbGQoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIGNoYW5nZWQpO1xuICAgICAgfSk7XG4gICAgICB0aGlzLmNhbGxiYWNrcy5jaGFuZ2VkKHRoaXMuY29sbGVjdGlvbk5hbWUsIGlkLCBjaGFuZ2VkKTtcbiAgICB9XG4gIH1cbn0iLCJpbnRlcmZhY2UgUHJlY2VkZW5jZUl0ZW0ge1xuICBzdWJzY3JpcHRpb25IYW5kbGU6IHN0cmluZztcbiAgdmFsdWU6IGFueTtcbn1cblxuaW50ZXJmYWNlIENoYW5nZUNvbGxlY3RvciB7XG4gIFtrZXk6IHN0cmluZ106IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIFNlc3Npb25Eb2N1bWVudFZpZXcge1xuICBwcml2YXRlIGV4aXN0c0luOiBTZXQ8c3RyaW5nPjtcbiAgcHJpdmF0ZSBkYXRhQnlLZXk6IE1hcDxzdHJpbmcsIFByZWNlZGVuY2VJdGVtW10+O1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuZXhpc3RzSW4gPSBuZXcgU2V0KCk7IC8vIHNldCBvZiBzdWJzY3JpcHRpb25IYW5kbGVcbiAgICAvLyBNZW1vcnkgR3Jvd3RoXG4gICAgdGhpcy5kYXRhQnlLZXkgPSBuZXcgTWFwKCk7IC8vIGtleS0+IFsge3N1YnNjcmlwdGlvbkhhbmRsZSwgdmFsdWV9IGJ5IHByZWNlZGVuY2VdXG4gIH1cblxuICBnZXRGaWVsZHMoKTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgY29uc3QgcmV0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgdGhpcy5kYXRhQnlLZXkuZm9yRWFjaCgocHJlY2VkZW5jZUxpc3QsIGtleSkgPT4ge1xuICAgICAgcmV0W2tleV0gPSBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmV0O1xuICB9XG5cbiAgY2xlYXJGaWVsZChcbiAgICBzdWJzY3JpcHRpb25IYW5kbGU6IHN0cmluZyxcbiAgICBrZXk6IHN0cmluZyxcbiAgICBjaGFuZ2VDb2xsZWN0b3I6IENoYW5nZUNvbGxlY3RvclxuICApOiB2b2lkIHtcbiAgICAvLyBQdWJsaXNoIEFQSSBpZ25vcmVzIF9pZCBpZiBwcmVzZW50IGluIGZpZWxkc1xuICAgIGlmIChrZXkgPT09IFwiX2lkXCIpIHJldHVybjtcblxuICAgIGNvbnN0IHByZWNlZGVuY2VMaXN0ID0gdGhpcy5kYXRhQnlLZXkuZ2V0KGtleSk7XG4gICAgLy8gSXQncyBva2F5IHRvIGNsZWFyIGZpZWxkcyB0aGF0IGRpZG4ndCBleGlzdC4gTm8gbmVlZCB0byB0aHJvd1xuICAgIC8vIGFuIGVycm9yLlxuICAgIGlmICghcHJlY2VkZW5jZUxpc3QpIHJldHVybjtcblxuICAgIGxldCByZW1vdmVkVmFsdWU6IGFueSA9IHVuZGVmaW5lZDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJlY2VkZW5jZUxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHByZWNlZGVuY2UgPSBwcmVjZWRlbmNlTGlzdFtpXTtcbiAgICAgIGlmIChwcmVjZWRlbmNlLnN1YnNjcmlwdGlvbkhhbmRsZSA9PT0gc3Vic2NyaXB0aW9uSGFuZGxlKSB7XG4gICAgICAgIC8vIFRoZSB2aWV3J3MgdmFsdWUgY2FuIG9ubHkgY2hhbmdlIGlmIHRoaXMgc3Vic2NyaXB0aW9uIGlzIHRoZSBvbmUgdGhhdFxuICAgICAgICAvLyB1c2VkIHRvIGhhdmUgcHJlY2VkZW5jZS5cbiAgICAgICAgaWYgKGkgPT09IDApIHJlbW92ZWRWYWx1ZSA9IHByZWNlZGVuY2UudmFsdWU7XG4gICAgICAgIHByZWNlZGVuY2VMaXN0LnNwbGljZShpLCAxKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHByZWNlZGVuY2VMaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5kYXRhQnlLZXkuZGVsZXRlKGtleSk7XG4gICAgICBjaGFuZ2VDb2xsZWN0b3Jba2V5XSA9IHVuZGVmaW5lZDtcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgcmVtb3ZlZFZhbHVlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICFFSlNPTi5lcXVhbHMocmVtb3ZlZFZhbHVlLCBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZSlcbiAgICApIHtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gcHJlY2VkZW5jZUxpc3RbMF0udmFsdWU7XG4gICAgfVxuICB9XG5cbiAgY2hhbmdlRmllbGQoXG4gICAgc3Vic2NyaXB0aW9uSGFuZGxlOiBzdHJpbmcsXG4gICAga2V5OiBzdHJpbmcsXG4gICAgdmFsdWU6IGFueSxcbiAgICBjaGFuZ2VDb2xsZWN0b3I6IENoYW5nZUNvbGxlY3RvcixcbiAgICBpc0FkZDogYm9vbGVhbiA9IGZhbHNlXG4gICk6IHZvaWQge1xuICAgIC8vIFB1Ymxpc2ggQVBJIGlnbm9yZXMgX2lkIGlmIHByZXNlbnQgaW4gZmllbGRzXG4gICAgaWYgKGtleSA9PT0gXCJfaWRcIikgcmV0dXJuO1xuXG4gICAgLy8gRG9uJ3Qgc2hhcmUgc3RhdGUgd2l0aCB0aGUgZGF0YSBwYXNzZWQgaW4gYnkgdGhlIHVzZXIuXG4gICAgdmFsdWUgPSBFSlNPTi5jbG9uZSh2YWx1ZSk7XG5cbiAgICBpZiAoIXRoaXMuZGF0YUJ5S2V5LmhhcyhrZXkpKSB7XG4gICAgICB0aGlzLmRhdGFCeUtleS5zZXQoa2V5LCBbXG4gICAgICAgIHsgc3Vic2NyaXB0aW9uSGFuZGxlOiBzdWJzY3JpcHRpb25IYW5kbGUsIHZhbHVlOiB2YWx1ZSB9LFxuICAgICAgXSk7XG4gICAgICBjaGFuZ2VDb2xsZWN0b3Jba2V5XSA9IHZhbHVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHByZWNlZGVuY2VMaXN0ID0gdGhpcy5kYXRhQnlLZXkuZ2V0KGtleSkhO1xuICAgIGxldCBlbHQ6IFByZWNlZGVuY2VJdGVtIHwgdW5kZWZpbmVkO1xuXG4gICAgaWYgKCFpc0FkZCkge1xuICAgICAgZWx0ID0gcHJlY2VkZW5jZUxpc3QuZmluZChcbiAgICAgICAgKHByZWNlZGVuY2UpID0+IHByZWNlZGVuY2Uuc3Vic2NyaXB0aW9uSGFuZGxlID09PSBzdWJzY3JpcHRpb25IYW5kbGVcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKGVsdCkge1xuICAgICAgaWYgKGVsdCA9PT0gcHJlY2VkZW5jZUxpc3RbMF0gJiYgIUVKU09OLmVxdWFscyh2YWx1ZSwgZWx0LnZhbHVlKSkge1xuICAgICAgICAvLyB0aGlzIHN1YnNjcmlwdGlvbiBpcyBjaGFuZ2luZyB0aGUgdmFsdWUgb2YgdGhpcyBmaWVsZC5cbiAgICAgICAgY2hhbmdlQ29sbGVjdG9yW2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGVsdC52YWx1ZSA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0aGlzIHN1YnNjcmlwdGlvbiBpcyBuZXdseSBjYXJpbmcgYWJvdXQgdGhpcyBmaWVsZFxuICAgICAgcHJlY2VkZW5jZUxpc3QucHVzaCh7IHN1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZTogdmFsdWUgfSk7XG4gICAgfVxuICB9XG59Il19
