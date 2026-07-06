<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\User;

class MunicipalityPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function update(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function delete(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin);
    }
}
