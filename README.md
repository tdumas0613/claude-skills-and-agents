# Claude skills and agents

Skills and subagents I've written for Claude Code that work in any project. This repo is their source;
what Claude actually loads is a copy.

```
skills/<name>/SKILL.md     a skill, with any files it bundles (scripts/, reference files) beside it
agents/<name>.md           a subagent definition
```

## How they're used

- **Skills** are uploaded to my claude.ai account (skill settings), which makes them load everywhere:
  Claude Code in the terminal and the desktop app, cloud sessions (including from the mobile app) and
  Cowork. To change one, edit it here, commit, then zip its folder (`skills/<name>/`, with the folder at
  the top of the zip) and upload it again. Synced copies on a machine are overwritten by the next sync,
  so never edit those.
- Uploaded skills accept only these frontmatter fields: `name`, `description`, `license`,
  `compatibility`, `metadata` and `allowed-tools`.
- Don't also keep a copy of a skill in a project's `.claude/skills/`: a project copy with the same name
  takes precedence over the account's.

## Contents

- `skills/review-agent-docs`: reviews agent instruction files (CLAUDE.md, AGENTS.md, rules, skills,
  subagents) for stale facts, duplication, misplaced content and context cost, and proposes fixes.
