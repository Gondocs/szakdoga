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
}
