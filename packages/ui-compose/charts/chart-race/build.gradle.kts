plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Bar race chart for Compose."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
        }
    }
}
