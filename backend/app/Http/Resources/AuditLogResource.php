<?php

namespace App\Http\Resources;

use App\Enums\RoleCode;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    /**
     * Ugyanazok a mezők, amelyeket a PersonResource is maszkol — a nyers
     * before/after modell-pillanatkép ugyanígy tartalmazhatja őket, így az
     * adatmaszkolás elve (18. fejezet) a napló megtekintésekor sem sérülhet.
     */
    private const SENSITIVE_KEYS = [
        'id_document_number',
        'document_photo_front_path',
        'document_photo_back_path',
        'birth_place',
        'mother_birth_name',
        'phone',
        'email',
        'address_street',
        'address_house_number',
        'password',
    ];

    public function toArray(Request $request): array
    {
        $user = $request->user();
        $canViewSensitive = (bool) $user?->hasRole(RoleCode::Admin, RoleCode::Manager);

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'user' => $this->whenLoaded('user', fn () => $this->user?->name),
            'event_id' => $this->event_id,
            'event' => $this->whenLoaded('event', fn () => $this->event ? [
                'id' => $this->event->id,
                'code' => $this->event->code,
                'name' => $this->event->name,
            ] : null),
            'action' => $this->action,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'significant' => (bool) $this->significant,
            'before' => $this->maskSensitiveFields($this->before_json, $canViewSensitive),
            'after' => $this->maskSensitiveFields($this->after_json, $canViewSensitive),
            'data_masked' => ! $canViewSensitive && $this->containsSensitiveFields(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function containsSensitiveFields(): bool
    {
        foreach (self::SENSITIVE_KEYS as $key) {
            if (array_key_exists($key, $this->before_json ?? []) || array_key_exists($key, $this->after_json ?? [])) {
                return true;
            }
        }

        return false;
    }

    private function maskSensitiveFields(?array $data, bool $canViewSensitive): ?array
    {
        if (! $data || $canViewSensitive) {
            return $data;
        }

        foreach (self::SENSITIVE_KEYS as $key) {
            if (array_key_exists($key, $data)) {
                $data[$key] = null;
            }
        }

        return $data;
    }
}
