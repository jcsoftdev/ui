import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect, within } from "storybook/test";
import { Card } from "../containers/card/card.js";
import { ConfirmAction } from "../containers/confirm-action/confirm-action.js";
import { FeedEvent } from "../containers/feed/feed.js";
import { FileTree } from "../containers/file-tree/file-tree.js";
import { GenericRow } from "../containers/generic-row/generic-row.js";
import { ItemCardGroup } from "../containers/item-card-group/item-card-group.js";
import { Kanban } from "../containers/kanban/kanban.js";
import {
  ListDetail,
  ListDetailItem,
  ListDetailList,
} from "../containers/list-detail/list-detail.js";
import { RowActions } from "../containers/row-actions/row-actions.js";
import { Section } from "../containers/section/section.js";
import { SelectableCard } from "../containers/selectable-card/selectable-card.js";
import { SettingsLayoutNavItem } from "../containers/settings-layout/settings-layout.js";
import { SettingsRow } from "../containers/settings-row/settings-row.js";
import { Table, TableBody, TableCell, TableLinkRow, TableRow } from "../containers/table/table.js";
import { TimelineItem } from "../containers/timeline/timeline.js";
import { IntentBridgeProvider } from "./bridge.js";
import type { IntentBridge } from "./types.js";

interface Registration {
  intent: string;
  key: string | undefined;
  role: string;
  requireName: boolean;
}

const noop = () => {};

function ContainersDemo({ live }: { live: Registration[] }) {
  const bridge = useMemo<IntentBridge>(
    () => ({
      registerTarget(ref, _element, expectation) {
        const entry: Registration = {
          intent: ref.intent,
          key: ref.key,
          role: expectation.role,
          requireName: expectation.requireName,
        };
        live.push(entry);
        return () => {
          live.splice(live.indexOf(entry), 1);
        };
      },
    }),
    [live],
  );
  return (
    <IntentBridgeProvider bridge={bridge}>
      <Card intent="card" intentKey="k">
        Card body
      </Card>
      <Section intent="section" intentKey="k" title="Section title">
        Section body
      </Section>
      <GenericRow intent="generic-row" intentKey="k">
        Generic row
      </GenericRow>
      <SettingsRow intent="settings-row" intentKey="k" title="Setting" />
      <SettingsLayoutNavItem intent="nav-item" intentKey="k">
        Nav item
      </SettingsLayoutNavItem>
      <ListDetail aria-label="Students">
        <ListDetailList>
          <ListDetailItem value="ana" intent="list-detail-item" intentKey="k">
            Ana Torres
          </ListDetailItem>
        </ListDetailList>
      </ListDetail>
      <Table aria-label="Orders">
        <TableBody>
          <TableRow intent="table-row" intentKey="k">
            <TableCell>Order 1</TableCell>
          </TableRow>
          <TableLinkRow href="/orders/2" primary="Order 2" intent="table-link-row" intentKey="k" />
        </TableBody>
      </Table>
      <ol>
        <TimelineItem title="Paid" intent="timeline-item" intentKey="k" />
        <FeedEvent intent="feed-event" intentKey="k">
          Feed event
        </FeedEvent>
      </ol>
      <SelectableCard intent="selectable-card" intentKey="k">
        <span>Pick me</span>
      </SelectableCard>
      <RowActions
        label="Actions for Ana"
        items={[{ id: "edit", label: "Edit", onSelect: noop }]}
        intent="row-actions"
        intentKey="k"
      />
      <ConfirmAction
        label="Cancel order"
        consequence="The order is cancelled."
        onConfirm={async () => {}}
        intent="confirm-action"
        intentKey="k"
      />
      <Kanban
        aria-label="Board"
        defaultColumns={[
          {
            id: "todo",
            title: "Todo",
            cards: [{ id: "c1", title: "Kanban card", intent: "kanban-card" }],
          },
        ]}
      />
      <FileTree label="Files" nodes={[{ id: "f1", name: "readme.md", intent: "tree-node" }]} />
      <ItemCardGroup
        items={[{ id: "i1", title: "Group item", onSelect: noop, intent: "group-item" }]}
      />
    </IntentBridgeProvider>
  );
}

const meta = {
  title: "Intent/Containers",
  component: ContainersDemo,
  parameters: { layout: "padded" },
  args: { live: [] },
} satisfies Meta<typeof ContainersDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

const expectedRegistrations: Array<[string, string, boolean]> = [
  ["section", "region", false],
  ["nav-item", "button", true],
  ["list-detail-item", "button", true],
  ["table-row", "row", false],
  ["table-link-row", "row", false],
  ["timeline-item", "listitem", false],
  ["feed-event", "listitem", false],
  ["selectable-card", "button", true],
  ["row-actions", "button", true],
  ["confirm-action", "button", true],
  ["kanban-card", "button", true],
  ["tree-node", "treeitem", true],
];

const serverRendered = ["card", "generic-row", "settings-row", "group-item"];

export const RegistersClientTargets: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const { live } = args;
    for (const [intent, role, requireName] of expectedRegistrations) {
      const matches = live.filter((item) => item.intent === intent);
      await expect(matches).toHaveLength(1);
      await expect(matches[0]?.role).toBe(role);
      await expect(matches[0]?.requireName).toBe(requireName);
      const target = canvas.getAllByRole(role).find((el) => el.dataset.intent === intent);
      await expect(target).toBeDefined();
    }
    await expect(live).toHaveLength(expectedRegistrations.length);
    for (const intent of serverRendered) {
      await expect(canvasElement.querySelector(`[data-intent="${intent}"]`)).not.toBeNull();
      await expect(live.some((item) => item.intent === intent)).toBe(false);
    }
  },
};

export const NamedTargets: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "Section title" })).toHaveAttribute(
      "data-intent",
      "section",
    );
    await expect(canvas.getByRole("button", { name: "Ana Torres" })).toHaveAttribute(
      "data-intent-key",
      "k",
    );
    await expect(canvas.getByRole("button", { name: "Actions for Ana" })).toHaveAttribute(
      "data-intent",
      "row-actions",
    );
    await expect(canvas.getByRole("button", { name: "Cancel order" })).toHaveAttribute(
      "data-intent",
      "confirm-action",
    );
    await expect(canvas.getByRole("treeitem", { name: "readme.md" })).toHaveAttribute(
      "data-intent-key",
      "f1",
    );
    await expect(canvas.getByRole("button", { name: /Kanban card/ })).toHaveAttribute(
      "data-intent-key",
      "c1",
    );
  },
};
