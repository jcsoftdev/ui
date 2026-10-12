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
    /** How far in, in pixels, the veil and the thickness shading reach (independent of the lens [depth]). */
    val rimDepth: Float = 1f,
    /** Magnification toward the center (0.05 samples the backdrop 5% closer to the center at the edge). */
    val dome: Float = 0f,
    /** Width of the edge glint in pixels and its strength (0 turns it off). */
    val glintWidth: Float = 1f,
    val glintStrength: Float = 0f,
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
uniform float sat;
uniform float4 tint;
uniform float4 dim;
uniform float veilEdge;
uniform float rimDepth;
uniform float dome;
uniform float glintWidth;
uniform float glintStrength;

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
    float t = clamp(-d / max(depth, 1.0), 0.0, 1.0);
    float bend = pow(1.0 - t, 3.0);
    // Edge term (strongest at the rim, fading to zero at the center where the normal flips) plus a dome that magnifies the
    // whole surface a little, so no part of it is a flat, undisplaced zone.
    float2 off = -n * strength * bend - p * dome;
    float2 lo = bounds.xy;
    float2 hi = bounds.zw;
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

    // Directional light from the top left: thickness shading across the bevel, and a thin glint right at the wall.
    float2 L = float2(-0.57, -0.82);
    float lf = dot(n, L);
    float wall = 1.0 - vt;
    c += 0.06 * wall * max(lf, 0.0);
    c *= 1.0 - 0.07 * wall * max(-lf, 0.0);
    float edge = 1.0 - smoothstep(0.0, max(glintWidth, 0.001), -d);
    float glint = edge * (pow(max(lf, 0.0), 2.0) + 0.55 * pow(max(-lf, 0.0), 2.0)) * glintStrength * 0.7;
    c += glint * (0.35 + 0.65 * c);
    return half4(half3(clamp(c, 0.0, 1.0)), 1.0);
}
"""
