<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PersonSearchAndMapTest extends TestCase
{
    use RefreshDatabase;

    public function test_per_page_parameter_controls_page_size(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-PAGE-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        foreach (range(1, 30) as $i) {
            $this->postJson("/api/events/{$eventId}/persons", [
                'last_name' => "Teszt{$i}", 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
            ])->assertCreated();
        }

        $defaultResponse = $this->getJson("/api/events/{$eventId}/persons")->assertOk();
        $this->assertCount(25, $defaultResponse->json('data'));
        $this->assertSame(30, $defaultResponse->json('meta.total'));

        $allResponse = $this->getJson("/api/events/{$eventId}/persons?per_page=100")->assertOk();
        $this->assertCount(30, $allResponse->json('data'));
    }

    public function test_search_matches_family_code(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-SEARCH-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $person = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Nagy',
            'first_name' => 'Család',
            'municipality_id' => $municipality->id,
            'create_new_family' => true,
            'is_primary_contact' => true,
        ])->assertCreated()->json('data');

        $familyId = $person['family_id'];
        $familyCode = $this->getJson("/api/families/{$familyId}")->json('data.family_code');

        $response = $this->getJson("/api/events/{$eventId}/persons?search={$familyCode}")->assertOk();
        $response->assertJsonCount(1, 'data');
        $this->assertEquals($person['id'], $response->json('data.0.id'));
    }

    public function test_municipality_summary_only_returns_municipalities_with_coordinates(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $withCoords = Municipality::factory()->create(['lat' => 47.6875, 'lng' => 17.6504]);
        $withoutCoords = Municipality::factory()->create(['lat' => null, 'lng' => null]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-MAP-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Első', 'first_name' => 'Teszt', 'municipality_id' => $withCoords->id,
        ])->assertCreated();
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Második', 'first_name' => 'Teszt', 'municipality_id' => $withCoords->id,
        ])->assertCreated();
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Harmadik', 'first_name' => 'Teszt', 'municipality_id' => $withoutCoords->id,
        ])->assertCreated();

        $response = $this->getJson("/api/events/{$eventId}/persons/municipality-summary")->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.municipality_id', $withCoords->id);
        $response->assertJsonPath('data.0.person_count', 2);
    }

    public function test_municipality_filter_narrows_person_list(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipalityA = Municipality::factory()->create();
        $municipalityB = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-MUNI-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Első', 'first_name' => 'Teszt', 'municipality_id' => $municipalityA->id,
        ])->assertCreated();
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Második', 'first_name' => 'Teszt', 'municipality_id' => $municipalityB->id,
        ])->assertCreated();

        $response = $this->getJson("/api/events/{$eventId}/persons?municipality_id={$municipalityA->id}")->assertOk();
        $response->assertJsonCount(1, 'data');
    }
}
