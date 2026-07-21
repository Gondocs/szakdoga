<?php

namespace App\Http\Controllers\Api;

use App\Enums\RoleCode;
use App\Http\Controllers\Controller;
use App\Http\Resources\PersonResource;
use App\Models\EvacuationEvent;
use App\Models\Family;
use App\Models\FamilyReunificationNote;
use App\Services\AuditService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class FamilyController extends Controller
{
    #[OA\Get(
        path: '/api/events/{event}/families',
        summary: 'Eseményhez tartozó családok/csoportok listája',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Családok listája'),
        ]
    )]
    public function index(EvacuationEvent $event)
    {
        $families = $event->families()->with('members.checkins')->withCount('members')->orderBy('family_code')->get();

        return response()->json([
            'data' => $families->map(fn ($f) => [
                'id' => $f->id,
                'family_code' => $f->family_code,
                'members_count' => $f->members_count,
                'primary_contact_person_id' => $f->primary_contact_person_id,
                'is_split' => $this->isSplit($f),
            ]),
        ]);
    }

    #[OA\Get(
        path: '/api/families/{family}',
        summary: 'Család részletei: tagok és kapcsolattartó',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'family', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Család adatai a tagokkal'),
        ]
    )]
    public function show(Family $family)
    {
        $family->load(['members.municipality', 'members.registration', 'members.specialNeeds', 'members.checkins.shelter', 'primaryContact']);

        return response()->json([
            'data' => [
                'id' => $family->id,
                'family_code' => $family->family_code,
                'primary_contact_person_id' => $family->primary_contact_person_id,
                'members' => PersonResource::collection($family->members)->toArray(request()),
            ],
        ]);
    }

    #[OA\Get(
        path: '/api/events/{event}/families/reunification-worklist',
        summary: 'Szétszakadt családok munkalistája (családegyesítés)',
        description: 'Interreg tanulmány "Családegyesítési munkalista és vészprotokoll" funkciója: a jelenleg '.
            'különböző befogadóhelyeken tartózkodó családok listája, a tagok aktuális elhelyezésével és az '.
            'ügyintézés eddigi bejegyzéseivel.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Szétszakadt családok listája'),
        ]
    )]
    public function reunificationWorklist(EvacuationEvent $event)
    {
        $families = $event->families()
            ->with([
                'members.checkins' => fn ($q) => $q->orderByDesc('checked_in_at')->orderByDesc('id'),
                'members.checkins.shelter.municipality',
                'reunificationNotes.createdBy',
            ])
            ->orderBy('family_code')
            ->get()
            ->filter(fn ($f) => $this->isSplit($f))
            ->values();

        return response()->json([
            'data' => $families->map(function ($f) {
                $latestNote = $f->reunificationNotes->sortByDesc('created_at')->first();

                return [
                    'id' => $f->id,
                    'family_code' => $f->family_code,
                    'members' => $f->members->map(function ($m) {
                        $shelter = $m->checkins->first()?->shelter;

                        return [
                            'id' => $m->id,
                            'full_name' => $m->fullName(),
                            'current_shelter' => $shelter?->name,
                            'shelter_id' => $shelter?->id,
                            'shelter_coordinates' => $shelter?->municipality && $shelter->municipality->lat !== null && $shelter->municipality->lng !== null
                                ? ['lat' => (float) $shelter->municipality->lat, 'lng' => (float) $shelter->municipality->lng]
                                : null,
                        ];
                    }),
                    'latest_note' => $latestNote ? ['note' => $latestNote->note, 'resolved' => $latestNote->resolved] : null,
                    'notes_count' => $f->reunificationNotes->count(),
                ];
            }),
        ]);
    }

    #[OA\Get(
        path: '/api/families/{family}/reunification-notes',
        summary: 'Egy család családegyesítési bejegyzéseinek listája',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'family', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Bejegyzések időrendben'),
        ]
    )]
    public function reunificationNotes(Family $family)
    {
        $notes = $family->reunificationNotes()->with('createdBy')->latest()->get();

        return response()->json([
            'data' => $notes->map(fn ($n) => [
                'id' => $n->id,
                'note' => $n->note,
                'resolved' => $n->resolved,
                'created_by' => $n->createdBy?->name,
                'created_at' => $n->created_at?->toIso8601String(),
            ]),
        ]);
    }

    #[OA\Post(
        path: '/api/families/{family}/reunification-notes',
        summary: 'Családegyesítési bejegyzés hozzáadása',
        description: 'Admin, vezető vagy regisztrátor jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'family', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['note'],
                properties: [
                    new OA\Property(property: 'note', type: 'string'),
                    new OA\Property(property: 'resolved', type: 'boolean', example: false),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott bejegyzés'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function addReunificationNote(Request $request, Family $family, AuditService $auditService)
    {
        if (! $request->user()->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar)) {
            throw new AuthorizationException('Nincs jogosultsága a bejegyzés rögzítéséhez.');
        }

        $data = $request->validate([
            'note' => ['required', 'string', 'max:1000'],
            'resolved' => ['nullable', 'boolean'],
        ]);

        $note = FamilyReunificationNote::create([
            'family_id' => $family->id,
            'note' => $data['note'],
            'resolved' => $data['resolved'] ?? false,
            'created_by' => $request->user()->id,
        ]);

        $auditService->log('reunification_note_add', $note, $request->user(), null, $note->toArray());

        return response()->json([
            'data' => [
                'id' => $note->id,
                'note' => $note->note,
                'resolved' => $note->resolved,
                'created_by' => $request->user()->name,
                'created_at' => $note->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    private function isSplit(Family $family): bool
    {
        return $family->members
            ->map(fn ($m) => $m->checkins->sortByDesc('checked_in_at')->first()?->shelter_id)
            ->filter()
            ->unique()
            ->count() > 1;
    }
}
