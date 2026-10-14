@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.navigation.Segmented
import com.jcsoftdev.ui.navigation.SegmentedOption
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class LargeFontWrapTest {
    private val label = "Confirmar la cita del cliente"

    private fun lines(
        fontScale: Float,
        content: @Composable () -> Unit,
    ): Int {
        var result = 0
        runComposeUiTest {
            setContent {
                CompositionLocalProvider(LocalDensity provides Density(1f, fontScale)) {
                    UiTheme(dark = false, fontFamily = FontFamily.Default, motion = Motion(0f)) {
                        Box(Modifier.wrapContentSize(Alignment.TopStart).width(150.dp), content = { content() })
                    }
                }
            }
            val layout = mutableListOf<TextLayoutResult>()
            onNodeWithText(label)
                .fetchSemanticsNode()
                .config
                .getOrNull(SemanticsActions.GetTextLayoutResult)
                ?.action
                ?.invoke(layout)
            result = layout.first().lineCount
        }
        return result
    }

    @Test
    fun buttonWrapsOnlyAboveTheWrapScale() {
        assertEquals(1, lines(1.3f) { Button(label, {}) })
        assertEquals(2, lines(2f) { Button(label, {}) })
    }

    @Test
    fun chipWrapsOnlyAboveTheWrapScale() {
        assertEquals(1, lines(1.3f) { Chip(label) })
        assertEquals(2, lines(2f) { Chip(label) })
    }

    @Test
    fun segmentedLabelWrapsAboveTheWrapScale() {
        val options = listOf(SegmentedOption("a", label), SegmentedOption("b", "No"))
        assertEquals(1, lines(1.3f) { Segmented(options, "a", {}) })
        assertTrue(lines(2f) { Segmented(options, "a", {}) } == 2)
    }
}
