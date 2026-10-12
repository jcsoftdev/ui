import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, within } from "storybook/test";
import { Button } from "../atoms/button/button.js";
import { Card, CardBody, CardHeader } from "../containers/card/card.js";
import { useGlassRefraction } from "../glass/use-glass-refraction.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../overlays/dialog/dialog.js";

const meta = {
  title: "Foundations/Liquid Glass",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Busy imagery drawn in CSS: saturated blobs plus fine stripes, the hard case for glass. */
const BUSY =
  "radial-gradient(40% 50% at 15% 20%, #ff4d6d, transparent), radial-gradient(45% 55% at 85% 25%, #4cc9f0, transparent), radial-gradient(50% 50% at 50% 95%, #ffd166, transparent), repeating-linear-gradient(135deg, #1b1b2f 0 10px, #e8e8f0 10px 20px)";

function Stage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative grid min-h-96 place-items-center gap-6 p-8 ${className}`}
      style={{ backgroundImage: BUSY }}
    >
      {children}
    </div>
  );
}

function Pane({
  title,
  className,
  children,
}: {
  title: string;
  className: string;
  children?: ReactNode;
}) {
  return (
    <div className={`${className} w-72 rounded-dialog p-5 text-ink`}>
      <h3 className="m-0 text-card-title">{title}</h3>
      <p className="m-0 mt-1 text-body text-ink-2">Legible over stripes, blobs and photos.</p>
      {children}
    </div>
  );
}

export const Variants: Story = {
  render: () => (
    <Stage>
      <div className="flex flex-wrap items-start justify-center gap-6">
        <Pane title="Regular" className="glass" />
        <Pane title="Clear" className="glass-clear" />
        <Pane title="Solid (control)" className="surface-solid shadow-overlay" />
      </div>
    </Stage>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const regular = canvas.getByText("Regular").parentElement as HTMLElement;
    await expect(getComputedStyle(regular).backdropFilter).toContain("blur");
    const solid = canvas.getByText("Solid (control)").parentElement as HTMLElement;
    await expect(getComputedStyle(solid).backdropFilter).toBe("none");
  },
};

export const GlassOnGlass: Story = {
  name: "Glass on glass falls back to near-solid",
  render: () => (
    <Stage>
      <Pane title="Outer glass" className="glass">
        <div className="glass mt-3 rounded-popover p-3 text-body">
          Nested: no blur, near-solid tint.
        </div>
      </Pane>
    </Stage>
  ),
  play: async ({ canvasElement }) => {
    const nested = within(canvasElement).getByText(/Nested/);
    await expect(getComputedStyle(nested).backdropFilter).toBe("none");
  },
};

export const ContentStaysSolid: Story = {
  name: "Content solid, chrome glass; cards can opt in",
  render: () => (
    <Stage>
      <div className="flex flex-wrap items-start justify-center gap-6">
        <Card className="w-72">
          <CardHeader>Card (default: solid)</CardHeader>
          <CardBody>Content layer. No blur.</CardBody>
        </Card>
        <Card className="w-72" material="glass">
          <CardHeader>Card material="glass"</CardHeader>
          <CardBody>Opted in on purpose, over imagery.</CardBody>
        </Card>
        <Card className="w-72" material="glass-clear">
          <CardHeader>Card material="glass-clear"</CardHeader>
          <CardBody>Clear variant with its veil.</CardBody>
        </Card>
      </div>
    </Stage>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const plain = canvas.getByText(/default: solid/).closest("div")?.parentElement as HTMLElement;
    await expect(getComputedStyle(plain).backdropFilter).toBe("none");
    const glass = canvas.getByText(/material="glass"$/).closest("div")
      ?.parentElement as HTMLElement;
    await expect(getComputedStyle(glass).backdropFilter).toContain("blur");
  },
};

function RefractionPane() {
  const ref = useGlassRefraction<HTMLDivElement>();
  return (
    <div ref={ref} className="glass-clear w-80 rounded-dialog p-6 text-ink">
      <h3 className="m-0 text-card-title">Refraction (opt-in)</h3>
      <p className="m-0 mt-1 text-body text-ink-2">
        Chromium bends the backdrop along the rim. Elsewhere this is the plain clear glass.
      </p>
    </div>
  );
}

export const Refraction: Story = {
  render: () => (
    <Stage>
      <RefractionPane />
    </Stage>
  ),
};

export const InAGlassDialog: Story = {
  render: () => (
    <Stage>
      <Dialog open>
        <DialogContent material="glass" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Chrome layer</DialogTitle>
          </DialogHeader>
          <DialogBody>
            Dialogs float above content and use glass in the glass preset or with material.
            <div className="mt-3">
              <Button variant="primary">Confirm</Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Stage>
  ),
};
