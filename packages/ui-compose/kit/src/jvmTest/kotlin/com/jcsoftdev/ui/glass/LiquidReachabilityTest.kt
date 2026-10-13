package com.jcsoftdev.ui.glass

import java.io.DataInputStream
import java.io.File
import java.util.zip.ZipFile
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Guards the opt-in: R8 keeps Liquid code only when the app reaches it, so no class of the kit outside the Liquid family may
 * refer to it. A default, a component or a helper that names `LiquidGlass`, a lens, `Dispersion` or `GlassEffectContainer` would
 * put Liquid Glass in every APK. Read from the compiled jvm classes: the class constants, the field and method descriptors and
 * the generic signatures; Kotlin metadata strings are not references and are ignored.
 */
class LiquidReachabilityTest {
    @Test fun noClassOutsideTheLiquidFamilyRefersToLiquidCode() {
        val classes = kitClasses()
        assertTrue(classes.size > 100, "found the kit classes (${classes.size})")
        val offenders =
            classes.mapNotNull { info ->
                // Inlined stdlib helpers keep the stdlib source file, so a class named after a Liquid one belongs to it too.
                if (info.sourceFile in LIQUID_FAMILY || isLiquid(info.name)) return@mapNotNull null
                val allowed = if (info.sourceFile == "SurfaceMaterial.kt") info.permittedSubclasses else emptySet()
                val hits = (info.references - allowed).filter(::isLiquid)
                if (hits.isEmpty()) null else "${info.name} (${info.sourceFile}) -> ${hits.sorted()}"
            }
        assertEquals(emptyList(), offenders, "Liquid code is reachable from outside the Liquid family")
    }

    @Test fun theGuardSeesTheLiquidFamilyItself() {
        // Without this the scan could pass by reading nothing: the Liquid surface does refer to the lens.
        val surface = kitClasses().filter { it.sourceFile == "LiquidSurface.kt" }
        assertTrue(surface.any { info -> info.references.any(::isLiquid) }, "LiquidSurface.kt refers to Liquid code")
    }

    private class ClassInfo(
        val name: String,
        val sourceFile: String?,
        val references: Set<String>,
        val permittedSubclasses: Set<String>,
    )

    private fun isLiquid(name: String): Boolean {
        if (!name.startsWith(GLASS)) return false
        val simple = name.removePrefix(GLASS).substringBefore('$')
        return LIQUID_PREFIXES.any { simple.startsWith(it) }
    }

    private fun kitClasses(): List<ClassInfo> {
        val root =
            File(
                SurfaceMaterial::class.java.protectionDomain.codeSource.location
                    .toURI(),
            )
        return if (root.isDirectory) {
            root
                .resolve("com/jcsoftdev/ui")
                .walkTopDown()
                .filter { it.isFile && it.extension == "class" }
                .map { file -> file.inputStream().use { parse(DataInputStream(it.buffered())) } }
                .toList()
        } else {
            ZipFile(root).use { zip ->
                zip
                    .entries()
                    .toList()
                    .filter { it.name.startsWith("com/jcsoftdev/ui/") && it.name.endsWith(".class") }
                    .map { entry -> zip.getInputStream(entry).use { parse(DataInputStream(it.buffered())) } }
            }
        }
    }

    // A minimal class-file reader: the constant pool, the member descriptors and the attributes that name types.
    private fun parse(input: DataInputStream): ClassInfo {
        input.readInt()
        input.readUnsignedShort()
        input.readUnsignedShort()
        val count = input.readUnsignedShort()
        val utf8 = arrayOfNulls<String>(count)
        val classIndex = IntArray(count)
        val descriptors = mutableListOf<Int>()
        var i = 1
        while (i < count) {
            when (val tag = input.readUnsignedByte()) {
                1 -> utf8[i] = input.readUTF()
                7 -> classIndex[i] = input.readUnsignedShort()
                8, 16, 19, 20 -> input.readUnsignedShort().also { if (tag == 16) descriptors += it }
                3, 4 -> input.readInt()
                5, 6 -> {
                    input.readLong()
                    i++
                }
                9, 10, 11, 17, 18 -> input.readInt()
                12 -> {
                    input.readUnsignedShort()
                    descriptors += input.readUnsignedShort()
                }
                15 -> {
                    input.readUnsignedByte()
                    input.readUnsignedShort()
                }
                else -> error("constant pool tag $tag")
            }
            i++
        }
        input.readUnsignedShort()
        val name = utf8[classIndex[input.readUnsignedShort()]]!!
        input.readUnsignedShort()
        repeat(input.readUnsignedShort()) { input.readUnsignedShort() }
        var sourceFile: String? = null
        val permitted = mutableSetOf<String>()
        val signatures = mutableListOf<Int>()

        fun attributes(onClass: Boolean) {
            repeat(input.readUnsignedShort()) {
                val attribute = utf8[input.readUnsignedShort()]
                val length = input.readInt()
                when {
                    attribute == "Signature" -> signatures += input.readUnsignedShort()
                    onClass && attribute == "SourceFile" -> sourceFile = utf8[input.readUnsignedShort()]
                    onClass && attribute == "PermittedSubclasses" ->
                        repeat(input.readUnsignedShort()) { permitted += utf8[classIndex[input.readUnsignedShort()]]!! }
                    else -> input.skipNBytes(length.toLong())
                }
            }
        }
        repeat(2) {
            repeat(input.readUnsignedShort()) {
                input.readUnsignedShort()
                input.readUnsignedShort()
                descriptors += input.readUnsignedShort()
                attributes(onClass = false)
            }
        }
        attributes(onClass = true)
        val references = mutableSetOf<String>()
        for (index in classIndex) if (index != 0) references += typesIn(utf8[index]!!)
        for (index in descriptors + signatures) references += typesIn(utf8[index]!!)
        return ClassInfo(name, sourceFile, references - name, permitted)
    }

    private fun typesIn(text: String): List<String> =
        if (text.startsWith("(") || text.startsWith("L") || text.startsWith("[") || text.startsWith("<")) {
            TYPE.findAll(text).map { it.groupValues[1] }.toList()
        } else {
            listOf(text)
        }

    private companion object {
        const val GLASS = "com/jcsoftdev/ui/glass/"
        val TYPE = Regex("L([^;<>:]+)[;<]")
        val LIQUID_PREFIXES =
            listOf("Liquid", "LensRenderer", "LensEngine", "LensProgram", "RefractionLens", "CrystalLens", "Dispersion", "GlassEffect")
        val LIQUID_FAMILY =
            setOf(
                "LiquidGlass.kt",
                "LiquidPresets.kt",
                "LiquidInteraction.kt",
                "LiquidDynamics.kt",
                "LiquidDrag.kt",
                "LiquidLens.kt",
                "LiquidSurface.kt",
                "CrystalLens.kt",
                "Dispersion.kt",
                "Lens.kt",
                "LensEngine.jvm.kt",
                "GlassEffectContainer.kt",
            )
    }
}
