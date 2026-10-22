package com.jcsoftdev.ui.auth

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.util.lerp
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonColors
import com.jcsoftdev.ui.atoms.ButtonDefaults
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.atoms.pressableTarget
import com.jcsoftdev.ui.theme.UiTheme
import kotlinx.coroutines.delay
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/** Default metrics and styles of [AuthPrimaryButton] and [AuthLink]. */
public object AuthActionDefaults {
    /** Height of the primary button; the theme `mButton`. */
    public val buttonHeight: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.mButton

    /** Label style of the primary button; the theme `mButton`. */
    public val buttonTextStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.mButton

    /** Link style; the theme `mMeta`, underlined. */
    public val linkTextStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.mMeta.copy(textDecoration = TextDecoration.Underline)

    /** Link color; `ink2` keeps 4.5:1 on the sheet. */
    public val linkColor: Color
        @Composable @ReadOnlyComposable
        get() = UiTheme.colors.ink2
}

/**
 * Full-width pill primary action of the sign-in family. [loading] shows the spinner and ignores taps (announcing
 * [loadingDescription]); [enabled] false swaps to the neutral disabled colors.
 *
 * [success] morphs it into a round badge with a check mark that draws itself, and makes it ignore taps; screen readers hear
 * [successDescription] as its state (pass the text, for example "Signed in"). With motion off it shows the badge at once.
 */
@Composable
public fun AuthPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    loadingDescription: String? = null,
    colors: ButtonColors = ButtonDefaults.colors(ButtonVariant.Primary),
    textStyle: TextStyle = AuthActionDefaults.buttonTextStyle,
    height: Dp = AuthActionDefaults.buttonHeight,
    success: Boolean = false,
    successDescription: String? = null,
) {
    val motion = UiTheme.motion
    val morph = animateFloatAsState(if (success) 1f else 0f, motion.tween(AuthMotion.MORPH_MS), label = "morph")
    val check = rememberCheckInk(success)
    val label = 1f - AuthMotion.segment(morph.value, 0f, 0.4f)
    val shown = if (label < 1f) colors.copy(content = colors.content.copy(alpha = colors.content.alpha * label)) else colors
    val latest by rememberUpdatedState(onClick)
    Button(
        text,
        { if (!success) latest() },
        modifier
            .morphToBadge(morph)
            .drawWithContent {
                drawContent()
                drawCheck(check.value, colors.content)
            }.semantics {
                if (success && successDescription != null) {
                    stateDescription = successDescription
                    liveRegion = LiveRegionMode.Polite
                }
            },
        variant = ButtonVariant.Primary,
        block = true,
        enabled = enabled,
        loading = loading && !success,
        loadingDescription = loadingDescription,
        colors = shown,
        shape = UiTheme.shapes.pill,
        height = height,
        textStyle = textStyle,
    )
}

/** Narrows the button from its full width to a circle as [morph] goes from 0 to 1, centered where the pill was. */
private fun Modifier.morphToBadge(morph: State<Float>): Modifier =
    layout { measurable, constraints ->
        val f = morph.value
        if (f <= 0f) {
            val placeable = measurable.measure(constraints)
            return@layout layout(placeable.width, placeable.height) { placeable.place(0, 0) }
        }
        val full = if (constraints.hasBoundedWidth) constraints.maxWidth else measurable.maxIntrinsicWidth(constraints.maxHeight)
        val side = measurable.minIntrinsicHeight(full).coerceIn(constraints.minHeight, constraints.maxHeight)
        val width = lerp(full.toFloat(), side.toFloat(), f).roundToInt().coerceAtLeast(side)
        val placeable = measurable.measure(Constraints.fixed(width, side))
        layout(full, side) { placeable.place((full - width) / 2, 0) }
    }

/** 0..1 share of the check mark drawn: it starts once the morph is mostly done; at once with motion off. */
@Composable
private fun rememberCheckInk(success: Boolean): State<Float> {
    val motion = UiTheme.motion
    val ink = remember { Animatable(if (success) 1f else 0f) }
    LaunchedEffect(success, motion) {
        when {
            !success -> ink.snapTo(0f)
            !motion.enabled -> ink.snapTo(1f)
            ink.value < 1f -> {
                delay((AuthMotion.MORPH_MS * 0.7f * motion.scale).roundToLong())
                ink.animateTo(1f, tween((AuthMotion.CHECK_MS * motion.scale).roundToInt(), easing = FastOutSlowInEasing))
            }
        }
    }
    return ink.asState()
}

/** A check mark centered in the button, [drawn] of its length, in the label color. */
private fun DrawScope.drawCheck(
    drawn: Float,
    color: Color,
) {
    if (drawn <= 0f) return
    val side = minOf(size.width, size.height)
    val c = center
    val path =
        Path().apply {
            moveTo(c.x - side * 0.2f, c.y + side * 0.01f)
            lineTo(c.x - side * 0.05f, c.y + side * 0.15f)
            lineTo(c.x + side * 0.21f, c.y - side * 0.13f)
        }
    val measure = PathMeasure().apply { setPath(path, false) }
    val part = Path()
    measure.getSegment(0f, measure.length * drawn.coerceIn(0f, 1f), part, true)
    drawPath(part, color, style = Stroke(side * 0.075f, cap = StrokeCap.Round, join = StrokeJoin.Round))
}

/**
 * Small underlined text link ("Forgot password?", "New user? Sign up"). The text comes from the caller; the tap target is at
 * least 48dp. Place it with [modifier] (for example `Modifier.align(Alignment.End)`).
 */
@Composable
public fun AuthLink(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    color: Color = AuthActionDefaults.linkColor,
    textStyle: TextStyle = AuthActionDefaults.linkTextStyle,
) {
    val source = remember { MutableInteractionSource() }
    Text(text, modifier.pressableTarget(onClick, enabled, Role.Button, source), textStyle, color)
}
