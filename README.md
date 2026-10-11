# Claude skills and agents

Skills and subagents I've written for Claude Code that work in any project. This repo is their source;
what Claude actually loads is a copy.

```
skills/<name>/SKILL.md     a skill, with any files it bundles (scripts/, reference files) beside it
skills/<name>/<name>.zip   the skill packaged for upload to claude.ai (built automatically; don't edit)
agents/<name>.md           a subagent definition
```

## Setup, once per clone

```bash
git config core.hooksPath .githooks
```

This turns on the pre-commit hook, which rebuilds each skill's zip from what the commit stages and adds
it to the commit, so the zip in a skill's folder always matches that skill. Needs Node 22 or newer.
`node scripts/build-skill-zips.mjs` builds the zips by hand.

## How they're used

- **Skills** are uploaded to my claude.ai account (skill settings), which makes them load everywhere:
  Claude Code in the terminal and the desktop app, cloud sessions (including from the mobile app) and
  Cowork. To change one, edit it here and commit, then upload `skills/<name>/<name>.zip` again. Synced
  copies on a machine are overwritten by the next sync, so never edit those.
- Uploaded skills accept only these frontmatter fields: `name`, `description`, `license`,
  `compatibility`, `metadata` and `allowed-tools`.
- Don't also keep a copy of a skill in a project's `.claude/skills/`: a project copy with the same name
  takes precedence over the account's.
- **Subagents** aren't uploaded; claude.ai doesn't take them. Copy one into a project's `.claude/agents/`
  to use it there (cloud sessions see a project's agents), or into `~/.claude/agents/` for every
  project on one machine.

## Contents

- `skills/review-agent-docs`: reviews agent instruction files (CLAUDE.md, AGENTS.md, rules, skills,
  subagents) for stale facts, duplication, misplaced content and context cost, and proposes fixes.
