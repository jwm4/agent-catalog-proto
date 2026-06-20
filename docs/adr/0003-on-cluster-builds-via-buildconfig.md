# 3. On-Cluster Builds via OpenShift BuildConfig

Date: 2026-06-18

## Status

Accepted

## Context

The prototype needs to build container images from generated Containerfiles.
Options:

- **Local builds (Podman/Docker):** Requires build tooling installed on the
  developer's laptop. Adds a prerequisite and does not reflect the product
  architecture.
- **OpenShift BuildConfig (Docker strategy, binary source):** On-cluster builds
  via `oc start-build --from-dir`. The cluster builds the image and pushes to
  its internal registry. Already proven on the dev cluster for claude-code,
  openclaw, and other agent deployments.
- **Shipwright (Builds for Red Hat OpenShift):** The strategic replacement for
  BuildConfig. Supports multiple build strategies (Buildah, S2I, Buildpacks).
  Kubernetes-native API. Not yet proven in our environment.

## Decision

Use OpenShift BuildConfig with Docker strategy and binary source for the
prototype. The backend generates a Containerfile and source context, creates a
BuildConfig and ImageStream on the cluster, and starts the build via
`oc start-build --from-dir`. The image lands in the internal OpenShift registry.

The build layer is designed with a clean `BuildBackend` interface so that
swapping to Shipwright later is straightforward.

## Consequences

**Positive:**
- No Podman, Docker, or local build tooling needed on the developer laptop.
- No external registry setup (internal registry handles storage).
- Build environment matches deployment environment.
- Build logs stream back to the UI via `--follow`.
- Already working on the dev cluster with the same pattern.

**Negative:**
- BuildConfig is the older system, being superseded by Shipwright.
- Docker strategy requires a Dockerfile-compatible build context.
- User needs `oc` CLI access with permissions to create BuildConfig,
  ImageStream, and Build resources.
