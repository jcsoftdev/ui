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

class LiquidGlassStyleTest {
    private val tokens = glassTokens(SurfaceMaterial.Liquid, dark = false)

    @Test fun theDefaultStyleIsTheRegularPresetAndLeavesTheTokensAlone() {
        assertEquals(LiquidGlassStyle.Regular, LiquidGlassStyle())
        assertSame(tokens, LiquidGlassStyle.Regular.applyTo(tokens))
    }

    @Test fun thePresetsDifferFromRegularButKeepTheContrastGuarantee() {
        for (preset in listOf(LiquidGlassStyle.Clear, LiquidGlassStyle.Thick)) {
            assertNotEquals(LiquidGlassStyle.Regular, preset)
            assertTrue(preset.preservesContrast, "$preset")
            assertSame(tokens, preset.applyTo(tokens), "a preset never touches the tint or dim")
        }
        assertTrue(LiquidGlassStyle.Thick.refraction > LiquidGlassStyle.Regular.refraction)
        assertTrue(LiquidGlassStyle.Thick.bevelWidth > LiquidGlassStyle.Clear.bevelWidth)
    }

    @Test fun lowOpacityStylesDropTheContrastGuaranteeAndScaleTheLayers() {
        val faint = LiquidGlassStyle(opacity = 0.5f)
        assertFalse(faint.preservesContrast)
        val out = faint.applyTo(tokens)
        assertEquals(tokens.tint.alpha * 0.5f, out.tint.alpha, 0.01f)
        assertEquals(tokens.dim.alpha * 0.5f, out.dim.alpha, 0.01f)
        assertFalse(LiquidGlassStyle(tint = LiquidTint(amount = 0.8f)).preservesContrast)
        assertFalse(LiquidGlassStyle(tint = LiquidTint(color = Color.Red)).preservesContrast)
        assertFalse(LiquidGlassStyle(brightness = 0.1f).preservesContrast)
    }

    @Test fun aStrongRimOrHighlightDropsTheContrastGuarantee() {
        assertFalse(LiquidGlassStyle(rim = 2.5f).preservesContrast)
        assertFalse(LiquidGlassStyle(specular = LiquidSpecular(intensity = 2f)).preservesContrast)
        assertTrue(LiquidGlassStyle(rim = 1.5f, specular = LiquidSpecular(intensity = 1.5f)).preservesContrast)
    }

    @Test fun theRimNeverReachesDeeperThanItsShareOfTheHalfSize() {
        assertEquals(22f, rimDepthFor(22f, 60f), "a deep enough surface keeps the bevel it asked for")
        assertEquals(MAX_RIM_SHARE * 28f, rimDepthFor(32f, 28f), 0.001f)
        assertEquals(1f, rimDepthFor(0f, 28f), "never below one pixel")
    }

    @Test fun frostSaturationAndTintColorReplaceTheTokenValues() {
        val out = LiquidGlassStyle(frost = 9.dp, saturation = 2f, tint = LiquidTint(color = Color(0xFF00FF00.toInt()))).applyTo(tokens)
        assertEquals(9.dp, out.blur)
        assertEquals(2f, out.saturate)
        assertEquals(Color.Green.green, out.tint.green)
        assertEquals(tokens.tint.alpha, out.tint.alpha, 0.01f)
        assertEquals(tokens.border, out.border)
    }

    @Test fun profilesMapToDistinctShaderCodesAndDomeAmounts() {
        assertEquals(listOf(1f, 0f, 2f), listOf(LiquidProfile.Rim, LiquidProfile.Full, LiquidProfile.Dome).map { it.shaderCode() })
        val full = LiquidGlassStyle(profile = LiquidProfile.Full).domeAmount()
        assertEquals(0f, LiquidGlassStyle(profile = LiquidProfile.Rim).domeAmount())
        assertTrue(LiquidGlassStyle(profile = LiquidProfile.Dome).domeAmount() > full)
        assertTrue(
            LiquidGlassStyle(profile = LiquidProfile.Dome, refraction = 2f).domeAmount() >
                LiquidGlassStyle(profile = LiquidProfile.Dome, refraction = 0.5f).domeAmount(),
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
        assertTrue(liquidMotionActive(LiquidGlassStyle.Regular, Motion(1f)))
        assertFalse(liquidMotionActive(LiquidGlassStyle.Regular, Motion(0f)))
        assertFalse(liquidMotionActive(LiquidGlassStyle(motion = null), Motion(1f)))
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
}
