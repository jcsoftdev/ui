import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { loadCases } from "./components/render.mjs";

const {
  html,
  formatClock,
  formatClockText,
  formatMinutesText,
  formatOverrunText,
  spokenDuration,
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

const en = {
  minutesShort: "{count} min",
  hoursShort: "{hours} h",
  hoursMinutesShort: "{hours} h {minutes} min",
  elapsedMinutesOne: "{count} minute",
  elapsedMinutes: "{count} minutes",
  elapsedHoursOne: "{count} hour",
  elapsedHours: "{count} hours",
};

test("the clock stays mm:ss under an hour and switches to hours and minutes from 60:00", () => {
  const table = [
    [0, "00:00"],
    [3599, "59:59"],
    [3600, "1 h"],
    [3660, "1 h 1 min"],
    [3900, "1 h 5 min"],
    [81000 + 11, "22 h 30 min"],
    [86340, "23 h 59 min"],
    [86400, "24 h"],
    [176580, "49 h 3 min"],
  ];
  for (const [seconds, expected] of table) {
    assert.equal(formatClockText(seconds, en), expected, `${seconds}s`);
  }
});

test("the overrun keeps its unpadded minutes under an hour and reads in hours after", () => {
  const table = [
    [71, "1:11"],
    [3599, "59:59"],
    [3600, "1 h"],
    [80100, "22 h 15 min"],
    [80111, "22 h 15 min"],
  ];
  for (const [seconds, expected] of table) {
    assert.equal(formatOverrunText(seconds, en), expected, `${seconds}s`);
  }
});

test("the minutes format reads in hours from 60 minutes on", () => {
  const table = [
    [0, "0 min"],
    [59, "59 min"],
    [60, "1 h"],
    [65, "1 h 5 min"],
    [568, "9 h 28 min"],
    [1439, "23 h 59 min"],
    [2943, "49 h 3 min"],
  ];
  for (const [minutes, expected] of table) {
    assert.equal(formatMinutesText(minutes, en), expected, `${minutes} min`);
  }
});

test("the spoken duration matches the visible one", () => {
  const table = [
    [1, "1 minute"],
    [59, "59 minutes"],
    [60, "1 hour"],
    [61, "1 hour 1 minute"],
    [568, "9 hours 28 minutes"],
    [2943, "49 hours 3 minutes"],
  ];
  for (const [minutes, expected] of table) {
    assert.equal(spokenDuration(minutes, en), expected, `${minutes} min`);
  }
});

test("an element open for hours reads in hours and speaks the same duration", () => {
  const clockMarkup = html.elapsed({}, 568);
  assert.match(clockMarkup, /<span aria-hidden="true"[^>]*>9 h 28 min<\/span>/);
  assert.match(clockMarkup, /<span class="sr-only"[^>]*>9 hours 28 minutes<\/span>/);
  const minutesMarkup = html.elapsed({ format: "minutes" }, 568);
  assert.match(minutesMarkup, />9 h 28 min<\/span>/);
  assert.match(html.elapsedEs(65), /1 h 5 min/);
  assert.match(html.elapsedEs(65), /1 hora 5 minutos/);
});
