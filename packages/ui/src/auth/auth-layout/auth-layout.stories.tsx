import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { Button } from "../../atoms/button/button.js";
import { AuthIllustration } from "../auth-illustration/auth-illustration.js";
import { AUTH_STATES } from "../auth-illustration/model.js";
import { AuthLayout } from "./auth-layout.js";

function PanelContent() {
  return (
    <div className="grid gap-3 p-6">
      <h2 className="m-0 text-center font-bold text-2xl">Inicia sesión</h2>
      <p className="m-0 text-center text-ink-3">Notas, asistencia y pagos de tu colegio.</p>
      <Button variant="primary" block>
        Ingresar
      </Button>
    </div>
  );
}

const meta = {
  title: "Auth/AuthLayout",
  component: AuthLayout,
  tags: ["autodocs"],
  args: {
    layout: "split",
    state: "idle",
    progress: 0,
    activeIndex: 0,
    children: (
      <>
        <AuthLayout.Brand>EduModules</AuthLayout.Brand>
        <AuthLayout.Art />
        <AuthLayout.Panel>
          <PanelContent />
        </AuthLayout.Panel>
        <AuthLayout.Footer>Soporte: ayuda@edumodules.pe</AuthLayout.Footer>
      </>
    ),
  },
  argTypes: {
    layout: { control: "inline-radio", options: ["split", "split-reverse", "centered"] },
    state: { control: "inline-radio", options: AUTH_STATES },
    progress: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
    activeIndex: { control: "inline-radio", options: [0, 1, 2] },
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Split: Story = {};

export const SplitReverse: Story = { args: { layout: "split-reverse" } };

export const Centered: Story = { args: { layout: "centered" } };

export const Typing: Story = { args: { state: "typing", progress: 0.3 } };

export const ErrorState: Story = { args: { state: "error", progress: 0.7 } };

export const Success: Story = { args: { state: "success", progress: 1 } };

const widths = [360, 600, 1100] as const;

/** The same layout in three boxes: the art drops out at 360px, stacks at 600px and sits beside the panel at 1100px. */
export const ContainerWidths: Story = {
  render: (args) => (
    <div className="grid gap-8 p-4">
      {widths.map((width) => (
        <div key={width} style={{ width }} data-testid={`box-${width}`}>
          <AuthLayout {...args} />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const box = (width: number) => {
      const root = within(canvasElement).getByTestId(`box-${width}`);
      const art = root.querySelector<HTMLElement>("[aria-hidden=true]")?.parentElement;
      const panel = root.querySelector<HTMLElement>("[class*=ui-auth-rise]");
      return { art, panel };
    };
    const narrow = box(360);
    await expect(getComputedStyle(narrow.art as HTMLElement).display).toBe("none");
    const medium = box(600);
    await expect(getComputedStyle(medium.art as HTMLElement).display).not.toBe("none");
    const mediumArt = (medium.art as HTMLElement).getBoundingClientRect();
    const mediumPanel = (medium.panel as HTMLElement).getBoundingClientRect();
    await expect(mediumArt.bottom).toBeLessThanOrEqual(mediumPanel.top + 1);
    const wide = box(1100);
    const wideArt = (wide.art as HTMLElement).getBoundingClientRect();
    const widePanel = (wide.panel as HTMLElement).getBoundingClientRect();
    await expect(wideArt.right).toBeLessThanOrEqual(widePanel.left + 1);
  },
};

export const CustomIllustration: Story = {
  args: {
    children: (
      <>
        <AuthLayout.Art>
          <AuthIllustration activeIndex={2} label="Portal de estudiantes" />
        </AuthLayout.Art>
        <AuthLayout.Panel>
          <PanelContent />
        </AuthLayout.Panel>
      </>
    ),
  },
};
