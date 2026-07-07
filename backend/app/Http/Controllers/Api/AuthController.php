<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
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
    public function login(LoginRequest $request, AuditService $auditService)
    {
        $credentials = $request->validated();

        if (! Auth::attempt($credentials, remember: false)) {
            $attemptedUser = User::where('email', $credentials['email'])->first();

            AuditLog::create([
                'user_id' => $attemptedUser?->id,
                'action' => 'login_failed',
                'entity_type' => 'User',
                'entity_id' => $attemptedUser ? (string) $attemptedUser->id : $credentials['email'],
                'before_json' => null,
                'after_json' => ['email' => $credentials['email']],
                'significant' => true,
            ]);

            throw ValidationException::withMessages([
                'email' => 'A megadott hitelesítő adatok nem egyeznek a nyilvántartással.',
            ]);
        }

        $request->session()->regenerate();

        $user = $request->user();
        $auditService->log('login', $user, $user, null, null);

        return new UserResource($user->load(['role', 'shelter']));
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
    public function logout(Request $request, AuditService $auditService)
    {
        $user = $request->user();

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($user) {
            $auditService->log('logout', $user, $user, null, null);
        }

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

    #[OA\Put(
        path: '/api/me',
        summary: 'Saját profil szerkesztése (név, e-mail, jelszó)',
        description: 'E-mail vagy jelszó módosításához a jelenlegi jelszó megadása is szükséges.',
        security: [['sanctumSession' => []]],
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', nullable: true),
                    new OA\Property(property: 'current_password', type: 'string', format: 'password', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Frissített felhasználó'),
            new OA\Response(response: 422, description: 'Validációs hiba vagy hibás jelenlegi jelszó'),
        ]
    )]
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', Password::min(8)],
            'current_password' => ['nullable', 'string'],
        ]);

        if (isset($data['email']) || ! empty($data['password'])) {
            if (! Hash::check($data['current_password'] ?? '', $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => 'A jelenlegi jelszó nem megfelelő.',
                ]);
            }
        }

        $update = array_filter([
            'name' => $data['name'] ?? null,
            'email' => $data['email'] ?? null,
        ], fn ($v) => $v !== null);

        if (! empty($data['password'])) {
            $update['password'] = bcrypt($data['password']);
        }

        $user->update($update);

        return new UserResource($user->fresh(['role', 'shelter']));
    }
}
