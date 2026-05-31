Package["core-runtime"].queue("webapp",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Boilerplate = Package['boilerplate-generator'].Boilerplate;
var WebAppHashing = Package['webapp-hashing'].WebAppHashing;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var WebApp, WebAppInternals, main;

var require = meteorInstall({"node_modules":{"meteor":{"webapp":{"webapp_server.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/webapp/webapp_server.js                                                                         //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    module1.export({
      WebApp: () => WebApp,
      WebAppInternals: () => WebAppInternals,
      getGroupInfo: () => getGroupInfo
    });
    let assert;
    module1.link("assert", {
      default(v) {
        assert = v;
      }
    }, 0);
    let readFileSync, chmodSync, chownSync;
    module1.link("fs", {
      readFileSync(v) {
        readFileSync = v;
      },
      chmodSync(v) {
        chmodSync = v;
      },
      chownSync(v) {
        chownSync = v;
      }
    }, 1);
    let createServer;
    module1.link("http", {
      createServer(v) {
        createServer = v;
      }
    }, 2);
    let userInfo;
    module1.link("os", {
      userInfo(v) {
        userInfo = v;
      }
    }, 3);
    let pathJoin, pathDirname;
    module1.link("path", {
      join(v) {
        pathJoin = v;
      },
      dirname(v) {
        pathDirname = v;
      }
    }, 4);
    let parseUrl;
    module1.link("url", {
      parse(v) {
        parseUrl = v;
      }
    }, 5);
    let createHash;
    module1.link("crypto", {
      createHash(v) {
        createHash = v;
      }
    }, 6);
    let express;
    module1.link("express", {
      default(v) {
        express = v;
      }
    }, 7);
    let compress;
    module1.link("compression", {
      default(v) {
        compress = v;
      }
    }, 8);
    let cookieParser;
    module1.link("cookie-parser", {
      default(v) {
        cookieParser = v;
      }
    }, 9);
    let qs;
    module1.link("qs", {
      default(v) {
        qs = v;
      }
    }, 10);
    let parseRequest;
    module1.link("parseurl", {
      default(v) {
        parseRequest = v;
      }
    }, 11);
    let lookupUserAgent;
    module1.link("useragent-ng", {
      lookup(v) {
        lookupUserAgent = v;
      }
    }, 12);
    let isModern;
    module1.link("meteor/modern-browsers", {
      isModern(v) {
        isModern = v;
      }
    }, 13);
    let send;
    module1.link("send", {
      default(v) {
        send = v;
      }
    }, 14);
    let removeExistingSocketFile, registerSocketFileCleanup;
    module1.link("./socket_file.js", {
      removeExistingSocketFile(v) {
        removeExistingSocketFile = v;
      },
      registerSocketFileCleanup(v) {
        registerSocketFileCleanup = v;
      }
    }, 15);
    let cluster;
    module1.link("cluster", {
      default(v) {
        cluster = v;
      }
    }, 16);
    let execSync;
    module1.link("child_process", {
      execSync(v) {
        execSync = v;
      }
    }, 17);
    let onMessage;
    module1.link("meteor/inter-process-messaging", {
      onMessage(v) {
        onMessage = v;
      }
    }, 18);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var SHORT_SOCKET_TIMEOUT = 5 * 1000;
    var LONG_SOCKET_TIMEOUT = 120 * 1000;
    const createExpressApp = () => {
      const app = express();
      // Security and performace headers
      // these headers come from these docs: https://expressjs.com/en/api.html#app.settings.table
      app.set('x-powered-by', false);
      app.set('etag', false);
      app.set('query parser', qs.parse);
      return app;
    };
    const WebApp = {};
    const WebAppInternals = {};
    const hasOwn = Object.prototype.hasOwnProperty;
    WebAppInternals.NpmModules = {
      express: {
        version: Npm.require('express/package.json').version,
        module: express
      }
    };

    // More of a convenience for the end user
    WebApp.express = express;

    // Though we might prefer to use web.browser (modern) as the default
    // architecture, safety requires a more compatible defaultArch.
    WebApp.defaultArch = 'web.browser.legacy';

    // XXX maps archs to manifests
    WebApp.clientPrograms = {};

    // XXX maps archs to program path on filesystem
    var archPath = {};
    var bundledJsCssUrlRewriteHook = function (url) {
      var bundledPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '';
      return bundledPrefix + url;
    };
    var sha1 = function (contents) {
      var hash = createHash('sha1');
      hash.update(contents);
      return hash.digest('hex');
    };
    function shouldCompress(req, res) {
      if (req.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false;
      }

      // fallback to standard filter function
      return compress.filter(req, res);
    }

    // #BrowserIdentification
    //
    // We have multiple places that want to identify the browser: the
    // unsupported browser page, the appcache package, and, eventually
    // delivering browser polyfills only as needed.
    //
    // To avoid detecting the browser in multiple places ad-hoc, we create a
    // Meteor "browser" object. It uses but does not expose the npm
    // useragent module (we could choose a different mechanism to identify
    // the browser in the future if we wanted to).  The browser object
    // contains
    //
    // * `name`: the name of the browser in camel case
    // * `major`, `minor`, `patch`: integers describing the browser version
    //
    // Also here is an early version of a Meteor `request` object, intended
    // to be a high-level description of the request without exposing
    // details of Express's low-level `req`.  Currently it contains:
    //
    // * `browser`: browser identification object described above
    // * `url`: parsed url, including parsed query params
    //
    // As a temporary hack there is a `categorizeRequest` function on WebApp which
    // converts a Express `req` to a Meteor `request`. This can go away once smart
    // packages such as appcache are being passed a `request` object directly when
    // they serve content.
    //
    // This allows `request` to be used uniformly: it is passed to the html
    // attributes hook, and the appcache package can use it when deciding
    // whether to generate a 404 for the manifest.
    //
    // Real routing / server side rendering will probably refactor this
    // heavily.

    // e.g. "Mobile Safari" => "mobileSafari"
    var camelCase = function (name) {
      var parts = name.split(' ');
      parts[0] = parts[0].toLowerCase();
      for (var i = 1; i < parts.length; ++i) {
        parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substring(1);
      }
      return parts.join('');
    };
    var identifyBrowser = function (userAgentString) {
      if (!userAgentString) {
        return {
          name: 'unknown',
          major: 0,
          minor: 0,
          patch: 0
        };
      }
      var userAgent = lookupUserAgent(userAgentString);
      return {
        name: camelCase(userAgent.family),
        major: +userAgent.major,
        minor: +userAgent.minor,
        patch: +userAgent.patch
      };
    };

    // XXX Refactor as part of implementing real routing.
    WebAppInternals.identifyBrowser = identifyBrowser;
    WebApp.categorizeRequest = function (req) {
      if (req.browser && req.arch && typeof req.modern === 'boolean') {
        // Already categorized.
        return req;
      }
      const browser = identifyBrowser(req.headers['user-agent']);
      const modern = isModern(browser);
      const path = typeof req.pathname === 'string' ? req.pathname : parseRequest(req).pathname;
      const categorized = {
        browser,
        modern,
        path,
        arch: WebApp.defaultArch,
        url: parseUrl(req.url, true),
        dynamicHead: req.dynamicHead,
        dynamicBody: req.dynamicBody,
        headers: req.headers,
        cookies: req.cookies
      };
      const pathParts = path.split('/');
      const archKey = pathParts[1];
      if (archKey.startsWith('__')) {
        const archCleaned = 'web.' + archKey.slice(2);
        if (hasOwn.call(WebApp.clientPrograms, archCleaned)) {
          pathParts.splice(1, 1); // Remove the archKey part.
          return Object.assign(categorized, {
            arch: archCleaned,
            path: pathParts.join('/')
          });
        }
      }

      // TODO Perhaps one day we could infer Cordova clients here, so that we
      // wouldn't have to use prefixed "/__cordova/..." URLs.
      const preferredArchOrder = isModern(browser) ? ['web.browser', 'web.browser.legacy'] : ['web.browser.legacy', 'web.browser'];
      for (const arch of preferredArchOrder) {
        // If our preferred arch is not available, it's better to use another
        // client arch that is available than to guarantee the site won't work
        // by returning an unknown arch. For example, if web.browser.legacy is
        // excluded using the --exclude-archs command-line option, legacy
        // clients are better off receiving web.browser (which might actually
        // work) than receiving an HTTP 404 response. If none of the archs in
        // preferredArchOrder are defined, only then should we send a 404.
        if (hasOwn.call(WebApp.clientPrograms, arch)) {
          return Object.assign(categorized, {
            arch
          });
        }
      }
      return categorized;
    };

    // HTML attribute hooks: functions to be called to determine any attributes to
    // be added to the '<html>' tag. Each function is passed a 'request' object (see
    // #BrowserIdentification) and should return null or object.
    var htmlAttributeHooks = [];
    var getHtmlAttributes = function (request) {
      var combinedAttributes = {};
      (htmlAttributeHooks || []).forEach(function (hook) {
        var attributes = hook(request);
        if (attributes === null) return;
        if (typeof attributes !== 'object') throw Error('HTML attribute hook must return null or object');
        Object.assign(combinedAttributes, attributes);
      });
      return combinedAttributes;
    };
    WebApp.addHtmlAttributeHook = function (hook) {
      htmlAttributeHooks.push(hook);
    };

    // Serve app HTML for this URL?
    var appUrl = function (url) {
      if (url === '/favicon.ico' || url === '/robots.txt') return false;

      // NOTE: app.manifest is not a web standard like favicon.ico and
      // robots.txt. It is a file name we have chosen to use for HTML5
      // appcache URLs. It is included here to prevent using an appcache
      // then removing it from poisoning an app permanently. Eventually,
      // once we have server side routing, this won't be needed as
      // unknown URLs with return a 404 automatically.
      if (url === '/app.manifest') return false;

      // Avoid serving app HTML for declared routes such as /sockjs/.
      if (RoutePolicy.classify(url)) return false;

      // we currently return app HTML on all URLs by default
      return true;
    };

    // We need to calculate the client hash after all packages have loaded
    // to give them a chance to populate __meteor_runtime_config__.
    //
    // Calculating the hash during startup means that packages can only
    // populate __meteor_runtime_config__ during load, not during startup.
    //
    // Calculating instead it at the beginning of main after all startup
    // hooks had run would allow packages to also populate
    // __meteor_runtime_config__ during startup, but that's too late for
    // autoupdate because it needs to have the client hash at startup to
    // insert the auto update version itself into
    // __meteor_runtime_config__ to get it to the client.
    //
    // An alternative would be to give autoupdate a "post-start,
    // pre-listen" hook to allow it to insert the auto update version at
    // the right moment.

    Meteor.startup(function () {
      function getter(key) {
        return function (arch) {
          arch = arch || WebApp.defaultArch;
          const program = WebApp.clientPrograms[arch];
          const value = program && program[key];
          // If this is the first time we have calculated this hash,
          // program[key] will be a thunk (lazy function with no parameters)
          // that we should call to do the actual computation.
          return typeof value === 'function' ? program[key] = value() : value;
        };
      }
      WebApp.calculateClientHash = WebApp.clientHash = getter('version');
      WebApp.calculateClientHashRefreshable = getter('versionRefreshable');
      WebApp.calculateClientHashNonRefreshable = getter('versionNonRefreshable');
      WebApp.calculateClientHashReplaceable = getter('versionReplaceable');
      WebApp.getRefreshableAssets = getter('refreshableAssets');
    });

    // When we have a request pending, we want the socket timeout to be long, to
    // give ourselves a while to serve it, and to allow sockjs long polls to
    // complete.  On the other hand, we want to close idle sockets relatively
    // quickly, so that we can shut down relatively promptly but cleanly, without
    // cutting off anyone's response.
    WebApp._timeoutAdjustmentRequestCallback = function (req, res) {
      // this is really just req.socket.setTimeout(LONG_SOCKET_TIMEOUT);
      req.setTimeout(LONG_SOCKET_TIMEOUT);
      // Insert our new finish listener to run BEFORE the existing one which removes
      // the response from the socket.
      var finishListeners = res.listeners('finish');
      // XXX Apparently in Node 0.12 this event was called 'prefinish'.
      // https://github.com/joyent/node/commit/7c9b6070
      // But it has switched back to 'finish' in Node v4:
      // https://github.com/nodejs/node/pull/1411
      res.removeAllListeners('finish');
      res.on('finish', function () {
        res.setTimeout(SHORT_SOCKET_TIMEOUT);
      });
      Object.values(finishListeners).forEach(function (l) {
        res.on('finish', l);
      });
    };

    // Will be updated by main before we listen.
    // Map from client arch to boilerplate object.
    // Boilerplate object has:
    //   - func: XXX
    //   - baseData: XXX
    var boilerplateByArch = {};

    // Register a callback function that can selectively modify boilerplate
    // data given arguments (request, data, arch). The key should be a unique
    // identifier, to prevent accumulating duplicate callbacks from the same
    // call site over time. Callbacks will be called in the order they were
    // registered. A callback should return false if it did not make any
    // changes affecting the boilerplate. Passing null deletes the callback.
    // Any previous callback registered for this key will be returned.
    const boilerplateDataCallbacks = Object.create(null);
    WebAppInternals.registerBoilerplateDataCallback = function (key, callback) {
      const previousCallback = boilerplateDataCallbacks[key];
      if (typeof callback === 'function') {
        boilerplateDataCallbacks[key] = callback;
      } else {
        assert.strictEqual(callback, null);
        delete boilerplateDataCallbacks[key];
      }

      // Return the previous callback in case the new callback needs to call
      // it; for example, when the new callback is a wrapper for the old.
      return previousCallback || null;
    };

    // Given a request (as returned from `categorizeRequest`), return the
    // boilerplate HTML to serve for that request.
    //
    // If a previous Express middleware has rendered content for the head or body,
    // returns the boilerplate with that content patched in otherwise
    // memoizes on HTML attributes (used by, eg, appcache) and whether inline
    // scripts are currently allowed.
    // XXX so far this function is always called with arch === 'web.browser'
    function getBoilerplate(request, arch) {
      return getBoilerplateAsync(request, arch);
    }

    /**
     * @summary Takes a runtime configuration object and
     * returns an encoded runtime string.
     * @locus Server
     * @param {Object} rtimeConfig
     * @returns {String}
     */
    WebApp.encodeRuntimeConfig = function (rtimeConfig) {
      return JSON.stringify(encodeURIComponent(JSON.stringify(rtimeConfig)));
    };

    /**
     * @summary Takes an encoded runtime string and returns
     * a runtime configuration object.
     * @locus Server
     * @param {String} rtimeConfigString
     * @returns {Object}
     */
    WebApp.decodeRuntimeConfig = function (rtimeConfigStr) {
      return JSON.parse(decodeURIComponent(JSON.parse(rtimeConfigStr)));
    };
    const runtimeConfig = {
      // hooks will contain the callback functions
      // set by the caller to addRuntimeConfigHook
      hooks: new Hook(),
      // updateHooks will contain the callback functions
      // set by the caller to addUpdatedNotifyHook
      updateHooks: new Hook(),
      // isUpdatedByArch is an object containing fields for each arch
      // that this server supports.
      // - Each field will be true when the server updates the runtimeConfig for that arch.
      // - When the hook callback is called the update field in the callback object will be
      // set to isUpdatedByArch[arch].
      // = isUpdatedyByArch[arch] is reset to false after the callback.
      // This enables the caller to cache data efficiently so they do not need to
      // decode & update data on every callback when the runtimeConfig is not changing.
      isUpdatedByArch: {}
    };

    /**
     * @name addRuntimeConfigHookCallback(options)
     * @locus Server
     * @isprototype true
     * @summary Callback for `addRuntimeConfigHook`.
     *
     * If the handler returns a _falsy_ value the hook will not
     * modify the runtime configuration.
     *
     * If the handler returns a _String_ the hook will substitute
     * the string for the encoded configuration string.
     *
     * **Warning:** the hook does not check the return value at all it is
     * the responsibility of the caller to get the formatting correct using
     * the helper functions.
     *
     * `addRuntimeConfigHookCallback` takes only one `Object` argument
     * with the following fields:
     * @param {Object} options
     * @param {String} options.arch The architecture of the client
     * requesting a new runtime configuration. This can be one of
     * `web.browser`, `web.browser.legacy` or `web.cordova`.
     * @param {Object} options.request
     * A NodeJs [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
     * https://nodejs.org/api/http.html#http_class_http_incomingmessage
     * `Object` that can be used to get information about the incoming request.
     * @param {String} options.encodedCurrentConfig The current configuration object
     * encoded as a string for inclusion in the root html.
     * @param {Boolean} options.updated `true` if the config for this architecture
     * has been updated since last called, otherwise `false`. This flag can be used
     * to cache the decoding/encoding for each architecture.
     */

    /**
     * @summary Hook that calls back when the meteor runtime configuration,
     * `__meteor_runtime_config__` is being sent to any client.
     *
     * **returns**: <small>_Object_</small> `{ stop: function, callback: function }`
     * - `stop` <small>_Function_</small> Call `stop()` to stop getting callbacks.
     * - `callback` <small>_Function_</small> The passed in `callback`.
     * @locus Server
     * @param {addRuntimeConfigHookCallback} callback
     * See `addRuntimeConfigHookCallback` description.
     * @returns {Object} {{ stop: function, callback: function }}
     * Call the returned `stop()` to stop getting callbacks.
     * The passed in `callback` is returned also.
     */
    WebApp.addRuntimeConfigHook = function (callback) {
      return runtimeConfig.hooks.register(callback);
    };
    async function getBoilerplateAsync(request, arch, response) {
      let boilerplate = boilerplateByArch[arch];
      await runtimeConfig.hooks.forEachAsync(async hook => {
        const meteorRuntimeConfig = await hook({
          arch,
          request,
          encodedCurrentConfig: boilerplate.baseData.meteorRuntimeConfig,
          updated: runtimeConfig.isUpdatedByArch[arch]
        });
        if (!meteorRuntimeConfig) return true;
        boilerplate.baseData = Object.assign({}, boilerplate.baseData, {
          meteorRuntimeConfig
        });
        return true;
      });
      runtimeConfig.isUpdatedByArch[arch] = false;
      const {
        dynamicHead,
        dynamicBody
      } = request;
      const data = Object.assign({}, boilerplate.baseData, {
        htmlAttributes: getHtmlAttributes(request)
      }, {
        dynamicHead,
        dynamicBody
      });
      let madeChanges = false;
      let promise = Promise.resolve();
      Object.keys(boilerplateDataCallbacks).forEach(key => {
        promise = promise.then(() => {
          const callback = boilerplateDataCallbacks[key];
          return callback(request, data, arch, response);
        }).then(result => {
          // Callbacks should return false if they did not make any changes.
          if (result !== false) {
            madeChanges = true;
          }
        });
      });
      return promise.then(() => ({
        stream: boilerplate.toHTMLStream(data),
        statusCode: data.statusCode,
        headers: data.headers
      }));
    }

    /**
     * @name addUpdatedNotifyHookCallback(options)
     * @summary callback handler for `addupdatedNotifyHook`
     * @isprototype true
     * @locus Server
     * @param {Object} options
     * @param {String} options.arch The architecture that is being updated.
     * This can be one of `web.browser`, `web.browser.legacy` or `web.cordova`.
     * @param {Object} options.manifest The new updated manifest object for
     * this `arch`.
     * @param {Object} options.runtimeConfig The new updated configuration
     * object for this `arch`.
     */

    /**
     * @summary Hook that runs when the meteor runtime configuration
     * is updated.  Typically the configuration only changes during development mode.
     * @locus Server
     * @param {addUpdatedNotifyHookCallback} handler
     * The `handler` is called on every change to an `arch` runtime configuration.
     * See `addUpdatedNotifyHookCallback`.
     * @returns {Object} {{ stop: function, callback: function }}
     */
    WebApp.addUpdatedNotifyHook = function (handler) {
      return runtimeConfig.updateHooks.register(handler);
    };
    WebAppInternals.generateBoilerplateInstance = function (arch, manifest, additionalOptions) {
      additionalOptions = additionalOptions || {};
      runtimeConfig.isUpdatedByArch[arch] = true;
      const rtimeConfig = _objectSpread(_objectSpread({}, __meteor_runtime_config__), additionalOptions.runtimeConfigOverrides || {});
      runtimeConfig.updateHooks.forEach(cb => {
        cb({
          arch,
          manifest,
          runtimeConfig: rtimeConfig
        });
        return true;
      });
      const meteorRuntimeConfig = JSON.stringify(encodeURIComponent(JSON.stringify(rtimeConfig)));
      return new Boilerplate(arch, manifest, Object.assign({
        pathMapper(itemPath) {
          return pathJoin(archPath[arch], itemPath);
        },
        baseDataExtension: {
          additionalStaticJs: (Object.entries(additionalStaticJs) || []).map(function (_ref) {
            let [pathname, contents] = _ref;
            return {
              pathname: pathname,
              contents: contents
            };
          }),
          // Convert to a JSON string, then get rid of most weird characters, then
          // wrap in double quotes. (The outermost JSON.stringify really ought to
          // just be "wrap in double quotes" but we use it to be safe.) This might
          // end up inside a <script> tag so we need to be careful to not include
          // "</script>", but normal {{spacebars}} escaping escapes too much! See
          // https://github.com/meteor/meteor/issues/3730
          meteorRuntimeConfig,
          meteorRuntimeHash: sha1(meteorRuntimeConfig),
          rootUrlPathPrefix: __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '',
          bundledJsCssUrlRewriteHook: bundledJsCssUrlRewriteHook,
          sriMode: sriMode,
          inlineScriptsAllowed: WebAppInternals.inlineScriptsAllowed(),
          inline: additionalOptions.inline
        }
      }, additionalOptions));
    };

    // A mapping from url path to architecture (e.g. "web.browser") to static
    // file information with the following fields:
    // - type: the type of file to be served
    // - cacheable: optionally, whether the file should be cached or not
    // - sourceMapUrl: optionally, the url of the source map
    //
    // Info also contains one of the following:
    // - content: the stringified content that should be served at this path
    // - absolutePath: the absolute path on disk to the file

    // Serve static files from the manifest or added with
    // `addStaticJs`. Exported for tests.
    WebAppInternals.staticFilesMiddleware = async function (staticFilesByArch, req, res, next) {
      var _Meteor$settings$pack3, _Meteor$settings$pack4, _Meteor$settings$pack5, _Meteor$settings$pack6, _Meteor$settings$pack7;
      var pathname = parseRequest(req).pathname;
      try {
        pathname = decodeURIComponent(pathname);
      } catch (e) {
        next();
        return;
      }
      var serveStaticJs = function (s) {
        var _Meteor$settings$pack, _Meteor$settings$pack2;
        if (req.method === 'GET' || req.method === 'HEAD' || (_Meteor$settings$pack = Meteor.settings.packages) !== null && _Meteor$settings$pack !== void 0 && (_Meteor$settings$pack2 = _Meteor$settings$pack.webapp) !== null && _Meteor$settings$pack2 !== void 0 && _Meteor$settings$pack2.alwaysReturnContent) {
          res.writeHead(200, {
            'Content-type': 'application/javascript; charset=UTF-8',
            'Content-Length': Buffer.byteLength(s)
          });
          res.write(s);
          res.end();
        } else {
          const status = req.method === 'OPTIONS' ? 200 : 405;
          res.writeHead(status, {
            Allow: 'OPTIONS, GET, HEAD',
            'Content-Length': '0'
          });
          res.end();
        }
      };
      if (pathname in additionalStaticJs && !WebAppInternals.inlineScriptsAllowed()) {
        serveStaticJs(additionalStaticJs[pathname]);
        return;
      }
      const {
        arch,
        path
      } = WebApp.categorizeRequest(req);
      if (!hasOwn.call(WebApp.clientPrograms, arch)) {
        // We could come here in case we run with some architectures excluded
        next();
        return;
      }

      // If pauseClient(arch) has been called, program.paused will be a
      // Promise that will be resolved when the program is unpaused.
      const program = WebApp.clientPrograms[arch];
      await program.paused;
      if (path === '/meteor_runtime_config.js' && !WebAppInternals.inlineScriptsAllowed()) {
        serveStaticJs("__meteor_runtime_config__ = ".concat(program.meteorRuntimeConfig, ";"));
        return;
      }
      const info = getStaticFileInfo(staticFilesByArch, pathname, path, arch);
      if (!info) {
        next();
        return;
      }
      // "send" will handle HEAD & GET requests
      if (req.method !== 'HEAD' && req.method !== 'GET' && !((_Meteor$settings$pack3 = Meteor.settings.packages) !== null && _Meteor$settings$pack3 !== void 0 && (_Meteor$settings$pack4 = _Meteor$settings$pack3.webapp) !== null && _Meteor$settings$pack4 !== void 0 && _Meteor$settings$pack4.alwaysReturnContent)) {
        const status = req.method === 'OPTIONS' ? 200 : 405;
        res.writeHead(status, {
          Allow: 'OPTIONS, GET, HEAD',
          'Content-Length': '0'
        });
        res.end();
        return;
      }

      // We don't need to call pause because, unlike 'static', once we call into
      // 'send' and yield to the event loop, we never call another handler with
      // 'next'.

      // Cacheable files are files that should never change. Typically
      // named by their hash (eg meteor bundled js and css files).
      // We cache them ~forever (1yr).
      const maxAge = info.cacheable ? 1000 * 60 * 60 * 24 * 365 : 0;

      // Resources whose URL already contains the content hash are immutable
      // and unique per architecture (modern vs legacy), so Vary: User-Agent
      // is unnecessary and harms CDN cache efficiency.
      //
      // If the requested URL does not contain the hash (e.g. development
      // or unhashed assets), we keep Vary: User-Agent to prevent cache
      // poisoning across different browsers.
      const includeVaryUserAgent = (_Meteor$settings$pack5 = (_Meteor$settings$pack6 = Meteor.settings.packages) === null || _Meteor$settings$pack6 === void 0 ? void 0 : (_Meteor$settings$pack7 = _Meteor$settings$pack6.webapp) === null || _Meteor$settings$pack7 === void 0 ? void 0 : _Meteor$settings$pack7.includeVaryUserAgent) !== null && _Meteor$settings$pack5 !== void 0 ? _Meteor$settings$pack5 : true;
      if (info.cacheable && !pathname.includes(info.hash) && includeVaryUserAgent) {
        res.setHeader('Vary', 'User-Agent');
      }

      // Set the X-SourceMap header, which current Chrome, FireFox, and Safari
      // understand.  (The SourceMap header is slightly more spec-correct but FF
      // doesn't understand it.)
      //
      // You may also need to enable source maps in Chrome: open dev tools, click
      // the gear in the bottom right corner, and select "enable source maps".
      if (info.sourceMapUrl) {
        res.setHeader('X-SourceMap', __meteor_runtime_config__.ROOT_URL_PATH_PREFIX + info.sourceMapUrl);
      }
      if (info.type === 'js' || info.type === 'dynamic js') {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      } else if (info.type === 'css') {
        res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      } else if (info.type === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=UTF-8');
      }
      if (info.hash) {
        res.setHeader('ETag', '"' + info.hash + '"');
      }
      if (info.content) {
        res.setHeader('Content-Length', Buffer.byteLength(info.content));
        res.write(info.content);
        res.end();
      } else {
        send(req, info.absolutePath, {
          maxage: maxAge,
          dotfiles: 'allow',
          // if we specified a dotfile in the manifest, serve it
          lastModified: false // don't set last-modified based on the file date
        }).on('error', function (err) {
          Log.error('Error serving static file ' + err);
          res.writeHead(500);
          res.end();
        }).on('directory', function () {
          Log.error('Unexpected directory ' + info.absolutePath);
          res.writeHead(500);
          res.end();
        }).pipe(res);
      }
    };
    function getStaticFileInfo(staticFilesByArch, originalPath, path, arch) {
      if (!hasOwn.call(WebApp.clientPrograms, arch)) {
        return null;
      }

      // Get a list of all available static file architectures, with arch
      // first in the list if it exists.
      const staticArchList = Object.keys(staticFilesByArch);
      const archIndex = staticArchList.indexOf(arch);
      if (archIndex > 0) {
        staticArchList.unshift(staticArchList.splice(archIndex, 1)[0]);
      }
      let info = null;
      staticArchList.some(arch => {
        const staticFiles = staticFilesByArch[arch];
        function finalize(path) {
          info = staticFiles[path];
          // Sometimes we register a lazy function instead of actual data in
          // the staticFiles manifest.
          if (typeof info === 'function') {
            info = staticFiles[path] = info();
          }
          return info;
        }

        // If staticFiles contains originalPath with the arch inferred above,
        // use that information.
        if (hasOwn.call(staticFiles, originalPath)) {
          return finalize(originalPath);
        }

        // If categorizeRequest returned an alternate path, try that instead.
        if (path !== originalPath && hasOwn.call(staticFiles, path)) {
          return finalize(path);
        }
      });
      return info;
    }

    // Parse the passed in port value. Return the port as-is if it's a String
    // (e.g. a Windows Server style named pipe), otherwise return the port as an
    // integer.
    //
    // DEPRECATED: Direct use of this function is not recommended; it is no
    // longer used internally, and will be removed in a future release.
    WebAppInternals.parsePort = port => {
      let parsedPort = parseInt(port);
      if (Number.isNaN(parsedPort)) {
        parsedPort = port;
      }
      return parsedPort;
    };
    onMessage('webapp-pause-client', async _ref2 => {
      let {
        arch
      } = _ref2;
      await WebAppInternals.pauseClient(arch);
    });
    onMessage('webapp-reload-client', async _ref3 => {
      let {
        arch
      } = _ref3;
      await WebAppInternals.generateClientProgram(arch);
    });
    async function runWebAppServer() {
      var shuttingDown = false;
      var syncQueue = new Meteor._AsynchronousQueue();
      var getItemPathname = function (itemUrl) {
        return decodeURIComponent(parseUrl(itemUrl).pathname);
      };
      WebAppInternals.reloadClientPrograms = async function () {
        await syncQueue.runTask(function () {
          const staticFilesByArch = Object.create(null);
          const {
            configJson
          } = __meteor_bootstrap__;
          const clientArchs = configJson.clientArchs || Object.keys(configJson.clientPaths);
          try {
            clientArchs.forEach(arch => {
              generateClientProgram(arch, staticFilesByArch);
            });
            WebAppInternals.staticFilesByArch = staticFilesByArch;
          } catch (e) {
            Log.error('Error reloading the client program: ' + e.stack);
            process.exit(1);
          }
        });
      };

      // Pause any incoming requests and make them wait for the program to be
      // unpaused the next time generateClientProgram(arch) is called.
      WebAppInternals.pauseClient = async function (arch) {
        await syncQueue.runTask(() => {
          const program = WebApp.clientPrograms[arch];
          const {
            unpause
          } = program;
          program.paused = new Promise(resolve => {
            if (typeof unpause === 'function') {
              // If there happens to be an existing program.unpause function,
              // compose it with the resolve function.
              program.unpause = function () {
                unpause();
                resolve();
              };
            } else {
              program.unpause = resolve;
            }
          });
        });
      };
      WebAppInternals.generateClientProgram = async function (arch) {
        await syncQueue.runTask(() => generateClientProgram(arch));
      };
      function generateClientProgram(arch) {
        let staticFilesByArch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : WebAppInternals.staticFilesByArch;
        const clientDir = pathJoin(pathDirname(__meteor_bootstrap__.serverDir), arch);

        // read the control for the client we'll be serving up
        const programJsonPath = pathJoin(clientDir, 'program.json');
        let programJson;
        try {
          programJson = JSON.parse(readFileSync(programJsonPath));
        } catch (e) {
          if (e.code === 'ENOENT') return;
          throw e;
        }
        if (programJson.format !== 'web-program-pre1') {
          throw new Error('Unsupported format for client assets: ' + JSON.stringify(programJson.format));
        }
        if (!programJsonPath || !clientDir || !programJson) {
          throw new Error('Client config file not parsed.');
        }
        archPath[arch] = clientDir;
        const staticFiles = staticFilesByArch[arch] = Object.create(null);
        const {
          manifest
        } = programJson;
        manifest.forEach(item => {
          if (item.url && item.where === 'client') {
            staticFiles[getItemPathname(item.url)] = {
              absolutePath: pathJoin(clientDir, item.path),
              cacheable: item.cacheable,
              hash: item.hash,
              // Link from source to its map
              sourceMapUrl: item.sourceMapUrl,
              type: item.type
            };
            if (item.sourceMap) {
              // Serve the source map too, under the specified URL. We assume
              // all source maps are cacheable.
              staticFiles[getItemPathname(item.sourceMapUrl)] = {
                absolutePath: pathJoin(clientDir, item.sourceMap),
                cacheable: true
              };
            }
          }
        });
        const {
          PUBLIC_SETTINGS
        } = __meteor_runtime_config__;
        const configOverrides = {
          PUBLIC_SETTINGS
        };
        const oldProgram = WebApp.clientPrograms[arch];
        const newProgram = WebApp.clientPrograms[arch] = {
          format: 'web-program-pre1',
          manifest: manifest,
          // Use arrow functions so that these versions can be lazily
          // calculated later, and so that they will not be included in the
          // staticFiles[manifestUrl].content string below.
          //
          // Note: these version calculations must be kept in agreement with
          // CordovaBuilder#appendVersion in tools/cordova/builder.js, or hot
          // code push will reload Cordova apps unnecessarily.
          version: () => WebAppHashing.calculateClientHash(manifest, null, configOverrides),
          versionRefreshable: () => WebAppHashing.calculateClientHash(manifest, type => type === 'css', configOverrides),
          versionNonRefreshable: () => WebAppHashing.calculateClientHash(manifest, (type, replaceable) => type !== 'css' && !replaceable, configOverrides),
          versionReplaceable: () => WebAppHashing.calculateClientHash(manifest, (_type, replaceable) => replaceable, configOverrides),
          cordovaCompatibilityVersions: programJson.cordovaCompatibilityVersions,
          PUBLIC_SETTINGS,
          hmrVersion: programJson.hmrVersion
        };

        // Expose program details as a string reachable via the following URL.
        const manifestUrlPrefix = '/__' + arch.replace(/^web\./, '');
        const manifestUrl = manifestUrlPrefix + getItemPathname('/manifest.json');
        staticFiles[manifestUrl] = () => {
          if (Package.autoupdate) {
            const {
              AUTOUPDATE_VERSION = Package.autoupdate.Autoupdate.autoupdateVersion
            } = process.env;
            if (AUTOUPDATE_VERSION) {
              newProgram.version = AUTOUPDATE_VERSION;
            }
          }
          if (typeof newProgram.version === 'function') {
            newProgram.version = newProgram.version();
          }
          return {
            content: JSON.stringify(newProgram),
            cacheable: false,
            hash: newProgram.version,
            type: 'json'
          };
        };
        generateBoilerplateForArch(arch);

        // If there are any requests waiting on oldProgram.paused, let them
        // continue now (using the new program).
        if (oldProgram && oldProgram.paused) {
          oldProgram.unpause();
        }
      }
      const defaultOptionsForArch = {
        'web.cordova': {
          runtimeConfigOverrides: {
            // XXX We use absoluteUrl() here so that we serve https://
            // URLs to cordova clients if force-ssl is in use. If we were
            // to use __meteor_runtime_config__.ROOT_URL instead of
            // absoluteUrl(), then Cordova clients would immediately get a
            // HCP setting their DDP_DEFAULT_CONNECTION_URL to
            // http://example.meteor.com. This breaks the app, because
            // force-ssl doesn't serve CORS headers on 302
            // redirects. (Plus it's undesirable to have clients
            // connecting to http://example.meteor.com when force-ssl is
            // in use.)
            DDP_DEFAULT_CONNECTION_URL: process.env.MOBILE_DDP_URL || Meteor.absoluteUrl(),
            ROOT_URL: process.env.MOBILE_ROOT_URL || Meteor.absoluteUrl()
          }
        },
        'web.browser': {
          runtimeConfigOverrides: {
            isModern: true
          }
        },
        'web.browser.legacy': {
          runtimeConfigOverrides: {
            isModern: false
          }
        }
      };
      WebAppInternals.generateBoilerplate = async function () {
        // This boilerplate will be served to the mobile devices when used with
        // Meteor/Cordova for the Hot-Code Push and since the file will be served by
        // the device's server, it is important to set the DDP url to the actual
        // Meteor server accepting DDP connections and not the device's file server.
        await syncQueue.runTask(function () {
          Object.keys(WebApp.clientPrograms).forEach(generateBoilerplateForArch);
        });
      };
      function generateBoilerplateForArch(arch) {
        const program = WebApp.clientPrograms[arch];
        const additionalOptions = defaultOptionsForArch[arch] || {};
        const {
          baseData
        } = boilerplateByArch[arch] = WebAppInternals.generateBoilerplateInstance(arch, program.manifest, additionalOptions);
        // We need the runtime config with overrides for meteor_runtime_config.js:
        program.meteorRuntimeConfig = JSON.stringify(_objectSpread(_objectSpread({}, __meteor_runtime_config__), additionalOptions.runtimeConfigOverrides || null));
        program.refreshableAssets = baseData.css.map(file => ({
          url: bundledJsCssUrlRewriteHook(file.url)
        }));
      }
      await WebAppInternals.reloadClientPrograms();

      // webserver
      var app = createExpressApp();

      // Packages and apps can add handlers that run before any other Meteor
      // handlers via WebApp.rawExpressHandlers.
      var rawExpressHandlers = createExpressApp();
      app.use(rawExpressHandlers);

      // Auto-compress any json, javascript, or text.
      app.use(compress({
        filter: shouldCompress
      }));

      // parse cookies into an object
      app.use(cookieParser());

      // We're not a proxy; reject (without crashing) attempts to treat us like
      // one. (See #1212.)
      app.use(function (req, res, next) {
        if (RoutePolicy.isValidUrl(req.url)) {
          next();
          return;
        }
        res.writeHead(400);
        res.write('Not a proxy');
        res.end();
      });
      function getPathParts(path) {
        const parts = path.split('/');
        while (parts[0] === '') parts.shift();
        return parts;
      }
      function isPrefixOf(prefix, array) {
        return prefix.length <= array.length && prefix.every((part, i) => part === array[i]);
      }

      // Strip off the path prefix, if it exists.
      app.use(function (request, response, next) {
        const pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX;
        const {
          pathname,
          search
        } = parseUrl(request.url);

        // check if the path in the url starts with the path prefix
        if (pathPrefix) {
          const prefixParts = getPathParts(pathPrefix);
          const pathParts = getPathParts(pathname);
          if (isPrefixOf(prefixParts, pathParts)) {
            request.url = '/' + pathParts.slice(prefixParts.length).join('/');
            if (search) {
              request.url += search;
            }
            return next();
          }
        }
        if (pathname === '/favicon.ico' || pathname === '/robots.txt') {
          return next();
        }
        if (pathPrefix) {
          response.writeHead(404);
          response.write('Unknown path');
          response.end();
          return;
        }
        next();
      });

      // Serve static files from the manifest.
      // This is inspired by the 'static' middleware.
      app.use(function (req, res, next) {
        // console.log(String(arguments.callee));
        WebAppInternals.staticFilesMiddleware(WebAppInternals.staticFilesByArch, req, res, next);
      });

      // Core Meteor packages like dynamic-import can add handlers before
      // other handlers added by package and application code.
      app.use(WebAppInternals.meteorInternalHandlers = createExpressApp());

      /**
       * @name expressHandlersCallback(req, res, next)
       * @locus Server
       * @isprototype true
       * @summary callback handler for `WebApp.expressHandlers`
       * @param {Object} req
       * a Node.js
       * [IncomingMessage](https://nodejs.org/api/http.html#class-httpincomingmessage)
       * object with some extra properties. This argument can be used
       *  to get information about the incoming request.
       * @param {Object} res
       * a Node.js
       * [ServerResponse](https://nodejs.org/api/http.html#class-httpserverresponse)
       * object. Use this to write data that should be sent in response to the
       * request, and call `res.end()` when you are done.
       * @param {Function} next
       * Calling this function will pass on the handling of
       * this request to the next relevant handler.
       *
       */

      /**
       * @method handlers
       * @memberof WebApp
       * @locus Server
       * @summary Register a handler for all HTTP requests.
       * @param {String} [path]
       * This handler will only be called on paths that match
       * this string. The match has to border on a `/` or a `.`.
       *
       * For example, `/hello` will match `/hello/world` and
       * `/hello.world`, but not `/hello_world`.
       * @param {expressHandlersCallback} handler
       * A handler function that will be called on HTTP requests.
       * See `expressHandlersCallback`
       *
       */
      // Packages and apps can add handlers to this via WebApp.expressHandlers.
      // They are inserted before our default handler.
      var packageAndAppHandlers = createExpressApp();
      app.use(packageAndAppHandlers);
      let suppressExpressErrors = false;
      // Express knows it is an error handler because it has 4 arguments instead of
      // 3. go figure.  (It is not smart enough to find such a thing if it's hidden
      // inside packageAndAppHandlers.)
      app.use(function (err, req, res, next) {
        if (!err || !suppressExpressErrors || !req.headers['x-suppress-error']) {
          next(err);
          return;
        }
        res.writeHead(err.status, {
          'Content-Type': 'text/plain'
        });
        res.end('An error message');
      });
      app.use(async function (req, res, next) {
        var _Meteor$settings$pack8, _Meteor$settings$pack9;
        if (!appUrl(req.url)) {
          return next();
        } else if (req.method !== 'HEAD' && req.method !== 'GET' && !((_Meteor$settings$pack8 = Meteor.settings.packages) !== null && _Meteor$settings$pack8 !== void 0 && (_Meteor$settings$pack9 = _Meteor$settings$pack8.webapp) !== null && _Meteor$settings$pack9 !== void 0 && _Meteor$settings$pack9.alwaysReturnContent)) {
          const status = req.method === 'OPTIONS' ? 200 : 405;
          res.writeHead(status, {
            Allow: 'OPTIONS, GET, HEAD',
            'Content-Length': '0'
          });
          res.end();
        } else {
          var headers = {
            'Content-Type': 'text/html; charset=utf-8'
          };
          if (shuttingDown) {
            headers['Connection'] = 'Close';
          }
          var request = WebApp.categorizeRequest(req);
          var response = res;
          if (request.url.query && request.url.query['meteor_css_resource']) {
            // In this case, we're requesting a CSS resource in the meteor-specific
            // way, but we don't have it.  Serve a static css file that indicates that
            // we didn't have it, so we can detect that and refresh.  Make sure
            // that any proxies or CDNs don't cache this error!  (Normally proxies
            // or CDNs are smart enough not to cache error pages, but in order to
            // make this hack work, we need to return the CSS file as a 200, which
            // would otherwise be cached.)
            headers['Content-Type'] = 'text/css; charset=utf-8';
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(200, headers);
            res.write('.meteor-css-not-found-error { width: 0px;}');
            res.end();
            return;
          }
          if (request.url.query && request.url.query['meteor_js_resource']) {
            // Similarly, we're requesting a JS resource that we don't have.
            // Serve an uncached 404. (We can't use the same hack we use for CSS,
            // because actually acting on that hack requires us to have the JS
            // already!)
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            res.end('404 Not Found');
            return;
          }
          if (request.url.query && request.url.query['meteor_dont_serve_index']) {
            // When downloading files during a Cordova hot code push, we need
            // to detect if a file is not available instead of inadvertently
            // downloading the default index page.
            // So similar to the situation above, we serve an uncached 404.
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            res.end('404 Not Found');
            return;
          }
          const {
            arch
          } = request;
          assert.strictEqual(typeof arch, 'string', {
            arch
          });
          if (!hasOwn.call(WebApp.clientPrograms, arch)) {
            // We could come here in case we run with some architectures excluded
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            if (Meteor.isDevelopment) {
              res.end("No client program found for the ".concat(arch, " architecture."));
            } else {
              // Safety net, but this branch should not be possible.
              res.end('404 Not Found');
            }
            return;
          }

          // If pauseClient(arch) has been called, program.paused will be a
          // Promise that will be resolved when the program is unpaused.
          await WebApp.clientPrograms[arch].paused;
          return getBoilerplateAsync(request, arch, response).then(_ref4 => {
            let {
              stream,
              statusCode,
              headers: newHeaders
            } = _ref4;
            if (!statusCode) {
              statusCode = res.statusCode ? res.statusCode : 200;
            }
            if (newHeaders) {
              Object.assign(headers, newHeaders);
            }
            res.writeHead(statusCode, headers);
            if (!disableBoilerplateResponse) {
              stream.pipe(res, {
                // End the response when the stream ends.
                end: true
              });
            }
          }).catch(error => {
            Log.error('Error running template: ' + error.stack);
            res.writeHead(500, headers);
            res.end();
          });
        }
      });

      // Return 404 by default, if no other handlers serve this URL.
      app.use(function (req, res) {
        res.writeHead(404);
        res.end();
      });
      var httpServer = createServer(app);
      var onListeningCallbacks = [];

      // After 5 seconds w/o data on a socket, kill it.  On the other hand, if
      // there's an outstanding request, give it a higher timeout instead (to avoid
      // killing long-polling requests)
      httpServer.setTimeout(SHORT_SOCKET_TIMEOUT);

      // Do this here, and then also in livedata/stream_server.js, because
      // stream_server.js kills all the current request handlers when installing its
      // own.
      httpServer.on('request', WebApp._timeoutAdjustmentRequestCallback);

      // If the client gave us a bad request, tell it instead of just closing the
      // socket. This lets load balancers in front of us differentiate between "a
      // server is randomly closing sockets for no reason" and "client sent a bad
      // request".
      //
      // This will only work on Node 6; Node 4 destroys the socket before calling
      // this event. See https://github.com/nodejs/node/pull/4557/ for details.
      httpServer.on('clientError', (err, socket) => {
        // Pre-Node-6, do nothing.
        if (socket.destroyed) {
          return;
        }
        if (err.message === 'Parse Error') {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        } else {
          // For other errors, use the default behavior as if we had no clientError
          // handler.
          socket.destroy(err);
        }
      });
      const suppressErrors = function () {
        suppressExpressErrors = true;
      };
      let warnedAboutConnectUsage = false;

      // start up app
      Object.assign(WebApp, {
        connectHandlers: packageAndAppHandlers,
        handlers: packageAndAppHandlers,
        rawConnectHandlers: rawExpressHandlers,
        rawHandlers: rawExpressHandlers,
        httpServer: httpServer,
        expressApp: app,
        // For testing.
        suppressConnectErrors: () => {
          if (!warnedAboutConnectUsage) {
            Meteor._debug("WebApp.suppressConnectErrors has been renamed to Meteor._suppressExpressErrors and it should be used only in tests.");
            warnedAboutConnectUsage = true;
          }
          suppressErrors();
        },
        _suppressExpressErrors: suppressErrors,
        onListening: function (f) {
          if (onListeningCallbacks) onListeningCallbacks.push(f);else f();
        },
        // This can be overridden by users who want to modify how listening works
        // (eg, to run a proxy like Apollo Engine Proxy in front of the server).
        startListening: function (httpServer, listenOptions, cb) {
          httpServer.listen(listenOptions, cb);
        }
      });

      /**
      * @name main
      * @locus Server
      * @summary Starts the HTTP server.
      *  If `UNIX_SOCKET_PATH` is present Meteor's HTTP server will use that socket file for inter-process communication, instead of TCP.
      * If you choose to not include webapp package in your application this method still must be defined for your Meteor application to work.
      */
      // Let the rest of the packages (and Meteor.startup hooks) insert Express
      // middlewares and update __meteor_runtime_config__, then keep going to set up
      // actually serving HTML.
      exports.main = async argv => {
        await WebAppInternals.generateBoilerplate();
        const startHttpServer = listenOptions => {
          WebApp.startListening((argv === null || argv === void 0 ? void 0 : argv.httpServer) || httpServer, listenOptions, Meteor.bindEnvironment(() => {
            if (process.env.METEOR_PRINT_ON_LISTEN) {
              console.log('LISTENING');
            }
            const callbacks = onListeningCallbacks;
            onListeningCallbacks = null;
            callbacks === null || callbacks === void 0 ? void 0 : callbacks.forEach(callback => {
              callback();
            });
          }, e => {
            console.error('Error listening:', e);
            console.error(e && e.stack);
          }));
        };
        let localPort = process.env.PORT || 0;
        let unixSocketPath = process.env.UNIX_SOCKET_PATH;
        if (unixSocketPath) {
          if (cluster.isWorker) {
            const workerName = cluster.worker.process.env.name || cluster.worker.id;
            unixSocketPath += '.' + workerName + '.sock';
          }
          // Start the HTTP server using a socket file.
          removeExistingSocketFile(unixSocketPath);
          startHttpServer({
            path: unixSocketPath
          });
          const unixSocketPermissions = (process.env.UNIX_SOCKET_PERMISSIONS || '').trim();
          if (unixSocketPermissions) {
            if (/^[0-7]{3}$/.test(unixSocketPermissions)) {
              chmodSync(unixSocketPath, parseInt(unixSocketPermissions, 8));
            } else {
              throw new Error('Invalid UNIX_SOCKET_PERMISSIONS specified');
            }
          }
          const unixSocketGroup = (process.env.UNIX_SOCKET_GROUP || '').trim();
          if (unixSocketGroup) {
            const unixSocketGroupInfo = getGroupInfo(unixSocketGroup);
            if (unixSocketGroupInfo === null) {
              throw new Error('Invalid UNIX_SOCKET_GROUP name specified');
            }
            chownSync(unixSocketPath, userInfo().uid, unixSocketGroupInfo.gid);
          }
          registerSocketFileCleanup(unixSocketPath);
        } else {
          localPort = isNaN(Number(localPort)) ? localPort : Number(localPort);
          if (/\\\\?.+\\pipe\\?.+/.test(localPort)) {
            // Start the HTTP server using Windows Server style named pipe.
            startHttpServer({
              path: localPort
            });
          } else if (typeof localPort === 'number') {
            // Start the HTTP server using TCP.
            startHttpServer({
              port: localPort,
              host: process.env.BIND_IP || '0.0.0.0'
            });
          } else {
            throw new Error('Invalid PORT specified');
          }
        }
        return 'DAEMON';
      };
    }
    const isGetentAvailable = () => {
      try {
        execSync('which getent');
        return true;
      } catch (_unused) {
        return false;
      }
    };
    const getGroupInfoUsingGetent = groupName => {
      try {
        const stdout = execSync("getent group ".concat(groupName), {
          encoding: 'utf8'
        });
        if (!stdout) return null;
        const [name,, gid] = stdout.trim().split(':');
        if (name == null || gid == null) return null;
        return {
          name,
          gid: Number(gid)
        };
      } catch (error) {
        return null;
      }
    };
    const getGroupInfoFromFile = groupName => {
      try {
        const data = readFileSync('/etc/group', 'utf8');
        const groupLine = data.trim().split('\n').find(line => line.startsWith("".concat(groupName, ":")));
        if (!groupLine) return null;
        const [name,, gid] = groupLine.trim().split(':');
        if (name == null || gid == null) return null;
        return {
          name,
          gid: Number(gid)
        };
      } catch (error) {
        return null;
      }
    };
    const getGroupInfo = groupName => {
      let groupInfo = getGroupInfoFromFile(groupName);
      if (!groupInfo && isGetentAvailable()) {
        groupInfo = getGroupInfoUsingGetent(groupName);
      }
      return groupInfo;
    };
    var inlineScriptsAllowed = true;
    WebAppInternals.inlineScriptsAllowed = function () {
      return inlineScriptsAllowed;
    };
    WebAppInternals.setInlineScriptsAllowed = async function (value) {
      inlineScriptsAllowed = value;
      await WebAppInternals.generateBoilerplate();
    };
    var sriMode;
    WebAppInternals.enableSubresourceIntegrity = async function () {
      let use_credentials = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      sriMode = use_credentials ? 'use-credentials' : 'anonymous';
      await WebAppInternals.generateBoilerplate();
    };
    WebAppInternals.setBundledJsCssUrlRewriteHook = async function (hookFn) {
      bundledJsCssUrlRewriteHook = hookFn;
      await WebAppInternals.generateBoilerplate();
    };
    WebAppInternals.setBundledJsCssPrefix = async function (prefix) {
      var self = this;
      await self.setBundledJsCssUrlRewriteHook(function (url) {
        return prefix + url;
      });
    };

    // Packages can call `WebAppInternals.addStaticJs` to specify static
    // JavaScript to be included in the app. This static JS will be inlined,
    // unless inline scripts have been disabled, in which case it will be
    // served under `/<sha1 of contents>`.
    var additionalStaticJs = {};
    WebAppInternals.addStaticJs = function (contents) {
      additionalStaticJs['/' + sha1(contents) + '.js'] = contents;
    };
    var disableBoilerplateResponse = false;
    WebAppInternals.disableBoilerplateResponse = function () {
      disableBoilerplateResponse = true;
    };

    // Exported for tests
    WebAppInternals.getBoilerplate = getBoilerplate;
    WebAppInternals.additionalStaticJs = additionalStaticJs;
    await runWebAppServer();
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: true
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"socket_file.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/webapp/socket_file.js                                                                           //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      removeExistingSocketFile: () => removeExistingSocketFile,
      registerSocketFileCleanup: () => registerSocketFileCleanup
    });
    let statSync, unlinkSync, existsSync;
    module.link("fs", {
      statSync(v) {
        statSync = v;
      },
      unlinkSync(v) {
        unlinkSync = v;
      },
      existsSync(v) {
        existsSync = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const removeExistingSocketFile = socketPath => {
      try {
        if (statSync(socketPath).isSocket()) {
          // Since a new socket file will be created, remove the existing
          // file.
          unlinkSync(socketPath);
        } else {
          throw new Error("An existing file was found at \"".concat(socketPath, "\" and it is not ") + 'a socket file. Please confirm PORT is pointing to valid and ' + 'un-used socket file path.');
        }
      } catch (error) {
        // If there is no existing socket file to cleanup, great, we'll
        // continue normally. If the caught exception represents any other
        // issue, re-throw.
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    };
    const registerSocketFileCleanup = function (socketPath) {
      let eventEmitter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : process;
      ['exit', 'SIGINT', 'SIGHUP', 'SIGTERM'].forEach(signal => {
        eventEmitter.on(signal, Meteor.bindEnvironment(() => {
          if (existsSync(socketPath)) {
            unlinkSync(socketPath);
          }
        }));
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
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"express":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/express/package.json                                             //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "express",
  "version": "5.1.0"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/express/index.js                                                 //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"compression":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/compression/package.json                                         //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "compression",
  "version": "1.7.4"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/compression/index.js                                             //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"cookie-parser":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/cookie-parser/package.json                                       //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "cookie-parser",
  "version": "1.4.6"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/cookie-parser/index.js                                           //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"qs":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/qs/package.json                                                  //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "qs",
  "version": "6.13.0",
  "main": "lib/index.js"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/qs/lib/index.js                                                  //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"parseurl":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/parseurl/package.json                                            //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "parseurl",
  "version": "1.3.3"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/parseurl/index.js                                                //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"useragent-ng":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/useragent-ng/package.json                                        //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "useragent-ng",
  "version": "2.4.4",
  "main": "./index.js"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/useragent-ng/index.js                                            //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"send":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/send/package.json                                                //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "send",
  "version": "1.1.0"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/webapp/node_modules/send/index.js                                                    //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      WebApp: WebApp,
      WebAppInternals: WebAppInternals,
      main: main
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/webapp/webapp_server.js"
  ],
  mainModulePath: "/node_modules/meteor/webapp/webapp_server.js"
}});

//# sourceURL=meteor://💻app/packages/webapp.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvd2ViYXBwL3dlYmFwcF9zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3dlYmFwcC9zb2NrZXRfZmlsZS5qcyJdLCJuYW1lcyI6WyJfb2JqZWN0U3ByZWFkIiwibW9kdWxlMSIsImxpbmsiLCJkZWZhdWx0IiwidiIsImV4cG9ydCIsIldlYkFwcCIsIldlYkFwcEludGVybmFscyIsImdldEdyb3VwSW5mbyIsImFzc2VydCIsInJlYWRGaWxlU3luYyIsImNobW9kU3luYyIsImNob3duU3luYyIsImNyZWF0ZVNlcnZlciIsInVzZXJJbmZvIiwicGF0aEpvaW4iLCJwYXRoRGlybmFtZSIsImpvaW4iLCJkaXJuYW1lIiwicGFyc2VVcmwiLCJwYXJzZSIsImNyZWF0ZUhhc2giLCJleHByZXNzIiwiY29tcHJlc3MiLCJjb29raWVQYXJzZXIiLCJxcyIsInBhcnNlUmVxdWVzdCIsImxvb2t1cFVzZXJBZ2VudCIsImxvb2t1cCIsImlzTW9kZXJuIiwic2VuZCIsInJlbW92ZUV4aXN0aW5nU29ja2V0RmlsZSIsInJlZ2lzdGVyU29ja2V0RmlsZUNsZWFudXAiLCJjbHVzdGVyIiwiZXhlY1N5bmMiLCJvbk1lc3NhZ2UiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsIlNIT1JUX1NPQ0tFVF9USU1FT1VUIiwiTE9OR19TT0NLRVRfVElNRU9VVCIsImNyZWF0ZUV4cHJlc3NBcHAiLCJhcHAiLCJzZXQiLCJoYXNPd24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsIk5wbU1vZHVsZXMiLCJ2ZXJzaW9uIiwiTnBtIiwicmVxdWlyZSIsIm1vZHVsZSIsImRlZmF1bHRBcmNoIiwiY2xpZW50UHJvZ3JhbXMiLCJhcmNoUGF0aCIsImJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rIiwidXJsIiwiYnVuZGxlZFByZWZpeCIsIl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18iLCJST09UX1VSTF9QQVRIX1BSRUZJWCIsInNoYTEiLCJjb250ZW50cyIsImhhc2giLCJ1cGRhdGUiLCJkaWdlc3QiLCJzaG91bGRDb21wcmVzcyIsInJlcSIsInJlcyIsImhlYWRlcnMiLCJmaWx0ZXIiLCJjYW1lbENhc2UiLCJuYW1lIiwicGFydHMiLCJzcGxpdCIsInRvTG93ZXJDYXNlIiwiaSIsImxlbmd0aCIsImNoYXJBdCIsInRvVXBwZXJDYXNlIiwic3Vic3RyaW5nIiwiaWRlbnRpZnlCcm93c2VyIiwidXNlckFnZW50U3RyaW5nIiwibWFqb3IiLCJtaW5vciIsInBhdGNoIiwidXNlckFnZW50IiwiZmFtaWx5IiwiY2F0ZWdvcml6ZVJlcXVlc3QiLCJicm93c2VyIiwiYXJjaCIsIm1vZGVybiIsInBhdGgiLCJwYXRobmFtZSIsImNhdGVnb3JpemVkIiwiZHluYW1pY0hlYWQiLCJkeW5hbWljQm9keSIsImNvb2tpZXMiLCJwYXRoUGFydHMiLCJhcmNoS2V5Iiwic3RhcnRzV2l0aCIsImFyY2hDbGVhbmVkIiwic2xpY2UiLCJjYWxsIiwic3BsaWNlIiwiYXNzaWduIiwicHJlZmVycmVkQXJjaE9yZGVyIiwiaHRtbEF0dHJpYnV0ZUhvb2tzIiwiZ2V0SHRtbEF0dHJpYnV0ZXMiLCJyZXF1ZXN0IiwiY29tYmluZWRBdHRyaWJ1dGVzIiwiZm9yRWFjaCIsImhvb2siLCJhdHRyaWJ1dGVzIiwiRXJyb3IiLCJhZGRIdG1sQXR0cmlidXRlSG9vayIsInB1c2giLCJhcHBVcmwiLCJSb3V0ZVBvbGljeSIsImNsYXNzaWZ5IiwiTWV0ZW9yIiwic3RhcnR1cCIsImdldHRlciIsImtleSIsInByb2dyYW0iLCJ2YWx1ZSIsImNhbGN1bGF0ZUNsaWVudEhhc2giLCJjbGllbnRIYXNoIiwiY2FsY3VsYXRlQ2xpZW50SGFzaFJlZnJlc2hhYmxlIiwiY2FsY3VsYXRlQ2xpZW50SGFzaE5vblJlZnJlc2hhYmxlIiwiY2FsY3VsYXRlQ2xpZW50SGFzaFJlcGxhY2VhYmxlIiwiZ2V0UmVmcmVzaGFibGVBc3NldHMiLCJfdGltZW91dEFkanVzdG1lbnRSZXF1ZXN0Q2FsbGJhY2siLCJzZXRUaW1lb3V0IiwiZmluaXNoTGlzdGVuZXJzIiwibGlzdGVuZXJzIiwicmVtb3ZlQWxsTGlzdGVuZXJzIiwib24iLCJ2YWx1ZXMiLCJsIiwiYm9pbGVycGxhdGVCeUFyY2giLCJib2lsZXJwbGF0ZURhdGFDYWxsYmFja3MiLCJjcmVhdGUiLCJyZWdpc3RlckJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrIiwiY2FsbGJhY2siLCJwcmV2aW91c0NhbGxiYWNrIiwic3RyaWN0RXF1YWwiLCJnZXRCb2lsZXJwbGF0ZSIsImdldEJvaWxlcnBsYXRlQXN5bmMiLCJlbmNvZGVSdW50aW1lQ29uZmlnIiwicnRpbWVDb25maWciLCJKU09OIiwic3RyaW5naWZ5IiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiZGVjb2RlUnVudGltZUNvbmZpZyIsInJ0aW1lQ29uZmlnU3RyIiwiZGVjb2RlVVJJQ29tcG9uZW50IiwicnVudGltZUNvbmZpZyIsImhvb2tzIiwiSG9vayIsInVwZGF0ZUhvb2tzIiwiaXNVcGRhdGVkQnlBcmNoIiwiYWRkUnVudGltZUNvbmZpZ0hvb2siLCJyZWdpc3RlciIsInJlc3BvbnNlIiwiYm9pbGVycGxhdGUiLCJmb3JFYWNoQXN5bmMiLCJtZXRlb3JSdW50aW1lQ29uZmlnIiwiZW5jb2RlZEN1cnJlbnRDb25maWciLCJiYXNlRGF0YSIsInVwZGF0ZWQiLCJkYXRhIiwiaHRtbEF0dHJpYnV0ZXMiLCJtYWRlQ2hhbmdlcyIsInByb21pc2UiLCJQcm9taXNlIiwicmVzb2x2ZSIsImtleXMiLCJ0aGVuIiwicmVzdWx0Iiwic3RyZWFtIiwidG9IVE1MU3RyZWFtIiwic3RhdHVzQ29kZSIsImFkZFVwZGF0ZWROb3RpZnlIb29rIiwiaGFuZGxlciIsImdlbmVyYXRlQm9pbGVycGxhdGVJbnN0YW5jZSIsIm1hbmlmZXN0IiwiYWRkaXRpb25hbE9wdGlvbnMiLCJydW50aW1lQ29uZmlnT3ZlcnJpZGVzIiwiY2IiLCJCb2lsZXJwbGF0ZSIsInBhdGhNYXBwZXIiLCJpdGVtUGF0aCIsImJhc2VEYXRhRXh0ZW5zaW9uIiwiYWRkaXRpb25hbFN0YXRpY0pzIiwiZW50cmllcyIsIm1hcCIsIl9yZWYiLCJtZXRlb3JSdW50aW1lSGFzaCIsInJvb3RVcmxQYXRoUHJlZml4Iiwic3JpTW9kZSIsImlubGluZVNjcmlwdHNBbGxvd2VkIiwiaW5saW5lIiwic3RhdGljRmlsZXNNaWRkbGV3YXJlIiwic3RhdGljRmlsZXNCeUFyY2giLCJuZXh0IiwiX01ldGVvciRzZXR0aW5ncyRwYWNrMyIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazQiLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2s1IiwiX01ldGVvciRzZXR0aW5ncyRwYWNrNiIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazciLCJlIiwic2VydmVTdGF0aWNKcyIsInMiLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2siLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2syIiwibWV0aG9kIiwic2V0dGluZ3MiLCJwYWNrYWdlcyIsIndlYmFwcCIsImFsd2F5c1JldHVybkNvbnRlbnQiLCJ3cml0ZUhlYWQiLCJCdWZmZXIiLCJieXRlTGVuZ3RoIiwid3JpdGUiLCJlbmQiLCJzdGF0dXMiLCJBbGxvdyIsInBhdXNlZCIsImNvbmNhdCIsImluZm8iLCJnZXRTdGF0aWNGaWxlSW5mbyIsIm1heEFnZSIsImNhY2hlYWJsZSIsImluY2x1ZGVWYXJ5VXNlckFnZW50IiwiaW5jbHVkZXMiLCJzZXRIZWFkZXIiLCJzb3VyY2VNYXBVcmwiLCJ0eXBlIiwiY29udGVudCIsImFic29sdXRlUGF0aCIsIm1heGFnZSIsImRvdGZpbGVzIiwibGFzdE1vZGlmaWVkIiwiZXJyIiwiTG9nIiwiZXJyb3IiLCJwaXBlIiwib3JpZ2luYWxQYXRoIiwic3RhdGljQXJjaExpc3QiLCJhcmNoSW5kZXgiLCJpbmRleE9mIiwidW5zaGlmdCIsInNvbWUiLCJzdGF0aWNGaWxlcyIsImZpbmFsaXplIiwicGFyc2VQb3J0IiwicG9ydCIsInBhcnNlZFBvcnQiLCJwYXJzZUludCIsIk51bWJlciIsImlzTmFOIiwiX3JlZjIiLCJwYXVzZUNsaWVudCIsIl9yZWYzIiwiZ2VuZXJhdGVDbGllbnRQcm9ncmFtIiwicnVuV2ViQXBwU2VydmVyIiwic2h1dHRpbmdEb3duIiwic3luY1F1ZXVlIiwiX0FzeW5jaHJvbm91c1F1ZXVlIiwiZ2V0SXRlbVBhdGhuYW1lIiwiaXRlbVVybCIsInJlbG9hZENsaWVudFByb2dyYW1zIiwicnVuVGFzayIsImNvbmZpZ0pzb24iLCJfX21ldGVvcl9ib290c3RyYXBfXyIsImNsaWVudEFyY2hzIiwiY2xpZW50UGF0aHMiLCJzdGFjayIsInByb2Nlc3MiLCJleGl0IiwidW5wYXVzZSIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsImNsaWVudERpciIsInNlcnZlckRpciIsInByb2dyYW1Kc29uUGF0aCIsInByb2dyYW1Kc29uIiwiY29kZSIsImZvcm1hdCIsIml0ZW0iLCJ3aGVyZSIsInNvdXJjZU1hcCIsIlBVQkxJQ19TRVRUSU5HUyIsImNvbmZpZ092ZXJyaWRlcyIsIm9sZFByb2dyYW0iLCJuZXdQcm9ncmFtIiwiV2ViQXBwSGFzaGluZyIsInZlcnNpb25SZWZyZXNoYWJsZSIsInZlcnNpb25Ob25SZWZyZXNoYWJsZSIsInJlcGxhY2VhYmxlIiwidmVyc2lvblJlcGxhY2VhYmxlIiwiX3R5cGUiLCJjb3Jkb3ZhQ29tcGF0aWJpbGl0eVZlcnNpb25zIiwiaG1yVmVyc2lvbiIsIm1hbmlmZXN0VXJsUHJlZml4IiwicmVwbGFjZSIsIm1hbmlmZXN0VXJsIiwiUGFja2FnZSIsImF1dG91cGRhdGUiLCJBVVRPVVBEQVRFX1ZFUlNJT04iLCJBdXRvdXBkYXRlIiwiYXV0b3VwZGF0ZVZlcnNpb24iLCJlbnYiLCJnZW5lcmF0ZUJvaWxlcnBsYXRlRm9yQXJjaCIsImRlZmF1bHRPcHRpb25zRm9yQXJjaCIsIkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMIiwiTU9CSUxFX0REUF9VUkwiLCJhYnNvbHV0ZVVybCIsIlJPT1RfVVJMIiwiTU9CSUxFX1JPT1RfVVJMIiwiZ2VuZXJhdGVCb2lsZXJwbGF0ZSIsInJlZnJlc2hhYmxlQXNzZXRzIiwiY3NzIiwiZmlsZSIsInJhd0V4cHJlc3NIYW5kbGVycyIsInVzZSIsImlzVmFsaWRVcmwiLCJnZXRQYXRoUGFydHMiLCJzaGlmdCIsImlzUHJlZml4T2YiLCJwcmVmaXgiLCJhcnJheSIsImV2ZXJ5IiwicGFydCIsInBhdGhQcmVmaXgiLCJzZWFyY2giLCJwcmVmaXhQYXJ0cyIsIm1ldGVvckludGVybmFsSGFuZGxlcnMiLCJwYWNrYWdlQW5kQXBwSGFuZGxlcnMiLCJzdXBwcmVzc0V4cHJlc3NFcnJvcnMiLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2s4IiwiX01ldGVvciRzZXR0aW5ncyRwYWNrOSIsInF1ZXJ5IiwiaXNEZXZlbG9wbWVudCIsIl9yZWY0IiwibmV3SGVhZGVycyIsImRpc2FibGVCb2lsZXJwbGF0ZVJlc3BvbnNlIiwiY2F0Y2giLCJodHRwU2VydmVyIiwib25MaXN0ZW5pbmdDYWxsYmFja3MiLCJzb2NrZXQiLCJkZXN0cm95ZWQiLCJtZXNzYWdlIiwiZGVzdHJveSIsInN1cHByZXNzRXJyb3JzIiwid2FybmVkQWJvdXRDb25uZWN0VXNhZ2UiLCJjb25uZWN0SGFuZGxlcnMiLCJoYW5kbGVycyIsInJhd0Nvbm5lY3RIYW5kbGVycyIsInJhd0hhbmRsZXJzIiwiZXhwcmVzc0FwcCIsInN1cHByZXNzQ29ubmVjdEVycm9ycyIsIl9kZWJ1ZyIsIl9zdXBwcmVzc0V4cHJlc3NFcnJvcnMiLCJvbkxpc3RlbmluZyIsImYiLCJzdGFydExpc3RlbmluZyIsImxpc3Rlbk9wdGlvbnMiLCJsaXN0ZW4iLCJleHBvcnRzIiwibWFpbiIsImFyZ3YiLCJzdGFydEh0dHBTZXJ2ZXIiLCJiaW5kRW52aXJvbm1lbnQiLCJNRVRFT1JfUFJJTlRfT05fTElTVEVOIiwiY29uc29sZSIsImxvZyIsImNhbGxiYWNrcyIsImxvY2FsUG9ydCIsIlBPUlQiLCJ1bml4U29ja2V0UGF0aCIsIlVOSVhfU09DS0VUX1BBVEgiLCJpc1dvcmtlciIsIndvcmtlck5hbWUiLCJ3b3JrZXIiLCJpZCIsInVuaXhTb2NrZXRQZXJtaXNzaW9ucyIsIlVOSVhfU09DS0VUX1BFUk1JU1NJT05TIiwidHJpbSIsInRlc3QiLCJ1bml4U29ja2V0R3JvdXAiLCJVTklYX1NPQ0tFVF9HUk9VUCIsInVuaXhTb2NrZXRHcm91cEluZm8iLCJ1aWQiLCJnaWQiLCJob3N0IiwiQklORF9JUCIsImlzR2V0ZW50QXZhaWxhYmxlIiwiX3VudXNlZCIsImdldEdyb3VwSW5mb1VzaW5nR2V0ZW50IiwiZ3JvdXBOYW1lIiwic3Rkb3V0IiwiZW5jb2RpbmciLCJnZXRHcm91cEluZm9Gcm9tRmlsZSIsImdyb3VwTGluZSIsImZpbmQiLCJsaW5lIiwiZ3JvdXBJbmZvIiwic2V0SW5saW5lU2NyaXB0c0FsbG93ZWQiLCJlbmFibGVTdWJyZXNvdXJjZUludGVncml0eSIsInVzZV9jcmVkZW50aWFscyIsInNldEJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rIiwiaG9va0ZuIiwic2V0QnVuZGxlZEpzQ3NzUHJlZml4Iiwic2VsZiIsImFkZFN0YXRpY0pzIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwiYXN5bmMiLCJzdGF0U3luYyIsInVubGlua1N5bmMiLCJleGlzdHNTeW5jIiwic29ja2V0UGF0aCIsImlzU29ja2V0IiwiZXZlbnRFbWl0dGVyIiwic2lnbmFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsYUFBYTtJQUFDQyxPQUFPLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztNQUFDQyxPQUFPQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0osYUFBYSxHQUFDSSxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQXRHSCxPQUFPLENBQUNJLE1BQU0sQ0FBQztNQUFDQyxNQUFNLEVBQUNBLENBQUEsS0FBSUEsTUFBTTtNQUFDQyxlQUFlLEVBQUNBLENBQUEsS0FBSUEsZUFBZTtNQUFDQyxZQUFZLEVBQUNBLENBQUEsS0FBSUE7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QztVQUN4QjtRQUNGLENBQUMsQ0FBQyxDQUFDO01BQ0wsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUFDTixzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRixJQUFBO0VBQUFJLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy93ZWJhcHAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIGNobW9kU3luYywgY2hvd25TeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgY3JlYXRlU2VydmVyIH0gZnJvbSAnaHR0cCc7XG5pbXBvcnQgeyB1c2VySW5mbyB9IGZyb20gJ29zJztcbmltcG9ydCB7IGpvaW4gYXMgcGF0aEpvaW4sIGRpcm5hbWUgYXMgcGF0aERpcm5hbWUgfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IHBhcnNlIGFzIHBhcnNlVXJsIH0gZnJvbSAndXJsJztcbmltcG9ydCB7IGNyZWF0ZUhhc2ggfSBmcm9tICdjcnlwdG8nO1xuaW1wb3J0IGV4cHJlc3MgZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgY29tcHJlc3MgZnJvbSAnY29tcHJlc3Npb24nO1xuaW1wb3J0IGNvb2tpZVBhcnNlciBmcm9tICdjb29raWUtcGFyc2VyJztcbmltcG9ydCBxcyBmcm9tICdxcyc7XG5pbXBvcnQgcGFyc2VSZXF1ZXN0IGZyb20gJ3BhcnNldXJsJztcbmltcG9ydCB7IGxvb2t1cCBhcyBsb29rdXBVc2VyQWdlbnQgfSBmcm9tICd1c2VyYWdlbnQtbmcnO1xuaW1wb3J0IHsgaXNNb2Rlcm4gfSBmcm9tICdtZXRlb3IvbW9kZXJuLWJyb3dzZXJzJztcbmltcG9ydCBzZW5kIGZyb20gJ3NlbmQnO1xuaW1wb3J0IHtcbiAgcmVtb3ZlRXhpc3RpbmdTb2NrZXRGaWxlLFxuICByZWdpc3RlclNvY2tldEZpbGVDbGVhbnVwLFxufSBmcm9tICcuL3NvY2tldF9maWxlLmpzJztcbmltcG9ydCBjbHVzdGVyIGZyb20gJ2NsdXN0ZXInO1xuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcblxudmFyIFNIT1JUX1NPQ0tFVF9USU1FT1VUID0gNSAqIDEwMDA7XG52YXIgTE9OR19TT0NLRVRfVElNRU9VVCA9IDEyMCAqIDEwMDA7XG5cbmNvbnN0IGNyZWF0ZUV4cHJlc3NBcHAgPSAoKSA9PiB7XG4gIGNvbnN0IGFwcCA9IGV4cHJlc3MoKTtcbiAgLy8gU2VjdXJpdHkgYW5kIHBlcmZvcm1hY2UgaGVhZGVyc1xuICAvLyB0aGVzZSBoZWFkZXJzIGNvbWUgZnJvbSB0aGVzZSBkb2NzOiBodHRwczovL2V4cHJlc3Nqcy5jb20vZW4vYXBpLmh0bWwjYXBwLnNldHRpbmdzLnRhYmxlXG4gIGFwcC5zZXQoJ3gtcG93ZXJlZC1ieScsIGZhbHNlKTtcbiAgYXBwLnNldCgnZXRhZycsIGZhbHNlKTtcbiAgYXBwLnNldCgncXVlcnkgcGFyc2VyJywgcXMucGFyc2UpO1xuICByZXR1cm4gYXBwO1xufVxuZXhwb3J0IGNvbnN0IFdlYkFwcCA9IHt9O1xuZXhwb3J0IGNvbnN0IFdlYkFwcEludGVybmFscyA9IHt9O1xuXG5jb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5cbldlYkFwcEludGVybmFscy5OcG1Nb2R1bGVzID0ge1xuICBleHByZXNzIDoge1xuICAgIHZlcnNpb246IE5wbS5yZXF1aXJlKCdleHByZXNzL3BhY2thZ2UuanNvbicpLnZlcnNpb24sXG4gICAgbW9kdWxlOiBleHByZXNzLFxuICB9XG59O1xuXG4vLyBNb3JlIG9mIGEgY29udmVuaWVuY2UgZm9yIHRoZSBlbmQgdXNlclxuV2ViQXBwLmV4cHJlc3MgPSBleHByZXNzO1xuXG4vLyBUaG91Z2ggd2UgbWlnaHQgcHJlZmVyIHRvIHVzZSB3ZWIuYnJvd3NlciAobW9kZXJuKSBhcyB0aGUgZGVmYXVsdFxuLy8gYXJjaGl0ZWN0dXJlLCBzYWZldHkgcmVxdWlyZXMgYSBtb3JlIGNvbXBhdGlibGUgZGVmYXVsdEFyY2guXG5XZWJBcHAuZGVmYXVsdEFyY2ggPSAnd2ViLmJyb3dzZXIubGVnYWN5JztcblxuLy8gWFhYIG1hcHMgYXJjaHMgdG8gbWFuaWZlc3RzXG5XZWJBcHAuY2xpZW50UHJvZ3JhbXMgPSB7fTtcblxuLy8gWFhYIG1hcHMgYXJjaHMgdG8gcHJvZ3JhbSBwYXRoIG9uIGZpbGVzeXN0ZW1cbnZhciBhcmNoUGF0aCA9IHt9O1xuXG52YXIgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2sgPSBmdW5jdGlvbih1cmwpIHtcbiAgdmFyIGJ1bmRsZWRQcmVmaXggPSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMX1BBVEhfUFJFRklYIHx8ICcnO1xuICByZXR1cm4gYnVuZGxlZFByZWZpeCArIHVybDtcbn07XG5cbnZhciBzaGExID0gZnVuY3Rpb24oY29udGVudHMpIHtcbiAgdmFyIGhhc2ggPSBjcmVhdGVIYXNoKCdzaGExJyk7XG4gIGhhc2gudXBkYXRlKGNvbnRlbnRzKTtcbiAgcmV0dXJuIGhhc2guZGlnZXN0KCdoZXgnKTtcbn07XG5cbmZ1bmN0aW9uIHNob3VsZENvbXByZXNzKHJlcSwgcmVzKSB7XG4gIGlmIChyZXEuaGVhZGVyc1sneC1uby1jb21wcmVzc2lvbiddKSB7XG4gICAgLy8gZG9uJ3QgY29tcHJlc3MgcmVzcG9uc2VzIHdpdGggdGhpcyByZXF1ZXN0IGhlYWRlclxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIGZhbGxiYWNrIHRvIHN0YW5kYXJkIGZpbHRlciBmdW5jdGlvblxuICByZXR1cm4gY29tcHJlc3MuZmlsdGVyKHJlcSwgcmVzKTtcbn1cblxuLy8gI0Jyb3dzZXJJZGVudGlmaWNhdGlvblxuLy9cbi8vIFdlIGhhdmUgbXVsdGlwbGUgcGxhY2VzIHRoYXQgd2FudCB0byBpZGVudGlmeSB0aGUgYnJvd3NlcjogdGhlXG4vLyB1bnN1cHBvcnRlZCBicm93c2VyIHBhZ2UsIHRoZSBhcHBjYWNoZSBwYWNrYWdlLCBhbmQsIGV2ZW50dWFsbHlcbi8vIGRlbGl2ZXJpbmcgYnJvd3NlciBwb2x5ZmlsbHMgb25seSBhcyBuZWVkZWQuXG4vL1xuLy8gVG8gYXZvaWQgZGV0ZWN0aW5nIHRoZSBicm93c2VyIGluIG11bHRpcGxlIHBsYWNlcyBhZC1ob2MsIHdlIGNyZWF0ZSBhXG4vLyBNZXRlb3IgXCJicm93c2VyXCIgb2JqZWN0LiBJdCB1c2VzIGJ1dCBkb2VzIG5vdCBleHBvc2UgdGhlIG5wbVxuLy8gdXNlcmFnZW50IG1vZHVsZSAod2UgY291bGQgY2hvb3NlIGEgZGlmZmVyZW50IG1lY2hhbmlzbSB0byBpZGVudGlmeVxuLy8gdGhlIGJyb3dzZXIgaW4gdGhlIGZ1dHVyZSBpZiB3ZSB3YW50ZWQgdG8pLiAgVGhlIGJyb3dzZXIgb2JqZWN0XG4vLyBjb250YWluc1xuLy9cbi8vICogYG5hbWVgOiB0aGUgbmFtZSBvZiB0aGUgYnJvd3NlciBpbiBjYW1lbCBjYXNlXG4vLyAqIGBtYWpvcmAsIGBtaW5vcmAsIGBwYXRjaGA6IGludGVnZXJzIGRlc2NyaWJpbmcgdGhlIGJyb3dzZXIgdmVyc2lvblxuLy9cbi8vIEFsc28gaGVyZSBpcyBhbiBlYXJseSB2ZXJzaW9uIG9mIGEgTWV0ZW9yIGByZXF1ZXN0YCBvYmplY3QsIGludGVuZGVkXG4vLyB0byBiZSBhIGhpZ2gtbGV2ZWwgZGVzY3JpcHRpb24gb2YgdGhlIHJlcXVlc3Qgd2l0aG91dCBleHBvc2luZ1xuLy8gZGV0YWlscyBvZiBFeHByZXNzJ3MgbG93LWxldmVsIGByZXFgLiAgQ3VycmVudGx5IGl0IGNvbnRhaW5zOlxuLy9cbi8vICogYGJyb3dzZXJgOiBicm93c2VyIGlkZW50aWZpY2F0aW9uIG9iamVjdCBkZXNjcmliZWQgYWJvdmVcbi8vICogYHVybGA6IHBhcnNlZCB1cmwsIGluY2x1ZGluZyBwYXJzZWQgcXVlcnkgcGFyYW1zXG4vL1xuLy8gQXMgYSB0ZW1wb3JhcnkgaGFjayB0aGVyZSBpcyBhIGBjYXRlZ29yaXplUmVxdWVzdGAgZnVuY3Rpb24gb24gV2ViQXBwIHdoaWNoXG4vLyBjb252ZXJ0cyBhIEV4cHJlc3MgYHJlcWAgdG8gYSBNZXRlb3IgYHJlcXVlc3RgLiBUaGlzIGNhbiBnbyBhd2F5IG9uY2Ugc21hcnRcbi8vIHBhY2thZ2VzIHN1Y2ggYXMgYXBwY2FjaGUgYXJlIGJlaW5nIHBhc3NlZCBhIGByZXF1ZXN0YCBvYmplY3QgZGlyZWN0bHkgd2hlblxuLy8gdGhleSBzZXJ2ZSBjb250ZW50LlxuLy9cbi8vIFRoaXMgYWxsb3dzIGByZXF1ZXN0YCB0byBiZSB1c2VkIHVuaWZvcm1seTogaXQgaXMgcGFzc2VkIHRvIHRoZSBodG1sXG4vLyBhdHRyaWJ1dGVzIGhvb2ssIGFuZCB0aGUgYXBwY2FjaGUgcGFja2FnZSBjYW4gdXNlIGl0IHdoZW4gZGVjaWRpbmdcbi8vIHdoZXRoZXIgdG8gZ2VuZXJhdGUgYSA0MDQgZm9yIHRoZSBtYW5pZmVzdC5cbi8vXG4vLyBSZWFsIHJvdXRpbmcgLyBzZXJ2ZXIgc2lkZSByZW5kZXJpbmcgd2lsbCBwcm9iYWJseSByZWZhY3RvciB0aGlzXG4vLyBoZWF2aWx5LlxuXG4vLyBlLmcuIFwiTW9iaWxlIFNhZmFyaVwiID0+IFwibW9iaWxlU2FmYXJpXCJcbnZhciBjYW1lbENhc2UgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHZhciBwYXJ0cyA9IG5hbWUuc3BsaXQoJyAnKTtcbiAgcGFydHNbMF0gPSBwYXJ0c1swXS50b0xvd2VyQ2FzZSgpO1xuICBmb3IgKHZhciBpID0gMTsgaSA8IHBhcnRzLmxlbmd0aDsgKytpKSB7XG4gICAgcGFydHNbaV0gPSBwYXJ0c1tpXS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHBhcnRzW2ldLnN1YnN0cmluZygxKTtcbiAgfVxuICByZXR1cm4gcGFydHMuam9pbignJyk7XG59O1xuXG52YXIgaWRlbnRpZnlCcm93c2VyID0gZnVuY3Rpb24odXNlckFnZW50U3RyaW5nKSB7XG4gIGlmICghdXNlckFnZW50U3RyaW5nKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG5hbWU6ICd1bmtub3duJyxcbiAgICAgIG1ham9yOiAwLFxuICAgICAgbWlub3I6IDAsXG4gICAgICBwYXRjaDogMFxuICAgIH07XG4gIH1cbiAgdmFyIHVzZXJBZ2VudCA9IGxvb2t1cFVzZXJBZ2VudCh1c2VyQWdlbnRTdHJpbmcpO1xuICByZXR1cm4ge1xuICAgIG5hbWU6IGNhbWVsQ2FzZSh1c2VyQWdlbnQuZmFtaWx5KSxcbiAgICBtYWpvcjogK3VzZXJBZ2VudC5tYWpvcixcbiAgICBtaW5vcjogK3VzZXJBZ2VudC5taW5vcixcbiAgICBwYXRjaDogK3VzZXJBZ2VudC5wYXRjaCxcbiAgfTtcbn07XG5cbi8vIFhYWCBSZWZhY3RvciBhcyBwYXJ0IG9mIGltcGxlbWVudGluZyByZWFsIHJvdXRpbmcuXG5XZWJBcHBJbnRlcm5hbHMuaWRlbnRpZnlCcm93c2VyID0gaWRlbnRpZnlCcm93c2VyO1xuXG5XZWJBcHAuY2F0ZWdvcml6ZVJlcXVlc3QgPSBmdW5jdGlvbihyZXEpIHtcbiAgaWYgKHJlcS5icm93c2VyICYmIHJlcS5hcmNoICYmIHR5cGVvZiByZXEubW9kZXJuID09PSAnYm9vbGVhbicpIHtcbiAgICAvLyBBbHJlYWR5IGNhdGVnb3JpemVkLlxuICAgIHJldHVybiByZXE7XG4gIH1cblxuICBjb25zdCBicm93c2VyID0gaWRlbnRpZnlCcm93c2VyKHJlcS5oZWFkZXJzWyd1c2VyLWFnZW50J10pO1xuICBjb25zdCBtb2Rlcm4gPSBpc01vZGVybihicm93c2VyKTtcbiAgY29uc3QgcGF0aCA9XG4gICAgdHlwZW9mIHJlcS5wYXRobmFtZSA9PT0gJ3N0cmluZydcbiAgICAgID8gcmVxLnBhdGhuYW1lXG4gICAgICA6IHBhcnNlUmVxdWVzdChyZXEpLnBhdGhuYW1lO1xuXG4gIGNvbnN0IGNhdGVnb3JpemVkID0ge1xuICAgIGJyb3dzZXIsXG4gICAgbW9kZXJuLFxuICAgIHBhdGgsXG4gICAgYXJjaDogV2ViQXBwLmRlZmF1bHRBcmNoLFxuICAgIHVybDogcGFyc2VVcmwocmVxLnVybCwgdHJ1ZSksXG4gICAgZHluYW1pY0hlYWQ6IHJlcS5keW5hbWljSGVhZCxcbiAgICBkeW5hbWljQm9keTogcmVxLmR5bmFtaWNCb2R5LFxuICAgIGhlYWRlcnM6IHJlcS5oZWFkZXJzLFxuICAgIGNvb2tpZXM6IHJlcS5jb29raWVzLFxuICB9O1xuXG4gIGNvbnN0IHBhdGhQYXJ0cyA9IHBhdGguc3BsaXQoJy8nKTtcbiAgY29uc3QgYXJjaEtleSA9IHBhdGhQYXJ0c1sxXTtcblxuICBpZiAoYXJjaEtleS5zdGFydHNXaXRoKCdfXycpKSB7XG4gICAgY29uc3QgYXJjaENsZWFuZWQgPSAnd2ViLicgKyBhcmNoS2V5LnNsaWNlKDIpO1xuICAgIGlmIChoYXNPd24uY2FsbChXZWJBcHAuY2xpZW50UHJvZ3JhbXMsIGFyY2hDbGVhbmVkKSkge1xuICAgICAgcGF0aFBhcnRzLnNwbGljZSgxLCAxKTsgLy8gUmVtb3ZlIHRoZSBhcmNoS2V5IHBhcnQuXG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihjYXRlZ29yaXplZCwge1xuICAgICAgICBhcmNoOiBhcmNoQ2xlYW5lZCxcbiAgICAgICAgcGF0aDogcGF0aFBhcnRzLmpvaW4oJy8nKSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8vIFRPRE8gUGVyaGFwcyBvbmUgZGF5IHdlIGNvdWxkIGluZmVyIENvcmRvdmEgY2xpZW50cyBoZXJlLCBzbyB0aGF0IHdlXG4gIC8vIHdvdWxkbid0IGhhdmUgdG8gdXNlIHByZWZpeGVkIFwiL19fY29yZG92YS8uLi5cIiBVUkxzLlxuICBjb25zdCBwcmVmZXJyZWRBcmNoT3JkZXIgPSBpc01vZGVybihicm93c2VyKVxuICAgID8gWyd3ZWIuYnJvd3NlcicsICd3ZWIuYnJvd3Nlci5sZWdhY3knXVxuICAgIDogWyd3ZWIuYnJvd3Nlci5sZWdhY3knLCAnd2ViLmJyb3dzZXInXTtcblxuICBmb3IgKGNvbnN0IGFyY2ggb2YgcHJlZmVycmVkQXJjaE9yZGVyKSB7XG4gICAgLy8gSWYgb3VyIHByZWZlcnJlZCBhcmNoIGlzIG5vdCBhdmFpbGFibGUsIGl0J3MgYmV0dGVyIHRvIHVzZSBhbm90aGVyXG4gICAgLy8gY2xpZW50IGFyY2ggdGhhdCBpcyBhdmFpbGFibGUgdGhhbiB0byBndWFyYW50ZWUgdGhlIHNpdGUgd29uJ3Qgd29ya1xuICAgIC8vIGJ5IHJldHVybmluZyBhbiB1bmtub3duIGFyY2guIEZvciBleGFtcGxlLCBpZiB3ZWIuYnJvd3Nlci5sZWdhY3kgaXNcbiAgICAvLyBleGNsdWRlZCB1c2luZyB0aGUgLS1leGNsdWRlLWFyY2hzIGNvbW1hbmQtbGluZSBvcHRpb24sIGxlZ2FjeVxuICAgIC8vIGNsaWVudHMgYXJlIGJldHRlciBvZmYgcmVjZWl2aW5nIHdlYi5icm93c2VyICh3aGljaCBtaWdodCBhY3R1YWxseVxuICAgIC8vIHdvcmspIHRoYW4gcmVjZWl2aW5nIGFuIEhUVFAgNDA0IHJlc3BvbnNlLiBJZiBub25lIG9mIHRoZSBhcmNocyBpblxuICAgIC8vIHByZWZlcnJlZEFyY2hPcmRlciBhcmUgZGVmaW5lZCwgb25seSB0aGVuIHNob3VsZCB3ZSBzZW5kIGEgNDA0LlxuICAgIGlmIChoYXNPd24uY2FsbChXZWJBcHAuY2xpZW50UHJvZ3JhbXMsIGFyY2gpKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmFzc2lnbihjYXRlZ29yaXplZCwgeyBhcmNoIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjYXRlZ29yaXplZDtcbn07XG5cbi8vIEhUTUwgYXR0cmlidXRlIGhvb2tzOiBmdW5jdGlvbnMgdG8gYmUgY2FsbGVkIHRvIGRldGVybWluZSBhbnkgYXR0cmlidXRlcyB0b1xuLy8gYmUgYWRkZWQgdG8gdGhlICc8aHRtbD4nIHRhZy4gRWFjaCBmdW5jdGlvbiBpcyBwYXNzZWQgYSAncmVxdWVzdCcgb2JqZWN0IChzZWVcbi8vICNCcm93c2VySWRlbnRpZmljYXRpb24pIGFuZCBzaG91bGQgcmV0dXJuIG51bGwgb3Igb2JqZWN0LlxudmFyIGh0bWxBdHRyaWJ1dGVIb29rcyA9IFtdO1xudmFyIGdldEh0bWxBdHRyaWJ1dGVzID0gZnVuY3Rpb24ocmVxdWVzdCkge1xuICB2YXIgY29tYmluZWRBdHRyaWJ1dGVzID0ge307XG4gIChodG1sQXR0cmlidXRlSG9va3MgfHwgW10pLmZvckVhY2goZnVuY3Rpb24oaG9vaykge1xuICAgIHZhciBhdHRyaWJ1dGVzID0gaG9vayhyZXF1ZXN0KTtcbiAgICBpZiAoYXR0cmlidXRlcyA9PT0gbnVsbCkgcmV0dXJuO1xuICAgIGlmICh0eXBlb2YgYXR0cmlidXRlcyAhPT0gJ29iamVjdCcpXG4gICAgICB0aHJvdyBFcnJvcignSFRNTCBhdHRyaWJ1dGUgaG9vayBtdXN0IHJldHVybiBudWxsIG9yIG9iamVjdCcpO1xuICAgIE9iamVjdC5hc3NpZ24oY29tYmluZWRBdHRyaWJ1dGVzLCBhdHRyaWJ1dGVzKTtcbiAgfSk7XG4gIHJldHVybiBjb21iaW5lZEF0dHJpYnV0ZXM7XG59O1xuV2ViQXBwLmFkZEh0bWxBdHRyaWJ1dGVIb29rID0gZnVuY3Rpb24oaG9vaykge1xuICBodG1sQXR0cmlidXRlSG9va3MucHVzaChob29rKTtcbn07XG5cbi8vIFNlcnZlIGFwcCBIVE1MIGZvciB0aGlzIFVSTD9cbnZhciBhcHBVcmwgPSBmdW5jdGlvbih1cmwpIHtcbiAgaWYgKHVybCA9PT0gJy9mYXZpY29uLmljbycgfHwgdXJsID09PSAnL3JvYm90cy50eHQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gTk9URTogYXBwLm1hbmlmZXN0IGlzIG5vdCBhIHdlYiBzdGFuZGFyZCBsaWtlIGZhdmljb24uaWNvIGFuZFxuICAvLyByb2JvdHMudHh0LiBJdCBpcyBhIGZpbGUgbmFtZSB3ZSBoYXZlIGNob3NlbiB0byB1c2UgZm9yIEhUTUw1XG4gIC8vIGFwcGNhY2hlIFVSTHMuIEl0IGlzIGluY2x1ZGVkIGhlcmUgdG8gcHJldmVudCB1c2luZyBhbiBhcHBjYWNoZVxuICAvLyB0aGVuIHJlbW92aW5nIGl0IGZyb20gcG9pc29uaW5nIGFuIGFwcCBwZXJtYW5lbnRseS4gRXZlbnR1YWxseSxcbiAgLy8gb25jZSB3ZSBoYXZlIHNlcnZlciBzaWRlIHJvdXRpbmcsIHRoaXMgd29uJ3QgYmUgbmVlZGVkIGFzXG4gIC8vIHVua25vd24gVVJMcyB3aXRoIHJldHVybiBhIDQwNCBhdXRvbWF0aWNhbGx5LlxuICBpZiAodXJsID09PSAnL2FwcC5tYW5pZmVzdCcpIHJldHVybiBmYWxzZTtcblxuICAvLyBBdm9pZCBzZXJ2aW5nIGFwcCBIVE1MIGZvciBkZWNsYXJlZCByb3V0ZXMgc3VjaCBhcyAvc29ja2pzLy5cbiAgaWYgKFJvdXRlUG9saWN5LmNsYXNzaWZ5KHVybCkpIHJldHVybiBmYWxzZTtcblxuICAvLyB3ZSBjdXJyZW50bHkgcmV0dXJuIGFwcCBIVE1MIG9uIGFsbCBVUkxzIGJ5IGRlZmF1bHRcbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyBXZSBuZWVkIHRvIGNhbGN1bGF0ZSB0aGUgY2xpZW50IGhhc2ggYWZ0ZXIgYWxsIHBhY2thZ2VzIGhhdmUgbG9hZGVkXG4vLyB0byBnaXZlIHRoZW0gYSBjaGFuY2UgdG8gcG9wdWxhdGUgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5cbi8vXG4vLyBDYWxjdWxhdGluZyB0aGUgaGFzaCBkdXJpbmcgc3RhcnR1cCBtZWFucyB0aGF0IHBhY2thZ2VzIGNhbiBvbmx5XG4vLyBwb3B1bGF0ZSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIGR1cmluZyBsb2FkLCBub3QgZHVyaW5nIHN0YXJ0dXAuXG4vL1xuLy8gQ2FsY3VsYXRpbmcgaW5zdGVhZCBpdCBhdCB0aGUgYmVnaW5uaW5nIG9mIG1haW4gYWZ0ZXIgYWxsIHN0YXJ0dXBcbi8vIGhvb2tzIGhhZCBydW4gd291bGQgYWxsb3cgcGFja2FnZXMgdG8gYWxzbyBwb3B1bGF0ZVxuLy8gX19tZXRlb3JfcnVudGltZV9jb25maWdfXyBkdXJpbmcgc3RhcnR1cCwgYnV0IHRoYXQncyB0b28gbGF0ZSBmb3Jcbi8vIGF1dG91cGRhdGUgYmVjYXVzZSBpdCBuZWVkcyB0byBoYXZlIHRoZSBjbGllbnQgaGFzaCBhdCBzdGFydHVwIHRvXG4vLyBpbnNlcnQgdGhlIGF1dG8gdXBkYXRlIHZlcnNpb24gaXRzZWxmIGludG9cbi8vIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18gdG8gZ2V0IGl0IHRvIHRoZSBjbGllbnQuXG4vL1xuLy8gQW4gYWx0ZXJuYXRpdmUgd291bGQgYmUgdG8gZ2l2ZSBhdXRvdXBkYXRlIGEgXCJwb3N0LXN0YXJ0LFxuLy8gcHJlLWxpc3RlblwiIGhvb2sgdG8gYWxsb3cgaXQgdG8gaW5zZXJ0IHRoZSBhdXRvIHVwZGF0ZSB2ZXJzaW9uIGF0XG4vLyB0aGUgcmlnaHQgbW9tZW50LlxuXG5NZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcbiAgZnVuY3Rpb24gZ2V0dGVyKGtleSkge1xuICAgIHJldHVybiBmdW5jdGlvbihhcmNoKSB7XG4gICAgICBhcmNoID0gYXJjaCB8fCBXZWJBcHAuZGVmYXVsdEFyY2g7XG4gICAgICBjb25zdCBwcm9ncmFtID0gV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdO1xuICAgICAgY29uc3QgdmFsdWUgPSBwcm9ncmFtICYmIHByb2dyYW1ba2V5XTtcbiAgICAgIC8vIElmIHRoaXMgaXMgdGhlIGZpcnN0IHRpbWUgd2UgaGF2ZSBjYWxjdWxhdGVkIHRoaXMgaGFzaCxcbiAgICAgIC8vIHByb2dyYW1ba2V5XSB3aWxsIGJlIGEgdGh1bmsgKGxhenkgZnVuY3Rpb24gd2l0aCBubyBwYXJhbWV0ZXJzKVxuICAgICAgLy8gdGhhdCB3ZSBzaG91bGQgY2FsbCB0byBkbyB0aGUgYWN0dWFsIGNvbXB1dGF0aW9uLlxuICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IChwcm9ncmFtW2tleV0gPSB2YWx1ZSgpKSA6IHZhbHVlO1xuICAgIH07XG4gIH1cblxuICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaCA9IFdlYkFwcC5jbGllbnRIYXNoID0gZ2V0dGVyKCd2ZXJzaW9uJyk7XG4gIFdlYkFwcC5jYWxjdWxhdGVDbGllbnRIYXNoUmVmcmVzaGFibGUgPSBnZXR0ZXIoJ3ZlcnNpb25SZWZyZXNoYWJsZScpO1xuICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaE5vblJlZnJlc2hhYmxlID0gZ2V0dGVyKCd2ZXJzaW9uTm9uUmVmcmVzaGFibGUnKTtcbiAgV2ViQXBwLmNhbGN1bGF0ZUNsaWVudEhhc2hSZXBsYWNlYWJsZSA9IGdldHRlcigndmVyc2lvblJlcGxhY2VhYmxlJyk7XG4gIFdlYkFwcC5nZXRSZWZyZXNoYWJsZUFzc2V0cyA9IGdldHRlcigncmVmcmVzaGFibGVBc3NldHMnKTtcbn0pO1xuXG4vLyBXaGVuIHdlIGhhdmUgYSByZXF1ZXN0IHBlbmRpbmcsIHdlIHdhbnQgdGhlIHNvY2tldCB0aW1lb3V0IHRvIGJlIGxvbmcsIHRvXG4vLyBnaXZlIG91cnNlbHZlcyBhIHdoaWxlIHRvIHNlcnZlIGl0LCBhbmQgdG8gYWxsb3cgc29ja2pzIGxvbmcgcG9sbHMgdG9cbi8vIGNvbXBsZXRlLiAgT24gdGhlIG90aGVyIGhhbmQsIHdlIHdhbnQgdG8gY2xvc2UgaWRsZSBzb2NrZXRzIHJlbGF0aXZlbHlcbi8vIHF1aWNrbHksIHNvIHRoYXQgd2UgY2FuIHNodXQgZG93biByZWxhdGl2ZWx5IHByb21wdGx5IGJ1dCBjbGVhbmx5LCB3aXRob3V0XG4vLyBjdXR0aW5nIG9mZiBhbnlvbmUncyByZXNwb25zZS5cbldlYkFwcC5fdGltZW91dEFkanVzdG1lbnRSZXF1ZXN0Q2FsbGJhY2sgPSBmdW5jdGlvbihyZXEsIHJlcykge1xuICAvLyB0aGlzIGlzIHJlYWxseSBqdXN0IHJlcS5zb2NrZXQuc2V0VGltZW91dChMT05HX1NPQ0tFVF9USU1FT1VUKTtcbiAgcmVxLnNldFRpbWVvdXQoTE9OR19TT0NLRVRfVElNRU9VVCk7XG4gIC8vIEluc2VydCBvdXIgbmV3IGZpbmlzaCBsaXN0ZW5lciB0byBydW4gQkVGT1JFIHRoZSBleGlzdGluZyBvbmUgd2hpY2ggcmVtb3Zlc1xuICAvLyB0aGUgcmVzcG9uc2UgZnJvbSB0aGUgc29ja2V0LlxuICB2YXIgZmluaXNoTGlzdGVuZXJzID0gcmVzLmxpc3RlbmVycygnZmluaXNoJyk7XG4gIC8vIFhYWCBBcHBhcmVudGx5IGluIE5vZGUgMC4xMiB0aGlzIGV2ZW50IHdhcyBjYWxsZWQgJ3ByZWZpbmlzaCcuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9qb3llbnQvbm9kZS9jb21taXQvN2M5YjYwNzBcbiAgLy8gQnV0IGl0IGhhcyBzd2l0Y2hlZCBiYWNrIHRvICdmaW5pc2gnIGluIE5vZGUgdjQ6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9wdWxsLzE0MTFcbiAgcmVzLnJlbW92ZUFsbExpc3RlbmVycygnZmluaXNoJyk7XG4gIHJlcy5vbignZmluaXNoJywgZnVuY3Rpb24oKSB7XG4gICAgcmVzLnNldFRpbWVvdXQoU0hPUlRfU09DS0VUX1RJTUVPVVQpO1xuICB9KTtcbiAgT2JqZWN0LnZhbHVlcyhmaW5pc2hMaXN0ZW5lcnMpLmZvckVhY2goZnVuY3Rpb24obCkge1xuICAgIHJlcy5vbignZmluaXNoJywgbCk7XG4gIH0pO1xufTtcblxuLy8gV2lsbCBiZSB1cGRhdGVkIGJ5IG1haW4gYmVmb3JlIHdlIGxpc3Rlbi5cbi8vIE1hcCBmcm9tIGNsaWVudCBhcmNoIHRvIGJvaWxlcnBsYXRlIG9iamVjdC5cbi8vIEJvaWxlcnBsYXRlIG9iamVjdCBoYXM6XG4vLyAgIC0gZnVuYzogWFhYXG4vLyAgIC0gYmFzZURhdGE6IFhYWFxudmFyIGJvaWxlcnBsYXRlQnlBcmNoID0ge307XG5cbi8vIFJlZ2lzdGVyIGEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBjYW4gc2VsZWN0aXZlbHkgbW9kaWZ5IGJvaWxlcnBsYXRlXG4vLyBkYXRhIGdpdmVuIGFyZ3VtZW50cyAocmVxdWVzdCwgZGF0YSwgYXJjaCkuIFRoZSBrZXkgc2hvdWxkIGJlIGEgdW5pcXVlXG4vLyBpZGVudGlmaWVyLCB0byBwcmV2ZW50IGFjY3VtdWxhdGluZyBkdXBsaWNhdGUgY2FsbGJhY2tzIGZyb20gdGhlIHNhbWVcbi8vIGNhbGwgc2l0ZSBvdmVyIHRpbWUuIENhbGxiYWNrcyB3aWxsIGJlIGNhbGxlZCBpbiB0aGUgb3JkZXIgdGhleSB3ZXJlXG4vLyByZWdpc3RlcmVkLiBBIGNhbGxiYWNrIHNob3VsZCByZXR1cm4gZmFsc2UgaWYgaXQgZGlkIG5vdCBtYWtlIGFueVxuLy8gY2hhbmdlcyBhZmZlY3RpbmcgdGhlIGJvaWxlcnBsYXRlLiBQYXNzaW5nIG51bGwgZGVsZXRlcyB0aGUgY2FsbGJhY2suXG4vLyBBbnkgcHJldmlvdXMgY2FsbGJhY2sgcmVnaXN0ZXJlZCBmb3IgdGhpcyBrZXkgd2lsbCBiZSByZXR1cm5lZC5cbmNvbnN0IGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5XZWJBcHBJbnRlcm5hbHMucmVnaXN0ZXJCb2lsZXJwbGF0ZURhdGFDYWxsYmFjayA9IGZ1bmN0aW9uKGtleSwgY2FsbGJhY2spIHtcbiAgY29uc3QgcHJldmlvdXNDYWxsYmFjayA9IGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrc1trZXldO1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3Nba2V5XSA9IGNhbGxiYWNrO1xuICB9IGVsc2Uge1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjYWxsYmFjaywgbnVsbCk7XG4gICAgZGVsZXRlIGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrc1trZXldO1xuICB9XG5cbiAgLy8gUmV0dXJuIHRoZSBwcmV2aW91cyBjYWxsYmFjayBpbiBjYXNlIHRoZSBuZXcgY2FsbGJhY2sgbmVlZHMgdG8gY2FsbFxuICAvLyBpdDsgZm9yIGV4YW1wbGUsIHdoZW4gdGhlIG5ldyBjYWxsYmFjayBpcyBhIHdyYXBwZXIgZm9yIHRoZSBvbGQuXG4gIHJldHVybiBwcmV2aW91c0NhbGxiYWNrIHx8IG51bGw7XG59O1xuXG4vLyBHaXZlbiBhIHJlcXVlc3QgKGFzIHJldHVybmVkIGZyb20gYGNhdGVnb3JpemVSZXF1ZXN0YCksIHJldHVybiB0aGVcbi8vIGJvaWxlcnBsYXRlIEhUTUwgdG8gc2VydmUgZm9yIHRoYXQgcmVxdWVzdC5cbi8vXG4vLyBJZiBhIHByZXZpb3VzIEV4cHJlc3MgbWlkZGxld2FyZSBoYXMgcmVuZGVyZWQgY29udGVudCBmb3IgdGhlIGhlYWQgb3IgYm9keSxcbi8vIHJldHVybnMgdGhlIGJvaWxlcnBsYXRlIHdpdGggdGhhdCBjb250ZW50IHBhdGNoZWQgaW4gb3RoZXJ3aXNlXG4vLyBtZW1vaXplcyBvbiBIVE1MIGF0dHJpYnV0ZXMgKHVzZWQgYnksIGVnLCBhcHBjYWNoZSkgYW5kIHdoZXRoZXIgaW5saW5lXG4vLyBzY3JpcHRzIGFyZSBjdXJyZW50bHkgYWxsb3dlZC5cbi8vIFhYWCBzbyBmYXIgdGhpcyBmdW5jdGlvbiBpcyBhbHdheXMgY2FsbGVkIHdpdGggYXJjaCA9PT0gJ3dlYi5icm93c2VyJ1xuZnVuY3Rpb24gZ2V0Qm9pbGVycGxhdGUocmVxdWVzdCwgYXJjaCkge1xuICByZXR1cm4gZ2V0Qm9pbGVycGxhdGVBc3luYyhyZXF1ZXN0LCBhcmNoKTtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBUYWtlcyBhIHJ1bnRpbWUgY29uZmlndXJhdGlvbiBvYmplY3QgYW5kXG4gKiByZXR1cm5zIGFuIGVuY29kZWQgcnVudGltZSBzdHJpbmcuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge09iamVjdH0gcnRpbWVDb25maWdcbiAqIEByZXR1cm5zIHtTdHJpbmd9XG4gKi9cbldlYkFwcC5lbmNvZGVSdW50aW1lQ29uZmlnID0gZnVuY3Rpb24ocnRpbWVDb25maWcpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGVuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShydGltZUNvbmZpZykpKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgVGFrZXMgYW4gZW5jb2RlZCBydW50aW1lIHN0cmluZyBhbmQgcmV0dXJuc1xuICogYSBydW50aW1lIGNvbmZpZ3VyYXRpb24gb2JqZWN0LlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHtTdHJpbmd9IHJ0aW1lQ29uZmlnU3RyaW5nXG4gKiBAcmV0dXJucyB7T2JqZWN0fVxuICovXG5XZWJBcHAuZGVjb2RlUnVudGltZUNvbmZpZyA9IGZ1bmN0aW9uKHJ0aW1lQ29uZmlnU3RyKSB7XG4gIHJldHVybiBKU09OLnBhcnNlKGRlY29kZVVSSUNvbXBvbmVudChKU09OLnBhcnNlKHJ0aW1lQ29uZmlnU3RyKSkpO1xufTtcblxuY29uc3QgcnVudGltZUNvbmZpZyA9IHtcbiAgLy8gaG9va3Mgd2lsbCBjb250YWluIHRoZSBjYWxsYmFjayBmdW5jdGlvbnNcbiAgLy8gc2V0IGJ5IHRoZSBjYWxsZXIgdG8gYWRkUnVudGltZUNvbmZpZ0hvb2tcbiAgaG9va3M6IG5ldyBIb29rKCksXG4gIC8vIHVwZGF0ZUhvb2tzIHdpbGwgY29udGFpbiB0aGUgY2FsbGJhY2sgZnVuY3Rpb25zXG4gIC8vIHNldCBieSB0aGUgY2FsbGVyIHRvIGFkZFVwZGF0ZWROb3RpZnlIb29rXG4gIHVwZGF0ZUhvb2tzOiBuZXcgSG9vaygpLFxuICAvLyBpc1VwZGF0ZWRCeUFyY2ggaXMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgZmllbGRzIGZvciBlYWNoIGFyY2hcbiAgLy8gdGhhdCB0aGlzIHNlcnZlciBzdXBwb3J0cy5cbiAgLy8gLSBFYWNoIGZpZWxkIHdpbGwgYmUgdHJ1ZSB3aGVuIHRoZSBzZXJ2ZXIgdXBkYXRlcyB0aGUgcnVudGltZUNvbmZpZyBmb3IgdGhhdCBhcmNoLlxuICAvLyAtIFdoZW4gdGhlIGhvb2sgY2FsbGJhY2sgaXMgY2FsbGVkIHRoZSB1cGRhdGUgZmllbGQgaW4gdGhlIGNhbGxiYWNrIG9iamVjdCB3aWxsIGJlXG4gIC8vIHNldCB0byBpc1VwZGF0ZWRCeUFyY2hbYXJjaF0uXG4gIC8vID0gaXNVcGRhdGVkeUJ5QXJjaFthcmNoXSBpcyByZXNldCB0byBmYWxzZSBhZnRlciB0aGUgY2FsbGJhY2suXG4gIC8vIFRoaXMgZW5hYmxlcyB0aGUgY2FsbGVyIHRvIGNhY2hlIGRhdGEgZWZmaWNpZW50bHkgc28gdGhleSBkbyBub3QgbmVlZCB0b1xuICAvLyBkZWNvZGUgJiB1cGRhdGUgZGF0YSBvbiBldmVyeSBjYWxsYmFjayB3aGVuIHRoZSBydW50aW1lQ29uZmlnIGlzIG5vdCBjaGFuZ2luZy5cbiAgaXNVcGRhdGVkQnlBcmNoOiB7fSxcbn07XG5cbi8qKlxuICogQG5hbWUgYWRkUnVudGltZUNvbmZpZ0hvb2tDYWxsYmFjayhvcHRpb25zKVxuICogQGxvY3VzIFNlcnZlclxuICogQGlzcHJvdG90eXBlIHRydWVcbiAqIEBzdW1tYXJ5IENhbGxiYWNrIGZvciBgYWRkUnVudGltZUNvbmZpZ0hvb2tgLlxuICpcbiAqIElmIHRoZSBoYW5kbGVyIHJldHVybnMgYSBfZmFsc3lfIHZhbHVlIHRoZSBob29rIHdpbGwgbm90XG4gKiBtb2RpZnkgdGhlIHJ1bnRpbWUgY29uZmlndXJhdGlvbi5cbiAqXG4gKiBJZiB0aGUgaGFuZGxlciByZXR1cm5zIGEgX1N0cmluZ18gdGhlIGhvb2sgd2lsbCBzdWJzdGl0dXRlXG4gKiB0aGUgc3RyaW5nIGZvciB0aGUgZW5jb2RlZCBjb25maWd1cmF0aW9uIHN0cmluZy5cbiAqXG4gKiAqKldhcm5pbmc6KiogdGhlIGhvb2sgZG9lcyBub3QgY2hlY2sgdGhlIHJldHVybiB2YWx1ZSBhdCBhbGwgaXQgaXNcbiAqIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgY2FsbGVyIHRvIGdldCB0aGUgZm9ybWF0dGluZyBjb3JyZWN0IHVzaW5nXG4gKiB0aGUgaGVscGVyIGZ1bmN0aW9ucy5cbiAqXG4gKiBgYWRkUnVudGltZUNvbmZpZ0hvb2tDYWxsYmFja2AgdGFrZXMgb25seSBvbmUgYE9iamVjdGAgYXJndW1lbnRcbiAqIHdpdGggdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMuYXJjaCBUaGUgYXJjaGl0ZWN0dXJlIG9mIHRoZSBjbGllbnRcbiAqIHJlcXVlc3RpbmcgYSBuZXcgcnVudGltZSBjb25maWd1cmF0aW9uLiBUaGlzIGNhbiBiZSBvbmUgb2ZcbiAqIGB3ZWIuYnJvd3NlcmAsIGB3ZWIuYnJvd3Nlci5sZWdhY3lgIG9yIGB3ZWIuY29yZG92YWAuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5yZXF1ZXN0XG4gKiBBIE5vZGVKcyBbSW5jb21pbmdNZXNzYWdlXShodHRwczovL25vZGVqcy5vcmcvYXBpL2h0dHAuaHRtbCNodHRwX2NsYXNzX2h0dHBfaW5jb21pbmdtZXNzYWdlKVxuICogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9odHRwLmh0bWwjaHR0cF9jbGFzc19odHRwX2luY29taW5nbWVzc2FnZVxuICogYE9iamVjdGAgdGhhdCBjYW4gYmUgdXNlZCB0byBnZXQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5lbmNvZGVkQ3VycmVudENvbmZpZyBUaGUgY3VycmVudCBjb25maWd1cmF0aW9uIG9iamVjdFxuICogZW5jb2RlZCBhcyBhIHN0cmluZyBmb3IgaW5jbHVzaW9uIGluIHRoZSByb290IGh0bWwuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudXBkYXRlZCBgdHJ1ZWAgaWYgdGhlIGNvbmZpZyBmb3IgdGhpcyBhcmNoaXRlY3R1cmVcbiAqIGhhcyBiZWVuIHVwZGF0ZWQgc2luY2UgbGFzdCBjYWxsZWQsIG90aGVyd2lzZSBgZmFsc2VgLiBUaGlzIGZsYWcgY2FuIGJlIHVzZWRcbiAqIHRvIGNhY2hlIHRoZSBkZWNvZGluZy9lbmNvZGluZyBmb3IgZWFjaCBhcmNoaXRlY3R1cmUuXG4gKi9cblxuLyoqXG4gKiBAc3VtbWFyeSBIb29rIHRoYXQgY2FsbHMgYmFjayB3aGVuIHRoZSBtZXRlb3IgcnVudGltZSBjb25maWd1cmF0aW9uLFxuICogYF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX19gIGlzIGJlaW5nIHNlbnQgdG8gYW55IGNsaWVudC5cbiAqXG4gKiAqKnJldHVybnMqKjogPHNtYWxsPl9PYmplY3RfPC9zbWFsbD4gYHsgc3RvcDogZnVuY3Rpb24sIGNhbGxiYWNrOiBmdW5jdGlvbiB9YFxuICogLSBgc3RvcGAgPHNtYWxsPl9GdW5jdGlvbl88L3NtYWxsPiBDYWxsIGBzdG9wKClgIHRvIHN0b3AgZ2V0dGluZyBjYWxsYmFja3MuXG4gKiAtIGBjYWxsYmFja2AgPHNtYWxsPl9GdW5jdGlvbl88L3NtYWxsPiBUaGUgcGFzc2VkIGluIGBjYWxsYmFja2AuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge2FkZFJ1bnRpbWVDb25maWdIb29rQ2FsbGJhY2t9IGNhbGxiYWNrXG4gKiBTZWUgYGFkZFJ1bnRpbWVDb25maWdIb29rQ2FsbGJhY2tgIGRlc2NyaXB0aW9uLlxuICogQHJldHVybnMge09iamVjdH0ge3sgc3RvcDogZnVuY3Rpb24sIGNhbGxiYWNrOiBmdW5jdGlvbiB9fVxuICogQ2FsbCB0aGUgcmV0dXJuZWQgYHN0b3AoKWAgdG8gc3RvcCBnZXR0aW5nIGNhbGxiYWNrcy5cbiAqIFRoZSBwYXNzZWQgaW4gYGNhbGxiYWNrYCBpcyByZXR1cm5lZCBhbHNvLlxuICovXG5XZWJBcHAuYWRkUnVudGltZUNvbmZpZ0hvb2sgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICByZXR1cm4gcnVudGltZUNvbmZpZy5ob29rcy5yZWdpc3RlcihjYWxsYmFjayk7XG59O1xuXG5hc3luYyBmdW5jdGlvbiBnZXRCb2lsZXJwbGF0ZUFzeW5jKHJlcXVlc3QsIGFyY2gsIHJlc3BvbnNlKSB7XG4gIGxldCBib2lsZXJwbGF0ZSA9IGJvaWxlcnBsYXRlQnlBcmNoW2FyY2hdO1xuICBhd2FpdCBydW50aW1lQ29uZmlnLmhvb2tzLmZvckVhY2hBc3luYyhhc3luYyBob29rID0+IHtcbiAgICBjb25zdCBtZXRlb3JSdW50aW1lQ29uZmlnID0gYXdhaXQgaG9vayh7XG4gICAgICBhcmNoLFxuICAgICAgcmVxdWVzdCxcbiAgICAgIGVuY29kZWRDdXJyZW50Q29uZmlnOiBib2lsZXJwbGF0ZS5iYXNlRGF0YS5tZXRlb3JSdW50aW1lQ29uZmlnLFxuICAgICAgdXBkYXRlZDogcnVudGltZUNvbmZpZy5pc1VwZGF0ZWRCeUFyY2hbYXJjaF0sXG4gICAgfSk7XG4gICAgaWYgKCFtZXRlb3JSdW50aW1lQ29uZmlnKSByZXR1cm4gdHJ1ZTtcbiAgICBib2lsZXJwbGF0ZS5iYXNlRGF0YSA9IE9iamVjdC5hc3NpZ24oe30sIGJvaWxlcnBsYXRlLmJhc2VEYXRhLCB7XG4gICAgICBtZXRlb3JSdW50aW1lQ29uZmlnLFxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9KTtcbiAgcnVudGltZUNvbmZpZy5pc1VwZGF0ZWRCeUFyY2hbYXJjaF0gPSBmYWxzZTtcbiAgY29uc3QgeyBkeW5hbWljSGVhZCwgZHluYW1pY0JvZHkgfSA9IHJlcXVlc3Q7XG4gIGNvbnN0IGRhdGEgPSBPYmplY3QuYXNzaWduKFxuICAgIHt9LFxuICAgIGJvaWxlcnBsYXRlLmJhc2VEYXRhLFxuICAgIHtcbiAgICAgIGh0bWxBdHRyaWJ1dGVzOiBnZXRIdG1sQXR0cmlidXRlcyhyZXF1ZXN0KSxcbiAgICB9LFxuICAgIHsgZHluYW1pY0hlYWQsIGR5bmFtaWNCb2R5IH1cbiAgKTtcblxuICBsZXQgbWFkZUNoYW5nZXMgPSBmYWxzZTtcbiAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcblxuICBPYmplY3Qua2V5cyhib2lsZXJwbGF0ZURhdGFDYWxsYmFja3MpLmZvckVhY2goa2V5ID0+IHtcbiAgICBwcm9taXNlID0gcHJvbWlzZVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICBjb25zdCBjYWxsYmFjayA9IGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrc1trZXldO1xuICAgICAgICByZXR1cm4gY2FsbGJhY2socmVxdWVzdCwgZGF0YSwgYXJjaCwgcmVzcG9uc2UpO1xuICAgICAgfSlcbiAgICAgIC50aGVuKHJlc3VsdCA9PiB7XG4gICAgICAgIC8vIENhbGxiYWNrcyBzaG91bGQgcmV0dXJuIGZhbHNlIGlmIHRoZXkgZGlkIG5vdCBtYWtlIGFueSBjaGFuZ2VzLlxuICAgICAgICBpZiAocmVzdWx0ICE9PSBmYWxzZSkge1xuICAgICAgICAgIG1hZGVDaGFuZ2VzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH0pO1xuXG4gIHJldHVybiBwcm9taXNlLnRoZW4oKCkgPT4gKHtcbiAgICBzdHJlYW06IGJvaWxlcnBsYXRlLnRvSFRNTFN0cmVhbShkYXRhKSxcbiAgICBzdGF0dXNDb2RlOiBkYXRhLnN0YXR1c0NvZGUsXG4gICAgaGVhZGVyczogZGF0YS5oZWFkZXJzLFxuICB9KSk7XG59XG5cbi8qKlxuICogQG5hbWUgYWRkVXBkYXRlZE5vdGlmeUhvb2tDYWxsYmFjayhvcHRpb25zKVxuICogQHN1bW1hcnkgY2FsbGJhY2sgaGFuZGxlciBmb3IgYGFkZHVwZGF0ZWROb3RpZnlIb29rYFxuICogQGlzcHJvdG90eXBlIHRydWVcbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5hcmNoIFRoZSBhcmNoaXRlY3R1cmUgdGhhdCBpcyBiZWluZyB1cGRhdGVkLlxuICogVGhpcyBjYW4gYmUgb25lIG9mIGB3ZWIuYnJvd3NlcmAsIGB3ZWIuYnJvd3Nlci5sZWdhY3lgIG9yIGB3ZWIuY29yZG92YWAuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5tYW5pZmVzdCBUaGUgbmV3IHVwZGF0ZWQgbWFuaWZlc3Qgb2JqZWN0IGZvclxuICogdGhpcyBgYXJjaGAuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5ydW50aW1lQ29uZmlnIFRoZSBuZXcgdXBkYXRlZCBjb25maWd1cmF0aW9uXG4gKiBvYmplY3QgZm9yIHRoaXMgYGFyY2hgLlxuICovXG5cbi8qKlxuICogQHN1bW1hcnkgSG9vayB0aGF0IHJ1bnMgd2hlbiB0aGUgbWV0ZW9yIHJ1bnRpbWUgY29uZmlndXJhdGlvblxuICogaXMgdXBkYXRlZC4gIFR5cGljYWxseSB0aGUgY29uZmlndXJhdGlvbiBvbmx5IGNoYW5nZXMgZHVyaW5nIGRldmVsb3BtZW50IG1vZGUuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge2FkZFVwZGF0ZWROb3RpZnlIb29rQ2FsbGJhY2t9IGhhbmRsZXJcbiAqIFRoZSBgaGFuZGxlcmAgaXMgY2FsbGVkIG9uIGV2ZXJ5IGNoYW5nZSB0byBhbiBgYXJjaGAgcnVudGltZSBjb25maWd1cmF0aW9uLlxuICogU2VlIGBhZGRVcGRhdGVkTm90aWZ5SG9va0NhbGxiYWNrYC5cbiAqIEByZXR1cm5zIHtPYmplY3R9IHt7IHN0b3A6IGZ1bmN0aW9uLCBjYWxsYmFjazogZnVuY3Rpb24gfX1cbiAqL1xuV2ViQXBwLmFkZFVwZGF0ZWROb3RpZnlIb29rID0gZnVuY3Rpb24oaGFuZGxlcikge1xuICByZXR1cm4gcnVudGltZUNvbmZpZy51cGRhdGVIb29rcy5yZWdpc3RlcihoYW5kbGVyKTtcbn07XG5cbldlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlSW5zdGFuY2UgPSBmdW5jdGlvbihcbiAgYXJjaCxcbiAgbWFuaWZlc3QsXG4gIGFkZGl0aW9uYWxPcHRpb25zXG4pIHtcbiAgYWRkaXRpb25hbE9wdGlvbnMgPSBhZGRpdGlvbmFsT3B0aW9ucyB8fCB7fTtcblxuICBydW50aW1lQ29uZmlnLmlzVXBkYXRlZEJ5QXJjaFthcmNoXSA9IHRydWU7XG4gIGNvbnN0IHJ0aW1lQ29uZmlnID0ge1xuICAgIC4uLl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18sXG4gICAgLi4uKGFkZGl0aW9uYWxPcHRpb25zLnJ1bnRpbWVDb25maWdPdmVycmlkZXMgfHwge30pLFxuICB9O1xuICBydW50aW1lQ29uZmlnLnVwZGF0ZUhvb2tzLmZvckVhY2goY2IgPT4ge1xuICAgIGNiKHsgYXJjaCwgbWFuaWZlc3QsIHJ1bnRpbWVDb25maWc6IHJ0aW1lQ29uZmlnIH0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9KTtcblxuICBjb25zdCBtZXRlb3JSdW50aW1lQ29uZmlnID0gSlNPTi5zdHJpbmdpZnkoXG4gICAgZW5jb2RlVVJJQ29tcG9uZW50KEpTT04uc3RyaW5naWZ5KHJ0aW1lQ29uZmlnKSlcbiAgKTtcblxuICByZXR1cm4gbmV3IEJvaWxlcnBsYXRlKFxuICAgIGFyY2gsXG4gICAgbWFuaWZlc3QsXG4gICAgT2JqZWN0LmFzc2lnbihcbiAgICAgIHtcbiAgICAgICAgcGF0aE1hcHBlcihpdGVtUGF0aCkge1xuICAgICAgICAgIHJldHVybiBwYXRoSm9pbihhcmNoUGF0aFthcmNoXSwgaXRlbVBhdGgpO1xuICAgICAgICB9LFxuICAgICAgICBiYXNlRGF0YUV4dGVuc2lvbjoge1xuICAgICAgICAgIGFkZGl0aW9uYWxTdGF0aWNKczogKE9iamVjdC5lbnRyaWVzKGFkZGl0aW9uYWxTdGF0aWNKcykgfHwgW10pLm1hcChmdW5jdGlvbihcbiAgICAgICAgICAgIFtwYXRobmFtZSwgY29udGVudHNdXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBwYXRobmFtZTogcGF0aG5hbWUsXG4gICAgICAgICAgICAgIGNvbnRlbnRzOiBjb250ZW50cyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSksXG4gICAgICAgICAgLy8gQ29udmVydCB0byBhIEpTT04gc3RyaW5nLCB0aGVuIGdldCByaWQgb2YgbW9zdCB3ZWlyZCBjaGFyYWN0ZXJzLCB0aGVuXG4gICAgICAgICAgLy8gd3JhcCBpbiBkb3VibGUgcXVvdGVzLiAoVGhlIG91dGVybW9zdCBKU09OLnN0cmluZ2lmeSByZWFsbHkgb3VnaHQgdG9cbiAgICAgICAgICAvLyBqdXN0IGJlIFwid3JhcCBpbiBkb3VibGUgcXVvdGVzXCIgYnV0IHdlIHVzZSBpdCB0byBiZSBzYWZlLikgVGhpcyBtaWdodFxuICAgICAgICAgIC8vIGVuZCB1cCBpbnNpZGUgYSA8c2NyaXB0PiB0YWcgc28gd2UgbmVlZCB0byBiZSBjYXJlZnVsIHRvIG5vdCBpbmNsdWRlXG4gICAgICAgICAgLy8gXCI8L3NjcmlwdD5cIiwgYnV0IG5vcm1hbCB7e3NwYWNlYmFyc319IGVzY2FwaW5nIGVzY2FwZXMgdG9vIG11Y2ghIFNlZVxuICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy8zNzMwXG4gICAgICAgICAgbWV0ZW9yUnVudGltZUNvbmZpZyxcbiAgICAgICAgICBtZXRlb3JSdW50aW1lSGFzaDogc2hhMShtZXRlb3JSdW50aW1lQ29uZmlnKSxcbiAgICAgICAgICByb290VXJsUGF0aFByZWZpeDpcbiAgICAgICAgICAgIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVggfHwgJycsXG4gICAgICAgICAgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2s6IGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rLFxuICAgICAgICAgIHNyaU1vZGU6IHNyaU1vZGUsXG4gICAgICAgICAgaW5saW5lU2NyaXB0c0FsbG93ZWQ6IFdlYkFwcEludGVybmFscy5pbmxpbmVTY3JpcHRzQWxsb3dlZCgpLFxuICAgICAgICAgIGlubGluZTogYWRkaXRpb25hbE9wdGlvbnMuaW5saW5lLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGFkZGl0aW9uYWxPcHRpb25zXG4gICAgKVxuICApO1xufTtcblxuLy8gQSBtYXBwaW5nIGZyb20gdXJsIHBhdGggdG8gYXJjaGl0ZWN0dXJlIChlLmcuIFwid2ViLmJyb3dzZXJcIikgdG8gc3RhdGljXG4vLyBmaWxlIGluZm9ybWF0aW9uIHdpdGggdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4vLyAtIHR5cGU6IHRoZSB0eXBlIG9mIGZpbGUgdG8gYmUgc2VydmVkXG4vLyAtIGNhY2hlYWJsZTogb3B0aW9uYWxseSwgd2hldGhlciB0aGUgZmlsZSBzaG91bGQgYmUgY2FjaGVkIG9yIG5vdFxuLy8gLSBzb3VyY2VNYXBVcmw6IG9wdGlvbmFsbHksIHRoZSB1cmwgb2YgdGhlIHNvdXJjZSBtYXBcbi8vXG4vLyBJbmZvIGFsc28gY29udGFpbnMgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4vLyAtIGNvbnRlbnQ6IHRoZSBzdHJpbmdpZmllZCBjb250ZW50IHRoYXQgc2hvdWxkIGJlIHNlcnZlZCBhdCB0aGlzIHBhdGhcbi8vIC0gYWJzb2x1dGVQYXRoOiB0aGUgYWJzb2x1dGUgcGF0aCBvbiBkaXNrIHRvIHRoZSBmaWxlXG5cbi8vIFNlcnZlIHN0YXRpYyBmaWxlcyBmcm9tIHRoZSBtYW5pZmVzdCBvciBhZGRlZCB3aXRoXG4vLyBgYWRkU3RhdGljSnNgLiBFeHBvcnRlZCBmb3IgdGVzdHMuXG5XZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNNaWRkbGV3YXJlID0gYXN5bmMgZnVuY3Rpb24oXG4gIHN0YXRpY0ZpbGVzQnlBcmNoLFxuICByZXEsXG4gIHJlcyxcbiAgbmV4dFxuKSB7XG4gIHZhciBwYXRobmFtZSA9IHBhcnNlUmVxdWVzdChyZXEpLnBhdGhuYW1lO1xuICB0cnkge1xuICAgIHBhdGhuYW1lID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhdGhuYW1lKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIG5leHQoKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgc2VydmVTdGF0aWNKcyA9IGZ1bmN0aW9uKHMpIHtcbiAgICBpZiAoXG4gICAgICByZXEubWV0aG9kID09PSAnR0VUJyB8fFxuICAgICAgcmVxLm1ldGhvZCA9PT0gJ0hFQUQnIHx8XG4gICAgICBNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXM/LndlYmFwcD8uYWx3YXlzUmV0dXJuQ29udGVudFxuICAgICkge1xuICAgICAgcmVzLndyaXRlSGVhZCgyMDAsIHtcbiAgICAgICAgJ0NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0OyBjaGFyc2V0PVVURi04JyxcbiAgICAgICAgJ0NvbnRlbnQtTGVuZ3RoJzogQnVmZmVyLmJ5dGVMZW5ndGgocyksXG4gICAgICB9KTtcbiAgICAgIHJlcy53cml0ZShzKTtcbiAgICAgIHJlcy5lbmQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgc3RhdHVzID0gcmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnID8gMjAwIDogNDA1O1xuICAgICAgcmVzLndyaXRlSGVhZChzdGF0dXMsIHtcbiAgICAgICAgQWxsb3c6ICdPUFRJT05TLCBHRVQsIEhFQUQnLFxuICAgICAgICAnQ29udGVudC1MZW5ndGgnOiAnMCcsXG4gICAgICB9KTtcbiAgICAgIHJlcy5lbmQoKTtcbiAgICB9XG4gIH07XG5cbiAgaWYgKFxuICAgIHBhdGhuYW1lIGluIGFkZGl0aW9uYWxTdGF0aWNKcyAmJlxuICAgICFXZWJBcHBJbnRlcm5hbHMuaW5saW5lU2NyaXB0c0FsbG93ZWQoKVxuICApIHtcbiAgICBzZXJ2ZVN0YXRpY0pzKGFkZGl0aW9uYWxTdGF0aWNKc1twYXRobmFtZV0pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHsgYXJjaCwgcGF0aCB9ID0gV2ViQXBwLmNhdGVnb3JpemVSZXF1ZXN0KHJlcSk7XG5cbiAgaWYgKCFoYXNPd24uY2FsbChXZWJBcHAuY2xpZW50UHJvZ3JhbXMsIGFyY2gpKSB7XG4gICAgLy8gV2UgY291bGQgY29tZSBoZXJlIGluIGNhc2Ugd2UgcnVuIHdpdGggc29tZSBhcmNoaXRlY3R1cmVzIGV4Y2x1ZGVkXG4gICAgbmV4dCgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIElmIHBhdXNlQ2xpZW50KGFyY2gpIGhhcyBiZWVuIGNhbGxlZCwgcHJvZ3JhbS5wYXVzZWQgd2lsbCBiZSBhXG4gIC8vIFByb21pc2UgdGhhdCB3aWxsIGJlIHJlc29sdmVkIHdoZW4gdGhlIHByb2dyYW0gaXMgdW5wYXVzZWQuXG4gIGNvbnN0IHByb2dyYW0gPSBXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF07XG4gIGF3YWl0IHByb2dyYW0ucGF1c2VkO1xuXG4gIGlmIChcbiAgICBwYXRoID09PSAnL21ldGVvcl9ydW50aW1lX2NvbmZpZy5qcycgJiZcbiAgICAhV2ViQXBwSW50ZXJuYWxzLmlubGluZVNjcmlwdHNBbGxvd2VkKClcbiAgKSB7XG4gICAgc2VydmVTdGF0aWNKcyhcbiAgICAgIGBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fID0gJHtwcm9ncmFtLm1ldGVvclJ1bnRpbWVDb25maWd9O2BcbiAgICApO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGluZm8gPSBnZXRTdGF0aWNGaWxlSW5mbyhzdGF0aWNGaWxlc0J5QXJjaCwgcGF0aG5hbWUsIHBhdGgsIGFyY2gpO1xuICBpZiAoIWluZm8pIHtcbiAgICBuZXh0KCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIC8vIFwic2VuZFwiIHdpbGwgaGFuZGxlIEhFQUQgJiBHRVQgcmVxdWVzdHNcbiAgaWYgKFxuICAgIHJlcS5tZXRob2QgIT09ICdIRUFEJyAmJlxuICAgIHJlcS5tZXRob2QgIT09ICdHRVQnICYmXG4gICAgIU1ldGVvci5zZXR0aW5ncy5wYWNrYWdlcz8ud2ViYXBwPy5hbHdheXNSZXR1cm5Db250ZW50XG4gICkge1xuICAgIGNvbnN0IHN0YXR1cyA9IHJlcS5tZXRob2QgPT09ICdPUFRJT05TJyA/IDIwMCA6IDQwNTtcbiAgICByZXMud3JpdGVIZWFkKHN0YXR1cywge1xuICAgICAgQWxsb3c6ICdPUFRJT05TLCBHRVQsIEhFQUQnLFxuICAgICAgJ0NvbnRlbnQtTGVuZ3RoJzogJzAnLFxuICAgIH0pO1xuICAgIHJlcy5lbmQoKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBXZSBkb24ndCBuZWVkIHRvIGNhbGwgcGF1c2UgYmVjYXVzZSwgdW5saWtlICdzdGF0aWMnLCBvbmNlIHdlIGNhbGwgaW50b1xuICAvLyAnc2VuZCcgYW5kIHlpZWxkIHRvIHRoZSBldmVudCBsb29wLCB3ZSBuZXZlciBjYWxsIGFub3RoZXIgaGFuZGxlciB3aXRoXG4gIC8vICduZXh0Jy5cblxuICAvLyBDYWNoZWFibGUgZmlsZXMgYXJlIGZpbGVzIHRoYXQgc2hvdWxkIG5ldmVyIGNoYW5nZS4gVHlwaWNhbGx5XG4gIC8vIG5hbWVkIGJ5IHRoZWlyIGhhc2ggKGVnIG1ldGVvciBidW5kbGVkIGpzIGFuZCBjc3MgZmlsZXMpLlxuICAvLyBXZSBjYWNoZSB0aGVtIH5mb3JldmVyICgxeXIpLlxuICBjb25zdCBtYXhBZ2UgPSBpbmZvLmNhY2hlYWJsZSA/IDEwMDAgKiA2MCAqIDYwICogMjQgKiAzNjUgOiAwO1xuXG4gIC8vIFJlc291cmNlcyB3aG9zZSBVUkwgYWxyZWFkeSBjb250YWlucyB0aGUgY29udGVudCBoYXNoIGFyZSBpbW11dGFibGVcbiAgLy8gYW5kIHVuaXF1ZSBwZXIgYXJjaGl0ZWN0dXJlIChtb2Rlcm4gdnMgbGVnYWN5KSwgc28gVmFyeTogVXNlci1BZ2VudFxuICAvLyBpcyB1bm5lY2Vzc2FyeSBhbmQgaGFybXMgQ0ROIGNhY2hlIGVmZmljaWVuY3kuXG4gIC8vXG4gIC8vIElmIHRoZSByZXF1ZXN0ZWQgVVJMIGRvZXMgbm90IGNvbnRhaW4gdGhlIGhhc2ggKGUuZy4gZGV2ZWxvcG1lbnRcbiAgLy8gb3IgdW5oYXNoZWQgYXNzZXRzKSwgd2Uga2VlcCBWYXJ5OiBVc2VyLUFnZW50IHRvIHByZXZlbnQgY2FjaGVcbiAgLy8gcG9pc29uaW5nIGFjcm9zcyBkaWZmZXJlbnQgYnJvd3NlcnMuXG4gIGNvbnN0IGluY2x1ZGVWYXJ5VXNlckFnZW50ID1cbiAgTWV0ZW9yLnNldHRpbmdzLnBhY2thZ2VzPy53ZWJhcHA/LmluY2x1ZGVWYXJ5VXNlckFnZW50ID8/IHRydWU7XG5cbiAgaWYgKGluZm8uY2FjaGVhYmxlICYmICFwYXRobmFtZS5pbmNsdWRlcyhpbmZvLmhhc2gpICYmIGluY2x1ZGVWYXJ5VXNlckFnZW50KSB7XG4gICAgcmVzLnNldEhlYWRlcignVmFyeScsICdVc2VyLUFnZW50Jyk7XG4gIH1cblxuICAvLyBTZXQgdGhlIFgtU291cmNlTWFwIGhlYWRlciwgd2hpY2ggY3VycmVudCBDaHJvbWUsIEZpcmVGb3gsIGFuZCBTYWZhcmlcbiAgLy8gdW5kZXJzdGFuZC4gIChUaGUgU291cmNlTWFwIGhlYWRlciBpcyBzbGlnaHRseSBtb3JlIHNwZWMtY29ycmVjdCBidXQgRkZcbiAgLy8gZG9lc24ndCB1bmRlcnN0YW5kIGl0LilcbiAgLy9cbiAgLy8gWW91IG1heSBhbHNvIG5lZWQgdG8gZW5hYmxlIHNvdXJjZSBtYXBzIGluIENocm9tZTogb3BlbiBkZXYgdG9vbHMsIGNsaWNrXG4gIC8vIHRoZSBnZWFyIGluIHRoZSBib3R0b20gcmlnaHQgY29ybmVyLCBhbmQgc2VsZWN0IFwiZW5hYmxlIHNvdXJjZSBtYXBzXCIuXG4gIGlmIChpbmZvLnNvdXJjZU1hcFVybCkge1xuICAgIHJlcy5zZXRIZWFkZXIoXG4gICAgICAnWC1Tb3VyY2VNYXAnLFxuICAgICAgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWCArIGluZm8uc291cmNlTWFwVXJsXG4gICAgKTtcbiAgfVxuXG4gIGlmIChpbmZvLnR5cGUgPT09ICdqcycgfHwgaW5mby50eXBlID09PSAnZHluYW1pYyBqcycpIHtcbiAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vamF2YXNjcmlwdDsgY2hhcnNldD1VVEYtOCcpO1xuICB9IGVsc2UgaWYgKGluZm8udHlwZSA9PT0gJ2NzcycpIHtcbiAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC9jc3M7IGNoYXJzZXQ9VVRGLTgnKTtcbiAgfSBlbHNlIGlmIChpbmZvLnR5cGUgPT09ICdqc29uJykge1xuICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PVVURi04Jyk7XG4gIH1cblxuICBpZiAoaW5mby5oYXNoKSB7XG4gICAgcmVzLnNldEhlYWRlcignRVRhZycsICdcIicgKyBpbmZvLmhhc2ggKyAnXCInKTtcbiAgfVxuXG4gIGlmIChpbmZvLmNvbnRlbnQpIHtcbiAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LUxlbmd0aCcsIEJ1ZmZlci5ieXRlTGVuZ3RoKGluZm8uY29udGVudCkpO1xuICAgIHJlcy53cml0ZShpbmZvLmNvbnRlbnQpO1xuICAgIHJlcy5lbmQoKTtcbiAgfSBlbHNlIHtcbiAgICBzZW5kKHJlcSwgaW5mby5hYnNvbHV0ZVBhdGgsIHtcbiAgICAgIG1heGFnZTogbWF4QWdlLFxuICAgICAgZG90ZmlsZXM6ICdhbGxvdycsIC8vIGlmIHdlIHNwZWNpZmllZCBhIGRvdGZpbGUgaW4gdGhlIG1hbmlmZXN0LCBzZXJ2ZSBpdFxuICAgICAgbGFzdE1vZGlmaWVkOiBmYWxzZSwgLy8gZG9uJ3Qgc2V0IGxhc3QtbW9kaWZpZWQgYmFzZWQgb24gdGhlIGZpbGUgZGF0ZVxuICAgIH0pXG4gICAgICAub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIExvZy5lcnJvcignRXJyb3Igc2VydmluZyBzdGF0aWMgZmlsZSAnICsgZXJyKTtcbiAgICAgICAgcmVzLndyaXRlSGVhZCg1MDApO1xuICAgICAgICByZXMuZW5kKCk7XG4gICAgICB9KVxuICAgICAgLm9uKCdkaXJlY3RvcnknLCBmdW5jdGlvbigpIHtcbiAgICAgICAgTG9nLmVycm9yKCdVbmV4cGVjdGVkIGRpcmVjdG9yeSAnICsgaW5mby5hYnNvbHV0ZVBhdGgpO1xuICAgICAgICByZXMud3JpdGVIZWFkKDUwMCk7XG4gICAgICAgIHJlcy5lbmQoKTtcbiAgICAgIH0pXG4gICAgICAucGlwZShyZXMpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBnZXRTdGF0aWNGaWxlSW5mbyhzdGF0aWNGaWxlc0J5QXJjaCwgb3JpZ2luYWxQYXRoLCBwYXRoLCBhcmNoKSB7XG4gIGlmICghaGFzT3duLmNhbGwoV2ViQXBwLmNsaWVudFByb2dyYW1zLCBhcmNoKSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gR2V0IGEgbGlzdCBvZiBhbGwgYXZhaWxhYmxlIHN0YXRpYyBmaWxlIGFyY2hpdGVjdHVyZXMsIHdpdGggYXJjaFxuICAvLyBmaXJzdCBpbiB0aGUgbGlzdCBpZiBpdCBleGlzdHMuXG4gIGNvbnN0IHN0YXRpY0FyY2hMaXN0ID0gT2JqZWN0LmtleXMoc3RhdGljRmlsZXNCeUFyY2gpO1xuICBjb25zdCBhcmNoSW5kZXggPSBzdGF0aWNBcmNoTGlzdC5pbmRleE9mKGFyY2gpO1xuICBpZiAoYXJjaEluZGV4ID4gMCkge1xuICAgIHN0YXRpY0FyY2hMaXN0LnVuc2hpZnQoc3RhdGljQXJjaExpc3Quc3BsaWNlKGFyY2hJbmRleCwgMSlbMF0pO1xuICB9XG5cbiAgbGV0IGluZm8gPSBudWxsO1xuXG4gIHN0YXRpY0FyY2hMaXN0LnNvbWUoYXJjaCA9PiB7XG4gICAgY29uc3Qgc3RhdGljRmlsZXMgPSBzdGF0aWNGaWxlc0J5QXJjaFthcmNoXTtcblxuICAgIGZ1bmN0aW9uIGZpbmFsaXplKHBhdGgpIHtcbiAgICAgIGluZm8gPSBzdGF0aWNGaWxlc1twYXRoXTtcbiAgICAgIC8vIFNvbWV0aW1lcyB3ZSByZWdpc3RlciBhIGxhenkgZnVuY3Rpb24gaW5zdGVhZCBvZiBhY3R1YWwgZGF0YSBpblxuICAgICAgLy8gdGhlIHN0YXRpY0ZpbGVzIG1hbmlmZXN0LlxuICAgICAgaWYgKHR5cGVvZiBpbmZvID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGluZm8gPSBzdGF0aWNGaWxlc1twYXRoXSA9IGluZm8oKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpbmZvO1xuICAgIH1cblxuICAgIC8vIElmIHN0YXRpY0ZpbGVzIGNvbnRhaW5zIG9yaWdpbmFsUGF0aCB3aXRoIHRoZSBhcmNoIGluZmVycmVkIGFib3ZlLFxuICAgIC8vIHVzZSB0aGF0IGluZm9ybWF0aW9uLlxuICAgIGlmIChoYXNPd24uY2FsbChzdGF0aWNGaWxlcywgb3JpZ2luYWxQYXRoKSkge1xuICAgICAgcmV0dXJuIGZpbmFsaXplKG9yaWdpbmFsUGF0aCk7XG4gICAgfVxuXG4gICAgLy8gSWYgY2F0ZWdvcml6ZVJlcXVlc3QgcmV0dXJuZWQgYW4gYWx0ZXJuYXRlIHBhdGgsIHRyeSB0aGF0IGluc3RlYWQuXG4gICAgaWYgKHBhdGggIT09IG9yaWdpbmFsUGF0aCAmJiBoYXNPd24uY2FsbChzdGF0aWNGaWxlcywgcGF0aCkpIHtcbiAgICAgIHJldHVybiBmaW5hbGl6ZShwYXRoKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbmZvO1xufVxuXG4vLyBQYXJzZSB0aGUgcGFzc2VkIGluIHBvcnQgdmFsdWUuIFJldHVybiB0aGUgcG9ydCBhcy1pcyBpZiBpdCdzIGEgU3RyaW5nXG4vLyAoZS5nLiBhIFdpbmRvd3MgU2VydmVyIHN0eWxlIG5hbWVkIHBpcGUpLCBvdGhlcndpc2UgcmV0dXJuIHRoZSBwb3J0IGFzIGFuXG4vLyBpbnRlZ2VyLlxuLy9cbi8vIERFUFJFQ0FURUQ6IERpcmVjdCB1c2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyBub3QgcmVjb21tZW5kZWQ7IGl0IGlzIG5vXG4vLyBsb25nZXIgdXNlZCBpbnRlcm5hbGx5LCBhbmQgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHJlbGVhc2UuXG5XZWJBcHBJbnRlcm5hbHMucGFyc2VQb3J0ID0gcG9ydCA9PiB7XG4gIGxldCBwYXJzZWRQb3J0ID0gcGFyc2VJbnQocG9ydCk7XG4gIGlmIChOdW1iZXIuaXNOYU4ocGFyc2VkUG9ydCkpIHtcbiAgICBwYXJzZWRQb3J0ID0gcG9ydDtcbiAgfVxuICByZXR1cm4gcGFyc2VkUG9ydDtcbn07XG5cbmltcG9ydCB7IG9uTWVzc2FnZSB9IGZyb20gJ21ldGVvci9pbnRlci1wcm9jZXNzLW1lc3NhZ2luZyc7XG5cbm9uTWVzc2FnZSgnd2ViYXBwLXBhdXNlLWNsaWVudCcsIGFzeW5jICh7IGFyY2ggfSkgPT4ge1xuICBhd2FpdCBXZWJBcHBJbnRlcm5hbHMucGF1c2VDbGllbnQoYXJjaCk7XG59KTtcblxub25NZXNzYWdlKCd3ZWJhcHAtcmVsb2FkLWNsaWVudCcsIGFzeW5jICh7IGFyY2ggfSkgPT4ge1xuICBhd2FpdCBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVDbGllbnRQcm9ncmFtKGFyY2gpO1xufSk7XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bldlYkFwcFNlcnZlcigpIHtcbiAgdmFyIHNodXR0aW5nRG93biA9IGZhbHNlO1xuICB2YXIgc3luY1F1ZXVlID0gbmV3IE1ldGVvci5fQXN5bmNocm9ub3VzUXVldWUoKTtcblxuICB2YXIgZ2V0SXRlbVBhdGhuYW1lID0gZnVuY3Rpb24oaXRlbVVybCkge1xuICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQocGFyc2VVcmwoaXRlbVVybCkucGF0aG5hbWUpO1xuICB9O1xuXG4gIFdlYkFwcEludGVybmFscy5yZWxvYWRDbGllbnRQcm9ncmFtcyA9IGFzeW5jIGZ1bmN0aW9uKCkge1xuICAgIGF3YWl0IHN5bmNRdWV1ZS5ydW5UYXNrKGZ1bmN0aW9uKCkge1xuICAgICAgY29uc3Qgc3RhdGljRmlsZXNCeUFyY2ggPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4gICAgICBjb25zdCB7IGNvbmZpZ0pzb24gfSA9IF9fbWV0ZW9yX2Jvb3RzdHJhcF9fO1xuICAgICAgY29uc3QgY2xpZW50QXJjaHMgPVxuICAgICAgICBjb25maWdKc29uLmNsaWVudEFyY2hzIHx8IE9iamVjdC5rZXlzKGNvbmZpZ0pzb24uY2xpZW50UGF0aHMpO1xuXG4gICAgICB0cnkge1xuICAgICAgICBjbGllbnRBcmNocy5mb3JFYWNoKGFyY2ggPT4ge1xuICAgICAgICAgIGdlbmVyYXRlQ2xpZW50UHJvZ3JhbShhcmNoLCBzdGF0aWNGaWxlc0J5QXJjaCk7XG4gICAgICAgIH0pO1xuICAgICAgICBXZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNCeUFyY2ggPSBzdGF0aWNGaWxlc0J5QXJjaDtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgTG9nLmVycm9yKCdFcnJvciByZWxvYWRpbmcgdGhlIGNsaWVudCBwcm9ncmFtOiAnICsgZS5zdGFjayk7XG4gICAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICAvLyBQYXVzZSBhbnkgaW5jb21pbmcgcmVxdWVzdHMgYW5kIG1ha2UgdGhlbSB3YWl0IGZvciB0aGUgcHJvZ3JhbSB0byBiZVxuICAvLyB1bnBhdXNlZCB0aGUgbmV4dCB0aW1lIGdlbmVyYXRlQ2xpZW50UHJvZ3JhbShhcmNoKSBpcyBjYWxsZWQuXG4gIFdlYkFwcEludGVybmFscy5wYXVzZUNsaWVudCA9IGFzeW5jIGZ1bmN0aW9uKGFyY2gpIHtcbiAgICBhd2FpdCBzeW5jUXVldWUucnVuVGFzaygoKSA9PiB7XG4gICAgICBjb25zdCBwcm9ncmFtID0gV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdO1xuICAgICAgY29uc3QgeyB1bnBhdXNlIH0gPSBwcm9ncmFtO1xuICAgICAgcHJvZ3JhbS5wYXVzZWQgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiB1bnBhdXNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgLy8gSWYgdGhlcmUgaGFwcGVucyB0byBiZSBhbiBleGlzdGluZyBwcm9ncmFtLnVucGF1c2UgZnVuY3Rpb24sXG4gICAgICAgICAgLy8gY29tcG9zZSBpdCB3aXRoIHRoZSByZXNvbHZlIGZ1bmN0aW9uLlxuICAgICAgICAgIHByb2dyYW0udW5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdW5wYXVzZSgpO1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJvZ3JhbS51bnBhdXNlID0gcmVzb2x2ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQ2xpZW50UHJvZ3JhbSA9IGFzeW5jIGZ1bmN0aW9uKGFyY2gpIHtcbiAgICBhd2FpdCBzeW5jUXVldWUucnVuVGFzaygoKSA9PiBnZW5lcmF0ZUNsaWVudFByb2dyYW0oYXJjaCkpO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGdlbmVyYXRlQ2xpZW50UHJvZ3JhbShcbiAgICBhcmNoLFxuICAgIHN0YXRpY0ZpbGVzQnlBcmNoID0gV2ViQXBwSW50ZXJuYWxzLnN0YXRpY0ZpbGVzQnlBcmNoXG4gICkge1xuICAgIGNvbnN0IGNsaWVudERpciA9IHBhdGhKb2luKFxuICAgICAgcGF0aERpcm5hbWUoX19tZXRlb3JfYm9vdHN0cmFwX18uc2VydmVyRGlyKSxcbiAgICAgIGFyY2hcbiAgICApO1xuXG4gICAgLy8gcmVhZCB0aGUgY29udHJvbCBmb3IgdGhlIGNsaWVudCB3ZSdsbCBiZSBzZXJ2aW5nIHVwXG4gICAgY29uc3QgcHJvZ3JhbUpzb25QYXRoID0gcGF0aEpvaW4oY2xpZW50RGlyLCAncHJvZ3JhbS5qc29uJyk7XG5cbiAgICBsZXQgcHJvZ3JhbUpzb247XG4gICAgdHJ5IHtcbiAgICAgIHByb2dyYW1Kc29uID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMocHJvZ3JhbUpzb25QYXRoKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGUuY29kZSA9PT0gJ0VOT0VOVCcpIHJldHVybjtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgaWYgKHByb2dyYW1Kc29uLmZvcm1hdCAhPT0gJ3dlYi1wcm9ncmFtLXByZTEnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdVbnN1cHBvcnRlZCBmb3JtYXQgZm9yIGNsaWVudCBhc3NldHM6ICcgK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHByb2dyYW1Kc29uLmZvcm1hdClcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCFwcm9ncmFtSnNvblBhdGggfHwgIWNsaWVudERpciB8fCAhcHJvZ3JhbUpzb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2xpZW50IGNvbmZpZyBmaWxlIG5vdCBwYXJzZWQuJyk7XG4gICAgfVxuXG4gICAgYXJjaFBhdGhbYXJjaF0gPSBjbGllbnREaXI7XG4gICAgY29uc3Qgc3RhdGljRmlsZXMgPSAoc3RhdGljRmlsZXNCeUFyY2hbYXJjaF0gPSBPYmplY3QuY3JlYXRlKG51bGwpKTtcblxuICAgIGNvbnN0IHsgbWFuaWZlc3QgfSA9IHByb2dyYW1Kc29uO1xuICAgIG1hbmlmZXN0LmZvckVhY2goaXRlbSA9PiB7XG4gICAgICBpZiAoaXRlbS51cmwgJiYgaXRlbS53aGVyZSA9PT0gJ2NsaWVudCcpIHtcbiAgICAgICAgc3RhdGljRmlsZXNbZ2V0SXRlbVBhdGhuYW1lKGl0ZW0udXJsKV0gPSB7XG4gICAgICAgICAgYWJzb2x1dGVQYXRoOiBwYXRoSm9pbihjbGllbnREaXIsIGl0ZW0ucGF0aCksXG4gICAgICAgICAgY2FjaGVhYmxlOiBpdGVtLmNhY2hlYWJsZSxcbiAgICAgICAgICBoYXNoOiBpdGVtLmhhc2gsXG4gICAgICAgICAgLy8gTGluayBmcm9tIHNvdXJjZSB0byBpdHMgbWFwXG4gICAgICAgICAgc291cmNlTWFwVXJsOiBpdGVtLnNvdXJjZU1hcFVybCxcbiAgICAgICAgICB0eXBlOiBpdGVtLnR5cGUsXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGl0ZW0uc291cmNlTWFwKSB7XG4gICAgICAgICAgLy8gU2VydmUgdGhlIHNvdXJjZSBtYXAgdG9vLCB1bmRlciB0aGUgc3BlY2lmaWVkIFVSTC4gV2UgYXNzdW1lXG4gICAgICAgICAgLy8gYWxsIHNvdXJjZSBtYXBzIGFyZSBjYWNoZWFibGUuXG4gICAgICAgICAgc3RhdGljRmlsZXNbZ2V0SXRlbVBhdGhuYW1lKGl0ZW0uc291cmNlTWFwVXJsKV0gPSB7XG4gICAgICAgICAgICBhYnNvbHV0ZVBhdGg6IHBhdGhKb2luKGNsaWVudERpciwgaXRlbS5zb3VyY2VNYXApLFxuICAgICAgICAgICAgY2FjaGVhYmxlOiB0cnVlLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IHsgUFVCTElDX1NFVFRJTkdTIH0gPSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fO1xuICAgIGNvbnN0IGNvbmZpZ092ZXJyaWRlcyA9IHtcbiAgICAgIFBVQkxJQ19TRVRUSU5HUyxcbiAgICB9O1xuXG4gICAgY29uc3Qgb2xkUHJvZ3JhbSA9IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXTtcbiAgICBjb25zdCBuZXdQcm9ncmFtID0gKFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXSA9IHtcbiAgICAgIGZvcm1hdDogJ3dlYi1wcm9ncmFtLXByZTEnLFxuICAgICAgbWFuaWZlc3Q6IG1hbmlmZXN0LFxuICAgICAgLy8gVXNlIGFycm93IGZ1bmN0aW9ucyBzbyB0aGF0IHRoZXNlIHZlcnNpb25zIGNhbiBiZSBsYXppbHlcbiAgICAgIC8vIGNhbGN1bGF0ZWQgbGF0ZXIsIGFuZCBzbyB0aGF0IHRoZXkgd2lsbCBub3QgYmUgaW5jbHVkZWQgaW4gdGhlXG4gICAgICAvLyBzdGF0aWNGaWxlc1ttYW5pZmVzdFVybF0uY29udGVudCBzdHJpbmcgYmVsb3cuXG4gICAgICAvL1xuICAgICAgLy8gTm90ZTogdGhlc2UgdmVyc2lvbiBjYWxjdWxhdGlvbnMgbXVzdCBiZSBrZXB0IGluIGFncmVlbWVudCB3aXRoXG4gICAgICAvLyBDb3Jkb3ZhQnVpbGRlciNhcHBlbmRWZXJzaW9uIGluIHRvb2xzL2NvcmRvdmEvYnVpbGRlci5qcywgb3IgaG90XG4gICAgICAvLyBjb2RlIHB1c2ggd2lsbCByZWxvYWQgQ29yZG92YSBhcHBzIHVubmVjZXNzYXJpbHkuXG4gICAgICB2ZXJzaW9uOiAoKSA9PlxuICAgICAgICBXZWJBcHBIYXNoaW5nLmNhbGN1bGF0ZUNsaWVudEhhc2gobWFuaWZlc3QsIG51bGwsIGNvbmZpZ092ZXJyaWRlcyksXG4gICAgICB2ZXJzaW9uUmVmcmVzaGFibGU6ICgpID0+XG4gICAgICAgIFdlYkFwcEhhc2hpbmcuY2FsY3VsYXRlQ2xpZW50SGFzaChcbiAgICAgICAgICBtYW5pZmVzdCxcbiAgICAgICAgICB0eXBlID0+IHR5cGUgPT09ICdjc3MnLFxuICAgICAgICAgIGNvbmZpZ092ZXJyaWRlc1xuICAgICAgICApLFxuICAgICAgdmVyc2lvbk5vblJlZnJlc2hhYmxlOiAoKSA9PlxuICAgICAgICBXZWJBcHBIYXNoaW5nLmNhbGN1bGF0ZUNsaWVudEhhc2goXG4gICAgICAgICAgbWFuaWZlc3QsXG4gICAgICAgICAgKHR5cGUsIHJlcGxhY2VhYmxlKSA9PiB0eXBlICE9PSAnY3NzJyAmJiAhcmVwbGFjZWFibGUsXG4gICAgICAgICAgY29uZmlnT3ZlcnJpZGVzXG4gICAgICAgICksXG4gICAgICB2ZXJzaW9uUmVwbGFjZWFibGU6ICgpID0+XG4gICAgICAgIFdlYkFwcEhhc2hpbmcuY2FsY3VsYXRlQ2xpZW50SGFzaChcbiAgICAgICAgICBtYW5pZmVzdCxcbiAgICAgICAgICAoX3R5cGUsIHJlcGxhY2VhYmxlKSA9PiByZXBsYWNlYWJsZSxcbiAgICAgICAgICBjb25maWdPdmVycmlkZXNcbiAgICAgICAgKSxcbiAgICAgIGNvcmRvdmFDb21wYXRpYmlsaXR5VmVyc2lvbnM6IHByb2dyYW1Kc29uLmNvcmRvdmFDb21wYXRpYmlsaXR5VmVyc2lvbnMsXG4gICAgICBQVUJMSUNfU0VUVElOR1MsXG4gICAgICBobXJWZXJzaW9uOiBwcm9ncmFtSnNvbi5obXJWZXJzaW9uLFxuICAgIH0pO1xuXG4gICAgLy8gRXhwb3NlIHByb2dyYW0gZGV0YWlscyBhcyBhIHN0cmluZyByZWFjaGFibGUgdmlhIHRoZSBmb2xsb3dpbmcgVVJMLlxuICAgIGNvbnN0IG1hbmlmZXN0VXJsUHJlZml4ID0gJy9fXycgKyBhcmNoLnJlcGxhY2UoL153ZWJcXC4vLCAnJyk7XG4gICAgY29uc3QgbWFuaWZlc3RVcmwgPSBtYW5pZmVzdFVybFByZWZpeCArIGdldEl0ZW1QYXRobmFtZSgnL21hbmlmZXN0Lmpzb24nKTtcblxuICAgIHN0YXRpY0ZpbGVzW21hbmlmZXN0VXJsXSA9ICgpID0+IHtcbiAgICAgIGlmIChQYWNrYWdlLmF1dG91cGRhdGUpIHtcbiAgICAgICAgY29uc3Qge1xuICAgICAgICAgIEFVVE9VUERBVEVfVkVSU0lPTiA9IFBhY2thZ2UuYXV0b3VwZGF0ZS5BdXRvdXBkYXRlLmF1dG91cGRhdGVWZXJzaW9uLFxuICAgICAgICB9ID0gcHJvY2Vzcy5lbnY7XG5cbiAgICAgICAgaWYgKEFVVE9VUERBVEVfVkVSU0lPTikge1xuICAgICAgICAgIG5ld1Byb2dyYW0udmVyc2lvbiA9IEFVVE9VUERBVEVfVkVSU0lPTjtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIG5ld1Byb2dyYW0udmVyc2lvbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBuZXdQcm9ncmFtLnZlcnNpb24gPSBuZXdQcm9ncmFtLnZlcnNpb24oKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY29udGVudDogSlNPTi5zdHJpbmdpZnkobmV3UHJvZ3JhbSksXG4gICAgICAgIGNhY2hlYWJsZTogZmFsc2UsXG4gICAgICAgIGhhc2g6IG5ld1Byb2dyYW0udmVyc2lvbixcbiAgICAgICAgdHlwZTogJ2pzb24nLFxuICAgICAgfTtcbiAgICB9O1xuXG4gICAgZ2VuZXJhdGVCb2lsZXJwbGF0ZUZvckFyY2goYXJjaCk7XG5cbiAgICAvLyBJZiB0aGVyZSBhcmUgYW55IHJlcXVlc3RzIHdhaXRpbmcgb24gb2xkUHJvZ3JhbS5wYXVzZWQsIGxldCB0aGVtXG4gICAgLy8gY29udGludWUgbm93ICh1c2luZyB0aGUgbmV3IHByb2dyYW0pLlxuICAgIGlmIChvbGRQcm9ncmFtICYmIG9sZFByb2dyYW0ucGF1c2VkKSB7XG4gICAgICBvbGRQcm9ncmFtLnVucGF1c2UoKTtcbiAgICB9XG4gIH1cblxuICBjb25zdCBkZWZhdWx0T3B0aW9uc0ZvckFyY2ggPSB7XG4gICAgJ3dlYi5jb3Jkb3ZhJzoge1xuICAgICAgcnVudGltZUNvbmZpZ092ZXJyaWRlczoge1xuICAgICAgICAvLyBYWFggV2UgdXNlIGFic29sdXRlVXJsKCkgaGVyZSBzbyB0aGF0IHdlIHNlcnZlIGh0dHBzOi8vXG4gICAgICAgIC8vIFVSTHMgdG8gY29yZG92YSBjbGllbnRzIGlmIGZvcmNlLXNzbCBpcyBpbiB1c2UuIElmIHdlIHdlcmVcbiAgICAgICAgLy8gdG8gdXNlIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkwgaW5zdGVhZCBvZlxuICAgICAgICAvLyBhYnNvbHV0ZVVybCgpLCB0aGVuIENvcmRvdmEgY2xpZW50cyB3b3VsZCBpbW1lZGlhdGVseSBnZXQgYVxuICAgICAgICAvLyBIQ1Agc2V0dGluZyB0aGVpciBERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCB0b1xuICAgICAgICAvLyBodHRwOi8vZXhhbXBsZS5tZXRlb3IuY29tLiBUaGlzIGJyZWFrcyB0aGUgYXBwLCBiZWNhdXNlXG4gICAgICAgIC8vIGZvcmNlLXNzbCBkb2Vzbid0IHNlcnZlIENPUlMgaGVhZGVycyBvbiAzMDJcbiAgICAgICAgLy8gcmVkaXJlY3RzLiAoUGx1cyBpdCdzIHVuZGVzaXJhYmxlIHRvIGhhdmUgY2xpZW50c1xuICAgICAgICAvLyBjb25uZWN0aW5nIHRvIGh0dHA6Ly9leGFtcGxlLm1ldGVvci5jb20gd2hlbiBmb3JjZS1zc2wgaXNcbiAgICAgICAgLy8gaW4gdXNlLilcbiAgICAgICAgRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkw6XG4gICAgICAgICAgcHJvY2Vzcy5lbnYuTU9CSUxFX0REUF9VUkwgfHwgTWV0ZW9yLmFic29sdXRlVXJsKCksXG4gICAgICAgIFJPT1RfVVJMOiBwcm9jZXNzLmVudi5NT0JJTEVfUk9PVF9VUkwgfHwgTWV0ZW9yLmFic29sdXRlVXJsKCksXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICAnd2ViLmJyb3dzZXInOiB7XG4gICAgICBydW50aW1lQ29uZmlnT3ZlcnJpZGVzOiB7XG4gICAgICAgIGlzTW9kZXJuOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgJ3dlYi5icm93c2VyLmxlZ2FjeSc6IHtcbiAgICAgIHJ1bnRpbWVDb25maWdPdmVycmlkZXM6IHtcbiAgICAgICAgaXNNb2Rlcm46IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICB9O1xuXG4gIFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlID0gYXN5bmMgZnVuY3Rpb24oKSB7XG4gICAgLy8gVGhpcyBib2lsZXJwbGF0ZSB3aWxsIGJlIHNlcnZlZCB0byB0aGUgbW9iaWxlIGRldmljZXMgd2hlbiB1c2VkIHdpdGhcbiAgICAvLyBNZXRlb3IvQ29yZG92YSBmb3IgdGhlIEhvdC1Db2RlIFB1c2ggYW5kIHNpbmNlIHRoZSBmaWxlIHdpbGwgYmUgc2VydmVkIGJ5XG4gICAgLy8gdGhlIGRldmljZSdzIHNlcnZlciwgaXQgaXMgaW1wb3J0YW50IHRvIHNldCB0aGUgRERQIHVybCB0byB0aGUgYWN0dWFsXG4gICAgLy8gTWV0ZW9yIHNlcnZlciBhY2NlcHRpbmcgRERQIGNvbm5lY3Rpb25zIGFuZCBub3QgdGhlIGRldmljZSdzIGZpbGUgc2VydmVyLlxuICAgIGF3YWl0IHN5bmNRdWV1ZS5ydW5UYXNrKGZ1bmN0aW9uKCkge1xuICAgICAgT2JqZWN0LmtleXMoV2ViQXBwLmNsaWVudFByb2dyYW1zKS5mb3JFYWNoKGdlbmVyYXRlQm9pbGVycGxhdGVGb3JBcmNoKTtcbiAgICB9KTtcbiAgfTtcblxuICBmdW5jdGlvbiBnZW5lcmF0ZUJvaWxlcnBsYXRlRm9yQXJjaChhcmNoKSB7XG4gICAgY29uc3QgcHJvZ3JhbSA9IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXTtcbiAgICBjb25zdCBhZGRpdGlvbmFsT3B0aW9ucyA9IGRlZmF1bHRPcHRpb25zRm9yQXJjaFthcmNoXSB8fCB7fTtcbiAgICBjb25zdCB7IGJhc2VEYXRhIH0gPSAoYm9pbGVycGxhdGVCeUFyY2hbXG4gICAgICBhcmNoXG4gICAgXSA9IFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlSW5zdGFuY2UoXG4gICAgICBhcmNoLFxuICAgICAgcHJvZ3JhbS5tYW5pZmVzdCxcbiAgICAgIGFkZGl0aW9uYWxPcHRpb25zXG4gICAgKSk7XG4gICAgLy8gV2UgbmVlZCB0aGUgcnVudGltZSBjb25maWcgd2l0aCBvdmVycmlkZXMgZm9yIG1ldGVvcl9ydW50aW1lX2NvbmZpZy5qczpcbiAgICBwcm9ncmFtLm1ldGVvclJ1bnRpbWVDb25maWcgPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAuLi5fX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLFxuICAgICAgLi4uKGFkZGl0aW9uYWxPcHRpb25zLnJ1bnRpbWVDb25maWdPdmVycmlkZXMgfHwgbnVsbCksXG4gICAgfSk7XG4gICAgcHJvZ3JhbS5yZWZyZXNoYWJsZUFzc2V0cyA9IGJhc2VEYXRhLmNzcy5tYXAoZmlsZSA9PiAoe1xuICAgICAgdXJsOiBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayhmaWxlLnVybCksXG4gICAgfSkpO1xuICB9XG5cbiAgYXdhaXQgV2ViQXBwSW50ZXJuYWxzLnJlbG9hZENsaWVudFByb2dyYW1zKCk7XG5cbiAgLy8gd2Vic2VydmVyXG4gIHZhciBhcHAgPSBjcmVhdGVFeHByZXNzQXBwKClcblxuICAvLyBQYWNrYWdlcyBhbmQgYXBwcyBjYW4gYWRkIGhhbmRsZXJzIHRoYXQgcnVuIGJlZm9yZSBhbnkgb3RoZXIgTWV0ZW9yXG4gIC8vIGhhbmRsZXJzIHZpYSBXZWJBcHAucmF3RXhwcmVzc0hhbmRsZXJzLlxuICB2YXIgcmF3RXhwcmVzc0hhbmRsZXJzID0gY3JlYXRlRXhwcmVzc0FwcCgpXG4gIGFwcC51c2UocmF3RXhwcmVzc0hhbmRsZXJzKTtcblxuICAvLyBBdXRvLWNvbXByZXNzIGFueSBqc29uLCBqYXZhc2NyaXB0LCBvciB0ZXh0LlxuICBhcHAudXNlKGNvbXByZXNzKHsgZmlsdGVyOiBzaG91bGRDb21wcmVzcyB9KSk7XG5cbiAgLy8gcGFyc2UgY29va2llcyBpbnRvIGFuIG9iamVjdFxuICBhcHAudXNlKGNvb2tpZVBhcnNlcigpKTtcblxuICAvLyBXZSdyZSBub3QgYSBwcm94eTsgcmVqZWN0ICh3aXRob3V0IGNyYXNoaW5nKSBhdHRlbXB0cyB0byB0cmVhdCB1cyBsaWtlXG4gIC8vIG9uZS4gKFNlZSAjMTIxMi4pXG4gIGFwcC51c2UoZnVuY3Rpb24ocmVxLCByZXMsIG5leHQpIHtcbiAgICBpZiAoUm91dGVQb2xpY3kuaXNWYWxpZFVybChyZXEudXJsKSkge1xuICAgICAgbmV4dCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXMud3JpdGVIZWFkKDQwMCk7XG4gICAgcmVzLndyaXRlKCdOb3QgYSBwcm94eScpO1xuICAgIHJlcy5lbmQoKTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gZ2V0UGF0aFBhcnRzKHBhdGgpIHtcbiAgICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy8nKTtcbiAgICB3aGlsZSAocGFydHNbMF0gPT09ICcnKSBwYXJ0cy5zaGlmdCgpO1xuICAgIHJldHVybiBwYXJ0cztcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzUHJlZml4T2YocHJlZml4LCBhcnJheSkge1xuICAgIHJldHVybiAoXG4gICAgICBwcmVmaXgubGVuZ3RoIDw9IGFycmF5Lmxlbmd0aCAmJlxuICAgICAgcHJlZml4LmV2ZXJ5KChwYXJ0LCBpKSA9PiBwYXJ0ID09PSBhcnJheVtpXSlcbiAgICApO1xuICB9XG5cbiAgLy8gU3RyaXAgb2ZmIHRoZSBwYXRoIHByZWZpeCwgaWYgaXQgZXhpc3RzLlxuICBhcHAudXNlKGZ1bmN0aW9uKHJlcXVlc3QsIHJlc3BvbnNlLCBuZXh0KSB7XG4gICAgY29uc3QgcGF0aFByZWZpeCA9IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVg7XG4gICAgY29uc3QgeyBwYXRobmFtZSwgc2VhcmNoIH0gPSBwYXJzZVVybChyZXF1ZXN0LnVybCk7XG5cbiAgICAvLyBjaGVjayBpZiB0aGUgcGF0aCBpbiB0aGUgdXJsIHN0YXJ0cyB3aXRoIHRoZSBwYXRoIHByZWZpeFxuICAgIGlmIChwYXRoUHJlZml4KSB7XG4gICAgICBjb25zdCBwcmVmaXhQYXJ0cyA9IGdldFBhdGhQYXJ0cyhwYXRoUHJlZml4KTtcbiAgICAgIGNvbnN0IHBhdGhQYXJ0cyA9IGdldFBhdGhQYXJ0cyhwYXRobmFtZSk7XG4gICAgICBpZiAoaXNQcmVmaXhPZihwcmVmaXhQYXJ0cywgcGF0aFBhcnRzKSkge1xuICAgICAgICByZXF1ZXN0LnVybCA9ICcvJyArIHBhdGhQYXJ0cy5zbGljZShwcmVmaXhQYXJ0cy5sZW5ndGgpLmpvaW4oJy8nKTtcbiAgICAgICAgaWYgKHNlYXJjaCkge1xuICAgICAgICAgIHJlcXVlc3QudXJsICs9IHNlYXJjaDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwYXRobmFtZSA9PT0gJy9mYXZpY29uLmljbycgfHwgcGF0aG5hbWUgPT09ICcvcm9ib3RzLnR4dCcpIHtcbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfVxuXG4gICAgaWYgKHBhdGhQcmVmaXgpIHtcbiAgICAgIHJlc3BvbnNlLndyaXRlSGVhZCg0MDQpO1xuICAgICAgcmVzcG9uc2Uud3JpdGUoJ1Vua25vd24gcGF0aCcpO1xuICAgICAgcmVzcG9uc2UuZW5kKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbmV4dCgpO1xuICB9KTtcblxuICAvLyBTZXJ2ZSBzdGF0aWMgZmlsZXMgZnJvbSB0aGUgbWFuaWZlc3QuXG4gIC8vIFRoaXMgaXMgaW5zcGlyZWQgYnkgdGhlICdzdGF0aWMnIG1pZGRsZXdhcmUuXG4gIGFwcC51c2UoZnVuY3Rpb24ocmVxLCByZXMsIG5leHQpIHtcbiAgICAvLyBjb25zb2xlLmxvZyhTdHJpbmcoYXJndW1lbnRzLmNhbGxlZSkpO1xuICAgIFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc01pZGRsZXdhcmUoXG4gICAgICBXZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNCeUFyY2gsXG4gICAgICByZXEsXG4gICAgICByZXMsXG4gICAgICBuZXh0XG4gICAgKTtcbiAgfSk7XG5cbiAgLy8gQ29yZSBNZXRlb3IgcGFja2FnZXMgbGlrZSBkeW5hbWljLWltcG9ydCBjYW4gYWRkIGhhbmRsZXJzIGJlZm9yZVxuICAvLyBvdGhlciBoYW5kbGVycyBhZGRlZCBieSBwYWNrYWdlIGFuZCBhcHBsaWNhdGlvbiBjb2RlLlxuICBhcHAudXNlKChXZWJBcHBJbnRlcm5hbHMubWV0ZW9ySW50ZXJuYWxIYW5kbGVycyA9IGNyZWF0ZUV4cHJlc3NBcHAoKSkpO1xuXG4gIC8qKlxuICAgKiBAbmFtZSBleHByZXNzSGFuZGxlcnNDYWxsYmFjayhyZXEsIHJlcywgbmV4dClcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAaXNwcm90b3R5cGUgdHJ1ZVxuICAgKiBAc3VtbWFyeSBjYWxsYmFjayBoYW5kbGVyIGZvciBgV2ViQXBwLmV4cHJlc3NIYW5kbGVyc2BcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlcVxuICAgKiBhIE5vZGUuanNcbiAgICogW0luY29taW5nTWVzc2FnZV0oaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9odHRwLmh0bWwjY2xhc3MtaHR0cGluY29taW5nbWVzc2FnZSlcbiAgICogb2JqZWN0IHdpdGggc29tZSBleHRyYSBwcm9wZXJ0aWVzLiBUaGlzIGFyZ3VtZW50IGNhbiBiZSB1c2VkXG4gICAqICB0byBnZXQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXNcbiAgICogYSBOb2RlLmpzXG4gICAqIFtTZXJ2ZXJSZXNwb25zZV0oaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9odHRwLmh0bWwjY2xhc3MtaHR0cHNlcnZlcnJlc3BvbnNlKVxuICAgKiBvYmplY3QuIFVzZSB0aGlzIHRvIHdyaXRlIGRhdGEgdGhhdCBzaG91bGQgYmUgc2VudCBpbiByZXNwb25zZSB0byB0aGVcbiAgICogcmVxdWVzdCwgYW5kIGNhbGwgYHJlcy5lbmQoKWAgd2hlbiB5b3UgYXJlIGRvbmUuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG5leHRcbiAgICogQ2FsbGluZyB0aGlzIGZ1bmN0aW9uIHdpbGwgcGFzcyBvbiB0aGUgaGFuZGxpbmcgb2ZcbiAgICogdGhpcyByZXF1ZXN0IHRvIHRoZSBuZXh0IHJlbGV2YW50IGhhbmRsZXIuXG4gICAqXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAbWV0aG9kIGhhbmRsZXJzXG4gICAqIEBtZW1iZXJvZiBXZWJBcHBcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAc3VtbWFyeSBSZWdpc3RlciBhIGhhbmRsZXIgZm9yIGFsbCBIVFRQIHJlcXVlc3RzLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gW3BhdGhdXG4gICAqIFRoaXMgaGFuZGxlciB3aWxsIG9ubHkgYmUgY2FsbGVkIG9uIHBhdGhzIHRoYXQgbWF0Y2hcbiAgICogdGhpcyBzdHJpbmcuIFRoZSBtYXRjaCBoYXMgdG8gYm9yZGVyIG9uIGEgYC9gIG9yIGEgYC5gLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSwgYC9oZWxsb2Agd2lsbCBtYXRjaCBgL2hlbGxvL3dvcmxkYCBhbmRcbiAgICogYC9oZWxsby53b3JsZGAsIGJ1dCBub3QgYC9oZWxsb193b3JsZGAuXG4gICAqIEBwYXJhbSB7ZXhwcmVzc0hhbmRsZXJzQ2FsbGJhY2t9IGhhbmRsZXJcbiAgICogQSBoYW5kbGVyIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgb24gSFRUUCByZXF1ZXN0cy5cbiAgICogU2VlIGBleHByZXNzSGFuZGxlcnNDYWxsYmFja2BcbiAgICpcbiAgICovXG4gIC8vIFBhY2thZ2VzIGFuZCBhcHBzIGNhbiBhZGQgaGFuZGxlcnMgdG8gdGhpcyB2aWEgV2ViQXBwLmV4cHJlc3NIYW5kbGVycy5cbiAgLy8gVGhleSBhcmUgaW5zZXJ0ZWQgYmVmb3JlIG91ciBkZWZhdWx0IGhhbmRsZXIuXG4gIHZhciBwYWNrYWdlQW5kQXBwSGFuZGxlcnMgPSBjcmVhdGVFeHByZXNzQXBwKClcbiAgYXBwLnVzZShwYWNrYWdlQW5kQXBwSGFuZGxlcnMpO1xuXG4gIGxldCBzdXBwcmVzc0V4cHJlc3NFcnJvcnMgPSBmYWxzZTtcbiAgLy8gRXhwcmVzcyBrbm93cyBpdCBpcyBhbiBlcnJvciBoYW5kbGVyIGJlY2F1c2UgaXQgaGFzIDQgYXJndW1lbnRzIGluc3RlYWQgb2ZcbiAgLy8gMy4gZ28gZmlndXJlLiAgKEl0IGlzIG5vdCBzbWFydCBlbm91Z2ggdG8gZmluZCBzdWNoIGEgdGhpbmcgaWYgaXQncyBoaWRkZW5cbiAgLy8gaW5zaWRlIHBhY2thZ2VBbmRBcHBIYW5kbGVycy4pXG4gIGFwcC51c2UoZnVuY3Rpb24oZXJyLCByZXEsIHJlcywgbmV4dCkge1xuICAgIGlmICghZXJyIHx8ICFzdXBwcmVzc0V4cHJlc3NFcnJvcnMgfHwgIXJlcS5oZWFkZXJzWyd4LXN1cHByZXNzLWVycm9yJ10pIHtcbiAgICAgIG5leHQoZXJyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmVzLndyaXRlSGVhZChlcnIuc3RhdHVzLCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9wbGFpbicgfSk7XG4gICAgcmVzLmVuZCgnQW4gZXJyb3IgbWVzc2FnZScpO1xuICB9KTtcblxuICBhcHAudXNlKGFzeW5jIGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgaWYgKCFhcHBVcmwocmVxLnVybCkpIHtcbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIHJlcS5tZXRob2QgIT09ICdIRUFEJyAmJlxuICAgICAgcmVxLm1ldGhvZCAhPT0gJ0dFVCcgJiZcbiAgICAgICFNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXM/LndlYmFwcD8uYWx3YXlzUmV0dXJuQ29udGVudFxuICAgICkge1xuICAgICAgY29uc3Qgc3RhdHVzID0gcmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnID8gMjAwIDogNDA1O1xuICAgICAgcmVzLndyaXRlSGVhZChzdGF0dXMsIHtcbiAgICAgICAgQWxsb3c6ICdPUFRJT05TLCBHRVQsIEhFQUQnLFxuICAgICAgICAnQ29udGVudC1MZW5ndGgnOiAnMCcsXG4gICAgICB9KTtcbiAgICAgIHJlcy5lbmQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGhlYWRlcnMgPSB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAndGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04JyxcbiAgICAgIH07XG5cbiAgICAgIGlmIChzaHV0dGluZ0Rvd24pIHtcbiAgICAgICAgaGVhZGVyc1snQ29ubmVjdGlvbiddID0gJ0Nsb3NlJztcbiAgICAgIH1cblxuICAgICAgdmFyIHJlcXVlc3QgPSBXZWJBcHAuY2F0ZWdvcml6ZVJlcXVlc3QocmVxKTtcbiAgICAgIHZhciByZXNwb25zZSA9IHJlcztcblxuICAgICAgaWYgKHJlcXVlc3QudXJsLnF1ZXJ5ICYmIHJlcXVlc3QudXJsLnF1ZXJ5WydtZXRlb3JfY3NzX3Jlc291cmNlJ10pIHtcbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCB3ZSdyZSByZXF1ZXN0aW5nIGEgQ1NTIHJlc291cmNlIGluIHRoZSBtZXRlb3Itc3BlY2lmaWNcbiAgICAgICAgLy8gd2F5LCBidXQgd2UgZG9uJ3QgaGF2ZSBpdC4gIFNlcnZlIGEgc3RhdGljIGNzcyBmaWxlIHRoYXQgaW5kaWNhdGVzIHRoYXRcbiAgICAgICAgLy8gd2UgZGlkbid0IGhhdmUgaXQsIHNvIHdlIGNhbiBkZXRlY3QgdGhhdCBhbmQgcmVmcmVzaC4gIE1ha2Ugc3VyZVxuICAgICAgICAvLyB0aGF0IGFueSBwcm94aWVzIG9yIENETnMgZG9uJ3QgY2FjaGUgdGhpcyBlcnJvciEgIChOb3JtYWxseSBwcm94aWVzXG4gICAgICAgIC8vIG9yIENETnMgYXJlIHNtYXJ0IGVub3VnaCBub3QgdG8gY2FjaGUgZXJyb3IgcGFnZXMsIGJ1dCBpbiBvcmRlciB0b1xuICAgICAgICAvLyBtYWtlIHRoaXMgaGFjayB3b3JrLCB3ZSBuZWVkIHRvIHJldHVybiB0aGUgQ1NTIGZpbGUgYXMgYSAyMDAsIHdoaWNoXG4gICAgICAgIC8vIHdvdWxkIG90aGVyd2lzZSBiZSBjYWNoZWQuKVxuICAgICAgICBoZWFkZXJzWydDb250ZW50LVR5cGUnXSA9ICd0ZXh0L2NzczsgY2hhcnNldD11dGYtOCc7XG4gICAgICAgIGhlYWRlcnNbJ0NhY2hlLUNvbnRyb2wnXSA9ICduby1jYWNoZSc7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoMjAwLCBoZWFkZXJzKTtcbiAgICAgICAgcmVzLndyaXRlKCcubWV0ZW9yLWNzcy1ub3QtZm91bmQtZXJyb3IgeyB3aWR0aDogMHB4O30nKTtcbiAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXF1ZXN0LnVybC5xdWVyeSAmJiByZXF1ZXN0LnVybC5xdWVyeVsnbWV0ZW9yX2pzX3Jlc291cmNlJ10pIHtcbiAgICAgICAgLy8gU2ltaWxhcmx5LCB3ZSdyZSByZXF1ZXN0aW5nIGEgSlMgcmVzb3VyY2UgdGhhdCB3ZSBkb24ndCBoYXZlLlxuICAgICAgICAvLyBTZXJ2ZSBhbiB1bmNhY2hlZCA0MDQuIChXZSBjYW4ndCB1c2UgdGhlIHNhbWUgaGFjayB3ZSB1c2UgZm9yIENTUyxcbiAgICAgICAgLy8gYmVjYXVzZSBhY3R1YWxseSBhY3Rpbmcgb24gdGhhdCBoYWNrIHJlcXVpcmVzIHVzIHRvIGhhdmUgdGhlIEpTXG4gICAgICAgIC8vIGFscmVhZHkhKVxuICAgICAgICBoZWFkZXJzWydDYWNoZS1Db250cm9sJ10gPSAnbm8tY2FjaGUnO1xuICAgICAgICByZXMud3JpdGVIZWFkKDQwNCwgaGVhZGVycyk7XG4gICAgICAgIHJlcy5lbmQoJzQwNCBOb3QgRm91bmQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVxdWVzdC51cmwucXVlcnkgJiYgcmVxdWVzdC51cmwucXVlcnlbJ21ldGVvcl9kb250X3NlcnZlX2luZGV4J10pIHtcbiAgICAgICAgLy8gV2hlbiBkb3dubG9hZGluZyBmaWxlcyBkdXJpbmcgYSBDb3Jkb3ZhIGhvdCBjb2RlIHB1c2gsIHdlIG5lZWRcbiAgICAgICAgLy8gdG8gZGV0ZWN0IGlmIGEgZmlsZSBpcyBub3QgYXZhaWxhYmxlIGluc3RlYWQgb2YgaW5hZHZlcnRlbnRseVxuICAgICAgICAvLyBkb3dubG9hZGluZyB0aGUgZGVmYXVsdCBpbmRleCBwYWdlLlxuICAgICAgICAvLyBTbyBzaW1pbGFyIHRvIHRoZSBzaXR1YXRpb24gYWJvdmUsIHdlIHNlcnZlIGFuIHVuY2FjaGVkIDQwNC5cbiAgICAgICAgaGVhZGVyc1snQ2FjaGUtQ29udHJvbCddID0gJ25vLWNhY2hlJztcbiAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQsIGhlYWRlcnMpO1xuICAgICAgICByZXMuZW5kKCc0MDQgTm90IEZvdW5kJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyBhcmNoIH0gPSByZXF1ZXN0O1xuICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhcmNoLCAnc3RyaW5nJywgeyBhcmNoIH0pO1xuXG4gICAgICBpZiAoIWhhc093bi5jYWxsKFdlYkFwcC5jbGllbnRQcm9ncmFtcywgYXJjaCkpIHtcbiAgICAgICAgLy8gV2UgY291bGQgY29tZSBoZXJlIGluIGNhc2Ugd2UgcnVuIHdpdGggc29tZSBhcmNoaXRlY3R1cmVzIGV4Y2x1ZGVkXG4gICAgICAgIGhlYWRlcnNbJ0NhY2hlLUNvbnRyb2wnXSA9ICduby1jYWNoZSc7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoNDA0LCBoZWFkZXJzKTtcbiAgICAgICAgaWYgKE1ldGVvci5pc0RldmVsb3BtZW50KSB7XG4gICAgICAgICAgcmVzLmVuZChgTm8gY2xpZW50IHByb2dyYW0gZm91bmQgZm9yIHRoZSAke2FyY2h9IGFyY2hpdGVjdHVyZS5gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBTYWZldHkgbmV0LCBidXQgdGhpcyBicmFuY2ggc2hvdWxkIG5vdCBiZSBwb3NzaWJsZS5cbiAgICAgICAgICByZXMuZW5kKCc0MDQgTm90IEZvdW5kJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiBwYXVzZUNsaWVudChhcmNoKSBoYXMgYmVlbiBjYWxsZWQsIHByb2dyYW0ucGF1c2VkIHdpbGwgYmUgYVxuICAgICAgLy8gUHJvbWlzZSB0aGF0IHdpbGwgYmUgcmVzb2x2ZWQgd2hlbiB0aGUgcHJvZ3JhbSBpcyB1bnBhdXNlZC5cbiAgICAgIGF3YWl0IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXS5wYXVzZWQ7XG5cbiAgICAgIHJldHVybiBnZXRCb2lsZXJwbGF0ZUFzeW5jKHJlcXVlc3QsIGFyY2gsIHJlc3BvbnNlKVxuICAgICAgICAudGhlbigoeyBzdHJlYW0sIHN0YXR1c0NvZGUsIGhlYWRlcnM6IG5ld0hlYWRlcnMgfSkgPT4ge1xuICAgICAgICAgIGlmICghc3RhdHVzQ29kZSkge1xuICAgICAgICAgICAgc3RhdHVzQ29kZSA9IHJlcy5zdGF0dXNDb2RlID8gcmVzLnN0YXR1c0NvZGUgOiAyMDA7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5ld0hlYWRlcnMpIHtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oaGVhZGVycywgbmV3SGVhZGVycyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmVzLndyaXRlSGVhZChzdGF0dXNDb2RlLCBoZWFkZXJzKTtcblxuICAgICAgICAgIGlmICghZGlzYWJsZUJvaWxlcnBsYXRlUmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHN0cmVhbS5waXBlKHJlcywge1xuICAgICAgICAgICAgICAvLyBFbmQgdGhlIHJlc3BvbnNlIHdoZW4gdGhlIHN0cmVhbSBlbmRzLlxuICAgICAgICAgICAgICBlbmQ6IHRydWUsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgICAgTG9nLmVycm9yKCdFcnJvciBydW5uaW5nIHRlbXBsYXRlOiAnICsgZXJyb3Iuc3RhY2spO1xuICAgICAgICAgIHJlcy53cml0ZUhlYWQoNTAwLCBoZWFkZXJzKTtcbiAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gUmV0dXJuIDQwNCBieSBkZWZhdWx0LCBpZiBubyBvdGhlciBoYW5kbGVycyBzZXJ2ZSB0aGlzIFVSTC5cbiAgYXBwLnVzZShmdW5jdGlvbihyZXEsIHJlcykge1xuICAgIHJlcy53cml0ZUhlYWQoNDA0KTtcbiAgICByZXMuZW5kKCk7XG4gIH0pO1xuXG4gIHZhciBodHRwU2VydmVyID0gY3JlYXRlU2VydmVyKGFwcCk7XG4gIHZhciBvbkxpc3RlbmluZ0NhbGxiYWNrcyA9IFtdO1xuXG4gIC8vIEFmdGVyIDUgc2Vjb25kcyB3L28gZGF0YSBvbiBhIHNvY2tldCwga2lsbCBpdC4gIE9uIHRoZSBvdGhlciBoYW5kLCBpZlxuICAvLyB0aGVyZSdzIGFuIG91dHN0YW5kaW5nIHJlcXVlc3QsIGdpdmUgaXQgYSBoaWdoZXIgdGltZW91dCBpbnN0ZWFkICh0byBhdm9pZFxuICAvLyBraWxsaW5nIGxvbmctcG9sbGluZyByZXF1ZXN0cylcbiAgaHR0cFNlcnZlci5zZXRUaW1lb3V0KFNIT1JUX1NPQ0tFVF9USU1FT1VUKTtcblxuICAvLyBEbyB0aGlzIGhlcmUsIGFuZCB0aGVuIGFsc28gaW4gbGl2ZWRhdGEvc3RyZWFtX3NlcnZlci5qcywgYmVjYXVzZVxuICAvLyBzdHJlYW1fc2VydmVyLmpzIGtpbGxzIGFsbCB0aGUgY3VycmVudCByZXF1ZXN0IGhhbmRsZXJzIHdoZW4gaW5zdGFsbGluZyBpdHNcbiAgLy8gb3duLlxuICBodHRwU2VydmVyLm9uKCdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG5cbiAgLy8gSWYgdGhlIGNsaWVudCBnYXZlIHVzIGEgYmFkIHJlcXVlc3QsIHRlbGwgaXQgaW5zdGVhZCBvZiBqdXN0IGNsb3NpbmcgdGhlXG4gIC8vIHNvY2tldC4gVGhpcyBsZXRzIGxvYWQgYmFsYW5jZXJzIGluIGZyb250IG9mIHVzIGRpZmZlcmVudGlhdGUgYmV0d2VlbiBcImFcbiAgLy8gc2VydmVyIGlzIHJhbmRvbWx5IGNsb3Npbmcgc29ja2V0cyBmb3Igbm8gcmVhc29uXCIgYW5kIFwiY2xpZW50IHNlbnQgYSBiYWRcbiAgLy8gcmVxdWVzdFwiLlxuICAvL1xuICAvLyBUaGlzIHdpbGwgb25seSB3b3JrIG9uIE5vZGUgNjsgTm9kZSA0IGRlc3Ryb3lzIHRoZSBzb2NrZXQgYmVmb3JlIGNhbGxpbmdcbiAgLy8gdGhpcyBldmVudC4gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9wdWxsLzQ1NTcvIGZvciBkZXRhaWxzLlxuICBodHRwU2VydmVyLm9uKCdjbGllbnRFcnJvcicsIChlcnIsIHNvY2tldCkgPT4ge1xuICAgIC8vIFByZS1Ob2RlLTYsIGRvIG5vdGhpbmcuXG4gICAgaWYgKHNvY2tldC5kZXN0cm95ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZXJyLm1lc3NhZ2UgPT09ICdQYXJzZSBFcnJvcicpIHtcbiAgICAgIHNvY2tldC5lbmQoJ0hUVFAvMS4xIDQwMCBCYWQgUmVxdWVzdFxcclxcblxcclxcbicpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBGb3Igb3RoZXIgZXJyb3JzLCB1c2UgdGhlIGRlZmF1bHQgYmVoYXZpb3IgYXMgaWYgd2UgaGFkIG5vIGNsaWVudEVycm9yXG4gICAgICAvLyBoYW5kbGVyLlxuICAgICAgc29ja2V0LmRlc3Ryb3koZXJyKTtcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IHN1cHByZXNzRXJyb3JzID0gZnVuY3Rpb24oKSB7XG4gICAgc3VwcHJlc3NFeHByZXNzRXJyb3JzID0gdHJ1ZTtcbiAgfTtcblxuICBsZXQgd2FybmVkQWJvdXRDb25uZWN0VXNhZ2UgPSBmYWxzZTtcblxuICAvLyBzdGFydCB1cCBhcHBcbiAgT2JqZWN0LmFzc2lnbihXZWJBcHAsIHtcbiAgICBjb25uZWN0SGFuZGxlcnM6IHBhY2thZ2VBbmRBcHBIYW5kbGVycyxcbiAgICBoYW5kbGVyczogcGFja2FnZUFuZEFwcEhhbmRsZXJzLFxuICAgIHJhd0Nvbm5lY3RIYW5kbGVyczogcmF3RXhwcmVzc0hhbmRsZXJzLFxuICAgIHJhd0hhbmRsZXJzOiByYXdFeHByZXNzSGFuZGxlcnMsXG4gICAgaHR0cFNlcnZlcjogaHR0cFNlcnZlcixcbiAgICBleHByZXNzQXBwOiBhcHAsXG4gICAgLy8gRm9yIHRlc3RpbmcuXG4gICAgc3VwcHJlc3NDb25uZWN0RXJyb3JzOiAoKSA9PiB7XG4gICAgICBpZiAoISB3YXJuZWRBYm91dENvbm5lY3RVc2FnZSkge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKFwiV2ViQXBwLnN1cHByZXNzQ29ubmVjdEVycm9ycyBoYXMgYmVlbiByZW5hbWVkIHRvIE1ldGVvci5fc3VwcHJlc3NFeHByZXNzRXJyb3JzIGFuZCBpdCBzaG91bGQgYmUgdXNlZCBvbmx5IGluIHRlc3RzLlwiKTtcbiAgICAgICAgd2FybmVkQWJvdXRDb25uZWN0VXNhZ2UgPSB0cnVlO1xuICAgICAgfVxuICAgICAgc3VwcHJlc3NFcnJvcnMoKTtcbiAgICB9LFxuICAgIF9zdXBwcmVzc0V4cHJlc3NFcnJvcnM6IHN1cHByZXNzRXJyb3JzLFxuICAgIG9uTGlzdGVuaW5nOiBmdW5jdGlvbihmKSB7XG4gICAgICBpZiAob25MaXN0ZW5pbmdDYWxsYmFja3MpIG9uTGlzdGVuaW5nQ2FsbGJhY2tzLnB1c2goZik7XG4gICAgICBlbHNlIGYoKTtcbiAgICB9LFxuICAgIC8vIFRoaXMgY2FuIGJlIG92ZXJyaWRkZW4gYnkgdXNlcnMgd2hvIHdhbnQgdG8gbW9kaWZ5IGhvdyBsaXN0ZW5pbmcgd29ya3NcbiAgICAvLyAoZWcsIHRvIHJ1biBhIHByb3h5IGxpa2UgQXBvbGxvIEVuZ2luZSBQcm94eSBpbiBmcm9udCBvZiB0aGUgc2VydmVyKS5cbiAgICBzdGFydExpc3RlbmluZzogZnVuY3Rpb24oaHR0cFNlcnZlciwgbGlzdGVuT3B0aW9ucywgY2IpIHtcbiAgICAgIGh0dHBTZXJ2ZXIubGlzdGVuKGxpc3Rlbk9wdGlvbnMsIGNiKTtcbiAgICB9LFxuICB9KTtcblxuICAgIC8qKlxuICAgKiBAbmFtZSBtYWluXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHN1bW1hcnkgU3RhcnRzIHRoZSBIVFRQIHNlcnZlci5cbiAgICogIElmIGBVTklYX1NPQ0tFVF9QQVRIYCBpcyBwcmVzZW50IE1ldGVvcidzIEhUVFAgc2VydmVyIHdpbGwgdXNlIHRoYXQgc29ja2V0IGZpbGUgZm9yIGludGVyLXByb2Nlc3MgY29tbXVuaWNhdGlvbiwgaW5zdGVhZCBvZiBUQ1AuXG4gICAqIElmIHlvdSBjaG9vc2UgdG8gbm90IGluY2x1ZGUgd2ViYXBwIHBhY2thZ2UgaW4geW91ciBhcHBsaWNhdGlvbiB0aGlzIG1ldGhvZCBzdGlsbCBtdXN0IGJlIGRlZmluZWQgZm9yIHlvdXIgTWV0ZW9yIGFwcGxpY2F0aW9uIHRvIHdvcmsuXG4gICAqL1xuICAvLyBMZXQgdGhlIHJlc3Qgb2YgdGhlIHBhY2thZ2VzIChhbmQgTWV0ZW9yLnN0YXJ0dXAgaG9va3MpIGluc2VydCBFeHByZXNzXG4gIC8vIG1pZGRsZXdhcmVzIGFuZCB1cGRhdGUgX19tZXRlb3JfcnVudGltZV9jb25maWdfXywgdGhlbiBrZWVwIGdvaW5nIHRvIHNldCB1cFxuICAvLyBhY3R1YWxseSBzZXJ2aW5nIEhUTUwuXG4gIGV4cG9ydHMubWFpbiA9IGFzeW5jIGFyZ3YgPT4ge1xuICAgIGF3YWl0IFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG5cbiAgICBjb25zdCBzdGFydEh0dHBTZXJ2ZXIgPSBsaXN0ZW5PcHRpb25zID0+IHtcbiAgICAgIFdlYkFwcC5zdGFydExpc3RlbmluZyhcbiAgICAgICAgYXJndj8uaHR0cFNlcnZlciB8fCBodHRwU2VydmVyLFxuICAgICAgICBsaXN0ZW5PcHRpb25zLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5NRVRFT1JfUFJJTlRfT05fTElTVEVOKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdMSVNURU5JTkcnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IG9uTGlzdGVuaW5nQ2FsbGJhY2tzO1xuICAgICAgICAgICAgb25MaXN0ZW5pbmdDYWxsYmFja3MgPSBudWxsO1xuICAgICAgICAgICAgY2FsbGJhY2tzPy5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBsaXN0ZW5pbmc6JywgZSk7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGUgJiYgZS5zdGFjayk7XG4gICAgICAgICAgfVxuICAgICAgICApXG4gICAgICApO1xuICAgIH07XG5cbiAgICBsZXQgbG9jYWxQb3J0ID0gcHJvY2Vzcy5lbnYuUE9SVCB8fCAwO1xuICAgIGxldCB1bml4U29ja2V0UGF0aCA9IHByb2Nlc3MuZW52LlVOSVhfU09DS0VUX1BBVEg7XG5cbiAgICBpZiAodW5peFNvY2tldFBhdGgpIHtcbiAgICAgIGlmIChjbHVzdGVyLmlzV29ya2VyKSB7XG4gICAgICAgIGNvbnN0IHdvcmtlck5hbWUgPSBjbHVzdGVyLndvcmtlci5wcm9jZXNzLmVudi5uYW1lIHx8IGNsdXN0ZXIud29ya2VyLmlkO1xuICAgICAgICB1bml4U29ja2V0UGF0aCArPSAnLicgKyB3b3JrZXJOYW1lICsgJy5zb2NrJztcbiAgICAgIH1cbiAgICAgIC8vIFN0YXJ0IHRoZSBIVFRQIHNlcnZlciB1c2luZyBhIHNvY2tldCBmaWxlLlxuICAgICAgcmVtb3ZlRXhpc3RpbmdTb2NrZXRGaWxlKHVuaXhTb2NrZXRQYXRoKTtcbiAgICAgIHN0YXJ0SHR0cFNlcnZlcih7IHBhdGg6IHVuaXhTb2NrZXRQYXRoIH0pO1xuXG4gICAgICBjb25zdCB1bml4U29ja2V0UGVybWlzc2lvbnMgPSAoXG4gICAgICAgIHByb2Nlc3MuZW52LlVOSVhfU09DS0VUX1BFUk1JU1NJT05TIHx8ICcnXG4gICAgICApLnRyaW0oKTtcbiAgICAgIGlmICh1bml4U29ja2V0UGVybWlzc2lvbnMpIHtcbiAgICAgICAgaWYgKC9eWzAtN117M30kLy50ZXN0KHVuaXhTb2NrZXRQZXJtaXNzaW9ucykpIHtcbiAgICAgICAgICBjaG1vZFN5bmModW5peFNvY2tldFBhdGgsIHBhcnNlSW50KHVuaXhTb2NrZXRQZXJtaXNzaW9ucywgOCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBVTklYX1NPQ0tFVF9QRVJNSVNTSU9OUyBzcGVjaWZpZWQnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCB1bml4U29ja2V0R3JvdXAgPSAocHJvY2Vzcy5lbnYuVU5JWF9TT0NLRVRfR1JPVVAgfHwgJycpLnRyaW0oKTtcbiAgICAgIGlmICh1bml4U29ja2V0R3JvdXApIHtcbiAgICAgICAgY29uc3QgdW5peFNvY2tldEdyb3VwSW5mbyA9IGdldEdyb3VwSW5mbyh1bml4U29ja2V0R3JvdXApO1xuICAgICAgICBpZiAodW5peFNvY2tldEdyb3VwSW5mbyA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBVTklYX1NPQ0tFVF9HUk9VUCBuYW1lIHNwZWNpZmllZCcpO1xuICAgICAgICB9XG4gICAgICAgIGNob3duU3luYyh1bml4U29ja2V0UGF0aCwgdXNlckluZm8oKS51aWQsIHVuaXhTb2NrZXRHcm91cEluZm8uZ2lkKTtcbiAgICAgIH1cblxuICAgICAgcmVnaXN0ZXJTb2NrZXRGaWxlQ2xlYW51cCh1bml4U29ja2V0UGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvY2FsUG9ydCA9IGlzTmFOKE51bWJlcihsb2NhbFBvcnQpKSA/IGxvY2FsUG9ydCA6IE51bWJlcihsb2NhbFBvcnQpO1xuICAgICAgaWYgKC9cXFxcXFxcXD8uK1xcXFxwaXBlXFxcXD8uKy8udGVzdChsb2NhbFBvcnQpKSB7XG4gICAgICAgIC8vIFN0YXJ0IHRoZSBIVFRQIHNlcnZlciB1c2luZyBXaW5kb3dzIFNlcnZlciBzdHlsZSBuYW1lZCBwaXBlLlxuICAgICAgICBzdGFydEh0dHBTZXJ2ZXIoeyBwYXRoOiBsb2NhbFBvcnQgfSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBsb2NhbFBvcnQgPT09ICdudW1iZXInKSB7XG4gICAgICAgIC8vIFN0YXJ0IHRoZSBIVFRQIHNlcnZlciB1c2luZyBUQ1AuXG4gICAgICAgIHN0YXJ0SHR0cFNlcnZlcih7XG4gICAgICAgICAgcG9ydDogbG9jYWxQb3J0LFxuICAgICAgICAgIGhvc3Q6IHByb2Nlc3MuZW52LkJJTkRfSVAgfHwgJzAuMC4wLjAnLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBQT1JUIHNwZWNpZmllZCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAnREFFTU9OJztcbiAgfTtcbn1cblxuY29uc3QgaXNHZXRlbnRBdmFpbGFibGUgPSAoKSA9PiB7XG4gIHRyeSB7XG4gICAgZXhlY1N5bmMoJ3doaWNoIGdldGVudCcpO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn07XG5cbmNvbnN0IGdldEdyb3VwSW5mb1VzaW5nR2V0ZW50ID0gKGdyb3VwTmFtZSkgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHN0ZG91dCA9IGV4ZWNTeW5jKGBnZXRlbnQgZ3JvdXAgJHtncm91cE5hbWV9YCwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pO1xuICAgIGlmICghc3Rkb3V0KSByZXR1cm4gbnVsbDtcbiAgICBjb25zdCBbbmFtZSwgLCBnaWRdID0gc3Rkb3V0LnRyaW0oKS5zcGxpdCgnOicpO1xuICAgIGlmIChuYW1lID09IG51bGwgfHwgZ2lkID09IG51bGwpIHJldHVybiBudWxsO1xuICAgIHJldHVybiB7IG5hbWUsIGdpZDogTnVtYmVyKGdpZCkgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuY29uc3QgZ2V0R3JvdXBJbmZvRnJvbUZpbGUgPSAoZ3JvdXBOYW1lKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgZGF0YSA9IHJlYWRGaWxlU3luYygnL2V0Yy9ncm91cCcsICd1dGY4Jyk7XG4gICAgY29uc3QgZ3JvdXBMaW5lID0gZGF0YS50cmltKCkuc3BsaXQoJ1xcbicpLmZpbmQobGluZSA9PiBsaW5lLnN0YXJ0c1dpdGgoYCR7Z3JvdXBOYW1lfTpgKSk7XG4gICAgaWYgKCFncm91cExpbmUpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IFtuYW1lLCAsIGdpZF0gPSBncm91cExpbmUudHJpbSgpLnNwbGl0KCc6Jyk7XG4gICAgaWYgKG5hbWUgPT0gbnVsbCB8fCBnaWQgPT0gbnVsbCkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIHsgbmFtZSwgZ2lkOiBOdW1iZXIoZ2lkKSB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0R3JvdXBJbmZvID0gKGdyb3VwTmFtZSkgPT4ge1xuICBsZXQgZ3JvdXBJbmZvID0gZ2V0R3JvdXBJbmZvRnJvbUZpbGUoZ3JvdXBOYW1lKTtcbiAgaWYgKCFncm91cEluZm8gJiYgaXNHZXRlbnRBdmFpbGFibGUoKSkge1xuICAgIGdyb3VwSW5mbyA9IGdldEdyb3VwSW5mb1VzaW5nR2V0ZW50KGdyb3VwTmFtZSk7XG4gIH1cbiAgcmV0dXJuIGdyb3VwSW5mbztcbn07XG5cbnZhciBpbmxpbmVTY3JpcHRzQWxsb3dlZCA9IHRydWU7XG5cbldlYkFwcEludGVybmFscy5pbmxpbmVTY3JpcHRzQWxsb3dlZCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gaW5saW5lU2NyaXB0c0FsbG93ZWQ7XG59O1xuXG5XZWJBcHBJbnRlcm5hbHMuc2V0SW5saW5lU2NyaXB0c0FsbG93ZWQgPSBhc3luYyBmdW5jdGlvbih2YWx1ZSkge1xuICBpbmxpbmVTY3JpcHRzQWxsb3dlZCA9IHZhbHVlO1xuICBhd2FpdCBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVCb2lsZXJwbGF0ZSgpO1xufTtcblxudmFyIHNyaU1vZGU7XG5cbldlYkFwcEludGVybmFscy5lbmFibGVTdWJyZXNvdXJjZUludGVncml0eSA9IGFzeW5jIGZ1bmN0aW9uKHVzZV9jcmVkZW50aWFscyA9IGZhbHNlKSB7XG4gIHNyaU1vZGUgPSB1c2VfY3JlZGVudGlhbHMgPyAndXNlLWNyZWRlbnRpYWxzJyA6ICdhbm9ueW1vdXMnO1xuICBhd2FpdCBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVCb2lsZXJwbGF0ZSgpO1xufTtcblxuV2ViQXBwSW50ZXJuYWxzLnNldEJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rID0gYXN5bmMgZnVuY3Rpb24oaG9va0ZuKSB7XG4gIGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rID0gaG9va0ZuO1xuICBhd2FpdCBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVCb2lsZXJwbGF0ZSgpO1xufTtcblxuV2ViQXBwSW50ZXJuYWxzLnNldEJ1bmRsZWRKc0Nzc1ByZWZpeCA9IGFzeW5jIGZ1bmN0aW9uKHByZWZpeCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGF3YWl0IHNlbGYuc2V0QnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2soZnVuY3Rpb24odXJsKSB7XG4gICAgcmV0dXJuIHByZWZpeCArIHVybDtcbiAgfSk7XG59O1xuXG4vLyBQYWNrYWdlcyBjYW4gY2FsbCBgV2ViQXBwSW50ZXJuYWxzLmFkZFN0YXRpY0pzYCB0byBzcGVjaWZ5IHN0YXRpY1xuLy8gSmF2YVNjcmlwdCB0byBiZSBpbmNsdWRlZCBpbiB0aGUgYXBwLiBUaGlzIHN0YXRpYyBKUyB3aWxsIGJlIGlubGluZWQsXG4vLyB1bmxlc3MgaW5saW5lIHNjcmlwdHMgaGF2ZSBiZWVuIGRpc2FibGVkLCBpbiB3aGljaCBjYXNlIGl0IHdpbGwgYmVcbi8vIHNlcnZlZCB1bmRlciBgLzxzaGExIG9mIGNvbnRlbnRzPmAuXG52YXIgYWRkaXRpb25hbFN0YXRpY0pzID0ge307XG5XZWJBcHBJbnRlcm5hbHMuYWRkU3RhdGljSnMgPSBmdW5jdGlvbihjb250ZW50cykge1xuICBhZGRpdGlvbmFsU3RhdGljSnNbJy8nICsgc2hhMShjb250ZW50cykgKyAnLmpzJ10gPSBjb250ZW50cztcbn07XG5cbnZhciBkaXNhYmxlQm9pbGVycGxhdGVSZXNwb25zZSA9IGZhbHNlO1xuV2ViQXBwSW50ZXJuYWxzLmRpc2FibGVCb2lsZXJwbGF0ZVJlc3BvbnNlID0gZnVuY3Rpb24oKSB7XG4gIGRpc2FibGVCb2lsZXJwbGF0ZVJlc3BvbnNlID0gdHJ1ZTtcbn1cblxuLy8gRXhwb3J0ZWQgZm9yIHRlc3RzXG5XZWJBcHBJbnRlcm5hbHMuZ2V0Qm9pbGVycGxhdGUgPSBnZXRCb2lsZXJwbGF0ZTtcbldlYkFwcEludGVybmFscy5hZGRpdGlvbmFsU3RhdGljSnMgPSBhZGRpdGlvbmFsU3RhdGljSnM7XG5cbmF3YWl0IHJ1bldlYkFwcFNlcnZlcigpO1xuIiwiaW1wb3J0IHsgc3RhdFN5bmMsIHVubGlua1N5bmMsIGV4aXN0c1N5bmMgfSBmcm9tICdmcyc7XG5cbi8vIFNpbmNlIGEgbmV3IHNvY2tldCBmaWxlIHdpbGwgYmUgY3JlYXRlZCB3aGVuIHRoZSBIVFRQIHNlcnZlclxuLy8gc3RhcnRzIHVwLCBpZiBmb3VuZCByZW1vdmUgdGhlIGV4aXN0aW5nIGZpbGUuXG4vL1xuLy8gV0FSTklORzpcbi8vIFRoaXMgd2lsbCByZW1vdmUgdGhlIGNvbmZpZ3VyZWQgc29ja2V0IGZpbGUgd2l0aG91dCB3YXJuaW5nLiBJZlxuLy8gdGhlIGNvbmZpZ3VyZWQgc29ja2V0IGZpbGUgaXMgYWxyZWFkeSBpbiB1c2UgYnkgYW5vdGhlciBhcHBsaWNhdGlvbixcbi8vIGl0IHdpbGwgc3RpbGwgYmUgcmVtb3ZlZC4gTm9kZSBkb2VzIG5vdCBwcm92aWRlIGEgcmVsaWFibGUgd2F5IHRvXG4vLyBkaWZmZXJlbnRpYXRlIGJldHdlZW4gYSBzb2NrZXQgZmlsZSB0aGF0IGlzIGFscmVhZHkgaW4gdXNlIGJ5XG4vLyBhbm90aGVyIGFwcGxpY2F0aW9uIG9yIGEgc3RhbGUgc29ja2V0IGZpbGUgdGhhdCBoYXMgYmVlblxuLy8gbGVmdCBvdmVyIGFmdGVyIGEgU0lHS0lMTC4gU2luY2Ugd2UgaGF2ZSBubyByZWxpYWJsZSB3YXkgdG9cbi8vIGRpZmZlcmVudGlhdGUgYmV0d2VlbiB0aGVzZSB0d28gc2NlbmFyaW9zLCB0aGUgYmVzdCBjb3Vyc2Ugb2Zcbi8vIGFjdGlvbiBkdXJpbmcgc3RhcnR1cCBpcyB0byByZW1vdmUgYW55IGV4aXN0aW5nIHNvY2tldCBmaWxlLiBUaGlzXG4vLyBpcyBub3QgdGhlIHNhZmVzdCBjb3Vyc2Ugb2YgYWN0aW9uIGFzIHJlbW92aW5nIHRoZSBleGlzdGluZyBzb2NrZXRcbi8vIGZpbGUgY291bGQgaW1wYWN0IGFuIGFwcGxpY2F0aW9uIHVzaW5nIGl0LCBidXQgdGhpcyBhcHByb2FjaCBoZWxwc1xuLy8gZW5zdXJlIHRoZSBIVFRQIHNlcnZlciBjYW4gc3RhcnR1cCB3aXRob3V0IG1hbnVhbFxuLy8gaW50ZXJ2ZW50aW9uIChlLmcuIGFza2luZyBmb3IgdGhlIHZlcmlmaWNhdGlvbiBhbmQgY2xlYW51cCBvZiBzb2NrZXRcbi8vIGZpbGVzIGJlZm9yZSBhbGxvd2luZyB0aGUgSFRUUCBzZXJ2ZXIgdG8gYmUgc3RhcnRlZCkuXG4vL1xuLy8gVGhlIGFib3ZlIGJlaW5nIHNhaWQsIGFzIGxvbmcgYXMgdGhlIHNvY2tldCBmaWxlIHBhdGggaXNcbi8vIGNvbmZpZ3VyZWQgY2FyZWZ1bGx5IHdoZW4gdGhlIGFwcGxpY2F0aW9uIGlzIGRlcGxveWVkIChhbmQgZXh0cmFcbi8vIGNhcmUgaXMgdGFrZW4gdG8gbWFrZSBzdXJlIHRoZSBjb25maWd1cmVkIHBhdGggaXMgdW5pcXVlIGFuZCBkb2Vzbid0XG4vLyBjb25mbGljdCB3aXRoIGFub3RoZXIgc29ja2V0IGZpbGUgcGF0aCksIHRoZW4gdGhlcmUgc2hvdWxkIG5vdCBiZVxuLy8gYW55IGlzc3VlcyB3aXRoIHRoaXMgYXBwcm9hY2guXG5leHBvcnQgY29uc3QgcmVtb3ZlRXhpc3RpbmdTb2NrZXRGaWxlID0gKHNvY2tldFBhdGgpID0+IHtcbiAgdHJ5IHtcbiAgICBpZiAoc3RhdFN5bmMoc29ja2V0UGF0aCkuaXNTb2NrZXQoKSkge1xuICAgICAgLy8gU2luY2UgYSBuZXcgc29ja2V0IGZpbGUgd2lsbCBiZSBjcmVhdGVkLCByZW1vdmUgdGhlIGV4aXN0aW5nXG4gICAgICAvLyBmaWxlLlxuICAgICAgdW5saW5rU3luYyhzb2NrZXRQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgQW4gZXhpc3RpbmcgZmlsZSB3YXMgZm91bmQgYXQgXCIke3NvY2tldFBhdGh9XCIgYW5kIGl0IGlzIG5vdCBgICtcbiAgICAgICAgJ2Egc29ja2V0IGZpbGUuIFBsZWFzZSBjb25maXJtIFBPUlQgaXMgcG9pbnRpbmcgdG8gdmFsaWQgYW5kICcgK1xuICAgICAgICAndW4tdXNlZCBzb2NrZXQgZmlsZSBwYXRoLidcbiAgICAgICk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIElmIHRoZXJlIGlzIG5vIGV4aXN0aW5nIHNvY2tldCBmaWxlIHRvIGNsZWFudXAsIGdyZWF0LCB3ZSdsbFxuICAgIC8vIGNvbnRpbnVlIG5vcm1hbGx5LiBJZiB0aGUgY2F1Z2h0IGV4Y2VwdGlvbiByZXByZXNlbnRzIGFueSBvdGhlclxuICAgIC8vIGlzc3VlLCByZS10aHJvdy5cbiAgICBpZiAoZXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcpIHtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxufTtcblxuLy8gUmVtb3ZlIHRoZSBzb2NrZXQgZmlsZSB3aGVuIGRvbmUgdG8gYXZvaWQgbGVhdmluZyBiZWhpbmQgYSBzdGFsZSBvbmUuXG4vLyBOb3RlIC0gYSBzdGFsZSBzb2NrZXQgZmlsZSBpcyBzdGlsbCBsZWZ0IGJlaGluZCBpZiB0aGUgcnVubmluZyBub2RlXG4vLyBwcm9jZXNzIGlzIGtpbGxlZCB2aWEgc2lnbmFsIDkgLSBTSUdLSUxMLlxuZXhwb3J0IGNvbnN0IHJlZ2lzdGVyU29ja2V0RmlsZUNsZWFudXAgPVxuICAoc29ja2V0UGF0aCwgZXZlbnRFbWl0dGVyID0gcHJvY2VzcykgPT4ge1xuICAgIFsnZXhpdCcsICdTSUdJTlQnLCAnU0lHSFVQJywgJ1NJR1RFUk0nXS5mb3JFYWNoKHNpZ25hbCA9PiB7XG4gICAgICBldmVudEVtaXR0ZXIub24oc2lnbmFsLCBNZXRlb3IuYmluZEVudmlyb25tZW50KCgpID0+IHtcbiAgICAgICAgaWYgKGV4aXN0c1N5bmMoc29ja2V0UGF0aCkpIHtcbiAgICAgICAgICB1bmxpbmtTeW5jKHNvY2tldFBhdGgpO1xuICAgICAgICB9XG4gICAgICB9KSk7XG4gICAgfSk7XG4gIH07XG4iXX0=
