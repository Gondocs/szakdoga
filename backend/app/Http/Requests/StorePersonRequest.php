<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePersonRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', \App\Models\Person::class);
    }

    public function rules(): array
    {
        $eventId = $this->route('event')?->id;

        return [
            'last_name' => ['required', 'string', 'max:100'],
            'first_name' => ['required', 'string', 'max:100'],
            'birth_last_name' => ['nullable', 'string', 'max:100'],
            'birth_first_name' => ['nullable', 'string', 'max:100'],
            'birth_place' => ['nullable', 'string', 'max:255'],
            'birth_date' => ['nullable', 'date'],
            'gender' => ['nullable', 'in:male,female,other'],
            'id_document_number' => ['nullable', 'string', 'max:50'],
            'mother_birth_name' => ['nullable', 'string', 'max:200'],
            'municipality_id' => ['required', 'exists:municipalities,id'],
            'address_postal_code' => ['nullable', 'string', 'max:10'],
            'address_settlement' => ['nullable', 'string', 'max:255'],
            'address_street' => ['nullable', 'string', 'max:255'],
            'address_house_number' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],

            'family_id' => [
                'nullable',
                'uuid',
                Rule::exists('families', 'id')->where('event_id', $eventId),
            ],
            'create_new_family' => ['nullable', 'boolean'],
            'is_primary_contact' => ['nullable', 'boolean'],

            'central_transport_required' => ['nullable', 'boolean'],
            'central_accommodation_required' => ['nullable', 'boolean'],
            'under_regular_medical_care' => ['nullable', 'boolean'],
            'own_vehicle' => ['nullable', 'boolean'],
            'travels_alone' => ['nullable', 'boolean'],

            'special_needs' => ['array'],
            'special_needs.*.category' => ['required_with:special_needs', 'in:medical,mobility,age,diet,animal,other'],
            'special_needs.*.type' => ['nullable', 'string', 'max:100'],
            'special_needs.*.priority' => ['nullable', 'integer', 'min:1', 'max:5'],
            'special_needs.*.description' => ['nullable', 'string'],

            'animals' => ['array'],
            'animals.*.animal_type' => ['required_with:animals', 'string', 'max:100'],
            'animals.*.count' => ['nullable', 'integer', 'min:1'],
            'animals.*.stays_at_address' => ['nullable', 'boolean'],
        ];
    }
}
