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
          <LoginForm.Error />
          <LoginForm.Identifier />
          <LoginForm.Password forgotHref="/forgot" />
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

| Piece                      | What it does                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AuthLayout`               | `layout` (`split`, `split-reverse`, `centered`); `state`, `progress`, `activeIndex` (each controlled or with a `default*` and `on*Change`). Parts: `.Brand`, `.Art`, `.Panel`, `.Footer`. `useAuthLayout()` reads the shared state.                                                                                      |
| `AuthIllustration`         | `state` (`idle`, `typing`, `password`, `error`, `success`), `progress` (0 to 1, fill of the whole form), `activeIndex` (the slab that rises), `label`, `look` (default `Slabs`). Without `label` it is decorative: `aria-hidden`, nothing focusable. Text looks (`Statement`) ignore `label`: their text is the content. |
| `LoginForm`                | `onSubmit`, `portals`, `portal` / `defaultPortal` / `onPortalChange`, `loading`, `error`, `success`. Parts: `.Header`, `.Portals`, `.Identifier`, `.Password`, `.Options`, `.Error`, `.Submit`, `.Providers`, `.Footer`. With no children it renders them in that order.                                                 |
| `PasswordInput`, `Divider` | The generic pieces behind the form, exported from `forms` and `atoms`.                                                                                                                                                                                                                                                   |

### Layout follows the container

The root of `AuthLayout` is a named container (`@container/auth`), never the viewport. At 768px of its own width the art goes beside the panel (`split`, `split-reverse`) or sits faded behind it (`centered`); under that the art stacks above the panel, and under 448px it is dropped so a narrow embed shows only the form. `AuthLayout.Brand` sits on the art's side: top left, or top right in a wide `split-reverse`. See the [container queries guide](/docs/container-queries/).

### Solid panel and open form

`panel="solid"` fills one side of a `split` or `split-reverse` layout with the theme's accent pair for the art (`--accent` behind, `--on-accent` for the brand and a duotone illustration, so the accent slab never disappears into the panel), and leaves the form open on the other side with no card. Inside it `LoginForm` defaults to `appearance="open"`: labels above the fields, a pill submit button and a left-aligned heading. Set `appearance` yourself to mix them (`card` on a solid panel, `open` on paper). The art collapses under 448px of layout width and stacks above the form under 768px, like the paper layout; `centered` ignores `panel`.

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
          <LoginForm.Error />
          <LoginForm.Identifier />
          <LoginForm.Password forgotHref="/forgot" />
          <LoginForm.Options helpHref="/help" />
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

### Looks

`look` on `AuthIllustration` (or `AuthLayout.Art`) takes the illustration as a component, and each look is its own entry. An app imports only the looks it renders: the default `Slabs` ships with `@jcsoftdev/ui/auth`, and the other four stay out of the bundle until you import them. Every look reads the same `state`, `progress` and `activeIndex`, takes its colors from the tokens, and adapts its composition to the width of its own container (`@container/art`), not the viewport.

| Look                           | What it shows                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Slabs` (default)              | Three isometric portal slabs (the default, shipped with `@jcsoftdev/ui/auth`). They drift together as the form fills, hop on each keystroke, fly apart on an error and lock together with a burst on success.                                                                                                                                                                                                                                                            |
| `Stack` (`auth/stack`)         | A tower of books that gains a book as the form fills (a dashed slot marks the next one), squashes on each keystroke, wobbles on an error and plants a flag with the active portal's glyph on success. Narrow containers show a shorter, larger tower (4, 5 or 6 books).                                                                                                                                                                                                  |
| `Mosaic` (`auth/mosaic`)       | A floor of isometric tiles that light diagonally from the back corner as the form fills. A tile glints on each keystroke and glows under the pointer; an error sweeps a red flash across the floor and success ripples out from its centre. Three tiles carry the portal glyphs and the active one stands raised. 4, 5 or 6 tiles a side by container width.                                                                                                             |
| `Character` (`auth/character`) | A student with a backpack riding a hover board over a pulsing shadow, made for the solid panel. They bob, blink and follow the pointer; they look toward the form and nod while it is typed into, cover their eyes for the password, shake their head on an error and hop with a boost on success. The deck lamps fill with progress and the chest badge carries the active portal's glyph.                                                                              |
| `Statement` (`auth/statement`) | Kinetic type instead of a drawing: a large headline that rises word by word, an optional caption and a pill that works as a progress meter (it fills toward the arrow at its end as the form fills, never moves on its own and is not a control). On success the headline gives way to a short "you're in" line (UI strings `welcomeBack` and `signedIn`). The text is real content, so this look is never hidden from assistive technology; pass `headline`, `caption` and `action` to `AuthIllustration` or `AuthLayout.Art`. |

```tsx region=looks
export function BooksScreen() {
  return (
    <AuthLayout panel="solid">
      <AuthLayout.Art look={Stack} />
      <AuthLayout.Panel>
        <LoginForm onSubmit={({ identifier, password }) => signIn(identifier, password)} />
      </AuthLayout.Panel>
    </AuthLayout>
  );
}
```

Import a look from its own entry, for example `import { Stack } from "@jcsoftdev/ui/auth/stack"`. A look is any component that takes the illustration's props (`AuthLook`), so you can write your own. A look that is text people read sets `text`, which keeps it visible to assistive technology.

#### Choosing the look by name

`AuthIllustrationAny` from `@jcsoftdev/ui/auth/looks` takes a string `variant` (`slabs`, `stack`, `mosaic`, `character`, `statement`). It imports all five looks on purpose, so an app that renders it pays the weight of every look (about 2 to 3 KB gzip each). Use it for a gallery or a theme picker, and pass the component to `AuthIllustration` everywhere else.

```tsx region=by-name
export function ByName({ variant }: { variant: "slabs" | "stack" | "mosaic" }) {
  return <AuthIllustrationAny variant={variant} />;
}
```

The text look takes its content from props:

```tsx region=statement
export function StatementScreen() {
  return (
    <AuthLayout layout="split-reverse">
      <AuthLayout.Art
        look={Statement}
        headline="Every class, every family, one place."
        caption="Sign in to pick up where your school left off."
        action={<a href="/about">How it works</a>}
      />
      <AuthLayout.Panel>
        <LoginForm onSubmit={({ identifier, password }) => signIn(identifier, password)} />
      </AuthLayout.Panel>
    </AuthLayout>
  );
}
```

### State

`LoginForm` keeps the layout in step with the form: focusing the identifier reads `typing`, the password `password`, leaving both `idle`; a failed submit reads `error` until the person edits a field (a new submit leaves it, so the same failure twice replays the error); controlled `success` or `error` going back to unset hands the art back to focus and typing; a resolved `onSubmit` reads `success`. `progress` is the fill of both fields: the identifier is the first half and grows with its length, the password is the second half and counts only as filled or not (its length never reaches the DOM, where session-replay tools do not mask styles and attributes). The selected portal becomes `activeIndex` (a form without portals leaves `defaultActiveIndex` alone), so its slab rises (the illustration draws three slabs, so portals past the third share the last).

`onSubmit` may return a promise: while it is pending the button is loading (it keeps focus and the form ignores further submits, see Accessibility), a rejection shows the error message (or the localized default) and moves focus to the password. To drive the form from your own mutation instead, pass `loading`, `error` and `success`.

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

### Security and Server Components

- The form carries `method="post"` (override it with the `method` prop), so a submit before hydration never puts the password in the URL.
- Every look is a client module, so a Server Component (Next.js App Router) can pass it as the `look` prop: `<AuthLayout.Art look={Stack} />` works from a server file.

### Accessibility

- Fields are real `Field`s: labels are visually hidden but present, `aria-invalid` and `aria-describedby` point at the error.
- A field left empty on submit is reported right under that field (`role="alert"`, an alert icon, a danger ring and icon on the field), and the field's `aria-describedby` points at that message.
- `LoginForm.Error` holds errors about the sign-in itself (wrong credentials, a server message) as a callout above the fields. It is a `role="alert"` region that stays in the page while empty, so a new message is announced, and the password field points at it while it shows.
- `LoginForm.Submit` is a `Button`: while signing in it shows a spinner next to its label, stays focused and undimmed, reports `aria-busy` and `aria-disabled`, and another press, click or Enter in a field does not submit again.
- `LoginForm.Portals` is a `radiogroup` with arrow-key navigation. A tile lifts on keyboard focus as it does on hover (hover only on devices that can hover), and the selected tile shows a check badge besides its colour; the badge is decorative, the radio's `aria-checked` carries the state; `PasswordInput`'s reveal toggle keeps one name and reports `aria-pressed`.
- The illustration is hidden from assistive technology unless you pass `label`. The `Statement` look is real text instead: the headline is read until sign-in succeeds, then "You're in." replaces it and the caption is hidden.

### Motion

Movement is CSS only: transitions and keyframes driven by `data-state` and custom properties, animating only `transform` and `opacity`. The one piece of script writes the pointer position as `--px` and `--py` on the art, at most once per frame, for a light parallax; it does nothing for touch or coarse pointers and is removed on unmount. An error holds for about a second (`ERROR_HOLD_MS`) and then the art settles back to the password state by itself. With `prefers-reduced-motion: reduce` nothing moves, but every state keeps its pose: the looks jump straight to it (spread out at rest, closer while typing, flung apart or tinted red on an error, assembled with a still burst on success), the edges still turn toward the danger color on an error, and there is no parallax. The parallax also follows the setting when it changes while the page is open.

### Strings

Defaults come from `UiStringsProvider` (en and es): `signIn`, `signInAs`, `withYourAccount`, `identifier`, `password`, `forgotPassword`, `signInAction`, `enterIdentifier`, `enterPassword`, `signInFailed`, `rememberMe`, `needHelp`, `orLogInWith` and `showPassword`.
