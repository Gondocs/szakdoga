<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShelterManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_and_update_a_shelter(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $response = $this->postJson('/api/shelters', [
            'name' => 'Teszt Sportcsarnok',
            'municipality_id' => $municipality->id,
            'address' => 'Fő utca 1.',
            'capacity_total' => 100,
            'status' => 'active',
        ]);

        $response->assertCreated();
        $shelterId = $response->json('data.id');

        $this->putJson("/api/shelters/{$shelterId}", [
            'capacity_total' => 150,
            'status' => 'full',
        ])->assertOk()->assertJsonPath('data.capacity_total', 150);
    }

    public function test_shelter_service_details_can_be_set(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $response = $this->postJson('/api/shelters', [
            'name' => 'Teszt Sportcsarnok',
            'municipality_id' => $municipality->id,
            'address' => 'Fő utca 1.',
            'capacity_total' => 100,
            'status' => 'active',
            'drinking_water_available' => true,
            'meals_available' => true,
            'hygiene_facilities_available' => true,
            'childcare_available' => false,
            'psychological_support_available' => false,
            'house_rules' => 'Csendes pihenő 22 és 6 óra között.',
            'public_health_notes' => 'Fertőtlenítés naponta kétszer.',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.drinking_water_available', true);
        $response->assertJsonPath('data.meals_available', true);
        $response->assertJsonPath('data.house_rules', 'Csendes pihenő 22 és 6 óra között.');
    }

    public function test_registrar_cannot_create_a_shelter(): void
    {
        $this->actingAsRole(RoleCode::Registrar);
        $municipality = Municipality::factory()->create();

        $this->postJson('/api/shelters', [
            'name' => 'Teszt',
            'municipality_id' => $municipality->id,
            'address' => 'Fő utca 1.',
            'capacity_total' => 100,
            'status' => 'active',
        ])->assertForbidden();
    }
}
