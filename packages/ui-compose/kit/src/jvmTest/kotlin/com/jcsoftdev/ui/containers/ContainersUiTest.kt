@file:OptIn(ExperimentalTestApi::class)

package com.jcsoftdev.ui.containers

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.runComposeUiTest
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.Motion
import com.jcsoftdev.ui.states.EmptyState
import com.jcsoftdev.ui.states.ErrorState
import com.jcsoftdev.ui.states.OfflineBanner
import com.jcsoftdev.ui.states.Skeleton
import com.jcsoftdev.ui.theme.ThemeSizes
import com.jcsoftdev.ui.theme.UiColors
import com.jcsoftdev.ui.theme.UiTheme
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ContainersUiTest {
    @Composable
    private fun Host(
        motion: Motion = Motion(0f),
        sizes: ThemeSizes = ThemeSizes.Default,
        content: @Composable () -> Unit,
    ) = UiTheme(dark = false, fontFamily = FontFamily.Default, motion = motion, sizes = sizes) { Column { content() } }

    private val heading = SemanticsMatcher.keyIsDefined(SemanticsProperties.Heading)

    private fun liveRegion(mode: LiveRegionMode) = SemanticsMatcher.expectValue(SemanticsProperties.LiveRegion, mode)

    @Test
    fun titlesAreHeadings() =
        runComposeUiTest {
            setContent {
                Host {
                    PageHeader("Agenda", eyebrow = "Sucursal", lede = "Hoy")
                    EmptyState("Sin citas", description = "Nada por ahora")
                    ErrorState("Falló la carga")
                }
            }
            onNode(hasText("Agenda") and heading).assertExists()
            onNode(hasText("Sin citas") and heading).assertExists()
            onNode(hasText("Falló la carga") and heading).assertExists()
            onNode(hasText("Sucursal") and heading).assertDoesNotExist()
        }

    @Test
    fun emptyStateIconIsHiddenFromAccessibility() =
        runComposeUiTest {
            setContent { Host { EmptyState("Vacío", icon = { Text("icon-glyph", Modifier.testTag("icon")) }) } }
            onNodeWithTag("icon").assertDoesNotExist()
            onNodeWithTag("icon", useUnmergedTree = true).assertExists()
        }

    @Test
    fun bannersAreLiveRegions() =
        runComposeUiTest {
            setContent {
                Host {
                    Banner("Revisa", tone = BannerTone.Info)
                    Banner("Falló", tone = BannerTone.Danger)
                    OfflineBanner("Sin conexión", queuedChanges = 2, queuedLabel = "2 cambios en cola")
                }
            }
            onNode(hasText("Revisa") and liveRegion(LiveRegionMode.Polite)).assertExists()
            onNode(hasText("Falló") and liveRegion(LiveRegionMode.Assertive)).assertExists()
            onNode(hasText("Sin conexión") and liveRegion(LiveRegionMode.Polite)).assertExists()
            onNodeWithContentDescription("2 cambios en cola").assertExists()
        }

    @Test
    fun offlineBannerHidesTheCounterWhenNothingIsQueued() =
        runComposeUiTest {
            setContent { Host { OfflineBanner("Sin conexión", queuedLabel = "0 cambios") } }
            onNodeWithContentDescription("0 cambios").assertDoesNotExist()
        }

    @Test
    fun bannerDismissAndActionFire() =
        runComposeUiTest {
            var dismissed = 0
            var acted = 0
            setContent {
                Host {
                    Banner(
                        "Guardado",
                        tone = BannerTone.Success,
                        onDismiss = { dismissed++ },
                        dismissLabel = "Cerrar",
                        action = { Text("Deshacer", Modifier.testTag("undo")) },
                    )
                    Banner("Sin dismiss")
                }
            }
            onNodeWithContentDescription("Cerrar").performClick()
            assertEquals(1, dismissed)
            onNodeWithTag("undo").assertExists()
            assertEquals(1, onAllNodesWithContentDescription("Cerrar").fetchSemanticsNodes().size)
            assertEquals(0, acted)
        }

    @Test
    fun errorStateRetries() =
        runComposeUiTest {
            var retries = 0
            setContent {
                Host {
                    ErrorState(
                        "No cargó",
                        correlationId = "7f3a",
                        correlationLabel = "ID:",
                        onRetry = { retries++ },
                        retryLabel = "Reintentar",
                    )
                }
            }
            onNode(hasText("No cargó") and liveRegion(LiveRegionMode.Assertive)).assertExists()
            onNodeWithText("ID: 7f3a", substring = true).assertExists()
            onNodeWithText("Reintentar").performClick()
            onNodeWithText("Reintentar").performClick()
            assertEquals(2, retries)
        }

    @Test
    fun errorStateWithoutRetryHasNoButton() =
        runComposeUiTest {
            setContent { Host { ErrorState("No cargó", retryLabel = "Reintentar") } }
            onNodeWithText("Reintentar").assertDoesNotExist()
        }

    @Test
    fun clickableListRowMergesIntoOneButton() =
        runComposeUiTest {
            var taps = 0
            setContent {
                Host {
                    ListRow("Corte", Modifier.testTag("row"), subtitle = "30 min", meta = "S/ 35", selected = true, onClick = { taps++ })
                }
            }
            onNodeWithTag("row")
                .assertTextEquals("Corte", "30 min", "S/ 35")
                .assertIsSelected()
                .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
                .assertHeightIsAtLeast(48.dp)
                .performClick()
            assertEquals(1, taps)
            assertEquals(1, onAllNodes(hasClickAction()).fetchSemanticsNodes().size)
        }

    @Test
    fun readOnlyListRowKeepsTrailingControlsSeparate() =
        runComposeUiTest {
            var toggled = 0
            setContent {
                Host {
                    ListRow(
                        "Notificaciones",
                        subtitle = "Recordatorios",
                        trailing = {
                            com.jcsoftdev.ui.atoms
                                .Switch(false, { toggled++ }, contentDescription = "notificar")
                        },
                    )
                }
            }
            onNode(hasText("Notificaciones")).assertTextEquals("Notificaciones", "Recordatorios")
            onNodeWithContentDescription("notificar").performClick()
            assertEquals(1, toggled)
        }

    @Test
    fun clickableCardIsAButton() =
        runComposeUiTest {
            var taps = 0
            setContent {
                Host {
                    Card(
                        Modifier.testTag("card"),
                        onClick = { taps++ },
                        header = { Text("Pedido") },
                        footer = { Text("Hoy") },
                    ) { Text("Corte") }
                    Card(Modifier.testTag("plain")) { Text("Solo lectura") }
                }
            }
            onNodeWithTag("card")
                .assert(SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Button))
                .assertTextEquals("Pedido", "Corte", "Hoy")
                .performClick()
            assertEquals(1, taps)
            onNodeWithTag("plain").assert(hasClickAction().not())
        }

    @Test
    fun pageHeaderBackAndActions() =
        runComposeUiTest {
            var back = 0
            setContent {
                Host { PageHeader("Agenda", onBack = { back++ }, backLabel = "Atrás", actions = { Text("Nueva") }) }
            }
            onNodeWithContentDescription("Atrás").performClick()
            assertEquals(1, back)
            onNodeWithText("Nueva").assertExists()
        }

    @Test
    fun skeletonStaysStaticWithReducedMotion() =
        runComposeUiTest {
            mainClock.autoAdvance = false
            setContent { Host(Motion(0f)) { Skeleton(Modifier.testTag("sk").width(200.dp)) } }
            val first =
                onNodeWithTag("sk")
                    .captureToImage()
                    .toPixelMap()
                    .buffer
                    .copyOf()
            mainClock.advanceTimeBy(700)
            val second =
                onNodeWithTag("sk")
                    .captureToImage()
                    .toPixelMap()
                    .buffer
                    .copyOf()
            assertContentEquals(first, second)
        }

    @Test
    fun skeletonShimmersWithMotion() =
        runComposeUiTest {
            mainClock.autoAdvance = false
            setContent { Host(Motion(1f)) { Skeleton(Modifier.testTag("sk").width(200.dp)) } }
            mainClock.advanceTimeBy(300)
            val first =
                onNodeWithTag("sk")
                    .captureToImage()
                    .toPixelMap()
                    .buffer
                    .copyOf()
            mainClock.advanceTimeBy(500)
            val second =
                onNodeWithTag("sk")
                    .captureToImage()
                    .toPixelMap()
                    .buffer
                    .copyOf()
            assertFalse(first.contentEquals(second))
        }

    @Test
    fun defaultsOverrideChangesSizeAndColor() =
        runComposeUiTest {
            val red = Color(0xFFD32F2F)
            setContent {
                Host {
                    ListRow("Normal", Modifier.testTag("normal"), onClick = {})
                    ListRow("Alto", Modifier.testTag("tall"), onClick = {}, minHeight = 80.dp)
                    Banner("Rojo", Modifier.testTag("banner"), colors = BannerDefaults.colors(BannerTone.Info).copy(container = red))
                    Banner("Tema", Modifier.testTag("themed"))
                }
            }
            onNodeWithTag("normal").assertHeightIsEqualTo(48.dp)
            onNodeWithTag("tall").assertHeightIsEqualTo(80.dp)

            fun fill(tag: String): Color {
                val map = onNodeWithTag(tag).captureToImage().toPixelMap()
                return map[6, map.height / 2]
            }
            assertEquals(red, fill("banner"))
            assertEquals(UiColors.Light.infoSoft, fill("themed"))
        }

    @Test
    fun themeTouchTargetFlowsIntoRows() =
        runComposeUiTest {
            setContent {
                Host(sizes = ThemeSizes.Default.copy(minTouchTarget = 64.dp)) { ListRow("Fila", Modifier.testTag("row")) }
            }
            onNodeWithTag("row").assertHeightIsEqualTo(64.dp)
            assertTrue(true)
        }
}
