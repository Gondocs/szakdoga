<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Family extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = ['event_id', 'family_code', 'primary_contact_person_id'];

    public function event(): BelongsTo
    {
        return $this->belongsTo(EvacuationEvent::class, 'event_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(Person::class, 'family_id');
    }

    public function primaryContact(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'primary_contact_person_id');
    }

    public function reunificationNotes(): HasMany
    {
        return $this->hasMany(FamilyReunificationNote::class);
    }
}
