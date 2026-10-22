plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Distribution charts for Compose: box plot, violin and raincloud."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
        }
    }
}
