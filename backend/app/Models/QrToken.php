<?php

namespace App\Models;

use App\Enums\QrTokenStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QrToken extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'person_id',
        'family_id',
        'public_id',
        'token_hash',
        'status',
        'issued_by',
        'delivery_method',
        'delivered_at',
        'delivered_by',
    ];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'status' => QrTokenStatus::class,
            'delivered_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(EvacuationEvent::class, 'event_id');
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    public function issuedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function deliveredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delivered_by');
    }

    public function isActive(): bool
    {
        return $this->status === QrTokenStatus::Active;
    }
}
