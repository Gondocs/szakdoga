<?php

namespace Database\Factories;

use App\Enums\SpecialNeedCategory;
use App\Models\Person;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\SpecialNeed>
 */
class SpecialNeedFactory extends Factory
{
    public function definition(): array
    {
        return [
            'person_id' => Person::factory(),
            'category' => fake()->randomElement(SpecialNeedCategory::cases())->value,
            'type' => fake()->randomElement(['mozgáskorlátozott', 'inzulinfüggő', 'terhes', 'idős', 'speciális diéta']),
            'priority' => fake()->numberBetween(1, 5),
            'description' => fake()->boolean(60) ? fake()->sentence() : null,
        ];
    }
}
