package com.jcsoftdev.ui.sample

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.jcsoftdev.ui.foundation.ProvideAndroidBack

class SampleActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val screen = intent.getStringExtra("screen")
        setContent {
            ProvideAndroidBack {
                when (screen) {
                    "forms" -> FormsGallery()
                    "overlays" -> OverlaysGallery()
                    "icons" -> IconsGallery()
                    "custom" -> CustomThemeGallery()
                    "headless" -> HeadlessGallery()
                    "states" -> StatesGallery()
                    else -> AtomsGallery()
                }
            }
        }
    }
}
