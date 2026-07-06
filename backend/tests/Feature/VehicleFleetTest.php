<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A szállítójármű-flotta (Vehicle) eseményfüggetlen törzsadat, amit tetszőleges
 * eseményhez Transport-ként rendelhetünk hozzá — a duplikált lefoglalás
 * (ugyanaz a busz két folyamatban lévő eseményben egyszerre) elleni védelemmel.
 */
class VehicleFleetTest extends TestCase
{
    use RefreshDatabase;

    private function createEvent(string $code, string $status = 'active'): EvacuationEvent
    {
        $this->actingAsRole(RoleCode::Admin);
        $eventId = $this->postJson('/api/events', [
            'code' => $code,
            'name' => "Teszt esemény {$code}",
            'status' => $status,
        ])->assertCreated()->json('data.id');

        return EvacuationEvent::findOrFail($eventId);
    }

    public function test_admin_can_create_update_and_delete_a_vehicle(): void
    {
        $this->actingAsRole(RoleCode::Admin);

        $vehicleId = $this->postJson('/api/vehicles', [
            'plate_number' => 'AAA-123',
            'label' => '1. sz. busz',
            'capacity' => 50,
            'driver_name' => 'Kovács János',
        ])->assertCreated()->json('data.id');

        $this->assertDatabaseHas('vehicles', ['plate_number' => 'AAA-123', 'label' => '1. sz. busz']);

        $this->putJson("/api/vehicles/{$vehicleId}", [
            'plate_number' => 'AAA-123',
            'label' => '1. sz. busz (átnevezve)',
            'capacity' => 55,
        ])->assertOk()->assertJsonPath('data.label', '1. sz. busz (átnevezve)');

        $this->deleteJson("/api/vehicles/{$vehicleId}")->assertNoContent();
        $this->assertDatabaseMissing('vehicles', ['id' => $vehicleId]);
    }

    public function test_plate_number_must_be_unique(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $this->postJson('/api/vehicles', ['plate_number' => 'BBB-456', 'label' => 'Busz 1'])->assertCreated();
        $this->postJson('/api/vehicles', ['plate_number' => 'BBB-456', 'label' => 'Busz 2'])->assertStatus(422);
    }

    public function test_registrar_cannot_manage_vehicles(): void
    {
        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson('/api/vehicles', ['plate_number' => 'CCC-789', 'label' => 'Busz'])->assertForbidden();
    }

    public function test_assigning_vehicle_to_two_ongoing_events_is_rejected(): void
    {
        $eventA = $this->createEvent('EVT-VEH-A', 'active');
        $eventB = $this->createEvent('EVT-VEH-B', 'paused');

        $this->actingAsRole(RoleCode::Admin);
        $vehicleId = $this->postJson('/api/vehicles', ['plate_number' => 'DDD-111', 'label' => 'Busz'])
            ->assertCreated()->json('data.id');

        $this->postJson("/api/events/{$eventA->id}/transports", [
            'code' => '1. sz. busz',
            'vehicle_id' => $vehicleId,
        ])->assertCreated();

        // Ugyanaz a jármű egy másik, jelenleg is folyamatban lévő eseményhez nem rendelhető.
        $this->postJson("/api/events/{$eventB->id}/transports", [
            'code' => '2. sz. busz',
            'vehicle_id' => $vehicleId,
        ])->assertStatus(409)->assertJsonPath('code', 'VEHICLE_IN_USE');

        $this->getJson('/api/vehicles')
            ->assertOk()
            ->assertJsonPath('data.0.active_assignment.event_id', $eventA->id);
    }

    public function test_vehicle_can_be_reassigned_after_its_event_is_closed(): void
    {
        $eventA = $this->createEvent('EVT-VEH-C', 'active');
        $eventB = $this->createEvent('EVT-VEH-D', 'active');

        $this->actingAsRole(RoleCode::Admin);
        $vehicleId = $this->postJson('/api/vehicles', ['plate_number' => 'EEE-222', 'label' => 'Busz'])
            ->assertCreated()->json('data.id');

        $this->postJson("/api/events/{$eventA->id}/transports", [
            'code' => '1. sz. busz',
            'vehicle_id' => $vehicleId,
        ])->assertCreated();

        $this->putJson("/api/events/{$eventA->id}", ['name' => $eventA->name, 'status' => 'closed'])->assertOk();

        $this->postJson("/api/events/{$eventB->id}/transports", [
            'code' => '2. sz. busz',
            'vehicle_id' => $vehicleId,
        ])->assertCreated();
    }

    public function test_vehicle_in_active_use_cannot_be_deleted(): void
    {
        $event = $this->createEvent('EVT-VEH-E', 'active');

        $this->actingAsRole(RoleCode::Admin);
        $vehicleId = $this->postJson('/api/vehicles', ['plate_number' => 'FFF-333', 'label' => 'Busz'])
            ->assertCreated()->json('data.id');

        $this->postJson("/api/events/{$event->id}/transports", [
            'code' => '1. sz. busz',
            'vehicle_id' => $vehicleId,
        ])->assertCreated();

        $this->deleteJson("/api/vehicles/{$vehicleId}")
            ->assertStatus(409)
            ->assertJsonPath('code', 'VEHICLE_IN_USE');
    }
}
