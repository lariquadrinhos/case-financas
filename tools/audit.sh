#!/usr/bin/env bash
#
# Repository audits that run in the local gate and in CI.
#
# Usage: tools/audit.sh tokens | lgpd | all
#
# Both audits inspect CODE, not prose. A comment that says "278px, from frame
# 5:3" is a fidelity trail, not a magic number; a comment that says
# "console.log is banned" is documentation, not a violation. Comment lines are
# therefore excluded, and that exclusion is the only heuristic here.
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; OFF='\033[0m'
fail() { printf "${RED}  %s${OFF}\n" "$1"; }
pass() { printf "${GREEN}  %s${OFF}\n" "$1"; }

# Drops matches whose content is a comment line (`*`, `//`, `/*`).
strip_comments() { grep -vE '^[^:]+:[0-9]+:[[:space:]]*(\*|//|/\*)' || true; }

audit_tokens() {
  echo "  [tokens] hex and px literals outside src/styles/ (ADR-0011)"
  local hits
  hits=$(grep -rnE '#[0-9a-fA-F]{3,8}\b|[^-a-z(][0-9]+px' \
           --include='*.ts' --include='*.tsx' --include='*.css' src/ 2>/dev/null \
         | grep -v '^src/styles/' \
         | strip_comments)
  if [ -n "$hits" ]; then
    echo "$hits"
    fail "Literal value found. Add a token to src/styles/tokens.css and use it."
    return 1
  fi
  pass "OK — no literal colour or measurement."
}

audit_lgpd() {
  echo "  [lgpd] PII in fixtures and console.log in src/ (ADR-0009)"
  local pii logs
  pii=$(grep -rniE 'cpf|cnpj|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|[0-9]{2}\.[0-9]{3}\.[0-9]{3}/[0-9]{4}-[0-9]{2}' \
          src/data/fixtures 2>/dev/null | strip_comments)
  if [ -n "$pii" ]; then
    echo "$pii"
    fail "Possible real personal data in a fixture. Use synthetic data."
    return 1
  fi
  logs=$(grep -rn 'console\.log' --include='*.ts' --include='*.tsx' src/ 2>/dev/null | strip_comments)
  if [ -n "$logs" ]; then
    echo "$logs"
    fail "console.log in src/. Use src/lib/log.ts, which never records a value or PII."
    return 1
  fi
  pass "OK — no PII, no console.log."
}

status=0
case "${1:-all}" in
  tokens) audit_tokens || status=1 ;;
  lgpd)   audit_lgpd   || status=1 ;;
  all)    audit_tokens || status=1; audit_lgpd || status=1 ;;
  *)      echo "usage: tools/audit.sh tokens|lgpd|all" >&2; exit 2 ;;
esac
exit $status
