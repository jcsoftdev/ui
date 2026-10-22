plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Polar charts for Compose: donut, pie, gauge, radar and parliament."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
        }
    }
}
