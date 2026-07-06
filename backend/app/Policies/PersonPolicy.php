<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\Person;
use App\Models\User;

class PersonPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Person $person): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar);
    }

    public function update(User $user, Person $person): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Registrar);
    }

    public function issueQr(User $user, Person $person): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar);
    }
}
