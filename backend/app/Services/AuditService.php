<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\StatusHistory;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditService
{
    /**
     * A végrehajtó felhasználót explicit paraméterként várjuk (nem auth()-ból olvassuk),
     * hogy az Action-ök seederből, jobból vagy tesztből, HTTP-kérésen kívül is helyesen
     * naplózhassanak, és a naplózás ne függjön rejtett globális állapottól.
     */
    public function log(string $action, Model $entity, User $causer, ?array $before = null, ?array $after = null): AuditLog
    {
        return AuditLog::create([
            'user_id' => $causer->id,
            'action' => $action,
            'entity_type' => class_basename($entity),
            'entity_id' => (string) $entity->getKey(),
            'before_json' => $before,
            'after_json' => $after,
        ]);
    }

    public function recordStatusChange(Model $entity, ?string $oldStatus, string $newStatus, User $causer): StatusHistory
    {
        return StatusHistory::create([
            'entity_type' => class_basename($entity),
            'entity_id' => (string) $entity->getKey(),
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'changed_by' => $causer->id,
        ]);
    }
}
