<?php

namespace Database\Seeders;

use App\Enums\RoleCode;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [RoleCode::Admin, 'Rendszergazda', 'Felhasználók, szerepkörök, alapadatok és események kezelése.'],
            [RoleCode::Manager, 'Műveleti vezető', 'Dashboard, jelentések, esemény állapot, kapacitások áttekintése.'],
            [RoleCode::Registrar, 'Regisztrátor', 'Személyek és családok rögzítése, QR-kód generálás.'],
            [RoleCode::ShelterOperator, 'Befogadóhelyi kezelő', 'QR beolvasás, érkeztetés, kapacitás figyelése saját befogadóhelyen.'],
            [RoleCode::Auditor, 'Auditor / megfigyelő', 'Naplók és jelentések megtekintése.'],
        ];

        foreach ($roles as [$code, $name, $description]) {
            Role::updateOrCreate(
                ['code' => $code->value],
                ['name' => $name, 'description' => $description]
            );
        }
    }
}
