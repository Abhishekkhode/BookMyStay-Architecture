# Cost Breakdown

> Figures below were tracked informally during development at low/test traffic levels — not benchmarked, not production load. Treat as directional, not exact. Replace with your own AWS Cost Explorer figures.

| Service | Configuration | Approx. Monthly Cost |
|---|---|---|
| EC2 | t3.micro, single instance | $21.21 |
| RDS (PostgreSQL) | Single-AZ, db.t3.micro | $1.38 |
| ElastiCache Serverless (Redis) | Low-throughput, dev usage | $3.25 |
| VPC | $2.15 |
| Secrets Manager | __ secrets | $0.02 |
| SSM Parameter Store | Standard tier | $0 (free tier) |
| CloudWatch | Logs + custom metrics + alarms | $0.17 |
| SNS | Email notifications | ~$0 (low volume) |
| **Total (approx.)** | | **$28.18** |

## Notes
- Most services here qualify for AWS Free Tier on a new account — actual cost will be higher post–free tier.
