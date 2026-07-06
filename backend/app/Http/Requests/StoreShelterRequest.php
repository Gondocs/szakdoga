<?php

namespace App\Http\Requests;

use App\Models\Shelter;
use Illuminate\Foundation\Http\FormRequest;

class StoreShelterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Shelter::class);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'municipality_id' => ['required', 'exists:municipalities,id'],
            'address' => ['required', 'string', 'max:255'],
            'capacity_total' => ['required', 'integer', 'min:1'],
            'accessible_capacity' => ['nullable', 'integer', 'min:0'],
            'medical_support_available' => ['nullable', 'boolean'],
            'drinking_water_available' => ['nullable', 'boolean'],
            'meals_available' => ['nullable', 'boolean'],
            'hygiene_facilities_available' => ['nullable', 'boolean'],
            'childcare_available' => ['nullable', 'boolean'],
            'psychological_support_available' => ['nullable', 'boolean'],
            'house_rules' => ['nullable', 'string', 'max:5000'],
            'public_health_notes' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', 'in:planned,active,full,inactive'],
            'contact_phone' => ['nullable', 'string', 'max:50'],
        ];
    }
}
