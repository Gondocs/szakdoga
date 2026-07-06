<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventAndShelterDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_delete_an_event_without_registrations(): void
    {
        $this->actingAsRole(RoleCode::Admin);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-DEL-1',
            'name' => 'Törlendő esemény',
            'status' => 'draft',
        ])->assertCreated()->json('data.id');

        $this->deleteJson("/api/events/{$eventId}")->assertNoContent();
        $this->assertDatabaseMissing('evacuation_events', ['id' => $eventId]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'delete', 'entity_type' => 'EvacuationEvent']);
    }

    public function test_event_with_registrations_cannot_be_deleted(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-DEL-2',
            'name' => 'Aktív esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Kovács',
            'first_name' => 'János',
            'municipality_id' => $municipality->id,
        ])->assertCreated();

        $this->deleteJson("/api/events/{$eventId}")
            ->assertStatus(409)
            ->assertJsonPath('code', 'EVENT_HAS_REGISTRATIONS');

        $this->assertDatabaseHas('evacuation_events', ['id' => $eventId]);
    }

    public function test_manager_cannot_delete_an_event(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-DEL-3',
            'name' => 'Teszt',
            'status' => 'draft',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Manager);
        $this->deleteJson("/api/events/{$eventId}")->assertForbidden();
    }

    public function test_admin_can_delete_a_shelter_not_assigned_to_any_event(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create(['municipality_id' => $municipality->id]);

        $this->deleteJson("/api/shelters/{$shelter->id}")->assertNoContent();
        $this->assertDatabaseMissing('shelters', ['id' => $shelter->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'delete', 'entity_type' => 'Shelter']);
    }

    public function test_shelter_assigned_to_an_event_cannot_be_deleted(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create(['municipality_id' => $municipality->id]);

        $this->postJson('/api/events', [
            'code' => 'EVT-DEL-4',
            'name' => 'Teszt kitelepítés',
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $shelter->id, 'capacity_limit' => 10],
            ],
        ])->assertCreated();

        $this->deleteJson("/api/shelters/{$shelter->id}")
            ->assertStatus(409)
            ->assertJsonPath('code', 'SHELTER_IN_USE');

        $this->assertDatabaseHas('shelters', ['id' => $shelter->id]);
    }

    public function test_manager_cannot_delete_a_shelter(): void
    {
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create(['municipality_id' => $municipality->id]);

        $this->actingAsRole(RoleCode::Manager);
        $this->deleteJson("/api/shelters/{$shelter->id}")->assertForbidden();
    }
}
