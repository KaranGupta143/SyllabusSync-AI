# Security Policy

## Supported Versions

This repository currently maintains the latest main branch.

## Reporting a Vulnerability

Please do not open public issues for security vulnerabilities.

Report security concerns privately with:

- clear vulnerability description
- impact assessment
- reproduction steps or proof of concept
- suggested mitigation (if available)

We aim to acknowledge valid reports quickly and provide a remediation timeline.

## Security Hardening Checklist

Before production release:

- enable JWT verification for edge functions
- tighten RLS policies to least privilege
- rotate API keys and service-role keys regularly
- add request rate limiting and abuse protection
- monitor logs and alert on suspicious patterns
