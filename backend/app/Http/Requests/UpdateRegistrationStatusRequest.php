<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRegistrationStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('updateStatus', $this->route('registration'));
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'in:registered,in_transport,arrived_shelter,left_shelter,returned_home,cancelled'],
        ];
    }
}
