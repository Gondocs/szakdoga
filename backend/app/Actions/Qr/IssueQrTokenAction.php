<?php

namespace App\Actions\Qr;

use App\Enums\QrTokenStatus;
use App\Enums\RegistrationStatus;
use App\Models\Person;
use App\Models\QrToken;
use App\Models\User;
use App\Services\AuditService;
use App\Services\QrTokenService;
use Illuminate\Validation\ValidationException;

class IssueQrTokenAction
{
    public function __construct(
        private readonly QrTokenService $qrTokenService,
        private readonly AuditService $auditService,
    ) {
    }

    /**
     * QR-token csak aktív eseményhez és aktív (nem lezárt/törölt) regisztrációhoz
     * generálható, és személyenként csak egy aktív token lehet érvényben.
     *
     * A $reason='lost' paraméter az "elveszett kód bejelentése" funkciót jelöli
     * (Interreg tanulmány 4. fejezet: "Kód aktiválása, újragenerálása,
     * visszavonása és elveszett kód kezelése") — ilyenkor a korábbi token
     * elveszettként (nem csak rutinszerű újragenerálásként) kerül visszavonásra
     * és a naplóban is külön akcióként ("qr_reissue_lost") jelenik meg, hogy a
     * gyakoriságuk utólag kimutatható/auditálható legyen.
     */
    public function execute(Person $person, User $issuedBy, ?string $reason = null): QrToken
    {
        $event = $person->event;
        $registration = $person->registration;

        if (! $event->isActive()) {
            throw ValidationException::withMessages(['event' => 'A kitelepítési esemény nem aktív.']);
        }

        if (! $registration || $registration->status === RegistrationStatus::Cancelled) {
            throw ValidationException::withMessages(['registration' => 'A regisztráció nem aktív.']);
        }

        $existingActive = $person->qrTokens()->where('status', QrTokenStatus::Active)->first();
        if ($existingActive) {
            $this->qrTokenService->revoke($existingActive);
        }

        $token = $this->qrTokenService->issue($event, $issuedBy, person: $person);

        $isLost = $reason === 'lost';
        $this->auditService->log(
            $isLost ? 'qr_reissue_lost' : 'qr_issue',
            $token,
            $issuedBy,
            $existingActive ? ['previous_public_id' => $existingActive->public_id] : null,
            ['public_id' => $token->public_id],
            forceSignificant: $isLost ?: null,
        );

        return $token;
    }
}
