<?php

namespace Database\Factories;

use App\Enums\RegistrationStatus;
use App\Models\EvacuationEvent;
use App\Models\Person;
use App\Models\Registration;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Registration>
 */
class RegistrationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'person_id' => Person::factory(),
            'event_id' => EvacuationEvent::factory(),
            'status' => RegistrationStatus::Registered,
            'central_transport_required' => fake()->boolean(25),
            'central_accommodation_required' => fake()->boolean(35),
            'under_regular_medical_care' => fake()->boolean(15),
            'own_vehicle' => fake()->boolean(45),
            'travels_alone' => fake()->boolean(30),
            'registered_at' => now(),
            'registered_by' => User::factory(),
        ];
    }
}
