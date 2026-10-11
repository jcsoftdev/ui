package com.jcsoftdev.ui.baselineprofile

import android.content.Intent
import androidx.benchmark.macro.MacrobenchmarkScope
import androidx.benchmark.macro.junit4.BaselineProfileRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Generates the baseline profile by driving every gallery of the sample app: cold start, scrolling the atoms, forms,
 * states and icons screens, and opening and closing the sheet, dialog, menu, select and toasts on the overlays screen.
 * Each gallery is a separate launch of `SampleActivity` with a `screen` extra, so every kit surface is exercised.
 */
@RunWith(AndroidJUnit4::class)
class BaselineProfileGenerator {
    @get:Rule
    val rule = BaselineProfileRule()

    @Test
    fun generate() =
        rule.collect(
            packageName = SAMPLE_PACKAGE,
            includeInStartupProfile = true,
        ) {
            pressHome()
            startGallery(null)
            scrollGallery()

            startGallery("forms")
            scrollGallery()

            startGallery("states")
            scrollGallery()

            startGallery("icons")
            scrollGallery()

            startGallery("custom")
            scrollGallery()

            startGallery("headless")
            scrollGallery()

            startGallery("overlays")
            overlaysJourney()
        }

    private fun MacrobenchmarkScope.startGallery(screen: String?) {
        val intent =
            Intent().apply {
                setClassName(SAMPLE_PACKAGE, "$SAMPLE_PACKAGE.SampleActivity")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                if (screen != null) putExtra("screen", screen)
            }
        startActivityAndWait(intent)
    }

    /** Swipes by coordinates: Compose scroll containers do not emit the scroll event `UiObject2.fling` waits for. */
    private fun MacrobenchmarkScope.swipeVertically(up: Boolean) {
        val x = device.displayWidth / 2
        val from = (device.displayHeight * if (up) 0.75 else 0.3).toInt()
        val to = (device.displayHeight * if (up) 0.3 else 0.75).toInt()
        device.swipe(x, from, x, to, SWIPE_STEPS)
        device.waitForIdle()
    }

    private fun MacrobenchmarkScope.scrollGallery() {
        repeat(3) { swipeVertically(up = true) }
        repeat(3) { swipeVertically(up = false) }
    }

    private fun MacrobenchmarkScope.overlaysJourney() {
        tapText("Hoja con lista larga")
        device.wait(Until.hasObject(By.text("Agregar a la cola")), UI_TIMEOUT_MS)
        swipeVertically(up = true)
        device.pressBack()
        device.waitForIdle()

        tapText("Diálogo de confirmación")
        device.wait(Until.hasObject(By.text("¿Cancelar la cita?")), UI_TIMEOUT_MS)
        device.pressBack()
        device.waitForIdle()

        tapText("Menú")
        device.wait(Until.hasObject(By.text("Duplicar")), UI_TIMEOUT_MS)
        device.pressBack()
        device.waitForIdle()

        tapText("Toast")
        device.wait(Until.hasObject(By.text("Cita guardada")), UI_TIMEOUT_MS)
        tapText("Toast con acción")
        device.waitForIdle()

        tapText("Elige un barbero")
        device.wait(Until.hasObject(By.text("Barbero 2")), UI_TIMEOUT_MS)
        device.pressBack()
        device.waitForIdle()
    }

    private fun MacrobenchmarkScope.tapText(text: String) {
        var attempts = 0
        while (!device.hasObject(By.text(text)) && attempts++ < MAX_SCROLLS) swipeVertically(up = true)
        device.wait(Until.findObject(By.text(text)), UI_TIMEOUT_MS)?.click()
        device.waitForIdle()
    }

    private companion object {
        const val SAMPLE_PACKAGE = "com.jcsoftdev.ui.sample"
        const val UI_TIMEOUT_MS = 3_000L
        const val SWIPE_STEPS = 20
        const val MAX_SCROLLS = 4
    }
}
