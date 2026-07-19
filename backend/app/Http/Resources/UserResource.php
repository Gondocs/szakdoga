<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'avatar_url' => $this->avatarUrl(),
            'two_factor_enabled' => $this->two_factor_enabled,
            'role' => $this->whenLoaded('role', fn () => $this->role ? [
                'id' => $this->role->id,
                'code' => $this->role->code,
                'name' => $this->role->name,
            ] : null),
            'shelter_id' => $this->shelter_id,
            'shelter' => $this->whenLoaded('shelter', fn () => $this->shelter ? [
                'id' => $this->shelter->id,
                'name' => $this->shelter->name,
            ] : null),
        ];
    }
}
