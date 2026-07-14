<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Transport;
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

    // Admin szerepkörrel egy flottajármű (Vehicle törzsadat) létrehozható,
    // módosítható, majd törölhető.
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

    // Két jármű nem kaphat azonos rendszámot: a másodikat 422-vel utasítja
    // el a rendszer.
    public function test_plate_number_must_be_unique(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $this->postJson('/api/vehicles', ['plate_number' => 'BBB-456', 'label' => 'Busz 1'])->assertCreated();
        $this->postJson('/api/vehicles', ['plate_number' => 'BBB-456', 'label' => 'Busz 2'])->assertStatus(422);
    }

    // Flottajármű létrehozása jogosultsághoz kötött: regisztrátor
    // szerepkörrel a kérés 403-at ad.
    public function test_registrar_cannot_manage_vehicles(): void
    {
        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson('/api/vehicles', ['plate_number' => 'CCC-789', 'label' => 'Busz'])->assertForbidden();
    }

    // Egy jármű nem rendelhető hozzá két, egyszerre FOLYAMATBAN lévő
    // (active/paused) esemény szállítójához — a második hozzárendelési
    // kísérlet 409 VEHICLE_IN_USE-t ad, és a flottalista is jelzi, melyik
    // eseményhez van éppen lefoglalva a jármű.
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

    // Miután az első esemény, amihez a jármű hozzá volt rendelve, "closed"
    // állapotba kerül, a jármű szabaddá válik és egy másik, aktív
    // eseményhez is hozzárendelhető — a foglalás csak folyamatban lévő
    // eseményre vonatkozik.
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

    // Egy aktív eseményhez jelenleg hozzárendelt jármű nem törölhető (409
    // VEHICLE_IN_USE).
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

    // A flottalista a jelenleg hozzárendelt szállítóeszköz utolsó ismert
    // pozícióját (lat/lng, időbélyeg) is visszaadja az aktuális
    // hozzárendelés (active_assignment) részeként.
    public function test_fleet_list_exposes_active_transport_position(): void
    {
        $event = $this->createEvent('EVT-VEH-F', 'active');

        $this->actingAsRole(RoleCode::Admin);
        $vehicleId = $this->postJson('/api/vehicles', ['plate_number' => 'GGG-444', 'label' => 'Busz'])
            ->assertCreated()->json('data.id');

        $transportId = $this->postJson("/api/events/{$event->id}/transports", [
            'code' => '1. sz. busz',
            'vehicle_id' => $vehicleId,
        ])->assertCreated()->json('data.id');

        Transport::whereKey($transportId)->update([
            'last_lat' => 47.6875,
            'last_lng' => 17.6504,
            'last_position_at' => now(),
        ]);

        $response = $this->getJson('/api/vehicles')->assertOk();
        $response->assertJsonPath('data.0.active_assignment.last_lat', 47.6875);
        $response->assertJsonPath('data.0.active_assignment.last_lng', 17.6504);
        $this->assertNotNull($response->json('data.0.active_assignment.last_position_at'));
    }
}
