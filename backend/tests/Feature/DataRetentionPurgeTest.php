<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Person;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * Interreg tanulmány "Adatmegőrzési/törlési szabályzat" funkciója.
 */
class DataRetentionPurgeTest extends TestCase
{
    use RefreshDatabase;

    public function test_purges_persons_only_for_closed_events_past_retention_window(): void
    {
        config(['retention.closed_event_retention_days' => 30]);

        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $oldClosedEventId = $this->postJson('/api/events', [
            'code' => 'EVT-RETENTION-OLD',
            'name' => 'Régi lezárt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $oldPersonId = $this->postJson("/api/events/{$oldClosedEventId}/persons", [
            'last_name' => 'Régi', 'first_name' => 'Személy', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Admin);
        $this->putJson("/api/events/{$oldClosedEventId}", ['status' => 'closed'])->assertOk();

        // Az esemény "lezárva" óta eltelt idő szimulálása: az updated_at időbélyeg visszadátumozása.
        EvacuationEvent::where('id', $oldClosedEventId)->update(['updated_at' => now()->subDays(60)]);

        $recentClosedEventId = $this->postJson('/api/events', [
            'code' => 'EVT-RETENTION-RECENT',
            'name' => 'Nemrég lezárt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $recentPersonId = $this->postJson("/api/events/{$recentClosedEventId}/persons", [
            'last_name' => 'Új', 'first_name' => 'Személy', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Admin);
        $this->putJson("/api/events/{$recentClosedEventId}", ['status' => 'closed'])->assertOk();

        Artisan::call('data:purge-expired-persons');

        $this->assertDatabaseMissing('persons', ['id' => $oldPersonId]);
        $this->assertDatabaseHas('persons', ['id' => $recentPersonId]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'data_retention_purge', 'entity_id' => $oldClosedEventId]);
    }

    public function test_dry_run_does_not_delete_anything(): void
    {
        config(['retention.closed_event_retention_days' => 30]);

        $this->actingAsRole(RoleCode::Admin);
        $municipality = Municipality::factory()->create();

        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-RETENTION-DRYRUN',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Registrar);
        $personId = $this->postJson("/api/events/{$eventId}/persons", [
            'last_name' => 'Teszt', 'first_name' => 'Elek', 'municipality_id' => $municipality->id,
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Admin);
        $this->putJson("/api/events/{$eventId}", ['status' => 'closed'])->assertOk();
        EvacuationEvent::where('id', $eventId)->update(['updated_at' => now()->subDays(60)]);

        Artisan::call('data:purge-expired-persons', ['--dry-run' => true]);

        $this->assertDatabaseHas('persons', ['id' => $personId]);
        $this->assertNotNull(Person::find($personId));
    }
}
