---
role: policy
audience: maintainers, agents
source_of_truth: docs/security-triage.md
update_triggers:
  - security alert workflow changes
  - triage policy changes
---

# Security triage inventory

This file tracks security findings for `dir-archiver` and the decision state for each finding.

## Inventory schema

Each finding record uses:

```json
{
  "ruleId": "string",
  "severity": "error|warning|note|critical|high|medium|low",
  "state": "open|fixed|dismissed",
  "file": "string",
  "line": 0,
  "firstSeen": "ISO-8601",
  "lastSeen": "ISO-8601",
  "owner": "string"
}
```

## Source precedence

1. GitHub Security UI inventory (authoritative while token scopes are limited).
2. GitHub API inventory (`code-scanning/alerts`, `dependabot/alerts`) once scopes are available.

Any temporary fallback to UI-only triage must be logged in private evidence (`tse-workbench`).
