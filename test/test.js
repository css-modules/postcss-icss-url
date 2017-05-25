/* eslint-env jest */
import postcss from "postcss";
import stripIndent from "strip-indent";
import plugin from "../src";

const strip = input => stripIndent(input).replace(/^\n/, "");
const compile = input =>
  postcss([plugin]).process(input).then(result => result.css);
const run = (fixture, expected) =>
  expect(compile(strip(fixture))).resolves.toEqual(strip(expected));

test("parse url without quotes", () => {
  return run(
    `
      .foo { background: url(./path/to/file.png) }
    `,
    `
      :import('./path/to/file.png') {
        __url_0: default
      }
      .foo { background: url(__url_0) }
    `
  );
});

test("parse url with single quotes", () => {
  return run(
    `
      .foo { background: url('./path/to/file.png') }
    `,
    `
      :import('./path/to/file.png') {
        __url_0: default
      }
      .foo { background: url(__url_0) }
    `
  );
});

test("parse url with double quotes", () => {
  return run(
    `
      .foo { background: url("./path/to/file.png") }
    `,
    `
      :import('./path/to/file.png') {
        __url_0: default
      }
      .foo { background: url(__url_0) }
    `
  );
});

test("reuse dublicated path", () => {
  return run(
    `
      .foo { background: url(path) }
      .bar { background: url(path) }
    `,
    `
      :import('path') {
        __url_0: default
      }
      .foo { background: url(__url_0) }
      .bar { background: url(__url_0) }
    `
  );
});

test("increment local identifier index", () => {
  return run(
    `
      .foo { background: url(path1) }
      .bar { background: url(path2) }
    `,
    `
      :import('path1') {
        __url_0: default
      }
      :import('path2') {
        __url_1: default
      }
      .foo { background: url(__url_0) }
      .bar { background: url(__url_1) }
    `
  );
});

test("skip url in strings", () => {
  const fixture = `
    .foo {
      content: 'url(path/to/file.css)';
      display: block;
    }
  `;
  return run(fixture, fixture);
});

test("skip data, protocol, hash, empty url", () => {
  const fixture = `
    .foo {
      background: url(data:image);
      background: url(http://path);
      background: url(https://path);
      background: url(//path);
      background: url(#hash);
      background: url();
      background: url( );
      background: url(' ');
    }
  `;
  return run(fixture, fixture);
});
