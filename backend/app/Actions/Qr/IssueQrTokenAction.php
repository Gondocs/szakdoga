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
     */
    public function execute(Person $person, User $issuedBy): QrToken
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

        $this->auditService->log('qr_issue', $token, $issuedBy, null, ['public_id' => $token->public_id]);

        return $token;
    }
}
