<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEvacuationEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', \App\Models\EvacuationEvent::class);
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:50', 'unique:evacuation_events,code'],
            'name' => ['required', 'string', 'max:255'],
            'status' => ['required', 'in:draft,active,paused,closed'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'shelters' => ['array'],
            'shelters.*.shelter_id' => ['required_with:shelters', 'uuid', 'exists:shelters,id'],
            'shelters.*.capacity_limit' => ['required_with:shelters', 'integer', 'min:1'],
        ];
    }
}
