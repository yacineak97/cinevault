Package["core-runtime"].queue("accounts-base",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Hook = Package['callback-hook'].Hook;
var URL = Package.url.URL;
var URLSearchParams = Package.url.URLSearchParams;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var CollectionExtensions = Package.mongo.CollectionExtensions;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Accounts;

var require = meteorInstall({"node_modules":{"meteor":{"accounts-base":{"server_main.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-base/server_main.js                                                                               //
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
    var _Meteor$settings$pack, _Meteor$settings$pack2;
    module1.export({
      AccountsServer: () => AccountsServer
    });
    let AccountsServer;
    module1.link("./accounts_server.js", {
      AccountsServer(v) {
        AccountsServer = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * @namespace Accounts
     * @summary The namespace for all server-side accounts-related methods.
     */
    Accounts = new AccountsServer(Meteor.server, _objectSpread(_objectSpread({}, (_Meteor$settings$pack = Meteor.settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : _Meteor$settings$pack.accounts), (_Meteor$settings$pack2 = Meteor.settings.packages) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2['accounts-base']));
    // TODO[FIBERS]: I need TLA
    Accounts.init().then();

    // Users table. Don't use the normal autopublish, since we want to hide
    // some fields. Code to autopublish this is in accounts_server.js.
    // XXX Allow users to configure this collection name.

    /**
     * @summary A [Mongo.Collection](#collections) containing user documents.
     * @locus Anywhere
     * @type {Mongo.Collection}
     * @importFromPackage meteor
     */
    Meteor.users = Accounts.users;
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

},"accounts_common.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-base/accounts_common.js                                                                           //
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
      AccountsCommon: () => AccountsCommon,
      EXPIRE_TOKENS_INTERVAL_MS: () => EXPIRE_TOKENS_INTERVAL_MS
    });
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // config option keys
    const VALID_CONFIG_KEYS = ['sendVerificationEmail', 'forbidClientAccountCreation', 'restrictCreationByEmailDomain', 'loginExpiration', 'loginExpirationInDays', 'oauthSecretKey', 'passwordResetTokenExpirationInDays', 'passwordResetTokenExpiration', 'passwordEnrollTokenExpirationInDays', 'passwordEnrollTokenExpiration', 'ambiguousErrorMessages', 'bcryptRounds', 'argon2Enabled', 'argon2Type', 'argon2TimeCost', 'argon2MemoryCost', 'argon2Parallelism', 'defaultFieldSelector', 'collection', 'loginTokenExpirationHours', 'tokenSequenceLength', 'clientStorage', 'ddpUrl', 'connection'];

    /**
     * @summary Super-constructor for AccountsClient and AccountsServer.
     * @locus Anywhere
     * @class AccountsCommon
     * @instancename accountsClientOrServer
     * @param options {Object} an object with fields:
     * - connection {Object} Optional DDP connection to reuse.
     * - ddpUrl {String} Optional URL for creating a new DDP connection.
     * - collection {String|Mongo.Collection} The name of the Mongo.Collection
     *     or the Mongo.Collection object to hold the users.
     */
    class AccountsCommon {
      constructor(options) {
        // Validate config options keys
        for (const key of Object.keys(options)) {
          if (!VALID_CONFIG_KEYS.includes(key)) {
            console.error("Accounts.config: Invalid key: ".concat(key));
          }
        }

        // Currently this is read directly by packages like accounts-password
        // and accounts-ui-unstyled.
        this._options = options || {};

        // Note that setting this.connection = null causes this.users to be a
        // LocalCollection, which is not what we want.
        this.connection = undefined;
        this._initConnection(options || {});

        // There is an allow call in accounts_server.js that restricts writes to
        // this collection.
        this.users = this._initializeCollection(options || {});

        // Callback exceptions are printed with Meteor._debug and ignored.
        this._onLoginHook = new Hook({
          bindEnvironment: false,
          debugPrintExceptions: 'onLogin callback'
        });
        this._onLoginFailureHook = new Hook({
          bindEnvironment: false,
          debugPrintExceptions: 'onLoginFailure callback'
        });
        this._onLogoutHook = new Hook({
          bindEnvironment: false,
          debugPrintExceptions: 'onLogout callback'
        });

        // Expose for testing.
        this.DEFAULT_LOGIN_EXPIRATION_DAYS = DEFAULT_LOGIN_EXPIRATION_DAYS;
        this.LOGIN_UNEXPIRING_TOKEN_DAYS = LOGIN_UNEXPIRING_TOKEN_DAYS;

        // Thrown when the user cancels the login process (eg, closes an oauth
        // popup, declines retina scan, etc)
        const lceName = 'Accounts.LoginCancelledError';
        this.LoginCancelledError = Meteor.makeErrorType(lceName, function (description) {
          this.message = description;
        });
        this.LoginCancelledError.prototype.name = lceName;

        // This is used to transmit specific subclass errors over the wire. We
        // should come up with a more generic way to do this (eg, with some sort of
        // symbolic error code rather than a number).
        this.LoginCancelledError.numericError = 0x8acdc2f;
      }
      _initializeCollection(options) {
        if (options.collection && typeof options.collection !== 'string' && !(options.collection instanceof Mongo.Collection)) {
          throw new Meteor.Error('Collection parameter can be only of type string or "Mongo.Collection"');
        }
        let collectionName = 'users';
        if (typeof options.collection === 'string') {
          collectionName = options.collection;
        }
        let collection;
        if (options.collection instanceof Mongo.Collection) {
          collection = options.collection;
        } else {
          collection = new Mongo.Collection(collectionName, {
            _preventAutopublish: true,
            connection: this.connection
          });
        }
        return collection;
      }

      /**
       * @summary Get the current user id, or `null` if no user is logged in. A reactive data source.
       * @locus Anywhere
       */
      userId() {
        throw new Error('userId method not implemented');
      }

      // merge the defaultFieldSelector with an existing options object
      _addDefaultFieldSelector() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        // this will be the most common case for most people, so make it quick
        if (!this._options.defaultFieldSelector) return options;

        // if no field selector then just use defaultFieldSelector
        if (!options.fields) return _objectSpread(_objectSpread({}, options), {}, {
          fields: this._options.defaultFieldSelector
        });

        // if empty field selector then the full user object is explicitly requested, so obey
        const keys = Object.keys(options.fields);
        if (!keys.length) return options;

        // if the requested fields are +ve then ignore defaultFieldSelector
        // assume they are all either +ve or -ve because Mongo doesn't like mixed
        if (!!options.fields[keys[0]]) return options;

        // The requested fields are -ve.
        // If the defaultFieldSelector is +ve then use requested fields, otherwise merge them
        const keys2 = Object.keys(this._options.defaultFieldSelector);
        return this._options.defaultFieldSelector[keys2[0]] ? options : _objectSpread(_objectSpread({}, options), {}, {
          fields: _objectSpread(_objectSpread({}, options.fields), this._options.defaultFieldSelector)
        });
      }

      /**
       * @summary Get the current user record, or `null` if no user is logged in. A reactive data source. In the server this fuction returns a promise.
       * @locus Anywhere
       * @param {Object} [options]
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       */
      user(options) {
        if (Meteor.isServer) {
          console.warn(["`Meteor.user()` is deprecated on the server side.", "    To fetch the current user record on the server,", "    use `Meteor.userAsync()` instead."].join("\n"));
        }
        const self = this;
        const userId = self.userId();
        const findOne = function () {
          return Meteor.isClient ? self.users.findOne(...arguments) : self.users.findOneAsync(...arguments);
        };
        return userId ? findOne(userId, this._addDefaultFieldSelector(options)) : null;
      }

      /**
       * @summary Get the current user record, or `null` if no user is logged in.
       * @locus Anywhere
       * @param {Object} [options]
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       */
      async userAsync(options) {
        const userId = this.userId();
        return userId ? this.users.findOneAsync(userId, this._addDefaultFieldSelector(options)) : null;
      }

      /**
       * @summary Set global accounts options. You can also set these in `Meteor.settings.packages.accounts` without the need to call this function.
       * @locus Anywhere
       * @param {Object} options
       * @param {Boolean} options.sendVerificationEmail New users with an email address will receive an address verification email.
       * @param {Boolean} options.forbidClientAccountCreation Calls to [`createUser`](#accounts_createuser) from the client will be rejected. In addition, if you are using [accounts-ui](#accountsui), the "Create account" link will not be available. **Important**: This option must be set on both the client and server to take full effect. If only set on the server, account creation will be blocked but the UI will still show the "Create account" link.
       * @param {String | Function} options.restrictCreationByEmailDomain If set to a string, only allows new users if the domain part of their email address matches the string. If set to a function, only allows new users if the function returns true.  The function is passed the full email address of the proposed new user.  Works with password-based sign-in and external services that expose email addresses (Google, Facebook, GitHub). All existing users still can log in after enabling this option. Example: `Accounts.config({ restrictCreationByEmailDomain: 'school.edu' })`.
       * @param {Number} options.loginExpiration The number of milliseconds from when a user logs in until their token expires and they are logged out, for a more granular control. If `loginExpirationInDays` is set, it takes precedent.
       * @param {Number} options.loginExpirationInDays The number of days from when a user logs in until their token expires and they are logged out. Defaults to 90. Set to `null` to disable login expiration.
       * @param {String} options.oauthSecretKey When using the `oauth-encryption` package, the 16 byte key using to encrypt sensitive account credentials in the database, encoded in base64.  This option may only be specified on the server.  See packages/oauth-encryption/README.md for details.
       * @param {Number} options.passwordResetTokenExpirationInDays The number of days from when a link to reset password is sent until token expires and user can't reset password with the link anymore. Defaults to 3.
       * @param {Number} options.passwordResetTokenExpiration The number of milliseconds from when a link to reset password is sent until token expires and user can't reset password with the link anymore. If `passwordResetTokenExpirationInDays` is set, it takes precedent.
       * @param {Number} options.passwordEnrollTokenExpirationInDays The number of days from when a link to set initial password is sent until token expires and user can't set password with the link anymore. Defaults to 30.
       * @param {Number} options.passwordEnrollTokenExpiration The number of milliseconds from when a link to set initial password is sent until token expires and user can't set password with the link anymore. If `passwordEnrollTokenExpirationInDays` is set, it takes precedent.
       * @param {Boolean} options.ambiguousErrorMessages Return ambiguous error messages from login failures to prevent user enumeration. Defaults to `true`.
       * @param {Number} options.bcryptRounds Allows override of number of bcrypt rounds (aka work factor) used to store passwords. The default is 10.
       * @param {Boolean} options.argon2Enabled Enable argon2 algorithm usage in replacement for bcrypt. The default is `false`.
       * @param {'argon2id' | 'argon2i' | 'argon2d'} options.argon2Type Allows override of the argon2 algorithm type. The default is `argon2id`.
       * @param {Number} options.argon2TimeCost Allows override of number of argon2 iterations (aka time cost) used to store passwords. The default is 2.
       * @param {Number} options.argon2MemoryCost Allows override of the amount of memory (in KiB) used by the argon2 algorithm. The default is 19456 (19MB).
       * @param {Number} options.argon2Parallelism Allows override of the number of threads used by the argon2 algorithm. The default is 1.
       * @param {MongoFieldSpecifier} options.defaultFieldSelector To exclude by default large custom fields from `Meteor.user()` and `Meteor.findUserBy...()` functions when called without a field selector, and all `onLogin`, `onLoginFailure` and `onLogout` callbacks.  Example: `Accounts.config({ defaultFieldSelector: { myBigArray: 0 }})`. Beware when using this. If, for instance, you do not include `email` when excluding the fields, you can have problems with functions like `forgotPassword` that will break because they won't have the required data available. It's recommend that you always keep the fields `_id`, `username`, and `email`.
       * @param {String|Mongo.Collection} options.collection A collection name or a Mongo.Collection object to hold the users.
       * @param {Number} options.loginTokenExpirationHours When using the package `accounts-2fa`, use this to set the amount of time a token sent is valid. As it's just a number, you can use, for example, 0.5 to make the token valid for just half hour. The default is 1 hour.
       * @param {Number} options.tokenSequenceLength When using the package `accounts-2fa`, use this to the size of the token sequence generated. The default is 6.
       * @param {'session' | 'local'} options.clientStorage By default login credentials are stored in local storage, setting this to true will switch to using session storage.
       * 
       * @example
       * // For UI-related options like forbidClientAccountCreation, call Accounts.config on both client and server
       * // Create a shared configuration file (e.g., lib/accounts-config.js):
       * import { Accounts } from 'meteor/accounts-base';
       * 
       * Accounts.config({
       *   forbidClientAccountCreation: true,
       *   sendVerificationEmail: true,
       * });
       * 
       * // Then import this file in both client/main.js and server/main.js:
       * // import '../lib/accounts-config.js';
       */
      config(options) {
        // We don't want users to accidentally only call Accounts.config on the
        // client, where some of the options will have partial effects (eg removing
        // the "create account" button from accounts-ui if forbidClientAccountCreation
        // is set, or redirecting Google login to a specific-domain page) without
        // having their full effects.
        if (Meteor.isServer) {
          __meteor_runtime_config__.accountsConfigCalled = true;
        } else if (!__meteor_runtime_config__.accountsConfigCalled) {
          // XXX would be nice to "crash" the client and replace the UI with an error
          // message, but there's no trivial way to do this.
          Meteor._debug('Accounts.config was called on the client but not on the ' + 'server; some configuration options may not take effect.');
        }

        // We need to validate the oauthSecretKey option at the time
        // Accounts.config is called. We also deliberately don't store the
        // oauthSecretKey in Accounts._options.
        if (Object.prototype.hasOwnProperty.call(options, 'oauthSecretKey')) {
          if (Meteor.isClient) {
            throw new Error('The oauthSecretKey option may only be specified on the server');
          }
          if (!Package['oauth-encryption']) {
            throw new Error('The oauth-encryption package must be loaded to set oauthSecretKey');
          }
          Package['oauth-encryption'].OAuthEncryption.loadKey(options.oauthSecretKey);
          options = _objectSpread({}, options);
          delete options.oauthSecretKey;
        }

        // Validate config options keys
        for (const key of Object.keys(options)) {
          if (!VALID_CONFIG_KEYS.includes(key)) {
            console.error("Accounts.config: Invalid key: ".concat(key));
          }
        }

        // set values in Accounts._options
        for (const key of VALID_CONFIG_KEYS) {
          if (key in options) {
            if (key in this._options) {
              if (key !== 'collection' && Meteor.isTest && key !== 'clientStorage') {
                throw new Meteor.Error("Can't set `".concat(key, "` more than once"));
              }
            }
            this._options[key] = options[key];
          }
        }
        if (options.collection && options.collection !== this.users._name && options.collection !== this.users) {
          this.users = this._initializeCollection(options);
        }
      }

      /**
       * @summary Register a callback to be called after a login attempt succeeds.
       * @locus Anywhere
       * @param {Function} func The callback to be called when login is successful.
       *                        The callback receives a single object that
       *                        holds login details. This object contains the login
       *                        result type (password, resume, etc.) on both the
       *                        client and server. `onLogin` callbacks registered
       *                        on the server also receive extra data, such
       *                        as user details, connection information, etc.
       */
      onLogin(func) {
        let ret = this._onLoginHook.register(func);
        // call the just registered callback if already logged in
        this._startupCallback(ret.callback);
        return ret;
      }

      /**
       * @summary Register a callback to be called after a login attempt fails.
       * @locus Anywhere
       * @param {Function} func The callback to be called after the login has failed.
       */
      onLoginFailure(func) {
        return this._onLoginFailureHook.register(func);
      }

      /**
       * @summary Register a callback to be called after a logout attempt succeeds.
       * @locus Anywhere
       * @param {Function} func The callback to be called when logout is successful.
       */
      onLogout(func) {
        return this._onLogoutHook.register(func);
      }
      _initConnection(options) {
        if (!Meteor.isClient) {
          return;
        }

        // The connection used by the Accounts system. This is the connection
        // that will get logged in by Meteor.login(), and this is the
        // connection whose login state will be reflected by Meteor.userId().
        //
        // It would be much preferable for this to be in accounts_client.js,
        // but it has to be here because it's needed to create the
        // Meteor.users collection.
        if (options.connection) {
          this.connection = options.connection;
        } else if (options.ddpUrl) {
          this.connection = DDP.connect(options.ddpUrl);
        } else if (typeof __meteor_runtime_config__ !== 'undefined' && __meteor_runtime_config__.ACCOUNTS_CONNECTION_URL) {
          // Temporary, internal hook to allow the server to point the client
          // to a different authentication server. This is for a very
          // particular use case that comes up when implementing a oauth
          // server. Unsupported and may go away at any point in time.
          //
          // We will eventually provide a general way to use account-base
          // against any DDP connection, not just one special one.
          this.connection = DDP.connect(__meteor_runtime_config__.ACCOUNTS_CONNECTION_URL);
        } else {
          this.connection = Meteor.connection;
        }
      }
      _getTokenLifetimeMs() {
        // When loginExpirationInDays is set to null, we'll use a really high
        // number of days (LOGIN_UNEXPIRABLE_TOKEN_DAYS) to simulate an
        // unexpiring token.
        const loginExpirationInDays = this._options.loginExpirationInDays === null ? LOGIN_UNEXPIRING_TOKEN_DAYS : this._options.loginExpirationInDays;
        return this._options.loginExpiration || (loginExpirationInDays || DEFAULT_LOGIN_EXPIRATION_DAYS) * 86400000;
      }
      _getPasswordResetTokenLifetimeMs() {
        return this._options.passwordResetTokenExpiration || (this._options.passwordResetTokenExpirationInDays || DEFAULT_PASSWORD_RESET_TOKEN_EXPIRATION_DAYS) * 86400000;
      }
      _getPasswordEnrollTokenLifetimeMs() {
        return this._options.passwordEnrollTokenExpiration || (this._options.passwordEnrollTokenExpirationInDays || DEFAULT_PASSWORD_ENROLL_TOKEN_EXPIRATION_DAYS) * 86400000;
      }
      _tokenExpiration(when) {
        // We pass when through the Date constructor for backwards compatibility;
        // `when` used to be a number.
        return new Date(new Date(when).getTime() + this._getTokenLifetimeMs());
      }
      _tokenExpiresSoon(when) {
        let minLifetimeMs = 0.1 * this._getTokenLifetimeMs();
        const minLifetimeCapMs = MIN_TOKEN_LIFETIME_CAP_SECS * 1000;
        if (minLifetimeMs > minLifetimeCapMs) {
          minLifetimeMs = minLifetimeCapMs;
        }
        return new Date() > new Date(when) - minLifetimeMs;
      }

      // No-op on the server, overridden on the client.
      _startupCallback(callback) {}
    }
    // Note that Accounts is defined separately in accounts_client.js and
    // accounts_server.js.

    /**
     * @summary Get the current user id, or `null` if no user is logged in. A reactive data source.
     * @locus Anywhere
     * @importFromPackage meteor
     */
    Meteor.userId = () => Accounts.userId();

    /**
     * @summary Get the current user record, or `null` if no user is logged in. A reactive data source.
     * @locus Anywhere
     * @importFromPackage meteor
     * @param {Object} [options]
     * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
     */
    Meteor.user = options => Accounts.user(options);

    /**
     * @summary Get the current user record, or `null` if no user is logged in. A reactive data source.
     * @locus Anywhere
     * @importFromPackage meteor
     * @param {Object} [options]
     * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
     */
    Meteor.userAsync = options => Accounts.userAsync(options);

    // how long (in days) until a login token expires
    const DEFAULT_LOGIN_EXPIRATION_DAYS = 90;
    // how long (in days) until reset password token expires
    const DEFAULT_PASSWORD_RESET_TOKEN_EXPIRATION_DAYS = 3;
    // how long (in days) until enrol password token expires
    const DEFAULT_PASSWORD_ENROLL_TOKEN_EXPIRATION_DAYS = 30;
    // Clients don't try to auto-login with a token that is going to expire within
    // .1 * DEFAULT_LOGIN_EXPIRATION_DAYS, capped at MIN_TOKEN_LIFETIME_CAP_SECS.
    // Tries to avoid abrupt disconnects from expiring tokens.
    const MIN_TOKEN_LIFETIME_CAP_SECS = 3600; // one hour
    // how often (in milliseconds) we check for expired tokens
    const EXPIRE_TOKENS_INTERVAL_MS = 600 * 1000;
    // 10 minutes
    // A large number of expiration days (approximately 100 years worth) that is
    // used when creating unexpiring tokens.
    const LOGIN_UNEXPIRING_TOKEN_DAYS = 365 * 100;
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

},"accounts_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/accounts-base/accounts_server.js                                                                           //
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
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 1);
    let _asyncIterator;
    module.link("@babel/runtime/helpers/asyncIterator", {
      default(v) {
        _asyncIterator = v;
      }
    }, 2);
    var _Package$oauthEncryp;
    const _excluded = ["token"];
    module.export({
      AccountsServer: () => AccountsServer
    });
    let crypto;
    module.link("crypto", {
      default(v) {
        crypto = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 1);
    let check, Match;
    module.link("meteor/check", {
      check(v) {
        check = v;
      },
      Match(v) {
        Match = v;
      }
    }, 2);
    let AccountsCommon, EXPIRE_TOKENS_INTERVAL_MS;
    module.link("./accounts_common.js", {
      AccountsCommon(v) {
        AccountsCommon = v;
      },
      EXPIRE_TOKENS_INTERVAL_MS(v) {
        EXPIRE_TOKENS_INTERVAL_MS = v;
      }
    }, 3);
    let URL;
    module.link("meteor/url", {
      URL(v) {
        URL = v;
      }
    }, 4);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const hasOwn = Object.prototype.hasOwnProperty;

    /**
     * @summary Constructor for the `Accounts` namespace on the server.
     * @locus Server
     * @class AccountsServer
     * @extends AccountsCommon
     * @instancename accountsServer
     * @param {Object} server A server object such as `Meteor.server`.
     */
    class AccountsServer extends AccountsCommon {
      // Note that this constructor is less likely to be instantiated multiple
      // times than the `AccountsClient` constructor, because a single server
      // can provide only one set of methods.
      constructor(server, _options) {
        var _this;
        super(_options || {});
        _this = this;
        ///
        /// CREATE USER HOOKS
        ///
        /**
         * @summary Customize login token creation.
         * @locus Server
         * @param {Function} func Called whenever a new token is created.
         * Return the sequence and the user object. Return true to keep sending the default email, or false to override the behavior.
         */
        this.onCreateLoginToken = function (func) {
          if (this._onCreateLoginTokenHook) {
            throw new Error('Can only call onCreateLoginToken once');
          }
          this._onCreateLoginTokenHook = func;
        };
        // Generates a MongoDB selector that can be used to perform a fast case
        // insensitive lookup for the given fieldName and string. Since MongoDB does
        // not support case insensitive indexes, and case insensitive regex queries
        // are slow, we construct a set of prefix selectors for all permutations of
        // the first 4 characters ourselves. We first attempt to matching against
        // these, and because 'prefix expression' regex queries do use indexes (see
        // http://docs.mongodb.org/v2.6/reference/operator/query/regex/#index-use),
        // this has been found to greatly improve performance (from 1200ms to 5ms in a
        // test with 1.000.000 users).
        this._selectorForFastCaseInsensitiveLookup = (fieldName, string) => {
          // Performance seems to improve up to 4 prefix characters
          const prefix = string.substring(0, Math.min(string.length, 4));
          const orClause = generateCasePermutationsForString(prefix).map(prefixPermutation => {
            const selector = {};
            selector[fieldName] = new RegExp("^".concat(Meteor._escapeRegExp(prefixPermutation)));
            return selector;
          });
          const caseInsensitiveClause = {};
          caseInsensitiveClause[fieldName] = new RegExp("^".concat(Meteor._escapeRegExp(string), "$"), 'i');
          return {
            $and: [{
              $or: orClause
            }, caseInsensitiveClause]
          };
        };
        this._findUserByQuery = async (query, options) => {
          let user = null;
          if (query.id) {
            // default field selector is added within getUserById()
            user = await Meteor.users.findOneAsync(query.id, this._addDefaultFieldSelector(options));
          } else {
            options = this._addDefaultFieldSelector(options);
            let fieldName;
            let fieldValue;
            if (query.username) {
              fieldName = 'username';
              fieldValue = query.username;
            } else if (query.email) {
              fieldName = 'emails.address';
              fieldValue = query.email;
            } else {
              throw new Error("shouldn't happen (validation missed something)");
            }
            let selector = {};
            selector[fieldName] = fieldValue;
            user = await Meteor.users.findOneAsync(selector, options);
            // If user is not found, try a case insensitive lookup
            if (!user) {
              selector = this._selectorForFastCaseInsensitiveLookup(fieldName, fieldValue);
              const candidateUsers = await Meteor.users.find(selector, _objectSpread(_objectSpread({}, options), {}, {
                limit: 2
              })).fetchAsync();
              // No match if multiple candidates are found
              if (candidateUsers.length === 1) {
                user = candidateUsers[0];
              }
            }
          }
          return user;
        };
        /**
         * @summary Find a user by one of their email addresses.
         * @locus Server
         * @param {String} email The email address to look for
         * @param {Object} [options]
         * @param {Object} options.fields Limit the fields to return from the user document
         * @returns {Promise<Object>} A user if found, else null
         * @memberof Accounts
         * @importFromPackage accounts-base
         */
        this.findUserByEmail = async (email, options) => await this._findUserByQuery({
          email
        }, options);
        /**
         * @summary Find a user by their username.
         * @locus Server
         * @param {String} username The username to look for
         * @param {Object} [options]
         * @param {Object} options.fields Limit the fields to return from the user document
         * @returns {Promise<Object>} A user if found, else null
         * @memberof Accounts
         * @importFromPackage accounts-base
         */
        this.findUserByUsername = async (username, options) => await this._findUserByQuery({
          username
        }, options);
        this._handleError = function (msg) {
          var _this$_options$ambigu;
          let throwError = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
          let errorCode = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 403;
          const isErrorAmbiguous = (_this$_options$ambigu = _this._options.ambiguousErrorMessages) !== null && _this$_options$ambigu !== void 0 ? _this$_options$ambigu : true;
          const error = new Meteor.Error(errorCode, isErrorAmbiguous ? 'Something went wrong. Please check your credentials.' : msg);
          if (throwError) {
            throw error;
          }
          return error;
        };
        this._userQueryValidator = Match.Where(user => {
          check(user, {
            id: Match.Optional(Match.NonEmptyString),
            username: Match.Optional(Match.NonEmptyString),
            email: Match.Optional(Match.NonEmptyString)
          });
          if (Object.keys(user).length !== 1) throw new Match.Error("User property must have exactly one field");
          return true;
        });
        this._server = server || Meteor.server;
        // Set up the server's methods, as if by calling Meteor.methods.
        this._initServerMethods();
        this._initAccountDataHooks();

        // If autopublish is on, publish these user fields. Login service
        // packages (eg accounts-google) add to these by calling
        // addAutopublishFields.  Notably, this isn't implemented with multiple
        // publishes since DDP only merges only across top-level fields, not
        // subfields (such as 'services.facebook.accessToken')
        this._autopublishFields = {
          loggedInUser: ['profile', 'username', 'emails'],
          otherUsers: ['profile', 'username']
        };

        // use object to keep the reference when used in functions
        // where _defaultPublishFields is destructured into lexical scope
        // for publish callbacks that need `this`
        this._defaultPublishFields = {
          projection: {
            profile: 1,
            username: 1,
            emails: 1
          }
        };
        this._initServerPublications();

        // connectionId -> {connection, loginToken}
        this._accountData = {};

        // connection id -> observe handle for the login token that this connection is
        // currently associated with, or a number. The number indicates that we are in
        // the process of setting up the observe (using a number instead of a single
        // sentinel allows multiple attempts to set up the observe to identify which
        // one was theirs).
        this._userObservesForConnections = {};
        this._nextUserObserveNumber = 1; // for the number described above.

        // list of all registered handlers.
        this._loginHandlers = [];
        setupDefaultLoginHandlers(this);
        setExpireTokensInterval(this);
        this._validateLoginHook = new Hook({
          bindEnvironment: false
        });
        this._validateNewUserHooks = [defaultValidateNewUserHook.bind(this)];
        this._deleteSavedTokensForAllUsersOnStartup();
        this._skipCaseInsensitiveChecksForTest = {};

        // Helper function to resolve promises if needed
        this._resolvePromise = async value => {
          return Meteor._isPromise(value) ? await value : value;
        };

        /**
         * @summary Object containing functions that generate URLs for account-related emails.
         * Override these to customize URLs in emails sent by
         * [`Accounts.sendResetPasswordEmail`](#Accounts-sendResetPasswordEmail),
         * [`Accounts.sendEnrollmentEmail`](#Accounts-sendEnrollmentEmail), and
         * [`Accounts.sendVerificationEmail`](#Accounts-sendVerificationEmail).
         *
         * By default, URLs use hash fragments (e.g., `#/reset-password/:token`) for security:
         * hash fragments are not sent to the server in HTTP requests, preventing tokens from
         * appearing in server logs or referrer headers.
         * @locus Server
         * @memberof Accounts
         * @name urls
         * @type {Object}
         * @property {Function} resetPassword - `(token, extraParams) => string` - Generates password reset URL.
         * @property {Function} verifyEmail - `(token, extraParams) => string` - Generates email verification URL.
         * @property {Function} enrollAccount - `(token, extraParams) => string` - Generates account enrollment URL.
         * @property {Function} loginToken - `(selector, token, extraParams) => string` - Generates login token URL.
         */
        this.urls = {
          resetPassword: (token, extraParams) => this.buildEmailUrl("#/reset-password/".concat(token), extraParams),
          verifyEmail: (token, extraParams) => this.buildEmailUrl("#/verify-email/".concat(token), extraParams),
          loginToken: (selector, token, extraParams) => this.buildEmailUrl("/?loginToken=".concat(token, "&selector=").concat(selector), extraParams),
          enrollAccount: (token, extraParams) => this.buildEmailUrl("#/enroll-account/".concat(token), extraParams)
        };
        this.addDefaultRateLimit();

        /**
         * @summary Builds a URL for account-related emails by combining the app's
         * root URL with a path and optional extra parameters.
         * @locus Server
         * @memberof Accounts
         * @name buildEmailUrl
         * @param {String} path - The path to append to the root URL (e.g., `#/reset-password/TOKEN`).
         * @param {Object} [extraParams={}] - Additional query parameters to include in the URL.
         * @returns {String} The complete URL.
         */
        this.buildEmailUrl = function (path) {
          let extraParams = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
          const url = new URL(Meteor.absoluteUrl(path));
          const params = Object.entries(extraParams);
          if (params.length > 0) {
            // Add additional parameters to the url
            for (const [key, value] of params) {
              url.searchParams.append(key, value);
            }
          }
          return url.toString();
        };
      }

      ///
      /// CURRENT USER
      ///

      // @override of "abstract" non-implementation in accounts_common.js
      userId() {
        // This function only works if called inside a method or a pubication.
        // Using any of the information from Meteor.user() in a method or
        // publish function will always use the value from when the function first
        // runs. This is likely not what the user expects. The way to make this work
        // in a method or publish function is to do Meteor.find(this.userId).observe
        // and recompute when the user record changes.
        const currentInvocation = DDP._CurrentMethodInvocation.get() || DDP._CurrentPublicationInvocation.get();
        if (!currentInvocation) throw new Error("Meteor.userId can only be invoked in method calls or publications.");
        return currentInvocation.userId;
      }
      async init() {
        await setupUsersCollection(this.users);
      }

      ///
      /// LOGIN HOOKS
      ///

      /**
       * @summary Validate login attempts.
       * @locus Server
       * @param {Function} func Called whenever a login is attempted (either successful or unsuccessful).  A login can be aborted by returning a falsy value or throwing an exception.
       */
      validateLoginAttempt(func) {
        // Exceptions inside the hook callback are passed up to us.
        return this._validateLoginHook.register(func);
      }

      /**
       * @summary Set restrictions on new user creation.
       * @locus Server
       * @param {Function} func Called whenever a new user is created. Takes the new user object, and returns true to allow the creation or false to abort.
       */
      validateNewUser(func) {
        this._validateNewUserHooks.push(func);
      }

      /**
       * @summary Validate login from external service
       * @locus Server
       * @param {Function} func Called whenever login/user creation from external service is attempted. Login or user creation based on this login can be aborted by passing a falsy value or throwing an exception.
       */
      beforeExternalLogin(func) {
        if (this._beforeExternalLoginHook) {
          throw new Error("Can only call beforeExternalLogin once");
        }
        this._beforeExternalLoginHook = func;
      }
      /**
       * @summary Customize new user creation.
       * @locus Server
       * @param {Function} func Called whenever a new user is created. Return the new user object, or throw an `Error` to abort the creation.
       */
      onCreateUser(func) {
        if (this._onCreateUserHook) {
          throw new Error("Can only call onCreateUser once");
        }
        this._onCreateUserHook = Meteor.wrapFn(func);
      }

      /**
       * @summary Customize oauth user profile updates
       * @locus Server
       * @param {Function} func Called whenever a user is logged in via oauth. Return the profile object to be merged, or throw an `Error` to abort the creation.
       */
      onExternalLogin(func) {
        if (this._onExternalLoginHook) {
          throw new Error("Can only call onExternalLogin once");
        }
        this._onExternalLoginHook = func;
      }

      /**
       * @summary Customize user selection on external logins
       * @locus Server
       * @param {Function} func Called whenever a user is logged in via oauth and a
       * user is not found with the service id. Return the user or undefined.
       */
      setAdditionalFindUserOnExternalLogin(func) {
        if (this._additionalFindUserOnExternalLogin) {
          throw new Error("Can only call setAdditionalFindUserOnExternalLogin once");
        }
        this._additionalFindUserOnExternalLogin = func;
      }
      async _validateLogin(connection, attempt) {
        await this._validateLoginHook.forEachAsync(async callback => {
          let ret;
          try {
            ret = await callback(cloneAttemptWithConnection(connection, attempt));
          } catch (e) {
            attempt.allowed = false;
            // XXX this means the last thrown error overrides previous error
            // messages. Maybe this is surprising to users and we should make
            // overriding errors more explicit. (see
            // https://github.com/meteor/meteor/issues/1960)
            attempt.error = e;
            return true;
          }
          if (!ret) {
            attempt.allowed = false;
            // don't override a specific error provided by a previous
            // validator or the initial attempt (eg "incorrect password").
            if (!attempt.error) attempt.error = new Meteor.Error(403, "Login forbidden");
          }
          return true;
        });
      }
      async _successfulLogin(connection, attempt) {
        await this._onLoginHook.forEachAsync(async callback => {
          await callback(cloneAttemptWithConnection(connection, attempt));
          return true;
        });
      }
      async _failedLogin(connection, attempt) {
        await this._onLoginFailureHook.forEachAsync(async callback => {
          await callback(cloneAttemptWithConnection(connection, attempt));
          return true;
        });
      }
      async _successfulLogout(connection, userId) {
        // don't fetch the user object unless there are some callbacks registered
        let user;
        await this._onLogoutHook.forEachAsync(async callback => {
          if (!user && userId) user = await this.users.findOneAsync(userId, {
            fields: this._options.defaultFieldSelector
          });
          callback({
            user,
            connection
          });
          return true;
        });
      }
      ///
      /// LOGIN METHODS
      ///

      // Login methods return to the client an object containing these
      // fields when the user was logged in successfully:
      //
      //   id: userId
      //   token: *
      //   tokenExpires: *
      //
      // tokenExpires is optional and intends to provide a hint to the
      // client as to when the token will expire. If not provided, the
      // client will call Accounts._tokenExpiration, passing it the date
      // that it received the token.
      //
      // The login method will throw an error back to the client if the user
      // failed to log in.
      //
      //
      // Login handlers and service specific login methods such as
      // `createUser` internally return a `result` object containing these
      // fields:
      //
      //   type:
      //     optional string; the service name, overrides the handler
      //     default if present.
      //
      //   error:
      //     exception; if the user is not allowed to login, the reason why.
      //
      //   userId:
      //     string; the user id of the user attempting to login (if
      //     known), required for an allowed login.
      //
      //   options:
      //     optional object merged into the result returned by the login
      //     method; used by HAMK from SRP.
      //
      //   stampedLoginToken:
      //     optional object with `token` and `when` indicating the login
      //     token is already present in the database, returned by the
      //     "resume" login handler.
      //
      // For convenience, login methods can also throw an exception, which
      // is converted into an {error} result.  However, if the id of the
      // user attempting the login is known, a {userId, error} result should
      // be returned instead since the user id is not captured when an
      // exception is thrown.
      //
      // This internal `result` object is automatically converted into the
      // public {id, token, tokenExpires} object returned to the client.

      // Try a login method, converting thrown exceptions into an {error}
      // result.  The `type` argument is a default, inserted into the result
      // object if not explicitly returned.
      //
      // Log in a user on a connection.
      //
      // We use the method invocation to set the user id on the connection,
      // not the connection object directly. setUserId is tied to methods to
      // enforce clear ordering of method application (using wait methods on
      // the client, and a no setUserId after unblock restriction on the
      // server)
      //
      // The `stampedLoginToken` parameter is optional.  When present, it
      // indicates that the login token has already been inserted into the
      // database and doesn't need to be inserted again.  (It's used by the
      // "resume" login handler).
      async _loginUser(methodInvocation, userId, stampedLoginToken) {
        if (!stampedLoginToken) {
          stampedLoginToken = this._generateStampedLoginToken();
          await this._insertLoginToken(userId, stampedLoginToken);
        }

        // This order (and the avoidance of yields) is important to make
        // sure that when publish functions are rerun, they see a
        // consistent view of the world: the userId is set and matches
        // the login token on the connection (not that there is
        // currently a public API for reading the login token on a
        // connection).
        Meteor._noYieldsAllowed(() => this._setLoginToken(userId, methodInvocation.connection, this._hashLoginToken(stampedLoginToken.token)));
        await methodInvocation.setUserId(userId);
        return {
          id: userId,
          token: stampedLoginToken.token,
          tokenExpires: this._tokenExpiration(stampedLoginToken.when)
        };
      }
      // After a login method has completed, call the login hooks.  Note
      // that `attemptLogin` is called for *all* login attempts, even ones
      // which aren't successful (such as an invalid password, etc).
      //
      // If the login is allowed and isn't aborted by a validate login hook
      // callback, log in the user.
      //
      async _attemptLogin(methodInvocation, methodName, methodArgs, result) {
        if (!result) throw new Error("result is required");

        // XXX A programming error in a login handler can lead to this occurring, and
        // then we don't call onLogin or onLoginFailure callbacks. Should
        // tryLoginMethod catch this case and turn it into an error?
        if (!result.userId && !result.error) throw new Error("A login method must specify a userId or an error");
        let user;
        if (result.userId) user = await this.users.findOneAsync(result.userId, {
          fields: this._options.defaultFieldSelector
        });
        const attempt = {
          type: result.type || "unknown",
          allowed: !!(result.userId && !result.error),
          methodName: methodName,
          methodArguments: Array.from(methodArgs)
        };
        if (result.error) {
          attempt.error = result.error;
        }
        if (user) {
          attempt.user = user;
        }

        // _validateLogin may mutate `attempt` by adding an error and changing allowed
        // to false, but that's the only change it can make (and the user's callbacks
        // only get a clone of `attempt`).
        await this._validateLogin(methodInvocation.connection, attempt);
        if (attempt.allowed) {
          const o = await this._loginUser(methodInvocation, result.userId, result.stampedLoginToken);
          const ret = _objectSpread(_objectSpread({}, o), result.options);
          ret.type = attempt.type;
          await this._successfulLogin(methodInvocation.connection, attempt);
          return ret;
        } else {
          await this._failedLogin(methodInvocation.connection, attempt);
          throw attempt.error;
        }
      }
      // All service specific login methods should go through this function.
      // Ensure that thrown exceptions are caught and that login hook
      // callbacks are still called.
      //
      async _loginMethod(methodInvocation, methodName, methodArgs, type, fn) {
        return this._attemptLogin(methodInvocation, methodName, methodArgs, await tryLoginMethod(type, fn));
      }
      // Report a login attempt failed outside the context of a normal login
      // method. This is for use in the case where there is a multi-step login
      // procedure (eg SRP based password login). If a method early in the
      // chain fails, it should call this function to report a failure. There
      // is no corresponding method for a successful login; methods that can
      // succeed at logging a user in should always be actual login methods
      // (using either Accounts._loginMethod or Accounts.registerLoginHandler).
      async _reportLoginFailure(methodInvocation, methodName, methodArgs, result) {
        const attempt = {
          type: result.type || "unknown",
          allowed: false,
          error: result.error,
          methodName: methodName,
          methodArguments: Array.from(methodArgs)
        };
        if (result.userId) {
          attempt.user = this.users.findOneAsync(result.userId, {
            fields: this._options.defaultFieldSelector
          });
        }
        await this._validateLogin(methodInvocation.connection, attempt);
        await this._failedLogin(methodInvocation.connection, attempt);

        // _validateLogin may mutate attempt to set a new error message. Return
        // the modified version.
        return attempt;
      }
      ///
      /// LOGIN HANDLERS
      ///

      /**
       * @summary Registers a new login handler.
       * @locus Server
       * @param {String} [name] The type of login method like oauth, password, etc.
       * @param {Function} handler A function that receives an options object
       * (as passed as an argument to the `login` method) and returns one of
       * `undefined`, meaning don't handle or a login method result object.
       */
      registerLoginHandler(name, handler) {
        if (!handler) {
          handler = name;
          name = null;
        }
        this._loginHandlers.push({
          name: name,
          handler: Meteor.wrapFn(handler)
        });
      }
      // Checks a user's credentials against all the registered login
      // handlers, and returns a login token if the credentials are valid. It
      // is like the login method, except that it doesn't set the logged-in
      // user on the connection. Throws a Meteor.Error if logging in fails,
      // including the case where none of the login handlers handled the login
      // request. Otherwise, returns {id: userId, token: *, tokenExpires: *}.
      //
      // For example, if you want to login with a plaintext password, `options` could be
      //   { user: { username: <username> }, password: <password> }, or
      //   { user: { email: <email> }, password: <password> }.

      // Try all of the registered login handlers until one of them doesn't
      // return `undefined`, meaning it handled this call to `login`. Return
      // that return value.
      async _runLoginHandlers(methodInvocation, options) {
        for (let handler of this._loginHandlers) {
          const result = await tryLoginMethod(handler.name, async () => await handler.handler.call(methodInvocation, options));
          if (result) {
            return result;
          }
          if (result !== undefined) {
            throw new Meteor.Error(400, 'A login handler should return a result or undefined');
          }
        }
        return {
          type: null,
          error: new Meteor.Error(400, "Unrecognized options for login request")
        };
      }
      // Deletes the given loginToken from the database.
      //
      // For new-style hashed token, this will cause all connections
      // associated with the token to be closed.
      //
      // Any connections associated with old-style unhashed tokens will be
      // in the process of becoming associated with hashed tokens and then
      // they'll get closed.
      async destroyToken(userId, loginToken) {
        await this.users.updateAsync(userId, {
          $pull: {
            "services.resume.loginTokens": {
              $or: [{
                hashedToken: loginToken
              }, {
                token: loginToken
              }]
            }
          }
        });
      }
      _initServerMethods() {
        // The methods created in this function need to be created here so that
        // this variable is available in their scope.
        const accounts = this;

        // This object will be populated with methods and then passed to
        // accounts._server.methods further below.
        const methods = {};

        // @returns {Object|null}
        //   If successful, returns {token: reconnectToken, id: userId}
        //   If unsuccessful (for example, if the user closed the oauth login popup),
        //     throws an error describing the reason
        methods.login = async function (options) {
          // Login handlers should really also check whatever field they look at in
          // options, but we don't enforce it.
          check(options, Object);
          const result = await accounts._runLoginHandlers(this, options);
          //console.log({result});

          return accounts._attemptLogin(this, "login", arguments, result);
        };
        methods.logout = async function () {
          const token = accounts._getLoginToken(this.connection.id);
          accounts._setLoginToken(this.userId, this.connection, null);
          if (token && this.userId) {
            await accounts.destroyToken(this.userId, token);
          }
          await accounts._successfulLogout(this.connection, this.userId);
          await this.setUserId(null);
        };

        // Logs out the current user and closes all the connections
        // associated with the user.
        //
        methods.logoutAllClients = async function () {
          const logoutUserId = this.userId;
          accounts._setLoginToken(logoutUserId, this.connection, null);
          accounts._clearAllLoginTokens(logoutUserId);
          await accounts._successfulLogout(this.connection, logoutUserId);
          await this.setUserId(null);
        };

        // Generates a new login token with the same expiration as the
        // connection's current token and saves it to the database. Associates
        // the connection with this new token and returns it. Throws an error
        // if called on a connection that isn't logged in.
        //
        // @returns Object
        //   If successful, returns { token: <new token>, id: <user id>,
        //   tokenExpires: <expiration date> }.
        methods.getNewToken = async function () {
          const user = await accounts.users.findOneAsync(this.userId, {
            fields: {
              "services.resume.loginTokens": 1
            }
          });
          if (!this.userId || !user) {
            throw new Meteor.Error("You are not logged in.");
          }
          // Be careful not to generate a new token that has a later
          // expiration than the curren token. Otherwise, a bad guy with a
          // stolen token could use this method to stop his stolen token from
          // ever expiring.
          const currentHashedToken = accounts._getLoginToken(this.connection.id);
          const currentStampedToken = user.services.resume.loginTokens.find(stampedToken => stampedToken.hashedToken === currentHashedToken);
          if (!currentStampedToken) {
            // safety belt: this should never happen
            throw new Meteor.Error("Invalid login token");
          }
          const newStampedToken = accounts._generateStampedLoginToken();
          newStampedToken.when = currentStampedToken.when;
          await accounts._insertLoginToken(this.userId, newStampedToken);
          return accounts._loginUser(this, this.userId, newStampedToken);
        };

        // Removes all tokens except the token associated with the current
        // connection. Throws an error if the connection is not logged
        // in. Returns nothing on success.
        methods.removeOtherTokens = async function () {
          if (!this.userId) {
            throw new Meteor.Error("You are not logged in.");
          }
          const currentToken = accounts._getLoginToken(this.connection.id);
          await accounts.users.updateAsync(this.userId, {
            $pull: {
              "services.resume.loginTokens": {
                hashedToken: {
                  $ne: currentToken
                }
              }
            }
          });
        };

        // Allow a one-time configuration for a login service. Modifications
        // to this collection are also allowed in insecure mode.
        methods.configureLoginService = async options => {
          check(options, Match.ObjectIncluding({
            service: String
          }));
          // Don't let random users configure a service we haven't added yet (so
          // that when we do later add it, it's set up with their configuration
          // instead of ours).
          // XXX if service configuration is oauth-specific then this code should
          //     be in accounts-oauth; if it's not then the registry should be
          //     in this package
          if (!(accounts.oauth && accounts.oauth.serviceNames().includes(options.service))) {
            throw new Meteor.Error(403, "Service unknown");
          }
          if (Package['service-configuration']) {
            const {
              ServiceConfiguration
            } = Package['service-configuration'];
            const service = await ServiceConfiguration.configurations.findOneAsync({
              service: options.service
            });
            if (service) throw new Meteor.Error(403, "Service ".concat(options.service, " already configured"));
            if (Package["oauth-encryption"]) {
              const {
                OAuthEncryption
              } = Package["oauth-encryption"];
              if (hasOwn.call(options, 'secret') && OAuthEncryption.keyIsLoaded()) options.secret = OAuthEncryption.seal(options.secret);
            }
            await ServiceConfiguration.configurations.insertAsync(options);
          }
        };
        accounts._server.methods(methods);
      }
      _initAccountDataHooks() {
        this._server.onConnection(connection => {
          this._accountData[connection.id] = {
            connection: connection
          };
          connection.onClose(() => {
            this._removeTokenFromConnection(connection.id);
            delete this._accountData[connection.id];
          });
        });
      }
      _initServerPublications() {
        // Bring into lexical scope for publish callbacks that need `this`
        const {
          users,
          _autopublishFields,
          _defaultPublishFields
        } = this;

        // Publish all login service configuration fields other than secret.
        this._server.publish("meteor.loginServiceConfiguration", function () {
          if (Package['service-configuration']) {
            const {
              ServiceConfiguration
            } = Package['service-configuration'];
            return ServiceConfiguration.configurations.find({}, {
              fields: {
                secret: 0
              }
            });
          }
          this.ready();
        }, {
          is_auto: true
        }); // not technically autopublish, but stops the warning.

        // Use Meteor.startup to give other packages a chance to call
        // setDefaultPublishFields.
        Meteor.startup(() => {
          // Merge custom fields selector and default publish fields so that the client
          // gets all the necessary fields to run properly
          const customFields = this._addDefaultFieldSelector().fields || {};
          const keys = Object.keys(customFields);
          // If the custom fields are negative, then ignore them and only send the necessary fields
          const fields = keys.length > 0 && customFields[keys[0]] ? _objectSpread(_objectSpread({}, this._addDefaultFieldSelector().fields), _defaultPublishFields.projection) : _defaultPublishFields.projection;
          // Publish the current user's record to the client.
          this._server.publish(null, function () {
            if (this.userId) {
              return users.find({
                _id: this.userId
              }, {
                fields
              });
            } else {
              return null;
            }
          }, /*suppress autopublish warning*/{
            is_auto: true
          });
        });

        // Use Meteor.startup to give other packages a chance to call
        // addAutopublishFields.
        Package.autopublish && Meteor.startup(() => {
          // ['profile', 'username'] -> {profile: 1, username: 1}
          const toFieldSelector = fields => fields.reduce((prev, field) => _objectSpread(_objectSpread({}, prev), {}, {
            [field]: 1
          }), {});
          this._server.publish(null, function () {
            if (this.userId) {
              return users.find({
                _id: this.userId
              }, {
                fields: toFieldSelector(_autopublishFields.loggedInUser)
              });
            } else {
              return null;
            }
          }, /*suppress autopublish warning*/{
            is_auto: true
          });

          // XXX this publish is neither dedup-able nor is it optimized by our special
          // treatment of queries on a specific _id. Therefore this will have O(n^2)
          // run-time performance every time a user document is changed (eg someone
          // logging in). If this is a problem, we can instead write a manual publish
          // function which filters out fields based on 'this.userId'.
          this._server.publish(null, function () {
            const selector = this.userId ? {
              _id: {
                $ne: this.userId
              }
            } : {};
            return users.find(selector, {
              fields: toFieldSelector(_autopublishFields.otherUsers)
            });
          }, /*suppress autopublish warning*/{
            is_auto: true
          });
        });
      }
      // Add to the list of fields or subfields to be automatically
      // published if autopublish is on. Must be called from top-level
      // code (ie, before Meteor.startup hooks run).
      //
      // @param opts {Object} with:
      //   - forLoggedInUser {Array} Array of fields published to the logged-in user
      //   - forOtherUsers {Array} Array of fields published to users that aren't logged in
      addAutopublishFields(opts) {
        this._autopublishFields.loggedInUser.push.apply(this._autopublishFields.loggedInUser, opts.forLoggedInUser);
        this._autopublishFields.otherUsers.push.apply(this._autopublishFields.otherUsers, opts.forOtherUsers);
      }
      // Replaces the fields to be automatically
      // published when the user logs in
      //
      // @param {MongoFieldSpecifier} fields Dictionary of fields to return or exclude.
      setDefaultPublishFields(fields) {
        this._defaultPublishFields.projection = fields;
      }
      ///
      /// ACCOUNT DATA
      ///

      // HACK: This is used by 'meteor-accounts' to get the loginToken for a
      // connection. Maybe there should be a public way to do that.
      _getAccountData(connectionId, field) {
        const data = this._accountData[connectionId];
        return data && data[field];
      }
      _setAccountData(connectionId, field, value) {
        const data = this._accountData[connectionId];

        // safety belt. shouldn't happen. accountData is set in onConnection,
        // we don't have a connectionId until it is set.
        if (!data) return;
        if (value === undefined) delete data[field];else data[field] = value;
      }
      ///
      /// RECONNECT TOKENS
      ///
      /// support reconnecting using a meteor login token

      _hashLoginToken(loginToken) {
        const hash = crypto.createHash('sha256');
        hash.update(loginToken);
        return hash.digest('base64');
      }
      // {token, when} => {hashedToken, when}
      _hashStampedToken(stampedToken) {
        const {
            token
          } = stampedToken,
          hashedStampedToken = _objectWithoutProperties(stampedToken, _excluded);
        return _objectSpread(_objectSpread({}, hashedStampedToken), {}, {
          hashedToken: this._hashLoginToken(token)
        });
      }
      // Using $addToSet avoids getting an index error if another client
      // logging in simultaneously has already inserted the new hashed
      // token.
      async _insertHashedLoginToken(userId, hashedToken, query) {
        query = query ? _objectSpread({}, query) : {};
        query._id = userId;
        await this.users.updateAsync(query, {
          $addToSet: {
            "services.resume.loginTokens": hashedToken
          }
        });
      }
      // Exported for tests.
      async _insertLoginToken(userId, stampedToken, query) {
        await this._insertHashedLoginToken(userId, this._hashStampedToken(stampedToken), query);
      }
      /**
       *
       * @param userId
       * @private
       * @returns {Promise<void>}
       */
      _clearAllLoginTokens(userId) {
        this.users.updateAsync(userId, {
          $set: {
            'services.resume.loginTokens': []
          }
        });
      }
      // test hook
      _getUserObserve(connectionId) {
        return this._userObservesForConnections[connectionId];
      }
      // Clean up this connection's association with the token: that is, stop
      // the observe that we started when we associated the connection with
      // this token.
      _removeTokenFromConnection(connectionId) {
        if (hasOwn.call(this._userObservesForConnections, connectionId)) {
          const observe = this._userObservesForConnections[connectionId];
          if (typeof observe === 'number') {
            // We're in the process of setting up an observe for this connection. We
            // can't clean up that observe yet, but if we delete the placeholder for
            // this connection, then the observe will get cleaned up as soon as it has
            // been set up.
            delete this._userObservesForConnections[connectionId];
          } else {
            delete this._userObservesForConnections[connectionId];
            observe.stop();
          }
        }
      }
      _getLoginToken(connectionId) {
        return this._getAccountData(connectionId, 'loginToken');
      }
      // newToken is a hashed token.
      _setLoginToken(userId, connection, newToken) {
        this._removeTokenFromConnection(connection.id);
        this._setAccountData(connection.id, 'loginToken', newToken);
        if (newToken) {
          // Set up an observe for this token. If the token goes away, we need
          // to close the connection.  We defer the observe because there's
          // no need for it to be on the critical path for login; we just need
          // to ensure that the connection will get closed at some point if
          // the token gets deleted.
          //
          // Initially, we set the observe for this connection to a number; this
          // signifies to other code (which might run while we yield) that we are in
          // the process of setting up an observe for this connection. Once the
          // observe is ready to go, we replace the number with the real observe
          // handle (unless the placeholder has been deleted or replaced by a
          // different placehold number, signifying that the connection was closed
          // already -- in this case we just clean up the observe that we started).
          const myObserveNumber = ++this._nextUserObserveNumber;
          this._userObservesForConnections[connection.id] = myObserveNumber;
          Meteor.defer(async () => {
            // If something else happened on this connection in the meantime (it got
            // closed, or another call to _setLoginToken happened), just do
            // nothing. We don't need to start an observe for an old connection or old
            // token.
            if (this._userObservesForConnections[connection.id] !== myObserveNumber) {
              return;
            }
            let foundMatchingUser;
            // Because we upgrade unhashed login tokens to hashed tokens at
            // login time, sessions will only be logged in with a hashed
            // token. Thus we only need to observe hashed tokens here.
            const observe = await this.users.find({
              _id: userId,
              'services.resume.loginTokens.hashedToken': newToken
            }, {
              fields: {
                _id: 1
              }
            }).observeChanges({
              added: () => {
                foundMatchingUser = true;
              },
              removed: connection.close
              // The onClose callback for the connection takes care of
              // cleaning up the observe handle and any other state we have
              // lying around.
            }, {
              nonMutatingCallbacks: true
            });

            // If the user ran another login or logout command we were waiting for the
            // defer or added to fire (ie, another call to _setLoginToken occurred),
            // then we let the later one win (start an observe, etc) and just stop our
            // observe now.
            //
            // Similarly, if the connection was already closed, then the onClose
            // callback would have called _removeTokenFromConnection and there won't
            // be an entry in _userObservesForConnections. We can stop the observe.
            if (this._userObservesForConnections[connection.id] !== myObserveNumber) {
              observe.stop();
              return;
            }
            this._userObservesForConnections[connection.id] = observe;
            if (!foundMatchingUser) {
              // We've set up an observe on the user associated with `newToken`,
              // so if the new token is removed from the database, we'll close
              // the connection. But the token might have already been deleted
              // before we set up the observe, which wouldn't have closed the
              // connection because the observe wasn't running yet.
              connection.close();
            }
          });
        }
      }
      // (Also used by Meteor Accounts server and tests).
      //
      _generateStampedLoginToken() {
        return {
          token: Random.secret(),
          when: new Date()
        };
      }
      ///
      /// TOKEN EXPIRATION
      ///

      // Deletes expired password reset tokens from the database.
      //
      // Exported for tests. Also, the arguments are only used by
      // tests. oldestValidDate is simulate expiring tokens without waiting
      // for them to actually expire. userId is used by tests to only expire
      // tokens for the test user.
      async _expirePasswordResetTokens(oldestValidDate, userId) {
        const tokenLifetimeMs = this._getPasswordResetTokenLifetimeMs();

        // when calling from a test with extra arguments, you must specify both!
        if (oldestValidDate && !userId || !oldestValidDate && userId) {
          throw new Error("Bad test. Must specify both oldestValidDate and userId.");
        }
        oldestValidDate = oldestValidDate || new Date(new Date() - tokenLifetimeMs);
        const tokenFilter = {
          $or: [{
            "services.password.reset.reason": "reset"
          }, {
            "services.password.reset.reason": {
              $exists: false
            }
          }]
        };
        await expirePasswordToken(this, oldestValidDate, tokenFilter, userId);
      }

      // Deletes expired password enroll tokens from the database.
      //
      // Exported for tests. Also, the arguments are only used by
      // tests. oldestValidDate is simulate expiring tokens without waiting
      // for them to actually expire. userId is used by tests to only expire
      // tokens for the test user.
      async _expirePasswordEnrollTokens(oldestValidDate, userId) {
        const tokenLifetimeMs = this._getPasswordEnrollTokenLifetimeMs();

        // when calling from a test with extra arguments, you must specify both!
        if (oldestValidDate && !userId || !oldestValidDate && userId) {
          throw new Error("Bad test. Must specify both oldestValidDate and userId.");
        }
        oldestValidDate = oldestValidDate || new Date(new Date() - tokenLifetimeMs);
        const tokenFilter = {
          "services.password.enroll.reason": "enroll"
        };
        await expirePasswordToken(this, oldestValidDate, tokenFilter, userId);
      }

      // Deletes expired tokens from the database and closes all open connections
      // associated with these tokens.
      //
      // Exported for tests. Also, the arguments are only used by
      // tests. oldestValidDate is simulate expiring tokens without waiting
      // for them to actually expire. userId is used by tests to only expire
      // tokens for the test user.
      /**
       *
       * @param oldestValidDate
       * @param userId
       * @private
       * @return {Promise<void>}
       */
      async _expireTokens(oldestValidDate, userId) {
        const tokenLifetimeMs = this._getTokenLifetimeMs();

        // when calling from a test with extra arguments, you must specify both!
        if (oldestValidDate && !userId || !oldestValidDate && userId) {
          throw new Error("Bad test. Must specify both oldestValidDate and userId.");
        }
        oldestValidDate = oldestValidDate || new Date(new Date() - tokenLifetimeMs);
        const userFilter = userId ? {
          _id: userId
        } : {};

        // Backwards compatible with older versions of meteor that stored login token
        // timestamps as numbers.
        await this.users.updateAsync(_objectSpread(_objectSpread({}, userFilter), {}, {
          $or: [{
            "services.resume.loginTokens.when": {
              $lt: oldestValidDate
            }
          }, {
            "services.resume.loginTokens.when": {
              $lt: +oldestValidDate
            }
          }]
        }), {
          $pull: {
            "services.resume.loginTokens": {
              $or: [{
                when: {
                  $lt: oldestValidDate
                }
              }, {
                when: {
                  $lt: +oldestValidDate
                }
              }]
            }
          }
        }, {
          multi: true
        });
        // The observe on Meteor.users will take care of closing connections for
        // expired tokens.
      }
      // @override from accounts_common.js
      config(options) {
        // Call the overridden implementation of the method.
        const superResult = AccountsCommon.prototype.config.apply(this, arguments);

        // If the user set loginExpirationInDays to null, then we need to clear the
        // timer that periodically expires tokens.
        if (hasOwn.call(this._options, 'loginExpirationInDays') && this._options.loginExpirationInDays === null && this.expireTokenInterval) {
          Meteor.clearInterval(this.expireTokenInterval);
          this.expireTokenInterval = null;
        }
        return superResult;
      }
      // Called by accounts-password
      async insertUserDoc(options, user) {
        // - clone user document, to protect from modification
        // - add createdAt timestamp
        // - prepare an _id, so that you can modify other collections (eg
        // create a first task for every new user)
        //
        // XXX If the onCreateUser or validateNewUser hooks fail, we might
        // end up having modified some other collection
        // inappropriately. The solution is probably to have onCreateUser
        // accept two callbacks - one that gets called before inserting
        // the user document (in which you can modify its contents), and
        // one that gets called after (in which you should change other
        // collections)
        user = _objectSpread({
          createdAt: new Date(),
          _id: Random.id()
        }, user);
        if (user.services) {
          Object.keys(user.services).forEach(service => pinEncryptedFieldsToUser(user.services[service], user._id));
        }
        let fullUser;
        if (this._onCreateUserHook) {
          // Allows _onCreateUserHook to be a promise returning func
          fullUser = await this._onCreateUserHook(options, user);

          // This is *not* part of the API. We need this because we can't isolate
          // the global server environment between tests, meaning we can't test
          // both having a create user hook set and not having one set.
          if (fullUser === 'TEST DEFAULT HOOK') fullUser = defaultCreateUserHook(options, user);
        } else {
          fullUser = defaultCreateUserHook(options, user);
        }
        var _iteratorAbruptCompletion = false;
        var _didIteratorError = false;
        var _iteratorError;
        try {
          for (var _iterator = _asyncIterator(this._validateNewUserHooks), _step; _iteratorAbruptCompletion = !(_step = await _iterator.next()).done; _iteratorAbruptCompletion = false) {
            const hook = _step.value;
            {
              if (!(await hook(fullUser))) throw new Meteor.Error(403, "User validation failed");
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
        let userId;
        try {
          userId = await this.users.insertAsync(fullUser);
        } catch (e) {
          // XXX string parsing sucks, maybe
          // https://jira.mongodb.org/browse/SERVER-3069 will get fixed one day
          // https://jira.mongodb.org/browse/SERVER-4637
          if (!e.errmsg) throw e;
          if (e.errmsg.includes('emails.address')) throw new Meteor.Error(403, "Email already exists.");
          if (e.errmsg.includes('username')) throw new Meteor.Error(403, "Username already exists.");
          throw e;
        }
        return userId;
      }
      // Helper function: returns false if email does not match company domain from
      // the configuration.
      _testEmailDomain(email) {
        const domain = this._options.restrictCreationByEmailDomain;
        return !domain || typeof domain === 'function' && domain(email) || typeof domain === 'string' && new RegExp("@".concat(Meteor._escapeRegExp(domain), "$"), 'i').test(email);
      }
      ///
      /// CLEAN UP FOR `logoutOtherClients`
      ///

      async _deleteSavedTokensForUser(userId, tokensToDelete) {
        if (tokensToDelete) {
          await this.users.updateAsync(userId, {
            $unset: {
              "services.resume.haveLoginTokensToDelete": 1,
              "services.resume.loginTokensToDelete": 1
            },
            $pullAll: {
              "services.resume.loginTokens": tokensToDelete
            }
          });
        }
      }
      _deleteSavedTokensForAllUsersOnStartup() {
        // If we find users who have saved tokens to delete on startup, delete
        // them now. It's possible that the server could have crashed and come
        // back up before new tokens are found in localStorage, but this
        // shouldn't happen very often. We shouldn't put a delay here because
        // that would give a lot of power to an attacker with a stolen login
        // token and the ability to crash the server.
        Meteor.startup(async () => {
          const users = await this.users.find({
            "services.resume.haveLoginTokensToDelete": true
          }, {
            fields: {
              "services.resume.loginTokensToDelete": 1
            }
          });
          users.forEach(user => {
            this._deleteSavedTokensForUser(user._id, user.services.resume.loginTokensToDelete)
            // We don't need to wait for this to complete.
            .then(_ => _).catch(err => {
              console.log(err);
            });
          });
        });
      }
      ///
      /// MANAGING USER OBJECTS
      ///

      // Updates or creates a user after we authenticate with a 3rd party.
      //
      // @param serviceName {String} Service name (eg, twitter).
      // @param serviceData {Object} Data to store in the user's record
      //        under services[serviceName]. Must include an "id" field
      //        which is a unique identifier for the user in the service.
      // @param options {Object, optional} Other options to pass to insertUserDoc
      //        (eg, profile)
      // @returns {Object} Object with token and id keys, like the result
      //        of the "login" method.
      //
      async updateOrCreateUserFromExternalService(serviceName, serviceData, options) {
        options = _objectSpread({}, options);
        if (serviceName === "password" || serviceName === "resume") {
          throw new Error("Can't use updateOrCreateUserFromExternalService with internal service " + serviceName);
        }
        if (!hasOwn.call(serviceData, 'id')) {
          throw new Error("Service data for service ".concat(serviceName, " must include id"));
        }

        // Look for a user with the appropriate service user id.
        const selector = {};
        const serviceIdKey = "services.".concat(serviceName, ".id");

        // XXX Temporary special case for Twitter. (Issue #629)
        //   The serviceData.id will be a string representation of an integer.
        //   We want it to match either a stored string or int representation.
        //   This is to cater to earlier versions of Meteor storing twitter
        //   user IDs in number form, and recent versions storing them as strings.
        //   This can be removed once migration technology is in place, and twitter
        //   users stored with integer IDs have been migrated to string IDs.
        if (serviceName === "twitter" && !isNaN(serviceData.id)) {
          selector["$or"] = [{}, {}];
          selector["$or"][0][serviceIdKey] = serviceData.id;
          selector["$or"][1][serviceIdKey] = parseInt(serviceData.id, 10);
        } else {
          selector[serviceIdKey] = serviceData.id;
        }
        let user = await this.users.findOneAsync(selector, {
          fields: this._options.defaultFieldSelector
        });
        // Check to see if the developer has a custom way to find the user outside
        // of the general selectors above.
        if (!user && this._additionalFindUserOnExternalLogin) {
          user = await this._additionalFindUserOnExternalLogin({
            serviceName,
            serviceData,
            options
          });
        }

        // Before continuing, run user hook to see if we should continue
        if (this._beforeExternalLoginHook && !(await this._beforeExternalLoginHook(serviceName, serviceData, user))) {
          throw new Meteor.Error(403, "Login forbidden");
        }

        // When creating a new user we pass through all options. When updating an
        // existing user, by default we only process/pass through the serviceData
        // (eg, so that we keep an unexpired access token and don't cache old email
        // addresses in serviceData.email). The onExternalLogin hook can be used when
        // creating or updating a user, to modify or pass through more options as
        // needed.
        let opts = user ? {} : options;
        if (this._onExternalLoginHook) {
          opts = await this._onExternalLoginHook(options, user);
        }
        if (user) {
          await pinEncryptedFieldsToUser(serviceData, user._id);
          let setAttrs = {};
          Object.keys(serviceData).forEach(key => setAttrs["services.".concat(serviceName, ".").concat(key)] = serviceData[key]);

          // XXX Maybe we should re-use the selector above and notice if the update
          //     touches nothing?
          setAttrs = _objectSpread(_objectSpread({}, setAttrs), opts);
          await this.users.updateAsync(user._id, {
            $set: setAttrs
          });
          return {
            type: serviceName,
            userId: user._id
          };
        } else {
          // Create a new user with the service data.
          user = {
            services: {}
          };
          user.services[serviceName] = serviceData;
          const userId = await this.insertUserDoc(opts, user);
          return {
            type: serviceName,
            userId
          };
        }
      }
      /**
       * @summary Removes default rate limiting rule
       * @locus Server
       * @importFromPackage accounts-base
       */
      removeDefaultRateLimit() {
        const resp = DDPRateLimiter.removeRule(this.defaultRateLimiterRuleId);
        this.defaultRateLimiterRuleId = null;
        return resp;
      }
      /**
       * @summary Add a default rule of limiting logins, creating new users and password reset
       * to 5 times every 10 seconds per connection.
       * @locus Server
       * @importFromPackage accounts-base
       */
      addDefaultRateLimit() {
        if (!this.defaultRateLimiterRuleId) {
          this.defaultRateLimiterRuleId = DDPRateLimiter.addRule({
            userId: null,
            clientAddress: null,
            type: 'method',
            name: name => ['login', 'createUser', 'resetPassword', 'forgotPassword'].includes(name),
            connectionId: connectionId => true
          }, 5, 10000);
        }
      }
      /**
       * @summary Creates options for email sending for reset password and enroll account emails.
       * You can use this function when customizing a reset password or enroll account email sending.
       * @locus Server
       * @param {Object} email Which address of the user's to send the email to.
       * @param {Object} user The user object to generate options for.
       * @param {String} url URL to which user is directed to confirm the email.
       * @param {String} reason `resetPassword` or `enrollAccount`.
       * @returns {Object} Options which can be passed to `Email.send`.
       * @importFromPackage accounts-base
       */
      async generateOptionsForEmail(email, user, url, reason) {
        let extra = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
        const options = {
          to: email,
          from: this.emailTemplates[reason].from ? await this.emailTemplates[reason].from(user) : this.emailTemplates.from,
          subject: await this.emailTemplates[reason].subject(user, url, extra)
        };
        if (typeof this.emailTemplates[reason].text === 'function') {
          options.text = await this.emailTemplates[reason].text(user, url, extra);
        }
        if (typeof this.emailTemplates[reason].html === 'function') {
          options.html = await this.emailTemplates[reason].html(user, url, extra);
        }
        if (typeof this.emailTemplates.headers === 'object') {
          options.headers = this.emailTemplates.headers;
        }
        return options;
      }
      async _checkForCaseInsensitiveDuplicates(fieldName, displayName, fieldValue, ownUserId) {
        // Some tests need the ability to add users with the same case insensitive
        // value, hence the _skipCaseInsensitiveChecksForTest check
        const skipCheck = Object.prototype.hasOwnProperty.call(this._skipCaseInsensitiveChecksForTest, fieldValue);
        if (fieldValue && !skipCheck) {
          const matchedUsers = await Meteor.users.find(this._selectorForFastCaseInsensitiveLookup(fieldName, fieldValue), {
            fields: {
              _id: 1
            },
            // we only need a maximum of 2 users for the logic below to work
            limit: 2
          }).fetchAsync();
          if (matchedUsers.length > 0 && (
          // If we don't have a userId yet, any match we find is a duplicate
          !ownUserId ||
          // Otherwise, check to see if there are multiple matches or a match
          // that is not us
          matchedUsers.length > 1 || matchedUsers[0]._id !== ownUserId)) {
            this._handleError("".concat(displayName, " already exists."));
          }
        }
      }
      async _createUserCheckingDuplicates(_ref) {
        let {
          user,
          email,
          username,
          options
        } = _ref;
        const newUser = _objectSpread(_objectSpread(_objectSpread({}, user), username ? {
          username
        } : {}), email ? {
          emails: [{
            address: email,
            verified: false
          }]
        } : {});

        // Perform a case insensitive check before insert
        await this._checkForCaseInsensitiveDuplicates('username', 'Username', username);
        await this._checkForCaseInsensitiveDuplicates('emails.address', 'Email', email);
        const userId = await this.insertUserDoc(options, newUser);
        // Perform another check after insert, in case a matching user has been
        // inserted in the meantime
        try {
          await this._checkForCaseInsensitiveDuplicates('username', 'Username', username, userId);
          await this._checkForCaseInsensitiveDuplicates('emails.address', 'Email', email, userId);
        } catch (ex) {
          // Remove inserted user if the check fails
          await Meteor.users.removeAsync(userId);
          throw ex;
        }
        return userId;
      }
    }
    // Give each login hook callback a fresh cloned copy of the attempt
    // object, but don't clone the connection.
    //
    const cloneAttemptWithConnection = (connection, attempt) => {
      const clonedAttempt = EJSON.clone(attempt);
      clonedAttempt.connection = connection;
      return clonedAttempt;
    };
    const tryLoginMethod = async (type, fn) => {
      let result;
      try {
        result = await fn();
      } catch (e) {
        result = {
          error: e
        };
      }
      if (result && !result.type && type) result.type = type;
      return result;
    };
    const setupDefaultLoginHandlers = accounts => {
      accounts.registerLoginHandler("resume", function (options) {
        return defaultResumeLoginHandler.call(this, accounts, options);
      });
    };

    // Login handler for resume tokens.
    const defaultResumeLoginHandler = async (accounts, options) => {
      if (!options.resume) return undefined;
      check(options.resume, String);
      const hashedToken = accounts._hashLoginToken(options.resume);

      // First look for just the new-style hashed login token, to avoid
      // sending the unhashed token to the database in a query if we don't
      // need to.
      let user = await accounts.users.findOneAsync({
        "services.resume.loginTokens.hashedToken": hashedToken
      }, {
        fields: {
          "services.resume.loginTokens.$": 1
        }
      });
      if (!user) {
        // If we didn't find the hashed login token, try also looking for
        // the old-style unhashed token.  But we need to look for either
        // the old-style token OR the new-style token, because another
        // client connection logging in simultaneously might have already
        // converted the token.
        user = await accounts.users.findOneAsync({
          $or: [{
            "services.resume.loginTokens.hashedToken": hashedToken
          }, {
            "services.resume.loginTokens.token": options.resume
          }]
        },
        // Note: Cannot use ...loginTokens.$ positional operator with $or query.
        {
          fields: {
            "services.resume.loginTokens": 1
          }
        });
      }
      if (!user) return {
        error: new Meteor.Error(403, "You've been logged out by the server. Please log in again.")
      };

      // Find the token, which will either be an object with fields
      // {hashedToken, when} for a hashed token or {token, when} for an
      // unhashed token.
      let oldUnhashedStyleToken;
      let token = user.services.resume.loginTokens.find(token => token.hashedToken === hashedToken);
      if (token) {
        oldUnhashedStyleToken = false;
      } else {
        token = user.services.resume.loginTokens.find(token => token.token === options.resume);
        oldUnhashedStyleToken = true;
      }
      const tokenExpires = accounts._tokenExpiration(token.when);
      if (new Date() >= tokenExpires) return {
        userId: user._id,
        error: new Meteor.Error(403, "Your session has expired. Please log in again.")
      };

      // Update to a hashed token when an unhashed token is encountered.
      if (oldUnhashedStyleToken) {
        // Only add the new hashed token if the old unhashed token still
        // exists (this avoids resurrecting the token if it was deleted
        // after we read it).  Using $addToSet avoids getting an index
        // error if another client logging in simultaneously has already
        // inserted the new hashed token.
        await accounts.users.updateAsync({
          _id: user._id,
          "services.resume.loginTokens.token": options.resume
        }, {
          $addToSet: {
            "services.resume.loginTokens": {
              "hashedToken": hashedToken,
              "when": token.when
            }
          }
        });

        // Remove the old token *after* adding the new, since otherwise
        // another client trying to login between our removing the old and
        // adding the new wouldn't find a token to login with.
        await accounts.users.updateAsync(user._id, {
          $pull: {
            "services.resume.loginTokens": {
              "token": options.resume
            }
          }
        });
      }
      return {
        userId: user._id,
        stampedLoginToken: {
          token: options.resume,
          when: token.when
        }
      };
    };
    const expirePasswordToken = async (accounts, oldestValidDate, tokenFilter, userId) => {
      // boolean value used to determine if this method was called from enroll account workflow
      let isEnroll = false;
      const userFilter = userId ? {
        _id: userId
      } : {};
      // check if this method was called from enroll account workflow
      if (tokenFilter['services.password.enroll.reason']) {
        isEnroll = true;
      }
      let resetRangeOr = {
        $or: [{
          "services.password.reset.when": {
            $lt: oldestValidDate
          }
        }, {
          "services.password.reset.when": {
            $lt: +oldestValidDate
          }
        }]
      };
      if (isEnroll) {
        resetRangeOr = {
          $or: [{
            "services.password.enroll.when": {
              $lt: oldestValidDate
            }
          }, {
            "services.password.enroll.when": {
              $lt: +oldestValidDate
            }
          }]
        };
      }
      const expireFilter = {
        $and: [tokenFilter, resetRangeOr]
      };
      if (isEnroll) {
        await accounts.users.updateAsync(_objectSpread(_objectSpread({}, userFilter), expireFilter), {
          $unset: {
            "services.password.enroll": ""
          }
        }, {
          multi: true
        });
      } else {
        await accounts.users.updateAsync(_objectSpread(_objectSpread({}, userFilter), expireFilter), {
          $unset: {
            "services.password.reset": ""
          }
        }, {
          multi: true
        });
      }
    };
    const setExpireTokensInterval = accounts => {
      accounts.expireTokenInterval = Meteor.setInterval(async () => {
        await accounts._expireTokens();
        await accounts._expirePasswordResetTokens();
        await accounts._expirePasswordEnrollTokens();
      }, EXPIRE_TOKENS_INTERVAL_MS);
    };
    const OAuthEncryption = (_Package$oauthEncryp = Package["oauth-encryption"]) === null || _Package$oauthEncryp === void 0 ? void 0 : _Package$oauthEncryp.OAuthEncryption;

    // OAuth service data is temporarily stored in the pending credentials
    // collection during the oauth authentication process.  Sensitive data
    // such as access tokens are encrypted without the user id because
    // we don't know the user id yet.  We re-encrypt these fields with the
    // user id included when storing the service data permanently in
    // the users collection.
    //
    const pinEncryptedFieldsToUser = (serviceData, userId) => {
      Object.keys(serviceData).forEach(key => {
        let value = serviceData[key];
        if (OAuthEncryption !== null && OAuthEncryption !== void 0 && OAuthEncryption.isSealed(value)) value = OAuthEncryption.seal(OAuthEncryption.open(value), userId);
        serviceData[key] = value;
      });
    };

    // XXX see comment on Accounts.createUser in passwords_server about adding a
    // second "server options" argument.
    const defaultCreateUserHook = (options, user) => {
      if (options.profile) user.profile = options.profile;
      return user;
    };

    // Validate new user's email or Google/Facebook/GitHub account's email
    function defaultValidateNewUserHook(user) {
      const domain = this._options.restrictCreationByEmailDomain;
      if (!domain) {
        return true;
      }
      let emailIsGood = false;
      if (user.emails && user.emails.length > 0) {
        emailIsGood = user.emails.reduce((prev, email) => prev || this._testEmailDomain(email.address), false);
      } else if (user.services && Object.values(user.services).length > 0) {
        // Find any email of any service and check it
        emailIsGood = Object.values(user.services).reduce((prev, service) => service.email && this._testEmailDomain(service.email), false);
      }
      if (emailIsGood) {
        return true;
      }
      if (typeof domain === 'string') {
        throw new Meteor.Error(403, "@".concat(domain, " email required"));
      } else {
        throw new Meteor.Error(403, "Email doesn't match the criteria.");
      }
    }
    const setupUsersCollection = async users => {
      ///
      /// RESTRICTING WRITES TO USER OBJECTS
      ///
      users.allow({
        // clients can modify the profile field of their own document, and
        // nothing else.
        update: (userId, user, fields, modifier) => {
          // make sure it is our record
          if (user._id !== userId) {
            return false;
          }

          // user can only modify the 'profile' field. sets to multiple
          // sub-keys (eg profile.foo and profile.bar) are merged into entry
          // in the fields list.
          if (fields.length !== 1 || fields[0] !== 'profile') {
            return false;
          }
          return true;
        },
        fetch: ['_id'] // we only look at _id.
      });

      /// DEFAULT INDEXES ON USERS
      await users.createIndexAsync('username', {
        unique: true,
        sparse: true
      });
      await users.createIndexAsync('emails.address', {
        unique: true,
        sparse: true
      });
      await users.createIndexAsync('services.resume.loginTokens.hashedToken', {
        unique: true,
        sparse: true
      });
      await users.createIndexAsync('services.resume.loginTokens.token', {
        unique: true,
        sparse: true
      });
      // For taking care of logoutOtherClients calls that crashed before the
      // tokens were deleted.
      await users.createIndexAsync('services.resume.haveLoginTokensToDelete', {
        sparse: true
      });
      // For expiring login tokens
      await users.createIndexAsync("services.resume.loginTokens.when", {
        sparse: true
      });
      // For expiring password tokens
      await users.createIndexAsync('services.password.reset.when', {
        sparse: true
      });
      await users.createIndexAsync('services.password.enroll.when', {
        sparse: true
      });
    };

    // Generates permutations of all case variations of a given string.
    const generateCasePermutationsForString = string => {
      let permutations = [''];
      for (let i = 0; i < string.length; i++) {
        const ch = string.charAt(i);
        permutations = [].concat(...permutations.map(prefix => {
          const lowerCaseChar = ch.toLowerCase();
          const upperCaseChar = ch.toUpperCase();
          // Don't add unnecessary permutations when ch is not a letter
          if (lowerCaseChar === upperCaseChar) {
            return [prefix + ch];
          } else {
            return [prefix + lowerCaseChar, prefix + upperCaseChar];
          }
        }));
      }
      return permutations;
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

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      Accounts: Accounts
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/accounts-base/server_main.js"
  ],
  mainModulePath: "/node_modules/meteor/accounts-base/server_main.js"
}});

//# sourceURL=meteor://💻app/packages/accounts-base.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYWNjb3VudHMtYmFzZS9zZXJ2ZXJfbWFpbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYWNjb3VudHMtYmFzZS9hY2NvdW50c19jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2FjY291bnRzLWJhc2UvYWNjb3VudHNfc2VydmVyLmpzIl0sIm5hbWVzIjpbIl9vYmplY3RTcHJlYWQiLCJtb2R1bGUxIiwibGluayIsImRlZmF1bHQiLCJ2IiwiX01ldGVvciRzZXR0aW5ncyRwYWNrIiwiX01ldGVvciRzZXR0aW5ncyRwYWNrMiIsImV4cG9ydCIsIkFjY291bnRzU2VydmVyIiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJBY2NvdW50cyIsIk1ldGVvciIsInNlcnZlciIsInNldHRpbmdzIiwicGFja2FnZXMiLCJhY2NvdW50cyIsImluaXQiLCJ0aGVuIiwidXNlcnMiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiLCJtb2R1bGUiLCJBY2NvdW50c0NvbW1vbiIsIkVYUElSRV9UT0tFTlNfSU5URVJWQUxfTVMiLCJWQUxJRF9DT05GSUdfS0VZUyIsImNvbnN0cnVjdG9yIiwib3B0aW9ucyIsImtleSIsIk9iamVjdCIsImtleXMiLCJpbmNsdWRlcyIsImNvbnNvbGUiLCJlcnJvciIsImNvbmNhdCIsIl9vcHRpb25zIiwiY29ubmVjdGlvbiIsInVuZGVmaW5lZCIsIl9pbml0Q29ubmVjdGlvbiIsIl9pbml0aWFsaXplQ29sbGVjdGlvbiIsIl9vbkxvZ2luSG9vayIsIkhvb2siLCJiaW5kRW52aXJvbm1lbnQiLCJkZWJ1Z1ByaW50RXhjZXB0aW9ucyIsIl9vbkxvZ2luRmFpbHVyZUhvb2siLCJfb25Mb2dvdXRIb29rIiwiREVGQVVMVF9MT0dJTl9FWFBJUkFUSU9OX0RBWVMiLCJMT0dJTl9VTkVYUElSSU5HX1RPS0VOX0RBWVMiLCJsY2VOYW1lIiwiTG9naW5DYW5jZWxsZWRFcnJvciIsIm1ha2VFcnJvclR5cGUiLCJkZXNjcmlwdGlvbiIsIm1lc3NhZ2UiLCJwcm90b3R5cGUiLCJuYW1lIiwibnVtZXJpY0Vycm9yIiwiY29sbGVjdGlvbiIsIk1vbmdvIiwiQ29sbGVjdGlvbiIsIkVycm9yIiwiY29sbGVjdGlvbk5hbWUiLCJfcHJldmVudEF1dG9wdWJsaXNoIiwidXNlcklkIiwiX2FkZERlZmF1bHRGaWVsZFNlbGVjdG9yIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwiZGVmYXVsdEZpZWxkU2VsZWN0b3IiLCJmaWVsZHMiLCJrZXlzMiIsInVzZXIiLCJpc1NlcnZlciIsIndhcm4iLCJqb2luIiwiZmluZE9uZSIsImlzQ2xpZW50IiwiZmluZE9uZUFzeW5jIiwidXNlckFzeW5jIiwiY29uZmlnIiwiX19tZXRlb3JfcnVudGltZV9jb25maWdfXyIsImFjY291bnRzQ29uZmlnQ2FsbGVkIiwiX2RlYnVnIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiUGFja2FnZSIsIk9BdXRoRW5jcnlwdGlvbiIsImxvYWRLZXkiLCJvYXV0aFNlY3JldEtleSIsImlzVGVzdCIsIl9uYW1lIiwib25Mb2dpbiIsImZ1bmMiLCJyZXQiLCJyZWdpc3RlciIsIl9zdGFydHVwQ2FsbGJhY2siLCJjYWxsYmFjayIsIm9uTG9naW5GYWlsdXJlIiwib25Mb2dvdXQiLCJkZHBVcmwiLCJERFAiLCJjb25uZWN0IiwiQUNDT1VOVFNfQ09OTkVDVElPTl9VUkwiLCJfZ2V0VG9rZW5MaWZldGltZU1zIiwibG9naW5FeHBpcmF0aW9uSW5EYXlzIiwibG9naW5FeHBpcmF0aW9uIiwiX2dldFBhc3N3b3JkUmVzZXRUb2tlbkxpZmV0aW1lTXMiLCJwYXNzd29yZFJlc2V0VG9rZW5FeHBpcmF0aW9uIiwicGFzc3dvcmRSZXNldFRva2VuRXhwaXJhdGlvbkluRGF5cyIsIkRFRkFVTFRfUEFTU1dPUkRfUkVTRVRfVE9LRU5fRVhQSVJBVElPTl9EQVlTIiwiX2dldFBhc3N3b3JkRW5yb2xsVG9rZW5MaWZldGltZU1zIiwicGFzc3dvcmRFbnJvbGxUb2tlbkV4cGlyYXRpb24iLCJwYXNzd29yZEVucm9sbFRva2VuRXhwaXJhdGlvbkluRGF5cyIsIkRFRkFVTFRfUEFTU1dPUkRfRU5ST0xMX1RPS0VOX0VYUElSQVRJT05fREFZUyIsIl90b2tlbkV4cGlyYXRpb24iLCJ3aGVuIiwiRGF0ZSIsImdldFRpbWUiLCJfdG9rZW5FeHBpcmVzU29vbiIsIm1pbkxpZmV0aW1lTXMiLCJtaW5MaWZldGltZUNhcE1zIiwiTUlOX1RPS0VOX0xJRkVUSU1FX0NBUF9TRUNTIiwiX29iamVjdFdpdGhvdXRQcm9wZXJ0aWVzIiwiX2FzeW5jSXRlcmF0b3IiLCJfUGFja2FnZSRvYXV0aEVuY3J5cCIsIl9leGNsdWRlZCIsImNyeXB0byIsImNoZWNrIiwiTWF0Y2giLCJVUkwiLCJoYXNPd24iLCJfdGhpcyIsInRoaXMiLCJvbkNyZWF0ZUxvZ2luVG9rZW4iLCJfb25DcmVhdGVMb2dpblRva2VuSG9vayIsIl9zZWxlY3RvckZvckZhc3RDYXNlSW5zZW5zaXRpdmVMb29rdXAiLCJmaWVsZE5hbWUiLCJzdHJpbmciLCJwcmVmaXgiLCJzdWJzdHJpbmciLCJNYXRoIiwibWluIiwib3JDbGF1c2UiLCJnZW5lcmF0ZUNhc2VQZXJtdXRhdGlvbnNGb3JTdHJpbmciLCJtYXAiLCJwcmVmaXhQZXJtdXRhdGlvbiIsInNlbGVjdG9yIiwiUmVnRXhwIiwiX2VzY2FwZVJlZ0V4cCIsImNhc2VJbnNlbnNpdGl2ZUNsYXVzZSIsIiRhbmQiLCIkb3IiLCJfZmluZFVzZXJCeVF1ZXJ5IiwicXVlcnkiLCJpZCIsImZpZWxkVmFsdWUiLCJ1c2VybmFtZSIsImVtYWlsIiwiY2FuZGlkYXRlVXNlcnMiLCJmaW5kIiwibGltaXQiLCJmZXRjaEFzeW5jIiwiZmluZFVzZXJCeUVtYWlsIiwiZmluZFVzZXJCeVVzZXJuYW1lIiwiX2hhbmRsZUVycm9yIiwibXNnIiwiX3RoaXMkX29wdGlvbnMkYW1iaWd1IiwidGhyb3dFcnJvciIsImVycm9yQ29kZSIsImlzRXJyb3JBbWJpZ3VvdXMiLCJhbWJpZ3VvdXNFcnJvck1lc3NhZ2VzIiwiX3VzZXJRdWVyeVZhbGlkYXRvciIsIldoZXJlIiwiT3B0aW9uYWwiLCJOb25FbXB0eVN0cmluZyIsIl9zZXJ2ZXIiLCJfaW5pdFNlcnZlck1ldGhvZHMiLCJfaW5pdEFjY291bnREYXRhSG9va3MiLCJfYXV0b3B1Ymxpc2hGaWVsZHMiLCJsb2dnZWRJblVzZXIiLCJvdGhlclVzZXJzIiwiX2RlZmF1bHRQdWJsaXNoRmllbGRzIiwicHJvamVjdGlvbiIsInByb2ZpbGUiLCJlbWFpbHMiLCJfaW5pdFNlcnZlclB1YmxpY2F0aW9ucyIsIl9hY2NvdW50RGF0YSIsIl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9ucyIsIl9uZXh0VXNlck9ic2VydmVOdW1iZXIiLCJfbG9naW5IYW5kbGVycyIsInNldHVwRGVmYXVsdExvZ2luSGFuZGxlcnMiLCJzZXRFeHBpcmVUb2tlbnNJbnRlcnZhbCIsIl92YWxpZGF0ZUxvZ2luSG9vayIsIl92YWxpZGF0ZU5ld1VzZXJIb29rcyIsImRlZmF1bHRWYWxpZGF0ZU5ld1VzZXJIb29rIiwiYmluZCIsIl9kZWxldGVTYXZlZFRva2Vuc0ZvckFsbFVzZXJzT25TdGFydHVwIiwiX3NraXBDYXNlSW5zZW5zaXRpdmVDaGVja3NGb3JUZXN0IiwiX3Jlc29sdmVQcm9taXNlIiwidmFsdWUiLCJfaXNQcm9taXNlIiwidXJscyIsInJlc2V0UGFzc3dvcmQiLCJ0b2tlbiIsImV4dHJhUGFyYW1zIiwiYnVpbGRFbWFpbFVybCIsInZlcmlmeUVtYWlsIiwibG9naW5Ub2tlbiIsImVucm9sbEFjY291bnQiLCJhZGREZWZhdWx0UmF0ZUxpbWl0IiwicGF0aCIsInVybCIsImFic29sdXRlVXJsIiwicGFyYW1zIiwiZW50cmllcyIsInNlYXJjaFBhcmFtcyIsImFwcGVuZCIsInRvU3RyaW5nIiwiY3VycmVudEludm9jYXRpb24iLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJnZXQiLCJfQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiIsInNldHVwVXNlcnNDb2xsZWN0aW9uIiwidmFsaWRhdGVMb2dpbkF0dGVtcHQiLCJ2YWxpZGF0ZU5ld1VzZXIiLCJwdXNoIiwiYmVmb3JlRXh0ZXJuYWxMb2dpbiIsIl9iZWZvcmVFeHRlcm5hbExvZ2luSG9vayIsIm9uQ3JlYXRlVXNlciIsIl9vbkNyZWF0ZVVzZXJIb29rIiwid3JhcEZuIiwib25FeHRlcm5hbExvZ2luIiwiX29uRXh0ZXJuYWxMb2dpbkhvb2siLCJzZXRBZGRpdGlvbmFsRmluZFVzZXJPbkV4dGVybmFsTG9naW4iLCJfYWRkaXRpb25hbEZpbmRVc2VyT25FeHRlcm5hbExvZ2luIiwiX3ZhbGlkYXRlTG9naW4iLCJhdHRlbXB0IiwiZm9yRWFjaEFzeW5jIiwiY2xvbmVBdHRlbXB0V2l0aENvbm5lY3Rpb24iLCJlIiwiYWxsb3dlZCIsIl9zdWNjZXNzZnVsTG9naW4iLCJfZmFpbGVkTG9naW4iLCJfc3VjY2Vzc2Z1bExvZ291dCIsIl9sb2dpblVzZXIiLCJtZXRob2RJbnZvY2F0aW9uIiwic3RhbXBlZExvZ2luVG9rZW4iLCJfZ2VuZXJhdGVTdGFtcGVkTG9naW5Ub2tlbiIsIl9pbnNlcnRMb2dpblRva2VuIiwiX25vWWllbGRzQWxsb3dlZCIsIl9zZXRMb2dpblRva2VuIiwiX2hhc2hMb2dpblRva2VuIiwic2V0VXNlcklkIiwidG9rZW5FeHBpcmVzIiwiX2F0dGVtcHRMb2dpbiIsIm1ldGhvZE5hbWUiLCJtZXRob2RBcmdzIiwicmVzdWx0IiwidHlwZSIsIm1ldGhvZEFyZ3VtZW50cyIsIkFycmF5IiwiZnJvbSIsIm8iLCJfbG9naW5NZXRob2QiLCJmbiIsInRyeUxvZ2luTWV0aG9kIiwiX3JlcG9ydExvZ2luRmFpbHVyZSIsInJlZ2lzdGVyTG9naW5IYW5kbGVyIiwiaGFuZGxlciIsIl9ydW5Mb2dpbkhhbmRsZXJzIiwiZGVzdHJveVRva2VuIiwidXBkYXRlQXN5bmMiLCIkcHVsbCIsImhhc2hlZFRva2VuIiwibWV0aG9kcyIsImxvZ2luIiwibG9nb3V0IiwiX2dldExvZ2luVG9rZW4iLCJsb2dvdXRBbGxDbGllbnRzIiwibG9nb3V0VXNlcklkIiwiX2NsZWFyQWxsTG9naW5Ub2tlbnMiLCJnZXROZXdUb2tlbiIsImN1cnJlbnRIYXNoZWRUb2tlbiIsImN1cnJlbnRTdGFtcGVkVG9rZW4iLCJzZXJ2aWNlcyIsInJlc3VtZSIsImxvZ2luVG9rZW5zIiwic3RhbXBlZFRva2VuIiwibmV3U3RhbXBlZFRva2VuIiwicmVtb3ZlT3RoZXJUb2tlbnMiLCJjdXJyZW50VG9rZW4iLCIkbmUiLCJjb25maWd1cmVMb2dpblNlcnZpY2UiLCJPYmplY3RJbmNsdWRpbmciLCJzZXJ2aWNlIiwiU3RyaW5nIiwib2F1dGgiLCJzZXJ2aWNlTmFtZXMiLCJTZXJ2aWNlQ29uZmlndXJhdGlvbiIsImNvbmZpZ3VyYXRpb25zIiwia2V5SXNMb2FkZWQiLCJzZWNyZXQiLCJzZWFsIiwiaW5zZXJ0QXN5bmMiLCJvbkNvbm5lY3Rpb24iLCJvbkNsb3NlIiwiX3JlbW92ZVRva2VuRnJvbUNvbm5lY3Rpb24iLCJwdWJsaXNoIiwicmVhZHkiLCJpc19hdXRvIiwic3RhcnR1cCIsImN1c3RvbUZpZWxkcyIsIl9pZCIsImF1dG9wdWJsaXNoIiwidG9GaWVsZFNlbGVjdG9yIiwicmVkdWNlIiwicHJldiIsImZpZWxkIiwiYWRkQXV0b3B1Ymxpc2hGaWVsZHMiLCJvcHRzIiwiYXBwbHkiLCJmb3JMb2dnZWRJblVzZXIiLCJmb3JPdGhlclVzZXJzIiwic2V0RGVmYXVsdFB1Ymxpc2hGaWVsZHMiLCJfZ2V0QWNjb3VudERhdGEiLCJjb25uZWN0aW9uSWQiLCJkYXRhIiwiX3NldEFjY291bnREYXRhIiwiaGFzaCIsImNyZWF0ZUhhc2giLCJ1cGRhdGUiLCJkaWdlc3QiLCJfaGFzaFN0YW1wZWRUb2tlbiIsImhhc2hlZFN0YW1wZWRUb2tlbiIsIl9pbnNlcnRIYXNoZWRMb2dpblRva2VuIiwiJGFkZFRvU2V0IiwiJHNldCIsIl9nZXRVc2VyT2JzZXJ2ZSIsIm9ic2VydmUiLCJzdG9wIiwibmV3VG9rZW4iLCJteU9ic2VydmVOdW1iZXIiLCJkZWZlciIsImZvdW5kTWF0Y2hpbmdVc2VyIiwib2JzZXJ2ZUNoYW5nZXMiLCJhZGRlZCIsInJlbW92ZWQiLCJjbG9zZSIsIm5vbk11dGF0aW5nQ2FsbGJhY2tzIiwiUmFuZG9tIiwiX2V4cGlyZVBhc3N3b3JkUmVzZXRUb2tlbnMiLCJvbGRlc3RWYWxpZERhdGUiLCJ0b2tlbkxpZmV0aW1lTXMiLCJ0b2tlbkZpbHRlciIsIiRleGlzdHMiLCJleHBpcmVQYXNzd29yZFRva2VuIiwiX2V4cGlyZVBhc3N3b3JkRW5yb2xsVG9rZW5zIiwiX2V4cGlyZVRva2VucyIsInVzZXJGaWx0ZXIiLCIkbHQiLCJtdWx0aSIsInN1cGVyUmVzdWx0IiwiZXhwaXJlVG9rZW5JbnRlcnZhbCIsImNsZWFySW50ZXJ2YWwiLCJpbnNlcnRVc2VyRG9jIiwiY3JlYXRlZEF0IiwiZm9yRWFjaCIsInBpbkVuY3J5cHRlZEZpZWxkc1RvVXNlciIsImZ1bGxVc2VyIiwiZGVmYXVsdENyZWF0ZVVzZXJIb29rIiwiX2l0ZXJhdG9yQWJydXB0Q29tcGxldGlvbiIsIl9kaWRJdGVyYXRvckVycm9yIiwiX2l0ZXJhdG9yRXJyb3IiLCJfaXRlcmF0b3IiLCJfc3RlcCIsIm5leHQiLCJkb25lIiwiaG9vayIsImVyciIsInJldHVybiIsImVycm1zZyIsIl90ZXN0RW1haWxEb21haW4iLCJkb21haW4iLCJyZXN0cmljdENyZWF0aW9uQnlFbWFpbERvbWFpbiIsInRlc3QiLCJfZGVsZXRlU2F2ZWRUb2tlbnNGb3JVc2VyIiwidG9rZW5zVG9EZWxldGUiLCIkdW5zZXQiLCIkcHVsbEFsbCIsImxvZ2luVG9rZW5zVG9EZWxldGUiLCJfIiwiY2F0Y2giLCJsb2ciLCJ1cGRhdGVPckNyZWF0ZVVzZXJGcm9tRXh0ZXJuYWxTZXJ2aWNlIiwic2VydmljZU5hbWUiLCJzZXJ2aWNlRGF0YSIsInNlcnZpY2VJZEtleSIsImlzTmFOIiwicGFyc2VJbnQiLCJzZXRBdHRycyIsInJlbW92ZURlZmF1bHRSYXRlTGltaXQiLCJyZXNwIiwiRERQUmF0ZUxpbWl0ZXIiLCJyZW1vdmVSdWxlIiwiZGVmYXVsdFJhdGVMaW1pdGVyUnVsZUlkIiwiYWRkUnVsZSIsImNsaWVudEFkZHJlc3MiLCJnZW5lcmF0ZU9wdGlvbnNGb3JFbWFpbCIsInJlYXNvbiIsImV4dHJhIiwidG8iLCJlbWFpbFRlbXBsYXRlcyIsInN1YmplY3QiLCJ0ZXh0IiwiaHRtbCIsImhlYWRlcnMiLCJfY2hlY2tGb3JDYXNlSW5zZW5zaXRpdmVEdXBsaWNhdGVzIiwiZGlzcGxheU5hbWUiLCJvd25Vc2VySWQiLCJza2lwQ2hlY2siLCJtYXRjaGVkVXNlcnMiLCJfY3JlYXRlVXNlckNoZWNraW5nRHVwbGljYXRlcyIsIl9yZWYiLCJuZXdVc2VyIiwiYWRkcmVzcyIsInZlcmlmaWVkIiwiZXgiLCJyZW1vdmVBc3luYyIsImNsb25lZEF0dGVtcHQiLCJFSlNPTiIsImNsb25lIiwiZGVmYXVsdFJlc3VtZUxvZ2luSGFuZGxlciIsIm9sZFVuaGFzaGVkU3R5bGVUb2tlbiIsImlzRW5yb2xsIiwicmVzZXRSYW5nZU9yIiwiZXhwaXJlRmlsdGVyIiwic2V0SW50ZXJ2YWwiLCJpc1NlYWxlZCIsIm9wZW4iLCJlbWFpbElzR29vZCIsInZhbHVlcyIsImFsbG93IiwibW9kaWZpZXIiLCJmZXRjaCIsImNyZWF0ZUluZGV4QXN5bmMiLCJ1bmlxdWUiLCJzcGFyc2UiLCJwZXJtdXRhdGlvbnMiLCJpIiwiY2giLCJjaGFyQXQiLCJsb3dlckNhc2VDaGFyIiwidG9Mb3dlckNhc2UiLCJ1cHBlckNhc2VDaGFyIiwidG9VcHBlckNhc2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBLElBQUlBLGFBQWE7SUFBQ0MsT0FBTyxDQUFDQyxJQUFJLENBQUMsc0NBQXNDLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUNKLGFBQWEsR0FBQ0ksQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFD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TSxDQUFDLEdBQUkyWixZQUFZLENBQUMvUyxHQUFHLENBQUNOLE1BQU0sSUFBSTtVQUN0RCxNQUFNeVQsYUFBYSxHQUFHRixFQUFFLENBQUNHLFdBQVcsQ0FBQyxDQUFDO1VBQ3RDLE1BQU1DLGFBQWEsR0FBR0osRUFBRSxDQUFDSyxXQUFXLENBQUMsQ0FBQztVQUN0QztVQUNBLElBQUlILGFBQWEsS0FBS0UsYUFBYSxFQUFFO1lBQ25DLE9BQU8sQ0FBQzNULE1BQU0sR0FBR3VULEVBQUUsQ0FBQztVQUN0QixDQUFDLE1BQU07WUFDTCxPQUFPLENBQUN2VCxNQUFNLEdBQUd5VCxhQUFhLEVBQUV6VCxNQUFNLEdBQUcyVCxhQUFhLENBQUM7VUFDekQ7UUFDRixDQUFDLENBQUUsQ0FBQztNQUNOO01BQ0EsT0FBT04sWUFBWTtJQUNyQixDQUFDO0lBQUEzYSxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9hY2NvdW50cy1iYXNlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQWNjb3VudHNTZXJ2ZXIgfSBmcm9tIFwiLi9hY2NvdW50c19zZXJ2ZXIuanNcIjtcblxuLyoqXG4gKiBAbmFtZXNwYWNlIEFjY291bnRzXG4gKiBAc3VtbWFyeSBUaGUgbmFtZXNwYWNlIGZvciBhbGwgc2VydmVyLXNpZGUgYWNjb3VudHMtcmVsYXRlZCBtZXRob2RzLlxuICovXG5BY2NvdW50cyA9IG5ldyBBY2NvdW50c1NlcnZlcihNZXRlb3Iuc2VydmVyLCB7IC4uLk1ldGVvci5zZXR0aW5ncy5wYWNrYWdlcz8uYWNjb3VudHMsIC4uLk1ldGVvci5zZXR0aW5ncy5wYWNrYWdlcz8uWydhY2NvdW50cy1iYXNlJ10gfSk7XG4vLyBUT0RPW0ZJQkVSU106IEkgbmVlZCBUTEFcbkFjY291bnRzLmluaXQoKS50aGVuKCk7XG5cbi8vIFVzZXJzIHRhYmxlLiBEb24ndCB1c2UgdGhlIG5vcm1hbCBhdXRvcHVibGlzaCwgc2luY2Ugd2Ugd2FudCB0byBoaWRlXG4vLyBzb21lIGZpZWxkcy4gQ29kZSB0byBhdXRvcHVibGlzaCB0aGlzIGlzIGluIGFjY291bnRzX3NlcnZlci5qcy5cbi8vIFhYWCBBbGxvdyB1c2VycyB0byBjb25maWd1cmUgdGhpcyBjb2xsZWN0aW9uIG5hbWUuXG5cbi8qKlxuICogQHN1bW1hcnkgQSBbTW9uZ28uQ29sbGVjdGlvbl0oI2NvbGxlY3Rpb25zKSBjb250YWluaW5nIHVzZXIgZG9jdW1lbnRzLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAdHlwZSB7TW9uZ28uQ29sbGVjdGlvbn1cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAqL1xuTWV0ZW9yLnVzZXJzID0gQWNjb3VudHMudXNlcnM7XG5cbmV4cG9ydCB7XG4gIC8vIFNpbmNlIHRoaXMgZmlsZSBpcyB0aGUgbWFpbiBtb2R1bGUgZm9yIHRoZSBzZXJ2ZXIgdmVyc2lvbiBvZiB0aGVcbiAgLy8gYWNjb3VudHMtYmFzZSBwYWNrYWdlLCBwcm9wZXJ0aWVzIG9mIG5vbi1lbnRyeS1wb2ludCBtb2R1bGVzIG5lZWQgdG9cbiAgLy8gYmUgcmUtZXhwb3J0ZWQgaW4gb3JkZXIgdG8gYmUgYWNjZXNzaWJsZSB0byBtb2R1bGVzIHRoYXQgaW1wb3J0IHRoZVxuICAvLyBhY2NvdW50cy1iYXNlIHBhY2thZ2UuXG4gIEFjY291bnRzU2VydmVyXG59O1xuIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5cbi8vIGNvbmZpZyBvcHRpb24ga2V5c1xuY29uc3QgVkFMSURfQ09ORklHX0tFWVMgPSBbXG4gICdzZW5kVmVyaWZpY2F0aW9uRW1haWwnLFxuICAnZm9yYmlkQ2xpZW50QWNjb3VudENyZWF0aW9uJyxcbiAgJ3Jlc3RyaWN0Q3JlYXRpb25CeUVtYWlsRG9tYWluJyxcbiAgJ2xvZ2luRXhwaXJhdGlvbicsXG4gICdsb2dpbkV4cGlyYXRpb25JbkRheXMnLFxuICAnb2F1dGhTZWNyZXRLZXknLFxuICAncGFzc3dvcmRSZXNldFRva2VuRXhwaXJhdGlvbkluRGF5cycsXG4gICdwYXNzd29yZFJlc2V0VG9rZW5FeHBpcmF0aW9uJyxcbiAgJ3Bhc3N3b3JkRW5yb2xsVG9rZW5FeHBpcmF0aW9uSW5EYXlzJyxcbiAgJ3Bhc3N3b3JkRW5yb2xsVG9rZW5FeHBpcmF0aW9uJyxcbiAgJ2FtYmlndW91c0Vycm9yTWVzc2FnZXMnLFxuICAnYmNyeXB0Um91bmRzJyxcbiAgJ2FyZ29uMkVuYWJsZWQnLFxuICAnYXJnb24yVHlwZScsXG4gICdhcmdvbjJUaW1lQ29zdCcsXG4gICdhcmdvbjJNZW1vcnlDb3N0JyxcbiAgJ2FyZ29uMlBhcmFsbGVsaXNtJyxcbiAgJ2RlZmF1bHRGaWVsZFNlbGVjdG9yJyxcbiAgJ2NvbGxlY3Rpb24nLFxuICAnbG9naW5Ub2tlbkV4cGlyYXRpb25Ib3VycycsXG4gICd0b2tlblNlcXVlbmNlTGVuZ3RoJyxcbiAgJ2NsaWVudFN0b3JhZ2UnLFxuICAnZGRwVXJsJyxcbiAgJ2Nvbm5lY3Rpb24nLFxuXTtcblxuLyoqXG4gKiBAc3VtbWFyeSBTdXBlci1jb25zdHJ1Y3RvciBmb3IgQWNjb3VudHNDbGllbnQgYW5kIEFjY291bnRzU2VydmVyLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAY2xhc3MgQWNjb3VudHNDb21tb25cbiAqIEBpbnN0YW5jZW5hbWUgYWNjb3VudHNDbGllbnRPclNlcnZlclxuICogQHBhcmFtIG9wdGlvbnMge09iamVjdH0gYW4gb2JqZWN0IHdpdGggZmllbGRzOlxuICogLSBjb25uZWN0aW9uIHtPYmplY3R9IE9wdGlvbmFsIEREUCBjb25uZWN0aW9uIHRvIHJldXNlLlxuICogLSBkZHBVcmwge1N0cmluZ30gT3B0aW9uYWwgVVJMIGZvciBjcmVhdGluZyBhIG5ldyBERFAgY29ubmVjdGlvbi5cbiAqIC0gY29sbGVjdGlvbiB7U3RyaW5nfE1vbmdvLkNvbGxlY3Rpb259IFRoZSBuYW1lIG9mIHRoZSBNb25nby5Db2xsZWN0aW9uXG4gKiAgICAgb3IgdGhlIE1vbmdvLkNvbGxlY3Rpb24gb2JqZWN0IHRvIGhvbGQgdGhlIHVzZXJzLlxuICovXG5leHBvcnQgY2xhc3MgQWNjb3VudHNDb21tb24ge1xuICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgLy8gVmFsaWRhdGUgY29uZmlnIG9wdGlvbnMga2V5c1xuICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG9wdGlvbnMpKSB7XG4gICAgICBpZiAoIVZBTElEX0NPTkZJR19LRVlTLmluY2x1ZGVzKGtleSkpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgQWNjb3VudHMuY29uZmlnOiBJbnZhbGlkIGtleTogJHtrZXl9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3VycmVudGx5IHRoaXMgaXMgcmVhZCBkaXJlY3RseSBieSBwYWNrYWdlcyBsaWtlIGFjY291bnRzLXBhc3N3b3JkXG4gICAgLy8gYW5kIGFjY291bnRzLXVpLXVuc3R5bGVkLlxuICAgIHRoaXMuX29wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgLy8gTm90ZSB0aGF0IHNldHRpbmcgdGhpcy5jb25uZWN0aW9uID0gbnVsbCBjYXVzZXMgdGhpcy51c2VycyB0byBiZSBhXG4gICAgLy8gTG9jYWxDb2xsZWN0aW9uLCB3aGljaCBpcyBub3Qgd2hhdCB3ZSB3YW50LlxuICAgIHRoaXMuY29ubmVjdGlvbiA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9pbml0Q29ubmVjdGlvbihvcHRpb25zIHx8IHt9KTtcblxuICAgIC8vIFRoZXJlIGlzIGFuIGFsbG93IGNhbGwgaW4gYWNjb3VudHNfc2VydmVyLmpzIHRoYXQgcmVzdHJpY3RzIHdyaXRlcyB0b1xuICAgIC8vIHRoaXMgY29sbGVjdGlvbi5cbiAgICB0aGlzLnVzZXJzID0gdGhpcy5faW5pdGlhbGl6ZUNvbGxlY3Rpb24ob3B0aW9ucyB8fCB7fSk7XG5cbiAgICAvLyBDYWxsYmFjayBleGNlcHRpb25zIGFyZSBwcmludGVkIHdpdGggTWV0ZW9yLl9kZWJ1ZyBhbmQgaWdub3JlZC5cbiAgICB0aGlzLl9vbkxvZ2luSG9vayA9IG5ldyBIb29rKHtcbiAgICAgIGJpbmRFbnZpcm9ubWVudDogZmFsc2UsXG4gICAgICBkZWJ1Z1ByaW50RXhjZXB0aW9uczogJ29uTG9naW4gY2FsbGJhY2snLFxuICAgIH0pO1xuXG4gICAgdGhpcy5fb25Mb2dpbkZhaWx1cmVIb29rID0gbmV3IEhvb2soe1xuICAgICAgYmluZEVudmlyb25tZW50OiBmYWxzZSxcbiAgICAgIGRlYnVnUHJpbnRFeGNlcHRpb25zOiAnb25Mb2dpbkZhaWx1cmUgY2FsbGJhY2snLFxuICAgIH0pO1xuXG4gICAgdGhpcy5fb25Mb2dvdXRIb29rID0gbmV3IEhvb2soe1xuICAgICAgYmluZEVudmlyb25tZW50OiBmYWxzZSxcbiAgICAgIGRlYnVnUHJpbnRFeGNlcHRpb25zOiAnb25Mb2dvdXQgY2FsbGJhY2snLFxuICAgIH0pO1xuXG4gICAgLy8gRXhwb3NlIGZvciB0ZXN0aW5nLlxuICAgIHRoaXMuREVGQVVMVF9MT0dJTl9FWFBJUkFUSU9OX0RBWVMgPSBERUZBVUxUX0xPR0lOX0VYUElSQVRJT05fREFZUztcbiAgICB0aGlzLkxPR0lOX1VORVhQSVJJTkdfVE9LRU5fREFZUyA9IExPR0lOX1VORVhQSVJJTkdfVE9LRU5fREFZUztcblxuICAgIC8vIFRocm93biB3aGVuIHRoZSB1c2VyIGNhbmNlbHMgdGhlIGxvZ2luIHByb2Nlc3MgKGVnLCBjbG9zZXMgYW4gb2F1dGhcbiAgICAvLyBwb3B1cCwgZGVjbGluZXMgcmV0aW5hIHNjYW4sIGV0YylcbiAgICBjb25zdCBsY2VOYW1lID0gJ0FjY291bnRzLkxvZ2luQ2FuY2VsbGVkRXJyb3InO1xuICAgIHRoaXMuTG9naW5DYW5jZWxsZWRFcnJvciA9IE1ldGVvci5tYWtlRXJyb3JUeXBlKGxjZU5hbWUsIGZ1bmN0aW9uKFxuICAgICAgZGVzY3JpcHRpb25cbiAgICApIHtcbiAgICAgIHRoaXMubWVzc2FnZSA9IGRlc2NyaXB0aW9uO1xuICAgIH0pO1xuICAgIHRoaXMuTG9naW5DYW5jZWxsZWRFcnJvci5wcm90b3R5cGUubmFtZSA9IGxjZU5hbWU7XG5cbiAgICAvLyBUaGlzIGlzIHVzZWQgdG8gdHJhbnNtaXQgc3BlY2lmaWMgc3ViY2xhc3MgZXJyb3JzIG92ZXIgdGhlIHdpcmUuIFdlXG4gICAgLy8gc2hvdWxkIGNvbWUgdXAgd2l0aCBhIG1vcmUgZ2VuZXJpYyB3YXkgdG8gZG8gdGhpcyAoZWcsIHdpdGggc29tZSBzb3J0IG9mXG4gICAgLy8gc3ltYm9saWMgZXJyb3IgY29kZSByYXRoZXIgdGhhbiBhIG51bWJlcikuXG4gICAgdGhpcy5Mb2dpbkNhbmNlbGxlZEVycm9yLm51bWVyaWNFcnJvciA9IDB4OGFjZGMyZjtcbiAgfVxuXG4gIF9pbml0aWFsaXplQ29sbGVjdGlvbihvcHRpb25zKSB7XG4gICAgaWYgKG9wdGlvbnMuY29sbGVjdGlvbiAmJiB0eXBlb2Ygb3B0aW9ucy5jb2xsZWN0aW9uICE9PSAnc3RyaW5nJyAmJiAhKG9wdGlvbnMuY29sbGVjdGlvbiBpbnN0YW5jZW9mIE1vbmdvLkNvbGxlY3Rpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdDb2xsZWN0aW9uIHBhcmFtZXRlciBjYW4gYmUgb25seSBvZiB0eXBlIHN0cmluZyBvciBcIk1vbmdvLkNvbGxlY3Rpb25cIicpO1xuICAgIH1cblxuICAgIGxldCBjb2xsZWN0aW9uTmFtZSA9ICd1c2Vycyc7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLmNvbGxlY3Rpb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICBjb2xsZWN0aW9uTmFtZSA9IG9wdGlvbnMuY29sbGVjdGlvbjtcbiAgICB9XG5cbiAgICBsZXQgY29sbGVjdGlvbjtcbiAgICBpZiAob3B0aW9ucy5jb2xsZWN0aW9uIGluc3RhbmNlb2YgTW9uZ28uQ29sbGVjdGlvbikge1xuICAgICAgY29sbGVjdGlvbiA9IG9wdGlvbnMuY29sbGVjdGlvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29sbGVjdGlvbiA9IG5ldyBNb25nby5Db2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lLCB7XG4gICAgICAgIF9wcmV2ZW50QXV0b3B1Ymxpc2g6IHRydWUsXG4gICAgICAgIGNvbm5lY3Rpb246IHRoaXMuY29ubmVjdGlvbixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBjb2xsZWN0aW9uO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldCB0aGUgY3VycmVudCB1c2VyIGlkLCBvciBgbnVsbGAgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4uIEEgcmVhY3RpdmUgZGF0YSBzb3VyY2UuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKi9cbiAgdXNlcklkKCkge1xuICAgIHRocm93IG5ldyBFcnJvcigndXNlcklkIG1ldGhvZCBub3QgaW1wbGVtZW50ZWQnKTtcbiAgfVxuXG4gIC8vIG1lcmdlIHRoZSBkZWZhdWx0RmllbGRTZWxlY3RvciB3aXRoIGFuIGV4aXN0aW5nIG9wdGlvbnMgb2JqZWN0XG4gIF9hZGREZWZhdWx0RmllbGRTZWxlY3RvcihvcHRpb25zID0ge30pIHtcbiAgICAvLyB0aGlzIHdpbGwgYmUgdGhlIG1vc3QgY29tbW9uIGNhc2UgZm9yIG1vc3QgcGVvcGxlLCBzbyBtYWtlIGl0IHF1aWNrXG4gICAgaWYgKCF0aGlzLl9vcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yKSByZXR1cm4gb3B0aW9ucztcblxuICAgIC8vIGlmIG5vIGZpZWxkIHNlbGVjdG9yIHRoZW4ganVzdCB1c2UgZGVmYXVsdEZpZWxkU2VsZWN0b3JcbiAgICBpZiAoIW9wdGlvbnMuZmllbGRzKVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgZmllbGRzOiB0aGlzLl9vcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yLFxuICAgICAgfTtcblxuICAgIC8vIGlmIGVtcHR5IGZpZWxkIHNlbGVjdG9yIHRoZW4gdGhlIGZ1bGwgdXNlciBvYmplY3QgaXMgZXhwbGljaXRseSByZXF1ZXN0ZWQsIHNvIG9iZXlcbiAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMob3B0aW9ucy5maWVsZHMpO1xuICAgIGlmICgha2V5cy5sZW5ndGgpIHJldHVybiBvcHRpb25zO1xuXG4gICAgLy8gaWYgdGhlIHJlcXVlc3RlZCBmaWVsZHMgYXJlICt2ZSB0aGVuIGlnbm9yZSBkZWZhdWx0RmllbGRTZWxlY3RvclxuICAgIC8vIGFzc3VtZSB0aGV5IGFyZSBhbGwgZWl0aGVyICt2ZSBvciAtdmUgYmVjYXVzZSBNb25nbyBkb2Vzbid0IGxpa2UgbWl4ZWRcbiAgICBpZiAoISFvcHRpb25zLmZpZWxkc1trZXlzWzBdXSkgcmV0dXJuIG9wdGlvbnM7XG5cbiAgICAvLyBUaGUgcmVxdWVzdGVkIGZpZWxkcyBhcmUgLXZlLlxuICAgIC8vIElmIHRoZSBkZWZhdWx0RmllbGRTZWxlY3RvciBpcyArdmUgdGhlbiB1c2UgcmVxdWVzdGVkIGZpZWxkcywgb3RoZXJ3aXNlIG1lcmdlIHRoZW1cbiAgICBjb25zdCBrZXlzMiA9IE9iamVjdC5rZXlzKHRoaXMuX29wdGlvbnMuZGVmYXVsdEZpZWxkU2VsZWN0b3IpO1xuICAgIHJldHVybiB0aGlzLl9vcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yW2tleXMyWzBdXVxuICAgICAgPyBvcHRpb25zXG4gICAgICA6IHtcbiAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgIGZpZWxkczoge1xuICAgICAgICAgICAgLi4ub3B0aW9ucy5maWVsZHMsXG4gICAgICAgICAgICAuLi50aGlzLl9vcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yLFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgR2V0IHRoZSBjdXJyZW50IHVzZXIgcmVjb3JkLCBvciBgbnVsbGAgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4uIEEgcmVhY3RpdmUgZGF0YSBzb3VyY2UuIEluIHRoZSBzZXJ2ZXIgdGhpcyBmdWN0aW9uIHJldHVybnMgYSBwcm9taXNlLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICAgKi9cbiAgdXNlcihvcHRpb25zKSB7XG4gICAgaWYgKE1ldGVvci5pc1NlcnZlcikge1xuICAgICAgY29uc29sZS53YXJuKFtcbiAgICAgICAgXCJgTWV0ZW9yLnVzZXIoKWAgaXMgZGVwcmVjYXRlZCBvbiB0aGUgc2VydmVyIHNpZGUuXCIsXG4gICAgICAgIFwiICAgIFRvIGZldGNoIHRoZSBjdXJyZW50IHVzZXIgcmVjb3JkIG9uIHRoZSBzZXJ2ZXIsXCIsXG4gICAgICAgIFwiICAgIHVzZSBgTWV0ZW9yLnVzZXJBc3luYygpYCBpbnN0ZWFkLlwiLFxuICAgICAgXS5qb2luKFwiXFxuXCIpKTtcbiAgICB9XG5cbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCB1c2VySWQgPSBzZWxmLnVzZXJJZCgpO1xuICAgIGNvbnN0IGZpbmRPbmUgPSAoLi4uYXJncykgPT4gTWV0ZW9yLmlzQ2xpZW50XG4gICAgICA/IHNlbGYudXNlcnMuZmluZE9uZSguLi5hcmdzKVxuICAgICAgOiBzZWxmLnVzZXJzLmZpbmRPbmVBc3luYyguLi5hcmdzKTtcbiAgICByZXR1cm4gdXNlcklkXG4gICAgICA/IGZpbmRPbmUodXNlcklkLCB0aGlzLl9hZGREZWZhdWx0RmllbGRTZWxlY3RvcihvcHRpb25zKSlcbiAgICAgIDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBHZXQgdGhlIGN1cnJlbnQgdXNlciByZWNvcmQsIG9yIGBudWxsYCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbi5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtNb25nb0ZpZWxkU3BlY2lmaWVyfSBvcHRpb25zLmZpZWxkcyBEaWN0aW9uYXJ5IG9mIGZpZWxkcyB0byByZXR1cm4gb3IgZXhjbHVkZS5cbiAgICovXG4gIGFzeW5jIHVzZXJBc3luYyhvcHRpb25zKSB7XG4gICAgY29uc3QgdXNlcklkID0gdGhpcy51c2VySWQoKTtcbiAgICByZXR1cm4gdXNlcklkXG4gICAgICA/IHRoaXMudXNlcnMuZmluZE9uZUFzeW5jKHVzZXJJZCwgdGhpcy5fYWRkRGVmYXVsdEZpZWxkU2VsZWN0b3Iob3B0aW9ucykpXG4gICAgICA6IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgU2V0IGdsb2JhbCBhY2NvdW50cyBvcHRpb25zLiBZb3UgY2FuIGFsc28gc2V0IHRoZXNlIGluIGBNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXMuYWNjb3VudHNgIHdpdGhvdXQgdGhlIG5lZWQgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnNlbmRWZXJpZmljYXRpb25FbWFpbCBOZXcgdXNlcnMgd2l0aCBhbiBlbWFpbCBhZGRyZXNzIHdpbGwgcmVjZWl2ZSBhbiBhZGRyZXNzIHZlcmlmaWNhdGlvbiBlbWFpbC5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLmZvcmJpZENsaWVudEFjY291bnRDcmVhdGlvbiBDYWxscyB0byBbYGNyZWF0ZVVzZXJgXSgjYWNjb3VudHNfY3JlYXRldXNlcikgZnJvbSB0aGUgY2xpZW50IHdpbGwgYmUgcmVqZWN0ZWQuIEluIGFkZGl0aW9uLCBpZiB5b3UgYXJlIHVzaW5nIFthY2NvdW50cy11aV0oI2FjY291bnRzdWkpLCB0aGUgXCJDcmVhdGUgYWNjb3VudFwiIGxpbmsgd2lsbCBub3QgYmUgYXZhaWxhYmxlLiAqKkltcG9ydGFudCoqOiBUaGlzIG9wdGlvbiBtdXN0IGJlIHNldCBvbiBib3RoIHRoZSBjbGllbnQgYW5kIHNlcnZlciB0byB0YWtlIGZ1bGwgZWZmZWN0LiBJZiBvbmx5IHNldCBvbiB0aGUgc2VydmVyLCBhY2NvdW50IGNyZWF0aW9uIHdpbGwgYmUgYmxvY2tlZCBidXQgdGhlIFVJIHdpbGwgc3RpbGwgc2hvdyB0aGUgXCJDcmVhdGUgYWNjb3VudFwiIGxpbmsuXG4gICAqIEBwYXJhbSB7U3RyaW5nIHwgRnVuY3Rpb259IG9wdGlvbnMucmVzdHJpY3RDcmVhdGlvbkJ5RW1haWxEb21haW4gSWYgc2V0IHRvIGEgc3RyaW5nLCBvbmx5IGFsbG93cyBuZXcgdXNlcnMgaWYgdGhlIGRvbWFpbiBwYXJ0IG9mIHRoZWlyIGVtYWlsIGFkZHJlc3MgbWF0Y2hlcyB0aGUgc3RyaW5nLiBJZiBzZXQgdG8gYSBmdW5jdGlvbiwgb25seSBhbGxvd3MgbmV3IHVzZXJzIGlmIHRoZSBmdW5jdGlvbiByZXR1cm5zIHRydWUuICBUaGUgZnVuY3Rpb24gaXMgcGFzc2VkIHRoZSBmdWxsIGVtYWlsIGFkZHJlc3Mgb2YgdGhlIHByb3Bvc2VkIG5ldyB1c2VyLiAgV29ya3Mgd2l0aCBwYXNzd29yZC1iYXNlZCBzaWduLWluIGFuZCBleHRlcm5hbCBzZXJ2aWNlcyB0aGF0IGV4cG9zZSBlbWFpbCBhZGRyZXNzZXMgKEdvb2dsZSwgRmFjZWJvb2ssIEdpdEh1YikuIEFsbCBleGlzdGluZyB1c2VycyBzdGlsbCBjYW4gbG9nIGluIGFmdGVyIGVuYWJsaW5nIHRoaXMgb3B0aW9uLiBFeGFtcGxlOiBgQWNjb3VudHMuY29uZmlnKHsgcmVzdHJpY3RDcmVhdGlvbkJ5RW1haWxEb21haW46ICdzY2hvb2wuZWR1JyB9KWAuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLmxvZ2luRXhwaXJhdGlvbiBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyBmcm9tIHdoZW4gYSB1c2VyIGxvZ3MgaW4gdW50aWwgdGhlaXIgdG9rZW4gZXhwaXJlcyBhbmQgdGhleSBhcmUgbG9nZ2VkIG91dCwgZm9yIGEgbW9yZSBncmFudWxhciBjb250cm9sLiBJZiBgbG9naW5FeHBpcmF0aW9uSW5EYXlzYCBpcyBzZXQsIGl0IHRha2VzIHByZWNlZGVudC5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMubG9naW5FeHBpcmF0aW9uSW5EYXlzIFRoZSBudW1iZXIgb2YgZGF5cyBmcm9tIHdoZW4gYSB1c2VyIGxvZ3MgaW4gdW50aWwgdGhlaXIgdG9rZW4gZXhwaXJlcyBhbmQgdGhleSBhcmUgbG9nZ2VkIG91dC4gRGVmYXVsdHMgdG8gOTAuIFNldCB0byBgbnVsbGAgdG8gZGlzYWJsZSBsb2dpbiBleHBpcmF0aW9uLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5vYXV0aFNlY3JldEtleSBXaGVuIHVzaW5nIHRoZSBgb2F1dGgtZW5jcnlwdGlvbmAgcGFja2FnZSwgdGhlIDE2IGJ5dGUga2V5IHVzaW5nIHRvIGVuY3J5cHQgc2Vuc2l0aXZlIGFjY291bnQgY3JlZGVudGlhbHMgaW4gdGhlIGRhdGFiYXNlLCBlbmNvZGVkIGluIGJhc2U2NC4gIFRoaXMgb3B0aW9uIG1heSBvbmx5IGJlIHNwZWNpZmllZCBvbiB0aGUgc2VydmVyLiAgU2VlIHBhY2thZ2VzL29hdXRoLWVuY3J5cHRpb24vUkVBRE1FLm1kIGZvciBkZXRhaWxzLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5wYXNzd29yZFJlc2V0VG9rZW5FeHBpcmF0aW9uSW5EYXlzIFRoZSBudW1iZXIgb2YgZGF5cyBmcm9tIHdoZW4gYSBsaW5rIHRvIHJlc2V0IHBhc3N3b3JkIGlzIHNlbnQgdW50aWwgdG9rZW4gZXhwaXJlcyBhbmQgdXNlciBjYW4ndCByZXNldCBwYXNzd29yZCB3aXRoIHRoZSBsaW5rIGFueW1vcmUuIERlZmF1bHRzIHRvIDMuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnBhc3N3b3JkUmVzZXRUb2tlbkV4cGlyYXRpb24gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgZnJvbSB3aGVuIGEgbGluayB0byByZXNldCBwYXNzd29yZCBpcyBzZW50IHVudGlsIHRva2VuIGV4cGlyZXMgYW5kIHVzZXIgY2FuJ3QgcmVzZXQgcGFzc3dvcmQgd2l0aCB0aGUgbGluayBhbnltb3JlLiBJZiBgcGFzc3dvcmRSZXNldFRva2VuRXhwaXJhdGlvbkluRGF5c2AgaXMgc2V0LCBpdCB0YWtlcyBwcmVjZWRlbnQuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnBhc3N3b3JkRW5yb2xsVG9rZW5FeHBpcmF0aW9uSW5EYXlzIFRoZSBudW1iZXIgb2YgZGF5cyBmcm9tIHdoZW4gYSBsaW5rIHRvIHNldCBpbml0aWFsIHBhc3N3b3JkIGlzIHNlbnQgdW50aWwgdG9rZW4gZXhwaXJlcyBhbmQgdXNlciBjYW4ndCBzZXQgcGFzc3dvcmQgd2l0aCB0aGUgbGluayBhbnltb3JlLiBEZWZhdWx0cyB0byAzMC5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMucGFzc3dvcmRFbnJvbGxUb2tlbkV4cGlyYXRpb24gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgZnJvbSB3aGVuIGEgbGluayB0byBzZXQgaW5pdGlhbCBwYXNzd29yZCBpcyBzZW50IHVudGlsIHRva2VuIGV4cGlyZXMgYW5kIHVzZXIgY2FuJ3Qgc2V0IHBhc3N3b3JkIHdpdGggdGhlIGxpbmsgYW55bW9yZS4gSWYgYHBhc3N3b3JkRW5yb2xsVG9rZW5FeHBpcmF0aW9uSW5EYXlzYCBpcyBzZXQsIGl0IHRha2VzIHByZWNlZGVudC5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLmFtYmlndW91c0Vycm9yTWVzc2FnZXMgUmV0dXJuIGFtYmlndW91cyBlcnJvciBtZXNzYWdlcyBmcm9tIGxvZ2luIGZhaWx1cmVzIHRvIHByZXZlbnQgdXNlciBlbnVtZXJhdGlvbi4gRGVmYXVsdHMgdG8gYHRydWVgLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5iY3J5cHRSb3VuZHMgQWxsb3dzIG92ZXJyaWRlIG9mIG51bWJlciBvZiBiY3J5cHQgcm91bmRzIChha2Egd29yayBmYWN0b3IpIHVzZWQgdG8gc3RvcmUgcGFzc3dvcmRzLiBUaGUgZGVmYXVsdCBpcyAxMC5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLmFyZ29uMkVuYWJsZWQgRW5hYmxlIGFyZ29uMiBhbGdvcml0aG0gdXNhZ2UgaW4gcmVwbGFjZW1lbnQgZm9yIGJjcnlwdC4gVGhlIGRlZmF1bHQgaXMgYGZhbHNlYC5cbiAgICogQHBhcmFtIHsnYXJnb24yaWQnIHwgJ2FyZ29uMmknIHwgJ2FyZ29uMmQnfSBvcHRpb25zLmFyZ29uMlR5cGUgQWxsb3dzIG92ZXJyaWRlIG9mIHRoZSBhcmdvbjIgYWxnb3JpdGhtIHR5cGUuIFRoZSBkZWZhdWx0IGlzIGBhcmdvbjJpZGAuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLmFyZ29uMlRpbWVDb3N0IEFsbG93cyBvdmVycmlkZSBvZiBudW1iZXIgb2YgYXJnb24yIGl0ZXJhdGlvbnMgKGFrYSB0aW1lIGNvc3QpIHVzZWQgdG8gc3RvcmUgcGFzc3dvcmRzLiBUaGUgZGVmYXVsdCBpcyAyLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5hcmdvbjJNZW1vcnlDb3N0IEFsbG93cyBvdmVycmlkZSBvZiB0aGUgYW1vdW50IG9mIG1lbW9yeSAoaW4gS2lCKSB1c2VkIGJ5IHRoZSBhcmdvbjIgYWxnb3JpdGhtLiBUaGUgZGVmYXVsdCBpcyAxOTQ1NiAoMTlNQikuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLmFyZ29uMlBhcmFsbGVsaXNtIEFsbG93cyBvdmVycmlkZSBvZiB0aGUgbnVtYmVyIG9mIHRocmVhZHMgdXNlZCBieSB0aGUgYXJnb24yIGFsZ29yaXRobS4gVGhlIGRlZmF1bHQgaXMgMS5cbiAgICogQHBhcmFtIHtNb25nb0ZpZWxkU3BlY2lmaWVyfSBvcHRpb25zLmRlZmF1bHRGaWVsZFNlbGVjdG9yIFRvIGV4Y2x1ZGUgYnkgZGVmYXVsdCBsYXJnZSBjdXN0b20gZmllbGRzIGZyb20gYE1ldGVvci51c2VyKClgIGFuZCBgTWV0ZW9yLmZpbmRVc2VyQnkuLi4oKWAgZnVuY3Rpb25zIHdoZW4gY2FsbGVkIHdpdGhvdXQgYSBmaWVsZCBzZWxlY3RvciwgYW5kIGFsbCBgb25Mb2dpbmAsIGBvbkxvZ2luRmFpbHVyZWAgYW5kIGBvbkxvZ291dGAgY2FsbGJhY2tzLiAgRXhhbXBsZTogYEFjY291bnRzLmNvbmZpZyh7IGRlZmF1bHRGaWVsZFNlbGVjdG9yOiB7IG15QmlnQXJyYXk6IDAgfX0pYC4gQmV3YXJlIHdoZW4gdXNpbmcgdGhpcy4gSWYsIGZvciBpbnN0YW5jZSwgeW91IGRvIG5vdCBpbmNsdWRlIGBlbWFpbGAgd2hlbiBleGNsdWRpbmcgdGhlIGZpZWxkcywgeW91IGNhbiBoYXZlIHByb2JsZW1zIHdpdGggZnVuY3Rpb25zIGxpa2UgYGZvcmdvdFBhc3N3b3JkYCB0aGF0IHdpbGwgYnJlYWsgYmVjYXVzZSB0aGV5IHdvbid0IGhhdmUgdGhlIHJlcXVpcmVkIGRhdGEgYXZhaWxhYmxlLiBJdCdzIHJlY29tbWVuZCB0aGF0IHlvdSBhbHdheXMga2VlcCB0aGUgZmllbGRzIGBfaWRgLCBgdXNlcm5hbWVgLCBhbmQgYGVtYWlsYC5cbiAgICogQHBhcmFtIHtTdHJpbmd8TW9uZ28uQ29sbGVjdGlvbn0gb3B0aW9ucy5jb2xsZWN0aW9uIEEgY29sbGVjdGlvbiBuYW1lIG9yIGEgTW9uZ28uQ29sbGVjdGlvbiBvYmplY3QgdG8gaG9sZCB0aGUgdXNlcnMuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLmxvZ2luVG9rZW5FeHBpcmF0aW9uSG91cnMgV2hlbiB1c2luZyB0aGUgcGFja2FnZSBgYWNjb3VudHMtMmZhYCwgdXNlIHRoaXMgdG8gc2V0IHRoZSBhbW91bnQgb2YgdGltZSBhIHRva2VuIHNlbnQgaXMgdmFsaWQuIEFzIGl0J3MganVzdCBhIG51bWJlciwgeW91IGNhbiB1c2UsIGZvciBleGFtcGxlLCAwLjUgdG8gbWFrZSB0aGUgdG9rZW4gdmFsaWQgZm9yIGp1c3QgaGFsZiBob3VyLiBUaGUgZGVmYXVsdCBpcyAxIGhvdXIuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnRva2VuU2VxdWVuY2VMZW5ndGggV2hlbiB1c2luZyB0aGUgcGFja2FnZSBgYWNjb3VudHMtMmZhYCwgdXNlIHRoaXMgdG8gdGhlIHNpemUgb2YgdGhlIHRva2VuIHNlcXVlbmNlIGdlbmVyYXRlZC4gVGhlIGRlZmF1bHQgaXMgNi5cbiAgICogQHBhcmFtIHsnc2Vzc2lvbicgfCAnbG9jYWwnfSBvcHRpb25zLmNsaWVudFN0b3JhZ2UgQnkgZGVmYXVsdCBsb2dpbiBjcmVkZW50aWFscyBhcmUgc3RvcmVkIGluIGxvY2FsIHN0b3JhZ2UsIHNldHRpbmcgdGhpcyB0byB0cnVlIHdpbGwgc3dpdGNoIHRvIHVzaW5nIHNlc3Npb24gc3RvcmFnZS5cbiAgICogXG4gICAqIEBleGFtcGxlXG4gICAqIC8vIEZvciBVSS1yZWxhdGVkIG9wdGlvbnMgbGlrZSBmb3JiaWRDbGllbnRBY2NvdW50Q3JlYXRpb24sIGNhbGwgQWNjb3VudHMuY29uZmlnIG9uIGJvdGggY2xpZW50IGFuZCBzZXJ2ZXJcbiAgICogLy8gQ3JlYXRlIGEgc2hhcmVkIGNvbmZpZ3VyYXRpb24gZmlsZSAoZS5nLiwgbGliL2FjY291bnRzLWNvbmZpZy5qcyk6XG4gICAqIGltcG9ydCB7IEFjY291bnRzIH0gZnJvbSAnbWV0ZW9yL2FjY291bnRzLWJhc2UnO1xuICAgKiBcbiAgICogQWNjb3VudHMuY29uZmlnKHtcbiAgICogICBmb3JiaWRDbGllbnRBY2NvdW50Q3JlYXRpb246IHRydWUsXG4gICAqICAgc2VuZFZlcmlmaWNhdGlvbkVtYWlsOiB0cnVlLFxuICAgKiB9KTtcbiAgICogXG4gICAqIC8vIFRoZW4gaW1wb3J0IHRoaXMgZmlsZSBpbiBib3RoIGNsaWVudC9tYWluLmpzIGFuZCBzZXJ2ZXIvbWFpbi5qczpcbiAgICogLy8gaW1wb3J0ICcuLi9saWIvYWNjb3VudHMtY29uZmlnLmpzJztcbiAgICovXG4gIGNvbmZpZyhvcHRpb25zKSB7XG4gICAgLy8gV2UgZG9uJ3Qgd2FudCB1c2VycyB0byBhY2NpZGVudGFsbHkgb25seSBjYWxsIEFjY291bnRzLmNvbmZpZyBvbiB0aGVcbiAgICAvLyBjbGllbnQsIHdoZXJlIHNvbWUgb2YgdGhlIG9wdGlvbnMgd2lsbCBoYXZlIHBhcnRpYWwgZWZmZWN0cyAoZWcgcmVtb3ZpbmdcbiAgICAvLyB0aGUgXCJjcmVhdGUgYWNjb3VudFwiIGJ1dHRvbiBmcm9tIGFjY291bnRzLXVpIGlmIGZvcmJpZENsaWVudEFjY291bnRDcmVhdGlvblxuICAgIC8vIGlzIHNldCwgb3IgcmVkaXJlY3RpbmcgR29vZ2xlIGxvZ2luIHRvIGEgc3BlY2lmaWMtZG9tYWluIHBhZ2UpIHdpdGhvdXRcbiAgICAvLyBoYXZpbmcgdGhlaXIgZnVsbCBlZmZlY3RzLlxuICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uYWNjb3VudHNDb25maWdDYWxsZWQgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoIV9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uYWNjb3VudHNDb25maWdDYWxsZWQpIHtcbiAgICAgIC8vIFhYWCB3b3VsZCBiZSBuaWNlIHRvIFwiY3Jhc2hcIiB0aGUgY2xpZW50IGFuZCByZXBsYWNlIHRoZSBVSSB3aXRoIGFuIGVycm9yXG4gICAgICAvLyBtZXNzYWdlLCBidXQgdGhlcmUncyBubyB0cml2aWFsIHdheSB0byBkbyB0aGlzLlxuICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICAgICAgJ0FjY291bnRzLmNvbmZpZyB3YXMgY2FsbGVkIG9uIHRoZSBjbGllbnQgYnV0IG5vdCBvbiB0aGUgJyArXG4gICAgICAgICAgJ3NlcnZlcjsgc29tZSBjb25maWd1cmF0aW9uIG9wdGlvbnMgbWF5IG5vdCB0YWtlIGVmZmVjdC4nXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFdlIG5lZWQgdG8gdmFsaWRhdGUgdGhlIG9hdXRoU2VjcmV0S2V5IG9wdGlvbiBhdCB0aGUgdGltZVxuICAgIC8vIEFjY291bnRzLmNvbmZpZyBpcyBjYWxsZWQuIFdlIGFsc28gZGVsaWJlcmF0ZWx5IGRvbid0IHN0b3JlIHRoZVxuICAgIC8vIG9hdXRoU2VjcmV0S2V5IGluIEFjY291bnRzLl9vcHRpb25zLlxuICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob3B0aW9ucywgJ29hdXRoU2VjcmV0S2V5JykpIHtcbiAgICAgIGlmIChNZXRlb3IuaXNDbGllbnQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdUaGUgb2F1dGhTZWNyZXRLZXkgb3B0aW9uIG1heSBvbmx5IGJlIHNwZWNpZmllZCBvbiB0aGUgc2VydmVyJ1xuICAgICAgICApO1xuICAgICAgfVxuICAgICAgaWYgKCFQYWNrYWdlWydvYXV0aC1lbmNyeXB0aW9uJ10pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdUaGUgb2F1dGgtZW5jcnlwdGlvbiBwYWNrYWdlIG11c3QgYmUgbG9hZGVkIHRvIHNldCBvYXV0aFNlY3JldEtleSdcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIFBhY2thZ2VbJ29hdXRoLWVuY3J5cHRpb24nXS5PQXV0aEVuY3J5cHRpb24ubG9hZEtleShcbiAgICAgICAgb3B0aW9ucy5vYXV0aFNlY3JldEtleVxuICAgICAgKTtcbiAgICAgIG9wdGlvbnMgPSB7IC4uLm9wdGlvbnMgfTtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLm9hdXRoU2VjcmV0S2V5O1xuICAgIH1cblxuICAgIC8vIFZhbGlkYXRlIGNvbmZpZyBvcHRpb25zIGtleXNcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhvcHRpb25zKSkge1xuICAgICAgaWYgKCFWQUxJRF9DT05GSUdfS0VZUy5pbmNsdWRlcyhrZXkpKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYEFjY291bnRzLmNvbmZpZzogSW52YWxpZCBrZXk6ICR7a2V5fWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNldCB2YWx1ZXMgaW4gQWNjb3VudHMuX29wdGlvbnNcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBWQUxJRF9DT05GSUdfS0VZUykge1xuICAgICAgaWYgKGtleSBpbiBvcHRpb25zKSB7XG4gICAgICAgIGlmIChrZXkgaW4gdGhpcy5fb3B0aW9ucykge1xuICAgICAgICAgIGlmIChrZXkgIT09ICdjb2xsZWN0aW9uJyAmJiAoTWV0ZW9yLmlzVGVzdCAmJiBrZXkgIT09ICdjbGllbnRTdG9yYWdlJykpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoYENhbid0IHNldCBcXGAke2tleX1cXGAgbW9yZSB0aGFuIG9uY2VgKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fb3B0aW9uc1trZXldID0gb3B0aW9uc1trZXldO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmNvbGxlY3Rpb24gJiYgb3B0aW9ucy5jb2xsZWN0aW9uICE9PSB0aGlzLnVzZXJzLl9uYW1lICYmIG9wdGlvbnMuY29sbGVjdGlvbiAhPT0gdGhpcy51c2Vycykge1xuICAgICAgdGhpcy51c2VycyA9IHRoaXMuX2luaXRpYWxpemVDb2xsZWN0aW9uKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZWdpc3RlciBhIGNhbGxiYWNrIHRvIGJlIGNhbGxlZCBhZnRlciBhIGxvZ2luIGF0dGVtcHQgc3VjY2VlZHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiBsb2dpbiBpcyBzdWNjZXNzZnVsLlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIFRoZSBjYWxsYmFjayByZWNlaXZlcyBhIHNpbmdsZSBvYmplY3QgdGhhdFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIGhvbGRzIGxvZ2luIGRldGFpbHMuIFRoaXMgb2JqZWN0IGNvbnRhaW5zIHRoZSBsb2dpblxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCB0eXBlIChwYXNzd29yZCwgcmVzdW1lLCBldGMuKSBvbiBib3RoIHRoZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIGNsaWVudCBhbmQgc2VydmVyLiBgb25Mb2dpbmAgY2FsbGJhY2tzIHJlZ2lzdGVyZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICBvbiB0aGUgc2VydmVyIGFsc28gcmVjZWl2ZSBleHRyYSBkYXRhLCBzdWNoXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgYXMgdXNlciBkZXRhaWxzLCBjb25uZWN0aW9uIGluZm9ybWF0aW9uLCBldGMuXG4gICAqL1xuICBvbkxvZ2luKGZ1bmMpIHtcbiAgICBsZXQgcmV0ID0gdGhpcy5fb25Mb2dpbkhvb2sucmVnaXN0ZXIoZnVuYyk7XG4gICAgLy8gY2FsbCB0aGUganVzdCByZWdpc3RlcmVkIGNhbGxiYWNrIGlmIGFscmVhZHkgbG9nZ2VkIGluXG4gICAgdGhpcy5fc3RhcnR1cENhbGxiYWNrKHJldC5jYWxsYmFjayk7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZWdpc3RlciBhIGNhbGxiYWNrIHRvIGJlIGNhbGxlZCBhZnRlciBhIGxvZ2luIGF0dGVtcHQgZmFpbHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBjYWxsYmFjayB0byBiZSBjYWxsZWQgYWZ0ZXIgdGhlIGxvZ2luIGhhcyBmYWlsZWQuXG4gICAqL1xuICBvbkxvZ2luRmFpbHVyZShmdW5jKSB7XG4gICAgcmV0dXJuIHRoaXMuX29uTG9naW5GYWlsdXJlSG9vay5yZWdpc3RlcihmdW5jKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZWdpc3RlciBhIGNhbGxiYWNrIHRvIGJlIGNhbGxlZCBhZnRlciBhIGxvZ291dCBhdHRlbXB0IHN1Y2NlZWRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdoZW4gbG9nb3V0IGlzIHN1Y2Nlc3NmdWwuXG4gICAqL1xuICBvbkxvZ291dChmdW5jKSB7XG4gICAgcmV0dXJuIHRoaXMuX29uTG9nb3V0SG9vay5yZWdpc3RlcihmdW5jKTtcbiAgfVxuXG4gIF9pbml0Q29ubmVjdGlvbihvcHRpb25zKSB7XG4gICAgaWYgKCFNZXRlb3IuaXNDbGllbnQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUaGUgY29ubmVjdGlvbiB1c2VkIGJ5IHRoZSBBY2NvdW50cyBzeXN0ZW0uIFRoaXMgaXMgdGhlIGNvbm5lY3Rpb25cbiAgICAvLyB0aGF0IHdpbGwgZ2V0IGxvZ2dlZCBpbiBieSBNZXRlb3IubG9naW4oKSwgYW5kIHRoaXMgaXMgdGhlXG4gICAgLy8gY29ubmVjdGlvbiB3aG9zZSBsb2dpbiBzdGF0ZSB3aWxsIGJlIHJlZmxlY3RlZCBieSBNZXRlb3IudXNlcklkKCkuXG4gICAgLy9cbiAgICAvLyBJdCB3b3VsZCBiZSBtdWNoIHByZWZlcmFibGUgZm9yIHRoaXMgdG8gYmUgaW4gYWNjb3VudHNfY2xpZW50LmpzLFxuICAgIC8vIGJ1dCBpdCBoYXMgdG8gYmUgaGVyZSBiZWNhdXNlIGl0J3MgbmVlZGVkIHRvIGNyZWF0ZSB0aGVcbiAgICAvLyBNZXRlb3IudXNlcnMgY29sbGVjdGlvbi5cbiAgICBpZiAob3B0aW9ucy5jb25uZWN0aW9uKSB7XG4gICAgICB0aGlzLmNvbm5lY3Rpb24gPSBvcHRpb25zLmNvbm5lY3Rpb247XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmRkcFVybCkge1xuICAgICAgdGhpcy5jb25uZWN0aW9uID0gRERQLmNvbm5lY3Qob3B0aW9ucy5kZHBVcmwpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICB0eXBlb2YgX19tZXRlb3JfcnVudGltZV9jb25maWdfXyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uQUNDT1VOVFNfQ09OTkVDVElPTl9VUkxcbiAgICApIHtcbiAgICAgIC8vIFRlbXBvcmFyeSwgaW50ZXJuYWwgaG9vayB0byBhbGxvdyB0aGUgc2VydmVyIHRvIHBvaW50IHRoZSBjbGllbnRcbiAgICAgIC8vIHRvIGEgZGlmZmVyZW50IGF1dGhlbnRpY2F0aW9uIHNlcnZlci4gVGhpcyBpcyBmb3IgYSB2ZXJ5XG4gICAgICAvLyBwYXJ0aWN1bGFyIHVzZSBjYXNlIHRoYXQgY29tZXMgdXAgd2hlbiBpbXBsZW1lbnRpbmcgYSBvYXV0aFxuICAgICAgLy8gc2VydmVyLiBVbnN1cHBvcnRlZCBhbmQgbWF5IGdvIGF3YXkgYXQgYW55IHBvaW50IGluIHRpbWUuXG4gICAgICAvL1xuICAgICAgLy8gV2Ugd2lsbCBldmVudHVhbGx5IHByb3ZpZGUgYSBnZW5lcmFsIHdheSB0byB1c2UgYWNjb3VudC1iYXNlXG4gICAgICAvLyBhZ2FpbnN0IGFueSBERFAgY29ubmVjdGlvbiwgbm90IGp1c3Qgb25lIHNwZWNpYWwgb25lLlxuICAgICAgdGhpcy5jb25uZWN0aW9uID0gRERQLmNvbm5lY3QoXG4gICAgICAgIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uQUNDT1VOVFNfQ09OTkVDVElPTl9VUkxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY29ubmVjdGlvbiA9IE1ldGVvci5jb25uZWN0aW9uO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRUb2tlbkxpZmV0aW1lTXMoKSB7XG4gICAgLy8gV2hlbiBsb2dpbkV4cGlyYXRpb25JbkRheXMgaXMgc2V0IHRvIG51bGwsIHdlJ2xsIHVzZSBhIHJlYWxseSBoaWdoXG4gICAgLy8gbnVtYmVyIG9mIGRheXMgKExPR0lOX1VORVhQSVJBQkxFX1RPS0VOX0RBWVMpIHRvIHNpbXVsYXRlIGFuXG4gICAgLy8gdW5leHBpcmluZyB0b2tlbi5cbiAgICBjb25zdCBsb2dpbkV4cGlyYXRpb25JbkRheXMgPVxuICAgICAgdGhpcy5fb3B0aW9ucy5sb2dpbkV4cGlyYXRpb25JbkRheXMgPT09IG51bGxcbiAgICAgICAgPyBMT0dJTl9VTkVYUElSSU5HX1RPS0VOX0RBWVNcbiAgICAgICAgOiB0aGlzLl9vcHRpb25zLmxvZ2luRXhwaXJhdGlvbkluRGF5cztcbiAgICByZXR1cm4gKFxuICAgICAgdGhpcy5fb3B0aW9ucy5sb2dpbkV4cGlyYXRpb24gfHxcbiAgICAgIChsb2dpbkV4cGlyYXRpb25JbkRheXMgfHwgREVGQVVMVF9MT0dJTl9FWFBJUkFUSU9OX0RBWVMpICogODY0MDAwMDBcbiAgICApO1xuICB9XG5cbiAgX2dldFBhc3N3b3JkUmVzZXRUb2tlbkxpZmV0aW1lTXMoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX29wdGlvbnMucGFzc3dvcmRSZXNldFRva2VuRXhwaXJhdGlvbiB8fFxuICAgICAgKHRoaXMuX29wdGlvbnMucGFzc3dvcmRSZXNldFRva2VuRXhwaXJhdGlvbkluRGF5cyB8fFxuICAgICAgICBERUZBVUxUX1BBU1NXT1JEX1JFU0VUX1RPS0VOX0VYUElSQVRJT05fREFZUykgKiA4NjQwMDAwMFxuICAgICk7XG4gIH1cblxuICBfZ2V0UGFzc3dvcmRFbnJvbGxUb2tlbkxpZmV0aW1lTXMoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIHRoaXMuX29wdGlvbnMucGFzc3dvcmRFbnJvbGxUb2tlbkV4cGlyYXRpb24gfHxcbiAgICAgICh0aGlzLl9vcHRpb25zLnBhc3N3b3JkRW5yb2xsVG9rZW5FeHBpcmF0aW9uSW5EYXlzIHx8XG4gICAgICAgIERFRkFVTFRfUEFTU1dPUkRfRU5ST0xMX1RPS0VOX0VYUElSQVRJT05fREFZUykgKiA4NjQwMDAwMFxuICAgICk7XG4gIH1cblxuICBfdG9rZW5FeHBpcmF0aW9uKHdoZW4pIHtcbiAgICAvLyBXZSBwYXNzIHdoZW4gdGhyb3VnaCB0aGUgRGF0ZSBjb25zdHJ1Y3RvciBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHk7XG4gICAgLy8gYHdoZW5gIHVzZWQgdG8gYmUgYSBudW1iZXIuXG4gICAgcmV0dXJuIG5ldyBEYXRlKG5ldyBEYXRlKHdoZW4pLmdldFRpbWUoKSArIHRoaXMuX2dldFRva2VuTGlmZXRpbWVNcygpKTtcbiAgfVxuXG4gIF90b2tlbkV4cGlyZXNTb29uKHdoZW4pIHtcbiAgICBsZXQgbWluTGlmZXRpbWVNcyA9IDAuMSAqIHRoaXMuX2dldFRva2VuTGlmZXRpbWVNcygpO1xuICAgIGNvbnN0IG1pbkxpZmV0aW1lQ2FwTXMgPSBNSU5fVE9LRU5fTElGRVRJTUVfQ0FQX1NFQ1MgKiAxMDAwO1xuICAgIGlmIChtaW5MaWZldGltZU1zID4gbWluTGlmZXRpbWVDYXBNcykge1xuICAgICAgbWluTGlmZXRpbWVNcyA9IG1pbkxpZmV0aW1lQ2FwTXM7XG4gICAgfVxuICAgIHJldHVybiBuZXcgRGF0ZSgpID4gbmV3IERhdGUod2hlbikgLSBtaW5MaWZldGltZU1zO1xuICB9XG5cbiAgLy8gTm8tb3Agb24gdGhlIHNlcnZlciwgb3ZlcnJpZGRlbiBvbiB0aGUgY2xpZW50LlxuICBfc3RhcnR1cENhbGxiYWNrKGNhbGxiYWNrKSB7fVxufVxuXG4vLyBOb3RlIHRoYXQgQWNjb3VudHMgaXMgZGVmaW5lZCBzZXBhcmF0ZWx5IGluIGFjY291bnRzX2NsaWVudC5qcyBhbmRcbi8vIGFjY291bnRzX3NlcnZlci5qcy5cblxuLyoqXG4gKiBAc3VtbWFyeSBHZXQgdGhlIGN1cnJlbnQgdXNlciBpZCwgb3IgYG51bGxgIGlmIG5vIHVzZXIgaXMgbG9nZ2VkIGluLiBBIHJlYWN0aXZlIGRhdGEgc291cmNlLlxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gKi9cbk1ldGVvci51c2VySWQgPSAoKSA9PiBBY2NvdW50cy51c2VySWQoKTtcblxuLyoqXG4gKiBAc3VtbWFyeSBHZXQgdGhlIGN1cnJlbnQgdXNlciByZWNvcmQsIG9yIGBudWxsYCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbi4gQSByZWFjdGl2ZSBkYXRhIHNvdXJjZS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHtNb25nb0ZpZWxkU3BlY2lmaWVyfSBvcHRpb25zLmZpZWxkcyBEaWN0aW9uYXJ5IG9mIGZpZWxkcyB0byByZXR1cm4gb3IgZXhjbHVkZS5cbiAqL1xuTWV0ZW9yLnVzZXIgPSBvcHRpb25zID0+IEFjY291bnRzLnVzZXIob3B0aW9ucyk7XG5cbi8qKlxuICogQHN1bW1hcnkgR2V0IHRoZSBjdXJyZW50IHVzZXIgcmVjb3JkLCBvciBgbnVsbGAgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4uIEEgcmVhY3RpdmUgZGF0YSBzb3VyY2UuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gb3B0aW9ucy5maWVsZHMgRGljdGlvbmFyeSBvZiBmaWVsZHMgdG8gcmV0dXJuIG9yIGV4Y2x1ZGUuXG4gKi9cbk1ldGVvci51c2VyQXN5bmMgPSBvcHRpb25zID0+IEFjY291bnRzLnVzZXJBc3luYyhvcHRpb25zKTtcblxuLy8gaG93IGxvbmcgKGluIGRheXMpIHVudGlsIGEgbG9naW4gdG9rZW4gZXhwaXJlc1xuY29uc3QgREVGQVVMVF9MT0dJTl9FWFBJUkFUSU9OX0RBWVMgPSA5MDtcbi8vIGhvdyBsb25nIChpbiBkYXlzKSB1bnRpbCByZXNldCBwYXNzd29yZCB0b2tlbiBleHBpcmVzXG5jb25zdCBERUZBVUxUX1BBU1NXT1JEX1JFU0VUX1RPS0VOX0VYUElSQVRJT05fREFZUyA9IDM7XG4vLyBob3cgbG9uZyAoaW4gZGF5cykgdW50aWwgZW5yb2wgcGFzc3dvcmQgdG9rZW4gZXhwaXJlc1xuY29uc3QgREVGQVVMVF9QQVNTV09SRF9FTlJPTExfVE9LRU5fRVhQSVJBVElPTl9EQVlTID0gMzA7XG4vLyBDbGllbnRzIGRvbid0IHRyeSB0byBhdXRvLWxvZ2luIHdpdGggYSB0b2tlbiB0aGF0IGlzIGdvaW5nIHRvIGV4cGlyZSB3aXRoaW5cbi8vIC4xICogREVGQVVMVF9MT0dJTl9FWFBJUkFUSU9OX0RBWVMsIGNhcHBlZCBhdCBNSU5fVE9LRU5fTElGRVRJTUVfQ0FQX1NFQ1MuXG4vLyBUcmllcyB0byBhdm9pZCBhYnJ1cHQgZGlzY29ubmVjdHMgZnJvbSBleHBpcmluZyB0b2tlbnMuXG5jb25zdCBNSU5fVE9LRU5fTElGRVRJTUVfQ0FQX1NFQ1MgPSAzNjAwOyAvLyBvbmUgaG91clxuLy8gaG93IG9mdGVuIChpbiBtaWxsaXNlY29uZHMpIHdlIGNoZWNrIGZvciBleHBpcmVkIHRva2Vuc1xuZXhwb3J0IGNvbnN0IEVYUElSRV9UT0tFTlNfSU5URVJWQUxfTVMgPSA2MDAgKiAxMDAwOyAvLyAxMCBtaW51dGVzXG4vLyBBIGxhcmdlIG51bWJlciBvZiBleHBpcmF0aW9uIGRheXMgKGFwcHJveGltYXRlbHkgMTAwIHllYXJzIHdvcnRoKSB0aGF0IGlzXG4vLyB1c2VkIHdoZW4gY3JlYXRpbmcgdW5leHBpcmluZyB0b2tlbnMuXG5jb25zdCBMT0dJTl9VTkVYUElSSU5HX1RPS0VOX0RBWVMgPSAzNjUgKiAxMDA7XG4iLCJpbXBvcnQgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJ1xuaW1wb3J0IHsgY2hlY2ssIE1hdGNoIH0gZnJvbSAnbWV0ZW9yL2NoZWNrJztcbmltcG9ydCB7XG4gIEFjY291bnRzQ29tbW9uLFxuICBFWFBJUkVfVE9LRU5TX0lOVEVSVkFMX01TLFxufSBmcm9tICcuL2FjY291bnRzX2NvbW1vbi5qcyc7XG5pbXBvcnQgeyBVUkwgfSBmcm9tICdtZXRlb3IvdXJsJztcblxuY29uc3QgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RvciBmb3IgdGhlIGBBY2NvdW50c2AgbmFtZXNwYWNlIG9uIHRoZSBzZXJ2ZXIuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAY2xhc3MgQWNjb3VudHNTZXJ2ZXJcbiAqIEBleHRlbmRzIEFjY291bnRzQ29tbW9uXG4gKiBAaW5zdGFuY2VuYW1lIGFjY291bnRzU2VydmVyXG4gKiBAcGFyYW0ge09iamVjdH0gc2VydmVyIEEgc2VydmVyIG9iamVjdCBzdWNoIGFzIGBNZXRlb3Iuc2VydmVyYC5cbiAqL1xuZXhwb3J0IGNsYXNzIEFjY291bnRzU2VydmVyIGV4dGVuZHMgQWNjb3VudHNDb21tb24ge1xuICAvLyBOb3RlIHRoYXQgdGhpcyBjb25zdHJ1Y3RvciBpcyBsZXNzIGxpa2VseSB0byBiZSBpbnN0YW50aWF0ZWQgbXVsdGlwbGVcbiAgLy8gdGltZXMgdGhhbiB0aGUgYEFjY291bnRzQ2xpZW50YCBjb25zdHJ1Y3RvciwgYmVjYXVzZSBhIHNpbmdsZSBzZXJ2ZXJcbiAgLy8gY2FuIHByb3ZpZGUgb25seSBvbmUgc2V0IG9mIG1ldGhvZHMuXG4gIGNvbnN0cnVjdG9yKHNlcnZlciwgb3B0aW9ucykge1xuICAgIHN1cGVyKG9wdGlvbnMgfHwge30pO1xuXG4gICAgdGhpcy5fc2VydmVyID0gc2VydmVyIHx8IE1ldGVvci5zZXJ2ZXI7XG4gICAgLy8gU2V0IHVwIHRoZSBzZXJ2ZXIncyBtZXRob2RzLCBhcyBpZiBieSBjYWxsaW5nIE1ldGVvci5tZXRob2RzLlxuICAgIHRoaXMuX2luaXRTZXJ2ZXJNZXRob2RzKCk7XG5cbiAgICB0aGlzLl9pbml0QWNjb3VudERhdGFIb29rcygpO1xuXG4gICAgLy8gSWYgYXV0b3B1Ymxpc2ggaXMgb24sIHB1Ymxpc2ggdGhlc2UgdXNlciBmaWVsZHMuIExvZ2luIHNlcnZpY2VcbiAgICAvLyBwYWNrYWdlcyAoZWcgYWNjb3VudHMtZ29vZ2xlKSBhZGQgdG8gdGhlc2UgYnkgY2FsbGluZ1xuICAgIC8vIGFkZEF1dG9wdWJsaXNoRmllbGRzLiAgTm90YWJseSwgdGhpcyBpc24ndCBpbXBsZW1lbnRlZCB3aXRoIG11bHRpcGxlXG4gICAgLy8gcHVibGlzaGVzIHNpbmNlIEREUCBvbmx5IG1lcmdlcyBvbmx5IGFjcm9zcyB0b3AtbGV2ZWwgZmllbGRzLCBub3RcbiAgICAvLyBzdWJmaWVsZHMgKHN1Y2ggYXMgJ3NlcnZpY2VzLmZhY2Vib29rLmFjY2Vzc1Rva2VuJylcbiAgICB0aGlzLl9hdXRvcHVibGlzaEZpZWxkcyA9IHtcbiAgICAgIGxvZ2dlZEluVXNlcjogWydwcm9maWxlJywgJ3VzZXJuYW1lJywgJ2VtYWlscyddLFxuICAgICAgb3RoZXJVc2VyczogWydwcm9maWxlJywgJ3VzZXJuYW1lJ11cbiAgICB9O1xuXG4gICAgLy8gdXNlIG9iamVjdCB0byBrZWVwIHRoZSByZWZlcmVuY2Ugd2hlbiB1c2VkIGluIGZ1bmN0aW9uc1xuICAgIC8vIHdoZXJlIF9kZWZhdWx0UHVibGlzaEZpZWxkcyBpcyBkZXN0cnVjdHVyZWQgaW50byBsZXhpY2FsIHNjb3BlXG4gICAgLy8gZm9yIHB1Ymxpc2ggY2FsbGJhY2tzIHRoYXQgbmVlZCBgdGhpc2BcbiAgICB0aGlzLl9kZWZhdWx0UHVibGlzaEZpZWxkcyA9IHtcbiAgICAgIHByb2plY3Rpb246IHtcbiAgICAgICAgcHJvZmlsZTogMSxcbiAgICAgICAgdXNlcm5hbWU6IDEsXG4gICAgICAgIGVtYWlsczogMSxcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy5faW5pdFNlcnZlclB1YmxpY2F0aW9ucygpO1xuXG4gICAgLy8gY29ubmVjdGlvbklkIC0+IHtjb25uZWN0aW9uLCBsb2dpblRva2VufVxuICAgIHRoaXMuX2FjY291bnREYXRhID0ge307XG5cbiAgICAvLyBjb25uZWN0aW9uIGlkIC0+IG9ic2VydmUgaGFuZGxlIGZvciB0aGUgbG9naW4gdG9rZW4gdGhhdCB0aGlzIGNvbm5lY3Rpb24gaXNcbiAgICAvLyBjdXJyZW50bHkgYXNzb2NpYXRlZCB3aXRoLCBvciBhIG51bWJlci4gVGhlIG51bWJlciBpbmRpY2F0ZXMgdGhhdCB3ZSBhcmUgaW5cbiAgICAvLyB0aGUgcHJvY2VzcyBvZiBzZXR0aW5nIHVwIHRoZSBvYnNlcnZlICh1c2luZyBhIG51bWJlciBpbnN0ZWFkIG9mIGEgc2luZ2xlXG4gICAgLy8gc2VudGluZWwgYWxsb3dzIG11bHRpcGxlIGF0dGVtcHRzIHRvIHNldCB1cCB0aGUgb2JzZXJ2ZSB0byBpZGVudGlmeSB3aGljaFxuICAgIC8vIG9uZSB3YXMgdGhlaXJzKS5cbiAgICB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9ucyA9IHt9O1xuICAgIHRoaXMuX25leHRVc2VyT2JzZXJ2ZU51bWJlciA9IDE7ICAvLyBmb3IgdGhlIG51bWJlciBkZXNjcmliZWQgYWJvdmUuXG5cbiAgICAvLyBsaXN0IG9mIGFsbCByZWdpc3RlcmVkIGhhbmRsZXJzLlxuICAgIHRoaXMuX2xvZ2luSGFuZGxlcnMgPSBbXTtcbiAgICBzZXR1cERlZmF1bHRMb2dpbkhhbmRsZXJzKHRoaXMpO1xuICAgIHNldEV4cGlyZVRva2Vuc0ludGVydmFsKHRoaXMpO1xuXG4gICAgdGhpcy5fdmFsaWRhdGVMb2dpbkhvb2sgPSBuZXcgSG9vayh7IGJpbmRFbnZpcm9ubWVudDogZmFsc2UgfSk7XG4gICAgdGhpcy5fdmFsaWRhdGVOZXdVc2VySG9va3MgPSBbXG4gICAgICBkZWZhdWx0VmFsaWRhdGVOZXdVc2VySG9vay5iaW5kKHRoaXMpXG4gICAgXTtcblxuICAgIHRoaXMuX2RlbGV0ZVNhdmVkVG9rZW5zRm9yQWxsVXNlcnNPblN0YXJ0dXAoKTtcblxuICAgIHRoaXMuX3NraXBDYXNlSW5zZW5zaXRpdmVDaGVja3NGb3JUZXN0ID0ge307XG5cbiAgICAvLyBIZWxwZXIgZnVuY3Rpb24gdG8gcmVzb2x2ZSBwcm9taXNlcyBpZiBuZWVkZWRcbiAgICB0aGlzLl9yZXNvbHZlUHJvbWlzZSA9IGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgcmV0dXJuIE1ldGVvci5faXNQcm9taXNlKHZhbHVlKSA/IGF3YWl0IHZhbHVlIDogdmFsdWU7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IE9iamVjdCBjb250YWluaW5nIGZ1bmN0aW9ucyB0aGF0IGdlbmVyYXRlIFVSTHMgZm9yIGFjY291bnQtcmVsYXRlZCBlbWFpbHMuXG4gICAgICogT3ZlcnJpZGUgdGhlc2UgdG8gY3VzdG9taXplIFVSTHMgaW4gZW1haWxzIHNlbnQgYnlcbiAgICAgKiBbYEFjY291bnRzLnNlbmRSZXNldFBhc3N3b3JkRW1haWxgXSgjQWNjb3VudHMtc2VuZFJlc2V0UGFzc3dvcmRFbWFpbCksXG4gICAgICogW2BBY2NvdW50cy5zZW5kRW5yb2xsbWVudEVtYWlsYF0oI0FjY291bnRzLXNlbmRFbnJvbGxtZW50RW1haWwpLCBhbmRcbiAgICAgKiBbYEFjY291bnRzLnNlbmRWZXJpZmljYXRpb25FbWFpbGBdKCNBY2NvdW50cy1zZW5kVmVyaWZpY2F0aW9uRW1haWwpLlxuICAgICAqXG4gICAgICogQnkgZGVmYXVsdCwgVVJMcyB1c2UgaGFzaCBmcmFnbWVudHMgKGUuZy4sIGAjL3Jlc2V0LXBhc3N3b3JkLzp0b2tlbmApIGZvciBzZWN1cml0eTpcbiAgICAgKiBoYXNoIGZyYWdtZW50cyBhcmUgbm90IHNlbnQgdG8gdGhlIHNlcnZlciBpbiBIVFRQIHJlcXVlc3RzLCBwcmV2ZW50aW5nIHRva2VucyBmcm9tXG4gICAgICogYXBwZWFyaW5nIGluIHNlcnZlciBsb2dzIG9yIHJlZmVycmVyIGhlYWRlcnMuXG4gICAgICogQGxvY3VzIFNlcnZlclxuICAgICAqIEBtZW1iZXJvZiBBY2NvdW50c1xuICAgICAqIEBuYW1lIHVybHNcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqIEBwcm9wZXJ0eSB7RnVuY3Rpb259IHJlc2V0UGFzc3dvcmQgLSBgKHRva2VuLCBleHRyYVBhcmFtcykgPT4gc3RyaW5nYCAtIEdlbmVyYXRlcyBwYXNzd29yZCByZXNldCBVUkwuXG4gICAgICogQHByb3BlcnR5IHtGdW5jdGlvbn0gdmVyaWZ5RW1haWwgLSBgKHRva2VuLCBleHRyYVBhcmFtcykgPT4gc3RyaW5nYCAtIEdlbmVyYXRlcyBlbWFpbCB2ZXJpZmljYXRpb24gVVJMLlxuICAgICAqIEBwcm9wZXJ0eSB7RnVuY3Rpb259IGVucm9sbEFjY291bnQgLSBgKHRva2VuLCBleHRyYVBhcmFtcykgPT4gc3RyaW5nYCAtIEdlbmVyYXRlcyBhY2NvdW50IGVucm9sbG1lbnQgVVJMLlxuICAgICAqIEBwcm9wZXJ0eSB7RnVuY3Rpb259IGxvZ2luVG9rZW4gLSBgKHNlbGVjdG9yLCB0b2tlbiwgZXh0cmFQYXJhbXMpID0+IHN0cmluZ2AgLSBHZW5lcmF0ZXMgbG9naW4gdG9rZW4gVVJMLlxuICAgICAqL1xuICAgIHRoaXMudXJscyA9IHtcbiAgICAgIHJlc2V0UGFzc3dvcmQ6ICh0b2tlbiwgZXh0cmFQYXJhbXMpID0+IHRoaXMuYnVpbGRFbWFpbFVybChgIy9yZXNldC1wYXNzd29yZC8ke3Rva2VufWAsIGV4dHJhUGFyYW1zKSxcbiAgICAgIHZlcmlmeUVtYWlsOiAodG9rZW4sIGV4dHJhUGFyYW1zKSA9PiB0aGlzLmJ1aWxkRW1haWxVcmwoYCMvdmVyaWZ5LWVtYWlsLyR7dG9rZW59YCwgZXh0cmFQYXJhbXMpLFxuICAgICAgbG9naW5Ub2tlbjogKHNlbGVjdG9yLCB0b2tlbiwgZXh0cmFQYXJhbXMpID0+XG4gICAgICAgIHRoaXMuYnVpbGRFbWFpbFVybChgLz9sb2dpblRva2VuPSR7dG9rZW59JnNlbGVjdG9yPSR7c2VsZWN0b3J9YCwgZXh0cmFQYXJhbXMpLFxuICAgICAgZW5yb2xsQWNjb3VudDogKHRva2VuLCBleHRyYVBhcmFtcykgPT4gdGhpcy5idWlsZEVtYWlsVXJsKGAjL2Vucm9sbC1hY2NvdW50LyR7dG9rZW59YCwgZXh0cmFQYXJhbXMpLFxuICAgIH07XG5cbiAgICB0aGlzLmFkZERlZmF1bHRSYXRlTGltaXQoKTtcblxuICAgIC8qKlxuICAgICAqIEBzdW1tYXJ5IEJ1aWxkcyBhIFVSTCBmb3IgYWNjb3VudC1yZWxhdGVkIGVtYWlscyBieSBjb21iaW5pbmcgdGhlIGFwcCdzXG4gICAgICogcm9vdCBVUkwgd2l0aCBhIHBhdGggYW5kIG9wdGlvbmFsIGV4dHJhIHBhcmFtZXRlcnMuXG4gICAgICogQGxvY3VzIFNlcnZlclxuICAgICAqIEBtZW1iZXJvZiBBY2NvdW50c1xuICAgICAqIEBuYW1lIGJ1aWxkRW1haWxVcmxcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0aCAtIFRoZSBwYXRoIHRvIGFwcGVuZCB0byB0aGUgcm9vdCBVUkwgKGUuZy4sIGAjL3Jlc2V0LXBhc3N3b3JkL1RPS0VOYCkuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtleHRyYVBhcmFtcz17fV0gLSBBZGRpdGlvbmFsIHF1ZXJ5IHBhcmFtZXRlcnMgdG8gaW5jbHVkZSBpbiB0aGUgVVJMLlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBjb21wbGV0ZSBVUkwuXG4gICAgICovXG4gICAgdGhpcy5idWlsZEVtYWlsVXJsID0gKHBhdGgsIGV4dHJhUGFyYW1zID0ge30pID0+IHtcbiAgICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoTWV0ZW9yLmFic29sdXRlVXJsKHBhdGgpKTtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IE9iamVjdC5lbnRyaWVzKGV4dHJhUGFyYW1zKTtcbiAgICAgIGlmIChwYXJhbXMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBBZGQgYWRkaXRpb25hbCBwYXJhbWV0ZXJzIHRvIHRoZSB1cmxcbiAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgcGFyYW1zKSB7XG4gICAgICAgICAgdXJsLnNlYXJjaFBhcmFtcy5hcHBlbmQoa2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB1cmwudG9TdHJpbmcoKTtcbiAgICB9O1xuICB9XG5cbiAgLy8vXG4gIC8vLyBDVVJSRU5UIFVTRVJcbiAgLy8vXG5cbiAgLy8gQG92ZXJyaWRlIG9mIFwiYWJzdHJhY3RcIiBub24taW1wbGVtZW50YXRpb24gaW4gYWNjb3VudHNfY29tbW9uLmpzXG4gIHVzZXJJZCgpIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIG9ubHkgd29ya3MgaWYgY2FsbGVkIGluc2lkZSBhIG1ldGhvZCBvciBhIHB1YmljYXRpb24uXG4gICAgLy8gVXNpbmcgYW55IG9mIHRoZSBpbmZvcm1hdGlvbiBmcm9tIE1ldGVvci51c2VyKCkgaW4gYSBtZXRob2Qgb3JcbiAgICAvLyBwdWJsaXNoIGZ1bmN0aW9uIHdpbGwgYWx3YXlzIHVzZSB0aGUgdmFsdWUgZnJvbSB3aGVuIHRoZSBmdW5jdGlvbiBmaXJzdFxuICAgIC8vIHJ1bnMuIFRoaXMgaXMgbGlrZWx5IG5vdCB3aGF0IHRoZSB1c2VyIGV4cGVjdHMuIFRoZSB3YXkgdG8gbWFrZSB0aGlzIHdvcmtcbiAgICAvLyBpbiBhIG1ldGhvZCBvciBwdWJsaXNoIGZ1bmN0aW9uIGlzIHRvIGRvIE1ldGVvci5maW5kKHRoaXMudXNlcklkKS5vYnNlcnZlXG4gICAgLy8gYW5kIHJlY29tcHV0ZSB3aGVuIHRoZSB1c2VyIHJlY29yZCBjaGFuZ2VzLlxuICAgIGNvbnN0IGN1cnJlbnRJbnZvY2F0aW9uID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKSB8fCBERFAuX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24uZ2V0KCk7XG4gICAgaWYgKCFjdXJyZW50SW52b2NhdGlvbilcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk1ldGVvci51c2VySWQgY2FuIG9ubHkgYmUgaW52b2tlZCBpbiBtZXRob2QgY2FsbHMgb3IgcHVibGljYXRpb25zLlwiKTtcbiAgICByZXR1cm4gY3VycmVudEludm9jYXRpb24udXNlcklkO1xuICB9XG5cbiAgYXN5bmMgaW5pdCgpIHtcbiAgICBhd2FpdCBzZXR1cFVzZXJzQ29sbGVjdGlvbih0aGlzLnVzZXJzKTtcbiAgfVxuXG4gIC8vL1xuICAvLy8gTE9HSU4gSE9PS1NcbiAgLy8vXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFZhbGlkYXRlIGxvZ2luIGF0dGVtcHRzLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgQ2FsbGVkIHdoZW5ldmVyIGEgbG9naW4gaXMgYXR0ZW1wdGVkIChlaXRoZXIgc3VjY2Vzc2Z1bCBvciB1bnN1Y2Nlc3NmdWwpLiAgQSBsb2dpbiBjYW4gYmUgYWJvcnRlZCBieSByZXR1cm5pbmcgYSBmYWxzeSB2YWx1ZSBvciB0aHJvd2luZyBhbiBleGNlcHRpb24uXG4gICAqL1xuICB2YWxpZGF0ZUxvZ2luQXR0ZW1wdChmdW5jKSB7XG4gICAgLy8gRXhjZXB0aW9ucyBpbnNpZGUgdGhlIGhvb2sgY2FsbGJhY2sgYXJlIHBhc3NlZCB1cCB0byB1cy5cbiAgICByZXR1cm4gdGhpcy5fdmFsaWRhdGVMb2dpbkhvb2sucmVnaXN0ZXIoZnVuYyk7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgU2V0IHJlc3RyaWN0aW9ucyBvbiBuZXcgdXNlciBjcmVhdGlvbi5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIENhbGxlZCB3aGVuZXZlciBhIG5ldyB1c2VyIGlzIGNyZWF0ZWQuIFRha2VzIHRoZSBuZXcgdXNlciBvYmplY3QsIGFuZCByZXR1cm5zIHRydWUgdG8gYWxsb3cgdGhlIGNyZWF0aW9uIG9yIGZhbHNlIHRvIGFib3J0LlxuICAgKi9cbiAgdmFsaWRhdGVOZXdVc2VyKGZ1bmMpIHtcbiAgICB0aGlzLl92YWxpZGF0ZU5ld1VzZXJIb29rcy5wdXNoKGZ1bmMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFZhbGlkYXRlIGxvZ2luIGZyb20gZXh0ZXJuYWwgc2VydmljZVxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgQ2FsbGVkIHdoZW5ldmVyIGxvZ2luL3VzZXIgY3JlYXRpb24gZnJvbSBleHRlcm5hbCBzZXJ2aWNlIGlzIGF0dGVtcHRlZC4gTG9naW4gb3IgdXNlciBjcmVhdGlvbiBiYXNlZCBvbiB0aGlzIGxvZ2luIGNhbiBiZSBhYm9ydGVkIGJ5IHBhc3NpbmcgYSBmYWxzeSB2YWx1ZSBvciB0aHJvd2luZyBhbiBleGNlcHRpb24uXG4gICAqL1xuICBiZWZvcmVFeHRlcm5hbExvZ2luKGZ1bmMpIHtcbiAgICBpZiAodGhpcy5fYmVmb3JlRXh0ZXJuYWxMb2dpbkhvb2spIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbiBvbmx5IGNhbGwgYmVmb3JlRXh0ZXJuYWxMb2dpbiBvbmNlXCIpO1xuICAgIH1cblxuICAgIHRoaXMuX2JlZm9yZUV4dGVybmFsTG9naW5Ib29rID0gZnVuYztcbiAgfVxuXG4gIC8vL1xuICAvLy8gQ1JFQVRFIFVTRVIgSE9PS1NcbiAgLy8vXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEN1c3RvbWl6ZSBsb2dpbiB0b2tlbiBjcmVhdGlvbi5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIENhbGxlZCB3aGVuZXZlciBhIG5ldyB0b2tlbiBpcyBjcmVhdGVkLlxuICAgKiBSZXR1cm4gdGhlIHNlcXVlbmNlIGFuZCB0aGUgdXNlciBvYmplY3QuIFJldHVybiB0cnVlIHRvIGtlZXAgc2VuZGluZyB0aGUgZGVmYXVsdCBlbWFpbCwgb3IgZmFsc2UgdG8gb3ZlcnJpZGUgdGhlIGJlaGF2aW9yLlxuICAgKi9cbiAgb25DcmVhdGVMb2dpblRva2VuID0gZnVuY3Rpb24oZnVuYykge1xuICAgIGlmICh0aGlzLl9vbkNyZWF0ZUxvZ2luVG9rZW5Ib29rKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgb25DcmVhdGVMb2dpblRva2VuIG9uY2UnKTtcbiAgICB9XG5cbiAgICB0aGlzLl9vbkNyZWF0ZUxvZ2luVG9rZW5Ib29rID0gZnVuYztcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDdXN0b21pemUgbmV3IHVzZXIgY3JlYXRpb24uXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBDYWxsZWQgd2hlbmV2ZXIgYSBuZXcgdXNlciBpcyBjcmVhdGVkLiBSZXR1cm4gdGhlIG5ldyB1c2VyIG9iamVjdCwgb3IgdGhyb3cgYW4gYEVycm9yYCB0byBhYm9ydCB0aGUgY3JlYXRpb24uXG4gICAqL1xuICBvbkNyZWF0ZVVzZXIoZnVuYykge1xuICAgIGlmICh0aGlzLl9vbkNyZWF0ZVVzZXJIb29rKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4gb25seSBjYWxsIG9uQ3JlYXRlVXNlciBvbmNlXCIpO1xuICAgIH1cblxuICAgIHRoaXMuX29uQ3JlYXRlVXNlckhvb2sgPSBNZXRlb3Iud3JhcEZuKGZ1bmMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEN1c3RvbWl6ZSBvYXV0aCB1c2VyIHByb2ZpbGUgdXBkYXRlc1xuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgQ2FsbGVkIHdoZW5ldmVyIGEgdXNlciBpcyBsb2dnZWQgaW4gdmlhIG9hdXRoLiBSZXR1cm4gdGhlIHByb2ZpbGUgb2JqZWN0IHRvIGJlIG1lcmdlZCwgb3IgdGhyb3cgYW4gYEVycm9yYCB0byBhYm9ydCB0aGUgY3JlYXRpb24uXG4gICAqL1xuICBvbkV4dGVybmFsTG9naW4oZnVuYykge1xuICAgIGlmICh0aGlzLl9vbkV4dGVybmFsTG9naW5Ib29rKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4gb25seSBjYWxsIG9uRXh0ZXJuYWxMb2dpbiBvbmNlXCIpO1xuICAgIH1cblxuICAgIHRoaXMuX29uRXh0ZXJuYWxMb2dpbkhvb2sgPSBmdW5jO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEN1c3RvbWl6ZSB1c2VyIHNlbGVjdGlvbiBvbiBleHRlcm5hbCBsb2dpbnNcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIENhbGxlZCB3aGVuZXZlciBhIHVzZXIgaXMgbG9nZ2VkIGluIHZpYSBvYXV0aCBhbmQgYVxuICAgKiB1c2VyIGlzIG5vdCBmb3VuZCB3aXRoIHRoZSBzZXJ2aWNlIGlkLiBSZXR1cm4gdGhlIHVzZXIgb3IgdW5kZWZpbmVkLlxuICAgKi9cbiAgc2V0QWRkaXRpb25hbEZpbmRVc2VyT25FeHRlcm5hbExvZ2luKGZ1bmMpIHtcbiAgICBpZiAodGhpcy5fYWRkaXRpb25hbEZpbmRVc2VyT25FeHRlcm5hbExvZ2luKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4gb25seSBjYWxsIHNldEFkZGl0aW9uYWxGaW5kVXNlck9uRXh0ZXJuYWxMb2dpbiBvbmNlXCIpO1xuICAgIH1cbiAgICB0aGlzLl9hZGRpdGlvbmFsRmluZFVzZXJPbkV4dGVybmFsTG9naW4gPSBmdW5jO1xuICB9XG5cbiAgYXN5bmMgX3ZhbGlkYXRlTG9naW4oY29ubmVjdGlvbiwgYXR0ZW1wdCkge1xuICAgIGF3YWl0IHRoaXMuX3ZhbGlkYXRlTG9naW5Ib29rLmZvckVhY2hBc3luYyhhc3luYyAoY2FsbGJhY2spID0+IHtcbiAgICAgIGxldCByZXQ7XG4gICAgICB0cnkge1xuICAgICAgICByZXQgPSBhd2FpdCBjYWxsYmFjayhjbG9uZUF0dGVtcHRXaXRoQ29ubmVjdGlvbihjb25uZWN0aW9uLCBhdHRlbXB0KSk7XG4gICAgICB9XG4gICAgICBjYXRjaCAoZSkge1xuICAgICAgICBhdHRlbXB0LmFsbG93ZWQgPSBmYWxzZTtcbiAgICAgICAgLy8gWFhYIHRoaXMgbWVhbnMgdGhlIGxhc3QgdGhyb3duIGVycm9yIG92ZXJyaWRlcyBwcmV2aW91cyBlcnJvclxuICAgICAgICAvLyBtZXNzYWdlcy4gTWF5YmUgdGhpcyBpcyBzdXJwcmlzaW5nIHRvIHVzZXJzIGFuZCB3ZSBzaG91bGQgbWFrZVxuICAgICAgICAvLyBvdmVycmlkaW5nIGVycm9ycyBtb3JlIGV4cGxpY2l0LiAoc2VlXG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy8xOTYwKVxuICAgICAgICBhdHRlbXB0LmVycm9yID0gZTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBpZiAoISByZXQpIHtcbiAgICAgICAgYXR0ZW1wdC5hbGxvd2VkID0gZmFsc2U7XG4gICAgICAgIC8vIGRvbid0IG92ZXJyaWRlIGEgc3BlY2lmaWMgZXJyb3IgcHJvdmlkZWQgYnkgYSBwcmV2aW91c1xuICAgICAgICAvLyB2YWxpZGF0b3Igb3IgdGhlIGluaXRpYWwgYXR0ZW1wdCAoZWcgXCJpbmNvcnJlY3QgcGFzc3dvcmRcIikuXG4gICAgICAgIGlmICghYXR0ZW1wdC5lcnJvcilcbiAgICAgICAgICBhdHRlbXB0LmVycm9yID0gbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiTG9naW4gZm9yYmlkZGVuXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH07XG5cbiAgYXN5bmMgX3N1Y2Nlc3NmdWxMb2dpbihjb25uZWN0aW9uLCBhdHRlbXB0KSB7XG4gICAgYXdhaXQgdGhpcy5fb25Mb2dpbkhvb2suZm9yRWFjaEFzeW5jKGFzeW5jIChjYWxsYmFjaykgPT4ge1xuICAgICAgYXdhaXQgY2FsbGJhY2soY2xvbmVBdHRlbXB0V2l0aENvbm5lY3Rpb24oY29ubmVjdGlvbiwgYXR0ZW1wdCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH07XG5cbiAgYXN5bmMgX2ZhaWxlZExvZ2luKGNvbm5lY3Rpb24sIGF0dGVtcHQpIHtcbiAgICBhd2FpdCB0aGlzLl9vbkxvZ2luRmFpbHVyZUhvb2suZm9yRWFjaEFzeW5jKGFzeW5jIChjYWxsYmFjaykgPT4ge1xuICAgICAgYXdhaXQgY2FsbGJhY2soY2xvbmVBdHRlbXB0V2l0aENvbm5lY3Rpb24oY29ubmVjdGlvbiwgYXR0ZW1wdCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH07XG5cbiAgYXN5bmMgX3N1Y2Nlc3NmdWxMb2dvdXQoY29ubmVjdGlvbiwgdXNlcklkKSB7XG4gICAgLy8gZG9uJ3QgZmV0Y2ggdGhlIHVzZXIgb2JqZWN0IHVubGVzcyB0aGVyZSBhcmUgc29tZSBjYWxsYmFja3MgcmVnaXN0ZXJlZFxuICAgIGxldCB1c2VyO1xuICAgIGF3YWl0IHRoaXMuX29uTG9nb3V0SG9vay5mb3JFYWNoQXN5bmMoYXN5bmMgY2FsbGJhY2sgPT4ge1xuICAgICAgaWYgKCF1c2VyICYmIHVzZXJJZCkgdXNlciA9IGF3YWl0IHRoaXMudXNlcnMuZmluZE9uZUFzeW5jKHVzZXJJZCwgeyBmaWVsZHM6IHRoaXMuX29wdGlvbnMuZGVmYXVsdEZpZWxkU2VsZWN0b3IgfSk7XG4gICAgICBjYWxsYmFjayh7IHVzZXIsIGNvbm5lY3Rpb24gfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBHZW5lcmF0ZXMgYSBNb25nb0RCIHNlbGVjdG9yIHRoYXQgY2FuIGJlIHVzZWQgdG8gcGVyZm9ybSBhIGZhc3QgY2FzZVxuICAvLyBpbnNlbnNpdGl2ZSBsb29rdXAgZm9yIHRoZSBnaXZlbiBmaWVsZE5hbWUgYW5kIHN0cmluZy4gU2luY2UgTW9uZ29EQiBkb2VzXG4gIC8vIG5vdCBzdXBwb3J0IGNhc2UgaW5zZW5zaXRpdmUgaW5kZXhlcywgYW5kIGNhc2UgaW5zZW5zaXRpdmUgcmVnZXggcXVlcmllc1xuICAvLyBhcmUgc2xvdywgd2UgY29uc3RydWN0IGEgc2V0IG9mIHByZWZpeCBzZWxlY3RvcnMgZm9yIGFsbCBwZXJtdXRhdGlvbnMgb2ZcbiAgLy8gdGhlIGZpcnN0IDQgY2hhcmFjdGVycyBvdXJzZWx2ZXMuIFdlIGZpcnN0IGF0dGVtcHQgdG8gbWF0Y2hpbmcgYWdhaW5zdFxuICAvLyB0aGVzZSwgYW5kIGJlY2F1c2UgJ3ByZWZpeCBleHByZXNzaW9uJyByZWdleCBxdWVyaWVzIGRvIHVzZSBpbmRleGVzIChzZWVcbiAgLy8gaHR0cDovL2RvY3MubW9uZ29kYi5vcmcvdjIuNi9yZWZlcmVuY2Uvb3BlcmF0b3IvcXVlcnkvcmVnZXgvI2luZGV4LXVzZSksXG4gIC8vIHRoaXMgaGFzIGJlZW4gZm91bmQgdG8gZ3JlYXRseSBpbXByb3ZlIHBlcmZvcm1hbmNlIChmcm9tIDEyMDBtcyB0byA1bXMgaW4gYVxuICAvLyB0ZXN0IHdpdGggMS4wMDAuMDAwIHVzZXJzKS5cbiAgX3NlbGVjdG9yRm9yRmFzdENhc2VJbnNlbnNpdGl2ZUxvb2t1cCA9IChmaWVsZE5hbWUsIHN0cmluZykgPT4ge1xuICAgIC8vIFBlcmZvcm1hbmNlIHNlZW1zIHRvIGltcHJvdmUgdXAgdG8gNCBwcmVmaXggY2hhcmFjdGVyc1xuICAgIGNvbnN0IHByZWZpeCA9IHN0cmluZy5zdWJzdHJpbmcoMCwgTWF0aC5taW4oc3RyaW5nLmxlbmd0aCwgNCkpO1xuICAgIGNvbnN0IG9yQ2xhdXNlID0gZ2VuZXJhdGVDYXNlUGVybXV0YXRpb25zRm9yU3RyaW5nKHByZWZpeCkubWFwKFxuICAgICAgICBwcmVmaXhQZXJtdXRhdGlvbiA9PiB7XG4gICAgICAgICAgY29uc3Qgc2VsZWN0b3IgPSB7fTtcbiAgICAgICAgICBzZWxlY3RvcltmaWVsZE5hbWVdID1cbiAgICAgICAgICAgICAgbmV3IFJlZ0V4cChgXiR7TWV0ZW9yLl9lc2NhcGVSZWdFeHAocHJlZml4UGVybXV0YXRpb24pfWApO1xuICAgICAgICAgIHJldHVybiBzZWxlY3RvcjtcbiAgICAgICAgfSk7XG4gICAgY29uc3QgY2FzZUluc2Vuc2l0aXZlQ2xhdXNlID0ge307XG4gICAgY2FzZUluc2Vuc2l0aXZlQ2xhdXNlW2ZpZWxkTmFtZV0gPVxuICAgICAgICBuZXcgUmVnRXhwKGBeJHtNZXRlb3IuX2VzY2FwZVJlZ0V4cChzdHJpbmcpfSRgLCAnaScpXG4gICAgcmV0dXJuIHskYW5kOiBbeyRvcjogb3JDbGF1c2V9LCBjYXNlSW5zZW5zaXRpdmVDbGF1c2VdfTtcbiAgfVxuXG4gIF9maW5kVXNlckJ5UXVlcnkgPSBhc3luYyAocXVlcnksIG9wdGlvbnMpID0+IHtcbiAgICBsZXQgdXNlciA9IG51bGw7XG5cbiAgICBpZiAocXVlcnkuaWQpIHtcbiAgICAgIC8vIGRlZmF1bHQgZmllbGQgc2VsZWN0b3IgaXMgYWRkZWQgd2l0aGluIGdldFVzZXJCeUlkKClcbiAgICAgIHVzZXIgPSBhd2FpdCBNZXRlb3IudXNlcnMuZmluZE9uZUFzeW5jKHF1ZXJ5LmlkLCB0aGlzLl9hZGREZWZhdWx0RmllbGRTZWxlY3RvcihvcHRpb25zKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdGlvbnMgPSB0aGlzLl9hZGREZWZhdWx0RmllbGRTZWxlY3RvcihvcHRpb25zKTtcbiAgICAgIGxldCBmaWVsZE5hbWU7XG4gICAgICBsZXQgZmllbGRWYWx1ZTtcbiAgICAgIGlmIChxdWVyeS51c2VybmFtZSkge1xuICAgICAgICBmaWVsZE5hbWUgPSAndXNlcm5hbWUnO1xuICAgICAgICBmaWVsZFZhbHVlID0gcXVlcnkudXNlcm5hbWU7XG4gICAgICB9IGVsc2UgaWYgKHF1ZXJ5LmVtYWlsKSB7XG4gICAgICAgIGZpZWxkTmFtZSA9ICdlbWFpbHMuYWRkcmVzcyc7XG4gICAgICAgIGZpZWxkVmFsdWUgPSBxdWVyeS5lbWFpbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInNob3VsZG4ndCBoYXBwZW4gKHZhbGlkYXRpb24gbWlzc2VkIHNvbWV0aGluZylcIik7XG4gICAgICB9XG4gICAgICBsZXQgc2VsZWN0b3IgPSB7fTtcbiAgICAgIHNlbGVjdG9yW2ZpZWxkTmFtZV0gPSBmaWVsZFZhbHVlO1xuICAgICAgdXNlciA9IGF3YWl0IE1ldGVvci51c2Vycy5maW5kT25lQXN5bmMoc2VsZWN0b3IsIG9wdGlvbnMpO1xuICAgICAgLy8gSWYgdXNlciBpcyBub3QgZm91bmQsIHRyeSBhIGNhc2UgaW5zZW5zaXRpdmUgbG9va3VwXG4gICAgICBpZiAoIXVzZXIpIHtcbiAgICAgICAgc2VsZWN0b3IgPSB0aGlzLl9zZWxlY3RvckZvckZhc3RDYXNlSW5zZW5zaXRpdmVMb29rdXAoZmllbGROYW1lLCBmaWVsZFZhbHVlKTtcbiAgICAgICAgY29uc3QgY2FuZGlkYXRlVXNlcnMgPSBhd2FpdCBNZXRlb3IudXNlcnMuZmluZChzZWxlY3RvciwgeyAuLi5vcHRpb25zLCBsaW1pdDogMiB9KS5mZXRjaEFzeW5jKCk7XG4gICAgICAgIC8vIE5vIG1hdGNoIGlmIG11bHRpcGxlIGNhbmRpZGF0ZXMgYXJlIGZvdW5kXG4gICAgICAgIGlmIChjYW5kaWRhdGVVc2Vycy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICB1c2VyID0gY2FuZGlkYXRlVXNlcnNbMF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdXNlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGaW5kIGEgdXNlciBieSBvbmUgb2YgdGhlaXIgZW1haWwgYWRkcmVzc2VzLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBlbWFpbCBUaGUgZW1haWwgYWRkcmVzcyB0byBsb29rIGZvclxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLmZpZWxkcyBMaW1pdCB0aGUgZmllbGRzIHRvIHJldHVybiBmcm9tIHRoZSB1c2VyIGRvY3VtZW50XG4gICAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IEEgdXNlciBpZiBmb3VuZCwgZWxzZSBudWxsXG4gICAqIEBtZW1iZXJvZiBBY2NvdW50c1xuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICAgKi9cbiAgZmluZFVzZXJCeUVtYWlsID0gYXN5bmMgKGVtYWlsLCBvcHRpb25zKSA9PlxuICAgIGF3YWl0IHRoaXMuX2ZpbmRVc2VyQnlRdWVyeSh7IGVtYWlsIH0sIG9wdGlvbnMpO1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGaW5kIGEgdXNlciBieSB0aGVpciB1c2VybmFtZS5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge1N0cmluZ30gdXNlcm5hbWUgVGhlIHVzZXJuYW1lIHRvIGxvb2sgZm9yXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuZmllbGRzIExpbWl0IHRoZSBmaWVsZHMgdG8gcmV0dXJuIGZyb20gdGhlIHVzZXIgZG9jdW1lbnRcbiAgICogQHJldHVybnMge1Byb21pc2U8T2JqZWN0Pn0gQSB1c2VyIGlmIGZvdW5kLCBlbHNlIG51bGxcbiAgICogQG1lbWJlcm9mIEFjY291bnRzXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBhY2NvdW50cy1iYXNlXG4gICAqL1xuICBmaW5kVXNlckJ5VXNlcm5hbWUgPSBhc3luYyAodXNlcm5hbWUsIG9wdGlvbnMpID0+XG4gICAgYXdhaXQgdGhpcy5fZmluZFVzZXJCeVF1ZXJ5KHsgdXNlcm5hbWUgfSwgb3B0aW9ucyk7XG5cbiAgLy8vXG4gIC8vLyBMT0dJTiBNRVRIT0RTXG4gIC8vL1xuXG4gIC8vIExvZ2luIG1ldGhvZHMgcmV0dXJuIHRvIHRoZSBjbGllbnQgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdGhlc2VcbiAgLy8gZmllbGRzIHdoZW4gdGhlIHVzZXIgd2FzIGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHk6XG4gIC8vXG4gIC8vICAgaWQ6IHVzZXJJZFxuICAvLyAgIHRva2VuOiAqXG4gIC8vICAgdG9rZW5FeHBpcmVzOiAqXG4gIC8vXG4gIC8vIHRva2VuRXhwaXJlcyBpcyBvcHRpb25hbCBhbmQgaW50ZW5kcyB0byBwcm92aWRlIGEgaGludCB0byB0aGVcbiAgLy8gY2xpZW50IGFzIHRvIHdoZW4gdGhlIHRva2VuIHdpbGwgZXhwaXJlLiBJZiBub3QgcHJvdmlkZWQsIHRoZVxuICAvLyBjbGllbnQgd2lsbCBjYWxsIEFjY291bnRzLl90b2tlbkV4cGlyYXRpb24sIHBhc3NpbmcgaXQgdGhlIGRhdGVcbiAgLy8gdGhhdCBpdCByZWNlaXZlZCB0aGUgdG9rZW4uXG4gIC8vXG4gIC8vIFRoZSBsb2dpbiBtZXRob2Qgd2lsbCB0aHJvdyBhbiBlcnJvciBiYWNrIHRvIHRoZSBjbGllbnQgaWYgdGhlIHVzZXJcbiAgLy8gZmFpbGVkIHRvIGxvZyBpbi5cbiAgLy9cbiAgLy9cbiAgLy8gTG9naW4gaGFuZGxlcnMgYW5kIHNlcnZpY2Ugc3BlY2lmaWMgbG9naW4gbWV0aG9kcyBzdWNoIGFzXG4gIC8vIGBjcmVhdGVVc2VyYCBpbnRlcm5hbGx5IHJldHVybiBhIGByZXN1bHRgIG9iamVjdCBjb250YWluaW5nIHRoZXNlXG4gIC8vIGZpZWxkczpcbiAgLy9cbiAgLy8gICB0eXBlOlxuICAvLyAgICAgb3B0aW9uYWwgc3RyaW5nOyB0aGUgc2VydmljZSBuYW1lLCBvdmVycmlkZXMgdGhlIGhhbmRsZXJcbiAgLy8gICAgIGRlZmF1bHQgaWYgcHJlc2VudC5cbiAgLy9cbiAgLy8gICBlcnJvcjpcbiAgLy8gICAgIGV4Y2VwdGlvbjsgaWYgdGhlIHVzZXIgaXMgbm90IGFsbG93ZWQgdG8gbG9naW4sIHRoZSByZWFzb24gd2h5LlxuICAvL1xuICAvLyAgIHVzZXJJZDpcbiAgLy8gICAgIHN0cmluZzsgdGhlIHVzZXIgaWQgb2YgdGhlIHVzZXIgYXR0ZW1wdGluZyB0byBsb2dpbiAoaWZcbiAgLy8gICAgIGtub3duKSwgcmVxdWlyZWQgZm9yIGFuIGFsbG93ZWQgbG9naW4uXG4gIC8vXG4gIC8vICAgb3B0aW9uczpcbiAgLy8gICAgIG9wdGlvbmFsIG9iamVjdCBtZXJnZWQgaW50byB0aGUgcmVzdWx0IHJldHVybmVkIGJ5IHRoZSBsb2dpblxuICAvLyAgICAgbWV0aG9kOyB1c2VkIGJ5IEhBTUsgZnJvbSBTUlAuXG4gIC8vXG4gIC8vICAgc3RhbXBlZExvZ2luVG9rZW46XG4gIC8vICAgICBvcHRpb25hbCBvYmplY3Qgd2l0aCBgdG9rZW5gIGFuZCBgd2hlbmAgaW5kaWNhdGluZyB0aGUgbG9naW5cbiAgLy8gICAgIHRva2VuIGlzIGFscmVhZHkgcHJlc2VudCBpbiB0aGUgZGF0YWJhc2UsIHJldHVybmVkIGJ5IHRoZVxuICAvLyAgICAgXCJyZXN1bWVcIiBsb2dpbiBoYW5kbGVyLlxuICAvL1xuICAvLyBGb3IgY29udmVuaWVuY2UsIGxvZ2luIG1ldGhvZHMgY2FuIGFsc28gdGhyb3cgYW4gZXhjZXB0aW9uLCB3aGljaFxuICAvLyBpcyBjb252ZXJ0ZWQgaW50byBhbiB7ZXJyb3J9IHJlc3VsdC4gIEhvd2V2ZXIsIGlmIHRoZSBpZCBvZiB0aGVcbiAgLy8gdXNlciBhdHRlbXB0aW5nIHRoZSBsb2dpbiBpcyBrbm93biwgYSB7dXNlcklkLCBlcnJvcn0gcmVzdWx0IHNob3VsZFxuICAvLyBiZSByZXR1cm5lZCBpbnN0ZWFkIHNpbmNlIHRoZSB1c2VyIGlkIGlzIG5vdCBjYXB0dXJlZCB3aGVuIGFuXG4gIC8vIGV4Y2VwdGlvbiBpcyB0aHJvd24uXG4gIC8vXG4gIC8vIFRoaXMgaW50ZXJuYWwgYHJlc3VsdGAgb2JqZWN0IGlzIGF1dG9tYXRpY2FsbHkgY29udmVydGVkIGludG8gdGhlXG4gIC8vIHB1YmxpYyB7aWQsIHRva2VuLCB0b2tlbkV4cGlyZXN9IG9iamVjdCByZXR1cm5lZCB0byB0aGUgY2xpZW50LlxuXG4gIC8vIFRyeSBhIGxvZ2luIG1ldGhvZCwgY29udmVydGluZyB0aHJvd24gZXhjZXB0aW9ucyBpbnRvIGFuIHtlcnJvcn1cbiAgLy8gcmVzdWx0LiAgVGhlIGB0eXBlYCBhcmd1bWVudCBpcyBhIGRlZmF1bHQsIGluc2VydGVkIGludG8gdGhlIHJlc3VsdFxuICAvLyBvYmplY3QgaWYgbm90IGV4cGxpY2l0bHkgcmV0dXJuZWQuXG4gIC8vXG4gIC8vIExvZyBpbiBhIHVzZXIgb24gYSBjb25uZWN0aW9uLlxuICAvL1xuICAvLyBXZSB1c2UgdGhlIG1ldGhvZCBpbnZvY2F0aW9uIHRvIHNldCB0aGUgdXNlciBpZCBvbiB0aGUgY29ubmVjdGlvbixcbiAgLy8gbm90IHRoZSBjb25uZWN0aW9uIG9iamVjdCBkaXJlY3RseS4gc2V0VXNlcklkIGlzIHRpZWQgdG8gbWV0aG9kcyB0b1xuICAvLyBlbmZvcmNlIGNsZWFyIG9yZGVyaW5nIG9mIG1ldGhvZCBhcHBsaWNhdGlvbiAodXNpbmcgd2FpdCBtZXRob2RzIG9uXG4gIC8vIHRoZSBjbGllbnQsIGFuZCBhIG5vIHNldFVzZXJJZCBhZnRlciB1bmJsb2NrIHJlc3RyaWN0aW9uIG9uIHRoZVxuICAvLyBzZXJ2ZXIpXG4gIC8vXG4gIC8vIFRoZSBgc3RhbXBlZExvZ2luVG9rZW5gIHBhcmFtZXRlciBpcyBvcHRpb25hbC4gIFdoZW4gcHJlc2VudCwgaXRcbiAgLy8gaW5kaWNhdGVzIHRoYXQgdGhlIGxvZ2luIHRva2VuIGhhcyBhbHJlYWR5IGJlZW4gaW5zZXJ0ZWQgaW50byB0aGVcbiAgLy8gZGF0YWJhc2UgYW5kIGRvZXNuJ3QgbmVlZCB0byBiZSBpbnNlcnRlZCBhZ2Fpbi4gIChJdCdzIHVzZWQgYnkgdGhlXG4gIC8vIFwicmVzdW1lXCIgbG9naW4gaGFuZGxlcikuXG4gIGFzeW5jIF9sb2dpblVzZXIobWV0aG9kSW52b2NhdGlvbiwgdXNlcklkLCBzdGFtcGVkTG9naW5Ub2tlbikge1xuICAgIGlmICghIHN0YW1wZWRMb2dpblRva2VuKSB7XG4gICAgICBzdGFtcGVkTG9naW5Ub2tlbiA9IHRoaXMuX2dlbmVyYXRlU3RhbXBlZExvZ2luVG9rZW4oKTtcbiAgICAgIGF3YWl0IHRoaXMuX2luc2VydExvZ2luVG9rZW4odXNlcklkLCBzdGFtcGVkTG9naW5Ub2tlbik7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBvcmRlciAoYW5kIHRoZSBhdm9pZGFuY2Ugb2YgeWllbGRzKSBpcyBpbXBvcnRhbnQgdG8gbWFrZVxuICAgIC8vIHN1cmUgdGhhdCB3aGVuIHB1Ymxpc2ggZnVuY3Rpb25zIGFyZSByZXJ1biwgdGhleSBzZWUgYVxuICAgIC8vIGNvbnNpc3RlbnQgdmlldyBvZiB0aGUgd29ybGQ6IHRoZSB1c2VySWQgaXMgc2V0IGFuZCBtYXRjaGVzXG4gICAgLy8gdGhlIGxvZ2luIHRva2VuIG9uIHRoZSBjb25uZWN0aW9uIChub3QgdGhhdCB0aGVyZSBpc1xuICAgIC8vIGN1cnJlbnRseSBhIHB1YmxpYyBBUEkgZm9yIHJlYWRpbmcgdGhlIGxvZ2luIHRva2VuIG9uIGFcbiAgICAvLyBjb25uZWN0aW9uKS5cbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZCgoKSA9PlxuICAgICAgdGhpcy5fc2V0TG9naW5Ub2tlbihcbiAgICAgICAgdXNlcklkLFxuICAgICAgICBtZXRob2RJbnZvY2F0aW9uLmNvbm5lY3Rpb24sXG4gICAgICAgIHRoaXMuX2hhc2hMb2dpblRva2VuKHN0YW1wZWRMb2dpblRva2VuLnRva2VuKVxuICAgICAgKVxuICAgICk7XG5cbiAgICBhd2FpdCBtZXRob2RJbnZvY2F0aW9uLnNldFVzZXJJZCh1c2VySWQpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiB1c2VySWQsXG4gICAgICB0b2tlbjogc3RhbXBlZExvZ2luVG9rZW4udG9rZW4sXG4gICAgICB0b2tlbkV4cGlyZXM6IHRoaXMuX3Rva2VuRXhwaXJhdGlvbihzdGFtcGVkTG9naW5Ub2tlbi53aGVuKVxuICAgIH07XG4gIH07XG5cbiAgLy8gQWZ0ZXIgYSBsb2dpbiBtZXRob2QgaGFzIGNvbXBsZXRlZCwgY2FsbCB0aGUgbG9naW4gaG9va3MuICBOb3RlXG4gIC8vIHRoYXQgYGF0dGVtcHRMb2dpbmAgaXMgY2FsbGVkIGZvciAqYWxsKiBsb2dpbiBhdHRlbXB0cywgZXZlbiBvbmVzXG4gIC8vIHdoaWNoIGFyZW4ndCBzdWNjZXNzZnVsIChzdWNoIGFzIGFuIGludmFsaWQgcGFzc3dvcmQsIGV0YykuXG4gIC8vXG4gIC8vIElmIHRoZSBsb2dpbiBpcyBhbGxvd2VkIGFuZCBpc24ndCBhYm9ydGVkIGJ5IGEgdmFsaWRhdGUgbG9naW4gaG9va1xuICAvLyBjYWxsYmFjaywgbG9nIGluIHRoZSB1c2VyLlxuICAvL1xuICBhc3luYyBfYXR0ZW1wdExvZ2luKFxuICAgIG1ldGhvZEludm9jYXRpb24sXG4gICAgbWV0aG9kTmFtZSxcbiAgICBtZXRob2RBcmdzLFxuICAgIHJlc3VsdFxuICApIHtcbiAgICBpZiAoIXJlc3VsdClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInJlc3VsdCBpcyByZXF1aXJlZFwiKTtcblxuICAgIC8vIFhYWCBBIHByb2dyYW1taW5nIGVycm9yIGluIGEgbG9naW4gaGFuZGxlciBjYW4gbGVhZCB0byB0aGlzIG9jY3VycmluZywgYW5kXG4gICAgLy8gdGhlbiB3ZSBkb24ndCBjYWxsIG9uTG9naW4gb3Igb25Mb2dpbkZhaWx1cmUgY2FsbGJhY2tzLiBTaG91bGRcbiAgICAvLyB0cnlMb2dpbk1ldGhvZCBjYXRjaCB0aGlzIGNhc2UgYW5kIHR1cm4gaXQgaW50byBhbiBlcnJvcj9cbiAgICBpZiAoIXJlc3VsdC51c2VySWQgJiYgIXJlc3VsdC5lcnJvcilcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbG9naW4gbWV0aG9kIG11c3Qgc3BlY2lmeSBhIHVzZXJJZCBvciBhbiBlcnJvclwiKTtcblxuICAgIGxldCB1c2VyO1xuICAgIGlmIChyZXN1bHQudXNlcklkKVxuICAgICAgdXNlciA9IGF3YWl0IHRoaXMudXNlcnMuZmluZE9uZUFzeW5jKHJlc3VsdC51c2VySWQsIHtmaWVsZHM6IHRoaXMuX29wdGlvbnMuZGVmYXVsdEZpZWxkU2VsZWN0b3J9KTtcblxuICAgIGNvbnN0IGF0dGVtcHQgPSB7XG4gICAgICB0eXBlOiByZXN1bHQudHlwZSB8fCBcInVua25vd25cIixcbiAgICAgIGFsbG93ZWQ6ICEhIChyZXN1bHQudXNlcklkICYmICFyZXN1bHQuZXJyb3IpLFxuICAgICAgbWV0aG9kTmFtZTogbWV0aG9kTmFtZSxcbiAgICAgIG1ldGhvZEFyZ3VtZW50czogQXJyYXkuZnJvbShtZXRob2RBcmdzKVxuICAgIH07XG4gICAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgICAgYXR0ZW1wdC5lcnJvciA9IHJlc3VsdC5lcnJvcjtcbiAgICB9XG4gICAgaWYgKHVzZXIpIHtcbiAgICAgIGF0dGVtcHQudXNlciA9IHVzZXI7XG4gICAgfVxuXG4gICAgLy8gX3ZhbGlkYXRlTG9naW4gbWF5IG11dGF0ZSBgYXR0ZW1wdGAgYnkgYWRkaW5nIGFuIGVycm9yIGFuZCBjaGFuZ2luZyBhbGxvd2VkXG4gICAgLy8gdG8gZmFsc2UsIGJ1dCB0aGF0J3MgdGhlIG9ubHkgY2hhbmdlIGl0IGNhbiBtYWtlIChhbmQgdGhlIHVzZXIncyBjYWxsYmFja3NcbiAgICAvLyBvbmx5IGdldCBhIGNsb25lIG9mIGBhdHRlbXB0YCkuXG4gICAgYXdhaXQgdGhpcy5fdmFsaWRhdGVMb2dpbihtZXRob2RJbnZvY2F0aW9uLmNvbm5lY3Rpb24sIGF0dGVtcHQpO1xuXG4gICAgaWYgKGF0dGVtcHQuYWxsb3dlZCkge1xuICAgICAgY29uc3QgbyA9IGF3YWl0IHRoaXMuX2xvZ2luVXNlcihcbiAgICAgICAgbWV0aG9kSW52b2NhdGlvbixcbiAgICAgICAgcmVzdWx0LnVzZXJJZCxcbiAgICAgICAgcmVzdWx0LnN0YW1wZWRMb2dpblRva2VuXG4gICAgICApXG4gICAgICBjb25zdCByZXQgPSB7XG4gICAgICAgIC4uLm8sXG4gICAgICAgIC4uLnJlc3VsdC5vcHRpb25zXG4gICAgICB9O1xuICAgICAgcmV0LnR5cGUgPSBhdHRlbXB0LnR5cGU7XG4gICAgICBhd2FpdCB0aGlzLl9zdWNjZXNzZnVsTG9naW4obWV0aG9kSW52b2NhdGlvbi5jb25uZWN0aW9uLCBhdHRlbXB0KTtcbiAgICAgIHJldHVybiByZXQ7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgYXdhaXQgdGhpcy5fZmFpbGVkTG9naW4obWV0aG9kSW52b2NhdGlvbi5jb25uZWN0aW9uLCBhdHRlbXB0KTtcbiAgICAgIHRocm93IGF0dGVtcHQuZXJyb3I7XG4gICAgfVxuICB9O1xuXG4gIC8vIEFsbCBzZXJ2aWNlIHNwZWNpZmljIGxvZ2luIG1ldGhvZHMgc2hvdWxkIGdvIHRocm91Z2ggdGhpcyBmdW5jdGlvbi5cbiAgLy8gRW5zdXJlIHRoYXQgdGhyb3duIGV4Y2VwdGlvbnMgYXJlIGNhdWdodCBhbmQgdGhhdCBsb2dpbiBob29rXG4gIC8vIGNhbGxiYWNrcyBhcmUgc3RpbGwgY2FsbGVkLlxuICAvL1xuICBhc3luYyBfbG9naW5NZXRob2QoXG4gICAgbWV0aG9kSW52b2NhdGlvbixcbiAgICBtZXRob2ROYW1lLFxuICAgIG1ldGhvZEFyZ3MsXG4gICAgdHlwZSxcbiAgICBmblxuICApIHtcbiAgICByZXR1cm4gdGhpcy5fYXR0ZW1wdExvZ2luKFxuICAgICAgbWV0aG9kSW52b2NhdGlvbixcbiAgICAgIG1ldGhvZE5hbWUsXG4gICAgICBtZXRob2RBcmdzLFxuICAgICAgYXdhaXQgdHJ5TG9naW5NZXRob2QodHlwZSwgZm4pXG4gICAgKTtcbiAgfTtcblxuXG4gIC8vIFJlcG9ydCBhIGxvZ2luIGF0dGVtcHQgZmFpbGVkIG91dHNpZGUgdGhlIGNvbnRleHQgb2YgYSBub3JtYWwgbG9naW5cbiAgLy8gbWV0aG9kLiBUaGlzIGlzIGZvciB1c2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlcmUgaXMgYSBtdWx0aS1zdGVwIGxvZ2luXG4gIC8vIHByb2NlZHVyZSAoZWcgU1JQIGJhc2VkIHBhc3N3b3JkIGxvZ2luKS4gSWYgYSBtZXRob2QgZWFybHkgaW4gdGhlXG4gIC8vIGNoYWluIGZhaWxzLCBpdCBzaG91bGQgY2FsbCB0aGlzIGZ1bmN0aW9uIHRvIHJlcG9ydCBhIGZhaWx1cmUuIFRoZXJlXG4gIC8vIGlzIG5vIGNvcnJlc3BvbmRpbmcgbWV0aG9kIGZvciBhIHN1Y2Nlc3NmdWwgbG9naW47IG1ldGhvZHMgdGhhdCBjYW5cbiAgLy8gc3VjY2VlZCBhdCBsb2dnaW5nIGEgdXNlciBpbiBzaG91bGQgYWx3YXlzIGJlIGFjdHVhbCBsb2dpbiBtZXRob2RzXG4gIC8vICh1c2luZyBlaXRoZXIgQWNjb3VudHMuX2xvZ2luTWV0aG9kIG9yIEFjY291bnRzLnJlZ2lzdGVyTG9naW5IYW5kbGVyKS5cbiAgYXN5bmMgX3JlcG9ydExvZ2luRmFpbHVyZShcbiAgICBtZXRob2RJbnZvY2F0aW9uLFxuICAgIG1ldGhvZE5hbWUsXG4gICAgbWV0aG9kQXJncyxcbiAgICByZXN1bHRcbiAgKSB7XG4gICAgY29uc3QgYXR0ZW1wdCA9IHtcbiAgICAgIHR5cGU6IHJlc3VsdC50eXBlIHx8IFwidW5rbm93blwiLFxuICAgICAgYWxsb3dlZDogZmFsc2UsXG4gICAgICBlcnJvcjogcmVzdWx0LmVycm9yLFxuICAgICAgbWV0aG9kTmFtZTogbWV0aG9kTmFtZSxcbiAgICAgIG1ldGhvZEFyZ3VtZW50czogQXJyYXkuZnJvbShtZXRob2RBcmdzKVxuICAgIH07XG5cbiAgICBpZiAocmVzdWx0LnVzZXJJZCkge1xuICAgICAgYXR0ZW1wdC51c2VyID0gdGhpcy51c2Vycy5maW5kT25lQXN5bmMocmVzdWx0LnVzZXJJZCwge2ZpZWxkczogdGhpcy5fb3B0aW9ucy5kZWZhdWx0RmllbGRTZWxlY3Rvcn0pO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuX3ZhbGlkYXRlTG9naW4obWV0aG9kSW52b2NhdGlvbi5jb25uZWN0aW9uLCBhdHRlbXB0KTtcbiAgICBhd2FpdCB0aGlzLl9mYWlsZWRMb2dpbihtZXRob2RJbnZvY2F0aW9uLmNvbm5lY3Rpb24sIGF0dGVtcHQpO1xuXG4gICAgLy8gX3ZhbGlkYXRlTG9naW4gbWF5IG11dGF0ZSBhdHRlbXB0IHRvIHNldCBhIG5ldyBlcnJvciBtZXNzYWdlLiBSZXR1cm5cbiAgICAvLyB0aGUgbW9kaWZpZWQgdmVyc2lvbi5cbiAgICByZXR1cm4gYXR0ZW1wdDtcbiAgfTtcblxuICAvLy9cbiAgLy8vIExPR0lOIEhBTkRMRVJTXG4gIC8vL1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZWdpc3RlcnMgYSBuZXcgbG9naW4gaGFuZGxlci5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAcGFyYW0ge1N0cmluZ30gW25hbWVdIFRoZSB0eXBlIG9mIGxvZ2luIG1ldGhvZCBsaWtlIG9hdXRoLCBwYXNzd29yZCwgZXRjLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyIEEgZnVuY3Rpb24gdGhhdCByZWNlaXZlcyBhbiBvcHRpb25zIG9iamVjdFxuICAgKiAoYXMgcGFzc2VkIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSBgbG9naW5gIG1ldGhvZCkgYW5kIHJldHVybnMgb25lIG9mXG4gICAqIGB1bmRlZmluZWRgLCBtZWFuaW5nIGRvbid0IGhhbmRsZSBvciBhIGxvZ2luIG1ldGhvZCByZXN1bHQgb2JqZWN0LlxuICAgKi9cbiAgcmVnaXN0ZXJMb2dpbkhhbmRsZXIobmFtZSwgaGFuZGxlcikge1xuICAgIGlmICghIGhhbmRsZXIpIHtcbiAgICAgIGhhbmRsZXIgPSBuYW1lO1xuICAgICAgbmFtZSA9IG51bGw7XG4gICAgfVxuXG4gICAgdGhpcy5fbG9naW5IYW5kbGVycy5wdXNoKHtcbiAgICAgIG5hbWU6IG5hbWUsXG4gICAgICBoYW5kbGVyOiBNZXRlb3Iud3JhcEZuKGhhbmRsZXIpXG4gICAgfSk7XG4gIH07XG5cblxuICAvLyBDaGVja3MgYSB1c2VyJ3MgY3JlZGVudGlhbHMgYWdhaW5zdCBhbGwgdGhlIHJlZ2lzdGVyZWQgbG9naW5cbiAgLy8gaGFuZGxlcnMsIGFuZCByZXR1cm5zIGEgbG9naW4gdG9rZW4gaWYgdGhlIGNyZWRlbnRpYWxzIGFyZSB2YWxpZC4gSXRcbiAgLy8gaXMgbGlrZSB0aGUgbG9naW4gbWV0aG9kLCBleGNlcHQgdGhhdCBpdCBkb2Vzbid0IHNldCB0aGUgbG9nZ2VkLWluXG4gIC8vIHVzZXIgb24gdGhlIGNvbm5lY3Rpb24uIFRocm93cyBhIE1ldGVvci5FcnJvciBpZiBsb2dnaW5nIGluIGZhaWxzLFxuICAvLyBpbmNsdWRpbmcgdGhlIGNhc2Ugd2hlcmUgbm9uZSBvZiB0aGUgbG9naW4gaGFuZGxlcnMgaGFuZGxlZCB0aGUgbG9naW5cbiAgLy8gcmVxdWVzdC4gT3RoZXJ3aXNlLCByZXR1cm5zIHtpZDogdXNlcklkLCB0b2tlbjogKiwgdG9rZW5FeHBpcmVzOiAqfS5cbiAgLy9cbiAgLy8gRm9yIGV4YW1wbGUsIGlmIHlvdSB3YW50IHRvIGxvZ2luIHdpdGggYSBwbGFpbnRleHQgcGFzc3dvcmQsIGBvcHRpb25zYCBjb3VsZCBiZVxuICAvLyAgIHsgdXNlcjogeyB1c2VybmFtZTogPHVzZXJuYW1lPiB9LCBwYXNzd29yZDogPHBhc3N3b3JkPiB9LCBvclxuICAvLyAgIHsgdXNlcjogeyBlbWFpbDogPGVtYWlsPiB9LCBwYXNzd29yZDogPHBhc3N3b3JkPiB9LlxuXG4gIC8vIFRyeSBhbGwgb2YgdGhlIHJlZ2lzdGVyZWQgbG9naW4gaGFuZGxlcnMgdW50aWwgb25lIG9mIHRoZW0gZG9lc24ndFxuICAvLyByZXR1cm4gYHVuZGVmaW5lZGAsIG1lYW5pbmcgaXQgaGFuZGxlZCB0aGlzIGNhbGwgdG8gYGxvZ2luYC4gUmV0dXJuXG4gIC8vIHRoYXQgcmV0dXJuIHZhbHVlLlxuICBhc3luYyBfcnVuTG9naW5IYW5kbGVycyhtZXRob2RJbnZvY2F0aW9uLCBvcHRpb25zKSB7XG4gICAgZm9yIChsZXQgaGFuZGxlciBvZiB0aGlzLl9sb2dpbkhhbmRsZXJzKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0cnlMb2dpbk1ldGhvZChoYW5kbGVyLm5hbWUsIGFzeW5jICgpID0+XG4gICAgICAgIGF3YWl0IGhhbmRsZXIuaGFuZGxlci5jYWxsKG1ldGhvZEludm9jYXRpb24sIG9wdGlvbnMpXG4gICAgICApO1xuXG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXN1bHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICAgIDQwMCxcbiAgICAgICAgICAnQSBsb2dpbiBoYW5kbGVyIHNob3VsZCByZXR1cm4gYSByZXN1bHQgb3IgdW5kZWZpbmVkJ1xuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiBudWxsLFxuICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoNDAwLCBcIlVucmVjb2duaXplZCBvcHRpb25zIGZvciBsb2dpbiByZXF1ZXN0XCIpXG4gICAgfTtcbiAgfTtcblxuICAvLyBEZWxldGVzIHRoZSBnaXZlbiBsb2dpblRva2VuIGZyb20gdGhlIGRhdGFiYXNlLlxuICAvL1xuICAvLyBGb3IgbmV3LXN0eWxlIGhhc2hlZCB0b2tlbiwgdGhpcyB3aWxsIGNhdXNlIGFsbCBjb25uZWN0aW9uc1xuICAvLyBhc3NvY2lhdGVkIHdpdGggdGhlIHRva2VuIHRvIGJlIGNsb3NlZC5cbiAgLy9cbiAgLy8gQW55IGNvbm5lY3Rpb25zIGFzc29jaWF0ZWQgd2l0aCBvbGQtc3R5bGUgdW5oYXNoZWQgdG9rZW5zIHdpbGwgYmVcbiAgLy8gaW4gdGhlIHByb2Nlc3Mgb2YgYmVjb21pbmcgYXNzb2NpYXRlZCB3aXRoIGhhc2hlZCB0b2tlbnMgYW5kIHRoZW5cbiAgLy8gdGhleSdsbCBnZXQgY2xvc2VkLlxuICBhc3luYyBkZXN0cm95VG9rZW4odXNlcklkLCBsb2dpblRva2VuKSB7XG4gICAgYXdhaXQgdGhpcy51c2Vycy51cGRhdGVBc3luYyh1c2VySWQsIHtcbiAgICAgICRwdWxsOiB7XG4gICAgICAgIFwic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zXCI6IHtcbiAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgIHsgaGFzaGVkVG9rZW46IGxvZ2luVG9rZW4gfSxcbiAgICAgICAgICAgIHsgdG9rZW46IGxvZ2luVG9rZW4gfVxuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIF9pbml0U2VydmVyTWV0aG9kcygpIHtcbiAgICAvLyBUaGUgbWV0aG9kcyBjcmVhdGVkIGluIHRoaXMgZnVuY3Rpb24gbmVlZCB0byBiZSBjcmVhdGVkIGhlcmUgc28gdGhhdFxuICAgIC8vIHRoaXMgdmFyaWFibGUgaXMgYXZhaWxhYmxlIGluIHRoZWlyIHNjb3BlLlxuICAgIGNvbnN0IGFjY291bnRzID0gdGhpcztcblxuICAgIC8vIFRoaXMgb2JqZWN0IHdpbGwgYmUgcG9wdWxhdGVkIHdpdGggbWV0aG9kcyBhbmQgdGhlbiBwYXNzZWQgdG9cbiAgICAvLyBhY2NvdW50cy5fc2VydmVyLm1ldGhvZHMgZnVydGhlciBiZWxvdy5cbiAgICBjb25zdCBtZXRob2RzID0ge307XG5cbiAgICAvLyBAcmV0dXJucyB7T2JqZWN0fG51bGx9XG4gICAgLy8gICBJZiBzdWNjZXNzZnVsLCByZXR1cm5zIHt0b2tlbjogcmVjb25uZWN0VG9rZW4sIGlkOiB1c2VySWR9XG4gICAgLy8gICBJZiB1bnN1Y2Nlc3NmdWwgKGZvciBleGFtcGxlLCBpZiB0aGUgdXNlciBjbG9zZWQgdGhlIG9hdXRoIGxvZ2luIHBvcHVwKSxcbiAgICAvLyAgICAgdGhyb3dzIGFuIGVycm9yIGRlc2NyaWJpbmcgdGhlIHJlYXNvblxuICAgIG1ldGhvZHMubG9naW4gPSBhc3luYyBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgLy8gTG9naW4gaGFuZGxlcnMgc2hvdWxkIHJlYWxseSBhbHNvIGNoZWNrIHdoYXRldmVyIGZpZWxkIHRoZXkgbG9vayBhdCBpblxuICAgICAgLy8gb3B0aW9ucywgYnV0IHdlIGRvbid0IGVuZm9yY2UgaXQuXG4gICAgICBjaGVjayhvcHRpb25zLCBPYmplY3QpO1xuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhY2NvdW50cy5fcnVuTG9naW5IYW5kbGVycyh0aGlzLCBvcHRpb25zKTtcbiAgICAgIC8vY29uc29sZS5sb2coe3Jlc3VsdH0pO1xuXG4gICAgICByZXR1cm4gYWNjb3VudHMuX2F0dGVtcHRMb2dpbih0aGlzLCBcImxvZ2luXCIsIGFyZ3VtZW50cywgcmVzdWx0KTtcbiAgICB9O1xuXG4gICAgbWV0aG9kcy5sb2dvdXQgPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICBjb25zdCB0b2tlbiA9IGFjY291bnRzLl9nZXRMb2dpblRva2VuKHRoaXMuY29ubmVjdGlvbi5pZCk7XG4gICAgICBhY2NvdW50cy5fc2V0TG9naW5Ub2tlbih0aGlzLnVzZXJJZCwgdGhpcy5jb25uZWN0aW9uLCBudWxsKTtcbiAgICAgIGlmICh0b2tlbiAmJiB0aGlzLnVzZXJJZCkge1xuICAgICAgIGF3YWl0IGFjY291bnRzLmRlc3Ryb3lUb2tlbih0aGlzLnVzZXJJZCwgdG9rZW4pO1xuICAgICAgfVxuICAgICAgYXdhaXQgYWNjb3VudHMuX3N1Y2Nlc3NmdWxMb2dvdXQodGhpcy5jb25uZWN0aW9uLCB0aGlzLnVzZXJJZCk7XG4gICAgICBhd2FpdCB0aGlzLnNldFVzZXJJZChudWxsKTtcbiAgICB9O1xuXG4gICAgLy8gTG9ncyBvdXQgdGhlIGN1cnJlbnQgdXNlciBhbmQgY2xvc2VzIGFsbCB0aGUgY29ubmVjdGlvbnNcbiAgICAvLyBhc3NvY2lhdGVkIHdpdGggdGhlIHVzZXIuXG4gICAgLy9cbiAgICBtZXRob2RzLmxvZ291dEFsbENsaWVudHMgPSBhc3luYyBmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IGxvZ291dFVzZXJJZCA9IHRoaXMudXNlcklkO1xuICAgICAgYWNjb3VudHMuX3NldExvZ2luVG9rZW4obG9nb3V0VXNlcklkLCB0aGlzLmNvbm5lY3Rpb24sIG51bGwpO1xuICAgICAgYWNjb3VudHMuX2NsZWFyQWxsTG9naW5Ub2tlbnMobG9nb3V0VXNlcklkKTtcbiAgICAgIGF3YWl0IGFjY291bnRzLl9zdWNjZXNzZnVsTG9nb3V0KHRoaXMuY29ubmVjdGlvbiwgbG9nb3V0VXNlcklkKTtcbiAgICAgIGF3YWl0IHRoaXMuc2V0VXNlcklkKG51bGwpO1xuICAgIH07XG5cbiAgICAvLyBHZW5lcmF0ZXMgYSBuZXcgbG9naW4gdG9rZW4gd2l0aCB0aGUgc2FtZSBleHBpcmF0aW9uIGFzIHRoZVxuICAgIC8vIGNvbm5lY3Rpb24ncyBjdXJyZW50IHRva2VuIGFuZCBzYXZlcyBpdCB0byB0aGUgZGF0YWJhc2UuIEFzc29jaWF0ZXNcbiAgICAvLyB0aGUgY29ubmVjdGlvbiB3aXRoIHRoaXMgbmV3IHRva2VuIGFuZCByZXR1cm5zIGl0LiBUaHJvd3MgYW4gZXJyb3JcbiAgICAvLyBpZiBjYWxsZWQgb24gYSBjb25uZWN0aW9uIHRoYXQgaXNuJ3QgbG9nZ2VkIGluLlxuICAgIC8vXG4gICAgLy8gQHJldHVybnMgT2JqZWN0XG4gICAgLy8gICBJZiBzdWNjZXNzZnVsLCByZXR1cm5zIHsgdG9rZW46IDxuZXcgdG9rZW4+LCBpZDogPHVzZXIgaWQ+LFxuICAgIC8vICAgdG9rZW5FeHBpcmVzOiA8ZXhwaXJhdGlvbiBkYXRlPiB9LlxuICAgIG1ldGhvZHMuZ2V0TmV3VG9rZW4gPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICBjb25zdCB1c2VyID0gYXdhaXQgYWNjb3VudHMudXNlcnMuZmluZE9uZUFzeW5jKHRoaXMudXNlcklkLCB7XG4gICAgICAgIGZpZWxkczogeyBcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vuc1wiOiAxIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCEgdGhpcy51c2VySWQgfHwgISB1c2VyKSB7XG4gICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXCJZb3UgYXJlIG5vdCBsb2dnZWQgaW4uXCIpO1xuICAgICAgfVxuICAgICAgLy8gQmUgY2FyZWZ1bCBub3QgdG8gZ2VuZXJhdGUgYSBuZXcgdG9rZW4gdGhhdCBoYXMgYSBsYXRlclxuICAgICAgLy8gZXhwaXJhdGlvbiB0aGFuIHRoZSBjdXJyZW4gdG9rZW4uIE90aGVyd2lzZSwgYSBiYWQgZ3V5IHdpdGggYVxuICAgICAgLy8gc3RvbGVuIHRva2VuIGNvdWxkIHVzZSB0aGlzIG1ldGhvZCB0byBzdG9wIGhpcyBzdG9sZW4gdG9rZW4gZnJvbVxuICAgICAgLy8gZXZlciBleHBpcmluZy5cbiAgICAgIGNvbnN0IGN1cnJlbnRIYXNoZWRUb2tlbiA9IGFjY291bnRzLl9nZXRMb2dpblRva2VuKHRoaXMuY29ubmVjdGlvbi5pZCk7XG4gICAgICBjb25zdCBjdXJyZW50U3RhbXBlZFRva2VuID0gdXNlci5zZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMuZmluZChcbiAgICAgICAgc3RhbXBlZFRva2VuID0+IHN0YW1wZWRUb2tlbi5oYXNoZWRUb2tlbiA9PT0gY3VycmVudEhhc2hlZFRva2VuXG4gICAgICApO1xuICAgICAgaWYgKCEgY3VycmVudFN0YW1wZWRUb2tlbikgeyAvLyBzYWZldHkgYmVsdDogdGhpcyBzaG91bGQgbmV2ZXIgaGFwcGVuXG4gICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXCJJbnZhbGlkIGxvZ2luIHRva2VuXCIpO1xuICAgICAgfVxuICAgICAgY29uc3QgbmV3U3RhbXBlZFRva2VuID0gYWNjb3VudHMuX2dlbmVyYXRlU3RhbXBlZExvZ2luVG9rZW4oKTtcbiAgICAgIG5ld1N0YW1wZWRUb2tlbi53aGVuID0gY3VycmVudFN0YW1wZWRUb2tlbi53aGVuO1xuICAgICAgYXdhaXQgYWNjb3VudHMuX2luc2VydExvZ2luVG9rZW4odGhpcy51c2VySWQsIG5ld1N0YW1wZWRUb2tlbik7XG4gICAgICByZXR1cm4gYWNjb3VudHMuX2xvZ2luVXNlcih0aGlzLCB0aGlzLnVzZXJJZCwgbmV3U3RhbXBlZFRva2VuKTtcbiAgICB9O1xuXG4gICAgLy8gUmVtb3ZlcyBhbGwgdG9rZW5zIGV4Y2VwdCB0aGUgdG9rZW4gYXNzb2NpYXRlZCB3aXRoIHRoZSBjdXJyZW50XG4gICAgLy8gY29ubmVjdGlvbi4gVGhyb3dzIGFuIGVycm9yIGlmIHRoZSBjb25uZWN0aW9uIGlzIG5vdCBsb2dnZWRcbiAgICAvLyBpbi4gUmV0dXJucyBub3RoaW5nIG9uIHN1Y2Nlc3MuXG4gICAgbWV0aG9kcy5yZW1vdmVPdGhlclRva2VucyA9IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghIHRoaXMudXNlcklkKSB7XG4gICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXCJZb3UgYXJlIG5vdCBsb2dnZWQgaW4uXCIpO1xuICAgICAgfVxuICAgICAgY29uc3QgY3VycmVudFRva2VuID0gYWNjb3VudHMuX2dldExvZ2luVG9rZW4odGhpcy5jb25uZWN0aW9uLmlkKTtcbiAgICAgIGF3YWl0IGFjY291bnRzLnVzZXJzLnVwZGF0ZUFzeW5jKHRoaXMudXNlcklkLCB7XG4gICAgICAgICRwdWxsOiB7XG4gICAgICAgICAgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNcIjogeyBoYXNoZWRUb2tlbjogeyAkbmU6IGN1cnJlbnRUb2tlbiB9IH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIEFsbG93IGEgb25lLXRpbWUgY29uZmlndXJhdGlvbiBmb3IgYSBsb2dpbiBzZXJ2aWNlLiBNb2RpZmljYXRpb25zXG4gICAgLy8gdG8gdGhpcyBjb2xsZWN0aW9uIGFyZSBhbHNvIGFsbG93ZWQgaW4gaW5zZWN1cmUgbW9kZS5cbiAgICBtZXRob2RzLmNvbmZpZ3VyZUxvZ2luU2VydmljZSA9IGFzeW5jIChvcHRpb25zKSA9PiB7XG4gICAgICBjaGVjayhvcHRpb25zLCBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe3NlcnZpY2U6IFN0cmluZ30pKTtcbiAgICAgIC8vIERvbid0IGxldCByYW5kb20gdXNlcnMgY29uZmlndXJlIGEgc2VydmljZSB3ZSBoYXZlbid0IGFkZGVkIHlldCAoc29cbiAgICAgIC8vIHRoYXQgd2hlbiB3ZSBkbyBsYXRlciBhZGQgaXQsIGl0J3Mgc2V0IHVwIHdpdGggdGhlaXIgY29uZmlndXJhdGlvblxuICAgICAgLy8gaW5zdGVhZCBvZiBvdXJzKS5cbiAgICAgIC8vIFhYWCBpZiBzZXJ2aWNlIGNvbmZpZ3VyYXRpb24gaXMgb2F1dGgtc3BlY2lmaWMgdGhlbiB0aGlzIGNvZGUgc2hvdWxkXG4gICAgICAvLyAgICAgYmUgaW4gYWNjb3VudHMtb2F1dGg7IGlmIGl0J3Mgbm90IHRoZW4gdGhlIHJlZ2lzdHJ5IHNob3VsZCBiZVxuICAgICAgLy8gICAgIGluIHRoaXMgcGFja2FnZVxuICAgICAgaWYgKCEoYWNjb3VudHMub2F1dGhcbiAgICAgICAgJiYgYWNjb3VudHMub2F1dGguc2VydmljZU5hbWVzKCkuaW5jbHVkZXMob3B0aW9ucy5zZXJ2aWNlKSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiU2VydmljZSB1bmtub3duXCIpO1xuICAgICAgfVxuXG4gICAgICBpZiAoUGFja2FnZVsnc2VydmljZS1jb25maWd1cmF0aW9uJ10pIHtcbiAgICAgICAgY29uc3QgeyBTZXJ2aWNlQ29uZmlndXJhdGlvbiB9ID0gUGFja2FnZVsnc2VydmljZS1jb25maWd1cmF0aW9uJ107XG4gICAgICAgIGNvbnN0IHNlcnZpY2UgPSBhd2FpdCBTZXJ2aWNlQ29uZmlndXJhdGlvbi5jb25maWd1cmF0aW9ucy5maW5kT25lQXN5bmMoe3NlcnZpY2U6IG9wdGlvbnMuc2VydmljZX0pXG4gICAgICAgIGlmIChzZXJ2aWNlKVxuICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBgU2VydmljZSAke29wdGlvbnMuc2VydmljZX0gYWxyZWFkeSBjb25maWd1cmVkYCk7XG5cbiAgICAgICAgaWYgKFBhY2thZ2VbXCJvYXV0aC1lbmNyeXB0aW9uXCJdKSB7XG4gICAgICAgICAgY29uc3QgeyBPQXV0aEVuY3J5cHRpb24gfSA9IFBhY2thZ2VbXCJvYXV0aC1lbmNyeXB0aW9uXCJdXG4gICAgICAgICAgaWYgKGhhc093bi5jYWxsKG9wdGlvbnMsICdzZWNyZXQnKSAmJiBPQXV0aEVuY3J5cHRpb24ua2V5SXNMb2FkZWQoKSlcbiAgICAgICAgICAgIG9wdGlvbnMuc2VjcmV0ID0gT0F1dGhFbmNyeXB0aW9uLnNlYWwob3B0aW9ucy5zZWNyZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgU2VydmljZUNvbmZpZ3VyYXRpb24uY29uZmlndXJhdGlvbnMuaW5zZXJ0QXN5bmMob3B0aW9ucyk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGFjY291bnRzLl9zZXJ2ZXIubWV0aG9kcyhtZXRob2RzKTtcbiAgfTtcblxuICBfaW5pdEFjY291bnREYXRhSG9va3MoKSB7XG4gICAgdGhpcy5fc2VydmVyLm9uQ29ubmVjdGlvbihjb25uZWN0aW9uID0+IHtcbiAgICAgIHRoaXMuX2FjY291bnREYXRhW2Nvbm5lY3Rpb24uaWRdID0ge1xuICAgICAgICBjb25uZWN0aW9uOiBjb25uZWN0aW9uXG4gICAgICB9O1xuXG4gICAgICBjb25uZWN0aW9uLm9uQ2xvc2UoKCkgPT4ge1xuICAgICAgICB0aGlzLl9yZW1vdmVUb2tlbkZyb21Db25uZWN0aW9uKGNvbm5lY3Rpb24uaWQpO1xuICAgICAgICBkZWxldGUgdGhpcy5fYWNjb3VudERhdGFbY29ubmVjdGlvbi5pZF07XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcblxuICBfaW5pdFNlcnZlclB1YmxpY2F0aW9ucygpIHtcbiAgICAvLyBCcmluZyBpbnRvIGxleGljYWwgc2NvcGUgZm9yIHB1Ymxpc2ggY2FsbGJhY2tzIHRoYXQgbmVlZCBgdGhpc2BcbiAgICBjb25zdCB7IHVzZXJzLCBfYXV0b3B1Ymxpc2hGaWVsZHMsIF9kZWZhdWx0UHVibGlzaEZpZWxkcyB9ID0gdGhpcztcblxuICAgIC8vIFB1Ymxpc2ggYWxsIGxvZ2luIHNlcnZpY2UgY29uZmlndXJhdGlvbiBmaWVsZHMgb3RoZXIgdGhhbiBzZWNyZXQuXG4gICAgdGhpcy5fc2VydmVyLnB1Ymxpc2goXCJtZXRlb3IubG9naW5TZXJ2aWNlQ29uZmlndXJhdGlvblwiLCBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChQYWNrYWdlWydzZXJ2aWNlLWNvbmZpZ3VyYXRpb24nXSkge1xuICAgICAgICBjb25zdCB7IFNlcnZpY2VDb25maWd1cmF0aW9uIH0gPSBQYWNrYWdlWydzZXJ2aWNlLWNvbmZpZ3VyYXRpb24nXTtcbiAgICAgICAgcmV0dXJuIFNlcnZpY2VDb25maWd1cmF0aW9uLmNvbmZpZ3VyYXRpb25zLmZpbmQoe30sIHtmaWVsZHM6IHtzZWNyZXQ6IDB9fSk7XG4gICAgICB9XG4gICAgICB0aGlzLnJlYWR5KCk7XG4gICAgfSwge2lzX2F1dG86IHRydWV9KTsgLy8gbm90IHRlY2huaWNhbGx5IGF1dG9wdWJsaXNoLCBidXQgc3RvcHMgdGhlIHdhcm5pbmcuXG5cbiAgICAvLyBVc2UgTWV0ZW9yLnN0YXJ0dXAgdG8gZ2l2ZSBvdGhlciBwYWNrYWdlcyBhIGNoYW5jZSB0byBjYWxsXG4gICAgLy8gc2V0RGVmYXVsdFB1Ymxpc2hGaWVsZHMuXG4gICAgTWV0ZW9yLnN0YXJ0dXAoKCkgPT4ge1xuICAgICAgLy8gTWVyZ2UgY3VzdG9tIGZpZWxkcyBzZWxlY3RvciBhbmQgZGVmYXVsdCBwdWJsaXNoIGZpZWxkcyBzbyB0aGF0IHRoZSBjbGllbnRcbiAgICAgIC8vIGdldHMgYWxsIHRoZSBuZWNlc3NhcnkgZmllbGRzIHRvIHJ1biBwcm9wZXJseVxuICAgICAgY29uc3QgY3VzdG9tRmllbGRzID0gdGhpcy5fYWRkRGVmYXVsdEZpZWxkU2VsZWN0b3IoKS5maWVsZHMgfHwge307XG4gICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMoY3VzdG9tRmllbGRzKTtcbiAgICAgIC8vIElmIHRoZSBjdXN0b20gZmllbGRzIGFyZSBuZWdhdGl2ZSwgdGhlbiBpZ25vcmUgdGhlbSBhbmQgb25seSBzZW5kIHRoZSBuZWNlc3NhcnkgZmllbGRzXG4gICAgICBjb25zdCBmaWVsZHMgPSBrZXlzLmxlbmd0aCA+IDAgJiYgY3VzdG9tRmllbGRzW2tleXNbMF1dID8ge1xuICAgICAgICAuLi50aGlzLl9hZGREZWZhdWx0RmllbGRTZWxlY3RvcigpLmZpZWxkcyxcbiAgICAgICAgLi4uX2RlZmF1bHRQdWJsaXNoRmllbGRzLnByb2plY3Rpb25cbiAgICAgIH0gOiBfZGVmYXVsdFB1Ymxpc2hGaWVsZHMucHJvamVjdGlvblxuICAgICAgLy8gUHVibGlzaCB0aGUgY3VycmVudCB1c2VyJ3MgcmVjb3JkIHRvIHRoZSBjbGllbnQuXG4gICAgICB0aGlzLl9zZXJ2ZXIucHVibGlzaChudWxsLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLnVzZXJJZCkge1xuICAgICAgICAgIHJldHVybiB1c2Vycy5maW5kKHtcbiAgICAgICAgICAgIF9pZDogdGhpcy51c2VySWRcbiAgICAgICAgICB9LCB7XG4gICAgICAgICAgICBmaWVsZHMsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0sIC8qc3VwcHJlc3MgYXV0b3B1Ymxpc2ggd2FybmluZyove2lzX2F1dG86IHRydWV9KTtcbiAgICB9KTtcblxuICAgIC8vIFVzZSBNZXRlb3Iuc3RhcnR1cCB0byBnaXZlIG90aGVyIHBhY2thZ2VzIGEgY2hhbmNlIHRvIGNhbGxcbiAgICAvLyBhZGRBdXRvcHVibGlzaEZpZWxkcy5cbiAgICBQYWNrYWdlLmF1dG9wdWJsaXNoICYmIE1ldGVvci5zdGFydHVwKCgpID0+IHtcbiAgICAgIC8vIFsncHJvZmlsZScsICd1c2VybmFtZSddIC0+IHtwcm9maWxlOiAxLCB1c2VybmFtZTogMX1cbiAgICAgIGNvbnN0IHRvRmllbGRTZWxlY3RvciA9IGZpZWxkcyA9PiBmaWVsZHMucmVkdWNlKChwcmV2LCBmaWVsZCkgPT4gKFxuICAgICAgICAgIHsgLi4ucHJldiwgW2ZpZWxkXTogMSB9KSxcbiAgICAgICAge31cbiAgICAgICk7XG4gICAgICB0aGlzLl9zZXJ2ZXIucHVibGlzaChudWxsLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLnVzZXJJZCkge1xuICAgICAgICAgIHJldHVybiB1c2Vycy5maW5kKHsgX2lkOiB0aGlzLnVzZXJJZCB9LCB7XG4gICAgICAgICAgICBmaWVsZHM6IHRvRmllbGRTZWxlY3RvcihfYXV0b3B1Ymxpc2hGaWVsZHMubG9nZ2VkSW5Vc2VyKSxcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9LCAvKnN1cHByZXNzIGF1dG9wdWJsaXNoIHdhcm5pbmcqL3tpc19hdXRvOiB0cnVlfSk7XG5cbiAgICAgIC8vIFhYWCB0aGlzIHB1Ymxpc2ggaXMgbmVpdGhlciBkZWR1cC1hYmxlIG5vciBpcyBpdCBvcHRpbWl6ZWQgYnkgb3VyIHNwZWNpYWxcbiAgICAgIC8vIHRyZWF0bWVudCBvZiBxdWVyaWVzIG9uIGEgc3BlY2lmaWMgX2lkLiBUaGVyZWZvcmUgdGhpcyB3aWxsIGhhdmUgTyhuXjIpXG4gICAgICAvLyBydW4tdGltZSBwZXJmb3JtYW5jZSBldmVyeSB0aW1lIGEgdXNlciBkb2N1bWVudCBpcyBjaGFuZ2VkIChlZyBzb21lb25lXG4gICAgICAvLyBsb2dnaW5nIGluKS4gSWYgdGhpcyBpcyBhIHByb2JsZW0sIHdlIGNhbiBpbnN0ZWFkIHdyaXRlIGEgbWFudWFsIHB1Ymxpc2hcbiAgICAgIC8vIGZ1bmN0aW9uIHdoaWNoIGZpbHRlcnMgb3V0IGZpZWxkcyBiYXNlZCBvbiAndGhpcy51c2VySWQnLlxuICAgICAgdGhpcy5fc2VydmVyLnB1Ymxpc2gobnVsbCwgZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBzZWxlY3RvciA9IHRoaXMudXNlcklkID8geyBfaWQ6IHsgJG5lOiB0aGlzLnVzZXJJZCB9IH0gOiB7fTtcbiAgICAgICAgcmV0dXJuIHVzZXJzLmZpbmQoc2VsZWN0b3IsIHtcbiAgICAgICAgICBmaWVsZHM6IHRvRmllbGRTZWxlY3RvcihfYXV0b3B1Ymxpc2hGaWVsZHMub3RoZXJVc2VycyksXG4gICAgICAgIH0pXG4gICAgICB9LCAvKnN1cHByZXNzIGF1dG9wdWJsaXNoIHdhcm5pbmcqL3tpc19hdXRvOiB0cnVlfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gQWRkIHRvIHRoZSBsaXN0IG9mIGZpZWxkcyBvciBzdWJmaWVsZHMgdG8gYmUgYXV0b21hdGljYWxseVxuICAvLyBwdWJsaXNoZWQgaWYgYXV0b3B1Ymxpc2ggaXMgb24uIE11c3QgYmUgY2FsbGVkIGZyb20gdG9wLWxldmVsXG4gIC8vIGNvZGUgKGllLCBiZWZvcmUgTWV0ZW9yLnN0YXJ0dXAgaG9va3MgcnVuKS5cbiAgLy9cbiAgLy8gQHBhcmFtIG9wdHMge09iamVjdH0gd2l0aDpcbiAgLy8gICAtIGZvckxvZ2dlZEluVXNlciB7QXJyYXl9IEFycmF5IG9mIGZpZWxkcyBwdWJsaXNoZWQgdG8gdGhlIGxvZ2dlZC1pbiB1c2VyXG4gIC8vICAgLSBmb3JPdGhlclVzZXJzIHtBcnJheX0gQXJyYXkgb2YgZmllbGRzIHB1Ymxpc2hlZCB0byB1c2VycyB0aGF0IGFyZW4ndCBsb2dnZWQgaW5cbiAgYWRkQXV0b3B1Ymxpc2hGaWVsZHMob3B0cykge1xuICAgIHRoaXMuX2F1dG9wdWJsaXNoRmllbGRzLmxvZ2dlZEluVXNlci5wdXNoLmFwcGx5KFxuICAgICAgdGhpcy5fYXV0b3B1Ymxpc2hGaWVsZHMubG9nZ2VkSW5Vc2VyLCBvcHRzLmZvckxvZ2dlZEluVXNlcik7XG4gICAgdGhpcy5fYXV0b3B1Ymxpc2hGaWVsZHMub3RoZXJVc2Vycy5wdXNoLmFwcGx5KFxuICAgICAgdGhpcy5fYXV0b3B1Ymxpc2hGaWVsZHMub3RoZXJVc2Vycywgb3B0cy5mb3JPdGhlclVzZXJzKTtcbiAgfTtcblxuICAvLyBSZXBsYWNlcyB0aGUgZmllbGRzIHRvIGJlIGF1dG9tYXRpY2FsbHlcbiAgLy8gcHVibGlzaGVkIHdoZW4gdGhlIHVzZXIgbG9ncyBpblxuICAvL1xuICAvLyBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IGZpZWxkcyBEaWN0aW9uYXJ5IG9mIGZpZWxkcyB0byByZXR1cm4gb3IgZXhjbHVkZS5cbiAgc2V0RGVmYXVsdFB1Ymxpc2hGaWVsZHMoZmllbGRzKSB7XG4gICAgdGhpcy5fZGVmYXVsdFB1Ymxpc2hGaWVsZHMucHJvamVjdGlvbiA9IGZpZWxkcztcbiAgfTtcblxuICAvLy9cbiAgLy8vIEFDQ09VTlQgREFUQVxuICAvLy9cblxuICAvLyBIQUNLOiBUaGlzIGlzIHVzZWQgYnkgJ21ldGVvci1hY2NvdW50cycgdG8gZ2V0IHRoZSBsb2dpblRva2VuIGZvciBhXG4gIC8vIGNvbm5lY3Rpb24uIE1heWJlIHRoZXJlIHNob3VsZCBiZSBhIHB1YmxpYyB3YXkgdG8gZG8gdGhhdC5cbiAgX2dldEFjY291bnREYXRhKGNvbm5lY3Rpb25JZCwgZmllbGQpIHtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5fYWNjb3VudERhdGFbY29ubmVjdGlvbklkXTtcbiAgICByZXR1cm4gZGF0YSAmJiBkYXRhW2ZpZWxkXTtcbiAgfTtcblxuICBfc2V0QWNjb3VudERhdGEoY29ubmVjdGlvbklkLCBmaWVsZCwgdmFsdWUpIHtcbiAgICBjb25zdCBkYXRhID0gdGhpcy5fYWNjb3VudERhdGFbY29ubmVjdGlvbklkXTtcblxuICAgIC8vIHNhZmV0eSBiZWx0LiBzaG91bGRuJ3QgaGFwcGVuLiBhY2NvdW50RGF0YSBpcyBzZXQgaW4gb25Db25uZWN0aW9uLFxuICAgIC8vIHdlIGRvbid0IGhhdmUgYSBjb25uZWN0aW9uSWQgdW50aWwgaXQgaXMgc2V0LlxuICAgIGlmICghZGF0YSlcbiAgICAgIHJldHVybjtcblxuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKVxuICAgICAgZGVsZXRlIGRhdGFbZmllbGRdO1xuICAgIGVsc2VcbiAgICAgIGRhdGFbZmllbGRdID0gdmFsdWU7XG4gIH07XG5cbiAgLy8vXG4gIC8vLyBSRUNPTk5FQ1QgVE9LRU5TXG4gIC8vL1xuICAvLy8gc3VwcG9ydCByZWNvbm5lY3RpbmcgdXNpbmcgYSBtZXRlb3IgbG9naW4gdG9rZW5cblxuICBfaGFzaExvZ2luVG9rZW4obG9naW5Ub2tlbikge1xuICAgIGNvbnN0IGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMjU2Jyk7XG4gICAgaGFzaC51cGRhdGUobG9naW5Ub2tlbik7XG4gICAgcmV0dXJuIGhhc2guZGlnZXN0KCdiYXNlNjQnKTtcbiAgfTtcblxuICAvLyB7dG9rZW4sIHdoZW59ID0+IHtoYXNoZWRUb2tlbiwgd2hlbn1cbiAgX2hhc2hTdGFtcGVkVG9rZW4oc3RhbXBlZFRva2VuKSB7XG4gICAgY29uc3QgeyB0b2tlbiwgLi4uaGFzaGVkU3RhbXBlZFRva2VuIH0gPSBzdGFtcGVkVG9rZW47XG4gICAgcmV0dXJuIHtcbiAgICAgIC4uLmhhc2hlZFN0YW1wZWRUb2tlbixcbiAgICAgIGhhc2hlZFRva2VuOiB0aGlzLl9oYXNoTG9naW5Ub2tlbih0b2tlbilcbiAgICB9O1xuICB9O1xuXG4gIC8vIFVzaW5nICRhZGRUb1NldCBhdm9pZHMgZ2V0dGluZyBhbiBpbmRleCBlcnJvciBpZiBhbm90aGVyIGNsaWVudFxuICAvLyBsb2dnaW5nIGluIHNpbXVsdGFuZW91c2x5IGhhcyBhbHJlYWR5IGluc2VydGVkIHRoZSBuZXcgaGFzaGVkXG4gIC8vIHRva2VuLlxuICBhc3luYyBfaW5zZXJ0SGFzaGVkTG9naW5Ub2tlbih1c2VySWQsIGhhc2hlZFRva2VuLCBxdWVyeSkge1xuICAgIHF1ZXJ5ID0gcXVlcnkgPyB7IC4uLnF1ZXJ5IH0gOiB7fTtcbiAgICBxdWVyeS5faWQgPSB1c2VySWQ7XG4gICAgYXdhaXQgdGhpcy51c2Vycy51cGRhdGVBc3luYyhxdWVyeSwge1xuICAgICAgJGFkZFRvU2V0OiB7XG4gICAgICAgIFwic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zXCI6IGhhc2hlZFRva2VuXG4gICAgICB9XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gRXhwb3J0ZWQgZm9yIHRlc3RzLlxuICBhc3luYyBfaW5zZXJ0TG9naW5Ub2tlbih1c2VySWQsIHN0YW1wZWRUb2tlbiwgcXVlcnkpIHtcbiAgICBhd2FpdCB0aGlzLl9pbnNlcnRIYXNoZWRMb2dpblRva2VuKFxuICAgICAgdXNlcklkLFxuICAgICAgdGhpcy5faGFzaFN0YW1wZWRUb2tlbihzdGFtcGVkVG9rZW4pLFxuICAgICAgcXVlcnlcbiAgICApO1xuICB9O1xuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gdXNlcklkXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICAgKi9cbiAgX2NsZWFyQWxsTG9naW5Ub2tlbnModXNlcklkKSB7XG4gICAgdGhpcy51c2Vycy51cGRhdGVBc3luYyh1c2VySWQsIHtcbiAgICAgICRzZXQ6IHtcbiAgICAgICAgJ3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucyc6IFtdLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfTtcblxuICAvLyB0ZXN0IGhvb2tcbiAgX2dldFVzZXJPYnNlcnZlKGNvbm5lY3Rpb25JZCkge1xuICAgIHJldHVybiB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uSWRdO1xuICB9O1xuXG4gIC8vIENsZWFuIHVwIHRoaXMgY29ubmVjdGlvbidzIGFzc29jaWF0aW9uIHdpdGggdGhlIHRva2VuOiB0aGF0IGlzLCBzdG9wXG4gIC8vIHRoZSBvYnNlcnZlIHRoYXQgd2Ugc3RhcnRlZCB3aGVuIHdlIGFzc29jaWF0ZWQgdGhlIGNvbm5lY3Rpb24gd2l0aFxuICAvLyB0aGlzIHRva2VuLlxuICBfcmVtb3ZlVG9rZW5Gcm9tQ29ubmVjdGlvbihjb25uZWN0aW9uSWQpIHtcbiAgICBpZiAoaGFzT3duLmNhbGwodGhpcy5fdXNlck9ic2VydmVzRm9yQ29ubmVjdGlvbnMsIGNvbm5lY3Rpb25JZCkpIHtcbiAgICAgIGNvbnN0IG9ic2VydmUgPSB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uSWRdO1xuICAgICAgaWYgKHR5cGVvZiBvYnNlcnZlID09PSAnbnVtYmVyJykge1xuICAgICAgICAvLyBXZSdyZSBpbiB0aGUgcHJvY2VzcyBvZiBzZXR0aW5nIHVwIGFuIG9ic2VydmUgZm9yIHRoaXMgY29ubmVjdGlvbi4gV2VcbiAgICAgICAgLy8gY2FuJ3QgY2xlYW4gdXAgdGhhdCBvYnNlcnZlIHlldCwgYnV0IGlmIHdlIGRlbGV0ZSB0aGUgcGxhY2Vob2xkZXIgZm9yXG4gICAgICAgIC8vIHRoaXMgY29ubmVjdGlvbiwgdGhlbiB0aGUgb2JzZXJ2ZSB3aWxsIGdldCBjbGVhbmVkIHVwIGFzIHNvb24gYXMgaXQgaGFzXG4gICAgICAgIC8vIGJlZW4gc2V0IHVwLlxuICAgICAgICBkZWxldGUgdGhpcy5fdXNlck9ic2VydmVzRm9yQ29ubmVjdGlvbnNbY29ubmVjdGlvbklkXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uSWRdO1xuICAgICAgICBvYnNlcnZlLnN0b3AoKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgX2dldExvZ2luVG9rZW4oY29ubmVjdGlvbklkKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldEFjY291bnREYXRhKGNvbm5lY3Rpb25JZCwgJ2xvZ2luVG9rZW4nKTtcbiAgfTtcblxuICAvLyBuZXdUb2tlbiBpcyBhIGhhc2hlZCB0b2tlbi5cbiAgX3NldExvZ2luVG9rZW4odXNlcklkLCBjb25uZWN0aW9uLCBuZXdUb2tlbikge1xuICAgIHRoaXMuX3JlbW92ZVRva2VuRnJvbUNvbm5lY3Rpb24oY29ubmVjdGlvbi5pZCk7XG4gICAgdGhpcy5fc2V0QWNjb3VudERhdGEoY29ubmVjdGlvbi5pZCwgJ2xvZ2luVG9rZW4nLCBuZXdUb2tlbik7XG5cbiAgICBpZiAobmV3VG9rZW4pIHtcbiAgICAgIC8vIFNldCB1cCBhbiBvYnNlcnZlIGZvciB0aGlzIHRva2VuLiBJZiB0aGUgdG9rZW4gZ29lcyBhd2F5LCB3ZSBuZWVkXG4gICAgICAvLyB0byBjbG9zZSB0aGUgY29ubmVjdGlvbi4gIFdlIGRlZmVyIHRoZSBvYnNlcnZlIGJlY2F1c2UgdGhlcmUnc1xuICAgICAgLy8gbm8gbmVlZCBmb3IgaXQgdG8gYmUgb24gdGhlIGNyaXRpY2FsIHBhdGggZm9yIGxvZ2luOyB3ZSBqdXN0IG5lZWRcbiAgICAgIC8vIHRvIGVuc3VyZSB0aGF0IHRoZSBjb25uZWN0aW9uIHdpbGwgZ2V0IGNsb3NlZCBhdCBzb21lIHBvaW50IGlmXG4gICAgICAvLyB0aGUgdG9rZW4gZ2V0cyBkZWxldGVkLlxuICAgICAgLy9cbiAgICAgIC8vIEluaXRpYWxseSwgd2Ugc2V0IHRoZSBvYnNlcnZlIGZvciB0aGlzIGNvbm5lY3Rpb24gdG8gYSBudW1iZXI7IHRoaXNcbiAgICAgIC8vIHNpZ25pZmllcyB0byBvdGhlciBjb2RlICh3aGljaCBtaWdodCBydW4gd2hpbGUgd2UgeWllbGQpIHRoYXQgd2UgYXJlIGluXG4gICAgICAvLyB0aGUgcHJvY2VzcyBvZiBzZXR0aW5nIHVwIGFuIG9ic2VydmUgZm9yIHRoaXMgY29ubmVjdGlvbi4gT25jZSB0aGVcbiAgICAgIC8vIG9ic2VydmUgaXMgcmVhZHkgdG8gZ28sIHdlIHJlcGxhY2UgdGhlIG51bWJlciB3aXRoIHRoZSByZWFsIG9ic2VydmVcbiAgICAgIC8vIGhhbmRsZSAodW5sZXNzIHRoZSBwbGFjZWhvbGRlciBoYXMgYmVlbiBkZWxldGVkIG9yIHJlcGxhY2VkIGJ5IGFcbiAgICAgIC8vIGRpZmZlcmVudCBwbGFjZWhvbGQgbnVtYmVyLCBzaWduaWZ5aW5nIHRoYXQgdGhlIGNvbm5lY3Rpb24gd2FzIGNsb3NlZFxuICAgICAgLy8gYWxyZWFkeSAtLSBpbiB0aGlzIGNhc2Ugd2UganVzdCBjbGVhbiB1cCB0aGUgb2JzZXJ2ZSB0aGF0IHdlIHN0YXJ0ZWQpLlxuICAgICAgY29uc3QgbXlPYnNlcnZlTnVtYmVyID0gKyt0aGlzLl9uZXh0VXNlck9ic2VydmVOdW1iZXI7XG4gICAgICB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXSA9IG15T2JzZXJ2ZU51bWJlcjtcbiAgICAgIE1ldGVvci5kZWZlcihhc3luYyAoKSA9PiB7XG4gICAgICAgIC8vIElmIHNvbWV0aGluZyBlbHNlIGhhcHBlbmVkIG9uIHRoaXMgY29ubmVjdGlvbiBpbiB0aGUgbWVhbnRpbWUgKGl0IGdvdFxuICAgICAgICAvLyBjbG9zZWQsIG9yIGFub3RoZXIgY2FsbCB0byBfc2V0TG9naW5Ub2tlbiBoYXBwZW5lZCksIGp1c3QgZG9cbiAgICAgICAgLy8gbm90aGluZy4gV2UgZG9uJ3QgbmVlZCB0byBzdGFydCBhbiBvYnNlcnZlIGZvciBhbiBvbGQgY29ubmVjdGlvbiBvciBvbGRcbiAgICAgICAgLy8gdG9rZW4uXG4gICAgICAgIGlmICh0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXSAhPT0gbXlPYnNlcnZlTnVtYmVyKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGZvdW5kTWF0Y2hpbmdVc2VyO1xuICAgICAgICAvLyBCZWNhdXNlIHdlIHVwZ3JhZGUgdW5oYXNoZWQgbG9naW4gdG9rZW5zIHRvIGhhc2hlZCB0b2tlbnMgYXRcbiAgICAgICAgLy8gbG9naW4gdGltZSwgc2Vzc2lvbnMgd2lsbCBvbmx5IGJlIGxvZ2dlZCBpbiB3aXRoIGEgaGFzaGVkXG4gICAgICAgIC8vIHRva2VuLiBUaHVzIHdlIG9ubHkgbmVlZCB0byBvYnNlcnZlIGhhc2hlZCB0b2tlbnMgaGVyZS5cbiAgICAgICAgY29uc3Qgb2JzZXJ2ZSA9IGF3YWl0IHRoaXMudXNlcnMuZmluZCh7XG4gICAgICAgICAgX2lkOiB1c2VySWQsXG4gICAgICAgICAgJ3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy5oYXNoZWRUb2tlbic6IG5ld1Rva2VuXG4gICAgICAgIH0sIHsgZmllbGRzOiB7IF9pZDogMSB9IH0pLm9ic2VydmVDaGFuZ2VzKHtcbiAgICAgICAgICBhZGRlZDogKCkgPT4ge1xuICAgICAgICAgICAgZm91bmRNYXRjaGluZ1VzZXIgPSB0cnVlO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgcmVtb3ZlZDogY29ubmVjdGlvbi5jbG9zZSxcbiAgICAgICAgICAvLyBUaGUgb25DbG9zZSBjYWxsYmFjayBmb3IgdGhlIGNvbm5lY3Rpb24gdGFrZXMgY2FyZSBvZlxuICAgICAgICAgIC8vIGNsZWFuaW5nIHVwIHRoZSBvYnNlcnZlIGhhbmRsZSBhbmQgYW55IG90aGVyIHN0YXRlIHdlIGhhdmVcbiAgICAgICAgICAvLyBseWluZyBhcm91bmQuXG4gICAgICAgIH0sIHsgbm9uTXV0YXRpbmdDYWxsYmFja3M6IHRydWUgfSk7XG5cbiAgICAgICAgLy8gSWYgdGhlIHVzZXIgcmFuIGFub3RoZXIgbG9naW4gb3IgbG9nb3V0IGNvbW1hbmQgd2Ugd2VyZSB3YWl0aW5nIGZvciB0aGVcbiAgICAgICAgLy8gZGVmZXIgb3IgYWRkZWQgdG8gZmlyZSAoaWUsIGFub3RoZXIgY2FsbCB0byBfc2V0TG9naW5Ub2tlbiBvY2N1cnJlZCksXG4gICAgICAgIC8vIHRoZW4gd2UgbGV0IHRoZSBsYXRlciBvbmUgd2luIChzdGFydCBhbiBvYnNlcnZlLCBldGMpIGFuZCBqdXN0IHN0b3Agb3VyXG4gICAgICAgIC8vIG9ic2VydmUgbm93LlxuICAgICAgICAvL1xuICAgICAgICAvLyBTaW1pbGFybHksIGlmIHRoZSBjb25uZWN0aW9uIHdhcyBhbHJlYWR5IGNsb3NlZCwgdGhlbiB0aGUgb25DbG9zZVxuICAgICAgICAvLyBjYWxsYmFjayB3b3VsZCBoYXZlIGNhbGxlZCBfcmVtb3ZlVG9rZW5Gcm9tQ29ubmVjdGlvbiBhbmQgdGhlcmUgd29uJ3RcbiAgICAgICAgLy8gYmUgYW4gZW50cnkgaW4gX3VzZXJPYnNlcnZlc0ZvckNvbm5lY3Rpb25zLiBXZSBjYW4gc3RvcCB0aGUgb2JzZXJ2ZS5cbiAgICAgICAgaWYgKHRoaXMuX3VzZXJPYnNlcnZlc0ZvckNvbm5lY3Rpb25zW2Nvbm5lY3Rpb24uaWRdICE9PSBteU9ic2VydmVOdW1iZXIpIHtcbiAgICAgICAgICBvYnNlcnZlLnN0b3AoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91c2VyT2JzZXJ2ZXNGb3JDb25uZWN0aW9uc1tjb25uZWN0aW9uLmlkXSA9IG9ic2VydmU7XG5cbiAgICAgICAgaWYgKCEgZm91bmRNYXRjaGluZ1VzZXIpIHtcbiAgICAgICAgICAvLyBXZSd2ZSBzZXQgdXAgYW4gb2JzZXJ2ZSBvbiB0aGUgdXNlciBhc3NvY2lhdGVkIHdpdGggYG5ld1Rva2VuYCxcbiAgICAgICAgICAvLyBzbyBpZiB0aGUgbmV3IHRva2VuIGlzIHJlbW92ZWQgZnJvbSB0aGUgZGF0YWJhc2UsIHdlJ2xsIGNsb3NlXG4gICAgICAgICAgLy8gdGhlIGNvbm5lY3Rpb24uIEJ1dCB0aGUgdG9rZW4gbWlnaHQgaGF2ZSBhbHJlYWR5IGJlZW4gZGVsZXRlZFxuICAgICAgICAgIC8vIGJlZm9yZSB3ZSBzZXQgdXAgdGhlIG9ic2VydmUsIHdoaWNoIHdvdWxkbid0IGhhdmUgY2xvc2VkIHRoZVxuICAgICAgICAgIC8vIGNvbm5lY3Rpb24gYmVjYXVzZSB0aGUgb2JzZXJ2ZSB3YXNuJ3QgcnVubmluZyB5ZXQuXG4gICAgICAgICAgY29ubmVjdGlvbi5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG5cbiAgLy8gKEFsc28gdXNlZCBieSBNZXRlb3IgQWNjb3VudHMgc2VydmVyIGFuZCB0ZXN0cykuXG4gIC8vXG4gIF9nZW5lcmF0ZVN0YW1wZWRMb2dpblRva2VuKCkge1xuICAgIHJldHVybiB7XG4gICAgICB0b2tlbjogUmFuZG9tLnNlY3JldCgpLFxuICAgICAgd2hlbjogbmV3IERhdGVcbiAgICB9O1xuICB9O1xuXG4gIC8vL1xuICAvLy8gVE9LRU4gRVhQSVJBVElPTlxuICAvLy9cblxuICAvLyBEZWxldGVzIGV4cGlyZWQgcGFzc3dvcmQgcmVzZXQgdG9rZW5zIGZyb20gdGhlIGRhdGFiYXNlLlxuICAvL1xuICAvLyBFeHBvcnRlZCBmb3IgdGVzdHMuIEFsc28sIHRoZSBhcmd1bWVudHMgYXJlIG9ubHkgdXNlZCBieVxuICAvLyB0ZXN0cy4gb2xkZXN0VmFsaWREYXRlIGlzIHNpbXVsYXRlIGV4cGlyaW5nIHRva2VucyB3aXRob3V0IHdhaXRpbmdcbiAgLy8gZm9yIHRoZW0gdG8gYWN0dWFsbHkgZXhwaXJlLiB1c2VySWQgaXMgdXNlZCBieSB0ZXN0cyB0byBvbmx5IGV4cGlyZVxuICAvLyB0b2tlbnMgZm9yIHRoZSB0ZXN0IHVzZXIuXG4gIGFzeW5jIF9leHBpcmVQYXNzd29yZFJlc2V0VG9rZW5zKG9sZGVzdFZhbGlkRGF0ZSwgdXNlcklkKSB7XG4gICAgY29uc3QgdG9rZW5MaWZldGltZU1zID0gdGhpcy5fZ2V0UGFzc3dvcmRSZXNldFRva2VuTGlmZXRpbWVNcygpO1xuXG4gICAgLy8gd2hlbiBjYWxsaW5nIGZyb20gYSB0ZXN0IHdpdGggZXh0cmEgYXJndW1lbnRzLCB5b3UgbXVzdCBzcGVjaWZ5IGJvdGghXG4gICAgaWYgKChvbGRlc3RWYWxpZERhdGUgJiYgIXVzZXJJZCkgfHwgKCFvbGRlc3RWYWxpZERhdGUgJiYgdXNlcklkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQmFkIHRlc3QuIE11c3Qgc3BlY2lmeSBib3RoIG9sZGVzdFZhbGlkRGF0ZSBhbmQgdXNlcklkLlwiKTtcbiAgICB9XG5cbiAgICBvbGRlc3RWYWxpZERhdGUgPSBvbGRlc3RWYWxpZERhdGUgfHxcbiAgICAgIChuZXcgRGF0ZShuZXcgRGF0ZSgpIC0gdG9rZW5MaWZldGltZU1zKSk7XG5cbiAgICBjb25zdCB0b2tlbkZpbHRlciA9IHtcbiAgICAgICRvcjogW1xuICAgICAgICB7IFwic2VydmljZXMucGFzc3dvcmQucmVzZXQucmVhc29uXCI6IFwicmVzZXRcIn0sXG4gICAgICAgIHsgXCJzZXJ2aWNlcy5wYXNzd29yZC5yZXNldC5yZWFzb25cIjogeyRleGlzdHM6IGZhbHNlfX1cbiAgICAgIF1cbiAgICB9O1xuXG4gICBhd2FpdCBleHBpcmVQYXNzd29yZFRva2VuKHRoaXMsIG9sZGVzdFZhbGlkRGF0ZSwgdG9rZW5GaWx0ZXIsIHVzZXJJZCk7XG4gIH1cblxuICAvLyBEZWxldGVzIGV4cGlyZWQgcGFzc3dvcmQgZW5yb2xsIHRva2VucyBmcm9tIHRoZSBkYXRhYmFzZS5cbiAgLy9cbiAgLy8gRXhwb3J0ZWQgZm9yIHRlc3RzLiBBbHNvLCB0aGUgYXJndW1lbnRzIGFyZSBvbmx5IHVzZWQgYnlcbiAgLy8gdGVzdHMuIG9sZGVzdFZhbGlkRGF0ZSBpcyBzaW11bGF0ZSBleHBpcmluZyB0b2tlbnMgd2l0aG91dCB3YWl0aW5nXG4gIC8vIGZvciB0aGVtIHRvIGFjdHVhbGx5IGV4cGlyZS4gdXNlcklkIGlzIHVzZWQgYnkgdGVzdHMgdG8gb25seSBleHBpcmVcbiAgLy8gdG9rZW5zIGZvciB0aGUgdGVzdCB1c2VyLlxuICBhc3luYyBfZXhwaXJlUGFzc3dvcmRFbnJvbGxUb2tlbnMob2xkZXN0VmFsaWREYXRlLCB1c2VySWQpIHtcbiAgICBjb25zdCB0b2tlbkxpZmV0aW1lTXMgPSB0aGlzLl9nZXRQYXNzd29yZEVucm9sbFRva2VuTGlmZXRpbWVNcygpO1xuXG4gICAgLy8gd2hlbiBjYWxsaW5nIGZyb20gYSB0ZXN0IHdpdGggZXh0cmEgYXJndW1lbnRzLCB5b3UgbXVzdCBzcGVjaWZ5IGJvdGghXG4gICAgaWYgKChvbGRlc3RWYWxpZERhdGUgJiYgIXVzZXJJZCkgfHwgKCFvbGRlc3RWYWxpZERhdGUgJiYgdXNlcklkKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQmFkIHRlc3QuIE11c3Qgc3BlY2lmeSBib3RoIG9sZGVzdFZhbGlkRGF0ZSBhbmQgdXNlcklkLlwiKTtcbiAgICB9XG5cbiAgICBvbGRlc3RWYWxpZERhdGUgPSBvbGRlc3RWYWxpZERhdGUgfHxcbiAgICAgIChuZXcgRGF0ZShuZXcgRGF0ZSgpIC0gdG9rZW5MaWZldGltZU1zKSk7XG5cbiAgICBjb25zdCB0b2tlbkZpbHRlciA9IHtcbiAgICAgIFwic2VydmljZXMucGFzc3dvcmQuZW5yb2xsLnJlYXNvblwiOiBcImVucm9sbFwiXG4gICAgfTtcblxuICAgIGF3YWl0IGV4cGlyZVBhc3N3b3JkVG9rZW4odGhpcywgb2xkZXN0VmFsaWREYXRlLCB0b2tlbkZpbHRlciwgdXNlcklkKTtcbiAgfVxuXG4gIC8vIERlbGV0ZXMgZXhwaXJlZCB0b2tlbnMgZnJvbSB0aGUgZGF0YWJhc2UgYW5kIGNsb3NlcyBhbGwgb3BlbiBjb25uZWN0aW9uc1xuICAvLyBhc3NvY2lhdGVkIHdpdGggdGhlc2UgdG9rZW5zLlxuICAvL1xuICAvLyBFeHBvcnRlZCBmb3IgdGVzdHMuIEFsc28sIHRoZSBhcmd1bWVudHMgYXJlIG9ubHkgdXNlZCBieVxuICAvLyB0ZXN0cy4gb2xkZXN0VmFsaWREYXRlIGlzIHNpbXVsYXRlIGV4cGlyaW5nIHRva2VucyB3aXRob3V0IHdhaXRpbmdcbiAgLy8gZm9yIHRoZW0gdG8gYWN0dWFsbHkgZXhwaXJlLiB1c2VySWQgaXMgdXNlZCBieSB0ZXN0cyB0byBvbmx5IGV4cGlyZVxuICAvLyB0b2tlbnMgZm9yIHRoZSB0ZXN0IHVzZXIuXG4gIC8qKlxuICAgKlxuICAgKiBAcGFyYW0gb2xkZXN0VmFsaWREYXRlXG4gICAqIEBwYXJhbSB1c2VySWRcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7UHJvbWlzZTx2b2lkPn1cbiAgICovXG4gIGFzeW5jIF9leHBpcmVUb2tlbnMob2xkZXN0VmFsaWREYXRlLCB1c2VySWQpIHtcbiAgICBjb25zdCB0b2tlbkxpZmV0aW1lTXMgPSB0aGlzLl9nZXRUb2tlbkxpZmV0aW1lTXMoKTtcblxuICAgIC8vIHdoZW4gY2FsbGluZyBmcm9tIGEgdGVzdCB3aXRoIGV4dHJhIGFyZ3VtZW50cywgeW91IG11c3Qgc3BlY2lmeSBib3RoIVxuICAgIGlmICgob2xkZXN0VmFsaWREYXRlICYmICF1c2VySWQpIHx8ICghb2xkZXN0VmFsaWREYXRlICYmIHVzZXJJZCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkJhZCB0ZXN0LiBNdXN0IHNwZWNpZnkgYm90aCBvbGRlc3RWYWxpZERhdGUgYW5kIHVzZXJJZC5cIik7XG4gICAgfVxuXG4gICAgb2xkZXN0VmFsaWREYXRlID0gb2xkZXN0VmFsaWREYXRlIHx8XG4gICAgICAobmV3IERhdGUobmV3IERhdGUoKSAtIHRva2VuTGlmZXRpbWVNcykpO1xuICAgIGNvbnN0IHVzZXJGaWx0ZXIgPSB1c2VySWQgPyB7X2lkOiB1c2VySWR9IDoge307XG5cblxuICAgIC8vIEJhY2t3YXJkcyBjb21wYXRpYmxlIHdpdGggb2xkZXIgdmVyc2lvbnMgb2YgbWV0ZW9yIHRoYXQgc3RvcmVkIGxvZ2luIHRva2VuXG4gICAgLy8gdGltZXN0YW1wcyBhcyBudW1iZXJzLlxuICAgIGF3YWl0IHRoaXMudXNlcnMudXBkYXRlQXN5bmMoeyAuLi51c2VyRmlsdGVyLFxuICAgICAgJG9yOiBbXG4gICAgICAgIHsgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMud2hlblwiOiB7ICRsdDogb2xkZXN0VmFsaWREYXRlIH0gfSxcbiAgICAgICAgeyBcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy53aGVuXCI6IHsgJGx0OiArb2xkZXN0VmFsaWREYXRlIH0gfVxuICAgICAgXVxuICAgIH0sIHtcbiAgICAgICRwdWxsOiB7XG4gICAgICAgIFwic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zXCI6IHtcbiAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgIHsgd2hlbjogeyAkbHQ6IG9sZGVzdFZhbGlkRGF0ZSB9IH0sXG4gICAgICAgICAgICB7IHdoZW46IHsgJGx0OiArb2xkZXN0VmFsaWREYXRlIH0gfVxuICAgICAgICAgIF1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sIHsgbXVsdGk6IHRydWUgfSk7XG4gICAgLy8gVGhlIG9ic2VydmUgb24gTWV0ZW9yLnVzZXJzIHdpbGwgdGFrZSBjYXJlIG9mIGNsb3NpbmcgY29ubmVjdGlvbnMgZm9yXG4gICAgLy8gZXhwaXJlZCB0b2tlbnMuXG4gIH07XG5cbiAgLy8gQG92ZXJyaWRlIGZyb20gYWNjb3VudHNfY29tbW9uLmpzXG4gIGNvbmZpZyhvcHRpb25zKSB7XG4gICAgLy8gQ2FsbCB0aGUgb3ZlcnJpZGRlbiBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgbWV0aG9kLlxuICAgIGNvbnN0IHN1cGVyUmVzdWx0ID0gQWNjb3VudHNDb21tb24ucHJvdG90eXBlLmNvbmZpZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgLy8gSWYgdGhlIHVzZXIgc2V0IGxvZ2luRXhwaXJhdGlvbkluRGF5cyB0byBudWxsLCB0aGVuIHdlIG5lZWQgdG8gY2xlYXIgdGhlXG4gICAgLy8gdGltZXIgdGhhdCBwZXJpb2RpY2FsbHkgZXhwaXJlcyB0b2tlbnMuXG4gICAgaWYgKGhhc093bi5jYWxsKHRoaXMuX29wdGlvbnMsICdsb2dpbkV4cGlyYXRpb25JbkRheXMnKSAmJlxuICAgICAgdGhpcy5fb3B0aW9ucy5sb2dpbkV4cGlyYXRpb25JbkRheXMgPT09IG51bGwgJiZcbiAgICAgIHRoaXMuZXhwaXJlVG9rZW5JbnRlcnZhbCkge1xuICAgICAgTWV0ZW9yLmNsZWFySW50ZXJ2YWwodGhpcy5leHBpcmVUb2tlbkludGVydmFsKTtcbiAgICAgIHRoaXMuZXhwaXJlVG9rZW5JbnRlcnZhbCA9IG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1cGVyUmVzdWx0O1xuICB9O1xuXG4gIC8vIENhbGxlZCBieSBhY2NvdW50cy1wYXNzd29yZFxuICBhc3luYyBpbnNlcnRVc2VyRG9jKG9wdGlvbnMsIHVzZXIpIHtcbiAgICAvLyAtIGNsb25lIHVzZXIgZG9jdW1lbnQsIHRvIHByb3RlY3QgZnJvbSBtb2RpZmljYXRpb25cbiAgICAvLyAtIGFkZCBjcmVhdGVkQXQgdGltZXN0YW1wXG4gICAgLy8gLSBwcmVwYXJlIGFuIF9pZCwgc28gdGhhdCB5b3UgY2FuIG1vZGlmeSBvdGhlciBjb2xsZWN0aW9ucyAoZWdcbiAgICAvLyBjcmVhdGUgYSBmaXJzdCB0YXNrIGZvciBldmVyeSBuZXcgdXNlcilcbiAgICAvL1xuICAgIC8vIFhYWCBJZiB0aGUgb25DcmVhdGVVc2VyIG9yIHZhbGlkYXRlTmV3VXNlciBob29rcyBmYWlsLCB3ZSBtaWdodFxuICAgIC8vIGVuZCB1cCBoYXZpbmcgbW9kaWZpZWQgc29tZSBvdGhlciBjb2xsZWN0aW9uXG4gICAgLy8gaW5hcHByb3ByaWF0ZWx5LiBUaGUgc29sdXRpb24gaXMgcHJvYmFibHkgdG8gaGF2ZSBvbkNyZWF0ZVVzZXJcbiAgICAvLyBhY2NlcHQgdHdvIGNhbGxiYWNrcyAtIG9uZSB0aGF0IGdldHMgY2FsbGVkIGJlZm9yZSBpbnNlcnRpbmdcbiAgICAvLyB0aGUgdXNlciBkb2N1bWVudCAoaW4gd2hpY2ggeW91IGNhbiBtb2RpZnkgaXRzIGNvbnRlbnRzKSwgYW5kXG4gICAgLy8gb25lIHRoYXQgZ2V0cyBjYWxsZWQgYWZ0ZXIgKGluIHdoaWNoIHlvdSBzaG91bGQgY2hhbmdlIG90aGVyXG4gICAgLy8gY29sbGVjdGlvbnMpXG4gICAgdXNlciA9IHtcbiAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgIF9pZDogUmFuZG9tLmlkKCksXG4gICAgICAuLi51c2VyLFxuICAgIH07XG5cbiAgICBpZiAodXNlci5zZXJ2aWNlcykge1xuICAgICAgT2JqZWN0LmtleXModXNlci5zZXJ2aWNlcykuZm9yRWFjaChzZXJ2aWNlID0+XG4gICAgICAgIHBpbkVuY3J5cHRlZEZpZWxkc1RvVXNlcih1c2VyLnNlcnZpY2VzW3NlcnZpY2VdLCB1c2VyLl9pZClcbiAgICAgICk7XG4gICAgfVxuXG4gICAgbGV0IGZ1bGxVc2VyO1xuICAgIGlmICh0aGlzLl9vbkNyZWF0ZVVzZXJIb29rKSB7XG4gICAgICAvLyBBbGxvd3MgX29uQ3JlYXRlVXNlckhvb2sgdG8gYmUgYSBwcm9taXNlIHJldHVybmluZyBmdW5jXG4gICAgICBmdWxsVXNlciA9IGF3YWl0IHRoaXMuX29uQ3JlYXRlVXNlckhvb2sob3B0aW9ucywgdXNlcik7XG5cbiAgICAgIC8vIFRoaXMgaXMgKm5vdCogcGFydCBvZiB0aGUgQVBJLiBXZSBuZWVkIHRoaXMgYmVjYXVzZSB3ZSBjYW4ndCBpc29sYXRlXG4gICAgICAvLyB0aGUgZ2xvYmFsIHNlcnZlciBlbnZpcm9ubWVudCBiZXR3ZWVuIHRlc3RzLCBtZWFuaW5nIHdlIGNhbid0IHRlc3RcbiAgICAgIC8vIGJvdGggaGF2aW5nIGEgY3JlYXRlIHVzZXIgaG9vayBzZXQgYW5kIG5vdCBoYXZpbmcgb25lIHNldC5cbiAgICAgIGlmIChmdWxsVXNlciA9PT0gJ1RFU1QgREVGQVVMVCBIT09LJylcbiAgICAgICAgZnVsbFVzZXIgPSBkZWZhdWx0Q3JlYXRlVXNlckhvb2sob3B0aW9ucywgdXNlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZ1bGxVc2VyID0gZGVmYXVsdENyZWF0ZVVzZXJIb29rKG9wdGlvbnMsIHVzZXIpO1xuICAgIH1cblxuICAgIGZvciBhd2FpdCAoY29uc3QgaG9vayBvZiB0aGlzLl92YWxpZGF0ZU5ld1VzZXJIb29rcykge1xuICAgICAgaWYgKCEgYXdhaXQgaG9vayhmdWxsVXNlcikpXG4gICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlVzZXIgdmFsaWRhdGlvbiBmYWlsZWRcIik7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJJZDtcbiAgICB0cnkge1xuICAgICAgdXNlcklkID0gYXdhaXQgdGhpcy51c2Vycy5pbnNlcnRBc3luYyhmdWxsVXNlcik7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gWFhYIHN0cmluZyBwYXJzaW5nIHN1Y2tzLCBtYXliZVxuICAgICAgLy8gaHR0cHM6Ly9qaXJhLm1vbmdvZGIub3JnL2Jyb3dzZS9TRVJWRVItMzA2OSB3aWxsIGdldCBmaXhlZCBvbmUgZGF5XG4gICAgICAvLyBodHRwczovL2ppcmEubW9uZ29kYi5vcmcvYnJvd3NlL1NFUlZFUi00NjM3XG4gICAgICBpZiAoIWUuZXJybXNnKSB0aHJvdyBlO1xuICAgICAgaWYgKGUuZXJybXNnLmluY2x1ZGVzKCdlbWFpbHMuYWRkcmVzcycpKVxuICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJFbWFpbCBhbHJlYWR5IGV4aXN0cy5cIik7XG4gICAgICBpZiAoZS5lcnJtc2cuaW5jbHVkZXMoJ3VzZXJuYW1lJykpXG4gICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlVzZXJuYW1lIGFscmVhZHkgZXhpc3RzLlwiKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIHJldHVybiB1c2VySWQ7XG4gIH07XG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uOiByZXR1cm5zIGZhbHNlIGlmIGVtYWlsIGRvZXMgbm90IG1hdGNoIGNvbXBhbnkgZG9tYWluIGZyb21cbiAgLy8gdGhlIGNvbmZpZ3VyYXRpb24uXG4gIF90ZXN0RW1haWxEb21haW4oZW1haWwpIHtcbiAgICBjb25zdCBkb21haW4gPSB0aGlzLl9vcHRpb25zLnJlc3RyaWN0Q3JlYXRpb25CeUVtYWlsRG9tYWluO1xuXG4gICAgcmV0dXJuICFkb21haW4gfHxcbiAgICAgICh0eXBlb2YgZG9tYWluID09PSAnZnVuY3Rpb24nICYmIGRvbWFpbihlbWFpbCkpIHx8XG4gICAgICAodHlwZW9mIGRvbWFpbiA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgKG5ldyBSZWdFeHAoYEAke01ldGVvci5fZXNjYXBlUmVnRXhwKGRvbWFpbil9JGAsICdpJykpLnRlc3QoZW1haWwpKTtcbiAgfTtcblxuICAvLy9cbiAgLy8vIENMRUFOIFVQIEZPUiBgbG9nb3V0T3RoZXJDbGllbnRzYFxuICAvLy9cblxuICBhc3luYyBfZGVsZXRlU2F2ZWRUb2tlbnNGb3JVc2VyKHVzZXJJZCwgdG9rZW5zVG9EZWxldGUpIHtcbiAgICBpZiAodG9rZW5zVG9EZWxldGUpIHtcbiAgICAgIGF3YWl0IHRoaXMudXNlcnMudXBkYXRlQXN5bmModXNlcklkLCB7XG4gICAgICAgICR1bnNldDoge1xuICAgICAgICAgIFwic2VydmljZXMucmVzdW1lLmhhdmVMb2dpblRva2Vuc1RvRGVsZXRlXCI6IDEsXG4gICAgICAgICAgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNUb0RlbGV0ZVwiOiAxXG4gICAgICAgIH0sXG4gICAgICAgICRwdWxsQWxsOiB7XG4gICAgICAgICAgXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNcIjogdG9rZW5zVG9EZWxldGVcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIF9kZWxldGVTYXZlZFRva2Vuc0ZvckFsbFVzZXJzT25TdGFydHVwKCkge1xuICAgIC8vIElmIHdlIGZpbmQgdXNlcnMgd2hvIGhhdmUgc2F2ZWQgdG9rZW5zIHRvIGRlbGV0ZSBvbiBzdGFydHVwLCBkZWxldGVcbiAgICAvLyB0aGVtIG5vdy4gSXQncyBwb3NzaWJsZSB0aGF0IHRoZSBzZXJ2ZXIgY291bGQgaGF2ZSBjcmFzaGVkIGFuZCBjb21lXG4gICAgLy8gYmFjayB1cCBiZWZvcmUgbmV3IHRva2VucyBhcmUgZm91bmQgaW4gbG9jYWxTdG9yYWdlLCBidXQgdGhpc1xuICAgIC8vIHNob3VsZG4ndCBoYXBwZW4gdmVyeSBvZnRlbi4gV2Ugc2hvdWxkbid0IHB1dCBhIGRlbGF5IGhlcmUgYmVjYXVzZVxuICAgIC8vIHRoYXQgd291bGQgZ2l2ZSBhIGxvdCBvZiBwb3dlciB0byBhbiBhdHRhY2tlciB3aXRoIGEgc3RvbGVuIGxvZ2luXG4gICAgLy8gdG9rZW4gYW5kIHRoZSBhYmlsaXR5IHRvIGNyYXNoIHRoZSBzZXJ2ZXIuXG4gICAgTWV0ZW9yLnN0YXJ0dXAoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdXNlcnMgPSBhd2FpdCB0aGlzLnVzZXJzLmZpbmQoe1xuICAgICAgICBcInNlcnZpY2VzLnJlc3VtZS5oYXZlTG9naW5Ub2tlbnNUb0RlbGV0ZVwiOiB0cnVlXG4gICAgICB9LCB7XG4gICAgICAgIGZpZWxkczoge1xuICAgICAgICAgIFwic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zVG9EZWxldGVcIjogMVxuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgdXNlcnMuZm9yRWFjaCh1c2VyID0+IHtcbiAgICAgICAgdGhpcy5fZGVsZXRlU2F2ZWRUb2tlbnNGb3JVc2VyKFxuICAgICAgICAgIHVzZXIuX2lkLFxuICAgICAgICAgIHVzZXIuc2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zVG9EZWxldGVcbiAgICAgICAgKVxuICAgICAgICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gd2FpdCBmb3IgdGhpcyB0byBjb21wbGV0ZS5cbiAgICAgICAgICAudGhlbihfID0+IF8pXG4gICAgICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8vXG4gIC8vLyBNQU5BR0lORyBVU0VSIE9CSkVDVFNcbiAgLy8vXG5cbiAgLy8gVXBkYXRlcyBvciBjcmVhdGVzIGEgdXNlciBhZnRlciB3ZSBhdXRoZW50aWNhdGUgd2l0aCBhIDNyZCBwYXJ0eS5cbiAgLy9cbiAgLy8gQHBhcmFtIHNlcnZpY2VOYW1lIHtTdHJpbmd9IFNlcnZpY2UgbmFtZSAoZWcsIHR3aXR0ZXIpLlxuICAvLyBAcGFyYW0gc2VydmljZURhdGEge09iamVjdH0gRGF0YSB0byBzdG9yZSBpbiB0aGUgdXNlcidzIHJlY29yZFxuICAvLyAgICAgICAgdW5kZXIgc2VydmljZXNbc2VydmljZU5hbWVdLiBNdXN0IGluY2x1ZGUgYW4gXCJpZFwiIGZpZWxkXG4gIC8vICAgICAgICB3aGljaCBpcyBhIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgdXNlciBpbiB0aGUgc2VydmljZS5cbiAgLy8gQHBhcmFtIG9wdGlvbnMge09iamVjdCwgb3B0aW9uYWx9IE90aGVyIG9wdGlvbnMgdG8gcGFzcyB0byBpbnNlcnRVc2VyRG9jXG4gIC8vICAgICAgICAoZWcsIHByb2ZpbGUpXG4gIC8vIEByZXR1cm5zIHtPYmplY3R9IE9iamVjdCB3aXRoIHRva2VuIGFuZCBpZCBrZXlzLCBsaWtlIHRoZSByZXN1bHRcbiAgLy8gICAgICAgIG9mIHRoZSBcImxvZ2luXCIgbWV0aG9kLlxuICAvL1xuICBhc3luYyB1cGRhdGVPckNyZWF0ZVVzZXJGcm9tRXh0ZXJuYWxTZXJ2aWNlKFxuICAgIHNlcnZpY2VOYW1lLFxuICAgIHNlcnZpY2VEYXRhLFxuICAgIG9wdGlvbnNcbiAgKSB7XG4gICAgb3B0aW9ucyA9IHsgLi4ub3B0aW9ucyB9O1xuXG4gICAgaWYgKHNlcnZpY2VOYW1lID09PSBcInBhc3N3b3JkXCIgfHwgc2VydmljZU5hbWUgPT09IFwicmVzdW1lXCIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJDYW4ndCB1c2UgdXBkYXRlT3JDcmVhdGVVc2VyRnJvbUV4dGVybmFsU2VydmljZSB3aXRoIGludGVybmFsIHNlcnZpY2UgXCJcbiAgICAgICAgKyBzZXJ2aWNlTmFtZSk7XG4gICAgfVxuICAgIGlmICghaGFzT3duLmNhbGwoc2VydmljZURhdGEsICdpZCcpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBTZXJ2aWNlIGRhdGEgZm9yIHNlcnZpY2UgJHtzZXJ2aWNlTmFtZX0gbXVzdCBpbmNsdWRlIGlkYCk7XG4gICAgfVxuXG4gICAgLy8gTG9vayBmb3IgYSB1c2VyIHdpdGggdGhlIGFwcHJvcHJpYXRlIHNlcnZpY2UgdXNlciBpZC5cbiAgICBjb25zdCBzZWxlY3RvciA9IHt9O1xuICAgIGNvbnN0IHNlcnZpY2VJZEtleSA9IGBzZXJ2aWNlcy4ke3NlcnZpY2VOYW1lfS5pZGA7XG5cbiAgICAvLyBYWFggVGVtcG9yYXJ5IHNwZWNpYWwgY2FzZSBmb3IgVHdpdHRlci4gKElzc3VlICM2MjkpXG4gICAgLy8gICBUaGUgc2VydmljZURhdGEuaWQgd2lsbCBiZSBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhbiBpbnRlZ2VyLlxuICAgIC8vICAgV2Ugd2FudCBpdCB0byBtYXRjaCBlaXRoZXIgYSBzdG9yZWQgc3RyaW5nIG9yIGludCByZXByZXNlbnRhdGlvbi5cbiAgICAvLyAgIFRoaXMgaXMgdG8gY2F0ZXIgdG8gZWFybGllciB2ZXJzaW9ucyBvZiBNZXRlb3Igc3RvcmluZyB0d2l0dGVyXG4gICAgLy8gICB1c2VyIElEcyBpbiBudW1iZXIgZm9ybSwgYW5kIHJlY2VudCB2ZXJzaW9ucyBzdG9yaW5nIHRoZW0gYXMgc3RyaW5ncy5cbiAgICAvLyAgIFRoaXMgY2FuIGJlIHJlbW92ZWQgb25jZSBtaWdyYXRpb24gdGVjaG5vbG9neSBpcyBpbiBwbGFjZSwgYW5kIHR3aXR0ZXJcbiAgICAvLyAgIHVzZXJzIHN0b3JlZCB3aXRoIGludGVnZXIgSURzIGhhdmUgYmVlbiBtaWdyYXRlZCB0byBzdHJpbmcgSURzLlxuICAgIGlmIChzZXJ2aWNlTmFtZSA9PT0gXCJ0d2l0dGVyXCIgJiYgIWlzTmFOKHNlcnZpY2VEYXRhLmlkKSkge1xuICAgICAgc2VsZWN0b3JbXCIkb3JcIl0gPSBbe30se31dO1xuICAgICAgc2VsZWN0b3JbXCIkb3JcIl1bMF1bc2VydmljZUlkS2V5XSA9IHNlcnZpY2VEYXRhLmlkO1xuICAgICAgc2VsZWN0b3JbXCIkb3JcIl1bMV1bc2VydmljZUlkS2V5XSA9IHBhcnNlSW50KHNlcnZpY2VEYXRhLmlkLCAxMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGVjdG9yW3NlcnZpY2VJZEtleV0gPSBzZXJ2aWNlRGF0YS5pZDtcbiAgICB9XG4gICAgbGV0IHVzZXIgPSBhd2FpdCB0aGlzLnVzZXJzLmZpbmRPbmVBc3luYyhzZWxlY3Rvciwge2ZpZWxkczogdGhpcy5fb3B0aW9ucy5kZWZhdWx0RmllbGRTZWxlY3Rvcn0pO1xuICAgIC8vIENoZWNrIHRvIHNlZSBpZiB0aGUgZGV2ZWxvcGVyIGhhcyBhIGN1c3RvbSB3YXkgdG8gZmluZCB0aGUgdXNlciBvdXRzaWRlXG4gICAgLy8gb2YgdGhlIGdlbmVyYWwgc2VsZWN0b3JzIGFib3ZlLlxuICAgIGlmICghdXNlciAmJiB0aGlzLl9hZGRpdGlvbmFsRmluZFVzZXJPbkV4dGVybmFsTG9naW4pIHtcbiAgICAgIHVzZXIgPSBhd2FpdCB0aGlzLl9hZGRpdGlvbmFsRmluZFVzZXJPbkV4dGVybmFsTG9naW4oe3NlcnZpY2VOYW1lLCBzZXJ2aWNlRGF0YSwgb3B0aW9uc30pXG4gICAgfVxuXG4gICAgLy8gQmVmb3JlIGNvbnRpbnVpbmcsIHJ1biB1c2VyIGhvb2sgdG8gc2VlIGlmIHdlIHNob3VsZCBjb250aW51ZVxuICAgIGlmICh0aGlzLl9iZWZvcmVFeHRlcm5hbExvZ2luSG9vayAmJiAhKGF3YWl0IHRoaXMuX2JlZm9yZUV4dGVybmFsTG9naW5Ib29rKHNlcnZpY2VOYW1lLCBzZXJ2aWNlRGF0YSwgdXNlcikpKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJMb2dpbiBmb3JiaWRkZW5cIik7XG4gICAgfVxuXG4gICAgLy8gV2hlbiBjcmVhdGluZyBhIG5ldyB1c2VyIHdlIHBhc3MgdGhyb3VnaCBhbGwgb3B0aW9ucy4gV2hlbiB1cGRhdGluZyBhblxuICAgIC8vIGV4aXN0aW5nIHVzZXIsIGJ5IGRlZmF1bHQgd2Ugb25seSBwcm9jZXNzL3Bhc3MgdGhyb3VnaCB0aGUgc2VydmljZURhdGFcbiAgICAvLyAoZWcsIHNvIHRoYXQgd2Uga2VlcCBhbiB1bmV4cGlyZWQgYWNjZXNzIHRva2VuIGFuZCBkb24ndCBjYWNoZSBvbGQgZW1haWxcbiAgICAvLyBhZGRyZXNzZXMgaW4gc2VydmljZURhdGEuZW1haWwpLiBUaGUgb25FeHRlcm5hbExvZ2luIGhvb2sgY2FuIGJlIHVzZWQgd2hlblxuICAgIC8vIGNyZWF0aW5nIG9yIHVwZGF0aW5nIGEgdXNlciwgdG8gbW9kaWZ5IG9yIHBhc3MgdGhyb3VnaCBtb3JlIG9wdGlvbnMgYXNcbiAgICAvLyBuZWVkZWQuXG4gICAgbGV0IG9wdHMgPSB1c2VyID8ge30gOiBvcHRpb25zO1xuICAgIGlmICh0aGlzLl9vbkV4dGVybmFsTG9naW5Ib29rKSB7XG4gICAgICBvcHRzID0gYXdhaXQgdGhpcy5fb25FeHRlcm5hbExvZ2luSG9vayhvcHRpb25zLCB1c2VyKTtcbiAgICB9XG5cbiAgICBpZiAodXNlcikge1xuICAgICAgYXdhaXQgcGluRW5jcnlwdGVkRmllbGRzVG9Vc2VyKHNlcnZpY2VEYXRhLCB1c2VyLl9pZCk7XG5cbiAgICAgIGxldCBzZXRBdHRycyA9IHt9O1xuICAgICAgT2JqZWN0LmtleXMoc2VydmljZURhdGEpLmZvckVhY2goa2V5ID0+XG4gICAgICAgIHNldEF0dHJzW2BzZXJ2aWNlcy4ke3NlcnZpY2VOYW1lfS4ke2tleX1gXSA9IHNlcnZpY2VEYXRhW2tleV1cbiAgICAgICk7XG5cbiAgICAgIC8vIFhYWCBNYXliZSB3ZSBzaG91bGQgcmUtdXNlIHRoZSBzZWxlY3RvciBhYm92ZSBhbmQgbm90aWNlIGlmIHRoZSB1cGRhdGVcbiAgICAgIC8vICAgICB0b3VjaGVzIG5vdGhpbmc/XG4gICAgICBzZXRBdHRycyA9IHsgLi4uc2V0QXR0cnMsIC4uLm9wdHMgfTtcbiAgICAgIGF3YWl0IHRoaXMudXNlcnMudXBkYXRlQXN5bmModXNlci5faWQsIHtcbiAgICAgICAgJHNldDogc2V0QXR0cnNcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiBzZXJ2aWNlTmFtZSxcbiAgICAgICAgdXNlcklkOiB1c2VyLl9pZFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ3JlYXRlIGEgbmV3IHVzZXIgd2l0aCB0aGUgc2VydmljZSBkYXRhLlxuICAgICAgdXNlciA9IHtzZXJ2aWNlczoge319O1xuICAgICAgdXNlci5zZXJ2aWNlc1tzZXJ2aWNlTmFtZV0gPSBzZXJ2aWNlRGF0YTtcbiAgICAgIGNvbnN0IHVzZXJJZCA9IGF3YWl0IHRoaXMuaW5zZXJ0VXNlckRvYyhvcHRzLCB1c2VyKTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGU6IHNlcnZpY2VOYW1lLFxuICAgICAgICB1c2VySWRcbiAgICAgIH07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZW1vdmVzIGRlZmF1bHQgcmF0ZSBsaW1pdGluZyBydWxlXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAgICovXG4gIHJlbW92ZURlZmF1bHRSYXRlTGltaXQoKSB7XG4gICAgY29uc3QgcmVzcCA9IEREUFJhdGVMaW1pdGVyLnJlbW92ZVJ1bGUodGhpcy5kZWZhdWx0UmF0ZUxpbWl0ZXJSdWxlSWQpO1xuICAgIHRoaXMuZGVmYXVsdFJhdGVMaW1pdGVyUnVsZUlkID0gbnVsbDtcbiAgICByZXR1cm4gcmVzcDtcbiAgfTtcblxuICAvKipcbiAgICogQHN1bW1hcnkgQWRkIGEgZGVmYXVsdCBydWxlIG9mIGxpbWl0aW5nIGxvZ2lucywgY3JlYXRpbmcgbmV3IHVzZXJzIGFuZCBwYXNzd29yZCByZXNldFxuICAgKiB0byA1IHRpbWVzIGV2ZXJ5IDEwIHNlY29uZHMgcGVyIGNvbm5lY3Rpb24uXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAgICovXG4gIGFkZERlZmF1bHRSYXRlTGltaXQoKSB7XG4gICAgaWYgKCF0aGlzLmRlZmF1bHRSYXRlTGltaXRlclJ1bGVJZCkge1xuICAgICAgdGhpcy5kZWZhdWx0UmF0ZUxpbWl0ZXJSdWxlSWQgPSBERFBSYXRlTGltaXRlci5hZGRSdWxlKHtcbiAgICAgICAgdXNlcklkOiBudWxsLFxuICAgICAgICBjbGllbnRBZGRyZXNzOiBudWxsLFxuICAgICAgICB0eXBlOiAnbWV0aG9kJyxcbiAgICAgICAgbmFtZTogbmFtZSA9PiBbJ2xvZ2luJywgJ2NyZWF0ZVVzZXInLCAncmVzZXRQYXNzd29yZCcsICdmb3Jnb3RQYXNzd29yZCddXG4gICAgICAgICAgLmluY2x1ZGVzKG5hbWUpLFxuICAgICAgICBjb25uZWN0aW9uSWQ6IChjb25uZWN0aW9uSWQpID0+IHRydWUsXG4gICAgICB9LCA1LCAxMDAwMCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDcmVhdGVzIG9wdGlvbnMgZm9yIGVtYWlsIHNlbmRpbmcgZm9yIHJlc2V0IHBhc3N3b3JkIGFuZCBlbnJvbGwgYWNjb3VudCBlbWFpbHMuXG4gICAqIFlvdSBjYW4gdXNlIHRoaXMgZnVuY3Rpb24gd2hlbiBjdXN0b21pemluZyBhIHJlc2V0IHBhc3N3b3JkIG9yIGVucm9sbCBhY2NvdW50IGVtYWlsIHNlbmRpbmcuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtPYmplY3R9IGVtYWlsIFdoaWNoIGFkZHJlc3Mgb2YgdGhlIHVzZXIncyB0byBzZW5kIHRoZSBlbWFpbCB0by5cbiAgICogQHBhcmFtIHtPYmplY3R9IHVzZXIgVGhlIHVzZXIgb2JqZWN0IHRvIGdlbmVyYXRlIG9wdGlvbnMgZm9yLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdXJsIFVSTCB0byB3aGljaCB1c2VyIGlzIGRpcmVjdGVkIHRvIGNvbmZpcm0gdGhlIGVtYWlsLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcmVhc29uIGByZXNldFBhc3N3b3JkYCBvciBgZW5yb2xsQWNjb3VudGAuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IE9wdGlvbnMgd2hpY2ggY2FuIGJlIHBhc3NlZCB0byBgRW1haWwuc2VuZGAuXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBhY2NvdW50cy1iYXNlXG4gICAqL1xuICBhc3luYyBnZW5lcmF0ZU9wdGlvbnNGb3JFbWFpbChlbWFpbCwgdXNlciwgdXJsLCByZWFzb24sIGV4dHJhID0ge30pe1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICB0bzogZW1haWwsXG4gICAgICBmcm9tOiB0aGlzLmVtYWlsVGVtcGxhdGVzW3JlYXNvbl0uZnJvbVxuICAgICAgICA/IGF3YWl0IHRoaXMuZW1haWxUZW1wbGF0ZXNbcmVhc29uXS5mcm9tKHVzZXIpXG4gICAgICAgIDogdGhpcy5lbWFpbFRlbXBsYXRlcy5mcm9tLFxuICAgICAgc3ViamVjdDogYXdhaXQgdGhpcy5lbWFpbFRlbXBsYXRlc1tyZWFzb25dLnN1YmplY3QodXNlciwgdXJsLCBleHRyYSksXG4gICAgfTtcblxuICAgIGlmICh0eXBlb2YgdGhpcy5lbWFpbFRlbXBsYXRlc1tyZWFzb25dLnRleHQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIG9wdGlvbnMudGV4dCA9IGF3YWl0IHRoaXMuZW1haWxUZW1wbGF0ZXNbcmVhc29uXS50ZXh0KHVzZXIsIHVybCwgZXh0cmEpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy5lbWFpbFRlbXBsYXRlc1tyZWFzb25dLmh0bWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIG9wdGlvbnMuaHRtbCA9IGF3YWl0IHRoaXMuZW1haWxUZW1wbGF0ZXNbcmVhc29uXS5odG1sKHVzZXIsIHVybCwgZXh0cmEpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdGhpcy5lbWFpbFRlbXBsYXRlcy5oZWFkZXJzID09PSAnb2JqZWN0Jykge1xuICAgICAgb3B0aW9ucy5oZWFkZXJzID0gdGhpcy5lbWFpbFRlbXBsYXRlcy5oZWFkZXJzO1xuICAgIH1cblxuICAgIHJldHVybiBvcHRpb25zO1xuICB9O1xuXG4gIGFzeW5jIF9jaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMoXG4gICAgZmllbGROYW1lLFxuICAgIGRpc3BsYXlOYW1lLFxuICAgIGZpZWxkVmFsdWUsXG4gICAgb3duVXNlcklkXG4gICkge1xuICAgIC8vIFNvbWUgdGVzdHMgbmVlZCB0aGUgYWJpbGl0eSB0byBhZGQgdXNlcnMgd2l0aCB0aGUgc2FtZSBjYXNlIGluc2Vuc2l0aXZlXG4gICAgLy8gdmFsdWUsIGhlbmNlIHRoZSBfc2tpcENhc2VJbnNlbnNpdGl2ZUNoZWNrc0ZvclRlc3QgY2hlY2tcbiAgICBjb25zdCBza2lwQ2hlY2sgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoXG4gICAgICB0aGlzLl9za2lwQ2FzZUluc2Vuc2l0aXZlQ2hlY2tzRm9yVGVzdCxcbiAgICAgIGZpZWxkVmFsdWVcbiAgICApO1xuXG4gICAgaWYgKGZpZWxkVmFsdWUgJiYgIXNraXBDaGVjaykge1xuICAgICAgY29uc3QgbWF0Y2hlZFVzZXJzID0gYXdhaXQgTWV0ZW9yLnVzZXJzXG4gICAgICAgIC5maW5kKFxuICAgICAgICAgIHRoaXMuX3NlbGVjdG9yRm9yRmFzdENhc2VJbnNlbnNpdGl2ZUxvb2t1cChmaWVsZE5hbWUsIGZpZWxkVmFsdWUpLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGZpZWxkczogeyBfaWQ6IDEgfSxcbiAgICAgICAgICAgIC8vIHdlIG9ubHkgbmVlZCBhIG1heGltdW0gb2YgMiB1c2VycyBmb3IgdGhlIGxvZ2ljIGJlbG93IHRvIHdvcmtcbiAgICAgICAgICAgIGxpbWl0OiAyLFxuICAgICAgICAgIH1cbiAgICAgICAgKVxuICAgICAgICAuZmV0Y2hBc3luYygpO1xuXG4gICAgICBpZiAoXG4gICAgICAgIG1hdGNoZWRVc2Vycy5sZW5ndGggPiAwICYmXG4gICAgICAgIC8vIElmIHdlIGRvbid0IGhhdmUgYSB1c2VySWQgeWV0LCBhbnkgbWF0Y2ggd2UgZmluZCBpcyBhIGR1cGxpY2F0ZVxuICAgICAgICAoIW93blVzZXJJZCB8fFxuICAgICAgICAgIC8vIE90aGVyd2lzZSwgY2hlY2sgdG8gc2VlIGlmIHRoZXJlIGFyZSBtdWx0aXBsZSBtYXRjaGVzIG9yIGEgbWF0Y2hcbiAgICAgICAgICAvLyB0aGF0IGlzIG5vdCB1c1xuICAgICAgICAgIG1hdGNoZWRVc2Vycy5sZW5ndGggPiAxIHx8IG1hdGNoZWRVc2Vyc1swXS5faWQgIT09IG93blVzZXJJZClcbiAgICAgICkge1xuICAgICAgICB0aGlzLl9oYW5kbGVFcnJvcihgJHtkaXNwbGF5TmFtZX0gYWxyZWFkeSBleGlzdHMuYCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIGFzeW5jIF9jcmVhdGVVc2VyQ2hlY2tpbmdEdXBsaWNhdGVzKHsgdXNlciwgZW1haWwsIHVzZXJuYW1lLCBvcHRpb25zIH0pIHtcbiAgICBjb25zdCBuZXdVc2VyID0ge1xuICAgICAgLi4udXNlcixcbiAgICAgIC4uLih1c2VybmFtZSA/IHsgdXNlcm5hbWUgfSA6IHt9KSxcbiAgICAgIC4uLihlbWFpbCA/IHsgZW1haWxzOiBbeyBhZGRyZXNzOiBlbWFpbCwgdmVyaWZpZWQ6IGZhbHNlIH1dIH0gOiB7fSksXG4gICAgfTtcblxuICAgIC8vIFBlcmZvcm0gYSBjYXNlIGluc2Vuc2l0aXZlIGNoZWNrIGJlZm9yZSBpbnNlcnRcbiAgICBhd2FpdCB0aGlzLl9jaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMoJ3VzZXJuYW1lJywgJ1VzZXJuYW1lJywgdXNlcm5hbWUpO1xuICAgIGF3YWl0IHRoaXMuX2NoZWNrRm9yQ2FzZUluc2Vuc2l0aXZlRHVwbGljYXRlcygnZW1haWxzLmFkZHJlc3MnLCAnRW1haWwnLCBlbWFpbCk7XG5cbiAgICBjb25zdCB1c2VySWQgPSBhd2FpdCB0aGlzLmluc2VydFVzZXJEb2Mob3B0aW9ucywgbmV3VXNlcik7XG4gICAgLy8gUGVyZm9ybSBhbm90aGVyIGNoZWNrIGFmdGVyIGluc2VydCwgaW4gY2FzZSBhIG1hdGNoaW5nIHVzZXIgaGFzIGJlZW5cbiAgICAvLyBpbnNlcnRlZCBpbiB0aGUgbWVhbnRpbWVcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5fY2hlY2tGb3JDYXNlSW5zZW5zaXRpdmVEdXBsaWNhdGVzKCd1c2VybmFtZScsICdVc2VybmFtZScsIHVzZXJuYW1lLCB1c2VySWQpO1xuICAgICAgYXdhaXQgdGhpcy5fY2hlY2tGb3JDYXNlSW5zZW5zaXRpdmVEdXBsaWNhdGVzKCdlbWFpbHMuYWRkcmVzcycsICdFbWFpbCcsIGVtYWlsLCB1c2VySWQpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAvLyBSZW1vdmUgaW5zZXJ0ZWQgdXNlciBpZiB0aGUgY2hlY2sgZmFpbHNcbiAgICAgIGF3YWl0IE1ldGVvci51c2Vycy5yZW1vdmVBc3luYyh1c2VySWQpO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICAgIHJldHVybiB1c2VySWQ7XG4gIH1cblxuICBfaGFuZGxlRXJyb3IgPSAobXNnLCB0aHJvd0Vycm9yID0gdHJ1ZSwgZXJyb3JDb2RlID0gNDAzKSA9PiB7XG4gICAgY29uc3QgaXNFcnJvckFtYmlndW91cyA9IHRoaXMuX29wdGlvbnMuYW1iaWd1b3VzRXJyb3JNZXNzYWdlcyA/PyB0cnVlO1xuICAgIGNvbnN0IGVycm9yID0gbmV3IE1ldGVvci5FcnJvcihcbiAgICAgIGVycm9yQ29kZSxcbiAgICAgIGlzRXJyb3JBbWJpZ3VvdXNcbiAgICAgICAgPyAnU29tZXRoaW5nIHdlbnQgd3JvbmcuIFBsZWFzZSBjaGVjayB5b3VyIGNyZWRlbnRpYWxzLidcbiAgICAgICAgOiBtc2dcbiAgICApO1xuICAgIGlmICh0aHJvd0Vycm9yKSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gICAgcmV0dXJuIGVycm9yO1xuICB9XG5cbiAgX3VzZXJRdWVyeVZhbGlkYXRvciA9IE1hdGNoLldoZXJlKHVzZXIgPT4ge1xuICAgIGNoZWNrKHVzZXIsIHtcbiAgICAgIGlkOiBNYXRjaC5PcHRpb25hbChNYXRjaC5Ob25FbXB0eVN0cmluZyksXG4gICAgICB1c2VybmFtZTogTWF0Y2guT3B0aW9uYWwoTWF0Y2guTm9uRW1wdHlTdHJpbmcpLFxuICAgICAgZW1haWw6IE1hdGNoLk9wdGlvbmFsKE1hdGNoLk5vbkVtcHR5U3RyaW5nKVxuICAgIH0pO1xuICAgIGlmIChPYmplY3Qua2V5cyh1c2VyKS5sZW5ndGggIT09IDEpXG4gICAgICB0aHJvdyBuZXcgTWF0Y2guRXJyb3IoXCJVc2VyIHByb3BlcnR5IG11c3QgaGF2ZSBleGFjdGx5IG9uZSBmaWVsZFwiKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG5cbn1cblxuLy8gR2l2ZSBlYWNoIGxvZ2luIGhvb2sgY2FsbGJhY2sgYSBmcmVzaCBjbG9uZWQgY29weSBvZiB0aGUgYXR0ZW1wdFxuLy8gb2JqZWN0LCBidXQgZG9uJ3QgY2xvbmUgdGhlIGNvbm5lY3Rpb24uXG4vL1xuY29uc3QgY2xvbmVBdHRlbXB0V2l0aENvbm5lY3Rpb24gPSAoY29ubmVjdGlvbiwgYXR0ZW1wdCkgPT4ge1xuICBjb25zdCBjbG9uZWRBdHRlbXB0ID0gRUpTT04uY2xvbmUoYXR0ZW1wdCk7XG4gIGNsb25lZEF0dGVtcHQuY29ubmVjdGlvbiA9IGNvbm5lY3Rpb247XG4gIHJldHVybiBjbG9uZWRBdHRlbXB0O1xufTtcblxuY29uc3QgdHJ5TG9naW5NZXRob2QgPSBhc3luYyAodHlwZSwgZm4pID0+IHtcbiAgbGV0IHJlc3VsdDtcbiAgdHJ5IHtcbiAgICByZXN1bHQgPSBhd2FpdCBmbigpO1xuICB9XG4gIGNhdGNoIChlKSB7XG4gICAgcmVzdWx0ID0ge2Vycm9yOiBlfTtcbiAgfVxuXG4gIGlmIChyZXN1bHQgJiYgIXJlc3VsdC50eXBlICYmIHR5cGUpXG4gICAgcmVzdWx0LnR5cGUgPSB0eXBlO1xuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5jb25zdCBzZXR1cERlZmF1bHRMb2dpbkhhbmRsZXJzID0gYWNjb3VudHMgPT4ge1xuICBhY2NvdW50cy5yZWdpc3RlckxvZ2luSGFuZGxlcihcInJlc3VtZVwiLCBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHJldHVybiBkZWZhdWx0UmVzdW1lTG9naW5IYW5kbGVyLmNhbGwodGhpcywgYWNjb3VudHMsIG9wdGlvbnMpO1xuICB9KTtcbn07XG5cbi8vIExvZ2luIGhhbmRsZXIgZm9yIHJlc3VtZSB0b2tlbnMuXG5jb25zdCBkZWZhdWx0UmVzdW1lTG9naW5IYW5kbGVyID0gYXN5bmMgKGFjY291bnRzLCBvcHRpb25zKSA9PiB7XG4gIGlmICghb3B0aW9ucy5yZXN1bWUpXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcblxuICBjaGVjayhvcHRpb25zLnJlc3VtZSwgU3RyaW5nKTtcblxuICBjb25zdCBoYXNoZWRUb2tlbiA9IGFjY291bnRzLl9oYXNoTG9naW5Ub2tlbihvcHRpb25zLnJlc3VtZSk7XG5cbiAgLy8gRmlyc3QgbG9vayBmb3IganVzdCB0aGUgbmV3LXN0eWxlIGhhc2hlZCBsb2dpbiB0b2tlbiwgdG8gYXZvaWRcbiAgLy8gc2VuZGluZyB0aGUgdW5oYXNoZWQgdG9rZW4gdG8gdGhlIGRhdGFiYXNlIGluIGEgcXVlcnkgaWYgd2UgZG9uJ3RcbiAgLy8gbmVlZCB0by5cbiAgbGV0IHVzZXIgPSBhd2FpdCBhY2NvdW50cy51c2Vycy5maW5kT25lQXN5bmMoXG4gICAge1wic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zLmhhc2hlZFRva2VuXCI6IGhhc2hlZFRva2VufSxcbiAgICB7ZmllbGRzOiB7XCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMuJFwiOiAxfX0pO1xuXG4gIGlmICghIHVzZXIpIHtcbiAgICAvLyBJZiB3ZSBkaWRuJ3QgZmluZCB0aGUgaGFzaGVkIGxvZ2luIHRva2VuLCB0cnkgYWxzbyBsb29raW5nIGZvclxuICAgIC8vIHRoZSBvbGQtc3R5bGUgdW5oYXNoZWQgdG9rZW4uICBCdXQgd2UgbmVlZCB0byBsb29rIGZvciBlaXRoZXJcbiAgICAvLyB0aGUgb2xkLXN0eWxlIHRva2VuIE9SIHRoZSBuZXctc3R5bGUgdG9rZW4sIGJlY2F1c2UgYW5vdGhlclxuICAgIC8vIGNsaWVudCBjb25uZWN0aW9uIGxvZ2dpbmcgaW4gc2ltdWx0YW5lb3VzbHkgbWlnaHQgaGF2ZSBhbHJlYWR5XG4gICAgLy8gY29udmVydGVkIHRoZSB0b2tlbi5cbiAgICB1c2VyID0gIGF3YWl0IGFjY291bnRzLnVzZXJzLmZpbmRPbmVBc3luYyh7XG4gICAgICAgICRvcjogW1xuICAgICAgICAgIHtcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy5oYXNoZWRUb2tlblwiOiBoYXNoZWRUb2tlbn0sXG4gICAgICAgICAge1wic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zLnRva2VuXCI6IG9wdGlvbnMucmVzdW1lfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAgLy8gTm90ZTogQ2Fubm90IHVzZSAuLi5sb2dpblRva2Vucy4kIHBvc2l0aW9uYWwgb3BlcmF0b3Igd2l0aCAkb3IgcXVlcnkuXG4gICAgICB7ZmllbGRzOiB7XCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnNcIjogMX19KTtcbiAgfVxuXG4gIGlmICghIHVzZXIpXG4gICAgcmV0dXJuIHtcbiAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJZb3UndmUgYmVlbiBsb2dnZWQgb3V0IGJ5IHRoZSBzZXJ2ZXIuIFBsZWFzZSBsb2cgaW4gYWdhaW4uXCIpXG4gICAgfTtcblxuICAvLyBGaW5kIHRoZSB0b2tlbiwgd2hpY2ggd2lsbCBlaXRoZXIgYmUgYW4gb2JqZWN0IHdpdGggZmllbGRzXG4gIC8vIHtoYXNoZWRUb2tlbiwgd2hlbn0gZm9yIGEgaGFzaGVkIHRva2VuIG9yIHt0b2tlbiwgd2hlbn0gZm9yIGFuXG4gIC8vIHVuaGFzaGVkIHRva2VuLlxuICBsZXQgb2xkVW5oYXNoZWRTdHlsZVRva2VuO1xuICBsZXQgdG9rZW4gPSB1c2VyLnNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy5maW5kKHRva2VuID0+XG4gICAgdG9rZW4uaGFzaGVkVG9rZW4gPT09IGhhc2hlZFRva2VuXG4gICk7XG4gIGlmICh0b2tlbikge1xuICAgIG9sZFVuaGFzaGVkU3R5bGVUb2tlbiA9IGZhbHNlO1xuICB9IGVsc2Uge1xuICAgIHRva2VuID0gdXNlci5zZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMuZmluZCh0b2tlbiA9PlxuICAgICAgdG9rZW4udG9rZW4gPT09IG9wdGlvbnMucmVzdW1lXG4gICAgKTtcbiAgICBvbGRVbmhhc2hlZFN0eWxlVG9rZW4gPSB0cnVlO1xuICB9XG5cbiAgY29uc3QgdG9rZW5FeHBpcmVzID0gYWNjb3VudHMuX3Rva2VuRXhwaXJhdGlvbih0b2tlbi53aGVuKTtcbiAgaWYgKG5ldyBEYXRlKCkgPj0gdG9rZW5FeHBpcmVzKVxuICAgIHJldHVybiB7XG4gICAgICB1c2VySWQ6IHVzZXIuX2lkLFxuICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIllvdXIgc2Vzc2lvbiBoYXMgZXhwaXJlZC4gUGxlYXNlIGxvZyBpbiBhZ2Fpbi5cIilcbiAgICB9O1xuXG4gIC8vIFVwZGF0ZSB0byBhIGhhc2hlZCB0b2tlbiB3aGVuIGFuIHVuaGFzaGVkIHRva2VuIGlzIGVuY291bnRlcmVkLlxuICBpZiAob2xkVW5oYXNoZWRTdHlsZVRva2VuKSB7XG4gICAgLy8gT25seSBhZGQgdGhlIG5ldyBoYXNoZWQgdG9rZW4gaWYgdGhlIG9sZCB1bmhhc2hlZCB0b2tlbiBzdGlsbFxuICAgIC8vIGV4aXN0cyAodGhpcyBhdm9pZHMgcmVzdXJyZWN0aW5nIHRoZSB0b2tlbiBpZiBpdCB3YXMgZGVsZXRlZFxuICAgIC8vIGFmdGVyIHdlIHJlYWQgaXQpLiAgVXNpbmcgJGFkZFRvU2V0IGF2b2lkcyBnZXR0aW5nIGFuIGluZGV4XG4gICAgLy8gZXJyb3IgaWYgYW5vdGhlciBjbGllbnQgbG9nZ2luZyBpbiBzaW11bHRhbmVvdXNseSBoYXMgYWxyZWFkeVxuICAgIC8vIGluc2VydGVkIHRoZSBuZXcgaGFzaGVkIHRva2VuLlxuICAgIGF3YWl0IGFjY291bnRzLnVzZXJzLnVwZGF0ZUFzeW5jKFxuICAgICAge1xuICAgICAgICBfaWQ6IHVzZXIuX2lkLFxuICAgICAgICBcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy50b2tlblwiOiBvcHRpb25zLnJlc3VtZVxuICAgICAgfSxcbiAgICAgIHskYWRkVG9TZXQ6IHtcbiAgICAgICAgICBcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vuc1wiOiB7XG4gICAgICAgICAgICBcImhhc2hlZFRva2VuXCI6IGhhc2hlZFRva2VuLFxuICAgICAgICAgICAgXCJ3aGVuXCI6IHRva2VuLndoZW5cbiAgICAgICAgICB9XG4gICAgICAgIH19XG4gICAgKTtcblxuICAgIC8vIFJlbW92ZSB0aGUgb2xkIHRva2VuICphZnRlciogYWRkaW5nIHRoZSBuZXcsIHNpbmNlIG90aGVyd2lzZVxuICAgIC8vIGFub3RoZXIgY2xpZW50IHRyeWluZyB0byBsb2dpbiBiZXR3ZWVuIG91ciByZW1vdmluZyB0aGUgb2xkIGFuZFxuICAgIC8vIGFkZGluZyB0aGUgbmV3IHdvdWxkbid0IGZpbmQgYSB0b2tlbiB0byBsb2dpbiB3aXRoLlxuICAgIGF3YWl0IGFjY291bnRzLnVzZXJzLnVwZGF0ZUFzeW5jKHVzZXIuX2lkLCB7XG4gICAgICAkcHVsbDoge1xuICAgICAgICBcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vuc1wiOiB7IFwidG9rZW5cIjogb3B0aW9ucy5yZXN1bWUgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB1c2VySWQ6IHVzZXIuX2lkLFxuICAgIHN0YW1wZWRMb2dpblRva2VuOiB7XG4gICAgICB0b2tlbjogb3B0aW9ucy5yZXN1bWUsXG4gICAgICB3aGVuOiB0b2tlbi53aGVuXG4gICAgfVxuICB9O1xufTtcblxuY29uc3QgZXhwaXJlUGFzc3dvcmRUb2tlbiA9XG4gIGFzeW5jIChcbiAgICBhY2NvdW50cyxcbiAgICBvbGRlc3RWYWxpZERhdGUsXG4gICAgdG9rZW5GaWx0ZXIsXG4gICAgdXNlcklkXG4gICkgPT4ge1xuICAgIC8vIGJvb2xlYW4gdmFsdWUgdXNlZCB0byBkZXRlcm1pbmUgaWYgdGhpcyBtZXRob2Qgd2FzIGNhbGxlZCBmcm9tIGVucm9sbCBhY2NvdW50IHdvcmtmbG93XG4gICAgbGV0IGlzRW5yb2xsID0gZmFsc2U7XG4gICAgY29uc3QgdXNlckZpbHRlciA9IHVzZXJJZCA/IHsgX2lkOiB1c2VySWQgfSA6IHt9O1xuICAgIC8vIGNoZWNrIGlmIHRoaXMgbWV0aG9kIHdhcyBjYWxsZWQgZnJvbSBlbnJvbGwgYWNjb3VudCB3b3JrZmxvd1xuICAgIGlmICh0b2tlbkZpbHRlclsnc2VydmljZXMucGFzc3dvcmQuZW5yb2xsLnJlYXNvbiddKSB7XG4gICAgICBpc0Vucm9sbCA9IHRydWU7XG4gICAgfVxuICAgIGxldCByZXNldFJhbmdlT3IgPSB7XG4gICAgICAkb3I6IFtcbiAgICAgICAgeyBcInNlcnZpY2VzLnBhc3N3b3JkLnJlc2V0LndoZW5cIjogeyAkbHQ6IG9sZGVzdFZhbGlkRGF0ZSB9IH0sXG4gICAgICAgIHsgXCJzZXJ2aWNlcy5wYXNzd29yZC5yZXNldC53aGVuXCI6IHsgJGx0OiArb2xkZXN0VmFsaWREYXRlIH0gfVxuICAgICAgXVxuICAgIH07XG4gICAgaWYgKGlzRW5yb2xsKSB7XG4gICAgICByZXNldFJhbmdlT3IgPSB7XG4gICAgICAgICRvcjogW1xuICAgICAgICAgIHsgXCJzZXJ2aWNlcy5wYXNzd29yZC5lbnJvbGwud2hlblwiOiB7ICRsdDogb2xkZXN0VmFsaWREYXRlIH0gfSxcbiAgICAgICAgICB7IFwic2VydmljZXMucGFzc3dvcmQuZW5yb2xsLndoZW5cIjogeyAkbHQ6ICtvbGRlc3RWYWxpZERhdGUgfSB9XG4gICAgICAgIF1cbiAgICAgIH07XG4gICAgfVxuICAgIGNvbnN0IGV4cGlyZUZpbHRlciA9IHsgJGFuZDogW3Rva2VuRmlsdGVyLCByZXNldFJhbmdlT3JdIH07XG4gICAgaWYgKGlzRW5yb2xsKSB7XG4gICAgICBhd2FpdCBhY2NvdW50cy51c2Vycy51cGRhdGVBc3luYyh7IC4uLnVzZXJGaWx0ZXIsIC4uLmV4cGlyZUZpbHRlciB9LCB7XG4gICAgICAgICR1bnNldDoge1xuICAgICAgICAgIFwic2VydmljZXMucGFzc3dvcmQuZW5yb2xsXCI6IFwiXCJcbiAgICAgICAgfVxuICAgICAgfSwgeyBtdWx0aTogdHJ1ZSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgYWNjb3VudHMudXNlcnMudXBkYXRlQXN5bmMoeyAuLi51c2VyRmlsdGVyLCAuLi5leHBpcmVGaWx0ZXIgfSwge1xuICAgICAgICAkdW5zZXQ6IHtcbiAgICAgICAgICBcInNlcnZpY2VzLnBhc3N3b3JkLnJlc2V0XCI6IFwiXCJcbiAgICAgICAgfVxuICAgICAgfSwgeyBtdWx0aTogdHJ1ZSB9KTtcbiAgICB9XG5cbiAgfTtcblxuY29uc3Qgc2V0RXhwaXJlVG9rZW5zSW50ZXJ2YWwgPSBhY2NvdW50cyA9PiB7XG4gIGFjY291bnRzLmV4cGlyZVRva2VuSW50ZXJ2YWwgPSBNZXRlb3Iuc2V0SW50ZXJ2YWwoYXN5bmMgKCkgPT4ge1xuICAgYXdhaXQgYWNjb3VudHMuX2V4cGlyZVRva2VucygpO1xuICAgYXdhaXQgYWNjb3VudHMuX2V4cGlyZVBhc3N3b3JkUmVzZXRUb2tlbnMoKTtcbiAgIGF3YWl0IGFjY291bnRzLl9leHBpcmVQYXNzd29yZEVucm9sbFRva2VucygpO1xuICB9LCBFWFBJUkVfVE9LRU5TX0lOVEVSVkFMX01TKTtcbn07XG5cbmNvbnN0IE9BdXRoRW5jcnlwdGlvbiA9IFBhY2thZ2VbXCJvYXV0aC1lbmNyeXB0aW9uXCJdPy5PQXV0aEVuY3J5cHRpb247XG5cbi8vIE9BdXRoIHNlcnZpY2UgZGF0YSBpcyB0ZW1wb3JhcmlseSBzdG9yZWQgaW4gdGhlIHBlbmRpbmcgY3JlZGVudGlhbHNcbi8vIGNvbGxlY3Rpb24gZHVyaW5nIHRoZSBvYXV0aCBhdXRoZW50aWNhdGlvbiBwcm9jZXNzLiAgU2Vuc2l0aXZlIGRhdGFcbi8vIHN1Y2ggYXMgYWNjZXNzIHRva2VucyBhcmUgZW5jcnlwdGVkIHdpdGhvdXQgdGhlIHVzZXIgaWQgYmVjYXVzZVxuLy8gd2UgZG9uJ3Qga25vdyB0aGUgdXNlciBpZCB5ZXQuICBXZSByZS1lbmNyeXB0IHRoZXNlIGZpZWxkcyB3aXRoIHRoZVxuLy8gdXNlciBpZCBpbmNsdWRlZCB3aGVuIHN0b3JpbmcgdGhlIHNlcnZpY2UgZGF0YSBwZXJtYW5lbnRseSBpblxuLy8gdGhlIHVzZXJzIGNvbGxlY3Rpb24uXG4vL1xuY29uc3QgcGluRW5jcnlwdGVkRmllbGRzVG9Vc2VyID0gKHNlcnZpY2VEYXRhLCB1c2VySWQpID0+IHtcbiAgT2JqZWN0LmtleXMoc2VydmljZURhdGEpLmZvckVhY2goa2V5ID0+IHtcbiAgICBsZXQgdmFsdWUgPSBzZXJ2aWNlRGF0YVtrZXldO1xuICAgIGlmIChPQXV0aEVuY3J5cHRpb24/LmlzU2VhbGVkKHZhbHVlKSlcbiAgICAgIHZhbHVlID0gT0F1dGhFbmNyeXB0aW9uLnNlYWwoT0F1dGhFbmNyeXB0aW9uLm9wZW4odmFsdWUpLCB1c2VySWQpO1xuICAgIHNlcnZpY2VEYXRhW2tleV0gPSB2YWx1ZTtcbiAgfSk7XG59O1xuXG4vLyBYWFggc2VlIGNvbW1lbnQgb24gQWNjb3VudHMuY3JlYXRlVXNlciBpbiBwYXNzd29yZHNfc2VydmVyIGFib3V0IGFkZGluZyBhXG4vLyBzZWNvbmQgXCJzZXJ2ZXIgb3B0aW9uc1wiIGFyZ3VtZW50LlxuY29uc3QgZGVmYXVsdENyZWF0ZVVzZXJIb29rID0gKG9wdGlvbnMsIHVzZXIpID0+IHtcbiAgaWYgKG9wdGlvbnMucHJvZmlsZSlcbiAgICB1c2VyLnByb2ZpbGUgPSBvcHRpb25zLnByb2ZpbGU7XG4gIHJldHVybiB1c2VyO1xufTtcblxuLy8gVmFsaWRhdGUgbmV3IHVzZXIncyBlbWFpbCBvciBHb29nbGUvRmFjZWJvb2svR2l0SHViIGFjY291bnQncyBlbWFpbFxuZnVuY3Rpb24gZGVmYXVsdFZhbGlkYXRlTmV3VXNlckhvb2sodXNlcikge1xuICBjb25zdCBkb21haW4gPSB0aGlzLl9vcHRpb25zLnJlc3RyaWN0Q3JlYXRpb25CeUVtYWlsRG9tYWluO1xuICBpZiAoIWRvbWFpbikge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgbGV0IGVtYWlsSXNHb29kID0gZmFsc2U7XG4gIGlmICh1c2VyLmVtYWlscyAmJiB1c2VyLmVtYWlscy5sZW5ndGggPiAwKSB7XG4gICAgZW1haWxJc0dvb2QgPSB1c2VyLmVtYWlscy5yZWR1Y2UoXG4gICAgICAocHJldiwgZW1haWwpID0+IHByZXYgfHwgdGhpcy5fdGVzdEVtYWlsRG9tYWluKGVtYWlsLmFkZHJlc3MpLCBmYWxzZVxuICAgICk7XG4gIH0gZWxzZSBpZiAodXNlci5zZXJ2aWNlcyAmJiBPYmplY3QudmFsdWVzKHVzZXIuc2VydmljZXMpLmxlbmd0aCA+IDApIHtcbiAgICAvLyBGaW5kIGFueSBlbWFpbCBvZiBhbnkgc2VydmljZSBhbmQgY2hlY2sgaXRcbiAgICBlbWFpbElzR29vZCA9IE9iamVjdC52YWx1ZXModXNlci5zZXJ2aWNlcykucmVkdWNlKFxuICAgICAgKHByZXYsIHNlcnZpY2UpID0+IHNlcnZpY2UuZW1haWwgJiYgdGhpcy5fdGVzdEVtYWlsRG9tYWluKHNlcnZpY2UuZW1haWwpLFxuICAgICAgZmFsc2UsXG4gICAgKTtcbiAgfVxuXG4gIGlmIChlbWFpbElzR29vZCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBkb21haW4gPT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIGBAJHtkb21haW59IGVtYWlsIHJlcXVpcmVkYCk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiRW1haWwgZG9lc24ndCBtYXRjaCB0aGUgY3JpdGVyaWEuXCIpO1xuICB9XG59XG5cbmNvbnN0IHNldHVwVXNlcnNDb2xsZWN0aW9uID0gYXN5bmMgdXNlcnMgPT4ge1xuICAvLy9cbiAgLy8vIFJFU1RSSUNUSU5HIFdSSVRFUyBUTyBVU0VSIE9CSkVDVFNcbiAgLy8vXG4gIHVzZXJzLmFsbG93KHtcbiAgICAvLyBjbGllbnRzIGNhbiBtb2RpZnkgdGhlIHByb2ZpbGUgZmllbGQgb2YgdGhlaXIgb3duIGRvY3VtZW50LCBhbmRcbiAgICAvLyBub3RoaW5nIGVsc2UuXG4gICAgdXBkYXRlOiAodXNlcklkLCB1c2VyLCBmaWVsZHMsIG1vZGlmaWVyKSA9PiB7XG4gICAgICAvLyBtYWtlIHN1cmUgaXQgaXMgb3VyIHJlY29yZFxuICAgICAgaWYgKHVzZXIuX2lkICE9PSB1c2VySWQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICAvLyB1c2VyIGNhbiBvbmx5IG1vZGlmeSB0aGUgJ3Byb2ZpbGUnIGZpZWxkLiBzZXRzIHRvIG11bHRpcGxlXG4gICAgICAvLyBzdWIta2V5cyAoZWcgcHJvZmlsZS5mb28gYW5kIHByb2ZpbGUuYmFyKSBhcmUgbWVyZ2VkIGludG8gZW50cnlcbiAgICAgIC8vIGluIHRoZSBmaWVsZHMgbGlzdC5cbiAgICAgIGlmIChmaWVsZHMubGVuZ3RoICE9PSAxIHx8IGZpZWxkc1swXSAhPT0gJ3Byb2ZpbGUnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcbiAgICBmZXRjaDogWydfaWQnXSAvLyB3ZSBvbmx5IGxvb2sgYXQgX2lkLlxuICB9KTtcblxuICAvLy8gREVGQVVMVCBJTkRFWEVTIE9OIFVTRVJTXG4gIGF3YWl0IHVzZXJzLmNyZWF0ZUluZGV4QXN5bmMoJ3VzZXJuYW1lJywgeyB1bmlxdWU6IHRydWUsIHNwYXJzZTogdHJ1ZSB9KTtcbiAgYXdhaXQgdXNlcnMuY3JlYXRlSW5kZXhBc3luYygnZW1haWxzLmFkZHJlc3MnLCB7IHVuaXF1ZTogdHJ1ZSwgc3BhcnNlOiB0cnVlIH0pO1xuICBhd2FpdCB1c2Vycy5jcmVhdGVJbmRleEFzeW5jKCdzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMuaGFzaGVkVG9rZW4nLFxuICAgIHsgdW5pcXVlOiB0cnVlLCBzcGFyc2U6IHRydWUgfSk7XG4gIGF3YWl0IHVzZXJzLmNyZWF0ZUluZGV4QXN5bmMoJ3NlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vucy50b2tlbicsXG4gICAgeyB1bmlxdWU6IHRydWUsIHNwYXJzZTogdHJ1ZSB9KTtcbiAgLy8gRm9yIHRha2luZyBjYXJlIG9mIGxvZ291dE90aGVyQ2xpZW50cyBjYWxscyB0aGF0IGNyYXNoZWQgYmVmb3JlIHRoZVxuICAvLyB0b2tlbnMgd2VyZSBkZWxldGVkLlxuICBhd2FpdCB1c2Vycy5jcmVhdGVJbmRleEFzeW5jKCdzZXJ2aWNlcy5yZXN1bWUuaGF2ZUxvZ2luVG9rZW5zVG9EZWxldGUnLFxuICAgIHsgc3BhcnNlOiB0cnVlIH0pO1xuICAvLyBGb3IgZXhwaXJpbmcgbG9naW4gdG9rZW5zXG4gIGF3YWl0IHVzZXJzLmNyZWF0ZUluZGV4QXN5bmMoXCJzZXJ2aWNlcy5yZXN1bWUubG9naW5Ub2tlbnMud2hlblwiLCB7IHNwYXJzZTogdHJ1ZSB9KTtcbiAgLy8gRm9yIGV4cGlyaW5nIHBhc3N3b3JkIHRva2Vuc1xuICBhd2FpdCB1c2Vycy5jcmVhdGVJbmRleEFzeW5jKCdzZXJ2aWNlcy5wYXNzd29yZC5yZXNldC53aGVuJywgeyBzcGFyc2U6IHRydWUgfSk7XG4gIGF3YWl0IHVzZXJzLmNyZWF0ZUluZGV4QXN5bmMoJ3NlcnZpY2VzLnBhc3N3b3JkLmVucm9sbC53aGVuJywgeyBzcGFyc2U6IHRydWUgfSk7XG59O1xuXG5cbi8vIEdlbmVyYXRlcyBwZXJtdXRhdGlvbnMgb2YgYWxsIGNhc2UgdmFyaWF0aW9ucyBvZiBhIGdpdmVuIHN0cmluZy5cbmNvbnN0IGdlbmVyYXRlQ2FzZVBlcm11dGF0aW9uc0ZvclN0cmluZyA9IHN0cmluZyA9PiB7XG4gIGxldCBwZXJtdXRhdGlvbnMgPSBbJyddO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmluZy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGNoID0gc3RyaW5nLmNoYXJBdChpKTtcbiAgICBwZXJtdXRhdGlvbnMgPSBbXS5jb25jYXQoLi4uKHBlcm11dGF0aW9ucy5tYXAocHJlZml4ID0+IHtcbiAgICAgIGNvbnN0IGxvd2VyQ2FzZUNoYXIgPSBjaC50b0xvd2VyQ2FzZSgpO1xuICAgICAgY29uc3QgdXBwZXJDYXNlQ2hhciA9IGNoLnRvVXBwZXJDYXNlKCk7XG4gICAgICAvLyBEb24ndCBhZGQgdW5uZWNlc3NhcnkgcGVybXV0YXRpb25zIHdoZW4gY2ggaXMgbm90IGEgbGV0dGVyXG4gICAgICBpZiAobG93ZXJDYXNlQ2hhciA9PT0gdXBwZXJDYXNlQ2hhcikge1xuICAgICAgICByZXR1cm4gW3ByZWZpeCArIGNoXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBbcHJlZml4ICsgbG93ZXJDYXNlQ2hhciwgcHJlZml4ICsgdXBwZXJDYXNlQ2hhcl07XG4gICAgICB9XG4gICAgfSkpKTtcbiAgfVxuICByZXR1cm4gcGVybXV0YXRpb25zO1xufVxuIl19
