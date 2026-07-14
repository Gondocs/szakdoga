<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Interreg tanulmány "Ideiglenes eltávozás és visszaérkezés kezelése" és
 * "Áthelyezés másik befogadóhelyre" funkciói.
 */
class ShelterTransferTest extends TestCase
{
    use RefreshDatabase;

    // Egy már befogadóhelyen lévő személy másik befogadóhelyre áthelyezhető
    // — a régi befogadóhely kapacitása felszabadul (checked_in_count: 0),
    // az újé lefoglalódik (1), és az áthelyezés naplózódik
    // ("shelter_transfer" akcióként).
    public function test_person_can_be_transferred_to_another_shelter(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelterA = Shelter::factory()->create(['capacity_total' => 50]);
        $shelterB = Shelter::factory()->create(['capacity_total' => 50]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-TRANSFER-1',
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

        $response = $this->postJson("/api/persons/{$personId}/transfer", ['shelter_id' => $shelterB->id]);
        $response->assertCreated();
        $response->assertJsonPath('data.shelter.id', $shelterB->id);

        $this->assertDatabaseHas('registrations', ['person_id' => $personId, 'status' => 'arrived_shelter']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'shelter_transfer']);

        $sheltersResponse = $this->getJson("/api/events/{$eventId}/shelters")->assertOk();
        $rows = collect($sheltersResponse->json('data'))->keyBy(fn ($r) => $r['shelter']['id']);
        $this->assertSame(0, $rows[$shelterA->id]['checked_in_count']);
        $this->assertSame(1, $rows[$shelterB->id]['checked_in_count']);
    }

    // Betelt kapacitású befogadóhelyre az áthelyezés alapból tiltott (409
    // SHELTER_FULL), de "override_capacity" paraméterrel — ami csak
    // admin/vezető jogosultsággal érvényesül — mégis végrehajtható.
    public function test_transfer_to_a_full_shelter_is_blocked_unless_overridden(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelterA = Shelter::factory()->create(['capacity_total' => 50]);
        $shelterB = Shelter::factory()->create(['capacity_total' => 50]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-TRANSFER-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $shelterA->id, 'capacity_limit' => 10],
                ['shelter_id' => $shelterB->id, 'capacity_limit' => 1],
            ],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        $otherPersonId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Foglaló', 'first_name' => 'Elem', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
        $otherPublicId = $this->postJson("/api/persons/{$otherPersonId}/qr")->assertCreated()->json('data.public_id');

        $this->actingAsRole(RoleCode::Admin);
        $this->postJson("/api/shelters/{$shelterA->id}/checkins", ['event_id' => $eventId, 'public_id' => $publicId])->assertCreated();
        $this->postJson("/api/shelters/{$shelterB->id}/checkins", ['event_id' => $eventId, 'public_id' => $otherPublicId])->assertCreated();

        $this->postJson("/api/persons/{$personId}/transfer", ['shelter_id' => $shelterB->id])
            ->assertStatus(409)
            ->assertJsonPath('code', 'SHELTER_FULL');

        $this->postJson("/api/persons/{$personId}/transfer", [
            'shelter_id' => $shelterB->id,
            'override_capacity' => true,
        ])->assertCreated();
    }

    // Egy befogadóhelyen tartózkodó személy ideiglenes eltávozása és
    // visszaérkezése is rögzíthető, mindkettő időbélyeggel.
    public function test_temporary_leave_and_return_are_recorded(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create(['capacity_total' => 50]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-TRANSFER-3',
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
        $this->postJson("/api/shelters/{$shelter->id}/checkins", ['event_id' => $eventId, 'public_id' => $publicId])->assertCreated();

        $leaveResponse = $this->postJson("/api/persons/{$personId}/temporary-leave");
        $leaveResponse->assertOk();
        $this->assertNotNull($leaveResponse->json('data.temporary_leave_at'));

        $returnResponse = $this->postJson("/api/persons/{$personId}/temporary-return");
        $returnResponse->assertOk();
        $this->assertNotNull($returnResponse->json('data.temporary_return_at'));
    }

    // Az ágy/szoba azonosító (bed_label) megadható már az érkeztetéskor és
    // az áthelyezéskor is, majd utólag, egy külön PATCH hívással is
    // módosítható — mindhárom út ténylegesen elmenti a megadott értéket.
    public function test_bed_label_can_be_set_on_checkin_and_transfer_and_updated_afterwards(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelterA = Shelter::factory()->create(['capacity_total' => 50]);
        $shelterB = Shelter::factory()->create(['capacity_total' => 50]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-TRANSFER-4',
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
        $checkInResponse = $this->postJson("/api/shelters/{$shelterA->id}/checkins", [
            'event_id' => $eventId,
            'public_id' => $publicId,
            'bed_label' => 'A terem, 3. ágy',
        ]);
        $checkInResponse->assertCreated();
        $checkInResponse->assertJsonPath('data.bed_label', 'A terem, 3. ágy');

        $transferResponse = $this->postJson("/api/persons/{$personId}/transfer", [
            'shelter_id' => $shelterB->id,
            'bed_label' => 'B terem, 7. ágy',
        ]);
        $transferResponse->assertCreated();
        $transferResponse->assertJsonPath('data.bed_label', 'B terem, 7. ágy');

        $updateResponse = $this->patchJson("/api/persons/{$personId}/bed-assignment", ['bed_label' => 'C terem, 1. ágy']);
        $updateResponse->assertOk();
        $updateResponse->assertJsonPath('data.bed_label', 'C terem, 1. ágy');

        $this->assertDatabaseHas('checkins', ['person_id' => $personId, 'bed_label' => 'C terem, 1. ágy']);
    }

    // Amíg a család egyetlen érkezett tagja van, nincs szétszakadási
    // figyelmeztetés; amint egy másik tag egy MÁSIK befogadóhelyre
    // érkezik, a check-in válasz figyelmeztetést ad (a másik tag nevét is
    // tartalmazva); miután a szétvált tagot átirányítják ugyanoda, ahol a
    // család többi tagja van, a figyelmeztetés eltűnik — a mutató a
    // ténylegesen aktuális állapotot tükrözi, nem egy egyszeri jelzést.
    public function test_family_split_warning_is_returned_on_checkin_and_cleared_after_transfer_to_same_shelter(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelterA = Shelter::factory()->create(['capacity_total' => 50]);
        $shelterB = Shelter::factory()->create(['capacity_total' => 50]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-SPLIT-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $shelterA->id, 'capacity_limit' => 10],
                ['shelter_id' => $shelterB->id, 'capacity_limit' => 10],
            ],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $primary = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Nagy', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
            'create_new_family' => true,
            'is_primary_contact' => true,
        ])->assertCreated()->json('data');
        $familyId = $primary['family_id'];
        $primaryPublicId = $this->postJson("/api/persons/{$primary['id']}/qr")->assertCreated()->json('data.public_id');

        $member = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Nagy', 'first_name' => 'Ibolya', 'municipality_id' => $municipality->id,
            'family_id' => $familyId,
        ])->assertCreated()->json('data');
        $memberPublicId = $this->postJson("/api/persons/{$member['id']}/qr")->assertCreated()->json('data.public_id');

        $this->actingAsRole(RoleCode::Admin);

        // Az elsődleges kapcsolattartó az A befogadóhelyre érkezik — még nincs kivel szétválnia.
        $primaryCheckIn = $this->postJson("/api/shelters/{$shelterA->id}/checkins", ['event_id' => $eventId, 'public_id' => $primaryPublicId]);
        $primaryCheckIn->assertCreated();
        $this->assertNull($primaryCheckIn->json('family_split_warning'));

        // A családtag a B befogadóhelyre érkezik — a válasznak jeleznie kell a szétválást.
        $memberCheckIn = $this->postJson("/api/shelters/{$shelterB->id}/checkins", ['event_id' => $eventId, 'public_id' => $memberPublicId]);
        $memberCheckIn->assertCreated();
        $this->assertNotNull($memberCheckIn->json('family_split_warning'));
        $this->assertStringContainsString('Nagy Elek', $memberCheckIn->json('family_split_warning'));

        // Áthelyezés ugyanoda, ahol a család többi tagja van — a figyelmeztetésnek el kell tűnnie.
        $transferResponse = $this->postJson("/api/persons/{$member['id']}/transfer", ['shelter_id' => $shelterA->id]);
        $transferResponse->assertCreated();
        $this->assertNull($transferResponse->json('family_split_warning'));
    }
}
