plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Gantt chart for Compose."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
        }
    }
}
