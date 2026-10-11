package com.jcsoftdev.ui.sample

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.jcsoftdev.ui.foundation.BackHandler
import com.jcsoftdev.ui.foundation.BackPriority
import com.jcsoftdev.ui.foundation.ProvideAndroidBack
import com.jcsoftdev.ui.foundation.pressScale
import com.jcsoftdev.ui.theme.UiShapes
import com.jcsoftdev.ui.theme.UiTheme
import com.jcsoftdev.ui.theme.UiTypography

class SampleActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ProvideAndroidBack {
                UiTheme(accent = "#77D3AD") {
                    var open by remember { mutableStateOf(false) }
                    BackHandler(enabled = open, priority = BackPriority.SHEET) { open = false }
                    val source = remember { MutableInteractionSource() }
                    Box(Modifier.fillMaxSize().background(UiTheme.colors.bg), contentAlignment = Alignment.Center) {
                        Box(
                            Modifier
                                .size(width = 200.dp, height = 56.dp)
                                .pressScale(source)
                                .clip(UiShapes.control)
                                .background(UiTheme.colors.accent)
                                .clickable(source, null) { open = !open },
                            contentAlignment = Alignment.Center,
                        ) {
                            BasicText(if (open) "Back closes me" else "Press me", style = UiTheme.text(UiTypography.control))
                        }
                    }
                }
            }
        }
    }
}
