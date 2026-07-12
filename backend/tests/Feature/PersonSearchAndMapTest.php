<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PersonSearchAndMapTest extends TestCase
{
    use RefreshDatabase;

    // A személylista alapértelmezetten 25-ös lapmérettel lapozott (a
    // meta.total viszont a teljes darabszámot mutatja), és a "per_page"
    // paraméterrel ez a lapméret felülírható.
    public function test_per_page_parameter_controls_page_size(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-PAGE-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        foreach (range(1, 30) as $i) {
            $this->postJson("/api/events/{$eventId}/persons", [
                'last_name' => "Teszt{$i}", 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
            ])->assertCreated();
        }

        $defaultResponse = $this->getJson("/api/events/{$eventId}/persons")->assertOk();
        $this->assertCount(25, $defaultResponse->json('data'));
        $this->assertSame(30, $defaultResponse->json('meta.total'));

        $allResponse = $this->getJson("/api/events/{$eventId}/persons?per_page=100")->assertOk();
        $this->assertCount(30, $allResponse->json('data'));
    }

    // A személylista szabadszöveges keresője a család kódjára (family_code)
    // is illeszkedik, nemcsak a névre — hasznos, ha egy egész családot
    // akarnak megtalálni a listában.
    public function test_search_matches_family_code(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-SEARCH-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $person = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Nagy',
            'first_name' => 'Család',
            'municipality_id' => $municipality->id,
            'create_new_family' => true,
            'is_primary_contact' => true,
        ])->assertCreated()->json('data');

        $familyId = $person['family_id'];
        $familyCode = $this->getJson("/api/families/{$familyId}")->json('data.family_code');

        $response = $this->getJson("/api/events/{$eventId}/persons?search={$familyCode}")->assertOk();
        $response->assertJsonCount(1, 'data');
        $this->assertEquals($person['id'], $response->json('data.0.id'));
    }

    // A személylista rendezhető név, település és regisztrációs státusz
    // szerint is, mindkét irányban (asc/desc) — a visszakapott sorrend
    // ténylegesen megfelel az elvárt rendezésnek.
    public function test_sort_by_name_status_and_municipality(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipalityA = Municipality::factory()->create(['name' => 'Alfafalva']);
        $municipalityZ = Municipality::factory()->create(['name' => 'Zetafalva']);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-SORT-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        // Nem ékezetes vezetéknevek, hogy a rendezés eredménye ne függjön az
        // adatbázis-motor (SQLite a tesztekben, MySQL éles környezetben)
        // eltérő ékezet-kollációjától.
        $this->actingAsRole(RoleCode::Registrar);
        $zoltan = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Zoltan', 'first_name' => 'Elek', 'municipality_id' => $municipalityA->id,
        ])->assertCreated()->json('data.id');
        $arpad = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Arpad', 'first_name' => 'Elek', 'municipality_id' => $municipalityZ->id,
        ])->assertCreated()->json('data.id');

        // Név szerint növekvő: Arpad előbb, mint Zoltan.
        $byNameAsc = $this->getJson("/api/events/{$eventId}/persons?sort_by=name&sort_dir=asc")->assertOk();
        $this->assertSame([$arpad, $zoltan], $byNameAsc->json('data.*.id'));

        // Név szerint csökkenő: Zoltan előbb.
        $byNameDesc = $this->getJson("/api/events/{$eventId}/persons?sort_by=name&sort_dir=desc")->assertOk();
        $this->assertSame([$zoltan, $arpad], $byNameDesc->json('data.*.id'));

        // Település szerint növekvő: Ács (Zoltan) előbb, mint Zirc (Arpad).
        $byMunicipalityAsc = $this->getJson("/api/events/{$eventId}/persons?sort_by=municipality&sort_dir=asc")->assertOk();
        $this->assertSame([$zoltan, $arpad], $byMunicipalityAsc->json('data.*.id'));

        $this->actingAsRole(RoleCode::Admin);
        $this->putJson("/api/registrations/{$this->registrationId($arpad)}/status", ['status' => 'arrived_shelter'])->assertOk();

        $byStatusAsc = $this->getJson("/api/events/{$eventId}/persons?sort_by=status&sort_dir=asc")->assertOk();
        $this->assertCount(2, $byStatusAsc->json('data'));
    }

    private function registrationId(string $personId): string
    {
        return $this->getJson("/api/persons/{$personId}")->json('data.registration.id');
    }

    // A térképes összesítő (municipality-summary) csak azokat a
    // településeket adja vissza, amelyeknek van rögzített koordinátája —
    // egy koordináta nélküli település (ahol emiatt nem lehetne pontot
    // rajzolni a térképre) kimarad a listából, a másik viszont a helyes
    // személyszámmal (2 fő) szerepel.
    public function test_municipality_summary_only_returns_municipalities_with_coordinates(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $withCoords = Municipality::factory()->create(['lat' => 47.6875, 'lng' => 17.6504]);
        $withoutCoords = Municipality::factory()->create(['lat' => null, 'lng' => null]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-MAP-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Első', 'first_name' => 'Teszt', 'municipality_id' => $withCoords->id,
        ])->assertCreated();
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Második', 'first_name' => 'Teszt', 'municipality_id' => $withCoords->id,
        ])->assertCreated();
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Harmadik', 'first_name' => 'Teszt', 'municipality_id' => $withoutCoords->id,
        ])->assertCreated();

        $response = $this->getJson("/api/events/{$eventId}/persons/municipality-summary")->assertOk();

        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.municipality_id', $withCoords->id);
        $response->assertJsonPath('data.0.person_count', 2);
    }

    // A térképes összesítő szűrhető "central_transport_required=1"
    // paraméterrel, ekkor csak a központi szállítást igénylő személyeket
    // számolja településenként.
    public function test_municipality_summary_can_be_filtered_to_central_transport_required(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create(['lat' => 47.6875, 'lng' => 17.6504]);

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-MAP-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $withTransport = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Első', 'first_name' => 'Teszt', 'municipality_id' => $municipality->id,
            'central_transport_required' => true,
        ])->assertCreated()->json('data');
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Második', 'first_name' => 'Teszt', 'municipality_id' => $municipality->id,
        ])->assertCreated();

        $unfiltered = $this->getJson("/api/events/{$eventId}/persons/municipality-summary")->assertOk();
        $unfiltered->assertJsonPath('data.0.person_count', 2);

        $filtered = $this->getJson("/api/events/{$eventId}/persons/municipality-summary?central_transport_required=1")->assertOk();
        $filtered->assertJsonCount(1, 'data');
        $filtered->assertJsonPath('data.0.person_count', 1);

        $this->assertNotNull($withTransport['registration']);
    }

    // A személylista "municipality_id" szűrővel egyetlen településre
    // szűkíthető.
    public function test_municipality_filter_narrows_person_list(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipalityA = Municipality::factory()->create();
        $municipalityB = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-MUNI-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Első', 'first_name' => 'Teszt', 'municipality_id' => $municipalityA->id,
        ])->assertCreated();
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Második', 'first_name' => 'Teszt', 'municipality_id' => $municipalityB->id,
        ])->assertCreated();

        $response = $this->getJson("/api/events/{$eventId}/persons?municipality_id={$municipalityA->id}")->assertOk();
        $response->assertJsonCount(1, 'data');
    }
}
