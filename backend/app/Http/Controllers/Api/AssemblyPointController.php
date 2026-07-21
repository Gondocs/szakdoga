<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AssemblyPointResource;
use App\Models\AssemblyPoint;
use App\Models\EvacuationEvent;
use App\Services\AuditService;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

/**
 * Interreg tanulmány "Gyülekezési pontok, útvonalak" funkciója: a
 * befogadóhelyektől és jármű-pozícióktól független, önálló térképi
 * entitásként kezelt gyülekezőhelyek karbantartása.
 */
class AssemblyPointController extends Controller
{
    #[OA\Get(
        path: '/api/events/{event}/assembly-points',
        summary: 'Eseményhez tartozó gyülekezési pontok listája',
        security: [['sanctumSession' => []]],
        tags: ['AssemblyPoints'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Gyülekezési pontok listája'),
        ]
    )]
    public function index(EvacuationEvent $event)
    {
        $this->authorize('viewAny', AssemblyPoint::class);

        return AssemblyPointResource::collection($event->assemblyPoints()->orderBy('name')->get());
    }

    #[OA\Post(
        path: '/api/events/{event}/assembly-points',
        summary: 'Gyülekezési pont létrehozása',
        security: [['sanctumSession' => []]],
        tags: ['AssemblyPoints'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'lat', 'lng'],
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'address', type: 'string', nullable: true),
                    new OA\Property(property: 'lat', type: 'number', format: 'float'),
                    new OA\Property(property: 'lng', type: 'number', format: 'float'),
                    new OA\Property(property: 'notes', type: 'string', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott gyülekezési pont'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function store(Request $request, EvacuationEvent $event, AuditService $auditService)
    {
        $this->authorize('create', AssemblyPoint::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $assemblyPoint = AssemblyPoint::create($data + ['event_id' => $event->id]);

        $auditService->log('create', $assemblyPoint, $request->user(), null, $assemblyPoint->toArray());

        return (new AssemblyPointResource($assemblyPoint))->response()->setStatusCode(201);
    }

    #[OA\Put(
        path: '/api/assembly-points/{assemblyPoint}',
        summary: 'Gyülekezési pont módosítása',
        security: [['sanctumSession' => []]],
        tags: ['AssemblyPoints'],
        parameters: [
            new OA\Parameter(name: 'assemblyPoint', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Frissített gyülekezési pont'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function update(Request $request, AssemblyPoint $assemblyPoint, AuditService $auditService)
    {
        $this->authorize('update', $assemblyPoint);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $before = $assemblyPoint->toArray();
        $assemblyPoint->update($data);

        $auditService->log('update', $assemblyPoint, $request->user(), $before, $assemblyPoint->fresh()->toArray());

        return new AssemblyPointResource($assemblyPoint->fresh());
    }

    #[OA\Delete(
        path: '/api/assembly-points/{assemblyPoint}',
        summary: 'Gyülekezési pont törlése',
        security: [['sanctumSession' => []]],
        tags: ['AssemblyPoints'],
        parameters: [
            new OA\Parameter(name: 'assemblyPoint', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Törölve'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function destroy(Request $request, AssemblyPoint $assemblyPoint, AuditService $auditService)
    {
        $this->authorize('delete', $assemblyPoint);

        $before = $assemblyPoint->toArray();
        $assemblyPoint->delete();

        $auditService->log('delete', $assemblyPoint, $request->user(), $before, null);

        return response()->noContent();
    }
}
