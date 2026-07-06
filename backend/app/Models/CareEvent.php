<?php

namespace App\Models;

use App\Enums\CareEventCategory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CareEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'person_id',
        'event_id',
        'shelter_id',
        'category',
        'note',
        'recorded_by',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'category' => CareEventCategory::class,
            'recorded_at' => 'datetime',
        ];
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function shelter(): BelongsTo
    {
        return $this->belongsTo(Shelter::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
