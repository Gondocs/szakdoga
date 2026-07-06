<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EventShelter extends Model
{
    use HasFactory;

    protected $fillable = ['event_id', 'shelter_id', 'capacity_limit', 'checked_in_count'];

    public function event(): BelongsTo
    {
        return $this->belongsTo(EvacuationEvent::class, 'event_id');
    }

    public function shelter(): BelongsTo
    {
        return $this->belongsTo(Shelter::class);
    }

    public function utilization(): float
    {
        if ($this->capacity_limit <= 0) {
            return 0.0;
        }

        return $this->checked_in_count / $this->capacity_limit;
    }
}
