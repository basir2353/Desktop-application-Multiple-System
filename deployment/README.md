# Deployment

This directory is reserved for deployment manifests and release automation (Docker Compose overlays, Kubernetes, Terraform, etc.).

## Current state

Local development uses the root [`docker-compose.yml`](../docker-compose.yml) for PostgreSQL only. The API ships with a [`Dockerfile`](../services/api/Dockerfile) for container builds.

## Suggested next steps

- Add production Compose or Kubernetes manifests here.
- Wire CI/CD to build and publish `@platform/api` images.
- Document Tauri updater channels and code signing for desktop releases.
