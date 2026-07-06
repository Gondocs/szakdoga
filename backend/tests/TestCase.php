<?php

namespace Tests;

use App\Enums\RoleCode;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function actingAsRole(RoleCode $code, array $attributes = []): User
    {
        $role = Role::firstOrCreate(
            ['code' => $code->value],
            ['name' => $code->value, 'description' => null]
        );

        $user = User::factory()->create(array_merge(['role_id' => $role->id], $attributes));

        $this->actingAs($user);

        return $user;
    }
}
