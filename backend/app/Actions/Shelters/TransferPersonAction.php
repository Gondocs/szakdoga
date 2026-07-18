<?php

namespace App\Actions\Shelters;

use App\Events\ShelterCapacityUpdated;
use App\Exceptions\ShelterFullException;
use App\Models\CheckIn;
use App\Models\EventShelter;
use App\Models\Person;
use App\Models\Shelter;
use App\Models\User;
use App\Services\AuditService;
use App\Services\CapacityRiskService;
use Illuminate\Support\Facades\DB;

/**
 * Interreg tanulmány "Áthelyezés másik befogadóhelyre" funkciója: egy már
 * befogadóhelyen tartózkodó személy egy másik befogadóhelyre kerül át — a
 * régi befogadóhely kapacitása felszabadul, az újé lefoglalódik, és a
 * regisztráció "befogadóhelyen van" státusza változatlan marad.
 */
class TransferPersonAction
{
    public function __construct(
        private readonly AuditService $auditService,
        private readonly CapacityRiskService $capacityRiskService,
    ) {
    }

    public function execute(Person $person, Shelter $newShelter, User $operator, bool $overrideCapacity = false, ?string $bedLabel = null): CheckIn
    {
        return DB::transaction(function () use ($person, $newShelter, $operator, $overrideCapacity, $bedLabel) {
            $registration = $person->registration()->lockForUpdate()->firstOrFail();

            $currentCheckIn = CheckIn::where('person_id', $person->id)
                ->where('event_id', $registration->event_id)
                ->latest('checked_in_at')
                ->lockForUpdate()
                ->first();

            if (! $currentCheckIn) {
                abort(422, 'A személy jelenleg nincs befogadóhelyen, nem helyezhető át.');
            }

            if ($currentCheckIn->shelter_id === $newShelter->id) {
                abort(422, 'A személy már ezen a befogadóhelyen tartózkodik.');
            }

            // Az új szálláshely kapacitásának ellenőrzése, mielőtt bármilyen
            // adatot módosítanánk
            $newEventShelter = EventShelter::where('event_id', $registration->event_id)
                ->where('shelter_id', $newShelter->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $overrideCapacity && $newEventShelter->checked_in_count >= $newEventShelter->capacity_limit) {
                throw new ShelterFullException();
            }

            // A régi szálláshely foglaltságát csökkentjük, hiszen a személy
            // onnan távozik
            $oldEventShelter = EventShelter::where('event_id', $registration->event_id)
                ->where('shelter_id', $currentCheckIn->shelter_id)
                ->lockForUpdate()
                ->first();

            if ($oldEventShelter && $oldEventShelter->checked_in_count > 0) {
                $oldEventShelter->decrement('checked_in_count');
            }

            $newCheckIn = CheckIn::create([
                'event_id' => $registration->event_id,
                'person_id' => $person->id,
                'shelter_id' => $newShelter->id,
                'bed_label' => $bedLabel,
                'checked_in_at' => now(),
                'checked_in_by' => $operator->id,
            ]);

            $newEventShelter->increment('checked_in_count');

            $this->auditService->log('shelter_transfer', $newCheckIn, $operator, [
                'from_shelter_id' => $currentCheckIn->shelter_id,
            ], [
                'to_shelter_id' => $newShelter->id,
            ]);

            // Mindkét érintett befogadóhely kapacitása változott (a régié
            // csökkent, az újé nőtt), ezért mindkettőre külön eseményt
            // váltunk ki.
            if ($oldEventShelter) {
                $this->broadcastCapacityUpdate($oldEventShelter->fresh(), $oldEventShelter->shelter);
            }
            $this->broadcastCapacityUpdate($newEventShelter->fresh(), $newShelter);

            return $newCheckIn;
        });
    }

    private function broadcastCapacityUpdate(EventShelter $eventShelter, Shelter $shelter): void
    {
        $risk = $this->capacityRiskService->forEventShelter($eventShelter);

        event(new ShelterCapacityUpdated(
            eventId: $eventShelter->event_id,
            shelterId: $eventShelter->shelter_id,
            shelterName: $shelter->name,
            checkedInCount: $eventShelter->checked_in_count,
            capacityLimit: $eventShelter->capacity_limit,
            riskScore: $risk['score'],
            riskLevel: $risk['level'],
            utilization: $risk['utilization'],
        ));
    }
}
