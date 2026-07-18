<?php

namespace App\Events;

use App\Models\Transport;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

// ShouldBroadcastNow, ugyanazért, mint a ShelterCapacityUpdated-nél: nincs
// mindig futó queue worker. Szándékosan a MEGLÉVŐ event.{eventId}.updates
// csatornán megy (nem újon) — a Szállítás és a Térképes áttekintés oldal is
// az EventLayout/EventSubNav alatt él, ami már felépíti/lezárja ennek a
// csatornának az élettartamát; nem kell újabb csatorna-életciklust bevezetni.
class TransportPositionUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(private readonly Transport $transport)
    {
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("event.{$this->transport->event_id}.updates"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'transport.position.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'transport_id' => $this->transport->id,
            'code' => $this->transport->code,
            'last_lat' => $this->transport->last_lat,
            'last_lng' => $this->transport->last_lng,
            'last_position_at' => $this->transport->last_position_at?->toIso8601String(),
        ];
    }
}
