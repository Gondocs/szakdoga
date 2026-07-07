<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use OpenApi\Attributes as OA;

class UserController extends Controller
{
    #[OA\Get(
        path: '/api/users',
        summary: 'Rendszerfelhasználók listája',
        description: 'Csak admin szerepkör jogosult.',
        security: [['sanctumSession' => []]],
        tags: ['Users'],
        responses: [
            new OA\Response(response: 200, description: 'Felhasználók listája'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function index()
    {
        $this->authorize('viewAny', User::class);

        $users = User::with(['role', 'shelter'])->orderBy('name')->get();

        return UserResource::collection($users);
    }

    #[OA\Post(
        path: '/api/users',
        summary: 'Új rendszerfelhasználó létrehozása',
        security: [['sanctumSession' => []]],
        tags: ['Users'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['name', 'email', 'password', 'role_id'],
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\Property(property: 'password', type: 'string', format: 'password'),
                    new OA\Property(property: 'role_id', type: 'integer'),
                    new OA\Property(property: 'shelter_id', type: 'string', format: 'uuid', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Létrehozott felhasználó'),
            new OA\Response(response: 422, description: 'Validációs hiba'),
        ]
    )]
    public function store(StoreUserRequest $request, AuditService $auditService)
    {
        $user = User::create([
            ...$request->safe()->only(['name', 'email', 'role_id', 'shelter_id']),
            'password' => bcrypt($request->validated('password')),
        ]);

        $auditService->log('user_create', $user, $request->user(), null, $user->toArray());

        return (new UserResource($user->load(['role', 'shelter'])))->response()->setStatusCode(201);
    }

    #[OA\Put(
        path: '/api/users/{targetUser}',
        summary: 'Rendszerfelhasználó módosítása (szerepkör, befogadóhely, jelszó)',
        security: [['sanctumSession' => []]],
        tags: ['Users'],
        parameters: [
            new OA\Parameter(name: 'targetUser', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Frissített felhasználó'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function update(UpdateUserRequest $request, User $targetUser, AuditService $auditService)
    {
        $before = $targetUser->toArray();
        $roleChanged = $request->filled('role_id') && (int) $request->validated('role_id') !== $targetUser->role_id;

        $data = $request->safe()->only(['name', 'email', 'role_id', 'shelter_id']);

        if ($request->filled('password')) {
            $data['password'] = bcrypt($request->validated('password'));
        }

        $targetUser->update($data);

        $auditService->log(
            $roleChanged ? 'role_change' : 'user_update',
            $targetUser,
            $request->user(),
            $before,
            $targetUser->fresh()->toArray(),
            forceSignificant: $roleChanged ?: null,
        );

        return new UserResource($targetUser->fresh(['role', 'shelter']));
    }

    #[OA\Post(
        path: '/api/users/{targetUser}/avatar',
        summary: 'Profilkép feltöltése/cseréje',
        description: 'Saját profilkép bárki feltöltheti, más felhasználóét csak admin.',
        security: [['sanctumSession' => []]],
        tags: ['Users'],
        parameters: [
            new OA\Parameter(name: 'targetUser', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(mediaType: 'multipart/form-data', schema: new OA\Schema(
                required: ['avatar'],
                properties: [
                    new OA\Property(property: 'avatar', type: 'string', format: 'binary'),
                ]
            ))
        ),
        responses: [
            new OA\Response(response: 200, description: 'Frissített felhasználó, benne az avatar_url'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
            new OA\Response(response: 422, description: 'Validációs hiba'),
        ]
    )]
    public function uploadAvatar(Request $request, User $targetUser)
    {
        $this->authorize('updateAvatar', $targetUser);

        $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        if ($targetUser->avatar_path) {
            Storage::disk('public')->delete($targetUser->avatar_path);
        }

        $path = $request->file('avatar')->store('avatars', 'public');
        $targetUser->update(['avatar_path' => $path]);

        return new UserResource($targetUser->fresh(['role', 'shelter']));
    }

    #[OA\Delete(
        path: '/api/users/{targetUser}/avatar',
        summary: 'Profilkép eltávolítása',
        security: [['sanctumSession' => []]],
        tags: ['Users'],
        parameters: [
            new OA\Parameter(name: 'targetUser', in: 'path', required: true, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Frissített felhasználó'),
            new OA\Response(response: 403, description: 'Nincs jogosultság'),
        ]
    )]
    public function deleteAvatar(User $targetUser)
    {
        $this->authorize('updateAvatar', $targetUser);

        if ($targetUser->avatar_path) {
            Storage::disk('public')->delete($targetUser->avatar_path);
            $targetUser->update(['avatar_path' => null]);
        }

        return new UserResource($targetUser->fresh(['role', 'shelter']));
    }

    #[OA\Get(
        path: '/api/roles',
        summary: 'Szerepkörök listája (felhasználókezelő űrlaphoz)',
        security: [['sanctumSession' => []]],
        tags: ['Users'],
        responses: [
            new OA\Response(response: 200, description: 'Szerepkörök listája'),
        ]
    )]
    public function roles()
    {
        $this->authorize('viewAny', User::class);

        return response()->json([
            'data' => Role::orderBy('name')->get(['id', 'code', 'name']),
        ]);
    }
}
