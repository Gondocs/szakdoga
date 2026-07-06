<?php

namespace App\Http\Controllers\Api;

use App\Enums\RoleCode;
use App\Http\Controllers\Controller;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\RepatriationAuthorization;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

/**
 * Interreg tanulmány "Visszatelepítési modul" funkciója: településenkénti
 * visszatelepítési engedélyezési státusz, feltételek és időablak kezelése.
 */
class RepatriationController extends Controller
{
    #[OA\Get(
        path: '/api/events/{event}/repatriation-authorizations',
        summary: 'Az eseményben érintett települések visszatelepítési engedélyezési státusza',
        security: [['sanctumSession' => []]],
        tags: ['Repatriation'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Településenkénti engedélyezési státuszok, létszámadatokkal'),
        ]
    )]
    public function index(EvacuationEvent $event)
    {
        $this->authorize('viewAny', RepatriationAuthorization::class);

        $municipalityIds = $event->persons()->distinct()->pluck('municipality_id');
        $municipalities = Municipality::whereIn('id', $municipalityIds)->orderBy('name')->get();

        $authorizations = RepatriationAuthorization::where('event_id', $event->id)
            ->whereIn('municipality_id', $municipalityIds)
            ->with('updatedBy')
            ->get()
            ->keyBy('municipality_id');

        $totalCounts = $event->persons()->selectRaw('municipality_id, count(*) as total')->groupBy('municipality_id')->pluck('total', 'municipality_id');
        $returnedCounts = $event->persons()
            ->whereHas('registration', fn ($q) => $q->where('status', 'returned_home'))
            ->selectRaw('municipality_id, count(*) as total')
            ->groupBy('municipality_id')
            ->pluck('total', 'municipality_id');

        return response()->json([
            'data' => $municipalities->map(function ($m) use ($authorizations, $totalCounts, $returnedCounts) {
                $auth = $authorizations->get($m->id);

                return [
                    'municipality_id' => $m->id,
                    'municipality_name' => $m->name,
                    'status' => $auth?->status->value ?? 'not_permitted',
                    'conditions_note' => $auth?->conditions_note,
                    'window_starts_at' => $auth?->window_starts_at?->toIso8601String(),
                    'window_ends_at' => $auth?->window_ends_at?->toIso8601String(),
                    'updated_by' => $auth?->updatedBy?->name,
                    'person_count' => $totalCounts->get($m->id, 0),
                    'returned_count' => $returnedCounts->get($m->id, 0),
                ];
            }),
        ]);
    }

    #[OA\Put(
        path: '/api/events/{event}/repatriation-authorizations',
        summary: 'Egy település visszatelepítési engedélyezési státuszának rögzítése/frissítése',
        description: 'Csak admin és vezető szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Repatriation'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['municipality_id', 'status'],
                properties: [
                    new OA\Property(property: 'municipality_id', type: 'integer'),
                    new OA\Property(property: 'status', type: 'string', enum: ['not_permitted', 'conditional', 'permitted']),
                    new OA\Property(property: 'conditions_note', type: 'string', nullable: true),
                    new OA\Property(property: 'window_starts_at', type: 'string', format: 'date-time', nullable: true),
                    new OA\Property(property: 'window_ends_at', type: 'string', format: 'date-time', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Frissített engedélyezési státusz'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function upsert(Request $request, EvacuationEvent $event)
    {
        if (! $request->user()->hasRole(RoleCode::Admin, RoleCode::Manager)) {
            throw new AuthorizationException('Nincs jogosultsága a visszatelepítési státusz módosításához.');
        }

        $data = $request->validate([
            'municipality_id' => ['required', 'integer', 'exists:municipalities,id'],
            'status' => ['required', 'string', 'in:not_permitted,conditional,permitted'],
            'conditions_note' => ['nullable', 'string', 'max:1000'],
            'window_starts_at' => ['nullable', 'date'],
            'window_ends_at' => ['nullable', 'date'],
        ]);

        $authorization = RepatriationAuthorization::updateOrCreate(
            ['event_id' => $event->id, 'municipality_id' => $data['municipality_id']],
            [
                'status' => $data['status'],
                'conditions_note' => $data['conditions_note'] ?? null,
                'window_starts_at' => $data['window_starts_at'] ?? null,
                'window_ends_at' => $data['window_ends_at'] ?? null,
                'updated_by' => $request->user()->id,
            ]
        );

        return response()->json([
            'data' => [
                'municipality_id' => $authorization->municipality_id,
                'status' => $authorization->status->value,
                'conditions_note' => $authorization->conditions_note,
                'window_starts_at' => $authorization->window_starts_at?->toIso8601String(),
                'window_ends_at' => $authorization->window_ends_at?->toIso8601String(),
            ],
        ]);
    }
}
