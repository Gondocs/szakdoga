<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Interreg tanulmány "Valós Idejű Kapacitás Összekapcsolás (Matching)"
 * funkciója: a rendszer a regisztrált egyedi igények alapján javasolja a
 * legmegfelelőbb befogadóhelyet (pl. mozgáskorlátozottat akadálymentes
 * kapacitással rendelkező helyre).
 */
class ShelterMatchingTest extends TestCase
{
    use RefreshDatabase;

    public function test_shelter_list_without_person_id_has_no_recommendation(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create(['municipality_id' => $municipality->id]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-MATCH-0',
            'name' => 'Teszt',
            'status' => 'active',
            'shelters' => [['shelter_id' => $shelter->id, 'capacity_limit' => 10]],
        ])->assertCreated()->json('data.id');

        $response = $this->getJson("/api/events/{$eventId}/shelters")->assertOk();

        $response->assertJsonPath('data.0.recommended', false);
        $response->assertJsonPath('data.0.match_score', null);
    }

    public function test_shelter_with_accessible_capacity_is_recommended_for_mobility_need(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $accessibleShelter = Shelter::factory()->create([
            'municipality_id' => $municipality->id,
            'accessible_capacity' => 10,
            'medical_support_available' => false,
        ]);
        $plainShelter = Shelter::factory()->create([
            'municipality_id' => $municipality->id,
            'accessible_capacity' => 0,
            'medical_support_available' => false,
        ]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-MATCH-1',
            'name' => 'Teszt',
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $accessibleShelter->id, 'capacity_limit' => 10],
                ['shelter_id' => $plainShelter->id, 'capacity_limit' => 10],
            ],
        ])->assertCreated()->json('data.id');

        $registrar = $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Kerekes',
            'first_name' => 'Mozgáskorlátozott',
            'municipality_id' => $municipality->id,
            'special_needs' => [['category' => 'mobility', 'type' => 'wheelchair']],
        ])->assertCreated()->json('data.id');

        $response = $this->getJson("/api/events/{$eventId}/shelters?person_id={$personId}")->assertOk();

        $recommended = collect($response->json('data'))->firstWhere('recommended', true);
        $this->assertNotNull($recommended);
        $this->assertEquals($accessibleShelter->id, $recommended['shelter']['id']);
        $this->assertContains('Van akadálymentes férőhely', $recommended['match_reasons']);
    }

    public function test_full_shelter_is_not_recommended_even_with_matching_capability(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $fullAccessibleShelter = Shelter::factory()->create([
            'municipality_id' => $municipality->id,
            'accessible_capacity' => 10,
        ]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-MATCH-2',
            'name' => 'Teszt',
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $fullAccessibleShelter->id, 'capacity_limit' => 1],
            ],
        ])->assertCreated()->json('data.id');

        \App\Models\EventShelter::where('event_id', $eventId)->update(['checked_in_count' => 1]);

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt',
            'first_name' => 'Elek',
            'municipality_id' => $municipality->id,
            'special_needs' => [['category' => 'mobility', 'type' => 'wheelchair']],
        ])->assertCreated()->json('data.id');

        $response = $this->getJson("/api/events/{$eventId}/shelters?person_id={$personId}")->assertOk();

        $this->assertFalse($response->json('data.0.recommended'));
    }
}
