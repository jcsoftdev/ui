plugins {
    id("jcsoftdev.kmp.library")
}

description = "Pure Kotlin chart math shared by every chart family: scales, ticks, paths, stacking and downsampling. No Compose."

kotlin {
    sourceSets {
        // The JDK locale data backs both the jvm and the android target.
        jvmMain { kotlin.srcDir("src/jvmShared/kotlin") }
        androidMain { kotlin.srcDir("src/jvmShared/kotlin") }
    }
}

kotlin {
    sourceSets {
        // Fixtures are classpath resources on the jvm and android unit tests.
        jvmTest { kotlin.srcDir("src/jvmSharedTest/kotlin") }
        getByName("androidUnitTest") {
            kotlin.srcDir("src/jvmSharedTest/kotlin")
        }
    }
}

// AGP unit tests see only the android source sets' java resources, not commonTest's.
android {
    sourceSets.getByName("test").resources.srcDir("src/commonTest/resources")
}

// Kotlin/Native test binaries cannot see commonTest resources; point them at the generated fixtures instead.
tasks.withType<org.jetbrains.kotlin.gradle.targets.native.tasks.KotlinNativeTest>().configureEach {
    val fixtures =
        layout.projectDirectory
            .dir("src/commonTest/resources/fixtures")
            .asFile.absolutePath
    environment("CHART_FIXTURES_DIR", fixtures)
    environment("SIMCTL_CHILD_CHART_FIXTURES_DIR", fixtures)
}
