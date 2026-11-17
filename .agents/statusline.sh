#!/usr/bin/env bash
# Claude Code status line for FoodMe. Reads the session JSON on stdin, prints one line:
#   <model> │ <dir> │ <branch>[*] │ api:8081 ●|○ │ ctx N% │ $cost
# plus a second line with the feature-testing run's progress.
# Shown only in sessions that started /feature-testing-pipeline; elsewhere it prints nothing.
# Must stay fast and never fail: it runs after every turn.

input=$(cat)
command -v jq >/dev/null 2>&1 || { printf 'foodme (install jq for the status line)'; exit 0; }

IFS=$'\037' read -r session transcript model cwd project ctx cost < <(
  jq -r '[
    .session_id // "",
    .transcript_path // "",
    .model.display_name // "?",
    .workspace.current_dir // .cwd // "",
    .workspace.project_dir // "",
    (.context_window.used_percentage // "" | tostring),
    (.cost.total_cost_usd // "" | tostring)
  ] | join("\u001f")' <<<"$input" 2>/dev/null
)
# Only for sessions that started the pipeline: by slash command or by the Skill tool.
# Match raw JSON (unescaped quotes) so a mere mention in a prompt or tool input doesn't count.
# Cache the hit per session so the transcript is grepped only until the first match.
marker="${TMPDIR:-/tmp}/foodme-statusline/${session:-none}"
if [ ! -e "$marker" ]; then
  [ -n "$session" ] && [ -f "$transcript" ] &&
    grep -qE '"content":"<command-message>feature-testing-pipeline</command-message>|"name":"Skill","input":\{"skill":"feature-testing-pipeline"' "$transcript" 2>/dev/null ||
    exit 0
  mkdir -p "${marker%/*}" 2>/dev/null && : >"$marker"
fi

[ -n "$cwd" ] || cwd=$PWD
[ -n "$project" ] || project=$cwd

dim=$'\033[2m'; cyan=$'\033[36m'; green=$'\033[32m'; yellow=$'\033[33m'; red=$'\033[31m'; reset=$'\033[0m'
sep="${dim} │ ${reset}"

# Directory relative to the repo root, so apps/backend shows as such.
name=$(basename "$project")
case "$cwd" in
  "$project") dir=$name ;;
  "$project"/*) dir="$name/${cwd#"$project"/}" ;;
  *) dir=$cwd ;;
esac

out="${cyan}${model}${reset}${sep}${dir}"

# Branch, red on main (protected: work belongs on a KAN-<n> branch), * when dirty.
if branch=$(git -C "$cwd" --no-optional-locks symbolic-ref --short -q HEAD 2>/dev/null) ||
   branch=$(git -C "$cwd" --no-optional-locks rev-parse --short HEAD 2>/dev/null); then
  dirty=
  [ -n "$(git -C "$cwd" --no-optional-locks status --porcelain 2>/dev/null | head -n 1)" ] && dirty='*'
  if [ "$branch" = main ]; then color=$red; else color=$green; fi
  out+="${sep}${color}${branch}${dirty}${reset}"
fi

# Is the local backend listening? The e2e suites and both dev servers need it.
if (exec 3<>/dev/tcp/127.0.0.1/8081) 2>/dev/null; then
  out+="${sep}api:8081 ${green}●${reset}"
else
  out+="${sep}${dim}api:8081 ○${reset}"
fi

if [ -n "$ctx" ]; then
  pct=${ctx%.*}
  if [ "$pct" -ge 80 ]; then color=$red; elif [ "$pct" -ge 50 ]; then color=$yellow; else color=$dim; fi
  out+="${sep}${color}ctx ${pct}%${reset}"
fi

[ -n "$cost" ] && out+="${sep}${dim}\$$(printf '%.2f' "$cost")${reset}"

# Feature-testing pipeline: the skill keeps one line of progress in runs/<T>/status.
# Show the most recently touched run.
runs="$project/agentic-workflows/functional-testing/runs"
status_file=$(ls -t "$runs"/*/status 2>/dev/null | head -n 1)
if [ -n "$status_file" ]; then
  IFS= read -r pipeline <"$status_file"
  [ -n "$pipeline" ] && out+=$'\n'"$pipeline"
fi

printf '%s' "$out"
