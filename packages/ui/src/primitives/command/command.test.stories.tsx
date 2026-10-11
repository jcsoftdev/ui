import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Dialog as UiDialog,
} from "../../overlays/dialog/dialog.js";
import * as Command from "./command.js";

const meta = {
  title: "Tests/Command",
  tags: ["!autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const options = () => screen.queryAllByRole("option");
const names = () => options().map((option) => option.textContent);
const selectedName = () =>
  options()
    .find((option) => option.getAttribute("aria-selected") === "true")
    ?.textContent?.trim();
const input = () => screen.getByRole("combobox");
const selectSpy = fn();

interface BasicProps {
  onSelect?: (value: string) => void;
  loop?: boolean;
  shouldFilter?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  filter?: Command.CommandFilter;
  vimBindings?: boolean;
}

function Basic({ onSelect, className, ...rootProps }: BasicProps) {
  return (
    <div className="p-6">
      <Command.Root label="Buscar" className={className} {...rootProps}>
        <Command.Input placeholder="Buscar..." />
        <Command.List>
          <Command.Empty>Sin resultados</Command.Empty>
          <Command.Group heading="Acciones">
            <Command.Item value="nueva-cita" keywords={["reserva"]} onSelect={onSelect}>
              Nueva cita
            </Command.Item>
            <Command.Item value="cobrar" keywords={["caja", "pago"]} onSelect={onSelect}>
              Cobrar servicio
            </Command.Item>
            <Command.Item value="bloqueado" disabled onSelect={onSelect}>
              Cierre de caja
            </Command.Item>
          </Command.Group>
          <Command.Separator />
          <Command.Group heading="Clientes">
            <Command.Item value="marco" onSelect={onSelect}>
              Marco Ríos
            </Command.Item>
            <Command.Item value="lucho" onSelect={onSelect}>
              Lucho Vargas
            </Command.Item>
          </Command.Group>
          <Command.Group heading="Inventario">
            <Command.Item value="pomada" onSelect={onSelect}>
              Pomada mate
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command.Root>
    </div>
  );
}

export const TypingFiltersAndSorts: Story = {
  render: () => <Basic />,
  play: async () => {
    await userEvent.type(input(), "mar");
    await waitFor(() => expect(names()).toEqual(["Marco Ríos"]));
    await userEvent.clear(input());
    await userEvent.type(input(), "ca");
    await waitFor(() => expect(names()[0]).toBe("Cobrar servicio"));
    await expect(names()).not.toContain("Pomada mate");
  },
};

export const SortsByScoreAndRestoresOrder: Story = {
  render: () => <Basic />,
  play: async () => {
    const original = names();
    await userEvent.type(input(), "o");
    await waitFor(() => expect(names().length).toBeGreaterThan(0));
    await userEvent.type(input(), "m");
    await userEvent.clear(input());
    await waitFor(() => expect(names()).toEqual(original));
    await userEvent.type(input(), "lucho");
    await waitFor(() => expect(names()).toEqual(["Lucho Vargas"]));
  },
};

export const SortsUngroupedItemsByScore: Story = {
  render: () => (
    <Command.Root label="Orden">
      <Command.Input />
      <Command.List>
        <Command.Item value="Open settings">Open settings</Command.Item>
        <Command.Item value="Sweet tin grapes">Sweet tin grapes</Command.Item>
        <Command.Item value="Settings">Settings</Command.Item>
        <Command.Item value="Settings page">Settings page</Command.Item>
      </Command.List>
    </Command.Root>
  ),
  play: async () => {
    await userEvent.type(input(), "settings");
    await waitFor(() =>
      expect(names()).toEqual(["Settings", "Settings page", "Open settings", "Sweet tin grapes"]),
    );
    await expect(selectedName()).toBe("Settings");
    await userEvent.clear(input());
    await waitFor(() =>
      expect(names()).toEqual(["Open settings", "Sweet tin grapes", "Settings", "Settings page"]),
    );
  },
};

export const KeywordsMatch: Story = {
  render: () => <Basic />,
  play: async () => {
    await userEvent.type(input(), "pago");
    await waitFor(() => expect(names()).toEqual(["Cobrar servicio"]));
  },
};

export const EmptyState: Story = {
  render: () => <Basic />,
  play: async () => {
    await expect(screen.queryByText("Sin resultados")).toBeNull();
    await userEvent.type(input(), "zzzz");
    await expect(await screen.findByText("Sin resultados")).toBeVisible();
    await expect(options()).toHaveLength(0);
    await userEvent.clear(input());
    await waitFor(() => expect(screen.queryByText("Sin resultados")).toBeNull());
  },
};

export const GroupsHideWhenEmptyAndSortByBestItem: Story = {
  render: () => <Basic />,
  play: async () => {
    const heading = (name: string) => screen.getByText(name).closest("[data-ui-command-group]");
    await expect(heading("Acciones")).toBeVisible();
    await userEvent.type(input(), "pomada");
    await waitFor(() => expect(heading("Acciones")).not.toBeVisible());
    await expect(heading("Clientes")).not.toBeVisible();
    await expect(heading("Inventario")).toBeVisible();
    await userEvent.clear(input());
    await userEvent.type(input(), "p");
    await waitFor(() => expect(names()[0]).toBe("Pomada mate"));
    const groups = [...document.querySelectorAll("[data-ui-command-group]:not([hidden])")];
    await expect(groups[0]?.textContent).toContain("Inventario");
    await expect(groups[1]?.textContent).toContain("Acciones");
  },
};

export const SeparatorHidesWhileSearching: Story = {
  render: () => <Basic />,
  play: async () => {
    await expect(document.querySelectorAll("[data-ui-command-separator]")).toHaveLength(1);
    await userEvent.type(input(), "m");
    await waitFor(() =>
      expect(document.querySelectorAll("[data-ui-command-separator]")).toHaveLength(0),
    );
  },
};

export const KeyboardNavigationLoopHomeEnd: Story = {
  render: () => <Basic loop />,
  play: async () => {
    await userEvent.click(input());
    await expect(selectedName()).toBe("Nueva cita");
    await userEvent.keyboard("{ArrowDown}");
    await expect(selectedName()).toBe("Cobrar servicio");
    await userEvent.keyboard("{ArrowDown}");
    await expect(selectedName()).toBe("Marco Ríos");
    await userEvent.keyboard("{End}");
    await expect(selectedName()).toBe("Pomada mate");
    await userEvent.keyboard("{ArrowDown}");
    await expect(selectedName()).toBe("Nueva cita");
    await userEvent.keyboard("{ArrowUp}");
    await expect(selectedName()).toBe("Pomada mate");
    await userEvent.keyboard("{Home}");
    await expect(selectedName()).toBe("Nueva cita");
  },
};

export const WithoutLoopStopsAtEnds: Story = {
  render: () => <Basic />,
  play: async () => {
    await userEvent.click(input());
    await userEvent.keyboard("{ArrowUp}");
    await expect(selectedName()).toBe("Nueva cita");
    await userEvent.keyboard("{End}{ArrowDown}");
    await expect(selectedName()).toBe("Pomada mate");
  },
};

export const VimBindings: Story = {
  render: () => <Basic />,
  play: async () => {
    await userEvent.click(input());
    await userEvent.keyboard("{Control>}n{/Control}");
    await expect(selectedName()).toBe("Cobrar servicio");
    await userEvent.keyboard("{Control>}j{/Control}");
    await expect(selectedName()).toBe("Marco Ríos");
    await userEvent.keyboard("{Control>}p{/Control}");
    await expect(selectedName()).toBe("Cobrar servicio");
    await userEvent.keyboard("{Control>}k{/Control}");
    await expect(selectedName()).toBe("Nueva cita");
  },
};

export const VimBindingsCanBeDisabled: Story = {
  render: () => <Basic vimBindings={false} />,
  play: async () => {
    await userEvent.click(input());
    await userEvent.keyboard("{Control>}n{/Control}");
    await expect(selectedName()).toBe("Nueva cita");
  },
};

export const AltArrowJumpsGroups: Story = {
  render: () => <Basic />,
  play: async () => {
    await userEvent.click(input());
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await expect(selectedName()).toBe("Marco Ríos");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");
    await expect(selectedName()).toBe("Pomada mate");
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await expect(selectedName()).toBe("Marco Ríos");
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await expect(selectedName()).toBe("Nueva cita");
  },
};

export const DisabledItemsAreSkippedAndInert: Story = {
  render: () => <Basic onSelect={selectSpy} />,
  play: async () => {
    selectSpy.mockClear();
    await userEvent.click(input());
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    await expect(selectedName()).toBe("Marco Ríos");
    const disabled = screen.getByText("Cierre de caja");
    await expect(disabled).toHaveAttribute("aria-disabled", "true");
    await expect(disabled).toHaveAttribute("data-disabled");
    await userEvent.hover(disabled);
    await userEvent.click(disabled);
    await expect(selectedName()).toBe("Marco Ríos");
    await expect(selectSpy).not.toHaveBeenCalled();
  },
};

export const EnterAndClickSelect: Story = {
  render: () => <Basic onSelect={selectSpy} />,
  play: async () => {
    const onSelect = selectSpy;
    await userEvent.click(input());
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(onSelect).toHaveBeenLastCalledWith("cobrar"));
    await userEvent.click(screen.getByText("Lucho Vargas"));
    await expect(onSelect).toHaveBeenLastCalledWith("lucho");
  },
};

export const HoverHighlights: Story = {
  render: () => <Basic />,
  play: async () => {
    await userEvent.hover(screen.getByText("Pomada mate"));
    await waitFor(() => expect(selectedName()).toBe("Pomada mate"));
    await userEvent.hover(screen.getByText("Marco Ríos"));
    await waitFor(() => expect(selectedName()).toBe("Marco Ríos"));
  },
};

export const ActiveDescendantFollowsHighlight: Story = {
  render: () => <Basic />,
  play: async () => {
    const box = input();
    await expect(box).toHaveAttribute("role", "combobox");
    await expect(box).toHaveAttribute("aria-expanded", "true");
    await expect(box).toHaveAttribute("aria-autocomplete", "list");
    await expect(screen.getByRole("listbox")).toHaveAttribute(
      "id",
      box.getAttribute("aria-controls") ?? "",
    );
    await userEvent.click(box);
    await waitFor(() =>
      expect(box.getAttribute("aria-activedescendant")).toBe(
        screen.getByRole("option", { name: "Nueva cita" }).id,
      ),
    );
    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(box.getAttribute("aria-activedescendant")).toBe(
        screen.getByRole("option", { name: "Cobrar servicio" }).id,
      ),
    );
    await expect(screen.getByRole("option", { name: "Cobrar servicio" })).toHaveAttribute(
      "data-selected",
      "true",
    );
  },
};

export const SearchResetsHighlightToFirstResult: Story = {
  render: () => <Basic />,
  play: async () => {
    await userEvent.click(input());
    await userEvent.keyboard("{End}");
    await expect(selectedName()).toBe("Pomada mate");
    await userEvent.type(input(), "luc");
    await waitFor(() => expect(selectedName()).toBe("Lucho Vargas"));
  },
};

function ControlledValue() {
  const [value, setValue] = useState("lucho");
  return (
    <div>
      <p data-testid="current">{value}</p>
      <Basic value={value} onValueChange={setValue} />
    </div>
  );
}

export const ControlledValueStory: Story = {
  name: "ControlledValue",
  render: () => <ControlledValue />,
  play: async () => {
    await waitFor(() => expect(selectedName()).toBe("Lucho Vargas"));
    await userEvent.click(input());
    await userEvent.keyboard("{ArrowUp}");
    await waitFor(() => expect(screen.getByTestId("current")).toHaveTextContent("marco"));
    await expect(selectedName()).toBe("Marco Ríos");
  },
};

function ServerSide() {
  const [results, setResults] = useState(["Resultado B", "Resultado A", "Resultado C"]);
  return (
    <Command.Root label="Servidor" shouldFilter={false}>
      <Command.Input
        placeholder="Buscar..."
        onValueChange={(search) => {
          if (search === "z") setResults(["Zeta", "Alfa"]);
        }}
      />
      <Command.List>
        <Command.Empty>Sin resultados</Command.Empty>
        {results.map((result) => (
          <Command.Item key={result} value={result}>
            {result}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Root>
  );
}

export const ShouldFilterFalseKeepsOrder: Story = {
  render: () => <ServerSide />,
  play: async () => {
    await expect(names()).toEqual(["Resultado B", "Resultado A", "Resultado C"]);
    await userEvent.type(input(), "no-coincide");
    await pause(80);
    await expect(names()).toEqual(["Resultado B", "Resultado A", "Resultado C"]);
    await expect(screen.queryByText("Sin resultados")).toBeNull();
    await userEvent.clear(input());
    await userEvent.type(input(), "z");
    await waitFor(() => expect(names()).toEqual(["Zeta", "Alfa"]));
    await waitFor(() => expect(selectedName()).toBe("Zeta"));
  },
};

export const CustomFilterOverride: Story = {
  render: () => <Basic filter={(value, search) => (value.endsWith(search) ? 1 : 0)} />,
  play: async () => {
    await userEvent.type(input(), "co");
    await waitFor(() => expect(names()).toEqual(["Marco Ríos"]));
  },
};

export const ForceMountItemStaysVisible: Story = {
  render: () => (
    <Command.Root label="Forzado">
      <Command.Input />
      <Command.List>
        <Command.Item value="uno">Uno</Command.Item>
        <Command.Item value="fijo" forceMount>
          Siempre
        </Command.Item>
      </Command.List>
    </Command.Root>
  ),
  play: async () => {
    await userEvent.type(input(), "xyz");
    await pause(60);
    await expect(names()).toEqual(["Siempre"]);
  },
};

export const LoadingExposesProgress: Story = {
  render: () => (
    <Command.Root label="Cargando">
      <Command.Input />
      <Command.Loading progress={40}>Buscando...</Command.Loading>
      <Command.List>
        <Command.Item value="uno">Uno</Command.Item>
      </Command.List>
    </Command.Root>
  ),
  play: async () => {
    const bar = screen.getByRole("progressbar");
    await expect(bar).toHaveAttribute("aria-valuenow", "40");
  },
};

export const ClassNameOverrideWins: Story = {
  render: () => <Basic className="consumer-root" />,
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector("[data-ui-command]");
    await expect(root).toHaveClass("consumer-root");
  },
};

export const ListHeightVariable: Story = {
  render: () => <Basic />,
  play: async () => {
    const list = screen.getByRole("listbox");
    await waitFor(() =>
      expect(list.style.getPropertyValue("--ui-command-list-height")).toMatch(/^\d+(\.\d+)?px$/),
    );
    const before = Number.parseFloat(list.style.getPropertyValue("--ui-command-list-height"));
    await userEvent.type(input(), "pomada");
    await waitFor(() =>
      expect(
        Number.parseFloat(list.style.getPropertyValue("--ui-command-list-height")),
      ).toBeLessThan(before),
    );
  },
};

function Palette({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Abrir paleta</Button>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Paleta"
        overlayClassName="fixed inset-0 bg-black/40"
        contentClassName="fixed top-20 left-1/2 w-96 -translate-x-1/2 bg-white"
      >
        <Command.Input placeholder="Buscar..." />
        <Command.List>
          <Command.Empty>Sin resultados</Command.Empty>
          <Command.Item value="uno">Uno</Command.Item>
          <Command.Item value="dos">Dos</Command.Item>
        </Command.List>
      </Command.Dialog>
    </div>
  );
}

export const DialogOpensClosesAndReturnsFocus: Story = {
  render: () => <Palette />,
  play: async ({ canvasElement }) => {
    const opener = within(canvasElement).getByRole("button", { name: "Abrir paleta" });
    opener.focus();
    await userEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Paleta" });
    await waitFor(() => expect(input()).toHaveFocus());
    await expect(dialog).toHaveClass("w-96");
    await userEvent.type(input(), "do");
    await waitFor(() => expect(names()).toEqual(["Dos"]));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(opener).toHaveFocus());
    await userEvent.click(opener);
    await screen.findByRole("dialog");
    await userEvent.click(document.querySelector("[data-ui-command-overlay]") as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

export const DialogClosesOnEscapeEvenWithQuery: Story = {
  render: () => <Palette initialOpen />,
  play: async () => {
    await screen.findByRole("dialog");
    await userEvent.type(input(), "u");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

function InlineInsideDialog() {
  return (
    <UiDialog>
      <DialogTrigger asChild>
        <Button>Abrir</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Con buscador</DialogTitle>
        </DialogHeader>
        <Command.Root label="Interno">
          <Command.Input placeholder="Buscar..." />
          <Command.List>
            <Command.Item value="uno">Uno</Command.Item>
            <Command.Item value="dos">Dos</Command.Item>
          </Command.List>
        </Command.Root>
      </DialogContent>
    </UiDialog>
  );
}

export const InlineCommandInDialogEscapeClearsThenCloses: Story = {
  render: () => <InlineInsideDialog />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    await userEvent.click(input());
    await userEvent.type(input(), "do");
    await waitFor(() => expect(names()).toEqual(["Dos"]));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(input()).toHaveValue(""));
    await pause(80);
    await expect(screen.queryAllByRole("dialog")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  },
};

function PaletteOverDialog() {
  const [open, setOpen] = useState(false);
  return (
    <UiDialog>
      <DialogTrigger asChild>
        <Button>Abrir base</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Base</DialogTitle>
        </DialogHeader>
        <Button onClick={() => setOpen(true)}>Paleta</Button>
        <Command.Dialog open={open} onOpenChange={setOpen} label="Paleta">
          <Command.Input placeholder="Buscar..." />
          <Command.List>
            <Command.Item value="uno">Uno</Command.Item>
          </Command.List>
        </Command.Dialog>
      </DialogContent>
    </UiDialog>
  );
}

export const PaletteOverDialogEscapeClosesPaletteFirst: Story = {
  render: () => <PaletteOverDialog />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir base" }));
    await screen.findByRole("dialog", { name: "Base" });
    await userEvent.click(screen.getByRole("button", { name: "Paleta" }));
    await screen.findByRole("dialog", { name: "Paleta" });
    await waitFor(() => expect(input()).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Paleta" })).toBeNull());
    await pause(80);
    await expect(screen.getByRole("dialog", { name: "Base" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  },
};

const MANY = Array.from({ length: 1000 }, (_, index) => ({
  id: `item-${index}`,
  label: `Elemento ${index} ${["alfa", "beta", "gamma", "delta"][index % 4]}`,
}));

function Thousand() {
  return (
    <Command.Root label="Mil">
      <Command.Input placeholder="Buscar..." />
      <Command.List style={{ maxHeight: 240, overflow: "auto" }}>
        <Command.Empty>Sin resultados</Command.Empty>
        {MANY.map((item) => (
          <Command.Item key={item.id} value={item.id} keywords={[item.label]}>
            {item.label}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Root>
  );
}

export const ThousandItemsFilterWithinBudget: Story = {
  render: () => <Thousand />,
  play: async () => {
    await waitFor(() => expect(options()).toHaveLength(1000));
    const started = performance.now();
    await userEvent.type(input(), "99 gamma", { delay: 0 });
    await waitFor(() => expect(options().length).toBeLessThan(200));
    const elapsed = performance.now() - started; // about 65ms measured locally for 8 keystrokes
    console.info(`command: 1000 items, typed "99 gamma" and settled in ${elapsed.toFixed(0)}ms`);
    await expect(elapsed).toBeLessThan(2000);
    await expect(options().length).toBeGreaterThan(0);
    await expect(names()[0]).toContain("99");
    const clear = performance.now();
    await userEvent.clear(input());
    await waitFor(() => expect(options()).toHaveLength(1000));
    await expect(performance.now() - clear).toBeLessThan(3000);
  },
};

export const CommandStateHookReportsCount: Story = {
  render: () => {
    function Count() {
      const count = Command.useCommandState((state) => state.filtered.count);
      return <span data-testid="count">{count}</span>;
    }
    return (
      <Command.Root label="Cuenta">
        <Command.Input />
        <Count />
        <Command.List>
          <Command.Item value="alfa">Alfa</Command.Item>
          <Command.Item value="beta">Beta</Command.Item>
        </Command.List>
      </Command.Root>
    );
  },
  play: async () => {
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
    await userEvent.type(input(), "alf");
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
  },
};

function GrowingList() {
  const [fruits, setFruits] = useState(["apple"]);
  return (
    <div className="p-6">
      <Button onClick={() => setFruits(["apple", "avocado", "banana"])}>Cargar</Button>
      <Command.Root label="Frutas">
        <Command.Input placeholder="Buscar..." />
        <Command.List>
          {fruits.map((fruit) => (
            <Command.Item key={fruit}>{fruit}</Command.Item>
          ))}
        </Command.List>
      </Command.Root>
    </div>
  );
}

export const ItemsWithoutValueMountedMidSearchAppearAndFilter: Story = {
  render: () => <GrowingList />,
  play: async ({ canvasElement }) => {
    await userEvent.type(input(), "a");
    await waitFor(() => expect(names()).toEqual(["apple"]));
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Cargar" }));
    await waitFor(() => expect(names()).toEqual(["apple", "avocado", "banana"]));
    await userEvent.type(input(), "v");
    await waitFor(() => expect(names()).toEqual(["avocado"]));
  },
};

function StuckQueryInDialog() {
  return (
    <UiDialog>
      <DialogTrigger asChild>
        <Button>Abrir</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buscar</DialogTitle>
        </DialogHeader>
        <Command.Root label="Frutas">
          <Command.Input placeholder="Buscar..." value="ap" onValueChange={() => {}} />
          <Command.List>
            <Command.Item value="apple">apple</Command.Item>
          </Command.List>
        </Command.Root>
      </DialogContent>
    </UiDialog>
  );
}

export const ControlledQueryThatCannotClearReleasesEscape: Story = {
  render: () => <StuckQueryInDialog />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Abrir" }));
    await screen.findByRole("dialog");
    await userEvent.click(input());
    await userEvent.keyboard("{Escape}");
    await pause(80);
    await expect(screen.queryAllByRole("dialog")).toHaveLength(1);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryAllByRole("dialog")).toHaveLength(0));
  },
};
