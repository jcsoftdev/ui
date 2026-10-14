package com.jcsoftdev.ui.chart.testing

/** Reads charts/<module>/src/commonTest/resources/fixtures/<name>.json from the test classpath and decodes it. */
internal object FixtureResources {
    fun text(name: String): String =
        checkNotNull(FixtureResources::class.java.getResourceAsStream("/fixtures/$name.json")) { "missing fixture $name" }
            .use { it.readBytes().decodeToString() }

    fun load(name: String): Any? = FixtureJson.parse(text(name))
}
