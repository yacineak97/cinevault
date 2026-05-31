Package["core-runtime"].queue("accounts-password",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var Accounts = Package['accounts-base'].Accounts;
var SHA256 = Package.sha.SHA256;
var EJSON = Package.ejson.EJSON;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var Email = Package.email.Email;
var EmailInternals = Package.email.EmailInternals;
var Random = Package.random.Random;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"accounts-password":{"email_templates.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/accounts-password/email_templates.js                                                                    //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    const greet = welcomeMsg => (user, url) => {
      const greeting = user.profile && user.profile.name ? "Hello ".concat(user.profile.name, ",") : 'Hello,';
      return "".concat(greeting, "\n\n").concat(welcomeMsg, ", simply click the link below.\n\n").concat(url, "\n\nThank you.\n");
    };

    /**
     * @summary Options to customize emails sent from the Accounts system.
     * @locus Server
     * @importFromPackage accounts-base
     */
    Accounts.emailTemplates = _objectSpread(_objectSpread({}, Accounts.emailTemplates || {}), {}, {
      from: 'Accounts Example <no-reply@example.com>',
      siteName: Meteor.absoluteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''),
      resetPassword: {
        subject: () => "How to reset your password on ".concat(Accounts.emailTemplates.siteName),
        text: greet('To reset your password')
      },
      verifyEmail: {
        subject: () => "How to verify email address on ".concat(Accounts.emailTemplates.siteName),
        text: greet('To verify your account email')
      },
      enrollAccount: {
        subject: () => "An account has been created for you on ".concat(Accounts.emailTemplates.siteName),
        text: greet('To start using the service')
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
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"password_server.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// packages/accounts-password/password_server.js                                                                    //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    let argon2;
    module.link("argon2", {
      default(v) {
        argon2 = v;
      }
    }, 0);
    let Accounts;
    module.link("meteor/accounts-base", {
      Accounts(v) {
        Accounts = v;
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
    let bcryptHash, bcryptCompare;
    module.link("bcrypt", {
      hash(v) {
        bcryptHash = v;
      },
      compare(v) {
        bcryptCompare = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Utility for grabbing user
    const getUserById = async (id, options) => await Meteor.users.findOneAsync(id, Accounts._addDefaultFieldSelector(options));

    // User records have two fields that are used for password-based login:
    // - 'services.password.bcrypt', which stores the bcrypt password, which will be deprecated
    // - 'services.password.argon2', which stores the argon2 password
    //
    // When the client sends a password to the server, it can either be a
    // string (the plaintext password) or an object with keys 'digest' and
    // 'algorithm' (must be "sha-256" for now). The Meteor client always sends
    // password objects { digest: *, algorithm: "sha-256" }, but DDP clients
    // that don't have access to SHA can just send plaintext passwords as
    // strings.
    //
    // When the server receives a plaintext password as a string, it always
    // hashes it with SHA256 before passing it into bcrypt / argon2. When the server
    // receives a password as an object, it asserts that the algorithm is
    // "sha-256" and then passes the digest to bcrypt / argon2.

    Accounts._bcryptRounds = () => Accounts._options.bcryptRounds || 10;
    Accounts._argon2Enabled = () => Accounts._options.argon2Enabled || false;
    const ARGON2_TYPES = {
      argon2i: argon2.argon2i,
      argon2d: argon2.argon2d,
      argon2id: argon2.argon2id
    };
    Accounts._argon2Type = () => ARGON2_TYPES[Accounts._options.argon2Type] || argon2.argon2id;
    Accounts._argon2TimeCost = () => Accounts._options.argon2TimeCost || 2;
    Accounts._argon2MemoryCost = () => Accounts._options.argon2MemoryCost || 19456;
    Accounts._argon2Parallelism = () => Accounts._options.argon2Parallelism || 1;

    /**
     * Extracts the string to be encrypted using bcrypt or Argon2 from the given `password`.
     *
     * @param {string|Object} password - The password provided by the client. It can be:
     *  - A plaintext string password.
     *  - An object with the following properties:
     *      @property {string} digest - The hashed password.
     *      @property {string} algorithm - The hashing algorithm used. Must be "sha-256".
     *
     * @returns {string} - The resulting password string to encrypt.
     *
     * @throws {Error} - If the `algorithm` in the password object is not "sha-256".
     */
    const getPasswordString = password => {
      if (typeof password === "string") {
        password = SHA256(password);
      } else {
        // 'password' is an object
        if (password.algorithm !== "sha-256") {
          throw new Error("Invalid password hash algorithm. " + "Only 'sha-256' is allowed.");
        }
        password = password.digest;
      }
      return password;
    };

    /**
     * Encrypt the given `password` using either bcrypt or Argon2.
     * @param password can be a string (in which case it will be run through SHA256 before encryption) or an object with properties `digest` and `algorithm` (in which case we bcrypt or Argon2 `password.digest`).
     * @returns {Promise<string>} The encrypted password.
     */
    const hashPassword = async password => {
      password = getPasswordString(password);
      if (Accounts._argon2Enabled() === true) {
        return await argon2.hash(password, {
          type: Accounts._argon2Type(),
          timeCost: Accounts._argon2TimeCost(),
          memoryCost: Accounts._argon2MemoryCost(),
          parallelism: Accounts._argon2Parallelism()
        });
      } else {
        return await bcryptHash(password, Accounts._bcryptRounds());
      }
    };

    // Extract the number of rounds used in the specified bcrypt hash.
    const getRoundsFromBcryptHash = hash => {
      let rounds;
      if (hash) {
        const hashSegments = hash.split("$");
        if (hashSegments.length > 2) {
          rounds = parseInt(hashSegments[2], 10);
        }
      }
      return rounds;
    };
    Accounts._getRoundsFromBcryptHash = getRoundsFromBcryptHash;

    /**
     * Extract readable parameters from an Argon2 hash string.
     * @param {string} hash - The Argon2 hash string.
     * @returns {object} An object containing the parsed parameters.
     * @throws {Error} If the hash format is invalid.
     */
    function getArgon2Params(hash) {
      const regex = /^\$(argon2(?:i|d|id))\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)/;
      const match = hash.match(regex);
      if (!match) {
        throw new Error("Invalid Argon2 hash format.");
      }
      const [, type, memoryCost, timeCost, parallelism] = match;
      return {
        type: ARGON2_TYPES[type],
        timeCost: parseInt(timeCost, 10),
        memoryCost: parseInt(memoryCost, 10),
        parallelism: parseInt(parallelism, 10)
      };
    }
    Accounts._getArgon2Params = getArgon2Params;
    const getUserPasswordHash = user => {
      var _user$services, _user$services$passwo, _user$services2, _user$services2$passw;
      return ((_user$services = user.services) === null || _user$services === void 0 ? void 0 : (_user$services$passwo = _user$services.password) === null || _user$services$passwo === void 0 ? void 0 : _user$services$passwo.argon2) || ((_user$services2 = user.services) === null || _user$services2 === void 0 ? void 0 : (_user$services2$passw = _user$services2.password) === null || _user$services2$passw === void 0 ? void 0 : _user$services2$passw.bcrypt);
    };
    Accounts._checkPasswordUserFields = {
      _id: 1,
      services: 1
    };
    const isBcrypt = hash => {
      // bcrypt hashes start with $2a$ or $2b$
      return hash.startsWith("$2");
    };
    const isArgon = hash => {
      // argon2 hashes start with $argon2i$, $argon2d$ or $argon2id$
      return hash.startsWith("$argon2");
    };
    const updateUserPasswordDefered = (user, formattedPassword) => {
      Meteor.defer(async () => {
        await updateUserPassword(user, formattedPassword);
      });
    };

    /**
     * Hashes the provided password and returns an object that can be used to update the user's password.
     * @param formattedPassword
     * @returns {Promise<{$set: {"services.password.bcrypt": string}}|{$unset: {"services.password.bcrypt": number}, $set: {"services.password.argon2": string}}>}
     */
    const getUpdatorForUserPassword = async formattedPassword => {
      const encryptedPassword = await hashPassword(formattedPassword);
      if (Accounts._argon2Enabled() === false) {
        return {
          $set: {
            "services.password.bcrypt": encryptedPassword
          },
          $unset: {
            "services.password.argon2": 1
          }
        };
      } else if (Accounts._argon2Enabled() === true) {
        return {
          $set: {
            "services.password.argon2": encryptedPassword
          },
          $unset: {
            "services.password.bcrypt": 1
          }
        };
      }
    };
    const updateUserPassword = async (user, formattedPassword) => {
      const updator = await getUpdatorForUserPassword(formattedPassword);
      await Meteor.users.updateAsync({
        _id: user._id
      }, updator);
    };

    /**
     * Checks whether the provided password matches the hashed password stored in the user's database record.
     *
     * @param {Object} user - The user object containing at least:
     *   @property {string} _id - The user's unique identifier.
     *   @property {Object} services - The user's services data.
     *   @property {Object} services.password - The user's password object.
     *   @property {string} [services.password.argon2] - The Argon2 hashed password.
     *   @property {string} [services.password.bcrypt] - The bcrypt hashed password, deprecated
     *
     * @param {string|Object} password - The password provided by the client. It can be:
     *   - A plaintext string password.
     *   - An object with the following properties:
     *       @property {string} digest - The hashed password.
     *       @property {string} algorithm - The hashing algorithm used. Must be "sha-256".
     *
     * @returns {Promise<Object>} - A result object with the following properties:
     *   @property {string} userId - The user's unique identifier.
     *   @property {Object} [error] - An error object if the password does not match or an error occurs.
     *
     * @throws {Error} - If an unexpected error occurs during the process.
     */
    const checkPasswordAsync = async (user, password) => {
      const result = {
        userId: user._id
      };
      const formattedPassword = getPasswordString(password);
      const hash = getUserPasswordHash(user);
      const argon2Enabled = Accounts._argon2Enabled();
      if (argon2Enabled === false) {
        if (isArgon(hash)) {
          // this is a rollback feature, enabling to switch back from argon2 to bcrypt if needed
          // TODO : deprecate this
          console.warn("User has an argon2 password and argon2 is not enabled, rolling back to bcrypt encryption");
          const match = await argon2.verify(hash, formattedPassword);
          if (!match) {
            result.error = Accounts._handleError("Incorrect password", false);
          } else {
            // The password checks out, but the user's stored password needs to be updated to argon2
            updateUserPasswordDefered(user, {
              digest: formattedPassword,
              algorithm: "sha-256"
            });
          }
        } else {
          const hashRounds = getRoundsFromBcryptHash(hash);
          const match = await bcryptCompare(formattedPassword, hash);
          if (!match) {
            result.error = Accounts._handleError("Incorrect password", false);
          } else if (hash) {
            const paramsChanged = hashRounds !== Accounts._bcryptRounds();
            // The password checks out, but the user's bcrypt hash needs to be updated
            // to match current bcrypt settings
            if (paramsChanged === true) {
              updateUserPasswordDefered(user, {
                digest: formattedPassword,
                algorithm: "sha-256"
              });
            }
          }
        }
      } else if (argon2Enabled === true) {
        if (isBcrypt(hash)) {
          // migration code from bcrypt to argon2
          const match = await bcryptCompare(formattedPassword, hash);
          if (!match) {
            result.error = Accounts._handleError("Incorrect password", false);
          } else {
            // The password checks out, but the user's stored password needs to be updated to argon2
            updateUserPasswordDefered(user, {
              digest: formattedPassword,
              algorithm: "sha-256"
            });
          }
        } else {
          // argon2 password
          const argon2Params = getArgon2Params(hash);
          const match = await argon2.verify(hash, formattedPassword);
          if (!match) {
            result.error = Accounts._handleError("Incorrect password", false);
          } else if (hash) {
            const paramsChanged = argon2Params.memoryCost !== Accounts._argon2MemoryCost() || argon2Params.timeCost !== Accounts._argon2TimeCost() || argon2Params.parallelism !== Accounts._argon2Parallelism() || argon2Params.type !== Accounts._argon2Type();
            if (paramsChanged === true) {
              // The password checks out, but the user's argon2 hash needs to be updated with the right params
              updateUserPasswordDefered(user, {
                digest: formattedPassword,
                algorithm: "sha-256"
              });
            }
          }
        }
      }
      return result;
    };
    Accounts._checkPasswordAsync = checkPasswordAsync;

    ///
    /// LOGIN
    ///

    const passwordValidator = Match.OneOf(Match.Where(str => {
      var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
      return Match.test(str, String) && str.length <= (((_Meteor$settings = Meteor.settings) === null || _Meteor$settings === void 0 ? void 0 : (_Meteor$settings$pack = _Meteor$settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : (_Meteor$settings$pack2 = _Meteor$settings$pack.accounts) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2.passwordMaxLength) || 256);
    }), {
      digest: Match.Where(str => Match.test(str, String) && str.length === 64),
      algorithm: Match.OneOf('sha-256')
    });

    // Handler to login with a password.
    //
    // The Meteor client sets options.password to an object with keys
    // 'digest' (set to SHA256(password)) and 'algorithm' ("sha-256").
    //
    // For other DDP clients which don't have access to SHA, the handler
    // also accepts the plaintext password in options.password as a string.
    //
    // (It might be nice if servers could turn the plaintext password
    // option off. Or maybe it should be opt-in, not opt-out?
    // Accounts.config option?)
    //
    // Note that neither password option is secure without SSL.
    //
    Accounts.registerLoginHandler("password", async options => {
      var _Accounts$_check2faEn, _Accounts;
      if (!options.password) return undefined; // don't handle

      check(options, {
        user: Accounts._userQueryValidator,
        password: passwordValidator,
        code: Match.Optional(Match.NonEmptyString)
      });
      const user = await Accounts._findUserByQuery(options.user, {
        fields: _objectSpread({
          services: 1
        }, Accounts._checkPasswordUserFields)
      });
      if (!user) {
        Accounts._handleError("User not found");
      }
      if (!getUserPasswordHash(user)) {
        Accounts._handleError("User has no password set");
      }
      const result = await checkPasswordAsync(user, options.password);
      // This method is added by the package accounts-2fa
      // First the login is validated, then the code situation is checked
      if (!result.error && (_Accounts$_check2faEn = (_Accounts = Accounts)._check2faEnabled) !== null && _Accounts$_check2faEn !== void 0 && _Accounts$_check2faEn.call(_Accounts, user)) {
        if (!options.code) {
          Accounts._handleError('2FA code must be informed', true, 'no-2fa-code');
        }
        if (!Accounts._isTokenValid(user.services.twoFactorAuthentication.secret, options.code)) {
          Accounts._handleError('Invalid 2FA code', true, 'invalid-2fa-code');
        }
      }
      return result;
    });

    ///
    /// CHANGING
    ///

    /**
     * @summary Change a user's username asynchronously. Use this instead of updating the
     * database directly. The operation will fail if there is an existing user
     * with a username only differing in case.
     * @locus Server
     * @param {String} userId The ID of the user to update.
     * @param {String} newUsername A new username for the user.
     * @importFromPackage accounts-base
     */
    Accounts.setUsername = async (userId, newUsername) => {
      check(userId, Match.NonEmptyString);
      check(newUsername, Match.NonEmptyString);
      const user = await getUserById(userId, {
        fields: {
          username: 1
        }
      });
      if (!user) {
        Accounts._handleError("User not found");
      }
      const oldUsername = user.username;

      // Perform a case insensitive check for duplicates before update
      await Accounts._checkForCaseInsensitiveDuplicates('username', 'Username', newUsername, user._id);
      await Meteor.users.updateAsync({
        _id: user._id
      }, {
        $set: {
          username: newUsername
        }
      });

      // Perform another check after update, in case a matching user has been
      // inserted in the meantime
      try {
        await Accounts._checkForCaseInsensitiveDuplicates('username', 'Username', newUsername, user._id);
      } catch (ex) {
        // Undo update if the check fails
        await Meteor.users.updateAsync({
          _id: user._id
        }, {
          $set: {
            username: oldUsername
          }
        });
        throw ex;
      }
    };

    // Let the user change their own password if they know the old
    // password. `oldPassword` and `newPassword` should be objects with keys
    // `digest` and `algorithm` (representing the SHA256 of the password).
    Meteor.methods({
      changePassword: async function (oldPassword, newPassword) {
        check(oldPassword, passwordValidator);
        check(newPassword, passwordValidator);
        if (!this.userId) {
          throw new Meteor.Error(401, "Must be logged in");
        }
        const user = await getUserById(this.userId, {
          fields: _objectSpread({
            services: 1
          }, Accounts._checkPasswordUserFields)
        });
        if (!user) {
          Accounts._handleError("User not found");
        }
        if (!getUserPasswordHash(user)) {
          Accounts._handleError("User has no password set");
        }
        const result = await checkPasswordAsync(user, oldPassword);
        if (result.error) {
          throw result.error;
        }

        // It would be better if this removed ALL existing tokens and replaced
        // the token for the current connection with a new one, but that would
        // be tricky, so we'll settle for just replacing all tokens other than
        // the one for the current connection.
        const currentToken = Accounts._getLoginToken(this.connection.id);
        const updator = await getUpdatorForUserPassword(newPassword);
        await Meteor.users.updateAsync({
          _id: this.userId
        }, {
          $set: updator.$set,
          $pull: {
            "services.resume.loginTokens": {
              hashedToken: {
                $ne: currentToken
              }
            }
          },
          $unset: _objectSpread({
            "services.password.reset": 1
          }, updator.$unset)
        });
        return {
          passwordChanged: true
        };
      }
    });

    // Force change the users password.

    /**
     * @summary Forcibly change the password for a user.
     * @locus Server
     * @param {String} userId The id of the user to update.
     * @param {String} newPlaintextPassword A new password for the user.
     * @param {Object} [options]
     * @param {Object} options.logout Logout all current connections with this userId (default: true)
     * @importFromPackage accounts-base
     */
    Accounts.setPasswordAsync = async (userId, newPlaintextPassword, options) => {
      check(userId, String);
      check(newPlaintextPassword, Match.Where(str => {
        var _Meteor$settings2, _Meteor$settings2$pac, _Meteor$settings2$pac2;
        return Match.test(str, String) && str.length <= (((_Meteor$settings2 = Meteor.settings) === null || _Meteor$settings2 === void 0 ? void 0 : (_Meteor$settings2$pac = _Meteor$settings2.packages) === null || _Meteor$settings2$pac === void 0 ? void 0 : (_Meteor$settings2$pac2 = _Meteor$settings2$pac.accounts) === null || _Meteor$settings2$pac2 === void 0 ? void 0 : _Meteor$settings2$pac2.passwordMaxLength) || 256);
      }));
      check(options, Match.Maybe({
        logout: Boolean
      }));
      options = _objectSpread({
        logout: true
      }, options);
      const user = await getUserById(userId, {
        fields: {
          _id: 1
        }
      });
      if (!user) {
        throw new Meteor.Error(403, "User not found");
      }
      let updator = await getUpdatorForUserPassword(newPlaintextPassword);
      updator.$unset = updator.$unset || {};
      updator.$unset["services.password.reset"] = 1;
      if (options.logout) {
        updator.$unset["services.resume.loginTokens"] = 1;
      }
      await Meteor.users.updateAsync({
        _id: user._id
      }, updator);
    };

    ///
    /// RESETTING VIA EMAIL
    ///

    // Utility for plucking addresses from emails
    const pluckAddresses = function () {
      let emails = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
      return emails.map(email => email.address);
    };

    // Method called by a user to request a password reset email. This is
    // the start of the reset process.
    Meteor.methods({
      forgotPassword: async options => {
        check(options, {
          email: String
        });
        const user = await Accounts.findUserByEmail(options.email, {
          fields: {
            emails: 1
          }
        });
        if (!user) {
          if (Accounts._options.ambiguousErrorMessages) return;
          Accounts._handleError("User not found");
        }
        const emails = pluckAddresses(user.emails);
        const caseSensitiveEmail = emails.find(email => email.toLowerCase() === options.email.toLowerCase());
        await Accounts.sendResetPasswordEmail(user._id, caseSensitiveEmail);
      }
    });

    /**
     * @summary Asynchronously generates a reset token and saves it into the database.
     * @locus Server
     * @param {String} userId The id of the user to generate the reset token for.
     * @param {String} email Which address of the user to generate the reset token for. This address must be in the user's `emails` list. If `null`, defaults to the first email in the list.
     * @param {String} reason `resetPassword` or `enrollAccount`.
     * @param {Object} [extraTokenData] Optional additional data to be added into the token record.
     * @returns {Promise<Object>} Promise of an object with {email, user, token} values.
     * @importFromPackage accounts-base
     */
    Accounts.generateResetToken = async (userId, email, reason, extraTokenData) => {
      // Make sure the user exists, and email is one of their addresses.
      // Don't limit the fields in the user object since the user is returned
      // by the function and some other fields might be used elsewhere.
      const user = await getUserById(userId);
      if (!user) {
        Accounts._handleError("Can't find user");
      }

      // pick the first email if we weren't passed an email.
      if (!email && user.emails && user.emails[0]) {
        email = user.emails[0].address;
      }

      // make sure we have a valid email
      if (!email || !pluckAddresses(user.emails).includes(email)) {
        Accounts._handleError("No such email for user.");
      }
      const token = Random.secret();
      const tokenRecord = {
        token,
        email,
        when: new Date()
      };
      if (reason === 'resetPassword') {
        tokenRecord.reason = 'reset';
      } else if (reason === 'enrollAccount') {
        tokenRecord.reason = 'enroll';
      } else if (reason) {
        // fallback so that this function can be used for unknown reasons as well
        tokenRecord.reason = reason;
      }
      if (extraTokenData) {
        Object.assign(tokenRecord, extraTokenData);
      }
      // if this method is called from the enroll account work-flow then
      // store the token record in 'services.password.enroll' db field
      // else store the token record in in 'services.password.reset' db field
      if (reason === "enrollAccount") {
        await Meteor.users.updateAsync({
          _id: user._id
        }, {
          $set: {
            "services.password.enroll": tokenRecord
          }
        });
        // before passing to template, update user object with new token
        Meteor._ensure(user, "services", "password").enroll = tokenRecord;
      } else {
        await Meteor.users.updateAsync({
          _id: user._id
        }, {
          $set: {
            "services.password.reset": tokenRecord
          }
        });
        // before passing to template, update user object with new token
        Meteor._ensure(user, "services", "password").reset = tokenRecord;
      }
      return {
        email,
        user,
        token
      };
    };

    /**
     * @summary Generates asynchronously an e-mail verification token and saves it into the database.
     * @locus Server
     * @param {String} userId The id of the user to generate the  e-mail verification token for.
     * @param {String} email Which address of the user to generate the e-mail verification token for. This address must be in the user's `emails` list. If `null`, defaults to the first unverified email in the list.
     * @param {Object} [extraTokenData] Optional additional data to be added into the token record.
     * @returns {Promise<Object>} Promise of an object with {email, user, token} values.
     * @importFromPackage accounts-base
     */
    Accounts.generateVerificationToken = async (userId, email, extraTokenData) => {
      // Make sure the user exists, and email is one of their addresses.
      // Don't limit the fields in the user object since the user is returned
      // by the function and some other fields might be used elsewhere.
      const user = await getUserById(userId);
      if (!user) {
        Accounts._handleError("Can't find user");
      }

      // pick the first unverified email if we weren't passed an email.
      if (!email) {
        const emailRecord = (user.emails || []).find(e => !e.verified);
        email = (emailRecord || {}).address;
        if (!email) {
          Accounts._handleError("That user has no unverified email addresses.");
        }
      }

      // make sure we have a valid email
      if (!email || !pluckAddresses(user.emails).includes(email)) {
        Accounts._handleError("No such email for user.");
      }
      const token = Random.secret();
      const tokenRecord = {
        token,
        // TODO: This should probably be renamed to "email" to match reset token record.
        address: email,
        when: new Date()
      };
      if (extraTokenData) {
        Object.assign(tokenRecord, extraTokenData);
      }
      await Meteor.users.updateAsync({
        _id: user._id
      }, {
        $push: {
          'services.email.verificationTokens': tokenRecord
        }
      });

      // before passing to template, update user object with new token
      Meteor._ensure(user, 'services', 'email');
      if (!user.services.email.verificationTokens) {
        user.services.email.verificationTokens = [];
      }
      user.services.email.verificationTokens.push(tokenRecord);
      return {
        email,
        user,
        token
      };
    };

    // send the user an email with a link that when opened allows the user
    // to set a new password, without the old password.

    /**
     * @summary Send an email asynchronously with a link the user can use to reset their password.
     * @locus Server
     * @param {String} userId The id of the user to send email to.
     * @param {String} [email] Optional. Which address of the user's to send the email to. This address must be in the user's `emails` list. Defaults to the first email in the list.
     * @param {Object} [extraTokenData] Optional additional data to be added into the token record.
     * @param {Object} [extraParams] Optional additional params to be added to the reset url.
     * @returns {Promise<Object>} Promise of an object with {email, user, token, url, options} values.
     * @importFromPackage accounts-base
     */
    Accounts.sendResetPasswordEmail = async (userId, email, extraTokenData, extraParams) => {
      const {
        email: realEmail,
        user,
        token
      } = await Accounts.generateResetToken(userId, email, 'resetPassword', extraTokenData);
      const url = await Accounts._resolvePromise(Accounts.urls.resetPassword(token, extraParams));
      const options = await Accounts.generateOptionsForEmail(realEmail, user, url, 'resetPassword');
      await Email.sendAsync(options);
      if (Meteor.isDevelopment && !Meteor.isPackageTest) {
        console.log("\nReset password URL: ".concat(url));
      }
      return {
        email: realEmail,
        user,
        token,
        url,
        options
      };
    };

    // send the user an email informing them that their account was created, with
    // a link that when opened both marks their email as verified and forces them
    // to choose their password. The email must be one of the addresses in the
    // user's emails field, or undefined to pick the first email automatically.
    //
    // This is not called automatically. It must be called manually if you
    // want to use enrollment emails.

    /**
     * @summary Send an email asynchronously with a link the user can use to set their initial password.
     * @locus Server
     * @param {String} userId The id of the user to send email to.
     * @param {String} [email] Optional. Which address of the user's to send the email to. This address must be in the user's `emails` list. Defaults to the first email in the list.
     * @param {Object} [extraTokenData] Optional additional data to be added into the token record.
     * @param {Object} [extraParams] Optional additional params to be added to the enrollment url.
     * @returns {Promise<Object>} Promise of an object {email, user, token, url, options} values.
     * @importFromPackage accounts-base
     */
    Accounts.sendEnrollmentEmail = async (userId, email, extraTokenData, extraParams) => {
      const {
        email: realEmail,
        user,
        token
      } = await Accounts.generateResetToken(userId, email, 'enrollAccount', extraTokenData);
      const url = await Accounts._resolvePromise(Accounts.urls.enrollAccount(token, extraParams));
      const options = await Accounts.generateOptionsForEmail(realEmail, user, url, 'enrollAccount');
      await Email.sendAsync(options);
      if (Meteor.isDevelopment && !Meteor.isPackageTest) {
        console.log("\nEnrollment email URL: ".concat(url));
      }
      return {
        email: realEmail,
        user,
        token,
        url,
        options
      };
    };

    // Take token from sendResetPasswordEmail or sendEnrollmentEmail, change
    // the users password, and log them in.
    Meteor.methods({
      resetPassword: async function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        const token = args[0];
        const newPassword = args[1];
        return await Accounts._loginMethod(this, "resetPassword", args, "password", async () => {
          var _Accounts$_check2faEn2, _Accounts2;
          check(token, String);
          check(newPassword, passwordValidator);
          let user = await Meteor.users.findOneAsync({
            "services.password.reset.token": token
          }, {
            fields: {
              services: 1,
              emails: 1
            }
          });
          let isEnroll = false;
          // if token is in services.password.reset db field implies
          // this method is was not called from enroll account workflow
          // else this method is called from enroll account workflow
          if (!user) {
            user = await Meteor.users.findOneAsync({
              "services.password.enroll.token": token
            }, {
              fields: {
                services: 1,
                emails: 1
              }
            });
            isEnroll = true;
          }
          if (!user) {
            throw new Meteor.Error(403, "Token expired");
          }
          let tokenRecord = {};
          if (isEnroll) {
            tokenRecord = user.services.password.enroll;
          } else {
            tokenRecord = user.services.password.reset;
          }
          const {
            when,
            email
          } = tokenRecord;
          let tokenLifetimeMs = Accounts._getPasswordResetTokenLifetimeMs();
          if (isEnroll) {
            tokenLifetimeMs = Accounts._getPasswordEnrollTokenLifetimeMs();
          }
          const currentTimeMs = Date.now();
          if (currentTimeMs - when > tokenLifetimeMs) throw new Meteor.Error(403, "Token expired");
          if (!pluckAddresses(user.emails).includes(email)) return {
            userId: user._id,
            error: new Meteor.Error(403, "Token has invalid email address")
          };

          // NOTE: We're about to invalidate tokens on the user, who we might be
          // logged in as. Make sure to avoid logging ourselves out if this
          // happens. But also make sure not to leave the connection in a state
          // of having a bad token set if things fail.
          const oldToken = Accounts._getLoginToken(this.connection.id);
          Accounts._setLoginToken(user._id, this.connection, null);
          const resetToOldToken = () => Accounts._setLoginToken(user._id, this.connection, oldToken);
          const updator = await getUpdatorForUserPassword(newPassword);
          try {
            // Update the user record by:
            // - Changing the password to the new one
            // - Forgetting about the reset token or enroll token that was just used
            // - Verifying their email, since they got the password reset via email.
            let affectedRecords = {};
            // if reason is enroll then check services.password.enroll.token field for affected records
            if (isEnroll) {
              affectedRecords = await Meteor.users.updateAsync({
                _id: user._id,
                "emails.address": email,
                "services.password.enroll.token": token
              }, {
                $set: _objectSpread({
                  "emails.$.verified": true
                }, updator.$set),
                $unset: _objectSpread({
                  "services.password.enroll": 1
                }, updator.$unset)
              });
            } else {
              affectedRecords = await Meteor.users.updateAsync({
                _id: user._id,
                "emails.address": email,
                "services.password.reset.token": token
              }, {
                $set: _objectSpread({
                  "emails.$.verified": true
                }, updator.$set),
                $unset: _objectSpread({
                  "services.password.reset": 1
                }, updator.$unset)
              });
            }
            if (affectedRecords !== 1) return {
              userId: user._id,
              error: new Meteor.Error(403, "Invalid email")
            };
          } catch (err) {
            resetToOldToken();
            throw err;
          }

          // Replace all valid login tokens with new ones (changing
          // password should invalidate existing sessions).
          await Accounts._clearAllLoginTokens(user._id);
          if ((_Accounts$_check2faEn2 = (_Accounts2 = Accounts)._check2faEnabled) !== null && _Accounts$_check2faEn2 !== void 0 && _Accounts$_check2faEn2.call(_Accounts2, user)) {
            return {
              userId: user._id,
              error: Accounts._handleError('Changed password, but user not logged in because 2FA is enabled', false, '2fa-enabled')
            };
          }
          return {
            userId: user._id
          };
        });
      }
    });

    ///
    /// EMAIL VERIFICATION
    ///

    // send the user an email with a link that when opened marks that
    // address as verified

    /**
     * @summary Send an email asynchronously with a link the user can use verify their email address.
     * @locus Server
     * @param {String} userId The id of the user to send email to.
     * @param {String} [email] Optional. Which address of the user's to send the email to. This address must be in the user's `emails` list. Defaults to the first unverified email in the list.
     * @param {Object} [extraTokenData] Optional additional data to be added into the token record.
     * @param {Object} [extraParams] Optional additional params to be added to the verification url.
     * @returns {Promise<Object>} Promise of an object with {email, user, token, url, options} values.
     * @importFromPackage accounts-base
     */
    Accounts.sendVerificationEmail = async (userId, email, extraTokenData, extraParams) => {
      // XXX Also generate a link using which someone can delete this
      // account if they own said address but weren't those who created
      // this account.

      const {
        email: realEmail,
        user,
        token
      } = await Accounts.generateVerificationToken(userId, email, extraTokenData);
      const url = await Accounts._resolvePromise(Accounts.urls.verifyEmail(token, extraParams));
      const options = await Accounts.generateOptionsForEmail(realEmail, user, url, 'verifyEmail');
      await Email.sendAsync(options);
      if (Meteor.isDevelopment && !Meteor.isPackageTest) {
        console.log("\nVerification email URL: ".concat(url));
      }
      return {
        email: realEmail,
        user,
        token,
        url,
        options
      };
    };

    // Take token from sendVerificationEmail, mark the email as verified,
    // and log them in.
    Meteor.methods({
      verifyEmail: async function () {
        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }
        const token = args[0];
        return await Accounts._loginMethod(this, "verifyEmail", args, "password", async () => {
          var _Accounts$_check2faEn3, _Accounts3;
          check(token, String);
          const user = await Meteor.users.findOneAsync({
            'services.email.verificationTokens.token': token
          }, {
            fields: {
              services: 1,
              emails: 1
            }
          });
          if (!user) throw new Meteor.Error(403, "Verify email link expired");
          const tokenRecord = await user.services.email.verificationTokens.find(t => t.token == token);
          if (!tokenRecord) return {
            userId: user._id,
            error: new Meteor.Error(403, "Verify email link expired")
          };
          const emailsRecord = user.emails.find(e => e.address == tokenRecord.address);
          if (!emailsRecord) return {
            userId: user._id,
            error: new Meteor.Error(403, "Verify email link is for unknown address")
          };

          // By including the address in the query, we can use 'emails.$' in the
          // modifier to get a reference to the specific object in the emails
          // array. See
          // http://www.mongodb.org/display/DOCS/Updating/#Updating-The%24positionaloperator)
          // http://www.mongodb.org/display/DOCS/Updating#Updating-%24pull
          await Meteor.users.updateAsync({
            _id: user._id,
            'emails.address': tokenRecord.address
          }, {
            $set: {
              'emails.$.verified': true
            },
            $pull: {
              'services.email.verificationTokens': {
                address: tokenRecord.address
              }
            }
          });
          if ((_Accounts$_check2faEn3 = (_Accounts3 = Accounts)._check2faEnabled) !== null && _Accounts$_check2faEn3 !== void 0 && _Accounts$_check2faEn3.call(_Accounts3, user)) {
            return {
              userId: user._id,
              error: Accounts._handleError('Email verified, but user not logged in because 2FA is enabled', false, '2fa-enabled')
            };
          }
          return {
            userId: user._id
          };
        });
      }
    });

    /**
     * @summary Asynchronously replace an email address for a user. Use this instead of directly
     * updating the database. The operation will fail if there is a different user
     * with an email only differing in case. If the specified user has an existing
     * email only differing in case however, we replace it.
     * @locus Server
     * @param {String} userId The ID of the user to update.
     * @param {String} oldEmail The email address to replace.
     * @param {String} newEmail The new email address to use.
     * @param {Boolean} [verified] Optional - whether the new email address should
     * be marked as verified. Defaults to false.
     * @importFromPackage accounts-base
     */
    Accounts.replaceEmailAsync = async (userId, oldEmail, newEmail, verified) => {
      check(userId, Match.NonEmptyString);
      check(oldEmail, Match.NonEmptyString);
      check(newEmail, Match.NonEmptyString);
      check(verified, Match.Optional(Boolean));
      if (verified === void 0) {
        verified = false;
      }
      const user = await getUserById(userId, {
        fields: {
          _id: 1
        }
      });
      if (!user) throw new Meteor.Error(403, "User not found");

      // Ensure no user already has this new email
      await Accounts._checkForCaseInsensitiveDuplicates("emails.address", "Email", newEmail, user._id);
      const result = await Meteor.users.updateAsync({
        _id: user._id,
        'emails.address': oldEmail
      }, {
        $set: {
          'emails.$.address': newEmail,
          'emails.$.verified': verified
        }
      });
      if (result.modifiedCount === 0) {
        throw new Meteor.Error(404, "No user could be found with old email");
      }
    };

    /**
     * @summary Asynchronously add an email address for a user. Use this instead of directly
     * updating the database. The operation will fail if there is a different user
     * with an email only differing in case. If the specified user has an existing
     * email only differing in case however, we replace it.
     * @locus Server
     * @param {String} userId The ID of the user to update.
     * @param {String} newEmail A new email address for the user.
     * @param {Boolean} [verified] Optional - whether the new email address should
     * be marked as verified. Defaults to false.
     * @importFromPackage accounts-base
     */
    Accounts.addEmailAsync = async (userId, newEmail, verified) => {
      check(userId, Match.NonEmptyString);
      check(newEmail, Match.NonEmptyString);
      check(verified, Match.Optional(Boolean));
      if (verified === void 0) {
        verified = false;
      }
      const user = await getUserById(userId, {
        fields: {
          emails: 1
        }
      });
      if (!user) throw new Meteor.Error(403, "User not found");

      // Allow users to change their own email to a version with a different case

      // We don't have to call checkForCaseInsensitiveDuplicates to do a case
      // insensitive check across all emails in the database here because: (1) if
      // there is no case-insensitive duplicate between this user and other users,
      // then we are OK and (2) if this would create a conflict with other users
      // then there would already be a case-insensitive duplicate and we can't fix
      // that in this code anyway.
      const caseInsensitiveRegExp = new RegExp("^".concat(Meteor._escapeRegExp(newEmail), "$"), "i");

      // TODO: This is a linear search. If we have a lot of emails.
      //  we should consider using a different data structure.
      const updatedEmail = async function () {
        let emails = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
        let _id = arguments.length > 1 ? arguments[1] : undefined;
        let updated = false;
        for (const email of emails) {
          if (caseInsensitiveRegExp.test(email.address)) {
            await Meteor.users.updateAsync({
              _id: _id,
              "emails.address": email.address
            }, {
              $set: {
                "emails.$.address": newEmail,
                "emails.$.verified": verified
              }
            });
            updated = true;
          }
        }
        return updated;
      };
      const didUpdateOwnEmail = await updatedEmail(user.emails, user._id);

      // In the other updates below, we have to do another call to
      // checkForCaseInsensitiveDuplicates to make sure that no conflicting values
      // were added to the database in the meantime. We don't have to do this for
      // the case where the user is updating their email address to one that is the
      // same as before, but only different because of capitalization. Read the
      // big comment above to understand why.

      if (didUpdateOwnEmail) {
        return;
      }

      // Perform a case insensitive check for duplicates before update
      await Accounts._checkForCaseInsensitiveDuplicates("emails.address", "Email", newEmail, user._id);
      await Meteor.users.updateAsync({
        _id: user._id
      }, {
        $addToSet: {
          emails: {
            address: newEmail,
            verified: verified
          }
        }
      });

      // Perform another check after update, in case a matching user has been
      // inserted in the meantime
      try {
        await Accounts._checkForCaseInsensitiveDuplicates("emails.address", "Email", newEmail, user._id);
      } catch (ex) {
        // Undo update if the check fails
        await Meteor.users.updateAsync({
          _id: user._id
        }, {
          $pull: {
            emails: {
              address: newEmail
            }
          }
        });
        throw ex;
      }
    };

    /**
     * @summary Remove an email address asynchronously for a user. Use this instead of updating
     * the database directly.
     * @locus Server
     * @param {String} userId The ID of the user to update.
     * @param {String} email The email address to remove.
     * @importFromPackage accounts-base
     */
    Accounts.removeEmail = async (userId, email) => {
      check(userId, Match.NonEmptyString);
      check(email, Match.NonEmptyString);
      const user = await getUserById(userId, {
        fields: {
          _id: 1
        }
      });
      if (!user) throw new Meteor.Error(403, "User not found");
      await Meteor.users.updateAsync({
        _id: user._id
      }, {
        $pull: {
          emails: {
            address: email
          }
        }
      });
    };

    ///
    /// CREATING USERS
    ///

    // Shared createUser function called from the createUser method, both
    // if originates in client or server code. Calls user provided hooks,
    // does the actual user insertion.
    //
    // returns the user id
    const createUser = async options => {
      // Unknown keys allowed, because a onCreateUserHook can take arbitrary
      // options.
      check(options, Match.ObjectIncluding({
        username: Match.Optional(String),
        email: Match.Optional(String),
        password: Match.Optional(passwordValidator)
      }));
      const {
        username,
        email,
        password
      } = options;
      if (!username && !email) throw new Meteor.Error(400, "Need to set a username or email");
      const user = {
        services: {}
      };
      if (password) {
        const hashed = await hashPassword(password);
        const argon2Enabled = Accounts._argon2Enabled();
        if (argon2Enabled === false) {
          user.services.password = {
            bcrypt: hashed
          };
        } else {
          user.services.password = {
            argon2: hashed
          };
        }
      }
      return await Accounts._createUserCheckingDuplicates({
        user,
        email,
        username,
        options
      });
    };

    // method for create user. Requests come from the client.
    Meteor.methods({
      createUser: async function () {
        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }
        const options = args[0];
        return await Accounts._loginMethod(this, "createUser", args, "password", async () => {
          // createUser() above does more checking.
          check(options, Object);
          if (Accounts._options.forbidClientAccountCreation) return {
            error: new Meteor.Error(403, "Signups forbidden")
          };
          const userId = await Accounts.createUserVerifyingEmail(options);

          // client gets logged in as the new user afterwards.
          return {
            userId: userId
          };
        });
      }
    });

    /**
     * @summary Creates an user asynchronously and sends an email if `options.email` is informed.
     * Then if the `sendVerificationEmail` option from the `Accounts` package is
     * enabled, you'll send a verification email if `options.password` is informed,
     * otherwise you'll send an enrollment email.
     * @locus Server
     * @param {Object} options The options object to be passed down when creating
     * the user
     * @param {String} options.username A unique name for this user.
     * @param {String} options.email The user's email address.
     * @param {String} options.password The user's password. This is __not__ sent in plain text over the wire.
     * @param {Object} options.profile The user's profile, typically including the `name` field.
     * @importFromPackage accounts-base
     * */
    Accounts.createUserVerifyingEmail = async options => {
      options = _objectSpread({}, options);
      // Create user. result contains id and token.
      const userId = await createUser(options);
      // safety belt. createUser is supposed to throw on error. send 500 error
      // instead of sending a verification email with empty userid.
      if (!userId) throw new Error("createUser failed to insert new user");

      // If `Accounts._options.sendVerificationEmail` is set, register
      // a token to verify the user's primary email, and send it to
      // that address.
      if (options.email && Accounts._options.sendVerificationEmail) {
        if (options.password) {
          await Accounts.sendVerificationEmail(userId, options.email);
        } else {
          await Accounts.sendEnrollmentEmail(userId, options.email);
        }
      }
      return userId;
    };

    // Create user directly on the server.
    //
    // Unlike the client version, this does not log you in as this user
    // after creation.
    //
    // returns Promise<userId> or throws an error if it can't create
    //
    // XXX add another argument ("server options") that gets sent to onCreateUser,
    // which is always empty when called from the createUser method? eg, "admin:
    // true", which we want to prevent the client from setting, but which a custom
    // method calling Accounts.createUser could set?
    //

    Accounts.createUserAsync = createUser;

    // Create user directly on the server.
    //
    // Unlike the client version, this does not log you in as this user
    // after creation.
    //
    // returns userId or throws an error if it can't create
    //
    // XXX add another argument ("server options") that gets sent to onCreateUser,
    // which is always empty when called from the createUser method? eg, "admin:
    // true", which we want to prevent the client from setting, but which a custom
    // method calling Accounts.createUser could set?
    //

    Accounts.createUser = Accounts.createUserAsync;

    ///
    /// PASSWORD-SPECIFIC INDEXES ON USERS
    ///
    await Meteor.users.createIndexAsync('services.email.verificationTokens.token', {
      unique: true,
      sparse: true
    });
    await Meteor.users.createIndexAsync('services.password.reset.token', {
      unique: true,
      sparse: true
    });
    await Meteor.users.createIndexAsync('services.password.enroll.token', {
      unique: true,
      sparse: true
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: true
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"argon2":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// node_modules/meteor/accounts-password/node_modules/argon2/package.json                                           //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
module.exports = {
  "name": "argon2",
  "version": "0.41.1",
  "main": "argon2.cjs"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"argon2.cjs":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// node_modules/meteor/accounts-password/node_modules/argon2/argon2.cjs                                             //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"bcrypt":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// node_modules/meteor/accounts-password/node_modules/bcrypt/package.json                                           //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
module.exports = {
  "name": "bcrypt",
  "version": "5.0.1",
  "main": "./bcrypt"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"bcrypt.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                  //
// node_modules/meteor/accounts-password/node_modules/bcrypt/bcrypt.js                                              //
//                                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                    //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/accounts-password/email_templates.js",
    "/node_modules/meteor/accounts-password/password_server.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/accounts-password.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYWNjb3VudHMtcGFzc3dvcmQvZW1haWxfdGVtcGxhdGVzLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9hY2NvdW50cy1wYXNzd29yZC9wYXNzd29yZF9zZXJ2ZXIuanMiXSwibmFtZXMiOlsiX29iamVjdFNwcmVhZCIsIm1vZHVsZSIsImxpbmsiLCJkZWZhdWx0IiwidiIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiZ3JlZXQiLCJ3ZWxjb21lTXNnIiwidXNlciIsInVybCIsImdyZWV0aW5nIiwicHJvZmlsZSIsIm5hbWUiLCJjb25jYXQiLCJBY2NvdW50cyIsImVtYWlsVGVtcGxhdGVzIiwiZnJvbSIsInNpdGVOYW1lIiwiTWV0ZW9yIiwiYWJzb2x1dGVVcmwiLCJyZXBsYWNlIiwicmVzZXRQYXNzd29yZCIsInN1YmplY3QiLCJ0ZXh0IiwidmVyaWZ5RW1haWwiLCJlbnJvbGxBY2NvdW50IiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiYXJnb24yIiwiY2hlY2siLCJNYXRjaCIsImJjcnlwdEhhc2giLCJiY3J5cHRDb21wYXJlIiwiaGFzaCIsImNvbXBhcmUiLCJnZXRVc2VyQnlJZCIsImlkIiwib3B0aW9ucyIsInVzZXJzIiwiZmluZE9uZUFzeW5jIiwiX2FkZERlZmF1bHRGaWVsZFNlbGVjdG9yIiwiX2JjcnlwdFJvdW5kcyIsIl9vcHRpb25zIiwiYmNyeXB0Um91bmRzIiwiX2FyZ29uMkVuYWJsZWQiLCJhcmdvbjJFbmFibGVkIiwiQVJHT04yX1RZUEVTIiwiYXJnb24yaSIsImFyZ29uMmQiLCJhcmdvbjJpZCIsIl9hcmdvbjJUeXBlIiwiYXJnb24yVHlwZSIsIl9hcmdvbjJUaW1lQ29zdCIsImFyZ29uMlRpbWVDb3N0IiwiX2FyZ29uMk1lbW9yeUNvc3QiLCJhcmdvbjJNZW1vcnlDb3N0IiwiX2FyZ29uMlBhcmFsbGVsaXNtIiwiYXJnb24yUGFyYWxsZWxpc20iLCJnZXRQYXNzd29yZFN0cmluZyIsInBhc3N3b3JkIiwiU0hBMjU2IiwiYWxnb3JpdGhtIiwiRXJyb3IiLCJkaWdlc3QiLCJoYXNoUGFzc3dvcmQiLCJ0eXBlIiwidGltZUNvc3QiLCJtZW1vcnlDb3N0IiwicGFyYWxsZWxpc20iLCJnZXRSb3VuZHNGcm9tQmNyeXB0SGFzaCIsInJvdW5kcyIsImhhc2hTZWdtZW50cyIsInNwbGl0IiwibGVuZ3RoIiwicGFyc2VJbnQiLCJfZ2V0Um91bmRzRnJvbUJjcnlwdEhhc2giLCJnZXRBcmdvbjJQYXJhbXMiLCJyZWdleCIsIm1hdGNoIiwiX2dldEFyZ29uMlBhcmFtcyIsImdldFVzZXJQYXNzd29yZEhhc2giLCJfdXNlciRzZXJ2aWNlcyIsIl91c2VyJHNlcnZpY2VzJHBhc3N3byIsIl91c2VyJHNlcnZpY2VzMiIsIl91c2VyJHNlcnZpY2VzMiRwYXNzdyIsInNlcnZpY2VzIiwiYmNyeXB0IiwiX2NoZWNrUGFzc3dvcmRVc2VyRmllbGRzIiwiX2lkIiwiaXNCY3J5cHQiLCJzdGFydHNXaXRoIiwiaXNBcmdvbiIsInVwZGF0ZVVzZXJQYXNzd29yZERlZmVyZWQiLCJmb3JtYXR0ZWRQYXNzd29yZCIsImRlZmVyIiwidXBkYXRlVXNlclBhc3N3b3JkIiwiZ2V0VXBkYXRvckZvclVzZXJQYXNzd29yZCIsImVuY3J5cHRlZFBhc3N3b3JkIiwiJHNldCIsIiR1bnNldCIsInVwZGF0b3IiLCJ1cGRhdGVBc3luYyIsImNoZWNrUGFzc3dvcmRBc3luYyIsInJlc3VsdCIsInVzZXJJZCIsImNvbnNvbGUiLCJ3YXJuIiwidmVyaWZ5IiwiZXJyb3IiLCJfaGFuZGxlRXJyb3IiLCJoYXNoUm91bmRzIiwicGFyYW1zQ2hhbmdlZCIsImFyZ29uMlBhcmFtcyIsIl9jaGVja1Bhc3N3b3JkQXN5bmMiLCJwYXNzd29yZFZhbGlkYXRvciIsIk9uZU9mIiwiV2hlcmUiLCJzdHIiLCJfTWV0ZW9yJHNldHRpbmdzIiwiX01ldGVvciRzZXR0aW5ncyRwYWNrIiwiX01ldGVvciRzZXR0aW5ncyRwYWNrMiIsInRlc3QiLCJTdHJpbmciLCJzZXR0aW5ncyIsInBhY2thZ2VzIiwiYWNjb3VudHMiLCJwYXNzd29yZE1heExlbmd0aCIsInJlZ2lzdGVyTG9naW5IYW5kbGVyIiwiX0FjY291bnRzJF9jaGVjazJmYUVuIiwiX0FjY291bnRzIiwidW5kZWZpbmVkIiwiX3VzZXJRdWVyeVZhbGlkYXRvciIsImNvZGUiLCJPcHRpb25hbCIsIk5vbkVtcHR5U3RyaW5nIiwiX2ZpbmRVc2VyQnlRdWVyeSIsImZpZWxkcyIsIl9jaGVjazJmYUVuYWJsZWQiLCJjYWxsIiwiX2lzVG9rZW5WYWxpZCIsInR3b0ZhY3RvckF1dGhlbnRpY2F0aW9uIiwic2VjcmV0Iiwic2V0VXNlcm5hbWUiLCJuZXdVc2VybmFtZSIsInVzZXJuYW1lIiwib2xkVXNlcm5hbWUiLCJfY2hlY2tGb3JDYXNlSW5zZW5zaXRpdmVEdXBsaWNhdGVzIiwiZXgiLCJtZXRob2RzIiwiY2hhbmdlUGFzc3dvcmQiLCJvbGRQYXNzd29yZCIsIm5ld1Bhc3N3b3JkIiwiY3VycmVudFRva2VuIiwiX2dldExvZ2luVG9rZW4iLCJjb25uZWN0aW9uIiwiJHB1bGwiLCJoYXNoZWRUb2tlbiIsIiRuZSIsInBhc3N3b3JkQ2hhbmdlZCIsInNldFBhc3N3b3JkQXN5bmMiLCJuZXdQbGFpbnRleHRQYXNzd29yZCIsIl9NZXRlb3Ikc2V0dGluZ3MyIiwiX01ldGVvciRzZXR0aW5nczIkcGFjIiwiX01ldGVvciRzZXR0aW5nczIkcGFjMiIsIk1heWJlIiwibG9nb3V0IiwiQm9vbGVhbiIsInBsdWNrQWRkcmVzc2VzIiwiZW1haWxzIiwiYXJndW1lbnRzIiwibWFwIiwiZW1haWwiLCJhZGRyZXNzIiwiZm9yZ290UGFzc3dvcmQiLCJmaW5kVXNlckJ5RW1haWwiLCJhbWJpZ3VvdXNFcnJvck1lc3NhZ2VzIiwiY2FzZVNlbnNpdGl2ZUVtYWlsIiwiZmluZCIsInRvTG93ZXJDYXNlIiwic2VuZFJlc2V0UGFzc3dvcmRFbWFpbCIsImdlbmVyYXRlUmVzZXRUb2tlbiIsInJlYXNvbiIsImV4dHJhVG9rZW5EYXRhIiwiaW5jbHVkZXMiLCJ0b2tlbiIsIlJhbmRvbSIsInRva2VuUmVjb3JkIiwid2hlbiIsIkRhdGUiLCJPYmplY3QiLCJhc3NpZ24iLCJfZW5zdXJlIiwiZW5yb2xsIiwicmVzZXQiLCJnZW5lcmF0ZVZlcmlmaWNhdGlvblRva2VuIiwiZW1haWxSZWNvcmQiLCJlIiwidmVyaWZpZWQiLCIkcHVzaCIsInZlcmlmaWNhdGlvblRva2VucyIsInB1c2giLCJleHRyYVBhcmFtcyIsInJlYWxFbWFpbCIsIl9yZXNvbHZlUHJvbWlzZSIsInVybHMiLCJnZW5lcmF0ZU9wdGlvbnNGb3JFbWFpbCIsIkVtYWlsIiwic2VuZEFzeW5jIiwiaXNEZXZlbG9wbWVudCIsImlzUGFja2FnZVRlc3QiLCJsb2ciLCJzZW5kRW5yb2xsbWVudEVtYWlsIiwiX2xlbiIsImFyZ3MiLCJBcnJheSIsIl9rZXkiLCJfbG9naW5NZXRob2QiLCJfQWNjb3VudHMkX2NoZWNrMmZhRW4yIiwiX0FjY291bnRzMiIsImlzRW5yb2xsIiwidG9rZW5MaWZldGltZU1zIiwiX2dldFBhc3N3b3JkUmVzZXRUb2tlbkxpZmV0aW1lTXMiLCJfZ2V0UGFzc3dvcmRFbnJvbGxUb2tlbkxpZmV0aW1lTXMiLCJjdXJyZW50VGltZU1zIiwibm93Iiwib2xkVG9rZW4iLCJfc2V0TG9naW5Ub2tlbiIsInJlc2V0VG9PbGRUb2tlbiIsImFmZmVjdGVkUmVjb3JkcyIsImVyciIsIl9jbGVhckFsbExvZ2luVG9rZW5zIiwic2VuZFZlcmlmaWNhdGlvbkVtYWlsIiwiX2xlbjIiLCJfa2V5MiIsIl9BY2NvdW50cyRfY2hlY2syZmFFbjMiLCJfQWNjb3VudHMzIiwidCIsImVtYWlsc1JlY29yZCIsInJlcGxhY2VFbWFpbEFzeW5jIiwib2xkRW1haWwiLCJuZXdFbWFpbCIsIm1vZGlmaWVkQ291bnQiLCJhZGRFbWFpbEFzeW5jIiwiY2FzZUluc2Vuc2l0aXZlUmVnRXhwIiwiUmVnRXhwIiwiX2VzY2FwZVJlZ0V4cCIsInVwZGF0ZWRFbWFpbCIsInVwZGF0ZWQiLCJkaWRVcGRhdGVPd25FbWFpbCIsIiRhZGRUb1NldCIsInJlbW92ZUVtYWlsIiwiY3JlYXRlVXNlciIsIk9iamVjdEluY2x1ZGluZyIsImhhc2hlZCIsIl9jcmVhdGVVc2VyQ2hlY2tpbmdEdXBsaWNhdGVzIiwiX2xlbjMiLCJfa2V5MyIsImZvcmJpZENsaWVudEFjY291bnRDcmVhdGlvbiIsImNyZWF0ZVVzZXJWZXJpZnlpbmdFbWFpbCIsImNyZWF0ZVVzZXJBc3luYyIsImNyZWF0ZUluZGV4QXN5bmMiLCJ1bmlxdWUiLCJzcGFyc2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBLElBQUlBLGFBQWE7SUFBQ0MsTUFBTSxDQUFDQyxJQUFJLENBQUMsc0NBQXNDLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUNKLGFBQWEsR0FBQ0ksQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlDLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU1BLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDO0lBQWxLLE1BQU1DLEtBQUssR0FBR0MsVUFBVSxJQUFJLENBQUNDLElBQUksRUFBRUMsR0FBRyxLQUFLO01BQ3pDLE1BQU1DLFFBQVEsR0FDWkYsSUFBSSxDQUFDRyxPQUFPLElBQUlILElBQUksQ0FBQ0csT0FBTyxDQUFDQyxJQUFJLFlBQUFDLE1BQUEsQ0FDcEJMLElBQUksQ0FBQ0csT0FBTyxDQUFDQyxJQUFJLFNBQzFCLFFBQVE7TUFDZCxVQUFBQyxNQUFBLENBQVVILFFBQVEsVUFBQUcsTUFBQSxDQUVsQk4sVUFBVSx3Q0FBQU0sTUFBQSxDQUVWSixHQUFHO0lBSUwsQ0FBQzs7SUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0FLLFFBQVEsQ0FBQ0MsY0FBYyxHQUFBZixhQUFBLENBQUFBLGFBQUEsS0FDakJjLFFBQVEsQ0FBQ0MsY0FBYyxJQUFJLENBQUMs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USxDQUFDK08sVUFBVSxHQUFHL08sUUFBUSxDQUFDdVAsZUFBZTs7SUFFOUM7SUFDQTtJQUNBO0lBQ0EsTUFBTW5QLE1BQU0sQ0FBQ3NCLEtBQUssQ0FBQzhOLGdCQUFnQixDQUFDLHlDQUF5QyxFQUMzRTtNQUFFQyxNQUFNLEVBQUUsSUFBSTtNQUFFQyxNQUFNLEVBQUU7SUFBSyxDQUFDLENBQUM7SUFDakMsTUFBTXRQLE1BQU0sQ0FBQ3NCLEtBQUssQ0FBQzhOLGdCQUFnQixDQUFDLCtCQUErQixFQUNqRTtNQUFFQyxNQUFNLEVBQUUsSUFBSTtNQUFFQyxNQUFNLEVBQUU7SUFBSyxDQUFDLENBQUM7SUFDakMsTUFBTXRQLE1BQU0sQ0FBQ3NCLEtBQUssQ0FBQzhOLGdCQUFnQixDQUFDLGdDQUFnQyxFQUNsRTtNQUFFQyxNQUFNLEVBQUUsSUFBSTtNQUFFQyxNQUFNLEVBQUU7SUFBSyxDQUFDLENBQUM7SUFBQzlPLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUFFLElBQUE7RUFBQUMsS0FBQTtBQUFBLEciLCJmaWxlIjoiL3BhY2thZ2VzL2FjY291bnRzLXBhc3N3b3JkLmpzIiwic291cmNlc0NvbnRlbnQiOlsiY29uc3QgZ3JlZXQgPSB3ZWxjb21lTXNnID0+ICh1c2VyLCB1cmwpID0+IHtcbiAgY29uc3QgZ3JlZXRpbmcgPVxuICAgIHVzZXIucHJvZmlsZSAmJiB1c2VyLnByb2ZpbGUubmFtZVxuICAgICAgPyBgSGVsbG8gJHt1c2VyLnByb2ZpbGUubmFtZX0sYFxuICAgICAgOiAnSGVsbG8sJztcbiAgcmV0dXJuIGAke2dyZWV0aW5nfVxuXG4ke3dlbGNvbWVNc2d9LCBzaW1wbHkgY2xpY2sgdGhlIGxpbmsgYmVsb3cuXG5cbiR7dXJsfVxuXG5UaGFuayB5b3UuXG5gO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBPcHRpb25zIHRvIGN1c3RvbWl6ZSBlbWFpbHMgc2VudCBmcm9tIHRoZSBBY2NvdW50cyBzeXN0ZW0uXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICovXG5BY2NvdW50cy5lbWFpbFRlbXBsYXRlcyA9IHtcbiAgLi4uKEFjY291bnRzLmVtYWlsVGVtcGxhdGVzIHx8IHt9KSxcbiAgZnJvbTogJ0FjY291bnRzIEV4YW1wbGUgPG5vLXJlcGx5QGV4YW1wbGUuY29tPicsXG4gIHNpdGVOYW1lOiBNZXRlb3IuYWJzb2x1dGVVcmwoKVxuICAgIC5yZXBsYWNlKC9eaHR0cHM/OlxcL1xcLy8sICcnKVxuICAgIC5yZXBsYWNlKC9cXC8kLywgJycpLFxuXG4gIHJlc2V0UGFzc3dvcmQ6IHtcbiAgICBzdWJqZWN0OiAoKSA9PlxuICAgICAgYEhvdyB0byByZXNldCB5b3VyIHBhc3N3b3JkIG9uICR7QWNjb3VudHMuZW1haWxUZW1wbGF0ZXMuc2l0ZU5hbWV9YCxcbiAgICB0ZXh0OiBncmVldCgnVG8gcmVzZXQgeW91ciBwYXNzd29yZCcpLFxuICB9LFxuICB2ZXJpZnlFbWFpbDoge1xuICAgIHN1YmplY3Q6ICgpID0+XG4gICAgICBgSG93IHRvIHZlcmlmeSBlbWFpbCBhZGRyZXNzIG9uICR7QWNjb3VudHMuZW1haWxUZW1wbGF0ZXMuc2l0ZU5hbWV9YCxcbiAgICB0ZXh0OiBncmVldCgnVG8gdmVyaWZ5IHlvdXIgYWNjb3VudCBlbWFpbCcpLFxuICB9LFxuICBlbnJvbGxBY2NvdW50OiB7XG4gICAgc3ViamVjdDogKCkgPT5cbiAgICAgIGBBbiBhY2NvdW50IGhhcyBiZWVuIGNyZWF0ZWQgZm9yIHlvdSBvbiAke0FjY291bnRzLmVtYWlsVGVtcGxhdGVzLnNpdGVOYW1lfWAsXG4gICAgdGV4dDogZ3JlZXQoJ1RvIHN0YXJ0IHVzaW5nIHRoZSBzZXJ2aWNlJyksXG4gIH0sXG59O1xuIiwiaW1wb3J0IGFyZ29uMiBmcm9tIFwiYXJnb24yXCI7XG5pbXBvcnQgeyBBY2NvdW50cyB9IGZyb20gXCJtZXRlb3IvYWNjb3VudHMtYmFzZVwiO1xuaW1wb3J0IHsgY2hlY2ssIE1hdGNoIH0gZnJvbSAnbWV0ZW9yL2NoZWNrJztcbmltcG9ydCB7IGhhc2ggYXMgYmNyeXB0SGFzaCwgY29tcGFyZSBhcyBiY3J5cHRDb21wYXJlIH0gZnJvbSAnYmNyeXB0JztcblxuLy8gVXRpbGl0eSBmb3IgZ3JhYmJpbmcgdXNlclxuY29uc3QgZ2V0VXNlckJ5SWQgPVxuICBhc3luYyAoaWQsIG9wdGlvbnMpID0+XG4gICAgYXdhaXQgTWV0ZW9yLnVzZXJzLmZpbmRPbmVBc3luYyhpZCwgQWNjb3VudHMuX2FkZERlZmF1bHRGaWVsZFNlbGVjdG9yKG9wdGlvbnMpKTtcblxuLy8gVXNlciByZWNvcmRzIGhhdmUgdHdvIGZpZWxkcyB0aGF0IGFyZSB1c2VkIGZvciBwYXNzd29yZC1iYXNlZCBsb2dpbjpcbi8vIC0gJ3NlcnZpY2VzLnBhc3N3b3JkLmJjcnlwdCcsIHdoaWNoIHN0b3JlcyB0aGUgYmNyeXB0IHBhc3N3b3JkLCB3aGljaCB3aWxsIGJlIGRlcHJlY2F0ZWRcbi8vIC0gJ3NlcnZpY2VzLnBhc3N3b3JkLmFyZ29uMicsIHdoaWNoIHN0b3JlcyB0aGUgYXJnb24yIHBhc3N3b3JkXG4vL1xuLy8gV2hlbiB0aGUgY2xpZW50IHNlbmRzIGEgcGFzc3dvcmQgdG8gdGhlIHNlcnZlciwgaXQgY2FuIGVpdGhlciBiZSBhXG4vLyBzdHJpbmcgKHRoZSBwbGFpbnRleHQgcGFzc3dvcmQpIG9yIGFuIG9iamVjdCB3aXRoIGtleXMgJ2RpZ2VzdCcgYW5kXG4vLyAnYWxnb3JpdGhtJyAobXVzdCBiZSBcInNoYS0yNTZcIiBmb3Igbm93KS4gVGhlIE1ldGVvciBjbGllbnQgYWx3YXlzIHNlbmRzXG4vLyBwYXNzd29yZCBvYmplY3RzIHsgZGlnZXN0OiAqLCBhbGdvcml0aG06IFwic2hhLTI1NlwiIH0sIGJ1dCBERFAgY2xpZW50c1xuLy8gdGhhdCBkb24ndCBoYXZlIGFjY2VzcyB0byBTSEEgY2FuIGp1c3Qgc2VuZCBwbGFpbnRleHQgcGFzc3dvcmRzIGFzXG4vLyBzdHJpbmdzLlxuLy9cbi8vIFdoZW4gdGhlIHNlcnZlciByZWNlaXZlcyBhIHBsYWludGV4dCBwYXNzd29yZCBhcyBhIHN0cmluZywgaXQgYWx3YXlzXG4vLyBoYXNoZXMgaXQgd2l0aCBTSEEyNTYgYmVmb3JlIHBhc3NpbmcgaXQgaW50byBiY3J5cHQgLyBhcmdvbjIuIFdoZW4gdGhlIHNlcnZlclxuLy8gcmVjZWl2ZXMgYSBwYXNzd29yZCBhcyBhbiBvYmplY3QsIGl0IGFzc2VydHMgdGhhdCB0aGUgYWxnb3JpdGhtIGlzXG4vLyBcInNoYS0yNTZcIiBhbmQgdGhlbiBwYXNzZXMgdGhlIGRpZ2VzdCB0byBiY3J5cHQgLyBhcmdvbjIuXG5cbkFjY291bnRzLl9iY3J5cHRSb3VuZHMgPSAoKSA9PiBBY2NvdW50cy5fb3B0aW9ucy5iY3J5cHRSb3VuZHMgfHwgMTA7XG5cbkFjY291bnRzLl9hcmdvbjJFbmFibGVkID0gKCkgPT4gQWNjb3VudHMuX29wdGlvbnMuYXJnb24yRW5hYmxlZCB8fCBmYWxzZTtcblxuY29uc3QgQVJHT04yX1RZUEVTID0ge1xuICBhcmdvbjJpOiBhcmdvbjIuYXJnb24yaSxcbiAgYXJnb24yZDogYXJnb24yLmFyZ29uMmQsXG4gIGFyZ29uMmlkOiBhcmdvbjIuYXJnb24yaWRcbn07XG5cbkFjY291bnRzLl9hcmdvbjJUeXBlID0gKCkgPT4gQVJHT04yX1RZUEVTW0FjY291bnRzLl9vcHRpb25zLmFyZ29uMlR5cGVdIHx8IGFyZ29uMi5hcmdvbjJpZDtcbkFjY291bnRzLl9hcmdvbjJUaW1lQ29zdCA9ICgpID0+IEFjY291bnRzLl9vcHRpb25zLmFyZ29uMlRpbWVDb3N0IHx8IDI7XG5BY2NvdW50cy5fYXJnb24yTWVtb3J5Q29zdCA9ICgpID0+IEFjY291bnRzLl9vcHRpb25zLmFyZ29uMk1lbW9yeUNvc3QgfHwgMTk0NTY7XG5BY2NvdW50cy5fYXJnb24yUGFyYWxsZWxpc20gPSAoKSA9PiBBY2NvdW50cy5fb3B0aW9ucy5hcmdvbjJQYXJhbGxlbGlzbSB8fCAxO1xuXG4vKipcbiAqIEV4dHJhY3RzIHRoZSBzdHJpbmcgdG8gYmUgZW5jcnlwdGVkIHVzaW5nIGJjcnlwdCBvciBBcmdvbjIgZnJvbSB0aGUgZ2l2ZW4gYHBhc3N3b3JkYC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ3xPYmplY3R9IHBhc3N3b3JkIC0gVGhlIHBhc3N3b3JkIHByb3ZpZGVkIGJ5IHRoZSBjbGllbnQuIEl0IGNhbiBiZTpcbiAqICAtIEEgcGxhaW50ZXh0IHN0cmluZyBwYXNzd29yZC5cbiAqICAtIEFuIG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAqICAgICAgQHByb3BlcnR5IHtzdHJpbmd9IGRpZ2VzdCAtIFRoZSBoYXNoZWQgcGFzc3dvcmQuXG4gKiAgICAgIEBwcm9wZXJ0eSB7c3RyaW5nfSBhbGdvcml0aG0gLSBUaGUgaGFzaGluZyBhbGdvcml0aG0gdXNlZC4gTXVzdCBiZSBcInNoYS0yNTZcIi5cbiAqXG4gKiBAcmV0dXJucyB7c3RyaW5nfSAtIFRoZSByZXN1bHRpbmcgcGFzc3dvcmQgc3RyaW5nIHRvIGVuY3J5cHQuXG4gKlxuICogQHRocm93cyB7RXJyb3J9IC0gSWYgdGhlIGBhbGdvcml0aG1gIGluIHRoZSBwYXNzd29yZCBvYmplY3QgaXMgbm90IFwic2hhLTI1NlwiLlxuICovXG5jb25zdCBnZXRQYXNzd29yZFN0cmluZyA9IHBhc3N3b3JkID0+IHtcbiAgaWYgKHR5cGVvZiBwYXNzd29yZCA9PT0gXCJzdHJpbmdcIikge1xuICAgIHBhc3N3b3JkID0gU0hBMjU2KHBhc3N3b3JkKTtcbiAgfVxuICBlbHNlIHsgLy8gJ3Bhc3N3b3JkJyBpcyBhbiBvYmplY3RcbiAgICBpZiAocGFzc3dvcmQuYWxnb3JpdGhtICE9PSBcInNoYS0yNTZcIikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBwYXNzd29yZCBoYXNoIGFsZ29yaXRobS4gXCIgK1xuICAgICAgICBcIk9ubHkgJ3NoYS0yNTYnIGlzIGFsbG93ZWQuXCIpO1xuICAgIH1cbiAgICBwYXNzd29yZCA9IHBhc3N3b3JkLmRpZ2VzdDtcbiAgfVxuICByZXR1cm4gcGFzc3dvcmQ7XG59O1xuXG4vKipcbiAqIEVuY3J5cHQgdGhlIGdpdmVuIGBwYXNzd29yZGAgdXNpbmcgZWl0aGVyIGJjcnlwdCBvciBBcmdvbjIuXG4gKiBAcGFyYW0gcGFzc3dvcmQgY2FuIGJlIGEgc3RyaW5nIChpbiB3aGljaCBjYXNlIGl0IHdpbGwgYmUgcnVuIHRocm91Z2ggU0hBMjU2IGJlZm9yZSBlbmNyeXB0aW9uKSBvciBhbiBvYmplY3Qgd2l0aCBwcm9wZXJ0aWVzIGBkaWdlc3RgIGFuZCBgYWxnb3JpdGhtYCAoaW4gd2hpY2ggY2FzZSB3ZSBiY3J5cHQgb3IgQXJnb24yIGBwYXNzd29yZC5kaWdlc3RgKS5cbiAqIEByZXR1cm5zIHtQcm9taXNlPHN0cmluZz59IFRoZSBlbmNyeXB0ZWQgcGFzc3dvcmQuXG4gKi9cbmNvbnN0IGhhc2hQYXNzd29yZCA9IGFzeW5jIChwYXNzd29yZCkgPT4ge1xuICBwYXNzd29yZCA9IGdldFBhc3N3b3JkU3RyaW5nKHBhc3N3b3JkKTtcbiAgaWYgKEFjY291bnRzLl9hcmdvbjJFbmFibGVkKCkgPT09IHRydWUpIHtcbiAgICByZXR1cm4gYXdhaXQgYXJnb24yLmhhc2gocGFzc3dvcmQsIHtcbiAgICAgIHR5cGU6IEFjY291bnRzLl9hcmdvbjJUeXBlKCksXG4gICAgICB0aW1lQ29zdDogQWNjb3VudHMuX2FyZ29uMlRpbWVDb3N0KCksXG4gICAgICBtZW1vcnlDb3N0OiBBY2NvdW50cy5fYXJnb24yTWVtb3J5Q29zdCgpLFxuICAgICAgcGFyYWxsZWxpc206IEFjY291bnRzLl9hcmdvbjJQYXJhbGxlbGlzbSgpXG4gICAgfSk7XG4gIH1cbiAgZWxzZSB7XG4gICAgcmV0dXJuIGF3YWl0IGJjcnlwdEhhc2gocGFzc3dvcmQsIEFjY291bnRzLl9iY3J5cHRSb3VuZHMoKSk7XG4gIH1cbn07XG5cbi8vIEV4dHJhY3QgdGhlIG51bWJlciBvZiByb3VuZHMgdXNlZCBpbiB0aGUgc3BlY2lmaWVkIGJjcnlwdCBoYXNoLlxuY29uc3QgZ2V0Um91bmRzRnJvbUJjcnlwdEhhc2ggPSAoaGFzaCkgPT4ge1xuICBsZXQgcm91bmRzO1xuICBpZiAoaGFzaCkge1xuICAgIGNvbnN0IGhhc2hTZWdtZW50cyA9IGhhc2guc3BsaXQoXCIkXCIpO1xuICAgIGlmIChoYXNoU2VnbWVudHMubGVuZ3RoID4gMikge1xuICAgICAgcm91bmRzID0gcGFyc2VJbnQoaGFzaFNlZ21lbnRzWzJdLCAxMCk7XG4gICAgfVxuICB9XG4gIHJldHVybiByb3VuZHM7XG59O1xuQWNjb3VudHMuX2dldFJvdW5kc0Zyb21CY3J5cHRIYXNoID0gZ2V0Um91bmRzRnJvbUJjcnlwdEhhc2g7XG5cblxuLyoqXG4gKiBFeHRyYWN0IHJlYWRhYmxlIHBhcmFtZXRlcnMgZnJvbSBhbiBBcmdvbjIgaGFzaCBzdHJpbmcuXG4gKiBAcGFyYW0ge3N0cmluZ30gaGFzaCAtIFRoZSBBcmdvbjIgaGFzaCBzdHJpbmcuXG4gKiBAcmV0dXJucyB7b2JqZWN0fSBBbiBvYmplY3QgY29udGFpbmluZyB0aGUgcGFyc2VkIHBhcmFtZXRlcnMuXG4gKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlIGhhc2ggZm9ybWF0IGlzIGludmFsaWQuXG4gKi9cbmZ1bmN0aW9uIGdldEFyZ29uMlBhcmFtcyhoYXNoKSB7XG4gIGNvbnN0IHJlZ2V4ID0gL15cXCQoYXJnb24yKD86aXxkfGlkKSlcXCR2PVxcZCtcXCRtPShcXGQrKSx0PShcXGQrKSxwPShcXGQrKS87XG5cbiAgY29uc3QgbWF0Y2ggPSBoYXNoLm1hdGNoKHJlZ2V4KTtcblxuICBpZiAoIW1hdGNoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBBcmdvbjIgaGFzaCBmb3JtYXQuXCIpO1xuICB9XG5cbiAgY29uc3QgWywgdHlwZSwgbWVtb3J5Q29zdCwgdGltZUNvc3QsIHBhcmFsbGVsaXNtXSA9IG1hdGNoO1xuXG4gIHJldHVybiB7XG4gICAgdHlwZTogQVJHT04yX1RZUEVTW3R5cGVdLFxuICAgIHRpbWVDb3N0OiBwYXJzZUludCh0aW1lQ29zdCwgMTApLFxuICAgIG1lbW9yeUNvc3Q6IHBhcnNlSW50KG1lbW9yeUNvc3QsIDEwKSxcbiAgICBwYXJhbGxlbGlzbTogcGFyc2VJbnQocGFyYWxsZWxpc20sIDEwKVxuICB9O1xufVxuXG5BY2NvdW50cy5fZ2V0QXJnb24yUGFyYW1zID0gZ2V0QXJnb24yUGFyYW1zO1xuXG5jb25zdCBnZXRVc2VyUGFzc3dvcmRIYXNoID0gdXNlciA9PiB7XG4gIHJldHVybiB1c2VyLnNlcnZpY2VzPy5wYXNzd29yZD8uYXJnb24yIHx8IHVzZXIuc2VydmljZXM/LnBhc3N3b3JkPy5iY3J5cHQ7XG59O1xuXG5BY2NvdW50cy5fY2hlY2tQYXNzd29yZFVzZXJGaWVsZHMgPSB7IF9pZDogMSwgc2VydmljZXM6IDEgfTtcblxuY29uc3QgaXNCY3J5cHQgPSAoaGFzaCkgPT4ge1xuICAvLyBiY3J5cHQgaGFzaGVzIHN0YXJ0IHdpdGggJDJhJCBvciAkMmIkXG4gIHJldHVybiBoYXNoLnN0YXJ0c1dpdGgoXCIkMlwiKTtcbn07XG5cbmNvbnN0IGlzQXJnb24gPSAoaGFzaCkgPT4ge1xuICAgIC8vIGFyZ29uMiBoYXNoZXMgc3RhcnQgd2l0aCAkYXJnb24yaSQsICRhcmdvbjJkJCBvciAkYXJnb24yaWQkXG4gICAgcmV0dXJuIGhhc2guc3RhcnRzV2l0aChcIiRhcmdvbjJcIik7XG59XG5cbmNvbnN0IHVwZGF0ZVVzZXJQYXNzd29yZERlZmVyZWQgPSAodXNlciwgZm9ybWF0dGVkUGFzc3dvcmQpID0+IHtcbiAgTWV0ZW9yLmRlZmVyKGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCB1cGRhdGVVc2VyUGFzc3dvcmQodXNlciwgZm9ybWF0dGVkUGFzc3dvcmQpO1xuICB9KTtcbn07XG5cbi8qKlxuICogSGFzaGVzIHRoZSBwcm92aWRlZCBwYXNzd29yZCBhbmQgcmV0dXJucyBhbiBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB0byB1cGRhdGUgdGhlIHVzZXIncyBwYXNzd29yZC5cbiAqIEBwYXJhbSBmb3JtYXR0ZWRQYXNzd29yZFxuICogQHJldHVybnMge1Byb21pc2U8eyRzZXQ6IHtcInNlcnZpY2VzLnBhc3N3b3JkLmJjcnlwdFwiOiBzdHJpbmd9fXx7JHVuc2V0OiB7XCJzZXJ2aWNlcy5wYXNzd29yZC5iY3J5cHRcIjogbnVtYmVyfSwgJHNldDoge1wic2VydmljZXMucGFzc3dvcmQuYXJnb24yXCI6IHN0cmluZ319Pn1cbiAqL1xuY29uc3QgZ2V0VXBkYXRvckZvclVzZXJQYXNzd29yZCA9IGFzeW5jIChmb3JtYXR0ZWRQYXNzd29yZCkgPT4ge1xuICBjb25zdCBlbmNyeXB0ZWRQYXNzd29yZCA9IGF3YWl0IGhhc2hQYXNzd29yZChmb3JtYXR0ZWRQYXNzd29yZCk7XG4gIGlmIChBY2NvdW50cy5fYXJnb24yRW5hYmxlZCgpID09PSBmYWxzZSkge1xuICAgIHJldHVybiB7XG4gICAgICAkc2V0OiB7XG4gICAgICAgIFwic2VydmljZXMucGFzc3dvcmQuYmNyeXB0XCI6IGVuY3J5cHRlZFBhc3N3b3JkXG4gICAgICB9LFxuICAgICAgJHVuc2V0OiB7XG4gICAgICAgIFwic2VydmljZXMucGFzc3dvcmQuYXJnb24yXCI6IDFcbiAgICAgIH1cbiAgICB9O1xuICB9XG4gIGVsc2UgaWYgKEFjY291bnRzLl9hcmdvbjJFbmFibGVkKCkgPT09IHRydWUpIHtcbiAgICByZXR1cm4ge1xuICAgICAgJHNldDoge1xuICAgICAgICBcInNlcnZpY2VzLnBhc3N3b3JkLmFyZ29uMlwiOiBlbmNyeXB0ZWRQYXNzd29yZFxuICAgICAgfSxcbiAgICAgICR1bnNldDoge1xuICAgICAgICBcInNlcnZpY2VzLnBhc3N3b3JkLmJjcnlwdFwiOiAxXG4gICAgICB9XG4gICAgfTtcbiAgfVxufTtcblxuY29uc3QgdXBkYXRlVXNlclBhc3N3b3JkID0gYXN5bmMgKHVzZXIsIGZvcm1hdHRlZFBhc3N3b3JkKSA9PiB7XG4gIGNvbnN0IHVwZGF0b3IgPSBhd2FpdCBnZXRVcGRhdG9yRm9yVXNlclBhc3N3b3JkKGZvcm1hdHRlZFBhc3N3b3JkKTtcbiAgYXdhaXQgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKHsgX2lkOiB1c2VyLl9pZCB9LCB1cGRhdG9yKTtcbn07XG5cbi8qKlxuICogQ2hlY2tzIHdoZXRoZXIgdGhlIHByb3ZpZGVkIHBhc3N3b3JkIG1hdGNoZXMgdGhlIGhhc2hlZCBwYXNzd29yZCBzdG9yZWQgaW4gdGhlIHVzZXIncyBkYXRhYmFzZSByZWNvcmQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHVzZXIgLSBUaGUgdXNlciBvYmplY3QgY29udGFpbmluZyBhdCBsZWFzdDpcbiAqICAgQHByb3BlcnR5IHtzdHJpbmd9IF9pZCAtIFRoZSB1c2VyJ3MgdW5pcXVlIGlkZW50aWZpZXIuXG4gKiAgIEBwcm9wZXJ0eSB7T2JqZWN0fSBzZXJ2aWNlcyAtIFRoZSB1c2VyJ3Mgc2VydmljZXMgZGF0YS5cbiAqICAgQHByb3BlcnR5IHtPYmplY3R9IHNlcnZpY2VzLnBhc3N3b3JkIC0gVGhlIHVzZXIncyBwYXNzd29yZCBvYmplY3QuXG4gKiAgIEBwcm9wZXJ0eSB7c3RyaW5nfSBbc2VydmljZXMucGFzc3dvcmQuYXJnb24yXSAtIFRoZSBBcmdvbjIgaGFzaGVkIHBhc3N3b3JkLlxuICogICBAcHJvcGVydHkge3N0cmluZ30gW3NlcnZpY2VzLnBhc3N3b3JkLmJjcnlwdF0gLSBUaGUgYmNyeXB0IGhhc2hlZCBwYXNzd29yZCwgZGVwcmVjYXRlZFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfE9iamVjdH0gcGFzc3dvcmQgLSBUaGUgcGFzc3dvcmQgcHJvdmlkZWQgYnkgdGhlIGNsaWVudC4gSXQgY2FuIGJlOlxuICogICAtIEEgcGxhaW50ZXh0IHN0cmluZyBwYXNzd29yZC5cbiAqICAgLSBBbiBvYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6XG4gKiAgICAgICBAcHJvcGVydHkge3N0cmluZ30gZGlnZXN0IC0gVGhlIGhhc2hlZCBwYXNzd29yZC5cbiAqICAgICAgIEBwcm9wZXJ0eSB7c3RyaW5nfSBhbGdvcml0aG0gLSBUaGUgaGFzaGluZyBhbGdvcml0aG0gdXNlZC4gTXVzdCBiZSBcInNoYS0yNTZcIi5cbiAqXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxPYmplY3Q+fSAtIEEgcmVzdWx0IG9iamVjdCB3aXRoIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllczpcbiAqICAgQHByb3BlcnR5IHtzdHJpbmd9IHVzZXJJZCAtIFRoZSB1c2VyJ3MgdW5pcXVlIGlkZW50aWZpZXIuXG4gKiAgIEBwcm9wZXJ0eSB7T2JqZWN0fSBbZXJyb3JdIC0gQW4gZXJyb3Igb2JqZWN0IGlmIHRoZSBwYXNzd29yZCBkb2VzIG5vdCBtYXRjaCBvciBhbiBlcnJvciBvY2N1cnMuXG4gKlxuICogQHRocm93cyB7RXJyb3J9IC0gSWYgYW4gdW5leHBlY3RlZCBlcnJvciBvY2N1cnMgZHVyaW5nIHRoZSBwcm9jZXNzLlxuICovXG5jb25zdCBjaGVja1Bhc3N3b3JkQXN5bmMgPSBhc3luYyAodXNlciwgcGFzc3dvcmQpID0+IHtcbiAgY29uc3QgcmVzdWx0ID0ge1xuICAgIHVzZXJJZDogdXNlci5faWRcbiAgfTtcblxuICBjb25zdCBmb3JtYXR0ZWRQYXNzd29yZCA9IGdldFBhc3N3b3JkU3RyaW5nKHBhc3N3b3JkKTtcbiAgY29uc3QgaGFzaCA9IGdldFVzZXJQYXNzd29yZEhhc2godXNlcik7XG5cblxuICBjb25zdCBhcmdvbjJFbmFibGVkID0gQWNjb3VudHMuX2FyZ29uMkVuYWJsZWQoKTtcbiAgaWYgKGFyZ29uMkVuYWJsZWQgPT09IGZhbHNlKSB7XG4gICAgaWYgKGlzQXJnb24oaGFzaCkpIHtcbiAgICAgIC8vIHRoaXMgaXMgYSByb2xsYmFjayBmZWF0dXJlLCBlbmFibGluZyB0byBzd2l0Y2ggYmFjayBmcm9tIGFyZ29uMiB0byBiY3J5cHQgaWYgbmVlZGVkXG4gICAgICAvLyBUT0RPIDogZGVwcmVjYXRlIHRoaXNcbiAgICAgIGNvbnNvbGUud2FybihcIlVzZXIgaGFzIGFuIGFyZ29uMiBwYXNzd29yZCBhbmQgYXJnb24yIGlzIG5vdCBlbmFibGVkLCByb2xsaW5nIGJhY2sgdG8gYmNyeXB0IGVuY3J5cHRpb25cIik7XG4gICAgICBjb25zdCBtYXRjaCA9IGF3YWl0IGFyZ29uMi52ZXJpZnkoaGFzaCwgZm9ybWF0dGVkUGFzc3dvcmQpO1xuICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICByZXN1bHQuZXJyb3IgPSBBY2NvdW50cy5faGFuZGxlRXJyb3IoXCJJbmNvcnJlY3QgcGFzc3dvcmRcIiwgZmFsc2UpO1xuICAgICAgfVxuICAgICAgZWxzZXtcbiAgICAgICAgLy8gVGhlIHBhc3N3b3JkIGNoZWNrcyBvdXQsIGJ1dCB0aGUgdXNlcidzIHN0b3JlZCBwYXNzd29yZCBuZWVkcyB0byBiZSB1cGRhdGVkIHRvIGFyZ29uMlxuICAgICAgICB1cGRhdGVVc2VyUGFzc3dvcmREZWZlcmVkKHVzZXIsIHsgZGlnZXN0OiBmb3JtYXR0ZWRQYXNzd29yZCwgYWxnb3JpdGhtOiBcInNoYS0yNTZcIiB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBjb25zdCBoYXNoUm91bmRzID0gZ2V0Um91bmRzRnJvbUJjcnlwdEhhc2goaGFzaCk7XG4gICAgICBjb25zdCBtYXRjaCA9IGF3YWl0IGJjcnlwdENvbXBhcmUoZm9ybWF0dGVkUGFzc3dvcmQsIGhhc2gpO1xuICAgICAgaWYgKCFtYXRjaCkge1xuICAgICAgICByZXN1bHQuZXJyb3IgPSBBY2NvdW50cy5faGFuZGxlRXJyb3IoXCJJbmNvcnJlY3QgcGFzc3dvcmRcIiwgZmFsc2UpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoaGFzaCkge1xuICAgICAgICBjb25zdCBwYXJhbXNDaGFuZ2VkID0gaGFzaFJvdW5kcyAhPT0gQWNjb3VudHMuX2JjcnlwdFJvdW5kcygpO1xuICAgICAgICAvLyBUaGUgcGFzc3dvcmQgY2hlY2tzIG91dCwgYnV0IHRoZSB1c2VyJ3MgYmNyeXB0IGhhc2ggbmVlZHMgdG8gYmUgdXBkYXRlZFxuICAgICAgICAvLyB0byBtYXRjaCBjdXJyZW50IGJjcnlwdCBzZXR0aW5nc1xuICAgICAgICBpZiAocGFyYW1zQ2hhbmdlZCA9PT0gdHJ1ZSkge1xuICAgICAgICAgIHVwZGF0ZVVzZXJQYXNzd29yZERlZmVyZWQodXNlciwgeyBkaWdlc3Q6IGZvcm1hdHRlZFBhc3N3b3JkLCBhbGdvcml0aG06IFwic2hhLTI1NlwiIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGVsc2UgaWYgKGFyZ29uMkVuYWJsZWQgPT09IHRydWUpIHtcbiAgICBpZiAoaXNCY3J5cHQoaGFzaCkpIHtcbiAgICAgIC8vIG1pZ3JhdGlvbiBjb2RlIGZyb20gYmNyeXB0IHRvIGFyZ29uMlxuICAgICAgY29uc3QgbWF0Y2ggPSBhd2FpdCBiY3J5cHRDb21wYXJlKGZvcm1hdHRlZFBhc3N3b3JkLCBoYXNoKTtcbiAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgcmVzdWx0LmVycm9yID0gQWNjb3VudHMuX2hhbmRsZUVycm9yKFwiSW5jb3JyZWN0IHBhc3N3b3JkXCIsIGZhbHNlKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICAvLyBUaGUgcGFzc3dvcmQgY2hlY2tzIG91dCwgYnV0IHRoZSB1c2VyJ3Mgc3RvcmVkIHBhc3N3b3JkIG5lZWRzIHRvIGJlIHVwZGF0ZWQgdG8gYXJnb24yXG4gICAgICAgIHVwZGF0ZVVzZXJQYXNzd29yZERlZmVyZWQodXNlciwgeyBkaWdlc3Q6IGZvcm1hdHRlZFBhc3N3b3JkLCBhbGdvcml0aG06IFwic2hhLTI1NlwiIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIC8vIGFyZ29uMiBwYXNzd29yZFxuICAgICAgY29uc3QgYXJnb24yUGFyYW1zID0gZ2V0QXJnb24yUGFyYW1zKGhhc2gpO1xuICAgICAgY29uc3QgbWF0Y2ggPSBhd2FpdCBhcmdvbjIudmVyaWZ5KGhhc2gsIGZvcm1hdHRlZFBhc3N3b3JkKTtcbiAgICAgIGlmICghbWF0Y2gpIHtcbiAgICAgICAgcmVzdWx0LmVycm9yID0gQWNjb3VudHMuX2hhbmRsZUVycm9yKFwiSW5jb3JyZWN0IHBhc3N3b3JkXCIsIGZhbHNlKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGhhc2gpIHtcbiAgICAgICAgY29uc3QgcGFyYW1zQ2hhbmdlZCA9IGFyZ29uMlBhcmFtcy5tZW1vcnlDb3N0ICE9PSBBY2NvdW50cy5fYXJnb24yTWVtb3J5Q29zdCgpIHx8XG4gICAgICAgICAgYXJnb24yUGFyYW1zLnRpbWVDb3N0ICE9PSBBY2NvdW50cy5fYXJnb24yVGltZUNvc3QoKSB8fFxuICAgICAgICAgIGFyZ29uMlBhcmFtcy5wYXJhbGxlbGlzbSAhPT0gQWNjb3VudHMuX2FyZ29uMlBhcmFsbGVsaXNtKCkgfHxcbiAgICAgICAgICBhcmdvbjJQYXJhbXMudHlwZSAhPT0gQWNjb3VudHMuX2FyZ29uMlR5cGUoKTtcbiAgICAgICAgaWYgKHBhcmFtc0NoYW5nZWQgPT09IHRydWUpIHtcbiAgICAgICAgICAvLyBUaGUgcGFzc3dvcmQgY2hlY2tzIG91dCwgYnV0IHRoZSB1c2VyJ3MgYXJnb24yIGhhc2ggbmVlZHMgdG8gYmUgdXBkYXRlZCB3aXRoIHRoZSByaWdodCBwYXJhbXNcbiAgICAgICAgICB1cGRhdGVVc2VyUGFzc3dvcmREZWZlcmVkKHVzZXIsIHsgZGlnZXN0OiBmb3JtYXR0ZWRQYXNzd29yZCwgYWxnb3JpdGhtOiBcInNoYS0yNTZcIiB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbkFjY291bnRzLl9jaGVja1Bhc3N3b3JkQXN5bmMgPSBjaGVja1Bhc3N3b3JkQXN5bmM7XG5cbi8vL1xuLy8vIExPR0lOXG4vLy9cblxuXG5cbmNvbnN0IHBhc3N3b3JkVmFsaWRhdG9yID0gTWF0Y2guT25lT2YoXG4gIE1hdGNoLldoZXJlKHN0ciA9PiBNYXRjaC50ZXN0KHN0ciwgU3RyaW5nKSAmJiBzdHIubGVuZ3RoIDw9IChNZXRlb3Iuc2V0dGluZ3M/LnBhY2thZ2VzPy5hY2NvdW50cz8ucGFzc3dvcmRNYXhMZW5ndGggfHwgMjU2KSksIHtcbiAgICBkaWdlc3Q6IE1hdGNoLldoZXJlKHN0ciA9PiBNYXRjaC50ZXN0KHN0ciwgU3RyaW5nKSAmJiBzdHIubGVuZ3RoID09PSA2NCksXG4gICAgYWxnb3JpdGhtOiBNYXRjaC5PbmVPZignc2hhLTI1NicpXG4gIH1cbik7XG5cbi8vIEhhbmRsZXIgdG8gbG9naW4gd2l0aCBhIHBhc3N3b3JkLlxuLy9cbi8vIFRoZSBNZXRlb3IgY2xpZW50IHNldHMgb3B0aW9ucy5wYXNzd29yZCB0byBhbiBvYmplY3Qgd2l0aCBrZXlzXG4vLyAnZGlnZXN0JyAoc2V0IHRvIFNIQTI1NihwYXNzd29yZCkpIGFuZCAnYWxnb3JpdGhtJyAoXCJzaGEtMjU2XCIpLlxuLy9cbi8vIEZvciBvdGhlciBERFAgY2xpZW50cyB3aGljaCBkb24ndCBoYXZlIGFjY2VzcyB0byBTSEEsIHRoZSBoYW5kbGVyXG4vLyBhbHNvIGFjY2VwdHMgdGhlIHBsYWludGV4dCBwYXNzd29yZCBpbiBvcHRpb25zLnBhc3N3b3JkIGFzIGEgc3RyaW5nLlxuLy9cbi8vIChJdCBtaWdodCBiZSBuaWNlIGlmIHNlcnZlcnMgY291bGQgdHVybiB0aGUgcGxhaW50ZXh0IHBhc3N3b3JkXG4vLyBvcHRpb24gb2ZmLiBPciBtYXliZSBpdCBzaG91bGQgYmUgb3B0LWluLCBub3Qgb3B0LW91dD9cbi8vIEFjY291bnRzLmNvbmZpZyBvcHRpb24/KVxuLy9cbi8vIE5vdGUgdGhhdCBuZWl0aGVyIHBhc3N3b3JkIG9wdGlvbiBpcyBzZWN1cmUgd2l0aG91dCBTU0wuXG4vL1xuQWNjb3VudHMucmVnaXN0ZXJMb2dpbkhhbmRsZXIoXCJwYXNzd29yZFwiLCBhc3luYyBvcHRpb25zID0+IHtcbiAgaWYgKCFvcHRpb25zLnBhc3N3b3JkKVxuICAgIHJldHVybiB1bmRlZmluZWQ7IC8vIGRvbid0IGhhbmRsZVxuXG4gIGNoZWNrKG9wdGlvbnMsIHtcbiAgICB1c2VyOiBBY2NvdW50cy5fdXNlclF1ZXJ5VmFsaWRhdG9yLFxuICAgIHBhc3N3b3JkOiBwYXNzd29yZFZhbGlkYXRvcixcbiAgICBjb2RlOiBNYXRjaC5PcHRpb25hbChNYXRjaC5Ob25FbXB0eVN0cmluZyksXG4gIH0pO1xuXG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IEFjY291bnRzLl9maW5kVXNlckJ5UXVlcnkob3B0aW9ucy51c2VyLCB7ZmllbGRzOiB7XG4gICAgc2VydmljZXM6IDEsXG4gICAgLi4uQWNjb3VudHMuX2NoZWNrUGFzc3dvcmRVc2VyRmllbGRzLFxuICB9fSk7XG4gIGlmICghdXNlcikge1xuICAgIEFjY291bnRzLl9oYW5kbGVFcnJvcihcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgaWYgKCFnZXRVc2VyUGFzc3dvcmRIYXNoKHVzZXIpKSB7XG4gICAgQWNjb3VudHMuX2hhbmRsZUVycm9yKFwiVXNlciBoYXMgbm8gcGFzc3dvcmQgc2V0XCIpO1xuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2hlY2tQYXNzd29yZEFzeW5jKHVzZXIsIG9wdGlvbnMucGFzc3dvcmQpO1xuICAvLyBUaGlzIG1ldGhvZCBpcyBhZGRlZCBieSB0aGUgcGFja2FnZSBhY2NvdW50cy0yZmFcbiAgLy8gRmlyc3QgdGhlIGxvZ2luIGlzIHZhbGlkYXRlZCwgdGhlbiB0aGUgY29kZSBzaXR1YXRpb24gaXMgY2hlY2tlZFxuICBpZiAoXG4gICAgIXJlc3VsdC5lcnJvciAmJlxuICAgIEFjY291bnRzLl9jaGVjazJmYUVuYWJsZWQ/Lih1c2VyKVxuICApIHtcbiAgICBpZiAoIW9wdGlvbnMuY29kZSkge1xuICAgICAgQWNjb3VudHMuX2hhbmRsZUVycm9yKCcyRkEgY29kZSBtdXN0IGJlIGluZm9ybWVkJywgdHJ1ZSwgJ25vLTJmYS1jb2RlJyk7XG4gICAgfVxuICAgIGlmIChcbiAgICAgICFBY2NvdW50cy5faXNUb2tlblZhbGlkKFxuICAgICAgICB1c2VyLnNlcnZpY2VzLnR3b0ZhY3RvckF1dGhlbnRpY2F0aW9uLnNlY3JldCxcbiAgICAgICAgb3B0aW9ucy5jb2RlXG4gICAgICApXG4gICAgKSB7XG4gICAgICBBY2NvdW50cy5faGFuZGxlRXJyb3IoJ0ludmFsaWQgMkZBIGNvZGUnLCB0cnVlLCAnaW52YWxpZC0yZmEtY29kZScpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59KTtcblxuLy8vXG4vLy8gQ0hBTkdJTkdcbi8vL1xuXG4vKipcbiAqIEBzdW1tYXJ5IENoYW5nZSBhIHVzZXIncyB1c2VybmFtZSBhc3luY2hyb25vdXNseS4gVXNlIHRoaXMgaW5zdGVhZCBvZiB1cGRhdGluZyB0aGVcbiAqIGRhdGFiYXNlIGRpcmVjdGx5LiBUaGUgb3BlcmF0aW9uIHdpbGwgZmFpbCBpZiB0aGVyZSBpcyBhbiBleGlzdGluZyB1c2VyXG4gKiB3aXRoIGEgdXNlcm5hbWUgb25seSBkaWZmZXJpbmcgaW4gY2FzZS5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSB1c2VySWQgVGhlIElEIG9mIHRoZSB1c2VyIHRvIHVwZGF0ZS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBuZXdVc2VybmFtZSBBIG5ldyB1c2VybmFtZSBmb3IgdGhlIHVzZXIuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICovXG5BY2NvdW50cy5zZXRVc2VybmFtZSA9IGFzeW5jICh1c2VySWQsIG5ld1VzZXJuYW1lKSA9PiB7XG4gIGNoZWNrKHVzZXJJZCwgTWF0Y2guTm9uRW1wdHlTdHJpbmcpO1xuICBjaGVjayhuZXdVc2VybmFtZSwgTWF0Y2guTm9uRW1wdHlTdHJpbmcpO1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IGdldFVzZXJCeUlkKHVzZXJJZCwge1xuICAgICAgZmllbGRzOiB7XG4gICAgICAgIHVzZXJuYW1lOiAxLFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKCF1c2VyKSB7XG4gICAgICBBY2NvdW50cy5faGFuZGxlRXJyb3IoXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBvbGRVc2VybmFtZSA9IHVzZXIudXNlcm5hbWU7XG5cbiAgICAvLyBQZXJmb3JtIGEgY2FzZSBpbnNlbnNpdGl2ZSBjaGVjayBmb3IgZHVwbGljYXRlcyBiZWZvcmUgdXBkYXRlXG4gICAgYXdhaXQgQWNjb3VudHMuX2NoZWNrRm9yQ2FzZUluc2Vuc2l0aXZlRHVwbGljYXRlcygndXNlcm5hbWUnLFxuICAgICAgJ1VzZXJuYW1lJywgbmV3VXNlcm5hbWUsIHVzZXIuX2lkKTtcblxuICAgIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyh7IF9pZDogdXNlci5faWQgfSwgeyAkc2V0OiB7IHVzZXJuYW1lOiBuZXdVc2VybmFtZSB9IH0pO1xuXG4gICAgLy8gUGVyZm9ybSBhbm90aGVyIGNoZWNrIGFmdGVyIHVwZGF0ZSwgaW4gY2FzZSBhIG1hdGNoaW5nIHVzZXIgaGFzIGJlZW5cbiAgICAvLyBpbnNlcnRlZCBpbiB0aGUgbWVhbnRpbWVcbiAgICB0cnkge1xuICAgICAgYXdhaXQgQWNjb3VudHMuX2NoZWNrRm9yQ2FzZUluc2Vuc2l0aXZlRHVwbGljYXRlcygndXNlcm5hbWUnLFxuICAgICAgICAnVXNlcm5hbWUnLCBuZXdVc2VybmFtZSwgdXNlci5faWQpO1xuICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAvLyBVbmRvIHVwZGF0ZSBpZiB0aGUgY2hlY2sgZmFpbHNcbiAgICAgIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyh7IF9pZDogdXNlci5faWQgfSwgeyAkc2V0OiB7IHVzZXJuYW1lOiBvbGRVc2VybmFtZSB9IH0pO1xuICAgICAgdGhyb3cgZXg7XG4gICAgfVxuICB9O1xuXG4vLyBMZXQgdGhlIHVzZXIgY2hhbmdlIHRoZWlyIG93biBwYXNzd29yZCBpZiB0aGV5IGtub3cgdGhlIG9sZFxuLy8gcGFzc3dvcmQuIGBvbGRQYXNzd29yZGAgYW5kIGBuZXdQYXNzd29yZGAgc2hvdWxkIGJlIG9iamVjdHMgd2l0aCBrZXlzXG4vLyBgZGlnZXN0YCBhbmQgYGFsZ29yaXRobWAgKHJlcHJlc2VudGluZyB0aGUgU0hBMjU2IG9mIHRoZSBwYXNzd29yZCkuXG5NZXRlb3IubWV0aG9kcyhcbiAge1xuICAgIGNoYW5nZVBhc3N3b3JkOiBhc3luYyBmdW5jdGlvbihvbGRQYXNzd29yZCwgbmV3UGFzc3dvcmQpIHtcbiAgICAgIGNoZWNrKG9sZFBhc3N3b3JkLCBwYXNzd29yZFZhbGlkYXRvcik7XG4gICAgICBjaGVjayhuZXdQYXNzd29yZCwgcGFzc3dvcmRWYWxpZGF0b3IpO1xuXG4gICAgICBpZiAoIXRoaXMudXNlcklkKSB7XG4gICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAxLCBcIk11c3QgYmUgbG9nZ2VkIGluXCIpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB1c2VyID0gYXdhaXQgZ2V0VXNlckJ5SWQodGhpcy51c2VySWQsIHtcbiAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgc2VydmljZXM6IDEsXG4gICAgICAgICAgLi4uQWNjb3VudHMuX2NoZWNrUGFzc3dvcmRVc2VyRmllbGRzXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCF1c2VyKSB7XG4gICAgICAgIEFjY291bnRzLl9oYW5kbGVFcnJvcihcIlVzZXIgbm90IGZvdW5kXCIpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWdldFVzZXJQYXNzd29yZEhhc2godXNlcikpIHtcbiAgICAgICAgQWNjb3VudHMuX2hhbmRsZUVycm9yKFwiVXNlciBoYXMgbm8gcGFzc3dvcmQgc2V0XCIpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBjaGVja1Bhc3N3b3JkQXN5bmModXNlciwgb2xkUGFzc3dvcmQpO1xuICAgICAgaWYgKHJlc3VsdC5lcnJvcikge1xuICAgICAgICB0aHJvdyByZXN1bHQuZXJyb3I7XG4gICAgICB9XG5cbiAgICAgIC8vIEl0IHdvdWxkIGJlIGJldHRlciBpZiB0aGlzIHJlbW92ZWQgQUxMIGV4aXN0aW5nIHRva2VucyBhbmQgcmVwbGFjZWRcbiAgICAgIC8vIHRoZSB0b2tlbiBmb3IgdGhlIGN1cnJlbnQgY29ubmVjdGlvbiB3aXRoIGEgbmV3IG9uZSwgYnV0IHRoYXQgd291bGRcbiAgICAgIC8vIGJlIHRyaWNreSwgc28gd2UnbGwgc2V0dGxlIGZvciBqdXN0IHJlcGxhY2luZyBhbGwgdG9rZW5zIG90aGVyIHRoYW5cbiAgICAgIC8vIHRoZSBvbmUgZm9yIHRoZSBjdXJyZW50IGNvbm5lY3Rpb24uXG4gICAgICBjb25zdCBjdXJyZW50VG9rZW4gPSBBY2NvdW50cy5fZ2V0TG9naW5Ub2tlbih0aGlzLmNvbm5lY3Rpb24uaWQpO1xuICAgICAgY29uc3QgdXBkYXRvciA9IGF3YWl0IGdldFVwZGF0b3JGb3JVc2VyUGFzc3dvcmQobmV3UGFzc3dvcmQpO1xuXG4gICAgICBhd2FpdCBNZXRlb3IudXNlcnMudXBkYXRlQXN5bmMoXG4gICAgICAgIHsgX2lkOiB0aGlzLnVzZXJJZCB9LFxuICAgICAgICB7XG4gICAgICAgICAgJHNldDogdXBkYXRvci4kc2V0LFxuICAgICAgICAgICRwdWxsOiB7XG4gICAgICAgICAgICBcInNlcnZpY2VzLnJlc3VtZS5sb2dpblRva2Vuc1wiOiB7IGhhc2hlZFRva2VuOiB7ICRuZTogY3VycmVudFRva2VuIH0gfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgJHVuc2V0OiB7IFwic2VydmljZXMucGFzc3dvcmQucmVzZXRcIjogMSwgLi4udXBkYXRvci4kdW5zZXQgfVxuICAgICAgICB9XG4gICAgICApO1xuXG4gICAgICByZXR1cm4geyBwYXNzd29yZENoYW5nZWQ6IHRydWUgfTtcbiAgICB9XG4gIH0pO1xuXG5cbi8vIEZvcmNlIGNoYW5nZSB0aGUgdXNlcnMgcGFzc3dvcmQuXG5cbi8qKlxuICogQHN1bW1hcnkgRm9yY2libHkgY2hhbmdlIHRoZSBwYXNzd29yZCBmb3IgYSB1c2VyLlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHtTdHJpbmd9IHVzZXJJZCBUaGUgaWQgb2YgdGhlIHVzZXIgdG8gdXBkYXRlLlxuICogQHBhcmFtIHtTdHJpbmd9IG5ld1BsYWludGV4dFBhc3N3b3JkIEEgbmV3IHBhc3N3b3JkIGZvciB0aGUgdXNlci5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLmxvZ291dCBMb2dvdXQgYWxsIGN1cnJlbnQgY29ubmVjdGlvbnMgd2l0aCB0aGlzIHVzZXJJZCAoZGVmYXVsdDogdHJ1ZSlcbiAqIEBpbXBvcnRGcm9tUGFja2FnZSBhY2NvdW50cy1iYXNlXG4gKi9cbkFjY291bnRzLnNldFBhc3N3b3JkQXN5bmMgPVxuICBhc3luYyAodXNlcklkLCBuZXdQbGFpbnRleHRQYXNzd29yZCwgb3B0aW9ucykgPT4ge1xuICAgIGNoZWNrKHVzZXJJZCwgU3RyaW5nKTtcbiAgICBjaGVjayhuZXdQbGFpbnRleHRQYXNzd29yZCwgTWF0Y2guV2hlcmUoc3RyID0+IE1hdGNoLnRlc3Qoc3RyLCBTdHJpbmcpICYmIHN0ci5sZW5ndGggPD0gKE1ldGVvci5zZXR0aW5ncz8ucGFja2FnZXM/LmFjY291bnRzPy5wYXNzd29yZE1heExlbmd0aCB8fCAyNTYpKSk7XG4gICAgY2hlY2sob3B0aW9ucywgTWF0Y2guTWF5YmUoeyBsb2dvdXQ6IEJvb2xlYW4gfSkpO1xuICAgIG9wdGlvbnMgPSB7IGxvZ291dDogdHJ1ZSwgLi4ub3B0aW9ucyB9O1xuXG4gICAgY29uc3QgdXNlciA9IGF3YWl0IGdldFVzZXJCeUlkKHVzZXJJZCwgeyBmaWVsZHM6IHsgX2lkOiAxIH0gfSk7XG4gICAgaWYgKCF1c2VyKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJVc2VyIG5vdCBmb3VuZFwiKTtcbiAgICB9XG5cbiAgICBsZXQgdXBkYXRvciA9IGF3YWl0IGdldFVwZGF0b3JGb3JVc2VyUGFzc3dvcmQobmV3UGxhaW50ZXh0UGFzc3dvcmQpO1xuICAgIHVwZGF0b3IuJHVuc2V0ID0gdXBkYXRvci4kdW5zZXQgfHwge307XG4gICAgdXBkYXRvci4kdW5zZXRbXCJzZXJ2aWNlcy5wYXNzd29yZC5yZXNldFwiXSA9IDE7XG5cbiAgICBpZiAob3B0aW9ucy5sb2dvdXQpIHtcbiAgICAgIHVwZGF0b3IuJHVuc2V0W1wic2VydmljZXMucmVzdW1lLmxvZ2luVG9rZW5zXCJdID0gMTtcbiAgICB9XG5cbiAgICBhd2FpdCBNZXRlb3IudXNlcnMudXBkYXRlQXN5bmMoeyBfaWQ6IHVzZXIuX2lkIH0sIHVwZGF0b3IpO1xuICB9O1xuXG4vLy9cbi8vLyBSRVNFVFRJTkcgVklBIEVNQUlMXG4vLy9cblxuLy8gVXRpbGl0eSBmb3IgcGx1Y2tpbmcgYWRkcmVzc2VzIGZyb20gZW1haWxzXG5jb25zdCBwbHVja0FkZHJlc3NlcyA9IChlbWFpbHMgPSBbXSkgPT4gZW1haWxzLm1hcChlbWFpbCA9PiBlbWFpbC5hZGRyZXNzKTtcblxuLy8gTWV0aG9kIGNhbGxlZCBieSBhIHVzZXIgdG8gcmVxdWVzdCBhIHBhc3N3b3JkIHJlc2V0IGVtYWlsLiBUaGlzIGlzXG4vLyB0aGUgc3RhcnQgb2YgdGhlIHJlc2V0IHByb2Nlc3MuXG5NZXRlb3IubWV0aG9kcyh7Zm9yZ290UGFzc3dvcmQ6IGFzeW5jIG9wdGlvbnMgPT4ge1xuICBjaGVjayhvcHRpb25zLCB7ZW1haWw6IFN0cmluZ30pXG5cbiAgY29uc3QgdXNlciA9IGF3YWl0IEFjY291bnRzLmZpbmRVc2VyQnlFbWFpbChvcHRpb25zLmVtYWlsLCB7IGZpZWxkczogeyBlbWFpbHM6IDEgfSB9KTtcblxuICBpZiAoIXVzZXIpIHtcbiAgICBpZiAoQWNjb3VudHMuX29wdGlvbnMuYW1iaWd1b3VzRXJyb3JNZXNzYWdlcykgcmV0dXJuO1xuICAgIEFjY291bnRzLl9oYW5kbGVFcnJvcihcIlVzZXIgbm90IGZvdW5kXCIpO1xuICB9XG5cbiAgY29uc3QgZW1haWxzID0gcGx1Y2tBZGRyZXNzZXModXNlci5lbWFpbHMpO1xuICBjb25zdCBjYXNlU2Vuc2l0aXZlRW1haWwgPSBlbWFpbHMuZmluZChcbiAgICBlbWFpbCA9PiBlbWFpbC50b0xvd2VyQ2FzZSgpID09PSBvcHRpb25zLmVtYWlsLnRvTG93ZXJDYXNlKClcbiAgKTtcblxuICBhd2FpdCBBY2NvdW50cy5zZW5kUmVzZXRQYXNzd29yZEVtYWlsKHVzZXIuX2lkLCBjYXNlU2Vuc2l0aXZlRW1haWwpO1xufX0pO1xuXG4vKipcbiAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IGdlbmVyYXRlcyBhIHJlc2V0IHRva2VuIGFuZCBzYXZlcyBpdCBpbnRvIHRoZSBkYXRhYmFzZS5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSB1c2VySWQgVGhlIGlkIG9mIHRoZSB1c2VyIHRvIGdlbmVyYXRlIHRoZSByZXNldCB0b2tlbiBmb3IuXG4gKiBAcGFyYW0ge1N0cmluZ30gZW1haWwgV2hpY2ggYWRkcmVzcyBvZiB0aGUgdXNlciB0byBnZW5lcmF0ZSB0aGUgcmVzZXQgdG9rZW4gZm9yLiBUaGlzIGFkZHJlc3MgbXVzdCBiZSBpbiB0aGUgdXNlcidzIGBlbWFpbHNgIGxpc3QuIElmIGBudWxsYCwgZGVmYXVsdHMgdG8gdGhlIGZpcnN0IGVtYWlsIGluIHRoZSBsaXN0LlxuICogQHBhcmFtIHtTdHJpbmd9IHJlYXNvbiBgcmVzZXRQYXNzd29yZGAgb3IgYGVucm9sbEFjY291bnRgLlxuICogQHBhcmFtIHtPYmplY3R9IFtleHRyYVRva2VuRGF0YV0gT3B0aW9uYWwgYWRkaXRpb25hbCBkYXRhIHRvIGJlIGFkZGVkIGludG8gdGhlIHRva2VuIHJlY29yZC5cbiAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IFByb21pc2Ugb2YgYW4gb2JqZWN0IHdpdGgge2VtYWlsLCB1c2VyLCB0b2tlbn0gdmFsdWVzLlxuICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAqL1xuQWNjb3VudHMuZ2VuZXJhdGVSZXNldFRva2VuID1cbiAgYXN5bmMgKHVzZXJJZCwgZW1haWwsIHJlYXNvbiwgZXh0cmFUb2tlbkRhdGEpID0+IHtcbiAgLy8gTWFrZSBzdXJlIHRoZSB1c2VyIGV4aXN0cywgYW5kIGVtYWlsIGlzIG9uZSBvZiB0aGVpciBhZGRyZXNzZXMuXG4gIC8vIERvbid0IGxpbWl0IHRoZSBmaWVsZHMgaW4gdGhlIHVzZXIgb2JqZWN0IHNpbmNlIHRoZSB1c2VyIGlzIHJldHVybmVkXG4gIC8vIGJ5IHRoZSBmdW5jdGlvbiBhbmQgc29tZSBvdGhlciBmaWVsZHMgbWlnaHQgYmUgdXNlZCBlbHNld2hlcmUuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBnZXRVc2VyQnlJZCh1c2VySWQpO1xuICBpZiAoIXVzZXIpIHtcbiAgICBBY2NvdW50cy5faGFuZGxlRXJyb3IoXCJDYW4ndCBmaW5kIHVzZXJcIik7XG4gIH1cblxuICAvLyBwaWNrIHRoZSBmaXJzdCBlbWFpbCBpZiB3ZSB3ZXJlbid0IHBhc3NlZCBhbiBlbWFpbC5cbiAgaWYgKCFlbWFpbCAmJiB1c2VyLmVtYWlscyAmJiB1c2VyLmVtYWlsc1swXSkge1xuICAgIGVtYWlsID0gdXNlci5lbWFpbHNbMF0uYWRkcmVzcztcbiAgfVxuXG4gIC8vIG1ha2Ugc3VyZSB3ZSBoYXZlIGEgdmFsaWQgZW1haWxcbiAgaWYgKCFlbWFpbCB8fFxuICAgICEocGx1Y2tBZGRyZXNzZXModXNlci5lbWFpbHMpLmluY2x1ZGVzKGVtYWlsKSkpIHtcbiAgICBBY2NvdW50cy5faGFuZGxlRXJyb3IoXCJObyBzdWNoIGVtYWlsIGZvciB1c2VyLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHRva2VuID0gUmFuZG9tLnNlY3JldCgpO1xuICBjb25zdCB0b2tlblJlY29yZCA9IHtcbiAgICB0b2tlbixcbiAgICBlbWFpbCxcbiAgICB3aGVuOiBuZXcgRGF0ZSgpXG4gIH07XG5cbiAgaWYgKHJlYXNvbiA9PT0gJ3Jlc2V0UGFzc3dvcmQnKSB7XG4gICAgdG9rZW5SZWNvcmQucmVhc29uID0gJ3Jlc2V0JztcbiAgfSBlbHNlIGlmIChyZWFzb24gPT09ICdlbnJvbGxBY2NvdW50Jykge1xuICAgIHRva2VuUmVjb3JkLnJlYXNvbiA9ICdlbnJvbGwnO1xuICB9IGVsc2UgaWYgKHJlYXNvbikge1xuICAgIC8vIGZhbGxiYWNrIHNvIHRoYXQgdGhpcyBmdW5jdGlvbiBjYW4gYmUgdXNlZCBmb3IgdW5rbm93biByZWFzb25zIGFzIHdlbGxcbiAgICB0b2tlblJlY29yZC5yZWFzb24gPSByZWFzb247XG4gIH1cblxuICBpZiAoZXh0cmFUb2tlbkRhdGEpIHtcbiAgICBPYmplY3QuYXNzaWduKHRva2VuUmVjb3JkLCBleHRyYVRva2VuRGF0YSk7XG4gIH1cbiAgLy8gaWYgdGhpcyBtZXRob2QgaXMgY2FsbGVkIGZyb20gdGhlIGVucm9sbCBhY2NvdW50IHdvcmstZmxvdyB0aGVuXG4gIC8vIHN0b3JlIHRoZSB0b2tlbiByZWNvcmQgaW4gJ3NlcnZpY2VzLnBhc3N3b3JkLmVucm9sbCcgZGIgZmllbGRcbiAgLy8gZWxzZSBzdG9yZSB0aGUgdG9rZW4gcmVjb3JkIGluIGluICdzZXJ2aWNlcy5wYXNzd29yZC5yZXNldCcgZGIgZmllbGRcbiAgaWYgKHJlYXNvbiA9PT0gXCJlbnJvbGxBY2NvdW50XCIpIHtcbiAgICBhd2FpdCBNZXRlb3IudXNlcnMudXBkYXRlQXN5bmMoXG4gICAgICB7IF9pZDogdXNlci5faWQgfSxcbiAgICAgIHtcbiAgICAgICAgJHNldDoge1xuICAgICAgICAgIFwic2VydmljZXMucGFzc3dvcmQuZW5yb2xsXCI6IHRva2VuUmVjb3JkXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuICAgIC8vIGJlZm9yZSBwYXNzaW5nIHRvIHRlbXBsYXRlLCB1cGRhdGUgdXNlciBvYmplY3Qgd2l0aCBuZXcgdG9rZW5cbiAgICBNZXRlb3IuX2Vuc3VyZSh1c2VyLCBcInNlcnZpY2VzXCIsIFwicGFzc3dvcmRcIikuZW5yb2xsID0gdG9rZW5SZWNvcmQ7XG4gIH1cbiAgZWxzZSB7XG4gICAgYXdhaXQgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKFxuICAgICAgeyBfaWQ6IHVzZXIuX2lkIH0sXG4gICAgICB7XG4gICAgICAgICRzZXQ6IHtcbiAgICAgICAgICBcInNlcnZpY2VzLnBhc3N3b3JkLnJlc2V0XCI6IHRva2VuUmVjb3JkXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICApO1xuICAgIC8vIGJlZm9yZSBwYXNzaW5nIHRvIHRlbXBsYXRlLCB1cGRhdGUgdXNlciBvYmplY3Qgd2l0aCBuZXcgdG9rZW5cbiAgICBNZXRlb3IuX2Vuc3VyZSh1c2VyLCBcInNlcnZpY2VzXCIsIFwicGFzc3dvcmRcIikucmVzZXQgPSB0b2tlblJlY29yZDtcbiAgfVxuXG4gIHJldHVybiB7IGVtYWlsLCB1c2VyLCB0b2tlbiB9O1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBHZW5lcmF0ZXMgYXN5bmNocm9ub3VzbHkgYW4gZS1tYWlsIHZlcmlmaWNhdGlvbiB0b2tlbiBhbmQgc2F2ZXMgaXQgaW50byB0aGUgZGF0YWJhc2UuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBpZCBvZiB0aGUgdXNlciB0byBnZW5lcmF0ZSB0aGUgIGUtbWFpbCB2ZXJpZmljYXRpb24gdG9rZW4gZm9yLlxuICogQHBhcmFtIHtTdHJpbmd9IGVtYWlsIFdoaWNoIGFkZHJlc3Mgb2YgdGhlIHVzZXIgdG8gZ2VuZXJhdGUgdGhlIGUtbWFpbCB2ZXJpZmljYXRpb24gdG9rZW4gZm9yLiBUaGlzIGFkZHJlc3MgbXVzdCBiZSBpbiB0aGUgdXNlcidzIGBlbWFpbHNgIGxpc3QuIElmIGBudWxsYCwgZGVmYXVsdHMgdG8gdGhlIGZpcnN0IHVudmVyaWZpZWQgZW1haWwgaW4gdGhlIGxpc3QuXG4gKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhVG9rZW5EYXRhXSBPcHRpb25hbCBhZGRpdGlvbmFsIGRhdGEgdG8gYmUgYWRkZWQgaW50byB0aGUgdG9rZW4gcmVjb3JkLlxuICogQHJldHVybnMge1Byb21pc2U8T2JqZWN0Pn0gUHJvbWlzZSBvZiBhbiBvYmplY3Qgd2l0aCB7ZW1haWwsIHVzZXIsIHRva2VufSB2YWx1ZXMuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICovXG5BY2NvdW50cy5nZW5lcmF0ZVZlcmlmaWNhdGlvblRva2VuID1cbiAgYXN5bmMgKHVzZXJJZCwgZW1haWwsIGV4dHJhVG9rZW5EYXRhKSA9PiB7XG4gIC8vIE1ha2Ugc3VyZSB0aGUgdXNlciBleGlzdHMsIGFuZCBlbWFpbCBpcyBvbmUgb2YgdGhlaXIgYWRkcmVzc2VzLlxuICAvLyBEb24ndCBsaW1pdCB0aGUgZmllbGRzIGluIHRoZSB1c2VyIG9iamVjdCBzaW5jZSB0aGUgdXNlciBpcyByZXR1cm5lZFxuICAvLyBieSB0aGUgZnVuY3Rpb24gYW5kIHNvbWUgb3RoZXIgZmllbGRzIG1pZ2h0IGJlIHVzZWQgZWxzZXdoZXJlLlxuICBjb25zdCB1c2VyID0gYXdhaXQgZ2V0VXNlckJ5SWQodXNlcklkKTtcbiAgaWYgKCF1c2VyKSB7XG4gICAgQWNjb3VudHMuX2hhbmRsZUVycm9yKFwiQ2FuJ3QgZmluZCB1c2VyXCIpO1xuICB9XG5cbiAgLy8gcGljayB0aGUgZmlyc3QgdW52ZXJpZmllZCBlbWFpbCBpZiB3ZSB3ZXJlbid0IHBhc3NlZCBhbiBlbWFpbC5cbiAgaWYgKCFlbWFpbCkge1xuICAgIGNvbnN0IGVtYWlsUmVjb3JkID0gKHVzZXIuZW1haWxzIHx8IFtdKS5maW5kKGUgPT4gIWUudmVyaWZpZWQpO1xuICAgIGVtYWlsID0gKGVtYWlsUmVjb3JkIHx8IHt9KS5hZGRyZXNzO1xuXG4gICAgaWYgKCFlbWFpbCkge1xuICAgICAgQWNjb3VudHMuX2hhbmRsZUVycm9yKFwiVGhhdCB1c2VyIGhhcyBubyB1bnZlcmlmaWVkIGVtYWlsIGFkZHJlc3Nlcy5cIik7XG4gICAgfVxuICB9XG5cbiAgLy8gbWFrZSBzdXJlIHdlIGhhdmUgYSB2YWxpZCBlbWFpbFxuICBpZiAoIWVtYWlsIHx8XG4gICAgIShwbHVja0FkZHJlc3Nlcyh1c2VyLmVtYWlscykuaW5jbHVkZXMoZW1haWwpKSkge1xuICAgIEFjY291bnRzLl9oYW5kbGVFcnJvcihcIk5vIHN1Y2ggZW1haWwgZm9yIHVzZXIuXCIpO1xuICB9XG5cbiAgY29uc3QgdG9rZW4gPSBSYW5kb20uc2VjcmV0KCk7XG4gIGNvbnN0IHRva2VuUmVjb3JkID0ge1xuICAgIHRva2VuLFxuICAgIC8vIFRPRE86IFRoaXMgc2hvdWxkIHByb2JhYmx5IGJlIHJlbmFtZWQgdG8gXCJlbWFpbFwiIHRvIG1hdGNoIHJlc2V0IHRva2VuIHJlY29yZC5cbiAgICBhZGRyZXNzOiBlbWFpbCxcbiAgICB3aGVuOiBuZXcgRGF0ZSgpXG4gIH07XG5cbiAgaWYgKGV4dHJhVG9rZW5EYXRhKSB7XG4gICAgT2JqZWN0LmFzc2lnbih0b2tlblJlY29yZCwgZXh0cmFUb2tlbkRhdGEpO1xuICB9XG5cbiAgYXdhaXQgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKHtfaWQ6IHVzZXIuX2lkfSwgeyRwdXNoOiB7XG4gICAgJ3NlcnZpY2VzLmVtYWlsLnZlcmlmaWNhdGlvblRva2Vucyc6IHRva2VuUmVjb3JkXG4gIH19KTtcblxuICAvLyBiZWZvcmUgcGFzc2luZyB0byB0ZW1wbGF0ZSwgdXBkYXRlIHVzZXIgb2JqZWN0IHdpdGggbmV3IHRva2VuXG4gIE1ldGVvci5fZW5zdXJlKHVzZXIsICdzZXJ2aWNlcycsICdlbWFpbCcpO1xuICBpZiAoIXVzZXIuc2VydmljZXMuZW1haWwudmVyaWZpY2F0aW9uVG9rZW5zKSB7XG4gICAgdXNlci5zZXJ2aWNlcy5lbWFpbC52ZXJpZmljYXRpb25Ub2tlbnMgPSBbXTtcbiAgfVxuICB1c2VyLnNlcnZpY2VzLmVtYWlsLnZlcmlmaWNhdGlvblRva2Vucy5wdXNoKHRva2VuUmVjb3JkKTtcblxuICByZXR1cm4ge2VtYWlsLCB1c2VyLCB0b2tlbn07XG59O1xuXG5cbi8vIHNlbmQgdGhlIHVzZXIgYW4gZW1haWwgd2l0aCBhIGxpbmsgdGhhdCB3aGVuIG9wZW5lZCBhbGxvd3MgdGhlIHVzZXJcbi8vIHRvIHNldCBhIG5ldyBwYXNzd29yZCwgd2l0aG91dCB0aGUgb2xkIHBhc3N3b3JkLlxuXG4vKipcbiAqIEBzdW1tYXJ5IFNlbmQgYW4gZW1haWwgYXN5bmNocm9ub3VzbHkgd2l0aCBhIGxpbmsgdGhlIHVzZXIgY2FuIHVzZSB0byByZXNldCB0aGVpciBwYXNzd29yZC5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSB1c2VySWQgVGhlIGlkIG9mIHRoZSB1c2VyIHRvIHNlbmQgZW1haWwgdG8uXG4gKiBAcGFyYW0ge1N0cmluZ30gW2VtYWlsXSBPcHRpb25hbC4gV2hpY2ggYWRkcmVzcyBvZiB0aGUgdXNlcidzIHRvIHNlbmQgdGhlIGVtYWlsIHRvLiBUaGlzIGFkZHJlc3MgbXVzdCBiZSBpbiB0aGUgdXNlcidzIGBlbWFpbHNgIGxpc3QuIERlZmF1bHRzIHRvIHRoZSBmaXJzdCBlbWFpbCBpbiB0aGUgbGlzdC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFUb2tlbkRhdGFdIE9wdGlvbmFsIGFkZGl0aW9uYWwgZGF0YSB0byBiZSBhZGRlZCBpbnRvIHRoZSB0b2tlbiByZWNvcmQuXG4gKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhUGFyYW1zXSBPcHRpb25hbCBhZGRpdGlvbmFsIHBhcmFtcyB0byBiZSBhZGRlZCB0byB0aGUgcmVzZXQgdXJsLlxuICogQHJldHVybnMge1Byb21pc2U8T2JqZWN0Pn0gUHJvbWlzZSBvZiBhbiBvYmplY3Qgd2l0aCB7ZW1haWwsIHVzZXIsIHRva2VuLCB1cmwsIG9wdGlvbnN9IHZhbHVlcy5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSBhY2NvdW50cy1iYXNlXG4gKi9cbkFjY291bnRzLnNlbmRSZXNldFBhc3N3b3JkRW1haWwgPVxuICBhc3luYyAodXNlcklkLCBlbWFpbCwgZXh0cmFUb2tlbkRhdGEsIGV4dHJhUGFyYW1zKSA9PiB7XG4gICAgY29uc3QgeyBlbWFpbDogcmVhbEVtYWlsLCB1c2VyLCB0b2tlbiB9ID1cbiAgICAgIGF3YWl0IEFjY291bnRzLmdlbmVyYXRlUmVzZXRUb2tlbih1c2VySWQsIGVtYWlsLCAncmVzZXRQYXNzd29yZCcsIGV4dHJhVG9rZW5EYXRhKTtcbiAgICBjb25zdCB1cmwgPSBhd2FpdCBBY2NvdW50cy5fcmVzb2x2ZVByb21pc2UoQWNjb3VudHMudXJscy5yZXNldFBhc3N3b3JkKHRva2VuLCBleHRyYVBhcmFtcykpO1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhd2FpdCBBY2NvdW50cy5nZW5lcmF0ZU9wdGlvbnNGb3JFbWFpbChyZWFsRW1haWwsIHVzZXIsIHVybCwgJ3Jlc2V0UGFzc3dvcmQnKTtcbiAgICBhd2FpdCBFbWFpbC5zZW5kQXN5bmMob3B0aW9ucyk7XG5cbiAgICBpZiAoTWV0ZW9yLmlzRGV2ZWxvcG1lbnQgJiYgIU1ldGVvci5pc1BhY2thZ2VUZXN0KSB7XG4gICAgICBjb25zb2xlLmxvZyhgXFxuUmVzZXQgcGFzc3dvcmQgVVJMOiAkeyB1cmwgfWApO1xuICAgIH1cbiAgICByZXR1cm4geyBlbWFpbDogcmVhbEVtYWlsLCB1c2VyLCB0b2tlbiwgdXJsLCBvcHRpb25zIH07XG4gIH07XG5cbi8vIHNlbmQgdGhlIHVzZXIgYW4gZW1haWwgaW5mb3JtaW5nIHRoZW0gdGhhdCB0aGVpciBhY2NvdW50IHdhcyBjcmVhdGVkLCB3aXRoXG4vLyBhIGxpbmsgdGhhdCB3aGVuIG9wZW5lZCBib3RoIG1hcmtzIHRoZWlyIGVtYWlsIGFzIHZlcmlmaWVkIGFuZCBmb3JjZXMgdGhlbVxuLy8gdG8gY2hvb3NlIHRoZWlyIHBhc3N3b3JkLiBUaGUgZW1haWwgbXVzdCBiZSBvbmUgb2YgdGhlIGFkZHJlc3NlcyBpbiB0aGVcbi8vIHVzZXIncyBlbWFpbHMgZmllbGQsIG9yIHVuZGVmaW5lZCB0byBwaWNrIHRoZSBmaXJzdCBlbWFpbCBhdXRvbWF0aWNhbGx5LlxuLy9cbi8vIFRoaXMgaXMgbm90IGNhbGxlZCBhdXRvbWF0aWNhbGx5LiBJdCBtdXN0IGJlIGNhbGxlZCBtYW51YWxseSBpZiB5b3Vcbi8vIHdhbnQgdG8gdXNlIGVucm9sbG1lbnQgZW1haWxzLlxuXG4vKipcbiAqIEBzdW1tYXJ5IFNlbmQgYW4gZW1haWwgYXN5bmNocm9ub3VzbHkgd2l0aCBhIGxpbmsgdGhlIHVzZXIgY2FuIHVzZSB0byBzZXQgdGhlaXIgaW5pdGlhbCBwYXNzd29yZC5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSB1c2VySWQgVGhlIGlkIG9mIHRoZSB1c2VyIHRvIHNlbmQgZW1haWwgdG8uXG4gKiBAcGFyYW0ge1N0cmluZ30gW2VtYWlsXSBPcHRpb25hbC4gV2hpY2ggYWRkcmVzcyBvZiB0aGUgdXNlcidzIHRvIHNlbmQgdGhlIGVtYWlsIHRvLiBUaGlzIGFkZHJlc3MgbXVzdCBiZSBpbiB0aGUgdXNlcidzIGBlbWFpbHNgIGxpc3QuIERlZmF1bHRzIHRvIHRoZSBmaXJzdCBlbWFpbCBpbiB0aGUgbGlzdC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFUb2tlbkRhdGFdIE9wdGlvbmFsIGFkZGl0aW9uYWwgZGF0YSB0byBiZSBhZGRlZCBpbnRvIHRoZSB0b2tlbiByZWNvcmQuXG4gKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhUGFyYW1zXSBPcHRpb25hbCBhZGRpdGlvbmFsIHBhcmFtcyB0byBiZSBhZGRlZCB0byB0aGUgZW5yb2xsbWVudCB1cmwuXG4gKiBAcmV0dXJucyB7UHJvbWlzZTxPYmplY3Q+fSBQcm9taXNlIG9mIGFuIG9iamVjdCB7ZW1haWwsIHVzZXIsIHRva2VuLCB1cmwsIG9wdGlvbnN9IHZhbHVlcy5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSBhY2NvdW50cy1iYXNlXG4gKi9cbkFjY291bnRzLnNlbmRFbnJvbGxtZW50RW1haWwgPVxuICBhc3luYyAodXNlcklkLCBlbWFpbCwgZXh0cmFUb2tlbkRhdGEsIGV4dHJhUGFyYW1zKSA9PiB7XG5cbiAgICBjb25zdCB7IGVtYWlsOiByZWFsRW1haWwsIHVzZXIsIHRva2VuIH0gPVxuICAgICAgYXdhaXQgQWNjb3VudHMuZ2VuZXJhdGVSZXNldFRva2VuKHVzZXJJZCwgZW1haWwsICdlbnJvbGxBY2NvdW50JywgZXh0cmFUb2tlbkRhdGEpO1xuXG4gICAgY29uc3QgdXJsID0gYXdhaXQgQWNjb3VudHMuX3Jlc29sdmVQcm9taXNlKEFjY291bnRzLnVybHMuZW5yb2xsQWNjb3VudCh0b2tlbiwgZXh0cmFQYXJhbXMpKTtcblxuICAgIGNvbnN0IG9wdGlvbnMgPVxuICAgICAgYXdhaXQgQWNjb3VudHMuZ2VuZXJhdGVPcHRpb25zRm9yRW1haWwocmVhbEVtYWlsLCB1c2VyLCB1cmwsICdlbnJvbGxBY2NvdW50Jyk7XG5cbiAgICBhd2FpdCBFbWFpbC5zZW5kQXN5bmMob3B0aW9ucyk7XG4gICAgaWYgKE1ldGVvci5pc0RldmVsb3BtZW50ICYmICFNZXRlb3IuaXNQYWNrYWdlVGVzdCkge1xuICAgICAgY29uc29sZS5sb2coYFxcbkVucm9sbG1lbnQgZW1haWwgVVJMOiAkeyB1cmwgfWApO1xuICAgIH1cbiAgICByZXR1cm4geyBlbWFpbDogcmVhbEVtYWlsLCB1c2VyLCB0b2tlbiwgdXJsLCBvcHRpb25zIH07XG4gIH07XG5cblxuLy8gVGFrZSB0b2tlbiBmcm9tIHNlbmRSZXNldFBhc3N3b3JkRW1haWwgb3Igc2VuZEVucm9sbG1lbnRFbWFpbCwgY2hhbmdlXG4vLyB0aGUgdXNlcnMgcGFzc3dvcmQsIGFuZCBsb2cgdGhlbSBpbi5cbk1ldGVvci5tZXRob2RzKFxuICB7XG4gICAgcmVzZXRQYXNzd29yZDpcbiAgICAgIGFzeW5jIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgIGNvbnN0IHRva2VuID0gYXJnc1swXTtcbiAgICAgICAgY29uc3QgbmV3UGFzc3dvcmQgPSBhcmdzWzFdO1xuICAgICAgICByZXR1cm4gYXdhaXQgQWNjb3VudHMuX2xvZ2luTWV0aG9kKFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgXCJyZXNldFBhc3N3b3JkXCIsXG4gICAgICAgICAgYXJncyxcbiAgICAgICAgICBcInBhc3N3b3JkXCIsXG4gICAgICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY2hlY2sodG9rZW4sIFN0cmluZyk7XG4gICAgICAgICAgICBjaGVjayhuZXdQYXNzd29yZCwgcGFzc3dvcmRWYWxpZGF0b3IpO1xuICAgICAgICAgICAgbGV0IHVzZXIgPSBhd2FpdCBNZXRlb3IudXNlcnMuZmluZE9uZUFzeW5jKFxuICAgICAgICAgICAgICB7IFwic2VydmljZXMucGFzc3dvcmQucmVzZXQudG9rZW5cIjogdG9rZW4gfSxcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGZpZWxkczoge1xuICAgICAgICAgICAgICAgICAgc2VydmljZXM6IDEsXG4gICAgICAgICAgICAgICAgICBlbWFpbHM6IDEsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBsZXQgaXNFbnJvbGwgPSBmYWxzZTtcbiAgICAgICAgICAgIC8vIGlmIHRva2VuIGlzIGluIHNlcnZpY2VzLnBhc3N3b3JkLnJlc2V0IGRiIGZpZWxkIGltcGxpZXNcbiAgICAgICAgICAgIC8vIHRoaXMgbWV0aG9kIGlzIHdhcyBub3QgY2FsbGVkIGZyb20gZW5yb2xsIGFjY291bnQgd29ya2Zsb3dcbiAgICAgICAgICAgIC8vIGVsc2UgdGhpcyBtZXRob2QgaXMgY2FsbGVkIGZyb20gZW5yb2xsIGFjY291bnQgd29ya2Zsb3dcbiAgICAgICAgICAgIGlmICghdXNlcikge1xuICAgICAgICAgICAgICB1c2VyID0gYXdhaXQgTWV0ZW9yLnVzZXJzLmZpbmRPbmVBc3luYyhcbiAgICAgICAgICAgICAgICB7IFwic2VydmljZXMucGFzc3dvcmQuZW5yb2xsLnRva2VuXCI6IHRva2VuIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgICAgICAgICAgIHNlcnZpY2VzOiAxLFxuICAgICAgICAgICAgICAgICAgICBlbWFpbHM6IDEsXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBpc0Vucm9sbCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXVzZXIpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiVG9rZW4gZXhwaXJlZFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCB0b2tlblJlY29yZCA9IHt9O1xuICAgICAgICAgICAgaWYgKGlzRW5yb2xsKSB7XG4gICAgICAgICAgICAgIHRva2VuUmVjb3JkID0gdXNlci5zZXJ2aWNlcy5wYXNzd29yZC5lbnJvbGw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0b2tlblJlY29yZCA9IHVzZXIuc2VydmljZXMucGFzc3dvcmQucmVzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB7IHdoZW4sIGVtYWlsIH0gPSB0b2tlblJlY29yZDtcbiAgICAgICAgICAgIGxldCB0b2tlbkxpZmV0aW1lTXMgPSBBY2NvdW50cy5fZ2V0UGFzc3dvcmRSZXNldFRva2VuTGlmZXRpbWVNcygpO1xuICAgICAgICAgICAgaWYgKGlzRW5yb2xsKSB7XG4gICAgICAgICAgICAgIHRva2VuTGlmZXRpbWVNcyA9IEFjY291bnRzLl9nZXRQYXNzd29yZEVucm9sbFRva2VuTGlmZXRpbWVNcygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgY3VycmVudFRpbWVNcyA9IERhdGUubm93KCk7XG4gICAgICAgICAgICBpZiAoKGN1cnJlbnRUaW1lTXMgLSB3aGVuKSA+IHRva2VuTGlmZXRpbWVNcylcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiVG9rZW4gZXhwaXJlZFwiKTtcbiAgICAgICAgICAgIGlmICghKHBsdWNrQWRkcmVzc2VzKHVzZXIuZW1haWxzKS5pbmNsdWRlcyhlbWFpbCkpKVxuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHVzZXJJZDogdXNlci5faWQsXG4gICAgICAgICAgICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlRva2VuIGhhcyBpbnZhbGlkIGVtYWlsIGFkZHJlc3NcIilcbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gTk9URTogV2UncmUgYWJvdXQgdG8gaW52YWxpZGF0ZSB0b2tlbnMgb24gdGhlIHVzZXIsIHdobyB3ZSBtaWdodCBiZVxuICAgICAgICAgICAgLy8gbG9nZ2VkIGluIGFzLiBNYWtlIHN1cmUgdG8gYXZvaWQgbG9nZ2luZyBvdXJzZWx2ZXMgb3V0IGlmIHRoaXNcbiAgICAgICAgICAgIC8vIGhhcHBlbnMuIEJ1dCBhbHNvIG1ha2Ugc3VyZSBub3QgdG8gbGVhdmUgdGhlIGNvbm5lY3Rpb24gaW4gYSBzdGF0ZVxuICAgICAgICAgICAgLy8gb2YgaGF2aW5nIGEgYmFkIHRva2VuIHNldCBpZiB0aGluZ3MgZmFpbC5cbiAgICAgICAgICAgIGNvbnN0IG9sZFRva2VuID0gQWNjb3VudHMuX2dldExvZ2luVG9rZW4odGhpcy5jb25uZWN0aW9uLmlkKTtcbiAgICAgICAgICAgIEFjY291bnRzLl9zZXRMb2dpblRva2VuKHVzZXIuX2lkLCB0aGlzLmNvbm5lY3Rpb24sIG51bGwpO1xuICAgICAgICAgICAgY29uc3QgcmVzZXRUb09sZFRva2VuID0gKCkgPT5cbiAgICAgICAgICAgICAgQWNjb3VudHMuX3NldExvZ2luVG9rZW4odXNlci5faWQsIHRoaXMuY29ubmVjdGlvbiwgb2xkVG9rZW4pO1xuXG4gICAgICAgICAgICBjb25zdCB1cGRhdG9yID0gYXdhaXQgZ2V0VXBkYXRvckZvclVzZXJQYXNzd29yZChuZXdQYXNzd29yZCk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgdXNlciByZWNvcmQgYnk6XG4gICAgICAgICAgICAgIC8vIC0gQ2hhbmdpbmcgdGhlIHBhc3N3b3JkIHRvIHRoZSBuZXcgb25lXG4gICAgICAgICAgICAgIC8vIC0gRm9yZ2V0dGluZyBhYm91dCB0aGUgcmVzZXQgdG9rZW4gb3IgZW5yb2xsIHRva2VuIHRoYXQgd2FzIGp1c3QgdXNlZFxuICAgICAgICAgICAgICAvLyAtIFZlcmlmeWluZyB0aGVpciBlbWFpbCwgc2luY2UgdGhleSBnb3QgdGhlIHBhc3N3b3JkIHJlc2V0IHZpYSBlbWFpbC5cbiAgICAgICAgICAgICAgbGV0IGFmZmVjdGVkUmVjb3JkcyA9IHt9O1xuICAgICAgICAgICAgICAvLyBpZiByZWFzb24gaXMgZW5yb2xsIHRoZW4gY2hlY2sgc2VydmljZXMucGFzc3dvcmQuZW5yb2xsLnRva2VuIGZpZWxkIGZvciBhZmZlY3RlZCByZWNvcmRzXG4gICAgICAgICAgICAgIGlmIChpc0Vucm9sbCkge1xuICAgICAgICAgICAgICAgIGFmZmVjdGVkUmVjb3JkcyA9IGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyhcbiAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiB1c2VyLl9pZCxcbiAgICAgICAgICAgICAgICAgICAgXCJlbWFpbHMuYWRkcmVzc1wiOiBlbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgXCJzZXJ2aWNlcy5wYXNzd29yZC5lbnJvbGwudG9rZW5cIjogdG9rZW5cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRzZXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICBcImVtYWlscy4kLnZlcmlmaWVkXCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgLi4udXBkYXRvci4kc2V0XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICR1bnNldDoge1xuICAgICAgICAgICAgICAgICAgICAgIFwic2VydmljZXMucGFzc3dvcmQuZW5yb2xsXCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgLi4udXBkYXRvci4kdW5zZXRcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgYWZmZWN0ZWRSZWNvcmRzID0gYXdhaXQgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IHVzZXIuX2lkLFxuICAgICAgICAgICAgICAgICAgICBcImVtYWlscy5hZGRyZXNzXCI6IGVtYWlsLFxuICAgICAgICAgICAgICAgICAgICBcInNlcnZpY2VzLnBhc3N3b3JkLnJlc2V0LnRva2VuXCI6IHRva2VuXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkc2V0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgXCJlbWFpbHMuJC52ZXJpZmllZFwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgIC4uLnVwZGF0b3IuJHNldFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAkdW5zZXQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICBcInNlcnZpY2VzLnBhc3N3b3JkLnJlc2V0XCI6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgLi4udXBkYXRvci4kdW5zZXRcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKGFmZmVjdGVkUmVjb3JkcyAhPT0gMSlcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgdXNlcklkOiB1c2VyLl9pZCxcbiAgICAgICAgICAgICAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJJbnZhbGlkIGVtYWlsXCIpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICByZXNldFRvT2xkVG9rZW4oKTtcbiAgICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXBsYWNlIGFsbCB2YWxpZCBsb2dpbiB0b2tlbnMgd2l0aCBuZXcgb25lcyAoY2hhbmdpbmdcbiAgICAgICAgICAgIC8vIHBhc3N3b3JkIHNob3VsZCBpbnZhbGlkYXRlIGV4aXN0aW5nIHNlc3Npb25zKS5cbiAgICAgICAgICAgIGF3YWl0IEFjY291bnRzLl9jbGVhckFsbExvZ2luVG9rZW5zKHVzZXIuX2lkKTtcblxuICAgICAgICAgICAgaWYgKEFjY291bnRzLl9jaGVjazJmYUVuYWJsZWQ/Lih1c2VyKSkge1xuICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHVzZXJJZDogdXNlci5faWQsXG4gICAgICAgICAgICAgICAgZXJyb3I6IEFjY291bnRzLl9oYW5kbGVFcnJvcihcbiAgICAgICAgICAgICAgICAgICdDaGFuZ2VkIHBhc3N3b3JkLCBidXQgdXNlciBub3QgbG9nZ2VkIGluIGJlY2F1c2UgMkZBIGlzIGVuYWJsZWQnLFxuICAgICAgICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAgICAgICAnMmZhLWVuYWJsZWQnXG4gICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHVzZXJJZDogdXNlci5faWQgfTtcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG4gIH1cbik7XG5cbi8vL1xuLy8vIEVNQUlMIFZFUklGSUNBVElPTlxuLy8vXG5cblxuLy8gc2VuZCB0aGUgdXNlciBhbiBlbWFpbCB3aXRoIGEgbGluayB0aGF0IHdoZW4gb3BlbmVkIG1hcmtzIHRoYXRcbi8vIGFkZHJlc3MgYXMgdmVyaWZpZWRcblxuLyoqXG4gKiBAc3VtbWFyeSBTZW5kIGFuIGVtYWlsIGFzeW5jaHJvbm91c2x5IHdpdGggYSBsaW5rIHRoZSB1c2VyIGNhbiB1c2UgdmVyaWZ5IHRoZWlyIGVtYWlsIGFkZHJlc3MuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBpZCBvZiB0aGUgdXNlciB0byBzZW5kIGVtYWlsIHRvLlxuICogQHBhcmFtIHtTdHJpbmd9IFtlbWFpbF0gT3B0aW9uYWwuIFdoaWNoIGFkZHJlc3Mgb2YgdGhlIHVzZXIncyB0byBzZW5kIHRoZSBlbWFpbCB0by4gVGhpcyBhZGRyZXNzIG11c3QgYmUgaW4gdGhlIHVzZXIncyBgZW1haWxzYCBsaXN0LiBEZWZhdWx0cyB0byB0aGUgZmlyc3QgdW52ZXJpZmllZCBlbWFpbCBpbiB0aGUgbGlzdC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbZXh0cmFUb2tlbkRhdGFdIE9wdGlvbmFsIGFkZGl0aW9uYWwgZGF0YSB0byBiZSBhZGRlZCBpbnRvIHRoZSB0b2tlbiByZWNvcmQuXG4gKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhUGFyYW1zXSBPcHRpb25hbCBhZGRpdGlvbmFsIHBhcmFtcyB0byBiZSBhZGRlZCB0byB0aGUgdmVyaWZpY2F0aW9uIHVybC5cbiAqIEByZXR1cm5zIHtQcm9taXNlPE9iamVjdD59IFByb21pc2Ugb2YgYW4gb2JqZWN0IHdpdGgge2VtYWlsLCB1c2VyLCB0b2tlbiwgdXJsLCBvcHRpb25zfSB2YWx1ZXMuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICovXG5BY2NvdW50cy5zZW5kVmVyaWZpY2F0aW9uRW1haWwgPVxuICBhc3luYyAodXNlcklkLCBlbWFpbCwgZXh0cmFUb2tlbkRhdGEsIGV4dHJhUGFyYW1zKSA9PiB7XG4gICAgLy8gWFhYIEFsc28gZ2VuZXJhdGUgYSBsaW5rIHVzaW5nIHdoaWNoIHNvbWVvbmUgY2FuIGRlbGV0ZSB0aGlzXG4gICAgLy8gYWNjb3VudCBpZiB0aGV5IG93biBzYWlkIGFkZHJlc3MgYnV0IHdlcmVuJ3QgdGhvc2Ugd2hvIGNyZWF0ZWRcbiAgICAvLyB0aGlzIGFjY291bnQuXG5cbiAgICBjb25zdCB7IGVtYWlsOiByZWFsRW1haWwsIHVzZXIsIHRva2VuIH0gPVxuICAgICAgYXdhaXQgQWNjb3VudHMuZ2VuZXJhdGVWZXJpZmljYXRpb25Ub2tlbih1c2VySWQsIGVtYWlsLCBleHRyYVRva2VuRGF0YSk7XG4gICAgY29uc3QgdXJsID0gYXdhaXQgQWNjb3VudHMuX3Jlc29sdmVQcm9taXNlKEFjY291bnRzLnVybHMudmVyaWZ5RW1haWwodG9rZW4sIGV4dHJhUGFyYW1zKSk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGF3YWl0IEFjY291bnRzLmdlbmVyYXRlT3B0aW9uc0ZvckVtYWlsKHJlYWxFbWFpbCwgdXNlciwgdXJsLCAndmVyaWZ5RW1haWwnKTtcbiAgICBhd2FpdCBFbWFpbC5zZW5kQXN5bmMob3B0aW9ucyk7XG4gICAgaWYgKE1ldGVvci5pc0RldmVsb3BtZW50ICYmICFNZXRlb3IuaXNQYWNrYWdlVGVzdCkge1xuICAgICAgY29uc29sZS5sb2coYFxcblZlcmlmaWNhdGlvbiBlbWFpbCBVUkw6ICR7IHVybCB9YCk7XG4gICAgfVxuICAgIHJldHVybiB7IGVtYWlsOiByZWFsRW1haWwsIHVzZXIsIHRva2VuLCB1cmwsIG9wdGlvbnMgfTtcbiAgfTtcblxuLy8gVGFrZSB0b2tlbiBmcm9tIHNlbmRWZXJpZmljYXRpb25FbWFpbCwgbWFyayB0aGUgZW1haWwgYXMgdmVyaWZpZWQsXG4vLyBhbmQgbG9nIHRoZW0gaW4uXG5NZXRlb3IubWV0aG9kcyhcbiAge1xuICAgIHZlcmlmeUVtYWlsOiBhc3luYyBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgY29uc3QgdG9rZW4gPSBhcmdzWzBdO1xuICAgICAgcmV0dXJuIGF3YWl0IEFjY291bnRzLl9sb2dpbk1ldGhvZChcbiAgICAgICAgdGhpcyxcbiAgICAgICAgXCJ2ZXJpZnlFbWFpbFwiLFxuICAgICAgICBhcmdzLFxuICAgICAgICBcInBhc3N3b3JkXCIsXG4gICAgICAgIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjaGVjayh0b2tlbiwgU3RyaW5nKTtcblxuICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNZXRlb3IudXNlcnMuZmluZE9uZUFzeW5jKFxuICAgICAgICAgICAgeyAnc2VydmljZXMuZW1haWwudmVyaWZpY2F0aW9uVG9rZW5zLnRva2VuJzogdG9rZW4gfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgZmllbGRzOiB7XG4gICAgICAgICAgICAgICAgc2VydmljZXM6IDEsXG4gICAgICAgICAgICAgICAgZW1haWxzOiAxLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgKTtcbiAgICAgICAgICBpZiAoIXVzZXIpXG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJWZXJpZnkgZW1haWwgbGluayBleHBpcmVkXCIpO1xuXG4gICAgICAgICAgY29uc3QgdG9rZW5SZWNvcmQgPVxuICAgICAgICAgICAgYXdhaXQgdXNlclxuICAgICAgICAgICAgICAuc2VydmljZXMuZW1haWwudmVyaWZpY2F0aW9uVG9rZW5zLmZpbmQodCA9PiB0LnRva2VuID09IHRva2VuKTtcblxuICAgICAgICAgIGlmICghdG9rZW5SZWNvcmQpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICB1c2VySWQ6IHVzZXIuX2lkLFxuICAgICAgICAgICAgICBlcnJvcjogbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiVmVyaWZ5IGVtYWlsIGxpbmsgZXhwaXJlZFwiKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIGNvbnN0IGVtYWlsc1JlY29yZCA9XG4gICAgICAgICAgICB1c2VyLmVtYWlscy5maW5kKGUgPT4gZS5hZGRyZXNzID09IHRva2VuUmVjb3JkLmFkZHJlc3MpO1xuXG4gICAgICAgICAgaWYgKCFlbWFpbHNSZWNvcmQpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICB1c2VySWQ6IHVzZXIuX2lkLFxuICAgICAgICAgICAgICBlcnJvcjogbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiVmVyaWZ5IGVtYWlsIGxpbmsgaXMgZm9yIHVua25vd24gYWRkcmVzc1wiKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgIC8vIEJ5IGluY2x1ZGluZyB0aGUgYWRkcmVzcyBpbiB0aGUgcXVlcnksIHdlIGNhbiB1c2UgJ2VtYWlscy4kJyBpbiB0aGVcbiAgICAgICAgICAvLyBtb2RpZmllciB0byBnZXQgYSByZWZlcmVuY2UgdG8gdGhlIHNwZWNpZmljIG9iamVjdCBpbiB0aGUgZW1haWxzXG4gICAgICAgICAgLy8gYXJyYXkuIFNlZVxuICAgICAgICAgIC8vIGh0dHA6Ly93d3cubW9uZ29kYi5vcmcvZGlzcGxheS9ET0NTL1VwZGF0aW5nLyNVcGRhdGluZy1UaGUlMjRwb3NpdGlvbmFsb3BlcmF0b3IpXG4gICAgICAgICAgLy8gaHR0cDovL3d3dy5tb25nb2RiLm9yZy9kaXNwbGF5L0RPQ1MvVXBkYXRpbmcjVXBkYXRpbmctJTI0cHVsbFxuICAgICAgICAgIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyhcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgX2lkOiB1c2VyLl9pZCxcbiAgICAgICAgICAgICAgJ2VtYWlscy5hZGRyZXNzJzogdG9rZW5SZWNvcmQuYWRkcmVzc1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgJHNldDogeyAnZW1haWxzLiQudmVyaWZpZWQnOiB0cnVlIH0sXG4gICAgICAgICAgICAgICRwdWxsOiB7ICdzZXJ2aWNlcy5lbWFpbC52ZXJpZmljYXRpb25Ub2tlbnMnOiB7IGFkZHJlc3M6IHRva2VuUmVjb3JkLmFkZHJlc3MgfSB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChBY2NvdW50cy5fY2hlY2syZmFFbmFibGVkPy4odXNlcikpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICB1c2VySWQ6IHVzZXIuX2lkLFxuICAgICAgICAgIGVycm9yOiBBY2NvdW50cy5faGFuZGxlRXJyb3IoXG4gICAgICAgICAgICAnRW1haWwgdmVyaWZpZWQsIGJ1dCB1c2VyIG5vdCBsb2dnZWQgaW4gYmVjYXVzZSAyRkEgaXMgZW5hYmxlZCcsXG4gICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICcyZmEtZW5hYmxlZCdcbiAgICAgICAgICApLFxuICAgICAgICB9O1xuICAgICAgfXJldHVybiB7IHVzZXJJZDogdXNlci5faWQgfTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG4gIH0pO1xuXG5cbi8qKlxuICogQHN1bW1hcnkgQXN5bmNocm9ub3VzbHkgcmVwbGFjZSBhbiBlbWFpbCBhZGRyZXNzIGZvciBhIHVzZXIuIFVzZSB0aGlzIGluc3RlYWQgb2YgZGlyZWN0bHlcbiAqIHVwZGF0aW5nIHRoZSBkYXRhYmFzZS4gVGhlIG9wZXJhdGlvbiB3aWxsIGZhaWwgaWYgdGhlcmUgaXMgYSBkaWZmZXJlbnQgdXNlclxuICogd2l0aCBhbiBlbWFpbCBvbmx5IGRpZmZlcmluZyBpbiBjYXNlLiBJZiB0aGUgc3BlY2lmaWVkIHVzZXIgaGFzIGFuIGV4aXN0aW5nXG4gKiBlbWFpbCBvbmx5IGRpZmZlcmluZyBpbiBjYXNlIGhvd2V2ZXIsIHdlIHJlcGxhY2UgaXQuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBJRCBvZiB0aGUgdXNlciB0byB1cGRhdGUuXG4gKiBAcGFyYW0ge1N0cmluZ30gb2xkRW1haWwgVGhlIGVtYWlsIGFkZHJlc3MgdG8gcmVwbGFjZS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBuZXdFbWFpbCBUaGUgbmV3IGVtYWlsIGFkZHJlc3MgdG8gdXNlLlxuICogQHBhcmFtIHtCb29sZWFufSBbdmVyaWZpZWRdIE9wdGlvbmFsIC0gd2hldGhlciB0aGUgbmV3IGVtYWlsIGFkZHJlc3Mgc2hvdWxkXG4gKiBiZSBtYXJrZWQgYXMgdmVyaWZpZWQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAqL1xuQWNjb3VudHMucmVwbGFjZUVtYWlsQXN5bmMgPSBhc3luYyAodXNlcklkLCBvbGRFbWFpbCwgbmV3RW1haWwsIHZlcmlmaWVkKSA9PiB7XG4gIGNoZWNrKHVzZXJJZCwgTWF0Y2guTm9uRW1wdHlTdHJpbmcpO1xuICBjaGVjayhvbGRFbWFpbCwgTWF0Y2guTm9uRW1wdHlTdHJpbmcpO1xuICBjaGVjayhuZXdFbWFpbCwgTWF0Y2guTm9uRW1wdHlTdHJpbmcpO1xuICBjaGVjayh2ZXJpZmllZCwgTWF0Y2guT3B0aW9uYWwoQm9vbGVhbikpO1xuXG4gIGlmICh2ZXJpZmllZCA9PT0gdm9pZCAwKSB7XG4gICAgdmVyaWZpZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBnZXRVc2VyQnlJZCh1c2VySWQsIHsgZmllbGRzOiB7IF9pZDogMSB9IH0pO1xuICBpZiAoIXVzZXIpXG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiVXNlciBub3QgZm91bmRcIik7XG5cbiAgLy8gRW5zdXJlIG5vIHVzZXIgYWxyZWFkeSBoYXMgdGhpcyBuZXcgZW1haWxcbiAgYXdhaXQgQWNjb3VudHMuX2NoZWNrRm9yQ2FzZUluc2Vuc2l0aXZlRHVwbGljYXRlcyhcbiAgICBcImVtYWlscy5hZGRyZXNzXCIsXG4gICAgXCJFbWFpbFwiLFxuICAgIG5ld0VtYWlsLFxuICAgIHVzZXIuX2lkXG4gICk7XG5cbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgTWV0ZW9yLnVzZXJzLnVwZGF0ZUFzeW5jKFxuICAgIHsgX2lkOiB1c2VyLl9pZCwgJ2VtYWlscy5hZGRyZXNzJzogb2xkRW1haWwgfSxcbiAgICB7ICRzZXQ6IHsgJ2VtYWlscy4kLmFkZHJlc3MnOiBuZXdFbWFpbCwgJ2VtYWlscy4kLnZlcmlmaWVkJzogdmVyaWZpZWQgfSB9XG4gICk7XG4gIFxuICBpZiAocmVzdWx0Lm1vZGlmaWVkQ291bnQgPT09IDApIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgXCJObyB1c2VyIGNvdWxkIGJlIGZvdW5kIHdpdGggb2xkIGVtYWlsXCIpO1xuICB9XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IGFkZCBhbiBlbWFpbCBhZGRyZXNzIGZvciBhIHVzZXIuIFVzZSB0aGlzIGluc3RlYWQgb2YgZGlyZWN0bHlcbiAqIHVwZGF0aW5nIHRoZSBkYXRhYmFzZS4gVGhlIG9wZXJhdGlvbiB3aWxsIGZhaWwgaWYgdGhlcmUgaXMgYSBkaWZmZXJlbnQgdXNlclxuICogd2l0aCBhbiBlbWFpbCBvbmx5IGRpZmZlcmluZyBpbiBjYXNlLiBJZiB0aGUgc3BlY2lmaWVkIHVzZXIgaGFzIGFuIGV4aXN0aW5nXG4gKiBlbWFpbCBvbmx5IGRpZmZlcmluZyBpbiBjYXNlIGhvd2V2ZXIsIHdlIHJlcGxhY2UgaXQuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBJRCBvZiB0aGUgdXNlciB0byB1cGRhdGUuXG4gKiBAcGFyYW0ge1N0cmluZ30gbmV3RW1haWwgQSBuZXcgZW1haWwgYWRkcmVzcyBmb3IgdGhlIHVzZXIuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFt2ZXJpZmllZF0gT3B0aW9uYWwgLSB3aGV0aGVyIHRoZSBuZXcgZW1haWwgYWRkcmVzcyBzaG91bGRcbiAqIGJlIG1hcmtlZCBhcyB2ZXJpZmllZC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgYWNjb3VudHMtYmFzZVxuICovXG5BY2NvdW50cy5hZGRFbWFpbEFzeW5jID0gYXN5bmMgKHVzZXJJZCwgbmV3RW1haWwsIHZlcmlmaWVkKSA9PiB7XG4gIGNoZWNrKHVzZXJJZCwgTWF0Y2guTm9uRW1wdHlTdHJpbmcpO1xuICBjaGVjayhuZXdFbWFpbCwgTWF0Y2guTm9uRW1wdHlTdHJpbmcpO1xuICBjaGVjayh2ZXJpZmllZCwgTWF0Y2guT3B0aW9uYWwoQm9vbGVhbikpO1xuXG4gIGlmICh2ZXJpZmllZCA9PT0gdm9pZCAwKSB7XG4gICAgdmVyaWZpZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHVzZXIgPSBhd2FpdCBnZXRVc2VyQnlJZCh1c2VySWQsIHsgZmllbGRzOiB7IGVtYWlsczogMSB9IH0pO1xuICBpZiAoIXVzZXIpIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlVzZXIgbm90IGZvdW5kXCIpO1xuXG4gIC8vIEFsbG93IHVzZXJzIHRvIGNoYW5nZSB0aGVpciBvd24gZW1haWwgdG8gYSB2ZXJzaW9uIHdpdGggYSBkaWZmZXJlbnQgY2FzZVxuXG4gIC8vIFdlIGRvbid0IGhhdmUgdG8gY2FsbCBjaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMgdG8gZG8gYSBjYXNlXG4gIC8vIGluc2Vuc2l0aXZlIGNoZWNrIGFjcm9zcyBhbGwgZW1haWxzIGluIHRoZSBkYXRhYmFzZSBoZXJlIGJlY2F1c2U6ICgxKSBpZlxuICAvLyB0aGVyZSBpcyBubyBjYXNlLWluc2Vuc2l0aXZlIGR1cGxpY2F0ZSBiZXR3ZWVuIHRoaXMgdXNlciBhbmQgb3RoZXIgdXNlcnMsXG4gIC8vIHRoZW4gd2UgYXJlIE9LIGFuZCAoMikgaWYgdGhpcyB3b3VsZCBjcmVhdGUgYSBjb25mbGljdCB3aXRoIG90aGVyIHVzZXJzXG4gIC8vIHRoZW4gdGhlcmUgd291bGQgYWxyZWFkeSBiZSBhIGNhc2UtaW5zZW5zaXRpdmUgZHVwbGljYXRlIGFuZCB3ZSBjYW4ndCBmaXhcbiAgLy8gdGhhdCBpbiB0aGlzIGNvZGUgYW55d2F5LlxuICBjb25zdCBjYXNlSW5zZW5zaXRpdmVSZWdFeHAgPSBuZXcgUmVnRXhwKFxuICAgIGBeJHtNZXRlb3IuX2VzY2FwZVJlZ0V4cChuZXdFbWFpbCl9JGAsXG4gICAgXCJpXCJcbiAgKTtcblxuICAvLyBUT0RPOiBUaGlzIGlzIGEgbGluZWFyIHNlYXJjaC4gSWYgd2UgaGF2ZSBhIGxvdCBvZiBlbWFpbHMuXG4gIC8vICB3ZSBzaG91bGQgY29uc2lkZXIgdXNpbmcgYSBkaWZmZXJlbnQgZGF0YSBzdHJ1Y3R1cmUuXG4gIGNvbnN0IHVwZGF0ZWRFbWFpbCA9IGFzeW5jIChlbWFpbHMgPSBbXSwgX2lkKSA9PiB7XG4gICAgbGV0IHVwZGF0ZWQgPSBmYWxzZTtcbiAgICBmb3IgKGNvbnN0IGVtYWlsIG9mIGVtYWlscykge1xuICAgICAgaWYgKGNhc2VJbnNlbnNpdGl2ZVJlZ0V4cC50ZXN0KGVtYWlsLmFkZHJlc3MpKSB7XG4gICAgICAgIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyhcbiAgICAgICAgICB7XG4gICAgICAgICAgICBfaWQ6IF9pZCxcbiAgICAgICAgICAgIFwiZW1haWxzLmFkZHJlc3NcIjogZW1haWwuYWRkcmVzcyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgICRzZXQ6IHtcbiAgICAgICAgICAgICAgXCJlbWFpbHMuJC5hZGRyZXNzXCI6IG5ld0VtYWlsLFxuICAgICAgICAgICAgICBcImVtYWlscy4kLnZlcmlmaWVkXCI6IHZlcmlmaWVkLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIHVwZGF0ZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdXBkYXRlZDtcbiAgfTtcbiAgY29uc3QgZGlkVXBkYXRlT3duRW1haWwgPSBhd2FpdCB1cGRhdGVkRW1haWwodXNlci5lbWFpbHMsIHVzZXIuX2lkKTtcblxuICAvLyBJbiB0aGUgb3RoZXIgdXBkYXRlcyBiZWxvdywgd2UgaGF2ZSB0byBkbyBhbm90aGVyIGNhbGwgdG9cbiAgLy8gY2hlY2tGb3JDYXNlSW5zZW5zaXRpdmVEdXBsaWNhdGVzIHRvIG1ha2Ugc3VyZSB0aGF0IG5vIGNvbmZsaWN0aW5nIHZhbHVlc1xuICAvLyB3ZXJlIGFkZGVkIHRvIHRoZSBkYXRhYmFzZSBpbiB0aGUgbWVhbnRpbWUuIFdlIGRvbid0IGhhdmUgdG8gZG8gdGhpcyBmb3JcbiAgLy8gdGhlIGNhc2Ugd2hlcmUgdGhlIHVzZXIgaXMgdXBkYXRpbmcgdGhlaXIgZW1haWwgYWRkcmVzcyB0byBvbmUgdGhhdCBpcyB0aGVcbiAgLy8gc2FtZSBhcyBiZWZvcmUsIGJ1dCBvbmx5IGRpZmZlcmVudCBiZWNhdXNlIG9mIGNhcGl0YWxpemF0aW9uLiBSZWFkIHRoZVxuICAvLyBiaWcgY29tbWVudCBhYm92ZSB0byB1bmRlcnN0YW5kIHdoeS5cblxuICBpZiAoZGlkVXBkYXRlT3duRW1haWwpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBQZXJmb3JtIGEgY2FzZSBpbnNlbnNpdGl2ZSBjaGVjayBmb3IgZHVwbGljYXRlcyBiZWZvcmUgdXBkYXRlXG4gIGF3YWl0IEFjY291bnRzLl9jaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMoXG4gICAgXCJlbWFpbHMuYWRkcmVzc1wiLFxuICAgIFwiRW1haWxcIixcbiAgICBuZXdFbWFpbCxcbiAgICB1c2VyLl9pZFxuICApO1xuXG4gIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyhcbiAgICB7XG4gICAgICBfaWQ6IHVzZXIuX2lkLFxuICAgIH0sXG4gICAge1xuICAgICAgJGFkZFRvU2V0OiB7XG4gICAgICAgIGVtYWlsczoge1xuICAgICAgICAgIGFkZHJlc3M6IG5ld0VtYWlsLFxuICAgICAgICAgIHZlcmlmaWVkOiB2ZXJpZmllZCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfVxuICApO1xuXG4gIC8vIFBlcmZvcm0gYW5vdGhlciBjaGVjayBhZnRlciB1cGRhdGUsIGluIGNhc2UgYSBtYXRjaGluZyB1c2VyIGhhcyBiZWVuXG4gIC8vIGluc2VydGVkIGluIHRoZSBtZWFudGltZVxuICB0cnkge1xuICAgIGF3YWl0IEFjY291bnRzLl9jaGVja0ZvckNhc2VJbnNlbnNpdGl2ZUR1cGxpY2F0ZXMoXG4gICAgICBcImVtYWlscy5hZGRyZXNzXCIsXG4gICAgICBcIkVtYWlsXCIsXG4gICAgICBuZXdFbWFpbCxcbiAgICAgIHVzZXIuX2lkXG4gICAgKTtcbiAgfSBjYXRjaCAoZXgpIHtcbiAgICAvLyBVbmRvIHVwZGF0ZSBpZiB0aGUgY2hlY2sgZmFpbHNcbiAgICBhd2FpdCBNZXRlb3IudXNlcnMudXBkYXRlQXN5bmMoXG4gICAgICB7IF9pZDogdXNlci5faWQgfSxcbiAgICAgIHsgJHB1bGw6IHsgZW1haWxzOiB7IGFkZHJlc3M6IG5ld0VtYWlsIH0gfSB9XG4gICAgKTtcbiAgICB0aHJvdyBleDtcbiAgfVxufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZW1vdmUgYW4gZW1haWwgYWRkcmVzcyBhc3luY2hyb25vdXNseSBmb3IgYSB1c2VyLiBVc2UgdGhpcyBpbnN0ZWFkIG9mIHVwZGF0aW5nXG4gKiB0aGUgZGF0YWJhc2UgZGlyZWN0bHkuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge1N0cmluZ30gdXNlcklkIFRoZSBJRCBvZiB0aGUgdXNlciB0byB1cGRhdGUuXG4gKiBAcGFyYW0ge1N0cmluZ30gZW1haWwgVGhlIGVtYWlsIGFkZHJlc3MgdG8gcmVtb3ZlLlxuICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAqL1xuQWNjb3VudHMucmVtb3ZlRW1haWwgPVxuICBhc3luYyAodXNlcklkLCBlbWFpbCkgPT4ge1xuICAgIGNoZWNrKHVzZXJJZCwgTWF0Y2guTm9uRW1wdHlTdHJpbmcpO1xuICAgIGNoZWNrKGVtYWlsLCBNYXRjaC5Ob25FbXB0eVN0cmluZyk7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgZ2V0VXNlckJ5SWQodXNlcklkLCB7IGZpZWxkczogeyBfaWQ6IDEgfSB9KTtcbiAgICBpZiAoIXVzZXIpXG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJVc2VyIG5vdCBmb3VuZFwiKTtcblxuICAgIGF3YWl0IE1ldGVvci51c2Vycy51cGRhdGVBc3luYyh7IF9pZDogdXNlci5faWQgfSxcbiAgICAgIHsgJHB1bGw6IHsgZW1haWxzOiB7IGFkZHJlc3M6IGVtYWlsIH0gfSB9KTtcbiAgfVxuXG4vLy9cbi8vLyBDUkVBVElORyBVU0VSU1xuLy8vXG5cbi8vIFNoYXJlZCBjcmVhdGVVc2VyIGZ1bmN0aW9uIGNhbGxlZCBmcm9tIHRoZSBjcmVhdGVVc2VyIG1ldGhvZCwgYm90aFxuLy8gaWYgb3JpZ2luYXRlcyBpbiBjbGllbnQgb3Igc2VydmVyIGNvZGUuIENhbGxzIHVzZXIgcHJvdmlkZWQgaG9va3MsXG4vLyBkb2VzIHRoZSBhY3R1YWwgdXNlciBpbnNlcnRpb24uXG4vL1xuLy8gcmV0dXJucyB0aGUgdXNlciBpZFxuY29uc3QgY3JlYXRlVXNlciA9XG4gIGFzeW5jIG9wdGlvbnMgPT4ge1xuICAgIC8vIFVua25vd24ga2V5cyBhbGxvd2VkLCBiZWNhdXNlIGEgb25DcmVhdGVVc2VySG9vayBjYW4gdGFrZSBhcmJpdHJhcnlcbiAgICAvLyBvcHRpb25zLlxuICAgIGNoZWNrKG9wdGlvbnMsIE1hdGNoLk9iamVjdEluY2x1ZGluZyh7XG4gICAgICB1c2VybmFtZTogTWF0Y2guT3B0aW9uYWwoU3RyaW5nKSxcbiAgICAgIGVtYWlsOiBNYXRjaC5PcHRpb25hbChTdHJpbmcpLFxuICAgICAgcGFzc3dvcmQ6IE1hdGNoLk9wdGlvbmFsKHBhc3N3b3JkVmFsaWRhdG9yKVxuICAgIH0pKTtcblxuICAgIGNvbnN0IHsgdXNlcm5hbWUsIGVtYWlsLCBwYXNzd29yZCB9ID0gb3B0aW9ucztcbiAgICBpZiAoIXVzZXJuYW1lICYmICFlbWFpbClcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAwLCBcIk5lZWQgdG8gc2V0IGEgdXNlcm5hbWUgb3IgZW1haWxcIik7XG5cbiAgICBjb25zdCB1c2VyID0geyBzZXJ2aWNlczoge30gfTtcbiAgICBpZiAocGFzc3dvcmQpIHtcbiAgICAgIGNvbnN0IGhhc2hlZCA9IGF3YWl0IGhhc2hQYXNzd29yZChwYXNzd29yZCk7XG4gICAgICBjb25zdCBhcmdvbjJFbmFibGVkID0gQWNjb3VudHMuX2FyZ29uMkVuYWJsZWQoKTtcbiAgICAgIGlmIChhcmdvbjJFbmFibGVkID09PSBmYWxzZSkge1xuICAgICAgICB1c2VyLnNlcnZpY2VzLnBhc3N3b3JkID0geyBiY3J5cHQ6IGhhc2hlZCB9O1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHVzZXIuc2VydmljZXMucGFzc3dvcmQgPSB7IGFyZ29uMjogaGFzaGVkIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGF3YWl0IEFjY291bnRzLl9jcmVhdGVVc2VyQ2hlY2tpbmdEdXBsaWNhdGVzKHsgdXNlciwgZW1haWwsIHVzZXJuYW1lLCBvcHRpb25zIH0pO1xuICB9O1xuXG4vLyBtZXRob2QgZm9yIGNyZWF0ZSB1c2VyLiBSZXF1ZXN0cyBjb21lIGZyb20gdGhlIGNsaWVudC5cbk1ldGVvci5tZXRob2RzKFxuICB7XG4gICAgY3JlYXRlVXNlcjogYXN5bmMgZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzWzBdO1xuICAgICAgcmV0dXJuIGF3YWl0IEFjY291bnRzLl9sb2dpbk1ldGhvZChcbiAgICAgICAgdGhpcyxcbiAgICAgICAgXCJjcmVhdGVVc2VyXCIsXG4gICAgICAgIGFyZ3MsXG4gICAgICAgIFwicGFzc3dvcmRcIixcbiAgICAgICAgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIC8vIGNyZWF0ZVVzZXIoKSBhYm92ZSBkb2VzIG1vcmUgY2hlY2tpbmcuXG4gICAgICAgICAgY2hlY2sob3B0aW9ucywgT2JqZWN0KTtcbiAgICAgICAgICBpZiAoQWNjb3VudHMuX29wdGlvbnMuZm9yYmlkQ2xpZW50QWNjb3VudENyZWF0aW9uKVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIlNpZ251cHMgZm9yYmlkZGVuXCIpXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgY29uc3QgdXNlcklkID0gYXdhaXQgQWNjb3VudHMuY3JlYXRlVXNlclZlcmlmeWluZ0VtYWlsKG9wdGlvbnMpO1xuXG4gICAgICAgICAgLy8gY2xpZW50IGdldHMgbG9nZ2VkIGluIGFzIHRoZSBuZXcgdXNlciBhZnRlcndhcmRzLlxuICAgICAgICAgIHJldHVybiB7IHVzZXJJZDogdXNlcklkIH07XG4gICAgICAgIH1cbiAgICAgICk7XG4gICAgfVxuICB9KTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDcmVhdGVzIGFuIHVzZXIgYXN5bmNocm9ub3VzbHkgYW5kIHNlbmRzIGFuIGVtYWlsIGlmIGBvcHRpb25zLmVtYWlsYCBpcyBpbmZvcm1lZC5cbiAqIFRoZW4gaWYgdGhlIGBzZW5kVmVyaWZpY2F0aW9uRW1haWxgIG9wdGlvbiBmcm9tIHRoZSBgQWNjb3VudHNgIHBhY2thZ2UgaXNcbiAqIGVuYWJsZWQsIHlvdSdsbCBzZW5kIGEgdmVyaWZpY2F0aW9uIGVtYWlsIGlmIGBvcHRpb25zLnBhc3N3b3JkYCBpcyBpbmZvcm1lZCxcbiAqIG90aGVyd2lzZSB5b3UnbGwgc2VuZCBhbiBlbnJvbGxtZW50IGVtYWlsLlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMgVGhlIG9wdGlvbnMgb2JqZWN0IHRvIGJlIHBhc3NlZCBkb3duIHdoZW4gY3JlYXRpbmdcbiAqIHRoZSB1c2VyXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy51c2VybmFtZSBBIHVuaXF1ZSBuYW1lIGZvciB0aGlzIHVzZXIuXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5lbWFpbCBUaGUgdXNlcidzIGVtYWlsIGFkZHJlc3MuXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5wYXNzd29yZCBUaGUgdXNlcidzIHBhc3N3b3JkLiBUaGlzIGlzIF9fbm90X18gc2VudCBpbiBwbGFpbiB0ZXh0IG92ZXIgdGhlIHdpcmUuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5wcm9maWxlIFRoZSB1c2VyJ3MgcHJvZmlsZSwgdHlwaWNhbGx5IGluY2x1ZGluZyB0aGUgYG5hbWVgIGZpZWxkLlxuICogQGltcG9ydEZyb21QYWNrYWdlIGFjY291bnRzLWJhc2VcbiAqICovXG5BY2NvdW50cy5jcmVhdGVVc2VyVmVyaWZ5aW5nRW1haWwgPVxuICBhc3luYyAob3B0aW9ucykgPT4ge1xuICAgIG9wdGlvbnMgPSB7IC4uLm9wdGlvbnMgfTtcbiAgICAvLyBDcmVhdGUgdXNlci4gcmVzdWx0IGNvbnRhaW5zIGlkIGFuZCB0b2tlbi5cbiAgICBjb25zdCB1c2VySWQgPSBhd2FpdCBjcmVhdGVVc2VyKG9wdGlvbnMpO1xuICAgIC8vIHNhZmV0eSBiZWx0LiBjcmVhdGVVc2VyIGlzIHN1cHBvc2VkIHRvIHRocm93IG9uIGVycm9yLiBzZW5kIDUwMCBlcnJvclxuICAgIC8vIGluc3RlYWQgb2Ygc2VuZGluZyBhIHZlcmlmaWNhdGlvbiBlbWFpbCB3aXRoIGVtcHR5IHVzZXJpZC5cbiAgICBpZiAoIXVzZXJJZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImNyZWF0ZVVzZXIgZmFpbGVkIHRvIGluc2VydCBuZXcgdXNlclwiKTtcblxuICAgIC8vIElmIGBBY2NvdW50cy5fb3B0aW9ucy5zZW5kVmVyaWZpY2F0aW9uRW1haWxgIGlzIHNldCwgcmVnaXN0ZXJcbiAgICAvLyBhIHRva2VuIHRvIHZlcmlmeSB0aGUgdXNlcidzIHByaW1hcnkgZW1haWwsIGFuZCBzZW5kIGl0IHRvXG4gICAgLy8gdGhhdCBhZGRyZXNzLlxuICAgIGlmIChvcHRpb25zLmVtYWlsICYmIEFjY291bnRzLl9vcHRpb25zLnNlbmRWZXJpZmljYXRpb25FbWFpbCkge1xuICAgICAgaWYgKG9wdGlvbnMucGFzc3dvcmQpIHtcbiAgICAgICAgYXdhaXQgQWNjb3VudHMuc2VuZFZlcmlmaWNhdGlvbkVtYWlsKHVzZXJJZCwgb3B0aW9ucy5lbWFpbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBBY2NvdW50cy5zZW5kRW5yb2xsbWVudEVtYWlsKHVzZXJJZCwgb3B0aW9ucy5lbWFpbCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHVzZXJJZDtcbiAgfTtcblxuLy8gQ3JlYXRlIHVzZXIgZGlyZWN0bHkgb24gdGhlIHNlcnZlci5cbi8vXG4vLyBVbmxpa2UgdGhlIGNsaWVudCB2ZXJzaW9uLCB0aGlzIGRvZXMgbm90IGxvZyB5b3UgaW4gYXMgdGhpcyB1c2VyXG4vLyBhZnRlciBjcmVhdGlvbi5cbi8vXG4vLyByZXR1cm5zIFByb21pc2U8dXNlcklkPiBvciB0aHJvd3MgYW4gZXJyb3IgaWYgaXQgY2FuJ3QgY3JlYXRlXG4vL1xuLy8gWFhYIGFkZCBhbm90aGVyIGFyZ3VtZW50IChcInNlcnZlciBvcHRpb25zXCIpIHRoYXQgZ2V0cyBzZW50IHRvIG9uQ3JlYXRlVXNlcixcbi8vIHdoaWNoIGlzIGFsd2F5cyBlbXB0eSB3aGVuIGNhbGxlZCBmcm9tIHRoZSBjcmVhdGVVc2VyIG1ldGhvZD8gZWcsIFwiYWRtaW46XG4vLyB0cnVlXCIsIHdoaWNoIHdlIHdhbnQgdG8gcHJldmVudCB0aGUgY2xpZW50IGZyb20gc2V0dGluZywgYnV0IHdoaWNoIGEgY3VzdG9tXG4vLyBtZXRob2QgY2FsbGluZyBBY2NvdW50cy5jcmVhdGVVc2VyIGNvdWxkIHNldD9cbi8vXG5cbkFjY291bnRzLmNyZWF0ZVVzZXJBc3luYyA9IGNyZWF0ZVVzZXJcblxuLy8gQ3JlYXRlIHVzZXIgZGlyZWN0bHkgb24gdGhlIHNlcnZlci5cbi8vXG4vLyBVbmxpa2UgdGhlIGNsaWVudCB2ZXJzaW9uLCB0aGlzIGRvZXMgbm90IGxvZyB5b3UgaW4gYXMgdGhpcyB1c2VyXG4vLyBhZnRlciBjcmVhdGlvbi5cbi8vXG4vLyByZXR1cm5zIHVzZXJJZCBvciB0aHJvd3MgYW4gZXJyb3IgaWYgaXQgY2FuJ3QgY3JlYXRlXG4vL1xuLy8gWFhYIGFkZCBhbm90aGVyIGFyZ3VtZW50IChcInNlcnZlciBvcHRpb25zXCIpIHRoYXQgZ2V0cyBzZW50IHRvIG9uQ3JlYXRlVXNlcixcbi8vIHdoaWNoIGlzIGFsd2F5cyBlbXB0eSB3aGVuIGNhbGxlZCBmcm9tIHRoZSBjcmVhdGVVc2VyIG1ldGhvZD8gZWcsIFwiYWRtaW46XG4vLyB0cnVlXCIsIHdoaWNoIHdlIHdhbnQgdG8gcHJldmVudCB0aGUgY2xpZW50IGZyb20gc2V0dGluZywgYnV0IHdoaWNoIGEgY3VzdG9tXG4vLyBtZXRob2QgY2FsbGluZyBBY2NvdW50cy5jcmVhdGVVc2VyIGNvdWxkIHNldD9cbi8vXG5cbkFjY291bnRzLmNyZWF0ZVVzZXIgPSBBY2NvdW50cy5jcmVhdGVVc2VyQXN5bmM7XG5cbi8vL1xuLy8vIFBBU1NXT1JELVNQRUNJRklDIElOREVYRVMgT04gVVNFUlNcbi8vL1xuYXdhaXQgTWV0ZW9yLnVzZXJzLmNyZWF0ZUluZGV4QXN5bmMoJ3NlcnZpY2VzLmVtYWlsLnZlcmlmaWNhdGlvblRva2Vucy50b2tlbicsXG4gIHsgdW5pcXVlOiB0cnVlLCBzcGFyc2U6IHRydWUgfSk7XG5hd2FpdCBNZXRlb3IudXNlcnMuY3JlYXRlSW5kZXhBc3luYygnc2VydmljZXMucGFzc3dvcmQucmVzZXQudG9rZW4nLFxuICB7IHVuaXF1ZTogdHJ1ZSwgc3BhcnNlOiB0cnVlIH0pO1xuYXdhaXQgTWV0ZW9yLnVzZXJzLmNyZWF0ZUluZGV4QXN5bmMoJ3NlcnZpY2VzLnBhc3N3b3JkLmVucm9sbC50b2tlbicsXG4gIHsgdW5pcXVlOiB0cnVlLCBzcGFyc2U6IHRydWUgfSk7XG4iXX0=
