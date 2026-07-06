<?php

namespace Database\Seeders;

use App\Enums\EventStatus;
use App\Models\EvacuationEvent;
use App\Models\Shelter;
use Illuminate\Database\Seeder;

class EvacuationEventSeeder extends Seeder
{
    public function run(): void
    {
        $activeEvent = EvacuationEvent::updateOrCreate(
            ['code' => 'EVT-2026-001'],
            [
                'name' => 'Mosoni-Duna árvízi kitelepítés',
                'status' => EventStatus::Active,
                'starts_at' => now()->subDays(2),
                'ends_at' => null,
            ]
        );

        $shelters = Shelter::orderBy('name')->take(4)->get();

        foreach ($shelters as $shelter) {
            $activeEvent->eventShelters()->updateOrCreate(
                ['shelter_id' => $shelter->id],
                ['capacity_limit' => $shelter->capacity_total]
            );
        }

        EvacuationEvent::updateOrCreate(
            ['code' => 'EVT-2025-014'],
            [
                'name' => 'Tavalyi gyakorlat - lezárt esemény',
                'status' => EventStatus::Closed,
                'starts_at' => now()->subMonths(6),
                'ends_at' => now()->subMonths(6)->addDays(3),
            ]
        );

        $pausedEvent = EvacuationEvent::updateOrCreate(
            ['code' => 'EVT-2026-002'],
            [
                'name' => 'Rábca gátszakadás - szüneteltetett kitelepítés',
                'status' => EventStatus::Paused,
                'starts_at' => now()->subDays(10),
                'ends_at' => null,
            ]
        );

        foreach (Shelter::orderBy('name')->skip(4)->take(2)->get() as $shelter) {
            $pausedEvent->eventShelters()->updateOrCreate(
                ['shelter_id' => $shelter->id],
                ['capacity_limit' => $shelter->capacity_total]
            );
        }

        EvacuationEvent::updateOrCreate(
            ['code' => 'EVT-2026-003'],
            [
                'name' => 'Téli veszélyhelyzeti terv - tervezett kitelepítés',
                'status' => EventStatus::Draft,
                'starts_at' => null,
                'ends_at' => null,
            ]
        );
    }
}
