# ui-compose

Compose Multiplatform UI kit (Android, JVM desktop, iOS) built from the same design tokens and icons as the web `@jcsoftdev/ui`. Parity matrix: [docs/parity.md](docs/parity.md).

## Install

Published to Maven Central as `com.jcsoftdev:ui-compose`.

```kotlin
// commonMain (Kotlin Multiplatform)
dependencies {
    implementation("com.jcsoftdev:ui-compose:0.1.0")
}
```

Gradle resolves the per-target artifacts (`ui-compose-android`, `ui-compose-jvm`, `ui-compose-iosarm64`, `ui-compose-iossimulatorarm64`) through Gradle module metadata. Android-only projects can depend on `com.jcsoftdev:ui-compose-android:0.1.0` directly. The Android artifact ships the kit's baseline profile.

## Release procedure

The version lives in one place: `VERSION_NAME` in `gradle.properties`.

1. Bump `VERSION_NAME` (for example `0.1.1`), update the install snippet above, and merge to `main`.
2. Tag the merge commit and push the tag: `git tag ui-compose-v0.1.1 && git push origin ui-compose-v0.1.1`.
3. `.github/workflows/ui-compose-release.yml` verifies the tag matches `VERSION_NAME`, re-runs the compose checks on Linux, then runs `./gradlew publishAndReleaseToMavenCentral --no-configuration-cache` on macOS (the iOS klibs need a Mac host).
4. Central releases are immutable. Check the deployment on https://central.sonatype.com/publishing/deployments.

Required repository secrets (environment `maven-central`):

| Secret | Gradle property |
| --- | --- |
| `MAVEN_CENTRAL_USERNAME` | `mavenCentralUsername` (Central Portal user token name) |
| `MAVEN_CENTRAL_PASSWORD` | `mavenCentralPassword` (Central Portal user token) |
| `SIGNING_KEY` | `signingInMemoryKey` (ASCII-armored private key, `gpg --armor --export-secret-keys <id>`) |
| `SIGNING_KEY_PASSWORD` | `signingInMemoryKeyPassword` |

The `com.jcsoftdev` namespace must be verified in the Central Portal, and the public key published to a keyserver (`keys.openpgp.org`).

### Local verification

```sh
./gradlew publishToMavenLocal --no-configuration-cache   # unsigned unless signingInMemoryKey is set
```

Artifacts land in `~/.m2/repository/com/jcsoftdev`. Signing only activates when `ORG_GRADLE_PROJECT_signingInMemoryKey` is present.
