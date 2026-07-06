<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\Shelter;
use App\Models\User;

class ShelterPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Shelter $shelter): bool
    {
        return true;
    }

    public function checkIn(User $user, Shelter $shelter): bool
    {
        if ($user->hasRole(RoleCode::Admin, RoleCode::Manager)) {
            return true;
        }

        return $user->hasRole(RoleCode::ShelterOperator) && $user->shelter_id === $shelter->id;
    }

    public function resolveQr(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::ShelterOperator);
    }

    public function printRoster(User $user, Shelter $shelter): bool
    {
        if ($user->hasRole(RoleCode::Admin, RoleCode::Manager)) {
            return true;
        }

        return $user->hasRole(RoleCode::ShelterOperator) && $user->shelter_id === $shelter->id;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function update(User $user, Shelter $shelter): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function delete(User $user, Shelter $shelter): bool
    {
        return $user->hasRole(RoleCode::Admin);
    }
}
