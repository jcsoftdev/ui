package com.jcsoftdev.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.ZeroCornerSize
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
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
import com.jcsoftdev.ui.atoms.LocalContentColor
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiTheme

/** Colors of [AuthScaffold]: the [header] band and the [onHeader] text and art on it, the [sheet] surface and the [tagline] text. */
@Immutable
public class AuthScaffoldColors(
    public val header: Color,
    public val onHeader: Color,
    public val sheet: Color,
    public val tagline: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        header: Color = this.header,
        onHeader: Color = this.onHeader,
        sheet: Color = this.sheet,
        tagline: Color = this.tagline,
    ): AuthScaffoldColors = AuthScaffoldColors(header, onHeader, sheet, tagline)
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
    /** The header is the accent pulled toward the darkest tone of the theme; text and art on it use `surface` or `ink`, whichever contrasts more. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): AuthScaffoldColors {
        val c = UiTheme.colors
        val header = authHeaderColor(c)
        val onHeader = authOnColor(header, c)
        return AuthScaffoldColors(header, onHeader, c.surface, lerp(onHeader, header, 0.25f))
    }

    /** The sheet: the theme `sheet` shape with square bottom corners. */
    public val sheetShape: Shape
        @Composable @ReadOnlyComposable
        get() = (UiTheme.shapes.sheet as CornerBasedShape).copy(bottomStart = ZeroCornerSize, bottomEnd = ZeroCornerSize)

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
 * [state] and [progress] (see [AuthProgress]) are handed to [art], which reacts to them; pass your own composable to change the
 * header look. The art is decorative and hidden from accessibility; the title is a heading. Colors come from the theme through
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
    bottom: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val padding = AuthScaffoldDefaults.horizontalPadding
    val arc = headerShape == AuthHeaderShape.Arc
    val drop = if (arc) arcDepth else overlap
    val headerClip: Shape = if (arc) remember(arcDepth) { ArcEdgeShape(arcDepth) } else RectangleShape
    val sheetShape: Shape = if (arc) RectangleShape else shape
    val zones = remember { AuthTextZones() }
    Layout(
        modifier = modifier.fillMaxSize().background(colors.sheet),
        content = {
            CompositionLocalProvider(LocalContentColor provides colors.onHeader) {
                Box(Modifier.fillMaxWidth().clip(headerClip).background(colors.header)) {
                    Box(Modifier.matchParentSize().clearAndSetSemantics {}) {
                        CompositionLocalProvider(LocalAuthTextZones provides zones) { art(state, progress) }
                    }
                    Column(
                        Modifier
                            .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Top))
                            .padding(start = padding, end = padding, top = padding, bottom = drop + padding)
                            .onGloballyPositioned { zones.login = it.boundsInHeader() },
                        verticalArrangement = Arrangement.spacedBy(UiTheme.sizes.space8),
                    ) {
                        Text(title, Modifier.semantics { heading() }, titleStyle, colors.onHeader)
                        Text(tagline, style = taglineStyle, color = colors.tagline)
                    }
                }
            }
            val insets = WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal + WindowInsetsSides.Bottom)
            Column(
                Modifier
                    .fillMaxSize()
                    .clip(sheetShape)
                    .background(colors.sheet)
                    .semantics { isTraversalGroup = true },
            ) {
                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .windowInsetsPadding(if (bottom == null) insets else insets.only(WindowInsetsSides.Horizontal))
                        .padding(
                            start = padding,
                            end = padding,
                            top = (if (arc) drop else 0.dp) + padding + UiTheme.sizes.space8,
                            bottom = padding,
                        ),
                    content = content,
                )
                if (bottom != null) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .windowInsetsPadding(insets)
                            .padding(start = padding, end = padding, top = UiTheme.sizes.space8, bottom = UiTheme.sizes.space16),
                        content = bottom,
                    )
                }
            }
        },
    ) { measurables, constraints ->
        val width = constraints.maxWidth
        val height = constraints.maxHeight
        val dropPx = drop.roundToPx()
        val header = measurables[0].measure(Constraints(minWidth = width, maxWidth = width, maxHeight = height))
        val sheetTop = (header.height - dropPx).coerceAtLeast(0)
        val sheet = measurables[1].measure(Constraints.fixed(width, (height - sheetTop).coerceAtLeast(0)))
        layout(width, height) {
            if (arc) {
                sheet.place(0, sheetTop)
                header.place(0, 0)
            } else {
                header.place(0, 0)
                sheet.place(0, sheetTop)
            }
        }
    }
}

/** Bounds of a header child in the coordinates of the header box, where the art is drawn. */
private fun LayoutCoordinates.boundsInHeader(): Rect = parentLayoutCoordinates?.localBoundingBoxOf(this, clipBounds = false) ?: Rect.Zero

private class ArcEdgeShape(
    private val depth: Dp,
) : Shape {
    override fun createOutline(
        size: Size,
        layoutDirection: LayoutDirection,
        density: Density,
    ): Outline {
        val d = with(density) { depth.toPx() }.coerceAtMost(size.height)
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
