plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Stock chart for Compose, built on the candlestick marks of chart-plots."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
            implementation(project(":chart-plots"))
        }
    }
}
