<?php

namespace Database\Seeders;

use App\Models\Municipality;
use Illuminate\Database\Seeder;

class MunicipalitySeeder extends Seeder
{
    public function run(): void
    {
        $municipalities = [
            ['Győr', '9021', 47.687500, 17.650400],
            ['Mosonmagyaróvár', '9200', 47.871900, 17.268600],
            ['Sopron', '9400', 47.681700, 16.584500],
            ['Csorna', '9300', 47.616700, 17.250000],
            ['Kapuvár', '9330', 47.583300, 17.033300],
            ['Tét', '9100', 47.516700, 17.533300],
            ['Rajka', '9224', 48.016700, 17.200000],
            ['Fertőd', '9431', 47.616700, 16.883300],
        ];

        foreach ($municipalities as [$name, $postalCode, $lat, $lng]) {
            Municipality::updateOrCreate(
                ['name' => $name],
                ['county' => 'Győr-Moson-Sopron', 'postal_code' => $postalCode, 'lat' => $lat, 'lng' => $lng]
            );
        }
    }
}
