package com.jcsoftdev.ui.glass

import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.asComposeRenderEffect
import org.jetbrains.skia.FilterTileMode
import org.jetbrains.skia.ImageFilter
import org.jetbrains.skia.RuntimeEffect
import org.jetbrains.skia.RuntimeShaderBuilder

// One effect per program, compiled on first use, so a surface that never merges never compiles the merge shader.
private fun LensProgram.effect(): RuntimeEffect = compiled as? RuntimeEffect ?: RuntimeEffect.makeForShader(source).also { compiled = it }

// Each builder is made for the program it was first asked for (and remade if the program changes). The blur that feeds the
// shader is kept while its radius holds; only the shader filter (which snapshots the uniforms) is made per change.
internal actual class LensEngine actual constructor() {
    private var builder: RuntimeShaderBuilder? = null
    private var builderProgram: LensProgram? = null
    private var mergeBuilder: RuntimeShaderBuilder? = null
    private var mergeProgram: LensProgram? = null
    private var blurRadius = -1f
    private var blurFilter: ImageFilter? = null

    actual fun effect(
        program: LensProgram,
        params: LensParams,
    ): RenderEffect? {
        val builder =
            builder?.takeIf { builderProgram === program } ?: RuntimeShaderBuilder(program.effect()).also {
                builder = it
                builderProgram = program
            }
        builder.uniform("size", params.width, params.height)
        builder.uniform("origin", params.pad, params.pad)
        builder.uniform("radii", params.tl, params.tr, params.br, params.bl)
        builder.uniform("exponent", params.exponent)
        builder.uniform("dome", params.dome)
        builder.common(params)
        return builder.filter(blurFor(params.blur))
    }

    actual fun merged(
        program: MergeProgram,
        params: MergeParams,
    ): RenderEffect? {
        val source = program.program
        val builder =
            mergeBuilder?.takeIf { mergeProgram === source } ?: RuntimeShaderBuilder(source.effect()).also {
                mergeBuilder = it
                mergeProgram = source
            }
        builder.uniform("boxes", params.shapes.boxes())
        builder.uniform("roundness", params.shapes.roundness())
        builder.uniform("count", params.count.toFloat())
        builder.uniform("blendK", params.blendDistance)
        builder.common(params.lens)
        return builder.filter(blurFor(params.lens.blur))
    }

    private fun blurFor(radius: Float): ImageFilter? {
        if (radius <= 0f) return null
        if (radius != blurRadius || blurFilter == null) {
            blurRadius = radius
            blurFilter = ImageFilter.makeBlur(radius, radius, FilterTileMode.CLAMP)
        }
        return blurFilter
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

private fun RuntimeShaderBuilder.filter(blur: ImageFilter?): RenderEffect =
    ImageFilter.makeRuntimeShader(this, "content", blur).asComposeRenderEffect()
