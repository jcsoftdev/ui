plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Opt-in chart export for Compose: PNG, CSV and XLSX. Never referenced by a chart."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
        }
    }
}
