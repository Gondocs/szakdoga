<?php

namespace App\Events;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

// ShouldBroadcastNow, ugyanazért, mint a többi broadcast eseménynél: nincs
// mindig futó queue worker. Szándékosan NEM küldi a before/after_json
// mezőket (azok érzékeny adatokat is tartalmazhatnak, amiket a normál
// /api/audit-logs végpont AuditLogResource-a szerepkör szerint maszkol) —
// ez a broadcast csak egy könnyű "élő csík", a részleteket a felhasználó a
// (megfelelően maszkolt) teljes naplóban nézheti meg.
class AuditLogRecorded implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        private readonly AuditLog $auditLog,
        private readonly User $causer,
    ) {
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('audit-logs'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'audit-log.recorded';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->auditLog->id,
            'action' => $this->auditLog->action,
            'entity_type' => $this->auditLog->entity_type,
            'user_name' => $this->causer->name,
            'significant' => (bool) $this->auditLog->significant,
            'created_at' => $this->auditLog->created_at?->toIso8601String(),
        ];
    }
}
