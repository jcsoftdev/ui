import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { loadCases } from "./components/render.mjs";

const {
  html,
  formatClock,
  isoDuration,
  readElapsed,
  toneFor,
  subscribeTicker,
  tickerListenerCount,
  getTickerSnapshot,
} = await loadCases("floor-plan-cases.tsx");

test("the clock pads minutes and seconds and keeps counting past an hour", () => {
  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(754), "12:34");
  assert.equal(formatClock(6000 + 5), "100:05");
  assert.equal(isoDuration(754), "PT12M34S");
});

test("elapsed time follows the server offset and never goes negative", () => {
  const since = "2026-01-01T10:00:00Z";
  const now = Date.parse("2026-01-01T10:12:34Z");
  assert.equal(readElapsed({ since, now }).seconds, 754);
  assert.equal(readElapsed({ since, now, serverOffsetMs: 60000 }).seconds, 814);
  assert.equal(readElapsed({ since, now: now - 3600000 }).seconds, 0);
});

test("a countdown reports the time left and the overrun", () => {
  const now = Date.parse("2026-01-01T10:00:00Z");
  const countdownTo = "2026-01-01T10:05:00Z";
  assert.deepEqual(readElapsed({ since: new Date(now), now, countdownTo }), {
    seconds: 300,
    over: false,
  });
  assert.deepEqual(readElapsed({ since: new Date(now), now: now + 330000, countdownTo }), {
    seconds: 30,
    over: true,
  });
});

test("tone switches at warnAt and dangerAt, and reverses for a countdown", () => {
  const at = (minutes, over = false) => ({ seconds: minutes * 60, over });
  assert.equal(toneFor(at(9), false, 10, 20), "neutral");
  assert.equal(toneFor(at(10), false, 10, 20), "warning");
  assert.equal(toneFor(at(20), false, 10, 20), "danger");
  assert.equal(toneFor(at(30), false), "neutral");
  assert.equal(toneFor(at(6), true, 5, 2), "neutral");
  assert.equal(toneFor(at(5), true, 5, 2), "warning");
  assert.equal(toneFor(at(2), true, 5, 2), "danger");
  assert.equal(toneFor(at(1, true), true), "danger");
});

test("renders a time element with a duration, tabular numerals and an accessible minutes text", () => {
  const markup = html.elapsed({});
  assert.match(markup, /<time datetime="PT12M\dS"/i);
  assert.match(markup, /tabular-nums/);
  assert.match(markup, /<span aria-hidden="true"[^>]*>12:0\d<\/span>/);
  assert.match(markup, /<span class="sr-only"[^>]*>12 minutes<\/span>/);
  assert.doesNotMatch(markup, /aria-live/);
});

test("the minutes format shows whole minutes, one minute is singular", () => {
  assert.match(html.elapsed({ format: "minutes" }), />12 min<\/span>/);
  assert.match(html.elapsed({}, 1), />1 minute<\/span>/);
});

test("warn and danger tones are exposed and motion-safe", () => {
  const warn = html.elapsed({ warnAt: 10, dangerAt: 20 });
  assert.match(warn, /data-tone="warning"/);
  assert.match(warn, /text-warning/);
  assert.match(warn, /motion-reduce:transition-none/);
  assert.match(html.elapsed({ warnAt: 5, dangerAt: 10 }), /data-tone="danger"/);
  assert.doesNotMatch(html.elapsed({}), /data-tone/);
});

test("a countdown announces the time left and uses the locale", () => {
  const markup = html.countdown({});
  assert.match(markup, /data-countdown/);
  assert.match(markup, /5 minutes left/);
  assert.match(html.elapsedEs(), /5 minutos/);
});

test("every instance shares one timer that stops with the last subscriber", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  const spy = mock.method(globalThis, "setTimeout");
  const calls = [0, 0, 0];
  const stops = calls.map((_, i) =>
    subscribeTicker(() => {
      calls[i] += 1;
    }),
  );
  assert.equal(tickerListenerCount(), 3);
  assert.equal(spy.mock.callCount(), 1);
  const before = getTickerSnapshot();
  t.mock.timers.tick(1010);
  assert.deepEqual(calls, [1, 1, 1]);
  assert.ok(getTickerSnapshot() > before);
  assert.equal(spy.mock.callCount(), 2);
  stops[0]();
  stops[1]();
  t.mock.timers.tick(1000);
  assert.deepEqual(calls, [1, 1, 2]);
  stops[2]();
  assert.equal(tickerListenerCount(), 0);
  t.mock.timers.tick(5000);
  assert.deepEqual(calls, [1, 1, 2]);
  spy.mock.restore();
});
