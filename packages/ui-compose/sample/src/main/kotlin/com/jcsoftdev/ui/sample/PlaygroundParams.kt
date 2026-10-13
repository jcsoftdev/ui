package com.jcsoftdev.ui.sample

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.glass.LiquidGlassStyle
import com.jcsoftdev.ui.glass.LiquidInteraction
import com.jcsoftdev.ui.glass.LiquidMotion
import com.jcsoftdev.ui.glass.LiquidProfile
import com.jcsoftdev.ui.glass.LiquidShadow
import com.jcsoftdev.ui.glass.LiquidSpecular
import com.jcsoftdev.ui.glass.LiquidTint
import kotlin.math.roundToInt

/** The spring set the playground offers: off (null), [LiquidMotion.Standard] or [LiquidMotion.Playful]. */
enum class MotionChoice(
    val label: String,
    val motion: LiquidMotion?,
    val code: String,
) {
    Off("Off", null, "null"),
    Standard("Standard", LiquidMotion.Standard, "LiquidMotion.Standard"),
    Playful("Playful", LiquidMotion.Playful, "LiquidMotion.Playful"),
}

/**
 * Every [LiquidGlassStyle] field as the plain numbers the sliders edit. Lengths are dp values; [frost] and [saturation] are
 * null while they follow the material token.
 */
data class PlaygroundParams(
    val refraction: Float = 1f,
    val bevel: Float = 22f,
    val profile: LiquidProfile = LiquidProfile.Full,
    val dispersion: Float = 0.03f,
    val frost: Float? = null,
    val saturation: Float? = null,
    val brightness: Float = 0f,
    val tintColor: Color = Color.Unspecified,
    val tintAmount: Float = 1f,
    val rim: Float = 1f,
    val specularIntensity: Float = 1f,
    val specularAngle: Float = -125f,
    val fresnel: Float = 0f,
    val grain: Float = 0f,
    val opacity: Float = 1f,
    val shadowOpacity: Float = 1f,
    val shadowSpread: Float = 14f,
    val shadowOffsetY: Float = 3f,
    val interaction: LiquidInteraction = LiquidInteraction.Press,
    val motion: MotionChoice = MotionChoice.Standard,
    val blend: Float = 24f,
) {
    fun toStyle(): LiquidGlassStyle =
        LiquidGlassStyle(
            refraction = refraction,
            bevelWidth = bevel.dp,
            profile = profile,
            dispersion = dispersion,
            frost = frost?.dp ?: Dp.Unspecified,
            saturation = saturation,
            brightness = brightness,
            tint = LiquidTint(tintColor, tintAmount),
            rim = rim,
            specular = LiquidSpecular(specularIntensity, specularAngle),
            fresnel = fresnel,
            grain = grain,
            opacity = opacity,
            shadow = LiquidShadow(shadowOpacity, shadowSpread.dp, shadowOffsetY.dp),
            interaction = interaction,
            motion = motion.motion,
            blend = blend.dp,
        )

    /** The `LiquidGlassStyle(...)` call that reproduces this look: only the fields that differ from the kit default. */
    fun toSnippet(): String {
        val d = Kit
        val args = mutableListOf<String>()
        if (refraction != d.refraction) args += "refraction = ${f(refraction)}"
        if (bevel != d.bevel) args += "bevelWidth = ${dp(bevel)}"
        if (profile != d.profile) args += "profile = LiquidProfile.$profile"
        if (dispersion != d.dispersion) args += "dispersion = ${f(dispersion)}"
        if (frost != null) args += "frost = ${dp(frost)}"
        if (saturation != null) args += "saturation = ${f(saturation)}"
        if (brightness != d.brightness) args += "brightness = ${f(brightness)}"
        if (tintColor != d.tintColor || tintAmount != d.tintAmount) {
            val parts = mutableListOf<String>()
            if (tintColor != d.tintColor) parts += "color = ${hex(tintColor)}"
            if (tintAmount != d.tintAmount) parts += "amount = ${f(tintAmount)}"
            args += "tint = LiquidTint(${parts.joinToString()})"
        }
        if (rim != d.rim) args += "rim = ${f(rim)}"
        if (specularIntensity != d.specularIntensity || specularAngle != d.specularAngle) {
            val parts = mutableListOf<String>()
            if (specularIntensity != d.specularIntensity) parts += "intensity = ${f(specularIntensity)}"
            if (specularAngle != d.specularAngle) parts += "angleDegrees = ${f(specularAngle)}"
            args += "specular = LiquidSpecular(${parts.joinToString()})"
        }
        if (fresnel != d.fresnel) args += "fresnel = ${f(fresnel)}"
        if (grain != d.grain) args += "grain = ${f(grain)}"
        if (opacity != d.opacity) args += "opacity = ${f(opacity)}"
        if (shadowOpacity != d.shadowOpacity || shadowSpread != d.shadowSpread || shadowOffsetY != d.shadowOffsetY) {
            val parts = mutableListOf<String>()
            if (shadowOpacity != d.shadowOpacity) parts += "opacity = ${f(shadowOpacity)}"
            if (shadowSpread != d.shadowSpread) parts += "spread = ${dp(shadowSpread)}"
            if (shadowOffsetY != d.shadowOffsetY) parts += "offsetY = ${dp(shadowOffsetY)}"
            args += "shadow = LiquidShadow(${parts.joinToString()})"
        }
        if (interaction != d.interaction) args += "interaction = LiquidInteraction.$interaction"
        if (motion != d.motion) args += "motion = ${motion.code}"
        if (blend != d.blend) args += "blend = ${dp(blend)}"
        if (args.isEmpty()) return "LiquidGlassStyle()"
        return "LiquidGlassStyle(\n" + args.joinToString("") { "    $it,\n" } + ")"
    }

    companion object {
        /** What `LiquidGlassStyle()` is, in playground units. */
        val Kit: PlaygroundParams = PlaygroundParams()

        /** The playground starts on the Crystal lens with the drag squash, so the panel flexes while it is moved. */
        val Initial: PlaygroundParams = from(LiquidGlassStyle.Crystal)

        fun from(style: LiquidGlassStyle): PlaygroundParams =
            PlaygroundParams(
                refraction = style.refraction,
                bevel = style.bevelWidth.value,
                profile = style.profile,
                dispersion = style.dispersion,
                frost = style.frost.takeIf { it != Dp.Unspecified }?.value,
                saturation = style.saturation,
                brightness = style.brightness,
                tintColor = style.tint.color,
                tintAmount = style.tint.amount,
                rim = style.rim,
                specularIntensity = style.specular.intensity,
                specularAngle = style.specular.angleDegrees,
                fresnel = style.fresnel,
                grain = style.grain,
                opacity = style.opacity,
                shadowOpacity = style.shadow.opacity,
                shadowSpread = style.shadow.spread.value,
                shadowOffsetY = style.shadow.offsetY.value,
                interaction = style.interaction,
                motion =
                    when (style.motion) {
                        null -> MotionChoice.Off
                        LiquidMotion.Playful -> MotionChoice.Playful
                        else -> MotionChoice.Standard
                    },
                blend = style.blend.value,
            )
    }
}

private fun round2(v: Float): Float = (v * 100f).roundToInt() / 100f

/** A Kotlin float literal rounded to two decimals. */
internal fun f(v: Float): String = "${round2(v)}f"

/** A Kotlin `Dp` literal; whole numbers print without a fraction. */
internal fun dp(v: Float): String {
    val r = round2(v)
    return if (r == r.roundToInt().toFloat()) "${r.roundToInt()}.dp" else "$r.dp"
}

private fun hex(c: Color): String = "Color(0x${c.toArgb().toUInt().toString(16).uppercase().padStart(8, '0')})"
