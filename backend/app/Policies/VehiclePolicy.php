<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\User;
use App\Models\Vehicle;

class VehiclePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar, RoleCode::ShelterOperator, RoleCode::Auditor);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function update(User $user, Vehicle $vehicle): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function delete(User $user, Vehicle $vehicle): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }
}
