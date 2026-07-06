<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_and_create_users(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $registrarRole = Role::firstOrCreate(['code' => RoleCode::Registrar->value], ['name' => 'Regisztrátor']);

        $this->getJson('/api/users')->assertOk();

        $response = $this->postJson('/api/users', [
            'name' => 'Teszt Elek',
            'email' => 'teszt.elek@example.com',
            'password' => 'password123',
            'role_id' => $registrarRole->id,
        ]);

        $response->assertCreated()->assertJsonPath('data.email', 'teszt.elek@example.com');
        $this->assertDatabaseHas('users', ['email' => 'teszt.elek@example.com']);
    }

    public function test_registrar_cannot_manage_users(): void
    {
        $this->actingAsRole(RoleCode::Registrar);

        $this->getJson('/api/users')->assertForbidden();
        $this->postJson('/api/users', [
            'name' => 'X',
            'email' => 'x@example.com',
            'password' => 'password123',
            'role_id' => 1,
        ])->assertForbidden();
    }

    public function test_admin_can_update_a_user_role(): void
    {
        $admin = $this->actingAsRole(RoleCode::Admin);
        $managerRole = Role::firstOrCreate(['code' => RoleCode::Manager->value], ['name' => 'Vezető']);

        $target = \App\Models\User::factory()->create();

        $this->putJson("/api/users/{$target->id}", [
            'role_id' => $managerRole->id,
        ])->assertOk()->assertJsonPath('data.role.code', 'manager');

        $this->assertNotEquals($admin->id, $target->id);
    }

    public function test_user_can_upload_and_remove_own_avatar(): void
    {
        Storage::fake('public');
        $user = $this->actingAsRole(RoleCode::Registrar);

        $response = $this->postJson("/api/users/{$user->id}/avatar", [
            'avatar' => UploadedFile::fake()->image('avatar.jpg'),
        ]);

        $response->assertOk();
        $this->assertNotNull($response->json('data.avatar_url'));
        Storage::disk('public')->assertExists($user->fresh()->avatar_path);

        $this->deleteJson("/api/users/{$user->id}/avatar")->assertOk()->assertJsonPath('data.avatar_url', null);
        $this->assertNull($user->fresh()->avatar_path);
    }

    public function test_user_cannot_upload_avatar_for_another_user(): void
    {
        Storage::fake('public');
        $this->actingAsRole(RoleCode::Registrar);
        $other = \App\Models\User::factory()->create();

        $this->postJson("/api/users/{$other->id}/avatar", [
            'avatar' => UploadedFile::fake()->image('avatar.jpg'),
        ])->assertForbidden();
    }
}
