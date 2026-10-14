plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Geo charts for Compose: projections, choropleth, bubble map, hex tile and globe. Map data lives in separate artifacts."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
        }
    }
}
