<?php

namespace App\Http\Controllers\Api;

use App\Actions\Qr\IssueQrTokenAction;
use App\Actions\Registrations\CreateRegistrationAction;
use App\Actions\Registrations\UpdateRegistrationStatusAction;
use App\Enums\RegistrationChannel;
use App\Enums\RegistrationStatus;
use App\Enums\RepatriationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\SelfProfileUpdateRequest;
use App\Http\Requests\SelfRegisterRequest;
use App\Http\Resources\PersonResource;
use App\Models\EvacuationEvent;
use App\Models\RepatriationAuthorization;
use App\Models\SpecialNeed;
use App\Models\User;
use App\Services\AuditService;
use App\Services\QrTokenService;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

/**
 * Bejelentkezés nélkül elérhető, lakossági önkiszolgáló előregisztrációs
 * végpontok, az Interreg tanulmány "1. fázis: előzetes kódgenerálás és
 * kézbesítés" koncepciója alapján. A lakos még a helyszíni megjelenés előtt
 * rögzítheti saját adatait, és azonnal kap egy letölthető/kinyomtatható
 * QR-azonosítót, amit a befogadóhelyen majd csak be kell olvasni.
 */
class SelfServiceController extends Controller
{
    #[OA\Get(
        path: '/api/public/events/{code}',
        summary: 'Aktív esemény alapadatainak lekérdezése kóddal (önkiszolgáló regisztrációs oldalhoz)',
        tags: ['SelfService'],
        parameters: [
            new OA\Parameter(name: 'code', in: 'path', required: true, schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Az esemény alapadatai, ha aktív'),
            new OA\Response(response: 404, description: 'Nincs ilyen kódú aktív esemény'),
        ]
    )]
    public function showEvent(string $code)
    {
        $event = EvacuationEvent::where('code', $code)->first();

        if (! $event || ! $event->isActive()) {
            return response()->json([
                'message' => 'Nincs ilyen kódú, jelenleg aktív kitelepítési esemény.',
                'code' => 'EVENT_NOT_FOUND',
            ], 404);
        }

        return response()->json([
            'data' => [
                'id' => $event->id,
                'code' => $event->code,
                'name' => $event->name,
                'status' => $event->status->value,
            ],
        ]);
    }

    #[OA\Post(
        path: '/api/public/events/{code}/self-register',
        summary: 'Lakossági önkiszolgáló előregisztráció és azonnali QR-kód kiadás',
        description: 'Hitelesítés nélkül hívható. Csak aktív eseményhez engedélyezett. A rögzítés self_service '.
            'csatornaként kerül naplózásra, a végrehajtó egy szintetikus rendszerfelhasználó.',
        tags: ['SelfService'],
        parameters: [
            new OA\Parameter(name: 'code', in: 'path', required: true, schema: new OA\Schema(type: 'string')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['last_name', 'first_name', 'municipality_id'],
                properties: [
                    new OA\Property(property: 'last_name', type: 'string'),
                    new OA\Property(property: 'first_name', type: 'string'),
                    new OA\Property(property: 'municipality_id', type: 'integer'),
                    new OA\Property(property: 'gender', type: 'string', enum: ['male', 'female', 'other']),
                    new OA\Property(property: 'id_document_number', type: 'string'),
                    new OA\Property(property: 'phone', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'A generált QR-token public_id-je és a rögzített adatok'),
            new OA\Response(response: 404, description: 'Nincs ilyen kódú aktív esemény'),
            new OA\Response(response: 422, description: 'Validációs hiba'),
        ]
    )]
    public function selfRegister(SelfRegisterRequest $request, string $code, CreateRegistrationAction $createAction, IssueQrTokenAction $issueQrAction)
    {
        $event = EvacuationEvent::where('code', $code)->first();

        if (! $event || ! $event->isActive()) {
            return response()->json([
                'message' => 'Nincs ilyen kódú, jelenleg aktív kitelepítési esemény.',
                'code' => 'EVENT_NOT_FOUND',
            ], 404);
        }

        [$person, $qrToken] = DB::transaction(function () use ($event, $request, $createAction, $issueQrAction) {
            $system = User::system();

            $person = $createAction->execute($event, $request->validated(), $system, RegistrationChannel::SelfService);
            $qrToken = $issueQrAction->execute($person, $system);

            return [$person, $qrToken];
        });

        return response()->json([
            'data' => [
                'person_id' => $person->id,
                'full_name' => $person->fullName(),
                'public_id' => $qrToken->public_id,
            ],
        ], 201);
    }

    #[OA\Get(
        path: '/api/public/self-profile/{publicId}',
        summary: 'A lakos saját adatainak lekérdezése a QR-kódja (public_id) alapján',
        description: 'Hitelesítés nélkül hívható. Interreg tanulmány "Folyamatos Adatfrissítési Kapcsolat" '.
            'funkciója: a lakos a visszatelepítésig bármikor megtekintheti és frissítheti az elérhetőségét.',
        tags: ['SelfService'],
        parameters: [
            new OA\Parameter(name: 'publicId', in: 'path', required: true, schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'A személy adatai'),
            new OA\Response(response: 404, description: 'A kód nem található'),
            new OA\Response(response: 409, description: 'A kód lejárt/visszavont, vagy a regisztráció már lezárult'),
        ]
    )]
    public function showProfile(string $publicId, QrTokenService $qrTokenService)
    {
        $person = $this->resolveEditablePerson($publicId, $qrTokenService);

        if ($person instanceof \Illuminate\Http\JsonResponse) {
            return $person;
        }

        return new PersonResource($person->load(['municipality', 'registration', 'specialNeeds']), bypassMasking: true);
    }

    #[OA\Put(
        path: '/api/public/self-profile/{publicId}',
        summary: 'A lakos saját adatainak frissítése a QR-kódja (public_id) alapján',
        description: 'Hitelesítés nélkül hívható. Csak az elérhetőség, ideiglenes cím és egyedi igények '.
            'módosíthatók; a személyazonosító adatokat a helyszíni regisztrátor kezeli.',
        tags: ['SelfService'],
        parameters: [
            new OA\Parameter(name: 'publicId', in: 'path', required: true, schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Frissített adatok'),
            new OA\Response(response: 404, description: 'A kód nem található'),
            new OA\Response(response: 409, description: 'A kód lejárt/visszavont, vagy a regisztráció már lezárult'),
            new OA\Response(response: 422, description: 'Validációs hiba'),
        ]
    )]
    public function updateProfile(
        SelfProfileUpdateRequest $request,
        string $publicId,
        QrTokenService $qrTokenService,
        AuditService $auditService
    ) {
        $person = $this->resolveEditablePerson($publicId, $qrTokenService);

        if ($person instanceof \Illuminate\Http\JsonResponse) {
            return $person;
        }

        $before = $person->toArray();
        $system = User::system();

        DB::transaction(function () use ($person, $request, $system) {
            $person->update([
                ...$request->safe()->only([
                    'address_postal_code', 'address_settlement', 'address_street', 'address_house_number',
                    'phone', 'email',
                ]),
                'updated_by' => $system->id,
            ]);

            if ($person->registration) {
                $person->registration->update([
                    ...$request->safe()->only(['central_transport_required', 'central_accommodation_required']),
                ]);
            }

            if ($request->has('special_needs')) {
                $person->specialNeeds()->delete();
                foreach ($request->input('special_needs', []) as $need) {
                    SpecialNeed::create([
                        'person_id' => $person->id,
                        'category' => $need['category'],
                        'type' => $need['type'] ?? null,
                        'priority' => $need['priority'] ?? 1,
                        'description' => $need['description'] ?? null,
                    ]);
                }
            }
        });

        $person = $person->fresh(['municipality', 'registration', 'specialNeeds']);

        $auditService->log('self_update', $person, $system, $before, $person->toArray());

        return new PersonResource($person, bypassMasking: true);
    }

    #[OA\Post(
        path: '/api/public/self-profile/{publicId}/confirm-arrival',
        summary: 'Saját járművel utazó lakos aktív megérkezés-megerősítése',
        description: 'Hitelesítés nélkül hívható. Interreg tanulmány "Saját Járművel Utazók Kezelése" '.
            'funkciója: csak akkor engedélyezett, ha a regisztrációban jelezte, hogy saját járművel utazik.',
        tags: ['SelfService'],
        parameters: [
            new OA\Parameter(name: 'publicId', in: 'path', required: true, schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Megérkezés rögzítve'),
            new OA\Response(response: 404, description: 'A kód nem található'),
            new OA\Response(response: 409, description: 'A kód lejárt/visszavont, vagy a regisztráció már lezárult'),
            new OA\Response(response: 422, description: 'A személy nem saját járművel utazik'),
        ]
    )]
    public function confirmArrival(string $publicId, QrTokenService $qrTokenService, AuditService $auditService)
    {
        $person = $this->resolveEditablePerson($publicId, $qrTokenService);

        if ($person instanceof \Illuminate\Http\JsonResponse) {
            return $person;
        }

        if (! $person->registration->own_vehicle) {
            return response()->json([
                'message' => 'A megérkezés-megerősítés csak saját járművel utazó személyeknél alkalmazható.',
                'code' => 'NOT_OWN_VEHICLE',
            ], 422);
        }

        $before = $person->registration->toArray();
        $system = User::system();

        $person->registration->update(['self_arrival_confirmed_at' => now()]);

        $auditService->log('self_arrival_confirmed', $person->registration, $system, $before, $person->registration->fresh()->toArray());

        return new PersonResource($person->fresh(['municipality', 'registration', 'specialNeeds']), bypassMasking: true);
    }

    #[OA\Post(
        path: '/api/public/self-profile/{publicId}/confirm-return',
        summary: 'Visszatelepülés önkéntes megerősítése QR-kóddal',
        description: 'Hitelesítés nélkül hívható. Interreg tanulmány "Visszatelepítési modul" funkciója: csak akkor '.
            'engedélyezett, ha a lakóhely települése az esemény alatt engedélyezett vagy feltételes visszatelepítési '.
            'státuszban van.',
        tags: ['SelfService'],
        parameters: [
            new OA\Parameter(name: 'publicId', in: 'path', required: true, schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Visszatelepülés rögzítve'),
            new OA\Response(response: 404, description: 'A kód nem található'),
            new OA\Response(response: 409, description: 'A kód lejárt/visszavont, vagy a regisztráció már lezárult'),
            new OA\Response(response: 422, description: 'A település visszatelepítése még nem engedélyezett'),
        ]
    )]
    public function confirmReturn(
        string $publicId,
        QrTokenService $qrTokenService,
        UpdateRegistrationStatusAction $statusAction,
        AuditService $auditService
    ) {
        $person = $this->resolveEditablePerson($publicId, $qrTokenService);

        if ($person instanceof \Illuminate\Http\JsonResponse) {
            return $person;
        }

        $authorization = RepatriationAuthorization::where('event_id', $person->event_id)
            ->where('municipality_id', $person->municipality_id)
            ->first();

        $authorized = $authorization && in_array($authorization->status, [RepatriationStatus::Permitted, RepatriationStatus::Conditional], true);

        if (! $authorized) {
            return response()->json([
                'message' => 'A lakóhelye települése számára a visszatelepítés még nincs engedélyezve.',
                'code' => 'REPATRIATION_NOT_AUTHORIZED',
            ], 422);
        }

        $system = User::system();
        $statusAction->execute($person->registration, RegistrationStatus::ReturnedHome, $system);

        $auditService->log('self_return_confirmed', $person->registration, $system, null, ['status' => RegistrationStatus::ReturnedHome->value]);

        return new PersonResource($person->fresh(['municipality', 'registration', 'specialNeeds']), bypassMasking: true);
    }

    private function resolveEditablePerson(string $publicId, QrTokenService $qrTokenService)
    {
        $token = $qrTokenService->resolve($publicId);

        if (! $token) {
            return response()->json([
                'message' => 'A kód nem található vagy hibás.',
                'code' => 'QR_TOKEN_NOT_FOUND',
            ], 404);
        }

        if (! $token->isActive()) {
            return response()->json([
                'message' => 'A kód már nem érvényes.',
                'code' => 'QR_TOKEN_INVALID',
            ], 409);
        }

        $person = $token->person ?? $token->family?->primaryContact;

        if (! $person) {
            return response()->json([
                'message' => 'A kódhoz nem tartozik személy.',
                'code' => 'QR_TOKEN_NOT_FOUND',
            ], 404);
        }

        $person->load('registration');

        if (! $person->registration || in_array($person->registration->status, [RegistrationStatus::ReturnedHome, RegistrationStatus::Cancelled], true)) {
            return response()->json([
                'message' => 'A regisztráció már lezárult, az adatok módosítása nem lehetséges.',
                'code' => 'SELF_PROFILE_LOCKED',
            ], 409);
        }

        return $person;
    }
}
