<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\Incident;
use App\Models\User;

class IncidentPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar, RoleCode::ShelterOperator);
    }

    public function resolve(User $user, Incident $incident): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar, RoleCode::ShelterOperator);
    }
}
