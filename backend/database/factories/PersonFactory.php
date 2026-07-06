<?php

namespace Database\Factories;

use App\Models\EvacuationEvent;
use App\Models\Municipality;
use App\Models\Person;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Person>
 */
class PersonFactory extends Factory
{
    public function definition(): array
    {
        return [
            'event_id' => EvacuationEvent::factory(),
            'family_id' => null,
            'municipality_id' => Municipality::factory(),
            'last_name' => fake()->lastName(),
            'first_name' => fake()->firstName(),
            'birth_last_name' => null,
            'birth_first_name' => null,
            'birth_place' => fake()->city(),
            'birth_date' => fake()->dateTimeBetween('-90 years', '-1 years')->format('Y-m-d'),
            'mother_birth_name' => fake()->name('female'),
            'address_postal_code' => (string) fake()->numberBetween(9000, 9499),
            'address_settlement' => fake()->city(),
            'address_street' => fake()->streetName(),
            'address_house_number' => (string) fake()->numberBetween(1, 99),
            'phone' => fake()->boolean(70) ? fake()->phoneNumber() : null,
            'email' => fake()->boolean(40) ? fake()->safeEmail() : null,
        ];
    }
}
