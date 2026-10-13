package com.jcsoftdev.ui.glass

import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.asComposeRenderEffect
import org.jetbrains.skia.FilterTileMode
import org.jetbrains.skia.ImageFilter
import org.jetbrains.skia.RuntimeEffect
import org.jetbrains.skia.RuntimeShaderBuilder

internal actual fun lensSupported(): Boolean = true

private val Effect: RuntimeEffect by lazy { RuntimeEffect.makeForShader(LENS_SHADER) }
private val MergeEffect: RuntimeEffect by lazy { RuntimeEffect.makeForShader(MERGE_SHADER) }

internal actual class LensEngine actual constructor() {
    private val builder = RuntimeShaderBuilder(Effect)
    private val mergeBuilder = RuntimeShaderBuilder(MergeEffect)

    actual fun effect(params: LensParams): RenderEffect? {
        builder.uniform("size", params.width, params.height)
        builder.uniform("origin", params.pad, params.pad)
        builder.uniform("radii", params.tl, params.tr, params.br, params.bl)
        builder.uniform("exponent", params.exponent)
        builder.uniform("dome", params.dome)
        builder.common(params)
        return builder.filter(params)
    }

    actual fun merged(params: MergeParams): RenderEffect? {
        mergeBuilder.uniform("boxes", params.shapes.boxes())
        mergeBuilder.uniform("roundness", params.shapes.roundness())
        mergeBuilder.uniform("count", params.count.toFloat())
        mergeBuilder.uniform("blendK", params.blendDistance)
        mergeBuilder.common(params.lens)
        return mergeBuilder.filter(params.lens)
    }
}

private fun RuntimeShaderBuilder.common(params: LensParams) {
    uniform("strength", params.strength)
    uniform("dispersion", params.dispersion)
    uniform("bounds", params.boundsLeft, params.boundsTop, params.boundsRight, params.boundsBottom)
    uniform("sat", params.saturate)
    uniform("tint", params.tintR, params.tintG, params.tintB, params.tintA)
    uniform("dim", params.dimR, params.dimG, params.dimB, params.dimA)
    uniform("veilEdge", params.veilEdge)
    uniform("rimDepth", params.rimDepth)
    uniform("glintWidth", params.glintWidth)
    uniform("glintStrength", params.glintStrength)
    uniform("light", params.lightX, params.lightY)
    uniform("fresnel", params.fresnel)
    uniform("grain", params.grain)
    uniform("bright", params.brightness)
    uniform("profile", params.profile)
    uniform("band", params.band)
    uniform("thickness", params.thickness)
    uniform("glow", params.glowX, params.glowY, params.glowRadius, params.glowAlpha)
}

private fun RuntimeShaderBuilder.filter(params: LensParams): RenderEffect {
    val blur = if (params.blur > 0f) ImageFilter.makeBlur(params.blur, params.blur, FilterTileMode.CLAMP) else null
    return ImageFilter.makeRuntimeShader(this, "content", blur).asComposeRenderEffect()
}
