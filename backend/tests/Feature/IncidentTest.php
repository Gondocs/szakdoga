<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Models\Shelter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IncidentTest extends TestCase
{
    use RefreshDatabase;

    public function test_shelter_operator_can_report_and_resolve_an_incident(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $shelter = Shelter::factory()->create();
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-INC-1',
            'name' => 'Teszt esemény',
            'status' => 'active',
            'shelters' => [['shelter_id' => $shelter->id, 'capacity_limit' => 10]],
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::ShelterOperator);
        $response = $this->postJson("/api/events/{$eventId}/incidents", [
            'category' => 'conflict',
            'severity' => 'medium',
            'description' => 'Vita alakult ki két család között az étkezési sorban.',
            'shelter_id' => $shelter->id,
        ]);
        $response->assertCreated();
        $response->assertJsonPath('data.status', 'open');
        $incidentId = $response->json('data.id');

        $this->getJson("/api/events/{$eventId}/incidents")
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson("/api/events/{$eventId}/incidents?status=open")
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $resolveResponse = $this->postJson("/api/incidents/{$incidentId}/resolve");
        $resolveResponse->assertOk();
        $resolveResponse->assertJsonPath('data.status', 'resolved');
        $this->assertNotNull($resolveResponse->json('data.resolved_at'));

        $this->getJson("/api/events/{$eventId}/incidents?status=open")
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_auditor_cannot_report_an_incident(): void
    {
        $this->actingAsRole(RoleCode::Admin);
        $eventId = $this->postJson('/api/events', [
            'code' => 'EVT-INC-2',
            'name' => 'Teszt esemény',
            'status' => 'active',
        ])->assertCreated()->json('data.id');

        $this->actingAsRole(RoleCode::Auditor);
        $this->postJson("/api/events/{$eventId}/incidents", [
            'category' => 'other',
            'severity' => 'low',
            'description' => 'x',
        ])->assertForbidden();
    }
}
