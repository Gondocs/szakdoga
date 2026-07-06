<?php

namespace App\Models;

use App\Enums\IncidentCategory;
use App\Enums\IncidentSeverity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Interreg tanulmány "Panaszok, rendkívüli események és konfliktusok
 * rögzítése" funkciója: befogadóhelyi vagy esemény szintű incidensek
 * (panasz, konfliktus, biztonsági esemény, káresemény) naplózása és
 * lezárásának nyomon követése.
 */
class Incident extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'shelter_id',
        'person_id',
        'category',
        'severity',
        'description',
        'status',
        'reported_by',
        'resolved_by',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'category' => IncidentCategory::class,
            'severity' => IncidentSeverity::class,
            'resolved_at' => 'datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(EvacuationEvent::class, 'event_id');
    }

    public function shelter(): BelongsTo
    {
        return $this->belongsTo(Shelter::class);
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function reportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
