<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Interreg tanulmány "Adatmaszkolás: minden felhasználó csak a feladatához
 * szükséges adatot lássa" funkciója (18. fejezet).
 */
class PersonDataMaskingTest extends TestCase
{
    use RefreshDatabase;

    private function createPersonWithFullData(): array
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-MASKING-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt',
            'first_name' => 'Elek',
            'municipality_id' => $municipality->id,
            'birth_place' => 'Győr',
            'id_document_number' => '123456AB',
            'phone' => '+36301234567',
            'email' => 'teszt.elek@example.com',
            'address_postal_code' => '9000',
            'address_settlement' => 'Győr',
            'address_street' => 'Fő utca',
            'address_house_number' => '1.',
        ])->assertCreated()->json('data.id');

        return [$personId];
    }

    // Admin szerepkörrel egy személy adatlapja teljesen maszkolatlanul
    // (okmányszám, telefon, cím) érkezik, "data_masked: false" jelzéssel.
    public function test_admin_sees_unmasked_data(): void
    {
        [$personId] = $this->createPersonWithFullData();

        $this->actingAsRole(RoleCode::Admin);
        $response = $this->getJson("/api/persons/{$personId}")->assertOk();

        $response->assertJsonPath('data.id_document_number', '123456AB');
        $response->assertJsonPath('data.phone', '+36301234567');
        $response->assertJsonPath('data.address.street', 'Fő utca');
        $response->assertJsonPath('data.data_masked', false);
    }

    // A befogadóhelyi kezelő a napi munkájához nem szükséges azonosító
    // adatokat (okmányszám, születési hely) maszkolva kapja (null), de az
    // elérhetőségi adatokat (telefon, cím) — amikre ténylegesen szüksége
    // van — nem: ez egy köztes maszkolási szint az admin és az auditor
    // között.
    public function test_shelter_operator_sees_masked_identity_documents_but_unmasked_contact_details(): void
    {
        [$personId] = $this->createPersonWithFullData();

        $this->actingAsRole(RoleCode::ShelterOperator);
        $response = $this->getJson("/api/persons/{$personId}")->assertOk();

        $response->assertJsonPath('data.id_document_number', null);
        $response->assertJsonPath('data.birth_place', null);
        $response->assertJsonPath('data.phone', '+36301234567');
        $response->assertJsonPath('data.address.street', 'Fő utca');
        $response->assertJsonPath('data.data_masked', true);
    }

    // Az auditor — mivel csak folyamatot ellenőriz, nem operatív munkát
    // végez — minden érzékeny mezőt maszkolva lát: okmányszám, születési
    // hely, telefon, e-mail és cím is null.
    public function test_auditor_sees_fully_masked_sensitive_fields(): void
    {
        [$personId] = $this->createPersonWithFullData();

        $this->actingAsRole(RoleCode::Auditor);
        $response = $this->getJson("/api/persons/{$personId}")->assertOk();

        $response->assertJsonPath('data.id_document_number', null);
        $response->assertJsonPath('data.birth_place', null);
        $response->assertJsonPath('data.phone', null);
        $response->assertJsonPath('data.email', null);
        $response->assertJsonPath('data.address.street', null);
        $response->assertJsonPath('data.data_masked', true);
    }

    // Az önkiszolgáló profil-nézet (public_id alapján, munkatárs-session
    // nélkül) sosem maszkol — a saját adatait mindenki teljes egészében
    // látja, hiszen ez nem munkatárs-hozzáférés, hanem a saját adata.
    public function test_self_service_profile_view_is_never_masked(): void
    {
        [$personId] = $this->createPersonWithFullData();

        $this->actingAsRole(RoleCode::Admin);
        $publicId = $this->postJson("/api/persons/{$personId}/qr")->assertCreated()->json('data.public_id');

        // Az önkiszolgáló felület nem munkatárs-munkamenetként fut (nincs auth:sanctum), a
        // korábbi actingAsRole session-je itt nem releváns, publikus végpontról van szó.
        $response = $this->getJson("/api/public/self-profile/{$publicId}")->assertOk();

        $response->assertJsonPath('data.id_document_number', '123456AB');
        $response->assertJsonPath('data.phone', '+36301234567');
        $response->assertJsonPath('data.data_masked', false);
    }
}
