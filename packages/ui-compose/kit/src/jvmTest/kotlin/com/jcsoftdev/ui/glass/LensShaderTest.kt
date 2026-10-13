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
        exponent: Float = 4f,
        veil: Boolean = false,
        profile: Float = 0f,
        band: Float = 0.3f,
        dome: Float = 0f,
        grain: Float = 0f,
        bright: Float = 0f,
        fresnel: Float = 0f,
        glow: Float = 0f,
    ): Bitmap {
        val builder = RuntimeShaderBuilder(RuntimeEffect.makeForShader(LENS_SHADER))
        builder.child("content", content)
        builder.uniform("size", 160f, 80f)
        builder.uniform("origin", 20f, 20f)
        builder.uniform("radii", tl, tr, br, bl)
        builder.uniform("exponent", exponent)
        builder.uniform("strength", 30f)
        builder.uniform("dispersion", dispersion)
        builder.uniform("sat", 1f)
        if (veil) {
            // A pure red dim whose strength depends only on the distance to the edge: red appears where the pixel is inside.
            builder.uniform("dim", 1f, 0f, 0f, 1f)
            builder.uniform("veilEdge", 0f)
            builder.uniform("rimDepth", 10f)
        }
        builder.uniform("profile", profile)
        builder.uniform("band", band)
        builder.uniform("dome", dome)
        builder.uniform("grain", grain)
        builder.uniform("bright", bright)
        builder.uniform("fresnel", fresnel)
        builder.uniform("glow", 100f, 60f, 40f, glow)
        builder.uniform("thickness", 1f)
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
        // The veil fades in with the distance to the edge: a pixel 3px inside a sharp corner is lightly dimmed (green drops), while
        // the same pixel outside a 40px rounded corner is not dimmed at all.
        val sharp = lens(veil = true)
        val corners =
            listOf(
                Triple("top-left", 23 to 23, lens(tl = 40f, veil = true)),
                Triple("top-right", 176 to 23, lens(tr = 40f, veil = true)),
                Triple("bottom-right", 176 to 96, lens(br = 40f, veil = true)),
                Triple("bottom-left", 23 to 96, lens(bl = 40f, veil = true)),
            )
        for ((name, at, rounded) in corners) {
            val (x, y) = at
            assertTrue(
                rounded.green(x, y) > sharp.green(x, y) + 15,
                "$name: rounded=${rounded.green(x, y)} sharp=${sharp.green(x, y)}",
            )
        }
        assertTrue(abs(lens(tl = 40f, veil = true).green(176, 96) - sharp.green(176, 96)) < 3)
    }

    private fun Bitmap.shift(
        x: Int,
        y: Int,
    ): Pair<Float, Float> = (red(x, y) * width / 255f - x) to (green(x, y) * height / 255f - y)

    @Test fun theRefractionHasNoCreaseAlongTheDiagonals() {
        // Walk across the top-left diagonal of a sharp card and of a pill-like ellipse, and across its center row. The edge
        // distance would flip direction there; the height field must not: neighbouring pixels move by almost the same vector.
        for (exponent in listOf(2f, 4f, 8f)) {
            val out = lens(exponent = exponent)
            val walks = listOf((26..90).map { it to 40 }, (24..60).map { it to it + 6 }.map { (x, y) -> y to x })
            for (walk in walks) {
                val shifts = walk.map { (x, y) -> out.shift(x, y) }
                for (i in 1 until shifts.size) {
                    val jump = hypot(shifts[i].first - shifts[i - 1].first, shifts[i].second - shifts[i - 1].second)
                    assertTrue(jump < 3f, "exponent $exponent at ${walk[i]}: jump $jump")
                }
            }
        }
    }

    @Test fun everyProfileIsCreaseFreeAlongTheDiagonals() {
        for (profile in listOf(0f, 1f, 2f)) {
            for (exponent in listOf(2f, 4f, 8f)) {
                val out = lens(exponent = exponent, profile = profile, band = 0.6f, dome = if (profile == 2f) 0.2f else 0.05f)
                val walks = listOf((26..90).map { it to 40 }, (24..60).map { it to it + 6 }.map { (x, y) -> y to x })
                for (walk in walks) {
                    val shifts = walk.map { (x, y) -> out.shift(x, y) }
                    for (i in 1 until shifts.size) {
                        val jump = hypot(shifts[i].first - shifts[i - 1].first, shifts[i].second - shifts[i - 1].second)
                        assertTrue(jump < 4f, "profile $profile exponent $exponent at ${walk[i]}: jump $jump")
                    }
                }
            }
        }
    }

    @Test fun theRimProfileRefractsOnlyABandAlongTheEdge() {
        val rim = lens(profile = 1f, band = 0.2f)
        assertTrue(rim.displacement(100, 60) < 1.5f, "center ${rim.displacement(100, 60)}")
        assertTrue(rim.displacement(80, 60) < 1.5f, "mid ${rim.displacement(80, 60)}")
        assertTrue(rim.displacement(22, 60) > 8f, "edge ${rim.displacement(22, 60)}")
        val full = lens(profile = 0f)
        assertTrue(full.displacement(40, 60) > rim.displacement(40, 60), "full reaches further in than rim")
    }

    @Test fun theDomeProfileMagnifiesTowardTheCenterWithoutABevelDirection() {
        val dome = lens(profile = 2f, dome = 0.2f)
        // A pixel 40px right of center reads 20% closer to the center: 100 + 40 * 0.8.
        val read = dome.red(140, 60) * width / 255f
        assertTrue(abs(read - 132f) < 3f, "dome sample $read")
        assertTrue(dome.displacement(100, 60) < 1.5f)
    }

    @Test fun theOpticsUniformsChangeThePixels() {
        val base = lens(veil = true)
        assertTrue(lens(veil = true, bright = 0.2f).green(100, 60) > base.green(100, 60))
        assertTrue(lens(veil = true, fresnel = 1f).green(23, 60) > base.green(23, 60), "fresnel brightens the wall")
        assertTrue(abs(lens(veil = true, fresnel = 1f).green(100, 60) - base.green(100, 60)) <= 1, "fresnel leaves the middle")
        val grainy = lens(veil = true, grain = 0.2f)
        val values = (90..110).map { grainy.green(it, 60) }.toSet()
        assertTrue(values.size > 3, "grain varies the pixels: $values")
        val lit = lens(veil = true, glow = 0.3f)
        assertTrue(lit.green(100, 60) > base.green(100, 60), "glow at the finger")
        assertTrue(abs(lit.green(30, 100) - base.green(30, 100)) <= 1, "no glow far from the finger")
    }

    /** The backdrop position (x when [vertical] is false, else y) each pixel of the convex lens shows, exact to 1/64 px. */
    private fun convexMap(
        vertical: Boolean,
        exponent: Float,
        radius: Float,
        strength: Float,
        dome: Float,
    ): Array<FloatArray> {
        val w = 900
        val h = 600
        // A coordinate packed into two channels: whole multiples of 4 in red, the remainder in green.
        val axis = if (vertical) "c.y" else "c.x"
        val encoded =
            RuntimeShaderBuilder(
                RuntimeEffect.makeForShader(
                    "half4 main(float2 c) { return half4(floor($axis / 4.0) / 255.0, ($axis - floor($axis / 4.0) * 4.0) / 4.0, 0.0, 1.0); }",
                ),
            ).makeShader()
        val builder = RuntimeShaderBuilder(RuntimeEffect.makeForShader(LENS_SHADER))
        builder.child("content", encoded)
        builder.uniform("size", 160f, 80f)
        builder.uniform("origin", 300f, 260f)
        builder.uniform("radii", radius, radius, radius, radius)
        builder.uniform("exponent", exponent)
        builder.uniform("strength", strength)
        builder.uniform("dispersion", 0f)
        builder.uniform("sat", 1f)
        builder.uniform("profile", 3f)
        builder.uniform("band", 0.3f)
        builder.uniform("dome", dome)
        // No rim shading: it would add to the encoded channels near the wall.
        builder.uniform("thickness", 0f)
        builder.uniform("glow", 0f, 0f, 1f, 0f)
        builder.uniform("bounds", 0f, 0f, w.toFloat(), h.toFloat())
        val surface = Surface.makeRasterN32Premul(w, h)
        surface.canvas.drawRect(Rect.makeWH(w.toFloat(), h.toFloat()), Paint().apply { shader = builder.makeShader() })
        val bitmap = Bitmap.makeFromImage(surface.makeImageSnapshot())
        return Array(80) { yy ->
            FloatArray(160) { xx ->
                val argb = bitmap.getColor(300 + xx, 260 + yy)
                ((argb shr 16) and 0xFF) * 4f + ((argb shr 8) and 0xFF) / 255f * 4f
            }
        }
    }

    @Test fun theConvexLensNeverFoldsAtMaxRefractionForAPillAndARectangle() {
        for ((exponent, radius) in listOf(2f to 40f, 8f to 0f, 4f to 16f)) {
            val sx = convexMap(false, exponent, radius, strength = 120f, dome = -0.64f)
            val sy = convexMap(true, exponent, radius, strength = 120f, dome = -0.64f)
            for (y in 4 until 76 step 2) {
                for (x in 4 until 156 step 2) {
                    val a = (sx[y][x + 1] - sx[y][x - 1]) / 2f
                    val b = (sx[y + 1][x] - sx[y - 1][x]) / 2f
                    val c = (sy[y][x + 1] - sy[y][x - 1]) / 2f
                    val d = (sy[y + 1][x] - sy[y - 1][x]) / 2f
                    assertTrue(a * d - b * c > 0.3f, "exponent $exponent at ($x,$y): jacobian ${a * d - b * c}")
                }
            }
            // The whole surface minifies: the left edge reads from well outside the surface (x = 300 - something), not inside it.
            assertTrue(sx[40][1] < 300f - 30f, "exponent $exponent: left edge samples ${sx[40][1]}")
        }
    }
}
