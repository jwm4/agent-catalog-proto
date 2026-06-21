# Java Language Reference

## Installation

Install a JDK via: `addPackage("microdnf", ["java-21-openjdk-devel"])`

Available JDK versions in UBI 10 repos: `java-11-openjdk-devel`,
`java-17-openjdk-devel`, `java-21-openjdk-devel`. Use the `-devel` variant
(not `-headless`) so the compiler (`javac`) is included.

## Build Tools

**Maven:**
`addPackage("microdnf", ["maven"])`

**Gradle:**
Gradle is not in the UBI repos. Install manually:
```
addRunCommand("curl -fsSL https://services.gradle.org/distributions/gradle-8.10-bin.zip -o /tmp/gradle.zip && unzip -q /tmp/gradle.zip -d /opt && ln -s /opt/gradle-8.10/bin/gradle /usr/local/bin/gradle && rm /tmp/gradle.zip")
```

## Common Packages by Use Case

- **Web:** spring-boot, quarkus, micronaut, vert.x
- **Testing:** junit5, mockito, testcontainers
- **Linting:** checkstyle, spotbugs, pmd
- **Formatting:** google-java-format, spotless
- **Build plugins:** maven-surefire-plugin, jacoco (coverage)

## Notes

- Maven and Gradle download dependencies at build time. Consider adding
  `addRunCommand("mvn dependency:go-offline")` or equivalent to cache
  dependencies in the image layer.
- If the user has a `pom.xml` or `build.gradle`, suggest copying it into
  the container and pre-fetching dependencies for faster startup.
- Spring Boot projects typically need `JAVA_TOOL_OPTIONS` set for container
  awareness: `setEnvVar("JAVA_TOOL_OPTIONS", "-XX:MaxRAMPercentage=75.0")`
