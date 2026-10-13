import type { Meta, StoryObj } from "@storybook/react-vite";
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
