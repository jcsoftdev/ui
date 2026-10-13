package com.jcsoftdev.ui.sample

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.glass.CrystalLens
import com.jcsoftdev.ui.glass.Dispersion
import com.jcsoftdev.ui.glass.LiquidGlass
import com.jcsoftdev.ui.glass.LiquidInteraction
import com.jcsoftdev.ui.glass.LiquidLens
import com.jcsoftdev.ui.glass.LiquidMotion
import com.jcsoftdev.ui.glass.LiquidProfile
import com.jcsoftdev.ui.glass.LiquidShadow
import com.jcsoftdev.ui.glass.LiquidSpecular
import com.jcsoftdev.ui.glass.LiquidTint
import com.jcsoftdev.ui.glass.RefractionLens
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

/** The lens the playground offers: none (the base material), a [RefractionLens] with one of its profiles, or a [CrystalLens]. */
enum class LensChoice(
    val label: String,
) {
    None("None"),
    Rim("Rim"),
    Full("Full"),
    Dome("Dome"),
    Crystal("Crystal"),
}

/** The interaction the playground offers: none (a static surface), [LiquidInteraction.Press] or [LiquidInteraction.Drag]. */
enum class InteractionChoice {
    None,
    Press,
    Drag,
}

/**
 * Every [LiquidGlass] field as the plain numbers the sliders edit. Lengths are dp values; [frost] and [saturation] are null while
 * they follow the material token. [dispersion] 0 means the lens has no [Dispersion].
 */
data class PlaygroundParams(
    val lens: LensChoice = LensChoice.Full,
    val refraction: Float = 1f,
    val bevel: Float = 22f,
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
    val interaction: InteractionChoice = InteractionChoice.Press,
    val motion: MotionChoice = MotionChoice.Standard,
    val blend: Float = 24f,
) {
    fun toMaterial(): LiquidGlass =
        LiquidGlass(
            lens = toLens(),
            interaction = toInteraction(),
            bevelWidth = bevel.dp,
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
            blend = blend.dp,
        )

    private fun toLens(): LiquidLens? =
        when (lens) {
            LensChoice.None -> null
            LensChoice.Rim -> RefractionLens(refraction, LiquidProfile.Rim, toDispersion())
            LensChoice.Full -> RefractionLens(refraction, LiquidProfile.Full, toDispersion())
            LensChoice.Dome -> RefractionLens(refraction, LiquidProfile.Dome, toDispersion())
            LensChoice.Crystal -> CrystalLens(refraction, toDispersion())
        }

    private fun toDispersion(): Dispersion? = if (dispersion > 0f) Dispersion(dispersion) else null

    private fun toInteraction(): LiquidInteraction? =
        when (interaction) {
            InteractionChoice.None -> null
            InteractionChoice.Press -> LiquidInteraction.Press(motion.motion)
            InteractionChoice.Drag -> LiquidInteraction.Drag(motion.motion)
        }

    /** The `LiquidGlass.Regular.copy(...)` call that reproduces this look: only the fields that differ from the kit default. */
    fun toSnippet(): String {
        val d = Kit
        val args = mutableListOf<String>()
        if (lens != d.lens || refraction != d.refraction || dispersion != d.dispersion) args += "lens = ${lensCode()}"
        if (interaction != d.interaction || motion != d.motion) args += "interaction = ${interactionCode()}"
        if (bevel != d.bevel) args += "bevelWidth = ${dp(bevel)}"
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
        if (blend != d.blend) args += "blend = ${dp(blend)}"
        if (args.isEmpty()) return "LiquidGlass.Regular"
        return "LiquidGlass.Regular.copy(\n" + args.joinToString("") { "    $it,\n" } + ")"
    }

    private fun lensCode(): String =
        when (lens) {
            LensChoice.None -> "null"
            LensChoice.Crystal -> {
                val parts = mutableListOf<String>()
                if (refraction != CrystalLens().refraction) parts += "refraction = ${f(refraction)}"
                dispersionCode()?.let { parts += it }
                "CrystalLens(${parts.joinToString()})"
            }
            else -> {
                val parts = mutableListOf<String>()
                if (refraction != 1f) parts += "refraction = ${f(refraction)}"
                if (lens != LensChoice.Full) parts += "profile = LiquidProfile.${lens.name}"
                dispersionCode()?.let { parts += it }
                "RefractionLens(${parts.joinToString()})"
            }
        }

    private fun dispersionCode(): String? =
        when {
            dispersion <= 0f -> null
            dispersion == Dispersion().amount -> "dispersion = Dispersion()"
            else -> "dispersion = Dispersion(${f(dispersion)})"
        }

    private fun interactionCode(): String {
        val spring = if (motion == MotionChoice.Standard) "" else motion.code
        return when (interaction) {
            InteractionChoice.None -> "null"
            InteractionChoice.Press -> "LiquidInteraction.Press($spring)"
            InteractionChoice.Drag -> "LiquidInteraction.Drag($spring)"
        }
    }

    companion object {
        /** What [LiquidGlass.Regular] is, in playground units. */
        val Kit: PlaygroundParams = PlaygroundParams()

        /** The playground starts on the Crystal lens with the drag squash, so the panel flexes while it is moved. */
        val Initial: PlaygroundParams = from(LiquidGlass.Crystal)

        fun from(material: LiquidGlass): PlaygroundParams {
            val lens = material.lens
            val interaction = material.interaction
            return PlaygroundParams(
                lens =
                    when (lens) {
                        null -> LensChoice.None
                        is CrystalLens -> LensChoice.Crystal
                        is RefractionLens ->
                            when (lens.profile) {
                                LiquidProfile.Rim -> LensChoice.Rim
                                LiquidProfile.Full -> LensChoice.Full
                                LiquidProfile.Dome -> LensChoice.Dome
                            }
                    },
                refraction = lens?.refraction ?: 1f,
                bevel = material.bevelWidth.value,
                dispersion = lens?.dispersion?.amount ?: 0f,
                frost = material.frost.takeIf { it != Dp.Unspecified }?.value,
                saturation = material.saturation,
                brightness = material.brightness,
                tintColor = material.tint.color,
                tintAmount = material.tint.amount,
                rim = material.rim,
                specularIntensity = material.specular.intensity,
                specularAngle = material.specular.angleDegrees,
                fresnel = material.fresnel,
                grain = material.grain,
                opacity = material.opacity,
                shadowOpacity = material.shadow.opacity,
                shadowSpread = material.shadow.spread.value,
                shadowOffsetY = material.shadow.offsetY.value,
                interaction =
                    when (interaction) {
                        null -> InteractionChoice.None
                        is LiquidInteraction.Drag -> InteractionChoice.Drag
                        is LiquidInteraction.Press -> InteractionChoice.Press
                    },
                motion =
                    when {
                        interaction == null -> MotionChoice.Standard
                        interaction.motion == null -> MotionChoice.Off
                        interaction.motion == LiquidMotion.Playful -> MotionChoice.Playful
                        else -> MotionChoice.Standard
                    },
                blend = material.blend.value,
            )
        }
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
