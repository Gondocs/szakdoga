<?php

namespace Database\Factories;

use App\Models\Municipality;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Municipality>
 */
class MunicipalityFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->city(),
            'county' => 'Győr-Moson-Sopron',
            'postal_code' => (string) fake()->numberBetween(9000, 9499),
        ];
    }
}
