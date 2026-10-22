package com.jcsoftdev.ui.chart.core

import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import platform.Foundation.NSProcessInfo
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.stringWithContentsOfFile

private const val RELATIVE_DIR = "src/commonTest/resources/fixtures"

/**
 * iOS test binaries do not bundle commonTest resources, so the fixtures are read from disk. Gradle points CHART_FIXTURES_DIR at the
 * module's fixture directory; without it the module-relative path is tried. CI compiles the iOS tests but does not run them.
 */
@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
internal actual fun readFixture(name: String): String {
    val dir = NSProcessInfo.processInfo.environment["CHART_FIXTURES_DIR"] as? String ?: RELATIVE_DIR
    return checkNotNull(
        NSString.stringWithContentsOfFile("$dir/$name.json", NSUTF8StringEncoding, null),
    ) { "missing fixture $dir/$name.json" }
}
