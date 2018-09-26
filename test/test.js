import postcss from "postcss";
import stripIndent from "strip-indent";
import plugin from "../src";

const strip = input => stripIndent(input).replace(/^\n/, "");
const compile = (input, opts) =>
  postcss([plugin(opts)]).process(input, { from: undefined });
const runCSS = (input, opts) =>
  compile(strip(input), opts).then(result => strip(result.css));

test("parse url", () => {
  return expect(
    runCSS(`
      .a { background: url(./path/to/file.png) }
      .b { background: url("./path/to/file.png") }
      .c { background: url('./path/to/file.png') }
      .d { background: url('./path/to/file.png') url('./path/to/file.png') }
      .e { background: url(   ./path/to/file.png   ) }
      .f { background: url(   "./path/to/file.png"   ) }
      .g { background: -webkit-image-set(url(./path/to/file.png) 1x, url(./path/to/file.png) 2x) }
    `)
  ).resolves.toEqual(
    strip(`
      :import("./path/to/file.png") {
        __url_0: default
      }
      .a { background: url(__url_0) }
      .b { background: url(__url_0) }
      .c { background: url(__url_0) }
      .d { background: url(__url_0) url(__url_0) }
      .e { background: url(   __url_0   ) }
      .f { background: url(   __url_0   ) }
      .g { background: -webkit-image-set(url(__url_0) 1x, url(__url_0) 2x) }
    `)
  );
});

test("parse uppercase url", () => {
  return expect(
    runCSS(`
      .foo { background: URL(./path/to/file.png) }
    `)
  ).resolves.toEqual(
    strip(`
      :import("./path/to/file.png") {
        __url_0: default
      }
      .foo { background: URL(__url_0) }
    `)
  );
});

test("reuse dublicated path", () => {
  return expect(
    runCSS(`
      .foo { background: url(path) }
      .bar { background: url(path) }
    `)
  ).resolves.toEqual(
    strip(`
      :import("path") {
        __url_0: default
      }
      .foo { background: url(__url_0) }
      .bar { background: url(__url_0) }
    `)
  );
});

test("increment local identifier index", () => {
  return expect(
    runCSS(`
      .foo { background: url(path1) }
      .bar { background: url(path2) }
      .baz { background: -webkit-image-set(url(path3) 1x, url(path4) 2x) }
    `)
  ).resolves.toEqual(
    strip(`
      :import("path1") {
        __url_0: default
      }
      :import("path2") {
        __url_1: default
      }
      :import("path3") {
        __url_2: default
      }
      :import("path4") {
        __url_3: default
      }
      .foo { background: url(__url_0) }
      .bar { background: url(__url_1) }
      .baz { background: -webkit-image-set(url(__url_2) 1x, url(__url_3) 2x) }
    `)
  );
});

test("option filter", () => {
  return expect(
    runCSS(
      `
      .foo { background: url(path1) }
      .bar { background: url(path2) }
      .baz { background: -webkit-image-set(url(path3) 1x, url(path4) 2x) }
      .boo { background: url(https://path); }
      .faz { background: url(//path); }
    `,
      {
        filter: () => true
      }
    )
  ).resolves.toEqual(
    strip(`
      :import("path1") {
        __url_0: default
      }
      :import("path2") {
        __url_1: default
      }
      :import("path3") {
        __url_2: default
      }
      :import("path4") {
        __url_3: default
      }
      :import("https://path") {
        __url_4: default
      }
      :import("//path") {
        __url_5: default
      }
      .foo { background: url(__url_0) }
      .bar { background: url(__url_1) }
      .baz { background: -webkit-image-set(url(__url_2) 1x, url(__url_3) 2x) }
      .boo { background: url(__url_4); }
      .faz { background: url(__url_5); }
    `)
  );
});

test("skip data, protocol, hash, empty url, no url", () => {
  const fixture = `
    .foo {
      background: nothing;
      background: nothing url();
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
  return expect(runCSS(fixture)).resolves.toEqual(strip(fixture));
});
