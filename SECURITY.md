# Security policy

## Scope

This repository is the source for nateanderson.dev. The live site (the `release` branch) and the `integration` branch are both in scope.

The site sits behind a shared password gate. It keeps the site private, but it is not a full authentication system. Please don't spend effort on the gate itself beyond reporting a bypass.

## Reporting a vulnerability

Please don't open a public issue or pull request for a security problem. Use GitHub's private reporting instead: open the **Security** tab and choose **Report a vulnerability**. Include what you found, where it is, and how to reproduce it.

Fixes land on `integration` first and reach the site with the next deploy.

## Secrets

- Never commit credentials: no `.env` files, API keys, service-role keys, tokens, or passwords, even as fallbacks or examples.
- Public values (such as a Supabase publishable key) belong in `NEXT_PUBLIC_*` variables set in Vercel, not in source.
- If a secret is committed, treat it as exposed the moment it is pushed. Rotate it first, then remove it from the current tree. Rewriting git history does not make a public secret private again.
- CI uses throwaway values such as `ci-password` for its own checks. They don't protect anything.

## Dependencies

Dependabot security updates are enabled for npm and GitHub Actions. Please keep `npm audit` clean at the `high` level and above before merging a dependency change.
