package com.jcsoftdev.ui.chart.core

private object FixtureAnchor

internal actual fun readFixture(name: String): String {
    val stream =
        checkNotNull(FixtureAnchor::class.java.classLoader.getResourceAsStream("fixtures/$name.json")) { "missing fixture $name.json" }
    return stream.use { String(it.readBytes(), Charsets.UTF_8) }
}
