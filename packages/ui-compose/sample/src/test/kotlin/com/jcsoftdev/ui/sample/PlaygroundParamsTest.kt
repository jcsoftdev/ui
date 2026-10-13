package com.jcsoftdev.ui.sample

import androidx.compose.ui.graphics.Color
import com.jcsoftdev.ui.glass.LiquidGlassStyle
import com.jcsoftdev.ui.glass.LiquidProfile
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PlaygroundParamsTest {
    @Test fun theKitDefaultPrintsAsAnEmptyCall() {
        assertEquals("LiquidGlassStyle()", PlaygroundParams.Kit.toSnippet())
    }

    @Test fun everyPresetRoundTripsThroughTheParams() {
        for (preset in listOf(LiquidGlassStyle.Regular, LiquidGlassStyle.Clear, LiquidGlassStyle.Thick, LiquidGlassStyle.Crystal)) {
            assertEquals(preset, PlaygroundParams.from(preset).toStyle())
        }
    }

    @Test fun onlyChangedFieldsAreListedAndNestedValuesKeepTheirDefaults() {
        val snippet =
            PlaygroundParams.Kit
                .copy(refraction = 1.5f, bevel = 32f, profile = LiquidProfile.Dome, tintColor = Color(0xFF4DA3FF), specularAngle = -90f)
                .toSnippet()
        assertEquals(
            """
            LiquidGlassStyle(
                refraction = 1.5f,
                bevelWidth = 32.dp,
                profile = LiquidProfile.Dome,
                tint = LiquidTint(color = Color(0xFF4DA3FF)),
                specular = LiquidSpecular(angleDegrees = -90.0f),
            )
            """.trimIndent(),
            snippet,
        )
    }

    @Test fun theInitialLookIsCrystalAndIsWrittenOutInFull() {
        assertEquals(LiquidGlassStyle.Crystal, PlaygroundParams.Initial.toStyle())
        val snippet = PlaygroundParams.Initial.toSnippet()
        assertTrue("profile = LiquidProfile.Convex" in snippet && "frost = 0.dp" in snippet && "opacity = 0.0f" in snippet, snippet)
    }
}
