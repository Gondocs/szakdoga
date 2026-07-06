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
}
