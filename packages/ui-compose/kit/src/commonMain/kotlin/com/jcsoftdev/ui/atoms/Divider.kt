package com.jcsoftdev.ui.atoms

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.theme.UiTheme

/** Decorative 1dp horizontal rule in the hairline token; invisible to accessibility services. */
@Composable
public fun Divider(
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
) {
    Box(modifier.fillMaxWidth().height(1.dp).background(color.takeIf { it != Color.Unspecified } ?: UiTheme.colors.hair))
}

/** Vertical counterpart of [Divider]. */
@Composable
public fun VerticalDivider(
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
) {
    Box(modifier.fillMaxHeight().width(1.dp).background(color.takeIf { it != Color.Unspecified } ?: UiTheme.colors.hair))
}
