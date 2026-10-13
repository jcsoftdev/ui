import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineActionBar, type UiActionBar } from "../src/action-bar/action-bar.ts";
import { defineButton } from "../src/button/button.ts";
import { defineConfirmAction, type UiConfirmAction } from "../src/confirm-action/confirm-action.ts";
import { defineToolbar } from "../src/toolbar/toolbar.ts";
import { ax, frame, mount } from "./setup.ts";

beforeAll(() => {
  defineButton();
  defineToolbar();
  defineActionBar();
  defineConfirmAction();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-toolbar", () => {
  it("is plain layout without roving", () => {
    const toolbar = mount(
      `<ui-toolbar><button>A</button><ui-toolbar-right><button>B</button></ui-toolbar-right></ui-toolbar>`,
    ).firstElementChild!;
    expect(toolbar.hasAttribute("role")).toBe(false);
    const right = toolbar.querySelector("ui-toolbar-right")!;
    const edge = toolbar.getBoundingClientRect().right;
    expect(Math.round(right.getBoundingClientRect().right)).toBe(Math.round(edge));
  });

  it("roving makes one tab stop and arrows, Home and End move", async () => {
    const host = mount(
      `<ui-toolbar roving aria-label="Filters"><button id="a">A</button><button id="b" disabled>B</button><button id="c">C</button><input id="t"><button id="d">D</button></ui-toolbar>`,
    );
    expect(await ax("toolbar", "Filters")).toBeTruthy();
    const pick = (id: string) => host.querySelector<HTMLElement>(`#${id}`) as HTMLElement;
    const [a, c, d] = [pick("a"), pick("c"), pick("d")] as [HTMLElement, HTMLElement, HTMLElement];
    await vi.waitFor(() => expect(a.tabIndex).toBe(0));
    expect([c.tabIndex, d.tabIndex]).toEqual([-1, -1]);
    a.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(c);
    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(d);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(a);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(a);
    host.querySelector("ui-toolbar")!.removeAttribute("roving");
    expect(host.querySelector("ui-toolbar")!.hasAttribute("role")).toBe(false);
    expect(c.hasAttribute("tabindex")).toBe(false);
  });
});

describe("ui-toolbar roving review fixes", () => {
  it("stopping roving puts back each item's own tabindex (ui-button)", async () => {
    const host = mount(
      `<ui-toolbar><ui-button id="a">A</ui-button><ui-button id="b">B</ui-button></ui-toolbar>`,
    );
    const toolbar = host.firstElementChild!;
    const [a, b] = [host.querySelector<HTMLElement>("#a")!, host.querySelector<HTMLElement>("#b")!];
    const before = [a.getAttribute("tabindex"), b.getAttribute("tabindex")];
    toolbar.setAttribute("roving", "");
    await vi.waitFor(() => expect(b.tabIndex).toBe(-1));
    toolbar.removeAttribute("roving");
    expect([a.getAttribute("tabindex"), b.getAttribute("tabindex")]).toEqual(before);
    expect(b.tabIndex).toBe(0);
  });

  it("leaves nested composites alone", async () => {
    const host = mount(
      `<ui-toolbar roving aria-label="T"><button id="a">A</button><div role="group"><button id="n">N</button></div><button id="c">C</button></ui-toolbar>`,
    );
    const [a, n, c] = ["a", "n", "c"].map((id) => host.querySelector<HTMLElement>(`#${id}`)!) as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    await vi.waitFor(() => expect(c.tabIndex).toBe(-1));
    expect(n.hasAttribute("tabindex")).toBe(false);
    a.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(c);
  });
});

describe("ui-action-bar", () => {
  const html = (attrs = "") =>
    `<div style="position:relative;width:600px;height:200px"><ui-action-bar ${attrs}><button id="x">Delete</button></ui-action-bar></div>`;

  it("renders nothing at zero and announces the count", async () => {
    const host = mount(html('selected-count="0"'));
    const bar = host.querySelector("ui-action-bar") as UiActionBar;
    expect(bar.hidden).toBe(true);
    expect(await ax("toolbar", "Acciones para la selección")).toBeUndefined();
    bar.setAttribute("selected-count", "1");
    expect(bar.hidden).toBe(false);
    const count = bar.querySelector("[aria-live=polite]")!;
    expect(count.textContent).toBe("1 seleccionado");
    bar.setAttribute("selected-count", "3");
    expect(count.textContent).toBe("3 seleccionados");
    expect(await ax("toolbar", "Acciones para la selección")).toBeTruthy();
  });

  it("keeps the actions in order and floats at the bottom of the positioned parent", () => {
    const host = mount(html('selected-count="2" clearable'));
    const bar = host.querySelector("ui-action-bar") as UiActionBar;
    const parts = Array.from(bar.children).map((child) => child.getAttribute("data-ui-part"));
    expect(parts).toEqual(["count", "actions", "clear"]);
    expect(bar.querySelector("[data-ui-part=actions] #x")).toBeTruthy();
    const parent = bar.parentElement!.getBoundingClientRect();
    const rect = bar.getBoundingClientRect();
    expect(Math.round(parent.bottom - rect.bottom)).toBe(16);
    expect(Math.abs(rect.left - parent.left - (parent.right - rect.right))).toBeLessThan(2);
  });

  it("clear button and Escape emit clear; labels and nouns are configurable", async () => {
    const host = mount(
      html(
        'selected-count="2" clearable noun-singular="cita" noun-plural="citas" clear-label="Clear"',
      ),
    );
    const bar = host.querySelector("ui-action-bar") as UiActionBar;
    const clear = vi.fn();
    bar.addEventListener("clear", clear);
    expect(bar.querySelector("[aria-live]")!.textContent).toBe("2 citas");
    const button = bar.querySelector<HTMLButtonElement>("[data-ui-part=clear]")!;
    expect(button.getAttribute("aria-label")).toBe("Clear");
    button.click();
    expect(clear).toHaveBeenCalledTimes(1);
    host.querySelector<HTMLElement>("#x")!.focus();
    await userEvent.keyboard("{Escape}");
    expect(clear).toHaveBeenCalledTimes(2);
    bar.removeAttribute("clearable");
    expect(bar.querySelector("[data-ui-part=clear]")).toBeNull();
  });

  it("an action added later lands in the actions group", async () => {
    const host = mount(html('selected-count="1"'));
    const bar = host.querySelector("ui-action-bar") as UiActionBar;
    const added = document.createElement("button");
    bar.append(added);
    await vi.waitFor(() =>
      expect(added.parentElement?.getAttribute("data-ui-part")).toBe("actions"),
    );
  });

  it("roving gives the actions one tab stop", async () => {
    const host = mount(
      `<div style="position:relative;height:100px"><ui-action-bar selected-count="1" roving><button id="a">A</button><button id="b">B</button></ui-action-bar></div>`,
    );
    const a = host.querySelector<HTMLElement>("#a") as HTMLElement;
    const b = host.querySelector<HTMLElement>("#b") as HTMLElement;
    await vi.waitFor(() => expect(b.tabIndex).toBe(-1));
    a.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(b);
  });

  it("keeps the roving position across count changes, and prepended actions go first", async () => {
    const host = mount(
      `<div style="position:relative;height:100px"><ui-action-bar selected-count="1" roving><button id="a">A</button><button id="b">B</button></ui-action-bar></div>`,
    );
    const bar = host.querySelector("ui-action-bar") as UiActionBar;
    const b = host.querySelector<HTMLElement>("#b")!;
    await vi.waitFor(() => expect(b.tabIndex).toBe(-1));
    b.focus();
    await vi.waitFor(() => expect(b.tabIndex).toBe(0));
    bar.setAttribute("selected-count", "2");
    bar.setAttribute("label", "Other");
    await frame();
    expect(document.activeElement).toBe(b);
    expect(b.tabIndex).toBe(0);
    const first = document.createElement("button");
    first.id = "first";
    bar.prepend(first);
    await vi.waitFor(() =>
      expect(bar.querySelector("[data-ui-part=actions]")!.firstElementChild).toBe(first),
    );
  });

  it("Escape that was already handled does not clear, and handled Escape is prevented", async () => {
    const host = mount(html('selected-count="2" clearable'));
    const bar = host.querySelector("ui-action-bar")!;
    const clear = vi.fn();
    bar.addEventListener("clear", clear);
    const button = host.querySelector<HTMLElement>("#x")!;
    button.addEventListener("keydown", (event) => event.preventDefault());
    button.focus();
    await userEvent.keyboard("{Escape}");
    expect(clear).not.toHaveBeenCalled();
  });

  it("works under a custom prefix", () => {
    defineActionBar({ prefix: "acme" });
    const host = mount(`<acme-action-bar selected-count="1"><button>x</button></acme-action-bar>`);
    expect(host.firstElementChild!.querySelector("[aria-live]")!.textContent).toBe(
      "1 seleccionado",
    );
  });
});

describe("ui-confirm-action", () => {
  const make = (attrs = "") =>
    mount(
      `<ui-confirm-action label="Cancel order" consequence="The order is cancelled." ${attrs}></ui-confirm-action>`,
    ).firstElementChild as UiConfirmAction;
  const buttons = (el: Element) => Array.from(el.querySelectorAll("button"));

  it("shows one trigger, then the consequence with Confirm and Cancel, focus on Cancel", async () => {
    const el = make();
    expect(buttons(el).map((b) => b.textContent)).toEqual(["Cancel order"]);
    expect(el.querySelector("fieldset")).toBeNull();
    buttons(el)[0]!.click();
    const fieldset = el.querySelector("fieldset")!;
    expect(fieldset.querySelector("legend")!.textContent).toBe("Cancel order");
    expect(el.querySelector(`#${fieldset.getAttribute("aria-describedby")}`)!.textContent).toBe(
      "The order is cancelled.",
    );
    expect(buttons(el).map((b) => b.textContent)).toEqual(["Confirm", "Cancel"]);
    expect(document.activeElement?.textContent).toBe("Cancel");
    expect(await ax("group", "Cancel order")).toBeTruthy();
  });

  it("cancel returns focus to the trigger", () => {
    const el = make();
    const cancel = vi.fn();
    el.addEventListener("cancel", cancel);
    buttons(el)[0]!.click();
    buttons(el)[1]!.click();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(el.querySelector("fieldset")).toBeNull();
    expect(document.activeElement).toBe(buttons(el)[0]);
  });

  it("runs the action, shows busy state, then closes and returns focus", async () => {
    const el = make('processing-label="Working"');
    let finish!: () => void;
    el.onConfirm = () => new Promise<void>((resolve) => (finish = resolve));
    const confirmed = vi.fn();
    el.addEventListener("confirm", confirmed);
    buttons(el)[0]!.click();
    buttons(el)[0]!.click();
    const [confirm, cancel] = buttons(el);
    expect(confirm!.getAttribute("aria-busy")).toBe("true");
    expect(confirm!.textContent).toContain("Working");
    expect(cancel!.disabled).toBe(true);
    finish();
    await vi.waitFor(() => expect(confirmed).toHaveBeenCalledTimes(1));
    expect(el.querySelector("fieldset")).toBeNull();
    expect(document.activeElement).toBe(buttons(el)[0]);
  });

  it("does not steal focus when opened from outside, and a failure clears on reopen", async () => {
    const el = make();
    const other = document.createElement("input");
    document.body.append(other);
    other.focus();
    el.open();
    expect(document.activeElement).toBe(other);
    el.onConfirm = async () => ({ ok: false, error: "No" });
    buttons(el)[0]!.click();
    await vi.waitFor(() => expect(el.querySelector("[role=alert]")).toBeTruthy());
    el.cancel();
    el.open();
    expect(el.querySelector("[role=alert]")).toBeNull();
  });

  it("takes onConfirm set before the element was upgraded", async () => {
    const early = document.createElement("late-confirm-action") as UiConfirmAction;
    early.setAttribute("label", "Go");
    const run = vi.fn(async () => {});
    early.onConfirm = run;
    document.body.append(early);
    defineConfirmAction({ prefix: "late" });
    early.open();
    early.querySelector<HTMLButtonElement>('[data-variant="danger"]')!.click();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });

  it("a returned failure or a throw keeps the step open with an alert", async () => {
    const el = make();
    el.onConfirm = async () => ({ ok: false, error: "Already shipped" });
    buttons(el)[0]!.click();
    buttons(el)[0]!.click();
    await vi.waitFor(() =>
      expect(el.querySelector("[role=alert]")?.textContent).toBe("Already shipped"),
    );
    expect(el.querySelector("fieldset")).not.toBeNull();
    expect(buttons(el)[1]!.disabled).toBe(false);
    el.onConfirm = () => {
      throw new Error("boom");
    };
    buttons(el)[0]!.click();
    await vi.waitFor(() =>
      expect(el.querySelector("[role=alert]")?.textContent).toBe(
        "The action could not be completed. Try again.",
      ),
    );
    expect(await ax("alert")).toBeTruthy();
  });
});
