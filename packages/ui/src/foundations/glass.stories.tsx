import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { expect, within } from "storybook/test";
import { Button } from "../atoms/button/button.js";
import { ActionBar } from "../containers/action-bar/action-bar.js";
import { Card, CardBody, CardHeader } from "../containers/card/card.js";
import { LiquidGlass } from "../glass/liquid-glass.js";
import {
  LIQUID_DEFAULTS,
  LIQUID_MOTIONS,
  type LiquidGlassOptions,
  type LiquidInteractive,
  type LiquidMotion,
  type LiquidPresetName,
  type LiquidProfile,
  liquidStyle,
} from "../glass/liquid-options.js";
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
  // The lens is opt-in: an app renders <LiquidGlass /> once, near the root.
  decorators: [
    (Story) => (
      <>
        <LiquidGlass />
        <Story />
      </>
    ),
  ],
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

/** The previous opt-in API still works on any glass element. */
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

/** A photo-like backdrop in CSS: sky, sun, sea and a bright pennant stripe. */
const PHOTO =
  "radial-gradient(circle at 72% 28%, #fff3b0 0 7%, #ffb347 14%, transparent 34%), linear-gradient(180deg, #1d2b64 0%, #f8685a 46%, #ffd29d 58%, #0f4c75 58.2%, #1b6ca8 80%, #0a2540 100%), repeating-linear-gradient(100deg, rgba(255,255,255,.18) 0 3px, transparent 3px 22px)";

const COPY =
  "Liquid glass bends the content behind it, so copy near the rim of a control is curved and magnified while the middle stays readable. ";

function TextBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-96 overflow-hidden bg-surface p-8">
      <div className="columns-3 gap-8 text-body text-ink-2" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static copy
          <p key={i} className="m-0 mb-3">
            <b className="text-ink">Section {i + 1}.</b> {COPY}
            {COPY}
          </p>
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center gap-6 p-8">{children}</div>
    </div>
  );
}

/** A pill button on a glass utility; <LiquidGlass /> lenses it when it resolves to liquid. */
function GlassButton({ className }: { className: string }) {
  return (
    <button type="button" className={`${className} rounded-pill px-6 py-2 text-ink`}>
      Button
    </button>
  );
}

function Compare({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="grid justify-items-center gap-3">
        <span className="rounded-pill bg-surface-solid px-3 py-1 text-caption text-ink">
          Before: frosted (glass)
        </span>
        <Pane title="Frosted" className={before} />
        <GlassButton className={before} />
      </div>
      <div className="grid justify-items-center gap-3">
        <span className="rounded-pill bg-surface-solid px-3 py-1 text-caption text-ink">
          After: liquid
        </span>
        <Pane title="Liquid" className={after} />
        <GlassButton className={after} />
      </div>
    </div>
  );
}

export const FrostedVsLiquidOverPhoto: Story = {
  name: "Frosted vs liquid over a photo (regular)",
  render: () => (
    <div className="grid place-items-center p-8" style={{ backgroundImage: PHOTO }}>
      <Compare before="glass" after="liquid" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frosted = canvas.getByText("Frosted").parentElement as HTMLElement;
    const liquid = canvas.getByText("Liquid").parentElement as HTMLElement;
    await expect(getComputedStyle(frosted).backdropFilter).toContain("blur(20px)");
    await expect(getComputedStyle(liquid).backdropFilter).toContain("blur(2px)");
    await expect(getComputedStyle(liquid).getPropertyValue("--glass-lens")).toBe("1");
  },
};

export const FrostedVsLiquidClearOverPhoto: Story = {
  name: "Frosted vs liquid over a photo (clear)",
  render: () => (
    <div className="grid place-items-center p-8" style={{ backgroundImage: PHOTO }}>
      <Compare before="glass-clear" after="liquid-clear" />
    </div>
  ),
};

export const FrostedVsLiquidOverText: Story = {
  name: "Frosted vs liquid over text-heavy content",
  render: () => (
    <TextBackdrop>
      <Compare before="glass" after="liquid" />
    </TextBackdrop>
  ),
};

function LensCard({ title, material }: { title: string; material: "glass" | "liquid" }) {
  return (
    <Card material={material} className="w-72">
      <CardHeader>{title}</CardHeader>
      <CardBody>Over a photo. Lensed along the rim where the browser supports it.</CardBody>
    </Card>
  );
}

export const LiquidComponents: Story = {
  name: 'Components with material="liquid", lensed by <LiquidGlass />',
  render: () => (
    <Stage>
      <div className="flex flex-wrap items-start justify-center gap-6">
        <LensCard title="Card liquid" material="liquid" />
        <LensCard title="Card frosted" material="glass" />
      </div>
      <div className="flex w-full justify-center">
        <ActionBar selectedCount={3} position="static" material="liquid" />
      </div>
      <Dialog open>
        <DialogContent material="liquid" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Liquid dialog</DialogTitle>
          </DialogHeader>
          <DialogBody>
            The lens loads when the dialog opens; frosted dialogs never load it.
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Stage>
  ),
};

export const GlobalSwitch: Story = {
  name: 'data-glass="liquid" switches every glass surface',
  render: () => (
    <div className="grid gap-0 md:grid-cols-2">
      <div className="grid place-items-center gap-4 p-8" style={{ backgroundImage: PHOTO }}>
        <Pane title="Default scope" className="glass" />
      </div>
      <div
        data-glass="liquid"
        className="grid place-items-center gap-4 p-8"
        style={{ backgroundImage: PHOTO }}
      >
        <Pane title="data-glass=liquid scope" className="glass" />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const frosted = canvas.getByText("Default scope").parentElement as HTMLElement;
    const liquid = canvas.getByText(/data-glass=liquid scope/).parentElement as HTMLElement;
    await expect(getComputedStyle(frosted).backdropFilter).toContain("blur(20px)");
    await expect(getComputedStyle(liquid).backdropFilter).toContain("blur(2px)");
  },
};

/** Flat controls for every `LiquidGlassOptions` field (a story arg cannot be a nested object). */
interface PlaygroundArgs {
  variant: "liquid" | "liquid-clear";
  shape: "card" | "pill" | "bar";
  refraction: number;
  bevelWidth: number;
  profile: LiquidProfile;
  dispersion: number;
  frost: number;
  saturation: number;
  brightness: number;
  tintColor: string;
  tintAmount: number;
  rim: number;
  specularIntensity: number;
  specularAngle: number;
  fresnel: number;
  grain: number;
  radius: number;
  opacity: number;
  shadowOpacity: number;
  shadowSpread: number;
  shadowOffsetY: number;
  interactive: LiquidInteractive;
  motion: LiquidMotion | "off";
}

const range = (min: number, max: number, step: number) =>
  ({
    control: { type: "range", min, max, step },
  }) as const;

/** The story args as the options object the `material` prop takes. */
function optionsOf(a: PlaygroundArgs): LiquidGlassOptions {
  return {
    refraction: a.refraction,
    // 0 means "derive it from the size and the radius".
    bevelWidth: a.bevelWidth > 0 ? a.bevelWidth : undefined,
    profile: a.profile,
    dispersion: a.dispersion,
    frost: a.frost,
    saturation: a.saturation,
    brightness: a.brightness,
    tint: a.tintAmount > 0 ? { color: a.tintColor, amount: a.tintAmount } : undefined,
    rim: a.rim,
    specular: { intensity: a.specularIntensity, angle: a.specularAngle },
    fresnel: a.fresnel,
    grain: a.grain,
    radius: a.radius > 0 ? a.radius : undefined,
    opacity: a.opacity,
    shadow: { opacity: a.shadowOpacity, spread: a.shadowSpread, offsetY: a.shadowOffsetY },
    interactive: a.interactive,
    motion: a.motion === "off" ? false : a.motion,
  };
}

const SHAPES = {
  card: "h-44 w-80",
  pill: "h-14 w-56 rounded-pill",
  bar: "h-14 w-[34rem] max-w-full",
} as const;

export const Playground: StoryObj<PlaygroundArgs> = {
  name: "Playground: every liquid option",
  parameters: { layout: "fullscreen" },
  args: {
    variant: "liquid",
    shape: "card",
    refraction: LIQUID_DEFAULTS.refraction,
    bevelWidth: 0,
    profile: LIQUID_DEFAULTS.profile,
    dispersion: LIQUID_DEFAULTS.dispersion,
    frost: LIQUID_DEFAULTS.frost,
    saturation: LIQUID_DEFAULTS.saturation,
    brightness: LIQUID_DEFAULTS.brightness,
    tintColor: "#4cc9f0",
    tintAmount: 0,
    rim: LIQUID_DEFAULTS.rim,
    specularIntensity: LIQUID_DEFAULTS.specular.intensity,
    specularAngle: LIQUID_DEFAULTS.specular.angle,
    fresnel: LIQUID_DEFAULTS.fresnel,
    grain: LIQUID_DEFAULTS.grain,
    radius: 0,
    opacity: LIQUID_DEFAULTS.opacity,
    shadowOpacity: LIQUID_DEFAULTS.shadow.opacity,
    shadowSpread: LIQUID_DEFAULTS.shadow.spread,
    shadowOffsetY: LIQUID_DEFAULTS.shadow.offsetY,
    interactive: "press",
    motion: "snappy",
  },
  argTypes: {
    variant: { control: "inline-radio", options: ["liquid", "liquid-clear"] },
    shape: { control: "inline-radio", options: ["card", "pill", "bar"] },
    refraction: {
      ...range(0, 1, 0.05),
      description: "0 flat, 1 the strongest bend that cannot fold",
    },
    bevelWidth: { ...range(0, 64, 1), description: "px; 0 derives it from size and radius" },
    profile: { control: "inline-radio", options: ["full", "dome", "rim"] },
    dispersion: range(0, 0.2, 0.01),
    frost: { ...range(0, 20, 0.1), description: "backdrop blur, px" },
    saturation: range(0, 3, 0.05),
    brightness: range(0.5, 1.5, 0.01),
    tintColor: { control: "color" },
    tintAmount: range(0, 1, 0.01),
    rim: range(0, 2, 0.05),
    specularIntensity: range(0, 2, 0.05),
    specularAngle: {
      ...range(-180, 180, 1),
      description: "degrees clockwise from +x; -120 is the upper left",
    },
    fresnel: range(0, 1, 0.05),
    grain: range(0, 1, 0.05),
    radius: { ...range(0, 80, 1), description: "px; 0 keeps the shape's own" },
    opacity: {
      ...range(0, 1, 0.01),
      description: "legibility veil; below 1 the contrast guarantee no longer applies",
    },
    shadowOpacity: range(0, 2, 0.05),
    shadowSpread: range(0, 60, 1),
    shadowOffsetY: range(-20, 60, 1),
    interactive: { control: "inline-radio", options: ["none", "press", "drag"] },
    motion: { control: "select", options: [...LIQUID_MOTIONS, "off"] },
  },
  render: (args) => (
    <div className="grid min-h-[34rem] place-items-center p-8" style={{ backgroundImage: PHOTO }}>
      <Card
        data-testid="playground"
        data-glass-interactive=""
        material={args.variant}
        style={liquidStyle(optionsOf(args))}
        className={`${SHAPES[args.shape]} grid place-content-center gap-1 p-5 text-center text-ink`}
      >
        <strong className="text-card-title">Liquid glass</strong>
        <span className="text-body text-ink-2">
          Press, hold and drag with interactive set to drag.
        </span>
      </Card>
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const surface = within(canvasElement).getByTestId("playground");
    const style = getComputedStyle(surface);
    await expect(style.getPropertyValue("--liquid-profile").trim()).toBe(args.profile);
    await expect(style.getPropertyValue("--liquid-frost").trim()).toBe(`${args.frost}px`);
    await expect(style.getPropertyValue("--liquid-motion").trim()).toBe(args.motion);
  },
};

const PROFILE_LABEL: Record<LiquidProfile, string> = {
  full: 'profile "full": a squarish pillow over the whole surface (default)',
  dome: 'profile "dome": a round drop, flatter in the middle',
  rim: 'profile "rim": only a bevel along the edge',
  crystal: 'profile "crystal": a thick clear lens that minifies the backdrop',
};

export const Profiles: Story = {
  name: "Profiles: full, dome and rim",
  render: () => (
    <div className="grid place-items-center gap-8 p-8" style={{ backgroundImage: PHOTO }}>
      <div className="flex flex-wrap justify-center gap-8">
        {(["full", "dome", "rim"] as const).map((profile) => (
          <Card
            key={profile}
            data-testid={`profile-${profile}`}
            material="liquid"
            style={liquidStyle({ profile })}
            className="grid h-44 w-72 place-content-center p-5 text-center text-ink"
          >
            <span className="text-body">{PROFILE_LABEL[profile]}</span>
          </Card>
        ))}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const profile of ["full", "dome", "rim"])
      await expect(
        getComputedStyle(canvas.getByTestId(`profile-${profile}`))
          .getPropertyValue("--liquid-profile")
          .trim(),
      ).toBe(profile);
  },
};

export const Presets: Story = {
  name: 'Presets: data-glass="liquid-clear | liquid-regular | liquid-thick"',
  render: () => (
    <div className="grid gap-0 md:grid-cols-3">
      {(["clear", "regular", "thick"] as const satisfies readonly LiquidPresetName[]).map(
        (name) => (
          <div
            key={name}
            data-glass={`liquid-${name}`}
            className="grid place-items-center gap-4 p-8"
            style={{ backgroundImage: PHOTO }}
          >
            <Pane title={`liquid-${name}`} className="glass" />
          </div>
        ),
      )}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const thick = within(canvasElement).getByText("liquid-thick").parentElement as HTMLElement;
    await expect(getComputedStyle(thick).getPropertyValue("--liquid-bevel").trim()).toBe("32px");
  },
};

export const Motion: Story = {
  name: "Motion: press lift, drag squash, touch glow",
  render: () => (
    <div className="grid place-items-center gap-8 p-8" style={{ backgroundImage: PHOTO }}>
      <div className="flex flex-wrap justify-center gap-8">
        <GlassButton className="liquid" />
        <Card
          data-testid="drag"
          data-glass-interactive=""
          material="liquid"
          style={liquidStyle({ interactive: "drag", motion: "jelly" })}
          className="grid h-32 w-56 place-content-center text-center text-ink"
        >
          Drag me: it stretches with your speed and settles like jelly
        </Card>
        <Card
          material="liquid"
          style={liquidStyle({ motion: false })}
          className="grid h-32 w-56 place-content-center text-center text-ink"
        >
          motion: false
        </Card>
      </div>
    </div>
  ),
};
