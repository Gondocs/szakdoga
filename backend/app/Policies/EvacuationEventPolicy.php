<?php

namespace App\Policies;

use App\Enums\RoleCode;
use App\Models\EvacuationEvent;
use App\Models\User;

class EvacuationEventPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, EvacuationEvent $event): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function update(User $user, EvacuationEvent $event): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function viewDashboard(User $user, EvacuationEvent $event): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager, RoleCode::Registrar, RoleCode::ShelterOperator, RoleCode::Auditor);
    }

    public function export(User $user, EvacuationEvent $event): bool
    {
        return $user->hasRole(RoleCode::Admin, RoleCode::Manager);
    }

    public function delete(User $user, EvacuationEvent $event): bool
    {
        return $user->hasRole(RoleCode::Admin);
    }
}
