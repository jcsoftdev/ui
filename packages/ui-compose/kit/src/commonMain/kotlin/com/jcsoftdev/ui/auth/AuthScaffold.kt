package com.jcsoftdev.ui.auth

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
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
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusManager
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
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
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Colors of [AuthScaffold]: the [header] band and the [onHeader] text and art on it, the [sheet] surface, the [tagline] text,
 * and the outlined [echo] behind the welcome title.
 */
@Immutable
public class AuthScaffoldColors(
    public val header: Color,
    public val onHeader: Color,
    public val sheet: Color,
    public val tagline: Color,
    public val echo: Color = tagline,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        header: Color = this.header,
        onHeader: Color = this.onHeader,
        sheet: Color = this.sheet,
        tagline: Color = this.tagline,
        echo: Color = this.echo,
    ): AuthScaffoldColors = AuthScaffoldColors(header, onHeader, sheet, tagline, echo)
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
     * The header is the accent pulled toward the darkest tone of the theme; text and art on it use `surface` or `ink`,
     * whichever contrasts more. The welcome title's echo leans toward the accent.
     */
    @Composable
    @ReadOnlyComposable
    public fun colors(): AuthScaffoldColors {
        val c = UiTheme.colors
        val header = authHeaderColor(c)
        val onHeader = authOnColor(header, c)
        return AuthScaffoldColors(header, onHeader, c.surface, lerp(onHeader, header, 0.25f), lerp(c.accent, onHeader, 0.3f))
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
     * Welcome title style: the theme `mTitle` at poster size, tight lines. The scaffold lets it grow with the system font scale
     * only up to 1.3x, since display text this large is already readable and would otherwise break mid-word.
     */
    public val welcomeTitleStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.mTitle.copy(fontSize = 56.sp, lineHeight = 56.sp, letterSpacing = (-0.035).em)

    /** The built-in header art: [AuthArcs] filling the header. */
    public val Art: @Composable (state: AuthState, progress: Float) -> Unit = { state, progress ->
        AuthArcs(state, progress, Modifier.fillMaxSize())
    }
}

/**
 * Screen frame of the sign-in family: a dark header band with [title], [tagline] and animated [art], and a surface sheet with
 * large rounded top corners rising [overlap] over it. [content] scrolls inside the sheet; [bottom] stays pinned at the sheet's
 * foot, above the system bar and the keyboard. It fills the space it is given (give it the whole screen), and draws edge to
 * edge: the header pads itself by the status bar and cutout, the pinned slot by the bottom and keyboard insets.
 *
 * [headerShape] `Arc` replaces the overlap with a concave curve of [arcDepth] cut into the header edge; [shape] and [overlap]
 * then do not apply. A photo header: pass an `art` that draws an `Image` with `ContentScale.Crop` filling the header; the
 * header clips it with the same shape.
 *
 * Welcome mode: with [expanded] the header fills the screen and shows [welcomeTitle] at poster size with an outlined echo,
 * [welcomeTagline] and the [welcomeAction] slot (typically a "Get started" pill whose click sets [expanded] to false); the
 * sheet waits below the fold. Toggling [expanded] plays one shared transition: the header shrinks to its band, the art shrinks
 * with it, the titles hand over and the sheet slides up. With motion off it cuts. Only the visible mode is in the
 * accessibility tree and takes input. [onBackToWelcome], when given, answers the system back while the sign-in form shows (at
 * `BackPriority.TAB`), so the host can set [expanded] again; nothing navigates by itself.
 *
 * [state] and [progress] (see [AuthProgress]) are handed to [art], which reacts to them; pass your own composable to change the
 * header look. The art is decorative and hidden from accessibility; the titles are headings. Colors come from the theme through
 * [AuthScaffoldDefaults.colors], so the band follows the accent and dark mode.
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
    LaunchedEffect(expanded) { if (expanded) focus.clearFocusSafely() }
    val density = LocalDensity.current
    val scaledText = density.fontScale > 1f
    val headerDensity = remember(density) { Density(density.density, min(density.fontScale, MAX_HEADER_FONT_SCALE)) }
    val ime = WindowInsets.ime
    if (onBackToWelcome != null) BackHandler(enabled = !expanded, priority = BackPriority.TAB, onBack = onBackToWelcome)
    val rise = with(LocalDensity.current) { 36.dp.toPx() }
    Layout(
        modifier = modifier.fillMaxSize().background(colors.sheet).onPlaced { zones.root = it },
        content = {
            Box(
                Modifier
                    .graphicsLayer {
                        clip = true
                        this.shape = if (arc) ArcEdgeShape(arcDepth * (1f - welcome.value)) else RectangleShape
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
                            Modifier.semantics { heading() },
                            titleStyle,
                            colors.onHeader,
                        )
                        Text(tagline, style = taglineStyle, color = colors.tagline)
                    }
                }
            }
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
                    welcomeAction,
                )
            } else {
                Box {}
            }
            AuthSheet(sheetShape, colors.sheet, arc, drop, expanded, bottom, content)
        },
    ) { measurables, constraints ->
        val width = constraints.maxWidth
        val height = constraints.maxHeight
        val f = welcome.value
        val imeShare = (ime.getBottom(this) / (height * IME_SHARE_SPAN)).coerceIn(0f, 1f)
        val bandCap = if (scaledText) (height * lerp(BAND_SHARE, BAND_SHARE_IME, imeShare)).roundToInt() else height
        val text = measurables[1].measure(Constraints(minWidth = width, maxWidth = width, maxHeight = bandCap.coerceIn(0, height)))
        val band = text.height
        val headerHeight = lerp(band.toFloat(), height.toFloat(), f).roundToInt().coerceIn(0, height)
        val header = measurables[0].measure(Constraints.fixed(width, headerHeight))
        val welcomeBlock = measurables[2].measure(Constraints(maxWidth = width, maxHeight = height))
        val sheetTop = (band - drop.roundToPx()).coerceAtLeast(0)
        val sheet = measurables[3].measure(Constraints.fixed(width, (height - sheetTop).coerceAtLeast(0)))
        val sheetY = lerp(sheetTop.toFloat(), height.toFloat(), f).roundToInt()
        layout(width, height) {
            if (arc && f < 1f) sheet.place(0, sheetY)
            header.place(0, 0)
            text.place(0, 0)
            welcomeBlock.place(0, height - welcomeBlock.height)
            if (!arc && f < 1f) sheet.place(0, sheetY)
        }
    }
}

@Composable
private fun AuthSheet(
    shape: Shape,
    color: Color,
    arc: Boolean,
    drop: Dp,
    hidden: Boolean,
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
    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .graphicsLayer {
                clip = true
                this.shape = shape
            }.background(color)
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
        Column(Modifier.fillMaxSize()) {
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(scroll)
                    .windowInsetsPadding(if (bottom == null || compact) insets else insets.only(WindowInsetsSides.Horizontal))
                    .padding(start = padding, end = padding, top = top, bottom = if (compact) 0.dp else padding),
            ) {
                movableContent(this)
                if (compact) Column(Modifier.padding(top = padding, bottom = UiTheme.sizes.space16)) { movableBottom(this) }
            }
            if (bottom != null && !compact) {
                Column(Modifier.windowInsetsPadding(insets).then(footer)) { movableBottom(this) }
            }
        }
    }
}

/**
 * The welcome block: poster title over its outlined echo, tagline and action, rising into place as [fraction] reaches 1. It
 * wraps its content at the foot of the screen, so the art above it keeps its touches, and scrolls when the text is too tall.
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
    action: (@Composable ColumnScope.() -> Unit)?,
) {
    val padding = AuthScaffoldDefaults.horizontalPadding
    val density = LocalDensity.current
    val cap = min(density.fontScale, MAX_WELCOME_FONT_SCALE) / density.fontScale
    val poster =
        remember(titleStyle, cap) { titleStyle.copy(fontSize = titleStyle.fontSize * cap, lineHeight = titleStyle.lineHeight * cap) }
    val echoStroke = with(density) { 1.5.dp.toPx() }
    val echoStyle = remember(poster, echoStroke) { poster.copy(drawStyle = Stroke(echoStroke)) }
    val echoShift = with(density) { 5.dp.toPx() }
    val breath = rememberDriftClock(remember { mutableFloatStateOf(1f) })
    Column(
        Modifier
            .fillMaxWidth()
            .then(if (expanded) Modifier else Modifier.clearAndSetSemantics {})
            .verticalScroll(rememberScrollState())
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .padding(start = padding, end = padding, top = padding, bottom = padding + UiTheme.sizes.space8),
    ) {
        Column(
            Modifier
                .graphicsLayer {
                    val s = AuthMotion.segment(fraction.value, 0.35f, 1f)
                    alpha = s
                    translationY = -(1f - s) * rise
                    scaleX = 0.94f + 0.06f * s
                    scaleY = scaleX
                    transformOrigin = TransformOrigin(0f, 1f)
                }.onGloballyPositioned { zones.welcome = zones.boundsOf(it) },
        ) {
            Box {
                Text(
                    title,
                    Modifier
                        .clearAndSetSemantics {}
                        .graphicsLayer {
                            val t = breath.value
                            translationX = echoShift + echoShift * 0.35f * sin(t * 0.7f)
                            translationY = echoShift + echoShift * 0.35f * sin(t * 0.7f + 1.4f)
                        },
                    echoStyle,
                    colors.echo,
                )
                Text(title, Modifier.semantics { heading() }, poster, colors.onHeader)
            }
            Spacer(Modifier.height(UiTheme.sizes.space16))
            Text(tagline, style = taglineStyle, color = colors.tagline)
        }
        if (action != null) {
            Spacer(Modifier.height(32.dp))
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

private const val MAX_WELCOME_FONT_SCALE = 1.3f

/** The header title and tagline stop growing with the system font scale here; the sheet keeps its room. */
private const val MAX_HEADER_FONT_SCALE = 1.3f

/** From a font scale above 1 the header band takes at most this share of the screen, and [BAND_SHARE_IME] while the keyboard is up. */
private const val BAND_SHARE = 0.4f
private const val BAND_SHARE_IME = 0.3f

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
