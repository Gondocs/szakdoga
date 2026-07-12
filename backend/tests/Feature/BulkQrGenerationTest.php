<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/**
 * Interreg tanulmány "Előzetes kódgenerálás és kiosztás" funkciója: egy
 * lakossági/önkormányzati CSV-lista alapján tömeges regisztráció és azonnali
 * QR-kód generálás, valamint a kiosztási nyilvántartás (ki, mikor, milyen
 * formában kapta meg a kódot).
 */
class BulkQrGenerationTest extends TestCase
{
    use RefreshDatabase;

    // Egy CSV-listából tömegesen felvitt személyek közül az érvényes sorok
    // (ismert településsel) létrejönnek és azonnal QR-kódot (public_id)
    // kapnak, a felismerhetetlen településsel rendelkező sor hibaként
    // jelenik meg a válaszban, nem szakítja meg a teljes importot.
    public function test_admin_can_bulk_import_persons_with_qr_codes(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create(['name' => 'Győr']);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-BULK-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $csv = "vezetéknév,keresztnév,okmányszám,település,telefon\n"
            ."Kovács,János,DOC100,Győr,+36301234567\n"
            ."Nagy,Éva,DOC101,Győr,\n"
            ."Téves,Sor,DOC102,Ismeretlen Település,\n";
        $file = UploadedFile::fake()->createWithContent('lista.csv', $csv);

        $response = $this->post("/api/events/{$eventId}/persons/bulk-import", ['file' => $file]);

        $response->assertOk();
        $response->assertJsonPath('data.created_count', 2);
        $this->assertCount(1, $response->json('data.errors'));
        $this->assertNotEmpty($response->json('data.created.0.public_id'));

        $this->assertDatabaseHas('persons', ['last_name' => 'Kovács', 'first_name' => 'János', 'event_id' => $eventId]);
        $this->assertDatabaseHas('qr_tokens', ['status' => 'active']);
    }

    // Egy kiadott QR-kód utólag megjelölhető kézbesítettként (pl. "card"
    // átadási móddal), és a kézbesítés időpontja ténylegesen rögzítésre
    // kerül — ez a kiosztási nyilvántartás alapja.
    public function test_registrar_can_mark_qr_token_as_delivered(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-BULK-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $qrTokenId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.id');

        $response = $this->postJson("/api/qr-tokens/{$qrTokenId}/deliver", ['delivery_method' => 'card']);
        $response->assertOk();
        $response->assertJsonPath('data.delivery_method', 'card');
        $this->assertNotNull($response->json('data.delivered_at'));

        $this->assertDatabaseHas('qr_tokens', ['id' => $qrTokenId, 'delivery_method' => 'card']);
    }

    // A tömeges CSV-import jogosultsághoz kötött: befogadóhelyi kezelő
    // szerepkörrel a végpont 403-at ad.
    public function test_shelter_operator_cannot_bulk_import(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-BULK-3',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::ShelterOperator);
        $file = UploadedFile::fake()->createWithContent('lista.csv', "a,b,c,d,e\n");
        $this->post("/api/events/{$eventId}/persons/bulk-import", ['file' => $file])->assertForbidden();
    }
}
