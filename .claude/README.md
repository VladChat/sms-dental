# Claude Repository Notes

This repository has two instruction layers:

- `.claude/skills/` is the Claude-specific skill layer.
- `Skills/*.md` is the universal project/reference layer.

Keep both layers.

If project facts conflict, use:

1. `MVP_BUILD_DOCS/OWNER-SETTINGS.md`
2. `config/runtime.config.ts`
3. `Skills/missed-calls-dental-product-context.md`

Do not add new skill packs or new instruction systems during cleanup unless Vlad explicitly asks.

Workflow reminders:

- Work on `main` unless instructed otherwise.
- Stage only files related to the current task.
- Do not commit secrets or local settings.
