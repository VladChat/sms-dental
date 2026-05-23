---
name: git-workflow
description: Repository workflow rules for Dental SMS changes, with strict staging hygiene, task-scoped commits, and main-branch collaboration discipline.
---

# Git Workflow

Use this skill for safe repository operations.

Branch and scope rules:
- Work on main unless Vlad explicitly requests branching.
- Never stage unrelated files.
- Never run blanket staging commands when task-scoped staging is required.

Commit rules:
- Keep commit scope aligned to the requested task.
- Write clear, direct commit messages.
- Verify staged files before commit.

Safety rules:
- Do not reset, stash, restore, or clean unless explicitly requested.
- Do not delete existing project assets unless explicitly requested.
- Preserve unrelated uncommitted changes.

Pre-push checks:
- Confirm only intended files are staged.
- Confirm no docs or website files were touched for non-website tasks.
