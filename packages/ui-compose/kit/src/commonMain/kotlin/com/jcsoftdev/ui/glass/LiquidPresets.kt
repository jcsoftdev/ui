package com.jcsoftdev.ui.glass

import androidx.compose.ui.unit.dp

// The presets other than Regular live in their own file class: it is loaded (and kept by R8) only when an app reads one.

// Declared first: Thick reads it while this file class initializes.
internal val PlayfulMotion: LiquidMotion =
    LiquidMotion(
        press = LiquidSpring(0.6f, 420f),
        follow = LiquidSpring(0.7f, 200f),
        squashX = LiquidSpring(0.45f, 200f),
        squashY = LiquidSpring(0.55f, 200f),
        swell = 22.dp,
        glow = 0.2f,
    )

internal val ClearPreset: LiquidGlassStyle =
    LiquidGlassStyle(
        refraction = 1.2f,
        bevelWidth = 18.dp,
        dispersion = 0.045f,
        specular = LiquidSpecular(intensity = 1.25f),
        shadow = LiquidShadow(opacity = 0.8f),
    )

internal val ThickPreset: LiquidGlassStyle =
    LiquidGlassStyle(
        refraction = 1.5f,
        bevelWidth = 32.dp,
        dispersion = 0.05f,
        rim = 1.3f,
        specular = LiquidSpecular(intensity = 1.3f),
        fresnel = 0.3f,
        grain = 0.03f,
        shadow = LiquidShadow(spread = 20.dp, offsetY = 8.dp),
        motion = LiquidMotion.Playful,
    )

internal val CrystalPreset: LiquidGlassStyle =
    LiquidGlassStyle(
        refraction = 1.67f,
        bevelWidth = 40.dp,
        profile = LiquidProfile.Convex,
        dispersion = 0.05f,
        frost = 0.dp,
        saturation = 1f,
        opacity = 0f,
        rim = 0.5f,
        specular = LiquidSpecular(intensity = 0.6f),
        fresnel = 1f,
        shadow = LiquidShadow(opacity = 0.6f, spread = 18.dp, offsetY = 6.dp),
        interaction = LiquidInteraction.Drag,
    )
