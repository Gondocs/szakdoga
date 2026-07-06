<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CareEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'person_id' => $this->person_id,
            'category' => $this->category->value,
            'note' => $this->note,
            'shelter' => $this->whenLoaded('shelter', fn () => $this->shelter ? [
                'id' => $this->shelter->id,
                'name' => $this->shelter->name,
            ] : null),
            'recorded_by' => $this->whenLoaded('recordedBy', fn () => $this->recordedBy?->name),
            'recorded_at' => $this->recorded_at?->toIso8601String(),
        ];
    }
}
