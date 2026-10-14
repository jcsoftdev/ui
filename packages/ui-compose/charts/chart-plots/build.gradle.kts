plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Plot charts for Compose: heatmap, beeswarm, candlestick, stream graph and timeline."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
        }
    }
}
