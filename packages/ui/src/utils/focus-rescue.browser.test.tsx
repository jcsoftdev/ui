/// <reference types="@vitest/browser-playwright" />
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Kanban } from "../containers/kanban/kanban.js";
import type { KanbanColumnData } from "../containers/kanban/model.js";
import {
  ListDetail,
  ListDetailDetail,
  ListDetailItem,
  ListDetailList,
} from "../containers/list-detail/list-detail.js";
import { ResponsiveList } from "../containers/responsive-list/responsive-list.js";
import { toast } from "../overlays/toaster/toast.js";
import { reset } from "../overlays/toaster/toast-store.js";
import { Toaster } from "../overlays/toaster/toaster.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settle = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  reset();
});

async function mount(node: React.ReactNode) {
  await act(async () => root.render(node));
  await settle();
}

const click = async (element: HTMLElement | null) => {
  await act(async () => element?.click());
  await settle(60);
};

const remove = async (element: HTMLElement | null | undefined) => {
  await act(async () => {
    element?.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  });
  await settle(60);
};

const labelOf = () => document.activeElement?.textContent?.trim();

describe("toast action", () => {
  test("returns focus to the element focused before the toast", async () => {
    function Screen() {
      return (
        <>
          <button
            type="button"
            id="origin"
            onClick={() => toast("Hecho", { action: { label: "Deshacer", onClick: () => {} } })}
          >
            Aprobar
          </button>
          <Toaster duration={Number.POSITIVE_INFINITY} />
        </>
      );
    }
    await mount(<Screen />);
    const origin = host.querySelector<HTMLElement>("#origin");
    origin?.focus();
    await click(origin);
    const action = document.querySelector<HTMLElement>("[data-type] button");
    expect(action?.textContent).toBe("Deshacer");
    action?.focus();
    await click(action);
    await settle(300);
    expect(document.activeElement).toBe(origin);
  });

  test("lands on the nearest surviving row when the origin row is gone", async () => {
    function Screen() {
      const [rows, setRows] = useState(["a", "b"]);
      return (
        <>
          <ul id="rows" aria-label="Filas">
            {rows.map((row) => (
              <li key={row}>
                <button
                  type="button"
                  id={`row-${row}`}
                  onClick={() => {
                    setRows((current) => current.filter((r) => r !== row));
                    toast("Aprobado", { action: { label: "Deshacer", onClick: () => {} } });
                  }}
                >
                  {row}
                </button>
              </li>
            ))}
          </ul>
          <Toaster duration={Number.POSITIVE_INFINITY} />
        </>
      );
    }
    await mount(<Screen />);
    const first = host.querySelector<HTMLElement>("#row-a");
    first?.focus();
    await click(first);
    const action = document.querySelector<HTMLElement>("[data-type] button");
    action?.focus();
    await click(action);
    await settle(300);
    expect(document.activeElement?.id).toBe("row-b");
  });
});

describe("ListDetail", () => {
  function Screen({ initial }: { initial: string[] }) {
    const [items, setItems] = useState(initial);
    return (
      <ListDetail aria-label="Pedidos" defaultValue={null}>
        <ListDetailList>
          {items.map((item) => (
            <ListDetailItem
              key={item}
              value={item}
              onKeyDown={(event) => {
                if (event.key === "Delete")
                  setItems((current) => current.filter((i) => i !== item));
              }}
            >
              {item}
            </ListDetailItem>
          ))}
        </ListDetailList>
        <ListDetailDetail aria-label="Detalle">detalle</ListDetailDetail>
      </ListDetail>
    );
  }

  test("focus moves to the next item when the focused one is removed", async () => {
    await mount(<Screen initial={["uno", "dos", "tres"]} />);
    const items = () => Array.from(host.querySelectorAll<HTMLElement>("[data-list-detail-item]"));
    items()[0]?.focus();
    await remove(items()[0]);
    expect(labelOf()).toBe("dos");
  });

  test("focus moves to the previous item when the last one is removed", async () => {
    await mount(<Screen initial={["uno", "dos"]} />);
    const items = () => Array.from(host.querySelectorAll<HTMLElement>("[data-list-detail-item]"));
    items()[1]?.focus();
    await remove(items()[1]);
    expect(labelOf()).toBe("uno");
  });

  test("focus lands on the list when it empties", async () => {
    await mount(<Screen initial={["uno"]} />);
    const item = host.querySelector<HTMLElement>("[data-list-detail-item]");
    item?.focus();
    await remove(item);
    expect(document.activeElement?.tagName).toBe("UL");
  });

  test("focus that moved elsewhere on purpose is left alone", async () => {
    await mount(
      <>
        <input id="elsewhere" />
        <Screen initial={["uno", "dos"]} />
      </>,
    );
    const item = host.querySelector<HTMLElement>("[data-list-detail-item]");
    item?.focus();
    host.querySelector<HTMLElement>("#elsewhere")?.focus();
    await remove(item);
    expect(document.activeElement?.id).toBe("elsewhere");
  });
});

describe("ResponsiveList", () => {
  test("the row after a removed one takes focus, actions included", async () => {
    function Screen() {
      const [items, setItems] = useState(["a", "b", "c"]);
      return (
        <ResponsiveList
          caption="Pedidos"
          layout="cards"
          items={items}
          rowKey={(item) => item}
          columns={[{ key: "name", header: "Pedido", cell: (item) => item }]}
          renderActions={(item) => (
            <button type="button" onClick={() => setItems((c) => c.filter((i) => i !== item))}>
              Aprobar {item}
            </button>
          )}
        />
      );
    }
    await mount(<Screen />);
    const buttons = () =>
      Array.from(host.querySelectorAll<HTMLElement>("[data-row-actions] button"));
    buttons()[0]?.focus();
    await click(buttons()[0] ?? null);
    expect(labelOf()).toBe("Aprobar b");
  });
});

describe("Kanban", () => {
  test("focus stays in the lane when a card leaves it", async () => {
    const initial: KanbanColumnData[] = [
      {
        id: "todo",
        title: "Por hacer",
        cards: [
          { id: "1", title: "Uno" },
          { id: "2", title: "Dos" },
        ],
      },
      { id: "done", title: "Hecho", cards: [] },
    ];
    function Screen() {
      const [columns, setColumns] = useState(initial);
      return (
        <Kanban
          aria-label="Tablero"
          columns={columns}
          draggable={false}
          cardActions={(card) => (
            <button
              type="button"
              onClick={() =>
                setColumns((current) =>
                  current.map((column) => ({
                    ...column,
                    cards:
                      column.id === "todo"
                        ? column.cards.filter((c) => c.id !== card.id)
                        : column.id === "done"
                          ? [...column.cards, card]
                          : column.cards,
                  })),
                )
              }
            >
              Mover {card.title}
            </button>
          )}
        />
      );
    }
    await mount(<Screen />);
    const first = host.querySelector<HTMLElement>("[data-card-actions] button");
    first?.focus();
    await click(first);
    expect(labelOf()).toBe("Mover Dos");
  });
});
