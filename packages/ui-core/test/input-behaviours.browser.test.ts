import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { createFileDrop } from "../src/file-drop.ts";
import { createOtp } from "../src/otp.ts";
import { createPointerDrag, type DragPoint } from "../src/pointer-drag.ts";
import { createPressRepeat } from "../src/press-repeat.ts";
import { createSegmentedInput } from "../src/segmented-input.ts";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const pointer = (type: string, init: PointerEventInit = {}) =>
  new PointerEvent(type, { bubbles: true, pointerId: 7, pointerType: "touch", ...init });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createPointerDrag", () => {
  it("tracks ratios inside the bounds, clamps outside them and reports the end", () => {
    const host = mount(
      `<div id="track" style="position:fixed;left:100px;top:50px;width:200px;height:20px"></div>`,
    );
    const track = host.querySelector<HTMLElement>("#track") as HTMLElement;
    const points: DragPoint[] = [];
    const ends: boolean[] = [];
    const drag = createPointerDrag(track, {
      onStart: (point) => void points.push(point),
      onMove: (point) => void points.push(point),
      onEnd: (_point, cancelled) => void ends.push(cancelled),
    });

    track.dispatchEvent(pointer("pointerdown", { clientX: 150, clientY: 60 }));
    expect(drag.dragging).toBe(true);
    track.dispatchEvent(pointer("pointermove", { clientX: 200, clientY: 60 }));
    track.dispatchEvent(pointer("pointermove", { clientX: 900, clientY: 60 }));
    track.dispatchEvent(pointer("pointerup", { clientX: 900, clientY: 60 }));

    expect(points.map((point) => point.ratioX)).toEqual([0.25, 0.5, 1]);
    expect(points[1]).toMatchObject({ dx: 50, dy: 0 });
    expect(ends).toEqual([false]);
    expect(drag.dragging).toBe(false);

    track.dispatchEvent(pointer("pointermove", { clientX: 200, clientY: 60 }));
    expect(points).toHaveLength(3);
    drag.destroy();
  });

  it("ignores the wrong mouse button and a disabled drag, and cancels cleanly", () => {
    const host = mount(`<div id="t" style="width:100px;height:10px"></div>`);
    const element = host.querySelector<HTMLElement>("#t") as HTMLElement;
    let disabled = true;
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const drag = createPointerDrag(element, { disabled: () => disabled, onStart, onEnd });
    element.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }));
    expect(onStart).not.toHaveBeenCalled();
    disabled = false;
    element.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 2 }));
    expect(onStart).not.toHaveBeenCalled();
    element.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }));
    expect(drag.dragging).toBe(true);
    element.dispatchEvent(pointer("pointercancel", { pointerType: "mouse" }));
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), true);
    drag.destroy();
  });

  it("keeps tracking outside the element with a real captured mouse drag", async () => {
    const host = mount(
      `<div id="a" style="position:fixed;left:20px;top:20px;width:100px;height:30px;background:#ccc"></div>`,
    );
    const element = host.querySelector<HTMLElement>("#a") as HTMLElement;
    const moves: number[] = [];
    const drag = createPointerDrag(element, { onMove: (point) => void moves.push(point.dx) });
    await userEvent.dragAndDrop(element, document.body, {
      sourcePosition: { x: 10, y: 10 },
      targetPosition: { x: 400, y: 300 },
    });
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[moves.length - 1] as number).toBeGreaterThan(200);
    drag.destroy();
  });
});

describe("createPressRepeat", () => {
  it("fires on press, repeats after the delay, and stops on release", async () => {
    const host = mount(`<button id="b">+</button>`);
    const button = host.querySelector<HTMLElement>("#b") as HTMLElement;
    const counts: number[] = [];
    const onClick = vi.fn();
    button.addEventListener("click", onClick);
    const stop = createPressRepeat(button, {
      onRepeat: (count) => void counts.push(count),
      delay: 40,
      interval: 20,
    });
    button.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }));
    expect(counts).toEqual([0]);
    await wait(150);
    expect(counts.length).toBeGreaterThanOrEqual(4);
    button.dispatchEvent(pointer("pointerup", { pointerType: "mouse" }));
    const settled = counts.length;
    await wait(80);
    expect(counts).toHaveLength(settled);
    button.click();
    expect(onClick).not.toHaveBeenCalled();
    stop();
  });

  it("steps once per key press, follows key auto-repeat, and honours disabled", async () => {
    const host = mount(`<button id="b">+</button>`);
    const button = host.querySelector<HTMLElement>("#b") as HTMLElement;
    let disabled = false;
    const onRepeat = vi.fn();
    const stop = createPressRepeat(button, { onRepeat, disabled: () => disabled });
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRepeat).toHaveBeenCalledTimes(1);
    button.dispatchEvent(new KeyboardEvent("keydown", { key: " ", repeat: true, bubbles: true }));
    expect(onRepeat).toHaveBeenLastCalledWith(1);
    disabled = true;
    button.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }));
    await userEvent.keyboard("{Enter}");
    expect(onRepeat).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe("createPressRepeat disabled mid-hold", () => {
  it("stops repeating once disabled() turns true inside a tick", async () => {
    const host = mount(`<button id="b">+</button>`);
    const button = host.querySelector<HTMLElement>("#b") as HTMLElement;
    let disabled = false;
    const onRepeat = vi.fn();
    const stop = createPressRepeat(button, {
      onRepeat,
      disabled: () => disabled,
      delay: 20,
      interval: 20,
    });
    button.dispatchEvent(pointer("pointerdown", { pointerType: "mouse", button: 0 }));
    await wait(100);
    disabled = true;
    await wait(60);
    const settled = onRepeat.mock.calls.length;
    await wait(100);
    expect(onRepeat).toHaveBeenCalledTimes(settled);
    stop();
  });
});

describe("createSegmentedInput", () => {
  it("types a time with the mask, commits it, and steps the segment under the caret", async () => {
    const host = mount(`<input id="t">`);
    const input = host.querySelector<HTMLInputElement>("#t") as HTMLInputElement;
    const changes: string[] = [];
    const field = createSegmentedInput(input, {
      kind: "time",
      step: 15,
      onChange: (value) => void changes.push(value),
    });
    input.focus();
    await userEvent.keyboard("0930");
    expect(input.value).toBe("09:30");
    expect(changes).toEqual(["09:30"]);

    input.setSelectionRange(4, 4);
    await userEvent.keyboard("{ArrowUp}");
    expect(input.value).toBe("09:45");
    expect(input.selectionStart).toBe(3);
    expect(input.selectionEnd).toBe(5);
    input.setSelectionRange(1, 1);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(input.value).toBe("07:45");
    expect(changes.at(-1)).toBe("07:45");
    expect(field.getValue()).toBe("07:45");
    field.destroy();
  });

  it("reverts a half-typed or impossible time on blur and clears on empty", async () => {
    const host = mount(`<input id="t">`);
    const input = host.querySelector<HTMLInputElement>("#t") as HTMLInputElement;
    const changes: string[] = [];
    const field = createSegmentedInput(input, {
      kind: "time",
      value: "08:15",
      onChange: (value) => void changes.push(value),
    });
    expect(input.value).toBe("08:15");
    input.focus();
    await userEvent.fill(input, "2500");
    expect(input.value).toBe("25:00");
    expect(changes).toEqual([]);
    input.blur();
    expect(input.value).toBe("08:15");
    input.focus();
    await userEvent.fill(input, "930");
    input.blur();
    expect(input.value).toBe("09:30");
    expect(changes).toEqual(["09:30"]);
    input.focus();
    await userEvent.clear(input);
    expect(changes.at(-1)).toBe("");
    field.destroy();
  });

  it("masks a date in its order, commits ISO, and wraps the month with the arrows", async () => {
    const host = mount(`<input id="d">`);
    const input = host.querySelector<HTMLInputElement>("#d") as HTMLInputElement;
    const changes: string[] = [];
    const field = createSegmentedInput(input, {
      kind: "date",
      order: "mdy",
      separator: "-",
      onChange: (value) => void changes.push(value),
    });
    input.focus();
    await userEvent.keyboard("01312024");
    expect(input.value).toBe("01-31-2024");
    expect(changes).toEqual(["2024-01-31"]);
    input.setSelectionRange(1, 1);
    await userEvent.keyboard("{ArrowUp}");
    expect(input.value).toBe("02-29-2024");
    field.setValue("2025-12-01");
    expect(input.value).toBe("12-01-2025");
    field.destroy();
  });
});

describe("createFileDrop", () => {
  const dropOf = (files: File[], type = "drop") => {
    const data = new DataTransfer();
    for (const file of files) data.items.add(file);
    return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data });
  };

  it("flags a file drag without flicker, validates the drop and ignores non-file drags", () => {
    const host = mount(`<div id="z"><span id="child">x</span></div>`);
    const zone = host.querySelector<HTMLElement>("#z") as HTMLElement;
    const child = host.querySelector<HTMLElement>("#child") as HTMLElement;
    const flags: boolean[] = [];
    const onFiles = vi.fn();
    const onReject = vi.fn();
    const drop = createFileDrop(zone, {
      onFiles,
      onReject,
      accept: ["image/*"],
      maxSize: 5,
      onDraggingChange: (dragging) => void flags.push(dragging),
    });
    const png = new File(["1234"], "a.png", { type: "image/png" });
    const big = new File(["1234567"], "b.png", { type: "image/png" });
    const txt = new File(["1"], "c.txt", { type: "text/plain" });

    zone.dispatchEvent(dropOf([png], "dragenter"));
    child.dispatchEvent(dropOf([png], "dragenter"));
    zone.dispatchEvent(dropOf([png], "dragleave"));
    expect(flags).toEqual([true]);
    const over = dropOf([png], "dragover");
    child.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    child.dispatchEvent(dropOf([png], "dragleave"));
    expect(flags).toEqual([true, false]);

    zone.dispatchEvent(dropOf([png], "dragenter"));
    const event = dropOf([png, big, txt]);
    zone.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(flags).toEqual([true, false, true, false]);
    expect(onFiles).toHaveBeenCalledWith([png]);
    expect(onReject.mock.calls[0]?.[0].map((r: { reason: string }) => r.reason)).toEqual([
      "size",
      "type",
    ]);

    const text = new DataTransfer();
    text.setData("text/plain", "hi");
    const textDrag = new DragEvent("dragover", {
      bubbles: true,
      cancelable: true,
      dataTransfer: text,
    });
    zone.dispatchEvent(textDrag);
    expect(textDrag.defaultPrevented).toBe(false);
    drop.destroy();
  });

  it("keeps only the first file when multiple is off", () => {
    const host = mount(`<div id="z"></div>`);
    const zone = host.querySelector<HTMLElement>("#z") as HTMLElement;
    const onFiles = vi.fn();
    const onReject = vi.fn();
    const drop = createFileDrop(zone, { onFiles, onReject, multiple: false });
    const a = new File(["a"], "a.txt");
    const b = new File(["b"], "b.txt");
    zone.dispatchEvent(dropOf([a, b]));
    expect(onFiles).toHaveBeenCalledWith([a]);
    expect(onReject).toHaveBeenCalledWith([{ file: b, reason: "count" }]);
    drop.destroy();
  });
});

describe("createOtp", () => {
  const cells = `<div id="otp">${'<input maxlength="1" inputmode="numeric">'.repeat(4)}</div>`;
  const inputs = (host: HTMLElement) =>
    Array.from(host.querySelectorAll<HTMLInputElement>("input"));

  it("advances while typing, rejects letters, and completes", async () => {
    const host = mount(cells);
    const done = vi.fn();
    const changes: string[] = [];
    const otp = createOtp(host.querySelector("#otp") as HTMLElement, {
      onChange: (code) => void changes.push(code),
      onComplete: done,
    });
    const [first] = inputs(host);
    first?.focus();
    await userEvent.keyboard("1a23");
    expect(inputs(host).map((cell) => cell.value)).toEqual(["1", "2", "3", ""]);
    expect(document.activeElement).toBe(inputs(host)[3]);
    expect(done).not.toHaveBeenCalled();
    await userEvent.keyboard("4");
    expect(done).toHaveBeenCalledWith("1234");
    expect(otp.value()).toBe("1234");
    expect(changes.at(-1)).toBe("1234");
    otp.destroy();
  });

  it("spreads a paste from the focused cell and cuts the overflow", async () => {
    const host = mount(cells);
    const otp = createOtp(host.querySelector("#otp") as HTMLElement);
    inputs(host)[1]?.focus();
    const data = new DataTransfer();
    data.setData("text", " 98-76 54");
    inputs(host)[1]?.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }),
    );
    expect(inputs(host).map((cell) => cell.value)).toEqual(["", "9", "8", "7"]);
    expect(document.activeElement).toBe(inputs(host)[3]);
    otp.destroy();
  });

  it("backspace clears then steps back, and the arrows and Home/End move between cells", async () => {
    const host = mount(cells);
    const otp = createOtp(host.querySelector("#otp") as HTMLElement);
    otp.setValue("123");
    inputs(host)[3]?.focus();
    await userEvent.keyboard("{Backspace}");
    expect(inputs(host).map((cell) => cell.value)).toEqual(["1", "2", "", ""]);
    expect(document.activeElement).toBe(inputs(host)[2]);
    await userEvent.keyboard("{Backspace}");
    expect(inputs(host).map((cell) => cell.value)).toEqual(["1", "", "", ""]);
    expect(document.activeElement).toBe(inputs(host)[1]);
    inputs(host)[0]?.focus();
    await userEvent.keyboard("{Backspace}");
    expect(otp.value()).toBe("");
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(inputs(host)[0]);
    await userEvent.keyboard("{ArrowRight}{End}");
    expect(document.activeElement).toBe(inputs(host)[3]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(inputs(host)[2]);
    otp.destroy();
  });

  it("takes a code dumped into one cell (autofill) and spreads it", () => {
    const host = mount(cells);
    const otp = createOtp(host.querySelector("#otp") as HTMLElement, {
      cells: () => inputs(host),
    });
    for (const cell of inputs(host)) cell.removeAttribute("maxlength");
    const first = inputs(host)[0] as HTMLInputElement;
    first.value = "4821";
    first.dispatchEvent(new Event("input", { bubbles: true }));
    expect(otp.value()).toBe("4821");
    otp.destroy();
  });
});
