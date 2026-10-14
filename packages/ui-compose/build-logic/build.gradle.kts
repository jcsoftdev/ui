plugins {
    `kotlin-dsl`
}

// A plugin marker artifact resolves from its id and version, so the catalog stays the only place versions live.
fun Provider<PluginDependency>.asDependency() = map { "${it.pluginId}:${it.pluginId}.gradle.plugin:${it.version}" }

dependencies {
    implementation(libs.plugins.kotlinMultiplatform.asDependency())
    implementation(libs.plugins.kotlinCompose.asDependency())
    implementation(libs.plugins.composeMultiplatform.asDependency())
    implementation(libs.plugins.androidLibrary.asDependency())
    implementation(libs.plugins.binaryCompatibilityValidator.asDependency())
    implementation(libs.plugins.roborazzi.asDependency())
    implementation(libs.plugins.mavenPublish.asDependency())
}
