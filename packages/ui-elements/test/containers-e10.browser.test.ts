import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineItemCardGroup } from "../src/item-card-group/item-card-group.ts";
import { defineKpiGroup, type UiKpiItem } from "../src/kpi-group/kpi-group.ts";
import {
  defineResponsiveList,
  type UiResponsiveList,
} from "../src/responsive-list/responsive-list.ts";
import { defineTimeline } from "../src/timeline/timeline.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineItemCardGroup();
  defineKpiGroup();
  defineTimeline();
  defineResponsiveList();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-item-card-group", () => {
  const group = () =>
    mount(`<ui-item-card-group heading="Clients" description="Active" selected-id="b">
      <ui-item-card id="a" heading="Ana" description="ana@x.pe"><span slot="leading">A</span><span slot="trailing">3</span></ui-item-card>
      <ui-item-card id="b" heading="Beto" interactive></ui-item-card>
      <ui-item-card id="c" heading="Cleo" interactive disabled></ui-item-card>
    </ui-item-card-group>`).firstElementChild!;

  it("is a named group with a list of rows and the selected row current", async () => {
    const el = group();
    expect(await ax("group", "Clients")).toBeTruthy();
    expect(el.querySelector("[role=list]")!.children).toHaveLength(3);
    expect(el.querySelectorAll("[role=listitem]")).toHaveLength(3);
    expect(el.querySelector("#b [aria-current=true]")).toBeTruthy();
    expect(el.querySelector("#a [aria-current]")).toBeNull();
    el.setAttribute("selected-id", "a");
    expect(el.querySelector("#a [aria-current=true]")).toBeTruthy();
    expect(el.querySelector("#b [aria-current]")).toBeNull();
    expect(el.querySelector("#a [data-ui-part=leading]")!.textContent).toBe("A");
    expect(el.querySelector("#a [data-ui-part=trailing]")!.textContent).toBe("3");
    expect(el.querySelector("#a [data-ui-part=item-description]")!.textContent).toBe("ana@x.pe");
  });

  it("only interactive rows are buttons; they emit select and skip when disabled", async () => {
    const el = group();
    const select = vi.fn((event: Event) => (event as CustomEvent).detail.id);
    el.addEventListener("select", select);
    expect(el.querySelector("#a button")).toBeNull();
    expect(el.querySelector("#a [data-ui-part=chevron]")).toBeNull();
    expect(el.querySelector("#b [data-ui-part=chevron]")).toBeTruthy();
    await userEvent.click(el.querySelector("#b button")!);
    expect(select).toHaveReturnedWith("b");
    expect(el.querySelector<HTMLButtonElement>("#c button")!.disabled).toBe(true);
    el.querySelector<HTMLElement>("#b button")!.focus();
    await userEvent.keyboard("{Enter}");
    expect(select).toHaveBeenCalledTimes(2);
  });

  it("prepended rows keep their order, removals and a removed selected-id update the highlight", async () => {
    const el = group();
    const row = document.createElement("ui-item-card");
    row.id = "z";
    row.setAttribute("heading", "Zed");
    el.prepend(row);
    await vi.waitFor(() => expect(el.querySelector("[role=list]")!.firstElementChild).toBe(row));
    el.removeAttribute("selected-id");
    expect(el.querySelector("[aria-current]")).toBeNull();
    el.setAttribute("selected-id", "z");
    expect(row.hasAttribute("selected")).toBe(true);
    el.querySelector("#a")!.remove();
    expect(el.querySelectorAll("[role=listitem]")).toHaveLength(3);
  });

  it("rows added later join the list", async () => {
    const el = group();
    const row = document.createElement("ui-item-card");
    row.setAttribute("heading", "Dani");
    el.append(row);
    await vi.waitFor(() => expect(row.closest("[role=list]")).toBeTruthy());
  });
});

describe("ui-kpi-group", () => {
  const kpis = (attrs = "") =>
    mount(`<div style="width:${"800px"}"><ui-kpi-group ${attrs}>
      <ui-kpi-item label="Revenue" value="1234.5" format='{"style":"currency","currency":"PEN","locale":"es-PE"}' trend="12.5" trend-label="vs last month"></ui-kpi-item>
      <ui-kpi-item label="Churn" value="2" trend="-1" invert-trend description="monthly"></ui-kpi-item>
      <ui-kpi-item label="Plan" value="Pro"></ui-kpi-item>
      <ui-kpi-item label="Seats"><b slot="value">12</b></ui-kpi-item>
    </ui-kpi-group></div>`).querySelector("ui-kpi-group")!;

  it("is a description list of terms and definitions", async () => {
    const el = kpis('animate="false"');
    expect(el.querySelector("dl")!.children).toHaveLength(4);
    expect(await ax("term", "Revenue")).toBeTruthy();
    expect(el.querySelectorAll("dt")[2]!.textContent).toBe("Plan");
    expect(el.querySelectorAll("[data-ui-part=value]")[2]!.textContent).toBe("Pro");
    expect(el.querySelectorAll("[data-ui-part=value]")[3]!.textContent).toBe("12");
    expect(el.querySelectorAll("[data-ui-part=description]")[0]!.textContent).toBe("monthly");
  });

  it("formats numbers with the format config", () => {
    const el = kpis('animate="false"');
    const value = el.querySelector("[data-ui-part=value]")!.textContent!;
    expect(value).toMatch(/1[\s,.]?234[.,]50/);
    expect(value).toContain("S/");
  });

  it("counts up to the value, and exposes the final text to assistive technology", async () => {
    const el = kpis();
    const first = el.querySelector<UiKpiItem>("ui-kpi-item")!;
    const text = first.querySelector("[data-ui-part=text]")!;
    expect(text.getAttribute("aria-hidden")).toBe("true");
    expect(first.querySelector("[data-ui-part=sr]")!.textContent).toMatch(/1[\s,.]?234/);
    await vi.waitFor(() => expect(text.textContent).toMatch(/1[\s,.]?234[.,]50/), {
      timeout: 3000,
    });
  });

  it("trend chip carries direction and tone in words, not colour alone", () => {
    const el = kpis('animate="false"');
    const [revenue, churn] = Array.from(el.querySelectorAll<HTMLElement>("[data-ui-part=trend]"));
    expect(revenue!.dataset.tone).toBe("positive");
    expect(revenue!.textContent).toContain("sube, favorable");
    expect(revenue!.textContent).toContain("vs last month");
    expect(churn!.dataset.tone).toBe("positive");
    expect(churn!.dataset.direction).toBe("down");
  });

  it("survives an invalid locale in the format and keeps the item out of the dl content model", () => {
    const el = mount(
      `<ui-kpi-group animate="false"><ui-kpi-item label="a" value="5" format='{"locale":"not_a_locale!"}'></ui-kpi-item></ui-kpi-group>`,
    ).firstElementChild!;
    expect(el.querySelector("[data-ui-part=value]")!.textContent).toBe("5");
    expect(el.querySelector("ui-kpi-item")!.getAttribute("role")).toBe("none");
  });

  it("columns follow the container: 1, 2 or 4 across", () => {
    const columns = (width: number) => {
      document.body.innerHTML = "";
      const el = mount(
        `<div style="width:${width}px"><ui-kpi-group animate="false"><ui-kpi-item label="a" value="1"></ui-kpi-item><ui-kpi-item label="b" value="2"></ui-kpi-item></ui-kpi-group></div>`,
      );
      return getComputedStyle(el.querySelector("dl")!).gridTemplateColumns.split(" ").length;
    };
    expect([columns(300), columns(500), columns(900)]).toEqual([1, 2, 4]);
  });
});

describe("ui-timeline", () => {
  const timeline = () =>
    mount(`<ui-timeline>
      <ui-timeline-item heading="Paid" time="14:30" datetime="2026-10-13T14:30" actor="Ana" tone="success" group="Today" description="Card ending 4242"><svg slot="icon" width="14" height="14"></svg><button>Receipt</button></ui-timeline-item>
      <ui-timeline-item heading="Created" time="09:00" group="Today"></ui-timeline-item>
      <ui-timeline-item heading="Quoted" group="Yesterday"></ui-timeline-item>
    </ui-timeline>`).firstElementChild!;

  it("is a list of items with a time element and extras under the text", async () => {
    const el = timeline();
    expect(el.getAttribute("role")).toBe("list");
    expect(el.children).toHaveLength(3);
    const first = el.querySelector("ui-timeline-item")!;
    expect(first.getAttribute("role")).toBe("listitem");
    const time = first.querySelector("time")!;
    expect(time.getAttribute("datetime")).toBe("2026-10-13T14:30");
    expect(first.querySelector("[data-ui-part=actor]")!.textContent).toBe("Ana");
    expect(first.querySelector("[data-ui-part=extras] button")).toBeTruthy();
    expect(first.querySelector("[data-ui-part=marker] svg")).toBeTruthy();
    expect(first.querySelector("[data-ui-part=dot]")).toBeNull();
    expect(await ax("list")).toBeTruthy();
  });

  it("shows a group heading only where the group changes, and updates when it does", () => {
    const el = timeline();
    const headings = () =>
      Array.from(el.querySelectorAll("[data-ui-part=group]")).map((h) => h.textContent);
    expect(headings()).toEqual(["Today", "Yesterday"]);
    el.querySelectorAll("ui-timeline-item")[1]!.setAttribute("group", "Earlier");
    expect(headings()).toEqual(["Today", "Earlier", "Yesterday"]);
  });

  it("keeps heading and order when an item is prepended, inserted or removed", async () => {
    const el = timeline();
    const headings = () =>
      Array.from(el.querySelectorAll("[data-ui-part=group]")).map((h) => h.textContent);
    const first = el.firstElementChild as HTMLElement;
    first.remove();
    await vi.waitFor(() =>
      expect(el.firstElementChild!.querySelector("[data-ui-part=group]")?.textContent).toBe(
        "Today",
      ),
    );
    expect(headings()).toEqual(["Today", "Yesterday"]);
    const added = document.createElement("ui-timeline-item");
    added.setAttribute("heading", "New");
    added.setAttribute("group", "Now");
    el.prepend(added);
    await vi.waitFor(() => expect(headings()).toEqual(["Now", "Today", "Yesterday"]));
    expect(el.firstElementChild).toBe(added);
    const middle = document.createElement("ui-timeline-item");
    middle.setAttribute("heading", "Mid");
    middle.setAttribute("group", "Today");
    el.insertBefore(middle, el.children[2]!);
    await vi.waitFor(() => expect(el.children[2]).toBe(middle));
  });

  it("draws a connector between items but not after the last, and tints the marker by tone", () => {
    const el = timeline();
    const items = el.querySelectorAll("ui-timeline-item");
    const display = (item: Element) =>
      getComputedStyle(item.querySelector("[data-ui-part=connector]")!).display;
    expect(display(items[0]!)).not.toBe("none");
    expect(display(items[2]!)).toBe("none");
    const marker = (item: Element) =>
      getComputedStyle(item.querySelector("[data-ui-part=marker]")!).backgroundColor;
    expect(marker(items[0]!)).not.toBe(marker(items[1]!));
    expect(items[2]!.querySelector("[data-ui-part=dot]")).toBeTruthy();
  });
});

describe("ui-responsive-list", () => {
  interface Order {
    id: string;
    customer: string;
    total: number;
  }
  const orders: Order[] = [
    { id: "o1", customer: "Ana", total: 120 },
    { id: "o2", customer: "Beto", total: 80 },
  ];
  const make = (width: number) => {
    const host = mount(
      `<div style="width:${width}px"><ui-responsive-list caption="Orders"></ui-responsive-list></div>`,
    );
    const list = host.querySelector("ui-responsive-list") as UiResponsiveList<Order>;
    list.columns = [
      { key: "customer", header: "Customer", cell: (o) => o.customer },
      { key: "total", header: "Total", cell: (o) => `S/ ${o.total}`, align: "end" },
    ];
    list.rowKey = (o) => o.id;
    list.renderActions = (o) => {
      const button = document.createElement("button");
      button.textContent = `Open ${o.id}`;
      return button;
    };
    list.rowClass = (o) => (o.id === "o2" ? "late" : undefined);
    list.items = orders;
    return list;
  };

  it("renders a captioned table with scoped headers and an actions column", async () => {
    const list = make(900);
    await vi.waitFor(() => expect(list.querySelector("table")).toBeTruthy());
    expect(list.querySelector("caption")!.textContent).toBe("Orders");
    expect(Array.from(list.querySelectorAll("th")).map((th) => [th.textContent, th.scope])).toEqual(
      [
        ["Customer", "col"],
        ["Total", "col"],
        ["Actions", "col"],
      ],
    );
    expect(list.querySelector('tr[data-row-key="o2"]')!.className).toBe("late");
    expect(await ax("table", "Orders")).toBeTruthy();
    expect(await ax("list", "Orders")).toBeUndefined();
  });

  it("shows the table from 48rem and the cards below, of its own width", async () => {
    const wide = make(900);
    await vi.waitFor(() => expect(wide.querySelector("table")).toBeTruthy());
    expect(getComputedStyle(wide.querySelector("table")!.parentElement!).display).not.toBe("none");
    expect(getComputedStyle(wide.querySelector("ul")!).display).toBe("none");
    document.body.innerHTML = "";
    const narrow = make(500);
    await vi.waitFor(() => expect(narrow.querySelector("ul")).toBeTruthy());
    expect(getComputedStyle(narrow.querySelector("table")!.parentElement!).display).toBe("none");
    expect(getComputedStyle(narrow.querySelector("ul")!).display).not.toBe("none");
    expect(await ax("list", "Orders")).toBeTruthy();
    expect(await ax("table", "Orders")).toBeUndefined();
  });

  it("stacks each row as a card: primary title, details, actions", async () => {
    const list = make(500);
    await vi.waitFor(() => expect(list.querySelector("li")).toBeTruthy());
    const card = list.querySelector('li[data-row-key="o1"]')!;
    expect(card.querySelector("[data-ui-part=card-title]")!.textContent).toBe("Ana");
    expect(card.querySelector("dt")!.textContent).toBe("Total");
    expect(card.querySelector("dd")!.textContent).toBe("S/ 120");
    expect(card.querySelector("button")!.textContent).toBe("Open o1");
    expect(list.querySelector('li[data-row-key="o2"]')!.className).toBe("late");
  });

  it("keeps focus on the same row control across a re-render, and takes properties set before upgrade", async () => {
    const list = make(900);
    await vi.waitFor(() => expect(list.querySelector("table")).toBeTruthy());
    const button = list.querySelector<HTMLElement>('tr[data-row-key="o2"] button')!;
    button.focus();
    list.items = [...orders];
    await vi.waitFor(() =>
      expect(list.querySelector('tr[data-row-key="o2"] button')).not.toBe(button),
    );
    expect(document.activeElement).toBe(list.querySelector('tr[data-row-key="o2"] button'));

    const early = document.createElement("late-responsive-list") as UiResponsiveList<Order>;
    early.setAttribute("caption", "Orders");
    early.columns = [{ key: "c", header: "Customer", cell: (o) => o.customer }];
    early.rowKey = (o) => o.id;
    early.items = orders;
    document.body.append(early);
    defineResponsiveList({ prefix: "late" });
    await vi.waitFor(() => expect(early.querySelectorAll("tbody tr")).toHaveLength(2));
  });

  it("a primary column becomes the card title and items re-render", async () => {
    const list = make(500);
    list.columns = [
      { key: "customer", header: "Customer", cell: (o) => o.customer },
      { key: "total", header: "Total", cell: (o) => String(o.total), primary: true },
    ];
    list.renderActions = undefined;
    list.items = [orders[1]!];
    await vi.waitFor(() => expect(list.querySelectorAll("li")).toHaveLength(1));
    expect(list.querySelector("[data-ui-part=card-title]")!.textContent).toBe("80");
    expect(list.querySelector("dt")!.textContent).toBe("Customer");
    expect(list.querySelectorAll("th")).toHaveLength(2);
  });
});
