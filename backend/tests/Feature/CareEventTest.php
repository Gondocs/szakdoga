<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CareEventTest extends TestCase
{
    use RefreshDatabase;

    public function test_shelter_operator_can_record_and_list_care_events(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-CARE-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [['shelter_id' => $shelter->id, 'capacity_limit' => 10]],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::ShelterOperator);
        $response = $this->postJson("/api/persons/{$personId}/care-events", [
            'category' => 'meal',
            'note' => 'Ebéd kiadva',
            'shelter_id' => $shelter->id,
        ]);
        $response->assertCreated();
        $response->assertJsonPath('data.category', 'meal');
        $response->assertJsonPath('data.shelter.id', $shelter->id);

        $this->getJson("/api/persons/{$personId}/care-events")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.note', 'Ebéd kiadva');
    }

    public function test_auditor_cannot_record_a_care_event(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-CARE-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Auditor);
        $this->postJson("/api/persons/{$personId}/care-events", ['category' => 'meal'])->assertForbidden();
    }
}
