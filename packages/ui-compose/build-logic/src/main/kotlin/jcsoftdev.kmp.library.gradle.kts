import com.vanniktech.maven.publish.JavadocJar
import com.vanniktech.maven.publish.KotlinMultiplatform
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// The shared convention of every chart artifact: targets, explicitApi, ABI check and Maven Central coordinates.
// The artifact id and the Android namespace follow the Gradle project name, so a module build file only declares its edges:
//   :chart-core -> com.jcsoftdev:ui-compose-chart-core, namespace com.jcsoftdev.ui.chart.core
plugins {
    id("org.jetbrains.kotlin.multiplatform")
    id("com.android.library")
    id("org.jetbrains.kotlinx.binary-compatibility-validator")
    id("com.vanniktech.maven.publish")
}

group = "com.jcsoftdev"
version = providers.gradleProperty("VERSION_NAME").get()

kotlin {
    explicitApi()

    jvm {
        compilerOptions.jvmTarget.set(JvmTarget.JVM_17)
    }
    androidTarget {
        compilerOptions.jvmTarget.set(JvmTarget.JVM_17)
    }
    iosArm64()
    iosSimulatorArm64()

    sourceSets {
        commonTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}

android {
    namespace = "com.jcsoftdev.ui.${project.name.replace('-', '.')}"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

apiValidation {
    @OptIn(kotlinx.validation.ExperimentalBCVApi::class)
    klib {
        enabled = true
    }
}

mavenPublishing {
    configure(
        KotlinMultiplatform(
            javadocJar = JavadocJar.Empty(),
            androidVariantsToPublish = listOf("release"),
        ),
    )
    publishToMavenCentral()
    if (providers.gradleProperty("signingInMemoryKey").isPresent) {
        signAllPublications()
    }
    coordinates(artifactId = "ui-compose-${project.name}")
    pom {
        name.set("jcsoftdev UI (Compose) ${project.name}")
        description.set(provider { project.description ?: "jcsoftdev UI Compose chart artifact ${project.name}." })
        inceptionYear.set("2026")
        url.set("https://github.com/jcsoftdev/ui")
        licenses {
            license {
                name.set("MIT License")
                url.set("https://opensource.org/licenses/MIT")
                distribution.set("repo")
            }
        }
        developers {
            developer {
                id.set("jcsoftdev")
                name.set("Juan Carlos")
                url.set("https://github.com/jcsoftdev")
            }
        }
        scm {
            url.set("https://github.com/jcsoftdev/ui")
            connection.set("scm:git:git://github.com/jcsoftdev/ui.git")
            developerConnection.set("scm:git:ssh://git@github.com/jcsoftdev/ui.git")
        }
    }
}
