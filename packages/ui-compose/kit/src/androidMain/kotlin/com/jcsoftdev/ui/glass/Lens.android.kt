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

internal actual class LensEngine actual constructor() {
    // Created lazily so the class stays loadable below API 33.
    private val shader: Any? by lazy { if (lensSupported()) RuntimeShader(LENS_SHADER) else null }

    actual fun effect(params: LensParams): RenderEffect? = if (lensSupported()) agslEffect(shader as RuntimeShader, params) else null
}

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
private fun agslEffect(
    shader: RuntimeShader,
    params: LensParams,
): RenderEffect {
    shader.setFloatUniform("size", params.width, params.height)
    shader.setFloatUniform("origin", params.pad, params.pad)
    shader.setFloatUniform("radii", params.tl, params.tr, params.br, params.bl)
    shader.setFloatUniform("depth", params.depth)
    shader.setFloatUniform("strength", params.strength)
    shader.setFloatUniform("dispersion", params.dispersion)
    shader.setFloatUniform("bounds", params.boundsLeft, params.boundsTop, params.boundsRight, params.boundsBottom)
    val lens = PlatformRenderEffect.createRuntimeShaderEffect(shader, "content")
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
