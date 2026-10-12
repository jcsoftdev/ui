# ui-compose

Compose Multiplatform UI kit (Android, JVM desktop, iOS) built from the same design tokens and icons as the web `@jcsoftdev/ui`. Parity matrix: [docs/parity.md](docs/parity.md).

## Install

Published to Maven Central as `com.jcsoftdev:ui-compose`.

```kotlin
// commonMain (Kotlin Multiplatform)
dependencies {
    implementation("com.jcsoftdev:ui-compose:0.2.0")
}
```

Gradle resolves the per-target artifacts (`ui-compose-android`, `ui-compose-jvm`, `ui-compose-iosarm64`, `ui-compose-iossimulatorarm64`) through Gradle module metadata. Android-only projects can depend on `com.jcsoftdev:ui-compose-android:0.2.0` directly. The Android artifact ships the kit's baseline profile.

## Glass

Liquid Glass follows Apple's model: glass is for controls and navigation floating above content; content stays solid; glass on glass falls back to a near-solid fill; accessibility settings make it opaque.

```kotlin
UiTheme(style = UiStyle.Glass) {          // chrome (Sheet, Dialog, Menu, Toaster, TopBar, ActionBar) becomes glass
    Card { ... }                          // content: solid
    Card(material = SurfaceMaterial.GlassClear) { ... } // opt in per surface
}
```

| Piece | What it does |
| --- | --- |
| `SurfaceMaterial.Solid / Glass / GlassClear / Liquid / LiquidClear` | The `material` parameter. `null` means the role default: chrome is glass only with `UiStyle.Glass`, content is solid. |
| `Modifier.material`, `MaterialSurface` | Glass for any surface; `MaterialSurface` also marks its children as inside glass. |
| `GlassVariant` (`Frosted`, `Liquid`), `UiTheme(glassVariant = ...)` | Which glass `UiStyle.Glass` chrome uses; the default is `Frosted` (blur only, like the web). Pass `GlassVariant.Liquid` for the lensed Apple look. |
| `rememberGlassState`, `Modifier.glassSource`, `LocalGlassState` | The backdrop. Overlays get the app content automatically from `OverlayHost`; for in-content bars mark the scrolling content and pass the state to `TopBar(glass = ...)`. |
| `UiTheme(reduceTransparency, highContrast, backdropBlur)` | Opaque-with-border switches and a global blur kill switch. |

How it renders: tint, dim layer, 1 px border and a top edge highlight everywhere (the `UiGlass` tokens shared with the web); real blur (`BlurEffect` plus a saturation color filter on a per-surface `GraphicsLayer` that replays the shared source layer) on Android 12 (API 31)+, desktop and iOS. The source is recorded only while a blurring surface is composed. Below API 31, in the Menu popup window (it cannot sample the app) and without a source, the surface is a 90% opaque tint instead of a blurred one. No dependency beyond Compose foundation.

Nesting: everything inside a glass surface (including a Menu opened from a glass `TopBar`, `ActionBar`, sheet or dialog) that asks for glass gets the near-solid fill. The web keeps portaled popups opened from a top bar as glass; Compose is stricter here on purpose, because a popup window cannot blur anyway. Glass inside an opaque surface (for example a glass `Card` in a default, solid sheet) is tint-only: it does not sample the page hidden behind the sheet.

The blur sits on an opaque `bg` base and never samples past the source bounds, so content under a source that is not opaque does not show through sharply.

Performance: blurred scrolling under a `TopBar` costs noticeably more than tint on software-GPU emulators (p50 29 ms vs 16 ms measured); for long scrolling lists prefer `material = SurfaceMaterial.Solid` or `UiTheme(backdropBlur = false)` on low-end devices. The kit does not switch blur off while scrolling on its own.

Rules: blur large chrome only, never list items; the radius is constant (never animate it); in-content glass cards are tint-only (a surface inside its own source would sample itself). The glass sheet follows its drag exactly; if a screen drops frames, `UiTheme(backdropBlur = false)` is the fallback.

Accessibility: Android has no reduce-transparency setting; the kit reads high-contrast text (`high_text_contrast_enabled`) and the Android 14 contrast level (`UiModeManager.contrast >= 0.5`) and shows opaque glass for them. iOS maps Reduce Transparency and Increase Contrast (`darkerSystemColors`). Pass the flags yourself to override.

Liquid variant: `Liquid` and `LiquidClear` refract the backdrop like a lens. A runtime shader (AGSL on Android 13+, SkSL on desktop and iOS) bends the backdrop along a signed-distance edge, strongest at the rim and fading to nothing across a bezel, with a little chromatic dispersion, a low center blur, a specular rim, thickness shading and an outer shadow. Pass `interactionSource` to `Modifier.material` or `MaterialSurface` and a press brightens and strengthens the lens; with motion enabled the surface also flexes by 3% (reduced motion keeps only the brightening). Fallbacks: Android 12 and 12L (API 31-32) get the blurred glass with the Liquid rim and shadow; below API 31 a tint with the rim; reduce transparency and high contrast force opaque, as for any glass. Frosted rendering is unchanged by the Liquid variant. Liquid keeps the frosted dim layer and a 0.95 (regular) or 0.8 (clear) tint, which holds primary and secondary text at 4.5:1 or better over a pure black or white backdrop; the tertiary text color (`ink3`) is about 3.3:1 on frosted regular over black and lower on Liquid, so do not put `ink3` copy on glass that matters. Cost: one extra shader pass per Liquid surface, and the shader compiles on first use.

The sample app has a Glass screen (`--es screen glass`; extras `dark`, `blur`, `reduce`, `variant` = `liquid` (default `frosted`), `open` = `sheet` or `dialog`).

Golden screenshots of glass are not in the verified set yet: goldens of record are Linux, recorded by CI. Run `GLASS_SHOTS=1 ./gradlew :kit:recordRoborazziJvm --tests '*GlassShots*'` to inspect them locally.

## Release procedure

The version lives in one place: `VERSION_NAME` in `gradle.properties`.

1. Bump `VERSION_NAME` (for example `0.1.1`), update the install snippet above, and merge to `main`.
2. Tag the merge commit and push the tag: `git tag ui-compose-v0.1.1 && git push origin ui-compose-v0.1.1`.
3. `.github/workflows/ui-compose-release.yml` verifies the tag matches `VERSION_NAME`, re-runs the compose checks on Linux, then runs `./gradlew publishAndReleaseToMavenCentral --no-configuration-cache` on macOS (the iOS klibs need a Mac host).
4. Central releases are immutable. Check the deployment on https://central.sonatype.com/publishing/deployments.

Required repository secrets (environment `maven-central`):

| Secret | Gradle property |
| --- | --- |
| `MAVEN_CENTRAL_USERNAME` | `mavenCentralUsername` (Central Portal user token name) |
| `MAVEN_CENTRAL_PASSWORD` | `mavenCentralPassword` (Central Portal user token) |
| `SIGNING_KEY` | `signingInMemoryKey` (ASCII-armored private key, `gpg --armor --export-secret-keys <id>`) |
| `SIGNING_KEY_PASSWORD` | `signingInMemoryKeyPassword` |

The `com.jcsoftdev` namespace must be verified in the Central Portal, and the public key published to a keyserver (`keys.openpgp.org`).

### Local verification

```sh
./gradlew publishToMavenLocal --no-configuration-cache   # unsigned unless signingInMemoryKey is set
```

Artifacts land in `~/.m2/repository/com/jcsoftdev`. Signing only activates when `ORG_GRADLE_PROJECT_signingInMemoryKey` is present.
