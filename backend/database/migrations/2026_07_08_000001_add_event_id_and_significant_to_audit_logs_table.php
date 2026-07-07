<?php

use App\Models\AuditLog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->uuid('event_id')->nullable()->after('user_id');
            $table->boolean('significant')->default(false)->after('after_json');

            $table->index('event_id');
            $table->index('significant');
            $table->index('created_at');
        });

        // Meglévő bejegyzések visszamenőleges kitöltése: event_id az entitás
        // saját event_id mezőjéből (ha van), a "significant" pedig ugyanazzal
        // a logikával, amit az AuditService::log() az új bejegyzéseknél használ.
        AuditLog::query()->orderBy('id')->chunk(200, function ($logs) {
            foreach ($logs as $log) {
                $entityClass = 'App\\Models\\'.$log->entity_type;

                $eventId = null;
                if (class_exists($entityClass)) {
                    $entity = $entityClass::find($log->entity_id);
                    if ($entity) {
                        $eventId = $entityClass === \App\Models\EvacuationEvent::class
                            ? $entity->id
                            : ($entity->event_id ?? null);
                    }
                }

                $significant = $log->action === 'delete'
                    || $log->action === 'data_retention_purge'
                    || \App\Services\AuditService::countChangedFields($log->before_json, $log->after_json) >= \App\Services\AuditService::SIGNIFICANT_THRESHOLD;

                $log->forceFill(['event_id' => $eventId, 'significant' => $significant])->saveQuietly();
            }
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['event_id']);
            $table->dropIndex(['significant']);
            $table->dropIndex(['created_at']);
            $table->dropColumn(['event_id', 'significant']);
        });
    }
};
