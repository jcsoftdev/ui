package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import com.jcsoftdev.ui.theme.UiTheme

/** Default thickness of [Divider] and [VerticalDivider]; the theme `borderWidth`. */
public object DividerDefaults {
    /** Line thickness. */
    public val thickness: Dp
        @Composable @ReadOnlyComposable
        get() = UiTheme.sizes.borderWidth
}

/** Decorative 1dp horizontal rule in the hairline token; invisible to accessibility services. */
@Composable
public fun Divider(
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    thickness: Dp = DividerDefaults.thickness,
) {
    Box(modifier.fillMaxWidth().height(thickness).background(color.takeIf { it != Color.Unspecified } ?: UiTheme.colors.hair))
}

/** Vertical counterpart of [Divider]. */
@Composable
public fun VerticalDivider(
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    thickness: Dp = DividerDefaults.thickness,
) {
    Box(modifier.fillMaxHeight().width(thickness).background(color.takeIf { it != Color.Unspecified } ?: UiTheme.colors.hair))
}
