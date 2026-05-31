Package["core-runtime"].queue("callback-hook",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Hook;

var require = meteorInstall({"node_modules":{"meteor":{"callback-hook":{"hook.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/callback-hook/hook.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  Hook: () => Hook
});
class Hook {
  /**
   * Creates a new Hook instance.
   * @param {object} [options={}] - Configuration options for the hook.
   * @param {boolean} [options.bindEnvironment=true] - Whether to automatically wrap registered callbacks with `Meteor.bindEnvironment`.
   *   If `true`, callbacks will run in the Meteor environment of the code that registered them.
   * @param {boolean} [options.wrapAsync=true] - Whether to automatically wrap registered callbacks with `Meteor.wrapFn`.
   *   If `true`, callbacks will be prepared to run asynchronously.
   * @param {Function} [options.exceptionHandler] - A custom function to handle exceptions thrown by registered callbacks.
   *   This function will be called with the exception as its argument.
   *   If provided, `options.debugPrintExceptions` will be ignored.
   * @param {string} [options.debugPrintExceptions] - If an `exceptionHandler` is not provided, and this option is a string,
   *   exceptions thrown by callbacks will be logged to `Meteor._debug` with this string as a description.
   */
  constructor() {
    let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    this.callbacks = new Set();

    // Whether to wrap callbacks with Meteor.bindEnvironment
    const {
      bindEnvironment = true,
      wrapAsync = true
    } = options;
    this.bindEnvironment = !!bindEnvironment;
    this.wrapAsync = !!wrapAsync;
    if (options.exceptionHandler) {
      this.exceptionHandler = options.exceptionHandler;
    } else if (options.debugPrintExceptions) {
      if (typeof options.debugPrintExceptions !== "string") {
        throw new Error("Hook option debugPrintExceptions should be a string");
      }
      this.exceptionHandler = options.debugPrintExceptions;
    }
  }

  /**
   * Clears all registered callbacks from this Hook instance.
   * After calling this method, the hook will have no callbacks registered.
   */
  clear() {
    this.callbacks.clear();
  }

  /**
   * Returns the number of callbacks currently registered with this Hook instance.
   * @returns {number} The number of registered callbacks.
   */
  size() {
    return this.callbacks.size;
  }

  /**
   * Returns all registered callbacks as a new Array.
   * This provides a snapshot of the current callbacks.
   * @returns {Array<Function>} An array containing all registered callback functions.
   */
  asArray() {
    return Array.from(this.callbacks);
  }

  /**
   * Replaces the current set of registered callbacks with a new set derived from the given array.
   *
   * @param {Array<Function>} arr An array of callback functions to register with this hook.
   * @throws {Error} If the provided argument `arr` is not an array.
   */
  fromArray(arr) {
    if (!Array.isArray(arr)) {
      throw new Error("Method fromArray expects an array");
    }
    this.callbacks = new Set(arr);
  }

  /**
   * Registers a new callback with this Hook instance.
   *
   * @param {Function} callback The function to register. This function will be called when the hook is iterated over.
   * @returns {{callback: Function, stop: Function}} An object containing:
   *   - `callback`: The actual callback function that was added to the hook's internal set (after any wrapping).
   *   - `stop`: A function that, when called, unregisters this specific callback from the hook.
   */
  register(callback) {
    const exceptionHandler = this.exceptionHandler || function (exception) {
      // Note: this relies on the undocumented fact that if bindEnvironment's
      // onException throws, and you are invoking the callback either in the
      // browser or from within a Fiber in Node, the exception is propagated.
      throw exception;
    };
    if (this.bindEnvironment) {
      callback = Meteor.bindEnvironment(callback, exceptionHandler);
    } else {
      callback = wrapHookWithErrorHandling(callback, exceptionHandler);
    }
    if (this.wrapAsync) {
      callback = Meteor.wrapFn(callback);
    }
    this.callbacks.add(callback);
    return {
      callback,
      stop: () => {
        this.callbacks.delete(callback);
      }
    };
  }

  /**
   * For each registered callback, call the passed iterator function with the callback.
   *
   * The iterator function can choose whether or not to call the
   * callback.  (For example, it might not call the callback if the
   * observed object has been closed or terminated).
   * The iteration is stopped if the iterator function returns a falsy
   * value or throws an exception.
   *
   * @param iterator
   */
  forEach(iterator) {
    for (const callback of this.callbacks) {
      if (!iterator(callback)) break;
    }
  }

  /**
   * For each registered callback, call the passed iterator function with the callback.
   *
   * it is a counterpart of forEach, but it is async and returns a promise
   * @param iterator
   * @return {Promise<void>}
   * @see forEach
   */
  async forEachAsync(iterator) {
    for (const callback of this.callbacks) {
      if (!(await iterator(callback))) break;
    }
  }

  /**
   * @deprecated use forEach
   * @param iterator
   */
  each(iterator) {
    return this.forEach(iterator);
  }

  /**
   * Makes the Hook instance iterable, allowing it to be used in `for...of` loops.
   * It iterates over the registered callbacks.
   * @returns {Iterator<Function>} An iterator for the registered callbacks.
   */
  [Symbol.iterator]() {
    return this.callbacks[Symbol.iterator]();
  }
}
/**
 * Wraps a given function with error handling. If the wrapped function throws an exception,
 * it will be caught and passed to the provided exception handler.
 * This is similar to `Meteor.bindEnvironment` but without the Meteor environment binding.
 *
 * @param {Function} func The function to wrap.
 * @param {Function|string} onException The exception handler function to call if `func` throws,
 *   or a string description for default exception logging.
 * @param {any} _this The `this` context to bind to `func` when it is called.
 * @returns {Function} A new function that executes `func` with error handling.
 */
function wrapHookWithErrorHandling(func, onException, _this) {
  const exceptionHandler = normalizeHookExceptionHandler(onException);
  return function executeHookWithErrorHandling() {
    let ret;
    try {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      ret = func.apply(_this, args);
    } catch (e) {
      exceptionHandler(e);
    }
    return ret;
  };
}

/**
 * Normalizes an exception handler, ensuring it is a function.
 * If a function is provided, it is returned directly.
 * If a string is provided, it is used as a description for a default handler that logs exceptions.
 * Otherwise, a generic default handler that logs exceptions with a default description is returned.
 *
 * @param {Function|string} exceptionHandler The exception handler to normalize. Can be a function,
 *   a string description for logging, or any other value (which defaults to generic logging).
 * @returns {Function} A function that handles exceptions.
 */
function normalizeHookExceptionHandler(exceptionHandler) {
  if (typeof exceptionHandler === 'function') {
    return exceptionHandler;
  }
  const description = typeof exceptionHandler === 'string' ? exceptionHandler : "callback of async function";
  return function defaultHookExceptionHandler(error) {
    Meteor._debug("Exception in ".concat(description), error);
  };
}
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
      Hook: Hook
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/callback-hook/hook.js"
  ],
  mainModulePath: "/node_modules/meteor/callback-hook/hook.js"
}});

//# sourceURL=meteor://💻app/packages/callback-hook.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2FsbGJhY2staG9vay9ob29rLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkhvb2siLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJjYWxsYmFja3MiLCJTZXQiLCJiaW5kRW52aXJvbm1lbnQiLCJ3cmFwQXN5bmMiLCJleGNlcHRpb25IYW5kbGVyIiwiZGVidWdQcmludEV4Y2VwdGlvbnMiLCJFcnJvciIsImNsZWFyIiwic2l6ZSIsImFzQXJyYXkiLCJBcnJheSIsImZyb20iLCJmcm9tQXJyYXkiLCJhcnIiLCJpc0FycmF5IiwicmVnaXN0ZXIiLCJjYWxsYmFjayIsImV4Y2VwdGlvbiIsIk1ldGVvciIsIndyYXBIb29rV2l0aEVycm9ySGFuZGxpbmciLCJ3cmFwRm4iLCJhZGQiLCJzdG9wIiwiZGVsZXRlIiwiZm9yRWFjaCIsIml0ZXJhdG9yIiwiZm9yRWFjaEFzeW5jIiwiZWFjaCIsIlN5bWJvbCIsImZ1bmMiLCJvbkV4Y2VwdGlvbiIsIl90aGlzIiwibm9ybWFsaXplSG9va0V4Y2VwdGlvbkhhbmRsZXIiLCJleGVjdXRlSG9va1dpdGhFcnJvckhhbmRsaW5nIiwicmV0IiwiX2xlbiIsImFyZ3MiLCJfa2V5IiwiYXBwbHkiLCJlIiwiZGVzY3JpcHRpb24iLCJkZWZhdWx0SG9va0V4Y2VwdGlvbkhhbmRsZXIiLCJlcnJvciIsIl9kZWJ1ZyIsImNvbmNhdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7RUFBQ0MsSUFBSSxFQUFDQSxDQUFBLEtBQUlBO0FBQUksQ0FBQyxDQUFDO0FBc0N2QixNQUFNQSxJQUFJLENBQUM7RUFDaEI7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQSxFQUFl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Q0FBQ1MsS0FBSyxDQUFDUCxLQUFLLEVBQUVLLElBQUksQ0FBQztJQUMvQixDQUFDLENBQUMsT0FBT0csQ0FBQyxFQUFFO01BQ1ZuQyxnQkFBZ0IsQ0FBQ21DLENBQUMsQ0FBQztJQUNyQjtJQUNBLE9BQU9MLEdBQUc7RUFDWixDQUFDO0FBQ0g7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTRiw2QkFBNkJBLENBQUM1QixnQkFBZ0IsRUFBRTtFQUN2RCxJQUFJLE9BQU9BLGdCQUFnQixLQUFLLFVBQVUsRUFBRTtJQUMxQyxPQUFPQSxnQkFBZ0I7RUFDekI7RUFFQSxNQUFNb0MsV0FBVyxHQUFHLE9BQU9wQyxnQkFBZ0IsS0FBSyxRQUFRLEdBQ3BEQSxnQkFBZ0IsR0FDaEIsNEJBQTRCO0VBRWhDLE9BQU8sU0FBU3FDLDJCQUEyQkEsQ0FBQ0MsS0FBSyxFQUFFO0lBQ2pEeEIsTUFBTSxDQUFDeUIsTUFBTSxpQkFBQUMsTUFBQSxDQUFpQkosV0FBVyxHQUFJRSxLQUFLLENBQUM7RUFDckQsQ0FBQztBQUNILEMiLCJmaWxlIjoiL3BhY2thZ2VzL2NhbGxiYWNrLWhvb2suanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBYWFggVGhpcyBwYXR0ZXJuIGlzIHVuZGVyIGRldmVsb3BtZW50LiBEbyBub3QgYWRkIG1vcmUgY2FsbHNpdGVzXG4vLyB1c2luZyB0aGlzIHBhY2thZ2UgZm9yIG5vdy4gU2VlOlxuLy8gaHR0cHM6Ly9tZXRlb3IuaGFja3BhZC5jb20vRGVzaWduLXByb3Bvc2FsLUhvb2tzLVl4dmdFVzA2cTZmXG4vL1xuLy8gRW5jYXBzdWxhdGVzIHRoZSBwYXR0ZXJuIG9mIHJlZ2lzdGVyaW5nIGNhbGxiYWNrcyBvbiBhIGhvb2suXG4vL1xuLy8gVGhlIGBlYWNoYCBtZXRob2Qgb2YgdGhlIGhvb2sgY2FsbHMgaXRzIGl0ZXJhdG9yIGZ1bmN0aW9uIGFyZ3VtZW50XG4vLyB3aXRoIGVhY2ggcmVnaXN0ZXJlZCBjYWxsYmFjay4gIFRoaXMgYWxsb3dzIHRoZSBob29rIHRvXG4vLyBjb25kaXRpb25hbGx5IGRlY2lkZSBub3QgdG8gY2FsbCB0aGUgY2FsbGJhY2sgKGlmLCBmb3IgZXhhbXBsZSwgdGhlXG4vLyBvYnNlcnZlZCBvYmplY3QgaGFzIGJlZW4gY2xvc2VkIG9yIHRlcm1pbmF0ZWQpLlxuLy9cbi8vIEJ5IGRlZmF1bHQsIGNhbGxiYWNrcyBhcmUgYm91bmQgd2l0aCBgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudGAsIHNvIHRoZXkgd2lsbCBiZVxuLy8gY2FsbGVkIHdpdGggdGhlIE1ldGVvciBlbnZpcm9ubWVudCBvZiB0aGUgY2FsbGluZyBjb2RlIHRoYXRcbi8vIHJlZ2lzdGVyZWQgdGhlIGNhbGxiYWNrLiBPdmVycmlkZSBieSBwYXNzaW5nIHsgYmluZEVudmlyb25tZW50OiBmYWxzZSB9XG4vLyB0byB0aGUgY29uc3RydWN0b3IuXG4vL1xuLy8gUmVnaXN0ZXJpbmcgYSBjYWxsYmFjayByZXR1cm5zIGFuIG9iamVjdCB3aXRoIGEgc2luZ2xlIGBzdG9wYFxuLy8gbWV0aG9kIHdoaWNoIHVucmVnaXN0ZXJzIHRoZSBjYWxsYmFjay5cbi8vXG4vLyBUaGUgY29kZSBpcyBjYXJlZnVsIHRvIGFsbG93IGEgY2FsbGJhY2sgdG8gYmUgc2FmZWx5IHVucmVnaXN0ZXJlZFxuLy8gd2hpbGUgdGhlIGNhbGxiYWNrcyBhcmUgYmVpbmcgaXRlcmF0ZWQgb3Zlci5cbi8vXG4vLyBJZiB0aGUgaG9vayBpcyBjb25maWd1cmVkIHdpdGggdGhlIGBleGNlcHRpb25IYW5kbGVyYCBvcHRpb24sIHRoZVxuLy8gaGFuZGxlciB3aWxsIGJlIGNhbGxlZCBpZiBhIGNhbGxlZCBjYWxsYmFjayB0aHJvd3MgYW4gZXhjZXB0aW9uLlxuLy8gQnkgZGVmYXVsdCAoaWYgdGhlIGV4Y2VwdGlvbiBoYW5kbGVyIGRvZXNuJ3QgaXRzZWxmIHRocm93IGFuXG4vLyBleGNlcHRpb24sIG9yIGlmIHRoZSBpdGVyYXRvciBmdW5jdGlvbiBkb2Vzbid0IHJldHVybiBhIGZhbHN5IHZhbHVlXG4vLyB0byB0ZXJtaW5hdGUgdGhlIGNhbGxpbmcgb2YgY2FsbGJhY2tzKSwgdGhlIHJlbWFpbmluZyBjYWxsYmFja3Ncbi8vIHdpbGwgc3RpbGwgYmUgY2FsbGVkLlxuLy9cbi8vIEFsdGVybmF0aXZlbHksIHRoZSBgZGVidWdQcmludEV4Y2VwdGlvbnNgIG9wdGlvbiBjYW4gYmUgc3BlY2lmaWVkXG4vLyBhcyBzdHJpbmcgZGVzY3JpYmluZyB0aGUgY2FsbGJhY2suICBPbiBhbiBleGNlcHRpb24gdGhlIHN0cmluZyBhbmRcbi8vIHRoZSBleGNlcHRpb24gd2lsbCBiZSBwcmludGVkIHRvIHRoZSBjb25zb2xlIGxvZyB3aXRoXG4vLyBgTWV0ZW9yLl9kZWJ1Z2AsIGFuZCB0aGUgZXhjZXB0aW9uIG90aGVyd2lzZSBpZ25vcmVkLlxuLy9cbi8vIElmIGFuIGV4Y2VwdGlvbiBoYW5kbGVyIGlzbid0IHNwZWNpZmllZCwgZXhjZXB0aW9ucyB0aHJvd24gaW4gdGhlXG4vLyBjYWxsYmFjayB3aWxsIHByb3BhZ2F0ZSB1cCB0byB0aGUgaXRlcmF0b3IgZnVuY3Rpb24sIGFuZCB3aWxsXG4vLyB0ZXJtaW5hdGUgY2FsbGluZyB0aGUgcmVtYWluaW5nIGNhbGxiYWNrcyBpZiBub3QgY2F1Z2h0LlxuXG5leHBvcnQgY2xhc3MgSG9vayB7XG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IEhvb2sgaW5zdGFuY2UuXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucz17fV0gLSBDb25maWd1cmF0aW9uIG9wdGlvbnMgZm9yIHRoZSBob29rLlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmJpbmRFbnZpcm9ubWVudD10cnVlXSAtIFdoZXRoZXIgdG8gYXV0b21hdGljYWxseSB3cmFwIHJlZ2lzdGVyZWQgY2FsbGJhY2tzIHdpdGggYE1ldGVvci5iaW5kRW52aXJvbm1lbnRgLlxuICAgKiAgIElmIGB0cnVlYCwgY2FsbGJhY2tzIHdpbGwgcnVuIGluIHRoZSBNZXRlb3IgZW52aXJvbm1lbnQgb2YgdGhlIGNvZGUgdGhhdCByZWdpc3RlcmVkIHRoZW0uXG4gICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMud3JhcEFzeW5jPXRydWVdIC0gV2hldGhlciB0byBhdXRvbWF0aWNhbGx5IHdyYXAgcmVnaXN0ZXJlZCBjYWxsYmFja3Mgd2l0aCBgTWV0ZW9yLndyYXBGbmAuXG4gICAqICAgSWYgYHRydWVgLCBjYWxsYmFja3Mgd2lsbCBiZSBwcmVwYXJlZCB0byBydW4gYXN5bmNocm9ub3VzbHkuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtvcHRpb25zLmV4Y2VwdGlvbkhhbmRsZXJdIC0gQSBjdXN0b20gZnVuY3Rpb24gdG8gaGFuZGxlIGV4Y2VwdGlvbnMgdGhyb3duIGJ5IHJlZ2lzdGVyZWQgY2FsbGJhY2tzLlxuICAgKiAgIFRoaXMgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQgd2l0aCB0aGUgZXhjZXB0aW9uIGFzIGl0cyBhcmd1bWVudC5cbiAgICogICBJZiBwcm92aWRlZCwgYG9wdGlvbnMuZGVidWdQcmludEV4Y2VwdGlvbnNgIHdpbGwgYmUgaWdub3JlZC5cbiAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmRlYnVnUHJpbnRFeGNlcHRpb25zXSAtIElmIGFuIGBleGNlcHRpb25IYW5kbGVyYCBpcyBub3QgcHJvdmlkZWQsIGFuZCB0aGlzIG9wdGlvbiBpcyBhIHN0cmluZyxcbiAgICogICBleGNlcHRpb25zIHRocm93biBieSBjYWxsYmFja3Mgd2lsbCBiZSBsb2dnZWQgdG8gYE1ldGVvci5fZGVidWdgIHdpdGggdGhpcyBzdHJpbmcgYXMgYSBkZXNjcmlwdGlvbi5cbiAgICovXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgICB0aGlzLmNhbGxiYWNrcyA9IG5ldyBTZXQoKTtcblxuICAgICAgLy8gV2hldGhlciB0byB3cmFwIGNhbGxiYWNrcyB3aXRoIE1ldGVvci5iaW5kRW52aXJvbm1lbnRcbiAgICAgIGNvbnN0IHsgYmluZEVudmlyb25tZW50ID0gdHJ1ZSwgd3JhcEFzeW5jID0gdHJ1ZSB9ID0gb3B0aW9ucztcbiAgICAgIHRoaXMuYmluZEVudmlyb25tZW50ID0gISFiaW5kRW52aXJvbm1lbnQ7XG4gICAgICB0aGlzLndyYXBBc3luYyA9ICEhd3JhcEFzeW5jO1xuXG4gICAgICBpZiAob3B0aW9ucy5leGNlcHRpb25IYW5kbGVyKSB7XG4gICAgICAgIHRoaXMuZXhjZXB0aW9uSGFuZGxlciA9IG9wdGlvbnMuZXhjZXB0aW9uSGFuZGxlcjtcbiAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5kZWJ1Z1ByaW50RXhjZXB0aW9ucykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMuZGVidWdQcmludEV4Y2VwdGlvbnMgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJIb29rIG9wdGlvbiBkZWJ1Z1ByaW50RXhjZXB0aW9ucyBzaG91bGQgYmUgYSBzdHJpbmdcIik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5leGNlcHRpb25IYW5kbGVyID0gb3B0aW9ucy5kZWJ1Z1ByaW50RXhjZXB0aW9ucztcbiAgICAgIH1cbiAgICB9XG5cbiAgLyoqXG4gICAqIENsZWFycyBhbGwgcmVnaXN0ZXJlZCBjYWxsYmFja3MgZnJvbSB0aGlzIEhvb2sgaW5zdGFuY2UuXG4gICAqIEFmdGVyIGNhbGxpbmcgdGhpcyBtZXRob2QsIHRoZSBob29rIHdpbGwgaGF2ZSBubyBjYWxsYmFja3MgcmVnaXN0ZXJlZC5cbiAgICovXG4gIGNsZWFyKCkge1xuICAgIHRoaXMuY2FsbGJhY2tzLmNsZWFyKCk7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIGNhbGxiYWNrcyBjdXJyZW50bHkgcmVnaXN0ZXJlZCB3aXRoIHRoaXMgSG9vayBpbnN0YW5jZS5cbiAgICogQHJldHVybnMge251bWJlcn0gVGhlIG51bWJlciBvZiByZWdpc3RlcmVkIGNhbGxiYWNrcy5cbiAgICovXG4gIHNpemUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2FsbGJhY2tzLnNpemU7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbGwgcmVnaXN0ZXJlZCBjYWxsYmFja3MgYXMgYSBuZXcgQXJyYXkuXG4gICAqIFRoaXMgcHJvdmlkZXMgYSBzbmFwc2hvdCBvZiB0aGUgY3VycmVudCBjYWxsYmFja3MuXG4gICAqIEByZXR1cm5zIHtBcnJheTxGdW5jdGlvbj59IEFuIGFycmF5IGNvbnRhaW5pbmcgYWxsIHJlZ2lzdGVyZWQgY2FsbGJhY2sgZnVuY3Rpb25zLlxuICAgKi9cbiAgYXNBcnJheSgpIHtcbiAgICByZXR1cm4gQXJyYXkuZnJvbSh0aGlzLmNhbGxiYWNrcyk7XG4gIH1cblxuICAvKipcbiAgICogUmVwbGFjZXMgdGhlIGN1cnJlbnQgc2V0IG9mIHJlZ2lzdGVyZWQgY2FsbGJhY2tzIHdpdGggYSBuZXcgc2V0IGRlcml2ZWQgZnJvbSB0aGUgZ2l2ZW4gYXJyYXkuXG4gICAqXG4gICAqIEBwYXJhbSB7QXJyYXk8RnVuY3Rpb24+fSBhcnIgQW4gYXJyYXkgb2YgY2FsbGJhY2sgZnVuY3Rpb25zIHRvIHJlZ2lzdGVyIHdpdGggdGhpcyBob29rLlxuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlIHByb3ZpZGVkIGFyZ3VtZW50IGBhcnJgIGlzIG5vdCBhbiBhcnJheS5cbiAgICovXG4gIGZyb21BcnJheShhcnIpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYXJyKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kIGZyb21BcnJheSBleHBlY3RzIGFuIGFycmF5XCIpO1xuICAgIH1cbiAgICB0aGlzLmNhbGxiYWNrcyA9IG5ldyBTZXQoYXJyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgYSBuZXcgY2FsbGJhY2sgd2l0aCB0aGlzIEhvb2sgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byByZWdpc3Rlci4gVGhpcyBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZCB3aGVuIHRoZSBob29rIGlzIGl0ZXJhdGVkIG92ZXIuXG4gICAqIEByZXR1cm5zIHt7Y2FsbGJhY2s6IEZ1bmN0aW9uLCBzdG9wOiBGdW5jdGlvbn19IEFuIG9iamVjdCBjb250YWluaW5nOlxuICAgKiAgIC0gYGNhbGxiYWNrYDogVGhlIGFjdHVhbCBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IHdhcyBhZGRlZCB0byB0aGUgaG9vaydzIGludGVybmFsIHNldCAoYWZ0ZXIgYW55IHdyYXBwaW5nKS5cbiAgICogICAtIGBzdG9wYDogQSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCwgdW5yZWdpc3RlcnMgdGhpcyBzcGVjaWZpYyBjYWxsYmFjayBmcm9tIHRoZSBob29rLlxuICAgKi9cbiAgcmVnaXN0ZXIoY2FsbGJhY2spIHtcbiAgICBjb25zdCBleGNlcHRpb25IYW5kbGVyID0gdGhpcy5leGNlcHRpb25IYW5kbGVyIHx8IGZ1bmN0aW9uIChleGNlcHRpb24pIHtcbiAgICAgIC8vIE5vdGU6IHRoaXMgcmVsaWVzIG9uIHRoZSB1bmRvY3VtZW50ZWQgZmFjdCB0aGF0IGlmIGJpbmRFbnZpcm9ubWVudCdzXG4gICAgICAvLyBvbkV4Y2VwdGlvbiB0aHJvd3MsIGFuZCB5b3UgYXJlIGludm9raW5nIHRoZSBjYWxsYmFjayBlaXRoZXIgaW4gdGhlXG4gICAgICAvLyBicm93c2VyIG9yIGZyb20gd2l0aGluIGEgRmliZXIgaW4gTm9kZSwgdGhlIGV4Y2VwdGlvbiBpcyBwcm9wYWdhdGVkLlxuICAgICAgdGhyb3cgZXhjZXB0aW9uO1xuICAgIH07XG5cbiAgICBpZiAodGhpcy5iaW5kRW52aXJvbm1lbnQpIHtcbiAgICAgIGNhbGxiYWNrID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChjYWxsYmFjaywgZXhjZXB0aW9uSGFuZGxlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrID0gd3JhcEhvb2tXaXRoRXJyb3JIYW5kbGluZyhjYWxsYmFjaywgZXhjZXB0aW9uSGFuZGxlcik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMud3JhcEFzeW5jKSB7XG4gICAgICBjYWxsYmFjayA9IE1ldGVvci53cmFwRm4oY2FsbGJhY2spO1xuICAgIH1cblxuICAgIHRoaXMuY2FsbGJhY2tzLmFkZChjYWxsYmFjayk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgY2FsbGJhY2ssXG4gICAgICBzdG9wOiAoKSA9PiB7XG4gICAgICAgIHRoaXMuY2FsbGJhY2tzLmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgZWFjaCByZWdpc3RlcmVkIGNhbGxiYWNrLCBjYWxsIHRoZSBwYXNzZWQgaXRlcmF0b3IgZnVuY3Rpb24gd2l0aCB0aGUgY2FsbGJhY2suXG4gICAqXG4gICAqIFRoZSBpdGVyYXRvciBmdW5jdGlvbiBjYW4gY2hvb3NlIHdoZXRoZXIgb3Igbm90IHRvIGNhbGwgdGhlXG4gICAqIGNhbGxiYWNrLiAgKEZvciBleGFtcGxlLCBpdCBtaWdodCBub3QgY2FsbCB0aGUgY2FsbGJhY2sgaWYgdGhlXG4gICAqIG9ic2VydmVkIG9iamVjdCBoYXMgYmVlbiBjbG9zZWQgb3IgdGVybWluYXRlZCkuXG4gICAqIFRoZSBpdGVyYXRpb24gaXMgc3RvcHBlZCBpZiB0aGUgaXRlcmF0b3IgZnVuY3Rpb24gcmV0dXJucyBhIGZhbHN5XG4gICAqIHZhbHVlIG9yIHRocm93cyBhbiBleGNlcHRpb24uXG4gICAqXG4gICAqIEBwYXJhbSBpdGVyYXRvclxuICAgKi9cbiAgZm9yRWFjaChpdGVyYXRvcikge1xuICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5jYWxsYmFja3MpIHtcbiAgICAgIGlmICghaXRlcmF0b3IoY2FsbGJhY2spKSBicmVhaztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRm9yIGVhY2ggcmVnaXN0ZXJlZCBjYWxsYmFjaywgY2FsbCB0aGUgcGFzc2VkIGl0ZXJhdG9yIGZ1bmN0aW9uIHdpdGggdGhlIGNhbGxiYWNrLlxuICAgKlxuICAgKiBpdCBpcyBhIGNvdW50ZXJwYXJ0IG9mIGZvckVhY2gsIGJ1dCBpdCBpcyBhc3luYyBhbmQgcmV0dXJucyBhIHByb21pc2VcbiAgICogQHBhcmFtIGl0ZXJhdG9yXG4gICAqIEByZXR1cm4ge1Byb21pc2U8dm9pZD59XG4gICAqIEBzZWUgZm9yRWFjaFxuICAgKi9cbiAgYXN5bmMgZm9yRWFjaEFzeW5jKGl0ZXJhdG9yKSB7XG4gICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLmNhbGxiYWNrcykge1xuICAgICAgaWYgKCFhd2FpdCBpdGVyYXRvcihjYWxsYmFjaykpIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAZGVwcmVjYXRlZCB1c2UgZm9yRWFjaFxuICAgKiBAcGFyYW0gaXRlcmF0b3JcbiAgICovXG4gIGVhY2goaXRlcmF0b3IpIHtcbiAgICByZXR1cm4gdGhpcy5mb3JFYWNoKGl0ZXJhdG9yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBNYWtlcyB0aGUgSG9vayBpbnN0YW5jZSBpdGVyYWJsZSwgYWxsb3dpbmcgaXQgdG8gYmUgdXNlZCBpbiBgZm9yLi4ub2ZgIGxvb3BzLlxuICAgKiBJdCBpdGVyYXRlcyBvdmVyIHRoZSByZWdpc3RlcmVkIGNhbGxiYWNrcy5cbiAgICogQHJldHVybnMge0l0ZXJhdG9yPEZ1bmN0aW9uPn0gQW4gaXRlcmF0b3IgZm9yIHRoZSByZWdpc3RlcmVkIGNhbGxiYWNrcy5cbiAgICovXG4gIFtTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgIHJldHVybiB0aGlzLmNhbGxiYWNrc1tTeW1ib2wuaXRlcmF0b3JdKCk7XG4gIH1cbn1cblxuLyoqXG4gKiBXcmFwcyBhIGdpdmVuIGZ1bmN0aW9uIHdpdGggZXJyb3IgaGFuZGxpbmcuIElmIHRoZSB3cmFwcGVkIGZ1bmN0aW9uIHRocm93cyBhbiBleGNlcHRpb24sXG4gKiBpdCB3aWxsIGJlIGNhdWdodCBhbmQgcGFzc2VkIHRvIHRoZSBwcm92aWRlZCBleGNlcHRpb24gaGFuZGxlci5cbiAqIFRoaXMgaXMgc2ltaWxhciB0byBgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudGAgYnV0IHdpdGhvdXQgdGhlIE1ldGVvciBlbnZpcm9ubWVudCBiaW5kaW5nLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHdyYXAuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufHN0cmluZ30gb25FeGNlcHRpb24gVGhlIGV4Y2VwdGlvbiBoYW5kbGVyIGZ1bmN0aW9uIHRvIGNhbGwgaWYgYGZ1bmNgIHRocm93cyxcbiAqICAgb3IgYSBzdHJpbmcgZGVzY3JpcHRpb24gZm9yIGRlZmF1bHQgZXhjZXB0aW9uIGxvZ2dpbmcuXG4gKiBAcGFyYW0ge2FueX0gX3RoaXMgVGhlIGB0aGlzYCBjb250ZXh0IHRvIGJpbmQgdG8gYGZ1bmNgIHdoZW4gaXQgaXMgY2FsbGVkLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBBIG5ldyBmdW5jdGlvbiB0aGF0IGV4ZWN1dGVzIGBmdW5jYCB3aXRoIGVycm9yIGhhbmRsaW5nLlxuICovXG5mdW5jdGlvbiB3cmFwSG9va1dpdGhFcnJvckhhbmRsaW5nKGZ1bmMsIG9uRXhjZXB0aW9uLCBfdGhpcykge1xuICBjb25zdCBleGNlcHRpb25IYW5kbGVyID0gbm9ybWFsaXplSG9va0V4Y2VwdGlvbkhhbmRsZXIob25FeGNlcHRpb24pO1xuICByZXR1cm4gZnVuY3Rpb24gZXhlY3V0ZUhvb2tXaXRoRXJyb3JIYW5kbGluZyguLi5hcmdzKSB7XG4gICAgbGV0IHJldDtcbiAgICB0cnkge1xuICAgICAgcmV0ID0gZnVuYy5hcHBseShfdGhpcywgYXJncyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhjZXB0aW9uSGFuZGxlcihlKTtcbiAgICB9XG4gICAgcmV0dXJuIHJldDtcbiAgfTtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemVzIGFuIGV4Y2VwdGlvbiBoYW5kbGVyLCBlbnN1cmluZyBpdCBpcyBhIGZ1bmN0aW9uLlxuICogSWYgYSBmdW5jdGlvbiBpcyBwcm92aWRlZCwgaXQgaXMgcmV0dXJuZWQgZGlyZWN0bHkuXG4gKiBJZiBhIHN0cmluZyBpcyBwcm92aWRlZCwgaXQgaXMgdXNlZCBhcyBhIGRlc2NyaXB0aW9uIGZvciBhIGRlZmF1bHQgaGFuZGxlciB0aGF0IGxvZ3MgZXhjZXB0aW9ucy5cbiAqIE90aGVyd2lzZSwgYSBnZW5lcmljIGRlZmF1bHQgaGFuZGxlciB0aGF0IGxvZ3MgZXhjZXB0aW9ucyB3aXRoIGEgZGVmYXVsdCBkZXNjcmlwdGlvbiBpcyByZXR1cm5lZC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufHN0cmluZ30gZXhjZXB0aW9uSGFuZGxlciBUaGUgZXhjZXB0aW9uIGhhbmRsZXIgdG8gbm9ybWFsaXplLiBDYW4gYmUgYSBmdW5jdGlvbixcbiAqICAgYSBzdHJpbmcgZGVzY3JpcHRpb24gZm9yIGxvZ2dpbmcsIG9yIGFueSBvdGhlciB2YWx1ZSAod2hpY2ggZGVmYXVsdHMgdG8gZ2VuZXJpYyBsb2dnaW5nKS5cbiAqIEByZXR1cm5zIHtGdW5jdGlvbn0gQSBmdW5jdGlvbiB0aGF0IGhhbmRsZXMgZXhjZXB0aW9ucy5cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplSG9va0V4Y2VwdGlvbkhhbmRsZXIoZXhjZXB0aW9uSGFuZGxlcikge1xuICBpZiAodHlwZW9mIGV4Y2VwdGlvbkhhbmRsZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZXhjZXB0aW9uSGFuZGxlcjtcbiAgfVxuXG4gIGNvbnN0IGRlc2NyaXB0aW9uID0gdHlwZW9mIGV4Y2VwdGlvbkhhbmRsZXIgPT09ICdzdHJpbmcnXG4gICAgPyBleGNlcHRpb25IYW5kbGVyXG4gICAgOiBcImNhbGxiYWNrIG9mIGFzeW5jIGZ1bmN0aW9uXCI7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGRlZmF1bHRIb29rRXhjZXB0aW9uSGFuZGxlcihlcnJvcikge1xuICAgIE1ldGVvci5fZGVidWcoYEV4Y2VwdGlvbiBpbiAke2Rlc2NyaXB0aW9ufWAsIGVycm9yKTtcbiAgfVxufVxuIl19
