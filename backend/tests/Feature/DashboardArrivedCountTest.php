<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regresszió: a dashboard "Érkezettek" mutatója a checkins tábla sorainak
 * száma helyett az egyedi, jelenleg befogadóhelyen tartózkodó személyek
 * számát adja vissza — egy áthelyezés (ami második checkin-rekordot hoz
 * létre ugyanahhoz a személyhez) ne duplázza meg a számot.
 */
class DashboardArrivedCountTest extends TestCase
{
    use RefreshDatabase;

    public function test_arrived_count_is_not_inflated_by_shelter_transfer(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelterA = Shelter::factory()->create(['capacity_total' => 50]);
        $shelterB = Shelter::factory()->create(['capacity_total' => 50]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-DASH-1',
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
        $this->postJson("/api/shelters/{$shelterA->id}/checkins", ['event_id' => $eventId, 'public_id' => $publicId])->assertCreated();
        $this->postJson("/api/persons/{$personId}/transfer", ['shelter_id' => $shelterB->id])->assertCreated();

        $this->assertDatabaseCount('checkins', 2);

        $dashboard = $this->getJson("/api/events/{$eventId}/dashboard")->assertOk();
        $this->assertSame(1, $dashboard->json('data.arrived_count'));
    }
}
