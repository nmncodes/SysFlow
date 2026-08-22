FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
# Explicit heap cap: without it the JVM sizes its default heap off the container's cgroup
# limit, which on a small free-tier instance can leave too little headroom for non-heap
# memory (metaspace, thread stacks, direct buffers) and cause GC thrashing that looks like
# a silent startup hang rather than a clean OOM crash.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-XX:+ExitOnOutOfMemoryError", "-jar", "app.jar"]
