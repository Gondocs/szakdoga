<?php

namespace App\Models;

use App\Enums\EventStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EvacuationEvent extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['code', 'name', 'status', 'starts_at', 'ends_at'];

    protected function casts(): array
    {
        return [
            'status' => EventStatus::class,
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function shelters(): BelongsToMany
    {
        return $this->belongsToMany(Shelter::class, 'event_shelters')
            ->withPivot(['id', 'capacity_limit', 'checked_in_count'])
            ->withTimestamps();
    }

    public function eventShelters(): HasMany
    {
        return $this->hasMany(EventShelter::class, 'event_id');
    }

    public function persons(): HasMany
    {
        return $this->hasMany(Person::class, 'event_id');
    }

    public function families(): HasMany
    {
        return $this->hasMany(Family::class, 'event_id');
    }

    public function registrations(): HasMany
    {
        return $this->hasMany(Registration::class, 'event_id');
    }

    public function checkins(): HasMany
    {
        return $this->hasMany(CheckIn::class, 'event_id');
    }

    public function qrTokens(): HasMany
    {
        return $this->hasMany(QrToken::class, 'event_id');
    }

    public function transports(): HasMany
    {
        return $this->hasMany(Transport::class, 'event_id');
    }

    public function incidents(): HasMany
    {
        return $this->hasMany(Incident::class, 'event_id');
    }

    public function assemblyPoints(): HasMany
    {
        return $this->hasMany(AssemblyPoint::class, 'event_id');
    }

    public function isActive(): bool
    {
        return $this->status === EventStatus::Active;
    }
}
