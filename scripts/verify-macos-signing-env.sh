#!/bin/zsh

set -euo pipefail

required_vars=(
  APPLE_ID
  APPLE_TEAM_ID
  APPLE_APP_SPECIFIC_PASSWORD
  APPLE_DEVELOPER_CERTIFICATE
)

missing_vars=()
for var_name in "${required_vars[@]}"; do
  if [[ -z "${(P)var_name:-}" ]]; then
    missing_vars+=("${var_name}")
  fi
done

if (( ${#missing_vars[@]} > 0 )); then
  echo "Missing required macOS signing environment variables: ${missing_vars[*]}" >&2
  exit 1
fi

echo "macOS signing environment variables look ready."
