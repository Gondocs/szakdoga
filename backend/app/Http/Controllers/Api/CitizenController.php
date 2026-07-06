<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Citizen;
use OpenApi\Attributes as OA;

/**
 * Eseményfüggetlen polgár törzsadat lekérdezése: egy adott személy összes
 * korábbi és jelenlegi kitelepítési eseményhez tartozó regisztrációja,
 * az okmányszám alapján összekapcsolva (lásd citizens tábla és
 * CreateRegistrationAction::resolveCitizen).
 */
class CitizenController extends Controller
{
    #[OA\Get(
        path: '/api/citizens/{citizen}/history',
        summary: 'Egy polgár összes kitelepítési eseményhez tartozó regisztrációjának története',
        security: [['sanctumSession' => []]],
        tags: ['Citizens'],
        parameters: [
            new OA\Parameter(name: 'citizen', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'A polgár kitelepítési története eseményenként'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function history(Citizen $citizen)
    {
        $this->authorize('view', $citizen);

        $citizen->load(['persons' => fn ($q) => $q->with(['event', 'registration'])->orderByDesc('created_at')]);

        return response()->json([
            'data' => [
                'citizen' => [
                    'id' => $citizen->id,
                    'full_name' => $citizen->fullName(),
                    'id_document_number' => $citizen->id_document_number,
                ],
                'registrations' => $citizen->persons->map(fn ($person) => [
                    'person_id' => $person->id,
                    'event' => [
                        'id' => $person->event->id,
                        'code' => $person->event->code,
                        'name' => $person->event->name,
                        'status' => $person->event->status->value,
                    ],
                    'registration_status' => $person->registration?->status?->value,
                    'channel' => $person->registration?->channel?->value,
                    'registered_at' => $person->registration?->registered_at?->toIso8601String(),
                ]),
            ],
        ]);
    }
}
