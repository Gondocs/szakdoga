<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FamilyAndExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_family_detail_lists_members_and_primary_contact(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-FAMILY-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $registrar = $this->actingAsRole(RoleCode::Registrar);

        $firstPerson = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Kovács',
            'first_name' => 'Anna',
            'municipality_id' => $municipality->id,
            'create_new_family' => true,
            'is_primary_contact' => true,
        ])->assertCreated()->json('data');

        $familyId = $firstPerson['family_id'];
        $this->assertNotNull($familyId);

        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Kovács',
            'first_name' => 'Béla',
            'municipality_id' => $municipality->id,
            'family_id' => $familyId,
        ])->assertCreated();

        $response = $this->getJson("/api/families/{$familyId}");
        $response->assertOk();
        $this->assertCount(2, $response->json('data.members'));
        $this->assertEquals($firstPerson['id'], $response->json('data.primary_contact_person_id'));
    }

    public function test_admin_can_export_persons_as_csv(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-EXPORT-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Export',
            'first_name' => 'Teszt',
            'municipality_id' => $municipality->id,
        ])->assertCreated();

        $this->actingAsRole(RoleCode::Admin);
        $response = $this->get("/api/events/{$eventId}/persons/export");

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('Export', $response->streamedContent());
    }

    public function test_registrar_cannot_export_csv(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-EXPORT-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->get("/api/events/{$eventId}/persons/export")->assertForbidden();
    }

    public function test_shelter_operator_can_export_own_shelter_roster_but_not_others(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelterA = Shelter::factory()->create(['municipality_id' => $municipality->id]);
        $shelterB = Shelter::factory()->create(['municipality_id' => $municipality->id]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-ROSTER-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $shelterA->id, 'capacity_limit' => 10],
                ['shelter_id' => $shelterB->id, 'capacity_limit' => 10],
            ],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Roster',
            'first_name' => 'Teszt',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        $operatorA = $this->actingAsRole(RoleCode::ShelterOperator, ['shelter_id' => $shelterA->id]);
        $this->postJson("/api/shelters/{$shelterA->id}/checkins", [
            'public_id' => $publicId,
            'event_id' => $eventId,
        ])->assertCreated();

        $this->actingAs($operatorA);
        $response = $this->get("/api/events/{$eventId}/shelters/{$shelterA->id}/roster-export");
        $response->assertOk();
        $this->assertStringContainsString('Roster', $response->streamedContent());

        $this->actingAsRole(RoleCode::ShelterOperator, ['shelter_id' => $shelterB->id]);
        $this->get("/api/events/{$eventId}/shelters/{$shelterA->id}/roster-export")->assertForbidden();
    }

    public function test_admin_can_export_summary_report(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-REPORT-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Riport',
            'first_name' => 'Teszt',
            'municipality_id' => $municipality->id,
            'special_needs' => [['category' => 'diet', 'type' => 'gluten_free']],
        ])->assertCreated();

        $this->actingAsRole(RoleCode::Admin);
        $response = $this->get("/api/events/{$eventId}/report-export");

        $response->assertOk();
        $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $content = $response->streamedContent();
        $this->assertStringContainsString('Összesítő mutatók', $content);
        $this->assertStringContainsString('Speciális igények kategóriánként', $content);
        $this->assertStringContainsString('Befogadóhelyek kihasználtsága', $content);
    }

    public function test_registrar_cannot_export_summary_report(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-REPORT-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->get("/api/events/{$eventId}/report-export")->assertForbidden();
    }
}
