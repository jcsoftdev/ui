package com.jcsoftdev.ui.states

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiTheme

/** Default metrics of [ErrorState]; colors and text styles come from [EmptyStateDefaults]. */
public object ErrorStateDefaults {
    /** Style of the correlation code; the theme `meta`. */
    public val correlationStyle: TextStyle
        @Composable
        get() = UiTheme.typography.meta
}

/**
 * Failure placeholder: a plain-language [title] (heading), an optional [description], a correlation code for support and a
 * retry button when [onRetry] is given. The text block is an assertive live region, so screen readers announce it when it appears;
 * the button stays separately focusable. Never pass a raw exception message.
 *
 * ```
 * ErrorState(
 *     title = "No pudimos cargar la agenda",
 *     description = "Tus citas están a salvo. Revisa tu conexión e inténtalo de nuevo.",
 *     correlationId = "7f3a-91c2",
 *     correlationLabel = "ID:",
 *     onRetry = viewModel::reload,
 *     retryLabel = "Reintentar",
 * )
 * ```
 *
 * Restyle through [colors], [contentPadding] and the text styles (start from [EmptyStateDefaults] and [ErrorStateDefaults]).
 */
@Composable
public fun ErrorState(
    title: String,
    modifier: Modifier = Modifier,
    description: String? = null,
    correlationId: String? = null,
    correlationLabel: String? = null,
    onRetry: (() -> Unit)? = null,
    retryLabel: String = UiTheme.strings.retry,
    colors: EmptyStateColors = EmptyStateDefaults.colors(),
    contentPadding: PaddingValues = EmptyStateDefaults.contentPadding,
    titleStyle: TextStyle = EmptyStateDefaults.titleStyle,
    descriptionStyle: TextStyle = EmptyStateDefaults.descriptionStyle,
    correlationStyle: TextStyle = ErrorStateDefaults.correlationStyle,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(contentPadding),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(EmptyStateDefaults.spacing),
    ) {
        Column(
            Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Assertive },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(EmptyStateDefaults.spacing),
        ) {
            Text(title, Modifier.semantics { heading() }, titleStyle, colors.title, TextAlign.Center)
            if (description != null) Text(description, style = descriptionStyle, color = colors.description, textAlign = TextAlign.Center)
            if (correlationId != null) {
                val code = if (correlationLabel != null) "$correlationLabel $correlationId" else correlationId
                Text(code, style = correlationStyle, color = colors.description, textAlign = TextAlign.Center)
            }
        }
        if (onRetry != null) Button(retryLabel, onRetry)
    }
}
