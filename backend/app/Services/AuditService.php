<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\EvacuationEvent;
use App\Models\StatusHistory;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditService
{
    /**
     * Ennyi, egyszerre módosult mező felett tekintjük egy módosítást
     * "jelentősnek" (a napló szűrhetőségéhez és kiemeléséhez) — a törlés és
     * az adatmegőrzési törlés mindig jelentősnek számít a mezőszámtól függetlenül.
     */
    public const SIGNIFICANT_THRESHOLD = 4;

    /**
     * A végrehajtó felhasználót explicit paraméterként várjuk (nem auth()-ból olvassuk),
     * hogy az Action-ök seederből, jobból vagy tesztből, HTTP-kérésen kívül is helyesen
     * naplózhassanak, és a naplózás ne függjön rejtett globális állapottól.
     */
    public function log(string $action, Model $entity, User $causer, ?array $before = null, ?array $after = null, ?bool $forceSignificant = null): AuditLog
    {
        return AuditLog::create([
            'user_id' => $causer->id,
            'event_id' => $this->resolveEventId($entity),
            'action' => $action,
            'entity_type' => class_basename($entity),
            'entity_id' => (string) $entity->getKey(),
            'before_json' => $before,
            'after_json' => $after,
            'significant' => $forceSignificant ?? (
                $action === 'delete'
                || $action === 'data_retention_purge'
                || self::countChangedFields($before, $after) >= self::SIGNIFICANT_THRESHOLD
            ),
        ]);
    }

    private function resolveEventId(Model $entity): ?string
    {
        if ($entity instanceof EvacuationEvent) {
            return $entity->id;
        }

        return $entity->event_id ?? null;
    }

    /**
     * Megszámolja, hány mező értéke tért el a "before" és "after" állapot
     * között. A JSON-kódolt reprezentációkat hasonlítjuk össze, hogy a
     * tömb/objektum típusú mezők mélységi (deep) összehasonlítása is
     * megfelelően működjön.
     */
    public static function countChangedFields(?array $before, ?array $after): int
    {
        if (! $before || ! $after) {
            return 0;
        }

        $keys = array_unique([...array_keys($before), ...array_keys($after)]);
        $count = 0;

        foreach ($keys as $key) {
            if (json_encode($before[$key] ?? null) !== json_encode($after[$key] ?? null)) {
                $count++;
            }
        }

        return $count;
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
