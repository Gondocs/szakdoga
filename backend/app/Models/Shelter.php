<?php

namespace App\Models;

use App\Enums\ShelterStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shelter extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'name',
        'municipality_id',
        'address',
        'capacity_total',
        'accessible_capacity',
        'medical_support_available',
        'drinking_water_available',
        'meals_available',
        'hygiene_facilities_available',
        'childcare_available',
        'psychological_support_available',
        'house_rules',
        'public_health_notes',
        'status',
        'contact_phone',
    ];

    protected function casts(): array
    {
        return [
            'status' => ShelterStatus::class,
            'medical_support_available' => 'boolean',
            'drinking_water_available' => 'boolean',
            'meals_available' => 'boolean',
            'hygiene_facilities_available' => 'boolean',
            'childcare_available' => 'boolean',
            'psychological_support_available' => 'boolean',
        ];
    }

    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }

    public function events(): BelongsToMany
    {
        return $this->belongsToMany(EvacuationEvent::class, 'event_shelters', 'shelter_id', 'event_id')
            ->withPivot(['id', 'capacity_limit', 'checked_in_count'])
            ->withTimestamps();
    }

    public function checkins(): HasMany
    {
        return $this->hasMany(CheckIn::class);
    }

    public function operators(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
