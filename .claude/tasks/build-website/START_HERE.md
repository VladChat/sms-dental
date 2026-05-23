# Build Website Task — Start Here

You are working in the Missed Calls Dental / Dental SMS repository.

Repository path on Vlad's machine:

```text
C:\Users\vladi\Documents\vcoding\projects\sms-dental
```

## Your job

Build a new professional marketing website for Missed Calls Dental according to the instruction files in this folder.

Read these files in order before editing anything:

1. `.claude/tasks/build-website/DO_NOT_BREAK.md`
2. `.claude/tasks/build-website/WEBSITE_BRIEF.md`
3. `.claude/tasks/build-website/PAGE_STRUCTURE.md`
4. `.claude/tasks/build-website/DESIGN_DIRECTION.md`
5. `.claude/tasks/build-website/COPY_GUIDE.md`
6. `.claude/tasks/build-website/ACCEPTANCE_CHECKLIST.md`

Also use the existing Claude project skills in:

```text
.claude/skills/
```

Relevant skills for this task:

- project-context
- frontend-design
- ui-ux-review
- landing-page-cro
- copywriting
- technical-seo
- accessibility-wcag
- performance-core-web-vitals
- asset-policy
- qa-release-checklist
- git-workflow

## Git rules

Work only on `main`.

Do not create branches.

Before editing:

```bash
git status --short
```

If unrelated dirty files already exist, do not reset, stash, clean, restore, or stage them. Continue only if you can safely edit the website files required for this task and stage only those files.

Do not run:

```bash
git add .
```

## Implementation rule

First produce a short implementation plan in the terminal/chat.

Then make the changes.

## Target files

Prefer editing the static website files in:

```text
docs/
```

Expected primary files:

```text
docs/index.html
docs/how-it-works.html
docs/pricing.html
docs/contact.html
docs/privacy.html
docs/terms.html
docs/sms-consent.html
docs/sign-in.html
docs/styles.css
```

Do not edit backend, secrets, environment files, package manager files, or app logic unless the task becomes impossible without doing so.

## Important visual rule

Do not rely on raster marketing infographics.

Website explanation visuals must be built with real HTML text, CSS, SVG/icons, cards, lines, and arrows.

Do not bake text into PNG/WebP images.

## After implementation

Run the checklist in:

```text
.claude/tasks/build-website/ACCEPTANCE_CHECKLIST.md
```

Then commit and push only the intended files.

Suggested commit message:

```bash
git commit -m "Build new marketing website"
```

Final report must include:

- files changed
- summary of website structure
- what visuals were built as HTML/CSS/SVG
- any checks performed
- commit hash
