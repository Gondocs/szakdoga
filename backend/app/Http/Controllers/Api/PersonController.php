<?php

namespace App\Http\Controllers\Api;

use App\Actions\Qr\IssueQrTokenAction;
use App\Actions\Registrations\CreateRegistrationAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePersonRequest;
use App\Http\Requests\UpdatePersonRequest;
use App\Http\Resources\PersonResource;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Person;
use App\Models\StatusHistory;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

class PersonController extends Controller
{
    #[OA\Get(
        path: '/api/events/{event}/persons',
        summary: 'Eseményhez tartozó regisztrált személyek listája',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'search', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: [
                'registered', 'in_transport', 'arrived_shelter', 'left_shelter', 'returned_home', 'cancelled',
            ])),
            new OA\Parameter(name: 'special_need_category', in: 'query', schema: new OA\Schema(type: 'string', enum: [
                'medical', 'mobility', 'age', 'diet', 'animal', 'other',
            ])),
            new OA\Parameter(name: 'special_need_type', in: 'query', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'central_transport_required', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'central_accommodation_required', in: 'query', schema: new OA\Schema(type: 'boolean')),
            new OA\Parameter(name: 'shelter_id', in: 'query', description: 'Csak az adott befogadóhelyre bejelentkezett személyek', schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'municipality_id', in: 'query', description: 'Csak az adott lakóhely szerinti település', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', description: 'Oldalankénti elemszám (max. 1000)', schema: new OA\Schema(type: 'integer', default: 25)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Személyek lapozott listája'),
        ]
    )]
    public function index(Request $request, EvacuationEvent $event)
    {
        $this->authorize('viewAny', Person::class);

        $persons = $event->persons()
            ->with(['municipality', 'registration', 'specialNeeds', 'family'])
            ->when($request->string('search')->isNotEmpty(), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(function ($q) use ($term) {
                    $q->where('last_name', 'like', $term)
                        ->orWhere('first_name', 'like', $term)
                        ->orWhereHas('family', fn ($fq) => $fq->where('family_code', 'like', $term));
                });
            })
            ->when($request->filled('municipality_id'), fn ($query) => $query->where('municipality_id', $request->integer('municipality_id')))
            ->when($request->filled('status'), fn ($query) => $query->whereHas(
                'registration',
                fn ($q) => $q->where('status', $request->string('status'))
            ))
            ->when($request->filled('special_need_category'), fn ($query) => $query->whereHas(
                'specialNeeds',
                fn ($q) => $q->where('category', $request->string('special_need_category'))
                    ->when($request->filled('special_need_type'), fn ($q2) => $q2->where('type', $request->string('special_need_type')))
            ))
            ->when($request->filled('central_transport_required'), fn ($query) => $query->whereHas(
                'registration',
                fn ($q) => $q->where('central_transport_required', $request->boolean('central_transport_required'))
            ))
            ->when($request->filled('central_accommodation_required'), fn ($query) => $query->whereHas(
                'registration',
                fn ($q) => $q->where('central_accommodation_required', $request->boolean('central_accommodation_required'))
            ))
            ->when($request->filled('shelter_id'), fn ($query) => $query->whereHas(
                'checkins',
                fn ($q) => $q->where('shelter_id', $request->string('shelter_id'))
            ))
            ->orderBy('last_name')
            ->paginate(min($request->integer('per_page', 25), 1000));

        return PersonResource::collection($persons);
    }

    #[OA\Get(
        path: '/api/events/{event}/persons/municipality-summary',
        summary: 'Regisztráltak száma lakóhely (település) szerint aggregálva, térképes megjelenítéshez',
        description: 'Csak a koordinátával rendelkező településeket adja vissza. Interreg tanulmány '.
            '"Geografikus Nyomon Követési Dashboard" funkciója.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Településenkénti összesítés koordinátákkal'),
        ]
    )]
    public function municipalitySummary(EvacuationEvent $event)
    {
        $this->authorize('viewAny', Person::class);

        $rows = $event->persons()
            ->join('municipalities', 'persons.municipality_id', '=', 'municipalities.id')
            ->whereNotNull('municipalities.lat')
            ->whereNotNull('municipalities.lng')
            ->selectRaw('municipalities.id as municipality_id, municipalities.name as name, municipalities.lat as lat, municipalities.lng as lng, count(*) as person_count')
            ->groupBy('municipalities.id', 'municipalities.name', 'municipalities.lat', 'municipalities.lng')
            ->get();

        return response()->json([
            'data' => $rows->map(fn ($row) => [
                'municipality_id' => $row->municipality_id,
                'name' => $row->name,
                'lat' => (float) $row->lat,
                'lng' => (float) $row->lng,
                'person_count' => (int) $row->person_count,
            ]),
        ]);
    }

    #[OA\Post(
        path: '/api/events/{event}/persons',
        summary: 'Személy/család regisztráció rögzítése',
        description: 'Csak aktív eseményhez lehet regisztrálni. Admin, vezető vagy regisztrátor szerepkör szükséges.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['last_name', 'first_name', 'municipality_id'],
                properties: [
                    new OA\Property(property: 'last_name', type: 'string', example: 'Kovács'),
                    new OA\Property(property: 'first_name', type: 'string', example: 'János'),
                    new OA\Property(property: 'birth_place', type: 'string', nullable: true),
                    new OA\Property(property: 'birth_date', type: 'string', format: 'date', nullable: true),
                    new OA\Property(property: 'mother_birth_name', type: 'string', nullable: true),
                    new OA\Property(property: 'municipality_id', type: 'integer', example: 1),
                    new OA\Property(property: 'address_postal_code', type: 'string', nullable: true),
                    new OA\Property(property: 'address_settlement', type: 'string', nullable: true),
                    new OA\Property(property: 'address_street', type: 'string', nullable: true),
                    new OA\Property(property: 'address_house_number', type: 'string', nullable: true),
                    new OA\Property(property: 'phone', type: 'string', nullable: true),
                    new OA\Property(property: 'email', type: 'string', format: 'email', nullable: true),
                    new OA\Property(property: 'family_id', type: 'string', format: 'uuid', nullable: true),
                    new OA\Property(property: 'create_new_family', type: 'boolean', example: false),
                    new OA\Property(property: 'is_primary_contact', type: 'boolean', example: false),
                    new OA\Property(property: 'central_transport_required', type: 'boolean', example: false),
                    new OA\Property(property: 'central_accommodation_required', type: 'boolean', example: false),
                    new OA\Property(property: 'under_regular_medical_care', type: 'boolean', example: false),
                    new OA\Property(property: 'own_vehicle', type: 'boolean', example: false),
                    new OA\Property(property: 'travels_alone', type: 'boolean', nullable: true),
                    new OA\Property(
                        property: 'special_needs',
                        type: 'array',
                        items: new OA\Items(properties: [
                            new OA\Property(property: 'category', type: 'string', enum: ['medical', 'mobility', 'age', 'diet', 'animal', 'other']),
                            new OA\Property(property: 'type', type: 'string', nullable: true),
                            new OA\Property(property: 'priority', type: 'integer', example: 1),
                            new OA\Property(property: 'description', type: 'string', nullable: true),
                        ])
                    ),
                    new OA\Property(
                        property: 'animals',
                        type: 'array',
                        items: new OA\Items(properties: [
                            new OA\Property(property: 'animal_type', type: 'string', example: 'kutya'),
                            new OA\Property(property: 'count', type: 'integer', example: 1),
                            new OA\Property(property: 'stays_at_address', type: 'boolean', example: false),
                        ])
                    ),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott személy és regisztráció'),
            new OA\Response(response: 422, description: 'Validációs hiba vagy nem aktív esemény'),
        ]
    )]
    public function store(StorePersonRequest $request, EvacuationEvent $event, CreateRegistrationAction $action)
    {
        if (! $event->isActive()) {
            abort(422, 'Regisztráció csak aktív eseményhez rögzíthető.');
        }

        $person = $action->execute($event, $request->validated(), $request->user());

        return (new PersonResource($person))->response()->setStatusCode(201);
    }

    #[OA\Post(
        path: '/api/events/{event}/persons/bulk-import',
        summary: 'Lakossági/önkormányzati névlista tömeges importálása előzetes QR-kód generálással',
        description: 'Interreg tanulmány "Előzetes kódgenerálás és kiosztás" funkciója: egy előre összeállított '.
            'lakossági vagy önkormányzati CSV-lista alapján tömegesen létrehozza a regisztrációkat és azonnal '.
            'QR-kódot is generál mindegyikhez, hogy a tényleges kitelepítéskor már csak a kód beolvasása legyen '.
            'szükséges. CSV-fejléc: vezetéknév,keresztnév,okmányszám,település,telefon. Admin, vezető vagy '.
            'regisztrátor szerepkör szükséges, csak aktív eseményhez.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(mediaType: 'multipart/form-data', schema: new OA\Schema(
                required: ['file'],
                properties: [new OA\Property(property: 'file', type: 'string', format: 'binary')]
            ))
        ),
        responses: [
            new OA\Response(response: 200, description: 'Import összegzés: létrehozott személyek QR-kódokkal, hibás sorok'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 422, description: 'Validációs hiba vagy nem aktív esemény'),
        ]
    )]
    public function bulkImport(
        Request $request,
        EvacuationEvent $event,
        CreateRegistrationAction $createRegistration,
        IssueQrTokenAction $issueQr
    ) {
        $this->authorize('create', Person::class);

        if (! $event->isActive()) {
            abort(422, 'Tömeges import csak aktív eseményhez végezhető.');
        }

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:4096'],
        ]);

        $rows = array_map('str_getcsv', file($request->file('file')->getRealPath()));
        array_shift($rows); // fejlécsor eldobása

        $created = [];
        $errors = [];

        foreach ($rows as $row) {
            [$lastName, $firstName, $docNumber, $municipalityName, $phone] = array_pad($row, 5, null);
            $lastName = trim((string) $lastName);
            $firstName = trim((string) $firstName);

            if ($lastName === '' || $firstName === '') {
                continue;
            }

            $municipality = Municipality::whereRaw('LOWER(name) = ?', [Str::lower(trim((string) $municipalityName))])->first();

            if (! $municipality) {
                $errors[] = "{$lastName} {$firstName}: település nem található (\"{$municipalityName}\").";
                continue;
            }

            $person = $createRegistration->execute($event, [
                'last_name' => $lastName,
                'first_name' => $firstName,
                'id_document_number' => $docNumber !== null && trim((string) $docNumber) !== '' ? trim((string) $docNumber) : null,
                'municipality_id' => $municipality->id,
                'phone' => $phone !== null && trim((string) $phone) !== '' ? trim((string) $phone) : null,
            ], $request->user());

            $qrToken = $issueQr->execute($person, $request->user());

            $created[] = [
                'person_id' => $person->id,
                'full_name' => $person->fullName(),
                'public_id' => $qrToken->public_id,
            ];
        }

        return response()->json([
            'data' => [
                'created_count' => count($created),
                'created' => $created,
                'errors' => $errors,
            ],
        ]);
    }

    #[OA\Get(
        path: '/api/persons/{person}',
        summary: 'Személy adatlap (regisztráció, speciális igények, állatok, QR-tokenek)',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Személy adatai'),
            new OA\Response(response: 404, description: 'Nincs ilyen személy'),
        ]
    )]
    public function show(Person $person)
    {
        $this->authorize('view', $person);

        $person->load(['municipality', 'family', 'registration', 'specialNeeds', 'animals', 'qrTokens', 'checkins.shelter']);

        return new PersonResource($person);
    }

    #[OA\Put(
        path: '/api/persons/{person}',
        summary: 'Személy adatainak módosítása',
        description: 'Csak nem lezárt eseményhez tartozó személy módosítható; admin vagy regisztrátor szerepkör szükséges.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'last_name', type: 'string'),
                    new OA\Property(property: 'first_name', type: 'string'),
                    new OA\Property(property: 'phone', type: 'string', nullable: true),
                    new OA\Property(property: 'email', type: 'string', format: 'email', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Frissített személy adatai'),
            new OA\Response(response: 403, description: 'Nincs jogosultság vagy lezárt esemény'),
        ]
    )]
    public function update(UpdatePersonRequest $request, Person $person, AuditService $auditService)
    {
        $before = $person->toArray();

        $person->update($request->validated() + ['updated_by' => $request->user()->id]);

        $auditService->log('update', $person, $request->user(), $before, $person->fresh()->toArray());

        return new PersonResource($person->fresh(['municipality', 'registration']));
    }

    #[OA\Post(
        path: '/api/persons/{person}/document-photo',
        summary: 'Okmányfénykép rögzítése a helyszíni regisztrációhoz',
        description: 'Kamerával vagy fájlfeltöltéssel rögzített kép az igazolványról (nem OCR, csak tárolás). '.
            'Admin vagy regisztrátor szerepkör szükséges.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(mediaType: 'multipart/form-data', schema: new OA\Schema(
                required: ['photo', 'side'],
                properties: [
                    new OA\Property(property: 'photo', type: 'string', format: 'binary'),
                    new OA\Property(property: 'side', type: 'string', enum: ['front', 'back'], description: 'Az okmány eleje vagy hátulja'),
                ]
            ))
        ),
        responses: [
            new OA\Response(response: 200, description: 'Frissített személy, benne a document_photo_front_url/document_photo_back_url'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 422, description: 'Validációs hiba'),
        ]
    )]
    public function uploadDocumentPhoto(Request $request, Person $person)
    {
        $this->authorize('update', $person);

        $data = $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'side' => ['required', 'string', 'in:front,back'],
        ]);

        $column = $data['side'] === 'back' ? 'document_photo_back_path' : 'document_photo_front_path';

        if ($person->{$column}) {
            Storage::disk('public')->delete($person->{$column});
        }

        $path = $request->file('photo')->store('document-photos', 'public');
        $person->update([$column => $path]);

        return new PersonResource($person->fresh(['municipality', 'registration']));
    }

    #[OA\Delete(
        path: '/api/persons/{person}/document-photo',
        summary: 'Okmányfénykép (eleje vagy hátulja) eltávolítása',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'side', in: 'query', required: true, schema: new OA\Schema(type: 'string', enum: ['front', 'back'])),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Frissített személy'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function deleteDocumentPhoto(Request $request, Person $person)
    {
        $this->authorize('update', $person);

        $data = $request->validate([
            'side' => ['required', 'string', 'in:front,back'],
        ]);

        $column = $data['side'] === 'back' ? 'document_photo_back_path' : 'document_photo_front_path';

        if ($person->{$column}) {
            Storage::disk('public')->delete($person->{$column});
            $person->update([$column => null]);
        }

        return new PersonResource($person->fresh(['municipality', 'registration']));
    }

    #[OA\Get(
        path: '/api/persons/{person}/status-history',
        summary: 'A személy regisztrációjának státusztörténete időrendben',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Státusztörténet bejegyzések'),
        ]
    )]
    public function statusHistory(Person $person)
    {
        $this->authorize('view', $person);

        $registration = $person->registration;

        if (! $registration) {
            return response()->json(['data' => []]);
        }

        $history = StatusHistory::with('changedBy')
            ->where('entity_type', 'Registration')
            ->where('entity_id', $registration->id)
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'data' => $history->map(fn ($h) => [
                'id' => $h->id,
                'old_status' => $h->old_status,
                'new_status' => $h->new_status,
                'changed_by' => $h->changedBy?->name,
                'created_at' => $h->created_at?->toIso8601String(),
            ]),
        ]);
    }
}
