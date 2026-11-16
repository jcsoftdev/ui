import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadCases } from "./components/render.mjs";

const { html, intentAttributes, intentTargetRef, implicitRoleOf, resolveExpectation } =
  await loadCases("intent-cases.tsx");

const src = (path) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

const source = (tagName, attrs = {}) => ({
  tagName,
  getAttribute: (name) => (name in attrs ? attrs[name] : null),
});

test("intent attributes render only with a non-empty intent", () => {
  assert.deepEqual(intentAttributes({}), {});
  assert.deepEqual(intentAttributes({ intent: "", intentKey: "7" }), {});
  assert.deepEqual(intentAttributes({ intentKey: "7" }), {});
  assert.deepEqual(intentAttributes({ intent: "order-card" }), { "data-intent": "order-card" });
  assert.deepEqual(intentAttributes({ intent: "order-card", intentKey: "" }), {
    "data-intent": "order-card",
  });
  assert.deepEqual(intentAttributes({ intent: "order-card", intentKey: "124" }), {
    "data-intent": "order-card",
    "data-intent-key": "124",
  });
});

test("intent attributes reach server-rendered markup", () => {
  assert.match(
    html.withIntent({ intent: "a", intentKey: "1" }),
    /data-intent="a" data-intent-key="1"/,
  );
  assert.doesNotMatch(html.withIntent({ intentKey: "1" }), /data-intent/);
});

test("target ref mirrors the attributes", () => {
  assert.equal(intentTargetRef({ intentKey: "1" }), undefined);
  assert.deepEqual(intentTargetRef({ intent: "t", intentKey: "1" }), { intent: "t", key: "1" });
  assert.deepEqual(intentTargetRef({ intent: "t" }), { intent: "t" });
});

test("implicit roles follow the element", () => {
  const table = [
    [source("A", { href: "/x" }), "link"],
    [source("A"), "generic"],
    [source("AREA", { href: "/x" }), "link"],
    [source("BUTTON"), "button"],
    [source("INPUT", { type: "checkbox" }), "checkbox"],
    [source("INPUT", { type: "radio" }), "radio"],
    [source("INPUT", { type: "range" }), "slider"],
    [source("INPUT", { type: "number" }), "spinbutton"],
    [source("INPUT", { type: "search" }), "searchbox"],
    [source("INPUT", { type: "submit" }), "button"],
    [source("INPUT", { type: "email" }), "textbox"],
    [source("INPUT"), "textbox"],
    [source("TEXTAREA"), "textbox"],
    [source("SELECT"), "combobox"],
    [source("SELECT", { multiple: "" }), "listbox"],
    [source("SELECT", { size: "4" }), "listbox"],
    [source("TR"), "row"],
    [source("TD"), "cell"],
    [source("TH"), "columnheader"],
    [source("TABLE"), "table"],
    [source("ARTICLE"), "article"],
    [source("FIELDSET"), "group"],
    [source("FORM"), "form"],
    [source("DIALOG"), "dialog"],
    [source("LI"), "listitem"],
    [source("NAV"), "navigation"],
    [source("SECTION"), "region"],
    [source("DIV"), "generic"],
  ];
  for (const [element, role] of table) {
    assert.equal(implicitRoleOf(element), role, element.tagName);
  }
});

test("expectation prefers the declared role, then the role attribute, then the implicit role", () => {
  assert.deepEqual(resolveExpectation({ role: "switch" }, source("BUTTON")), {
    role: "switch",
    requireName: true,
  });
  assert.deepEqual(resolveExpectation(undefined, source("DIV", { role: "grid" })), {
    role: "grid",
    requireName: true,
  });
  assert.deepEqual(resolveExpectation({ requireName: false }, source("A", { href: "/x" })), {
    role: "link",
    requireName: false,
  });
});

test("the module split keeps hooks out of server-safe files", () => {
  assert.doesNotMatch(readFileSync(src("intent/attributes.ts"), "utf8"), /from "react"/);
  assert.doesNotMatch(readFileSync(src("intent/types.ts"), "utf8"), /use client/);
  assert.match(readFileSync(src("intent/use-intent-target.ts"), "utf8"), /^"use client"/);
});
