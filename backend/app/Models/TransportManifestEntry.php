<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransportManifestEntry extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'transport_id',
        'event_id',
        'person_id',
        'boarded_at',
        'boarded_by',
        'alighted_at',
        'alighted_by',
    ];

    protected function casts(): array
    {
        return [
            'boarded_at' => 'datetime',
            'alighted_at' => 'datetime',
        ];
    }

    public function transport(): BelongsTo
    {
        return $this->belongsTo(Transport::class);
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function boardedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'boarded_by');
    }

    public function alightedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'alighted_by');
    }
}
