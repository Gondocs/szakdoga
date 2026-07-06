<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('targetUser') ?? User::class);
    }

    public function rules(): array
    {
        $userId = $this->route('targetUser')?->id;

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($userId)],
            'password' => ['sometimes', 'nullable', 'string', Password::min(8)],
            'role_id' => ['sometimes', 'required', 'exists:roles,id'],
            'shelter_id' => ['sometimes', 'nullable', 'uuid', 'exists:shelters,id'],
        ];
    }
}
