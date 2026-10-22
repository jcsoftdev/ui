@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.screenshots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.runDesktopComposeUiTest
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.RoborazziOptions
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.theme.UiStrings
import com.jcsoftdev.ui.theme.UiStyle
import com.jcsoftdev.ui.theme.UiTheme
import io.github.takahirom.roborazzi.captureRoboImage

/** The three looks every component is captured in: light, dark and a 200% system font scale. */
internal enum class Look(
    val id: String,
    val dark: Boolean,
    val fontScale: Float,
) {
    Light("light", false, 1f),
    Dark("dark", true, 1f),
    Font200("font200", false, 2f),
}

private const val SHOT_DENSITY = 1.5f

/** The default test window (1024 x 768 px); a taller fixed frame gets a taller window, or its foot would be cut off. */
private const val WINDOW_WIDTH = 1024
private const val WINDOW_HEIGHT = 768

// The goldens of record are Linux ones, recorded by the `ui-compose-record` workflow on ubuntu (CI is the source of
// truth). A local run on macOS differs by glyph rasterization, which this small share of changed pixels tolerates
// when only checking roughly; CI verifies the same goldens with the same threshold.
private val Options =
    RoborazziOptions(compareOptions = RoborazziOptions.CompareOptions(changeThreshold = 0.03f))

/**
 * Renders [content] once per [Look] and stores the cropped bounds of a fixed-width frame as
 * `screenshots/<family>/<name>_<look>.png` (relative to the kit module). `recordRoborazziJvm` writes the goldens and
 * `verifyRoborazziJvm` compares against them. Motion is off so nothing animates, and the bundled Figtree keeps text
 * metrics identical across machines. A [height] makes a fixed frame, needed by overlays that fill their parent; the test
 * window grows to hold a frame taller than the default window.
 */
internal fun shoot(
    family: String,
    name: String,
    width: Dp = 360.dp,
    height: Dp? = null,
    style: UiStyle = UiStyle.Default,
    content: @Composable () -> Unit,
) {
    val window = maxOf(WINDOW_HEIGHT, kotlin.math.ceil((height?.value ?: 0f) * SHOT_DENSITY).toInt())
    for (look in Look.entries) {
        runDesktopComposeUiTest(WINDOW_WIDTH, window) {
            setContent {
                CompositionLocalProvider(LocalDensity provides Density(SHOT_DENSITY, look.fontScale)) {
                    if (height == null) {
                        // The overlay host fills its parent, so a wrapping frame sits inside the theme.
                        UiTheme(dark = look.dark, motion = Motion(0f), strings = UiStrings.En, style = style) {
                            Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                                Box(Modifier.width(width).testTag("shot").background(UiTheme.colors.bg)) { content() }
                            }
                        }
                    } else {
                        // Overlays are laid out against the theme's host, so the fixed frame wraps the theme.
                        Box(Modifier.wrapContentSize(Alignment.TopStart)) {
                            Box(Modifier.size(width, height).testTag("shot")) {
                                UiTheme(dark = look.dark, motion = Motion(0f), strings = UiStrings.En, style = style) {
                                    Box(Modifier.fillMaxSize().background(UiTheme.colors.bg)) { content() }
                                }
                            }
                        }
                    }
                }
            }
            waitForIdle()
            onNodeWithTag("shot").captureToImage().captureRoboImage("screenshots/$family/${name}_${look.id}.png", Options)
        }
    }
}
