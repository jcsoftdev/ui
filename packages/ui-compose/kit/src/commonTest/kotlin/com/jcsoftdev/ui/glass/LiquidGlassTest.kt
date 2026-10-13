package com.jcsoftdev.ui.glass

import androidx.compose.animation.core.TargetBasedAnimation
import androidx.compose.animation.core.VectorConverter
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

class LiquidGlassTest {
    private val tokens = glassTokens(LiquidGlass(), dark = false)

    @Test fun theBaseMaterialHasNoFeaturesAndLeavesTheTokensAlone() {
        val base = LiquidGlass()
        assertNull(base.lens)
        assertNull(base.dispersion)
        assertNull(base.interaction)
        assertFalse(base.refracts, "no lens: it never resolves to the lens mode")
        assertSame(tokens, base.applyTo(tokens))
        assertEquals(tokens, LiquidGlass.Regular.tokens(dark = false), "a preset keeps the base tokens")
    }

    @Test fun regularIsTheShippedLookAsFeatures() {
        val regular = LiquidGlass.Regular
        assertEquals(RefractionLens(1f, LiquidProfile.Full), regular.lens)
        assertEquals(Dispersion(0.03f), regular.dispersion)
        assertEquals(LiquidInteraction.Press(LiquidMotion.Standard), regular.interaction)
        assertTrue(regular.refracts)
        assertSame(regular, LiquidGlass.Regular, "a preset is one value")
    }

    @Test fun thePresetsDifferFromRegularButKeepTheContrastGuarantee() {
        for (preset in listOf(LiquidGlass.Clear, LiquidGlass.Thick)) {
            assertNotEquals(LiquidGlass.Regular, preset)
            assertTrue(preset.preservesContrast, "$preset")
            assertSame(tokens, preset.applyTo(tokens), "a preset never touches the tint or dim")
        }
        assertTrue(LiquidGlass.Thick.lens!!.refraction > LiquidGlass.Regular.lens!!.refraction)
        assertTrue(LiquidGlass.Thick.bevelWidth > LiquidGlass.Clear.bevelWidth)
    }

    @Test fun lowOpacityMaterialsDropTheContrastGuaranteeAndScaleTheLayers() {
        val faint = LiquidGlass(opacity = 0.5f)
        assertFalse(faint.preservesContrast)
        val out = faint.applyTo(tokens)
        assertEquals(tokens.tint.alpha * 0.5f, out.tint.alpha, 0.01f)
        assertEquals(tokens.dim.alpha * 0.5f, out.dim.alpha, 0.01f)
        val drawn = faint.tokens(dark = false)
        assertEquals(out.tint, drawn.tint, "the material draws the tokens with its own opacity")
        assertEquals(out.dim, drawn.dim)
        assertFalse(LiquidGlass(tint = LiquidTint(amount = 0.8f)).preservesContrast)
        assertFalse(LiquidGlass(tint = LiquidTint(color = Color.Red)).preservesContrast)
        assertFalse(LiquidGlass(brightness = 0.1f).preservesContrast)
    }

    @Test fun aStrongRimOrHighlightDropsTheContrastGuarantee() {
        assertFalse(LiquidGlass(rim = 2.5f).preservesContrast)
        assertFalse(LiquidGlass(specular = LiquidSpecular(intensity = 2f)).preservesContrast)
        assertTrue(LiquidGlass(rim = 1.5f, specular = LiquidSpecular(intensity = 1.5f)).preservesContrast)
    }

    @Test fun theRimNeverReachesDeeperThanItsShareOfTheHalfSize() {
        assertEquals(22f, rimDepthFor(22f, 60f), "a deep enough surface keeps the bevel it asked for")
        assertEquals(MAX_RIM_SHARE * 28f, rimDepthFor(32f, 28f), 0.001f)
        assertEquals(1f, rimDepthFor(0f, 28f), "never below one pixel")
    }

    @Test fun frostSaturationAndTintColorReplaceTheTokenValues() {
        val out = LiquidGlass(frost = 9.dp, saturation = 2f, tint = LiquidTint(color = Color(0xFF00FF00.toInt()))).applyTo(tokens)
        assertEquals(9.dp, out.blur)
        assertEquals(2f, out.saturate)
        assertEquals(Color.Green.green, out.tint.green)
        assertEquals(tokens.tint.alpha, out.tint.alpha, 0.01f)
        assertEquals(tokens.border, out.border)
    }

    @Test fun theClearTokenSetIsMoreTransparent() {
        val clear = glassTokens(LiquidGlass(clear = true), dark = false)
        assertTrue(clear.tint.alpha < tokens.tint.alpha)
        assertTrue(clear.blur < tokens.blur)
    }

    @Test fun profilesMapToDistinctShaderCodesAndDomeAmounts() {
        assertEquals(
            listOf(1f, 0f, 2f),
            listOf(LiquidProfile.Rim, LiquidProfile.Full, LiquidProfile.Dome).map { RefractionLens(profile = it).profileCode },
        )
        val full = RefractionLens(profile = LiquidProfile.Full).dome()
        assertEquals(0f, RefractionLens(profile = LiquidProfile.Rim).dome())
        assertTrue(RefractionLens(profile = LiquidProfile.Dome).dome() > full)
        assertTrue(
            RefractionLens(profile = LiquidProfile.Dome, refraction = 2f).dome() >
                RefractionLens(profile = LiquidProfile.Dome, refraction = 0.5f).dome(),
        )
    }

    @Test fun biggerSurfacesGetThickerShadowsAndShadingWithinBounds() {
        assertTrue(sizeScale(100f, 56f) > sizeScale(40f, 56f))
        assertEquals(1.5f, sizeScale(10_000f, 56f))
        assertEquals(0.6f, sizeScale(1f, 56f))
    }

    @Test fun smoothUnionMatchesMinOutsideTheBlendAndDipsInsideIt() {
        assertEquals(-3f, smoothMin(-3f, 40f, 10f))
        assertEquals(2f, smoothMin(2f, 2f + 10f, 10f))
        val joined = smoothMin(5f, 5f, 10f)
        assertTrue(joined < 5f, "equal distances pull in: $joined")
        assertEquals(5f - 10f * 0.25f, joined, 1e-5f)
        assertEquals(smoothMin(3f, 7f, 6f), smoothMin(7f, 3f, 6f), "symmetric")
        assertTrue(smoothMin(3f, 7f, 6f) <= minOf(3f, 7f))
        assertEquals(minOf(3f, 4f), smoothMin(3f, 4f, 0f), "no blend is a plain union")
    }

    @Test fun squashStretchesAlongTheMotionAndStaysWithinTwentyPercent() {
        val still = squashFor(0f, 0f)
        assertEquals(1f, still.x)
        assertEquals(1f, still.y)
        val sideways = squashFor(1f, 0f)
        assertTrue(sideways.x > 1f && sideways.y < 1f, "$sideways")
        val up = squashFor(0f, -1f)
        assertTrue(up.y > 1f && up.x < 1f, "$up")
        for (v in listOf(0.2f, 1f, 5f)) {
            val s = squashFor(v, v)
            assertTrue(s.x in 0.79f..1.26f && s.y in 0.79f..1.26f, "$v -> $s")
        }
        assertEquals(squashFor(0.4f, 0f).x, squashFor(-0.4f, 0f).x, "direction does not matter")
    }

    @Test fun theRubberBandIsLinearNearZeroAndNeverPassesTheLimit() {
        assertEquals(0f, rubberBand(0f, 50f))
        assertTrue(abs(rubberBand(1f, 50f) - 1f) < 0.01f)
        assertTrue(rubberBand(10_000f, 50f) <= 50f)
        assertEquals(-rubberBand(30f, 50f), rubberBand(-30f, 50f), 1e-5f)
        assertEquals(0f, rubberBand(5f, 0f))
    }

    @Test fun theHighlightTurnsTowardThePointer() {
        assertNull(lightToward(Offset(50f, 25f), 100f, 50f))
        val right = lightToward(Offset(100f, 25f), 100f, 50f)!!
        assertEquals(1f, right.x, 1e-5f)
        val own = lightFromAngle(-125f)
        assertEquals(hypot(own.x, own.y), 1f, 1e-5f)
        val unchanged = blendLight(own, right, 0f)
        assertEquals(own.x, unchanged.x, 1e-5f)
        assertEquals(own.y, unchanged.y, 1e-5f)
        val half = blendLight(own, right, 1f)
        assertEquals(right.x, half.x, 1e-5f)
        assertEquals(-90f, angleOf(0f, -1f), 1e-4f)
    }

    @Test fun springMotionIsOffForReducedMotionOrWithoutSprings() {
        assertTrue(liquidMotionActive(LiquidInteraction.Press(), Motion(1f)))
        assertFalse(liquidMotionActive(LiquidInteraction.Press(), Motion(0f)))
        assertFalse(liquidMotionActive(LiquidInteraction.Press(motion = null), Motion(1f)))
    }

    @Test fun onlyAnInteractionThatCanMoveTheSurfaceNeedsDynamics() {
        val on = Motion(1f)
        assertTrue(needsDynamics(LiquidInteraction.Press(), null, on), "the materialize ramp")
        assertFalse(needsDynamics(LiquidInteraction.Press(), null, Motion(0f)), "no ramp without motion, no source")
        assertFalse(needsDynamics(LiquidInteraction.Press(LiquidMotion(materialize = null)), null, on))
        assertTrue(needsDynamics(LiquidInteraction.Drag(motion = null), null, Motion(0f)), "a drag always observes")
        assertTrue(LiquidInteraction.Drag().drags)
        assertFalse(LiquidInteraction.Press().drags)
        assertNull(LiquidInteraction.Press().newDragState(), "only a drag makes drag state")
    }

    @Test fun swellIsSixteenDpOverTheWidthWithinALimit() {
        assertEquals(16f / 400f, swellFraction(16f, 400f), 1e-6f)
        assertEquals(0.12f, swellFraction(16f, 20f))
        assertEquals(0.12f, swellFraction(16f, 0f))
    }

    private fun anim(spring: LiquidSpring) = TargetBasedAnimation(spring.spec<Float>(), Float.VectorConverter, 0f, 1f)

    @Test fun everyMotionSpringConvergesOnItsTarget() {
        for (motion in listOf(LiquidMotion.Standard, LiquidMotion.Playful)) {
            for (spring in listOfNotNull(motion.press, motion.follow, motion.squashX, motion.squashY, motion.materialize)) {
                val a = anim(spring)
                assertEquals(1f, a.getValueFromNanos(a.durationNanos), 0.01f, "$spring")
                assertTrue(a.durationNanos < 3_000_000_000L, "$spring settles within 3s")
            }
        }
    }

    @Test fun theSquashSpringsAreMismatchedSoTheJellyWobbles() {
        val x = anim(LiquidMotion.Standard.squashX)
        val y = anim(LiquidMotion.Standard.squashY)
        val t = 200_000_000L
        assertTrue(abs(x.getValueFromNanos(t) - y.getValueFromNanos(t)) > 0.01f)
        // Underdamped: the value overshoots its target on the way, which is the jelly.
        val peak = (1..60).maxOf { x.getValueFromNanos(it * 20_000_000L) }
        assertTrue(peak > 1.02f, "overshoot $peak")
    }

    @Test fun crystalIsAClearConvexLensWithoutAVeil() {
        val c = LiquidGlass.Crystal
        assertEquals(CrystalLens(1.67f), c.lens)
        assertEquals(Dispersion(0.05f), c.dispersion)
        assertEquals(40.dp, c.bevelWidth)
        assertEquals(0.dp, c.frost)
        assertEquals(1f, c.fresnel)
        assertEquals(LiquidInteraction.Drag(), c.interaction)
        assertFalse(c.preservesContrast, "no veil: the contrast guarantee is gone")
        val veil = c.applyTo(tokens)
        assertEquals(0f, veil.tint.alpha)
        assertEquals(0f, veil.dim.alpha)
        assertEquals(0.dp, veil.blur)
    }

    @Test fun theCrystalLensMinifiesAndReachesBeyondTheSurface() {
        val crystal = CrystalLens()
        assertEquals(3f, crystal.profileCode)
        assertEquals(CONVEX_BEND, crystal.bend)
        assertTrue(crystal.dome() < 0f, "a negative dome samples a wider strip")
        assertTrue(CrystalLens(refraction = 2f).dome() < CrystalLens(refraction = 1f).dome())
        assertEquals(0f, RefractionLens().reach(100f, 50f, 20f), "a refraction lens keeps the surface bounds")
        assertTrue(crystal.reach(100f, 50f, 20f) > 20f)
    }

    @Test fun dispersionOwnsTheDispersiveShaderAndThePlainOneLeavesItOut() {
        val plain = PlainLensProgram.value.source
        val dispersive = Dispersion().lensProgram.source
        assertFalse("1.0 + dispersion" in plain, "the plain lens takes one sample per pixel")
        assertTrue("1.0 + dispersion" in dispersive)
        assertSame(Dispersion(0.05f).lensProgram, Dispersion().lensProgram, "one dispersive program, whatever the amount")
        assertTrue("blendK" in Dispersion().mergeProgram.program.source)
        assertFalse("blendK" in plain)
    }
}
