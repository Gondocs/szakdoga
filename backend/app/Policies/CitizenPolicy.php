<?php

namespace App\Policies;

use App\Models\Citizen;
use App\Models\User;

class CitizenPolicy
{
    public function view(User $user, Citizen $citizen): bool
    {
        return true;
    }
}
