<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vehicle extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'plate_number',
        'label',
        'vehicle_type',
        'capacity',
        'driver_name',
        'notes',
    ];

    public function transports(): HasMany
    {
        return $this->hasMany(Transport::class);
    }

    /**
     * A jármű jelenlegi hozzárendelése, ha éppen egy folyamatban lévő
     * (aktív vagy szüneteltetett) esemény valamelyik szállítójárataként van
     * felhasználva. Ennek hiánya jelzi, hogy a jármű szabadon hozzárendelhető
     * egy új eseményhez (dupla lefoglalás elkerülése).
     */
    public function activeAssignment(): ?Transport
    {
        return $this->transports()
            ->whereHas('event', fn ($q) => $q->whereIn('status', ['active', 'paused']))
            ->with('event')
            ->latest('created_at')
            ->first();
    }
}
