<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CareEventResource;
use App\Models\CareEvent;
use App\Models\Person;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

/**
 * Interreg tanulmány "Befogadóhelyi érkeztetés és ellátáskövetés" funkciója:
 * a befogadóhelyen nyújtott ellátási események (étkezés, segélycsomag, orvosi
 * ellátás, tisztálkodás) személyenkénti naplózása.
 */
class CareEventController extends Controller
{
    #[OA\Get(
        path: '/api/persons/{person}/care-events',
        summary: 'Egy személyhez rögzített ellátási események listája',
        security: [['sanctumSession' => []]],
        tags: ['CareEvents'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Ellátási események időrendben'),
        ]
    )]
    public function index(Person $person)
    {
        $this->authorize('viewAny', CareEvent::class);

        $careEvents = $person->careEvents()->with(['shelter', 'recordedBy'])->latest('recorded_at')->get();

        return CareEventResource::collection($careEvents);
    }

    #[OA\Post(
        path: '/api/persons/{person}/care-events',
        summary: 'Ellátási esemény rögzítése (étkezés, segélycsomag, orvosi ellátás, tisztálkodás)',
        description: 'Admin, vezető, regisztrátor vagy befogadóhelyi kezelő jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['CareEvents'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['category'],
                properties: [
                    new OA\Property(property: 'category', type: 'string', enum: ['meal', 'aid_package', 'medical', 'hygiene', 'other']),
                    new OA\Property(property: 'note', type: 'string', nullable: true),
                    new OA\Property(property: 'shelter_id', type: 'string', format: 'uuid', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott ellátási esemény'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function store(Request $request, Person $person)
    {
        $this->authorize('create', CareEvent::class);

        $data = $request->validate([
            'category' => ['required', 'string', 'in:meal,aid_package,medical,hygiene,other'],
            'note' => ['nullable', 'string', 'max:255'],
            'shelter_id' => ['nullable', 'uuid', 'exists:shelters,id'],
        ]);

        $shelterId = $data['shelter_id'] ?? $person->checkins()->latest('checked_in_at')->first()?->shelter_id;

        $careEvent = CareEvent::create([
            'person_id' => $person->id,
            'event_id' => $person->event_id,
            'shelter_id' => $shelterId,
            'category' => $data['category'],
            'note' => $data['note'] ?? null,
            'recorded_by' => $request->user()->id,
            'recorded_at' => now(),
        ]);

        return (new CareEventResource($careEvent->load(['shelter', 'recordedBy'])))->response()->setStatusCode(201);
    }
}
