<?php

namespace App\Models;

use App\Enums\RepatriationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RepatriationAuthorization extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'municipality_id',
        'status',
        'conditions_note',
        'window_starts_at',
        'window_ends_at',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => RepatriationStatus::class,
            'window_starts_at' => 'datetime',
            'window_ends_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(EvacuationEvent::class, 'event_id');
    }

    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
