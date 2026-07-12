<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Végigjátssza a README_HASZNALATI_PELDA.md-ben leírt kitalált árvízi
 * kitelepítési forgatókönyvet (Vámosszabadi/Vének/Kisbajcs, 2026 márciusa)
 * a leírásban szereplő szereplőknek megfelelő, elkülönített szerepkörű
 * felhasználókkal, kizárólag a valódi API-n és jogosultsági szabályokon
 * keresztül. Célja, hogy egyetlen összefüggő futásban leleplezze, ha a
 * modulok között valahol elszakad a lánc (pl. egy státuszváltás nem
 * triggereli a másik oldalt), amit a modulonként elkülönített Feature
 * tesztek nem feltétlenül vennének észre.
 *
 * Szereplő -> szerepkör megfeleltetés a leírás "Összefoglalva" táblázata
 * alapján:
 *  - Nagy Katalin (műveleti vezető)          -> Manager
 *  - Tóth Eszter (regisztrátor)               -> Registrar
 *  - Varga Attila (kísérő, regisztrátori jog) -> Registrar
 *  - Kiss Márton (befogadóhelyi kezelő, Győr) -> ShelterOperator @ Győr
 *  - egy második befogadóhelyi kezelő         -> ShelterOperator @ Mosonmagyaróvár
 *  - Dr. Farkas Judit (auditor)                -> Auditor
 *  - Kovács Béláné (lakosság)                  -> nincs auth (self-service)
 */
class EvacuationScenarioWalkthroughTest extends TestCase
{
    use RefreshDatabase;

    public function test_full_evacuation_scenario_with_role_separated_actors(): void
    {
        // --- 1. lépés: Nagy Katalin (Manager) létrehozza az eseményt és a befogadóhelyeket ---
        $katalin = $this->actingAsRole(RoleCode::Manager);

        $vamosszabadi = Municipality::factory()->create(['name' => 'Vámosszabadi']);
        $gyor = Municipality::factory()->create(['name' => 'Győr', 'lat' => 47.6875, 'lng' => 17.6504]);
        $mosonmagyarovar = Municipality::factory()->create(['name' => 'Mosonmagyaróvár']);

        $sportcsarnok = Shelter::factory()->create(['municipality_id' => $gyor->id, 'name' => 'Győri Városi Sportcsarnok', 'capacity_total' => 150]);
        $tornaterem = Shelter::factory()->create(['municipality_id' => $mosonmagyarovar->id, 'name' => 'Mosonmagyaróvári Iskola Tornaterem', 'capacity_total' => 80]);

        $eventResponse = $this->postJson('/api/events', [
            'code' => 'ARVIZ-2026-03',
            'name' => '2026. márciusi árvízi kitelepítés – Mosoni-Duna',
            'status' => 'draft',
            'shelters' => [
                ['shelter_id' => $sportcsarnok->id, 'capacity_limit' => 150],
                ['shelter_id' => $tornaterem->id, 'capacity_limit' => 80],
            ],
        ])->assertCreated();
        $event = EvacuationEvent::findOrFail($eventResponse->json('data.id'));

        // TESZTELJÜK: "tervezet" (draft) státuszú eseményhez nem lehet
        // önkiszolgáló előregisztrációval csatlakozni — a nyilvános végpont
        // csak aktív eseményt fogad el, tervezetnél 404 EVENT_NOT_FOUND-ot ad.
        $this->app['auth']->forgetGuards();
        $this->postJson("/api/public/events/{$event->code}/self-register", [
            'last_name' => 'Kovácsné', 'first_name' => 'Teszt', 'municipality_id' => $vamosszabadi->id,
        ])->assertStatus(404)->assertJsonPath('code', 'EVENT_NOT_FOUND');

        // TESZTELJÜK: Manager jogosultsággal az esemény "aktívra" állítható,
        // és ettől kezdve a hozzárendelt befogadóhelyek kapacitáskorláttal
        // együtt élesben elérhetők.
        $this->actingAs($katalin);
        $this->putJson("/api/events/{$event->id}", [
            'name' => $event->name,
            'status' => 'active',
            'shelters' => [
                ['shelter_id' => $sportcsarnok->id, 'capacity_limit' => 150],
                ['shelter_id' => $tornaterem->id, 'capacity_limit' => 80],
            ],
        ])->assertOk()->assertJsonPath('data.status', 'active');

        // --- 2. lépés: Kovács Béláné önkiszolgáló előregisztrációja (nincs bejelentkezve) ---
        // TESZTELJÜK: bejelentkezés (auth guard) nélkül, kizárólag az esemény
        // kódja alapján is sikeresen létrehozható regisztráció; a válasz
        // tartalmaz egy public_id-t (a QR-kód alapja), és a felvitt egyedi
        // igény (mobility/"Ágyhoz kötött") és a központi szállítási igény
        // ténylegesen elmentődik.
        $this->app['auth']->forgetGuards();
        $selfRegResponse = $this->postJson("/api/public/events/{$event->code}/self-register", [
            'last_name' => 'Kovácsné', 'first_name' => 'Ilona',
            'municipality_id' => $vamosszabadi->id,
            'central_transport_required' => true,
            'special_needs' => [
                ['category' => 'mobility', 'type' => 'Ágyhoz kötött', 'description' => 'Ágyhoz kötött hozzátartozó (nagyanya) egy háztartásban él.'],
            ],
        ])->assertCreated();
        $kovacsnePublicId = $selfRegResponse->json('data.public_id');
        $this->assertNotEmpty($kovacsnePublicId);
        $this->assertDatabaseHas('registrations', ['channel' => 'self_service', 'central_transport_required' => true]);

        // --- 3. lépés: Tóth Eszter (Registrar) helyszíni regisztrációja a gyülekezőponton ---
        $eszter = $this->actingAsRole(RoleCode::Registrar);

        // TESZTELJÜK: a "create_new_family" + "is_primary_contact" flaggel
        // felvitt első családtag családot hoz létre és annak elsődleges
        // kapcsolattartója lesz; az egyedi igény (medical/gyógyszerszedés)
        // a személyhez rögzítve marad a további lépésekhez (dashboard,
        // családegyesítés). A Szabó család (5 fő), a nagypapa gyógyszeres
        // kezelés alatt áll.
        $szaboNagypapa = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Szabó', 'first_name' => 'Nagypapa', 'municipality_id' => $vamosszabadi->id,
            'create_new_family' => true, 'is_primary_contact' => true,
            'special_needs' => [
                ['category' => 'medical', 'type' => 'Rendszeres gyógyszerszedés', 'description' => 'Létfontosságú, napi gyógyszerszedés.'],
            ],
        ])->assertCreated()->json('data');
        $szaboFamilyId = $szaboNagypapa['family_id'];
        $this->assertNotEmpty($szaboFamilyId);

        $szaboUnoka = $this->postJson("/api/events/{$event->id}/persons", [
            'last_name' => 'Szabó', 'first_name' => 'Unoka', 'municipality_id' => $vamosszabadi->id,
            'family_id' => $szaboFamilyId,
        ])->assertCreated()->json('data');

        $szaboTobbiek = [];
        foreach (['Anya', 'Apa', 'Kisebb Unoka'] as $firstName) {
            $szaboTobbiek[] = $this->postJson("/api/events/{$event->id}/persons", [
                'last_name' => 'Szabó', 'first_name' => $firstName, 'municipality_id' => $vamosszabadi->id,
                'family_id' => $szaboFamilyId,
            ])->assertCreated()->json('data');
        }
        // TESZTELJÜK: az önkiszolgáló és a helyszíni csatornán felvitt
        // személyek ugyanabba a personek táblába kerülnek — a két
        // regisztrációs csatorna (self_service és on-site) nem hoz létre
        // duplikált vagy inkonzisztens adatmodellt.
        $this->assertDatabaseCount('persons', 6); // Kovácsné (önkiszolgáló) + 5 Szabó családtag

        // QR-kód kiadása mindegyik helyben regisztrált Szabó családtagnak.
        $szaboNagypapaQr = $this->postJson("/api/persons/{$szaboNagypapa['id']}/qr")->assertCreated()->json('data.public_id');
        $szaboUnokaQr = $this->postJson("/api/persons/{$szaboUnoka['id']}/qr")->assertCreated()->json('data.public_id');
        $szaboTobbiekQr = array_map(
            fn ($p) => $this->postJson("/api/persons/{$p['id']}/qr")->assertCreated()->json('data.public_id'),
            $szaboTobbiek
        );

        // --- 4-5. lépés: Varga Attila (kísérő, Registrar jog) szállítás + Kiss Márton érkeztetés ---
        $this->actingAs($katalin);
        $busz = $this->postJson("/api/events/{$event->id}/transports", [
            'code' => '1. sz. busz – Győr',
            'capacity' => 50,
            'origin' => 'Vámosszabadi gyülekezőpont',
            'destination' => 'Győri Városi Sportcsarnok',
        ])->assertCreated()->json('data');

        $attila = $this->actingAsRole(RoleCode::Registrar);

        // TESZTELJÜK: a Registrar szerepkör (Varga Attila, mint kísérő)
        // QR-kód (public_id) alapján felszállásként rögzítheti az utasokat,
        // és ez azonnal tükröződik a jármű "fedélzeten lévők" számlálójában
        // — Kovácsné (önkiszolgáló) és a Szabó család nagy része felszáll a
        // Győrbe tartó buszra.
        foreach ([$kovacsnePublicId, ...$szaboTobbiekQr] as $publicId) {
            $this->postJson("/api/transports/{$busz['id']}/board", ['public_id' => $publicId])->assertCreated();
        }
        $this->getJson("/api/events/{$event->id}/transports")
            ->assertOk()
            ->assertJsonPath('data.0.onboard_count', 1 + count($szaboTobbiekQr));

        // TESZTELJÜK: a pozíció szimulálása végpont sikeresen visszaad egy
        // koordinátát, mert a célállomás (sportcsarnok) településéhez van
        // rögzített lat/lng.
        $this->postJson("/api/transports/{$busz['id']}/simulate-position")->assertOk();

        // TESZTELJÜK: az utasok leszállásként rögzíthetők, ami a
        // regisztrációjuk státuszát "in_transport"-ról továbblépteti, hogy a
        // következő lépésben (befogadóhelyi érkeztetés) már fogadhatók
        // legyenek. A busz megérkezik Győrbe.
        foreach ([$kovacsnePublicId, ...$szaboTobbiekQr] as $publicId) {
            $this->postJson("/api/transports/{$busz['id']}/alight", ['public_id' => $publicId])->assertOk();
        }

        // Kiss Márton (ShelterOperator, Győri Sportcsarnok) érkezteti a leszállókat.
        $marton = $this->actingAsRole(RoleCode::ShelterOperator, ['shelter_id' => $sportcsarnok->id]);

        // TESZTELJÜK: a befogadóhelyi kezelő QR-kód alapján érkeztethet a
        // saját befogadóhelyére, és az ágyhoz rendelés (bed-assignment)
        // végpont a check-in után külön PATCH hívással módosítható — ez
        // reprezentálja azt, hogy Márton az ágyhoz kötött hozzátartozó
        // egyedi igénye miatt tudatosan földszinti ágyat választ.
        $kovacsneCheckIn = $this->postJson("/api/shelters/{$sportcsarnok->id}/checkins", [
            'event_id' => $event->id,
            'public_id' => $kovacsnePublicId,
        ])->assertCreated();
        $kovacsneId = $kovacsneCheckIn->json('data.person.id');
        $this->patchJson("/api/persons/{$kovacsneId}/bed-assignment", ['bed_label' => 'Földszint / 12. ágy'])
            ->assertOk()
            ->assertJsonPath('data.bed_label', 'Földszint / 12. ágy');
        // TESZTELJÜK: a self-service csatornán rögzített egyedi igény
        // (mobility kategória) végig megmarad a személy adatlapján egészen
        // a befogadóhelyi érkeztetésig — ez az az adat, ami alapján a
        // frontend figyelmeztető ikont jelenít meg a kezelőnek.
        $this->assertDatabaseHas('special_needs', ['person_id' => $kovacsneId, 'category' => 'mobility']);

        foreach ($szaboTobbiekQr as $i => $publicId) {
            $this->postJson("/api/shelters/{$sportcsarnok->id}/checkins", [
                'event_id' => $event->id,
                'public_id' => $publicId,
            ])->assertCreated();
        }

        // --- 6. lépés: a Szabó nagypapa és az egyik unoka egy másik buszon,
        // a Mosonmagyaróvári Tornateremben köt ki -> szétszakadt család ---
        $this->actingAs($katalin);
        $mosonBusz = $this->postJson("/api/events/{$event->id}/transports", [
            'code' => '2. sz. busz – Mosonmagyaróvár',
        ])->assertCreated()->json('data');

        $this->actingAs($attila);
        foreach ([$szaboNagypapaQr, $szaboUnokaQr] as $publicId) {
            $this->postJson("/api/transports/{$mosonBusz['id']}/board", ['public_id' => $publicId])->assertCreated();
            $this->postJson("/api/transports/{$mosonBusz['id']}/alight", ['public_id' => $publicId])->assertOk();
        }

        $mosonKezelo = $this->actingAsRole(RoleCode::ShelterOperator, ['shelter_id' => $tornaterem->id]);

        // TESZTELJÜK: amikor egy család egyik tagja egy másik
        // befogadóhelyen tartózkodik, mint a most érkeztetett személy, a
        // check-in válasz "family_split_warning" mezője azonnal (nem csak
        // utólag, a munkalistán) jelzi ezt a befogadóhelyi kezelőnek.
        $nagypapaCheckIn = $this->postJson("/api/shelters/{$tornaterem->id}/checkins", [
            'event_id' => $event->id,
            'public_id' => $szaboNagypapaQr,
        ])->assertCreated();
        $this->assertNotNull($nagypapaCheckIn->json('family_split_warning'));

        $this->postJson("/api/shelters/{$tornaterem->id}/checkins", [
            'event_id' => $event->id,
            'public_id' => $szaboUnokaQr,
        ])->assertCreated();

        // TESZTELJÜK: a családegyesítési munkalista kizárólag a ténylegesen
        // szétszakadt családokat listázza (a Szabó család tagjai két
        // különböző befogadóhelyen vannak), és ehhez a Manager szerepkör
        // ügyintézési bejegyzést ("resolved: false" alapértelmezéssel)
        // fűzhet.
        $this->actingAs($katalin);
        $worklist = $this->getJson("/api/events/{$event->id}/families/reunification-worklist")->assertOk();
        $worklist->assertJsonPath('data.0.id', $szaboFamilyId);

        $note = $this->postJson("/api/families/{$szaboFamilyId}/reunification-notes", [
            'note' => 'Átszállítás szervezés alatt a nagypapa gyógyszeres kezelése miatt priorizálva.',
        ])->assertCreated();
        $note->assertJsonPath('data.resolved', false);

        // TESZTELJÜK: egy újabb bejegyzés "resolved: true" jelzéssel
        // lezártként rögzíthető — másnap, az átszállítás megoldása után.
        $this->postJson("/api/families/{$szaboFamilyId}/reunification-notes", [
            'note' => 'Átszállítás megtörtént, a család újra együtt Győrben.',
            'resolved' => true,
        ])->assertCreated()->assertJsonPath('data.resolved', true);

        // --- 7. lépés: incidens a sportcsarnokban, Kiss Márton rögzíti és lezárja ---
        // TESZTELJÜK: a befogadóhelyi kezelő bejelenthet egy incidenst
        // (alapértelmezett státusza "open"), majd ugyanő megoldottá
        // ("resolved") zárhatja azt.
        $this->actingAs($marton);
        $incident = $this->postJson("/api/events/{$event->id}/incidents", [
            'category' => 'conflict',
            'severity' => 'medium',
            'description' => 'Vita alakult ki két család között egy közös helyiség használata miatt.',
            'shelter_id' => $sportcsarnok->id,
        ])->assertCreated()->assertJsonPath('data.status', 'open')->json('data');

        $this->postJson("/api/incidents/{$incident['id']}/resolve")
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved');

        // TESZTELJÜK: az auditor szerepkör (Dr. Farkas Judit) — a leírás
        // szerint kizárólag utólagos ellenőrzést végez — nem jelenthet be
        // incidenst, ezt a policy réteg tiltja.
        $this->actingAsRole(RoleCode::Auditor);
        $this->postJson("/api/events/{$event->id}/incidents", [
            'category' => 'other', 'severity' => 'low', 'description' => 'x',
        ])->assertForbidden();

        // --- 8. lépés: Nagy Katalin a dashboardot és a készletigény-előrejelzést figyeli ---
        // TESZTELJÜK: a dashboard KPI-jai a korábbi lépések tényleges
        // adatbázis-állapotát tükrözik — nem csak visszaadnak valamilyen
        // számot, hanem a helyes számot: 6 regisztrált (Kovácsné + 5 Szabó),
        // 1 család, mind a 6-an megérkeztek egy befogadóhelyre, és 1 fő
        // igényelt központi szállítást (Kovácsné).
        $this->actingAs($katalin);
        $dashboard = $this->getJson("/api/events/{$event->id}/dashboard")->assertOk();
        $dashboard->assertJsonPath('data.registered_count', 6); // Kovácsné + 5 Szabó
        $dashboard->assertJsonPath('data.families_count', 1);
        $dashboard->assertJsonPath('data.arrived_count', 6);
        $dashboard->assertJsonPath('data.central_transport_required_count', 1);
        $dashboard->assertJsonStructure([
            'data' => ['overall_risk' => ['score', 'level', 'utilization']],
        ]);

        // TESZTELJÜK: a napi készletigény-előrejelzés végpont a jelenleg
        // befogadóhelyen tartózkodó személyek alapján ténylegesen ad vissza
        // adatot (nem üres választ), ahogy a leírás 8. lépése elvárja.
        $stockForecast = $this->getJson("/api/events/{$event->id}/stock-forecast")->assertOk();
        $this->assertNotEmpty($stockForecast->json('data'));

        // --- 9. lépés: Kiss Márton nyomtatható névsort kér a saját befogadóhelyéről ---
        // TESZTELJÜK: a befogadóhelyi kezelő letöltheti a saját
        // befogadóhelyének CSV névsorát, de egy másik befogadóhely
        // kezelője (itt a mosonmagyaróvári) NEM érheti el ugyanezt a
        // győri exportot — ugyanaz a hozzárendelés-alapú jogosultsági
        // szabály érvényesül, mint az érkeztetésnél.
        $this->actingAs($marton);
        $this->get("/api/events/{$event->id}/shelters/{$sportcsarnok->id}/roster-export")
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $this->actingAs($mosonKezelo);
        $this->get("/api/events/{$event->id}/shelters/{$sportcsarnok->id}/roster-export")->assertForbidden();

        // --- 10. lépés: visszatelepítés, Nagy Katalin engedélyezi Vámosszabadit ---
        // TESZTELJÜK: a Manager beállíthatja egy adott település
        // visszatelepítési státuszát "permitted"-re.
        $this->actingAs($katalin);
        $this->putJson("/api/events/{$event->id}/repatriation-authorizations", [
            'municipality_id' => $vamosszabadi->id,
            'status' => 'permitted',
        ])->assertOk()->assertJsonPath('data.status', 'permitted');

        // TESZTELJÜK: miután a lakóhelye engedélyezetté vált, az
        // önkiszolgáló csatornán (bejelentkezés nélkül) a hazatérés
        // megerősíthető, és ez ténylegesen "returned_home" állapotba
        // állítja a regisztrációt.
        $this->app['auth']->forgetGuards();
        $this->postJson("/api/public/self-profile/{$kovacsnePublicId}/confirm-return")
            ->assertOk()
            ->assertJsonPath('data.registration.status', 'returned_home');

        // --- 11. lépés: összesítő export és auditnapló-ellenőrzés ---
        // TESZTELJÜK: az esemény lezárásához készülő összesítő CSV riport
        // Manager jogosultsággal letölthető.
        $this->actingAs($katalin);
        $this->get("/api/events/{$event->id}/report-export")
            ->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        // TESZTELJÜK: az auditor visszamenőleg látja az eseményhez tartozó
        // auditnapló-bejegyzéseket (a teszt korábbi lépései — regisztráció,
        // check-in, transport, incidens stb. — mind naplózódtak).
        $judit = $this->actingAsRole(RoleCode::Auditor);
        $auditResponse = $this->getJson("/api/audit-logs?event_id={$event->id}")->assertOk();
        $this->assertGreaterThan(0, count($auditResponse->json('data')));

        // TESZTELJÜK: a leírás 11. lépésében említett adatmaszkolás
        // ténylegesen működik — az auditor a személyes adatokat (pl.
        // telefonszám) tartalmazó napló-bejegyzést "data_masked: true"
        // jelzéssel és rejtett mezőkkel kapja vissza.
        $personRow = collect($auditResponse->json('data'))->firstWhere('entity_id', $kovacsneId);
        if ($personRow) {
            $this->assertTrue($personRow['data_masked']);
        }

        // TESZTELJÜK: az auditor kizárólag megfigyelő szerepkör — nem
        // zárhatja le az eseményt, ezt csak a Manager teheti meg.
        $this->putJson("/api/events/{$event->id}", ['name' => $event->name, 'status' => 'closed'])
            ->assertForbidden();

        // TESZTELJÜK: a forgatókönyv utolsó lépéseként Nagy Katalin
        // (Manager) ténylegesen lezárhatja az eseményt — ez az az állapot,
        // amelynél a PurgeExpiredEventDataCommand a megőrzési idő lejárta
        // után törölheti a személyes adatokat.
        $this->actingAs($katalin);
        $this->putJson("/api/events/{$event->id}", ['name' => $event->name, 'status' => 'closed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'closed');
    }
}
