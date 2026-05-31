Package["core-runtime"].queue("boilerplate-generator",function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Boilerplate;

var require = meteorInstall({"node_modules":{"meteor":{"boilerplate-generator":{"generator.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/boilerplate-generator/generator.js                                                                         //
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
      Boilerplate: () => Boilerplate
    });
    let readFileSync;
    module.link("fs", {
      readFileSync(v) {
        readFileSync = v;
      }
    }, 0);
    let createStream;
    module.link("combined-stream2", {
      create(v) {
        createStream = v;
      }
    }, 1);
    let modernHeadTemplate, modernCloseTemplate;
    module.link("./template-web.browser", {
      headTemplate(v) {
        modernHeadTemplate = v;
      },
      closeTemplate(v) {
        modernCloseTemplate = v;
      }
    }, 2);
    let cordovaHeadTemplate, cordovaCloseTemplate;
    module.link("./template-web.cordova", {
      headTemplate(v) {
        cordovaHeadTemplate = v;
      },
      closeTemplate(v) {
        cordovaCloseTemplate = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Copied from webapp_server
    const readUtf8FileSync = filename => readFileSync(filename, 'utf8');
    const identity = value => value;
    function appendToStream(chunk, stream) {
      if (typeof chunk === "string") {
        stream.append(Buffer.from(chunk, "utf8"));
      } else if (Buffer.isBuffer(chunk) || typeof chunk.read === "function") {
        stream.append(chunk);
      }
    }
    class Boilerplate {
      constructor(arch, manifest) {
        let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        const {
          headTemplate,
          closeTemplate
        } = getTemplate(arch);
        this.headTemplate = headTemplate;
        this.closeTemplate = closeTemplate;
        this.baseData = null;
        this._generateBoilerplateFromManifest(manifest, options);
      }
      toHTML(extraData) {
        throw new Error("The Boilerplate#toHTML method has been removed. " + "Please use Boilerplate#toHTMLStream instead.");
      }

      // Returns a Promise that resolves to a string of HTML.
      toHTMLAsync(extraData) {
        return new Promise((resolve, reject) => {
          const stream = this.toHTMLStream(extraData);
          const chunks = [];
          stream.on("data", chunk => chunks.push(chunk));
          stream.on("end", () => {
            resolve(Buffer.concat(chunks).toString("utf8"));
          });
          stream.on("error", reject);
        });
      }

      // The 'extraData' argument can be used to extend 'self.baseData'. Its
      // purpose is to allow you to specify data that you might not know at
      // the time that you construct the Boilerplate object. (e.g. it is used
      // by 'webapp' to specify data that is only known at request-time).
      // this returns a stream
      toHTMLStream(extraData) {
        if (!this.baseData || !this.headTemplate || !this.closeTemplate) {
          throw new Error('Boilerplate did not instantiate correctly.');
        }
        const data = _objectSpread(_objectSpread({}, this.baseData), extraData);
        const start = "<!DOCTYPE html>\n" + this.headTemplate(data);
        const {
          body,
          dynamicBody
        } = data;
        const end = this.closeTemplate(data);
        const response = createStream();
        appendToStream(start, response);
        if (body) {
          appendToStream(body, response);
        }
        if (dynamicBody) {
          appendToStream(dynamicBody, response);
        }
        appendToStream(end, response);
        return response;
      }

      // XXX Exported to allow client-side only changes to rebuild the boilerplate
      // without requiring a full server restart.
      // Produces an HTML string with given manifest and boilerplateSource.
      // Optionally takes urlMapper in case urls from manifest need to be prefixed
      // or rewritten.
      // Optionally takes pathMapper for resolving relative file system paths.
      // Optionally allows to override fields of the data context.
      _generateBoilerplateFromManifest(manifest) {
        let {
          urlMapper = identity,
          pathMapper = identity,
          baseDataExtension,
          inline
        } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        const boilerplateBaseData = _objectSpread({
          css: [],
          js: [],
          head: '',
          body: '',
          meteorManifest: JSON.stringify(manifest)
        }, baseDataExtension);
        manifest.forEach(item => {
          const urlPath = urlMapper(item.url);
          const itemObj = {
            url: urlPath
          };
          if (inline) {
            itemObj.scriptContent = readUtf8FileSync(pathMapper(item.path));
            itemObj.inline = true;
          } else if (item.sri) {
            itemObj.sri = item.sri;
          }
          if (item.type === 'css' && item.where === 'client') {
            boilerplateBaseData.css.push(itemObj);
          }
          if (item.type === 'js' && item.where === 'client' &&
          // Dynamic JS modules should not be loaded eagerly in the
          // initial HTML of the app.
          !item.path.startsWith('dynamic/')) {
            boilerplateBaseData.js.push(itemObj);
          }
          if (item.type === 'head') {
            boilerplateBaseData.head = readUtf8FileSync(pathMapper(item.path));
          }
          if (item.type === 'body') {
            boilerplateBaseData.body = readUtf8FileSync(pathMapper(item.path));
          }
        });
        this.baseData = boilerplateBaseData;
      }
    }
    ;

    // Returns a template function that, when called, produces the boilerplate
    // html as a string.
    function getTemplate(arch) {
      const prefix = arch.split(".", 2).join(".");
      if (prefix === "web.browser") {
        return {
          headTemplate: modernHeadTemplate,
          closeTemplate: modernCloseTemplate
        };
      }
      if (prefix === "web.cordova") {
        return {
          headTemplate: cordovaHeadTemplate,
          closeTemplate: cordovaCloseTemplate
        };
      }
      throw new Error("Unsupported arch: " + arch);
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

},"template-web.browser.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/boilerplate-generator/template-web.browser.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      headTemplate: () => headTemplate,
      closeTemplate: () => closeTemplate
    });
    let template;
    module.link("./template", {
      default(v) {
        template = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const sri = (sri, mode) => sri && mode ? " integrity=\"sha512-".concat(sri, "\" crossorigin=\"").concat(mode, "\"") : '';
    const headTemplate = _ref => {
      let {
        css,
        htmlAttributes,
        bundledJsCssUrlRewriteHook,
        sriMode,
        head,
        dynamicHead
      } = _ref;
      var headSections = head.split(/<meteor-bundled-css[^<>]*>/, 2);
      var cssBundle = [...(css || []).map(file => template('  <link rel="stylesheet" type="text/css" class="__meteor-css__" href="<%- href %>"<%= sri %>>')({
        href: bundledJsCssUrlRewriteHook(file.url),
        sri: sri(file.sri, sriMode)
      }))].join('\n');
      return ['<html' + Object.keys(htmlAttributes || {}).map(key => template(' <%= attrName %>="<%- attrValue %>"')({
        attrName: key,
        attrValue: htmlAttributes[key]
      })).join('') + '>', '<head>', headSections.length === 1 ? [cssBundle, headSections[0]].join('\n') : [headSections[0], cssBundle, headSections[1]].join('\n'), dynamicHead, '</head>', '<body>'].join('\n');
    };
    const closeTemplate = _ref2 => {
      let {
        meteorRuntimeConfig,
        meteorRuntimeHash,
        rootUrlPathPrefix,
        inlineScriptsAllowed,
        js,
        additionalStaticJs,
        bundledJsCssUrlRewriteHook,
        sriMode
      } = _ref2;
      return ['', inlineScriptsAllowed ? template('  <script type="text/javascript">__meteor_runtime_config__ = JSON.parse(decodeURIComponent(<%= conf %>))</script>')({
        conf: meteorRuntimeConfig
      }) : template('  <script type="text/javascript" src="<%- src %>/meteor_runtime_config.js?hash=<%- hash %>"></script>')({
        src: rootUrlPathPrefix,
        hash: meteorRuntimeHash
      }), '', ...(js || []).map(file => template('  <script type="text/javascript" src="<%- src %>"<%= sri %>></script>')({
        src: bundledJsCssUrlRewriteHook(file.url),
        sri: sri(file.sri, sriMode)
      })), ...(additionalStaticJs || []).map(_ref3 => {
        let {
          contents,
          pathname
        } = _ref3;
        return inlineScriptsAllowed ? template('  <script><%= contents %></script>')({
          contents
        }) : template('  <script type="text/javascript" src="<%- src %>"></script>')({
          src: rootUrlPathPrefix + pathname
        });
      }), process.env.METEOR_APP_CUSTOM_SCRIPT_URL ? template("  <script type=\"text/javascript\" src=\"<%- src %>\"></script>")({
        src: process.env.METEOR_APP_CUSTOM_SCRIPT_URL
      }) : '', '', '', '</body>', '</html>'].join('\n');
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

},"template-web.cordova.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/boilerplate-generator/template-web.cordova.js                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      headTemplate: () => headTemplate,
      closeTemplate: () => closeTemplate
    });
    let template;
    module.link("./template", {
      default(v) {
        template = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const headTemplate = _ref => {
      let {
        meteorRuntimeConfig,
        rootUrlPathPrefix,
        inlineScriptsAllowed,
        css,
        js,
        additionalStaticJs,
        htmlAttributes,
        bundledJsCssUrlRewriteHook,
        head,
        dynamicHead
      } = _ref;
      var headSections = head.split(/<meteor-bundled-css[^<>]*>/, 2);
      var cssBundle = [
      // We are explicitly not using bundledJsCssUrlRewriteHook: in cordova we serve assets up directly from disk, so rewriting the URL does not make sense
      ...(css || []).map(file => template('  <link rel="stylesheet" type="text/css" class="__meteor-css__" href="<%- href %>">')({
        href: file.url
      }))].join('\n');
      return ['<html>', '<head>', '  <meta charset="utf-8">', '  <meta name="format-detection" content="telephone=no">', '  <meta name="viewport" content="user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1, width=device-width, height=device-height, viewport-fit=cover">', '  <meta name="msapplication-tap-highlight" content="no">', '  <meta http-equiv="Content-Security-Policy" content="default-src * android-webview-video-poster: gap: data: blob: \'unsafe-inline\' \'unsafe-eval\' ws: wss:;">', headSections.length === 1 ? [cssBundle, headSections[0]].join('\n') : [headSections[0], cssBundle, headSections[1]].join('\n'), '  <script type="text/javascript">', template('    __meteor_runtime_config__ = JSON.parse(decodeURIComponent(<%= conf %>));')({
        conf: meteorRuntimeConfig
      }), '    if (/Android/i.test(navigator.userAgent)) {',
      // When Android app is emulated, it cannot connect to localhost,
      // instead it should connect to 10.0.2.2
      // (unless we\'re using an http proxy; then it works!)
      '      if (!__meteor_runtime_config__.httpProxyPort) {', '        __meteor_runtime_config__.ROOT_URL = (__meteor_runtime_config__.ROOT_URL || \'\').replace(/localhost/i, \'10.0.2.2\');', '        __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL = (__meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL || \'\').replace(/localhost/i, \'10.0.2.2\');', '      }', '    }', '  </script>', '', '  <script type="text/javascript" src="/cordova.js"></script>', ...(js || []).map(file => template('  <script type="text/javascript" src="<%- src %>"></script>')({
        src: file.url
      })), ...(additionalStaticJs || []).map(_ref2 => {
        let {
          contents,
          pathname
        } = _ref2;
        return inlineScriptsAllowed ? template('  <script><%= contents %></script>')({
          contents
        }) : template('  <script type="text/javascript" src="<%- src %>"></script>')({
          src: rootUrlPathPrefix + pathname
        });
      }), '', '</head>', '', '<body>'].join('\n');
    };
    function closeTemplate() {
      return "</body>\n</html>";
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

},"template.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/boilerplate-generator/template.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  default: () => template
});
/**
 * Internal full-featured implementation of lodash.template (inspired by v4.5.0)
 * embedded to eliminate the external dependency while preserving functionality.
 *
 * MIT License (c) JS Foundation and other contributors <https://js.foundation/>
 * Adapted for Meteor boilerplate-generator (only the pieces required by template were extracted).
 */

// ---------------------------------------------------------------------------
// Utility & regex definitions (mirroring lodash pieces used by template)
// ---------------------------------------------------------------------------

const reEmptyStringLeading = /\b__p \+= '';/g;
const reEmptyStringMiddle = /\b(__p \+=) '' \+/g;
const reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;
const reEscape = /<%-([\s\S]+?)%>/g; // escape delimiter
const reEvaluate = /<%([\s\S]+?)%>/g; // evaluate delimiter
const reInterpolate = /<%=([\s\S]+?)%>/g; // interpolate delimiter
const reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g; // ES6 template literal capture
const reUnescapedString = /['\\\n\r\u2028\u2029]/g; // string literal escapes

// HTML escape
const htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
const reHasUnescapedHtml = /[&<>"']/;
function escapeHtml(string) {
  return string && reHasUnescapedHtml.test(string) ? string.replace(/[&<>"']/g, chr => htmlEscapes[chr]) : string || '';
}

// Escape characters for inclusion into a string literal
const escapes = {
  "'": "'",
  '\\': '\\',
  '\n': 'n',
  '\r': 'r',
  "\u2028": 'u2028',
  "\u2029": 'u2029'
};
function escapeStringChar(match) {
  return '\\' + escapes[match];
}

// Basic Object helpers ------------------------------------------------------
function isObject(value) {
  return value != null && typeof value === 'object';
}
function toStringSafe(value) {
  return value == null ? '' : value + '';
}
function baseValues(object, props) {
  return props.map(k => object[k]);
}
function attempt(fn) {
  try {
    return fn();
  } catch (e) {
    return e;
  }
}
function isError(value) {
  return value instanceof Error || isObject(value) && value.name === 'Error';
}

// ---------------------------------------------------------------------------
// Main template implementation
// ---------------------------------------------------------------------------
let templateCounter = -1; // used for sourceURL generation

function _template(string) {
  string = toStringSafe(string);
  const imports = {
    '_': {
      escape: escapeHtml
    }
  };
  const importKeys = Object.keys(imports);
  const importValues = baseValues(imports, importKeys);
  let index = 0;
  let isEscaping;
  let isEvaluating;
  let source = "__p += '";

  // Build combined regex of delimiters
  const reDelimiters = RegExp(reEscape.source + '|' + reInterpolate.source + '|' + reEsTemplate.source + '|' + reEvaluate.source + '|$', 'g');
  const sourceURL = "//# sourceURL=lodash.templateSources[".concat(++templateCounter, "]\n");

  // Tokenize
  string.replace(reDelimiters, function (match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
    interpolateValue || (interpolateValue = esTemplateValue);
    // Append preceding string portion with escaped literal chars
    source += string.slice(index, offset).replace(reUnescapedString, escapeStringChar);
    if (escapeValue) {
      isEscaping = true;
      source += "' +\n__e(" + escapeValue + ") +\n'";
    }
    if (evaluateValue) {
      isEvaluating = true;
      source += "';\n" + evaluateValue + ";\n__p += '";
    }
    if (interpolateValue) {
      source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
    }
    index = offset + match.length;
    return match;
  });
  source += "';\n";
  source = 'with (obj) {\n' + source + '\n}\n';

  // Remove unnecessary concatenations
  source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source).replace(reEmptyStringMiddle, '$1').replace(reEmptyStringTrailing, '$1;');

  // Frame as function body
  source = 'function(obj) {\n' + 'obj || (obj = {});\n' + "var __t, __p = ''" + (isEscaping ? ', __e = _.escape' : '') + (isEvaluating ? ', __j = Array.prototype.join;\nfunction print() { __p += __j.call(arguments, \'\') }\n' : ';\n') + source + 'return __p\n}';

  // Actual compile step
  const result = attempt(function () {
    return Function(importKeys, sourceURL + 'return ' + source).apply(undefined, importValues); // eslint-disable-line no-new-func
  });
  if (isError(result)) {
    result.source = source; // expose for debugging if error
    throw result;
  }
  // Expose compiled source
  result.source = source;
  return result;
}
function template(text) {
  return _template(text);
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"combined-stream2":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/boilerplate-generator/node_modules/combined-stream2/package.json                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "combined-stream2",
  "version": "1.1.2",
  "main": "index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/boilerplate-generator/node_modules/combined-stream2/index.js                                    //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      Boilerplate: Boilerplate
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/boilerplate-generator/generator.js"
  ],
  mainModulePath: "/node_modules/meteor/boilerplate-generator/generator.js"
}});

//# sourceURL=meteor://💻app/packages/boilerplate-generator.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYm9pbGVycGxhdGUtZ2VuZXJhdG9yL2dlbmVyYXRvci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYm9pbGVycGxhdGUtZ2VuZXJhdG9yL3RlbXBsYXRlLXdlYi5icm93c2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ib2lsZXJwbGF0ZS1nZW5lcmF0b3IvdGVtcGxhdGUtd2ViLmNvcmRvdmEuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JvaWxlcnBsYXRlLWdlbmVyYXRvci90ZW1wbGF0ZS5qcyJdLCJuYW1lcyI6WyJfb2JqZWN0U3ByZWFkIiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJ2IiwiZXhwb3J0IiwiQm9pbGVycGxhdGUiLCJyZWFkRmlsZVN5bmMiLCJjcmVhdGVTdHJlYW0iLCJjcmVhdGUiLCJtb2Rlcm5IZWFkVGVtcGxhdGUiLCJtb2Rlcm5DbG9zZVRlbXBsYXRlIiwiaGVhZFRlbXBsYXRlIiwiY2xvc2VUZW1wbGF0ZSIsImNvcmRvdmFIZWFkVGVtcGxhdGUiLCJjb3Jkb3ZhQ2xvc2VUZW1wbGF0ZSIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwicmVhZFV0ZjhGaWxlU3luYyIsImZpbGVuYW1lIiwiaWRlbnRpdHkiLCJ2YWx1ZSIsImFwcGVuZFRvU3RyZWFtIiwiY2h1bmsiLCJzdHJlYW0iLCJhcHBlbmQiLCJCdWZmZXIiLCJmcm9tIiwiaXNCdWZmZXIiLCJyZWFkIiwiY29uc3RydWN0b3IiLCJhcmNoIiwibWFuaWZlc3QiLCJvcHRpb25zIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwiZ2V0VGVtcGxhdGUiLCJiYXNlRGF0YSIsIl9nZW5lcmF0ZUJvaWxlcnBsYXRlRnJvbU1hbmlmZXN0IiwidG9IVE1MIiwiZXh0cmFEYXRhIiwiRXJyb3IiLCJ0b0hUTUxBc3luYyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwidG9IVE1MU3RyZWFtIiwiY2h1bmtzIiwib24iLCJwdXNoIiwiY29uY2F0IiwidG9TdHJpbmciLCJkYXRhIiwic3RhcnQiLCJib2R5IiwiZHluYW1pY0JvZHkiLCJlbmQiLCJyZXNwb25zZSIsInVybE1hcHBlciIsInBhdGhNYXBwZXIiLCJiYXNlRGF0YUV4dGVuc2lvbiIsImlubGluZSIsImJvaWxlcnBsYXRlQmFzZURhdGEiLCJjc3MiLCJqcyIsImhlYWQiLCJtZXRlb3JNYW5pZmVzdCIsIkpTT04iLCJzdHJpbmdpZnkiLCJmb3JFYWNoIiwiaXRlbSIsInVybFBhdGgiLCJ1cmwiLCJpdGVtT2JqIiwic2NyaXB0Q29udGVudCIsInBhdGgiLCJzcmkiLCJ0eXBlIiwid2hlcmUiLCJzdGFydHNXaXRoIiwicHJlZml4Iiwic3BsaXQiLCJqb2luIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwidGVtcGxhdGUiLCJtb2RlIiwiX3JlZiIsImh0bWxBdHRyaWJ1dGVzIiwiYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2siLCJzcmlNb2RlIiwiZHluYW1pY0hlYWQiLCJoZWFkU2VjdGlvbnMiLCJjc3NCdW5kbGUiLCJtYXAiLCJmaWxlIiwiaHJlZiIsIk9iamVjdCIsImtleXMiLCJrZXkiLCJhdHRyTmFtZSIsImF0dHJWYWx1ZSIsIl9yZWYyIiwibWV0ZW9yUnVudGltZUNvbmZpZyIsIm1ldGVvclJ1bnRpbWVIYXNoIiwicm9vdFVybFBhdGhQcmVmaXgiLCJpbmxpbmVTY3JpcHRzQWxsb3dlZCIsImFkZGl0aW9uYWxTdGF0aWNKcyIsImNvbmYiLCJzcmMiLCJoYXNoIiwiX3JlZjMiLCJjb250ZW50cyIsInBhdGhuYW1lIiwicHJvY2VzcyIsImVudiIsIk1FVEVPUl9BUFBfQ1VTVE9NX1NDUklQVF9VUkwiLCJyZUVtcHR5U3RyaW5nTGVhZGluZyIsInJlRW1wdHlTdHJpbmdNaWRkbGUiLCJyZUVtcHR5U3RyaW5nVHJhaWxpbmciLCJyZUVzY2FwZSIsInJlRXZhbHVhdGUiLCJyZUludGVycG9sYXRlIiwicmVFc1RlbXBsYXRlIiwicmVVbmVzY2FwZWRTdHJpbmciLCJodG1sRXNjYXBlcyIsInJlSGFzVW5lc2NhcGVkSHRtbCIsImVzY2FwZUh0bWwiLCJzdHJpbmciLCJ0ZXN0IiwicmVwbGFjZSIsImNociIsImVzY2FwZXMiLCJlc2NhcGVTdHJpbmdDaGFyIiwibWF0Y2giLCJpc09iamVjdCIsInRvU3RyaW5nU2FmZSIsImJhc2VWYWx1ZXMiLCJvYmplY3QiLCJwcm9wcyIsImsiLCJhdHRlbXB0IiwiZm4iLCJlIiwiaXNFcnJvciIsIm5hbWUiLCJ0ZW1wbGF0ZUNvdW50ZXIiLCJfdGVtcGxhdGUiLCJpbXBvcnRzIiwiZXNjYXBlIiwiaW1wb3J0S2V5cyIsImltcG9ydFZhbHVlcyIsImluZGV4IiwiaXNFc2NhcGluZyIsImlzRXZhbHVhdGluZyIsInNvdXJjZSIsInJlRGVsaW1pdGVycyIsIlJlZ0V4cCIsInNvdXJjZVVSTCIsImVzY2FwZVZhbHVlIiwiaW50ZXJwb2xhdGVWYWx1ZSIsImVzVGVtcGxhdGVWYWx1ZSIsImV2YWx1YXRlVmFsdWUiLCJvZmZzZXQiLCJzbGljZSIsInJlc3VsdCIsIkZ1bmN0aW9uIiwiYXBwbHkiLCJ0ZXh0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBLElBQUlBLGFBQWE7SUFBQ0MsTUFBTSxDQUFDQyxJQUFJLENBQUMsc0NBQXNDLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUNKLGFBQWEsR0FBQ0ksQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFyR0gsTUFBTSxDQUFDSSxNQUFNLENBQUM7TUFBQ0MsV0FBVyxFQUFDQSxDQUFBLEtBQUlBO0lBQVcsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsWUFBWTtJQUFDTixNQUFNLENBQUNDLElBQUksQ0FBQyxJQUFJLEVBQUM7TUFBQ0ssWUFBWUEsQ0FBQ0gsQ0FBQyxFQUFDO1FBQUNHLFlBQVksR0FBQ0gsQ0FBQztNQUFBO0lBQUMsQ0FBQyxF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QUNoQyxPQUFPeUIsUUFBUSxDQUFDaEIsVUFBVSxFQUFFUSxTQUFTLEdBQUcsU0FBUyxHQUFHSCxNQUFNLENBQUMsQ0FBQ1ksS0FBSyxDQUFDdEksU0FBUyxFQUFFc0gsWUFBWSxDQUFDLENBQUMsQ0FBQztFQUM5RixDQUFDLENBQUM7RUFFRixJQUFJUCxPQUFPLENBQUNxQixNQUFNLENBQUMsRUFBRTtJQUNuQkEsTUFBTSxDQUFDVixNQUFNLEdBQUdBLE1BQU0sQ0FBQyxDQUFDO0lBQ3hCLE1BQU1VLE1BQU07RUFDZDtFQUNBO0VBQ0FBLE1BQU0sQ0FBQ1YsTUFBTSxHQUFHQSxNQUFNO0VBQ3RCLE9BQU9VLE1BQU07QUFDZjtBQUVlLFNBQVNoRixRQUFRQSxDQUFDbUYsSUFBSSxFQUFFO0VBQ3JDLE9BQU9yQixTQUFTLENBQUNxQixJQUFJLENBQUM7QUFDeEIsQyIsImZpbGUiOiIvcGFja2FnZXMvYm9pbGVycGxhdGUtZ2VuZXJhdG9yLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtyZWFkRmlsZVN5bmN9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGNyZWF0ZSBhcyBjcmVhdGVTdHJlYW0gfSBmcm9tIFwiY29tYmluZWQtc3RyZWFtMlwiO1xuXG5pbXBvcnQgeyBoZWFkVGVtcGxhdGUgYXMgbW9kZXJuSGVhZFRlbXBsYXRlLCBjbG9zZVRlbXBsYXRlIGFzIG1vZGVybkNsb3NlVGVtcGxhdGUgfSBmcm9tICcuL3RlbXBsYXRlLXdlYi5icm93c2VyJztcbmltcG9ydCB7IGhlYWRUZW1wbGF0ZSBhcyBjb3Jkb3ZhSGVhZFRlbXBsYXRlLCBjbG9zZVRlbXBsYXRlIGFzIGNvcmRvdmFDbG9zZVRlbXBsYXRlIH0gZnJvbSAnLi90ZW1wbGF0ZS13ZWIuY29yZG92YSc7XG5cbi8vIENvcGllZCBmcm9tIHdlYmFwcF9zZXJ2ZXJcbmNvbnN0IHJlYWRVdGY4RmlsZVN5bmMgPSBmaWxlbmFtZSA9PiByZWFkRmlsZVN5bmMoZmlsZW5hbWUsICd1dGY4Jyk7XG5cbmNvbnN0IGlkZW50aXR5ID0gdmFsdWUgPT4gdmFsdWU7XG5cbmZ1bmN0aW9uIGFwcGVuZFRvU3RyZWFtKGNodW5rLCBzdHJlYW0pIHtcbiAgaWYgKHR5cGVvZiBjaHVuayA9PT0gXCJzdHJpbmdcIikge1xuICAgIHN0cmVhbS5hcHBlbmQoQnVmZmVyLmZyb20oY2h1bmssIFwidXRmOFwiKSk7XG4gIH0gZWxzZSBpZiAoQnVmZmVyLmlzQnVmZmVyKGNodW5rKSB8fFxuICAgICAgICAgICAgIHR5cGVvZiBjaHVuay5yZWFkID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBzdHJlYW0uYXBwZW5kKGNodW5rKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgQm9pbGVycGxhdGUge1xuICBjb25zdHJ1Y3RvcihhcmNoLCBtYW5pZmVzdCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgeyBoZWFkVGVtcGxhdGUsIGNsb3NlVGVtcGxhdGUgfSA9IGdldFRlbXBsYXRlKGFyY2gpO1xuICAgIHRoaXMuaGVhZFRlbXBsYXRlID0gaGVhZFRlbXBsYXRlO1xuICAgIHRoaXMuY2xvc2VUZW1wbGF0ZSA9IGNsb3NlVGVtcGxhdGU7XG4gICAgdGhpcy5iYXNlRGF0YSA9IG51bGw7XG5cbiAgICB0aGlzLl9nZW5lcmF0ZUJvaWxlcnBsYXRlRnJvbU1hbmlmZXN0KFxuICAgICAgbWFuaWZlc3QsXG4gICAgICBvcHRpb25zXG4gICAgKTtcbiAgfVxuXG4gIHRvSFRNTChleHRyYURhdGEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIlRoZSBCb2lsZXJwbGF0ZSN0b0hUTUwgbWV0aG9kIGhhcyBiZWVuIHJlbW92ZWQuIFwiICtcbiAgICAgICAgXCJQbGVhc2UgdXNlIEJvaWxlcnBsYXRlI3RvSFRNTFN0cmVhbSBpbnN0ZWFkLlwiXG4gICAgKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYSBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYSBzdHJpbmcgb2YgSFRNTC5cbiAgdG9IVE1MQXN5bmMoZXh0cmFEYXRhKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IHN0cmVhbSA9IHRoaXMudG9IVE1MU3RyZWFtKGV4dHJhRGF0YSk7XG4gICAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICAgIHN0cmVhbS5vbihcImRhdGFcIiwgY2h1bmsgPT4gY2h1bmtzLnB1c2goY2h1bmspKTtcbiAgICAgIHN0cmVhbS5vbihcImVuZFwiLCAoKSA9PiB7XG4gICAgICAgIHJlc29sdmUoQnVmZmVyLmNvbmNhdChjaHVua3MpLnRvU3RyaW5nKFwidXRmOFwiKSk7XG4gICAgICB9KTtcbiAgICAgIHN0cmVhbS5vbihcImVycm9yXCIsIHJlamVjdCk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBUaGUgJ2V4dHJhRGF0YScgYXJndW1lbnQgY2FuIGJlIHVzZWQgdG8gZXh0ZW5kICdzZWxmLmJhc2VEYXRhJy4gSXRzXG4gIC8vIHB1cnBvc2UgaXMgdG8gYWxsb3cgeW91IHRvIHNwZWNpZnkgZGF0YSB0aGF0IHlvdSBtaWdodCBub3Qga25vdyBhdFxuICAvLyB0aGUgdGltZSB0aGF0IHlvdSBjb25zdHJ1Y3QgdGhlIEJvaWxlcnBsYXRlIG9iamVjdC4gKGUuZy4gaXQgaXMgdXNlZFxuICAvLyBieSAnd2ViYXBwJyB0byBzcGVjaWZ5IGRhdGEgdGhhdCBpcyBvbmx5IGtub3duIGF0IHJlcXVlc3QtdGltZSkuXG4gIC8vIHRoaXMgcmV0dXJucyBhIHN0cmVhbVxuICB0b0hUTUxTdHJlYW0oZXh0cmFEYXRhKSB7XG4gICAgaWYgKCF0aGlzLmJhc2VEYXRhIHx8ICF0aGlzLmhlYWRUZW1wbGF0ZSB8fCAhdGhpcy5jbG9zZVRlbXBsYXRlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JvaWxlcnBsYXRlIGRpZCBub3QgaW5zdGFudGlhdGUgY29ycmVjdGx5LicpO1xuICAgIH1cblxuICAgIGNvbnN0IGRhdGEgPSB7Li4udGhpcy5iYXNlRGF0YSwgLi4uZXh0cmFEYXRhfTtcbiAgICBjb25zdCBzdGFydCA9IFwiPCFET0NUWVBFIGh0bWw+XFxuXCIgKyB0aGlzLmhlYWRUZW1wbGF0ZShkYXRhKTtcblxuICAgIGNvbnN0IHsgYm9keSwgZHluYW1pY0JvZHkgfSA9IGRhdGE7XG5cbiAgICBjb25zdCBlbmQgPSB0aGlzLmNsb3NlVGVtcGxhdGUoZGF0YSk7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBjcmVhdGVTdHJlYW0oKTtcblxuICAgIGFwcGVuZFRvU3RyZWFtKHN0YXJ0LCByZXNwb25zZSk7XG5cbiAgICBpZiAoYm9keSkge1xuICAgICAgYXBwZW5kVG9TdHJlYW0oYm9keSwgcmVzcG9uc2UpO1xuICAgIH1cblxuICAgIGlmIChkeW5hbWljQm9keSkge1xuICAgICAgYXBwZW5kVG9TdHJlYW0oZHluYW1pY0JvZHksIHJlc3BvbnNlKTtcbiAgICB9XG5cbiAgICBhcHBlbmRUb1N0cmVhbShlbmQsIHJlc3BvbnNlKTtcblxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfVxuXG4gIC8vIFhYWCBFeHBvcnRlZCB0byBhbGxvdyBjbGllbnQtc2lkZSBvbmx5IGNoYW5nZXMgdG8gcmVidWlsZCB0aGUgYm9pbGVycGxhdGVcbiAgLy8gd2l0aG91dCByZXF1aXJpbmcgYSBmdWxsIHNlcnZlciByZXN0YXJ0LlxuICAvLyBQcm9kdWNlcyBhbiBIVE1MIHN0cmluZyB3aXRoIGdpdmVuIG1hbmlmZXN0IGFuZCBib2lsZXJwbGF0ZVNvdXJjZS5cbiAgLy8gT3B0aW9uYWxseSB0YWtlcyB1cmxNYXBwZXIgaW4gY2FzZSB1cmxzIGZyb20gbWFuaWZlc3QgbmVlZCB0byBiZSBwcmVmaXhlZFxuICAvLyBvciByZXdyaXR0ZW4uXG4gIC8vIE9wdGlvbmFsbHkgdGFrZXMgcGF0aE1hcHBlciBmb3IgcmVzb2x2aW5nIHJlbGF0aXZlIGZpbGUgc3lzdGVtIHBhdGhzLlxuICAvLyBPcHRpb25hbGx5IGFsbG93cyB0byBvdmVycmlkZSBmaWVsZHMgb2YgdGhlIGRhdGEgY29udGV4dC5cbiAgX2dlbmVyYXRlQm9pbGVycGxhdGVGcm9tTWFuaWZlc3QobWFuaWZlc3QsIHtcbiAgICB1cmxNYXBwZXIgPSBpZGVudGl0eSxcbiAgICBwYXRoTWFwcGVyID0gaWRlbnRpdHksXG4gICAgYmFzZURhdGFFeHRlbnNpb24sXG4gICAgaW5saW5lLFxuICB9ID0ge30pIHtcblxuICAgIGNvbnN0IGJvaWxlcnBsYXRlQmFzZURhdGEgPSB7XG4gICAgICBjc3M6IFtdLFxuICAgICAganM6IFtdLFxuICAgICAgaGVhZDogJycsXG4gICAgICBib2R5OiAnJyxcbiAgICAgIG1ldGVvck1hbmlmZXN0OiBKU09OLnN0cmluZ2lmeShtYW5pZmVzdCksXG4gICAgICAuLi5iYXNlRGF0YUV4dGVuc2lvbixcbiAgICB9O1xuXG4gICAgbWFuaWZlc3QuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgIGNvbnN0IHVybFBhdGggPSB1cmxNYXBwZXIoaXRlbS51cmwpO1xuICAgICAgY29uc3QgaXRlbU9iaiA9IHsgdXJsOiB1cmxQYXRoIH07XG5cbiAgICAgIGlmIChpbmxpbmUpIHtcbiAgICAgICAgaXRlbU9iai5zY3JpcHRDb250ZW50ID0gcmVhZFV0ZjhGaWxlU3luYyhcbiAgICAgICAgICBwYXRoTWFwcGVyKGl0ZW0ucGF0aCkpO1xuICAgICAgICBpdGVtT2JqLmlubGluZSA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKGl0ZW0uc3JpKSB7XG4gICAgICAgIGl0ZW1PYmouc3JpID0gaXRlbS5zcmk7XG4gICAgICB9XG5cbiAgICAgIGlmIChpdGVtLnR5cGUgPT09ICdjc3MnICYmIGl0ZW0ud2hlcmUgPT09ICdjbGllbnQnKSB7XG4gICAgICAgIGJvaWxlcnBsYXRlQmFzZURhdGEuY3NzLnB1c2goaXRlbU9iaik7XG4gICAgICB9XG5cbiAgICAgIGlmIChpdGVtLnR5cGUgPT09ICdqcycgJiYgaXRlbS53aGVyZSA9PT0gJ2NsaWVudCcgJiZcbiAgICAgICAgLy8gRHluYW1pYyBKUyBtb2R1bGVzIHNob3VsZCBub3QgYmUgbG9hZGVkIGVhZ2VybHkgaW4gdGhlXG4gICAgICAgIC8vIGluaXRpYWwgSFRNTCBvZiB0aGUgYXBwLlxuICAgICAgICAhaXRlbS5wYXRoLnN0YXJ0c1dpdGgoJ2R5bmFtaWMvJykpIHtcbiAgICAgICAgYm9pbGVycGxhdGVCYXNlRGF0YS5qcy5wdXNoKGl0ZW1PYmopO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXRlbS50eXBlID09PSAnaGVhZCcpIHtcbiAgICAgICAgYm9pbGVycGxhdGVCYXNlRGF0YS5oZWFkID1cbiAgICAgICAgICByZWFkVXRmOEZpbGVTeW5jKHBhdGhNYXBwZXIoaXRlbS5wYXRoKSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChpdGVtLnR5cGUgPT09ICdib2R5Jykge1xuICAgICAgICBib2lsZXJwbGF0ZUJhc2VEYXRhLmJvZHkgPVxuICAgICAgICAgIHJlYWRVdGY4RmlsZVN5bmMocGF0aE1hcHBlcihpdGVtLnBhdGgpKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuYmFzZURhdGEgPSBib2lsZXJwbGF0ZUJhc2VEYXRhO1xuICB9XG59O1xuXG4vLyBSZXR1cm5zIGEgdGVtcGxhdGUgZnVuY3Rpb24gdGhhdCwgd2hlbiBjYWxsZWQsIHByb2R1Y2VzIHRoZSBib2lsZXJwbGF0ZVxuLy8gaHRtbCBhcyBhIHN0cmluZy5cbmZ1bmN0aW9uIGdldFRlbXBsYXRlKGFyY2gpIHtcbiAgY29uc3QgcHJlZml4ID0gYXJjaC5zcGxpdChcIi5cIiwgMikuam9pbihcIi5cIik7XG5cbiAgaWYgKHByZWZpeCA9PT0gXCJ3ZWIuYnJvd3NlclwiKSB7XG4gICAgcmV0dXJuIHsgaGVhZFRlbXBsYXRlOiBtb2Rlcm5IZWFkVGVtcGxhdGUsIGNsb3NlVGVtcGxhdGU6IG1vZGVybkNsb3NlVGVtcGxhdGUgfTtcbiAgfVxuXG4gIGlmIChwcmVmaXggPT09IFwid2ViLmNvcmRvdmFcIikge1xuICAgIHJldHVybiB7IGhlYWRUZW1wbGF0ZTogY29yZG92YUhlYWRUZW1wbGF0ZSwgY2xvc2VUZW1wbGF0ZTogY29yZG92YUNsb3NlVGVtcGxhdGUgfTtcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGFyY2g6IFwiICsgYXJjaCk7XG59XG4iLCJpbXBvcnQgdGVtcGxhdGUgZnJvbSAnLi90ZW1wbGF0ZSc7XG5cbmNvbnN0IHNyaSA9IChzcmksIG1vZGUpID0+XG4gIChzcmkgJiYgbW9kZSkgPyBgIGludGVncml0eT1cInNoYTUxMi0ke3NyaX1cIiBjcm9zc29yaWdpbj1cIiR7bW9kZX1cImAgOiAnJztcblxuZXhwb3J0IGNvbnN0IGhlYWRUZW1wbGF0ZSA9ICh7XG4gIGNzcyxcbiAgaHRtbEF0dHJpYnV0ZXMsXG4gIGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rLFxuICBzcmlNb2RlLFxuICBoZWFkLFxuICBkeW5hbWljSGVhZCxcbn0pID0+IHtcbiAgdmFyIGhlYWRTZWN0aW9ucyA9IGhlYWQuc3BsaXQoLzxtZXRlb3ItYnVuZGxlZC1jc3NbXjw+XSo+LywgMik7XG4gIHZhciBjc3NCdW5kbGUgPSBbLi4uKGNzcyB8fCBbXSkubWFwKGZpbGUgPT5cbiAgICB0ZW1wbGF0ZSgnICA8bGluayByZWw9XCJzdHlsZXNoZWV0XCIgdHlwZT1cInRleHQvY3NzXCIgY2xhc3M9XCJfX21ldGVvci1jc3NfX1wiIGhyZWY9XCI8JS0gaHJlZiAlPlwiPCU9IHNyaSAlPj4nKSh7XG4gICAgICBocmVmOiBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayhmaWxlLnVybCksXG4gICAgICBzcmk6IHNyaShmaWxlLnNyaSwgc3JpTW9kZSksXG4gICAgfSlcbiAgKV0uam9pbignXFxuJyk7XG5cbiAgcmV0dXJuIFtcbiAgICAnPGh0bWwnICsgT2JqZWN0LmtleXMoaHRtbEF0dHJpYnV0ZXMgfHwge30pLm1hcChcbiAgICAgIGtleSA9PiB0ZW1wbGF0ZSgnIDwlPSBhdHRyTmFtZSAlPj1cIjwlLSBhdHRyVmFsdWUgJT5cIicpKHtcbiAgICAgICAgYXR0ck5hbWU6IGtleSxcbiAgICAgICAgYXR0clZhbHVlOiBodG1sQXR0cmlidXRlc1trZXldLFxuICAgICAgfSlcbiAgICApLmpvaW4oJycpICsgJz4nLFxuXG4gICAgJzxoZWFkPicsXG5cbiAgICAoaGVhZFNlY3Rpb25zLmxlbmd0aCA9PT0gMSlcbiAgICAgID8gW2Nzc0J1bmRsZSwgaGVhZFNlY3Rpb25zWzBdXS5qb2luKCdcXG4nKVxuICAgICAgOiBbaGVhZFNlY3Rpb25zWzBdLCBjc3NCdW5kbGUsIGhlYWRTZWN0aW9uc1sxXV0uam9pbignXFxuJyksXG5cbiAgICBkeW5hbWljSGVhZCxcbiAgICAnPC9oZWFkPicsXG4gICAgJzxib2R5PicsXG4gIF0uam9pbignXFxuJyk7XG59O1xuXG4vLyBUZW1wbGF0ZSBmdW5jdGlvbiBmb3IgcmVuZGVyaW5nIHRoZSBib2lsZXJwbGF0ZSBodG1sIGZvciBicm93c2Vyc1xuZXhwb3J0IGNvbnN0IGNsb3NlVGVtcGxhdGUgPSAoe1xuICBtZXRlb3JSdW50aW1lQ29uZmlnLFxuICBtZXRlb3JSdW50aW1lSGFzaCxcbiAgcm9vdFVybFBhdGhQcmVmaXgsXG4gIGlubGluZVNjcmlwdHNBbGxvd2VkLFxuICBqcyxcbiAgYWRkaXRpb25hbFN0YXRpY0pzLFxuICBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayxcbiAgc3JpTW9kZSxcbn0pID0+IFtcbiAgJycsXG4gIGlubGluZVNjcmlwdHNBbGxvd2VkXG4gICAgPyB0ZW1wbGF0ZSgnICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIj5fX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fID0gSlNPTi5wYXJzZShkZWNvZGVVUklDb21wb25lbnQoPCU9IGNvbmYgJT4pKTwvc2NyaXB0PicpKHtcbiAgICAgIGNvbmY6IG1ldGVvclJ1bnRpbWVDb25maWcsXG4gICAgfSlcbiAgICA6IHRlbXBsYXRlKCcgIDxzY3JpcHQgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiIHNyYz1cIjwlLSBzcmMgJT4vbWV0ZW9yX3J1bnRpbWVfY29uZmlnLmpzP2hhc2g9PCUtIGhhc2ggJT5cIj48L3NjcmlwdD4nKSh7XG4gICAgICBzcmM6IHJvb3RVcmxQYXRoUHJlZml4LFxuICAgICAgaGFzaDogbWV0ZW9yUnVudGltZUhhc2gsXG4gICAgfSksXG4gICcnLFxuXG4gIC4uLihqcyB8fCBbXSkubWFwKGZpbGUgPT5cbiAgICB0ZW1wbGF0ZSgnICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIiBzcmM9XCI8JS0gc3JjICU+XCI8JT0gc3JpICU+Pjwvc2NyaXB0PicpKHtcbiAgICAgIHNyYzogYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2soZmlsZS51cmwpLFxuICAgICAgc3JpOiBzcmkoZmlsZS5zcmksIHNyaU1vZGUpLFxuICAgIH0pXG4gICksXG5cbiAgLi4uKGFkZGl0aW9uYWxTdGF0aWNKcyB8fCBbXSkubWFwKCh7IGNvbnRlbnRzLCBwYXRobmFtZSB9KSA9PiAoXG4gICAgaW5saW5lU2NyaXB0c0FsbG93ZWRcbiAgICAgID8gdGVtcGxhdGUoJyAgPHNjcmlwdD48JT0gY29udGVudHMgJT48L3NjcmlwdD4nKSh7XG4gICAgICAgIGNvbnRlbnRzLFxuICAgICAgfSlcbiAgICAgIDogdGVtcGxhdGUoJyAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCIgc3JjPVwiPCUtIHNyYyAlPlwiPjwvc2NyaXB0PicpKHtcbiAgICAgICAgc3JjOiByb290VXJsUGF0aFByZWZpeCArIHBhdGhuYW1lLFxuICAgICAgfSlcbiAgKSksXG4gIHByb2Nlc3MuZW52Lk1FVEVPUl9BUFBfQ1VTVE9NX1NDUklQVF9VUkwgP1xuICAgIHRlbXBsYXRlKFwiICA8c2NyaXB0IHR5cGU9XFxcInRleHQvamF2YXNjcmlwdFxcXCIgc3JjPVxcXCI8JS0gc3JjICU+XFxcIj48L3NjcmlwdD5cIikoe1xuICAgICAgc3JjOiBwcm9jZXNzLmVudi5NRVRFT1JfQVBQX0NVU1RPTV9TQ1JJUFRfVVJMXG4gICAgfSlcbiAgICA6ICcnLFxuICAnJyxcbiAgJycsXG4gICc8L2JvZHk+JyxcbiAgJzwvaHRtbD4nXG5dLmpvaW4oJ1xcbicpO1xuIiwiaW1wb3J0IHRlbXBsYXRlIGZyb20gJy4vdGVtcGxhdGUnO1xuXG4vLyBUZW1wbGF0ZSBmdW5jdGlvbiBmb3IgcmVuZGVyaW5nIHRoZSBib2lsZXJwbGF0ZSBodG1sIGZvciBjb3Jkb3ZhXG5leHBvcnQgY29uc3QgaGVhZFRlbXBsYXRlID0gKHtcbiAgbWV0ZW9yUnVudGltZUNvbmZpZyxcbiAgcm9vdFVybFBhdGhQcmVmaXgsXG4gIGlubGluZVNjcmlwdHNBbGxvd2VkLFxuICBjc3MsXG4gIGpzLFxuICBhZGRpdGlvbmFsU3RhdGljSnMsXG4gIGh0bWxBdHRyaWJ1dGVzLFxuICBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayxcbiAgaGVhZCxcbiAgZHluYW1pY0hlYWQsXG59KSA9PiB7XG4gIHZhciBoZWFkU2VjdGlvbnMgPSBoZWFkLnNwbGl0KC88bWV0ZW9yLWJ1bmRsZWQtY3NzW148Pl0qPi8sIDIpO1xuICB2YXIgY3NzQnVuZGxlID0gW1xuICAgIC8vIFdlIGFyZSBleHBsaWNpdGx5IG5vdCB1c2luZyBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vazogaW4gY29yZG92YSB3ZSBzZXJ2ZSBhc3NldHMgdXAgZGlyZWN0bHkgZnJvbSBkaXNrLCBzbyByZXdyaXRpbmcgdGhlIFVSTCBkb2VzIG5vdCBtYWtlIHNlbnNlXG4gICAgLi4uKGNzcyB8fCBbXSkubWFwKGZpbGUgPT5cbiAgICAgIHRlbXBsYXRlKCcgIDxsaW5rIHJlbD1cInN0eWxlc2hlZXRcIiB0eXBlPVwidGV4dC9jc3NcIiBjbGFzcz1cIl9fbWV0ZW9yLWNzc19fXCIgaHJlZj1cIjwlLSBocmVmICU+XCI+Jykoe1xuICAgICAgICBocmVmOiBmaWxlLnVybCxcbiAgICAgIH0pXG4gICldLmpvaW4oJ1xcbicpO1xuXG4gIHJldHVybiBbXG4gICAgJzxodG1sPicsXG4gICAgJzxoZWFkPicsXG4gICAgJyAgPG1ldGEgY2hhcnNldD1cInV0Zi04XCI+JyxcbiAgICAnICA8bWV0YSBuYW1lPVwiZm9ybWF0LWRldGVjdGlvblwiIGNvbnRlbnQ9XCJ0ZWxlcGhvbmU9bm9cIj4nLFxuICAgICcgIDxtZXRhIG5hbWU9XCJ2aWV3cG9ydFwiIGNvbnRlbnQ9XCJ1c2VyLXNjYWxhYmxlPW5vLCBpbml0aWFsLXNjYWxlPTEsIG1heGltdW0tc2NhbGU9MSwgbWluaW11bS1zY2FsZT0xLCB3aWR0aD1kZXZpY2Utd2lkdGgsIGhlaWdodD1kZXZpY2UtaGVpZ2h0LCB2aWV3cG9ydC1maXQ9Y292ZXJcIj4nLFxuICAgICcgIDxtZXRhIG5hbWU9XCJtc2FwcGxpY2F0aW9uLXRhcC1oaWdobGlnaHRcIiBjb250ZW50PVwibm9cIj4nLFxuICAgICcgIDxtZXRhIGh0dHAtZXF1aXY9XCJDb250ZW50LVNlY3VyaXR5LVBvbGljeVwiIGNvbnRlbnQ9XCJkZWZhdWx0LXNyYyAqIGFuZHJvaWQtd2Vidmlldy12aWRlby1wb3N0ZXI6IGdhcDogZGF0YTogYmxvYjogXFwndW5zYWZlLWlubGluZVxcJyBcXCd1bnNhZmUtZXZhbFxcJyB3czogd3NzOjtcIj4nLFxuXG4gIChoZWFkU2VjdGlvbnMubGVuZ3RoID09PSAxKVxuICAgID8gW2Nzc0J1bmRsZSwgaGVhZFNlY3Rpb25zWzBdXS5qb2luKCdcXG4nKVxuICAgIDogW2hlYWRTZWN0aW9uc1swXSwgY3NzQnVuZGxlLCBoZWFkU2VjdGlvbnNbMV1dLmpvaW4oJ1xcbicpLFxuXG4gICAgJyAgPHNjcmlwdCB0eXBlPVwidGV4dC9qYXZhc2NyaXB0XCI+JyxcbiAgICB0ZW1wbGF0ZSgnICAgIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18gPSBKU09OLnBhcnNlKGRlY29kZVVSSUNvbXBvbmVudCg8JT0gY29uZiAlPikpOycpKHtcbiAgICAgIGNvbmY6IG1ldGVvclJ1bnRpbWVDb25maWcsXG4gICAgfSksXG4gICAgJyAgICBpZiAoL0FuZHJvaWQvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpKSB7JyxcbiAgICAvLyBXaGVuIEFuZHJvaWQgYXBwIGlzIGVtdWxhdGVkLCBpdCBjYW5ub3QgY29ubmVjdCB0byBsb2NhbGhvc3QsXG4gICAgLy8gaW5zdGVhZCBpdCBzaG91bGQgY29ubmVjdCB0byAxMC4wLjIuMlxuICAgIC8vICh1bmxlc3Mgd2VcXCdyZSB1c2luZyBhbiBodHRwIHByb3h5OyB0aGVuIGl0IHdvcmtzISlcbiAgICAnICAgICAgaWYgKCFfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLmh0dHBQcm94eVBvcnQpIHsnLFxuICAgICcgICAgICAgIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkwgPSAoX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTCB8fCBcXCdcXCcpLnJlcGxhY2UoL2xvY2FsaG9zdC9pLCBcXCcxMC4wLjIuMlxcJyk7JyxcbiAgICAnICAgICAgICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLkREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMID0gKF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkwgfHwgXFwnXFwnKS5yZXBsYWNlKC9sb2NhbGhvc3QvaSwgXFwnMTAuMC4yLjJcXCcpOycsXG4gICAgJyAgICAgIH0nLFxuICAgICcgICAgfScsXG4gICAgJyAgPC9zY3JpcHQ+JyxcbiAgICAnJyxcbiAgICAnICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIiBzcmM9XCIvY29yZG92YS5qc1wiPjwvc2NyaXB0PicsXG5cbiAgICAuLi4oanMgfHwgW10pLm1hcChmaWxlID0+XG4gICAgICB0ZW1wbGF0ZSgnICA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIiBzcmM9XCI8JS0gc3JjICU+XCI+PC9zY3JpcHQ+Jykoe1xuICAgICAgICBzcmM6IGZpbGUudXJsLFxuICAgICAgfSlcbiAgICApLFxuXG4gICAgLi4uKGFkZGl0aW9uYWxTdGF0aWNKcyB8fCBbXSkubWFwKCh7IGNvbnRlbnRzLCBwYXRobmFtZSB9KSA9PiAoXG4gICAgICBpbmxpbmVTY3JpcHRzQWxsb3dlZFxuICAgICAgICA/IHRlbXBsYXRlKCcgIDxzY3JpcHQ+PCU9IGNvbnRlbnRzICU+PC9zY3JpcHQ+Jykoe1xuICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICB9KVxuICAgICAgICA6IHRlbXBsYXRlKCcgIDxzY3JpcHQgdHlwZT1cInRleHQvamF2YXNjcmlwdFwiIHNyYz1cIjwlLSBzcmMgJT5cIj48L3NjcmlwdD4nKSh7XG4gICAgICAgICAgc3JjOiByb290VXJsUGF0aFByZWZpeCArIHBhdGhuYW1lXG4gICAgICAgIH0pXG4gICAgKSksXG4gICAgJycsXG4gICAgJzwvaGVhZD4nLFxuICAgICcnLFxuICAgICc8Ym9keT4nLFxuICBdLmpvaW4oJ1xcbicpO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlVGVtcGxhdGUoKSB7XG4gIHJldHVybiBcIjwvYm9keT5cXG48L2h0bWw+XCI7XG59XG4iLCIvKipcbiAqIEludGVybmFsIGZ1bGwtZmVhdHVyZWQgaW1wbGVtZW50YXRpb24gb2YgbG9kYXNoLnRlbXBsYXRlIChpbnNwaXJlZCBieSB2NC41LjApXG4gKiBlbWJlZGRlZCB0byBlbGltaW5hdGUgdGhlIGV4dGVybmFsIGRlcGVuZGVuY3kgd2hpbGUgcHJlc2VydmluZyBmdW5jdGlvbmFsaXR5LlxuICpcbiAqIE1JVCBMaWNlbnNlIChjKSBKUyBGb3VuZGF0aW9uIGFuZCBvdGhlciBjb250cmlidXRvcnMgPGh0dHBzOi8vanMuZm91bmRhdGlvbi8+XG4gKiBBZGFwdGVkIGZvciBNZXRlb3IgYm9pbGVycGxhdGUtZ2VuZXJhdG9yIChvbmx5IHRoZSBwaWVjZXMgcmVxdWlyZWQgYnkgdGVtcGxhdGUgd2VyZSBleHRyYWN0ZWQpLlxuICovXG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gVXRpbGl0eSAmIHJlZ2V4IGRlZmluaXRpb25zIChtaXJyb3JpbmcgbG9kYXNoIHBpZWNlcyB1c2VkIGJ5IHRlbXBsYXRlKVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmNvbnN0IHJlRW1wdHlTdHJpbmdMZWFkaW5nID0gL1xcYl9fcCBcXCs9ICcnOy9nO1xuY29uc3QgcmVFbXB0eVN0cmluZ01pZGRsZSA9IC9cXGIoX19wIFxcKz0pICcnIFxcKy9nO1xuY29uc3QgcmVFbXB0eVN0cmluZ1RyYWlsaW5nID0gLyhfX2VcXCguKj9cXCl8XFxiX190XFwpKSBcXCtcXG4nJzsvZztcblxuY29uc3QgcmVFc2NhcGUgPSAvPCUtKFtcXHNcXFNdKz8pJT4vZzsgICAgICAgICAgICAgIC8vIGVzY2FwZSBkZWxpbWl0ZXJcbmNvbnN0IHJlRXZhbHVhdGUgPSAvPCUoW1xcc1xcU10rPyklPi9nOyAgICAgICAgICAgICAgLy8gZXZhbHVhdGUgZGVsaW1pdGVyXG5jb25zdCByZUludGVycG9sYXRlID0gLzwlPShbXFxzXFxTXSs/KSU+L2c7ICAgICAgICAgIC8vIGludGVycG9sYXRlIGRlbGltaXRlclxuY29uc3QgcmVFc1RlbXBsYXRlID0gL1xcJFxceyhbXlxcXFx9XSooPzpcXFxcLlteXFxcXH1dKikqKVxcfS9nOyAvLyBFUzYgdGVtcGxhdGUgbGl0ZXJhbCBjYXB0dXJlXG5jb25zdCByZVVuZXNjYXBlZFN0cmluZyA9IC9bJ1xcXFxcXG5cXHJcXHUyMDI4XFx1MjAyOV0vZzsgLy8gc3RyaW5nIGxpdGVyYWwgZXNjYXBlc1xuXG4vLyBIVE1MIGVzY2FwZVxuY29uc3QgaHRtbEVzY2FwZXMgPSB7ICcmJzogJyZhbXA7JywgJzwnOiAnJmx0OycsICc+JzogJyZndDsnLCAnXCInOiAnJnF1b3Q7JywgXCInXCI6ICcmIzM5OycgfTtcbmNvbnN0IHJlSGFzVW5lc2NhcGVkSHRtbCA9IC9bJjw+XCInXS87XG5cbmZ1bmN0aW9uIGVzY2FwZUh0bWwoc3RyaW5nKSB7XG4gIHJldHVybiBzdHJpbmcgJiYgcmVIYXNVbmVzY2FwZWRIdG1sLnRlc3Qoc3RyaW5nKVxuICAgID8gc3RyaW5nLnJlcGxhY2UoL1smPD5cIiddL2csIGNociA9PiBodG1sRXNjYXBlc1tjaHJdKVxuICAgIDogKHN0cmluZyB8fCAnJyk7XG59XG5cbi8vIEVzY2FwZSBjaGFyYWN0ZXJzIGZvciBpbmNsdXNpb24gaW50byBhIHN0cmluZyBsaXRlcmFsXG5jb25zdCBlc2NhcGVzID0geyBcIidcIjogXCInXCIsICdcXFxcJzogJ1xcXFwnLCAnXFxuJzogJ24nLCAnXFxyJzogJ3InLCAnXFx1MjAyOCc6ICd1MjAyOCcsICdcXHUyMDI5JzogJ3UyMDI5JyB9O1xuZnVuY3Rpb24gZXNjYXBlU3RyaW5nQ2hhcihtYXRjaCkgeyByZXR1cm4gJ1xcXFwnICsgZXNjYXBlc1ttYXRjaF07IH1cblxuLy8gQmFzaWMgT2JqZWN0IGhlbHBlcnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnOyB9XG5mdW5jdGlvbiB0b1N0cmluZ1NhZmUodmFsdWUpIHsgcmV0dXJuIHZhbHVlID09IG51bGwgPyAnJyA6ICh2YWx1ZSArICcnKTsgfVxuZnVuY3Rpb24gYmFzZVZhbHVlcyhvYmplY3QsIHByb3BzKSB7IHJldHVybiBwcm9wcy5tYXAoayA9PiBvYmplY3Rba10pOyB9XG5cblxuZnVuY3Rpb24gYXR0ZW1wdChmbikge1xuICB0cnkgeyByZXR1cm4gZm4oKTsgfSBjYXRjaCAoZSkgeyByZXR1cm4gZTsgfVxufVxuZnVuY3Rpb24gaXNFcnJvcih2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBFcnJvciB8fCAoaXNPYmplY3QodmFsdWUpICYmIHZhbHVlLm5hbWUgPT09ICdFcnJvcicpOyB9XG5cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBNYWluIHRlbXBsYXRlIGltcGxlbWVudGF0aW9uXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmxldCB0ZW1wbGF0ZUNvdW50ZXIgPSAtMTsgLy8gdXNlZCBmb3Igc291cmNlVVJMIGdlbmVyYXRpb25cblxuZnVuY3Rpb24gX3RlbXBsYXRlKHN0cmluZykge1xuICBzdHJpbmcgPSB0b1N0cmluZ1NhZmUoc3RyaW5nKTtcblxuICBjb25zdCBpbXBvcnRzID0geyAnXyc6IHsgZXNjYXBlOiBlc2NhcGVIdG1sIH0gfTtcbiAgY29uc3QgaW1wb3J0S2V5cyA9IE9iamVjdC5rZXlzKGltcG9ydHMpO1xuICBjb25zdCBpbXBvcnRWYWx1ZXMgPSBiYXNlVmFsdWVzKGltcG9ydHMsIGltcG9ydEtleXMpO1xuXG4gIGxldCBpbmRleCA9IDA7XG4gIGxldCBpc0VzY2FwaW5nO1xuICBsZXQgaXNFdmFsdWF0aW5nO1xuICBsZXQgc291cmNlID0gXCJfX3AgKz0gJ1wiO1xuXG5cbiAgLy8gQnVpbGQgY29tYmluZWQgcmVnZXggb2YgZGVsaW1pdGVyc1xuICBjb25zdCByZURlbGltaXRlcnMgPSBSZWdFeHAoXG4gICAgcmVFc2NhcGUuc291cmNlICsgJ3wnICtcbiAgICByZUludGVycG9sYXRlLnNvdXJjZSArICd8JyArXG4gICAgcmVFc1RlbXBsYXRlLnNvdXJjZSArICd8JyArXG4gICAgcmVFdmFsdWF0ZS5zb3VyY2UgKyAnfCQnXG4gICwgJ2cnKTtcblxuICBjb25zdCBzb3VyY2VVUkwgPSBgLy8jIHNvdXJjZVVSTD1sb2Rhc2gudGVtcGxhdGVTb3VyY2VzWyR7Kyt0ZW1wbGF0ZUNvdW50ZXJ9XVxcbmA7XG5cbiAgLy8gVG9rZW5pemVcbiAgc3RyaW5nLnJlcGxhY2UocmVEZWxpbWl0ZXJzLCBmdW5jdGlvbihtYXRjaCwgZXNjYXBlVmFsdWUsIGludGVycG9sYXRlVmFsdWUsIGVzVGVtcGxhdGVWYWx1ZSwgZXZhbHVhdGVWYWx1ZSwgb2Zmc2V0KSB7XG4gICAgaW50ZXJwb2xhdGVWYWx1ZSB8fCAoaW50ZXJwb2xhdGVWYWx1ZSA9IGVzVGVtcGxhdGVWYWx1ZSk7XG4gICAgLy8gQXBwZW5kIHByZWNlZGluZyBzdHJpbmcgcG9ydGlvbiB3aXRoIGVzY2FwZWQgbGl0ZXJhbCBjaGFyc1xuICAgIHNvdXJjZSArPSBzdHJpbmcuc2xpY2UoaW5kZXgsIG9mZnNldCkucmVwbGFjZShyZVVuZXNjYXBlZFN0cmluZywgZXNjYXBlU3RyaW5nQ2hhcik7XG4gICAgaWYgKGVzY2FwZVZhbHVlKSB7XG4gICAgICBpc0VzY2FwaW5nID0gdHJ1ZTtcbiAgICAgIHNvdXJjZSArPSBcIicgK1xcbl9fZShcIiArIGVzY2FwZVZhbHVlICsgXCIpICtcXG4nXCI7XG4gICAgfVxuICAgIGlmIChldmFsdWF0ZVZhbHVlKSB7XG4gICAgICBpc0V2YWx1YXRpbmcgPSB0cnVlO1xuICAgICAgc291cmNlICs9IFwiJztcXG5cIiArIGV2YWx1YXRlVmFsdWUgKyBcIjtcXG5fX3AgKz0gJ1wiO1xuICAgIH1cbiAgICBpZiAoaW50ZXJwb2xhdGVWYWx1ZSkge1xuICAgICAgc291cmNlICs9IFwiJyArXFxuKChfX3QgPSAoXCIgKyBpbnRlcnBvbGF0ZVZhbHVlICsgXCIpKSA9PSBudWxsID8gJycgOiBfX3QpICtcXG4nXCI7XG4gICAgfVxuICAgIGluZGV4ID0gb2Zmc2V0ICsgbWF0Y2gubGVuZ3RoO1xuICAgIHJldHVybiBtYXRjaDtcbiAgfSk7XG5cbiAgc291cmNlICs9IFwiJztcXG5cIjtcblxuICBzb3VyY2UgPSAnd2l0aCAob2JqKSB7XFxuJyArIHNvdXJjZSArICdcXG59XFxuJztcblxuICAvLyBSZW1vdmUgdW5uZWNlc3NhcnkgY29uY2F0ZW5hdGlvbnNcbiAgc291cmNlID0gKGlzRXZhbHVhdGluZyA/IHNvdXJjZS5yZXBsYWNlKHJlRW1wdHlTdHJpbmdMZWFkaW5nLCAnJykgOiBzb3VyY2UpXG4gICAgLnJlcGxhY2UocmVFbXB0eVN0cmluZ01pZGRsZSwgJyQxJylcbiAgICAucmVwbGFjZShyZUVtcHR5U3RyaW5nVHJhaWxpbmcsICckMTsnKTtcblxuICAvLyBGcmFtZSBhcyBmdW5jdGlvbiBib2R5XG4gIHNvdXJjZSA9ICdmdW5jdGlvbihvYmopIHtcXG4nICtcbiAgICAnb2JqIHx8IChvYmogPSB7fSk7XFxuJyArXG4gICAgXCJ2YXIgX190LCBfX3AgPSAnJ1wiICtcbiAgICAoaXNFc2NhcGluZyA/ICcsIF9fZSA9IF8uZXNjYXBlJyA6ICcnKSArXG4gICAgKGlzRXZhbHVhdGluZ1xuICAgICAgPyAnLCBfX2ogPSBBcnJheS5wcm90b3R5cGUuam9pbjtcXG5mdW5jdGlvbiBwcmludCgpIHsgX19wICs9IF9fai5jYWxsKGFyZ3VtZW50cywgXFwnXFwnKSB9XFxuJ1xuICAgICAgOiAnO1xcbidcbiAgICApICtcbiAgICBzb3VyY2UgK1xuICAgICdyZXR1cm4gX19wXFxufSc7XG5cbiAgLy8gQWN0dWFsIGNvbXBpbGUgc3RlcFxuICBjb25zdCByZXN1bHQgPSBhdHRlbXB0KGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBGdW5jdGlvbihpbXBvcnRLZXlzLCBzb3VyY2VVUkwgKyAncmV0dXJuICcgKyBzb3VyY2UpLmFwcGx5KHVuZGVmaW5lZCwgaW1wb3J0VmFsdWVzKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZXctZnVuY1xuICB9KTtcblxuICBpZiAoaXNFcnJvcihyZXN1bHQpKSB7XG4gICAgcmVzdWx0LnNvdXJjZSA9IHNvdXJjZTsgLy8gZXhwb3NlIGZvciBkZWJ1Z2dpbmcgaWYgZXJyb3JcbiAgICB0aHJvdyByZXN1bHQ7XG4gIH1cbiAgLy8gRXhwb3NlIGNvbXBpbGVkIHNvdXJjZVxuICByZXN1bHQuc291cmNlID0gc291cmNlO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB0ZW1wbGF0ZSh0ZXh0KSB7XG4gIHJldHVybiBfdGVtcGxhdGUodGV4dCk7XG59XG4iXX0=
