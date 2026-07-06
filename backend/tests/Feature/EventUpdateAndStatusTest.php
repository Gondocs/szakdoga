<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventUpdateAndStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_activate_event_and_add_shelter_capacity(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create(['municipality_id' => $municipality->id]);

        $event = $this->postJson('/api/events', [
            'code' => 'EVT-UPDATE-1',
            'name' => 'Teszt esemény',
            'status' => 'draft',
        ])->assertCreated()->json('data.id');

        $response = $this->putJson("/api/events/{$event}", [
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $shelter->id, 'capacity_limit' => 80],
            ],
        ]);

        $response->assertOk()->assertJsonPath('data.status', 'active');
        $this->assertDatabaseHas('event_shelters', ['event_id' => $event, 'shelter_id' => $shelter->id, 'capacity_limit' => 80]);
    }

    public function test_registrar_can_manually_transition_registration_status(): void
    {
        $admin = $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-STATUS-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $registrar = $this->actingAsRole(RoleCode::Registrar);

        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt',
            'first_name' => 'Elemér',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $person = \App\Models\Person::with('registration')->find($personId);
        $registrationId = $person->registration->id;

        $this->putJson("/api/registrations/{$registrationId}/status", [
            'status' => 'in_transport',
        ])->assertOk()->assertJsonPath('data.status', 'in_transport');

        $this->assertDatabaseHas('registrations', ['id' => $registrationId, 'status' => 'in_transport']);
        $this->assertDatabaseHas('status_history', [
            'entity_type' => 'Registration',
            'entity_id' => $registrationId,
            'old_status' => 'registered',
            'new_status' => 'in_transport',
        ]);
    }

    public function test_shelter_operator_cannot_transition_status(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-STATUS-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt',
            'first_name' => 'Piroska',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $person = \App\Models\Person::with('registration')->find($personId);

        $this->actingAsRole(RoleCode::ShelterOperator);
        $this->putJson("/api/registrations/{$person->registration->id}/status", [
            'status' => 'returned_home',
        ])->assertForbidden();
    }
}
