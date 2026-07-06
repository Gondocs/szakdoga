<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\User;

class RepatriationAuthorizationPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function manage(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }
}
