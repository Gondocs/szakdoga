<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Events\IncidentCreated;
use App\Events\ShelterCapacityUpdated;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

// A ShelterCapacityUpdated/IncidentCreated csak azt ellenőrzi, hogy a
// megfelelő eseményt a megfelelő adatokkal váltjuk ki (Event::fake() —
// nincs szükség valódi Reverb-kapcsolatra a teszteléshez, lásd 2FA-nál a
// Mail::fake() mintáját).
class BroadcastingTest extends TestCase
{
    use RefreshDatabase;

    // Érkeztetéskor a befogadóhely új létszámával és a frissen számolt
    // kockázati szinttel váltódik ki a ShelterCapacityUpdated esemény.
    public function test_checkin_broadcasts_shelter_capacity_updated(): void
    {
        Event::fake([ShelterCapacityUpdated::class]);

        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create(['capacity_total' => 50]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-BROADCAST-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [['shelter_id' => $shelter->id, 'capacity_limit' => 10]],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        $this->actingAsRole(RoleCode::Admin);
        $this->postJson("/api/shelters/{$shelter->id}/checkins", ['event_id' => $eventId, 'public_id' => $publicId])
            ->assertCreated();

        Event::assertDispatched(ShelterCapacityUpdated::class, function (ShelterCapacityUpdated $event) use ($eventId, $shelter) {
            return $event->eventId === $eventId
                && $event->shelterId === $shelter->id
                && $event->checkedInCount === 1
                && $event->capacityLimit === 10;
        });
    }

    // Áthelyezéskor mindkét érintett befogadóhelyre (régi és új) külön
    // ShelterCapacityUpdated esemény váltódik ki.
    public function test_transfer_broadcasts_capacity_update_for_both_shelters(): void
    {
        Event::fake([ShelterCapacityUpdated::class]);

        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelterA = Shelter::factory()->create(['capacity_total' => 50]);
        $shelterB = Shelter::factory()->create(['capacity_total' => 50]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-BROADCAST-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $shelterA->id, 'capacity_limit' => 10],
                ['shelter_id' => $shelterB->id, 'capacity_limit' => 10],
            ],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        $this->actingAsRole(RoleCode::Admin);
        $this->postJson("/api/shelters/{$shelterA->id}/checkins", ['event_id' => $eventId, 'public_id' => $publicId])
            ->assertCreated();

        Event::fake([ShelterCapacityUpdated::class]);

        $this->postJson("/api/persons/{$personId}/transfer", ['shelter_id' => $shelterB->id])->assertCreated();

        Event::assertDispatched(ShelterCapacityUpdated::class, fn (ShelterCapacityUpdated $e) => $e->shelterId === $shelterA->id && $e->checkedInCount === 0);
        Event::assertDispatched(ShelterCapacityUpdated::class, fn (ShelterCapacityUpdated $e) => $e->shelterId === $shelterB->id && $e->checkedInCount === 1);
    }

    // Új incidens bejelentésekor az IncidentCreated esemény a helyes
    // esemény-/befogadóhely-adatokkal váltódik ki.
    public function test_incident_creation_broadcasts_incident_created(): void
    {
        Event::fake([IncidentCreated::class]);

        $this->actingAsRole(RoleCode::Admin);
        $shelter = Shelter::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-BROADCAST-3',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [['shelter_id' => $shelter->id, 'capacity_limit' => 10]],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::ShelterOperator);
        $this->postJson("/api/events/{$eventId}/incidents", [
            'category' => 'conflict',
            'severity' => 'high',
            'description' => 'Vita alakult ki két család között az étkezési sorban.',
            'shelter_id' => $shelter->id,
        ])->assertCreated();

        Event::assertDispatched(IncidentCreated::class, function (IncidentCreated $event) use ($shelter) {
            $payload = $event->broadcastWith();

            return $payload['category'] === 'conflict'
                && $payload['severity'] === 'high'
                && $payload['shelter_name'] === $shelter->name;
        });
    }
}
