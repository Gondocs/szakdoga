<?php

namespace Database\Factories;

use App\Models\Person;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\Animal>
 */
class AnimalFactory extends Factory
{
    public function definition(): array
    {
        return [
            'person_id' => Person::factory(),
            'animal_type' => fake()->randomElement(['kutya', 'macska', 'nyúl', 'baromfi']),
            'count' => fake()->numberBetween(1, 3),
            'stays_at_address' => fake()->boolean(20),
        ];
    }
}
