package com.jcsoftdev.ui.auth

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.ZeroCornerSize
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.movableContentOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.util.lerp
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.theme.UiTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/**
 * Colors of [AuthScaffold]: the [header] band and the [onHeader] text and art on it, the [sheet] surface, the [tagline] text
 * on the header, the [onSheet] and [sheetTagline] text of the welcome panel, and the [highlight] swash under the welcome title.
 */
@Immutable
public class AuthScaffoldColors(
    public val header: Color,
    public val onHeader: Color,
    public val sheet: Color,
    public val tagline: Color,
    public val onSheet: Color,
    public val sheetTagline: Color,
    public val highlight: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        header: Color = this.header,
        onHeader: Color = this.onHeader,
        sheet: Color = this.sheet,
        tagline: Color = this.tagline,
        onSheet: Color = this.onSheet,
        sheetTagline: Color = this.sheetTagline,
        highlight: Color = this.highlight,
    ): AuthScaffoldColors = AuthScaffoldColors(header, onHeader, sheet, tagline, onSheet, sheetTagline, highlight)
}

/** How the header meets the sheet. */
public enum class AuthHeaderShape {
    /** Flat header band; the sheet with rounded top corners rises over it. */
    Overlap,

    /** The header's lower edge is cut by one large concave curve; the sheet is flat and its content starts under the curve. */
    Arc,
}

/** Default colors, shapes, metrics and text styles of [AuthScaffold]; read the theme, so any accent and dark mode flow through. */
public object AuthScaffoldDefaults {
    /**
     * The header is near black with a faint tint of the accent (a little lighter in a dark theme, so it stands apart from the
     * sheet); text and art on it use `surface` or `ink`, whichever contrasts more, at 4.5:1 or more. The welcome panel is the
     * sheet with `ink` and `ink2` text; the swash under the welcome title is the accent, softened toward the sheet until the
     * title keeps 4.5:1 over it.
     */
    @Composable
    @ReadOnlyComposable
    public fun colors(): AuthScaffoldColors {
        val c = UiTheme.colors
        val header = authHeaderColor(c)
        val onHeader = authOnColor(header, c)
        return AuthScaffoldColors(header, onHeader, c.surface, lerp(onHeader, header, 0.25f), c.ink, c.ink2, authHighlightColor(c))
    }

    /** The sheet: the theme `sheet` shape with square bottom corners. */
    public val sheetShape: Shape
        @Composable @ReadOnlyComposable
        get() = UiTheme.shapes.sheet.copy(bottomStart = ZeroCornerSize, bottomEnd = ZeroCornerSize)

    /** How far the sheet rises over the header band. */
    public val overlap: Dp = 24.dp

    /** Depth of the [AuthHeaderShape.Arc] curve at its middle. */
    public val arcDepth: Dp = 40.dp

    /** Horizontal padding of the header text and the sheet content. */
    public val horizontalPadding: Dp = 24.dp

    /** Title style; the theme `mTitle`. */
    public val titleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.mTitle

    /** Tagline style; the theme `mBody`. */
    public val taglineStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.mBody

    /**
     * Welcome title style: the theme `mTitle` at poster size, tight lines, set on the welcome panel over a highlight swash. The
     * scaffold lets it grow with the system font scale only up to 1.3x, since display text this large is already readable and
     * would otherwise break mid-word.
     */
    public val welcomeTitleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.mTitle.copy(fontSize = 48.sp, lineHeight = 50.sp, letterSpacing = (-0.035).em)

    /** The built-in header art: [AuthArcs] filling the header. */
    public val Art: @Composable (state: AuthState, progress: Float) -> Unit = { state, progress ->
        AuthArcs(state, progress, Modifier.fillMaxSize())
    }
}

/**
 * Screen frame of the sign-in family: a dark header band with [title], [tagline] and animated [art], and a surface sheet with
 * large rounded top corners rising [overlap] over it. [content] scrolls inside the sheet; [bottom] follows the content and
 * sticks to the sheet's foot, above the system bar and the keyboard, once the content needs the room. It fills the space it is
 * given (give it the whole screen), and draws edge to edge: the header pads itself by the status bar and cutout, the bottom
 * slot by the bottom and keyboard insets.
 *
 * [headerShape] `Arc` replaces the overlap with a concave curve of [arcDepth] cut into the header edge; [shape] and [overlap]
 * then do not apply. A photo header: pass an `art` that draws an `Image` with `ContentScale.Crop` filling the header; the
 * header clips it with the same shape.
 *
 * Welcome mode: with [expanded] the header grows over most of the screen with its art, and the sheet becomes a panel at the
 * foot holding [welcomeTitle] at poster size over a highlight swash, [welcomeTagline] and the [welcomeAction] slot (typically
 * a "Get started" pill whose click sets [expanded] to false). Toggling [expanded] plays one shared transition: the panel rises
 * into the sign-in sheet while the welcome text hands over to the form, and the header and its art shrink to the band. With
 * motion off it cuts. Only the visible mode is in the accessibility tree and takes input. [onBackToWelcome], when given,
 * answers the system back while the sign-in form shows (at `BackPriority.TAB`), so the host can set [expanded] again; nothing
 * navigates by itself.
 *
 * [state] and [progress] (see [AuthProgress]) are handed to [art], which reacts to them; pass your own composable to change the
 * header look. `AuthState.Success` also sends a soft wave across the sheet from the bottom slot. The art is decorative and
 * hidden from accessibility; the titles are headings. Colors come from the theme through [AuthScaffoldDefaults.colors], so the
 * band follows the accent and dark mode.
 */
@Composable
public fun AuthScaffold(
    title: String,
    tagline: String,
    modifier: Modifier = Modifier,
    state: AuthState = AuthState.Idle,
    progress: Float = 0f,
    colors: AuthScaffoldColors = AuthScaffoldDefaults.colors(),
    headerShape: AuthHeaderShape = AuthHeaderShape.Overlap,
    shape: Shape = AuthScaffoldDefaults.sheetShape,
    overlap: Dp = AuthScaffoldDefaults.overlap,
    arcDepth: Dp = AuthScaffoldDefaults.arcDepth,
    titleStyle: TextStyle = AuthScaffoldDefaults.titleStyle,
    taglineStyle: TextStyle = AuthScaffoldDefaults.taglineStyle,
    art: @Composable (state: AuthState, progress: Float) -> Unit = AuthScaffoldDefaults.Art,
    expanded: Boolean = false,
    welcomeTitle: String = title,
    welcomeTagline: String = tagline,
    welcomeTitleStyle: TextStyle = AuthScaffoldDefaults.welcomeTitleStyle,
    welcomeAction: (@Composable ColumnScope.() -> Unit)? = null,
    onBackToWelcome: (() -> Unit)? = null,
    bottom: (@Composable ColumnScope.() -> Unit)? = null,
    errorKey: Int = 0,
    content: @Composable ColumnScope.() -> Unit,
) {
    val padding = AuthScaffoldDefaults.horizontalPadding
    val arc = headerShape == AuthHeaderShape.Arc
    val drop = if (arc) arcDepth else overlap
    val sheetShape: Shape = if (arc) RectangleShape else shape
    val motion = UiTheme.motion
    val welcome = animateFloatAsState(if (expanded) 1f else 0f, motion.tween(AuthMotion.WELCOME_MS), label = "welcome")
    val showWelcome by remember { derivedStateOf { welcome.value > 0f } }
    val zones = remember { AuthTextZones() }
    zones.welcomeFraction = welcome
    val focus = LocalFocusManager.current
    val formTitleFocus = remember { FocusRequester() }
    val welcomeTitleFocus = remember { FocusRequester() }
    var settled by remember { mutableStateOf(false) }
    LaunchedEffect(expanded) {
        if (expanded) focus.clearFocusSafely()
        if (!settled) {
            settled = true
            return@LaunchedEffect
        }
        if (expanded) snapshotFlow { showWelcome }.first { it }
        withFrameNanos { }
        runCatching { (if (expanded) welcomeTitleFocus else formTitleFocus).requestFocus() }
    }
    val density = LocalDensity.current
    val scaledText = density.fontScale > 1f
    val headerDensity = remember(density) { Density(density.density, min(density.fontScale, MAX_HEADER_FONT_SCALE)) }
    val ime = WindowInsets.ime
    if (onBackToWelcome != null) BackHandler(enabled = !expanded, priority = BackPriority.TAB, onBack = onBackToWelcome)
    val rise = with(LocalDensity.current) { 36.dp.toPx() }
    val minArt = with(LocalDensity.current) { MIN_WELCOME_ART.roundToPx() }
    Layout(
        modifier = modifier.fillMaxSize().background(colors.sheet).onPlaced { zones.root = it },
        content = {
            Box(
                Modifier
                    .graphicsLayer {
                        clip = true
                        this.shape = if (arc) ArcEdgeShape(arcDepth) else RectangleShape
                    }.background(colors.header)
                    .clearAndSetSemantics {},
            ) {
                CompositionLocalProvider(
                    LocalContentColor provides colors.onHeader,
                    LocalAuthTextZones provides zones,
                    LocalAuthErrorKey provides errorKey,
                ) {
                    Box(Modifier.fillMaxSize()) { art(state, progress) }
                }
            }
            Column(
                Modifier
                    .graphicsLayer {
                        val f = welcome.value
                        alpha = 1f - AuthMotion.segment(f, 0f, 0.4f)
                        translationY = f * rise
                    }.then(if (expanded) Modifier.clearAndSetSemantics {} else Modifier)
                    .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Top))
                    .padding(start = padding, end = padding, top = padding, bottom = drop + padding),
            ) {
                CompositionLocalProvider(LocalDensity provides headerDensity) {
                    Column(
                        Modifier.onGloballyPositioned { zones.login = zones.boundsOf(it) },
                        verticalArrangement = Arrangement.spacedBy(UiTheme.sizes.space8),
                    ) {
                        Text(
                            title,
                            Modifier.focusRequester(formTitleFocus).focusable().semantics { heading() },
                            titleStyle,
                            colors.onHeader,
                        )
                        Text(tagline, style = taglineStyle, color = colors.tagline)
                    }
                }
            }
            AuthSheet(sheetShape, colors, arc, drop, expanded, welcome, state == AuthState.Success, bottom, content)
            if (showWelcome) {
                WelcomeContent(
                    welcomeTitle,
                    welcomeTagline,
                    welcomeTitleStyle,
                    taglineStyle,
                    colors,
                    welcome,
                    rise,
                    zones,
                    expanded,
                    if (arc) drop else 0.dp,
                    welcomeTitleFocus,
                    welcomeAction,
                )
            } else {
                Box {}
            }
        },
    ) { measurables, constraints ->
        val width = constraints.maxWidth
        val height = constraints.maxHeight
        val f = welcome.value
        val imeShare = (ime.getBottom(this) / (height * IME_SHARE_SPAN)).coerceIn(0f, 1f)
        val bandCap = if (scaledText) (height * lerp(BAND_SHARE, BAND_SHARE_IME, imeShare)).roundToInt() else height
        val text = measurables[1].measure(Constraints(minWidth = width, maxWidth = width, maxHeight = bandCap.coerceIn(0, height)))
        val minBand = (height * MIN_BAND_SHARE * (1f - imeShare)).roundToInt()
        val band = maxOf(text.height, minBand).coerceAtMost(maxOf(text.height, bandCap))
        val panel = measurables[3].measure(Constraints(maxWidth = width, maxHeight = (height - minArt).coerceAtLeast(0)))
        val dropPx = drop.roundToPx()
        val sheetTop = (band - dropPx).coerceAtLeast(0)
        val panelTop = if (panel.height > 0) height - panel.height else height
        val sheetY = lerp(sheetTop.toFloat(), panelTop.toFloat(), f).roundToInt()
        val headerHeight = (sheetY + dropPx).coerceIn(0, height)
        val header = measurables[0].measure(Constraints.fixed(width, headerHeight))
        val sheet = measurables[2].measure(Constraints.fixed(width, (height - sheetTop).coerceAtLeast(0)))
        layout(width, height) {
            if (arc) sheet.place(0, sheetY)
            header.place(0, 0)
            text.place(0, 0)
            if (!arc) sheet.place(0, sheetY)
            panel.place(0, sheetY)
        }
    }
}

@Composable
private fun AuthSheet(
    shape: Shape,
    colors: AuthScaffoldColors,
    arc: Boolean,
    drop: Dp,
    hidden: Boolean,
    welcome: State<Float>,
    success: Boolean,
    bottom: (@Composable ColumnScope.() -> Unit)?,
    content: @Composable ColumnScope.() -> Unit,
) {
    val padding = AuthScaffoldDefaults.horizontalPadding
    val insets = WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom)
    val latestContent by rememberUpdatedState(content)
    val latestBottom by rememberUpdatedState(bottom)
    val movableContent = remember { movableContentOf { scope: ColumnScope -> latestContent.invoke(scope) } }
    val movableBottom = remember { movableContentOf { scope: ColumnScope -> latestBottom?.invoke(scope) } }
    val scroll = rememberScrollState()
    val scaled = LocalDensity.current.fontScale > 1f
    val wave = rememberSuccessWave(success)
    val waveColors = UiTheme.colors.let { lerp(it.accentSoft, it.accent, 0.35f) to it.accent }
    val origin = remember { SheetAnchor() }
    val edge = !arc && authNeedsSheetEdge(colors.header, colors.sheet)
    val reveal = Modifier.graphicsLayer { alpha = 1f - AuthMotion.segment(welcome.value, 0f, 0.45f) }
    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .graphicsLayer {
                clip = true
                this.shape = shape
            }.background(colors.sheet)
            .then(if (edge) Modifier.border(UiTheme.sizes.borderWidth, UiTheme.colors.lineStrong, shape) else Modifier)
            .onPlaced { origin.sheet = it }
            .drawBehind { drawSuccessWave(wave.value, origin.center(size), waveColors.first, waveColors.second) }
            .then(if (hidden) Modifier.clearAndSetSemantics {} else Modifier.semantics { isTraversalGroup = true }),
    ) {
        val visible = maxHeight - with(LocalDensity.current) { WindowInsets.safeDrawing.getBottom(this).toDp() }
        val compact = bottom != null && scaled && visible < COMPACT_SHEET_HEIGHT
        val top = (if (arc) drop else 0.dp) + padding + UiTheme.sizes.space8
        val footer =
            Modifier.fillMaxWidth().padding(
                start = padding,
                end = padding,
                top = UiTheme.sizes.space8,
                bottom = UiTheme.sizes.space16,
            )
        val anchor = Modifier.onGloballyPositioned { origin.footer = it }
        Column(Modifier.fillMaxSize()) {
            Column(
                Modifier
                    .weight(1f, fill = false)
                    .fillMaxWidth()
                    .then(reveal)
                    .verticalScroll(scroll)
                    .windowInsetsPadding(if (bottom == null || compact) insets else insets.only(WindowInsetsSides.Horizontal))
                    .padding(
                        start = padding,
                        end = padding,
                        top = top,
                        bottom =
                            if (compact) {
                                0.dp
                            } else if (bottom != null) {
                                UiTheme.sizes.space16
                            } else {
                                padding
                            },
                    ),
            ) {
                movableContent(this)
                if (compact) Column(anchor.padding(top = padding, bottom = UiTheme.sizes.space16)) { movableBottom(this) }
            }
            if (bottom != null && !compact) {
                Column(
                    Modifier
                        .then(reveal)
                        .windowInsetsPadding(insets)
                        .then(footer)
                        .then(anchor),
                ) { movableBottom(this) }
            }
        }
        if (hidden) Box(Modifier.matchParentSize().pointerInput(Unit) { swallowTouches() })
    }
}

/** Where the success wave starts: the middle of the bottom slot, in the sheet's own coordinates. */
private class SheetAnchor {
    var sheet: LayoutCoordinates? = null
    var footer: LayoutCoordinates? = null

    fun center(size: Size): Offset {
        val s = sheet?.takeIf { it.isAttached }
        val f = footer?.takeIf { it.isAttached }
        if (s == null || f == null) return Offset(size.width / 2f, size.height)
        return s.localBoundingBoxOf(f, clipBounds = false).center
    }
}

/** 0..1 progress of the wave that crosses the sheet when the sign-in succeeds; it rests at 1 (gone) and stays there with motion off. */
@Composable
private fun rememberSuccessWave(success: Boolean): State<Float> {
    val wave = remember { Animatable(1f) }
    val motion = UiTheme.motion
    LaunchedEffect(success, motion) {
        if (!success || !motion.enabled) {
            wave.snapTo(1f)
            return@LaunchedEffect
        }
        wave.snapTo(0f)
        wave.animateTo(1f, tween((AuthMotion.WAVE_MS * motion.scale).roundToInt(), easing = LinearEasing))
    }
    return wave.asState()
}

/** A soft disc in [fill] spreading from [center] with a thin [ring] at its front; both fade as it reaches the sheet's corners. */
private fun DrawScope.drawSuccessWave(
    t: Float,
    center: Offset,
    fill: Color,
    ring: Color,
) {
    if (t <= 0f || t >= 1f) return
    val reach = maxOf(hypot(center.x, center.y), hypot(size.width - center.x, center.y))
    val radius = reach * AuthMotion.waveRadius(t)
    val fade = AuthMotion.waveAlpha(t)
    drawCircle(fill, radius, center, alpha = fade)
    drawCircle(ring, radius, center, alpha = fade * 0.7f, style = Stroke(2.dp.toPx()))
}

/** Takes every touch, so a sheet that waits under the welcome panel cannot be typed into. */
private suspend fun PointerInputScope.swallowTouches() {
    awaitPointerEventScope {
        while (true) awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() }
    }
}

/**
 * The welcome panel's text: poster title over its highlight swash, tagline and action. It sits at the foot of the screen on
 * the sheet (the panel); when the text is too tall it scrolls above the action, which stays in view, and fades and rises away as [fraction] leaves 1. [topInset] makes
 * room for the curve of an arc header.
 */
@Composable
private fun WelcomeContent(
    title: String,
    tagline: String,
    titleStyle: TextStyle,
    taglineStyle: TextStyle,
    colors: AuthScaffoldColors,
    fraction: State<Float>,
    rise: Float,
    zones: AuthTextZones,
    expanded: Boolean,
    topInset: Dp,
    titleFocus: FocusRequester,
    action: (@Composable ColumnScope.() -> Unit)?,
) {
    val padding = AuthScaffoldDefaults.horizontalPadding
    val density = LocalDensity.current
    val cap = min(density.fontScale, MAX_WELCOME_FONT_SCALE) / density.fontScale
    val poster =
        UiTheme.text(titleStyle).let { remember(it, cap, colors.onSheet) { it.scaled(cap).copy(color = colors.onSheet) } }
    val swash = rememberSwashInk()
    var lines by remember { mutableStateOf<TextLayoutResult?>(null) }
    Column(
        Modifier
            .fillMaxWidth()
            .then(if (expanded) Modifier else Modifier.clearAndSetSemantics {})
            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom))
            .padding(start = padding, end = padding, top = padding + topInset + UiTheme.sizes.space4, bottom = padding),
    ) {
        Column(
            Modifier
                .weight(1f, fill = false)
                .verticalScroll(rememberScrollState())
                .graphicsLayer {
                    val s = AuthMotion.segment(fraction.value, 0.35f, 1f)
                    alpha = s
                    translationY = -(1f - s) * rise
                }.onGloballyPositioned { zones.welcome = zones.boundsOf(it) },
        ) {
            BasicText(
                title,
                Modifier
                    .focusRequester(titleFocus)
                    .focusable()
                    .semantics { heading() }
                    .drawBehind {
                        val drawn = swash.value * AuthMotion.segment(fraction.value, 0.5f, 1f)
                        lines?.let { drawSwash(it, drawn, colors.highlight) }
                    },
                poster,
                onTextLayout = { lines = it },
            )
            Spacer(Modifier.height(UiTheme.sizes.space12))
            Text(tagline, style = taglineStyle, color = colors.sheetTagline)
        }
        if (action != null) {
            Spacer(Modifier.height(UiTheme.sizes.space28))
            Column(
                Modifier.fillMaxWidth().graphicsLayer {
                    val s = AuthMotion.segment(fraction.value, 0.55f, 1f)
                    alpha = s
                    translationY = (1f - s) * rise
                },
                content = action,
            )
        }
    }
}

/** How much of the swash is drawn, 0..1: it sweeps in once, shortly after the welcome first shows; at once with motion off. */
@Composable
private fun rememberSwashInk(): State<Float> {
    val motion = UiTheme.motion
    val ink = remember { Animatable(if (motion.enabled) 0f else 1f) }
    LaunchedEffect(motion) {
        if (!motion.enabled) {
            ink.snapTo(1f)
            return@LaunchedEffect
        }
        delay((AuthMotion.SWASH_DELAY_MS * motion.scale).roundToLong())
        ink.animateTo(1f, tween((AuthMotion.SWASH_MS * motion.scale).roundToInt(), easing = FastOutSlowInEasing))
    }
    return ink.asState()
}

/**
 * A marker stroke under the last line of the title, from its first to its last glyph with a small upward flick at the end,
 * covering the lower part of the letters. [drawn] is the share of its length drawn so far.
 */
private fun DrawScope.drawSwash(
    text: TextLayoutResult,
    drawn: Float,
    color: Color,
) {
    if (drawn <= 0f || text.lineCount == 0) return
    val line = text.lineCount - 1
    val left = text.getLineLeft(line)
    val right = text.getLineRight(line)
    val em =
        text.layoutInput.style.fontSize
            .toPx()
    val y = text.getLineBaseline(line) - em * 0.04f
    val start = if (text.layoutInput.layoutDirection == LayoutDirection.Rtl) right + em * 0.08f else left - em * 0.06f
    val end = if (text.layoutInput.layoutDirection == LayoutDirection.Rtl) left - em * 0.1f else right + em * 0.1f
    val path =
        Path().apply {
            moveTo(start, y + em * 0.05f)
            quadraticTo((start + end) / 2f, y + em * 0.11f, end, y - em * 0.06f)
        }
    val measure = PathMeasure().apply { setPath(path, false) }
    val part = Path()
    measure.getSegment(0f, measure.length * drawn.coerceIn(0f, 1f), part, true)
    drawPath(part, color, style = Stroke(em * 0.3f, cap = StrokeCap.Round))
}

private fun TextStyle.scaled(cap: Float): TextStyle = copy(fontSize = fontSize * cap, lineHeight = lineHeight * cap)

private const val MAX_WELCOME_FONT_SCALE = 1.3f

/** The welcome panel never covers more of the screen than leaves this much header for the art above it. */
private val MIN_WELCOME_ART = 180.dp

/** The header title and tagline stop growing with the system font scale here; the sheet keeps its room. */
private const val MAX_HEADER_FONT_SCALE = 1.3f

/** From a font scale above 1 the header band takes at most this share of the screen, and [BAND_SHARE_IME] while the keyboard is up. */
private const val BAND_SHARE = 0.4f
private const val BAND_SHARE_IME = 0.3f

/**
 * The header band takes at least this share of the screen while the keyboard is down, so on a tall phone the art gets the
 * room and the sheet rises only as far as the form needs; it gives the room back as the keyboard comes up.
 */
private const val MIN_BAND_SHARE = 0.34f

/** The keyboard counts as fully up for the band once it covers this share of the screen. */
private const val IME_SHARE_SPAN = 0.25f

/** Below this visible sheet height, with a font scale above 1, the pinned slot scrolls with the content instead. */
private val COMPACT_SHEET_HEIGHT = 480.dp

private fun FocusManager.clearFocusSafely() = clearFocus(force = true)

/** Bounds of a header text block in the scaffold's coordinates, which are the art's: both start at the scaffold's top left. */
private fun AuthTextZones.boundsOf(block: LayoutCoordinates): Rect =
    root?.takeIf { it.isAttached }?.localBoundingBoxOf(block, clipBounds = false) ?: Rect.Zero

private class ArcEdgeShape(
    private val depth: Dp,
) : Shape {
    override fun createOutline(
        size: Size,
        layoutDirection: LayoutDirection,
        density: Density,
    ): Outline {
        val d = with(density) { depth.toPx() }.coerceIn(0f, size.height)
        return Outline.Generic(
            Path().apply {
                moveTo(0f, 0f)
                lineTo(size.width, 0f)
                lineTo(size.width, size.height)
                quadraticTo(size.width / 2f, size.height - 2f * d, 0f, size.height)
                close()
            },
        )
    }
}
