#!/usr/bin/env bash
# Helps you make the iOS signing certificate WITHOUT a Mac (only OpenSSL is needed - Git Bash on Windows includes it).
# The certificate + its private key are the app's permanent signing identity: run this on YOUR computer, never paste the .key / .p12 /
# passwords into chat or commit them, and keep a backup (password manager + offline copy).
#
#   1) bash tools/make-ios-signing.sh csr                       -> pizza-ios.key (PRIVATE) + pizza-ios.csr
#        Upload pizza-ios.csr at developer.apple.com -> Certificates, IDs & Profiles -> Certificates -> (+) -> "Apple Distribution",
#        then download the .cer file Apple gives you.
#   2) bash tools/make-ios-signing.sh p12 distribution.cer      -> pizza-ios.p12 + the 2 secret values to paste into GitHub
#   3) bash tools/make-ios-signing.sh profile Pizza_Stack.mobileprovision   -> the IOS_PROFILE_BASE64 value
#        (create the profile at developer.apple.com -> Profiles -> (+) -> "App Store Connect" for the bundle id com.pizzatechnologies.pizzastack
#         and pick the certificate from step 1)
#
#   Optional: PIZZA_P12_PASS=...  to skip the password prompt (step 2).  PIZZA_CSR_EMAIL / PIZZA_CSR_NAME to fill the CSR without prompts.
set -euo pipefail
command -v openssl >/dev/null || { echo "openssl not found - install it first (Git Bash for Windows includes it)." >&2; exit 1; }
KEY="${PIZZA_IOS_KEY:-pizza-ios.key}"; CSR="${PIZZA_IOS_CSR:-pizza-ios.csr}"; P12="${PIZZA_IOS_P12:-pizza-ios.p12}"
b64() { base64 < "$1" | tr -d '\n'; }

case "${1:-}" in
  csr)
    [ -e "$KEY" ] && { echo "$KEY already exists - refusing to overwrite it (it is the private key for any certificate you already requested)." >&2; exit 1; }
    NAME="${PIZZA_CSR_NAME:-}"; EMAIL="${PIZZA_CSR_EMAIL:-}"
    [ -n "$NAME" ]  || read -rp "Your / company name (as on your Apple Developer account): " NAME
    [ -n "$EMAIL" ] || read -rp "Your Apple Developer account email: " EMAIL
    # MSYS_NO_PATHCONV stops Git Bash on Windows from rewriting the leading "/" of the subject
    ERR="$(mktemp)"; trap 'rm -f "$ERR"' EXIT     # openssl prints a long progress bar while it makes the key: show its output only on failure
    MSYS_NO_PATHCONV=1 openssl req -new -newkey rsa:2048 -nodes -keyout "$KEY" -out "$CSR" -subj "/emailAddress=$EMAIL/CN=$NAME/C=US" 2>"$ERR" || { cat "$ERR" >&2; rm -f "$KEY" "$CSR"; exit 1; }
    chmod 600 "$KEY" 2>/dev/null || true
    echo
    echo "Created $CSR (safe to upload) and $KEY (PRIVATE - back it up, never share it)."
    echo "Next: developer.apple.com -> Certificates -> (+) -> Apple Distribution -> upload $CSR -> download the .cer, then run:"
    echo "  bash tools/make-ios-signing.sh p12 <downloaded>.cer"
    ;;
  p12)
    CER="${2:-}"; [ -f "$CER" ] || { echo "usage: bash tools/make-ios-signing.sh p12 <certificate.cer>" >&2; exit 1; }
    [ -f "$KEY" ] || { echo "$KEY not found - run the 'csr' step first, on this same computer/folder." >&2; exit 1; }
    [ -e "$P12" ] && { echo "$P12 already exists - refusing to overwrite it." >&2; exit 1; }
    PEM="$(mktemp)"; trap 'rm -f "$PEM"' EXIT
    # Apple hands out DER; accept PEM too
    openssl x509 -inform DER -in "$CER" -out "$PEM" 2>/dev/null || openssl x509 -in "$CER" -out "$PEM"
    # the certificate must belong to our private key
    A="$(openssl x509 -in "$PEM" -noout -pubkey | openssl sha256)"; B="$(openssl pkey -in "$KEY" -pubout | openssl sha256)"
    [ "$A" = "$B" ] || { echo "This certificate was NOT made from $KEY (a different CSR/key). Use the key that matches this .cer." >&2; exit 1; }
    echo "Certificate: $(openssl x509 -in "$PEM" -noout -subject -enddate | tr '\n' ' ')"
    if [ -z "${PIZZA_P12_PASS:-}" ]; then
      read -rsp "Choose a password for the .p12 (min 6 chars): " PIZZA_P12_PASS; echo
      read -rsp "Repeat it: " again; echo
      [ "$PIZZA_P12_PASS" = "$again" ] || { echo "Passwords differ." >&2; exit 1; }
    fi
    [ "${#PIZZA_P12_PASS}" -ge 6 ] || { echo "Password must be at least 6 characters." >&2; exit 1; }
    # SHA1/3DES encryption: the macOS keychain cannot import OpenSSL 3's default PKCS#12 encryption
    openssl pkcs12 -export -inkey "$KEY" -in "$PEM" -name "Pizza Technologies Distribution" -out "$P12" \
      -certpbe PBE-SHA1-3DES -keypbe PBE-SHA1-3DES -macalg sha1 -passout "pass:$PIZZA_P12_PASS"
    cat <<MSG

============================================================
Created $P12   (BACK IT UP - password manager + offline copy)

Add these as GitHub repository secrets:
  GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret

  IOS_CERT_P12_BASE64  = (the long value below)
  IOS_CERT_PASSWORD    = the password you just chose
  IOS_PROFILE_BASE64   = bash tools/make-ios-signing.sh profile <your>.mobileprovision
  APPLE_TEAM_ID        = your 10-character Team ID (developer.apple.com -> Membership details)

IOS_CERT_P12_BASE64 value:
$(b64 "$P12")
============================================================
MSG
    ;;
  profile)
    PF="${2:-}"; [ -f "$PF" ] || { echo "usage: bash tools/make-ios-signing.sh profile <profile.mobileprovision>" >&2; exit 1; }
    echo "IOS_PROFILE_BASE64 value:"; b64 "$PF"; echo
    ;;
  *)
    sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
