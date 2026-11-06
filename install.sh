#!/bin/sh
# Installs Agent 自动化中台: a clone in ~/.agent-autoloop/app, with nothing to build and nothing else to install.
set -e
PUBLISHED=https://github.com/Jimmy-Prime/agent-autoloop.git
UPSTREAM=https://github.com/KKKKhazix/agent-autoloop.git
REPO="${AGENT_AUTOLOOP_REPO:-$PUBLISHED}"
ROOT="${AGENT_AUTOLOOP_HOME:-$HOME/.agent-autoloop}"
APP="$ROOT/app"
PROGRAM="$APP/bin/agent-autoloop.ts"

# A new install speaks this machine's language. One already installed speaks what its rules.json says.
language_here() {
  case "${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}" in
    zh_TW* | zh_HK* | zh_MO*) echo zh-TW ;;
    zh*) echo zh-CN ;;
    *) echo en ;;
  esac
}

# What this script says, in that language: Simplified Chinese, Traditional Chinese, English.
say() {
  case "$(language_here)" in
    zh-TW) printf '%s\n' "$2" ;;
    en) printf '%s\n' "$3" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

need_node() {
  echo "$1"
  say "用 Homebrew 的话，node@24 装好后默认不在 PATH 上，这三行都要运行（用 bash 就把 ~/.zshrc 换成 ~/.bashrc）：" \
    "用 Homebrew 的話，node@24 裝好後預設不在 PATH 上，這三行都要執行（用 bash 就把 ~/.zshrc 換成 ~/.bashrc）：" \
    "With Homebrew, node@24 isn't on PATH once installed. Run all three lines (with bash, use ~/.bashrc instead of ~/.zshrc):"
  cat <<'END'
  brew install node@24
  echo "export PATH=\"$(brew --prefix node@24)/bin:\$PATH\"" >> ~/.zshrc
  source ~/.zshrc
END
  say "用 nvm 的话：" "用 nvm 的話：" "With nvm:"
  cat <<'END'
  nvm install 24
  nvm alias default 24
END
  say "装好后再运行一遍这个安装命令。" "裝好後再執行一遍這個安裝命令。" "Then run this install command again."
  exit 1
}

command -v git >/dev/null || { say "需要 git。" "需要 git。" "git is needed."; exit 1; }
command -v node >/dev/null || need_node "$(say "需要 Node.js 24 或更新，这台电脑上没找到。" "需要 Node.js 24 或更新，這台電腦上沒找到。" "Node.js 24 or newer is needed, and this computer doesn't have it.")"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' ||
  need_node "$(say "需要 Node.js 24 或更新，现在是 $(node -v)。" "需要 Node.js 24 或更新，現在是 $(node -v)。" "Node.js 24 or newer is needed; this one is $(node -v).")"

mkdir -p -m 700 "$ROOT"
chmod 700 "$ROOT"

# A copy follows where it came from, and what came from the public repository follows its newest release, which has passed
# every check. cli/update.ts decides the same way, or an update would fail on a copy this had moved.
from="$REPO"
if [ -d "$APP/.git" ]; then
  from=$(git -C "$APP" config --get remote.origin.url || true)
  # Running this fork's installer over upstream's published copy is asking for the fork. Left on upstream's origin, a
  # release's detached HEAD has nothing to pull, and the install would fail.
  if [ "$from" = "$UPSTREAM" ] && [ "$REPO" = "$PUBLISHED" ]; then
    git -C "$APP" remote set-url origin "$PUBLISHED"
    from="$PUBLISHED"
    say "原来跟着上游 KKKKhazix/agent-autoloop，现在改成跟着这个 fork 的 Release。" \
      "原本跟著上游 KKKKhazix/agent-autoloop，現在改成跟著這個 fork 的 Release。" \
      "This followed upstream KKKKhazix/agent-autoloop; it now follows this fork's releases."
  fi
fi
release=""
if [ "$from" = "$PUBLISHED" ]; then
  # On a line of its own: in a pipe, not getting an answer would look like there being no releases.
  tags=$(git ls-remote --refs --tags "$PUBLISHED" 'v*')
  release=$(printf '%s\n' "$tags" | sed -n 's#.*refs/tags/\(v[0-9]*\.[0-9]*\.[0-9]*\)$#\1#p' |
    sort -t. -k1.2,1n -k2,2n -k3,3n | tail -n 1)
fi
if [ ! -d "$APP/.git" ]; then
  git -c advice.detachedHead=false clone --quiet --depth 1 ${release:+--branch "$release"} -- "$REPO" "$APP"
elif [ -n "$release" ]; then
  git -C "$APP" fetch --quiet --depth 1 origin "refs/tags/$release:refs/tags/$release"
  git -C "$APP" checkout --quiet --detach "$release"
else
  git -C "$APP" pull --ff-only --quiet
fi

# Only a folder that's on PATH makes `agent-autoloop` work, and an agent-autoloop that isn't this one is someone else's to keep.
place_link() {
  case ":$PATH:" in *":$1:"*) ;; *) return 1 ;; esac
  case "$1" in /*) ;; *) return 1 ;; esac
  if [ "$1" = "$HOME/.local/bin" ]; then mkdir -p "$1" 2>/dev/null || return 1; fi
  [ -d "$1" ] && [ -w "$1" ] || return 1
  if [ -e "$1/agent-autoloop" ] || [ -L "$1/agent-autoloop" ]; then
    [ -L "$1/agent-autoloop" ] && [ "$1/agent-autoloop" -ef "$PROGRAM" ] || return 1
  fi
  ln -sf "$PROGRAM" "$1/agent-autoloop"
}

usual_ifs=$IFS
IFS=:
set -f
for place in "$HOME/.local/bin" $PATH; do
  if place_link "$place"; then break; fi
done
set +f
IFS=$usual_ifs

if [ "${1:-}" = join ]; then
  "$PROGRAM" "$@"
elif [ -f "$ROOT/config.json" ]; then
  say "更新好了。" "更新好了。" "Updated."
  case " $* " in *" --no-service "*) ;; *) "$PROGRAM" service install ;; esac
else
  # In the environment, not as --language: the release this installs may be older than this script, and refuse the flag.
  AGENT_AUTOLOOP_LANGUAGE="$(language_here)" "$PROGRAM" init "$@"
fi

if ! [ "$(command -v agent-autoloop)" -ef "$PROGRAM" ]; then
  echo
  say "直接打 agent-autoloop 运行不了这个程序：PATH 上没有能放它的目录，或者排在前面的是另一个同名程序。" \
    "直接打 agent-autoloop 執行不了這個程式：PATH 上沒有能放它的目錄，或者排在前面的是另一個同名程式。" \
    "Typing agent-autoloop won't run this program: nothing on PATH can hold it, or another program by that name comes first."
  say "要写完整路径 $PROGRAM，或者把这一行加进 ~/.zshrc（用 bash 就是 ~/.bashrc）：" \
    "要寫完整路徑 $PROGRAM，或者把這一行加進 ~/.zshrc（用 bash 就是 ~/.bashrc）：" \
    "Type the full path, $PROGRAM, or add this line to ~/.zshrc (~/.bashrc with bash):"
  echo "  alias agent-autoloop='$PROGRAM'"
fi
