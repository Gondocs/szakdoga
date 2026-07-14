<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/**
 * Interreg tanulmány "Szállítási Kontroll" funkciója: felszálláskor és
 * leszálláskor is QR-kóddal azonosítják a személyt, létrehozva a digitális
 * manifesztet (ki melyik járművön utazik).
 */
class TransportManifestTest extends TestCase
{
    use RefreshDatabase;

    private function createActiveEvent(): array
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-TRANSPORT-1',
            'name' => 'Teszt kitelepítés',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        return [EvacuationEvent::findOrFail($eventId), $municipality];
    }

    // Admin/vezető szerepkörrel egy szállítóeszköz (busz) felvehető
    // névvel és kapacitással, és ténylegesen elmentésre kerül.
    public function test_admin_can_create_a_transport(): void
    {
        [$event] = $this->createActiveEvent();

        $response = $this->postJson("/api/events/{$event->id}/transports", [
            'code' => '1. sz. busz',
            'capacity' => 50,
        ]);

        $response->assertCreated()->assertJsonPath('data.code', '1. sz. busz');
        $this->assertDatabaseHas('transports', ['code' => '1. sz. busz', 'event_id' => $event->id]);
    }

    // A szállítóeszközhöz opcionálisan megadható indulási/célállomás és
    // tervezett indulási/érkezési időpont is, ezek ténylegesen elmentésre
    // kerülnek.
    public function test_transport_can_be_created_with_route_and_schedule(): void
    {
        [$event] = $this->createActiveEvent();

        $response = $this->postJson("/api/events/{$event->id}/transports", [
            'code' => '1. sz. busz',
            'capacity' => 50,
            'origin' => 'Győr, Gyülekezőpont',
            'destination' => 'Csorna, Befogadóhely',
            'departure_planned_at' => '2026-08-01 08:00:00',
            'arrival_planned_at' => '2026-08-01 09:30:00',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('data.origin', 'Győr, Gyülekezőpont');
        $response->assertJsonPath('data.destination', 'Csorna, Befogadóhely');
        $this->assertNotNull($response->json('data.departure_planned_at'));
    }

    // Egy busz kapacitásán felüli felszállás alapból tiltott (409
    // TRANSPORT_OVERCAPACITY), de "override_capacity" paraméterrel mégis
    // végrehajtható — a frontend "Mégis felszállítom" gombja is ezt hívja.
    public function test_boarding_beyond_capacity_is_blocked_unless_overridden(): void
    {
        [$event, $municipality] = $this->createActiveEvent();

        $transportId = $this->postJson("/api/events/{$event->id}/transports", [
            'code' => '1. sz. busz',
            'capacity' => 1,
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personAId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Első', 'first_name' => 'Utas', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
        $personBId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Második', 'first_name' => 'Utas', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
        $publicIdA = $this->postJson("/api/persons/{$personAId}/qr")->assertCreated()->json('data.public_id');
        $publicIdB = $this->postJson("/api/persons/{$personBId}/qr")->assertCreated()->json('data.public_id');

        $this->postJson("/api/transports/{$transportId}/board", ['public_id' => $publicIdA])->assertCreated();

        $this->postJson("/api/transports/{$transportId}/board", ['public_id' => $publicIdB])
            ->assertStatus(409)
            ->assertJsonPath('code', 'TRANSPORT_OVERCAPACITY');

        $this->postJson("/api/transports/{$transportId}/board", [
            'public_id' => $publicIdB,
            'override_capacity' => true,
        ])->assertCreated();
    }

    // A teljes fel-/leszállási ciklus: felszálláskor a regisztráció
    // "in_transport" státuszba kerül, a manifeszt (utaslista) tartalmazza
    // a személyt, ugyanazzal a QR-kóddal másodszor felszállni nem lehet
    // (409 ALREADY_ONBOARD); leszállás után a fedélzeti létszám nullára
    // csökken, a manifesztből is eltűnik, majd egy másik útra ismét
    // felszállhat ugyanaz a személy.
    public function test_board_and_alight_flow_updates_manifest_and_status(): void
    {
        [$event, $municipality] = $this->createActiveEvent();

        $transportId = $this->postJson("/api/events/{$event->id}/transports", [
            'code' => '1. sz. busz',
        ])->assertCreated()->json('data.id');

        $registrar = $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Utas',
            'first_name' => 'Elek',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        $this->postJson("/api/transports/{$transportId}/board", ['public_id' => $publicId])
            ->assertCreated();

        $this->assertDatabaseHas('registrations', ['person_id' => $personId, 'status' => 'in_transport']);
        $this->assertDatabaseHas('transport_manifest_entries', ['transport_id' => $transportId, 'person_id' => $personId]);

        $this->getJson("/api/events/{$event->id}/transports")
            ->assertOk()
            ->assertJsonPath('data.0.onboard_count', 1);

        $this->getJson("/api/transports/{$transportId}/passengers")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $personId);

        // Másodszori felszállás (még nem szállt le) ütközést jelez.
        $this->postJson("/api/transports/{$transportId}/board", ['public_id' => $publicId])
            ->assertStatus(409)
            ->assertJsonPath('code', 'ALREADY_ONBOARD');

        $this->postJson("/api/transports/{$transportId}/alight", ['public_id' => $publicId])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', ['action' => 'transport_alight']);

        $this->getJson("/api/events/{$event->id}/transports")
            ->assertOk()
            ->assertJsonPath('data.0.onboard_count', 0);

        $this->getJson("/api/transports/{$transportId}/passengers")
            ->assertOk()
            ->assertJsonCount(0, 'data');

        // Leszállás után újra fel lehet szállni (pl. egy másik viszonylatra).
        $this->postJson("/api/transports/{$transportId}/board", ['public_id' => $publicId])
            ->assertCreated();
    }

    // Szállítóeszköz létrehozása jogosultsághoz kötött: befogadóhelyi
    // kezelő szerepkörrel a kérés 403-at ad.
    public function test_shelter_operator_cannot_create_a_transport(): void
    {
        [$event] = $this->createActiveEvent();

        $this->actingAsRole(RoleCode::ShelterOperator);
        $this->postJson("/api/events/{$event->id}/transports", ['code' => 'X'])->assertForbidden();
    }

    // Felszállás rögzítése jogosultsághoz kötött: auditor szerepkörrel a
    // kérés 403-at ad.
    public function test_auditor_cannot_board_a_person(): void
    {
        [$event, $municipality] = $this->createActiveEvent();

        $transportId = $this->postJson("/api/events/{$event->id}/transports", ['code' => '1. sz. busz'])
            ->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Teszt',
            'first_name' => 'Elemér',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        $this->actingAsRole(RoleCode::Auditor);
        $this->postJson("/api/transports/{$transportId}/board", ['public_id' => $publicId])->assertForbidden();
    }

    // A pozíció szimulálása a busz úti céljához (befogadóhely)
    // hozzárendelt település rögzített koordinátáit adja vissza — nem
    // véletlenszerű vagy fix koordinátát.
    public function test_simulate_position_uses_shelter_municipality_coordinates(): void
    {
        [$event] = $this->createActiveEvent();
        $municipality = Municipality::factory()->create(['lat' => 47.6875, 'lng' => 17.6504]);
        $shelter = Shelter::factory()->create(['municipality_id' => $municipality->id]);

        $this->actingAsRole(RoleCode::Admin);
        $this->putJson("/api/events/{$event->id}", [
            'name' => $event->name,
            'status' => 'active',
            'shelters' => [['shelter_id' => $shelter->id, 'capacity_limit' => 10]],
        ])->assertOk();

        $transportId = $this->postJson("/api/events/{$event->id}/transports", ['code' => '1. sz. busz'])
            ->assertCreated()->json('data.id');

        $response = $this->postJson("/api/transports/{$transportId}/simulate-position")->assertOk();

        $this->assertNotNull($response->json('data.last_lat'));
        $this->assertNotNull($response->json('data.last_lng'));
        $this->assertEqualsWithDelta(47.6875, $response->json('data.last_lat'), 0.01);
        $this->assertEqualsWithDelta(17.6504, $response->json('data.last_lng'), 0.01);
    }

    // Ha a busznak (illetve a hozzá tartozó eseménynek/befogadóhelynek)
    // nincs koordinátája, a pozíció szimulálása 422 NO_COORDINATES hibát
    // ad ahelyett, hogy hamis/üres adatot mutatna a térképen.
    public function test_simulate_position_fails_without_shelter_coordinates(): void
    {
        [$event] = $this->createActiveEvent();

        $transportId = $this->postJson("/api/events/{$event->id}/transports", ['code' => '1. sz. busz'])
            ->assertCreated()->json('data.id');

        $this->postJson("/api/transports/{$transportId}/simulate-position")
            ->assertStatus(422)
            ->assertJsonPath('code', 'NO_COORDINATES');
    }

    // Egy CSV-utaslista (okmányszám oszloppal) importja tömegesen
    // felszállítja az egyező, előzetesen regisztrált személyeket, a nem
    // egyező okmányszámokat "not_found"-ként jelzi vissza, és egy
    // ismételt import a már fedélzeten lévőket "already_onboard"-ként
    // jelöli, nem duplikálja a felszállást.
    public function test_manifest_csv_import_boards_matched_persons_and_reports_summary(): void
    {
        [$event, $municipality] = $this->createActiveEvent();

        $transportId = $this->postJson("/api/events/{$event->id}/transports", ['code' => '1. sz. busz'])
            ->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personAId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Első',
            'first_name' => 'Utas',
            'municipality_id' => $municipality->id,
            'id_document_number' => 'DOC001',
        ])->assertCreated()->json('data.id');

        $personBId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Második',
            'first_name' => 'Utas',
            'municipality_id' => $municipality->id,
            'id_document_number' => 'DOC002',
        ])->assertCreated()->json('data.id');

        $csvContent = "Okmányszám\nDOC001\nDOC002\nDOC999\n";
        $file = UploadedFile::fake()->createWithContent('utaslista.csv', $csvContent);

        $response = $this->post("/api/transports/{$transportId}/import-manifest", ['file' => $file]);

        $response->assertOk();
        $response->assertJsonPath('data.boarded_count', 2);
        $response->assertJsonPath('data.not_found', ['DOC999']);
        $response->assertJsonPath('data.transport.onboard_count', 2);

        $this->assertDatabaseHas('transport_manifest_entries', ['transport_id' => $transportId, 'person_id' => $personAId]);
        $this->assertDatabaseHas('transport_manifest_entries', ['transport_id' => $transportId, 'person_id' => $personBId]);
        $this->assertDatabaseHas('registrations', ['person_id' => $personAId, 'status' => 'in_transport']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'transport_import']);

        // Már fedélzeten lévő személyt tartalmazó ismételt import ezt jelzi, nem duplikál.
        $csvContent2 = "Okmányszám\nDOC001\n";
        $file2 = UploadedFile::fake()->createWithContent('utaslista2.csv', $csvContent2);
        $response2 = $this->post("/api/transports/{$transportId}/import-manifest", ['file' => $file2]);
        $response2->assertJsonPath('data.already_onboard', ['DOC001']);
        $response2->assertJsonPath('data.boarded_count', 0);
    }

    // CSV-utaslista importja jogosultsághoz kötött: itt (a metódus neve
    // ellenére) auditor szerepkörrel teszteljük, hogy a kérés 403-at ad.
    public function test_shelter_operator_cannot_import_manifest(): void
    {
        [$event] = $this->createActiveEvent();
        $transportId = $this->postJson("/api/events/{$event->id}/transports", ['code' => '1. sz. busz'])
            ->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Auditor);
        $file = UploadedFile::fake()->createWithContent('utaslista.csv', "Okmányszám\nDOC001\n");
        $this->post("/api/transports/{$transportId}/import-manifest", ['file' => $file])->assertForbidden();
    }

    // Egy üres (senki nem száll rajta) szállítóeszköz módosítható (kód,
    // kapacitás) és törölhető is.
    public function test_admin_can_update_and_delete_an_empty_transport(): void
    {
        [$event] = $this->createActiveEvent();

        $transportId = $this->postJson("/api/events/{$event->id}/transports", ['code' => '1. sz. busz'])
            ->assertCreated()->json('data.id');

        $this->putJson("/api/transports/{$transportId}", ['code' => '1. sz. busz (átnevezve)', 'capacity' => 40])
            ->assertOk()
            ->assertJsonPath('data.code', '1. sz. busz (átnevezve)')
            ->assertJsonPath('data.capacity', 40);

        $this->deleteJson("/api/transports/{$transportId}")->assertNoContent();
        $this->assertDatabaseMissing('transports', ['id' => $transportId]);
    }

    // Egy olyan szállítóeszköz, amelynek van jelenleg felszállva lévő
    // utasa, nem törölhető (409 TRANSPORT_IN_USE) — adatvesztés-védelem.
    public function test_transport_with_onboard_passenger_cannot_be_deleted(): void
    {
        [$event, $municipality] = $this->createActiveEvent();

        $transportId = $this->postJson("/api/events/{$event->id}/transports", ['code' => '1. sz. busz'])
            ->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Utas', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');
        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');
        $this->postJson("/api/transports/{$transportId}/board", ['public_id' => $publicId])->assertCreated();

        $this->actingAsRole(RoleCode::Admin);
        $this->deleteJson("/api/transports/{$transportId}")
            ->assertStatus(409)
            ->assertJsonPath('code', 'TRANSPORT_IN_USE');
    }

    // Szállítóeszköz módosítása/törlése jogosultsághoz kötött: regisztrátor
    // szerepkörrel mindkét kérés 403-at ad.
    public function test_registrar_cannot_update_or_delete_a_transport(): void
    {
        [$event] = $this->createActiveEvent();

        $transportId = $this->postJson("/api/events/{$event->id}/transports", ['code' => '1. sz. busz'])
            ->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->putJson("/api/transports/{$transportId}", ['code' => 'X'])->assertForbidden();
        $this->deleteJson("/api/transports/{$transportId}")->assertForbidden();
    }
}
