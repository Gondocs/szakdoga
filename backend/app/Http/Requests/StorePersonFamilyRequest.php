<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Helyszíni (regisztrátor által kezelt) CSALÁDI regisztráció: egy kérésben
 * több családtagot rögzít, mindegyiket saját, önálló adatlappal — a
 * StorePersonRequest egyszemélyes változatával szemben itt a `members`
 * tömb minden eleme ugyanazokat a mezőket kéri be. A családhoz tartozás
 * (meglévő családhoz csatlakozás vagy új család létrehozása) egyetlen,
 * a kérés tetején megadott döntés, nem személyenkénti — ezt a
 * kontroller alkalmazza minden tagra.
 */
class StorePersonFamilyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', \App\Models\Person::class);
    }

    public function rules(): array
    {
        $eventId = $this->route('event')?->id;

        return [
            'family_id' => [
                'nullable',
                'uuid',
                Rule::exists('families', 'id')->where('event_id', $eventId),
            ],
            'create_new_family' => ['nullable', 'boolean'],

            'members' => ['required', 'array', 'min:1', 'max:12'],

            'members.*.last_name' => ['required', 'string', 'max:100'],
            'members.*.first_name' => ['required', 'string', 'max:100'],
            'members.*.birth_last_name' => ['nullable', 'string', 'max:100'],
            'members.*.birth_first_name' => ['nullable', 'string', 'max:100'],
            'members.*.birth_place' => ['nullable', 'string', 'max:255'],
            'members.*.birth_date' => ['nullable', 'date'],
            'members.*.gender' => ['nullable', 'in:male,female,other'],
            'members.*.id_document_number' => ['nullable', 'string', 'max:50'],
            'members.*.mother_birth_name' => ['nullable', 'string', 'max:200'],
            'members.*.municipality_id' => ['required', 'exists:municipalities,id'],
            'members.*.address_postal_code' => ['nullable', 'string', 'max:10'],
            'members.*.address_settlement' => ['nullable', 'string', 'max:255'],
            'members.*.address_street' => ['nullable', 'string', 'max:255'],
            'members.*.address_house_number' => ['nullable', 'string', 'max:50'],
            'members.*.phone' => ['nullable', 'string', 'max:50'],
            'members.*.email' => ['nullable', 'email', 'max:255'],

            'members.*.central_transport_required' => ['nullable', 'boolean'],
            'members.*.central_accommodation_required' => ['nullable', 'boolean'],
            'members.*.under_regular_medical_care' => ['nullable', 'boolean'],
            'members.*.own_vehicle' => ['nullable', 'boolean'],
            'members.*.travels_alone' => ['nullable', 'boolean'],

            'members.*.special_needs' => ['array'],
            'members.*.special_needs.*.category' => ['required_with:members.*.special_needs', 'in:medical,mobility,age,diet,animal,other'],
            'members.*.special_needs.*.type' => ['nullable', 'string', 'max:100'],
            'members.*.special_needs.*.priority' => ['nullable', 'integer', 'min:1', 'max:5'],
            'members.*.special_needs.*.description' => ['nullable', 'string'],

            'members.*.animals' => ['array'],
            'members.*.animals.*.animal_type' => ['required_with:members.*.animals', 'string', 'max:100'],
            'members.*.animals.*.count' => ['nullable', 'integer', 'min:1'],
            'members.*.animals.*.stays_at_address' => ['nullable', 'boolean'],
        ];
    }
}
