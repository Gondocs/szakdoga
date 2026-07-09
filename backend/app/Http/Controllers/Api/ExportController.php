<?php

namespace App\Http\Controllers\Api;

use App\Enums\RegistrationStatus;
use App\Enums\SpecialNeedCategory;
use App\Http\Controllers\Controller;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\RepatriationAuthorization;
use App\Models\Shelter;
use App\Models\SpecialNeed;
use App\Services\CapacityRiskService;
use App\Services\DemographicsService;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    #[OA\Get(
        path: '/api/events/{event}/persons/export',
        summary: 'Regisztrált személyek exportálása CSV formátumban',
        description: 'Opcionális (F14) jelentéskészítő funkció. Admin vagy vezető szerepkör szükséges.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'CSV fájl letöltése'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function personsCsv(EvacuationEvent $event): StreamedResponse
    {
        $this->authorize('export', $event);

        $persons = $event->persons()->with(['municipality', 'registration', 'specialNeeds', 'family'])->orderBy('last_name')->get();

        $filename = "regisztraltak-{$event->code}.csv";

        return response()->streamDownload(function () use ($persons) {
            $handle = fopen('php://output', 'w');
            // UTF-8 BOM, hogy Excelben is helyesen jelenjenek meg az ékezetes karakterek.
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'Vezetéknév', 'Keresztnév', 'Nem', 'Születési hely', 'Születési idő',
                'Település', 'Cím', 'Telefon', 'Család kód', 'Regisztráció csatorna',
                'Státusz', 'Központi szállítás', 'Központi elszállásolás', 'Speciális igények',
            ], ';');

            foreach ($persons as $person) {
                fputcsv($handle, [
                    $person->last_name,
                    $person->first_name,
                    $person->gender?->label(),
                    $person->birth_place,
                    $person->birth_date?->toDateString(),
                    $person->municipality?->name,
                    trim("{$person->address_postal_code} {$person->address_settlement}, {$person->address_street} {$person->address_house_number}"),
                    $person->phone,
                    $person->family?->family_code,
                    $person->registration?->channel?->label(),
                    $person->registration?->status?->label(),
                    $person->registration?->central_transport_required ? 'igen' : 'nem',
                    $person->registration?->central_accommodation_required ? 'igen' : 'nem',
                    $person->specialNeeds->map(fn ($n) => $n->category->label())->implode(', '),
                ], ';');
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    #[OA\Get(
        path: '/api/events/{event}/shelters/{shelter}/roster-export',
        summary: 'Egy befogadóhelyen jelenleg tartózkodók névsorának exportálása CSV formátumban (nyomtatáshoz)',
        description: 'Admin és vezető bármely befogadóhelyre, a befogadóhelyi kezelő csak a saját befogadóhelyére kérheti le.',
        security: [['sanctumSession' => []]],
        tags: ['Shelters'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'shelter', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'CSV fájl letöltése'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function shelterRosterCsv(EvacuationEvent $event, Shelter $shelter): StreamedResponse
    {
        $this->authorize('printRoster', $shelter);

        $persons = $event->persons()
            ->whereHas('registration', fn ($q) => $q->where('status', 'arrived_shelter'))
            ->with(['municipality', 'registration', 'specialNeeds', 'family', 'checkins' => fn ($q) => $q->orderByDesc('checked_in_at')])
            ->get()
            ->filter(fn ($person) => $person->checkins->first()?->shelter_id === $shelter->id)
            ->sortBy('last_name')
            ->values();

        $filename = "nevsor-{$shelter->name}-{$event->code}.csv";

        return response()->streamDownload(function () use ($persons) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'Vezetéknév', 'Keresztnév', 'Születési hely', 'Születési idő',
                'Település', 'Cím', 'Telefon', 'Család kód', 'Speciális igények',
            ], ';');

            foreach ($persons as $person) {
                fputcsv($handle, [
                    $person->last_name,
                    $person->first_name,
                    $person->birth_place,
                    $person->birth_date?->toDateString(),
                    $person->municipality?->name,
                    trim("{$person->address_postal_code} {$person->address_settlement}, {$person->address_street} {$person->address_house_number}"),
                    $person->phone,
                    $person->family?->family_code,
                    $person->specialNeeds->map(fn ($n) => $n->category->label())->implode(', '),
                ], ';');
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    #[OA\Get(
        path: '/api/events/{event}/report-export',
        summary: 'Összesített (demográfiai és igény-eloszlási) jelentés exportálása CSV formátumban',
        description: 'Aggregált vezetői jelentés (nem személyenkénti lista): összesítő mutatók, státusz- és igény-eloszlás, '.
            'befogadóhelyi kihasználtság. Admin vagy vezető szerepkör szükséges.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'CSV fájl letöltése'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function summaryReportCsv(EvacuationEvent $event, CapacityRiskService $riskService, DemographicsService $demographicsService): StreamedResponse
    {
        $this->authorize('export', $event);

        $demographics = $demographicsService->breakdown($event);

        $registrations = $event->registrations();

        $registeredCount = (clone $registrations)->count();
        $familiesCount = $event->families()->count();
        $arrivedCount = (clone $registrations)->where('status', 'arrived_shelter')->count();
        $centralTransportCount = (clone $registrations)->where('central_transport_required', true)->count();
        $centralAccommodationCount = (clone $registrations)->where('central_accommodation_required', true)->count();

        $statusBreakdown = (clone $registrations)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $specialNeedsByCategory = SpecialNeed::whereHas('person', fn ($q) => $q->where('event_id', $event->id))
            ->selectRaw('category, count(*) as total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $shelterRows = $event->eventShelters()->with('shelter')->get()->map(function ($es) use ($riskService) {
            $risk = $riskService->forEventShelter($es);

            return [
                'name' => $es->shelter?->name,
                'capacity_limit' => $es->capacity_limit,
                'checked_in_count' => $es->checked_in_count,
                'utilization' => round($risk['utilization'] * 100),
                'risk_level' => $risk['level']->label(),
            ];
        });

        $municipalityIds = $event->persons()->distinct()->pluck('municipality_id');
        $municipalityNames = Municipality::whereIn('id', $municipalityIds)->pluck('name', 'id');
        $returnedCounts = $event->persons()
            ->whereHas('registration', fn ($q) => $q->where('status', 'returned_home'))
            ->selectRaw('municipality_id, count(*) as total')
            ->groupBy('municipality_id')
            ->pluck('total', 'municipality_id');
        $repatriationRows = RepatriationAuthorization::where('event_id', $event->id)
            ->whereIn('municipality_id', $municipalityIds)
            ->get()
            ->map(fn ($a) => [
                'municipality' => $municipalityNames->get($a->municipality_id, '–'),
                'status' => $a->status->label(),
                'returned_count' => $returnedCounts->get($a->municipality_id, 0),
            ]);

        $filename = "osszesito-jelentes-{$event->code}.csv";

        return response()->streamDownload(function () use (
            $event,
            $registeredCount,
            $familiesCount,
            $arrivedCount,
            $centralTransportCount,
            $centralAccommodationCount,
            $statusBreakdown,
            $specialNeedsByCategory,
            $repatriationRows,
            $shelterRows,
            $demographics
        ) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, ['Kitelepítési esemény összesítő jelentése'], ';');
            fputcsv($handle, ['Esemény', "{$event->name} ({$event->code})"], ';');
            fputcsv($handle, ['Generálva', now()->toDateTimeString()], ';');
            fputcsv($handle, [], ';');

            fputcsv($handle, ['Összesítő mutatók'], ';');
            fputcsv($handle, ['Regisztráltak száma', $registeredCount], ';');
            fputcsv($handle, ['Családok száma', $familiesCount], ';');
            fputcsv($handle, ['Megérkezettek száma', $arrivedCount], ';');
            fputcsv($handle, ['Központi szállítást igénylők', $centralTransportCount], ';');
            fputcsv($handle, ['Központi elszállásolást igénylők', $centralAccommodationCount], ';');
            fputcsv($handle, [], ';');

            fputcsv($handle, ['Regisztrációk státusz szerint'], ';');
            foreach (RegistrationStatus::cases() as $status) {
                fputcsv($handle, [$status->label(), $statusBreakdown->get($status->value, 0)], ';');
            }
            fputcsv($handle, [], ';');

            fputcsv($handle, ['Speciális igények kategóriánként'], ';');
            foreach (SpecialNeedCategory::cases() as $category) {
                fputcsv($handle, [$category->label(), $specialNeedsByCategory->get($category->value, 0)], ';');
            }
            fputcsv($handle, [], ';');

            fputcsv($handle, ['Nem szerinti megoszlás'], ';');
            $genderLabels = ['male' => 'Férfi', 'female' => 'Nő', 'other' => 'Egyéb'];
            foreach ($genderLabels as $key => $label) {
                fputcsv($handle, [$label, $demographics['gender'][$key] ?? 0], ';');
            }
            fputcsv($handle, [], ';');

            fputcsv($handle, ['Kor szerinti megoszlás'], ';');
            foreach ($demographics['age'] as $bucket => $count) {
                fputcsv($handle, [$bucket, $count], ';');
            }
            fputcsv($handle, [], ';');

            fputcsv($handle, ['Befogadóhelyek kihasználtsága'], ';');
            fputcsv($handle, ['Név', 'Kapacitás', 'Foglalt', 'Telítettség %', 'Kockázat'], ';');
            foreach ($shelterRows as $row) {
                fputcsv($handle, [$row['name'], $row['capacity_limit'], $row['checked_in_count'], $row['utilization'], $row['risk_level']], ';');
            }
            fputcsv($handle, [], ';');

            fputcsv($handle, ['Visszatelepítési engedélyezési státuszok'], ';');
            fputcsv($handle, ['Település', 'Státusz', 'Visszatelepültek száma'], ';');
            foreach ($repatriationRows as $row) {
                fputcsv($handle, [$row['municipality'], $row['status'], $row['returned_count']], ';');
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
