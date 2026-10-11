plugins {
    alias(libs.plugins.androidTest)
    alias(libs.plugins.kotlinAndroid)
    alias(libs.plugins.baselineProfile)
}

android {
    namespace = "com.jcsoftdev.ui.baselineprofile"
    compileSdk = 36

    defaultConfig {
        minSdk = 28
        targetSdk = 36
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    targetProjectPath = ":sample"
}

// Run on the connected device or emulator; add `-Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.suppressErrors=EMULATOR`
// to run the profile generator or the benchmarks on an emulator (emulator timings are indicative only).
baselineProfile {
    useConnectedDevices = true
}

kotlin {
    compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
}

dependencies {
    implementation(libs.androidx.test.ext.junit)
    implementation(libs.androidx.test.uiautomator)
    implementation(libs.androidx.benchmark.macro.junit4)
}
