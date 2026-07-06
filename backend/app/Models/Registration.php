<?php

namespace App\Models;

use App\Enums\RegistrationChannel;
use App\Enums\RegistrationStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Registration extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'person_id',
        'event_id',
        'status',
        'channel',
        'central_transport_required',
        'central_accommodation_required',
        'under_regular_medical_care',
        'own_vehicle',
        'travels_alone',
        'registered_at',
        'registered_by',
        'self_arrival_confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => RegistrationStatus::class,
            'channel' => RegistrationChannel::class,
            'central_transport_required' => 'boolean',
            'central_accommodation_required' => 'boolean',
            'under_regular_medical_care' => 'boolean',
            'own_vehicle' => 'boolean',
            'travels_alone' => 'boolean',
            'registered_at' => 'datetime',
            'self_arrival_confirmed_at' => 'datetime',
        ];
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(EvacuationEvent::class, 'event_id');
    }

    public function registeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registered_by');
    }
}
