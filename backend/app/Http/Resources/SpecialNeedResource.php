<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SpecialNeedResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category->value,
            'type' => $this->type,
            'priority' => $this->priority,
            'description' => $this->description,
        ];
    }
}
