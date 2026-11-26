#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
: "${ANDROID_JAR:?Defina ANDROID_JAR para o android.jar da plataforma Android usada na compilação}"
: "${D8_JAR:?Defina D8_JAR para o r8.jar que contém com.android.tools.r8.D8}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
mkdir -p "$TMP_DIR/classes" "$TMP_DIR/dex"

javac --release 8 -classpath "$ANDROID_JAR" -d "$TMP_DIR/classes" \
  "$SCRIPT_DIR/InAppMessageProvider.java"
java -cp "$D8_JAR" com.android.tools.r8.D8 \
  --min-api 23 \
  --lib "$ANDROID_JAR" \
  --output "$TMP_DIR/dex" \
  "$TMP_DIR"/classes/com/dtunnel/inapp/*.class
install -m 0644 "$TMP_DIR/dex/classes.dex" "$SCRIPT_DIR/classes7.dex"
printf 'DEX gerado: %s/classes7.dex\n' "$SCRIPT_DIR"
