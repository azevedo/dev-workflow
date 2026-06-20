#!/usr/bin/env bash
#
# comment-guard.sh — PostToolUse hook for Edit/Write/MultiEdit.
#
# Why this exists: a "why-comments only" rule lives in memory files and an
# end-of-run reviewer, yet verbose/restating comments still get written. Memory
# files lose salience deep in a long edit session, and a review nit at the end
# of a slice is easy to defer. This hook re-asserts the rule at the moment a
# comment is written, on the small diff that just landed — the only point where
# the reminder is both salient and cheap to act on.
#
# It does the deterministic half (did this edit add full-line comments? which
# ones?) and hands the judgment half (why-comment vs. restating) back to the
# model by surfacing the exact lines. It never fires on edits that added no
# comments, so the reminder stays meaningful instead of becoming background noise.
#
# Tuning: COMMENT_GUARD_MIN_COMMENTS (default 2) — minimum added comment lines
# before the hook speaks up. Set to 1 for strictest enforcement.
#
# Fails safe: any missing dependency or unexpected input exits 0 (silent) so the
# hook can never disrupt an edit.

# No `set -e`: several pipeline steps return non-zero benignly; we handle flow
# explicitly and prefer silence over disruption.
set -u

command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
[ -n "$input" ] || exit 0

file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
[ -n "$file_path" ] || exit 0

# Text this edit introduced: Write=content, Edit=new_string,
# MultiEdit=every edit's new_string, plus the normalized file_text field.
added="$(printf '%s' "$input" | jq -r '
  [ .tool_input.content,
    .tool_input.new_string,
    .tool_input.file_text,
    ( .tool_input.edits // [] | .[].new_string )
  ] | map(select(. != null)) | join("\n")
' 2>/dev/null)"
[ -n "$added" ] || exit 0

ext="${file_path##*.}"
ext="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"

# Extension -> full-line comment prefix. Unlisted extensions (md, json, yaml,
# txt, ...) are intentionally skipped: this guards code comments, not prose or
# config. Block comments (/* */, <!-- -->) are out of scope for v1.
case "$ext" in
  js|jsx|ts|tsx|mjs|cjs|go|rs|java|c|cc|cpp|cxx|h|hpp|hh|cs|swift|kt|kts|scala|php|m|mm|dart) prefix='//' ;;
  py|rb|sh|bash|zsh|pl|ex|exs|nim|r) prefix='#' ;;
  lua|sql|hs|elm|adb|ads) prefix='--' ;;
  el|clj|cljs|cljc|lisp|scm) prefix=';' ;;
  *) exit 0 ;;
esac

min_comments="${COMMENT_GUARD_MIN_COMMENTS:-2}"

# Collect full-line comments from the added text. A shebang is not narration.
# Matching on the trimmed line start keeps comment markers inside strings/URLs
# (e.g. "https://", "x = 1  # ...") from registering as comments.
comment_lines="$(printf '%s\n' "$added" | awk -v pfx="$prefix" '
  {
    line = $0
    sub(/^[ \t]+/, "", line)
    if (line == "") next
    if (line ~ /^#!/) next
    if (substr(line, 1, length(pfx)) == pfx) print line
  }
')"

count="$(printf '%s' "$comment_lines" | grep -c . 2>/dev/null || true)"
[ -n "$count" ] || count=0
[ "$count" -ge "$min_comments" ] 2>/dev/null || exit 0

# Cap the quoted listing; report the rest as a count so a big rewrite stays readable.
listing="$(printf '%s\n' "$comment_lines" | head -10 | sed 's/^/    /')"
extra=""
if [ "$count" -gt 10 ]; then
  extra="$(printf '\n    … and %d more' "$((count - 10))")"
fi

msg="$(printf '%s' "Comment-style check (dev-workflow) — this edit to ${file_path} added ${count} comment line(s):

${listing}${extra}

Project convention: comments are why-comments only. Keep non-obvious rationale, workarounds, and invariant explanations; delete anything that merely restates what the code already says. Re-read the comment lines above now and remove the redundant ones before continuing.")"

jq -n --arg ctx "$msg" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $ctx
  }
}'
exit 0
