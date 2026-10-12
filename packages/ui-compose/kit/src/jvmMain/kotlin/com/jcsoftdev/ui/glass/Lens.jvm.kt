package com.jcsoftdev.ui.glass

import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.asComposeRenderEffect
import org.jetbrains.skia.FilterTileMode
import org.jetbrains.skia.ImageFilter
import org.jetbrains.skia.RuntimeEffect
import org.jetbrains.skia.RuntimeShaderBuilder

internal actual fun lensSupported(): Boolean = true

private val Effect: RuntimeEffect by lazy { RuntimeEffect.makeForShader(LENS_SHADER) }

internal actual class LensEngine actual constructor() {
    private val builder = RuntimeShaderBuilder(Effect)

    actual fun effect(params: LensParams): RenderEffect? {
        builder.uniform("size", params.width, params.height)
        builder.uniform("origin", params.pad, params.pad)
        builder.uniform("radii", params.tl, params.tr, params.br, params.bl)
        builder.uniform("exponent", params.exponent)
        builder.uniform("strength", params.strength)
        builder.uniform("dispersion", params.dispersion)
        builder.uniform("bounds", params.boundsLeft, params.boundsTop, params.boundsRight, params.boundsBottom)
        builder.uniform("sat", params.saturate)
        builder.uniform("tint", params.tintR, params.tintG, params.tintB, params.tintA)
        builder.uniform("dim", params.dimR, params.dimG, params.dimB, params.dimA)
        builder.uniform("veilEdge", params.veilEdge)
        builder.uniform("rimDepth", params.rimDepth)
        builder.uniform("dome", params.dome)
        builder.uniform("glintWidth", params.glintWidth)
        builder.uniform("glintStrength", params.glintStrength)
        val blur = if (params.blur > 0f) ImageFilter.makeBlur(params.blur, params.blur, FilterTileMode.CLAMP) else null
        return ImageFilter.makeRuntimeShader(builder, "content", blur).asComposeRenderEffect()
    }
}
