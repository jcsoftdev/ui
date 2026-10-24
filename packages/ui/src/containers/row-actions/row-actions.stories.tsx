import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { Copy, Pencil, Trash2 } from "../../icons/index.js";
import {
  Table,
  TableActionsCell,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "../table/table.js";
import { RowActions } from "./row-actions.js";

const meta = {
  title: "Containers/RowActions",
  component: RowActions,
  tags: ["autodocs"],
  args: {
    label: "Acciones de Ana Quispe",
    primary: <Button size="sm">Ver ficha</Button>,
    items: [
      { id: "delete", label: "Eliminar", tone: "danger", icon: <Trash2 />, onSelect: fn() },
      { id: "edit", label: "Editar", icon: <Pencil />, onSelect: fn() },
      { id: "copy", label: "Duplicar", icon: <Copy />, onSelect: fn(), disabled: true },
    ],
  },
} satisfies Meta<typeof RowActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One inline action and an overflow menu; the destructive item sorts last, behind a separator. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Acciones de Ana Quispe" });
    await expect(Math.round(trigger.getBoundingClientRect().height)).toBe(30);
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    await expect(items.map((item) => item.textContent)).toEqual(["Editar", "Duplicar", "Eliminar"]);
    await expect(within(menu).getByRole("separator")).toBeInTheDocument();
    await expect(items[1]).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{End}{Enter}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await expect(args.items[0]?.onSelect).toHaveBeenCalledTimes(1);
  },
};

/** Without items only the primary action shows: no empty menu trigger. */
export const PrimaryOnly: Story = {
  args: { items: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Acciones de Ana Quispe" })).toBeNull();
    await expect(canvas.getByRole("button", { name: "Ver ficha" })).toBeInTheDocument();
  },
};

const people = ["Ana Quispe", "Luis Ramírez", "María Fernanda de la Torre Villanueva"];

/**
 * In a clickable row: neither the inline action nor the menu activates the row, and the actions
 * stay on one line in a narrow table.
 */
export const InClickableRow: Story = {
  render: function Render() {
    const [opened, setOpened] = useState<string[]>([]);
    return (
      <div className="w-[420px] max-w-full">
        <Table aria-label="Personas" stickyActions>
          <TableHead>
            <tr>
              <TableHeaderCell>Nombre</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Acciones</span>
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {people.map((name) => (
              <TableRow
                key={name}
                data-testid={`row-${name}`}
                className="cursor-pointer"
                onClick={() => setOpened((list) => [...list, name])}
              >
                <TableCell>{name}</TableCell>
                <TableActionsCell>
                  <RowActions
                    label={`Acciones de ${name}`}
                    primary={<Button size="sm">Ver ficha</Button>}
                    items={[
                      { id: "edit", label: "Editar", onSelect: () => {} },
                      { id: "delete", label: "Eliminar", tone: "danger", onSelect: () => {} },
                    ]}
                  />
                </TableActionsCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <output data-testid="opened">{opened.join(", ")}</output>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const name = "María Fernanda de la Torre Villanueva";
    const actions = canvas
      .getByRole("button", { name: `Acciones de ${name}` })
      .closest("[data-slot=row-actions]") as HTMLElement;
    await expect(Math.round(actions.getBoundingClientRect().height)).toBe(30);
    await userEvent.click(within(actions).getByRole("button", { name: "Ver ficha" }));
    await userEvent.click(canvas.getByRole("button", { name: `Acciones de ${name}` }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Editar" }));
    await expect(canvas.getByTestId("opened")).toHaveTextContent("");
    await userEvent.click(canvas.getByText("Ana Quispe"));
    await expect(canvas.getByTestId("opened")).toHaveTextContent("Ana Quispe");
  },
};
