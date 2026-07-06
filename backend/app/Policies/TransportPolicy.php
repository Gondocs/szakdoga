<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\Transport;
use App\Models\User;

class TransportPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar, RoleCode::ShelterOperator, RoleCode::Auditor);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function update(User $user, Transport $transport): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function delete(User $user, Transport $transport): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function boardOrAlight(User $user, Transport $transport): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar, RoleCode::ShelterOperator);
    }
}
