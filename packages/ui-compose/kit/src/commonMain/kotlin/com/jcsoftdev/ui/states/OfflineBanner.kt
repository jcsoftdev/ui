package com.jcsoftdev.ui.states

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.containers.Banner
import com.jcsoftdev.ui.containers.BannerColors
import com.jcsoftdev.ui.containers.BannerDefaults
import com.jcsoftdev.ui.containers.BannerTone
import com.jcsoftdev.ui.theme.UiTheme

/** Default style of the [OfflineBanner] counter; colors come from [BannerDefaults]. */
public object OfflineBannerDefaults {
    /** Style of the queued-changes counter; the theme `chipText` in semibold. */
    public val counterStyle: TextStyle
        @Composable
        get() = UiTheme.typography.chipText.copy(fontWeight = FontWeight.SemiBold)
}

/**
 * Warning [Banner] shown while the device is offline: [message] is a polite live region and [queuedChanges] (when above zero)
 * appears at the end as a counter that reads as [queuedLabel] (already localized, for example "3 cambios en cola") to screen readers.
 *
 * ```
 * if (!online) OfflineBanner("Sin conexión. Guardaremos tus cambios.", queuedChanges = pending, queuedLabel = "$pending cambios en cola")
 * ```
 */
@Composable
public fun OfflineBanner(
    message: String,
    modifier: Modifier = Modifier,
    queuedChanges: Int = 0,
    queuedLabel: String? = null,
    colors: BannerColors = BannerDefaults.colors(BannerTone.Warning),
    counterStyle: TextStyle = OfflineBannerDefaults.counterStyle,
) {
    Banner(
        message = message,
        modifier = modifier,
        tone = BannerTone.Warning,
        colors = colors,
        action =
            if (queuedChanges > 0) {
                {
                    Text(
                        queuedChanges.toString(),
                        Modifier.semantics {
                            contentDescription = queuedLabel ?: queuedChanges.toString()
                        },
                        counterStyle,
                        colors.content,
                    )
                }
            } else {
                null
            },
    )
}
