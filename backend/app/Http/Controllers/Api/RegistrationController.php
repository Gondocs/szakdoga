<?php

namespace App\Http\Controllers\Api;

use App\Actions\Registrations\UpdateRegistrationStatusAction;
use App\Enums\RegistrationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateRegistrationStatusRequest;
use App\Models\EvacuationEvent;
use App\Models\Registration;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class RegistrationController extends Controller
{
    #[OA\Put(
        path: '/api/registrations/{registration}/status',
        summary: 'Regisztráció státuszának kézi módosítása',
        description: 'A checkin-folyamaton kívüli manuális státuszváltás (pl. szállítás alatt, visszatelepült, törölt). '.
            'Admin, vezető vagy regisztrátor szerepkör szükséges.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'registration', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['status'],
                properties: [
                    new OA\Property(property: 'status', type: 'string', enum: [
                        'registered', 'in_transport', 'arrived_shelter', 'left_shelter', 'returned_home', 'cancelled',
                    ]),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Frissített regisztráció'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function updateStatus(UpdateRegistrationStatusRequest $request, Registration $registration, UpdateRegistrationStatusAction $action)
    {
        $registration = $action->execute(
            $registration,
            RegistrationStatus::from($request->validated('status')),
            $request->user(),
        );

        return response()->json([
            'data' => [
                'id' => $registration->id,
                'status' => $registration->status->value,
            ],
        ]);
    }

    #[OA\Put(
        path: '/api/events/{event}/registrations/bulk-status',
        summary: 'Több személy regisztrációs státuszának egyszerre történő módosítása',
        description: 'Tömeges művelet (pl. egy csoport visszatelepítése). Admin, vezető vagy regisztrátor szerepkör szükséges. '.
            'Az egyes személyeknél fellépő hibák nem szakítják meg a többi feldolgozását.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'event', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['person_ids', 'status'],
                properties: [
                    new OA\Property(property: 'person_ids', type: 'array', items: new OA\Items(type: 'string', format: 'uuid')),
                    new OA\Property(property: 'status', type: 'string', enum: [
                        'registered', 'in_transport', 'arrived_shelter', 'left_shelter', 'returned_home', 'cancelled',
                    ]),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'A sikeresen és a sikertelenül frissített személyek azonosítói'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 422, description: 'Validációs hiba'),
        ]
    )]
    public function bulkUpdateStatus(Request $request, EvacuationEvent $event, UpdateRegistrationStatusAction $action)
    {
        $this->authorize('bulkUpdateStatus', Registration::class);

        $data = $request->validate([
            'person_ids' => ['required', 'array', 'min:1'],
            'person_ids.*' => ['string'],
            'status' => ['required', 'in:registered,in_transport,arrived_shelter,left_shelter,returned_home,cancelled'],
        ]);

        $status = RegistrationStatus::from($data['status']);

        $registrations = Registration::where('event_id', $event->id)
            ->whereIn('person_id', $data['person_ids'])
            ->get();

        $updated = [];
        $failed = [];

        // Regisztrációnként külön-külön hívjuk a státuszváltó Action-t, hogy
        // egy hibás/érvénytelen átmenet ne akassza meg a teljes tömeges
        // műveletet — a sikertelen elemeket külön gyűjtjük össze
        foreach ($registrations as $registration) {
            try {
                $action->execute($registration, $status, $request->user());
                $updated[] = $registration->person_id;
            } catch (\Throwable) {
                $failed[] = $registration->person_id;
            }
        }

        return response()->json([
            'data' => [
                'updated' => $updated,
                'failed' => $failed,
            ],
        ]);
    }
}
