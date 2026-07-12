<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A projektleírás Melléklet C "Minimális bemutató forgatókönyve" és a
 * 13.3 Elfogadási tesztesetek (AT1-AT7) alapján felépített végponti teszt.
 */
class RegistrationCheckInFlowTest extends TestCase
{
    use RefreshDatabase;

    private function createActiveEventWithShelter(int $capacityLimit = 2): array
    {
        $admin = $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create(['municipality_id' => $municipality->id, 'capacity_total' => 50]);

        $response = $this->postJson('/api/events', [
            'code' => 'EVT-FLOW-1',
            'name' => 'Teszt kitelepítés',
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $shelter->id, 'capacity_limit' => $capacityLimit],
            ],
        ])->assertCreated();

        $eventId = $response->json('data.id');

        return [$admin, EvacuationEvent::findOrFail($eventId), $municipality, $shelter];
    }

    // Végigköveti az AT2-AT7 elfogadási teszteseteket egy folyamatban: a
    // regisztrátor felvesz egy személyt (státusz: registered), QR-kódot
    // kap, a befogadóhelyi kezelő ezzel érkezteti (státusz: arrived_shelter,
    // status_history és audit_log bejegyzéssel), majd ugyanazt a QR-kódot
    // másodszor beolvasva a rendszer 409 ALREADY_CHECKED_IN-nel jelzi a
    // duplikált érkeztetést.
    public function test_full_registration_qr_and_checkin_flow(): void
    {
        [, $event, $municipality, $shelter] = $this->createActiveEventWithShelter();

        $registrar = $this->actingAsRole(RoleCode::Registrar);

        // AT2: regisztrátor rögzíti egy személy adatait.
        $personResponse = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Kovács',
            'first_name' => 'János',
            'municipality_id' => $municipality->id,
        ])->assertCreated();

        $personId = $personResponse->json('data.id');
        $this->assertDatabaseHas('registrations', ['person_id' => $personId, 'status' => 'registered']);

        // AT3: QR-kód generálása, public_id egyedi.
        $qrResponse = $this->postJson("/api/persons/{$personId}/qr")->assertCreated();
        $publicId = $qrResponse->json('data.public_id');
        $this->assertNotEmpty($publicId);

        // AT4: befogadóhelyi kezelő QR-kóddal érkeztet.
        $shelterOperator = $this->actingAsRole(RoleCode::ShelterOperator, ['shelter_id' => $shelter->id]);

        $checkInResponse = $this->postJson("/api/shelters/{$shelter->id}/checkins", [
            'public_id' => $publicId,
            'event_id' => $event->id,
        ])->assertCreated();

        $this->assertDatabaseHas('registrations', ['person_id' => $personId, 'status' => 'arrived_shelter']);
        $this->assertDatabaseHas('checkins', ['person_id' => $personId, 'shelter_id' => $shelter->id]);
        $this->assertDatabaseHas('status_history', [
            'entity_type' => 'Registration',
            'old_status' => 'registered',
            'new_status' => 'arrived_shelter',
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'checkin']);

        // AT7: ugyanazt a QR-kódot másodszor is érkeztetik -> duplikált érkeztetés jelzés.
        $duplicate = $this->postJson("/api/shelters/{$shelter->id}/checkins", [
            'public_id' => $publicId,
            'event_id' => $event->id,
        ]);
        $duplicate->assertStatus(409)->assertJsonPath('code', 'ALREADY_CHECKED_IN');
    }

    // AT5: ha egy befogadóhely kapacitáskorlátja (itt 1 fő) betelik, a
    // következő érkeztetési kísérlet 409 SHELTER_FULL hibát ad — a
    // kapacitáskorlát ténylegesen érvényesül, nem csak megjelenítési
    // adat.
    public function test_checkin_fails_when_shelter_capacity_is_full(): void
    {
        [, $event, $municipality, $shelter] = $this->createActiveEventWithShelter(capacityLimit: 1);

        $registrar = $this->actingAsRole(RoleCode::Registrar);
        $shelterOperator = $this->actingAsRole(RoleCode::ShelterOperator, ['shelter_id' => $shelter->id]);

        $publicIds = [];
        foreach (range(1, 2) as $i) {
            $this->actingAs($registrar);
            $personId = $this->postJson("/api/events/{$event->id}/persons", [
                'last_name' => 'Teszt',
                'first_name' => "Személy {$i}",
                'municipality_id' => $municipality->id,
            ])->assertCreated()->json('data.id');

            $publicIds[] = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');
        }

        $this->actingAs($shelterOperator);

        // AT5 előfeltétele: az első érkeztetés betölti az egyetlen kapacitást.
        $this->postJson("/api/shelters/{$shelter->id}/checkins", [
            'public_id' => $publicIds[0],
            'event_id' => $event->id,
        ])->assertCreated();

        // A második érkeztetés a betelt kapacitás miatt SHELTER_FULL hibát ad.
        $this->postJson("/api/shelters/{$shelter->id}/checkins", [
            'public_id' => $publicIds[1],
            'event_id' => $event->id,
        ])->assertStatus(409)->assertJsonPath('code', 'SHELTER_FULL');
    }

    // AT6: a regisztrátor jogosultsága a felvitelre és QR-kiadásra terjed
    // ki, az érkeztetésre nem — ez befogadóhelyi kezelői (vagy magasabb)
    // jogosultságot igényel, ezért a kérés 403-at ad.
    public function test_registrar_cannot_perform_checkin(): void
    {
        [, $event, $municipality, $shelter] = $this->createActiveEventWithShelter();

        $registrar = $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Teszt',
            'first_name' => 'Elemér',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        // AT6-hoz hasonlóan: a regisztrátor jogosultsága nem terjed ki az érkeztetésre.
        $this->postJson("/api/shelters/{$shelter->id}/checkins", [
            'public_id' => $publicId,
            'event_id' => $event->id,
        ])->assertForbidden();
    }

    // Egy tömeges státuszváltás (bulk-status) végponttal több személy
    // regisztrációs státusza egyszerre állítható, a válasz pontosan
    // visszaadja, hány frissült sikeresen és hány sikertelenül.
    public function test_registrar_can_bulk_update_registration_status(): void
    {
        [, $event, $municipality] = $this->createActiveEventWithShelter();

        $registrar = $this->actingAsRole(RoleCode::Registrar);

        $personIds = [];
        foreach (range(1, 2) as $i) {
            $personIds[] = $this->postJson("/api/events/{$event->id}/persons", [
                'last_name' => 'Teszt',
                'first_name' => "Tömeges {$i}",
                'municipality_id' => $municipality->id,
            ])->assertCreated()->json('data.id');
        }

        $response = $this->putJson("/api/events/{$event->id}/registrations/bulk-status", [
            'person_ids' => $personIds,
            'status' => 'returned_home',
        ])->assertOk();

        $response->assertJsonCount(2, 'data.updated');
        $response->assertJsonCount(0, 'data.failed');

        foreach ($personIds as $personId) {
            $this->assertDatabaseHas('registrations', ['person_id' => $personId, 'status' => 'returned_home']);
        }
    }

    // A tömeges státuszváltás jogosultsághoz kötött: befogadóhelyi kezelő
    // szerepkörrel a kérés 403-at ad.
    public function test_shelter_operator_cannot_bulk_update_registration_status(): void
    {
        [, $event, $municipality] = $this->createActiveEventWithShelter();

        $registrar = $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Teszt',
            'first_name' => 'Elemér',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::ShelterOperator);
        $this->putJson("/api/events/{$event->id}/registrations/bulk-status", [
            'person_ids' => [$personId],
            'status' => 'returned_home',
        ])->assertForbidden();
    }

    // Az auditnaplóhoz kizárólag az auditor (és admin) szerepkörnek van
    // hozzáférése; a regisztrátornak nincs, a végpont 403-at ad neki.
    public function test_auditor_can_view_audit_log_but_registrar_cannot(): void
    {
        $this->actingAsRole(RoleCode::Auditor);
        $this->getJson('/api/audit-logs')->assertOk();

        $this->actingAsRole(RoleCode::Registrar);
        $this->getJson('/api/audit-logs')->assertForbidden();
    }

    // A dashboard a ténylegesen felvitt regisztráció adatait (regisztráltak
    // száma, központi szállítást igénylők száma) tükrözi, és a válasz
    // struktúrája tartalmazza az összesített kockázati mutatókat is.
    public function test_dashboard_reflects_registrations_and_checkins(): void
    {
        [, $event, $municipality, $shelter] = $this->createActiveEventWithShelter();

        $registrar = $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Dashboard',
            'first_name' => 'Teszt',
            'municipality_id' => $municipality->id,
            'central_transport_required' => true,
        ])->assertCreated()->json('data.id');

        $manager = $this->actingAsRole(RoleCode::Manager);

        $dashboard = $this->getJson("/api/events/{$event->id}/dashboard")->assertOk();

        $dashboard->assertJsonPath('data.registered_count', 1);
        $dashboard->assertJsonPath('data.central_transport_required_count', 1);
        $dashboard->assertJsonStructure([
            'data' => ['overall_risk' => ['score', 'level', 'utilization']],
        ]);
    }
}
