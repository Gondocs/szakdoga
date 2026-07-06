<?php

namespace App\Actions\Registrations;

use App\Enums\RegistrationStatus;
use App\Models\CheckIn;
use App\Models\EventShelter;
use App\Models\Registration;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Support\Facades\DB;

class UpdateRegistrationStatusAction
{
    public function __construct(private readonly AuditService $auditService)
    {
    }

    /**
     * Kézi státuszváltás (F8 követelmény): a hatósági dolgozó a checkin-folyamaton
     * kívül is állíthatja a regisztráció státuszát (pl. "szállítás alatt",
     * "visszatelepült", "törölt"). Ha a személy korábban befogadóhelyen tartózkodott
     * és onnan kerül ki, a kapcsolódó befogadóhely foglaltságát is csökkentjük.
     */
    public function execute(Registration $registration, RegistrationStatus $newStatus, User $actor): Registration
    {
        return DB::transaction(function () use ($registration, $newStatus, $actor) {
            $oldStatus = $registration->status;

            if ($oldStatus === RegistrationStatus::ArrivedShelter && $newStatus !== RegistrationStatus::ArrivedShelter) {
                $lastCheckIn = CheckIn::where('person_id', $registration->person_id)
                    ->where('event_id', $registration->event_id)
                    ->latest('checked_in_at')
                    ->first();

                if ($lastCheckIn) {
                    EventShelter::where('event_id', $registration->event_id)
                        ->where('shelter_id', $lastCheckIn->shelter_id)
                        ->where('checked_in_count', '>', 0)
                        ->decrement('checked_in_count');
                }
            }

            $registration->update(['status' => $newStatus]);

            $this->auditService->recordStatusChange($registration, $oldStatus->value, $newStatus->value, $actor);
            $this->auditService->log('status_update', $registration, $actor, ['status' => $oldStatus->value], ['status' => $newStatus->value]);

            return $registration->fresh();
        });
    }
}
