<?php

namespace App\Services;

use App\Models\EvacuationEvent;
use Carbon\Carbon;

class DemographicsService
{
    /**
     * Egy evakuációs eseményhez tartozó személyek nem és korcsoport szerinti
     * eloszlását (demográfiai statisztikáját) állítja elő.
     *
     * @return array{gender: array<string, int>, age: array<string, int>}
     */
    public function breakdown(EvacuationEvent $event): array
    {
        // Nemenkénti darabszámok lekérdezése egyetlen csoportosított
        // (GROUP BY) SQL lekérdezéssel
        $genderCounts = $event->persons()
            ->whereNotNull('gender')
            ->selectRaw('gender, count(*) as total')
            ->groupBy('gender')
            ->pluck('total', 'gender');

        $ageBuckets = ['0-17' => 0, '18-39' => 0, '40-59' => 0, '60-74' => 0, '75+' => 0, 'ismeretlen' => 0];

        // Minden személy születési dátumából kiszámoljuk a jelenlegi
        // életkort, majd az előre definiált korcsoport-sávok (bucket-ek)
        // egyikébe soroljuk
        $event->persons()->pluck('birth_date')->each(function ($birthDate) use (&$ageBuckets) {
            if (! $birthDate) {
                $ageBuckets['ismeretlen']++;

                return;
            }

            $age = $birthDate instanceof \Carbon\CarbonInterface ? $birthDate->age : Carbon::parse($birthDate)->age;

            $bucket = match (true) {
                $age < 18 => '0-17',
                $age < 40 => '18-39',
                $age < 60 => '40-59',
                $age < 75 => '60-74',
                default => '75+',
            };

            $ageBuckets[$bucket]++;
        });

        return [
            'gender' => [
                'male' => $genderCounts->get('male', 0),
                'female' => $genderCounts->get('female', 0),
                'other' => $genderCounts->get('other', 0),
            ],
            'age' => $ageBuckets,
        ];
    }
}
