#!/usr/bin/env bash
# Creates the Pizza Technologies Android release keystore and prints the 4 values to add as GitHub repository secrets.
#   bash tools/make-keystore.sh [output-file] [key-alias]
# Needs a JDK (keytool). Run it on YOUR computer: the keystore is the app's permanent identity, so it should never be
# committed to git or pasted into chat. BACK IT UP (password manager + offline copy): without it you can never update the app.
set -euo pipefail
OUT="${1:-pizza-release.keystore}"
ALIAS="${2:-pizza}"
command -v keytool >/dev/null || { echo "keytool not found - install a JDK (e.g. Temurin 21) first." >&2; exit 1; }
[ -e "$OUT" ] && { echo "$OUT already exists - refusing to overwrite it." >&2; exit 1; }

if [ -z "${PIZZA_KS_PASS:-}" ]; then
  read -rsp "Choose a keystore password (min 6 chars): " PIZZA_KS_PASS; echo
  read -rsp "Repeat it: " again; echo
  [ "$PIZZA_KS_PASS" = "$again" ] || { echo "Passwords differ." >&2; exit 1; }
fi
[ "${#PIZZA_KS_PASS}" -ge 6 ] || { echo "Password must be at least 6 characters." >&2; exit 1; }

DNAME_ARGS=()
[ -n "${PIZZA_KS_DNAME:-}" ] && DNAME_ARGS=(-dname "$PIZZA_KS_DNAME")   # otherwise keytool asks for your name / organisation
keytool -genkeypair -v -keystore "$OUT" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PIZZA_KS_PASS" -keypass "$PIZZA_KS_PASS" "${DNAME_ARGS[@]}"

B64="$(base64 < "$OUT" | tr -d '\n')"
cat <<MSG

============================================================
Keystore created: $OUT   (BACK IT UP NOW - password manager + offline copy)

Add these 4 secrets at:
  GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret

  ANDROID_KEYSTORE_BASE64    = (the long value below)
  ANDROID_KEYSTORE_PASSWORD  = the password you just chose
  ANDROID_KEY_ALIAS          = $ALIAS
  ANDROID_KEY_PASSWORD       = the same password

ANDROID_KEYSTORE_BASE64 value:
$B64
============================================================
MSG
