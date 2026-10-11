package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

public enum class AvatarSize { Md, Lg }

private val MdText = UiTypography.chipText.copy(fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.02.em)
private val LgText = UiTypography.chipText.copy(fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.02.em)

/**
 * Round avatar showing the initials of [name], which is also its accessible name.
 * [image] is drawn over the initials so a missing or still-loading picture falls back to them; the kit loads no images itself.
 */
@Composable
public fun Avatar(
    name: String,
    modifier: Modifier = Modifier,
    size: AvatarSize = AvatarSize.Md,
    highlighted: Boolean = false,
    image: (@Composable () -> Unit)? = null,
) {
    val colors = UiTheme.colors
    val initials = remember(name) { initialsOf(name) }
    Box(
        modifier =
            modifier
                .clearAndSetSemantics {
                    contentDescription = name
                    role = Role.Image
                }.size(if (size == AvatarSize.Md) 26.dp else 32.dp)
                .clip(CircleShape)
                .background(if (highlighted) colors.accent else colors.sunken),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            initials,
            style = if (size == AvatarSize.Md) MdText else LgText,
            color = if (highlighted) colors.onAccent else colors.ink2,
            textAlign = TextAlign.Center,
            maxLines = 1,
        )
        image?.invoke()
    }
}

/** One word gives its first two letters; several give the first letter of the first and last word. */
internal fun initialsOf(name: String): String {
    val words = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    return when (words.size) {
        0 -> ""
        1 -> words[0].leadingChars(2)
        else -> words.first().leadingChars(1) + words.last().leadingChars(1)
    }.uppercase()
}

private fun String.leadingChars(count: Int): String {
    var end = 0
    var taken = 0
    while (end < length && taken < count) {
        end += if (this[end].isHighSurrogate() && end + 1 < length) 2 else 1
        taken++
    }
    return substring(0, end)
}
