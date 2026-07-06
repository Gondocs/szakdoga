<?php

namespace App\Models;

use App\Enums\SpecialNeedCategory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpecialNeed extends Model
{
    use HasFactory;

    protected $fillable = ['person_id', 'category', 'type', 'priority', 'description'];

    protected function casts(): array
    {
        return [
            'category' => SpecialNeedCategory::class,
        ];
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }
}
