import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const { html } = await loadCases("intent-overlays-cases.tsx");

const rawIntentProps = /\sintent(key)?=/i;

test("ContextMenuTrigger carries the intent attributes on its area and leaks no raw props", () => {
  const markup = html.contextMenuTrigger();
  assert.match(markup, /<div[^>]*data-intent="probe"[^>]*data-intent-key="k1"[^>]*>area<\/div>/);
  assert.doesNotMatch(markup, rawIntentProps);
});

test("HoverCardTrigger carries the intent attributes on the span or the asChild element", () => {
  const span = html.hoverCardTrigger();
  assert.match(span, /<span[^>]*data-intent="probe"[^>]*data-intent-key="k1"[^>]*>who<\/span>/);
  assert.doesNotMatch(span, rawIntentProps);
  const link = html.hoverCardTriggerAsChild();
  assert.match(link, /<a[^>]*data-intent="probe"[^>]*data-intent-key="k1"[^>]*>who<\/a>/);
  assert.doesNotMatch(link, rawIntentProps);
});

test("an empty intent renders nothing, even with an intentKey", () => {
  const markup = html.hoverCardTriggerEmptyIntent();
  assert.doesNotMatch(markup, /data-intent/);
  assert.doesNotMatch(markup, rawIntentProps);
});

test("portalled overlay contents render nothing on the server and leak no raw props", () => {
  const markup = html.portalled();
  assert.doesNotMatch(markup, rawIntentProps);
});
