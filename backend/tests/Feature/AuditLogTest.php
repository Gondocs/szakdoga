<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Municipality;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    // A sikertelen belépési kísérlet, a sikeres bejelentkezés és a
    // kijelentkezés is auditnapló-bejegyzést hoz létre, a sikertelen
    // kísérlet "significant" (kiemelt) jelzéssel.
    public function test_login_logout_and_failed_login_are_logged(): void
    {
        $role = Role::create(['code' => RoleCode::Admin->value, 'name' => 'Admin']);
        $user = User::factory()->create(['email' => 'admin@example.com', 'password' => bcrypt('password'), 'role_id' => $role->id]);

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'wrong-password',
        ])->assertUnprocessable();

        $this->assertDatabaseHas('audit_logs', ['action' => 'login_failed', 'significant' => true]);

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ])->assertOk();

        $this->assertDatabaseHas('audit_logs', ['action' => 'login', 'user_id' => $user->id]);

        $this->postJson('/api/logout')->assertNoContent();

        $this->assertDatabaseHas('audit_logs', ['action' => 'logout', 'user_id' => $user->id]);
    }

    // Egy felhasználó nevének módosítása "nem kiemelt" (significant: false)
    // naplóbejegyzést hoz létre, de a szerepkör (role_id) módosítása külön,
    // "kiemelt" (significant: true) "role_change" akcióként naplózódik —
    // a rendszer megkülönbözteti a triviális és a biztonságkritikus
    // módosításokat.
    public function test_role_change_is_logged_as_significant_but_plain_update_is_not(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $managerRole = Role::firstOrCreate(['code' => RoleCode::Manager->value], ['name' => 'Manager']);
        $registrarRole = Role::firstOrCreate(['code' => RoleCode::Registrar->value], ['name' => 'Registrar']);
        $target = User::factory()->create(['role_id' => $registrarRole->id]);

        $this->putJson("/api/users/{$target->id}", ['name' => 'Új Név'])->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'user_update', 'entity_id' => (string) $target->id, 'significant' => false]);

        $this->putJson("/api/users/{$target->id}", ['role_id' => $managerRole->id])->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'role_change', 'entity_id' => (string) $target->id, 'significant' => true]);
    }

    // Az auditnapló szűrhető esemény (event_id) és felhasználó (user_id)
    // szerint, valamint szabadszöveges kereséssel (q) — a találatok
    // ténylegesen megfelelnek a szűrőnek, és egy nem létező kifejezésre
    // nulla találat jön vissza.
    public function test_filters_by_user_event_and_free_text_search(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-AUDIT-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $registrar = $this->actingAsRole(RoleCode::Registrar);
        $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated();

        $this->actingAsRole(RoleCode::Admin);

        $byEvent = $this->getJson("/api/audit-logs?event_id={$eventId}")->assertOk();
        $this->assertGreaterThan(0, count($byEvent->json('data')));
        foreach ($byEvent->json('data') as $row) {
            $this->assertSame($eventId, $row['event_id']);
        }

        $byUser = $this->getJson("/api/audit-logs?user_id={$registrar->id}")->assertOk();
        $this->assertGreaterThan(0, count($byUser->json('data')));

        $bySearch = $this->getJson('/api/audit-logs?q='.urlencode($registrar->name))->assertOk();
        $this->assertGreaterThan(0, count($bySearch->json('data')));

        $noMatch = $this->getJson('/api/audit-logs?q=nonexistent-xyz-search-term')->assertOk();
        $this->assertCount(0, $noMatch->json('data'));
    }

    // A "significant_only" szűrő kizárólag a kiemelt (pl. szerepkör-
    // változtatás) bejegyzéseket adja vissza, a nem kiemelt módosítás
    // (névváltoztatás) nem szerepel a találatok között.
    public function test_significant_only_filter(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $registrarRole = Role::firstOrCreate(['code' => RoleCode::Registrar->value], ['name' => 'Registrar']);
        $target = User::factory()->create(['role_id' => $registrarRole->id]);
        $managerRole = Role::firstOrCreate(['code' => RoleCode::Manager->value], ['name' => 'Manager']);

        $this->putJson("/api/users/{$target->id}", ['name' => 'Kis Módosítás'])->assertOk();
        $this->putJson("/api/users/{$target->id}", ['role_id' => $managerRole->id])->assertOk();

        $response = $this->getJson('/api/audit-logs?significant_only=1')->assertOk();
        $this->assertNotEmpty($response->json('data'));
        foreach ($response->json('data') as $row) {
            $this->assertTrue($row['significant']);
        }
    }

    // A szűrő-opciók (filter-options) végpont nem üres listát ad vissza a
    // szűrőmezők (felhasználók, események) feltöltéséhez a felületen.
    public function test_filter_options_returns_distinct_users_and_events(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $this->postJson('/api/events', [
            'code' => 'EVT-AUDIT-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated();

        $response = $this->getJson('/api/audit-logs/filter-options')->assertOk();
        $this->assertNotEmpty($response->json('data.users'));
        $this->assertNotEmpty($response->json('data.events'));
    }

    // Az auditnapló CSV-ként exportálható, és a válasz helyes
    // Content-Type fejlécet kap.
    public function test_csv_export_is_downloadable(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $this->postJson('/api/events', [
            'code' => 'EVT-AUDIT-3',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated();

        $response = $this->get('/api/audit-logs/export');
        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    // Ugyanaz a naplóbejegyzés admin nézetben a valódi telefonszámot mutatja
    // ("data_masked: false"), auditor nézetben viszont a személyes adat
    // (telefonszám) el van rejtve és a bejegyzés "data_masked: true"-val
    // van jelölve — a szerepkör-alapú adatmaszkolás ténylegesen működik.
    public function test_auditor_sees_masked_sensitive_fields_but_admin_does_not(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-AUDIT-4',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
            'phone' => '+36301234567',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Admin);
        $adminResponse = $this->getJson("/api/audit-logs?entity_type=Person&event_id={$eventId}")->assertOk();
        $adminRow = collect($adminResponse->json('data'))->firstWhere('entity_id', $personId);
        $this->assertSame('+36301234567', $adminRow['after']['phone']);
        $this->assertFalse($adminRow['data_masked']);

        $this->actingAsRole(RoleCode::Auditor);
        $auditorResponse = $this->getJson("/api/audit-logs?entity_type=Person&event_id={$eventId}")->assertOk();
        $auditorRow = collect($auditorResponse->json('data'))->firstWhere('entity_id', $personId);
        $this->assertNull($auditorRow['after']['phone']);
        $this->assertTrue($auditorRow['data_masked']);
    }

    // Az auditnapló-lista válasz meta.summary.today_count mezője a mai napi
    // bejegyzésszámot tartalmazza, és ez nagyobb, mint nulla, ha aznap
    // történt naplózható esemény.
    public function test_summary_meta_includes_today_counts(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $this->postJson('/api/events', [
            'code' => 'EVT-AUDIT-5',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated();

        $response = $this->getJson('/api/audit-logs')->assertOk();
        $this->assertGreaterThan(0, $response->json('meta.summary.today_count'));
    }
}
