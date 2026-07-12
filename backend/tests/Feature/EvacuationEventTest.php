<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EvacuationEventTest extends TestCase
{
    use RefreshDatabase;

    // Admin szerepkörrel egyből "aktív" státuszú esemény is létrehozható,
    // és az ténylegesen elmentődik az adatbázisba.
    public function test_admin_can_create_an_active_event(): void
    {
        $this->actingAsRole(RoleCode::Admin);

        $response = $this->postJson('/api/events', [
            'code' => 'EVT-TEST-1',
            'name' => 'Teszt kitelepítés',
            'status' => 'active',
        ]);

        $response->assertCreated()->assertJsonPath('data.code', 'EVT-TEST-1');
        $this->assertDatabaseHas('evacuation_events', ['code' => 'EVT-TEST-1', 'status' => 'active']);
    }

    // Esemény létrehozása jogosultsághoz kötött: regisztrátor szerepkörrel
    // a kérés 403-at ad.
    public function test_registrar_cannot_create_an_event(): void
    {
        $this->actingAsRole(RoleCode::Registrar);

        $response = $this->postJson('/api/events', [
            'code' => 'EVT-TEST-2',
            'name' => 'Teszt kitelepítés',
            'status' => 'active',
        ]);

        $response->assertForbidden();
    }

    // Az események listázása bejelentkezést igényel: hitelesítés nélkül a
    // kérés 401-et ad.
    public function test_guest_cannot_list_events(): void
    {
        $this->getJson('/api/events')->assertUnauthorized();
    }
}
