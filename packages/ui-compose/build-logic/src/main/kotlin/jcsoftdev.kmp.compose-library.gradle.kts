import org.gradle.api.artifacts.VersionCatalogsExtension

// The Compose layer of the chart convention: Compose runtime, the stability config of the kit and the Roborazzi wiring.
// Applied on top of jcsoftdev.kmp.library by every chart module that draws; chart-core and the data artifacts skip it.
plugins {
    id("jcsoftdev.kmp.library")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.compose")
    id("io.github.takahirom.roborazzi")
}

val libs = extensions.getByType<VersionCatalogsExtension>().named("libs")

kotlin {
    sourceSets {
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.ui)
        }
        jvmTest.dependencies {
            @OptIn(org.jetbrains.compose.ExperimentalComposeLibrary::class)
            implementation(compose.uiTest)
            implementation(compose.desktop.currentOs)
            implementation(libs.findLibrary("roborazzi-compose-desktop").get())
        }
    }
}

// Roborazzi drags in ui-test-junit4 1.6.2, whose classes clash with the ui-test the Compose version ships.
configurations.matching { it.name.startsWith("jvmTest") }.configureEach {
    exclude(group = "org.jetbrains.compose.ui", module = "ui-test-junit4-desktop")
    exclude(group = "org.jetbrains.compose.ui", module = "ui-test-junit4")
}

composeCompiler {
    stabilityConfigurationFiles.add(rootProject.layout.projectDirectory.file("compose-stability.conf"))
}
