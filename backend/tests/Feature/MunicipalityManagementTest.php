<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MunicipalityManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_update_and_delete_a_municipality(): void
    {
        $this->actingAsRole(RoleCode::Admin);

        $response = $this->postJson('/api/municipalities', [
            'name' => 'Teszttelepülés',
            'county' => 'Győr-Moson-Sopron',
            'postal_code' => '9021',
        ]);
        $response->assertCreated();
        $municipalityId = $response->json('data.id');

        $this->putJson("/api/municipalities/{$municipalityId}", ['name' => 'Átnevezett Település'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Átnevezett Település');

        $this->deleteJson("/api/municipalities/{$municipalityId}")->assertNoContent();
        $this->assertDatabaseMissing('municipalities', ['id' => $municipalityId]);
    }

    public function test_registrar_cannot_create_a_municipality(): void
    {
        $this->actingAsRole(RoleCode::Registrar);

        $this->postJson('/api/municipalities', [
            'name' => 'Teszt',
            'county' => 'Győr-Moson-Sopron',
        ])->assertForbidden();
    }

    public function test_municipality_in_use_cannot_be_deleted(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-MUNI-DEL-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated();

        $this->actingAsRole(RoleCode::Admin);
        $this->deleteJson("/api/municipalities/{$municipality->id}")
            ->assertStatus(409)
            ->assertJsonPath('code', 'MUNICIPALITY_IN_USE');
    }
}
