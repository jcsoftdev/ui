plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Cartesian charts for Compose: bar, line, area, scatter and their variants."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
        }
    }
}
