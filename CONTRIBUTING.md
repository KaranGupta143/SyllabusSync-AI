# Contributing to SyllabusSync AI

Thanks for your interest in contributing.

## Development Setup

1. Fork the repository and create a feature branch.
2. Install dependencies:
   npm install
3. Create .env from .env.example.
4. Run local development:
   npm run dev

## Code Standards

- Use TypeScript for all new frontend code.
- Follow existing naming conventions and folder structure.
- Keep components focused and reusable.
- Prefer small, testable functions.

## Quality Checks

Before opening a PR, run:

- npm run lint
- npm run test
- npm run build

## Pull Request Guidelines

- Keep PRs small and scoped to one concern.
- Add clear PR title and description.
- Include screenshots for UI changes.
- Mention any schema, env, or deployment changes.

## Commit Message Suggestions

Use concise, descriptive commit messages, for example:

- feat: add topic mastery trend chart
- fix: handle empty quiz response gracefully
- docs: update setup instructions

## Reporting Issues

When filing a bug, include:

- expected behavior
- actual behavior
- steps to reproduce
- browser and OS details
- relevant logs or screenshots
