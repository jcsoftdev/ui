import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { Chip } from "../../atoms/chip/chip.js";
import { Breadcrumbs } from "../../navigation/breadcrumbs/breadcrumbs.js";
import { TabsNav, TabsNavLink } from "../../navigation/tabs/tabs-nav.js";
import { PageHeaderBack } from "./back.js";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderEyebrow,
  PageHeaderLede,
  PageHeaderTitle,
} from "./page-header.js";

const meta = {
  title: "Containers/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  args: {
    children: (
      <>
        <div>
          <PageHeaderEyebrow>Sábado 11 de octubre</PageHeaderEyebrow>
          <PageHeaderTitle>
            Agenda de <span className="text-accent-word">hoy</span>
          </PageHeaderTitle>
          <PageHeaderLede>
            12 citas con 3 barberos. Quedan 2 horarios libres por la tarde.
          </PageHeaderLede>
        </div>
        <PageHeaderActions>
          <Button variant="secondary">Bloquear horario</Button>
          <Button>Nueva cita</Button>
        </PageHeaderActions>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TitleOnly: Story = {
  args: {
    children: (
      <div>
        <PageHeaderTitle>Inventario</PageHeaderTitle>
      </div>
    ),
  },
};

export const WithoutActions: Story = {
  args: {
    children: (
      <div>
        <PageHeaderEyebrow>Equipo</PageHeaderEyebrow>
        <PageHeaderTitle>Barberos</PageHeaderTitle>
        <PageHeaderLede>Diego Quispe, Mateo Flores y Camila Rojas.</PageHeaderLede>
      </div>
    ),
  },
};

/** 320 px container: use it to check the narrow layout without resizing the viewport. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container/page w-[320px] max-w-full">
        <Story />
      </div>
    ),
  ],
};

export const WithBreadcrumbs: Story = {
  args: {
    breadcrumbs: (
      <Breadcrumbs
        items={[
          { label: "Home", href: "#home" },
          { label: "Agenda", href: "#agenda" },
          { label: "Today" },
        ]}
      />
    ),
  },
};

export const Compact: Story = {
  args: {
    compact: true,
    children: (
      <div>
        <PageHeaderEyebrow>Paso 2 de 3</PageHeaderEyebrow>
        <PageHeaderTitle>Verifica tu correo</PageHeaderTitle>
        <PageHeaderLede>Te enviamos un código de seis dígitos.</PageHeaderLede>
      </div>
    ),
  },
};

const tabs = (
  <TabsNav aria-label="Applicant sections" value="overview">
    <TabsNavLink value="overview" href="#overview">
      Overview
    </TabsNavLink>
    <TabsNavLink value="documents" href="#documents" count={4}>
      Documents
    </TabsNavLink>
    <TabsNavLink value="history" href="#history">
      History
    </TabsNavLink>
  </TabsNav>
);

/** `back` link, `meta` row and `tabs` under the title block. */
export const BackMetaTabs: Story = {
  args: {
    back: <PageHeaderBack href="#applicants" />,
    meta: (
      <>
        <Chip tone="warning">In review</Chip>
        <span>Grade 3 admission</span>
        <span>Applied 12 Oct</span>
      </>
    ),
    tabs,
    children: (
      <>
        <div>
          <PageHeaderTitle>Ana Torres</PageHeaderTitle>
        </div>
        <PageHeaderActions>
          <Button>Approve</Button>
        </PageHeaderActions>
      </>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Back" })).toHaveAttribute("href", "#applicants");
    await expect(canvas.getByRole("navigation", { name: "Applicant sections" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: /Overview/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  },
};

/** Stays at the top of its scroll container, tabs included. */
export const Sticky: Story = {
  args: { ...BackMetaTabs.args, sticky: true },
  decorators: [
    (Story) => (
      <div className="h-64 overflow-auto">
        <Story />
        <div className="h-[600px]" />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector("header") as HTMLElement;
    await expect(getComputedStyle(header).position).toBe("sticky");
  },
};
