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
    /** Width of the refracting bezel, measured inward from the edge. */
    val depth: Float,
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
)

/** True when a runtime shader can refract the backdrop (Android 13+, Skia targets). */
internal expect fun lensSupported(): Boolean

/** Builds the blur-then-refract effect for a layer; one engine per surface reuses its compiled shader. */
internal expect class LensEngine() {
    /** The effect for [params], or null when [lensSupported] is false. */
    fun effect(params: LensParams): RenderEffect?
}

/**
 * Edge refraction in SkSL (also valid AGSL): a rounded-rect signed distance field gives the distance to the edge and the
 * edge normal; the backdrop is sampled from further inside (so every sample stays within the visible surface), by an amount that is strongest at the edge and fades to zero
 * across the bezel [depth], so the center shows the backdrop undistorted. Samples are clamped to the surface rectangle. Red and blue use slightly different amounts for a
 * subtle dispersion at the rim.
 */
internal const val LENS_SHADER: String = """
uniform shader content;
uniform float2 size;
uniform float2 origin;
uniform float4 radii;
uniform float depth;
uniform float strength;
uniform float dispersion;
uniform float4 bounds;

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
    float t = clamp(-d / depth, 0.0, 1.0);
    float bend = pow(1.0 - t, 3.0);
    float2 off = -n * strength * bend;
    float2 lo = bounds.xy;
    float2 hi = bounds.zw;
    half4 mid = content.eval(clamp(coord + off, lo, hi));
    half r = content.eval(clamp(coord + off * (1.0 + dispersion), lo, hi)).r;
    half bl = content.eval(clamp(coord + off * (1.0 - dispersion), lo, hi)).b;
    return half4(r, mid.g, bl, mid.a);
}
"""
