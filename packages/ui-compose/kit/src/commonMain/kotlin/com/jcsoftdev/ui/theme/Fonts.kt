package com.jcsoftdev.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.jcsoftdev.ui.resources.Res
import com.jcsoftdev.ui.resources.figtree_bold
import com.jcsoftdev.ui.resources.figtree_extrabold
import com.jcsoftdev.ui.resources.figtree_medium
import com.jcsoftdev.ui.resources.figtree_regular
import com.jcsoftdev.ui.resources.figtree_semibold
import org.jetbrains.compose.resources.Font

private const val MIN_LINE_HEIGHT_RATIO = 1.2f

@Composable
internal fun rememberFigtree(): FontFamily {
    val regular = Font(Res.font.figtree_regular, FontWeight.Normal)
    val medium = Font(Res.font.figtree_medium, FontWeight.Medium)
    val semiBold = Font(Res.font.figtree_semibold, FontWeight.SemiBold)
    val bold = Font(Res.font.figtree_bold, FontWeight.Bold)
    val extraBold = Font(Res.font.figtree_extrabold, FontWeight.ExtraBold)
    return remember(regular, medium, semiBold, bold, extraBold) {
        FontFamily(regular, medium, semiBold, bold, extraBold)
    }
}

/** Some tokens set the line height equal to the font size, which clips accents and descenders. */
internal fun TextStyle.withMinLineHeight(): TextStyle =
    if (fontSize.isSp && lineHeight.isSp && lineHeight.value < fontSize.value * MIN_LINE_HEIGHT_RATIO) {
        copy(lineHeight = (fontSize.value * MIN_LINE_HEIGHT_RATIO).sp)
    } else {
        this
    }
