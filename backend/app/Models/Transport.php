<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transport extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'event_id',
        'vehicle_id',
        'code',
        'capacity',
        'origin',
        'destination',
        'escort_name',
        'departure_planned_at',
        'arrival_planned_at',
        'delay_minutes',
        'route_change_note',
        'last_lat',
        'last_lng',
        'last_position_at',
    ];

    protected function casts(): array
    {
        return [
            'departure_planned_at' => 'datetime',
            'arrival_planned_at' => 'datetime',
            'last_position_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(EvacuationEvent::class, 'event_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function manifestEntries(): HasMany
    {
        return $this->hasMany(TransportManifestEntry::class);
    }

    public function onboardCount(): int
    {
        return $this->manifestEntries()->whereNull('alighted_at')->count();
    }
}
