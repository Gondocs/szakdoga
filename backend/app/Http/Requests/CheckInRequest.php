<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CheckInRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('checkIn', $this->route('shelter'));
    }

    public function rules(): array
    {
        return [
            'public_id' => ['required_without:person_id', 'string'],
            'person_id' => ['required_without:public_id', 'uuid', 'exists:persons,id'],
            'event_id' => ['required', 'uuid', 'exists:evacuation_events,id'],
            'override_capacity' => ['nullable', 'boolean'],
        ];
    }
}
