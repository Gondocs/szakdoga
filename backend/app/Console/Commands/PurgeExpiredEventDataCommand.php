<?php

namespace App\Console\Commands;

use App\Enums\EventStatus;
use App\Models\AuditLog;
use App\Models\EvacuationEvent;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Interreg tanulmány "Adatmegőrzési/törlési szabályzat" funkciója: a
 * megőrzési időn (config('retention.closed_event_retention_days')) túl
 * lezárt eseményekhez tartozó személyes adatok automatikus törlése. Az
 * esemény metaadatai (kód, név, státusz) megmaradnak statisztikai célra,
 * de a hozzá tartozó személyek (és az arra épülő regisztrációk, checkinek,
 * speciális igények, okmányfényképek stb.) véglegesen törlődnek.
 */
class PurgeExpiredEventDataCommand extends Command
{
    protected $signature = 'data:purge-expired-persons {--dry-run : Csak kiírja, mit törölne törlés végrehajtása nélkül}';

    protected $description = 'A megőrzési időn túli, lezárt eseményekhez tartozó személyes adatok törlése';

    public function handle(): int
    {
        $retentionDays = (int) config('retention.closed_event_retention_days');
        $cutoff = now()->subDays($retentionDays);
        $isDryRun = (bool) $this->option('dry-run');

        $events = EvacuationEvent::where('status', EventStatus::Closed->value)
            ->where('updated_at', '<=', $cutoff)
            ->get();

        if ($events->isEmpty()) {
            $this->info('Nincs a megőrzési időn túli, lezárt esemény.');

            return self::SUCCESS;
        }

        foreach ($events as $event) {
            $persons = $event->persons()->get(['id', 'document_photo_front_path', 'document_photo_back_path']);

            if ($persons->isEmpty()) {
                continue;
            }

            $this->line(sprintf(
                '%s [%s]: %d személy %s.',
                $event->code,
                $event->name,
                $persons->count(),
                $isDryRun ? 'törölhető lenne' : 'törlésre kerül'
            ));

            if ($isDryRun) {
                continue;
            }

            foreach ($persons as $person) {
                if ($person->document_photo_front_path) {
                    Storage::disk('public')->delete($person->document_photo_front_path);
                }
                if ($person->document_photo_back_path) {
                    Storage::disk('public')->delete($person->document_photo_back_path);
                }
            }

            $personCount = $persons->count();

            $event->persons()->delete();

            AuditLog::create([
                'user_id' => null,
                'action' => 'data_retention_purge',
                'entity_type' => 'EvacuationEvent',
                'entity_id' => (string) $event->id,
                'before_json' => ['person_count' => $personCount],
                'after_json' => ['retention_days' => $retentionDays, 'purged_at' => now()->toIso8601String()],
            ]);
        }

        $this->info($isDryRun ? 'Próbafuttatás befejezve, törlés nem történt.' : 'Adatmegőrzési törlés befejezve.');

        return self::SUCCESS;
    }
}
