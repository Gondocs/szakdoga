<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use App\Services\AuditService;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

/**
 * Eseményfüggetlen szállítójármű-flotta törzsadatai: egy jármű (busz)
 * egyszer vehető fel, majd tetszőleges eseményhez rendelhető szállítóeszközként
 * (Transport), a Citizen/Person mintához hasonlóan. Az esetleges dupla
 * lefoglalás (ugyanaz a jármű két folyamatban lévő eseményhez egyszerre)
 * a TransportController store/update műveletében kerül ellenőrzésre.
 */
class VehicleController extends Controller
{
    #[OA\Get(
        path: '/api/vehicles',
        summary: 'Szállítójármű-flotta törzsadatainak listája, aktuális hozzárendeléssel',
        security: [['sanctumSession' => []]],
        tags: ['Vehicles'],
        responses: [
            new OA\Response(response: 200, description: 'Járművek listája'),
        ]
    )]
    public function index()
    {
        $this->authorize('viewAny', Vehicle::class);

        $vehicles = Vehicle::orderBy('label')->get();

        return response()->json([
            'data' => $vehicles->map(fn (Vehicle $v) => $this->serialize($v)),
        ]);
    }

    private function serialize(Vehicle $vehicle): array
    {
        $assignment = $vehicle->activeAssignment();

        return [
            'id' => $vehicle->id,
            'plate_number' => $vehicle->plate_number,
            'label' => $vehicle->label,
            'vehicle_type' => $vehicle->vehicle_type,
            'capacity' => $vehicle->capacity,
            'driver_name' => $vehicle->driver_name,
            'notes' => $vehicle->notes,
            'active_assignment' => $assignment ? [
                'transport_id' => $assignment->id,
                'transport_code' => $assignment->code,
                'event_id' => $assignment->event_id,
                'event_name' => $assignment->event?->name,
                'last_lat' => $assignment->last_lat,
                'last_lng' => $assignment->last_lng,
                'last_position_at' => $assignment->last_position_at?->toIso8601String(),
            ] : null,
        ];
    }

    #[OA\Post(
        path: '/api/vehicles',
        summary: 'Új jármű felvétele a flottába',
        description: 'Csak admin és vezető szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Vehicles'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['plate_number', 'label'],
                properties: [
                    new OA\Property(property: 'plate_number', type: 'string', example: 'AAA-123'),
                    new OA\Property(property: 'label', type: 'string', example: '1. sz. busz'),
                    new OA\Property(property: 'capacity', type: 'integer', nullable: true),
                    new OA\Property(property: 'driver_name', type: 'string', nullable: true),
                    new OA\Property(property: 'notes', type: 'string', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott jármű'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function store(Request $request, AuditService $auditService)
    {
        $this->authorize('create', Vehicle::class);

        $data = $request->validate([
            'plate_number' => ['required', 'string', 'max:20', 'unique:vehicles,plate_number'],
            'label' => ['required', 'string', 'max:100'],
            'vehicle_type' => ['nullable', 'string', 'in:bus,minibus,train,car,ambulance,truck,other'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'driver_name' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $vehicle = Vehicle::create($data);

        $auditService->log('create', $vehicle, $request->user(), null, $vehicle->toArray());

        return response()->json(['data' => $this->serialize($vehicle)], 201);
    }

    #[OA\Put(
        path: '/api/vehicles/{vehicle}',
        summary: 'Jármű törzsadatainak módosítása',
        description: 'Csak admin és vezető szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Vehicles'],
        parameters: [
            new OA\Parameter(name: 'vehicle', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Frissített jármű'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function update(Request $request, Vehicle $vehicle, AuditService $auditService)
    {
        $this->authorize('update', $vehicle);

        $data = $request->validate([
            'plate_number' => ['required', 'string', 'max:20', 'unique:vehicles,plate_number,'.$vehicle->id],
            'label' => ['required', 'string', 'max:100'],
            'vehicle_type' => ['nullable', 'string', 'in:bus,minibus,train,car,ambulance,truck,other'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'driver_name' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $before = $vehicle->toArray();
        $vehicle->update($data);

        $auditService->log('update', $vehicle, $request->user(), $before, $vehicle->fresh()->toArray());

        return response()->json(['data' => $this->serialize($vehicle->fresh())]);
    }

    #[OA\Delete(
        path: '/api/vehicles/{vehicle}',
        summary: 'Jármű törlése a flottából',
        description: 'Csak admin és vezető jogosult, és csak akkor, ha a jármű jelenleg nincs folyamatban lévő eseményhez rendelve.',
        security: [['sanctumSession' => []]],
        tags: ['Vehicles'],
        parameters: [
            new OA\Parameter(name: 'vehicle', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Sikeres törlés'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 409, description: 'A jármű jelenleg használatban van'),
        ]
    )]
    public function destroy(Vehicle $vehicle, AuditService $auditService)
    {
        $this->authorize('delete', $vehicle);

        if ($vehicle->activeAssignment()) {
            return response()->json([
                'message' => 'A jármű nem törölhető, mert jelenleg egy folyamatban lévő eseményhez van rendelve.',
                'code' => 'VEHICLE_IN_USE',
            ], 409);
        }

        $before = $vehicle->toArray();
        $vehicle->delete();

        $auditService->log('delete', $vehicle, request()->user(), $before, null);

        return response()->noContent();
    }
}
