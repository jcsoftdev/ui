plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Chart foundation for Compose: frame, state, hover and pin, dock, tooltip, legend and accessibility."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart-core"))
            api(project(":kit"))
        }
    }
}
