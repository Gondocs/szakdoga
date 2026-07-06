<?php

namespace App\Models;

use App\Enums\Gender;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Person extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'persons';

    protected $fillable = [
        'event_id',
        'citizen_id',
        'family_id',
        'municipality_id',
        'last_name',
        'first_name',
        'birth_last_name',
        'birth_first_name',
        'birth_place',
        'birth_date',
        'gender',
        'id_document_number',
        'document_photo_front_path',
        'document_photo_back_path',
        'mother_birth_name',
        'address_postal_code',
        'address_settlement',
        'address_street',
        'address_house_number',
        'phone',
        'email',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'gender' => Gender::class,
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(EvacuationEvent::class, 'event_id');
    }

    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    public function citizen(): BelongsTo
    {
        return $this->belongsTo(Citizen::class);
    }

    public function municipality(): BelongsTo
    {
        return $this->belongsTo(Municipality::class);
    }

    public function registration(): HasOne
    {
        return $this->hasOne(Registration::class);
    }

    public function specialNeeds(): HasMany
    {
        return $this->hasMany(SpecialNeed::class);
    }

    public function animals(): HasMany
    {
        return $this->hasMany(Animal::class);
    }

    public function checkins(): HasMany
    {
        return $this->hasMany(CheckIn::class);
    }

    public function qrTokens(): HasMany
    {
        return $this->hasMany(QrToken::class);
    }

    public function transportManifestEntries(): HasMany
    {
        return $this->hasMany(TransportManifestEntry::class);
    }

    public function careEvents(): HasMany
    {
        return $this->hasMany(CareEvent::class);
    }

    public function fullName(): string
    {
        return trim("{$this->last_name} {$this->first_name}");
    }

    public function documentPhotoFrontUrl(): ?string
    {
        return $this->document_photo_front_path ? asset('storage/'.$this->document_photo_front_path) : null;
    }

    public function documentPhotoBackUrl(): ?string
    {
        return $this->document_photo_back_path ? asset('storage/'.$this->document_photo_back_path) : null;
    }
}
