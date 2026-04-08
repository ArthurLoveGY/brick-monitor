#!/bin/zsh

set -euo pipefail

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Xcode Command Line Tools not configured. Run: xcode-select --install" >&2
  exit 1
fi

if ! xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1; then
  echo "Xcode is installed but first-launch tasks or license acceptance are incomplete." >&2
  echo "Run: sudo xcodebuild -license" >&2
  echo "Then run: sudo xcodebuild -runFirstLaunch" >&2
  exit 1
fi

echo "Xcode command line environment is ready."
