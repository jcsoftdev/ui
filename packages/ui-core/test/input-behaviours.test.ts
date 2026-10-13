import { describe, expect, it } from "vitest";
import * as react from "../../ui/src/forms/slider/model.ts";
import { validateFiles } from "../src/file-drop.ts";
import { fillOtp, sanitizeOtp } from "../src/otp.ts";
import * as drag from "../src/pointer-drag.ts";
import { repeatInterval } from "../src/press-repeat.ts";
import {
  formatDate,
  maskDate,
  maskTime,
  normalizeDate,
  normalizeTime,
  stepDate,
  stepTime,
} from "../src/segmented-input.ts";

describe("pointer-drag maths", () => {
  it("matches the React slider model value for value", () => {
    let seed = 11;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const steps = [1, 0.1, 0.25, 5, 7];
    for (let i = 0; i < 400; i++) {
      const min = Math.round(rand() * 40 - 20);
      const max = min + 1 + Math.round(rand() * 100);
      const step = steps[i % steps.length] as number;
      const value = rand() * 160 - 40;
      const ratio = rand();
      const pair: [number, number] = [min + rand() * (max - min), min + rand() * (max - min)];
      expect(drag.snapToStep(value, min, max, step)).toBe(react.snapToStep(value, min, max, step));
      expect(drag.ratioOf(value, min, max)).toBe(react.ratioOf(value, min, max));
      expect(drag.valueFromRatio(ratio, min, max, step)).toBe(
        react.valueFromRatio(ratio, min, max, step),
      );
      expect(drag.setRangeThumb(pair, 0, value, min, max, step, 2)).toEqual(
        react.setRangeThumb(pair, 0, value, min, max, step, 2),
      );
      expect(drag.nearestThumb(pair, value)).toBe(react.nearestThumb(pair, value));
      for (const key of ["ArrowLeft", "ArrowUp", "PageDown", "End", "Home", "a"])
        expect(drag.keyboardValue(key, value, min, max, step, step * 10)).toBe(
          react.keyboardValue(key, value, min, max, step, step * 10),
        );
    }
  });

  it("snaps an unreachable max to the last valid step and mirrors arrows in rtl", () => {
    expect(drag.snapToStep(100, 0, 99, 10)).toBe(90);
    expect(drag.snapToStep(0.3, 0, 1, 0.1)).toBe(0.3);
    expect(drag.keyboardValue("ArrowRight", 5, 0, 10, 1, 10, "rtl")).toBe(4);
    expect(drag.keyboardValue("ArrowLeft", 5, 0, 10, 1, 10, "rtl")).toBe(6);
  });
});

describe("press-repeat timing", () => {
  it("ramps the interval down to the floor and stays constant without one", () => {
    const timing = { interval: 100, minInterval: 40, ramp: 3 };
    expect([1, 2, 3, 4, 9].map((count) => repeatInterval(count, timing))).toEqual([
      100, 80, 60, 40, 40,
    ]);
    expect(repeatInterval(5, { interval: 90 })).toBe(90);
  });
});

describe("time field", () => {
  it("masks and normalizes like the React TimeInput", () => {
    expect(["", "9", "93", "930", "0930", "09:30", "1a2b3"].map(maskTime)).toEqual([
      "",
      "9",
      "93",
      "93:0",
      "09:30",
      "09:30",
      "12:3",
    ]);
    expect(
      ["930", "9:30", "0930", "23:59", "24:00", "12:60", "12", "12345"].map(normalizeTime),
    ).toEqual(["09:30", "09:30", "09:30", "23:59", null, null, null, null]);
  });

  it("steps hours by one and minutes by the step, wrapping on 24 hours", () => {
    expect(stepTime("23:30", 1, 1)).toBe("00:30");
    expect(stepTime("00:30", 1, -1)).toBe("23:30");
    expect(stepTime("10:58", 4, 1, 5)).toBe("11:03");
    expect(stepTime("00:02", 4, -1, 5)).toBe("23:57");
    expect(stepTime("", 1, 1)).toBe("01:00");
  });
});

describe("date field", () => {
  it("masks in the field order and normalizes only real dates", () => {
    expect(maskDate("31122024")).toBe("31/12/2024");
    expect(maskDate("2024123", "ymd", "-")).toBe("2024-12-3");
    expect(maskDate("3", "dmy")).toBe("3");
    expect(normalizeDate("29/02/2024")).toBe("2024-02-29");
    expect(normalizeDate("29/02/2023")).toBeNull();
    expect(normalizeDate("12/31/2024", "mdy")).toBe("2024-12-31");
    expect(normalizeDate("2024-13-01", "ymd")).toBeNull();
    expect(normalizeDate("31/12/20")).toBeNull();
    expect(formatDate("2024-03-05", "mdy", "-")).toBe("03-05-2024");
    expect(formatDate("2023-02-30")).toBe("");
  });

  it("wraps each segment inside its range and clamps the day", () => {
    expect(stepDate("2024-01-31", "month", 1)).toBe("2024-02-29");
    expect(stepDate("2024-12-15", "month", 1)).toBe("2024-01-15");
    expect(stepDate("2024-03-31", "day", 1)).toBe("2024-03-01");
    expect(stepDate("2024-03-01", "day", -1)).toBe("2024-03-31");
    expect(stepDate("2024-02-29", "year", 1)).toBe("2025-02-28");
    expect(stepDate("", "day", 1)).toBe("2000-01-02");
  });
});

describe("file validation", () => {
  const file = (name: string, type: string, size: number) =>
    new File([new Uint8Array(size)], name, { type });

  it("splits by type (exact, wildcard, extension) and size in order", () => {
    const files = [
      file("a.png", "image/png", 10),
      file("b.pdf", "application/pdf", 10),
      file("c.jpg", "image/jpeg", 500),
      file("D.TXT", "", 1),
    ];
    const result = validateFiles(files, ["image/*", ".txt"], 100);
    expect(result.accepted.map((f) => f.name)).toEqual(["a.png", "D.TXT"]);
    expect(result.rejected.map((r) => [r.file.name, r.reason])).toEqual([
      ["b.pdf", "type"],
      ["c.jpg", "size"],
    ]);
    expect(validateFiles(files).accepted).toHaveLength(4);
  });

  it("matches MIME types case-insensitively, ignores parameters and accepts */*", () => {
    const text = file("a.txt", "text/plain;charset=utf-8", 1);
    expect(validateFiles([text], ["TEXT/PLAIN"]).accepted).toHaveLength(1);
    expect(validateFiles([text], ["text/plain; charset=utf-8"]).accepted).toHaveLength(1);
    expect(validateFiles([file("a.png", "IMAGE/PNG", 1)], ["image/*"]).accepted).toHaveLength(1);
    expect(validateFiles([file("x", "application/x-y", 1)], ["*/*"]).accepted).toHaveLength(1);
    expect(validateFiles([text], ["image/*"]).rejected).toHaveLength(1);
  });
});

describe("otp", () => {
  it("filters by charset and fills forward, cutting what does not fit", () => {
    expect(sanitizeOtp("12 3-4a", "numeric")).toBe("1234");
    expect(sanitizeOtp("a1-B2", "alphanumeric", 3)).toBe("a1B");
    expect(fillOtp(["", "", "", ""], 1, "98765")).toEqual({
      cells: ["", "9", "8", "7"],
      focus: 3,
    });
    expect(fillOtp(["1", "", "", ""], 1, "2")).toEqual({ cells: ["1", "2", "", ""], focus: 2 });
  });
});
