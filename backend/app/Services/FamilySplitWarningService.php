<?php

namespace App\Services;

use App\Enums\RegistrationStatus;
use App\Models\Person;

/**
 * Interreg tanulmány "Automatikus figyelmeztetés, ha egy család tagjai külön
 * befogadóhelyre kerülnének" funkciója (7. fejezet): érkeztetéskor és
 * áthelyezéskor ellenőrzi, hogy a személy jelenlegi befogadóhelye eltér-e
 * a család már befogadóhelyen tartózkodó többi tagjának elhelyezésétől.
 */
class FamilySplitWarningService
{
    public function detect(Person $person): ?string
    {
        if (! $person->family_id) {
            return null;
        }

        $currentShelterId = $person->checkins()->latest('checked_in_at')->latest('id')->first()?->shelter_id;

        if (! $currentShelterId) {
            return null;
        }

        $otherMembers = Person::where('family_id', $person->family_id)
            ->where('id', '!=', $person->id)
            ->whereHas('registration', fn ($q) => $q->where('status', RegistrationStatus::ArrivedShelter->value))
            ->with(['checkins' => fn ($q) => $q->orderByDesc('checked_in_at')->orderByDesc('id')->with('shelter')])
            ->get();

        $differing = $otherMembers
            ->map(fn ($member) => [
                'person' => $member,
                'shelter' => $member->checkins->first()?->shelter,
            ])
            ->filter(fn ($row) => $row['shelter'] && $row['shelter']->id !== $currentShelterId);

        if ($differing->isEmpty()) {
            return null;
        }

        $details = $differing
            ->map(fn ($row) => "{$row['person']->fullName()} ({$row['shelter']->name})")
            ->implode(', ');

        return "Figyelem: a család más tagjai jelenleg más befogadóhelyen tartózkodnak: {$details}.";
    }
}
