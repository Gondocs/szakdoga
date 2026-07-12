<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Interreg tanulmány "Gyülekezési pontok, útvonalak" funkciója.
 */
class AssemblyPointTest extends TestCase
{
    use RefreshDatabase;

    // Admin szerepkörrel egy gyülekezési pont létrehozható, listázható,
    // módosítható (lat/lng és név frissítése), majd törölhető — a törlés
    // után a listából is eltűnik.
    public function test_admin_can_manage_assembly_points(): void
    {
        $this->actingAsRole(RoleCode::Admin);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-ASSEMBLY-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $createResponse = $this->postJson("/api/events/{$eventId}/assembly-points", [
            'name' => 'Faluház udvara',
            'address' => 'Kossuth utca 1.',
            'lat' => 47.75,
            'lng' => 17.35,
            'notes' => 'Buszmegálló mellett',
        ]);
        $createResponse->assertCreated();
        $assemblyPointId = $createResponse->json('data.id');

        $this->getJson("/api/events/{$eventId}/assembly-points")
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Faluház udvara');

        $updateResponse = $this->putJson("/api/assembly-points/{$assemblyPointId}", [
            'name' => 'Faluház udvara (frissítve)',
            'lat' => 47.76,
            'lng' => 17.36,
        ]);
        $updateResponse->assertOk();
        $updateResponse->assertJsonPath('data.name', 'Faluház udvara (frissítve)');

        $this->deleteJson("/api/assembly-points/{$assemblyPointId}")->assertNoContent();
        $this->getJson("/api/events/{$eventId}/assembly-points")->assertOk()->assertJsonCount(0, 'data');
    }

    // A gyülekezési pontok létrehozása jogosultsághoz kötött: regisztrátor
    // szerepkörrel a kérés 403-at ad.
    public function test_registrar_cannot_create_assembly_points(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-ASSEMBLY-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/assembly-points", [
            'name' => 'Faluház udvara',
            'lat' => 47.75,
            'lng' => 17.35,
        ])->assertForbidden();
    }
}
