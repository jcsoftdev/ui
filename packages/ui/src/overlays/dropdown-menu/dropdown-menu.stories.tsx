import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import {
  DropdownMenu,
  DropdownMenuAnchor,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  dropdownMenuItemClasses,
} from "./dropdown-menu.js";

const meta = {
  title: "Overlays/DropdownMenu",
  component: DropdownMenuContent,
  tags: ["autodocs"],
  args: { align: "start", side: "bottom", sideOffset: 6 },
  argTypes: {
    align: { control: "inline-radio", options: ["start", "center", "end"] },
    side: { control: "inline-radio", options: ["top", "right", "bottom", "left"] },
    sideOffset: { control: "number" },
    children: { control: false },
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof DropdownMenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Acciones de la cita</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...args}>
        <DropdownMenuLabel>Luis Ramírez · 11:30</DropdownMenuLabel>
        <DropdownMenuItem>Reprogramar</DropdownMenuItem>
        <DropdownMenuItem>Cobrar S/ 45</DropdownMenuItem>
        <DropdownMenuItem disabled>Enviar recordatorio</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger">Anular cita</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const OpenByDefault: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">Acciones de la cita</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...args}>
        <DropdownMenuLabel>Luis Ramírez · 11:30</DropdownMenuLabel>
        <DropdownMenuItem>Reprogramar</DropdownMenuItem>
        <DropdownMenuItem>Cobrar S/ 45</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger">Anular cita</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const RadioFilter: Story = {
  render: (args) => {
    const [barber, setBarber] = useState("todos");
    return (
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">Barbero: {barber}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...args}>
          <DropdownMenuLabel>Filtrar por barbero</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={barber} onValueChange={setBarber}>
            <DropdownMenuRadioItem value="todos">Todos</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="diego">Diego Quispe</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="mateo">Mateo Flores</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="camila">Camila Rojas</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

/**
 * A user menu in a sidebar footer: the whole card is the anchor, a nested button is the custom
 * trigger, the panel is `bare` with its own surface and header, and one item is a link.
 */
export const CustomUserMenu: Story = {
  render: () => (
    <DropdownMenu modal={false}>
      <DropdownMenuAnchor asChild>
        <div className="flex w-64 items-center gap-2 rounded-lg border border-line p-2">
          <span className="grow text-body">Ana Torres</span>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Account menu" className="rounded p-1">
              ...
            </button>
          </DropdownMenuTrigger>
        </div>
      </DropdownMenuAnchor>
      <DropdownMenuContent
        bare
        side="top"
        align="start"
        className="w-64 rounded-lg border border-line bg-surface p-0"
      >
        <div className="border-b-divider px-3 py-2.5">
          <p className="m-0 text-control text-ink">Ana Torres</p>
          <p className="m-0 text-meta text-ink-3">ana@school.test</p>
        </div>
        <div className="p-1">
          <DropdownMenuItem asChild>
            <a href="#profile" className={dropdownMenuItemClasses}>
              Profile
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem>Sign out</DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Account menu" }));
    const menu = await screen.findByRole("menu");
    const style = getComputedStyle(menu);
    await expect(style.paddingTop).toBe("0px");
    await expect(style.borderTopWidth).not.toBe("0px");
    const profile = within(menu).getByRole("menuitem", { name: "Profile" });
    await expect(profile.tagName).toBe("A");
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(profile).toHaveFocus());
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(within(menu).getByRole("menuitem", { name: "Sign out" })).toHaveFocus(),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  },
};
