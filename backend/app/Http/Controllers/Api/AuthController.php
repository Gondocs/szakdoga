<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class AuthController extends Controller
{
    #[OA\Post(
        path: '/api/login',
        summary: 'Bejelentkezés (Sanctum SPA session)',
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'admin@katasztrofavedelem.test'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Sikeres bejelentkezés',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'data', properties: [
                            new OA\Property(property: 'id', type: 'integer', example: 1),
                            new OA\Property(property: 'name', type: 'string', example: 'Admin Felhasználó'),
                            new OA\Property(property: 'email', type: 'string', example: 'admin@katasztrofavedelem.test'),
                            new OA\Property(property: 'role', properties: [
                                new OA\Property(property: 'code', type: 'string', example: 'admin'),
                                new OA\Property(property: 'name', type: 'string', example: 'Rendszergazda'),
                            ], type: 'object'),
                        ], type: 'object'),
                    ]
                )
            ),
            new OA\Response(response: 422, description: 'Hibás e-mail vagy jelszó'),
        ]
    )]
    public function login(LoginRequest $request)
    {
        $credentials = $request->validated();

        if (! Auth::attempt($credentials, remember: false)) {
            throw ValidationException::withMessages([
                'email' => 'A megadott hitelesítő adatok nem egyeznek a nyilvántartással.',
            ]);
        }

        $request->session()->regenerate();

        return new UserResource($request->user()->load(['role', 'shelter']));
    }

    #[OA\Post(
        path: '/api/logout',
        summary: 'Kijelentkezés',
        security: [['sanctumSession' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 204, description: 'Sikeres kijelentkezés'),
            new OA\Response(response: 401, description: 'Nincs bejelentkezve'),
        ]
    )]
    public function logout(Request $request)
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    #[OA\Get(
        path: '/api/me',
        summary: 'Aktuális bejelentkezett felhasználó és jogosultsága',
        security: [['sanctumSession' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Aktuális felhasználó adatai'),
            new OA\Response(response: 401, description: 'Nincs bejelentkezve'),
        ]
    )]
    public function me(Request $request)
    {
        return new UserResource($request->user()->load(['role', 'shelter']));
    }
}
