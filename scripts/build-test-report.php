<?php

/**
 * Önálló, Laravel-bootstrap nélküli riport-generáló szkript.
 *
 * SZÁNDÉKOSAN nem Artisan parancs: egy korábbi kísérlet során kiderült,
 * hogy ha egy már bootstrapolt Laravel-folyamat indít gyermekfolyamatként
 * egy PHPUnit-futást, a gyermek örökölheti a szülő VALÓDI .env-jét
 * (pl. DB_CONNECTION=mysql), és a phpunit.xml tesztkörnyezeti felülírásai
 * (DB_CONNECTION=sqlite) ezt nem garantáltan írják felül — ez egyszer már
 * adatvesztéssel járó, éles adatbázist törlő hibát okozott. Ezért ez a
 * riport-építő script csak a MÁR LEFUTOTT tesztek kimeneti fájljait
 * (JUnit XML, Vitest JSON) olvassa be és dolgozza fel; magát a tesztfutást
 * mindig egy friss, Laravel-bootstrap nélküli terminálparancs végzi
 * (lásd test-report.ps1 / test-report.sh), soha nem ez a script.
 */

$root = dirname(__DIR__);
$reportsDir = $root . '/reports';
$backendJunitPath = $reportsDir . '/backend-junit.xml';
$frontendJsonPath = $reportsDir . '/frontend-results.json';
$outputPath = $reportsDir . '/test-report.html';
$backendTestsDir = $root . '/backend/tests';

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

/**
 * A PHPUnit test metódus neve önmagában (pl. "test_score_is_zero_when_shelter_is_empty")
 * egy technikai azonosító, nem egy olvasható leírás. A tesztfájlokban viszont
 * minden teszt fölött ott van egy magyar `//` komment, ami elmagyarázza, mit
 * ellenőriz — ezt olvassuk ki innen (nem a JUnit XML-ből, abban nincs benne),
 * hogy a riportban a nyers metódusnév helyett/mellett emberi leírás is
 * megjelenjen. Csak sima szövegfájl-beolvasás, nincs PHP-kód futtatás/parse,
 * tehát semmilyen kockázatot nem hordoz.
 *
 * @return array<string, string> kulcs: "Namespace\ClassName::test_metodus", érték: a leírás
 */
function extractBackendTestDescriptions(string $testsDir): array
{
    $descriptions = [];

    if (! is_dir($testsDir)) {
        return $descriptions;
    }

    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($testsDir, FilesystemIterator::SKIP_DOTS));

    foreach ($iterator as $file) {
        if ($file->getExtension() !== 'php') {
            continue;
        }

        $contents = file_get_contents($file->getPathname());

        if (! preg_match('/namespace\s+([^;]+);/', $contents, $nsMatch)) {
            continue;
        }

        if (! preg_match('/\bclass\s+(\w+)/', $contents, $classMatch)) {
            continue;
        }

        $fqcn = trim($nsMatch[1]) . '\\' . $classMatch[1];
        $pendingComment = [];

        foreach (explode("\n", $contents) as $line) {
            $trimmed = trim($line);

            if (preg_match('/^\/\/\s?(.*)$/', $trimmed, $m)) {
                $pendingComment[] = $m[1];

                continue;
            }

            if (preg_match('/public\s+function\s+(test_\w+)\s*\(/', $trimmed, $m)) {
                if ($pendingComment !== []) {
                    $descriptions[$fqcn . '::' . $m[1]] = trim(implode(' ', $pendingComment));
                }

                $pendingComment = [];

                continue;
            }

            // Bármi más (üres sor is) megszakítja a komment-blokkot — csak a
            // KÖZVETLENÜL a függvény fölötti, megszakítás nélküli komment
            // számít a leírásának, hogy ne kössünk össze véletlenül egy
            // korábbi, más célú kommentet egy távolabbi teszttel.
            $pendingComment = [];
        }
    }

    return $descriptions;
}

/**
 * @return array{
 *   available: bool,
 *   total: int, passed: int, failed: int, skipped: int, durationMs: int,
 *   breakdown: array<int, array{
 *     name: string, passed: int, failed: int, skipped: int, time: float,
 *     tests: array<int, array{name: string, status: string, time: float, message: ?string}>,
 *   }>,
 * }
 */
function parseBackendJunit(string $path, array $descriptions): array
{
    $empty = ['available' => false, 'total' => 0, 'passed' => 0, 'failed' => 0, 'skipped' => 0, 'durationMs' => 0, 'breakdown' => []];

    if (! file_exists($path)) {
        return $empty;
    }

    $xml = @simplexml_load_file($path);

    if ($xml === false) {
        return $empty;
    }

    $classSuites = $xml->xpath('//testsuite[testcase]') ?: [];
    $breakdown = [];
    $totalPassed = 0;
    $totalFailed = 0;
    $totalSkipped = 0;
    $totalTests = 0;
    $totalTime = 0.0;

    foreach ($classSuites as $suite) {
        $name = (string) $suite['name'];
        $tests = [];
        $suitePassed = 0;
        $suiteFailed = 0;
        $suiteSkipped = 0;
        $suiteTime = 0.0;

        foreach ($suite->testcase as $testcase) {
            $time = (float) $testcase['time'];
            $suiteTime += $time;
            $testName = (string) ($testcase['name'] ?? '?');
            $description = $descriptions[$name . '::' . $testName] ?? null;

            if (isset($testcase->failure) || isset($testcase->error)) {
                $node = $testcase->failure ?? $testcase->error;
                $tests[] = ['name' => $testName, 'status' => 'failed', 'time' => $time, 'message' => trim((string) $node), 'description' => $description];
                $suiteFailed++;
            } elseif (isset($testcase->skipped)) {
                $tests[] = ['name' => $testName, 'status' => 'skipped', 'time' => $time, 'message' => null, 'description' => $description];
                $suiteSkipped++;
            } else {
                $tests[] = ['name' => $testName, 'status' => 'passed', 'time' => $time, 'message' => null, 'description' => $description];
                $suitePassed++;
            }
        }

        usort($tests, fn ($a, $b) => statusRank($a['status']) <=> statusRank($b['status']));

        $breakdown[] = [
            'name' => $name, 'passed' => $suitePassed, 'failed' => $suiteFailed, 'skipped' => $suiteSkipped,
            'time' => $suiteTime, 'tests' => $tests,
        ];

        $totalPassed += $suitePassed;
        $totalFailed += $suiteFailed;
        $totalSkipped += $suiteSkipped;
        $totalTests += count($tests);
        $totalTime += $suiteTime;
    }

    usort($breakdown, fn ($a, $b) => ($b['failed'] <=> $a['failed']) ?: strcmp($a['name'], $b['name']));

    return [
        'available' => true,
        'total' => $totalTests,
        'passed' => $totalPassed,
        'failed' => $totalFailed,
        'skipped' => $totalSkipped,
        'durationMs' => (int) round($totalTime * 1000),
        'breakdown' => $breakdown,
    ];
}

/** Sikertelen tesztek legyenek legfelül egy lenyitott csoporton belül, utánuk a kihagyottak, végül a sikeresek. */
function statusRank(string $status): int
{
    return match ($status) {
        'failed' => 0,
        'skipped' => 1,
        default => 2,
    };
}

/**
 * @return array{
 *   available: bool,
 *   total: int, passed: int, failed: int, skipped: int, durationMs: int,
 *   breakdown: array<int, array{
 *     name: string, passed: int, failed: int, skipped: int, time: float,
 *     tests: array<int, array{name: string, status: string, time: float, message: ?string}>,
 *   }>,
 * }
 */
function parseFrontendJson(string $path): array
{
    $empty = ['available' => false, 'total' => 0, 'passed' => 0, 'failed' => 0, 'skipped' => 0, 'durationMs' => 0, 'breakdown' => []];

    if (! file_exists($path)) {
        return $empty;
    }

    $data = json_decode((string) file_get_contents($path), true);

    if (! is_array($data)) {
        return $empty;
    }

    $breakdown = [];

    foreach (($data['testResults'] ?? []) as $fileResult) {
        $tests = [];
        $filePassed = 0;
        $fileFailed = 0;
        $fileSkipped = 0;
        $fileTime = ((float) ($fileResult['endTime'] ?? 0) - (float) ($fileResult['startTime'] ?? 0)) / 1000;

        foreach (($fileResult['assertionResults'] ?? []) as $assertion) {
            $status = $assertion['status'] ?? '';
            $duration = ((float) ($assertion['duration'] ?? 0)) / 1000;
            // A Vitest "title" már önmagában is egy olvasható magyar mondat
            // (pl. "a katalógusból ismert típust részesíti előnyben...") —
            // az "ancestorTitles" (a describe()-blokkok) adják hozzá a
            // kontextust, ezt tesszük leírásnak, hasonlóan a backend
            // teszt-kommentjeihez.
            $testName = $assertion['title'] ?? $assertion['fullName'] ?? '?';
            $description = ($assertion['ancestorTitles'] ?? []) !== [] ? implode(' › ', $assertion['ancestorTitles']) : null;

            if ($status === 'passed') {
                $filePassed++;
                $tests[] = ['name' => $testName, 'status' => 'passed', 'time' => $duration, 'message' => null, 'description' => $description];
            } elseif ($status === 'failed') {
                $fileFailed++;
                $tests[] = [
                    'name' => $testName, 'status' => 'failed', 'time' => $duration,
                    'message' => trim(implode("\n", $assertion['failureMessages'] ?? [])), 'description' => $description,
                ];
            } else {
                $fileSkipped++;
                $tests[] = ['name' => $testName, 'status' => 'skipped', 'time' => $duration, 'message' => null, 'description' => $description];
            }
        }

        usort($tests, fn ($a, $b) => statusRank($a['status']) <=> statusRank($b['status']));

        // A Vitest JSON "name" mezője abszolút útvonal, OS-függő
        // perjelekkel — a "/frontend/" (vagy "\frontend\") utáni részt
        // vágjuk ki belőle, függetlenül a pontos elérési út formátumától.
        $fileName = str_replace('\\', '/', $fileResult['name'] ?? 'ismeretlen fájl');
        $shortName = preg_replace('#^.*/frontend/#i', '', $fileName);

        $breakdown[] = [
            'name' => $shortName, 'passed' => $filePassed, 'failed' => $fileFailed, 'skipped' => $fileSkipped,
            'time' => max($fileTime, 0), 'tests' => $tests,
        ];
    }

    usort($breakdown, fn ($a, $b) => ($b['failed'] <=> $a['failed']) ?: strcmp($a['name'], $b['name']));

    return [
        'available' => true,
        'total' => (int) ($data['numTotalTests'] ?? 0),
        'passed' => (int) ($data['numPassedTests'] ?? 0),
        'failed' => (int) ($data['numFailedTests'] ?? 0),
        'skipped' => (int) ($data['numPendingTests'] ?? 0) + (int) ($data['numTodoTests'] ?? 0),
        'durationMs' => isset($data['startTime'])
            ? (int) round(array_sum(array_column($data['testResults'] ?? [], 'endTime')) - array_sum(array_column($data['testResults'] ?? [], 'startTime')))
            : 0,
        'breakdown' => $breakdown,
    ];
}

/** Egyetlen, önmagában is értelmezhető donut-diagram (tiszta SVG, nincs JS-függőség a rajzoláshoz — csak a %-számláló animációjához). */
function renderDonut(int $passed, int $failed, int $skipped): string
{
    $total = max($passed + $failed + $skipped, 1);
    $radius = 54;
    $circumference = 2 * M_PI * $radius;

    $segments = [
        ['value' => $failed, 'color' => '#c62828', 'label' => 'Sikertelen'],
        ['value' => $skipped, 'color' => '#9c8f8d', 'label' => 'Kihagyott'],
        ['value' => $passed, 'color' => '#166534', 'label' => 'Sikeres'],
    ];

    $offset = 0;
    $arcs = '';

    foreach ($segments as $segment) {
        if ($segment['value'] <= 0) {
            continue;
        }

        $fraction = $segment['value'] / $total;
        $length = $fraction * $circumference;
        $gap = $circumference - $length;
        $dashOffset = -$offset;

        $arcs .= sprintf(
            '<circle class="donut-seg" r="%d" cx="60" cy="60" fill="none" stroke="%s" stroke-width="14" '
            . 'stroke-dasharray="%.3f %.3f" stroke-dashoffset="%.3f" transform="rotate(-90 60 60)"><title>%s: %d</title></circle>',
            $radius, $segment['color'], $length, $gap, $dashOffset, h($segment['label']), $segment['value']
        );

        $offset += $length;
    }

    $percent = $total > 0 ? (int) round($passed / $total * 100) : 0;

    return <<<SVG
        <svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label="Eredmény arány: {$percent}% sikeres">
            <circle r="{$radius}" cx="60" cy="60" fill="none" stroke="var(--donut-track)" stroke-width="14" />
            {$arcs}
            <text x="60" y="56" text-anchor="middle" class="donut-percent count-up" data-final="{$percent}">0%</text>
            <text x="60" y="74" text-anchor="middle" class="donut-caption">sikeres</text>
        </svg>
        SVG;
}

function renderLegendDot(string $color): string
{
    return '<span class="legend-dot" style="background:' . $color . '"></span>';
}

function statusIcon(string $status): string
{
    return match ($status) {
        'failed' => '<span class="test-icon icon-failed" aria-hidden="true">&#10005;</span>',
        'skipped' => '<span class="test-icon icon-skipped" aria-hidden="true">&#9679;</span>',
        default => '<span class="test-icon icon-passed" aria-hidden="true">&#10003;</span>',
    };
}

/**
 * Egy osztály/fájl lenyitható csoportja: fejléc (arány-sáv + összesítés),
 * lenyitva pedig az egyes tesztek listája ikonnal, névvel, idővel — sikertelen
 * teszteknél a hibaüzenettel is. A sikertelen teszteket tartalmazó csoportok
 * alapból nyitva jelennek meg, hogy a hiba azonnal látható legyen.
 *
 * @param array<int, array{name: string, passed: int, failed: int, skipped: int, time: float, tests: array<int, array{name: string, status: string, time: float, message: ?string}>}> $breakdown
 */
function renderAccordion(array $breakdown, string $unitLabel): string
{
    if ($breakdown === []) {
        return '<p class="muted">Nincs adat.</p>';
    }

    $groups = '';

    foreach ($breakdown as $row) {
        $total = max($row['passed'] + $row['failed'] + $row['skipped'], 1);
        $passPct = $row['passed'] / $total * 100;
        $failPct = $row['failed'] / $total * 100;
        $skipPct = $row['skipped'] / $total * 100;
        $hasFailure = $row['failed'] > 0;

        $testItems = '';

        foreach ($row['tests'] as $test) {
            $message = $test['message']
                ? sprintf('<pre class="test-message">%s</pre>', h($test['message']))
                : '';

            $nameBlock = ($test['description'] ?? null)
                ? sprintf(
                    '<span class="test-name"><span class="test-desc">%s</span><code class="test-method">%s</code></span>',
                    h($test['description']), h($test['name'])
                )
                : sprintf('<span class="test-name"><code class="test-method">%s</code></span>', h($test['name']));

            $testItems .= sprintf(
                '<li class="test-item status-%s">%s%s<span class="test-time">%s</span>%s</li>',
                h($test['status']), statusIcon($test['status']), $nameBlock,
                $test['time'] > 0 ? number_format($test['time'] * 1000, 0) . ' ms' : '&lt;1 ms',
                $message
            );
        }

        $groups .= sprintf(
            '<div class="group%s">'
            . '<button type="button" class="group-header" aria-expanded="%s">'
            . '<svg class="chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3l6 5-6 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            . '<span class="group-name" title="%s">%s</span>'
            . '<span class="minibar"><span class="bar-seg" data-w="%.2f" style="background:#166534"></span><span class="bar-seg" data-w="%.2f" style="background:#c62828"></span><span class="bar-seg" data-w="%.2f" style="background:#9c8f8d"></span></span>'
            . '<span class="group-count">%d/%d</span>'
            . '<span class="group-time">%.2fs</span>'
            . '</button>'
            . '<div class="group-body-wrap"><div class="group-body-inner"><ul class="test-list">%s</ul></div></div>'
            . '</div>',
            $hasFailure ? ' open row-failed' : '',
            $hasFailure ? 'true' : 'false',
            h($row['name']), h($row['name']),
            $passPct, $failPct, $skipPct,
            $row['passed'], $total, $row['time'],
            $testItems
        );
    }

    return <<<HTML
        <div class="accordion-head">
            <span>{$unitLabel}</span><span>Arány</span><span>Eredmény</span><span>Idő</span>
        </div>
        <div class="accordion">{$groups}</div>
        HTML;
}

function renderSuiteCard(string $title, array $stats, string $unitLabel): string
{
    if (! $stats['available']) {
        return <<<HTML
            <section class="card suite-card">
                <h2>{$title}</h2>
                <p class="muted">Nincs adat — nem futott le ehhez a csomaghoz teszt, vagy a kimeneti fájl hiányzik.</p>
            </section>
            HTML;
    }

    $donut = renderDonut($stats['passed'], $stats['failed'], $stats['skipped']);
    $accordion = renderAccordion($stats['breakdown'], $unitLabel);
    $durationSec = number_format($stats['durationMs'] / 1000, 1);
    $greenDot = renderLegendDot('#166534');
    $redDot = renderLegendDot('#c62828');
    $grayDot = renderLegendDot('#9c8f8d');

    return <<<HTML
        <section class="card suite-card">
            <div class="suite-header">
                <h2>{$title}</h2>
                <span class="duration">{$durationSec} s</span>
            </div>
            <div class="suite-body">
                <div class="donut-wrap">{$donut}</div>
                <div class="legend">
                    <div class="legend-row">{$greenDot} Sikeres <strong>{$stats['passed']}</strong></div>
                    <div class="legend-row">{$redDot} Sikertelen <strong>{$stats['failed']}</strong></div>
                    <div class="legend-row">{$grayDot} Kihagyott <strong>{$stats['skipped']}</strong></div>
                    <div class="legend-row total-row">Összesen <strong>{$stats['total']}</strong></div>
                </div>
            </div>
            {$accordion}
        </section>
        HTML;
}

$backendDescriptions = extractBackendTestDescriptions($backendTestsDir);
$backend = parseBackendJunit($backendJunitPath, $backendDescriptions);
$frontend = parseFrontendJson($frontendJsonPath);

$overallTotal = $backend['total'] + $frontend['total'];
$overallPassed = $backend['passed'] + $frontend['passed'];
$overallFailed = $backend['failed'] + $frontend['failed'];
$overallSkipped = $backend['skipped'] + $frontend['skipped'];
$overallPercent = $overallTotal > 0 ? round($overallPassed / $overallTotal * 100, 1) : 0;
$generatedAt = (new DateTime())->format('Y-m-d H:i:s');

$backendCard = renderSuiteCard('Backend (PHPUnit)', $backend, 'Teszt osztály');
$frontendCard = renderSuiteCard('Frontend (Vitest)', $frontend, 'Teszt fájl');

$statusBadgeColor = $overallFailed > 0 ? '#c62828' : '#166534';
$statusBadgeText = $overallFailed > 0 ? 'Vannak sikertelen tesztek' : 'Minden teszt sikeres';

$html = <<<HTML
<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<title>Rendszerteszt riport — {$generatedAt}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  /*
   * A színek és a stílus szándékosan az alkalmazás saját MUI témáját
   * (frontend/src/theme/muiTheme.ts, colors.ts) tükrözik — ugyanaz a
   * bordó elsődleges szín (#a3172b), krémes háttér, kártyák enyhe
   * kerettel (nem lebegő árnyékkal, ahogy a Paper variant="outlined"
   * mintát követi a többi oldal), Inter betűtípus. Az alkalmazásnak
   * nincs sötét témája (muiTheme.ts: mode: 'light' fixen), ezért ez a
   * riport is SZÁNDÉKOSAN mindig világos.
   */
  :root {
    --bg: #f7f6f5;
    --surface: #ffffff;
    --border: rgba(0,0,0,0.10);
    --text: #211a1b;
    --text-muted: #5b4d4e;
    --donut-track: #efe3e3;
    --primary: #a3172b;
    --primary-dark: #7a1020;
    --success: #166534;
    --danger: #c62828;
    --skip: #9c8f8d;
    --table-head-bg: #faf5f5;
  }
  html { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    padding: 32px 20px 60px;
  }
  .wrap { max-width: 980px; margin: 0 auto; }
  header { margin-bottom: 24px; }
  h1 { font-size: 1.6rem; margin: 0 0 4px; font-weight: 700; }
  .subtitle { color: var(--text-muted); font-size: 0.9rem; }
  .badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px; border-radius: 999px; font-weight: 600; font-size: 0.85rem;
    color: #fff; margin-top: 12px;
  }
  .overview {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px; margin: 20px 0 28px;
  }
  .stat-tile {
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    padding: 14px 16px;
  }
  .stat-tile .value { font-size: 1.5rem; font-weight: 700; }
  .stat-tile .label { font-size: 0.78rem; color: var(--text-muted); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 20px; }
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
    padding: 20px; margin-bottom: 20px;
    min-width: 0; /* grid item alapból nem engedi zsugorodni a tartalmát a track alá */
  }
  .suite-header { display: flex; justify-content: space-between; align-items: baseline; }
  .suite-header h2 { margin: 0 0 4px; font-size: 1.15rem; font-weight: 700; }
  .duration { color: var(--text-muted); font-size: 0.85rem; }
  .suite-body { display: flex; align-items: center; gap: 24px; margin: 16px 0; flex-wrap: wrap; }
  .donut-wrap { opacity: 0; transform: scale(.85); animation: popIn 500ms 120ms cubic-bezier(.34,1.56,.64,1) both; }
  .donut-percent { font-size: 20px; font-weight: 700; fill: var(--text); }
  .donut-caption { font-size: 10px; fill: var(--text-muted); }
  .donut-seg { transition: stroke-width 150ms ease; }
  .legend { display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; }
  .legend-row { display: flex; align-items: center; gap: 8px; }
  .legend-row strong { margin-left: auto; padding-left: 12px; }
  .total-row { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 6px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .muted { color: var(--text-muted); font-size: 0.9rem; }

  /* Fejléc-sor az accordion oszlopainak, ugyanazzal a szélesség-osztással, mint a group-header. */
  .accordion-head {
    display: grid; grid-template-columns: 14px 1fr 26% 60px 56px; gap: 10px; align-items: center;
    padding: 6px 10px; margin-top: 4px; border-bottom: 1px solid var(--border);
    color: var(--text-muted); font-weight: 700; font-size: 0.78rem; background: var(--table-head-bg);
    border-radius: 6px 6px 0 0;
  }
  .accordion-head span:nth-child(1) { grid-column: 2; }
  .accordion { border: 1px solid var(--border); border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; }
  .group { border-bottom: 1px solid var(--border); }
  .group:last-child { border-bottom: none; }
  .group-header {
    all: unset; box-sizing: border-box; cursor: pointer;
    display: grid; grid-template-columns: 14px 1fr 26% 60px 56px; gap: 10px; align-items: center;
    width: 100%; padding: 8px 10px; font-size: 0.85rem; color: var(--text);
    transition: background 150ms ease;
  }
  .group-header:hover { background: var(--bg); }
  .group-header:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
  .chevron { color: var(--text-muted); transition: transform 200ms ease; flex-shrink: 0; }
  .group.open .chevron { transform: rotate(90deg); color: var(--primary); }
  .group-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
  .group.row-failed .group-name { color: var(--danger); font-weight: 600; }
  .group-count, .group-time { white-space: nowrap; color: var(--text-muted); font-variant-numeric: tabular-nums; text-align: right; }
  .minibar { display: flex; width: 100%; height: 8px; border-radius: 4px; overflow: hidden; background: var(--donut-track); }
  .bar-seg { display: block; height: 100%; width: 0; transition: width 700ms cubic-bezier(.22,.61,.36,1); }

  .group-body-wrap { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 260ms ease; }
  .group.open .group-body-wrap { grid-template-rows: 1fr; }
  .group-body-inner { overflow: hidden; }
  .test-list { list-style: none; margin: 0; padding: 2px 10px 10px 34px; }
  .test-item {
    display: flex; align-items: flex-start; gap: 8px; padding: 5px 8px; border-radius: 6px;
    font-size: 0.82rem; flex-wrap: wrap;
  }
  .test-item + .test-item { margin-top: 1px; }
  .test-item.status-failed { background: rgba(198,40,40,0.06); }
  .test-name { flex: 1; min-width: 160px; word-break: break-word; display: flex; flex-direction: column; gap: 1px; }
  .test-desc { color: var(--text); line-height: 1.35; }
  .test-method {
    color: var(--text-muted); font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
    font-size: 0.72rem; background: none; opacity: .85;
  }
  .test-time { color: var(--text-muted); font-size: 0.76rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .test-icon { flex-shrink: 0; width: 16px; text-align: center; font-size: 0.78rem; line-height: 1.4; }
  .icon-passed { color: var(--success); }
  .icon-failed { color: var(--danger); font-weight: 700; }
  .icon-skipped { color: var(--skip); }
  .test-message {
    flex-basis: 100%; margin: 4px 0 0 24px; padding: 8px 10px; background: var(--surface);
    border: 1px solid var(--border); border-radius: 6px; font-size: 0.78rem; color: var(--danger);
    white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow-y: auto;
  }
  a { color: var(--primary); }
  footer { text-align: center; color: var(--text-muted); font-size: 0.78rem; margin-top: 32px; }

  @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes popIn { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: scale(1); } }
  header { animation: fadeSlideUp 420ms ease both; }
  .stat-tile { animation: fadeSlideUp 420ms ease both; }
  .stat-tile:nth-child(1) { animation-delay: 40ms; }
  .stat-tile:nth-child(2) { animation-delay: 90ms; }
  .stat-tile:nth-child(3) { animation-delay: 140ms; }
  .stat-tile:nth-child(4) { animation-delay: 190ms; }
  .stat-tile:nth-child(5) { animation-delay: 240ms; }
  .cards .card { animation: fadeSlideUp 480ms ease both; }
  .cards .card:nth-child(1) { animation-delay: 220ms; }
  .cards .card:nth-child(2) { animation-delay: 300ms; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 1ms !important; animation-delay: 0ms !important; transition-duration: 1ms !important; }
  }
  @media (max-width: 640px) {
    .accordion-head, .group-header { grid-template-columns: 14px 1fr 60px 50px; }
    .accordion-head span:nth-child(3) { display: none; }
    .minibar { display: none; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Rendszerteszt riport</h1>
    <div class="subtitle">Generálva: {$generatedAt}</div>
    <span class="badge" style="background:{$statusBadgeColor}">{$statusBadgeText}</span>
  </header>

  <div class="overview">
    <div class="stat-tile"><div class="value count-up" data-final="{$overallTotal}">0</div><div class="label">Összes teszt</div></div>
    <div class="stat-tile"><div class="value count-up" data-final="{$overallPercent}" data-suffix="%">0%</div><div class="label">Sikeres arány</div></div>
    <div class="stat-tile"><div class="value count-up" data-final="{$overallPassed}">0</div><div class="label">Sikeres</div></div>
    <div class="stat-tile"><div class="value count-up" data-final="{$overallFailed}">0</div><div class="label">Sikertelen</div></div>
    <div class="stat-tile"><div class="value count-up" data-final="{$overallSkipped}">0</div><div class="label">Kihagyott</div></div>
  </div>

  <div class="cards">
    {$backendCard}
    {$frontendCard}
  </div>

  <footer>Backend: PHPUnit JUnit XML · Frontend: Vitest JSON reporter · scripts/build-test-report.php által generálva</footer>
</div>
<script>
(function () {
  // Lenyitható csoportok (osztályonként/fájlonként) — kattintásra ki/be.
  document.querySelectorAll('.group-header').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.closest('.group');
      var open = group.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  // Arány-sávok animált behúzása (0-ról a tényleges szélességre).
  var bars = document.querySelectorAll('.bar-seg');
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      bars.forEach(function (bar) {
        bar.style.width = bar.getAttribute('data-w') + '%';
      });
    });
  });

  // Számláló-animáció (0-tól a végértékig) az összesítő számoknál és a donutok %-ánál.
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.count-up').forEach(function (el) {
    var final = parseFloat(el.getAttribute('data-final')) || 0;
    var suffix = el.getAttribute('data-suffix') || (el.classList.contains('donut-percent') ? '%' : '');
    if (reduceMotion) {
      el.textContent = final + suffix;
      return;
    }
    var duration = 900;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(final * eased * 10) / 10;
      el.textContent = (Number.isInteger(final) ? Math.round(current) : current) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
})();
</script>
</body>
</html>
HTML;

if (! is_dir($reportsDir)) {
    mkdir($reportsDir, 0777, true);
}

file_put_contents($outputPath, $html);

echo "Riport elkészült: {$outputPath}\n";
echo "Összesen: {$overallTotal} teszt, {$overallPassed} sikeres, {$overallFailed} sikertelen, {$overallSkipped} kihagyott ({$overallPercent}%).\n";
