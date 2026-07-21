<?php

namespace App\Http\Controllers\Api;

use App\Actions\Qr\IssueQrTokenAction;
use App\Enums\RoleCode;
use App\Http\Controllers\Controller;
use App\Http\Requests\ResolveQrRequest;
use App\Http\Resources\PersonResource;
use App\Http\Resources\QrTokenResource;
use App\Models\Person;
use App\Models\QrToken;
use App\Services\AuditService;
use App\Services\QrTokenService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class QrController extends Controller
{
    #[OA\Post(
        path: '/api/persons/{person}/qr',
        summary: 'QR-token generálása egy regisztrált személyhez',
        description: 'Csak aktív eseményhez és aktív regisztrációhoz generálható. Egy már meglévő aktív token visszavonásra kerül. '.
            'A "reason":"lost" paraméterrel az elveszett kód bejelentése és pótlása külön, kiemelt naplóbejegyzésként rögzül.',
        security: [['sanctumSession' => []]],
        tags: ['Qr'],
        parameters: [
            new OA\Parameter(name: 'person', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\JsonContent(properties: [
                new OA\Property(property: 'reason', type: 'string', nullable: true, enum: ['lost'], description: 'Elveszett kód bejelentése esetén: "lost"'),
            ])
        ),
        responses: [
            new OA\Response(
                response: 201,
                description: 'Létrehozott QR-token',
                content: new OA\JsonContent(properties: [
                    new OA\Property(property: 'data', properties: [
                        new OA\Property(property: 'id', type: 'integer'),
                        new OA\Property(property: 'public_id', type: 'string', example: 'a1b2c3d4e5f6...'),
                        new OA\Property(property: 'status', type: 'string', example: 'active'),
                    ], type: 'object'),
                ])
            ),
            new OA\Response(response: 422, description: 'Nem aktív esemény vagy regisztráció'),
        ]
    )]
    public function issue(Request $request, Person $person, IssueQrTokenAction $action)
    {
        $this->authorize('issueQr', $person);

        $reason = $request->string('reason')->value() ?: null;
        $token = $action->execute($person, $request->user(), $reason);

        return (new QrTokenResource($token))->response()->setStatusCode(201);
    }

    #[OA\Post(
        path: '/api/qr/resolve',
        summary: 'QR azonosító feloldása befogadóhelyi/adminisztrátori előnézethez',
        description: 'A public_id alapján visszaadja a minimálisan szükséges személyadatokat érkeztetés előtti megerősítéshez.',
        security: [['sanctumSession' => []]],
        tags: ['Qr'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['public_id'],
                properties: [new OA\Property(property: 'public_id', type: 'string')]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Feloldott személy adatai'),
            new OA\Response(response: 404, description: 'QR_TOKEN_NOT_FOUND — a kód nem található'),
            new OA\Response(response: 409, description: 'QR_TOKEN_INVALID — a kód lejárt vagy visszavont'),
        ]
    )]
    public function resolve(ResolveQrRequest $request, QrTokenService $qrTokenService)
    {
        $token = $qrTokenService->resolve($request->validated('public_id'));

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

        $person->load(['municipality', 'family.members', 'registration', 'specialNeeds']);

        return new PersonResource($person);
    }

    #[OA\Post(
        path: '/api/qr-tokens/{qrToken}/deliver',
        summary: 'QR-kód kiosztásának rögzítése (kiosztási nyilvántartás)',
        description: 'Interreg tanulmány "Kiosztási nyilvántartás" követelménye: rögzíti, hogy a kódot mikor, '.
            'milyen formában (digitális, kártya, karszalag, nyomtatott) adták át az érintettnek.',
        security: [['sanctumSession' => []]],
        tags: ['Qr'],
        parameters: [
            new OA\Parameter(name: 'qrToken', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['delivery_method'],
                properties: [
                    new OA\Property(property: 'delivery_method', type: 'string', enum: ['digital', 'card', 'wristband', 'paper']),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Frissített QR-token, benne a kiosztás adataival'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function deliver(Request $request, QrToken $qrToken, AuditService $auditService)
    {
        if (! $request->user()->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar)) {
            throw new AuthorizationException('Nincs jogosultsága a kiosztás rögzítéséhez.');
        }

        $data = $request->validate([
            'delivery_method' => ['required', 'string', 'in:digital,card,wristband,paper'],
        ]);

        $before = $qrToken->toArray();

        $qrToken->update([
            'delivery_method' => $data['delivery_method'],
            'delivered_at' => now(),
            'delivered_by' => $request->user()->id,
        ]);

        $auditService->log('qr_deliver', $qrToken, $request->user(), $before, $qrToken->fresh()->toArray());

        return new QrTokenResource($qrToken->fresh());
    }
}
