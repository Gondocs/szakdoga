<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\Registration;
use App\Models\User;

class RegistrationPolicy
{
    public function updateStatus(User $user, Registration $registration): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar);
    }

    public function bulkUpdateStatus(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar);
    }
}
