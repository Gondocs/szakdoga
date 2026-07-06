<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EvacuationEventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'status' => $this->status->value,
            'starts_at' => $this->starts_at?->toIso8601String(),
            'ends_at' => $this->ends_at?->toIso8601String(),
            'shelters' => $this->whenLoaded('eventShelters', fn () => $this->eventShelters->map(fn ($es) => [
                'id' => $es->id,
                'shelter_id' => $es->shelter_id,
                'shelter_name' => $es->shelter?->name,
                'capacity_limit' => $es->capacity_limit,
                'checked_in_count' => $es->checked_in_count,
            ])),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
