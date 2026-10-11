import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, fn, screen, userEvent, waitFor } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { reset } from "./toast-store.js";
import { Toaster, toast } from "./toaster.js";

const meta = {
  title: "Overlays/Toaster",
  component: Toaster,
  tags: ["autodocs"],
  args: { position: "bottom-center", duration: 6000, visibleToasts: 2 },
  argTypes: {
    position: {
      control: "select",
      options: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
    },
    duration: { control: "number" },
    visibleToasts: { control: "number" },
    label: { control: "text" },
    className: { control: false },
  },
  parameters: { layout: "centered" },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button onClick={() => toast("Cita agendada para Luis Ramírez, sábado 11:30")}>
        Agendar cita
      </Button>
    </>
  ),
};

export const WithUndoAction: Story = {
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button
        variant="secondary"
        onClick={() =>
          toast("Cita de Marco Salas anulada", {
            action: { label: "Deshacer", onClick: () => toast("Cita restaurada") },
          })
        }
      >
        Anular cita
      </Button>
    </>
  ),
};

export const OpenByDefault: Story = {
  args: { duration: Number.POSITIVE_INFINITY },
  render: (args) => {
    // Rendered once on mount so docs show a visible toast.
    setTimeout(() => {
      toast.dismiss();
      toast("Pago de S/ 45 registrado con Yape", {
        action: { label: "Ver recibo", onClick: () => undefined },
      });
    }, 0);
    return <Toaster {...args} />;
  },
};

export const TopRightStack: Story = {
  args: { position: "top-right", visibleToasts: 3 },
  render: (args) => (
    <>
      <Toaster {...args} />
      <Button
        variant="secondary"
        onClick={() => {
          toast("Stock bajo: Pomada mate (9 u.)");
          toast("Nuevo cliente: José Carrasco");
          toast("Cobro de S/ 25 completado");
        }}
      >
        Lanzar 3 avisos
      </Button>
    </>
  ),
};

const cleanUp = () => reset();

const withToaster =
  (props: Partial<React.ComponentProps<typeof Toaster>> = {}): Story["render"] =>
  (args) => <Toaster {...args} {...props} />;

export const ShowsAtMostTwo: Story = {
  render: withToaster({ duration: Number.POSITIVE_INFINITY }),
  play: async () => {
    cleanUp();
    toast("Primero");
    toast("Segundo");
    toast("Tercero");
    await waitFor(() => expect(screen.getAllByRole("status")).toHaveLength(2));
    await expect(screen.queryByText("Primero")).toBeNull();
    await expect(screen.getByText("Tercero")).toBeInTheDocument();
    toast.dismiss("missing");
    toast.dismiss();
    await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0));
  },
};

export const ActionRunsAndDismisses: Story = {
  render: withToaster({ duration: Number.POSITIVE_INFINITY }),
  play: async () => {
    cleanUp();
    const onClick = fn();
    toast("Cita anulada", { action: { label: "Deshacer", onClick } });
    await userEvent.click(await screen.findByRole("button", { name: "Deshacer" }));
    await expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Cita anulada")).toBeNull());
  },
};

export const DismissById: Story = {
  render: withToaster({ duration: Number.POSITIVE_INFINITY }),
  play: async () => {
    cleanUp();
    const keep = toast("Se queda");
    const drop = toast("Se va");
    await screen.findByText("Se va");
    toast.dismiss(drop);
    await waitFor(() => expect(screen.queryByText("Se va")).toBeNull());
    await expect(screen.getByText("Se queda")).toBeInTheDocument();
    await expect(keep).not.toBe(drop);
  },
};

export const AutoDismissPausesOnHover: Story = {
  render: withToaster({ duration: 700 }),
  play: async () => {
    cleanUp();
    toast("Guardado");
    const item = await screen.findByRole("status");
    await userEvent.hover(item);
    await new Promise((r) => setTimeout(r, 1100));
    await expect(screen.getByText("Guardado")).toBeInTheDocument();
    await userEvent.unhover(item);
    await waitFor(() => expect(screen.queryByText("Guardado")).toBeNull(), { timeout: 3000 });
  },
};

export const AutoDismissPausesOnFocus: Story = {
  render: withToaster({ duration: 700 }),
  play: async () => {
    cleanUp();
    toast("Con foco", { action: { label: "Ver", onClick: () => undefined } });
    const button = await screen.findByRole("button", { name: "Ver" });
    button.focus();
    await new Promise((r) => setTimeout(r, 1100));
    await expect(screen.getByText("Con foco")).toBeInTheDocument();
    button.blur();
    await waitFor(() => expect(screen.queryByText("Con foco")).toBeNull(), { timeout: 3000 });
  },
};

export const EscapeDismissesFocusedToast: Story = {
  render: withToaster({ duration: Number.POSITIVE_INFINITY }),
  play: async () => {
    cleanUp();
    toast("Cerrar con Escape", { action: { label: "Ver", onClick: () => undefined } });
    (await screen.findByRole("button", { name: "Ver" })).focus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Cerrar con Escape")).toBeNull());
  },
};

export const SwipeDismissesOnTouch: Story = {
  render: withToaster({ duration: Number.POSITIVE_INFINITY }),
  play: async () => {
    cleanUp();
    toast("Desliza");
    const item = await screen.findByRole("status");
    const touch = { pointerType: "touch", pointerId: 1 };
    fireEvent.pointerDown(item, { ...touch, clientX: 100 });
    fireEvent.pointerMove(item, { ...touch, clientX: 130 });
    fireEvent.pointerUp(item, { ...touch, clientX: 130 });
    await expect(screen.getByText("Desliza")).toBeInTheDocument();
    fireEvent.pointerDown(item, { ...touch, clientX: 100 });
    fireEvent.pointerMove(item, { ...touch, clientX: 200 });
    fireEvent.pointerUp(item, { ...touch, clientX: 200 });
    await waitFor(() => expect(screen.queryByText("Desliza")).toBeNull());
  },
};

export const ErrorIsAnAlert: Story = {
  render: withToaster({ duration: Number.POSITIVE_INFINITY }),
  play: async () => {
    cleanUp();
    toast.error("No se pudo guardar");
    toast.success("Listo");
    const alert = await screen.findByRole("alert");
    await expect(alert).toHaveTextContent("No se pudo guardar");
    await expect(alert).toHaveAttribute("aria-live", "assertive");
    await expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  },
};

export const RegionIsLabelled: Story = {
  render: withToaster(),
  play: async () => {
    cleanUp();
    await expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
    await userEvent.keyboard("{Alt>}t{/Alt}");
    await expect(screen.getByRole("region", { name: "Notifications" })).toHaveFocus();
  },
};

export const BeforeMount: Story = {
  render: () => {
    cleanUp();
    toast("Antes de montar");
    return <Toaster duration={Number.POSITIVE_INFINITY} />;
  },
  play: async () => {
    await expect(await screen.findByText("Antes de montar")).toBeInTheDocument();
    cleanUp();
  },
};

export const ReducedMotionRemovesImmediately: Story = {
  render: withToaster({ duration: Number.POSITIVE_INFINITY }),
  beforeEach: () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    return () => {
      window.matchMedia = original;
    };
  },
  play: async () => {
    cleanUp();
    const id = toast("Sin animación");
    await screen.findByText("Sin animación");
    const started = performance.now();
    toast.dismiss(id);
    await waitFor(() => expect(screen.queryByText("Sin animación")).toBeNull());
    await expect(performance.now() - started).toBeLessThan(150);
  },
};
