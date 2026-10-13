package com.jcsoftdev.ui.glass

import androidx.compose.runtime.Immutable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.GlassMaterial
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.tanh

/**
 * The refraction of a Liquid surface: [LiquidGlass.lens]. A lens bends the backdrop with a runtime shader (Android 13+ AGSL, Skia
 * SkSL on desktop and iOS); where the shader cannot run, the surface is the base Liquid material. The lens shader also draws the
 * specular glint, the thickness shading, fresnel, grain and the touch glow, so those come with the lens.
 */
@Immutable
public sealed class LiquidLens {
    /** How far the lens bends the backdrop, as a multiple of the default (0 keeps the lens on with no bend). */
    public abstract val refraction: Float

    /** Per-channel spread of the refraction, or null for one sample per pixel. Dispersion only exists on a lens. */
    public abstract val dispersion: Dispersion?

    /** Shader code of the profile: 0 full, 1 rim, 2 dome, 3 convex. */
    internal abstract val profileCode: Float

    /** Magnification toward the center (negative minifies). */
    internal abstract fun dome(): Float

    /** Share of the usual rim bend this lens applies. */
    internal open val bend: Float get() = 1f

    /** The renderer of a surface with this lens; only a lens makes one, so a surface without a lens ships none of it. */
    internal abstract fun renderer(): LensRenderer

    /**
     * The largest displacement, at the edge, for a lens [depth] px deep: the bevel capped at 20dp, times [refraction], raised
     * while [pressed] and grown in by [materialize].
     */
    internal fun DrawScope.strength(
        depth: Float,
        pressed: Float,
        materialize: Float,
    ): Float =
        min(depth * STRENGTH_PER_DEPTH, MAX_REFRACTION_DP.dp.toPx()) * refraction.coerceAtLeast(0f) * (1f + PRESS_LENS_GAIN * pressed) *
            materialize * bend

    /**
     * How far beyond the surface edge the lens samples, in px, for a surface of half size [halfWidth] x [halfHeight] and a rim
     * bend of [strength] px. The backdrop layer is padded by this much; 0 keeps every sample inside the surface.
     */
    internal open fun reach(
        halfWidth: Float,
        halfHeight: Float,
        strength: Float,
    ): Float = 0f
}

/** How a [RefractionLens] bends the backdrop across the surface. */
public enum class LiquidProfile {
    /** Only a band along the edge (see [LiquidGlass.bevelWidth]) refracts; the middle is flat. The thin-bezel look. */
    Rim,

    /** The whole surface refracts, strongest at the rim and fading toward the middle, plus a faint dome. The default. */
    Full,

    /** A convex lens: the backdrop is magnified toward the middle with no directional bevel. */
    Dome,
}

/**
 * The Liquid lens: the backdrop is sampled from further inside the surface, by an amount that is strongest at the edge, so every
 * sample stays within the surface. [profile] picks how the bend spreads; [dispersion] splits it per channel.
 */
@Immutable
public data class RefractionLens(
    override val refraction: Float = 1f,
    val profile: LiquidProfile = LiquidProfile.Full,
    override val dispersion: Dispersion? = null,
) : LiquidLens() {
    override val profileCode: Float
        get() =
            when (profile) {
                LiquidProfile.Full -> 0f
                LiquidProfile.Rim -> 1f
                LiquidProfile.Dome -> 2f
            }

    override fun renderer(): LensRenderer = LensRenderer()

    // Full keeps the faint dome, Rim none, Dome a strong one that grows with the refraction.
    override fun dome(): Float =
        when (profile) {
            LiquidProfile.Full -> BASE_DOME
            LiquidProfile.Rim -> 0f
            LiquidProfile.Dome -> BASE_DOME + DOME_GAIN * refraction.coerceIn(0f, 2f)
        }
}

internal const val BASE_DOME: Float = 0.05f
internal const val DOME_GAIN: Float = 0.16f

// Kyant's backdrop lens uses a refraction height up to the smallest corner radius and an amount about twice that; our samples
// stay inside the surface, so the amount is capped at the bevel itself.
internal const val STRENGTH_PER_DEPTH = 1.1f
internal const val MAX_REFRACTION_DP = 20f
internal const val PRESS_LENS_GAIN = 0.35f
private const val VEIL_EDGE = 0.35f
private const val GLOW_RADIUS = 0.55f
private const val LENS_INPUTS = 16

/**
 * What a lensed surface holds: the platform engine, the last effect and the inputs it was built for, and the corner radii and
 * superellipse exponent of the outline. Made on the first lensed draw by [LiquidLens], so a surface without a lens never has one.
 */
internal class LensRenderer {
    private val engine = LensEngine()
    private var key: LensParams? = null
    private var keyProgram: LensProgram? = null
    private var effect: RenderEffect? = null
    private val last = FloatArray(LENS_INPUTS)
    private val scratch = FloatArray(LENS_INPUTS)
    private val corners = FloatArray(4)
    private var exponent = 2f
    private var outline: Outline? = null

    /** Set when the surface's inputs changed outside the frame values (the node was updated). */
    var stale = true

    // From the sharpest corner, a pill or circle is an ellipse (2) and a sharp rectangle fills its corners (8).
    private fun sync(
        made: Outline,
        size: Size,
    ) {
        if (made === outline) return
        outline = made
        made.cornerRadiiInto(corners)
        val half = min(size.width, size.height) * 0.5f
        exponent = 2f + 6f * (1f - (minOf(corners[0], corners[1], corners[2], corners[3]) / half.coerceAtLeast(1f)).coerceIn(0f, 1f))
        stale = true
    }

    /**
     * The blur-then-refract effect of [material]'s [lens] for the current frame. Rebuilt only when one of the inputs that vary
     * between frames moved, so a settled surface allocates nothing.
     */
    fun DrawScope.effect(
        material: LiquidGlass,
        lens: LiquidLens,
        tokens: GlassMaterial,
        outline: Outline,
        pad: Int,
        depth: Float,
        strength: Float,
        radius: Float,
        pressed: Float,
        wide: Boolean,
        sourceLeft: Float,
        sourceTop: Float,
        sourceSize: IntSize,
        light: Offset,
        pointer: Offset?,
    ): RenderEffect? {
        sync(outline, size)
        val rimDepth = rimDepthFor(material.bevelWidth.toPx(), depth)
        val half = min(size.width, size.height) * 0.5f
        val glowAlpha = (material.interaction?.motion?.glow ?: 0f) * pressed
        val glowing = pointer != null && glowAlpha > 0f
        val glowX = if (glowing) size.width / 2f + rubberBand(pointer!!.x - size.width / 2f, size.width / 2f) else 0f
        val glowY = if (glowing) size.height / 2f + rubberBand(pointer!!.y - size.height / 2f, size.height / 2f) else 0f
        val shownGlow = if (pointer != null) glowAlpha else 0f
        val inputs = scratch
        inputs[0] = size.width
        inputs[1] = size.height
        inputs[2] = pad.toFloat()
        inputs[3] = strength
        inputs[4] = radius
        inputs[5] = light.x
        inputs[6] = light.y
        inputs[7] = glowX
        inputs[8] = glowY
        inputs[9] = shownGlow
        inputs[10] = rimDepth
        inputs[11] = exponent
        inputs[12] = if (wide) sourceLeft else 0f
        inputs[13] = if (wide) sourceTop else 0f
        inputs[14] = sourceSize.width.toFloat()
        inputs[15] = sourceSize.height.toFloat()
        if (!stale && effect != null && inputs.contentEquals(last)) return effect
        inputs.copyInto(last)
        stale = false
        val dispersion = lens.dispersion
        val program = dispersion?.lensProgram ?: PlainLensProgram.value
        val params =
            LensParams(
                width = size.width,
                height = size.height,
                pad = pad.toFloat(),
                tl = corners[0],
                tr = corners[1],
                br = corners[2],
                bl = corners[3],
                exponent = exponent,
                strength = strength,
                dispersion = dispersion?.amount ?: 0f,
                blur = radius,
                // A wide (crystal) lens reads beyond its own surface, up to the edge of the backdrop source (never past it, where
                // nothing was recorded); the others stay inside the surface.
                boundsLeft = if (wide) sourceLeft.coerceAtLeast(0f) else pad.toFloat(),
                boundsTop = if (wide) sourceTop.coerceAtLeast(0f) else pad.toFloat(),
                boundsRight = if (wide) (sourceLeft + sourceSize.width).coerceAtMost(size.width + pad * 2) else pad + size.width,
                boundsBottom = if (wide) (sourceTop + sourceSize.height).coerceAtMost(size.height + pad * 2) else pad + size.height,
                saturate = tokens.saturate,
                tintR = tokens.tint.red,
                tintG = tokens.tint.green,
                tintB = tokens.tint.blue,
                tintA = tokens.tint.alpha,
                dimR = tokens.dim.red,
                dimG = tokens.dim.green,
                dimB = tokens.dim.blue,
                dimA = tokens.dim.alpha,
                veilEdge = VEIL_EDGE,
                rimDepth = rimDepth.coerceAtLeast(1f),
                dome = lens.dome(),
                glintWidth = GLINT_WIDTH_DP.dp.toPx(),
                glintStrength = tokens.edge.alpha * material.specular.intensity.coerceAtLeast(0f),
                lightX = light.x,
                lightY = light.y,
                fresnel = material.fresnel,
                grain = material.grain,
                brightness = material.brightness,
                profile = lens.profileCode,
                band = (rimDepth / half).coerceIn(0.05f, 1f),
                thickness = material.rim * sizeScale(half, REFERENCE_SIZE_DP.dp.toPx() / 2f),
                glowX = pad + glowX,
                glowY = pad + glowY,
                glowRadius = max(size.width, size.height) * GLOW_RADIUS,
                glowAlpha = shownGlow,
            )
        if (params != key || program !== keyProgram) {
            key = params
            keyProgram = program
            effect = engine.effect(program, params)
        }
        return effect
    }
}

/** Fills [into] with the top-left, top-right, bottom-right, bottom-left corner radius (x) of a rounded outline; zeros for anything else. */
private fun Outline.cornerRadiiInto(into: FloatArray) {
    if (this is Outline.Rounded) {
        into[0] = roundRect.topLeftCornerRadius.x
        into[1] = roundRect.topRightCornerRadius.x
        into[2] = roundRect.bottomRightCornerRadius.x
        into[3] = roundRect.bottomLeftCornerRadius.x
    } else {
        into.fill(0f)
    }
}

// The light and touch geometry the lens shader is fed (the merged container reads the light too).

/** Pulls [value] toward a limit smoothly: linear near 0, never beyond [limit]. */
internal fun rubberBand(
    value: Float,
    limit: Float,
): Float = if (limit <= 0f) 0f else limit * tanh(value / limit)

/** The unit vector toward [pointer] from the center of a surface of [size], or null when it sits on the center. */
internal fun lightToward(
    pointer: Offset,
    width: Float,
    height: Float,
): Offset? {
    val dx = pointer.x - width / 2f
    val dy = pointer.y - height / 2f
    val length = hypot(dx, dy)
    return if (length < 0.5f) null else Offset(dx / length, dy / length)
}

/** Blends two light directions and renormalizes; [amount] 0 gives [from], 1 gives [to]. */
internal fun blendLight(
    from: Offset,
    to: Offset,
    amount: Float,
): Offset {
    val x = from.x + (to.x - from.x) * amount
    val y = from.y + (to.y - from.y) * amount
    val length = hypot(x, y)
    return if (length < 1e-4f) from else Offset(x / length, y / length)
}

/** Unit vector toward the light for an angle in degrees clockwise from 3 o'clock. */
internal fun lightFromAngle(degrees: Float): Offset {
    val radians = degrees * PI.toFloat() / 180f
    return Offset(cos(radians), sin(radians))
}

internal fun angleOf(
    x: Float,
    y: Float,
): Float = atan2(y, x) * 180f / PI.toFloat()
