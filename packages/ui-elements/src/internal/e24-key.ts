/**
 * The key a map draws under its drawing for what the chart's own legend cannot show next to its
 * color bar: the "No data" swatch and, on the globe, the marker categories. Lazy: a chart without
 * either never loads it.
 */
export interface KeyItem {
  id: string;
  name: string;
  color: string;
  shape?: "square" | "dot";
  /** A button that hides and shows the series `id` through the chart. */
  toggle?: boolean;
  /** A thin border: the swatch of a fill that is nearly the page color. */
  outline?: boolean;
}

interface KeyHost extends HTMLElement {
  toggleSeries(id: string): void;
  isHidden(id: string): boolean;
}

const lists = new WeakMap<HTMLElement, { list: HTMLUListElement; items: readonly KeyItem[] }>();

export function renderKey(host: HTMLElement, items: readonly KeyItem[]): void {
  let entry = lists.get(host);
  if (!entry) {
    if (items.length === 0) return;
    const list = document.createElement("ul");
    list.dataset.uiPart = "geo-key";
    list.addEventListener("click", (event) => {
      const id = (event.target as Element).closest<HTMLElement>("button[data-id]")?.dataset.id;
      if (id !== undefined) (host as KeyHost).toggleSeries(id);
    });
    host.addEventListener("chart-series", () => paint(host));
    entry = { list, items };
    lists.set(host, entry);
  }
  entry.items = items;
  if (items.length === 0) entry.list.remove();
  else if (!entry.list.isConnected) host.append(entry.list);
  paint(host);
}

function paint(host: HTMLElement): void {
  const entry = lists.get(host);
  if (!entry) return;
  entry.list.replaceChildren(
    ...entry.items.map((item) => {
      const li = document.createElement("li");
      const node = document.createElement(item.toggle ? "button" : "span");
      node.dataset.item = "";
      if (item.toggle) {
        (node as HTMLButtonElement).type = "button";
        node.dataset.id = item.id;
        node.setAttribute("aria-pressed", `${!(host as KeyHost).isHidden(item.id)}`);
      }
      const swatch = document.createElement("span");
      swatch.dataset.swatch = "";
      swatch.dataset.shape = item.shape ?? "square";
      if (item.outline) swatch.dataset.outline = "";
      swatch.setAttribute("aria-hidden", "true");
      swatch.style.background = item.color;
      node.append(swatch, item.name);
      li.append(node);
      return li;
    }),
  );
}
