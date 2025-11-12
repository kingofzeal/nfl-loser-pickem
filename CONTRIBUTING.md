# Contributing to NFL Loser Pick'em Bot

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/nfl-loser-pickem.git
   cd nfl-loser-pickem
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Setup local database**
   ```bash
   docker-compose up -d postgres
   npm run migrate:up
   ```

5. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Guidelines

### Code Style

- **TypeScript:** Use strict type checking
- **Naming:** 
  - camelCase for variables and functions
  - PascalCase for classes and interfaces
  - UPPER_CASE for constants
- **Formatting:** Run `npm run format` before committing
- **Linting:** Run `npm run lint` to check for issues

### Testing

- Write tests for all new features
- Maintain or improve code coverage
- Run tests before submitting PR: `npm test`

**Test Structure:**
- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Use fixtures in `tests/fixtures/` for mock data

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

**Examples:**
```
feat(picks): add ability to change pick before kickoff
fix(database): resolve connection pool exhaustion
docs(readme): update installation instructions
test(picks): add test for locked pick validation
```

## Project Structure

### Adding a New Service

1. Create interface in `src/services/interfaces/IYourService.ts`
2. Implement in `src/services/YourService.ts`
3. Add tests in `tests/unit/services/YourService.test.ts`
4. Update dependency injection in main entry point

### Adding a New Command

1. Create handler in `src/commands/YourCommandHandler.ts`
2. Implement `ICommandHandler` interface
3. Add to command router
4. Add tests
5. Update help documentation

### Adding a Database Table

1. Create migration in `migrations/XXX_description.sql`
2. Update types in `src/types/index.ts`
3. Add repository methods to `IDatabase.ts`
4. Implement repository methods
5. Write integration tests

## Pull Request Process

1. **Ensure tests pass:** `npm test`
2. **Update documentation** if needed
3. **Describe your changes** in PR description
4. **Link related issues** using `Fixes #123`
5. **Request review** from maintainers

### PR Checklist

- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No TypeScript errors
- [ ] Follows code style guidelines
- [ ] Commits follow conventional format

## Areas for Contribution

### High Priority
- [ ] Database layer implementation
- [ ] Service layer implementation
- [ ] Slack adapter
- [ ] Discord adapter
- [ ] ESPN ingestion module

### Medium Priority
- [ ] Render service (image generation)
- [ ] Scheduler implementation
- [ ] Admin command implementations
- [ ] More comprehensive tests

### Low Priority / Nice to Have
- [ ] Web dashboard
- [ ] Player statistics
- [ ] Multi-league support
- [ ] Mobile notifications
- [ ] Trading system

See `docs/ROADMAP.md` for the full development plan.

## Need Help?

- **Questions?** Open a GitHub Discussion
- **Bugs?** Open an issue with reproduction steps
- **Features?** Open an issue with use case description

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Assume good intentions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to NFL Loser Pick'em Bot! 🏈
