<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FamilyReunificationNote extends Model
{
    use HasFactory;

    protected $fillable = ['family_id', 'note', 'resolved', 'created_by'];

    protected function casts(): array
    {
        return [
            'resolved' => 'boolean',
        ];
    }

    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
