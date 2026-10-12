# ui-compose

Compose Multiplatform UI kit (Android, JVM desktop, iOS) built from the same design tokens and icons as the web `@jcsoftdev/ui`. Parity matrix: [docs/parity.md](docs/parity.md).

## Install

Published to Maven Central as `com.jcsoftdev:ui-compose`.

```kotlin
// commonMain (Kotlin Multiplatform)
dependencies {
    implementation("com.jcsoftdev:ui-compose:0.1.0")
}
```

Gradle resolves the per-target artifacts (`ui-compose-android`, `ui-compose-jvm`, `ui-compose-iosarm64`, `ui-compose-iossimulatorarm64`) through Gradle module metadata. Android-only projects can depend on `com.jcsoftdev:ui-compose-android:0.1.0` directly. The Android artifact ships the kit's baseline profile.

## Glass

Liquid Glass follows Apple's model: glass is for controls and navigation floating above content; content stays solid; glass never sits on glass; accessibility settings make it opaque.

```kotlin
UiTheme(style = UiStyle.Glass) {          // chrome (Sheet, Dialog, Menu, Toaster, TopBar, ActionBar) becomes glass
    Card { ... }                          // content: solid
    Card(material = SurfaceMaterial.GlassClear) { ... } // opt in per surface
}
```

| Piece | What it does |
| --- | --- |
| `SurfaceMaterial.Solid / Glass / GlassClear` | The `material` parameter. `null` means the role default: chrome is glass only with `UiStyle.Glass`, content is solid. |
| `Modifier.material`, `MaterialSurface` | Glass for any surface; `MaterialSurface` also marks its children as inside glass. |
| `rememberGlassState`, `Modifier.glassSource`, `LocalGlassState` | The backdrop. Overlays get the app content automatically from `OverlayHost`; for in-content bars mark the scrolling content and pass the state to `TopBar(glass = ...)`. |
| `UiTheme(reduceTransparency, highContrast, backdropBlur)` | Opaque-with-border switches and a global blur kill switch. |

How it renders: tint, dim layer, 1 px border and a top edge highlight everywhere (the `UiGlass` tokens shared with the web); real blur (`BlurEffect` plus a saturation color filter on a per-surface `GraphicsLayer` that replays the shared source layer) on Android 12 (API 31)+, desktop and iOS. The source is recorded only while a blurring surface is composed. Below API 31, in the Menu popup window (it cannot sample the app) and without a source, the surface is a 90% opaque tint instead of a blurred one. No dependency beyond Compose foundation.

Rules: blur large chrome only, never list items; the radius is constant (never animate it); in-content glass cards are tint-only (a surface inside its own source would sample itself). The glass sheet follows its drag exactly; if a screen drops frames, `UiTheme(backdropBlur = false)` is the fallback.

Accessibility: Android has no reduce-transparency setting; the kit reads high-contrast text (`high_text_contrast_enabled`) and the Android 14 contrast level (`UiModeManager.contrast >= 0.5`) and shows opaque glass for them. iOS maps Reduce Transparency and Increase Contrast (`darkerSystemColors`). Pass the flags yourself to override.

The sample app has a Glass screen (`--es screen glass`; extras `dark`, `blur`, `reduce`, `open` = `sheet` or `dialog`).

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
