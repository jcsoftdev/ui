import { createRef } from "react";
import { Breadcrumbs } from "./breadcrumbs/breadcrumbs.js";
import { FloatingToc } from "./floating-toc/floating-toc.js";
import { Segmented, SegmentedItem } from "./segmented/segmented.js";
import { Stepper } from "./stepper/stepper.js";
import { TabsContent, TabsTrigger } from "./tabs/tabs.js";
import { TabsNav, TabsNavLink } from "./tabs/tabs-nav.js";
import { Wizard } from "./wizard/wizard.js";

const nav = createRef<HTMLElement>();
const anchor = createRef<HTMLAnchorElement>();
const div = createRef<HTMLDivElement>();
const button = createRef<HTMLButtonElement>();
const list = createRef<HTMLOListElement>();

export const refProps = [
  <Breadcrumbs key="breadcrumbs" ref={nav} items={[]} />,
  <FloatingToc
    key="toc"
    ref={nav}
    items={[{ id: "a", label: "A", intent: "jump", intentKey: "a" }]}
  />,
  <TabsNav key="tabs-nav" ref={nav} aria-label="Sections" />,
  <TabsNavLink key="tabs-nav-link" ref={anchor} value="a" intent="go" intentKey="a">
    A
  </TabsNavLink>,
  <Wizard
    key="wizard"
    ref={div}
    steps={[{ id: "a", label: "A", content: null, intent: "step", intentKey: "a" }]}
  />,
  <TabsTrigger key="tab" ref={button} value="a" intent="tab" intentKey="a" />,
  <TabsContent key="panel" ref={div} value="a" intent="panel" intentKey="a" />,
  <SegmentedItem key="segment" ref={button} value="a" intent="pick" intentKey="a" />,
  <Segmented key="segmented" ref={div} />,
  <Stepper key="stepper" ref={list} steps={[]} currentStepId="" />,
];
