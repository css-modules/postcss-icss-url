"use strict";

var _postcss = _interopRequireDefault(require("postcss"));

var _postcssValueParser = _interopRequireDefault(
  require("postcss-value-parser")
);

var _icssUtils = require("icss-utils");

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

/* eslint-env node */
const walkUrls = (parsed, callback) => {
  parsed.walk(node => {
    if (node.type === "function" && node.value.toLowerCase() === "url") {
      const content = (node.nodes.length !== 0 &&
      node.nodes[0].type === "string"
        ? node.nodes[0].value
        : _postcssValueParser.default.stringify(node.nodes)
      ).trim();

      if (content.length !== 0) {
        callback(node, content);
      } // do not traverse inside url

      return false;
    }
  });
};

const mapUrls = (parsed, map) => {
  walkUrls(parsed, (node, content) => {
    node.nodes = [
      {
        type: "word",
        value: map(content)
      }
    ];
  });
};

const filterUrls = (parsed, filter) => {
  const result = [];
  walkUrls(parsed, (node, content) => {
    if (filter && !filter(content)) {
      return;
    }

    result.push(content);
  });
  return result;
};

const walkDeclsWithUrl = (css, filter) => {
  const result = [];
  css.walkDecls(decl => {
    if (!/url\(/i.test(decl.value)) {
      return;
    }

    const parsed = (0, _postcssValueParser.default)(decl.value);
    const values = filterUrls(parsed, filter);

    if (values.length === 0) {
      return;
    }

    result.push({
      decl,
      parsed,
      values
    });
  });
  return result;
};

const defaultFilter = url =>
  !/^\w+:\/\//.test(url) &&
  !url.startsWith("//") &&
  !url.startsWith("#") &&
  !url.startsWith("data:");

const flatten = array => array.reduce((acc, d) => [...acc, ...d], []);

const uniq = array =>
  array.reduce((acc, d) => (acc.indexOf(d) === -1 ? [...acc, d] : acc), []);

module.exports = _postcss.default.plugin(
  "postcss-icss-url",
  (options = {}) => css => {
    const filter = options.filter || defaultFilter;
    const traversed = walkDeclsWithUrl(css, filter);

    if (traversed.length === 0) {
      return;
    }

    const paths = uniq(flatten(traversed.map(item => item.values)));
    const imports = {};
    const aliases = {};
    paths.forEach((path, index) => {
      const alias = `__url_${index}`;
      imports[`"${path}"`] = {
        [alias]: "default"
      };
      aliases[path] = alias;
    });
    traversed.forEach(item => {
      mapUrls(item.parsed, value => aliases[value]);
      item.decl.value = item.parsed.toString();
    });
    css.prepend((0, _icssUtils.createICSSRules)(imports, {}));
  }
);
