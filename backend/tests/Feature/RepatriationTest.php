<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Interreg tanulmány "Visszatelepítési modul" funkciója: településenkénti
 * visszatelepítési engedélyezési státusz, és az önkiszolgáló visszatérés-
 * megerősítés csak akkor engedélyezett, ha a település státusza megfelelő.
 */
class RepatriationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_set_repatriation_status_and_it_appears_in_the_list(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-REPAT-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated();

        $this->actingAsRole(RoleCode::Admin);
        $this->putJson("/api/events/{$eventId}/repatriation-authorizations", [
            'municipality_id' => $municipality->id,
            'status' => 'permitted',
            'conditions_note' => 'Közművek helyreálltak.',
        ])->assertOk()->assertJsonPath('data.status', 'permitted');

        $list = $this->getJson("/api/events/{$eventId}/repatriation-authorizations")->assertOk();
        $list->assertJsonCount(1, 'data');
        $list->assertJsonPath('data.0.status', 'permitted');
        $list->assertJsonPath('data.0.person_count', 1);
    }

    public function test_registrar_cannot_set_repatriation_status(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-REPAT-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->putJson("/api/events/{$eventId}/repatriation-authorizations", [
            'municipality_id' => $municipality->id,
            'status' => 'permitted',
        ])->assertForbidden();
    }

    public function test_self_service_return_confirmation_requires_authorized_municipality(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-REPAT-3',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        // Még nincs engedélyezve a település.
        $this->postJson("/api/public/self-profile/{$publicId}/confirm-return")
            ->assertStatus(422)
            ->assertJsonPath('code', 'REPATRIATION_NOT_AUTHORIZED');

        $this->actingAsRole(RoleCode::Admin);
        $this->putJson("/api/events/{$eventId}/repatriation-authorizations", [
            'municipality_id' => $municipality->id,
            'status' => 'conditional',
        ])->assertOk();

        $response = $this->postJson("/api/public/self-profile/{$publicId}/confirm-return");
        $response->assertOk();
        $response->assertJsonPath('data.registration.status', 'returned_home');

        $this->assertDatabaseHas('registrations', ['person_id' => $personId, 'status' => 'returned_home']);
    }
}
