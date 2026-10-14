package com.jcsoftdev.ui.chart.core

import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min

/** Scale [k] and translation of a pannable stage: screen = content * k + (x, y). */
public class PanZoomView(
    public val k: Double,
    public val x: Double,
    public val y: Double,
) {
    public companion object {
        public val Identity: PanZoomView = PanZoomView(1.0, 0.0, 0.0)
    }
}

private fun clamp(
    value: Double,
    lo: Double,
    hi: Double,
): Double = min(hi, max(lo, value))

/** Scales [view] by [factor] keeping the screen point ([px], [py]) fixed; `k` stays in the zoom limits. A non-finite factor leaves the view. */
public fun zoomAround(
    view: PanZoomView,
    factor: Double,
    px: Double,
    py: Double,
    minZoom: Double,
    maxZoom: Double,
): PanZoomView {
    if (!factor.isFinite() || !px.isFinite() || !py.isFinite()) return view
    val k = clamp(view.k * factor, minZoom, maxZoom)
    val ratio = k / view.k
    return PanZoomView(k, px - (px - view.x) * ratio, py - (py - view.y) * ratio)
}

/**
 * View that shows a [contentWidth] x [contentHeight] drawing centred in a [width] x [height] viewport, [padding] from the edges and
 * never enlarged past [maxFit].
 */
public fun fitView(
    contentWidth: Double,
    contentHeight: Double,
    width: Double,
    height: Double,
    padding: Double = 16.0,
    minZoom: Double = 0.05,
    maxFit: Double = 1.0,
): PanZoomView {
    val k =
        max(
            minZoom,
            min(min((width - padding * 2) / max(1.0, contentWidth), (height - padding * 2) / max(1.0, contentHeight)), maxFit),
        )
    return PanZoomView(k, (width - contentWidth * k) / 2, (height - contentHeight * k) / 2)
}

/** Zoom factor of one wheel event: smooth for pixel deltas, coarser for line deltas. */
public fun wheelFactor(
    deltaY: Double,
    lineMode: Boolean = false,
): Double = exp(-deltaY * (if (lineMode) 0.05 else 0.0025))

/** Zoom factor of the +/- keys and buttons. */
public const val ZOOM_STEP: Double = 1.25

/** Pixels an arrow key pans by. */
public const val PAN_STEP: Double = 48.0

public enum class PanZoomKey { Left, Right, Up, Down, ZoomIn, ZoomOut }

/**
 * Keyboard meaning for a pannable stage. Arrows move the viewport over the content (so the content slides the other way); zoom keys
 * zoom around the viewport centre. [shift] pans five times as far.
 */
public fun panZoomKey(
    view: PanZoomView,
    key: PanZoomKey,
    width: Double,
    height: Double,
    minZoom: Double = 0.1,
    maxZoom: Double = 2.5,
    panStep: Double = PAN_STEP,
    zoomStep: Double = ZOOM_STEP,
    shift: Boolean = false,
): PanZoomView {
    val step = if (shift) panStep * 5 else panStep
    return when (key) {
        PanZoomKey.Left -> PanZoomView(view.k, view.x + step, view.y)
        PanZoomKey.Right -> PanZoomView(view.k, view.x - step, view.y)
        PanZoomKey.Up -> PanZoomView(view.k, view.x, view.y + step)
        PanZoomKey.Down -> PanZoomView(view.k, view.x, view.y - step)
        PanZoomKey.ZoomIn -> zoomAround(view, zoomStep, width / 2, height / 2, minZoom, maxZoom)
        PanZoomKey.ZoomOut -> zoomAround(view, 1 / zoomStep, width / 2, height / 2, minZoom, maxZoom)
    }
}
