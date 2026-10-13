package com.jcsoftdev.ui.glass

import org.jetbrains.skia.Bitmap
import org.jetbrains.skia.Paint
import org.jetbrains.skia.Rect
import org.jetbrains.skia.RuntimeEffect
import org.jetbrains.skia.RuntimeShaderBuilder
import org.jetbrains.skia.Surface
import kotlin.math.hypot
import kotlin.test.Test
import kotlin.test.assertTrue

/** Runs the dispersive merge program over a plain gray backdrop: alpha is the merged coverage. */
class MergeShaderTest {
    private val width = 240
    private val height = 120
    private val content =
        RuntimeShaderBuilder(
            RuntimeEffect.makeForShader("half4 main(float2 c) { return half4(c.x / 240.0, c.y / 120.0, 0.5, 1.0); }"),
        ).makeShader()

    // Two pills, 80x40 each, with a 24px gap between them (x 20..100 and 124..204), center line y = 60.
    private val pills = floatArrayOf(60f, 60f, 40f, 20f, 20f, 164f, 60f, 40f, 20f, 20f)

    private fun render(
        blend: Float,
        shapes: FloatArray = pills,
        count: Int = shapes.size / 5,
    ): Bitmap {
        val builder = RuntimeShaderBuilder(RuntimeEffect.makeForShader(Dispersion().mergeProgram.program.source))
        builder.child("content", content)
        builder.uniform("boxes", shapes.boxes())
        builder.uniform("roundness", shapes.roundness())
        builder.uniform("count", count.toFloat())
        builder.uniform("blendK", blend)
        builder.uniform("strength", 12f)
        builder.uniform("rimDepth", 14f)
        builder.uniform("sat", 1f)
        builder.uniform("veilEdge", 1f)
        builder.uniform("bounds", 0f, 0f, width.toFloat(), height.toFloat())
        val surface = Surface.makeRasterN32Premul(width, height)
        surface.canvas.drawRect(Rect.makeWH(width.toFloat(), height.toFloat()), Paint().apply { shader = builder.makeShader() })
        return Bitmap.makeFromImage(surface.makeImageSnapshot())
    }

    private fun Bitmap.alpha(
        x: Int,
        y: Int,
    ) = (getColor(x, y) ushr 24) and 0xFF

    @Test fun separatePillsLeaveTheGapEmptyAndABlendedUnionBridgesIt() {
        val apart = render(blend = 0.0001f)
        val joined = render(blend = 64f)
        assertTrue(apart.alpha(112, 60) < 20, "gap without blend: ${apart.alpha(112, 60)}")
        assertTrue(joined.alpha(112, 60) > 200, "neck with blend: ${joined.alpha(112, 60)}")
        assertTrue(joined.alpha(60, 60) > 250 && apart.alpha(60, 60) > 250, "inside a pill stays covered")
        assertTrue(joined.alpha(10, 10) < 5, "far outside stays empty")
    }

    @Test fun theMergedFieldIsSmoothAcrossTheSeam() {
        val joined = render(blend = 64f)
        // Walk across the neck: coverage never jumps by more than a few steps of an anti-aliased edge between neighbours.
        for (y in 20..100) {
            val jump = hypot(0f, (joined.alpha(112, y) - joined.alpha(112, y - 1)).toFloat())
            assertTrue(jump < 120f, "alpha jump $jump at y=$y")
        }
    }

    @Test fun theCountLimitsWhichShapesAreDrawn() {
        val one = render(blend = 64f, count = 1)
        assertTrue(one.alpha(60, 60) > 250)
        assertTrue(one.alpha(164, 60) < 5, "the second shape is ignored")
    }

    @Test fun refractionInsideTheMergedShapeDisplacesTheEdgeButNotTheMiddle() {
        val joined = render(blend = 64f)

        fun shiftX(
            x: Int,
            y: Int,
        ) = ((joined.getColor(x, y) shr 16) and 0xFF) * width / 255f - x
        assertTrue(shiftX(23, 60) > 3f, "edge reads further in: ${shiftX(23, 60)}")
        assertTrue(kotlin.math.abs(shiftX(60, 60)) < 2f, "middle: ${shiftX(60, 60)}")
    }
}
