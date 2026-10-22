// Type-checks the examples in site/src/content/docs/docs/auth.md against the built package.
// Every ```tsx block in that page must equal one `#region` below (see test/docs-examples.mjs).
import { AuthIllustration, AuthLayout, LoginForm } from "@jcsoftdev/ui/auth";
import { useState } from "react";

declare function signIn(identifier: string, password: string): Promise<void>;

// #region login
export function LoginScreen() {
  return (
    <AuthLayout layout="split">
      <AuthLayout.Brand>Acme</AuthLayout.Brand>
      <AuthLayout.Art />
      <AuthLayout.Panel>
        <LoginForm
          portals={[
            { value: "staff", label: "Staff", identifierLabel: "Work email" },
            { value: "family", label: "Family", identifierLabel: "Guardian ID" },
            { value: "student", label: "Student", identifierLabel: "Student code" },
          ]}
          onSubmit={({ identifier, password }) => signIn(identifier, password)}
        >
          <LoginForm.Header />
          <LoginForm.Portals />
          <LoginForm.Identifier />
          <LoginForm.Password forgotHref="/forgot" />
          <LoginForm.Error />
          <LoginForm.Submit />
          <LoginForm.Footer>
            By signing in you accept the <a href="/terms">Terms</a>.
          </LoginForm.Footer>
        </LoginForm>
      </AuthLayout.Panel>
    </AuthLayout>
  );
}
// #endregion

// #region controlled
export function ControlledState() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthLayout layout="centered">
      <AuthLayout.Art>
        <AuthIllustration label="The three portals" />
      </AuthLayout.Art>
      <AuthLayout.Panel>
        <LoginForm
          loading={loading}
          error={error}
          onSubmit={async ({ identifier, password }) => {
            setLoading(true);
            setError(null);
            try {
              await signIn(identifier, password);
            } catch {
              setError("Those details do not match.");
            } finally {
              setLoading(false);
            }
          }}
        />
      </AuthLayout.Panel>
    </AuthLayout>
  );
}
// #endregion
