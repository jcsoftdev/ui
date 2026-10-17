import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { UiStringsProvider } from "../../i18n/index.js";
import { Note } from "../note/note.js";
import { Aside, AsideHeader } from "./aside.js";

const meta = {
  title: "Containers/Aside",
  component: Aside,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <AsideHeader title="Pending" action={<a href="#all">View all</a>} />
        <Note>Nothing pending.</Note>
      </>
    ),
  },
  argTypes: { children: { control: false } },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Aside>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const aside = canvas.getByRole("complementary", { name: "Related information" });
    await expect(getComputedStyle(aside).paddingInlineStart).toBe("0px");
    await expect(canvas.getByRole("heading", { name: "Pending" })).toBeInTheDocument();
    await expect(canvas.getByRole("link", { name: "View all" })).toBeInTheDocument();
  },
};

export const CustomLabel: Story = {
  args: { "aria-label": "Student summary" },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("complementary", { name: "Student summary" }),
    ).toBeInTheDocument();
  },
};

export const Spanish: Story = {
  render: (args) => (
    <UiStringsProvider locale="es">
      <Aside {...args} />
    </UiStringsProvider>
  ),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole("complementary", { name: "Información relacionada" }),
    ).toBeInTheDocument();
  },
};
