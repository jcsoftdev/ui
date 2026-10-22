import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { Note } from "../note/note.js";
import { Section } from "./section.js";

const meta = {
  title: "Containers/Section",
  component: Section,
  tags: ["autodocs"],
  args: {
    title: "Guardians",
    description: "People who can pick the student up.",
    count: 3,
    children: <p className="m-0 text-body text-ink-2">Section body.</p>,
  },
  argTypes: { children: { control: false }, actions: { control: false } },
} satisfies Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("region", { name: "Guardians" });
    await expect(canvas.getByRole("heading", { level: 2, name: "Guardians" })).toBeInTheDocument();
    // The page owns the gutter: nothing inside pads the inline edges.
    for (const el of [region, ...Array.from(region.children)] as HTMLElement[]) {
      const style = getComputedStyle(el);
      await expect(style.paddingInlineStart).toBe("0px");
      await expect(style.paddingInlineEnd).toBe("0px");
    }
  },
};

export const WithActions: Story = {
  args: { actions: <Button size="sm">Add guardian</Button>, divider: true },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button", { name: "Add guardian" })).toBeVisible();
  },
};

export const Nested: Story = {
  render: (args) => (
    <Section {...args} title="Student">
      <Section title="Contact" divider>
        <Section title="Phones" divider>
          <Note>Primary first.</Note>
        </Section>
      </Section>
    </Section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 2, name: "Student" })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { level: 3, name: "Contact" })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { level: 4, name: "Phones" })).toBeInTheDocument();
    const outer = canvas.getByRole("region", { name: "Student" });
    const inner = canvas.getByRole("region", { name: "Phones" });
    const pad = (el: Element) =>
      Number.parseFloat(getComputedStyle(el.lastElementChild as Element).paddingTop);
    // Vertical spacing steps down with depth instead of stacking, and inline padding stays zero.
    await expect(pad(inner)).toBeLessThan(pad(outer));
    await expect(getComputedStyle(inner).paddingInlineStart).toBe("0px");
  },
};

export const WithoutDivider: Story = {
  args: { divider: false },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole("region", { name: "Guardians" });
    await expect(getComputedStyle(region).borderTopWidth).toBe("0px");
  },
};

export const UnpaddedBody: Story = {
  args: { padded: false },
};

export const NarrowActionsTakeTheRow: Story = {
  args: { actions: <Button size="sm">Add</Button> },
  decorators: [
    (Story) => (
      <div className="w-72 max-w-full">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Add" });
    const actions = button.parentElement as HTMLElement;
    const header = actions.parentElement as HTMLElement;
    await expect(actions.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      header.getBoundingClientRect().width - 1,
    );
  },
};

export const AsDivHasNoRegion: Story = {
  args: { as: "div" },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("region")).toBeNull();
  },
};

export const Composed: Story = {
  render: () => (
    <Section divider>
      <Section.Header>
        <Section.Title>Guardians</Section.Title>
        <Section.Count>3</Section.Count>
        <Section.Description>People who can pick the student up.</Section.Description>
        <Section.Actions>
          <Button size="sm">Add guardian</Button>
        </Section.Actions>
      </Section.Header>
      <Section.Body>
        <Note>Primary first.</Note>
      </Section.Body>
    </Section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole("region", { name: "Guardians" });
    await expect(canvas.getByRole("heading", { level: 2, name: "Guardians" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Add guardian" })).toBeVisible();
    for (const el of [region, ...Array.from(region.children)] as HTMLElement[]) {
      await expect(getComputedStyle(el).paddingInlineStart).toBe("0px");
    }
  },
};

export const TitlelessWrapperKeepsHeadingLevel: Story = {
  render: () => (
    <Section title="Student">
      <Section>
        <Section title="Contact" divider>
          <Note>Primary first.</Note>
        </Section>
      </Section>
    </Section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 2, name: "Student" })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { level: 3, name: "Contact" })).toBeInTheDocument();
  },
};
