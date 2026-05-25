---
name: state
description: Use when the user asks for the state of the repo, what's in flight, where things stand, what's shipping, or says "/state" — summarizes open PRs, branches without PRs, recent commits, and what was probably being worked on most recently. Trigger even when the request is vague ("where am I?", "what was I doing?", "status") as long as the context is clearly a git repository.
---

# Repo State

Produce a quick, scannable snapshot of what's happening in the current repo so the user can re-orient fast after a break.

## What to gather

Run these in parallel — they're all independent reads:

1. **Open PRs** — `gh pr list --state open --json number,title,headRefName,isDraft,updatedAt,author --limit 20`
2. **Local branches** — `git branch --format='%(refname:short) %(upstream:short) %(committerdate:relative)'`
3. **Recent commits** — `git log -5 --pretty=format:'%h %s (%cr by %an)'`
4. **Current branch + dirty state** — `git status --short --branch`

If `gh` is not available or not authenticated, skip the PR-linkage check and say so once. Don't retry or prompt the user to auth.

## Finding branches that *should* be PRs

A branch is a PR candidate when **all** of these hold:
- It's not `main`, `master`, `develop`, or the repo's default branch
- It has commits ahead of the default branch (`git log main..<branch> --oneline` returns something)
- It has no open PR (cross-reference with `gh pr list` output)
- It was touched in the last ~30 days (stale branches aren't interesting)

The "ahead of main" check matters — old merged branches often linger locally and shouldn't be flagged.

## Output format

Keep it tight. One screen, no preamble. Use this structure:

```
## Open PRs (N)
- #123 feat: widget redesign — <branch>, updated 2h ago (draft)
- #122 fix: login race — <branch>, updated yesterday

## Branches without PRs (N)
- `feature/foo` — 3 commits ahead, last touched 2 days ago
- `refactor/bar` — 7 commits ahead, last touched last week

## Last 5 commits
- a0c4fd3 perf: queue proposal mailables (2h ago, Ray)
- 47e1555 chore: prevent lazy loading outside prod (yesterday, Ray)
- ...

## Recent focus
<one paragraph — 2-4 sentences — describing what the recent commits + open PRs suggest the user has been working on. Be specific: name the feature, the area of the codebase, the apparent goal. If commits span unrelated threads, say so.>
```

Omit any section that's empty. If there are zero open PRs *and* zero branches-without-PRs, say "Working tree is clean — no in-flight work" and just show the commits + focus paragraph.

## Writing the "Recent focus" paragraph

This is the part the user most wants to read — don't phone it in. Look at the actual commit messages and PR titles together and synthesize. Answer: what problem is the user solving right now? Not "various commits were made" — something like "Optimizing the proposal send flow: the last few commits queue mailables and chunk expiration to avoid timeouts, and PR #6 extracts this into a reusable action." If there's a dirty working tree, factor that in ("...and there are uncommitted changes in `app/Actions/` suggesting the next step is in progress").

If the signal is genuinely mixed — e.g., commits touch auth, billing, and the build system — say that plainly rather than inventing a narrative. Honesty beats tidiness.

## Don't

- Don't run `git fetch` or any network operation beyond the one `gh pr list` call. The user wants a snapshot of local state, not a sync.
- Don't include merged or closed PRs.
- Don't speculate beyond what the commits/PRs actually show. If you don't know, say "unclear from the recent history."
- Don't list every local branch — only ones that look like PR candidates per the criteria above.
