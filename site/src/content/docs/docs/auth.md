---
title: Sign-in screen
description: AuthLayout, AuthIllustration and LoginForm, a themeable login screen whose illustration reacts to the form, with container-query layouts, portals, accessibility notes and examples.
section: Guides
---

`@jcsoftdev/ui/auth` is a login screen built from three compound pieces. The illustration (three isometric slabs, one per portal) reacts to what the person does in the form: it drifts together while they type, flies apart on an error and locks together on success. It has no tenant concept: every color comes from the theme tokens (`--accent`, `--surface`, `--ink`) through `color-mix`, so dark mode and each `data-accent` apply with no extra code, and the host app does any tenant theming by setting those tokens.

Every example below is type-checked against the built package (`pnpm check:docs-examples`).

## Putting it together

```tsx region=login
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
```

`AuthLayout` owns the sign-in state and shares it by context with `AuthIllustration` and `LoginForm`, so placing them inside it is the whole wiring. `LoginForm` also works alone, outside a layout.

## Parts

| Piece                      | What it does                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AuthLayout`               | `layout` (`split`, `split-reverse`, `centered`); `state`, `progress`, `activeIndex` (each controlled or with a `default*` and `on*Change`). Parts: `.Brand`, `.Art`, `.Panel`, `.Footer`. `useAuthLayout()` reads the shared state.                                      |
| `AuthIllustration`         | `state` (`idle`, `typing`, `password`, `error`, `success`), `progress` (0 to 1, fill of the whole form), `activeIndex` (the slab that rises), `label`. Without `label` it is decorative: `aria-hidden`, nothing focusable.                                               |
| `LoginForm`                | `onSubmit`, `portals`, `portal` / `defaultPortal` / `onPortalChange`, `loading`, `error`, `success`. Parts: `.Header`, `.Portals`, `.Identifier`, `.Password`, `.Options`, `.Error`, `.Submit`, `.Providers`, `.Footer`. With no children it renders them in that order. |
| `PasswordInput`, `Divider` | The generic pieces behind the form, exported from `forms` and `atoms`.                                                                                                                                                                                                   |

### Layout follows the container

The root of `AuthLayout` is a named container (`@container/auth`), never the viewport. At 768px of its own width the art goes beside the panel (`split`, `split-reverse`) or sits faded behind it (`centered`); under that the art stacks above the panel, and under 448px it is dropped so a narrow embed shows only the form. See the [container queries guide](/docs/container-queries/).

### Solid panel and open form

`panel="solid"` fills one side of a `split` or `split-reverse` layout with a solid color derived from the theme (`color-mix` of `--accent` and `--ink`) for the art, and leaves the form open on the other side with no card. Inside it `LoginForm` defaults to `appearance="open"`: labels above the fields, a pill submit button and a left-aligned heading. Set `appearance` yourself to mix them (`card` on a solid panel, `open` on paper). The art collapses under 448px of layout width and stacks above the form under 768px, like the paper layout; `centered` ignores `panel`.

`LoginForm.Options` is a row with a remember-me checkbox (reported to `onSubmit` as `remember`) and a help link slot (`help`, or `helpHref` for the localized link). `LoginForm.Providers` is a labelled group for alternative ways to sign in: the library ships no providers and renders only the children you pass, and nothing when there are none.

```tsx region=solid
export function SolidPanelScreen() {
  return (
    <AuthLayout panel="solid">
      <AuthLayout.Brand>Acme</AuthLayout.Brand>
      <AuthLayout.Art />
      <AuthLayout.Panel>
        <LoginForm onSubmit={({ identifier, password }) => signIn(identifier, password)}>
          <LoginForm.Header title="Welcome back" />
          <LoginForm.Identifier />
          <LoginForm.Password forgotHref="/forgot" />
          <LoginForm.Options helpHref="/help" />
          <LoginForm.Error />
          <LoginForm.Submit />
          <LoginForm.Providers label="Or log in with">
            <button type="button">Company account</button>
          </LoginForm.Providers>
        </LoginForm>
      </AuthLayout.Panel>
    </AuthLayout>
  );
}
```

### State

`LoginForm` keeps the layout in step with the form: focusing the identifier reads `typing`, the password `password`, leaving both `idle`; a failed submit reads `error` until the person edits a field; a resolved `onSubmit` reads `success`. `progress` is the fill of both fields (the identifier is the first half). The selected portal becomes `activeIndex`, so its slab rises (the illustration draws three slabs, so portals past the third share the last).

`onSubmit` may return a promise: while it is pending the button is loading, a rejection shows the error message (or the localized default) and moves focus to the password. To drive the form from your own mutation instead, pass `loading`, `error` and `success`.

```tsx region=controlled
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
```

### Accessibility

- Fields are real `Field`s: labels are visually hidden but present, `aria-invalid` and `aria-describedby` point at the error.
- `LoginForm.Error` is a `role="alert"` region that stays in the page while empty, so a new message is announced.
- `LoginForm.Portals` is a `radiogroup` with arrow-key navigation; `PasswordInput`'s reveal toggle keeps one name and reports `aria-pressed`.
- The illustration is hidden from assistive technology unless you pass `label`.

### Motion

Movement is CSS only (transitions and keyframes driven by `data-state` and custom properties, with `--motion-ease`). With `prefers-reduced-motion: reduce` the slabs rest assembled and still; an error still shows in the slab edges, which turn toward the danger color.

### Strings

Defaults come from `UiStringsProvider` (en and es): `signIn`, `signInAs`, `withYourAccount`, `identifier`, `password`, `forgotPassword`, `signInAction`, `enterIdentifier`, `enterPassword`, `signInFailed`, `rememberMe`, `needHelp`, `orLogInWith` and `showPassword`.
