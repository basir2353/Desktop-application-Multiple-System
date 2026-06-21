# Infrastructure

This directory is reserved for infrastructure-as-code and cloud provisioning (Terraform, Pulumi, Ansible, etc.).

## Current state

The repository includes only local development infrastructure:

- [`docker-compose.yml`](../docker-compose.yml) — PostgreSQL for the NestJS API
- [`services/api/Dockerfile`](../services/api/Dockerfile) — API container image

Add cloud-specific modules here when you deploy to staging or production.
