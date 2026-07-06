<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Interreg tanulmány "Gyülekezési pontok, útvonalak" funkciója: a
 * lakosság gyülekezőhelyéül szolgáló, önálló térképi entitásként
 * kezelt pont (pl. iskola udvara, faluház), ahonnan a szállítás indul.
 */
class AssemblyPoint extends Model
{
    use HasFactory;

    protected $fillable = ['event_id', 'name', 'address', 'lat', 'lng', 'notes'];

    protected function casts(): array
    {
        return [
            'lat' => 'float',
            'lng' => 'float',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(EvacuationEvent::class, 'event_id');
    }
}
