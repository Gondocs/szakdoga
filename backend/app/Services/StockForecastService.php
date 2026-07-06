<?php

namespace App\Services;

use App\Enums\RegistrationStatus;
use App\Enums\SpecialNeedCategory;
use App\Models\EvacuationEvent;
use App\Models\Person;

/**
 * Interreg tanulmány "Napi készletigény-előrejelzés" funkciója: a jelenleg
 * befogadóhelyen tartózkodó személyek száma és egyedi igényei alapján napi
 * étkezési adag-, takaró-, matrac- és gyógyszerigény becslése.
 */
class StockForecastService
{
    private const MEALS_PER_PERSON_PER_DAY = 3;

    public function forEvent(EvacuationEvent $event): array
    {
        $eventShelters = $event->eventShelters()->with('shelter')->get();

        $persons = Person::where('event_id', $event->id)
            ->whereHas('registration', fn ($q) => $q->where('status', RegistrationStatus::ArrivedShelter->value))
            ->with(['checkins' => fn ($q) => $q->orderByDesc('checked_in_at'), 'specialNeeds'])
            ->get();

        $statsByShelter = [];

        foreach ($persons as $person) {
            $latestCheckIn = $person->checkins->first();

            if (! $latestCheckIn) {
                continue;
            }

            $shelterId = $latestCheckIn->shelter_id;
            $statsByShelter[$shelterId] ??= ['count' => 0, 'medical' => 0, 'diet' => 0];
            $statsByShelter[$shelterId]['count']++;

            foreach ($person->specialNeeds as $need) {
                if ($need->category === SpecialNeedCategory::Medical) {
                    $statsByShelter[$shelterId]['medical']++;
                } elseif ($need->category === SpecialNeedCategory::Diet) {
                    $statsByShelter[$shelterId]['diet']++;
                }
            }
        }

        $rows = $eventShelters->map(function ($eventShelter) use ($statsByShelter) {
            $stats = $statsByShelter[$eventShelter->shelter_id] ?? ['count' => 0, 'medical' => 0, 'diet' => 0];

            return [
                'shelter_id' => $eventShelter->shelter_id,
                'shelter_name' => $eventShelter->shelter?->name,
                'checked_in_count' => $stats['count'],
                'meal_portions_per_day' => $stats['count'] * self::MEALS_PER_PERSON_PER_DAY,
                'special_diet_portions_per_day' => $stats['diet'] * self::MEALS_PER_PERSON_PER_DAY,
                'blankets_needed' => $stats['count'],
                'mattresses_needed' => $stats['count'],
                'medicine_needed_count' => $stats['medical'],
            ];
        })->values();

        $totals = [
            'checked_in_count' => $rows->sum('checked_in_count'),
            'meal_portions_per_day' => $rows->sum('meal_portions_per_day'),
            'special_diet_portions_per_day' => $rows->sum('special_diet_portions_per_day'),
            'blankets_needed' => $rows->sum('blankets_needed'),
            'mattresses_needed' => $rows->sum('mattresses_needed'),
            'medicine_needed_count' => $rows->sum('medicine_needed_count'),
        ];

        return [
            'generated_at' => now()->toIso8601String(),
            'by_shelter' => $rows,
            'totals' => $totals,
        ];
    }
}
