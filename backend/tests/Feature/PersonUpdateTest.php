<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Person;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PersonUpdateTest extends TestCase
{
    use RefreshDatabase;

    // Egy regisztrátor módosíthatja egy már felvett személy alapadatait, és
    // ezzel egy időben a hozzá tartozó regisztráció szállítási/elszállásolási
    // igényét is — utóbbi a registrations táblában, nem a persons táblában
    // tárolódik, ezért a controllernek szét kell választania a payloadot.
    public function test_registrar_can_update_person_fields_and_registration_transport_flags(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-PERSON-UPD-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Kovács',
            'first_name' => 'Béla',
            'municipality_id' => $municipality->id,
            'central_transport_required' => false,
            'central_accommodation_required' => false,
        ])->assertCreated()->json('data.id');

        $response = $this->putJson("/api/persons/{$personId}", [
            'last_name' => 'Kovács',
            'first_name' => 'Béláné',
            'phone' => '+36301234567',
            'central_transport_required' => true,
            'central_accommodation_required' => true,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.first_name', 'Béláné')
            ->assertJsonPath('data.phone', '+36301234567')
            ->assertJsonPath('data.registration.central_transport_required', true)
            ->assertJsonPath('data.registration.central_accommodation_required', true);

        $this->assertDatabaseHas('persons', [
            'id' => $personId,
            'first_name' => 'Béláné',
        ]);

        $person = Person::with('registration')->find($personId);
        $this->assertDatabaseHas('registrations', [
            'id' => $person->registration->id,
            'central_transport_required' => true,
            'central_accommodation_required' => true,
        ]);
    }

    // A szállítási/elszállásolási jelölők elhagyása a kérésből nem módosítja
    // a meglévő értéket (a mező "sometimes" validált, nem kötelező minden
    // frissítésnél megadni).
    public function test_omitting_transport_flags_leaves_existing_registration_values_unchanged(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-PERSON-UPD-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Nagy',
            'first_name' => 'Elek',
            'municipality_id' => $municipality->id,
            'central_transport_required' => true,
            'central_accommodation_required' => false,
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/persons/{$personId}", [
            'phone' => '+36309998877',
        ])->assertOk();

        $person = Person::with('registration')->find($personId);
        $this->assertTrue($person->registration->central_transport_required);
        $this->assertFalse($person->registration->central_accommodation_required);
    }

    // A személy módosítása jogosultsághoz kötött: befogadóhelyi kezelő
    // szerepkörrel a kérés 403-at ad.
    public function test_shelter_operator_cannot_update_person(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-PERSON-UPD-3',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Kiss', 'first_name' => 'Piroska', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::ShelterOperator);
        $this->putJson("/api/persons/{$personId}", ['first_name' => 'Más'])->assertForbidden();
    }

    // Lezárt eseményhez tartozó személy adatai már nem módosíthatók.
    public function test_person_cannot_be_updated_once_event_is_closed(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-PERSON-UPD-4',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Tóth', 'first_name' => 'Anna', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Admin);
        $this->putJson("/api/events/{$eventId}", ['status' => 'closed'])->assertOk();

        $this->actingAsRole(RoleCode::Registrar);
        $this->putJson("/api/persons/{$personId}", ['first_name' => 'Anna Mária'])->assertForbidden();
    }
}
