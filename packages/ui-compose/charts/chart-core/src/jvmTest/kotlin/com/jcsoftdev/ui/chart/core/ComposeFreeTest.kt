package com.jcsoftdev.ui.chart.core

import java.io.File
import java.util.zip.ZipFile
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * chart-core is pure Kotlin so desktop, server and test code can use the chart math without Compose. The compiled jvm classes
 * must not name a Compose type: class-file constants are UTF-8 in the constant pool, so a byte scan sees every reference.
 */
class ComposeFreeTest {
    @Test fun noCompiledClassReferencesCompose() {
        val classes = coreClasses()
        assertTrue(classes.isNotEmpty(), "found the chart-core classes")
        val offenders =
            classes.filter { (_, bytes) -> FORBIDDEN.any { String(bytes, Charsets.ISO_8859_1).contains(it) } }.map { it.first }
        assertEquals(emptyList(), offenders, "chart-core references Compose")
    }

    private fun coreClasses(): List<Pair<String, ByteArray>> {
        val root =
            File(
                NumberRange::class.java.protectionDomain.codeSource.location
                    .toURI(),
            )
        return if (root.isDirectory) {
            root
                .walkTopDown()
                .filter { it.isFile && it.extension == "class" }
                .map { it.name to it.readBytes() }
                .toList()
        } else {
            ZipFile(root).use { zip ->
                zip
                    .entries()
                    .toList()
                    .filter { it.name.endsWith(".class") }
                    .map { it.name to zip.getInputStream(it).readBytes() }
            }
        }
    }

    private companion object {
        val FORBIDDEN = listOf("androidx/compose", "org/jetbrains/compose", "com/jcsoftdev/ui/theme")
    }
}
