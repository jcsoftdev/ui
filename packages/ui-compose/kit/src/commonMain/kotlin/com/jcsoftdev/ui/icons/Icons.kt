package com.jcsoftdev.ui.icons

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * Namespace of the generated icon set (`Icons.Calendar`, ...). Names match the web icons.
 * Each icon is an extension property with its own lazily filled backing field in its own file, so R8
 * removes every icon an app does not reference.
 */
public object Icons

private const val VIEWPORT = 24f

/** Builds a Lucide-style icon: 24x24 viewport, 2px round stroke, no fill. Black so `Icon` tinting decides the color. */
internal fun lucideIcon(
    name: String,
    vararg paths: String,
): ImageVector {
    val builder = ImageVector.Builder(name, 24.dp, 24.dp, VIEWPORT, VIEWPORT)
    for (d in paths) {
        builder.addPath(
            pathData = PathParser().parsePathString(d).toNodes(),
            stroke = SolidColor(Color.Black),
            strokeLineWidth = 2f,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
        )
    }
    return builder.build()
}
