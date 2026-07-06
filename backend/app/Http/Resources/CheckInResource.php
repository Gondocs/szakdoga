<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CheckInResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event_id' => $this->event_id,
            'person' => $this->whenLoaded('person', fn () => [
                'id' => $this->person->id,
                'full_name' => $this->person->fullName(),
            ]),
            'shelter' => $this->whenLoaded('shelter', fn () => [
                'id' => $this->shelter->id,
                'name' => $this->shelter->name,
            ]),
            'bed_label' => $this->bed_label,
            'checked_in_at' => $this->checked_in_at?->toIso8601String(),
            'checked_in_by' => $this->whenLoaded('checkedInBy', fn () => $this->checkedInBy->name),
            'temporary_leave_at' => $this->temporary_leave_at?->toIso8601String(),
            'temporary_return_at' => $this->temporary_return_at?->toIso8601String(),
        ];
    }
}
