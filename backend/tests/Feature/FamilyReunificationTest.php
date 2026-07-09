<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Interreg tanulmány "Családegyesítési munkalista és vészprotokoll" funkciója:
 * a szétszakadt (különböző befogadóhelyeken lévő) családok munkalistája és az
 * ügyintézés bejegyzései.
 */
class FamilyReunificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_worklist_lists_only_split_families_and_notes_can_be_added(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelterA = Shelter::factory()->create();
        $shelterB = Shelter::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-REUNITE-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $shelterA->id, 'capacity_limit' => 10],
                ['shelter_id' => $shelterB->id, 'capacity_limit' => 10],
            ],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $memberA = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Kovács', 'first_name' => 'Anna', 'municipality_id' => $municipality->id,
            'create_new_family' => true, 'is_primary_contact' => true,
        ])->assertCreated()->json('data');
        $familyId = $memberA['family_id'];

        $memberB = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Kovács', 'first_name' => 'Béla', 'municipality_id' => $municipality->id,
            'family_id' => $familyId,
        ])->assertCreated()->json('data');

        $publicIdA = $this->postJson("/api/persons/{$memberA['id']}/qr")->assertCreated()->json('data.public_id');
        $publicIdB = $this->postJson("/api/persons/{$memberB['id']}/qr")->assertCreated()->json('data.public_id');

        // Egyelőre nincs szétszakadás - egyikük sincs még befogadóhelyen.
        $this->getJson("/api/events/{$eventId}/families/reunification-worklist")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAsRole(RoleCode::Admin);
        $this->postJson("/api/shelters/{$shelterA->id}/checkins", ['event_id' => $eventId, 'public_id' => $publicIdA])->assertCreated();
        $this->postJson("/api/shelters/{$shelterB->id}/checkins", ['event_id' => $eventId, 'public_id' => $publicIdB])->assertCreated();

        $worklist = $this->getJson("/api/events/{$eventId}/families/reunification-worklist")->assertOk();
        $worklist->assertJsonCount(1, 'data');
        $worklist->assertJsonPath('data.0.id', $familyId);
        $worklist->assertJsonPath('data.0.notes_count', 0);

        $noteResponse = $this->postJson("/api/families/{$familyId}/reunification-notes", [
            'note' => 'Felvettük a kapcsolatot mindkét taggal, áthelyezés szervezés alatt.',
        ]);
        $noteResponse->assertCreated();
        $noteResponse->assertJsonPath('data.resolved', false);

        $notes = $this->getJson("/api/families/{$familyId}/reunification-notes")->assertOk();
        $notes->assertJsonCount(1, 'data');

        $worklistAfterNote = $this->getJson("/api/events/{$eventId}/families/reunification-worklist")->assertOk();
        $worklistAfterNote->assertJsonPath('data.0.notes_count', 1);
        $worklistAfterNote->assertJsonPath('data.0.latest_note.resolved', false);
    }

    public function test_worklist_members_include_shelter_id_and_coordinates(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $personMunicipality = Municipality::factory()->create();
        $shelterMunicipality = Municipality::factory()->create(['lat' => 47.6875, 'lng' => 17.6504]);
        $shelterA = Shelter::factory()->create(['municipality_id' => $shelterMunicipality->id]);
        $shelterB = Shelter::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-REUNITE-3',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $shelterA->id, 'capacity_limit' => 10],
                ['shelter_id' => $shelterB->id, 'capacity_limit' => 10],
            ],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $memberA = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Kis', 'first_name' => 'Anna', 'municipality_id' => $personMunicipality->id,
            'create_new_family' => true, 'is_primary_contact' => true,
        ])->assertCreated()->json('data');
        $familyId = $memberA['family_id'];

        $memberB = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Kis', 'first_name' => 'Béla', 'municipality_id' => $personMunicipality->id,
            'family_id' => $familyId,
        ])->assertCreated()->json('data');

        $publicIdA = $this->postJson("/api/persons/{$memberA['id']}/qr")->assertCreated()->json('data.public_id');
        $publicIdB = $this->postJson("/api/persons/{$memberB['id']}/qr")->assertCreated()->json('data.public_id');

        $this->actingAsRole(RoleCode::Admin);
        $this->postJson("/api/shelters/{$shelterA->id}/checkins", ['event_id' => $eventId, 'public_id' => $publicIdA])->assertCreated();
        $this->postJson("/api/shelters/{$shelterB->id}/checkins", ['event_id' => $eventId, 'public_id' => $publicIdB])->assertCreated();

        $worklist = $this->getJson("/api/events/{$eventId}/families/reunification-worklist")->assertOk();
        $members = collect($worklist->json('data.0.members'))->keyBy('id');

        $this->assertSame($shelterA->id, $members[$memberA['id']]['shelter_id']);
        $this->assertSame(47.6875, $members[$memberA['id']]['shelter_coordinates']['lat']);
        $this->assertSame(17.6504, $members[$memberA['id']]['shelter_coordinates']['lng']);
        $this->assertNull($members[$memberB['id']]['shelter_coordinates']);
    }

    public function test_shelter_operator_cannot_add_a_reunification_note(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-REUNITE-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $person = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
            'create_new_family' => true,
        ])->assertCreated()->json('data');

        $this->actingAsRole(RoleCode::ShelterOperator);
        $this->postJson("/api/families/{$person['family_id']}/reunification-notes", ['note' => 'x'])->assertForbidden();
    }
}
