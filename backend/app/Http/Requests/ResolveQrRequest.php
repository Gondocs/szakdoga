<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ResolveQrRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('resolveQr', \App\Models\Shelter::class);
    }

    public function rules(): array
    {
        return [
            'public_id' => ['required', 'string'],
        ];
    }
}
