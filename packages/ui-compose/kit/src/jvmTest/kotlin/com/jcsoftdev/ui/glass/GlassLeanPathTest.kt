@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.glass

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ComposeUiTest
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

private val TestShape = RoundedCornerShape(12.dp)

@Composable
private fun Tagged(
    tag: String,
    material: SurfaceMaterial,
    source: MutableInteractionSource? = null,
    size: Dp = 80.dp,
) {
    Box(Modifier.size(size).testTag(tag).material(material, TestShape, glass = null, interactionSource = source))
}

// The modifiers only a Liquid surface needs: the shadow stack, the swell/squash layer and the drag pointer observer.
private val LiquidOnly = setOf("LiquidShadowElement", "BlockGraphicsLayerElement", "PointerObserverElement")

/** The class names of the modifiers on the node tagged [tag]. */
private fun ComposeUiTest.modifierNames(tag: String): List<String> =
    onNodeWithTag(tag)
        .fetchSemanticsNode()
        .layoutInfo
        .getModifierInfo()
        .mapNotNull { it.modifier::class.simpleName }

private fun ComposeUiTest.element(
    tag: String,
    name: String,
): Modifier.Element? =
    onNodeWithTag(tag)
        .fetchSemanticsNode()
        .layoutInfo
        .getModifierInfo()
        .map { it.modifier }
        .filterIsInstance<Modifier.Element>()
        .firstOrNull { it::class.simpleName == name }

class GlassLeanPathTest {
    @Test fun surfacesThatAreNotLiquidCarryNoLiquidModifier() {
        runComposeUiTest {
            val press = MutableInteractionSource()
            setContent {
                UiTheme(dark = false, motion = Motion(1f)) {
                    Column {
                        Tagged("solid", SurfaceMaterial.Solid, press)
                        Tagged("frosted", SurfaceMaterial.Glass, press)
                        Tagged("liquid", LiquidGlass.Regular)
                        Tagged("pressable", LiquidGlass.Regular, press)
                        Tagged("static", LiquidGlass(), press)
                    }
                }
            }
            waitForIdle()
            val solid = modifierNames("solid")
            val frosted = modifierNames("frosted")
            assertFalse(solid.any { it.endsWith("SurfaceElement") }, "a solid surface draws no glass: $solid")
            assertTrue("FrostedSurfaceElement" in frosted, "the frosted surface is glass: $frosted")
            assertFalse("LiquidSurfaceElement" in frosted, "a frosted surface draws none of the Liquid surface: $frosted")
            for (name in LiquidOnly) {
                assertFalse(name in solid, "$name on a solid surface")
                assertFalse(name in frosted, "$name on a frosted surface")
            }
            val liquid = modifierNames("liquid")
            assertTrue("LiquidShadowElement" in liquid, "a Liquid surface casts its shadow: $liquid")
            assertFalse("BlockGraphicsLayerElement" in liquid, "a Liquid surface without a press source gets no swell layer: $liquid")
            assertFalse("PointerObserverElement" in liquid, "a Press surface does not observe the pointer: $liquid")
            assertTrue("BlockGraphicsLayerElement" in modifierNames("pressable"), "a pressable Liquid surface swells")
            val static = modifierNames("static")
            assertTrue("LiquidSurfaceElement" in static, "the base material is Liquid: $static")
            assertFalse("BlockGraphicsLayerElement" in static, "without an interaction a press source moves nothing: $static")
        }
    }

    @Test fun aCustomLiquidMaterialKeepsTheSurfaceElementAcrossRecompositions() {
        runComposeUiTest {
            var tick by mutableIntStateOf(0)
            val custom = LiquidGlass.Regular.copy(opacity = 0.9f)
            setContent {
                UiTheme(dark = false, motion = Motion(0f)) {
                    Tagged("s", custom, size = if (tick >= 0) 80.dp else 0.dp)
                }
            }
            waitForIdle()
            val before = assertNotNull(element("s", "LiquidSurfaceElement"))
            tick++
            waitForIdle()
            val after = assertNotNull(element("s", "LiquidSurfaceElement"))
            assertEquals(before, after, "the tokens of a custom material are remembered, so the node is not updated on recomposition")
        }
    }
}
