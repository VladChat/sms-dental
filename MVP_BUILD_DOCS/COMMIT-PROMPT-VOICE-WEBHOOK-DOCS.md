# Commit Prompt — Voice Pipeline Documentation Addendum

Use this prompt after unpacking this archive into the repository root.

```txt
You are Codex working in:

C:\Users\vladi\Documents\vcoding\projects\sms-dental

Goal:
Commit and push the voice webhook final verification documentation addendum.

Allowed new files:
- MVP_BUILD_DOCS/VOICE-WEBHOOK-FINAL-VERIFICATION-2026-05-26.md
- MVP_BUILD_DOCS/AGENT-PROMPT-RULE-ADDENDUM.md

Rules:
- Do not modify files.
- Do not add any other files.
- Do not add .env.local.
- Do not add .local-agent/.
- Do not add docs/.
- Do not add app/.
- Do not add lib/.
- Do not add design/.
- Do not add MVP_BUILD_DOCS/env/.
- Do not print secrets.

Steps:
1. Run:
   git status --short
   git diff --check

2. Stage only the two allowed new files.

3. Run:
   git diff --cached --name-only

4. Confirm only the two allowed files are staged.

5. Commit with message:
   docs: record final voice webhook verification

6. Push to origin main.

7. Report:
   - commit hash
   - pushed files
   - docs/ touched: yes/no
   - app/lib touched: yes/no
   - secrets printed: no
   - remaining untracked files
```
