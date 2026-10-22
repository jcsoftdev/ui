import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "../atoms/button/button.js";
import { AUTH_STATES, type AuthState } from "./auth-illustration/model.js";
import { AuthLayout, type AuthLayoutKind } from "./auth-layout/auth-layout.js";
import { LoginForm, type LoginFormAppearance, type LoginPortal } from "./login-form/login-form.js";
import { AUTH_LOOKS, type AuthIllustrationVariant } from "./looks/auth-illustration-any.js";

const portals: LoginPortal[] = [
  {
    value: "staff",
    label: "Personal",
    description: "Docentes, dirección y tesorería",
    identifierLabel: "Correo institucional",
  },
  {
    value: "family",
    label: "Familia",
    description: "Padres y apoderados",
    identifierLabel: "DNI del apoderado",
  },
  {
    value: "student",
    label: "Estudiante",
    description: "Alumnos con cuenta",
    identifierLabel: "Código de estudiante",
  },
];

interface ScreenProps {
  layout?: AuthLayoutKind;
  panel?: "paper" | "solid";
  appearance?: LoginFormAppearance;
  state?: AuthState;
  progress?: number;
  /** Look of the illustration, by name. */
  look?: AuthIllustrationVariant;
  /** Width of the box the screen is rendered in; the layout follows it. */
  width?: number;
}

function LoginScreen({ width, ...props }: ScreenProps) {
  return width ? (
    <div style={{ width }}>
      <Screen {...props} />
    </div>
  ) : (
    <Screen {...props} />
  );
}

function Screen({ layout = "split", panel, appearance, state, progress, look }: ScreenProps) {
  return (
    <AuthLayout
      layout={layout}
      {...(panel ? { panel } : {})}
      {...(state ? { state } : {})}
      {...(progress !== undefined ? { progress } : {})}
    >
      <AuthLayout.Brand>EduModules</AuthLayout.Brand>
      <AuthLayout.Art
        look={look ? AUTH_LOOKS[look] : undefined}
        headline="Aprende sin pausa"
        caption="Tu colegio, tus cursos y tus pagos en un solo lugar."
      />
      <AuthLayout.Panel>
        <LoginForm
          portals={portals}
          {...(appearance ? { appearance } : {})}
          onSubmit={async ({ password }) => {
            if (password !== "demo1234") throw new Error("La contraseña no coincide.");
          }}
        >
          <LoginForm.Header title="Inicia sesión" />
          <LoginForm.Portals />
          <LoginForm.Error />
          <LoginForm.Identifier />
          <LoginForm.Password forgotHref="#recuperar" />
          <LoginForm.Options helpHref="#ayuda" />
          <LoginForm.Submit />
          <LoginForm.Providers>
            <Button size="sm">Cuenta del colegio</Button>
            <Button size="sm">Código QR</Button>
          </LoginForm.Providers>
          <LoginForm.Footer>
            Al ingresar aceptas los <a href="#terminos">Términos</a> y la{" "}
            <a href="#privacidad">Política de privacidad</a>.
          </LoginForm.Footer>
        </LoginForm>
      </AuthLayout.Panel>
    </AuthLayout>
  );
}

const meta = {
  title: "Auth/LoginScreen",
  component: LoginScreen,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  argTypes: {
    layout: { control: "inline-radio", options: ["split", "split-reverse", "centered"] },
    panel: { control: "inline-radio", options: ["paper", "solid"] },
    appearance: { control: "inline-radio", options: ["card", "open"] },
    state: { control: "inline-radio", options: AUTH_STATES },
    look: { control: "inline-radio", options: Object.keys(AUTH_LOOKS) },
    width: { control: { type: "number", min: 320, max: 1400, step: 10 } },
  },
} satisfies Meta<typeof LoginScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Try it: pick a portal, type, use a wrong password, then `demo1234`. */
export const Interactive: Story = {};

export const SplitReverse: Story = { args: { layout: "split-reverse" } };

export const Centered: Story = { args: { layout: "centered" } };

const boxed = (width: number): Story => ({
  decorators: [
    (Story) => (
      <div style={{ width }}>
        <Story />
      </div>
    ),
  ],
});

/** A 360px box: the layout follows its container, so the art drops out and only the card stays. */
export const Narrow360: Story = boxed(360);

/** A 600px box: the art stacks above the card. */
export const Medium600: Story = boxed(600);

export const Wide1100: Story = boxed(1100);

export const StateTypingIdentifier: Story = { args: { state: "typing", progress: 0.3 } };

export const StatePassword: Story = { args: { state: "password", progress: 0.8 } };

export const StateError: Story = { args: { state: "error", progress: 0.7 } };

export const StateSuccess: Story = { args: { state: "success", progress: 1 } };

export const SolidPanel: Story = { args: { panel: "solid" } };

export const SolidPanelReverse: Story = { args: { panel: "solid", layout: "split-reverse" } };

const combos = [
  { panel: "paper", appearance: "card" },
  { panel: "paper", appearance: "open" },
  { panel: "solid", appearance: "card" },
  { panel: "solid", appearance: "open" },
] as const;

/** Every panel x appearance in a wide and a 360px container. */
export const PanelAndAppearance: Story = {
  decorators: [
    () => (
      <div className="grid gap-10 p-4">
        {combos.map(({ panel, appearance }) => (
          <section key={`${panel}-${appearance}`} className="grid gap-3">
            <p className="m-0 text-ink-3 text-meta">
              panel={panel} appearance={appearance}
            </p>
            <div className="flex flex-wrap items-start gap-6">
              {[1100, 360].map((width) => (
                <div key={width} style={{ width }}>
                  <LoginScreen panel={panel} appearance={appearance} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    ),
  ],
};

export const OpenFormStructure: Story = {
  args: { panel: "solid" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const form = canvasElement.querySelector("form") as HTMLElement;
    await expect(form).toHaveAttribute("data-appearance", "open");
    // The labels are visible above the fields, not screen-reader only.
    const label = canvas.getByText("Correo institucional", { selector: "label" });
    await expect(getComputedStyle(label).position).not.toBe("absolute");
    const remember = canvas.getByRole("checkbox", { name: "Remember me" });
    await userEvent.click(remember);
    await expect(remember).toHaveAttribute("aria-checked", "true");
    await expect(canvas.getByRole("group", { name: "Or log in with" })).toBeVisible();
    await expect(canvas.getByRole("link", { name: "Need help?" })).toBeVisible();
    const root = canvasElement.querySelector("[data-layout]") as HTMLElement;
    await expect(root).toHaveAttribute("data-panel", "solid");
  },
};
