<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Family;
use App\Models\Municipality;
use App\Models\Person;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PersonFamilyRegistrationTest extends TestCase
{
    use RefreshDatabase;

    // A helyszíni regisztrátor egyetlen kéréssel felvehet egy egész
    // családot, mindenkit saját adatlappal — mindannyian egy új,
    // közösen létrehozott családhoz kerülnek, és az első tag lesz a
    // kapcsolattartó.
    public function test_registrar_can_register_a_family_together_in_one_request(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-FAM-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);

        $response = $this->postJson("/api/events/{$eventId}/persons/family", [
            'create_new_family' => true,
            'members' => [
                ['last_name' => 'Kovács', 'first_name' => 'Anna', 'municipality_id' => $municipality->id],
                ['last_name' => 'Kovács', 'first_name' => 'Béla', 'municipality_id' => $municipality->id],
            ],
        ]);

        $response->assertCreated();
        $this->assertCount(2, $response->json('data'));

        $persons = Person::where('last_name', 'Kovács')->get();
        $this->assertCount(2, $persons);
        $familyIds = $persons->pluck('family_id')->unique();
        $this->assertCount(1, $familyIds);

        $family = Family::findOrFail($familyIds->first());
        $anna = $persons->firstWhere('first_name', 'Anna');
        $this->assertSame($anna->id, $family->primary_contact_person_id);
    }

    // Ha a kérés egy már létező family_id-t ad meg (nem
    // create_new_family-t), az összes új tag ehhez a meglévő családhoz
    // csatlakozik, a család korábbi kapcsolattartója változatlan marad.
    public function test_family_members_can_join_an_existing_family(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-FAM-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $firstPersonId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Szabó', 'first_name' => 'Eszter', 'municipality_id' => $municipality->id,
            'create_new_family' => true, 'is_primary_contact' => true,
        ])->assertCreated()->json('data.id');
        $familyId = Person::findOrFail($firstPersonId)->family_id;

        $this->postJson("/api/events/{$eventId}/persons/family", [
            'family_id' => $familyId,
            'members' => [
                ['last_name' => 'Szabó', 'first_name' => 'Dániel', 'municipality_id' => $municipality->id],
                ['last_name' => 'Szabó', 'first_name' => 'Fanni', 'municipality_id' => $municipality->id],
            ],
        ])->assertCreated();

        $family = Family::findOrFail($familyId);
        $this->assertSame($firstPersonId, $family->primary_contact_person_id);
        $this->assertSame(3, Person::where('family_id', $familyId)->count());
    }

    // Legalább egy családtag megadása kötelező.
    public function test_family_registration_requires_at_least_one_member(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-FAM-3',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons/family", ['members' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['members']);
    }

    // Befogadóhelyi kezelő nem vehet fel új családi regisztrációt.
    public function test_shelter_operator_cannot_register_a_family(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-FAM-4',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::ShelterOperator);
        $this->postJson("/api/events/{$eventId}/persons/family", [
            'members' => [['last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id]],
        ])->assertForbidden();
    }
}
