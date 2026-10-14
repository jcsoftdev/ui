plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.kotlinAndroid)
    alias(libs.plugins.kotlinCompose)
    alias(libs.plugins.composeMultiplatform)
}

// One flavour per artifact. Each flavour reaches only its artifact's Probe through ProbeActivity, so the R8 dex of
// <flavour>Release minus the `none` flavour (a Compose activity on UiTheme) is what that artifact adds to an app. scripts/check-chart-size.mjs reads it.
android {
    namespace = "com.jcsoftdev.ui.sizeprobe"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.jcsoftdev.ui.sizeprobe"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.0.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    flavorDimensions += "artifact"
    productFlavors {
        create("none")
        create("chartCore")
        create("chart")
        create("cartesian")
        create("race")
        create("distribution")
        create("plots")
        create("polar")
        create("hierarchy")
        create("units")
        create("gantt")
        create("stock")
        create("crossfilter")
        create("geo")
        create("geoWorld")
        create("geoPeru")
        create("export")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            // Local measurement only: the probe is never distributed.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    // The baseline every flavour shares is a Compose app on the kit, so the manifest components and runtime classes a Compose
    // app already ships are not charged to a chart artifact; only what the artifact itself adds shows in the delta.
    implementation(project(":kit"))
    implementation(compose.runtime)
    implementation(compose.foundation)
    implementation(compose.ui)
    implementation(libs.androidx.activity.compose)
    "chartCoreImplementation"(project(":chart-core"))
    "chartImplementation"(project(":chart"))
    "cartesianImplementation"(project(":chart-cartesian"))
    "raceImplementation"(project(":chart-race"))
    "distributionImplementation"(project(":chart-distribution"))
    "plotsImplementation"(project(":chart-plots"))
    "polarImplementation"(project(":chart-polar"))
    "hierarchyImplementation"(project(":chart-hierarchy"))
    "unitsImplementation"(project(":chart-units"))
    "ganttImplementation"(project(":chart-gantt"))
    "stockImplementation"(project(":chart-stock"))
    "crossfilterImplementation"(project(":chart-crossfilter"))
    "geoImplementation"(project(":chart-geo"))
    "geoWorldImplementation"(project(":chart-geo-world"))
    "geoPeruImplementation"(project(":chart-geo-peru"))
    "exportImplementation"(project(":chart-export"))
}

kotlin {
    compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
}
