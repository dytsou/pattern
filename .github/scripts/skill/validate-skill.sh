#!/usr/bin/env bash
# Validate .agents/skills/pattern/SKILL.md frontmatter for agentskills.io.
set -euo pipefail

SKILL=".agents/skills/pattern/SKILL.md"

if [[ ! -f "$SKILL" ]]; then
  echo "missing skill file: $SKILL" >&2
  exit 1
fi

if [[ "$(head -n1 "$SKILL")" != "---" ]]; then
  echo "missing frontmatter" >&2
  exit 1
fi

# Frontmatter = lines between the first and second --- markers
fm=$(awk 'BEGIN{n=0} /^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL")
if [[ -z "$fm" ]]; then
  echo "incomplete frontmatter" >&2
  exit 1
fi

if ! grep -qE '^name:[[:space:]]*pattern[[:space:]]*$' <<<"$fm"; then
  echo "expected name: pattern" >&2
  exit 1
fi

if ! grep -qE '^description:[[:space:]]*' <<<"$fm"; then
  echo "description required" >&2
  exit 1
fi

# Collect description: same-line value and/or indented folded block
body=$(
  awk '
    BEGIN { in_desc = 0 }
    /^description:[[:space:]]*/ {
      in_desc = 1
      rest = $0
      sub(/^description:[[:space:]]*/, "", rest)
      if (rest != "" && rest != ">" && rest != ">-" && rest != "|" && rest != "|-") {
        print rest
      }
      next
    }
    in_desc {
      if ($0 ~ /^[[:space:]]/) {
        line = $0
        sub(/^[[:space:]]+/, "", line)
        print line
        next
      }
      exit
    }
  ' <<<"$fm" | tr '\n' ' ' | sed 's/[[:space:]]*$//'
)

if [[ ${#body} -lt 20 ]]; then
  printf 'description too short: %q\n' "$body" >&2
  exit 1
fi

preview="${body:0:120}"
echo "skill ok: ${preview} ..."
