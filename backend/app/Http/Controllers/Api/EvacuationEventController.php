<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEvacuationEventRequest;
use App\Http\Requests\UpdateEvacuationEventRequest;
use App\Http\Resources\EvacuationEventResource;
use App\Models\EvacuationEvent;
use App\Services\AuditService;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class EvacuationEventController extends Controller
{
    #[OA\Get(
        path: '/api/events',
        summary: 'Kitelepítési események listája (lapozott)',
        security: [['sanctumSession' => []]],
        tags: ['Events'],
        parameters: [
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Esemény lista'),
            new OA\Response(response: 401, description: 'Nincs bejelentkezve'),
        ]
    )]
    public function index()
    {
        $events = EvacuationEvent::withCount(['persons', 'registrations'])
            ->orderByDesc('created_at')
            ->paginate(20);

        return EvacuationEventResource::collection($events);
    }

    #[OA\Post(
        path: '/api/events',
        summary: 'Új kitelepítési esemény létrehozása',
        description: 'Csak admin és vezető szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Events'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['code', 'name', 'status'],
                properties: [
                    new OA\Property(property: 'code', type: 'string', example: 'EVT-2026-002'),
                    new OA\Property(property: 'name', type: 'string', example: 'Mosoni-Duna árvízi kitelepítés'),
                    new OA\Property(property: 'status', type: 'string', enum: ['draft', 'active', 'paused', 'closed'], example: 'active'),
                    new OA\Property(property: 'starts_at', type: 'string', format: 'date-time', nullable: true),
                    new OA\Property(property: 'ends_at', type: 'string', format: 'date-time', nullable: true),
                    new OA\Property(
                        property: 'shelters',
                        type: 'array',
                        items: new OA\Items(properties: [
                            new OA\Property(property: 'shelter_id', type: 'string', format: 'uuid'),
                            new OA\Property(property: 'capacity_limit', type: 'integer', example: 100),
                        ])
                    ),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott esemény'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 422, description: 'Validációs hiba'),
        ]
    )]
    public function store(StoreEvacuationEventRequest $request, AuditService $auditService)
    {
        $event = DB::transaction(function () use ($request) {
            $event = EvacuationEvent::create($request->safe()->only(['code', 'name', 'status', 'starts_at', 'ends_at']));

            foreach ($request->input('shelters', []) as $shelterData) {
                $event->eventShelters()->create([
                    'shelter_id' => $shelterData['shelter_id'],
                    'capacity_limit' => $shelterData['capacity_limit'],
                ]);
            }

            return $event;
        });

        $auditService->log('create', $event, $request->user(), null, $event->toArray());

        return (new EvacuationEventResource($event->load('eventShelters.shelter')))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Get(
        path: '/api/events/{event}',
        summary: 'Esemény adatlap',
        security: [['sanctumSession' => []]],
        tags: ['Events'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Esemény adatai'),
            new OA\Response(response: 404, description: 'Nincs ilyen esemény'),
        ]
    )]
    public function show(EvacuationEvent $event)
    {
        $this->authorize('view', $event);

        return new EvacuationEventResource($event->load('eventShelters.shelter'));
    }

    #[OA\Put(
        path: '/api/events/{event}',
        summary: 'Esemény módosítása: státusz (aktiválás/szüneteltetés/lezárás), adatok, befogadóhely-kapacitások',
        description: 'A "shelters" tömbben megadott befogadóhelyek felülírják/kiegészítik a meglévő hozzárendeléseket.',
        security: [['sanctumSession' => []]],
        tags: ['Events'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Frissített esemény'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function update(UpdateEvacuationEventRequest $request, EvacuationEvent $event, AuditService $auditService)
    {
        $before = $event->toArray();

        DB::transaction(function () use ($request, $event) {
            $event->update($request->safe()->only(['name', 'status', 'starts_at', 'ends_at']));

            foreach ($request->input('shelters', []) as $shelterData) {
                $event->eventShelters()->updateOrCreate(
                    ['shelter_id' => $shelterData['shelter_id']],
                    ['capacity_limit' => $shelterData['capacity_limit']]
                );
            }
        });

        $auditService->log('update', $event, $request->user(), $before, $event->fresh()->toArray());

        return new EvacuationEventResource($event->fresh(['eventShelters.shelter']));
    }

    #[OA\Delete(
        path: '/api/events/{event}',
        summary: 'Esemény törlése',
        description: 'Csak admin jogosult, és csak akkor engedélyezett, ha az eseményhez még nem tartozik egyetlen regisztrált személy sem '.
            '(adatvesztés elkerülése végett). Meglévő regisztrációk esetén az esemény "lezárva" státuszra állítása javasolt törlés helyett.',
        security: [['sanctumSession' => []]],
        tags: ['Events'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Sikeres törlés'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 409, description: 'Az eseményhez már tartoznak regisztrációk'),
        ]
    )]
    public function destroy(EvacuationEvent $event, AuditService $auditService)
    {
        $this->authorize('delete', $event);

        if ($event->persons()->exists()) {
            return response()->json([
                'message' => 'Az esemény nem törölhető, mert már vannak hozzá tartozó regisztrációk. Zárja le az eseményt törlés helyett.',
                'code' => 'EVENT_HAS_REGISTRATIONS',
            ], 409);
        }

        $before = $event->toArray();
        $event->eventShelters()->delete();
        $event->delete();

        $auditService->log('delete', $event, request()->user(), $before, null);

        return response()->noContent();
    }
}
