package com.jcsoftdev.ui.sample

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.glass.GlassEffectContainer
import com.jcsoftdev.ui.glass.GlassState
import com.jcsoftdev.ui.glass.LiquidGlassStyle
import com.jcsoftdev.ui.glass.LiquidInteraction
import com.jcsoftdev.ui.glass.LiquidProfile
import com.jcsoftdev.ui.glass.MaterialSurface
import com.jcsoftdev.ui.glass.SurfaceMaterial
import com.jcsoftdev.ui.glass.glassEffect
import com.jcsoftdev.ui.glass.glassSource
import com.jcsoftdev.ui.glass.rememberGlassState
import com.jcsoftdev.ui.navigation.TabItem
import com.jcsoftdev.ui.navigation.Tabs
import com.jcsoftdev.ui.theme.UiStyle
import com.jcsoftdev.ui.theme.UiTheme
import kotlinx.coroutines.delay
import java.util.Locale

/** What sits behind the glass: a photo (with its credit) or the scene drawn in code. */
enum class Backdrop(
    val label: String,
    val photo: Int?,
    val credit: String,
) {
    Rio("Rio", R.drawable.photo_rio, "\"Rio de Janeiro skyline and Sugarloaf Mountain at sunset\" by Wilfredor, CC0 1.0"),
    Mountains("Mountains", R.drawable.photo_mountains, "\"Sunset in the mountains\" by Sergey Pesterev (sickle), CC0 1.0"),
    Quebec("Quebec", R.drawable.photo_quebec, "\"Chateau Frontenac illuminated at night in Quebec City\" by Wilfredor, CC0 1.0"),
    Scene("Scene", null, "Drawn in code: gradient, stripes and a fine grid."),
}

private val WideBreakpoint = 720.dp

/**
 * A playground for [LiquidGlassStyle]: a glass panel you can drag anywhere over a photo, a control for every field of the
 * style, presets, a "copy code" snippet and a second tab with [GlassEffectContainer] pills that merge when dragged together.
 * The controls sit in a bottom panel on a phone and in a side panel on a wide window.
 */
@Composable
fun GlassPlayground(
    dark: Boolean = false,
    initialTab: String = "style",
    initialBackdrop: Backdrop = Backdrop.Rio,
) {
    UiTheme(dark = dark, style = UiStyle.Glass) {
        var tab by remember { mutableStateOf(initialTab) }
        var backdrop by remember { mutableStateOf(initialBackdrop) }
        var params by remember { mutableStateOf(PlaygroundParams.Initial) }
        var controlsOpen by remember { mutableStateOf(true) }
        BoxWithConstraints(Modifier.fillMaxSize().background(UiTheme.colors.bg).systemBarsPadding()) {
            val wide = maxWidth >= WideBreakpoint
            val panelHeight = maxHeight * 0.46f
            val stage: @Composable (Modifier) -> Unit = { modifier ->
                Column(modifier) {
                    Tabs(
                        listOf(TabItem("style", "Glass panel"), TabItem("merge", "Merge")),
                        tab,
                        { tab = it },
                        Modifier.fillMaxWidth(),
                    )
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        when (tab) {
                            "merge" -> MergeStage(backdrop, params)
                            else -> PanelStage(backdrop, params)
                        }
                    }
                }
            }
            val controls: @Composable (Modifier) -> Unit = { modifier ->
                ControlPanel(
                    params = params,
                    onParams = { params = it },
                    backdrop = backdrop,
                    onBackdrop = { backdrop = it },
                    open = controlsOpen,
                    onOpen = { controlsOpen = it },
                    collapsible = !wide,
                    modifier = modifier,
                )
            }
            if (wide) {
                Row(Modifier.fillMaxSize()) {
                    stage(Modifier.weight(1f).fillMaxHeight())
                    controls(Modifier.width(380.dp).fillMaxHeight())
                }
            } else {
                Column(Modifier.fillMaxSize()) {
                    stage(Modifier.weight(1f).fillMaxWidth())
                    controls(if (controlsOpen) Modifier.fillMaxWidth().height(panelHeight) else Modifier.fillMaxWidth())
                }
            }
        }
    }
}

/** The backdrop and its credit, with the glass state that glass on top of it samples. */
@Composable
private fun Stage(
    backdrop: Backdrop,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.(GlassState) -> Unit,
) {
    val glass = rememberGlassState()
    Box(modifier.clipToBounds()) {
        val photo = backdrop.photo
        if (photo != null) {
            Image(
                painterResource(photo),
                contentDescription = null,
                modifier = Modifier.fillMaxSize().glassSource(glass),
                contentScale = ContentScale.Crop,
            )
        } else {
            SceneBackdrop(Modifier.fillMaxSize().glassSource(glass))
        }
        content(glass)
        Text(
            if (photo != null) "Photo: ${backdrop.credit}" else backdrop.credit,
            Modifier
                .align(Alignment.BottomStart)
                .padding(8.dp)
                .background(Color.Black.copy(alpha = 0.55f), RoundedCornerShape(8.dp))
                .padding(horizontal = 8.dp, vertical = 3.dp),
            style = UiTheme.typography.meta.copy(fontSize = 10.sp),
            color = Color.White,
            maxLines = 2,
        )
    }
}

/** The gradient scene: a warm gradient with dark stripes and a white grid, so every bend of the lens shows. */
@Composable
private fun SceneBackdrop(modifier: Modifier) {
    Canvas(modifier) {
        drawRect(Brush.verticalGradient(listOf(Color(0xFFFFE29F), Color(0xFFFF719A), Color(0xFF6A4FD9))))
        var x = 0f
        while (x < size.width) {
            drawRect(Color.Black.copy(alpha = 0.8f), Offset(x, 0f), Size(18f, size.height))
            x += 54f
        }
        var y = 0f
        while (y < size.height) {
            drawLine(Color.White.copy(alpha = 0.8f), Offset(0f, y), Offset(size.width, y), 3f)
            y += 36f
        }
    }
}

private fun Offset.clampTo(
    area: IntSize,
    item: Size,
): Offset =
    Offset(
        x.coerceIn(0f, (area.width - item.width).coerceAtLeast(0f)),
        y.coerceIn(0f, (area.height - item.height).coerceAtLeast(0f)),
    )

/** Gives a draggable glass shape a name for screen readers and keyboard-free ways to move it. */
private fun Modifier.movable(
    name: String,
    nudge: (Offset) -> Unit,
): Modifier =
    semantics {
        contentDescription = name
        customActions =
            listOf(
                CustomAccessibilityAction("Move up") {
                    nudge(Offset(0f, -NUDGE))
                    true
                },
                CustomAccessibilityAction("Move down") {
                    nudge(Offset(0f, NUDGE))
                    true
                },
                CustomAccessibilityAction("Move left") {
                    nudge(Offset(-NUDGE, 0f))
                    true
                },
                CustomAccessibilityAction("Move right") {
                    nudge(Offset(NUDGE, 0f))
                    true
                },
            )
    }

private const val NUDGE = 48f

/** One glass panel, free to move anywhere over the backdrop; it squashes and settles while dragged (with the Drag interaction). */
@Composable
private fun PanelStage(
    backdrop: Backdrop,
    params: PlaygroundParams,
) {
    val panel = with(LocalDensity.current) { Size(250.dp.toPx(), 112.dp.toPx()) }
    var area by remember { mutableStateOf(IntSize.Zero) }
    var pos by remember { mutableStateOf<Offset?>(null) }
    LaunchedEffect(area) {
        if (area != IntSize.Zero) {
            pos = (pos ?: Offset((area.width - panel.width) / 2, (area.height - panel.height) / 2)).clampTo(area, panel)
        }
    }
    Stage(backdrop, Modifier.fillMaxSize().onSizeChanged { area = it }) { glass ->
        val at = pos
        if (at != null) {
            MaterialSurface(
                SurfaceMaterial.Liquid,
                RoundedCornerShape(40.dp),
                Modifier
                    .offset { IntOffset(at.x.toInt(), at.y.toInt()) }
                    .size(250.dp, 112.dp)
                    .movable("Glass panel, draggable") { pos = (at + it).clampTo(area, panel) }
                    .pointerInput(area) {
                        detectDragGestures { change, amount ->
                            change.consume()
                            pos = ((pos ?: at) + amount).clampTo(area, panel)
                        }
                    },
                glass = glass,
                style = params.toStyle(),
            ) {
                Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
                    val soft = Shadow(Color.Black.copy(alpha = 0.5f), Offset(0f, 2f), 10f)
                    Text(
                        "Liquid Glass",
                        style = UiTheme.typography.dialogTitle.copy(fontWeight = FontWeight.ExtraBold, shadow = soft),
                        color = Color.White,
                    )
                    Text(
                        "Drag me anywhere",
                        style = UiTheme.typography.meta.copy(fontWeight = FontWeight.Bold, shadow = soft),
                        color = Color.White,
                    )
                }
            }
        }
    }
}

private class Pill(
    val name: String,
    val size: androidx.compose.ui.unit.DpSize,
    val corner: Int,
)

private val Pills =
    listOf(
        Pill(
            "Glass pill 1",
            androidx.compose.ui.unit
                .DpSize(92.dp, 92.dp),
            50,
        ),
        Pill(
            "Glass pill 2",
            androidx.compose.ui.unit
                .DpSize(150.dp, 68.dp),
            50,
        ),
        Pill(
            "Glass pill 3",
            androidx.compose.ui.unit
                .DpSize(76.dp, 76.dp),
            50,
        ),
    )

/** Three glass shapes in a [GlassEffectContainer]: drag them together and they flow into one piece of glass. */
@Composable
private fun MergeStage(
    backdrop: Backdrop,
    params: PlaygroundParams,
) {
    val density = LocalDensity.current
    val sizes = remember { Pills.map { with(density) { Size(it.size.width.toPx(), it.size.height.toPx()) } } }
    var area by remember { mutableStateOf(IntSize.Zero) }
    var positions by remember { mutableStateOf<List<Offset>?>(null) }
    LaunchedEffect(area) {
        if (area != IntSize.Zero) {
            positions =
                positions?.mapIndexed { i, p -> p.clampTo(area, sizes[i]) } ?: listOf(
                    Offset(area.width * 0.18f, area.height * 0.3f),
                    Offset(area.width * 0.4f, area.height * 0.3f),
                    Offset(area.width * 0.3f, area.height * 0.62f),
                )
        }
    }
    Stage(backdrop, Modifier.fillMaxSize().onSizeChanged { area = it }) { glass ->
        val current = positions
        if (current != null) {
            GlassEffectContainer(Modifier.fillMaxSize(), style = params.toStyle(), glass = glass) {
                Pills.forEachIndexed { i, pill ->
                    fun move(by: Offset) {
                        positions = positions?.mapIndexed { j, p -> if (j == i) (p + by).clampTo(area, sizes[i]) else p }
                    }
                    Box(
                        Modifier
                            .offset { IntOffset(current[i].x.toInt(), current[i].y.toInt()) }
                            .size(pill.size)
                            .glassEffect(RoundedCornerShape(pill.corner))
                            .movable("${pill.name}, draggable, merges with the others when close") { move(it) }
                            .pointerInput(area) {
                                detectDragGestures { change, amount ->
                                    change.consume()
                                    move(amount)
                                }
                            },
                    )
                }
            }
        }
    }
}

@Composable
private fun ControlPanel(
    params: PlaygroundParams,
    onParams: (PlaygroundParams) -> Unit,
    backdrop: Backdrop,
    onBackdrop: (Backdrop) -> Unit,
    open: Boolean,
    onOpen: (Boolean) -> Unit,
    collapsible: Boolean,
    modifier: Modifier = Modifier,
) {
    val colors = UiTheme.colors
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }
    LaunchedEffect(copied) {
        if (copied) {
            delay(2000)
            copied = false
        }
    }
    val snippet = params.toSnippet()
    Column(
        modifier
            .background(colors.surface, RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
            .padding(horizontal = 16.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Style controls", Modifier.weight(1f), style = UiTheme.typography.cardTitle)
            if (collapsible) {
                Button(if (open) "Hide" else "Show", { onOpen(!open) }, variant = ButtonVariant.Ghost, size = ButtonSize.Sm)
            }
        }
        if (open || !collapsible) {
            Column(Modifier.weight(1f, fill = true).verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
                ChoiceRow("Backdrop", Backdrop.entries.map { it.label to it }, backdrop, onBackdrop)
                Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for ((name, preset) in listOf(
                        "Crystal" to LiquidGlassStyle.Crystal,
                        "Clear" to LiquidGlassStyle.Clear,
                        "Regular" to LiquidGlassStyle.Regular,
                        "Thick" to LiquidGlassStyle.Thick,
                    )) {
                        val target = PlaygroundParams.from(preset).copy(interaction = params.interaction)
                        Button(
                            name,
                            { onParams(target) },
                            Modifier.weight(1f),
                            variant = if (params == target) ButtonVariant.Primary else ButtonVariant.Secondary,
                            size = ButtonSize.Sm,
                        )
                    }
                }
                Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Button("Reset", { onParams(PlaygroundParams.Initial) }, Modifier.weight(1f), size = ButtonSize.Sm)
                    Button(
                        if (copied) "Copied" else "Copy code",
                        {
                            clipboard.setText(AnnotatedString(snippet))
                            copied = true
                        },
                        Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite },
                        variant = ButtonVariant.Primary,
                        size = ButtonSize.Sm,
                    )
                }
                Text(
                    if (params.toStyle().preservesContrast) {
                        "Text contrast guarantee: kept."
                    } else {
                        "Text contrast guarantee: dropped by this style."
                    },
                    Modifier.padding(top = 8.dp),
                    style = UiTheme.typography.meta,
                    color = colors.ink2,
                )
                Controls(params, onParams)
                ControlSection("Code")
                Text(
                    snippet,
                    Modifier.fillMaxWidth().background(colors.sunken, RoundedCornerShape(12.dp)).padding(12.dp),
                    style = UiTheme.typography.data.copy(fontFamily = FontFamily.Monospace, fontSize = 12.sp),
                )
                ControlSection("Credits")
                for (b in Backdrop.entries.filter { it.photo != null }) {
                    Text(
                        "${b.credit}. Wikimedia Commons, CC0 1.0 Universal (public domain dedication).",
                        Modifier.padding(bottom = 6.dp),
                        style = UiTheme.typography.meta,
                        color = colors.ink2,
                    )
                }
            }
        }
    }
}

private fun fmt(
    v: Float,
    decimals: Int = 2,
): String = String.format(Locale.US, "%.${decimals}f", v)

@Composable
private fun Controls(
    p: PlaygroundParams,
    set: (PlaygroundParams) -> Unit,
) {
    ControlSection("Lens")
    LabSlider("Refraction", p.refraction, { set(p.copy(refraction = it)) }, 0f..3f, 0.05f, fmt(p.refraction))
    LabSlider("Bevel width", p.bevel, { set(p.copy(bevel = it)) }, 0f..60f, 1f, "${fmt(p.bevel, 0)} dp")
    ChoiceRow("Profile", LiquidProfile.entries.map { it.name to it }, p.profile) { set(p.copy(profile = it)) }
    LabSlider("Dispersion", p.dispersion, { set(p.copy(dispersion = it)) }, 0f..0.15f, 0.005f, fmt(p.dispersion, 3))

    ControlSection("Material")
    LabSlider(
        "Frost",
        p.frost ?: 14f,
        { set(p.copy(frost = it)) },
        0f..40f,
        1f,
        p.frost?.let { "${fmt(it, 0)} dp" } ?: "Auto",
        trailing = { AutoToggle("Frost follows the material", p.frost == null) { set(p.copy(frost = if (it) null else 14f)) } },
    )
    LabSlider(
        "Saturation",
        p.saturation ?: 1.2f,
        { set(p.copy(saturation = it)) },
        0f..2.5f,
        0.05f,
        p.saturation?.let { fmt(it) } ?: "Auto",
        trailing = {
            AutoToggle(
                "Saturation follows the material",
                p.saturation == null,
            ) { set(p.copy(saturation = if (it) null else 1.2f)) }
        },
    )
    LabSlider("Brightness", p.brightness, { set(p.copy(brightness = it)) }, -1f..1f, 0.05f, fmt(p.brightness))
    TintSwatches(p.tintColor) { set(p.copy(tintColor = it)) }
    LabSlider("Tint amount", p.tintAmount, { set(p.copy(tintAmount = it)) }, 0f..1f, 0.05f, fmt(p.tintAmount))
    LabSlider("Opacity", p.opacity, { set(p.copy(opacity = it)) }, 0f..1f, 0.05f, fmt(p.opacity))

    ControlSection("Light")
    LabSlider("Rim", p.rim, { set(p.copy(rim = it)) }, 0f..2f, 0.05f, fmt(p.rim))
    LabSlider("Specular intensity", p.specularIntensity, { set(p.copy(specularIntensity = it)) }, 0f..2f, 0.05f, fmt(p.specularIntensity))
    LabSlider("Specular angle", p.specularAngle, { set(p.copy(specularAngle = it)) }, -180f..180f, 5f, "${fmt(p.specularAngle, 0)}°")
    LabSlider("Fresnel", p.fresnel, { set(p.copy(fresnel = it)) }, 0f..1f, 0.05f, fmt(p.fresnel))
    LabSlider("Grain", p.grain, { set(p.copy(grain = it)) }, 0f..0.1f, 0.005f, fmt(p.grain, 3))

    ControlSection("Shadow")
    LabSlider("Shadow opacity", p.shadowOpacity, { set(p.copy(shadowOpacity = it)) }, 0f..2f, 0.05f, fmt(p.shadowOpacity))
    LabSlider("Shadow spread", p.shadowSpread, { set(p.copy(shadowSpread = it)) }, 0f..48f, 1f, "${fmt(p.shadowSpread, 0)} dp")
    LabSlider("Shadow offset Y", p.shadowOffsetY, { set(p.copy(shadowOffsetY = it)) }, 0f..32f, 1f, "${fmt(p.shadowOffsetY, 0)} dp")

    ControlSection("Motion and merge")
    ChoiceRow("Interaction", LiquidInteraction.entries.map { it.name to it }, p.interaction) { set(p.copy(interaction = it)) }
    ChoiceRow("Motion", MotionChoice.entries.map { it.label to it }, p.motion) { set(p.copy(motion = it)) }
    LabSlider("Blend (Merge tab)", p.blend, { set(p.copy(blend = it)) }, 0f..80f, 1f, "${fmt(p.blend, 0)} dp")
}
