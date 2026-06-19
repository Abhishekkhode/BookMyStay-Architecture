# ADR-003: Public Subnet for EC2 in v1

## Status
Accepted (v1) — Superseded in v3

## Context
RDS and Redis are locked down via security-group references (see [ADR-002](./002-sg-references-over-cidr.md)). The application server (EC2) does not have equivalent network isolation in v1 — it sits in a public subnet.

## Decision
Keep EC2 in a public subnet for v1. Defer private-subnet isolation to v3, alongside an Application Load Balancer and AWS WAF.

## Why
The frontend (Vercel) makes browser-to-API calls — requests originate from end-user browsers, not from a fixed set of infrastructure IPs. This means there's no IP or CIDR-based rule that could meaningfully restrict inbound access to the API the way SG references restrict access to RDS/Redis; the source IP EC2 sees is the user's, not Vercel's.

The structural fix isn't a tighter inbound rule — it's an architectural layer: an Application Load Balancer (or API Gateway) in the public subnet, fronting an EC2 instance moved into a private subnet, with WAF in front for request-level filtering. That's a deliberate v3 addition, not a v1 patch, because it brings ALB, target groups, and (eventually) Auto Scaling along with it — scope intentionally deferred until v2's load testing informs what's actually needed.

## Consequences
- v1's application layer has no network-level access restriction beyond the security group's port/protocol rules — this is a known, accepted gap, not a blind spot.
- v3 resolves this by moving EC2 behind an ALB into a private subnet, with WAF added for request filtering.
