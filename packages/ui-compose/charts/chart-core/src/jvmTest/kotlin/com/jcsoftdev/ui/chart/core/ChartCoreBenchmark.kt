package com.jcsoftdev.ui.chart.core

import java.io.File
import kotlin.math.sqrt
import kotlin.test.Test

/**
 * Micro-benchmarks of the 100k-point paths (the plan's downsample and model-build budgets). They only run under `./gradlew
 * :chart-core:chartBench`, which sets `chart.bench`; a normal `jvmTest` skips them. Each result is the lower quartile of timed runs divided by a
 * fixed arithmetic calibration loop measured in the same round, and the best of three rounds is kept, so the committed baseline survives a faster or slower machine.
 * `scripts/check-chart-bench.mjs` fails a run that is more than 20% slower than `bench-baseline.json`. Nothing here reads a wall clock
 * for behaviour: the clock only times the loops.
 */
class ChartCoreBenchmark {
    private val n = 100_000
    private val xs = DoubleArray(n) { it.toDouble() }
    private val ys = DoubleArray(n) { sqrt(it.toDouble()) * 10 + (it * 7919L % 211) }
    private val series = Array(20) { s -> DoubleArray(20_000) { ((it * 31 + s * 17) % 97).toDouble() } }

    private fun median(block: () -> Unit): Double {
        repeat(WARMUP) { block() }
        val times = DoubleArray(RUNS)
        for (i in 0 until RUNS) {
            val start = System.nanoTime()
            block()
            times[i] = (System.nanoTime() - start).toDouble()
        }
        times.sort()
        return times[RUNS / 4]
    }

    private var sink = 0.0

    private fun round(): Map<String, Pair<Double, Double>> {
        val calibration = median { for (i in 0 until 5_000_000) sink += sqrt(i.toDouble()) }
        val timed = linkedMapOf<String, Double>()
        timed["lttb-100k-to-2000"] = median { sink += lttbIndices(xs, ys, 2000).size }
        timed["minmax-100k-800-columns"] = median { sink += minMaxIndices(xs, ys, 0.0, n.toDouble(), 800).size }
        timed["line-path-100k-sampled"] =
            median {
                val picked = lttbIndices(xs, ys, 2000)
                val px = DoubleArray(picked.size) { xs[picked[it]] }
                val py = DoubleArray(picked.size) { ys[picked[it]] }
                sink += linePath(px, py, Curve.Smooth).commandCount
            }
        timed["stack-20x20000"] = median { sink += stackLayers(series, StackMode.Normal).size }
        timed["point-index-100k-build-and-1000-hits"] =
            median {
                val index = PointIndex(xs, ys)
                for (q in 0 until 1000) sink += index.nearest(q * 97.0, q * 53.0 % 400)
            }
        return timed.mapValues { it.value to it.value / calibration }
    }

    @Test fun run() {
        val out = System.getProperty("chart.bench.out") ?: return
        // Best of a few rounds: a busy machine only ever makes a round slower, so the fastest one is the closest to the code's cost.
        val rounds = List(ROUNDS) { round() }
        val results = rounds.first().keys.associateWith { name -> rounds.minBy { it.getValue(name).second }.getValue(name) }
        val json =
            buildString {
                append("{\n  \"benchmarks\": {")
                results.entries.forEachIndexed { i, (name, pair) ->
                    append(
                        if (i ==
                            0
                        ) {
                            "\n"
                        } else {
                            ",\n"
                        },
                    ).append("    \"")
                        .append(name)
                        .append("\": { \"ns\": ")
                        .append(pair.first)
                        .append(", \"normalized\": ")
                        .append(
                            pair.second,
                        ).append(" }")
                }
                append("\n  }\n}\n")
            }
        File(out).also { it.parentFile.mkdirs() }.writeText(json)
        check(sink.isFinite())
    }

    private companion object {
        const val WARMUP = 6
        const val RUNS = 41
        const val ROUNDS = 3
    }
}
