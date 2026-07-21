<?php

namespace App\Http\Controllers\Api;

use App\Actions\Registrations\UpdateRegistrationStatusAction;
use App\Enums\RegistrationStatus;
use App\Events\TransportPositionUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\PersonResource;
use App\Models\EvacuationEvent;
use App\Models\EventShelter;
use App\Models\Person;
use App\Models\Transport;
use App\Models\TransportManifestEntry;
use App\Services\AuditService;
use App\Services\QrTokenService;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

/**
 * Interreg tanulmány "Szállítási Kontroll" funkciója: a szervezett szállítást
 * végző járművekre (busz, vonat) történő fel- és leszállás QR-kóddal történő
 * rögzítése, digitális manifesztet létrehozva, ki melyik járművön utazik.
 */
class TransportController extends Controller
{
    #[OA\Get(
        path: '/api/events/{event}/transports',
        summary: 'Egy eseményhez rendelt szállítóeszközök listája, a jelenlegi utaslétszámmal',
        security: [['sanctumSession' => []]],
        tags: ['Transports'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Szállítóeszközök listája'),
        ]
    )]
    public function index(EvacuationEvent $event)
    {
        $this->authorize('viewAny', Transport::class);

        $transports = $event->transports()->with('vehicle')->get();

        return response()->json([
            'data' => $transports->map(fn (Transport $t) => $this->serialize($t)),
        ]);
    }

    private function serialize(Transport $transport): array
    {
        return [
            'id' => $transport->id,
            'code' => $transport->code,
            'capacity' => $transport->capacity,
            'origin' => $transport->origin,
            'destination' => $transport->destination,
            'escort_name' => $transport->escort_name,
            'departure_planned_at' => $transport->departure_planned_at?->toIso8601String(),
            'arrival_planned_at' => $transport->arrival_planned_at?->toIso8601String(),
            'delay_minutes' => $transport->delay_minutes,
            'route_change_note' => $transport->route_change_note,
            'vehicle' => $transport->vehicle ? [
                'id' => $transport->vehicle->id,
                'plate_number' => $transport->vehicle->plate_number,
                'label' => $transport->vehicle->label,
                'vehicle_type' => $transport->vehicle->vehicle_type,
            ] : null,
            'onboard_count' => $transport->onboardCount(),
            'last_lat' => $transport->last_lat !== null ? (float) $transport->last_lat : null,
            'last_lng' => $transport->last_lng !== null ? (float) $transport->last_lng : null,
            'last_position_at' => $transport->last_position_at?->toIso8601String(),
        ];
    }

    /**
     * Ellenőrzi, hogy a kiválasztott jármű nincs-e már egy másik, folyamatban
     * lévő (aktív/szüneteltetett) esemény szállítójárataként lefoglalva —
     * ez előzi meg a dupla lefoglalást (double booking).
     */
    private function findVehicleConflict(string $vehicleId, ?string $excludeTransportId = null): ?Transport
    {
        return Transport::where('vehicle_id', $vehicleId)
            ->when($excludeTransportId, fn ($q) => $q->where('id', '!=', $excludeTransportId))
            ->whereHas('event', fn ($q) => $q->whereIn('status', ['active', 'paused']))
            ->with('event')
            ->first();
    }

    #[OA\Post(
        path: '/api/events/{event}/transports',
        summary: 'Új szállítóeszköz (busz/vonat) létrehozása egy eseményhez',
        description: 'Csak admin és vezető szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Transports'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['code'],
                properties: [
                    new OA\Property(property: 'code', type: 'string', example: '1. sz. busz - Győr'),
                    new OA\Property(property: 'capacity', type: 'integer', nullable: true),
                    new OA\Property(property: 'vehicle_id', type: 'string', format: 'uuid', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott szállítóeszköz'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 409, description: 'A kiválasztott jármű már használatban van egy másik eseményben'),
        ]
    )]
    public function store(Request $request, EvacuationEvent $event, AuditService $auditService)
    {
        $this->authorize('create', Transport::class);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:100'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,id'],
            'origin' => ['nullable', 'string', 'max:150'],
            'destination' => ['nullable', 'string', 'max:150'],
            'escort_name' => ['nullable', 'string', 'max:150'],
            'departure_planned_at' => ['nullable', 'date'],
            'arrival_planned_at' => ['nullable', 'date'],
            'delay_minutes' => ['nullable', 'integer'],
            'route_change_note' => ['nullable', 'string', 'max:255'],
        ]);

        if (! empty($data['vehicle_id']) && $conflict = $this->findVehicleConflict($data['vehicle_id'])) {
            return response()->json([
                'message' => "A jármű már használatban van a(z) \"{$conflict->event?->name}\" eseményben ({$conflict->code}).",
                'code' => 'VEHICLE_IN_USE',
            ], 409);
        }

        $transport = $event->transports()->create($data);

        $auditService->log('create', $transport, $request->user(), null, $transport->toArray());

        return response()->json(['data' => $this->serialize($transport)], 201);
    }

    #[OA\Put(
        path: '/api/transports/{transport}',
        summary: 'Szállítóeszköz adatainak módosítása',
        description: 'Csak admin és vezető szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Transports'],
        parameters: [
            new OA\Parameter(name: 'transport', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(properties: [
                new OA\Property(property: 'code', type: 'string'),
                new OA\Property(property: 'capacity', type: 'integer', nullable: true),
                new OA\Property(property: 'vehicle_id', type: 'string', format: 'uuid', nullable: true),
            ])
        ),
        responses: [
            new OA\Response(response: 200, description: 'Frissített szállítóeszköz'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 409, description: 'A kiválasztott jármű már használatban van egy másik eseményben'),
        ]
    )]
    public function update(Request $request, Transport $transport, AuditService $auditService)
    {
        $this->authorize('update', $transport);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:100'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'vehicle_id' => ['nullable', 'uuid', 'exists:vehicles,id'],
            'origin' => ['nullable', 'string', 'max:150'],
            'destination' => ['nullable', 'string', 'max:150'],
            'escort_name' => ['nullable', 'string', 'max:150'],
            'departure_planned_at' => ['nullable', 'date'],
            'arrival_planned_at' => ['nullable', 'date'],
            'delay_minutes' => ['nullable', 'integer'],
            'route_change_note' => ['nullable', 'string', 'max:255'],
        ]);

        if (! empty($data['vehicle_id']) && $conflict = $this->findVehicleConflict($data['vehicle_id'], $transport->id)) {
            return response()->json([
                'message' => "A jármű már használatban van a(z) \"{$conflict->event?->name}\" eseményben ({$conflict->code}).",
                'code' => 'VEHICLE_IN_USE',
            ], 409);
        }

        $before = $transport->toArray();
        $transport->update($data);

        $auditService->log('update', $transport, $request->user(), $before, $transport->fresh()->toArray());

        return response()->json(['data' => $this->serialize($transport->fresh())]);
    }

    #[OA\Delete(
        path: '/api/transports/{transport}',
        summary: 'Szállítóeszköz törlése',
        description: 'Csak admin és vezető jogosult, és csak akkor, ha jelenleg senki nincs a fedélzetén.',
        security: [['sanctumSession' => []]],
        tags: ['Transports'],
        parameters: [
            new OA\Parameter(name: 'transport', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Sikeres törlés'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 409, description: 'A járművön jelenleg is tartózkodnak személyek'),
        ]
    )]
    public function destroy(Transport $transport, AuditService $auditService)
    {
        $this->authorize('delete', $transport);

        if ($transport->onboardCount() > 0) {
            return response()->json([
                'message' => 'A jármű nem törölhető, mert jelenleg is vannak rajta utasok. Előbb rögzítse a leszállásukat.',
                'code' => 'TRANSPORT_IN_USE',
            ], 409);
        }

        $before = $transport->toArray();
        $transport->delete();

        $auditService->log('delete', $transport, request()->user(), $before, null);

        return response()->noContent();
    }

    #[OA\Get(
        path: '/api/transports/{transport}/passengers',
        summary: 'A jármű fedélzetén jelenleg tartózkodó személyek listája',
        security: [['sanctumSession' => []]],
        tags: ['Transports'],
        parameters: [
            new OA\Parameter(name: 'transport', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Fedélzeten tartózkodó személyek'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function passengers(Transport $transport)
    {
        $this->authorize('viewAny', Transport::class);

        $persons = Person::query()
            ->whereHas('transportManifestEntries', fn ($q) => $q->where('transport_id', $transport->id)->whereNull('alighted_at'))
            ->with(['municipality', 'registration', 'specialNeeds'])
            ->orderBy('last_name')
            ->get();

        return PersonResource::collection($persons);
    }

    #[OA\Post(
        path: '/api/transports/{transport}/simulate-position',
        summary: 'A jármű pozíciójának szimulálása (valós GPS-integráció hiányában demonstrációs célra)',
        description: 'Az esemény egyik, koordinátával rendelkező befogadóhelye közelébe helyezi a járművet, '.
            'kis véletlenszerű eltéréssel. Admin, vezető, regisztrátor vagy befogadóhelyi kezelő jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Transports'],
        parameters: [
            new OA\Parameter(name: 'transport', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Frissített pozíció'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 422, description: 'Nincs koordinátával rendelkező befogadóhely az eseményhez'),
        ]
    )]
    public function simulatePosition(Transport $transport)
    {
        $this->authorize('boardOrAlight', $transport);

        $eventShelters = $transport->event->eventShelters()->with('shelter.municipality')->get();
        $withCoords = $eventShelters->filter(
            fn ($es) => $es->shelter?->municipality?->lat !== null && $es->shelter?->municipality?->lng !== null
        );

        if ($withCoords->isEmpty()) {
            return response()->json([
                'message' => 'Nincs koordinátával rendelkező befogadóhely az eseményhez, a pozíció nem szimulálható.',
                'code' => 'NO_COORDINATES',
            ], 422);
        }

        // Egy véletlenszerű, koordinátával rendelkező befogadóhely
        // közelébe helyezzük a járművet, kis véletlenszerű eltéréssel
        // (jitter), hogy valós GPS-mozgást imitáljon demonstrációs célra
        /** @var EventShelter $target */
        $target = $withCoords->random();
        $jitter = fn () => mt_rand(-600, 600) / 100000; // kb. +/- 0.6 km

        $transport->update([
            'last_lat' => (float) $target->shelter->municipality->lat + $jitter(),
            'last_lng' => (float) $target->shelter->municipality->lng + $jitter(),
            'last_position_at' => now(),
        ]);

        $freshTransport = $transport->fresh();

        event(new TransportPositionUpdated($freshTransport));

        return response()->json(['data' => $this->serialize($freshTransport)]);
    }

    #[OA\Post(
        path: '/api/transports/{transport}/board',
        summary: 'Személy felszállásának rögzítése QR-kóddal (digitális manifeszt)',
        description: 'A regisztráció státusza "szállítás alatt"-ra változik. Admin, vezető, regisztrátor vagy befogadóhelyi kezelő jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Transports'],
        parameters: [
            new OA\Parameter(name: 'transport', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(required: ['public_id'], properties: [
                new OA\Property(property: 'public_id', type: 'string'),
                new OA\Property(property: 'override_capacity', type: 'boolean', example: false),
            ])
        ),
        responses: [
            new OA\Response(response: 201, description: 'Rögzített felszállás'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 404, description: 'QR_TOKEN_NOT_FOUND'),
            new OA\Response(response: 409, description: 'QR_TOKEN_INVALID, ALREADY_ONBOARD vagy TRANSPORT_OVERCAPACITY'),
        ]
    )]
    public function board(
        Request $request,
        Transport $transport,
        QrTokenService $qrTokenService,
        UpdateRegistrationStatusAction $statusAction,
        AuditService $auditService
    ) {
        $this->authorize('boardOrAlight', $transport);

        $data = $request->validate([
            'public_id' => ['required', 'string'],
            'override_capacity' => ['nullable', 'boolean'],
        ]);

        // Kapacitás-ellenőrzés: csak akkor engedjük felszállni a
        // személyt, ha van még hely, vagy az operátor kifejezetten
        // felülbírálta a korlátot
        if ($transport->capacity && ! ($data['override_capacity'] ?? false) && $transport->onboardCount() >= $transport->capacity) {
            return response()->json([
                'message' => 'A jármű elérte a megadott kapacitást. Szükség esetén jelölje az áttöltést.',
                'code' => 'TRANSPORT_OVERCAPACITY',
            ], 409);
        }

        $token = $qrTokenService->resolve($data['public_id']);

        if (! $token || ! $token->isActive()) {
            return response()->json([
                'message' => 'A kód nem található vagy már nem érvényes.',
                'code' => $token ? 'QR_TOKEN_INVALID' : 'QR_TOKEN_NOT_FOUND',
            ], $token ? 409 : 404);
        }

        $person = $token->person ?? $token->family?->primaryContact;

        if (! $person || $person->event_id !== $transport->event_id) {
            return response()->json([
                'message' => 'A személy nem ehhez az eseményhez tartozik.',
                'code' => 'PERSON_EVENT_MISMATCH',
            ], 409);
        }

        $alreadyOnboard = TransportManifestEntry::where('person_id', $person->id)
            ->where('event_id', $transport->event_id)
            ->whereNull('alighted_at')
            ->exists();

        if ($alreadyOnboard) {
            return response()->json([
                'message' => 'A személy már fel van szállva egy járműre.',
                'code' => 'ALREADY_ONBOARD',
            ], 409);
        }

        $entry = TransportManifestEntry::create([
            'transport_id' => $transport->id,
            'event_id' => $transport->event_id,
            'person_id' => $person->id,
            'boarded_at' => now(),
            'boarded_by' => $request->user()->id,
        ]);

        if ($person->registration) {
            $statusAction->execute($person->registration, RegistrationStatus::InTransport, $request->user());
        }

        $auditService->log('transport_board', $entry, $request->user(), null, ['transport_id' => $transport->id, 'person_id' => $person->id]);

        return (new PersonResource($person->fresh(['municipality', 'registration', 'specialNeeds'])))->response()->setStatusCode(201);
    }

    #[OA\Post(
        path: '/api/transports/{transport}/alight',
        summary: 'Személy leszállásának rögzítése QR-kóddal (áthelyezés igazolása)',
        security: [['sanctumSession' => []]],
        tags: ['Transports'],
        parameters: [
            new OA\Parameter(name: 'transport', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(required: ['public_id'], properties: [
                new OA\Property(property: 'public_id', type: 'string'),
            ])
        ),
        responses: [
            new OA\Response(response: 200, description: 'Rögzített leszállás'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 404, description: 'QR_TOKEN_NOT_FOUND vagy NOT_ONBOARD'),
        ]
    )]
    public function alight(Request $request, Transport $transport, QrTokenService $qrTokenService, AuditService $auditService)
    {
        $this->authorize('boardOrAlight', $transport);

        $data = $request->validate(['public_id' => ['required', 'string']]);

        $token = $qrTokenService->resolve($data['public_id']);

        if (! $token || ! $token->isActive()) {
            return response()->json([
                'message' => 'A kód nem található vagy már nem érvényes.',
                'code' => $token ? 'QR_TOKEN_INVALID' : 'QR_TOKEN_NOT_FOUND',
            ], $token ? 409 : 404);
        }

        $person = $token->person ?? $token->family?->primaryContact;

        $entry = $person
            ? TransportManifestEntry::where('transport_id', $transport->id)
                ->where('person_id', $person->id)
                ->whereNull('alighted_at')
                ->first()
            : null;

        if (! $entry) {
            return response()->json([
                'message' => 'A személy nincs felszállva erre a járműre.',
                'code' => 'NOT_ONBOARD',
            ], 404);
        }

        $before = $entry->toArray();
        $entry->update(['alighted_at' => now(), 'alighted_by' => $request->user()->id]);

        $auditService->log('transport_alight', $entry, $request->user(), $before, $entry->fresh()->toArray());

        return new PersonResource($person->fresh(['municipality', 'registration', 'specialNeeds']));
    }

    #[OA\Post(
        path: '/api/transports/{transport}/import-manifest',
        summary: 'Előre elkészített szervezett szállítási lista (utaslista) tömeges importálása CSV-ből',
        description: 'Interreg tanulmány "Szervezett Szállítási Listák (importálása)" funkciója: a fejléc nélküli vagy '.
            'egy fejlécsort tartalmazó CSV első oszlopában szereplő okmányszámok alapján tömegesen felszállítja az '.
            'egyező, az eseményhez tartozó személyeket erre a járműre. Admin, vezető, regisztrátor vagy befogadóhelyi '.
            'kezelő jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Transports'],
        parameters: [
            new OA\Parameter(name: 'transport', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(mediaType: 'multipart/form-data', schema: new OA\Schema(
                required: ['file'],
                properties: [new OA\Property(property: 'file', type: 'string', format: 'binary')]
            ))
        ),
        responses: [
            new OA\Response(response: 200, description: 'Import összegzés: felszállt, nem található, már fedélzeten lévő okmányszámok'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 422, description: 'Validációs hiba'),
        ]
    )]
    public function importManifest(
        Request $request,
        Transport $transport,
        UpdateRegistrationStatusAction $statusAction,
        AuditService $auditService
    ) {
        $this->authorize('boardOrAlight', $transport);

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        // A CSV első oszlopát olvassuk okmányszámként; ha az első sor nem
        // okmányszám-szerű (pl. "Okmányszám" fejléc), azt eldobjuk
        $rows = array_map('str_getcsv', file($request->file('file')->getRealPath()));
        if (! empty($rows) && isset($rows[0][0]) && ! preg_match('/^[0-9A-Za-z]+$/', trim($rows[0][0]))) {
            array_shift($rows); // fejlécsor eldobása, ha nem okmányszám-szerű
        }

        $boarded = [];
        $notFound = [];
        $alreadyOnboard = [];
        $capacityExceeded = [];
        $onboardCount = $transport->onboardCount();

        // Soronként feldolgozzuk az okmányszámokat: megkeressük a
        // hozzájuk tartozó személyt, majd kiszűrjük a hibás eseteket
        // (nem található, már fent van, betelt a kapacitás), mielőtt
        // ténylegesen felszállítanánk
        foreach ($rows as $row) {
            $docNumber = trim((string) ($row[0] ?? ''));
            if ($docNumber === '') {
                continue;
            }

            $person = Person::where('event_id', $transport->event_id)
                ->where('id_document_number', $docNumber)
                ->first();

            if (! $person) {
                $notFound[] = $docNumber;

                continue;
            }

            $onboard = TransportManifestEntry::where('person_id', $person->id)
                ->where('event_id', $transport->event_id)
                ->whereNull('alighted_at')
                ->exists();

            if ($onboard) {
                $alreadyOnboard[] = $docNumber;

                continue;
            }

            if ($transport->capacity && $onboardCount >= $transport->capacity) {
                $capacityExceeded[] = $docNumber;

                continue;
            }

            TransportManifestEntry::create([
                'transport_id' => $transport->id,
                'event_id' => $transport->event_id,
                'person_id' => $person->id,
                'boarded_at' => now(),
                'boarded_by' => $request->user()->id,
            ]);

            if ($person->registration) {
                $statusAction->execute($person->registration, RegistrationStatus::InTransport, $request->user());
            }

            $onboardCount++;
            $boarded[] = $docNumber;
        }

        $auditService->log('transport_import', $transport, $request->user(), null, [
            'boarded' => count($boarded),
            'not_found' => count($notFound),
            'already_onboard' => count($alreadyOnboard),
            'capacity_exceeded' => count($capacityExceeded),
        ]);

        return response()->json([
            'data' => [
                'boarded_count' => count($boarded),
                'not_found' => $notFound,
                'already_onboard' => $alreadyOnboard,
                'capacity_exceeded' => $capacityExceeded,
                'transport' => $this->serialize($transport->fresh()),
            ],
        ]);
    }
}
