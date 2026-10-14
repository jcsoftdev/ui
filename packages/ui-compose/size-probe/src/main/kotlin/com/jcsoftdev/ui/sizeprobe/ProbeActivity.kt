package com.jcsoftdev.ui.sizeprobe

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.jcsoftdev.ui.theme.UiTheme

/**
 * The single entry point R8 keeps. Every flavour shares this Compose activity on a kit composable, so Compose, activity-compose
 * and the kit's theme are in the `none` baseline and only what ProbeContent reaches is charged to the flavour's artifact.
 */
class ProbeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { UiTheme { ProbeContent() } }
    }
}
