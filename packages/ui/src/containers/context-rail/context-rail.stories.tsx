import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../../atoms/button/button.js";
import { Card, CardBody } from "../../containers/card/card.js";
import { CalendarDays, Users } from "../../icons/index.js";
import { AppShell } from "../../shell/app-shell/index.js";
import { BottomNav } from "../../shell/bottom-nav/index.js";
import { ContextRail } from "./context-rail.js";

const cart = (
  <Card>
    <CardBody>
      <h3 className="m-0 text-card-title text-ink">Pedido en curso</h3>
      <p className="m-0 mt-1 text-body text-ink-2">2 x Lomo saltado · 1 x Chicha morada</p>
      <p className="m-0 mt-3 font-semibold text-ink">Total S/ 74.00</p>
    </CardBody>
  </Card>
);

const dishes = (
  <div className="grid grid-cols-2 gap-3">
    {["Lomo saltado", "Ají de gallina", "Ceviche", "Arroz chaufa", "Chicha", "Inca Kola"].map(
      (name) => (
        <Card key={name}>
          <CardBody>{name}</CardBody>
        </Card>
      ),
    )}
  </div>
);

const meta = {
  title: "Containers/ContextRail",
  component: ContextRail,
  tags: ["autodocs"],
  args: { rail: cart, children: dishes, railLabel: "Pedido" },
  argTypes: { rail: { control: false }, children: { control: false }, summary: { control: false } },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ContextRail>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The rail is 360 px, 400 px from 1280 px and 440 px from 1600 px of container width. */
export const Default: Story = {};

export const FixedWidth: Story = { args: { width: 320 } };

/** Under 720 px the rail stacks below the work area. */
export const CollapsedStack: Story = {
  decorators: [
    (Story) => (
      <div className="w-[480px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

/** Under 720 px the rail leaves the page for a bottom sheet opened from the summary bar. */
export const CollapsedSheet: Story = {
  args: {
    collapse: "sheet",
    sheetLabel: "Ver pedido",
    summary: (
      <span className="flex items-center gap-3">
        <span className="font-semibold text-ink">S/ 74.00</span>
        <Button size="sm" variant="primary">
          Cobrar
        </Button>
      </span>
    ),
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

/** Inside an `AppShell` with a `bottomBar` the summary bar sits above the tab bar on its own, safe-area inset included. */
export const SheetAboveTabBar: Story = {
  args: CollapsedSheet.args,
  render: (args) => (
    <div className="w-[375px] max-w-full">
      <AppShell
        bottomBar={
          <BottomNav
            ariaLabel="Navegación móvil"
            items={[
              {
                id: "pedidos",
                label: "Pedidos",
                href: "#pedidos",
                icon: <CalendarDays />,
                active: true,
              },
              { id: "clientes", label: "Clientes", href: "#clientes", icon: <Users /> },
            ]}
          />
        }
      >
        <div className="min-w-0 flex-1">
          <ContextRail {...args} />
        </div>
      </AppShell>
    </div>
  ),
};

/** `breakpoint="never"` keeps the rail beside the work area at any width. */
export const NeverCollapses: Story = {
  args: { breakpoint: "never", width: 200 },
  decorators: [
    (Story) => (
      <div className="w-[420px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

/** `breakpoint="always"` collapses the rail even on a wide container. */
export const AlwaysCollapsed: Story = {
  args: { breakpoint: "always", collapse: "sheet", sheetLabel: "Ver pedido", summary: "S/ 74.00" },
};

/** Inside a scroll container the rail sticks to its top. */
export const StickyInScroll: Story = {
  args: {
    stickyTop: 8,
    children: (
      <div className="space-y-3">
        {dishes}
        {dishes}
        {dishes}
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <section
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region must be keyboard reachable
        tabIndex={0}
        aria-label="Menú"
        className="h-96 overflow-y-auto focus-visible:focus-ring"
      >
        <Story />
      </section>
    ),
  ],
};
