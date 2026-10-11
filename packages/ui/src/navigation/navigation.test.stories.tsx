import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Segmented, SegmentedItem } from "./segmented/segmented.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs/tabs.js";

const meta = {
  title: "Tests/Navigation",
  tags: ["!autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TabsArrowKeys: Story = {
  render: () => (
    <Tabs defaultValue="citas">
      <button type="button">Antes</button>
      <TabsList aria-label="Secciones">
        <TabsTrigger value="citas">Citas</TabsTrigger>
        <TabsTrigger value="clientes">Clientes</TabsTrigger>
        <TabsTrigger value="caja">Caja</TabsTrigger>
      </TabsList>
      <TabsContent value="citas">Panel de citas</TabsContent>
      <TabsContent value="clientes">Panel de clientes</TabsContent>
      <TabsContent value="caja">Panel de caja</TabsContent>
      <button type="button">Después</button>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [citas, clientes, caja] = canvas.getAllByRole("tab");
    await expect(canvas.getByRole("tablist")).toBeInTheDocument();
    await expect(citas).toHaveAttribute("aria-selected", "true");
    await expect(clientes).toHaveAttribute("aria-selected", "false");
    canvas.getByRole("button", { name: "Antes" }).focus();
    await userEvent.tab();
    await expect(citas).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole("tabpanel")).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Después" })).toHaveFocus();
    const panel = canvas.getByRole("tabpanel");
    await expect(panel).toHaveTextContent("Panel de citas");
    await expect(citas).toHaveAttribute("aria-controls", panel.id);
    await expect(panel).toHaveAttribute("aria-labelledby", citas?.id ?? "");
    citas?.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(clientes).toHaveFocus();
    await expect(clientes).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("Panel de clientes");
    await userEvent.keyboard("{ArrowRight}");
    await expect(caja).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(citas).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(caja).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(citas).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(caja).toHaveFocus();
    await expect(caja).toHaveAttribute("aria-selected", "true");
  },
};

export const SegmentedArrowKeys: Story = {
  render: () => (
    <>
      <button type="button">Antes</button>
      <Segmented aria-label="Vista" defaultValue="dia">
        <SegmentedItem value="dia">Día</SegmentedItem>
        <SegmentedItem value="semana">Semana</SegmentedItem>
        <SegmentedItem value="mes">Mes</SegmentedItem>
      </Segmented>
      <button type="button">Después</button>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("radiogroup")).toBeInTheDocument();
    const [dia, semana, mes] = canvas.getAllByRole("radio");
    await expect(dia).toHaveAttribute("aria-checked", "true");
    await expect(dia).toHaveAttribute("data-state", "on");
    canvas.getByRole("button", { name: "Antes" }).focus();
    await userEvent.tab();
    await expect(dia).toHaveFocus();
    await userEvent.tab();
    await expect(canvas.getByRole("button", { name: "Después" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    await expect(dia).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(semana).toHaveFocus();
    await expect(semana).toHaveAttribute("aria-checked", "false");
    await userEvent.keyboard(" ");
    await expect(semana).toHaveAttribute("aria-checked", "true");
    await expect(dia).toHaveAttribute("aria-checked", "false");
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await expect(dia).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(mes).toHaveFocus();
    await userEvent.click(mes as HTMLElement);
    await expect(mes).toHaveAttribute("aria-checked", "true");
  },
};
