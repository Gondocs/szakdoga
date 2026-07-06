<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin);
    }

    public function update(User $user, User $target): bool
    {
        return $user->hasRole(RoleCode::Admin);
    }

    public function updateAvatar(User $user, User $target): bool
    {
        return $user->hasRole(RoleCode::Admin) || $user->id === $target->id;
    }

    public function generateTestData(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin);
    }
}
