plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Unit charts for Compose: waffle, pictogram and progress units."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
        }
    }
}
