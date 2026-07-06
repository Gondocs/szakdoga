<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Municipality extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'county', 'postal_code', 'lat', 'lng'];

    public function shelters(): HasMany
    {
        return $this->hasMany(Shelter::class);
    }

    public function persons(): HasMany
    {
        return $this->hasMany(Person::class);
    }
}
