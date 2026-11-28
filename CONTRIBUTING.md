# Contributing

This project follows a unified development workflow shared across the
maintainer's repositories (adopted from aegis-app/aegis-bot).

## Development workflow

1. **Open an issue first.** Every change starts with an issue (use the
   issue templates). Describe the purpose, the planned work, and the
   definition of done.
2. **Create a branch from `main`** named `<type>/<issue-number>-<slug>`,
   e.g. `feat/12-test-command`, `fix/9-summary-resend`, `docs/3-readme`.
3. **Implement and test.** Run `npm test` locally; it must pass. The CI
   also syntax-checks every JavaScript file and validates every JSON file.
4. **Open a pull request.** Fill in the PR template and link the issue
   with `Closes #<number>`.
5. **Merge with "Rebase and merge"** to keep the history of `main`
   linear, then delete the branch.

## Commit messages

Commit messages use **Conventional Commits with English subjects**:

```
feat: add master data counts display
fix: persist the posted date to stop re-sending after restarts
docs: update documentation for v1.0.0
data: refresh server metrics snapshot
```

Types in use: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `data`.

## Data updates

`status.json` is hand-maintained operational data. Updating it follows the
same workflow (issue → branch → PR); the unit tests pin its shape, entry
counts, and consistency with `api/sites.js`, so a malformed update fails
CI before it can be deployed.

## Releases

Releases are cut from `main`: bump the version, tag `vX.Y.Z`, and publish
a GitHub Release with notes only (no binaries are attached).

## Notes

- Never commit secrets. Configuration goes in `.env` (see `.env.example`
  if present); `.env` is git-ignored.
- Deploys are done with the Vercel CLI from a local checkout
  (`vercel deploy --prod`); pushing to GitHub does not deploy.
