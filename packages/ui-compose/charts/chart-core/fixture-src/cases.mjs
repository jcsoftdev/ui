// Case generators behind registry.mjs. Seeded and deterministic: the same Lehmer generator as ui-core/test/chart.test.ts.
export const lehmer = (seed) => {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
};

export const between = (rand, lo, hi) => lo + rand() * (hi - lo);
export const times = (n, make) => Array.from({ length: n }, (_, i) => make(i));
const utc = (y, m, d, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min);
const DAY = 86_400_000;

// V8's `10 ** n` is not exactly 10^n on every release (Node 22 gives 0.00009999999999999999 for n = -4, Node 26 gives 0.0001). Kotlin
// uses the correctly rounded power, so cases whose ticks hang on that last bit are left out rather than pinned to one V8.
const exactTickStep = (min, max, count) => {
  const raw = Math.abs(max - min) / Math.max(1, count);
  if (raw === 0 || !Number.isFinite(raw)) return 1;
  const power = Number(`1e${Math.floor(Math.log10(raw))}`);
  const error = raw / power;
  return (error >= 7.5 ? 10 : error >= 3.5 ? 5 : error >= 1.5 ? 2 : 1) * power;
};

const ticks = (mod) => {
  const rand = lehmer(11);
  const fixed = [
    [0, 0], [5, 5], [-3, -3], [0, 1e-9], [1e9, 1e9 + 1], [0.1, 0.30000000000000004], [0, 1], [0, 100], [-1, 1], [0, 7], [3, 3.0001],
    [1e-12, 5e-12], [-1e12, 1e12], [123456, 123999], [0.0001, 0.0009], [42, -17], [1e15, 1e15 + 8], [-0.5, 0.25],
  ];
  const randoms = times(220, () => [between(rand, -5000, 5000), between(rand, -5000, 5000)]);
  const wide = times(40, () => [between(rand, -1e9, 1e9), between(rand, -1e9, 1e9)]);
  const tiny = times(40, () => { const a = between(rand, -1, 1); return [a, a + between(rand, 0, 1e-3)]; });
  const counts = [2, 3, 5, 6, 7, 10];
  const out = [...fixed, ...randoms, ...wide, ...tiny].flatMap(([min, max], i) => {
    const count = counts[i % counts.length];
    if (exactTickStep(min, max, count) !== mod.tickStep(min, max, count)) return [];
    return [{ min, max, count, step: mod.tickStep(min, max, count), nice: mod.niceDomain(min, max, count), ticks: mod.linearTicks(min, max, count) }];
  });
  const clean = [0, 1, -1, 0.1 + 0.2, 1 / 3, 2 / 3, 1e-7 * 3, 123456.78901234567, 1e21, 1.5e-10, -4.35, 1.0000000000005, 9.9999999999995, 4503599627370496.5, 1e-12, -1e-12, -0, 0.5e-13, -1.0000000000005, -9.9999999999995, 2.5, -2.5, 1e-300, 1e300, 123456789012.5, -123456789012.5]
    .concat(times(80, () => between(rand, -1e6, 1e6) / 7)).map((value) => ({ value, clean: mod.clean(value) }));
  return { cases: out, clean };
};

const probes = (rand, d0, d1) => [d0, d1, d0 - 1, d1 + 1, d0 + (d1 - d0) / 2, ...times(6, () => between(rand, Math.min(d0, d1), Math.max(d0, d1)))];

const scales = (mod) => {
  const rand = lehmer(7);
  const linear = times(120, (i) => {
    const domain = [between(rand, -5000, 5000), between(rand, -5000, 5000)];
    const range = [between(rand, 0, 50), between(rand, 100, 900)];
    const nice = rand() > 0.3;
    const tickCount = 2 + Math.floor(rand() * 10);
    const scale = mod.linearScale({ domain, range, nice, tickCount });
    const stable = exactTickStep(...scale.domain, tickCount) === mod.tickStep(...scale.domain, tickCount) && exactTickStep(...domain, tickCount) === mod.tickStep(...domain, tickCount) && exactTickStep(...scale.domain, 7) === mod.tickStep(...scale.domain, 7);
    if (!stable) return null;
    return {
      domain, range, nice, tickCount, resolved: scale.domain,
      map: probes(rand, ...scale.domain).map((v) => [v, scale.map(v)]),
      invert: [range[0], range[1], between(rand, 0, 900)].map((p) => [p, scale.invert(p)]),
      ticks: scale.ticks(), ticks7: scale.ticks(7),
    };
  });
  linear.splice(0, linear.length, ...linear.filter(Boolean));
  for (const domain of [[0, 0], [5, 5], [-3, -3], [0, 1e-9], [1e9, 1e9 + 1], [0.1, 0.30000000000000004]]) {
    const scale = mod.linearScale({ domain, range: [0, 100] });
    linear.push({
      domain, range: [0, 100], nice: true, tickCount: 5, resolved: scale.domain,
      map: [domain[0], domain[1], domain[0] + 1].map((v) => [v, scale.map(v)]), invert: [0, 50, 100].map((p) => [p, scale.invert(p)]),
      ticks: scale.ticks(), ticks7: scale.ticks(7),
    });
  }
  const log = times(60, () => {
    const domain = [Math.pow(10, between(rand, -4, 6)), Math.pow(10, between(rand, -4, 6))];
    const range = [between(rand, 0, 50), between(rand, 100, 900)];
    const scale = mod.logScale({ domain, range });
    return {
      domain, range, resolved: scale.domain,
      map: [...probes(rand, ...scale.domain), 0, -5].map((v) => [v, scale.map(v)]),
      invert: [range[0], range[1], between(rand, 0, 900)].map((p) => [p, scale.invert(p)]), ticks: scale.ticks(),
    };
  });
  for (const domain of [[1, 100], [1, 10], [0.5, 50], [0, 100], [100, 100], [10, 1000], [1e-300, 1e300]]) {
    const scale = mod.logScale({ domain, range: [0, 200] });
    log.push({
      domain, range: [0, 200], resolved: scale.domain,
      map: [...domain, 0, -1, 7].map((v) => [v, scale.map(v)]), invert: [0, 100, 200].map((p) => [p, scale.invert(p)]), ticks: scale.ticks(),
    });
  }
  const bandCases = [];
  for (const count of [0, 1, 2, 3, 5, 12, 100, 1000]) {
    for (const [paddingInner, paddingOuter] of [[0.2, 0.1], [0, 0], [0.25, 0.1], [0.5, 0.5]]) {
      const range = [between(rand, 0, 20), between(rand, 200, 800)];
      const scale = mod.bandScale({ count, range, paddingInner, paddingOuter });
      const idx = Math.min(count, 12);
      bandCases.push({
        count, range, paddingInner, paddingOuter, step: scale.step, bandwidth: scale.bandwidth,
        starts: times(idx, (i) => scale.start(i)), centers: times(idx, (i) => scale.center(i)),
        indexAt: [range[0] - 30, range[0], ...times(8, () => between(rand, range[0], range[1])), range[1], range[1] + 30].map((p) => [p, scale.indexAt(p)]),
      });
    }
  }
  const pointCases = [];
  for (const count of [0, 1, 2, 3, 7, 50, 1000]) {
    for (const padding of [0, 0.5]) {
      const range = [between(rand, 0, 20), between(rand, 200, 800)];
      const scale = mod.pointScale({ count, range, padding });
      const idx = Math.min(count, 12);
      pointCases.push({
        count, range, padding, step: scale.step, starts: times(idx, (i) => scale.start(i)), centers: times(idx, (i) => scale.center(i)),
        indexAt: [range[0] - 30, range[0], ...times(8, () => between(rand, range[0], range[1])), range[1], range[1] + 30].map((p) => [p, scale.indexAt(p)]),
      });
    }
  }
  const big = Array.from({ length: 1_000_000 }, (_, i) => Math.sin(i * 0.001) * 1000 + (i % 977));
  const extents = [
    [], [3], [3, null, Number.NaN, -1, undefined, 9], [Number.NaN], [Infinity, -Infinity], [1, Infinity, -2, -Infinity, 5], [null, null], [0, -0], big,
  ].map((values) => ({ size: values.length, values: values.length > 100 ? null : values, extent: mod.extent(values) }));
  return { linear, log, band: bandCases, point: pointCases, extent: extents };
};

const LOCALES = ["es-PE", "es", "en-US"];
// The null zone is the machine's local zone, so its output depends on where the generator runs and cannot be a committed fixture.
const ZONES = ["UTC", "America/Lima", "America/New_York", "Europe/Madrid", "Asia/Kolkata", "America/Santiago"];
// Number formatting also covers locales with other grouping, digits and sign placement. Compact notation exists for es and en only.
const FORMAT_LOCALES = [...LOCALES, "en-IN", "nl", "de-CH", "ar-EG"];
// Short month and weekday names, which the platform supplies; ca and fi differ between their format and standalone forms.
const NAME_LOCALES = [...LOCALES, "ca", "fi", "de"];

const time = (mod) => {
  const rand = lehmer(23);
  const spans = [3 * 3_600_000, DAY, 2 * DAY, 6 * DAY, 10 * DAY, 20 * DAY, 40 * DAY, 100 * DAY, 200 * DAY, 400 * DAY, 800 * DAY, 5 * 365 * DAY, 30 * 365 * DAY, 300 * 365 * DAY];
  const starts = [utc(2026, 1, 1), utc(2026, 3, 7, 12), utc(2026, 3, 28, 22), utc(2026, 10, 24, 5), utc(2026, 10, 31, 20, 30), utc(2024, 2, 27, 3), utc(1999, 12, 30)];
  const tickCases = [];
  for (const zone of ZONES) {
    for (const [si, span] of spans.entries()) {
      const start = starts[(si + zone.length) % starts.length];
      const locale = LOCALES[si % LOCALES.length];
      const count = [6, 3, 12][si % 3];
      const options = { locale, timeZone: zone };
      tickCases.push({ start, end: start + span, count, zone, locale, ticks: mod.timeTicks(start, start + span, count, options) });
    }
  }
  // America/Santiago skips 2026-09-06 00:00 to 01:00: midnight of the 6th does not exist and must resolve forward, not to the 5th.
  tickCases.push({ start: utc(2026, 9, 3), end: utc(2026, 9, 9), count: 6, zone: "America/Santiago", locale: "es-PE", ticks: mod.timeTicks(utc(2026, 9, 3), utc(2026, 9, 9), 6, { locale: "es-PE", timeZone: "America/Santiago" }) });
  tickCases.push({ start: utc(2026, 11, 1), end: utc(2026, 11, 3), count: 6, zone: "America/New_York", locale: "en-US", ticks: mod.timeTicks(utc(2026, 11, 1), utc(2026, 11, 3), 6, { locale: "en-US", timeZone: "America/New_York" }) });
  for (const [start, end, zone] of [[starts[0], starts[0], "UTC"], [starts[0] + 5 * DAY, starts[0], "UTC"], [starts[1], starts[1] + 1, "America/New_York"]]) {
    tickCases.push({ start, end, count: 6, zone, locale: "es-PE", ticks: mod.timeTicks(start, end, 6, { locale: "es-PE", timeZone: zone }) });
  }
  const dates = times(40, () => starts[0] + Math.floor(rand() * 5 * 365 * 24 * 3600) * 1000);
  const formats = ["UTC", "America/Lima", "America/New_York", "Europe/Madrid", "America/Santiago"].flatMap((zone) =>
    ["es-PE", "en-US"].flatMap((locale) => dates.slice(0, 12).map((value) => ({ value, zone, locale, text: mod.formatDate(value, { locale, timeZone: zone }), month: mod.shortMonth(new Date(value), { locale, timeZone: zone }), weekday: mod.shortWeekday(new Date(value), { locale, timeZone: zone }), day: mod.dayOfMonth(new Date(value), { locale, timeZone: zone }) }))),
  );
  const scale = mod.timeScale({ domain: [starts[0], starts[0] + 30 * DAY], range: [10, 410], timeZone: "UTC" });
  const flat = mod.timeScale({ domain: [starts[0], starts[0]], range: [0, 100], timeZone: "UTC" });
  const maps = {
    domain: scale.domain, flatDomain: flat.domain,
    map: [starts[0], starts[0] + 15 * DAY, starts[0] + 40 * DAY].map((v) => [v, scale.map(v)]),
    invert: [10, 210, 410, 500].map((p) => [p, scale.invert(p)]),
  };
  // Month and weekday names per locale, as the platform formatter has to supply them.
  const names = Object.fromEntries(
    NAME_LOCALES.map((locale) => [
      locale,
      {
        months: times(12, (m) => new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(Date.UTC(2026, m, 5))),
        weekdays: times(7, (d) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(Date.UTC(2026, 9, 4 + d))),
      },
    ]),
  );
  return { names, ticks: tickCases, formats, scale: maps };
};

const format = (mod) => {
  const symbols = {};
  const currencies = ["PEN", "USD", "EUR"];
  for (const locale of FORMAT_LOCALES) {
    const parts = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).formatToParts(-1234567.5);
    const part = (type) => parts.find((p) => p.type === type)?.value ?? "";
    const sample = (opts, value) => new Intl.NumberFormat(locale, { ...opts, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    const groups = new Intl.NumberFormat(locale, { useGrouping: "always" }).formatToParts(123456789).filter((p) => p.type === "integer").map((p) => p.value.length);
    const styles = { decimal: {}, percent: {}, currency: Object.fromEntries(currencies.map((code) => [code, {}])) };
    for (const [key, value] of [["pos", 1], ["neg", -1]]) {
      styles.decimal[key] = sample({}, value);
      styles.percent[key] = sample({ style: "percent" }, value);
      for (const code of currencies) styles.currency[code][key] = sample({ style: "currency", currency: code }, value);
    }
    symbols[locale] = {
      decimal: part("decimal"), group: part("group"), minus: part("minusSign"),
      zero: new Intl.NumberFormat(locale).format(0), primaryGroup: groups.at(-1), secondaryGroup: groups.at(-2) ?? groups.at(-1),
      percent: styles.percent.pos, currency: Object.fromEntries(currencies.map((code) => [code, styles.currency[code].pos])), styles,
    };
  }
  const numbers = [0, 0.5, 1, -1, 7, 42.42, 999, 999.994, 1000, 1234.5, -1234.5, 12345.678, 99999.5, 123456.789, 1234567.891, -9876543.21, 0.005, 0.015, 1.005, 2.675, 0.1 + 0.2, 1e-7, 0.000123, 123456789.125, 1e15, 1e21, 99.995, 9.9995];
  const compact = [1e10, 2.5e11, 9.99e9, 9.9995e10, 1e11, 999.96e9, 0, 0.4, 5, 123.456, 999.44, 999.96, 1000, 1049, 1050, 12345, 999949, 999950, 999999, 1e6, 1.05e6, 99.96e6, 1e9, 1.5e9, 1e12, 1.5e15, 1e16, -1500, 25e5, 3e9, 4e12];
  const percents = [0, 0.125, 0.1255, 1.5, -0.5, 0.00049, 0.999, 0.5, 12, 0.0001];
  const out = [];
  for (const locale of FORMAT_LOCALES) {
    for (const value of numbers) {
      out.push({ locale, kind: "number", value, args: {}, text: mod.formatNumber(value, { locale }) });
      out.push({ locale, kind: "integer", value, args: {}, text: mod.formatNumber(value, { locale, maximumFractionDigits: 0 }) });
      out.push({ locale, kind: "fixed", value, args: { min: 2, max: 2 }, text: mod.formatNumber(value, { locale, minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
    }
    for (const value of percents) {
      out.push({ locale, kind: "percent", value, args: { decimals: 1, whole: false }, text: mod.formatPercent(value, { locale }) });
      out.push({ locale, kind: "percent", value: value * 100, args: { decimals: 0, whole: true }, text: mod.formatPercent(value * 100, { locale, decimals: 0, input: "whole" }) });
    }
    // Compact suffixes come from a shared table for es and en. CLDR's es-419 family (es-PE included) switches between "K" and "k" by
    // magnitude; that quirk is not modelled, so es-PE has no compact cases (its default compact locale on the web is "es" anyway).
    for (const value of locale === "es" || locale === "en-US" ? compact : []) {
      out.push({ locale, kind: "compact", value, args: { decimals: 1, prefix: "" }, text: mod.formatCompact(value, { locale }) });
      out.push({ locale, kind: "compact", value, args: { decimals: 0, prefix: "S/ " }, text: mod.formatCompact(value, { locale, decimals: 0, prefix: "S/ " }) });
    }
    for (const currency of currencies) {
      for (const value of [0, 1, 1234.5, -1234.5, 99999.999, 0.005]) {
        out.push({ locale, kind: "currency", value, args: { currency, decimals: 2 }, text: mod.formatCurrency(value, { locale, currency }) });
        out.push({ locale, kind: "currency", value, args: { currency, decimals: 0 }, text: mod.formatCurrency(value, { locale, currency, decimals: 0 }) });
      }
      for (const preset of ["currency", "percent", "number", "compact"]) {
        for (const value of locale !== "es" && locale !== "en-US" ? [0, 12, 950, 1234.5, 9999, -950, 0.5] : [0, 12, 950, 1234.5, 9999, 10000, 25000, 1.5e6, -42000, 0.5]) {
          out.push({ locale, kind: `axis-${preset}`, value, args: { currency }, text: mod.resolveAxisFormat(preset, { locale, currency })(value) });
        }
      }
    }
  }
  return { symbols, cases: out };
};

const axis = (mod) => {
  const rand = lehmer(31);
  const labelSets = [
    ["a", "b", "c"], ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto"], times(30, (i) => `d${i + 1}`),
    times(12, (i) => "x".repeat(1 + (i % 5) * 3)), ["solo"], [], ["uno", "dos"],
  ];
  const thin = labelSets.flatMap((labels) =>
    [0, 10, 30].map((gap) => {
      const ticks = labels.map((label, key) => ({ key, position: 12 + key * (labels.length ? 600 / labels.length : 0), label }));
      return { gap, ticks, kept: mod.thinTicks(ticks, gap).map((t) => t.key) };
    }),
  );
  const valueTicks = times(24, () => {
    const scale = mod.linearScale({ domain: [between(rand, -300, 100), between(rand, 100, 9000)], range: [300, 0], tickCount: 2 + Math.floor(rand() * 6) });
    const count = 2 + Math.floor(rand() * 8);
    return { domain: scale.domain, count, ticks: mod.valueTicks(scale, count, (v) => String(v)) };
  });
  const category = [];
  for (const labels of labelSets) {
    for (const mode of ["point", "band"]) {
      for (const width of [320, 800]) {
        const options = mode === "band" ? { mode, paddingInner: 0.3, padding: 0.15 } : { mode };
        const built = mod.buildTimeCategoryAxis(labels, width, options);
        category.push({
          labels, mode, width, options, positions: built.positions, step: built.step, bandwidth: built.bandwidth, ticks: built.ticks,
          indexAt: [-20, 0, width / 3, width / 2, width * 0.9, width, width + 40].map((p) => [p, built.indexAt(p)]),
        });
      }
    }
  }
  const dated = [];
  const base = utc(2026, 9, 28);
  const dateSets = {
    daily: times(21, (i) => base + i * DAY), sparse: [base, base + DAY, base + 9 * DAY, base + 10 * DAY, base + 40 * DAY], monthly: times(18, (i) => utc(2025, 1 + i, 1)),
    unsorted: [base + 5 * DAY, base, base + 9 * DAY, base + 2 * DAY], single: [base], hourly: times(30, (i) => base + i * 3_600_000),
  };
  for (const [name, stamps] of Object.entries(dateSets)) {
    for (const timeZone of ["UTC", "America/Lima", "America/New_York"]) {
      const options = { mode: "time", locale: "es-PE", timeZone };
      const built = mod.buildTimeCategoryAxis(stamps.map((t) => new Date(t)), 640, options);
      dated.push({
        name, timeZone, times: stamps, width: 640, positions: built.positions, step: built.step, bandwidth: built.bandwidth, ticks: built.ticks,
        indexAt: [-10, 0, 100, 321, 500, 640, 700].map((p) => [p, built.indexAt(p)]),
      });
    }
  }
  return { thin, valueTicks, category, dated };
};

const timeRange = (mod) => {
  const rand = lehmer(41);
  const zones = ["UTC", "America/Lima", "America/New_York", "Europe/Madrid"];
  const shifts = [];
  const instants = [utc(2026, 3, 31, 15), utc(2024, 2, 29, 9), utc(2026, 10, 25, 0, 30), utc(2026, 1, 31, 23), utc(2026, 12, 31, 12), utc(2026, 5, 15), utc(2000, 2, 29)];
  for (const zone of zones) {
    for (const value of instants) {
      for (const [unit, count] of [["day", 1], ["day", 30], ["week", 1], ["week", 2], ["month", 1], ["month", 3], ["month", 12], ["year", 1], ["year", 5], ["month", 0]]) {
        shifts.push({ value, zone, unit, count, shifted: mod.shiftDate(new Date(value), unit, count, zone).getTime() });
      }
    }
  }
  const windows = [];
  const presets = [["day", 1], ["week", 1], ["month", 1], ["month", 3], ["month", 6], ["year", 1], ["all", 0]];
  const series = {
    daily: times(400, (i) => utc(2025, 1, 1) + i * DAY), weekdays: times(300, (i) => utc(2025, 1, 1) + (i + Math.floor(i / 5) * 2) * DAY),
    sparse: times(12, (i) => utc(2024, 1 + i * 2, 15)), one: [utc(2026, 1, 1)], two: [utc(2026, 1, 1), utc(2026, 6, 1)], none: [],
    irregular: times(60, () => utc(2025, 1, 1) + Math.floor(rand() * 500) * DAY).sort((a, b) => a - b),
  };
  for (const [name, dates] of Object.entries(series)) {
    for (const zone of ["UTC", "America/Lima"]) {
      for (const [unit, count] of presets) {
        windows.push({ name, zone, unit, count, window: mod.rangeWindow(dates.map((t) => new Date(t)), { unit, count }, zone) });
      }
    }
  }
  return { shifts, series, windows };
};

export const cases = { ticks, scales, time, format, axis, timeRange };
