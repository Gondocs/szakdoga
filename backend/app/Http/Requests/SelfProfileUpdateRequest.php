<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Interreg tanulmány "Folyamatos Adatfrissítési Kapcsolat" funkciója: a lakos
 * a saját QR-kódja (public_id) alapján, hitelesítés nélkül, bármikor
 * frissítheti az elérhetőségét és ideiglenes tartózkodási helyét a
 * visszatelepítésig. A személyazonosító adatok (név, születési adatok) itt
 * szándékosan nem módosíthatók — azt a helyszíni regisztrátor kezeli.
 */
class SelfProfileUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'address_postal_code' => ['nullable', 'string', 'max:10'],
            'address_settlement' => ['nullable', 'string', 'max:255'],
            'address_street' => ['nullable', 'string', 'max:255'],
            'address_house_number' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],

            'central_transport_required' => ['nullable', 'boolean'],
            'central_accommodation_required' => ['nullable', 'boolean'],

            'special_needs' => ['array'],
            'special_needs.*.category' => ['required_with:special_needs', 'in:medical,mobility,age,diet,animal,other'],
            'special_needs.*.type' => ['nullable', 'string', 'max:100'],
            'special_needs.*.priority' => ['nullable', 'integer', 'min:1', 'max:5'],
            'special_needs.*.description' => ['nullable', 'string'],
        ];
    }
}
