package com.jcsoftdev.ui.glass

import com.jcsoftdev.ui.theme.UiStyle
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class MaterialResolutionTest {
    private fun resolve(
        requested: SurfaceMaterial? = null,
        role: SurfaceRole = SurfaceRole.Chrome,
        style: UiStyle = UiStyle.Default,
        reduceTransparency: Boolean = false,
        highContrast: Boolean = false,
        nested: Boolean = false,
        blurAvailable: Boolean = true,
        chromeGlass: SurfaceMaterial = SurfaceMaterial.Glass,
        lensAvailable: Boolean = false,
    ) = resolveMaterial(
        requested,
        role,
        style,
        reduceTransparency,
        highContrast,
        nested,
        blurAvailable,
        chromeGlass,
        lensAvailable,
    )

    @Test fun defaultStyleKeepsEverySurfaceSolid() {
        for (role in SurfaceRole.entries) assertEquals(SurfaceMode.Solid, resolve(role = role).mode)
    }

    @Test fun glassStyleMakesOnlyChromeGlass() {
        assertEquals(SurfaceMode.Blur, resolve(role = SurfaceRole.Chrome, style = UiStyle.Glass).mode)
        assertEquals(SurfaceMode.Solid, resolve(role = SurfaceRole.Content, style = UiStyle.Glass).mode)
    }

    @Test fun contentOptsInWithAMaterial() {
        val clear = resolve(SurfaceMaterial.GlassClear, SurfaceRole.Content)
        assertEquals(SurfaceMode.Blur, clear.mode)
        assertEquals(SurfaceMaterial.GlassClear, clear.variant)
    }

    @Test fun explicitSolidBeatsTheGlassStyle() {
        assertEquals(SurfaceMode.Solid, resolve(SurfaceMaterial.Solid, style = UiStyle.Glass).mode)
    }

    @Test fun glassFallsBackToTintWithoutABackdropOrPlatformBlur() {
        assertEquals(SurfaceMode.Tint, resolve(SurfaceMaterial.Glass, blurAvailable = false).mode)
    }

    @Test fun nestedGlassFallsBackToTheNearSolidFill() {
        val nested = resolve(SurfaceMaterial.Glass, nested = true)
        assertEquals(SurfaceMode.Nested, nested.mode)
        assertFalse(nested.isGlass)
        assertTrue(nested.providesNesting)
    }

    @Test fun glassProvidesNestingButSolidDoesNot() {
        assertTrue(resolve(SurfaceMaterial.Glass).providesNesting)
        assertTrue(resolve(SurfaceMaterial.Glass, blurAvailable = false).providesNesting)
        assertFalse(resolve(SurfaceMaterial.Solid).providesNesting)
    }

    @Test fun reducedTransparencyForcesOpaque() {
        val r = resolve(SurfaceMaterial.GlassClear, reduceTransparency = true, nested = true)
        assertEquals(SurfaceMode.Solid, r.mode)
        assertTrue(r.forcedOpaque)
        assertFalse(r.highContrast)
    }

    @Test fun highContrastForcesOpaqueWithAStrongBorder() {
        val r = resolve(style = UiStyle.Glass, highContrast = true)
        assertEquals(SurfaceMode.Solid, r.mode)
        assertTrue(r.forcedOpaque)
        assertTrue(r.highContrast)
    }

    @Test fun aSolidSurfaceIsNotMarkedForcedOpaque() {
        val r = resolve(SurfaceMaterial.Solid, highContrast = true)
        assertFalse(r.forcedOpaque)
        assertFalse(r.highContrast)
    }

    @Test fun defaultStyleWithAccessibilityOnIsPlainSolid() {
        val r = resolve(highContrast = true, reduceTransparency = true)
        assertEquals(SurfaceMode.Solid, r.mode)
        assertFalse(r.forcedOpaque)
    }

    @Test fun chromeGlassPicksWhatChromeIsMadeOf() {
        val liquid = resolve(style = UiStyle.Glass, chromeGlass = LiquidGlass.Regular)
        assertEquals(LiquidGlass.Regular, liquid.variant)
        assertEquals(SurfaceMaterial.Glass, resolve(style = UiStyle.Glass).variant)
        assertEquals(SurfaceMode.Solid, resolve(role = SurfaceRole.Content, style = UiStyle.Glass, chromeGlass = LiquidGlass.Regular).mode)
    }

    @Test fun anExplicitMaterialBeatsTheThemeChromeGlass() {
        assertEquals(SurfaceMaterial.Glass, resolve(SurfaceMaterial.Glass, chromeGlass = LiquidGlass.Regular).variant)
    }

    @Test fun aLensUsesTheShaderOnlyWhereItRuns() {
        val lensed = LiquidGlass(lens = RefractionLens())
        assertEquals(SurfaceMode.Lens, resolve(lensed, lensAvailable = true).mode)
        // Android 12 / 12L: blur but no runtime shader.
        assertEquals(SurfaceMode.Blur, resolve(lensed, lensAvailable = false).mode)
        // Below Android 12: no blur either.
        assertEquals(SurfaceMode.Tint, resolve(lensed, blurAvailable = false, lensAvailable = false).mode)
        assertEquals(SurfaceMode.Tint, resolve(lensed, blurAvailable = false, lensAvailable = true).mode)
    }

    @Test fun liquidWithoutALensIsTheBaseMaterialEvenWhereTheShaderRuns() {
        assertEquals(SurfaceMode.Blur, resolve(LiquidGlass(), lensAvailable = true).mode)
        assertEquals(SurfaceMode.Blur, resolve(LiquidGlass(dispersion = Dispersion()), lensAvailable = true).mode)
    }

    @Test fun frostedNeverUsesTheLens() {
        assertEquals(SurfaceMode.Blur, resolve(SurfaceMaterial.Glass, lensAvailable = true).mode)
        assertEquals(SurfaceMode.Blur, resolve(SurfaceMaterial.GlassClear, lensAvailable = true).mode)
    }

    @Test fun accessibilityForcesLiquidOpaqueAndNestingFlattensIt() {
        assertEquals(SurfaceMode.Solid, resolve(LiquidGlass.Regular, reduceTransparency = true, lensAvailable = true).mode)
        assertEquals(SurfaceMode.Solid, resolve(LiquidGlass.Regular.copy(clear = true), highContrast = true, lensAvailable = true).mode)
        assertEquals(SurfaceMode.Nested, resolve(LiquidGlass.Regular, nested = true, lensAvailable = true).mode)
        assertTrue(resolve(LiquidGlass.Regular, reduceTransparency = true).forcedOpaque)
    }
}
