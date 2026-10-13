package com.jcsoftdev.ui.glass

import androidx.compose.ui.graphics.RenderEffect

/** Everything the lens shader needs, in pixels of the (padded) backdrop layer. */
internal data class LensParams(
    val width: Float,
    val height: Float,
    /** Where the surface starts inside the padded layer. */
    val pad: Float,
    /** Corner radii, top-left, top-right, bottom-right, bottom-left. */
    val tl: Float,
    val tr: Float,
    val br: Float,
    val bl: Float,
    /** Squareness of the height field (the superellipse exponent): 2 is an ellipse, higher values fill the corners. */
    val exponent: Float,
    /** Largest displacement, reached at the edge. */
    val strength: Float,
    /** Per-channel spread of the displacement (chromatic dispersion). */
    val dispersion: Float,
    /** Gaussian radius applied to the backdrop before refraction (the low blur at the center). */
    val blur: Float,
    /** The part of the layer that holds the source (left, top, right, bottom); samples are clamped into it. */
    val boundsLeft: Float,
    val boundsTop: Float,
    val boundsRight: Float,
    val boundsBottom: Float,
    /** Backdrop saturation, applied before the veil. */
    val saturate: Float = 1f,
    /** The veil (non-premultiplied red, green, blue, alpha of the tint, then of the dim layer). */
    val tintR: Float = 0f,
    val tintG: Float = 0f,
    val tintB: Float = 0f,
    val tintA: Float = 0f,
    val dimR: Float = 0f,
    val dimG: Float = 0f,
    val dimB: Float = 0f,
    val dimA: Float = 0f,
    /** Share of the veil left at the very edge (1 keeps it uniform). */
    val veilEdge: Float = 1f,
    /** How far in, in pixels, the veil and the thickness shading reach (independent of the lens). */
    val rimDepth: Float = 1f,
    /** Magnification toward the center (0.05 samples the backdrop 5% closer to the center at the edge). */
    val dome: Float = 0f,
    /** Width of the edge glint in pixels and its strength (0 turns it off). */
    val glintWidth: Float = 1f,
    val glintStrength: Float = 0f,
    /** Direction toward the light (a unit vector; zero keeps the default top left light). */
    val lightX: Float = 0f,
    val lightY: Float = 0f,
    /** Brightening toward the rim independent of the light, film grain amplitude and brightness added to the surface. */
    val fresnel: Float = 0f,
    val grain: Float = 0f,
    val brightness: Float = 0f,
    /** Lens profile code (0 full, 1 rim, 2 dome) and, for the rim profile, the band as a share of the half size. */
    val profile: Float = 0f,
    val band: Float = 0.3f,
    /** Scales the lit and dark thickness shading at the rim. */
    val thickness: Float = 1f,
    /** Touch glow: center in layer pixels, radius and opacity (0 turns it off). */
    val glowX: Float = 0f,
    val glowY: Float = 0f,
    val glowRadius: Float = 1f,
    val glowAlpha: Float = 0f,
)

/** Largest number of shapes one [GlassEffectContainer] merges in the shader. */
internal const val MAX_MERGED_SHAPES: Int = 16

/**
 * The merged surface of a [GlassEffectContainer]: up to [MAX_MERGED_SHAPES] rounded boxes (in layer pixels) joined by a smooth
 * union of the given blend distance. [shapes] holds center x, center y, half width, half height and corner radius per shape.
 */
internal data class MergeParams(
    val shapes: FloatArray,
    val count: Int,
    val blendDistance: Float,
    val lens: LensParams,
) {
    override fun equals(other: Any?): Boolean =
        other is MergeParams &&
            count == other.count &&
            blendDistance == other.blendDistance &&
            lens == other.lens &&
            shapes.contentEquals(other.shapes)

    override fun hashCode(): Int = ((shapes.contentHashCode() * 31 + count) * 31 + blendDistance.hashCode()) * 31 + lens.hashCode()
}

/** True when a runtime shader can refract the backdrop (Android 13+, Skia targets). */
internal expect fun lensSupported(): Boolean

/** Builds the blur-then-refract effect for a layer; one engine per surface reuses its compiled shader. */
internal expect class LensEngine() {
    /** The effect for [params], or null when [lensSupported] is false. */
    fun effect(params: LensParams): RenderEffect?

    /** The effect of a merged container, or null when [lensSupported] is false. */
    fun merged(params: MergeParams): RenderEffect?
}

/**
 * The part of the lens shaders after the sample offset is known: dispersion, saturation, the veil that thins toward the rim,
 * thickness shading, glint, fresnel, grain, brightness and the touch glow. Valid SkSL and AGSL.
 */
internal const val LENS_COMMON: String = """
uniform shader content;
uniform float2 size;
uniform float2 origin;
uniform float4 radii;
uniform float exponent;
uniform float strength;
uniform float dispersion;
uniform float4 bounds;
uniform float sat;
uniform float4 tint;
uniform float4 dim;
uniform float veilEdge;
uniform float rimDepth;
uniform float dome;
uniform float glintWidth;
uniform float glintStrength;
uniform float2 light;
uniform float fresnel;
uniform float grain;
uniform float bright;
uniform float profile;
uniform float band;
uniform float thickness;
uniform float4 glow;

// How far, in pixels, a sample keeps from the edge of the backdrop that exists: the blur fades its last columns toward the base.
const float EDGE_SLACK = 3.0;

// Shrinks one axis of the offset so a sample moved by `want` from `at` stays between lo and hi (1 when there is room).
float reachFit(float at, float want, float lo, float hi) {
    float travel = abs(want);
    if (travel < 0.0001) { return 1.0; }
    float room = want > 0.0 ? hi - at : at - lo;
    return clamp(room / travel, 0.0, 1.0);
}

half4 shade(float2 coord, float2 off, float d, float2 n) {
    float2 lo = bounds.xy + float2(EDGE_SLACK);
    float2 hi = bounds.zw - float2(EDGE_SLACK);
    // Every channel stays inside the existing backdrop: the offset (dispersion pushes red furthest) shrinks smoothly toward the
    // edge instead of being clamped there, which would smear one column of the backdrop into a flat band with a seam.
    float widest = 1.0 + abs(dispersion);
    off = float2(
        off.x * reachFit(coord.x, off.x * widest, lo.x, hi.x),
        off.y * reachFit(coord.y, off.y * widest, lo.y, hi.y));
    half4 mid = content.eval(clamp(coord + off, lo, hi));
    half r = content.eval(clamp(coord + off * (1.0 + dispersion), lo, hi)).r;
    half bl = content.eval(clamp(coord + off * (1.0 - dispersion), lo, hi)).b;
    float3 c = float3(r, mid.g, bl);
    float luma = dot(c, float3(0.2126, 0.7152, 0.0722));
    c = mix(float3(luma), c, sat);

    // The veil thins smoothly toward the edge, so the bent backdrop shows at the rim and the centre keeps full strength.
    float rt = clamp(-d / max(rimDepth, 1.0), 0.0, 1.0);
    float vt = smoothstep(0.0, 1.0, rt);
    float s = mix(veilEdge, 1.0, vt);
    c = mix(c, tint.rgb, tint.a * s);
    c = mix(c, dim.rgb, dim.a * s);
    c += bright;

    // Directional light: thickness shading across the bevel, and a thin glint right at the wall.
    float2 L = length(light) > 0.001 ? normalize(light) : float2(-0.57, -0.82);
    float lf = dot(n, L);
    float wall = (1.0 - vt) * thickness;
    c += 0.06 * wall * max(lf, 0.0);
    c *= 1.0 - 0.07 * wall * max(-lf, 0.0);
    float edge = 1.0 - smoothstep(0.0, max(glintWidth, 0.001), -d);
    float glint = edge * (pow(max(lf, 0.0), 2.0) + 0.55 * pow(max(-lf, 0.0), 2.0)) * glintStrength * 0.7;
    c += glint * (0.35 + 0.65 * c);

    // Fresnel: the rim catches light whatever the direction, strongest right at the wall.
    float fr = pow(1.0 - rt, 3.0);
    c = mix(c, float3(1.0), clamp(fresnel * fr * 0.5, 0.0, 1.0));

    // Touch glow: a soft radial add at the finger.
    float gd = length(coord - glow.xy) / max(glow.z, 1.0);
    c += glow.w * (1.0 - smoothstep(0.0, 1.0, gd));

    // Film grain from a hash of the pixel position.
    float h = fract(sin(dot(coord, float2(12.9898, 78.233))) * 43758.5453);
    c += (h - 0.5) * grain;
    return half4(half3(clamp(c, 0.0, 1.0)), 1.0);
}
"""

/**
 * Edge refraction in SkSL (also valid AGSL): a rounded-rect signed distance field gives the distance to the edge and the
 * edge normal for the rim; the refraction itself comes from a smooth superellipse height field (no crease along the medial
 * axis). The backdrop is sampled from further inside (so every sample stays within the visible surface), by an amount that is
 * strongest at the edge. Samples are clamped to the surface rectangle. Red and blue use slightly different amounts for a
 * subtle dispersion at the rim. The profile uniform picks how the displacement spreads: 0 across the whole surface, 1 only in
 * a band along the rim, 2 as a dome (a magnification with no bevel direction at all), 3 as a convex lens (minify plus an outward rim bend).
 */
internal const val LENS_SHADER: String =
    LENS_COMMON + """
float sdBox(float2 p, float2 b, float4 r) {
    float2 rr = p.x > 0.0 ? r.yz : r.xw;
    float rad = p.y > 0.0 ? rr.y : rr.x;
    float2 q = abs(p) - b + rad;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rad;
}

half4 main(float2 coord) {
    float2 b = size * 0.5;
    float2 p = coord - (origin + b);
    float d = sdBox(p, b, radii);
    float2 g = float2(
        sdBox(p + float2(1.0, 0.0), b, radii) - sdBox(p - float2(1.0, 0.0), b, radii),
        sdBox(p + float2(0.0, 1.0), b, radii) - sdBox(p - float2(0.0, 1.0), b, radii));
    float2 n = length(g) > 0.0001 ? normalize(g) : float2(0.0, 0.0);
    // The refraction comes from a smooth height field, not from the edge distance (whose gradient jumps along the medial axis and
    // would crease the surface into four faces): a superellipse radial coordinate r = (|u|^n + |v|^n)^(1/n) over the
    // half-size normalized axes. Its gradient direction is continuous everywhere but the exact center, where the displacement
    // is zero anyway.
    float2 h = max(b, float2(1.0));
    float2 uv = p / h;
    float2 a = abs(uv) + float2(0.0001);
    float rr = pow(pow(a.x, exponent) + pow(a.y, exponent), 1.0 / exponent);
    float2 gr = float2(pow(a.x, exponent - 1.0) * sign(uv.x) / h.x, pow(a.y, exponent - 1.0) * sign(uv.y) / h.y);
    float2 dir = length(gr) > 0.000001 ? normalize(gr) : float2(0.0, 0.0);
    float rc = clamp(rr, 0.0, 1.0);
    float full = pow(rc, 3.0);
    float m = clamp((rr - (1.0 - band)) / max(band, 0.001), 0.0, 1.0);
    float rim = m * m;
    float isRim = step(0.5, profile) * (1.0 - step(1.5, profile));
    float isConvex = step(2.5, profile);
    float isDome = step(1.5, profile) * (1.0 - isConvex);
    float mag = mix(mix(full, rim, isRim), 0.0, isDome);
    // Convex: the dome term is negative (the whole surface samples a wider strip: sample = center + (1 + k) * p), and the rim
    // bend flips to push outward as well, so the sampled point always moves away from the center faster than the pixel does
    // (the mapping never folds). Every other profile bends inward.
    float bendSign = 1.0 - 2.0 * isConvex;
    float2 off = -dir * strength * mag * bendSign - p * dome;
    return shade(coord, off, d, n);
}
"""

/**
 * The merged surface of a container: the rounded boxes are joined with a polynomial smooth union, the refraction follows the
 * gradient of the joined field in a band along its edge (the field is smooth, so no seam appears where shapes meet), and the
 * coverage is anti-aliased from the field itself. Valid SkSL and AGSL.
 */
internal const val MERGE_SHADER: String =
    LENS_COMMON + """
uniform float4 boxes[16];
uniform float roundness[16];
uniform float count;
uniform float blendK;

float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / max(k, 0.0001);
    return min(a, b) - h * h * k * 0.25;
}

float field(float2 p) {
    float d = 100000.0;
    for (int i = 0; i < 16; i++) {
        if (float(i) >= count) { break; }
        float2 q = abs(p - boxes[i].xy) - boxes[i].zw + roundness[i];
        float di = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - roundness[i];
        d = (i == 0) ? di : smin(d, di, blendK);
    }
    return d;
}

half4 main(float2 coord) {
    float d = field(coord);
    // The gradient is measured over a step, not a pixel, and not normalized: where the joined outline folds in on itself (the
    // medial axis inside a neck) opposite normals average out, so the displacement fades to zero there instead of flipping.
    float st = max(1.0, rimDepth * 0.25);
    float2 g = float2(
        field(coord + float2(st, 0.0)) - field(coord - float2(st, 0.0)),
        field(coord + float2(0.0, st)) - field(coord - float2(0.0, st))) / (2.0 * st);
    float2 n = length(g) > 1.0 ? normalize(g) : g;
    float t = clamp(-d / max(rimDepth, 1.0), 0.0, 1.0);
    float m = 1.0 - t;
    float2 off = -n * strength * m * m;
    half4 c = shade(coord, off, d, n);
    float cover = 1.0 - smoothstep(-0.75, 0.75, d);
    return half4(c.rgb * half(cover), half(cover));
}
"""

/** Polynomial smooth minimum, the same function the merge shader uses; [k] is the blend distance. */
internal fun smoothMin(
    a: Float,
    b: Float,
    k: Float,
): Float {
    val h = (k - kotlin.math.abs(a - b)).coerceAtLeast(0f) / k.coerceAtLeast(0.0001f)
    return kotlin.math.min(a, b) - h * h * k * 0.25f
}

/** The first four floats of every five-float shape record, as the shader's `float4 boxes[16]`. */
internal fun FloatArray.boxes(): FloatArray =
    FloatArray(MAX_MERGED_SHAPES * 4).also { out ->
        for (i in 0 until minOf(size / 5, MAX_MERGED_SHAPES)) for (k in 0 until 4) out[i * 4 + k] = this[i * 5 + k]
    }

/** The fifth float of every shape record, as the shader's `float roundness[16]`. */
internal fun FloatArray.roundness(): FloatArray =
    FloatArray(MAX_MERGED_SHAPES).also { out -> for (i in 0 until minOf(size / 5, MAX_MERGED_SHAPES)) out[i] = this[i * 5 + 4] }
