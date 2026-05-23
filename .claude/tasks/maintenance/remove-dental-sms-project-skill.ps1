# Removes the old duplicate skill after its useful guidance has been merged into project-context.
# Run from repository root.

$duplicate = ".claude\skills\dental-sms-project"

if (Test-Path $duplicate) {
  Remove-Item -Recurse -Force $duplicate
  Write-Host "Removed duplicate skill: $duplicate"
} else {
  Write-Host "Duplicate skill not found: $duplicate"
}

Write-Host ""
Write-Host "Now verify and commit:"
Write-Host "git status --short"
Write-Host "git add .claude/skills/project-context/SKILL.md"
Write-Host "git add -u .claude/skills/dental-sms-project"
Write-Host 'git commit -m "Merge duplicate dental SMS project skill"'
Write-Host "git push"
