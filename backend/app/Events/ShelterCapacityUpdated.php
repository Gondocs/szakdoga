<?php

namespace App\Events;

use App\Enums\RiskLevel;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

// Szándékosan ShouldBroadcastNow (nem ShouldBroadcast): a dashboardot néző
// staff azonnal várja a frissülést, és — ugyanúgy, mint a 2FA e-mail
// kiküldésénél — nincs mindig futó queue worker, ami a queue-olt broadcastot
// feldolgozná.
class ShelterCapacityUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $eventId,
        public readonly string $shelterId,
        public readonly string $shelterName,
        public readonly int $checkedInCount,
        public readonly int $capacityLimit,
        public readonly float $riskScore,
        public readonly RiskLevel $riskLevel,
        public readonly float $utilization,
    ) {
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("event.{$this->eventId}.updates"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'shelter.capacity.updated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'shelter_id' => $this->shelterId,
            'shelter_name' => $this->shelterName,
            'checked_in_count' => $this->checkedInCount,
            'capacity_limit' => $this->capacityLimit,
            'risk_score' => $this->riskScore,
            'risk_level' => $this->riskLevel->value,
            'utilization' => $this->utilization,
        ];
    }
}
