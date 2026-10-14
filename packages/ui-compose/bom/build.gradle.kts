import com.vanniktech.maven.publish.JavaPlatform

plugins {
    `java-platform`
    alias(libs.plugins.mavenPublish)
}

group = "com.jcsoftdev"
version = providers.gradleProperty("VERSION_NAME").get()
description = "Bill of materials aligning every jcsoftdev UI Compose artifact on one version."

// The kit and every chart module, by project name, so a new module is aligned the moment it is registered in settings.
dependencies {
    constraints {
        rootProject.subprojects
            .filter { it.path == ":kit" || it.path.startsWith(":chart") }
            .forEach { api("com.jcsoftdev:${if (it.path == ":kit") "ui-compose" else "ui-compose-${it.name}"}:$version") }
    }
}

mavenPublishing {
    configure(JavaPlatform())
    publishToMavenCentral()
    if (providers.gradleProperty("signingInMemoryKey").isPresent) {
        signAllPublications()
    }
    coordinates(artifactId = "ui-compose-bom")
    pom {
        name.set("jcsoftdev UI (Compose) BOM")
        description.set(project.description)
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
