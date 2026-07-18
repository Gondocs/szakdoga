<?php

namespace App\Events;

use App\Models\Incident;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

// ShouldBroadcastNow, ugyanazért, mint a ShelterCapacityUpdated-nél: nincs
// mindig futó queue worker, a toast-értesítésnek pedig azonnal meg kell
// jelennie.
class IncidentCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(private readonly Incident $incident)
    {
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("event.{$this->incident->event_id}.updates"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'incident.created';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'incident_id' => $this->incident->id,
            // A category/severity enumoknak (App\Enums\IncidentCategory/
            // IncidentSeverity) nincs label() metódusuk — a magyar
            // megjelenítést a frontend végzi, ugyanazokkal a
            // categoryLabels/severityLabels térképekkel, amiket az
            // IncidentListPage már használ.
            'category' => $this->incident->category->value,
            'severity' => $this->incident->severity->value,
            'shelter_name' => $this->incident->shelter?->name,
            'description' => str($this->incident->description)->limit(120)->toString(),
        ];
    }
}
