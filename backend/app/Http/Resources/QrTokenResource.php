<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QrTokenResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'public_id' => $this->public_id,
            'status' => $this->status->value,
            'person_id' => $this->person_id,
            'family_id' => $this->family_id,
            'delivery_method' => $this->delivery_method,
            'delivered_at' => $this->delivered_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
