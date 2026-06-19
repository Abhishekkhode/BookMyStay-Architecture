# ADR-004: Secrets Manager + SSM Parameter Store Split

## Status
Accepted (v1)

## Context
The application needs both sensitive values (DB credentials, JWT signing secret) and non-sensitive config (RDS hostname, Redis cluster endpoint, S3 bucket name) available at runtime, without hardcoding either in the repository.

## Decision
Sensitive values go in AWS Secrets Manager. Non-sensitive config goes in SSM Parameter Store. A boot-time script resolves both and writes them to a `.env` file consumed by the systemd-managed service.

## Why
Secrets Manager provides encryption and rotation suited to genuinely sensitive values, but costs more per secret. SSM Parameter Store (standard tier) is free and sufficient for values that aren't sensitive but still shouldn't be hardcoded. Splitting them avoids paying for rotation/encryption overhead on values that don't need it, while keeping sensitive values fully out of the repo and out of plaintext config files.

## Consequences
- Zero hardcoded credentials or config in source control.
- Two services to manage instead of one, and the boot script needs to resolve both — minor added complexity, acceptable given the cost/capability tradeoff.
