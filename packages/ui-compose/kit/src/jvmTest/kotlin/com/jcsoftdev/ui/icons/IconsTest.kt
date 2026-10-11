@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.icons

import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.VectorPath
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertSame
import kotlin.test.assertTrue

class IconsTest {
    private val svgDir = File("../../ui/icons/svg")

    @Test
    fun everySvgAndAliasProducedAnIcon() {
        val svgs = svgDir.listFiles { f -> f.extension == "svg" }.orEmpty().size
        assertTrue(svgs > 0, "svg source not found at ${svgDir.absolutePath}")
        assertEquals(svgs, GeneratedSvgCount)
        assertEquals(svgs + GeneratedAliasCount, GeneratedIcons.size)
        assertEquals(GeneratedIcons.size, GeneratedIconNames.toSet().size)
        for ((name, icon) in GeneratedIcons) {
            val vector = icon()
            assertEquals(24f, vector.viewportWidth, name)
            assertTrue(vector.root.size > 0, "$name has no paths")
        }
    }

    @Test
    fun iconIsBuiltOnceAndAliasesShareIt() {
        assertSame(Icons.Calendar, Icons.Calendar)
        assertSame(Icons.TriangleAlert, Icons.AlertTriangle)
    }

    @Test
    fun calendarMatchesTheGoldenShape() {
        val calendar = Icons.Calendar
        assertEquals("Calendar", calendar.name)
        assertEquals(24f, calendar.viewportWidth)
        assertEquals(24f, calendar.viewportHeight)
        val paths = calendar.root.filterIsInstance<VectorPath>()
        assertEquals(4, paths.size)
        // M8 2v3 -> MoveTo + RelativeVerticalTo
        assertEquals(2, paths[0].pathData.size)
        // The rounded rect: M, h, a, v, a, h, a, v, a, z
        assertEquals(10, paths[2].pathData.size)
        assertEquals(2f, paths[0].strokeLineWidth)
        assertEquals(null, paths[0].fill)
    }

    @Test
    fun decorativeIconHasNoSemantics() =
        runComposeUiTest {
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                    Icon(Icons.Calendar, contentDescription = null, modifier = Modifier.testTag("deco"))
                }
            }
            val node = onNodeWithTag("deco").fetchSemanticsNode()
            assertFalse(SemanticsProperties.ContentDescription in node.config)
        }

    @Test
    fun describedIconExposesContentDescription() =
        runComposeUiTest {
            setContent {
                UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                    Icon(Icons.Calendar, contentDescription = "Calendario")
                }
            }
            onNodeWithContentDescription("Calendario").assert(
                SemanticsMatcher.expectValue(SemanticsProperties.ContentDescription, listOf("Calendario")),
            )
        }
}
