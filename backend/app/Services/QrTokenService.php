<?php

namespace App\Services;

use App\Enums\QrTokenStatus;
use App\Models\EvacuationEvent;
use App\Models\Family;
use App\Models\Person;
use App\Models\QrToken;
use App\Models\User;
use Illuminate\Support\Str;

class QrTokenService
{
    /**
     * Új, nem kitalálható QR-token kibocsátása egy személyhez vagy családhoz.
     * A QR-kódba csak a public_id kerül; a person/family adatok a védett backendben maradnak.
     */
    public function issue(EvacuationEvent $event, User $issuedBy, ?Person $person = null, ?Family $family = null): QrToken
    {
        $publicId = Str::lower(Str::random(32)).bin2hex(random_bytes(8));

        return QrToken::create([
            'event_id' => $event->id,
            'person_id' => $person?->id,
            'family_id' => $family?->id,
            'public_id' => $publicId,
            'token_hash' => hash('sha256', $publicId),
            'status' => QrTokenStatus::Active,
            'issued_by' => $issuedBy->id,
        ]);
    }

    /**
     * A QR-kódban szereplő public_id alapján visszaadja a hozzá tartozó
     * tokent. A public_id-ból újraszámolt hash-t is összeveti a tárolt
     * token_hash-sel, hogy egy esetlegesen módosított/hamisított
     * azonosítót ne fogadjon el érvényesként.
     */
    public function resolve(string $publicId): ?QrToken
    {
        $hash = hash('sha256', $publicId);

        return QrToken::where('public_id', $publicId)
            ->where('token_hash', $hash)
            ->first();
    }

    public function revoke(QrToken $token): void
    {
        $token->update(['status' => QrTokenStatus::Revoked]);
    }
}
