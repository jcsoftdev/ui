package com.jcsoftdev.ui.forms

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

/** What a [Field] tells the control inside it, so the control carries the label and error in its own semantics. */
@Immutable
internal class FieldInfo(
    val label: String,
    val description: String?,
    val error: String?,
) {
    /** One description for screen readers: label, then the helper text. */
    val spoken: String = if (description == null) label else "$label. $description"
}

internal val LocalFieldInfo = compositionLocalOf<FieldInfo?> { null }

/**
 * Label, helper text and error message around one control. The error is announced as a polite live region and the
 * control inside reads the label, the helper text and the error as its own semantics. [optionalLabel] (for example
 * "optional") marks a non-required field; it is a parameter because the kit ships no copy.
 */
@Composable
public fun Field(
    label: String,
    modifier: Modifier = Modifier,
    description: String? = null,
    error: String? = null,
    required: Boolean = false,
    optionalLabel: String? = null,
    content: @Composable () -> Unit,
) {
    val colors = UiTheme.colors
    val info = remember(label, description, error) { FieldInfo(label, description, error) }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label, style = UiTypography.control.copy(fontWeight = FontWeight.SemiBold), color = colors.ink2)
            if (required) Text("*", style = UiTypography.control, color = colors.danger)
            if (!required && optionalLabel != null) Text(optionalLabel, style = UiTypography.meta, color = colors.ink3)
        }
        CompositionLocalProvider(LocalFieldInfo provides info, content = content)
        if (description != null) Text(description, style = UiTypography.meta, color = colors.ink3)
        if (error != null) {
            Text(
                error,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                style = UiTypography.meta.copy(fontWeight = FontWeight.SemiBold),
                color = colors.danger,
            )
        }
    }
}
