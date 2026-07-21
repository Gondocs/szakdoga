<?php

namespace App\Http\Controllers\Api;

use App\Events\IncidentCreated;
use App\Http\Controllers\Controller;
use App\Http\Resources\IncidentResource;
use App\Models\EvacuationEvent;
use App\Models\Incident;
use App\Services\AuditService;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

/**
 * Interreg tanulmány "Panaszok, rendkívüli események és konfliktusok
 * rögzítése" funkciója (befogadóhelyi ellátáskövetés és jelentéskészítés).
 */
class IncidentController extends Controller
{
    #[OA\Get(
        path: '/api/events/{event}/incidents',
        summary: 'Eseményhez tartozó panaszok/rendkívüli események listája',
        security: [['sanctumSession' => []]],
        tags: ['Incidents'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'status', in: 'query', required: false, schema: new OA\Schema(type: 'string', enum: ['open', 'resolved'])),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Incidensek időrendben'),
        ]
    )]
    public function index(Request $request, EvacuationEvent $event)
    {
        $this->authorize('viewAny', Incident::class);

        $incidents = $event->incidents()
            ->with(['shelter.municipality', 'person.municipality', 'reportedBy', 'resolvedBy'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest()
            ->get();

        return IncidentResource::collection($incidents);
    }

    #[OA\Post(
        path: '/api/events/{event}/incidents',
        summary: 'Panasz/rendkívüli esemény rögzítése',
        description: 'Admin, vezető, regisztrátor vagy befogadóhelyi kezelő jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Incidents'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['category', 'severity', 'description'],
                properties: [
                    new OA\Property(property: 'category', type: 'string', enum: ['complaint', 'conflict', 'security', 'damage', 'other']),
                    new OA\Property(property: 'severity', type: 'string', enum: ['low', 'medium', 'high']),
                    new OA\Property(property: 'description', type: 'string'),
                    new OA\Property(property: 'shelter_id', type: 'string', format: 'uuid', nullable: true),
                    new OA\Property(property: 'person_id', type: 'string', format: 'uuid', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott incidens'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function store(Request $request, EvacuationEvent $event, AuditService $auditService)
    {
        $this->authorize('create', Incident::class);

        $data = $request->validate([
            'category' => ['required', 'string', 'in:complaint,conflict,security,damage,other'],
            'severity' => ['required', 'string', 'in:low,medium,high'],
            'description' => ['required', 'string', 'max:2000'],
            'shelter_id' => ['nullable', 'uuid', 'exists:shelters,id'],
            'person_id' => ['nullable', 'uuid', 'exists:persons,id'],
        ]);

        $incident = Incident::create($data + [
            'event_id' => $event->id,
            'status' => 'open',
            'reported_by' => $request->user()->id,
        ]);

        $incident->load(['shelter', 'person', 'reportedBy']);

        $auditService->log('incident_create', $incident, $request->user(), null, $incident->toArray(), forceSignificant: true);

        event(new IncidentCreated($incident));

        return (new IncidentResource($incident))->response()->setStatusCode(201);
    }

    #[OA\Post(
        path: '/api/incidents/{incident}/resolve',
        summary: 'Panasz/rendkívüli esemény lezárása',
        security: [['sanctumSession' => []]],
        tags: ['Incidents'],
        parameters: [
            new OA\Parameter(name: 'incident', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lezárt incidens'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function resolve(Request $request, Incident $incident, AuditService $auditService)
    {
        $this->authorize('resolve', $incident);

        $before = $incident->toArray();

        $incident->update([
            'status' => 'resolved',
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        $auditService->log('incident_resolve', $incident, $request->user(), $before, $incident->fresh()->toArray(), forceSignificant: true);

        return new IncidentResource($incident->fresh(['shelter', 'person', 'reportedBy', 'resolvedBy']));
    }
}
