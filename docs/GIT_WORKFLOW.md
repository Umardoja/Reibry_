# Git workflow

| Branch | Responsibility |
| --- | --- |
| `main` | Reviewed, buildable shared baseline and releases |
| `feat/integration` | Person 1: infrastructure, auth, database, API, context/actions, integration |
| `feat/ai-engine` | Person 2: AI and retrieval |
| `feat/core-ui` | Person 3: Today, Memories, detail, navigation/design |
| `feat/capture-life` | Person 4: onboarding, Capture, Ask, Life, sharing/demo |

Person 1 commits the initialized foundation to main once. All four feature branches start from that same commit. After initialization, **no one pushes directly to main**. Enable branch protection with pull requests and required checks. Person 1 coordinates reviews, conflicts, and merges.

```powershell
git switch main
git pull --ff-only
git switch -c feat/integration
# Each teammate substitutes their assigned branch name.
```

Commit `package-lock.json` with dependency changes. Never commit `.env.local`, secrets, generated build files, or node_modules. Run lint, typecheck, tests, and build before requesting a merge. Keep migrations additive after shared deployment; coordinate contract/schema edits first. Do not replace another person's feature with mock implementations.

Merge updated main into feature branches as needed; avoid rewriting a teammate's shared history. Submit focused PRs into main, or a coordinated integration PR when Person 1 requests it. Branches, commits, remotes, and protection settings are not changed by this scaffold.
