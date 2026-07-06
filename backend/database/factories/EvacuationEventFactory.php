<?php

namespace Database\Factories;

use App\Enums\EventStatus;
use App\Models\EvacuationEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EvacuationEvent>
 */
class EvacuationEventFactory extends Factory
{
    public function definition(): array
    {
        return [
            'code' => 'EVT-'.fake()->unique()->numerify('####'),
            'name' => fake()->randomElement(['Árvízi kitelepítés', 'Ipari baleset', 'Belvíz-elöntés', 'Erdőtűz']).' - '.fake()->city(),
            'status' => EventStatus::Draft,
            'starts_at' => now()->subDays(fake()->numberBetween(0, 5)),
            'ends_at' => null,
        ];
    }

    public function active(): static
    {
        return $this->state(fn () => ['status' => EventStatus::Active]);
    }

    public function closed(): static
    {
        return $this->state(fn () => ['status' => EventStatus::Closed, 'ends_at' => now()->subDay()]);
    }
}
