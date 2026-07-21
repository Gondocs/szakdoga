<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreShelterRequest;
use App\Http\Requests\UpdateShelterRequest;
use App\Http\Resources\ShelterResource;
use App\Models\EvacuationEvent;
use App\Models\EventShelter;
use App\Models\Shelter;
use App\Models\SpecialNeed;
use App\Services\AuditService;
use App\Services\CapacityRiskService;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class ShelterController extends Controller
{
    #[OA\Get(
        path: '/api/shelters',
        summary: 'Összes törzsadat befogadóhely listája (esemény-függetlenül)',
        security: [['sanctumSession' => []]],
        tags: ['Shelters'],
        responses: [
            new OA\Response(response: 200, description: 'Befogadóhelyek listája'),
        ]
    )]
    public function all()
    {
        $shelters = Shelter::with('municipality')->orderBy('name')->get();

        return ShelterResource::collection($shelters);
    }

    #[OA\Post(
        path: '/api/shelters',
        summary: 'Új befogadóhely törzsadat létrehozása',
        description: 'Csak admin és vezető szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Shelters'],
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott befogadóhely'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function store(StoreShelterRequest $request, AuditService $auditService)
    {
        $shelter = Shelter::create($request->validated());

        $auditService->log('create', $shelter, $request->user(), null, $shelter->toArray());

        return (new ShelterResource($shelter->load('municipality')))->response()->setStatusCode(201);
    }

    #[OA\Put(
        path: '/api/shelters/{shelter}',
        summary: 'Befogadóhely törzsadat módosítása',
        security: [['sanctumSession' => []]],
        tags: ['Shelters'],
        parameters: [
            new OA\Parameter(name: 'shelter', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Frissített befogadóhely'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function update(UpdateShelterRequest $request, Shelter $shelter, AuditService $auditService)
    {
        $before = $shelter->toArray();
        $shelter->update($request->validated());

        $auditService->log('update', $shelter, $request->user(), $before, $shelter->fresh()->toArray());

        return new ShelterResource($shelter->fresh('municipality'));
    }

    #[OA\Delete(
        path: '/api/shelters/{shelter}',
        summary: 'Befogadóhely törzsadat törlése',
        description: 'Csak admin jogosult, és csak akkor engedélyezett, ha a befogadóhely jelenleg egyetlen eseményhez '.
            'sincs hozzárendelve (nincs kapcsolódó kapacitás- vagy érkeztetési adat).',
        security: [['sanctumSession' => []]],
        tags: ['Shelters'],
        parameters: [
            new OA\Parameter(name: 'shelter', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Sikeres törlés'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 409, description: 'A befogadóhely eseményhez van rendelve'),
        ]
    )]
    public function destroy(Shelter $shelter, AuditService $auditService)
    {
        $this->authorize('delete', $shelter);

        if (EventShelter::where('shelter_id', $shelter->id)->exists()) {
            return response()->json([
                'message' => 'A befogadóhely nem törölhető, mert esemény(ek)hez van rendelve. Állítsa inaktívra törlés helyett.',
                'code' => 'SHELTER_IN_USE',
            ], 409);
        }

        $before = $shelter->toArray();
        $shelter->delete();

        $auditService->log('delete', $shelter, request()->user(), $before, null);

        return response()->noContent();
    }

    #[OA\Get(
        path: '/api/events/{event}/shelters',
        summary: 'Egy eseményhez rendelt befogadóhelyek kapacitása és kockázati szintje',
        security: [['sanctumSession' => []]],
        tags: ['Shelters'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'person_id', in: 'query', description: 'Ha megadott, a válasz az adott személy egyedi igényei alapján javasolt sorrendben és pontszámmal tér vissza (Interreg tanulmány "Valós Idejű Kapacitás Összekapcsolás" funkciója).', schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Befogadóhelyek kapacitás- és kockázatadatokkal',
                content: new OA\JsonContent(properties: [
                    new OA\Property(property: 'data', type: 'array', items: new OA\Items(properties: [
                        new OA\Property(property: 'event_shelter_id', type: 'integer'),
                        new OA\Property(property: 'capacity_limit', type: 'integer'),
                        new OA\Property(property: 'checked_in_count', type: 'integer'),
                        new OA\Property(property: 'utilization', type: 'number', format: 'float', example: 0.62),
                        new OA\Property(property: 'risk_score', type: 'number', format: 'float', example: 43.4),
                        new OA\Property(property: 'risk_level', type: 'string', enum: ['low', 'medium', 'high', 'critical']),
                        new OA\Property(property: 'match_score', type: 'integer', nullable: true),
                        new OA\Property(property: 'match_reasons', type: 'array', items: new OA\Items(type: 'string')),
                        new OA\Property(property: 'recommended', type: 'boolean'),
                    ])),
                ])
            ),
        ]
    )]
    public function index(Request $request, EvacuationEvent $event, CapacityRiskService $riskService)
    {
        $eventShelters = $event->eventShelters()->with('shelter.municipality')->get();

        $needCategories = collect();
        if ($request->filled('person_id')) {
            $needCategories = SpecialNeed::where('person_id', $request->string('person_id'))
                ->pluck('category')
                ->map(fn ($c) => $c->value)
                ->unique();
        }

        $rows = $eventShelters->map(function ($es) use ($riskService, $needCategories) {
            $risk = $riskService->forEventShelter($es);
            $freeCapacity = max($es->capacity_limit - $es->checked_in_count, 0);

            $matchScore = null;
            $matchReasons = [];

            if ($needCategories->isNotEmpty()) {
                $matchScore = 0;

                if ($needCategories->contains('medical') && $es->shelter->medical_support_available) {
                    $matchScore += 3;
                    $matchReasons[] = 'Egészségügyi támogatás elérhető';
                }
                if ($needCategories->contains('mobility') && $es->shelter->accessible_capacity > 0) {
                    $matchScore += 3;
                    $matchReasons[] = 'Van akadálymentes férőhely';
                }
                if ($freeCapacity <= 0) {
                    $matchScore -= 10;
                    $matchReasons[] = 'Nincs szabad kapacitás';
                } elseif ($risk['utilization'] < 0.5) {
                    $matchScore += 1;
                }
            }

            return [
                'event_shelter_id' => $es->id,
                'shelter' => (new ShelterResource($es->shelter))->toArray(request()),
                'capacity_limit' => $es->capacity_limit,
                'checked_in_count' => $es->checked_in_count,
                'free_capacity' => $freeCapacity,
                'utilization' => $risk['utilization'],
                'risk_score' => $risk['score'],
                'risk_level' => $risk['level']->value,
                'match_score' => $matchScore,
                'match_reasons' => $matchReasons,
            ];
        });

        if ($needCategories->isNotEmpty()) {
            $rows = $rows->sortByDesc('match_score')->values();
            $topScore = $rows->first()['match_score'] ?? null;
            $rows = $rows->map(function ($row) use ($topScore) {
                $row['recommended'] = $topScore !== null && $topScore > 0 && $row['match_score'] === $topScore && $row['free_capacity'] > 0;

                return $row;
            });
        } else {
            $rows = $rows->map(function ($row) {
                $row['recommended'] = false;

                return $row;
            });
        }

        return response()->json(['data' => $rows->values()]);
    }
}
