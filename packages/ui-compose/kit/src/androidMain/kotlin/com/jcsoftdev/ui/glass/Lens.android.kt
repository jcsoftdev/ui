package com.jcsoftdev.ui.glass

import android.graphics.RuntimeShader
import android.graphics.Shader
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.ui.graphics.RenderEffect
import androidx.compose.ui.graphics.asComposeRenderEffect
import android.graphics.RenderEffect as PlatformRenderEffect

// RuntimeShader (AGSL) exists from Android 13.
internal actual fun lensSupported(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU

// One shader per process, created lazily so the class stays loadable below API 33. Each effect snapshots the uniforms when it
// is created, and effects are only built on the main thread, so every surface can reuse it.
private val SharedShader: Any? by lazy { if (lensSupported()) RuntimeShader(LENS_SHADER) else null }
private val SharedMergeShader: Any? by lazy { if (lensSupported()) RuntimeShader(MERGE_SHADER) else null }

internal actual class LensEngine actual constructor() {
    actual fun effect(params: LensParams): RenderEffect? = if (lensSupported()) agslEffect(SharedShader as RuntimeShader, params) else null

    actual fun merged(params: MergeParams): RenderEffect? =
        if (lensSupported()) agslMerged(SharedMergeShader as RuntimeShader, params) else null
}

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
private fun agslEffect(
    shader: RuntimeShader,
    params: LensParams,
): RenderEffect {
    shader.setFloatUniform("size", params.width, params.height)
    shader.setFloatUniform("origin", params.pad, params.pad)
    shader.setFloatUniform("radii", params.tl, params.tr, params.br, params.bl)
    shader.setFloatUniform("exponent", params.exponent)
    shader.setFloatUniform("dome", params.dome)
    shader.common(params)
    return shader.chain(params)
}

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
private fun agslMerged(
    shader: RuntimeShader,
    params: MergeParams,
): RenderEffect {
    shader.setFloatUniform("boxes", params.shapes.boxes())
    shader.setFloatUniform("roundness", params.shapes.roundness())
    shader.setFloatUniform("count", params.count.toFloat())
    shader.setFloatUniform("blendK", params.blendDistance)
    shader.common(params.lens)
    return shader.chain(params.lens)
}

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
private fun RuntimeShader.common(params: LensParams) {
    setFloatUniform("strength", params.strength)
    setFloatUniform("dispersion", params.dispersion)
    setFloatUniform("bounds", params.boundsLeft, params.boundsTop, params.boundsRight, params.boundsBottom)
    setFloatUniform("sat", params.saturate)
    setFloatUniform("tint", params.tintR, params.tintG, params.tintB, params.tintA)
    setFloatUniform("dim", params.dimR, params.dimG, params.dimB, params.dimA)
    setFloatUniform("veilEdge", params.veilEdge)
    setFloatUniform("rimDepth", params.rimDepth)
    setFloatUniform("glintWidth", params.glintWidth)
    setFloatUniform("glintStrength", params.glintStrength)
    setFloatUniform("light", params.lightX, params.lightY)
    setFloatUniform("fresnel", params.fresnel)
    setFloatUniform("grain", params.grain)
    setFloatUniform("bright", params.brightness)
    setFloatUniform("profile", params.profile)
    setFloatUniform("band", params.band)
    setFloatUniform("thickness", params.thickness)
    setFloatUniform("glow", params.glowX, params.glowY, params.glowRadius, params.glowAlpha)
}

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
private fun RuntimeShader.chain(params: LensParams): RenderEffect {
    val lens = PlatformRenderEffect.createRuntimeShaderEffect(this, "content")
    val effect =
        if (params.blur > 0f) {
            PlatformRenderEffect.createChainEffect(
                lens,
                PlatformRenderEffect.createBlurEffect(params.blur, params.blur, Shader.TileMode.CLAMP),
            )
        } else {
            lens
        }
    return effect.asComposeRenderEffect()
}
