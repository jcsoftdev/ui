import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
    alias(libs.plugins.kotlinCompose)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.binaryCompatibilityValidator)
    alias(libs.plugins.roborazzi)
}

group = "com.jcsoftdev"
version = "0.1.0-SNAPSHOT"

// Tokens are generated from the same tokens.json as the web CSS and never committed.
val uiPackage = rootProject.layout.projectDirectory.dir("../ui")
val generatedTokensDir = layout.buildDirectory.dir("generated/ui-tokens/kotlin/com/jcsoftdev/ui/theme")
val generateUiTokens by tasks.registering(Exec::class) {
    group = "build"
    description = "Generates Theme.kt from packages/ui/tokens/default.json."
    val tokensFile = uiPackage.file("tokens/default.json")
    inputs.file(tokensFile).withPropertyName("tokens").withPathSensitivity(PathSensitivity.RELATIVE)
    inputs
        .files(uiPackage.file("bin/ui-theme.mjs"), uiPackage.file("scripts/build-theme.mjs"))
        .withPropertyName("generator")
        .withPathSensitivity(PathSensitivity.RELATIVE)
    outputs.dir(generatedTokensDir).withPropertyName("generated")
    outputs.cacheIf { true }
    doFirst { delete(generatedTokensDir) }
    commandLine(
        "node",
        uiPackage.file("bin/ui-theme.mjs").asFile.absolutePath,
        "build",
        tokensFile.asFile.absolutePath,
        "--out",
        generatedTokensDir.get().asFile.absolutePath,
        "--kotlin-package",
        "com.jcsoftdev.ui.theme",
        "--kotlin-library",
        "--no-css",
    )
}

// Icons come from the same SVG source as the web icons (packages/ui/icons) and are never committed.
val generatedIconsDir = layout.buildDirectory.dir("generated/ui-icons")
val generateUiIcons by tasks.registering(Exec::class) {
    group = "build"
    description = "Generates one ImageVector file per Lucide icon from packages/ui/icons."
    val iconsDir = uiPackage.dir("icons")
    val generator = rootProject.layout.projectDirectory.file("scripts/build-icons.mjs")
    inputs.dir(iconsDir).withPropertyName("icons").withPathSensitivity(PathSensitivity.RELATIVE)
    inputs.file(generator).withPropertyName("generator").withPathSensitivity(PathSensitivity.RELATIVE)
    outputs.dir(generatedIconsDir).withPropertyName("generated")
    outputs.cacheIf { true }
    commandLine(
        "node",
        generator.asFile.absolutePath,
        iconsDir.asFile.absolutePath,
        generatedIconsDir.get().asFile.absolutePath,
    )
}

kotlin {
    explicitApi()

    jvm {
        compilerOptions.jvmTarget.set(JvmTarget.JVM_17)
    }
    androidTarget {
        compilerOptions.jvmTarget.set(JvmTarget.JVM_17)
    }
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        getByName("commonMain").kotlin.srcDir(generateUiTokens.map { layout.buildDirectory.dir("generated/ui-tokens/kotlin").get() })
        getByName("commonMain").kotlin.srcDir(generateUiIcons.map { generatedIconsDir.get().dir("main") })
        getByName("commonTest").kotlin.srcDir(generateUiIcons.map { generatedIconsDir.get().dir("test") })
        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.ui)
            implementation(compose.components.resources)
        }
        androidMain.dependencies {
            implementation(libs.androidx.activity.compose)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
        jvmTest.dependencies {
            @OptIn(org.jetbrains.compose.ExperimentalComposeLibrary::class)
            implementation(compose.uiTest)
            implementation(compose.desktop.currentOs)
            implementation(libs.roborazzi.compose.desktop)
        }
    }
}

// Roborazzi 1.43 drags in ui-test-junit4 1.6.2, whose classes clash with the 1.8.2 ui-test the kit tests use.
configurations.matching { it.name.startsWith("jvmTest") }.configureEach {
    exclude(group = "org.jetbrains.compose.ui", module = "ui-test-junit4-desktop")
    exclude(group = "org.jetbrains.compose.ui", module = "ui-test-junit4")
}

android {
    namespace = "com.jcsoftdev.ui"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
        consumerProguardFiles("consumer-rules.pro")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

apiValidation {
    ignoredPackages.add("com.jcsoftdev.ui.resources")
    @OptIn(kotlinx.validation.ExperimentalBCVApi::class)
    klib {
        enabled = true
    }
}

composeCompiler {
    reportsDestination = layout.buildDirectory.dir("compose_compiler")
    metricsDestination = layout.buildDirectory.dir("compose_compiler")
    stabilityConfigurationFiles.add(rootProject.layout.projectDirectory.file("compose-stability.conf"))
}

compose.resources {
    publicResClass = false
    packageOfResClass = "com.jcsoftdev.ui.resources"
    generateResClass = always
}
