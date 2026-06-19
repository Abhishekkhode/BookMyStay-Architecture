# ADR-005: Single-AZ RDS in v1

## Status
Accepted (v1) — Revisit in v3

## Context
RDS supports Multi-AZ deployment, which maintains a synchronously replicated standby in a second Availability Zone and fails over automatically during an outage. This roughly doubles RDS cost.

## Decision
Run RDS Single-AZ in v1. Multi-AZ is deferred to v3.

## Why
This is a learning project with no production traffic. Multi-AZ protects against an AZ-level outage, but enabling it doesn't teach anything additional about the areas v1 was scoped to — networking, IAM, secrets management, observability. The cost is better justified once there's a real availability requirement to design around, informed by v2's load testing.

RDS is configured so Multi-AZ can be enabled with a single change later, without schema or application changes.

## Consequences
- No automatic failover if the current AZ has an outage — acceptable for v1's scope and traffic level.
- Enabling Multi-AZ later is a configuration change, not a redesign.
