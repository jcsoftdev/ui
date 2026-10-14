plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Cross-filter provider and linked charts for Compose, built on chart-cartesian."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
            implementation(project(":chart-cartesian"))
        }
    }
}
