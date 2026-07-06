<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PersonResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event_id' => $this->event_id,
            'citizen_id' => $this->citizen_id,
            'family_id' => $this->family_id,
            'family' => $this->whenLoaded('family', fn () => $this->family ? [
                'id' => $this->family->id,
                'family_code' => $this->family->family_code,
            ] : null),
            'last_name' => $this->last_name,
            'first_name' => $this->first_name,
            'full_name' => $this->fullName(),
            'birth_place' => $this->birth_place,
            'birth_date' => $this->birth_date?->toDateString(),
            'gender' => $this->gender?->value,
            'id_document_number' => $this->id_document_number,
            'document_photo_front_url' => $this->documentPhotoFrontUrl(),
            'document_photo_back_url' => $this->documentPhotoBackUrl(),
            'municipality' => $this->whenLoaded('municipality', fn () => [
                'id' => $this->municipality->id,
                'name' => $this->municipality->name,
            ]),
            'address' => [
                'postal_code' => $this->address_postal_code,
                'settlement' => $this->address_settlement,
                'street' => $this->address_street,
                'house_number' => $this->address_house_number,
            ],
            'phone' => $this->phone,
            'email' => $this->email,
            'registration' => $this->whenLoaded('registration', fn () => $this->registration ? [
                'id' => $this->registration->id,
                'status' => $this->registration->status->value,
                'channel' => $this->registration->channel?->value,
                'central_transport_required' => $this->registration->central_transport_required,
                'central_accommodation_required' => $this->registration->central_accommodation_required,
                'under_regular_medical_care' => $this->registration->under_regular_medical_care,
                'own_vehicle' => $this->registration->own_vehicle,
                'travels_alone' => $this->registration->travels_alone,
                'registered_at' => $this->registration->registered_at?->toIso8601String(),
                'self_arrival_confirmed_at' => $this->registration->self_arrival_confirmed_at?->toIso8601String(),
            ] : null),
            'current_shelter' => $this->whenLoaded('checkins', function () {
                $latest = $this->checkins->sortByDesc('checked_in_at')->first();

                return $latest ? [
                    'id' => $latest->shelter_id,
                    'name' => $latest->shelter?->name,
                ] : null;
            }),
            'special_needs' => SpecialNeedResource::collection($this->whenLoaded('specialNeeds')),
            'animals' => $this->whenLoaded('animals', fn () => $this->animals->map(fn ($a) => [
                'id' => $a->id,
                'animal_type' => $a->animal_type,
                'count' => $a->count,
                'stays_at_address' => $a->stays_at_address,
            ])),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
