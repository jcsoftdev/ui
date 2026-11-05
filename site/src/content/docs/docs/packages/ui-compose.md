---
title: ui-compose
description: Compose Multiplatform UI kit for Android, JVM desktop and iOS, built from the same design tokens and icons as the web kit, with Liquid Glass materials.
section: Packages
---

`ui-compose` is a Compose Multiplatform UI kit (Android, JVM desktop, iOS) built from the same design tokens and icons as the web `@jcsoftdev/ui`. It ports the mobile subset of the web kit and keeps names, props and the accessibility contract aligned where a component exists on both sides. The per-family matrix is in the [parity table](https://github.com/jcsoftdev/ui/blob/main/packages/ui-compose/docs/parity.md).

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

Glass follows the same model as the web kit (see [Liquid Glass](/docs/glass)): it is for controls and navigation floating above content, content stays solid, and accessibility settings make it opaque.

```kotlin
UiTheme(style = UiStyle.Glass) {          // chrome (Sheet, Dialog, Menu, Toaster, TopBar, ActionBar) becomes glass
    Card { ... }                          // content: solid
    Card(material = SurfaceMaterial.GlassClear) { ... } // opt in per surface
}
```

Liquid Glass features (`LiquidGlass`, lenses, dispersion, press and drag interaction) are values the app passes, so R8 drops what an app never names. The rendering details, fallbacks per Android API level, performance guidance and accessibility behaviour are in the README.

## Related

- Design tokens shared with the web: [Theming](/docs/theming) and [Theme generation](/docs/theming/theme-generator).

## Reference

README (glass, release procedure, verification): [packages/ui-compose on GitHub](https://github.com/jcsoftdev/ui/tree/main/packages/ui-compose).
