<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\User;

class CareEventPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar, RoleCode::ShelterOperator);
    }
}
