package com.jcsoftdev.ui.forms

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.theme.UiTheme

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

/** Colors of a [Field]: label, required marker, optional label, helper text and error. */
@Immutable
public class FieldColors(
    public val label: Color,
    public val required: Color,
    public val optional: Color,
    public val description: Color,
    public val error: Color,
) {
    /** Copy with selected colors replaced. */
    public fun copy(
        label: Color = this.label,
        required: Color = this.required,
        optional: Color = this.optional,
        description: Color = this.description,
        error: Color = this.error,
    ): FieldColors = FieldColors(label, required, optional, description, error)
}

/** Default colors, text styles and spacing of [Field]. */
public object FieldDefaults {
    /** Colors in the active theme. */
    @Composable
    @ReadOnlyComposable
    public fun colors(): FieldColors {
        val c = UiTheme.colors
        return FieldColors(c.ink2, c.danger, c.ink3, c.ink3, c.danger)
    }

    /** Label style. */
    public val labelStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.control.copy(fontWeight = FontWeight.SemiBold)

    /** Helper text and optional marker style. */
    public val descriptionStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.meta

    /** Error message style. */
    public val errorStyle: TextStyle
        @Composable @ReadOnlyComposable
        get() = UiTheme.typography.meta.copy(fontWeight = FontWeight.SemiBold)

    /** Gap between the label, the control, the helper text and the error. */
    public val spacing: Dp = 5.dp
}

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
    colors: FieldColors = FieldDefaults.colors(),
    labelStyle: TextStyle = FieldDefaults.labelStyle,
    descriptionStyle: TextStyle = FieldDefaults.descriptionStyle,
    errorStyle: TextStyle = FieldDefaults.errorStyle,
    spacing: Dp = FieldDefaults.spacing,
    content: @Composable () -> Unit,
) {
    val info = remember(label, description, error) { FieldInfo(label, description, error) }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(spacing)) {
        Row(horizontalArrangement = Arrangement.spacedBy(UiTheme.sizes.space4)) {
            Text(label, style = labelStyle, color = colors.label)
            if (required) Text("*", style = labelStyle, color = colors.required)
            if (!required && optionalLabel != null) Text(optionalLabel, style = descriptionStyle, color = colors.optional)
        }
        CompositionLocalProvider(LocalFieldInfo provides info, content = content)
        if (description != null) Text(description, style = descriptionStyle, color = colors.description)
        if (error != null) {
            Text(
                error,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                style = errorStyle,
                color = colors.error,
            )
        }
    }
}
