<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Az Interreg tanulmány "1. fázis: előzetes kódgenerálás" koncepciója:
 * a lakos bejelentkezés nélkül regisztrálhat egy aktív eseményhez, és
 * azonnal kap egy QR public_id-t, amit később a befogadóhelyen beolvasnak.
 */
class SelfServiceRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function createActiveEventWithShelter(): array
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();
        $shelter = Shelter::factory()->create(['municipality_id' => $municipality->id]);

        $response = $this->postJson('/api/events', [
            'code' => 'EVT-SELF-1',
            'name' => 'Teszt önkiszolgáló esemény',
            'status' => 'active',
            'shelters' => [['shelter_id' => $shelter->id, 'capacity_limit' => 10]],
        ])->assertCreated();

        return [EvacuationEvent::findOrFail($response->json('data.id')), $municipality, $shelter];
    }

    // Bejelentkezés nélkül (auth guard kikapcsolva) is sikeresen
    // regisztrálható egy lakos egy aktív eseményhez, azonnal public_id-t
    // (QR-kód alapja) kap, és a regisztráció "self_service" csatornaként,
    // a személy adatai pedig helyesen kerülnek elmentésre.
    public function test_citizen_can_self_register_without_authentication_and_receives_qr(): void
    {
        [$event, $municipality] = $this->createActiveEventWithShelter();

        // Kijelentkezünk, hogy igazoljuk: nincs szükség hitelesítésre.
        $this->app['auth']->forgetGuards();

        $response = $this->postJson("/api/public/events/{$event->code}/self-register", [
            'last_name' => 'Kiss',
            'first_name' => 'Anna',
            'municipality_id' => $municipality->id,
            'gender' => 'female',
            'id_document_number' => '123456AB',
        ]);

        $response->assertCreated();
        $publicId = $response->json('data.public_id');
        $this->assertNotEmpty($publicId);

        $this->assertDatabaseHas('registrations', ['channel' => 'self_service']);
        $this->assertDatabaseHas('persons', ['last_name' => 'Kiss', 'gender' => 'female', 'id_document_number' => '123456AB']);
    }

    // Egy önkiszolgálóan előregisztrált személy ugyanúgy érkeztethető a
    // befogadóhelyen a QR-kódja alapján, mint egy helyszínen regisztrált
    // — a két csatorna a check-in szempontjából megkülönböztethetetlen.
    public function test_self_registered_person_can_be_checked_in_normally(): void
    {
        [$event, $municipality, $shelter] = $this->createActiveEventWithShelter();

        $this->app['auth']->forgetGuards();

        $publicId = $this->postJson("/api/public/events/{$event->code}/self-register", [
            'last_name' => 'Nagy',
            'first_name' => 'Béla',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.public_id');

        $this->actingAsRole(RoleCode::ShelterOperator, ['shelter_id' => $shelter->id]);

        $this->postJson("/api/shelters/{$shelter->id}/checkins", [
            'public_id' => $publicId,
            'event_id' => $event->id,
        ])->assertCreated();

        $this->assertDatabaseHas('checkins', ['shelter_id' => $shelter->id]);
    }

    // "draft" (tervezet) státuszú eseményhez az önkiszolgáló regisztráció
    // nem érhető el — a végpont 404 EVENT_NOT_FOUND-ot ad, mintha az
    // esemény nem is létezne, hogy ne szivárogjon információ a még nem
    // közzétett eseményről.
    public function test_self_registration_fails_for_inactive_event(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $response = $this->postJson('/api/events', [
            'code' => 'EVT-SELF-DRAFT',
            'name' => 'Tervezet esemény',
            'status' => 'draft',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();

        $this->postJson('/api/public/events/EVT-SELF-DRAFT/self-register', [
            'last_name' => 'Teszt',
            'first_name' => 'Elek',
            'municipality_id' => $municipality->id,
        ])->assertStatus(404)->assertJsonPath('code', 'EVENT_NOT_FOUND');
    }

    // A public_id birtokában (bejelentkezés nélkül) a saját profil
    // megtekinthető és módosítható (telefon, cím, központi szállítási
    // igény, egyedi igény hozzáadása), és a módosítás "self_update"
    // akcióként naplózódik az auditnaplóba.
    public function test_citizen_can_view_and_update_own_profile_via_public_id(): void
    {
        [$event, $municipality] = $this->createActiveEventWithShelter();

        $this->app['auth']->forgetGuards();

        $publicId = $this->postJson("/api/public/events/{$event->code}/self-register", [
            'last_name' => 'Varga',
            'first_name' => 'Eszter',
            'municipality_id' => $municipality->id,
            'phone' => '+3611111111',
        ])->assertCreated()->json('data.public_id');

        $this->getJson("/api/public/self-profile/{$publicId}")
            ->assertOk()
            ->assertJsonPath('data.phone', '+3611111111');

        $this->putJson("/api/public/self-profile/{$publicId}", [
            'phone' => '+3622222222',
            'address_settlement' => 'Győr',
            'central_transport_required' => true,
            'special_needs' => [
                ['category' => 'diet', 'type' => 'gluten_free'],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.phone', '+3622222222')
            ->assertJsonPath('data.address.settlement', 'Győr')
            ->assertJsonPath('data.registration.central_transport_required', true)
            ->assertJsonCount(1, 'data.special_needs');

        $this->assertDatabaseHas('audit_logs', ['action' => 'self_update']);
    }

    // Miután egy regisztrátor a személy státuszát "returned_home"-ra
    // állította, a saját profil önkiszolgáló megtekintése lezárul (409
    // SELF_PROFILE_LOCKED) — hazatérés után a profil már nem módosítható
    // a saját QR-kóddal.
    public function test_self_profile_locked_after_return_home(): void
    {
        [$event, $municipality] = $this->createActiveEventWithShelter();

        $this->app['auth']->forgetGuards();
        $publicId = $this->postJson("/api/public/events/{$event->code}/self-register", [
            'last_name' => 'Kovács',
            'first_name' => 'Péter',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.public_id');

        $personId = \App\Models\Person::where('last_name', 'Kovács')->firstOrFail()->id;
        $registration = \App\Models\Registration::where('person_id', $personId)->firstOrFail();

        $this->actingAsRole(RoleCode::Registrar);
        $this->putJson("/api/registrations/{$registration->id}/status", ['status' => 'returned_home'])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->getJson("/api/public/self-profile/{$publicId}")
            ->assertStatus(409)
            ->assertJsonPath('code', 'SELF_PROFILE_LOCKED');
    }

    // Aki saját járművel utazik (own_vehicle: true), önkiszolgáló módon
    // megerősítheti a megérkezését — ez kitölti a
    // self_arrival_confirmed_at mezőt és naplózódik.
    public function test_own_vehicle_traveler_can_confirm_arrival(): void
    {
        [$event, $municipality] = $this->createActiveEventWithShelter();

        $this->app['auth']->forgetGuards();
        $publicId = $this->postJson("/api/public/events/{$event->code}/self-register", [
            'last_name' => 'Szabó',
            'first_name' => 'Dénes',
            'municipality_id' => $municipality->id,
            'own_vehicle' => true,
        ])->assertCreated()->json('data.public_id');

        $response = $this->postJson("/api/public/self-profile/{$publicId}/confirm-arrival")->assertOk();

        $this->assertNotNull($response->json('data.registration.self_arrival_confirmed_at'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'self_arrival_confirmed']);
    }

    // Aki nem jelölte, hogy saját járművel utazik, nem erősítheti meg
    // önkiszolgáló módon a megérkezését — a végpont 422
    // NOT_OWN_VEHICLE-t ad, mert az ő esetükben a befogadóhelyi
    // kezelőnek kell QR-kóddal érkeztetnie.
    public function test_confirm_arrival_fails_without_own_vehicle(): void
    {
        [$event, $municipality] = $this->createActiveEventWithShelter();

        $this->app['auth']->forgetGuards();
        $publicId = $this->postJson("/api/public/events/{$event->code}/self-register", [
            'last_name' => 'Tóth',
            'first_name' => 'Ilona',
            'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.public_id');

        $this->postJson("/api/public/self-profile/{$publicId}/confirm-arrival")
            ->assertStatus(422)
            ->assertJsonPath('code', 'NOT_OWN_VEHICLE');
    }
}
