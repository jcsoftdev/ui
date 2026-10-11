package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import com.jcsoftdev.ui.theme.UiTheme

/** Color that [Text] and icon slots use when none is given; atoms with a colored surface provide their own. */
public val LocalContentColor: ProvidableCompositionLocal<Color> = compositionLocalOf { Color.Unspecified }

/** Text in a token style with the theme font. [color] defaults to [LocalContentColor], then to the theme ink. */
@Composable
public fun Text(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = UiTheme.typography.body,
    color: Color = Color.Unspecified,
    textAlign: TextAlign = TextAlign.Unspecified,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
) {
    val themed = UiTheme.text(style)
    val resolved = color.takeOrElse { LocalContentColor.current.takeOrElse { UiTheme.colors.ink } }
    val finalStyle = remember(themed, resolved, textAlign) { themed.copy(color = resolved, textAlign = textAlign) }
    BasicText(text, modifier, finalStyle, overflow = overflow, maxLines = maxLines)
}

private inline fun Color.takeOrElse(block: () -> Color): Color = if (this != Color.Unspecified) this else block()
