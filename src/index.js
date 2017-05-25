/* eslint-env node */
import postcss from "postcss";
import valueParser from "postcss-value-parser";
import { createICSSRules } from "icss-utils";

const walkUrls = (parsed, callback) => {
  parsed.walk(node => {
    if (node.type === "function" && node.value === "url") {
      const content = node.nodes.length !== 0 && node.nodes[0].type === "string"
        ? node.nodes[0].value
        : valueParser.stringify(node.nodes);
      if (content.trim().length !== 0) {
        callback(node, content);
      }
      // do not traverse inside url
      return false;
    }
  });
};

const mapUrls = (parsed, map) => {
  walkUrls(parsed, (node, content) => {
    node.nodes = [{ type: "word", value: map(content) }];
  });
};

const filterUrls = (parsed, filter) => {
  const result = [];
  walkUrls(parsed, (node, content) => {
    if (filter(content)) {
      result.push(content);
    }
  });
  return result;
};

const walkDeclsWithUrl = (css, filter) => {
  const result = [];
  css.walkDecls(decl => {
    if (decl.value.includes("url(")) {
      const parsed = valueParser(decl.value);
      const values = filterUrls(parsed, filter);
      if (values.length) {
        result.push({
          decl,
          parsed,
          values
        });
      }
    }
  });
  return result;
};

const filterValues = value =>
  !/^\w+:\/\//.test(value) &&
  !value.startsWith("//") &&
  !value.startsWith("#") &&
  !value.startsWith("data:");

const flatten = array => array.reduce((acc, d) => [...acc, ...d], []);
const uniq = array =>
  array.reduce((acc, d) => (acc.indexOf(d) === -1 ? [...acc, d] : acc), []);

module.exports = postcss.plugin("postcss-icss-url", () => css => {
  const traversed = walkDeclsWithUrl(css, filterValues);
  const paths = uniq(flatten(traversed.map(item => item.values)));
  const imports = {};
  const aliases = {};

  paths.forEach((path, index) => {
    const alias = `__url_${index}`;
    imports[`'${path}'`] = {
      [alias]: "default"
    };
    aliases[path] = alias;
  });

  traversed.forEach(item => {
    mapUrls(item.parsed, value => aliases[value]);
    item.decl.value = item.parsed.toString();
  });

  css.prepend(createICSSRules(imports, {}));
});
