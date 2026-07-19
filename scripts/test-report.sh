#!/usr/bin/env bash
# Lefuttatja a backend (PHPUnit) és a frontend (Vitest) automata teszteket,
# majd egy statikus HTML riportot generál. Lásd test-report.ps1 fejlécét a
# "miért nem Artisan parancs" indoklásért.
#
# Használat:
#   ./scripts/test-report.sh           # mindkét csomag
#   ./scripts/test-report.sh backend   # csak backend
#   ./scripts/test-report.sh frontend  # csak frontend

set -e

SUITE="${1:-all}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORTS_DIR="$ROOT/reports"

mkdir -p "$REPORTS_DIR"

if [ "$SUITE" = "all" ] || [ "$SUITE" = "backend" ]; then
    echo "Backend tesztek futtatása (PHPUnit)..."
    (cd "$ROOT/backend" && php artisan config:clear --ansi >/dev/null && php vendor/bin/phpunit --log-junit ../reports/backend-junit.xml)
fi

if [ "$SUITE" = "all" ] || [ "$SUITE" = "frontend" ]; then
    echo "Frontend tesztek futtatása (Vitest)..."
    (cd "$ROOT/frontend" && npx vitest run --reporter=json --outputFile=../reports/frontend-results.json)
fi

echo "Riport összeállítása..."
php "$ROOT/scripts/build-test-report.php"

REPORT_PATH="$REPORTS_DIR/test-report.html"
echo "Megnyitás böngészőben: $REPORT_PATH"
start "$REPORT_PATH" 2>/dev/null || xdg-open "$REPORT_PATH" 2>/dev/null || open "$REPORT_PATH" 2>/dev/null || true
