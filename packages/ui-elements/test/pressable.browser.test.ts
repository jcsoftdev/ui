import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { definePressable } from "../src/pressable/pressable.ts";
import { mount, wait } from "./setup.ts";

beforeAll(() => {
  definePressable();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const press = (el: Element, x = 20, y = 10) =>
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y }));
const ripples = (el: Element) => el.shadowRoot!.querySelectorAll("[part=ripple]");

describe("ui-pressable", () => {
  it("spawns a ripple at the pointer that removes itself, and adds no semantics", async () => {
    const host = mount(`<ui-pressable style="margin:0"><button>Go</button></ui-pressable>`);
    const el = host.firstElementChild!;
    const rect = el.getBoundingClientRect();
    press(el, rect.left + 5, rect.top + 5);
    expect(ripples(el)).toHaveLength(1);
    const dot = ripples(el)[0] as HTMLElement;
    const size = Math.hypot(rect.width, rect.height) * 2;
    expect(parseFloat(dot.style.width)).toBeCloseTo(size);
    expect(parseFloat(dot.style.left)).toBeCloseTo(5 - size / 2);
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    expect(el.getAttribute("role")).toBeNull();
    await wait(600);
    expect(ripples(el)).toHaveLength(0);
  });

  it("skips the ripple when ripple is false or it is disabled", () => {
    const host = mount(
      `<ui-pressable ripple="false"><button>A</button></ui-pressable><ui-pressable disabled><button>B</button></ui-pressable>`,
    );
    for (const el of Array.from(host.children)) {
      press(el);
      expect(ripples(el)).toHaveLength(0);
    }
    expect(getComputedStyle(host.children[1]!).pointerEvents).toBe("none");
  });

  it("scales down while pressed unless scale is false", async () => {
    const host = mount(
      `<ui-pressable id="a"><button>A</button></ui-pressable><ui-pressable id="b" scale="false"><button>B</button></ui-pressable>`,
    );
    const a = host.querySelector("#a") as HTMLElement;
    expect(getComputedStyle(a).transitionProperty).toContain("scale");
    expect(getComputedStyle(host.querySelector("#b")!).transitionProperty).not.toContain("scale");
  });
});
