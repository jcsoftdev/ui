import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("labelled-control-cases.tsx");

const checkboxLabelledSnapshot =
  '<span class="inline-flex items-center"><button type="button" role="checkbox" aria-checked="false" data-state="unchecked" value="on" id="cb" class="relative after:absolute after:top-1/2 after:left-1/2 after:size-(--touch-target) after:-translate-1/2 after:content-[&#x27;&#x27;] group inline-flex size-10 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"><span class="grid size-4.5 place-items-center rounded-xs border-[1.5px] border-line-strong group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent group-data-[state=indeterminate]:border-accent group-data-[state=indeterminate]:bg-accent"></span></button><input type="checkbox" aria-hidden="true" tabindex="-1" style="position:absolute;pointer-events:none;opacity:0;margin:0;transform:translateX(-100%)" value="on"/><label for="cb" class="cursor-pointer select-none text-control text-ink data-disabled:cursor-not-allowed data-disabled:opacity-50">Agree</label></span>';

const checkboxLabelledDisabledSnapshot =
  '<span class="inline-flex items-center"><button type="button" role="checkbox" aria-checked="false" data-state="unchecked" data-disabled="" disabled="" value="on" id="cb" class="relative after:absolute after:top-1/2 after:left-1/2 after:size-(--touch-target) after:-translate-1/2 after:content-[&#x27;&#x27;] group inline-flex size-10 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"><span class="grid size-4.5 place-items-center rounded-xs border-[1.5px] border-line-strong group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent group-data-[state=indeterminate]:border-accent group-data-[state=indeterminate]:bg-accent"></span></button><input type="checkbox" aria-hidden="true" disabled="" tabindex="-1" style="position:absolute;pointer-events:none;opacity:0;margin:0;transform:translateX(-100%)" value="on"/><label for="cb" data-disabled="" class="cursor-pointer select-none text-control text-ink data-disabled:cursor-not-allowed data-disabled:opacity-50">Agree</label></span>';

const checkboxBareSnapshot =
  '<button type="button" role="checkbox" aria-checked="false" data-state="unchecked" value="on" id="cb" aria-label="Agree" class="relative after:absolute after:top-1/2 after:left-1/2 after:size-(--touch-target) after:-translate-1/2 after:content-[&#x27;&#x27;] group inline-flex size-10 shrink-0 items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"><span class="grid size-4.5 place-items-center rounded-xs border-[1.5px] border-line-strong group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent group-data-[state=indeterminate]:border-accent group-data-[state=indeterminate]:bg-accent"></span></button><input type="checkbox" aria-hidden="true" tabindex="-1" style="position:absolute;pointer-events:none;opacity:0;margin:0;transform:translateX(-100%)" value="on"/>';

const switchBareSnapshot =
  '<button type="button" role="switch" aria-checked="false" data-state="unchecked" value="on" id="sw" aria-label="Notify" class="relative after:absolute after:top-1/2 after:left-1/2 after:size-(--touch-target) after:-translate-1/2 after:content-[&#x27;&#x27;] group inline-flex size-10 shrink-0 items-center justify-center"><span class="relative block h-5 w-8.5 rounded-pill bg-line-strong transition-colors group-data-[state=checked]:bg-accent"><span data-state="unchecked" class="absolute top-0.75 left-0.75 block size-3.5 rounded-pill bg-surface transition-transform data-[state=checked]:translate-x-3.5"></span></span></button><input type="checkbox" aria-hidden="true" tabindex="-1" style="position:absolute;pointer-events:none;opacity:0;margin:0;transform:translateX(-100%)" value="on"/>';

const attr = (markup, tag, name) =>
  markup
    .match(new RegExp(`<button[^>]*role="${tag}"[^>]*>`))?.[0]
    .match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

const descriptionIdOf = (markup) => markup.match(/<span id="([^"]+-description)"/)?.[1];

test("a switch with a label is named by it", () => {
  const id = attr(html.switchLabelled, "switch", "id");
  assert.equal(id, "sw");
  assert.ok(html.switchLabelled.includes(`<label for="${id}`));
  assert.match(html.switchLabelled, />Notify<\/label>/);
});

test("a labelled switch without an id gets a generated one tied to its label", () => {
  const id = attr(html.switchGeneratedId, "switch", "id");
  assert.ok(id);
  assert.ok(html.switchGeneratedId.includes(`<label for="${id}"`));
});

test("the description describes the control", () => {
  for (const [name, role] of [
    ["switchDescribed", "switch"],
    ["checkboxDescribed", "checkbox"],
  ]) {
    const descriptionId = descriptionIdOf(html[name]);
    assert.ok(descriptionId, name);
    assert.equal(attr(html[name], role, "aria-describedby"), descriptionId, name);
  }
});

test("a consumer describedby is kept ahead of the description id", () => {
  for (const [name, role] of [
    ["switchDescribedConsumer", "switch"],
    ["checkboxDescribedConsumer", "checkbox"],
  ]) {
    const descriptionId = descriptionIdOf(html[name]);
    assert.equal(attr(html[name], role, "aria-describedby"), `err ${descriptionId}`, name);
  }
});

test("a description without a label describes a control that keeps its aria-label", () => {
  const descriptionId = descriptionIdOf(html.switchDescriptionOnly);
  assert.equal(attr(html.switchDescriptionOnly, "switch", "aria-describedby"), descriptionId);
  assert.equal(attr(html.switchDescriptionOnly, "switch", "aria-label"), "Notify");
  assert.doesNotMatch(html.switchDescriptionOnly, /<label/);
});

test("classNames reach the wrapper, label and description", () => {
  for (const name of ["switchParts", "checkboxParts"]) {
    assert.match(html[name], /class="inline-flex items-center w-x"/, name);
    assert.match(html[name], /<label[^>]* l-x"/, name);
    assert.match(html[name], /<span id="[^"]+-description"[^>]* d-x"/, name);
  }
});

test("no label and no description render the 0.9.0 markup", () => {
  assert.equal(html.checkboxLabelled, checkboxLabelledSnapshot);
  assert.equal(html.checkboxLabelledDisabled, checkboxLabelledDisabledSnapshot);
  assert.equal(html.checkboxBare, checkboxBareSnapshot);
  assert.equal(html.switchBare, switchBareSnapshot);
});
