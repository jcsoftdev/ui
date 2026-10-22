import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { AuthLayout } from "../auth-layout/auth-layout.js";
import { LoginForm, type LoginPortal } from "./login-form.js";

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

const meta = {
  title: "Auth/LoginForm",
  component: LoginForm,
  tags: ["autodocs"],
  args: { portals },
  decorators: [
    (Story) => (
      <div className="max-w-110 overflow-hidden rounded-card border-card bg-surface">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standalone: Story = {
  args: { portals: [], onSubmit: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // Before hydration a native submit must not put the password in the URL.
    await expect(canvasElement.querySelector("form")).toHaveAttribute("method", "post");
    await userEvent.type(canvas.getByLabelText("Email or ID"), "maria@colegio.pe");
    await userEvent.type(canvas.getByLabelText("Password", { selector: "input" }), "secreto");
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(args.onSubmit).toHaveBeenCalledWith({
        identifier: "maria@colegio.pe",
        password: "secreto",
        portal: undefined,
        remember: false,
      }),
    );
  },
};

export const WithPortals: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("radiogroup", { name: "Sign in as" });
    await expect(group).toBeVisible();
    const radios = within(group).getAllByRole("radio");
    await expect(radios).toHaveLength(3);
    radios[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(radios[1]).toHaveAttribute("aria-checked", "true");
    await expect(canvas.getByLabelText("DNI del apoderado")).toBeVisible();
    await expect(canvas.getByText("Padres y apoderados")).toBeVisible();
  },
};

export const Complete: Story = {
  render: (args) => (
    <LoginForm {...args}>
      <LoginForm.Header title="Bienvenido" description="Ingresa con tu cuenta del colegio." />
      <LoginForm.Portals />
      <LoginForm.Identifier />
      <LoginForm.Password forgotHref="#recuperar" />
      <LoginForm.Error />
      <LoginForm.Submit>Ingresar</LoginForm.Submit>
      <LoginForm.Footer>
        Al ingresar aceptas los <a href="#terminos">Términos</a>.
      </LoginForm.Footer>
    </LoginForm>
  ),
};

export const MissingIdentifier: Story = {
  args: { portals: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    const alert = await canvas.findByRole("alert");
    await expect(alert).toHaveTextContent("Enter your email or ID.");
    const identifier = canvas.getByLabelText("Email or ID");
    await expect(identifier).toHaveAttribute("aria-invalid", "true");
    await expect(identifier).toHaveAccessibleDescription("Enter your email or ID.");
    await expect(identifier).toHaveFocus();
  },
};

export const WrongPassword: Story = {
  args: {
    portals: [],
    onSubmit: async () => {
      throw new Error("La contraseña no coincide.");
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Email or ID"), "maria@colegio.pe");
    const password = canvas.getByLabelText("Password", { selector: "input" });
    await userEvent.type(password, "mala");
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent("La contraseña no coincide.");
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAccessibleDescription("La contraseña no coincide.");
    await expect(password).toHaveFocus();
    await userEvent.type(password, "x");
    await expect(password).not.toHaveAttribute("aria-invalid");
  },
};

export const Loading: Story = { args: { portals: [], loading: true } };

export const ControlledError: Story = {
  args: { portals: [], error: "Tu cuenta está bloqueada. Contacta a tu colegio." },
};

/** Inside an `AuthLayout` the form drives the illustration: focus, typing, failure and success. */
export const InsideAuthLayout: Story = {
  decorators: [
    (Story) => (
      <AuthLayout layout="split">
        <AuthLayout.Brand>EduModules</AuthLayout.Brand>
        <AuthLayout.Art />
        <AuthLayout.Panel>
          <Story />
        </AuthLayout.Panel>
      </AuthLayout>
    ),
  ],
  args: {
    onSubmit: async ({ password }) => {
      if (password !== "demo1234") throw new Error("La contraseña no coincide.");
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const layout = canvasElement.querySelector("[data-layout]") as HTMLElement;
    await expect(layout).toHaveAttribute("data-state", "idle");
    const identifier = canvas.getByLabelText("Correo institucional");
    await userEvent.click(identifier);
    await expect(layout).toHaveAttribute("data-state", "typing");
    await userEvent.type(identifier, "maria@colegio.pe");
    const password = canvas.getByLabelText("Password", { selector: "input" });
    await userEvent.click(password);
    await expect(layout).toHaveAttribute("data-state", "password");
    await userEvent.type(password, "mala");
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(layout).toHaveAttribute("data-state", "error"));
    await userEvent.clear(password);
    await userEvent.type(password, "demo1234");
    await userEvent.click(canvas.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(layout).toHaveAttribute("data-state", "success"));
  },
};
