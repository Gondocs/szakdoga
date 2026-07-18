<?php

namespace App\Models;

use App\Enums\RoleCode;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    // A two_factor_code/two_factor_expires_at/two_factor_attempts mezők
    // szándékosan NEM szerepelnek itt: azokat kizárólag az AuthController
    // állítja be belsőleg (forceFill-lel), sosem tömeges felhasználói
    // bemenetből.
    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'shelter_id',
        'avatar_path',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        // A 2FA-kód hash-e sosem kerülhet ki a JSON-válaszokba, még
        // véletlenül sem — a two_factor_expires_at/attempts nem érzékeny,
        // azok maradhatnak láthatók.
        'two_factor_code',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_expires_at' => 'datetime',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function shelter(): BelongsTo
    {
        return $this->belongsTo(Shelter::class);
    }

    public function avatarUrl(): ?string
    {
        return $this->avatar_path ? asset('storage/'.$this->avatar_path) : null;
    }

    /**
     * Megvizsgálja, hogy a felhasználó szerepköre megegyezik-e a megadott
     * szerepkörök (RoleCode) valamelyikével — tetszőleges számú szerepkör
     * adható meg, pl. hasRole(RoleCode::Admin, RoleCode::Leader).
     */
    public function hasRole(RoleCode ...$codes): bool
    {
        if (! $this->role) {
            return false;
        }

        foreach ($codes as $code) {
            if ($this->role->code === $code->value) {
                return true;
            }
        }

        return false;
    }

    /**
     * Szintetikus "rendszer" felhasználó, amit az önkiszolgáló (bejelentkezés
     * nélküli) előregisztráció audit- és státusznaplózásához használunk
     * ténylegesen eljáró hatósági dolgozó helyett.
     */
    public static function system(): self
    {
        return static::firstOrCreate(
            ['email' => 'system@internal.local'],
            ['name' => 'Önkiszolgáló rendszer', 'password' => bcrypt(Str::random(40))]
        );
    }
}
