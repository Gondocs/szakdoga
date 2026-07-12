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
    /**
     * Megvizsgálja, hogy a megadott személy családjának más, már
     * befogadóhelyre érkezett tagjai eltérő szálláshelyen vannak-e, mint ő
     * maga. Ha igen, egy magyar nyelvű figyelmeztető szöveget ad vissza,
     * egyébként null-t.
     */
    public function detect(Person $person): ?string
    {
        if (! $person->family_id) {
            return null;
        }

        // A személy legutolsó (legfrissebb) bejelentkezéséhez tartozó
        // szálláshely azonosítója
        $currentShelterId = $person->checkins()->latest('checked_in_at')->latest('id')->first()?->shelter_id;

        if (! $currentShelterId) {
            return null;
        }

        // A család azon többi tagja, akik már megérkeztek egy
        // befogadóhelyre
        $otherMembers = Person::where('family_id', $person->family_id)
            ->where('id', '!=', $person->id)
            ->whereHas('registration', fn ($q) => $q->where('status', RegistrationStatus::ArrivedShelter->value))
            ->with(['checkins' => fn ($q) => $q->orderByDesc('checked_in_at')->orderByDesc('id')->with('shelter')])
            ->get();

        // Kiszűrjük azokat a családtagokat, akiknek a jelenlegi
        // szálláshelye eltér a vizsgált személy szálláshelyétől
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
