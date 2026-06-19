# ADR-002: Security-Group References Over CIDR Rules

## Status
Accepted (v1)

## Context
RDS and Redis need inbound rules that allow traffic only from the application tier. The common beginner approach is to whitelist the EC2 instance's IP address directly.

## Decision
Inbound rules on the RDS and Redis security groups reference the EC2 instance's security group ID, not its IP address or a CIDR block.

## Why
IP-based rules break silently if the underlying instance is stopped/restarted and gets a new IP (or moves to a new instance entirely). A security-group reference stays correct regardless of the instance's IP, because it's scoped to "anything carrying this SG," not a fixed address. It's also more self-documenting — the rule reads as "traffic from the app tier," not an opaque IP someone has to cross-reference later.

## Consequences
- Inbound rules remain valid through instance replacement, without manual updates.
- This pattern doesn't extend to the EC2 instance's own inbound rule, since browser-originated traffic has no fixed source IP or SG to reference — see [ADR-003](./003-public-subnet-v1-tradeoff.md).
