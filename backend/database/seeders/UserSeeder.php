<?php

namespace Database\Seeders;

use App\Enums\RoleCode;
use App\Models\Role;
use App\Models\Shelter;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Egy-egy demonstrációs felhasználó szerepkörönként, bemutatáshoz és teszteléshez.
     * Jelszó minden fiókhoz: "password".
     */
    public function run(): void
    {
        $roleId = fn (RoleCode $code) => Role::where('code', $code->value)->value('id');

        User::updateOrCreate(
            ['email' => 'admin@katasztrofavedelem.test'],
            ['name' => 'Admin Felhasználó', 'role_id' => $roleId(RoleCode::Admin), 'password' => bcrypt('password')]
        );

        User::updateOrCreate(
            ['email' => 'vezeto@katasztrofavedelem.test'],
            ['name' => 'Kovács Vezető', 'role_id' => $roleId(RoleCode::Manager), 'password' => bcrypt('password')]
        );

        User::updateOrCreate(
            ['email' => 'regisztrator@katasztrofavedelem.test'],
            ['name' => 'Nagy Regisztrátor', 'role_id' => $roleId(RoleCode::Registrar), 'password' => bcrypt('password')]
        );

        User::updateOrCreate(
            ['email' => 'auditor@katasztrofavedelem.test'],
            ['name' => 'Szabó Auditor', 'role_id' => $roleId(RoleCode::Auditor), 'password' => bcrypt('password')]
        );

        $firstShelter = Shelter::query()->first();

        User::updateOrCreate(
            ['email' => 'befogadohely@katasztrofavedelem.test'],
            [
                'name' => 'Tóth Befogadóhelyi Kezelő',
                'role_id' => $roleId(RoleCode::ShelterOperator),
                'shelter_id' => $firstShelter?->id,
                'password' => bcrypt('password'),
            ]
        );
    }
}
