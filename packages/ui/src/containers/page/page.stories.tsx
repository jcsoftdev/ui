import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Aside, AsideHeader } from "../aside/aside.js";
import { Card, CardBody, CardHeader } from "../card/card.js";
import { Cols } from "../cols/cols.js";
import { PageHeader, PageHeaderTitle } from "../page-header/page-header.js";
import { Page } from "./page.js";

function Panel({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="m-0 font-semibold text-[14px]">{title}</h2>
      </CardHeader>
      <CardBody>Content</CardBody>
    </Card>
  );
}

const meta = {
  title: "Containers/Page",
  component: Page,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <PageHeader>
          <PageHeaderTitle>Overview</PageHeaderTitle>
        </PageHeader>
        <Cols>
          <Panel title="Main" />
          <Panel title="Side" />
        </Cols>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `Cols` reacts to the `Page` width because `Page` is the `page` container. */
export const Default: Story = {};

const rail = (
  <Aside className="px-4">
    <AsideHeader title="Related" />
    <p className="m-0 text-body text-ink-2">Notes and shortcuts for this page.</p>
  </Aside>
);

/** `aside` adds a fixed rail beside the content; the `page` container still measures the full width. */
export const WithAside: Story = {
  args: { aside: rail },
  decorators: [
    (Story) => (
      <div style={{ width: "64rem" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const aside = within(canvasElement).getByRole("complementary", { name: "Related information" });
    await expect(aside.parentElement?.getBoundingClientRect().width).toBe(320);
  },
};

/** At 1000px or less the rail falls under the content with a top divider. */
export const AsideBelowOnNarrowPage: Story = {
  args: { aside: rail },
  decorators: [
    (Story) => (
      <div style={{ width: "30rem" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const rail = within(canvasElement).getByRole("complementary", { name: "Related information" })
      .parentElement as HTMLElement;
    await expect(rail.getBoundingClientRect().width).toBeGreaterThan(400);
    await expect(getComputedStyle(rail).borderLeftWidth).toBe("0px");
  },
};

export const WideAside: Story = {
  args: { aside: rail, asideWidth: "24rem", asideSticky: true },
  decorators: WithAside.decorators,
};
