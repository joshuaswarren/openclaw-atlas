# Security Policy

## Supported Versions

Reporting vulnerabilities affecting the Atlas plugin:

| Version | Supported |
|---------|------------|
| 0.2.x   | ✅ Yes      |
| 0.1.x   | ✅ Yes      |
| < 0.1.0 | ❌ No       |

## Reporting a Vulnerability

If you discover a security vulnerability in Atlas, please **do not open a public issue**. Instead, please follow these steps:

### 1. Determine Impact

Assess the severity of the vulnerability:

- **Critical** — Data exposure, code execution, authentication bypass
- **High** — Significant data leak, privilege escalation
- **Medium** — Limited data exposure, minor privilege escalation
- **Low** — Information disclosure, minor impact

### 2. Report Privately

Send an email to: **security@your-domain.com**

Include:
- **Description** of the vulnerability
- **Proof of concept** (minimal reproducible code)
- **Impact assessment** — What data/systems are affected
- **Proposed fix** (if you have one)

### 3. What to Expect

- **Acknowledgment** — We'll respond within 48 hours
- **Confirmation** — We'll confirm the vulnerability and planned fix
- **Updates** — We'll keep you informed on progress
- **Coordinated Disclosure** — We'll work with you on disclosure timing

### 4. Disclosure Policy

- **Patch First** — Vulnerabilities are disclosed after a fix is released
- **Credit** — You'll be credited in the security advisory
- **Timeline** — We aim to patch within 30 days for critical issues

## Security Best Practices

### For Users

1. **Keep Updated** — Always run the latest version
2. **Review Config** — Don't expose sensitive paths in logs
3. **Access Control** — Restrict who can index/search documents
4. **Monitor Logs** — Watch for suspicious activity

### For Developers

1. **Input Validation** — Validate all user inputs
2. **Path Traversal** — Prevent directory traversal attacks
3. **Command Injection** — Sanitize all subprocess arguments
4. **Secret Protection** — Never log sensitive data

## Security Features

### Input Sanitization

```typescript
// ✅ Sanitize file paths
private sanitizePath(path: string): string {
  // Remove dangerous characters
  const sanitized = path.replace(/\.\./g, "")
                     .replace(/[\/\\]/g, "");
  return sanitized;
}

// ✅ Validate file extensions
private isValidExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return this.config.supportedExtensions.includes(ext);
}
```

### Subprocess Security

```typescript
// ✅ Safe argument passing
const args = [
  "build",
  this.sanitizePath(docPath),
  "--json"
];

// Spawn with explicit PATH
const child = spawn("pageindex", args, {
  env: { ...process.env, PATH: process.env.PATH },
  stdio: ["ignore", "pipe", "pipe"]
});
```

### Cache Security

- No sensitive data in cache
- Automatic expiration
- Size limits enforced

## Vulnerability Types

### Common Issues

1. **Path Traversal** — Mitigated by path sanitization
2. **Command Injection** — Mitigated by argument validation
3. **Denial of Service** — Mitigated by timeouts and job limits
4. **Information Disclosure** — Logs don't contain sensitive data

### Known Limitations

- PageIndex subprocess inherits gateway environment
- No authentication on built-in CLI
- Trusts installed PageIndex binary

## Security Audits

| Date | Version | Auditor | Scope |
|------|---------|---------|-------|
| TBD  | 0.2.0  | TBD    | Pending |

## Coordinated Disclosure

We coordinate security issue disclosure with:

- **Upstream Projects** — PageIndex, OpenClaw
- **Downstream Users** — Plugin consumers
- **Security Researchers** — Bug bounty participants

## Contact

For security-related inquiries:

- **Email:** security@your-domain.com
- **PGP Key:** [Available on request]
- **Security Policy:** https://github.com/your-org/openclaw-atlas/security/policy

## Responsible Disclosure

We appreciate responsible disclosure and will:

1. **Acknowledge** promptly (within 48 hours)
2. **Confirm** the vulnerability
3. **Patch** within reasonable time (30 days for critical)
4. **Credit** discoverers in release notes
5. **Coordinate** disclosure when appropriate

---

**Thank you for helping keep Atlas secure!** 🔒
