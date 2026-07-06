<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShelterResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'municipality' => $this->whenLoaded('municipality', fn () => $this->municipality->name),
            'coordinates' => $this->whenLoaded('municipality', fn () => $this->municipality->lat !== null && $this->municipality->lng !== null
                ? ['lat' => (float) $this->municipality->lat, 'lng' => (float) $this->municipality->lng]
                : null),
            'address' => $this->address,
            'capacity_total' => $this->capacity_total,
            'accessible_capacity' => $this->accessible_capacity,
            'medical_support_available' => $this->medical_support_available,
            'drinking_water_available' => $this->drinking_water_available,
            'meals_available' => $this->meals_available,
            'hygiene_facilities_available' => $this->hygiene_facilities_available,
            'childcare_available' => $this->childcare_available,
            'psychological_support_available' => $this->psychological_support_available,
            'house_rules' => $this->house_rules,
            'public_health_notes' => $this->public_health_notes,
            'status' => $this->status->value,
            'contact_phone' => $this->contact_phone,
            'event_capacity' => $this->when(isset($this->pivot), fn () => [
                'capacity_limit' => $this->pivot->capacity_limit,
                'checked_in_count' => $this->pivot->checked_in_count,
            ]),
        ];
    }
}
