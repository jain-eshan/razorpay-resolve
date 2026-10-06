#!/usr/bin/env bash
# Fail if a tracked or new file contains something that looks like a real credential. Run: make test, and on every commit.
cd "$(git rev-parse --show-toplevel)" || exit 1
pat='rzp_live_[A-Za-z0-9]+|sk-ant-[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.|(KEY_SECRET|SECRET_KEY|API_KEY|TOKEN)[A-Za-z_]*[[:space:]]*=[[:space:]]*["'"'"']?[A-Za-z0-9_-]{16,}'
hits=$(git ls-files -co --exclude-standard | grep -v -E '(^|/)(package-lock\.json|\.env\.example|secret_scan\.sh)$' | xargs grep -I -n -E "$pat" 2>/dev/null)
if [ -n "$hits" ]; then echo "Possible secret found:"; echo "$hits"; exit 1; fi
echo "secret scan: clean"
