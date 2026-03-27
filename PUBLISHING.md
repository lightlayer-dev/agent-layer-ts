# Publishing to npm

This monorepo publishes all packages under the `@agent-layer` npm scope.

## First-time setup

### 1. Create the npm org

1. Go to [npmjs.com](https://www.npmjs.com) and sign in (or create an account)
2. Click your avatar → **Add an Organization**
3. Name it `agent-layer` — this reserves the `@agent-layer` scope
4. Choose the **free** plan (unlimited public packages)

### 2. Generate an npm access token

1. Go to [npmjs.com/settings/tokens](https://www.npmjs.com/settings/~/tokens)
2. Click **Generate New Token** → **Classic Token**
3. Select **Automation** (bypasses 2FA for CI — safe for publish-only tokens)
4. Copy the token

### 3. Add the token to GitHub

1. Go to the repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `NPM_TOKEN`
4. Value: paste the token from step 2
5. Click **Add secret**

## Publishing

### Option A: Push a version tag

```bash
# Bump versions in each package.json first, then:
git tag v0.1.0
git push origin v0.1.0
```

This triggers the publish workflow automatically.

### Option B: Manual dispatch

1. Go to **Actions** → **Publish to npm** → **Run workflow**
2. Optionally enter a tag name for reference
3. Click **Run workflow**

### What happens

The workflow will:
1. Install dependencies
2. Build all packages
3. Run tests
4. Publish all packages with `pnpm -r publish --no-git-checks`

Packages that are already published at their current version will be skipped (npm returns 403 for duplicate versions — that's fine).

## Versioning strategy

We use **manual version bumps** for now:

1. Update `version` in each `packages/*/package.json` that changed
2. Keep versions in sync across packages (all at the same version)
3. Commit the version bump
4. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`

### Version checklist

- [ ] Bump `version` in changed `packages/*/package.json` files
- [ ] Update inter-package dependency ranges if needed (e.g. `@agent-layer/core`)
- [ ] Commit: `chore: bump to vX.Y.Z`
- [ ] Tag: `git tag vX.Y.Z`
- [ ] Push: `git push origin main --tags`

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@agent-layer/core` | [![npm](https://img.shields.io/npm/v/@agent-layer/core)](https://npmjs.com/package/@agent-layer/core) | Core utilities — error envelopes, rate limiting, llms.txt, discovery |
| `@agent-layer/express` | [![npm](https://img.shields.io/npm/v/@agent-layer/express)](https://npmjs.com/package/@agent-layer/express) | Express middleware |
| `@agent-layer/hono` | [![npm](https://img.shields.io/npm/v/@agent-layer/hono)](https://npmjs.com/package/@agent-layer/hono) | Hono middleware |
| `@agent-layer/fastify` | [![npm](https://img.shields.io/npm/v/@agent-layer/fastify)](https://npmjs.com/package/@agent-layer/fastify) | Fastify plugin |
| `@agent-layer/koa` | [![npm](https://img.shields.io/npm/v/@agent-layer/koa)](https://npmjs.com/package/@agent-layer/koa) | Koa middleware |
| `@agent-layer/score` | [![npm](https://img.shields.io/npm/v/@agent-layer/score)](https://npmjs.com/package/@agent-layer/score) | Agent-readiness score CLI |
| `@agent-layer/strapi` | [![npm](https://img.shields.io/npm/v/@agent-layer/strapi)](https://npmjs.com/package/@agent-layer/strapi) | Strapi 4 plugin |
| `@agent-layer/firestore` | [![npm](https://img.shields.io/npm/v/@agent-layer/firestore)](https://npmjs.com/package/@agent-layer/firestore) | Firestore adapter |
