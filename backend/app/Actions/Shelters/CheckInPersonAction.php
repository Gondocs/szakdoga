<?php

namespace App\Actions\Shelters;

use App\Enums\RegistrationStatus;
use App\Exceptions\AlreadyCheckedInException;
use App\Exceptions\ShelterFullException;
use App\Models\CheckIn;
use App\Models\EvacuationEvent;
use App\Models\EventShelter;
use App\Models\Person;
use App\Models\Shelter;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Support\Facades\DB;

class CheckInPersonAction
{
    public function __construct(private readonly AuditService $auditService)
    {
    }

    /**
     * Tranzakciós érkeztetés a projektleírás 10.1 fejezete szerint:
     * kapacitás-ellenőrzés, checkin rögzítés, regisztráció-státusz és
     * event_shelters.checked_in_count frissítése, majd napló.
     */
    public function execute(EvacuationEvent $event, Person $person, Shelter $shelter, User $operator, bool $overrideCapacity = false): CheckIn
    {
        return DB::transaction(function () use ($event, $person, $shelter, $operator, $overrideCapacity) {
            $registration = $person->registration()->lockForUpdate()->firstOrFail();

            if ($registration->status === RegistrationStatus::ArrivedShelter) {
                throw new AlreadyCheckedInException();
            }

            $eventShelter = EventShelter::where('event_id', $event->id)
                ->where('shelter_id', $shelter->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $overrideCapacity && $eventShelter->checked_in_count >= $eventShelter->capacity_limit) {
                throw new ShelterFullException();
            }

            $checkIn = CheckIn::create([
                'event_id' => $event->id,
                'person_id' => $person->id,
                'shelter_id' => $shelter->id,
                'checked_in_at' => now(),
                'checked_in_by' => $operator->id,
            ]);

            $oldStatus = $registration->status->value;
            $registration->update(['status' => RegistrationStatus::ArrivedShelter]);

            $eventShelter->increment('checked_in_count');

            $this->auditService->recordStatusChange($registration, $oldStatus, RegistrationStatus::ArrivedShelter->value, $operator);
            $this->auditService->log('checkin', $checkIn, $operator, null, $checkIn->toArray());

            return $checkIn;
        });
    }
}
