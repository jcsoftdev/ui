import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
    alias(libs.plugins.kotlinCompose)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.binaryCompatibilityValidator)
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
    }
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
