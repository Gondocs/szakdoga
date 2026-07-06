<?php

namespace Database\Factories;

use App\Enums\ShelterStatus;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Shelter>
 */
class ShelterFactory extends Factory
{
    public function definition(): array
    {
        $capacity = fake()->numberBetween(30, 300);

        return [
            'name' => fake()->company().' Sportcsarnok',
            'municipality_id' => Municipality::factory(),
            'address' => fake()->streetAddress(),
            'capacity_total' => $capacity,
            'accessible_capacity' => (int) round($capacity * 0.1),
            'medical_support_available' => fake()->boolean(40),
            'status' => ShelterStatus::Active,
            'contact_phone' => fake()->phoneNumber(),
        ];
    }
}
