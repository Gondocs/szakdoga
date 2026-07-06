<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Eseményfüggetlen polgár törzsadat (lásd citizens tábla migrációja):
 * az okmányszám alapján köti össze ugyanazon személy több kitelepítési
 * eseményhez tartozó regisztrációját.
 */
class Citizen extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'id_document_number',
        'last_name',
        'first_name',
        'birth_last_name',
        'birth_first_name',
        'birth_place',
        'birth_date',
        'gender',
        'mother_birth_name',
        'phone',
        'email',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
        ];
    }

    public function persons(): HasMany
    {
        return $this->hasMany(Person::class);
    }

    public function fullName(): string
    {
        return trim("{$this->last_name} {$this->first_name}");
    }
}
