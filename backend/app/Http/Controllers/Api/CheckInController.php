<?php

namespace App\Http\Controllers\Api;

use App\Actions\Shelters\CheckInPersonAction;
use App\Actions\Shelters\TransferPersonAction;
use App\Enums\RoleCode;
use App\Exceptions\AlreadyCheckedInException;
use App\Exceptions\ShelterFullException;
use App\Http\Controllers\Controller;
use App\Http\Requests\CheckInRequest;
use App\Http\Resources\CheckInResource;
use App\Models\CheckIn;
use App\Models\EvacuationEvent;
use App\Models\Person;
use App\Models\Shelter;
use App\Services\QrTokenService;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class CheckInController extends Controller
{
    #[OA\Post(
        path: '/api/shelters/{shelter}/checkins',
        summary: 'Személy érkeztetése egy befogadóhelyre (QR-kód vagy azonosító alapján)',
        description: 'Tranzakciós művelet: kapacitás-ellenőrzés, checkin rögzítés, regisztráció-státusz és kapacitás frissítése, audit napló.',
        security: [['sanctumSession' => []]],
        tags: ['CheckIns'],
        parameters: [
            new OA\Parameter(name: 'shelter', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['event_id'],
                properties: [
                    new OA\Property(property: 'event_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'public_id', type: 'string', description: 'QR-token azonosítója (vagy person_id adható meg helyette)'),
                    new OA\Property(property: 'person_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'override_capacity', type: 'boolean', description: 'Csak admin/vezető szerepkörnél hatásos'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Sikeres érkeztetés'),
            new OA\Response(response: 403, description: 'EVENT_MISMATCH — az esemény nem aktív vagy a kód más eseményhez tartozik'),
            new OA\Response(response: 404, description: 'QR_TOKEN_NOT_FOUND — a kód vagy a személy nem található'),
            new OA\Response(response: 409, description: 'ALREADY_CHECKED_IN vagy SHELTER_FULL'),
        ]
    )]
    public function store(CheckInRequest $request, Shelter $shelter, CheckInPersonAction $action, QrTokenService $qrTokenService)
    {
        $event = EvacuationEvent::findOrFail($request->validated('event_id'));

        if (! $event->isActive()) {
            return response()->json([
                'message' => 'Az esemény nem aktív.',
                'code' => 'EVENT_MISMATCH',
            ], 403);
        }

        if ($request->filled('public_id')) {
            $token = $qrTokenService->resolve($request->validated('public_id'));

            if (! $token) {
                return response()->json(['message' => 'A kód nem található vagy hibás.', 'code' => 'QR_TOKEN_NOT_FOUND'], 404);
            }

            if (! $token->isActive()) {
                return response()->json(['message' => 'A kód már nem érvényes.', 'code' => 'QR_TOKEN_INVALID'], 409);
            }

            if ($token->event_id !== $event->id) {
                return response()->json(['message' => 'A kód nem ehhez az eseményhez tartozik.', 'code' => 'EVENT_MISMATCH'], 403);
            }

            $person = $token->person ?? $token->family?->primaryContact;
        } else {
            $person = Person::findOrFail($request->validated('person_id'));
        }

        if (! $person) {
            return response()->json(['message' => 'A kódhoz nem tartozik személy.', 'code' => 'QR_TOKEN_NOT_FOUND'], 404);
        }

        $overrideCapacity = (bool) $request->boolean('override_capacity')
            && $request->user()->hasRole(RoleCode::Admin, RoleCode::Manager);

        try {
            $checkIn = $action->execute($event, $person, $shelter, $request->user(), $overrideCapacity);
        } catch (AlreadyCheckedInException $e) {
            return response()->json(['message' => $e->getMessage(), 'code' => 'ALREADY_CHECKED_IN'], 409);
        } catch (ShelterFullException $e) {
            return response()->json(['message' => $e->getMessage(), 'code' => 'SHELTER_FULL'], 409);
        }

        return (new CheckInResource($checkIn->load(['person', 'shelter', 'checkedInBy'])))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Post(
        path: '/api/persons/{person}/transfer',
        summary: 'Személy áthelyezése másik befogadóhelyre',
        description: 'A régi befogadóhely kapacitása felszabadul, az újé lefoglalódik. Admin/vezető korlátlanul, '.
            'befogadóhelyi kezelő csak a saját befogadóhelyére fogadhat át.',
        security: [['sanctumSession' => []]],
        tags: ['CheckIns'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['shelter_id'],
                properties: [
                    new OA\Property(property: 'shelter_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'override_capacity', type: 'boolean'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Sikeres áthelyezés'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 409, description: 'SHELTER_FULL'),
            new OA\Response(response: 422, description: 'A személy nincs befogadóhelyen, vagy már ott van'),
        ]
    )]
    public function transfer(Request $request, Person $person, TransferPersonAction $action)
    {
        $data = $request->validate([
            'shelter_id' => ['required', 'uuid', 'exists:shelters,id'],
            'override_capacity' => ['nullable', 'boolean'],
        ]);

        $newShelter = Shelter::findOrFail($data['shelter_id']);

        $this->authorize('checkIn', $newShelter);

        $overrideCapacity = $request->boolean('override_capacity') && $request->user()->hasRole(RoleCode::Admin, RoleCode::Manager);

        try {
            $checkIn = $action->execute($person, $newShelter, $request->user(), $overrideCapacity);
        } catch (ShelterFullException $e) {
            return response()->json(['message' => $e->getMessage(), 'code' => 'SHELTER_FULL'], 409);
        }

        return (new CheckInResource($checkIn->load(['person', 'shelter', 'checkedInBy'])))
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Post(
        path: '/api/persons/{person}/temporary-leave',
        summary: 'Ideiglenes eltávozás rögzítése a befogadóhelyről',
        security: [['sanctumSession' => []]],
        tags: ['CheckIns'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Ideiglenes eltávozás rögzítve'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 422, description: 'A személy nincs befogadóhelyen'),
        ]
    )]
    public function temporaryLeave(Person $person)
    {
        $checkIn = $this->currentCheckInOrFail($person);
        $this->authorize('checkIn', $checkIn->shelter);

        $checkIn->update(['temporary_leave_at' => now(), 'temporary_return_at' => null]);

        return new CheckInResource($checkIn->fresh(['person', 'shelter', 'checkedInBy']));
    }

    #[OA\Post(
        path: '/api/persons/{person}/temporary-return',
        summary: 'Ideiglenes eltávozásból való visszaérkezés rögzítése',
        security: [['sanctumSession' => []]],
        tags: ['CheckIns'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Visszaérkezés rögzítve'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 422, description: 'A személy nincs befogadóhelyen'),
        ]
    )]
    public function temporaryReturn(Person $person)
    {
        $checkIn = $this->currentCheckInOrFail($person);
        $this->authorize('checkIn', $checkIn->shelter);

        $checkIn->update(['temporary_return_at' => now()]);

        return new CheckInResource($checkIn->fresh(['person', 'shelter', 'checkedInBy']));
    }

    private function currentCheckInOrFail(Person $person): CheckIn
    {
        $checkIn = CheckIn::where('person_id', $person->id)
            ->where('event_id', $person->event_id)
            ->latest('checked_in_at')
            ->first();

        if (! $checkIn) {
            abort(422, 'A személy jelenleg nincs befogadóhelyen.');
        }

        return $checkIn;
    }
}
