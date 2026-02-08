# Contributing to Atlas

Thank you for your interest in contributing to Atlas! This document provides guidelines and instructions for contributing to the project.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork locally**
   ```bash
   git clone https://github.com/your-username/openclaw-atlas.git
   cd openclaw-atlas
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. **Make your changes** and test thoroughly
6. **Commit your changes**
   ```bash
   git commit -m "Add some feature"
   ```
7. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Create a Pull Request** on GitHub

## 📋 Development Setup

### Prerequisites

- **Node.js** 18.x or later
- **npm** or **pnpm**
- **TypeScript** 5.x
- **PageIndex** Python package
  ```bash
  pip install pageindex
  ```

### Build Commands

```bash
# Build the plugin
npm run build

# Watch mode for development
npm run dev

# Type checking
npm run typecheck
```

### Project Structure

```
openclaw-atlas/
├── src/                    # Source code
│   ├── index.ts          # Plugin entry point
│   ├── types.ts          # TypeScript interfaces
│   ├── config.ts         # Configuration parsing
│   ├── logger.ts         # Logging wrapper
│   ├── pageindex.ts      # PageIndex API client
│   ├── storage.ts        # Storage & state management
│   ├── tools.ts          # Agent tools
│   └── cli.ts            # CLI commands
├── dist/                   # Built output (npm run build)
├── state/                  # Runtime data (gitignored)
│   ├── jobs/             # Async job tracking
│   ├── cache/            # Search result cache
│   └── index-state/      # Incremental indexing state
├── openclaw.plugin.json   # Plugin manifest
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── tsup.config.ts        # Build configuration
├── README.md              # User documentation
├── SCALING.md             # Scaling guide
├── CHANGELOG.md            # Version history
├── CONTRIBUTING.md         # This file
├── CLAUDE.md               # Agent guidelines
└── LICENSE                 # MIT License
```

## 🧪 Testing

### Manual Testing Checklist

Before submitting a PR, verify:

- [ ] Plugin builds successfully (`npm run build`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] All new features are documented
- [ ] CLI commands work as expected
- [ ] Agent tools return valid results
- [ ] Scaling features (async, incremental, sharding, caching) work correctly

### Testing Scenarios

#### Small Collections (< 100 docs)
```bash
# Index a small collection
openclaw atlas index ~/Documents/small-collection

# Search
openclaw atlas search "test query"

# Should return results quickly
```

#### Large Collections (1000+ docs)
```bash
# Async indexing
openclaw atlas index ~/Documents/large-collection --background

# Monitor progress
openclaw atlas jobs
openclaw atlas job-status <job-id>

# Incremental update
openclaw atlas index ~/Documents/large-collection --incremental
```

#### Caching
```bash
# First search (cache miss)
openclaw atlas search "query"

# Second search (cache hit - should be faster)
openclaw atlas search "query"

# Check cache stats
openclaw atlas cache-stats
```

## 📝 Coding Standards

### TypeScript Guidelines

- **Strict mode enabled** — All code must pass `tsc --strict`
- **Type safety** — Avoid `any` types, use proper interfaces
- **Async/await** — Use async/await over callbacks
- **Error handling** — Proper try/catch with meaningful error messages

### Code Style

```typescript
// ✅ Good: Clear types, proper error handling
async indexDocument(docPath: string): Promise<PageIndexBuildResult> {
  try {
    const result = await this.pageindex.buildIndex(docPath);
    log.info(`Indexed ${docPath} successfully`);
    return result;
  } catch (error) {
    log.error(`Failed to index ${docPath}:`, error);
    return {
      success: false,
      documentPath: docPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ❌ Bad: No types, poor error handling
async indexDocument(docPath: any) {
  const result = await this.pageindex.buildIndex(docPath);
  return result; // What if this fails?
}
```

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `pageindex.ts`, `storage.ts`)
- **Classes**: `PascalCase` (e.g., `PageIndexClient`, `StorageManager`)
- **Interfaces**: `PascalCase` (e.g., `PluginConfig`, `IndexJob`)
- **Functions/Methods**: `camelCase` (e.g., `loadMetadata`, `saveJob`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `PAGEINDEX_TIMEOUT_MS`)
- **Private methods**: Prefix with `_` (e.g., `_getCacheKey()`)

### Documentation

**JSDoc Comments:**
```typescript
/**
 * Build a PageIndex tree from a document
 * @param docPath - Path to the document to index
 * @param options - Optional indexing parameters
 * @returns Result with success status, timing, and node count
 */
async buildIndex(
  docPath: string,
  options?: { timeout?: number }
): Promise<PageIndexBuildResult>
```

**Inline Comments:**
```typescript
// Check cache first for faster responses
const cached = await this.getCache(query, collection);
if (cached) {
  log.debug(`Cache hit for query: "${query}"`);
  return cached.results;
}

// Cache miss - query PageIndex
log.debug(`Cache miss for query: "${query}", querying PageIndex...`);
```

## 🎯 Feature Guidelines

### Adding New Features

1. **Update types** — Add interfaces to `types.ts`
2. **Update config** — Add config options if needed
3. **Implement** — Add functionality to appropriate module
4. **Test** — Verify functionality works
5. **Document** — Update README, SCALING.md, or add guides
6. **Update CHANGELOG** — Add entry to changelog

### Scaling Features

When adding scaling-related features:
- Consider performance impact on large collections
- Add progress tracking for long-running operations
- Support async/non-blocking patterns
- Include caching where appropriate
- Document in SCALING.md

### Agent Tools

When adding new agent tools:
1. Add to `tools.ts`
2. Include clear description and parameter docs
3. Handle errors gracefully
4. Return formatted, user-friendly results
5. Test with actual agent interactions

## 📖 Documentation Standards

### README.md

**Target audience:** Users

- Clear installation instructions
- Usage examples
- Configuration options
- Performance characteristics
- Troubleshooting guide

### SCALING.md

**Target audience:** Operators with large collections

- Performance benchmarks
- Scaling strategies
- Configuration recommendations
- Migration guides
- Best practices

### CLAUDE.md

**Target audience:** Agent developers

- Architecture notes
- Common gotchas
- Testing guidelines
- Code patterns

### CHANGELOG.md

**Target audience:** All stakeholders

- Version history
- Breaking changes
- New features
- Performance improvements
- Migration guides

## 🐛 Bug Reports

### Before Reporting

1. **Check existing issues** — Search for similar problems
2. **Verify version** — Ensure you're on the latest version
3. **Create minimal reproduction** - Smallest code that exhibits the issue

### Bug Report Template

```markdown
## Description
Clear description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Atlas version: 0.2.0
- OpenClaw version:
- Node.js version:
- Operating system:

## Logs
```
Paste relevant log output here
```

## Additional Context
Any other relevant information
```

## ✨ Pull Request Guidelines

### PR Title

Use conventional commit format:

```
feat: Add support for DOCX documents
fix: Resolve race condition in job tracking
docs: Update SCALING.md with sharding examples
refactor: Simplify cache key generation
```

### PR Description

Include:

- **Summary** — What this PR does and why
- **Changes** — List of files modified
- **Testing** — How you tested this PR
- **Screenshots** — For UI changes (if applicable)
- **Breaking changes** — Any breaking changes (if applicable)

### Before Submitting

- [ ] Code builds successfully (`npm run build`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] Documentation updated (README, SCALING.md, CHANGELOG.md)
- [ ] Tests pass (manual testing checklist)
- [ ] Commits follow conventional commit format
- [ ] PR description is clear and comprehensive

### Review Process

1. **Automated checks** — CI will build and test
2. **Code review** — Maintainers will review your code
3. **Feedback** — Address review comments
4. **Approval** — PR approved and merged

## 🎨 Design Philosophy

Atlas follows these principles:

1. **Local-first** — All data stored locally, no external dependencies
2. **Async by default** — Long operations should be non-blocking
3. **Incremental when possible** — Only re-do work when necessary
4. **Observable** — Users can see what's happening (progress, status, errors)
5. **Configurable** - All features have sensible defaults but can be customized
6. **Documented** — Every feature has clear documentation

## 🤝 Code Review

### As a Reviewer

- **Be constructive** — Provide specific, actionable feedback
- **Explain why** — Help contributors understand the reasoning
- **Approve when ready** — Don't block on minor preferences

### As a Contributor

- **Be patient** — Reviewers are volunteers
- **Respond promptly** — Address feedback in a timely manner
- **Ask questions** — Clarify feedback you don't understand
- **Revise and resubmit** — Make requested changes promptly

## 🌟 Recognition

Contributors will be recognized in:
- **README.md** — Contributors section
- **CHANGELOG.md** — Credit for specific features
- **GitHub releases** — Automatic contributor list

## 📜 License

By contributing, you agree that your contributions will be licensed under the **MIT License**.

## 🎯 Areas Where Help Is Needed

We're particularly interested in contributions for:

1. **Hybrid RAG** — Add vector embeddings alongside PageIndex
2. **Additional formats** — DOCX, PPTX, EPUB support
3. **Performance optimization** — Faster indexing and search
4. **UI improvements** — Better progress visualization
5. **Documentation** — More examples, tutorials, guides
6. **Testing** - Automated test suite

## 💬 Communication

- **GitHub Issues** — Bug reports, feature requests
- **GitHub Discussions** — Questions, ideas, proposals
- **Pull Requests** — Code contributions

---

## 🙏 Thank You

Contributors like you make Atlas better for everyone. We appreciate your time and expertise!

**Happy indexing!** 📚🗺️
