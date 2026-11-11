import { renderToStaticMarkup } from "react-dom/server";
import { Card } from "../../src/containers/card/card.js";
import { ConfirmAction } from "../../src/containers/confirm-action/confirm-action.js";
import { FeedEvent } from "../../src/containers/feed/feed.js";
import { FileTree } from "../../src/containers/file-tree/file-tree.js";
import { GenericRow } from "../../src/containers/generic-row/generic-row.js";
import { ItemCardGroup } from "../../src/containers/item-card-group/item-card-group.js";
import { Kanban } from "../../src/containers/kanban/kanban.js";
import { ListDetail, ListDetailItem, ListDetailList } from "../../src/containers/list-detail/list-detail.js";
import { RowActions } from "../../src/containers/row-actions/row-actions.js";
import { SelectableCard } from "../../src/containers/selectable-card/selectable-card.js";
import { Section } from "../../src/containers/section/section.js";
import { SettingsLayoutNavItem } from "../../src/containers/settings-layout/settings-layout.js";
import { SettingsRow } from "../../src/containers/settings-row/settings-row.js";
import { TableLinkRow, TableRow } from "../../src/containers/table/table.js";
import { TimelineItem } from "../../src/containers/timeline/timeline.js";

const probe = { intent: "probe", intentKey: "k1" };

const columns = [
  { id: "todo", title: "Todo", cards: [{ id: "c1", title: "Card", ...probe }] },
];

const noop = () => {};

export const cases = {
  card: { tag: "div", markup: () => renderToStaticMarkup(<Card {...probe}>body</Card>) },
  section: {
    tag: "section",
    markup: () => renderToStaticMarkup(<Section {...probe} title="Title">body</Section>),
  },
  genericRow: { tag: "div", markup: () => renderToStaticMarkup(<GenericRow {...probe}>row</GenericRow>) },
  settingsRow: {
    tag: "div",
    markup: () => renderToStaticMarkup(<SettingsRow {...probe} title="Setting" />),
  },
  settingsLayoutNavItem: {
    tag: "button",
    markup: () => renderToStaticMarkup(<SettingsLayoutNavItem {...probe}>Nav</SettingsLayoutNavItem>),
  },
  listDetailItem: {
    tag: "button",
    markup: () =>
      renderToStaticMarkup(
        <ListDetail aria-label="Students">
          <ListDetailList>
            <ListDetailItem value="ana" {...probe}>
              Ana
            </ListDetailItem>
          </ListDetailList>
        </ListDetail>,
      ),
  },
  tableRow: {
    tag: "tr",
    markup: () =>
      renderToStaticMarkup(
        <table>
          <tbody>
            <TableRow {...probe}>
              <td>cell</td>
            </TableRow>
          </tbody>
        </table>,
      ),
  },
  tableLinkRow: {
    tag: "tr",
    markup: () =>
      renderToStaticMarkup(
        <table>
          <tbody>
            <TableLinkRow href="/x" primary="Open" {...probe} />
          </tbody>
        </table>,
      ),
  },
  timelineItem: {
    tag: "li",
    markup: () => renderToStaticMarkup(<ol><TimelineItem title="Step" {...probe} /></ol>),
  },
  feedEvent: {
    tag: "li",
    markup: () => renderToStaticMarkup(<ol><FeedEvent {...probe}>Event</FeedEvent></ol>),
  },
  selectableCard: {
    tag: "button",
    markup: () => renderToStaticMarkup(<SelectableCard {...probe}>Pick</SelectableCard>),
  },
  rowActions: {
    tag: "button",
    markup: () =>
      renderToStaticMarkup(
        <RowActions label="Actions" items={[{ id: "a", label: "Edit", onSelect: noop }]} {...probe} />,
      ),
  },
  confirmAction: {
    tag: "button",
    markup: () =>
      renderToStaticMarkup(
        <ConfirmAction label="Cancel order" consequence="Gone" onConfirm={async () => {}} {...probe} />,
      ),
  },
  kanbanDraggable: {
    tag: "div",
    markup: () => renderToStaticMarkup(<Kanban defaultColumns={columns} />),
  },
  kanbanStatic: {
    tag: "div",
    markup: () => renderToStaticMarkup(<Kanban defaultColumns={columns} draggable={false} />),
  },
  kanbanActions: {
    tag: "div",
    markup: () =>
      renderToStaticMarkup(
        <Kanban defaultColumns={columns} cardActions={() => <button type="button">Go</button>} />,
      ),
  },
  fileTree: {
    tag: "div",
    markup: () =>
      renderToStaticMarkup(<FileTree label="Files" nodes={[{ id: "f1", name: "a.ts", ...probe }]} />),
  },
  itemCardGroup: {
    tag: "button",
    markup: () =>
      renderToStaticMarkup(
        <ItemCardGroup items={[{ id: "i1", title: "Item", onSelect: noop, ...probe }]} />,
      ),
  },
  itemCardGroupStatic: {
    tag: "div",
    markup: () => renderToStaticMarkup(<ItemCardGroup items={[{ id: "i1", title: "Item", ...probe }]} />),
  },
};

export const emptyIntentMarkup = () =>
  renderToStaticMarkup(
    <Card intent="" intentKey="k1">
      body
    </Card>,
  );
