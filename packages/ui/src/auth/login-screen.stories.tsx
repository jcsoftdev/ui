import type { Meta, StoryObj } from "@storybook/react-vite";
import { AUTH_STATES, type AuthState } from "./auth-illustration/model.js";
import { AuthLayout, type AuthLayoutKind } from "./auth-layout/auth-layout.js";
import { LoginForm, type LoginPortal } from "./login-form/login-form.js";

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
  state?: AuthState;
  progress?: number;
}

function LoginScreen({ layout = "split", state, progress }: ScreenProps) {
  return (
    <AuthLayout
      layout={layout}
      {...(state ? { state } : {})}
      {...(progress !== undefined ? { progress } : {})}
    >
      <AuthLayout.Brand>EduModules</AuthLayout.Brand>
      <AuthLayout.Art />
      <AuthLayout.Panel>
        <LoginForm
          portals={portals}
          onSubmit={async ({ password }) => {
            if (password !== "demo1234") throw new Error("La contraseña no coincide.");
          }}
        >
          <LoginForm.Header title="Inicia sesión" />
          <LoginForm.Portals />
          <LoginForm.Identifier />
          <LoginForm.Password forgotHref="#recuperar" />
          <LoginForm.Error />
          <LoginForm.Submit />
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
    state: { control: "inline-radio", options: AUTH_STATES },
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
