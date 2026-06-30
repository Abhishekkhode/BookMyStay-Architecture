# Hotel Management & Booking System — Cloud Architecture

AWS cloud architecture for a full-stack Hotel Management & Booking System. This repo documents infrastructure design, decisions, and operational setup — application code lives in separate frontend/backend repos (linked below).

First AWS project. Background is backend (Spring Boot); AWS and networking were new going in. This repo details the completed **3-part scalability roadmap** — see [Roadmap](#roadmap).

Infrastructure is provisioned manually via the AWS Console. No IaC (Terraform/CDK) yet — noted here explicitly rather than implied.



## Repos

- Frontend: [BookMyStay](https://github.com/Abhishekkhode/BookMyStay)
- Backend: [BookMyStay-BackendService](https://github.com/Abhishekkhode/BookMyStay-BackendService)
- Deployed : [BookMyStay](https://bookmystay-one.vercel.app/)
- This repo: architecture, decisions, docs

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Security & Networking](#security--networking)
- [Observability](#observability)
- [What v1 Intentionally Does Not Include](#what-v1-intentionally-does-not-include)
- [Decisions](#decisions)
- [Cost](#cost)
- [Roadmap](#roadmap)



## Architecture Overview

![Architecture Diagram](./V3/3-Teir.drawio%20%286%29.png)

```
User Browser
     │
     ▼
Vercel (React/Vite SPA)
     │ HTTPS
     ▼
Application Load Balancer (ALB)
     │
     ├────────────────────── (Traffic Routing) ──────────────────────┐
     ▼                                                               ▼
Private Subnets (AZ A)                                      Private Subnets (AZ B)
└── [Auto Scaling Group] EC2 (t3.micro)                     └── [Auto Scaling Group] EC2 (t3.micro)
     │                                                               │
     ├───────────────────────────────┴───────────────────────────────┤
     ▼                                                               ▼
RDS PostgreSQL Database (Private Subnet)                    ElastiCache Redis Cache (Private Subnet)

Outside VPC (via VPC Endpoints):
S3 · Secrets Manager · SSM Parameter Store · CloudWatch · SNS · IAM
```

Full diagram + source file: [`V3/`](./V3)

### 📍 Architectural Evolution (Phase 1 Initial Design)

To see the progression of this project, you can view the starting single-instance topology deployed in **V1**:
* **V1 Architecture Diagram**:
 ![Architecture Diagram](architecture/architecture-diagram.png)
* **V1 Setup Docs**: Refer to the [V1 architectural records and ADR tradeoffs](./architecture/) to see how the single-host infrastructure was originally designed before scaling.


## Tech Stack

| Layer            | Technology                     |
| ---------------- | ------------------------------ |
| Frontend         | React (Vite) on Vercel         |
| Backend          | Java Spring Boot               |
| Database         | RDS (PostgreSQL)               |
| Cache / Sessions | ElastiCache Serverless (Redis) |
| Object Storage   | S3                             |
| Compute          | EC2 (t3.micro)                 |
| Secrets          | Secrets Manager                |
| Config           | SSM Parameter Store            |
| Observability    | CloudWatch, SNS                |
| Endpoint         | VPC Endpoints                  |


## Security & Networking

- RDS and Redis in private subnets, no public IPs.
- Inbound access scoped to security-group references, not CIDR/IP rules.
- No hardcoded credentials — secrets resolved from Secrets Manager / SSM at instance boot.
- IAM role scoped to least-privilege permissions for the specific resources the app uses.
- S3 CORS restricted to known origins (Vercel + local dev).
- Known v1 gap: EC2 instance is in a public subnet. See [ADR-003](./adr/003-public-subnet-v1-tradeoff.md).
- VPC Endpoints for internal Traffic routing


## Observability

- CloudWatch Agent streaming app + system logs from EC2.
- Custom metrics for memory and disk (not collected by default).
- CloudWatch Alarms → SNS email on CPU, memory, disk, and low RDS storage thresholds.

Screenshots: [`screenshots/`](./screenshots)


## What v1 Intentionally Does Not Include

- Application Load Balancer
- Auto Scaling Group
- Multi-AZ RDS
- Private subnet for the application server
- AWS WAF

*Note: These high-availability and security additions have been fully implemented and validated in the [V3 release](./V3/).*


## Decisions

Short, focused write-ups on individual tradeoffs: [`adr/`](./adr)

| ADR                                              | Decision                                  |
| ------------------------------------------------ | ----------------------------------------- |
| [001](./adr/001-presigned-s3-uploads.md)         | Direct-to-S3 uploads via pre-signed URLs  |
| [002](./adr/002-sg-references-over-cidr.md)      | Security-group references over CIDR rules |
| [003](./adr/003-public-subnet-v1-tradeoff.md)    | Public subnet for EC2 in v1               |
| [004](./adr/004-secrets-manager-vs-ssm-split.md) | Secrets Manager + SSM split               |
| [005](./adr/005-single-az-rds-v1.md)             | Single-AZ RDS in v1                       |


## Cost

Approximate, informally tracked during development — not benchmarked. See [`cost/cost-breakdown.md`](./cost/cost-breakdown.md) for the full table and caveats.

---

## Roadmap

| Version | Focus                                             | Status       |
| ------- | ------------------------------------------------- | ------------ |
| v1      | VPC, security groups, IAM, secrets, observability | ✅ Completed |
| v2      | Load testing with k6 to find real bottlenecks     | ✅ Completed |
| v3      | ALB, ASG, Multi-AZ RDS, private app subnet, WAF   | ✅ Completed |


## V2: Load testing with K6

- This directory contains the load testing scripts, configuration results, and metric reports comparing the BookMyStay System's performance before and after executing critical backend catalog optimizations.
- [Analysis & Metrics](./V2/)
- Details - [README.md](./V2/README.md)
- 📥 **Download the Full Benchmarks Slide Deck**: [AWS_Performance_Benchmarks.pdf](./V2/AWS_Performance_Benchmarks.pdf)

## V3: High Availability & Horizontal Scaling

- This directory documents the distributed, load-balanced, and horizontally autoscaled deployment of the system on AWS.
- [Infrastructure & Benchmarks](./V3/)
- Details - [README.md](./V3/README.md)
- **Architectural Diagram**: [3-Teir.drawio (6).png](./V3/3-Teir.drawio%20%286%29.png)
- **Verification**: Scaled system successfully supported **1,500+ concurrent Virtual Users (VUs)** with **0.00% error rates** and sub-20ms average response times.


## Connect with Me
**Abhishek Khode**

*AWS learner building production-inspired cloud architectures and validating them through monitoring and load testing.*

<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linkedin/linkedin-original.svg" width="20" /> [Abhishek Khode](https://www.linkedin.com/in/abhishek-khode-1650372a0/)

<img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg" width="20" /> [Abhishek Khode](https://github.com/Abhishekkhode)
