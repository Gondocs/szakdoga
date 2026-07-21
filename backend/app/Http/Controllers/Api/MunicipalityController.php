<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Municipality;
use App\Models\Person;
use App\Models\Shelter;
use App\Services\AuditService;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class MunicipalityController extends Controller
{
    #[OA\Get(
        path: '/api/municipalities',
        summary: 'Település törzsadatok listája',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        responses: [
            new OA\Response(response: 200, description: 'Települések listája'),
        ]
    )]
    public function index()
    {
        return response()->json([
            'data' => Municipality::orderBy('name')->get(['id', 'name', 'county', 'postal_code', 'lat', 'lng']),
        ]);
    }

    #[OA\Post(
        path: '/api/municipalities',
        summary: 'Új település törzsadat felvétele',
        description: 'Csak admin és vezető szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'county'],
                properties: [
                    new OA\Property(property: 'name', type: 'string', example: 'Győr'),
                    new OA\Property(property: 'county', type: 'string', example: 'Győr-Moson-Sopron'),
                    new OA\Property(property: 'postal_code', type: 'string', nullable: true),
                    new OA\Property(property: 'lat', type: 'number', format: 'float', nullable: true),
                    new OA\Property(property: 'lng', type: 'number', format: 'float', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott település'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function store(Request $request, AuditService $auditService)
    {
        $this->authorize('create', Municipality::class);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'county' => ['required', 'string', 'max:150'],
            'postal_code' => ['nullable', 'string', 'max:10'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $municipality = Municipality::create($data);

        $auditService->log('create', $municipality, $request->user(), null, $municipality->toArray());

        return response()->json(['data' => $municipality], 201);
    }

    #[OA\Put(
        path: '/api/municipalities/{municipality}',
        summary: 'Település törzsadat módosítása',
        description: 'Csak admin és vezető szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'municipality', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Frissített település'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function update(Request $request, Municipality $municipality, AuditService $auditService)
    {
        $this->authorize('update', Municipality::class);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'county' => ['sometimes', 'required', 'string', 'max:150'],
            'postal_code' => ['nullable', 'string', 'max:10'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $before = $municipality->toArray();
        $municipality->update($data);

        $auditService->log('update', $municipality, $request->user(), $before, $municipality->fresh()->toArray());

        return response()->json(['data' => $municipality->fresh()]);
    }

    #[OA\Delete(
        path: '/api/municipalities/{municipality}',
        summary: 'Település törzsadat törlése',
        description: 'Csak admin jogosult, és csak akkor, ha nincs hozzá kapcsolódó személy vagy befogadóhely.',
        security: [['sanctumSession' => []]],
        tags: ['Persons'],
        parameters: [
            new OA\Parameter(name: 'municipality', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 204, description: 'Sikeres törlés'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 409, description: 'A település használatban van'),
        ]
    )]
    public function destroy(Municipality $municipality, AuditService $auditService)
    {
        $this->authorize('delete', Municipality::class);

        if (Person::where('municipality_id', $municipality->id)->exists() || Shelter::where('municipality_id', $municipality->id)->exists()) {
            return response()->json([
                'message' => 'A település nem törölhető, mert személyek vagy befogadóhelyek hivatkoznak rá.',
                'code' => 'MUNICIPALITY_IN_USE',
            ], 409);
        }

        $before = $municipality->toArray();
        $municipality->delete();

        $auditService->log('delete', $municipality, request()->user(), $before, null);

        return response()->noContent();
    }
}
