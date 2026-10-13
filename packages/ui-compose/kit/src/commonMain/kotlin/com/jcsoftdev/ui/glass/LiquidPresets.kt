package com.jcsoftdev.ui.glass

import androidx.compose.ui.unit.dp

// Each preset is its own holder object: it is built (and kept by R8) only when an app reads it, together with the lens,
// dispersion and interaction it names.

internal object RegularPreset {
    val value: LiquidGlass =
        LiquidGlass(
            lens = RefractionLens(),
            dispersion = Dispersion(),
            interaction = LiquidInteraction.Press(),
        )
}

internal object ClearPreset {
    val value: LiquidGlass =
        LiquidGlass(
            lens = RefractionLens(refraction = 1.2f),
            dispersion = Dispersion(0.045f),
            interaction = LiquidInteraction.Press(),
            bevelWidth = 18.dp,
            specular = LiquidSpecular(intensity = 1.25f),
            shadow = LiquidShadow(opacity = 0.8f),
        )
}

internal object ThickPreset {
    val value: LiquidGlass =
        LiquidGlass(
            lens = RefractionLens(refraction = 1.5f),
            dispersion = Dispersion(0.05f),
            interaction = LiquidInteraction.Press(LiquidMotion.Playful),
            bevelWidth = 32.dp,
            rim = 1.3f,
            specular = LiquidSpecular(intensity = 1.3f),
            fresnel = 0.3f,
            grain = 0.03f,
            shadow = LiquidShadow(spread = 20.dp, offsetY = 8.dp),
        )
}

internal object CrystalPreset {
    val value: LiquidGlass =
        LiquidGlass(
            lens = CrystalLens(),
            dispersion = Dispersion(0.05f),
            interaction = LiquidInteraction.Drag(),
            bevelWidth = 40.dp,
            frost = 0.dp,
            saturation = 1f,
            opacity = 0f,
            rim = 0.5f,
            specular = LiquidSpecular(intensity = 0.6f),
            fresnel = 1f,
            shadow = LiquidShadow(opacity = 0.6f, spread = 18.dp, offsetY = 6.dp),
        )
}

internal object PlayfulMotion {
    val value: LiquidMotion =
        LiquidMotion(
            press = LiquidSpring(0.6f, 420f),
            follow = LiquidSpring(0.7f, 200f),
            squashX = LiquidSpring(0.45f, 200f),
            squashY = LiquidSpring(0.55f, 200f),
            swell = 22.dp,
            glow = 0.2f,
        )
}
