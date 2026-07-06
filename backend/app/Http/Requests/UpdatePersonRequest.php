<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePersonRequest extends FormRequest
{
    public function authorize(): bool
    {
        $person = $this->route('person');

        if (! $this->user()->can('update', $person)) {
            return false;
        }

        return $person->event->isActive();
    }

    public function rules(): array
    {
        return [
            'last_name' => ['sometimes', 'required', 'string', 'max:100'],
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'birth_last_name' => ['nullable', 'string', 'max:100'],
            'birth_first_name' => ['nullable', 'string', 'max:100'],
            'birth_place' => ['nullable', 'string', 'max:255'],
            'birth_date' => ['nullable', 'date'],
            'gender' => ['nullable', 'in:male,female,other'],
            'id_document_number' => ['nullable', 'string', 'max:50'],
            'mother_birth_name' => ['nullable', 'string', 'max:200'],
            'municipality_id' => ['sometimes', 'required', 'exists:municipalities,id'],
            'address_postal_code' => ['nullable', 'string', 'max:10'],
            'address_settlement' => ['nullable', 'string', 'max:255'],
            'address_street' => ['nullable', 'string', 'max:255'],
            'address_house_number' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
        ];
    }
}
