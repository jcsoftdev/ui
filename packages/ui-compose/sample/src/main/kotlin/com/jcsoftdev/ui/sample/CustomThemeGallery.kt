package com.jcsoftdev.ui.sample

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jcsoftdev.ui.atoms.Avatar
import com.jcsoftdev.ui.atoms.Button
import com.jcsoftdev.ui.atoms.ButtonDefaults
import com.jcsoftdev.ui.atoms.ButtonSize
import com.jcsoftdev.ui.atoms.ButtonVariant
import com.jcsoftdev.ui.atoms.Checkbox
import com.jcsoftdev.ui.atoms.Chip
import com.jcsoftdev.ui.atoms.ChipDefaults
import com.jcsoftdev.ui.atoms.ChipTone
import com.jcsoftdev.ui.atoms.Progress
import com.jcsoftdev.ui.atoms.Switch
import com.jcsoftdev.ui.atoms.Text
import com.jcsoftdev.ui.forms.Field
import com.jcsoftdev.ui.forms.Input
import com.jcsoftdev.ui.forms.InputDefaults
import com.jcsoftdev.ui.navigation.Segmented
import com.jcsoftdev.ui.navigation.SegmentedOption
import com.jcsoftdev.ui.theme.ThemeShapes
import com.jcsoftdev.ui.theme.ThemeSizes
import com.jcsoftdev.ui.theme.ThemeTypography
import com.jcsoftdev.ui.theme.UiColors
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.copy

private val Ink = Color(0xFF1B1A17)
private val Paper = Color(0xFFF4EFE6)

/** A deliberately different look: warm paper, ink-blue accent, sharp corners, serif type, taller controls. */
private val InkColors =
    UiColors.Light.copy(
        bg = Paper,
        surface = Color(0xFFFFFBF2),
        surface2 = Color(0xFFE9E2D2),
        float = Color(0xFFFFFBF2),
        ink = Ink,
        ink2 = Color(0xFF45413A),
        ink3 = Color(0xFF6B6558),
        accent = Color(0xFF1F3A8A),
        onAccent = Color.White,
        accentInk = Color(0xFF1F3A8A),
        accentSoft = Color(0xFFDDE4F7),
        lineControl = Color(0xFF8A8372),
    )

private val InkShapes =
    ThemeShapes.Default.copy(
        control = CutCornerShape(topStart = 10.dp, bottomEnd = 10.dp),
        chip = RoundedCornerShape(2.dp),
        card = RoundedCornerShape(2.dp),
    )

private val InkSizes = ThemeSizes.Default.copy(controlHeight = 44.dp, controlHeightSm = 36.dp)

private val InkType =
    ThemeTypography.Default.copy(
        control = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold, lineHeight = 22.sp),
        pageTitle = TextStyle(fontSize = 30.sp, fontWeight = FontWeight.Bold, lineHeight = 36.sp),
        body = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Normal, lineHeight = 23.sp),
    )

@Composable
fun CustomThemeGallery() {
    Column(Modifier.statusBarsPadding().verticalScroll(rememberScrollState())) {
        Showcase("Kit theme", custom = false)
        Showcase("Custom theme", custom = true)
    }
}

@Composable
private fun Showcase(
    title: String,
    custom: Boolean,
) {
    val content: @Composable () -> Unit = { Components(title) }
    if (custom) {
        UiTheme(
            dark = false,
            colors = InkColors,
            shapes = InkShapes,
            sizes = InkSizes,
            typography = InkType,
            fontFamily = FontFamily.Serif,
            content = content,
        )
    } else {
        UiTheme(dark = false, content = content)
    }
}

@Composable
private fun Components(title: String) {
    var on by remember { mutableStateOf(true) }
    var checked by remember { mutableStateOf(true) }
    var text by remember { mutableStateOf("") }
    var segment by remember { mutableStateOf<String?>("a") }
    Column(Modifier.background(UiTheme.colors.bg).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(title, style = UiTheme.typography.pageTitle)
        Text("The same components, restyled by the theme alone.")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button("Primary", {}, variant = ButtonVariant.Primary)
            Button("Secondary", {})
            Button("Small", {}, size = ButtonSize.Sm)
            Chip("Accent", tone = ChipTone.Accent)
            Chip("Square", square = true)
        }
        Text("Per-instance Defaults overrides", style = UiTheme.typography.rowTitle)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                "Forest",
                {},
                colors = ButtonDefaults.colors(ButtonVariant.Primary).copy(container = Color(0xFF166534)),
                shape = RoundedCornerShape(50),
                contentPadding = PaddingValues(horizontal = 24.dp),
            )
            Chip("Outlined", colors = ChipDefaults.colors(ChipTone.Outline).copy(content = Color(0xFFB91C1C)), shape = CutCornerShape(6.dp))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Avatar("Ana Ruiz", highlighted = true)
            Switch(on, { on = it }, contentDescription = "Notifications")
            Switch(on, { on = it }, contentDescription = "Large", trackSize = DpSize(52.dp, 30.dp))
            Checkbox(checked, { checked = it }, contentDescription = "Accept")
        }
        Progress(0.6f, max = 1f)
        Field("Name") { Input(text, { text = it }, placeholder = "Type here") }
        Field("Name (square inputs)") {
            Input(
                text,
                {
                    text = it
                },
                placeholder = "Type here",
                shape =
                    RoundedCornerShape(
                        0.dp,
                    ),
                colors = InputDefaults.colors().copy(focusedBorder = Color(0xFFB91C1C)),
            )
        }
        Segmented(listOf(SegmentedOption("a", "Day"), SegmentedOption("b", "Week")), segment, { segment = it })
    }
}
