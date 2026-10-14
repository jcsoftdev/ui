plugins {
    id("jcsoftdev.kmp.compose-library")
}

description = "Hierarchy and flow charts for Compose: sunburst, treemap, tree, sankey, chord and funnel."

kotlin {
    sourceSets {
        commonMain.dependencies {
            api(project(":chart"))
        }
    }
}
