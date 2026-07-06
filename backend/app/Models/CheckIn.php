<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CheckIn extends Model
{
    use HasFactory;

    protected $table = 'checkins';

    protected $fillable = [
        'event_id',
        'person_id',
        'shelter_id',
        'bed_label',
        'checked_in_at',
        'checked_in_by',
        'temporary_leave_at',
        'temporary_return_at',
    ];

    protected function casts(): array
    {
        return [
            'checked_in_at' => 'datetime',
            'temporary_leave_at' => 'datetime',
            'temporary_return_at' => 'datetime',
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

    public function shelter(): BelongsTo
    {
        return $this->belongsTo(Shelter::class);
    }

    public function checkedInBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_in_by');
    }
}
