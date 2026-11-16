import { renderToStaticMarkup } from "react-dom/server";
import { Breadcrumbs } from "../../src/navigation/breadcrumbs/breadcrumbs.js";
import { FloatingToc } from "../../src/navigation/floating-toc/floating-toc.js";
import { Segmented, SegmentedItem } from "../../src/navigation/segmented/segmented.js";
import { Stepper } from "../../src/navigation/stepper/stepper.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/navigation/tabs/tabs.js";
import { TabsNav, TabsNavLink } from "../../src/navigation/tabs/tabs-nav.js";
import { Wizard } from "../../src/navigation/wizard/wizard.js";
import { BottomNav } from "../../src/shell/bottom-nav/bottom-nav.js";
import { Sidebar } from "../../src/shell/sidebar/sidebar.js";

const probe = { intent: "probe", intentKey: "k1" };
const items = [{ id: "home", label: "Home", href: "/home", ...probe }];

export const html = {
  tabs: () =>
    renderToStaticMarkup(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a" {...probe}>
            A
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a" {...probe}>
          panel
        </TabsContent>
      </Tabs>,
    ),
  tabsNav: () =>
    renderToStaticMarkup(
      <TabsNav aria-label="Sections" value="a">
        <TabsNavLink value="a" href="/a" {...probe}>
          A
        </TabsNavLink>
      </TabsNav>,
    ),
  segmented: () =>
    renderToStaticMarkup(
      <Segmented defaultValue="a">
        <SegmentedItem value="a" {...probe}>
          A
        </SegmentedItem>
      </Segmented>,
    ),
  stepper: () =>
    renderToStaticMarkup(
      <Stepper steps={[{ id: "one", label: "One", intent: "probe", intentKey: "k1" }]} currentStepId="one" />,
    ),
  stepperDefaultKey: () =>
    renderToStaticMarkup(
      <Stepper steps={[{ id: "one", label: "One", intent: "probe" }]} currentStepId="one" />,
    ),
  wizard: () =>
    renderToStaticMarkup(
      <Wizard steps={[{ id: "one", label: "One", content: "x", ...probe }]} />,
    ),
  breadcrumbs: () =>
    renderToStaticMarkup(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/", ...probe },
          { label: "Now", intent: "probe-current", intentKey: "k2" },
        ]}
      />,
    ),
  floatingToc: () =>
    renderToStaticMarkup(<FloatingToc items={[{ id: "intro", label: "Intro", ...probe }]} />),
  sidebar: () =>
    renderToStaticMarkup(
      <Sidebar ariaLabel="Main" groups={[{ id: "g", label: "Group", items }]} />,
    ),
  bottomNav: () => renderToStaticMarkup(<BottomNav ariaLabel="Main" items={items} />),
  emptyIntent: () =>
    renderToStaticMarkup(
      <Sidebar
        ariaLabel="Main"
        groups={[{ id: "g", label: "Group", items: [{ id: "home", label: "Home", href: "/home", intent: "", intentKey: "k1" }] }]}
      />,
    ),
};
