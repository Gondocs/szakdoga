<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class IncidentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category->value,
            'severity' => $this->severity->value,
            'description' => $this->description,
            'status' => $this->status,
            'shelter' => $this->whenLoaded('shelter', fn () => $this->shelter ? [
                'id' => $this->shelter->id,
                'name' => $this->shelter->name,
            ] : null),
            'person' => $this->whenLoaded('person', fn () => $this->person ? [
                'id' => $this->person->id,
                'full_name' => $this->person->fullName(),
            ] : null),
            'reported_by' => $this->whenLoaded('reportedBy', fn () => $this->reportedBy?->name),
            'resolved_by' => $this->whenLoaded('resolvedBy', fn () => $this->resolvedBy?->name),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
