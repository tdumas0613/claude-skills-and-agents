---
name: review-agent-docs
description: Review agent instruction files (CLAUDE.md, AGENTS.md, skills, subagent definitions, slash commands) for stale facts, duplication, misplaced content, contradictions, missing lessons and context cost, then propose what to update, remove or move. Use when asked to review, audit, tidy or slim down any of them, or after a refactor or rename.
---

# Reviewing agent instruction files

Agent instruction files decay quietly. Code gets renamed, commands change, lessons pile up in the wrong place, and the same rule ends up in three files that slowly disagree. Every word in an always-loaded file costs context on every turn. The aim of a review is files that are **true**, **in the right place**, **said once** and **as short as they can be while still changing behavior**.

## 1. Take inventory and note what loads when

Find every instruction file:
- `CLAUDE.md` at the root and in subfolders, `CLAUDE.local.md`, `.claude/CLAUDE.md` and `AGENTS.md`
- `.claude/rules/**/*.md`
- `.claude/skills/*/SKILL.md`, plus each skill's bundled files
- `.claude/agents/*.md` and `.claude/commands/**/*.md`
- Hooks and permissions in `.claude/settings.json`
- The user's own files: `~/.claude/CLAUDE.md`, `~/.claude/rules/`, and the auto memory index (`MEMORY.md` in `~/.claude/projects/<project>/memory/`)
- The README, because it often overlaps

Count words per file (`wc -w`). Context cost depends on when a file loads:

| Loaded | What | Cost |
|---|---|---|
| Every turn | CLAUDE.md files at and above the working folder (with everything they `@`-import), rules without `paths:`, the first 200 lines of `MEMORY.md`, and every skill's and subagent's `name` + `description` | Highest: pay attention to every word |
| When triggered | A folder's CLAUDE.md and rules with `paths:` (when Claude works on matching files); a skill's body; a subagent's body (as that subagent's system prompt) | Medium |
| When read | Bundled reference files, memory topic files, scripts, code comments | Lowest |
| Never | Hooks and tests, unless they print output | None |

So the cheapest fix for a long CLAUDE.md is usually moving content down a row, not deleting it. An `@` import organises a file but doesn't lower its cost.

## 2. Check every claim against the repo

Stale facts are the most common defect, and the most harmful, because the agent acts on them confidently.

- Run `node <this skill's dir>/scripts/check_refs.mjs <repo root>` (add file paths after the root to check others, such as the README). It lists backticked paths and `npm run` commands that no longer exist. A clean run only means nothing is obviously broken.
- Then read each file and verify what the script can't: function and field names (grep them), described behavior, numbers (timings, counts, thresholds), flags and defaults. Pay most attention to anything touched by recent commits: `git log --since=<date the doc last changed> --stat` shows where to look.
- Watch for **rationale that expired**. A rule like "keep X free of imports" may have existed only because of a tool that's gone. Keep the rule only if its reason still holds.
- Watch for **contradictions** between files, or within one (one section says to run the whole test suite before committing, another says the fast subset is enough).

## 3. Put each piece of content in its one right home

| Content | Belongs in | Not in |
|---|---|---|
| Commands the agent can't guess, rules for every task, gotchas that aren't self-evident, settled decisions, working preferences for this project (such as testing the app in Expo Go) | The project's CLAUDE.md (or AGENTS.md) | — |
| Working preferences for every project (stack choices such as TypeScript and Node, how the user likes to work) | `~/.claude/CLAUDE.md` or `~/.claude/rules/` | A project's CLAUDE.md |
| The user's private notes for one project | `CLAUDE.local.md` (gitignored) | A checked-in CLAUDE.md |
| Rules for one part of the codebase | `.claude/rules/*.md` with `paths:` frontmatter, or a CLAUDE.md in that folder | The root CLAUDE.md |
| Rules that must hold every time | A hook (`PreToolUse` to block, `PostToolUse` or `Stop` to check), a test or a lint; CLAUDE.md keeps at most a one-line reason | CLAUDE.md alone, which Claude may not follow |
| How replies are formatted and phrased | An output style | CLAUDE.md |
| Which tools run without asking | Permissions in `.claude/settings.json` | Prose |
| A procedure for a recognizable kind of task (shipping, tuning, adding content) | A skill, with triggers in its description | CLAUDE.md |
| Reference knowledge needed only sometimes | A reference skill, or a skill's bundled file linked directly from SKILL.md (one level deep; a table of contents if over 100 lines) | SKILL.md itself, or CLAUDE.md |
| Deterministic, repeated checks a procedure runs | A script in the skill | Prose steps |
| A specialist role run in its own context, with its own tools and output contract | A subagent definition | CLAUDE.md |
| A fact about one file or function | A comment in that file | CLAUDE.md |
| How to run, play or contribute, written for people | README | CLAUDE.md (unless an agent needs it every task) |
| Live plans, open ideas, work in progress | The issue tracker (or a plan doc), with a CLAUDE.md pointer only while it affects every task | Instruction files |
| History: what changed and why, old numbers, finished plans | Commit messages | Any instruction file |
| Notes Claude saved for itself | Auto memory: promote one to CLAUDE.md when it's shared and lasting; delete one that duplicates an instruction file | — |
| Anything the agent can work out from the code; standard conventions it already follows | Nowhere | Any instruction file |

Duplicates are allowed only with a stated reason. The common good one: an always-loaded one-line guard in CLAUDE.md ("a schema change needs a migration; see the migrate skill") pointing at the full procedure. A duplicate without a reason is a future contradiction. Keep the copy in the most specific home and point to it.

If both AGENTS.md and CLAUDE.md exist, Claude Code reads only CLAUDE.md, and AGENTS.md is silently ignored unless CLAUDE.md imports it (`@AGENTS.md`). Make CLAUDE.md import it, or merge the two.

## 4. Check each file type's own rules

- **CLAUDE.md:** short, imperative bullets that each change behavior; aim for under 200 lines. Keep the *why* when a rule would otherwise get "optimized away" (the reason is what stops a smart agent overriding it). Cut background the agent can't act on. Settled decisions belong here, so they don't get re-litigated.
- **Rules (`.claude/rules/`):** one topic per file, and `paths:` frontmatter on any rule that applies to only part of the codebase, so it loads only there.
- **Skills:**
  - Frontmatter `name` matches the folder.
  - The `description` says what the skill does and when to use it, with concrete trigger phrases. It is the only part always loaded, so it must carry the triggering; vague descriptions undertrigger.
  - The body reads as steps.
  - Body under about 500 lines, with longer material moved to bundled files that the body says when to read.
  - `disable-model-invocation: true` on a skill with side effects that the user wants to start themselves; it also keeps the description out of every turn.
  - Skills that call each other do it by name ("then follow the ship skill"), not by repeating each other.
- **Subagent definitions:**
  - Frontmatter `name` and a `description` that tells the main agent when to delegate.
  - `tools` limited to what the role needs; `model` set only when it should differ.
  - The body is the subagent's whole brief, since it starts without the parent conversation: its role, what to return and in what shape, and what not to do.
- **Slash commands:** a clear purpose, argument use (`$ARGUMENTS`) documented, and no drift from the skill they wrap, if any.

## 5. Look for what's missing

A review should also capture lessons that never got written down:
- Corrections the user made during recent work, and bugs or wrong turns that cost time.
- Decisions the user settled, and new tools or commands.

Check the recent conversation, commit messages and TODO-style comments. Add only what will change future behavior, and put it in its right home.

## 6. Report, then apply on approval

Report findings grouped by file, most important first. Make each one a single line, using the kind and fix labels below. For example:

> `CLAUDE.md` · **stale** · says `src/utils.js`; it's `src/utils.ts` now (converted to TypeScript) → fix the path

- **Kinds:** stale, contradiction, duplicate, misplaced, cost, missing.
- **Fixes:** update, remove, move to X, or add.

End with the net effect, for example: always-loaded words before → after, and which files change.

Choosing what a project's instructions say is the user's call, so ask before applying unless they already said to go ahead. When applying:
- Re-run `check_refs.mjs`.
- Grep for references to anything you renamed or moved: the README's file list, other skills' pointers, the commands a description names.
- Check every frontmatter block still parses.
- Commit with a message listing what moved where.
