<?php

namespace Database\Factories;

use App\Models\EvacuationEvent;
use App\Models\Family;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Family>
 */
class FamilyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'event_id' => EvacuationEvent::factory(),
            'family_code' => 'F-'.Str::upper(Str::random(6)),
        ];
    }
}
