<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\User;

class AuditLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Auditor);
    }
}
