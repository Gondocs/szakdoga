<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Interreg tanulmány "Kód aktiválása, újragenerálása, visszavonása és
 * elveszett kód kezelése" funkciója (4. fejezet).
 */
class QrTokenLostCodeTest extends TestCase
{
    use RefreshDatabase;

    private function createPerson(): string
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-QRLOST-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);

        return $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
    }

    public function test_routine_reissue_is_logged_as_qr_issue(): void
    {
        $personId = $this->createPerson();

        $this->actingAsRole(RoleCode::Admin);
        $this->postJson("/api/persons/{$personId}/qr")->assertCreated();

        $this->assertDatabaseHas('audit_logs', ['action' => 'qr_issue', 'significant' => false]);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'qr_reissue_lost']);
    }

    public function test_lost_code_reissue_is_logged_distinctly_and_significantly_and_invalidates_old_code(): void
    {
        $personId = $this->createPerson();

        $this->actingAsRole(RoleCode::Admin);
        $firstToken = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        $secondResponse = $this->postJson("/api/persons/{$personId}/qr", ['reason' => 'lost']);
        $secondResponse->assertCreated();
        $secondToken = $secondResponse->json('data.public_id');

        $this->assertNotSame($firstToken, $secondToken);
        $this->assertDatabaseHas('audit_logs', ['action' => 'qr_reissue_lost', 'significant' => true]);

        // A korábbi (elveszett) kód a beolvasásnál már ne legyen elfogadható.
        $this->postJson('/api/qr/resolve', ['public_id' => $firstToken])->assertStatus(409);

        // Az új kód viszont érvényes.
        $this->postJson('/api/qr/resolve', ['public_id' => $secondToken])->assertOk();
    }
}
