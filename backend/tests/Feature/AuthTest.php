<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_correct_credentials(): void
    {
        $role = Role::create(['code' => RoleCode::Admin->value, 'name' => 'Admin']);
        User::factory()->create([
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);

        $response = $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ]);

        $response->assertOk()->assertJsonPath('data.email', 'admin@example.com');
    }

    public function test_login_fails_with_wrong_password(): void
    {
        User::factory()->create(['email' => 'admin@example.com', 'password' => bcrypt('password')]);

        $response = $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertUnprocessable();
    }

    public function test_me_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_me_endpoint_returns_current_user(): void
    {
        $user = $this->actingAsRole(RoleCode::Admin);

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);
    }

    public function test_user_can_update_own_name_without_current_password(): void
    {
        $this->actingAsRole(RoleCode::Admin);

        $this->putJson('/api/me', ['name' => 'Új Név'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Új Név');
    }

    public function test_user_cannot_change_email_without_correct_current_password(): void
    {
        $this->actingAsRole(RoleCode::Admin, ['password' => bcrypt('titkosjelszo')]);

        $this->putJson('/api/me', [
            'email' => 'uj-email@example.com',
            'current_password' => 'wrong-password',
        ])->assertUnprocessable();
    }

    public function test_user_can_change_password_with_correct_current_password(): void
    {
        $user = $this->actingAsRole(RoleCode::Admin, ['password' => bcrypt('regijelszo')]);

        $this->putJson('/api/me', [
            'password' => 'ujjelszo123',
            'current_password' => 'regijelszo',
        ])->assertOk();

        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('ujjelszo123', $user->fresh()->password));
    }

    public function test_login_history_is_available_even_to_roles_without_audit_log_access(): void
    {
        $role = Role::create(['code' => RoleCode::Registrar->value, 'name' => 'Registrar']);
        $user = User::factory()->create([
            'email' => 'registrar@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'registrar@example.com',
            'password' => 'wrong-password',
        ])->assertUnprocessable();

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'registrar@example.com',
            'password' => 'password',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'login']);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'login_failed']);

        // A tényleges bejelentkezés által beállított session-sütit a teszt-kliens
        // nem viszi át automatikusan a következő hívásra, ezért a védett
        // végpontokat explicit módon, a már autentikált felhasználóval hívjuk.
        $this->actingAs($user);

        $this->getJson('/api/audit-logs')->assertForbidden();

        $history = $this->getJson('/api/me/login-history')->assertOk();
        $actions = collect($history->json('data'))->pluck('action');
        $this->assertTrue($actions->contains('login'));
        $this->assertTrue($actions->contains('login_failed'));
    }

    public function test_login_history_only_shows_own_entries(): void
    {
        $this->actingAsRole(RoleCode::Admin);

        $history = $this->getJson('/api/me/login-history')->assertOk();
        $this->assertEmpty($history->json('data'));
    }
}
