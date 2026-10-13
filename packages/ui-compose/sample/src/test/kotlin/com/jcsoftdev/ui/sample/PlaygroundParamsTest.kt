package com.jcsoftdev.ui.sample

import androidx.compose.ui.graphics.Color
import com.jcsoftdev.ui.glass.LiquidGlass
import com.jcsoftdev.ui.glass.LiquidInteraction
import com.jcsoftdev.ui.glass.LiquidMotion
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PlaygroundParamsTest {
    @Test fun theKitDefaultIsTheRegularPreset() {
        assertEquals("LiquidGlass.Regular", PlaygroundParams.Kit.toSnippet())
        assertEquals(LiquidGlass.Regular, PlaygroundParams.Kit.toMaterial())
    }

    @Test fun everyPresetRoundTripsThroughTheParams() {
        for (preset in listOf(LiquidGlass.Regular, LiquidGlass.Clear, LiquidGlass.Thick, LiquidGlass.Crystal)) {
            assertEquals(preset, PlaygroundParams.from(preset).toMaterial())
        }
    }

    @Test fun theFeatureChoicesBuildTheirValues() {
        val base = PlaygroundParams.Kit.copy(lens = LensChoice.None, dispersion = 0f, interaction = InteractionChoice.None)
        assertEquals(LiquidGlass(), base.toMaterial())
        val still = PlaygroundParams.Kit.copy(interaction = InteractionChoice.Drag, motion = MotionChoice.Off).toMaterial()
        assertEquals(LiquidInteraction.Drag(null), still.interaction)
        assertEquals(MotionChoice.Off, PlaygroundParams.from(still).motion)
    }

    @Test fun onlyChangedFieldsAreListedAndNestedValuesKeepTheirDefaults() {
        val snippet =
            PlaygroundParams.Kit
                .copy(refraction = 1.5f, bevel = 32f, lens = LensChoice.Dome, tintColor = Color(0xFF4DA3FF), specularAngle = -90f)
                .copy(interaction = InteractionChoice.Press, motion = MotionChoice.Playful)
                .toSnippet()
        assertEquals(
            """
            LiquidGlass.Regular.copy(
                lens = RefractionLens(refraction = 1.5f, profile = LiquidProfile.Dome),
                interaction = LiquidInteraction.Press(LiquidMotion.Playful),
                bevelWidth = 32.dp,
                tint = LiquidTint(color = Color(0xFF4DA3FF)),
                specular = LiquidSpecular(angleDegrees = -90.0f),
            )
            """.trimIndent(),
            snippet,
        )
        assertEquals(LiquidMotion.Playful, LiquidInteraction.Press(LiquidMotion.Playful).motion)
    }

    @Test fun theInitialLookIsCrystalAndIsWrittenOutInFull() {
        assertEquals(LiquidGlass.Crystal, PlaygroundParams.Initial.toMaterial())
        val snippet = PlaygroundParams.Initial.toSnippet()
        assertTrue("lens = CrystalLens()" in snippet && "frost = 0.dp" in snippet && "opacity = 0.0f" in snippet, snippet)
        assertTrue("interaction = LiquidInteraction.Drag()" in snippet, snippet)
    }
}
