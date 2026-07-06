<?php

namespace App\Actions\Shelters;

use App\Exceptions\ShelterFullException;
use App\Models\CheckIn;
use App\Models\EventShelter;
use App\Models\Person;
use App\Models\Shelter;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Support\Facades\DB;

/**
 * Interreg tanulmány "Áthelyezés másik befogadóhelyre" funkciója: egy már
 * befogadóhelyen tartózkodó személy egy másik befogadóhelyre kerül át — a
 * régi befogadóhely kapacitása felszabadul, az újé lefoglalódik, és a
 * regisztráció "befogadóhelyen van" státusza változatlan marad.
 */
class TransferPersonAction
{
    public function __construct(private readonly AuditService $auditService)
    {
    }

    public function execute(Person $person, Shelter $newShelter, User $operator, bool $overrideCapacity = false): CheckIn
    {
        return DB::transaction(function () use ($person, $newShelter, $operator, $overrideCapacity) {
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

            $newEventShelter = EventShelter::where('event_id', $registration->event_id)
                ->where('shelter_id', $newShelter->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $overrideCapacity && $newEventShelter->checked_in_count >= $newEventShelter->capacity_limit) {
                throw new ShelterFullException();
            }

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
                'checked_in_at' => now(),
                'checked_in_by' => $operator->id,
            ]);

            $newEventShelter->increment('checked_in_count');

            $this->auditService->log('shelter_transfer', $newCheckIn, $operator, [
                'from_shelter_id' => $currentCheckIn->shelter_id,
            ], [
                'to_shelter_id' => $newShelter->id,
            ]);

            return $newCheckIn;
        });
    }
}
