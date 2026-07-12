<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Citizen;
use App\Models\Municipality;
use App\Models\Person;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Interreg tanulmány szerint a regisztráció eseményfüggő, de a tanulmányban
 * megfogalmazott igény alapján (ugyanaz a személy több kitelepítés között is
 * nyomon követhető legyen) az okmányszám alapján egy eseményfüggetlen
 * "polgár" törzsadat köti össze a regisztrációkat.
 */
class CitizenHistoryTest extends TestCase
{
    use RefreshDatabase;

    // Ha ugyanaz az okmányszám két különböző eseményben is regisztrálásra
    // kerül, a két Person-rekord ugyanahhoz az egy (eseményfüggetlen)
    // Citizen törzsadathoz kapcsolódik (nem jön létre duplikált Citizen), és
    // a citizen history végpont mindkét esemény regisztrációját visszaadja.
    public function test_same_document_number_links_registrations_across_two_events_to_one_citizen(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventAId = $this->postJson('/api/events', [
            'code' => 'EVT-CIT-A',
            'name' => 'Első esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $eventBId = $this->postJson('/api/events', [
            'code' => 'EVT-CIT-B',
            'name' => 'Második esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);

        $personA = $this->postJson("/api/events/{$eventAId}/persons", [
            'last_name' => 'Kovács',
            'first_name' => 'Béla',
            'municipality_id' => $municipality->id,
            'id_document_number' => 'ID-SHARED-1',
        ])->assertCreated()->json('data');

        $personB = $this->postJson("/api/events/{$eventBId}/persons", [
            'last_name' => 'Kovács',
            'first_name' => 'Béla',
            'municipality_id' => $municipality->id,
            'id_document_number' => 'ID-SHARED-1',
        ])->assertCreated()->json('data');

        $this->assertNotNull($personA['citizen_id']);
        $this->assertEquals($personA['citizen_id'], $personB['citizen_id']);
        $this->assertEquals(1, Citizen::where('id_document_number', 'ID-SHARED-1')->count());

        $response = $this->getJson("/api/citizens/{$personA['citizen_id']}/history")->assertOk();

        $response->assertJsonCount(2, 'data.registrations');
        $eventCodes = collect($response->json('data.registrations'))->pluck('event.code')->all();
        $this->assertContains('EVT-CIT-A', $eventCodes);
        $this->assertContains('EVT-CIT-B', $eventCodes);
    }

    // Okmányszám megadása nélkül a személyhez nem jön létre Citizen-kapcsolat
    // (citizen_id null marad), és nem keletkezik felesleges Citizen-rekord.
    public function test_person_without_document_number_has_no_citizen_link(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-CIT-C',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $person = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt',
            'first_name' => 'Elek',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data');

        $this->assertNull($person['citizen_id']);
        $this->assertSame(0, Citizen::count());
    }

    // Két eltérő okmányszámmal felvitt személy két külön Citizen-rekordot
    // kap — a törzsadat-összekapcsolás kizárólag egyező okmányszám esetén
    // történik meg, különbözőnél nem vonja össze őket.
    public function test_different_document_numbers_create_separate_citizens(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-CIT-D',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Első',
            'first_name' => 'Személy',
            'municipality_id' => $municipality->id,
            'id_document_number' => 'DOC-A',
        ])->assertCreated();

        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Második',
            'first_name' => 'Személy',
            'municipality_id' => $municipality->id,
            'id_document_number' => 'DOC-B',
        ])->assertCreated();

        $this->assertSame(2, Citizen::count());
        $this->assertSame(2, Person::count());
    }
}
