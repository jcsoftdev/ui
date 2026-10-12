package com.jcsoftdev.ui.glass

import org.jetbrains.skia.Bitmap
import org.jetbrains.skia.Paint
import org.jetbrains.skia.Rect
import org.jetbrains.skia.RuntimeEffect
import org.jetbrains.skia.RuntimeShaderBuilder
import org.jetbrains.skia.Surface
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.test.Test
import kotlin.test.assertTrue

/** Runs [LENS_SHADER] on its own over a coordinate-encoding backdrop (red = x, green = y), with no tint or blur in the way. */
class LensShaderTest {
    private val width = 200
    private val height = 120
    private val content =
        RuntimeShaderBuilder(
            RuntimeEffect.makeForShader("half4 main(float2 c) { return half4(c.x / 200.0, c.y / 120.0, 0.0, 1.0); }"),
        ).makeShader()

    private fun lens(
        tl: Float = 0f,
        tr: Float = 0f,
        br: Float = 0f,
        bl: Float = 0f,
        dispersion: Float = 0.06f,
    ): Bitmap {
        val builder = RuntimeShaderBuilder(RuntimeEffect.makeForShader(LENS_SHADER))
        builder.child("content", content)
        builder.uniform("size", 160f, 80f)
        builder.uniform("origin", 20f, 20f)
        builder.uniform("radii", tl, tr, br, bl)
        builder.uniform("depth", 24f)
        builder.uniform("strength", 30f)
        builder.uniform("dispersion", dispersion)
        builder.uniform("sat", 1f)
        builder.uniform("bounds", 0f, 0f, width.toFloat(), height.toFloat())
        val surface = Surface.makeRasterN32Premul(width, height)
        surface.canvas.drawRect(Rect.makeWH(width.toFloat(), height.toFloat()), Paint().apply { shader = builder.makeShader() })
        return Bitmap.makeFromImage(surface.makeImageSnapshot())
    }

    private fun Bitmap.channel(
        x: Int,
        y: Int,
        shift: Int,
    ) = (getColor(x, y) shr shift) and 0xFF

    private fun Bitmap.red(
        x: Int,
        y: Int,
    ) = channel(x, y, 16)

    private fun Bitmap.green(
        x: Int,
        y: Int,
    ) = channel(x, y, 8)

    private fun Bitmap.blue(
        x: Int,
        y: Int,
    ) = channel(x, y, 0)

    /** How far, in backdrop pixels, the lens moved what this pixel shows. */
    private fun Bitmap.displacement(
        x: Int,
        y: Int,
    ): Float = hypot(red(x, y) * width / 255f - x, green(x, y) * height / 255f - y)

    @Test fun dispersionMovesTheRedChannelAtTheEdge() {
        // Red is sampled further along the displacement than green, so with dispersion it differs from the dispersion-free red.
        assertTrue(lens().red(22, 60) - lens(dispersion = 0f).red(22, 60) >= 1, "red must read further in with dispersion")
        assertTrue(lens().green(22, 60) == lens(dispersion = 0f).green(22, 60), "green is the undispersed channel")
    }

    @Test fun theCenterIsNotDisplaced() {
        val out = lens()
        assertTrue(out.displacement(100, 60) < 1.5f, "center moved by ${out.displacement(100, 60)}")
    }

    @Test fun theEdgeIsDisplacedInward() {
        val out = lens()
        // Pixel 2px inside the left edge reads from further to the right.
        assertTrue(out.red(22, 60) * width / 255f - 22 > 20f)
    }

    @Test fun eachCornerRadiusShapesItsOwnCorner() {
        val sharp = lens()
        val corners =
            listOf(
                Triple("top-left", 23 to 23, lens(tl = 40f)),
                Triple("top-right", 176 to 23, lens(tr = 40f)),
                Triple("bottom-right", 176 to 96, lens(br = 40f)),
                Triple("bottom-left", 23 to 96, lens(bl = 40f)),
            )
        for ((name, at, rounded) in corners) {
            val (x, y) = at
            // With a big radius the pixel sits outside the shape (full bend); a sharp corner has it 3px inside (less bend).
            assertTrue(
                rounded.displacement(x, y) > sharp.displacement(x, y) + 4f,
                "$name: rounded=${rounded.displacement(x, y)} sharp=${sharp.displacement(x, y)}",
            )
        }
        // A radius at one corner leaves the opposite corner alone.
        assertTrue(abs(lens(tl = 40f).displacement(176, 96) - sharp.displacement(176, 96)) < 1f)
    }
}
