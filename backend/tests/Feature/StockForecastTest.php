<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Interreg tanulmány "Napi készletigény-előrejelzés" funkciója.
 */
class StockForecastTest extends TestCase
{
    use RefreshDatabase;

    // A napi készletigény-előrejelzés a ténylegesen befogadóhelyen lévő
    // személyek száma alapján számol napi 3 étkezést, 1 takarót és 1
    // matracot fejenként, és az egyedi (medical) igény miatt a
    // gyógyszerre szorulók számát is helyesen (1) adja vissza,
    // befogadóhelyenkénti bontásban is.
    public function test_stock_forecast_reflects_checked_in_persons_and_special_needs(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create(['capacity_total' => 50]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-STOCK-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [['shelter_id' => $shelter->id, 'capacity_limit' => 10]],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
            'special_needs' => [['category' => 'medical', 'type' => 'inzulinfüggő']],
        ])->assertCreated()->json('data.id');

        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        $this->actingAsRole(RoleCode::Admin);
        $this->postJson("/api/shelters/{$shelter->id}/checkins", ['event_id' => $eventId, 'public_id' => $publicId])->assertCreated();

        $response = $this->getJson("/api/events/{$eventId}/stock-forecast");
        $response->assertOk();
        $response->assertJsonPath('data.totals.checked_in_count', 1);
        $response->assertJsonPath('data.totals.meal_portions_per_day', 3);
        $response->assertJsonPath('data.totals.blankets_needed', 1);
        $response->assertJsonPath('data.totals.mattresses_needed', 1);
        $response->assertJsonPath('data.totals.medicine_needed_count', 1);
        $response->assertJsonPath('data.by_shelter.0.shelter_id', $shelter->id);
    }
}
