<?php

namespace Database\Seeders;

use App\Enums\ShelterStatus;
use App\Models\Municipality;
use App\Models\Shelter;
use Illuminate\Database\Seeder;

class ShelterSeeder extends Seeder
{
    public function run(): void
    {
        $shelters = [
            ['name' => 'Győri Városi Sportcsarnok', 'municipality' => 'Győr', 'capacity' => 250, 'medical' => true],
            ['name' => 'Mosonmagyaróvári Iskola Tornaterem', 'municipality' => 'Mosonmagyaróvár', 'capacity' => 120, 'medical' => false],
            ['name' => 'Soproni Közösségi Ház', 'municipality' => 'Sopron', 'capacity' => 180, 'medical' => true],
            ['name' => 'Csornai Sportcsarnok', 'municipality' => 'Csorna', 'capacity' => 90, 'medical' => false],
            ['name' => 'Kapuvári Művelődési Ház', 'municipality' => 'Kapuvár', 'capacity' => 60, 'medical' => false],
            ['name' => 'Téti Iskola', 'municipality' => 'Tét', 'capacity' => 45, 'medical' => false],
        ];

        foreach ($shelters as $data) {
            $municipality = Municipality::where('name', $data['municipality'])->first();

            Shelter::updateOrCreate(
                ['name' => $data['name']],
                [
                    'municipality_id' => $municipality->id,
                    'address' => $data['municipality'].', Fő tér 1.',
                    'capacity_total' => $data['capacity'],
                    'accessible_capacity' => (int) round($data['capacity'] * 0.15),
                    'medical_support_available' => $data['medical'],
                    'status' => ShelterStatus::Active,
                    'contact_phone' => '+36 96 000 000',
                ]
            );
        }
    }
}
