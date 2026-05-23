# Merge duplicate dental-sms-project skill

This update keeps one source of truth:

```text
.claude/skills/project-context/SKILL.md
```

The useful guidance from:

```text
.claude/skills/dental-sms-project/SKILL.md
```

has been merged into `project-context`.

After extracting this archive into the repository root, remove the duplicate folder by running:

```powershell
.claude\tasks\maintenance\remove-dental-sms-project-skill.ps1
```

Then commit only:

```text
.claude/skills/project-context/SKILL.md
.claude/skills/dental-sms-project/
```
