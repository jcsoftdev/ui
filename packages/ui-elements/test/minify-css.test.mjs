import assert from "node:assert/strict";
import { test } from "node:test";
import { minify } from "../scripts/minify-css.mjs";

test("squeezes whitespace and drops comments", () => {
  assert.equal(
    minify("/* x */ a,  b {\n  color:  red;\n  margin: 0 ;\n}\n"),
    "a,b{color:red;margin:0}",
  );
});

test("keeps quoted strings and url() byte for byte", () => {
  const css = `a::after { content: "a:  b  {  c }"; background: url( "x  y:  z.png" ); }
b { content: '/* not a comment */  '; background: url(data:image/svg+xml;utf8,<svg  a: b/>); }`;
  assert.equal(
    minify(css),
    `a::after{content:"a:  b  {  c }";background:url( "x  y:  z.png" )}b{content:'/* not a comment */  ';background:url(data:image/svg+xml;utf8,<svg  a: b/>)}`,
  );
});

test("a quote inside a comment does not swallow the rules after it", () => {
  assert.equal(minify("/* don't */ a { color: red }"), "a{color:red}");
});
