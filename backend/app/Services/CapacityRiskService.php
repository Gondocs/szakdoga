<?php

namespace App\Services;

use App\Enums\RiskLevel;
use App\Models\EvacuationEvent;
use App\Models\EventShelter;
use App\Models\SpecialNeed;

class CapacityRiskService
{
    /**
     * A projektleírás 10.2 fejezetében rögzített, dokumentált kockázati képlet:
     *
     *   capacity_utilization = checked_in_count / capacity_limit
     *   special_need_ratio   = special_needs_count / max(checked_in_count, 1)
     *   pending_transport_ratio = pending_transport_count / max(total_registered, 1)
     *
     *   risk_score = capacity_utilization*70 + special_need_ratio*20 + pending_transport_ratio*10
     */
    public function score(
        int $checkedInCount,
        int $capacityLimit,
        int $specialNeedsCount,
        int $pendingTransportCount,
        int $totalRegistered,
    ): float {
        $capacityUtilization = $capacityLimit > 0 ? $checkedInCount / $capacityLimit : 0.0;
        $specialNeedRatio = $specialNeedsCount / max($checkedInCount, 1);
        $pendingTransportRatio = $pendingTransportCount / max($totalRegistered, 1);

        return ($capacityUtilization * 70) + ($specialNeedRatio * 20) + ($pendingTransportRatio * 10);
    }

    /**
     * A számított kockázati pontszámot sávokba (RiskLevel) sorolja a
     * projektleírásban rögzített küszöbértékek alapján.
     */
    public function levelFromScore(float $score): RiskLevel
    {
        return match (true) {
            $score >= 91 => RiskLevel::Critical,
            $score >= 71 => RiskLevel::High,
            $score >= 51 => RiskLevel::Medium,
            default => RiskLevel::Low,
        };
    }

    /**
     * Egy adott befogadóhely (esemény + szállás páros) kockázati mutatóit
     * számolja ki: összegyűjti a bejelentkezettek, a különleges igényűek és
     * a még szállításra váró regisztrációk számát, majd ebből képzi a
     * kockázati pontszámot és a kihasználtsági arányt.
     */
    public function forEventShelter(EventShelter $eventShelter): array
    {
        $event = $eventShelter->event ?? $eventShelter->event()->first();
        $totalRegistered = $event?->registrations()->count() ?? 0;
        // A központi szállítást igénylő, még nem célba ért regisztrációk száma
        $pendingTransport = $event?->registrations()
            ->where('central_transport_required', true)
            ->whereIn('status', [\App\Enums\RegistrationStatus::Registered, \App\Enums\RegistrationStatus::InTransport])
            ->count() ?? 0;

        // Az adott eseményhez és szálláshelyhez bejelentkezett, különleges
        // igényű személyek száma
        $specialNeedsCount = SpecialNeed::whereHas('person.checkins', function ($query) use ($eventShelter) {
            $query->where('shelter_id', $eventShelter->shelter_id)
                ->where('event_id', $eventShelter->event_id);
        })->count();

        $score = $this->score(
            checkedInCount: $eventShelter->checked_in_count,
            capacityLimit: $eventShelter->capacity_limit,
            specialNeedsCount: $specialNeedsCount,
            pendingTransportCount: $pendingTransport,
            totalRegistered: $totalRegistered,
        );

        return [
            'score' => round($score, 1),
            'level' => $this->levelFromScore($score),
            'utilization' => $eventShelter->capacity_limit > 0
                ? round($eventShelter->checked_in_count / $eventShelter->capacity_limit, 3)
                : 0.0,
        ];
    }

    /**
     * A teljes evakuációs esemény összesített kockázatát számolja ki az
     * összes hozzá tartozó szálláshely kapacitás- és létszámadatainak
     * összegzésével (aggregálásával), majd ugyanazzal a képlettel, mint az
     * egyedi szálláshelyeknél.
     */
    public function forEvent(EvacuationEvent $event): array
    {
        $eventShelters = $event->eventShelters()->get();

        if ($eventShelters->isEmpty()) {
            return ['score' => 0.0, 'level' => RiskLevel::Low, 'utilization' => 0.0];
        }

        $totalCapacity = $eventShelters->sum('capacity_limit');
        $totalCheckedIn = $eventShelters->sum('checked_in_count');
        $totalRegistered = $event->registrations()->count();
        $pendingTransport = $event->registrations()
            ->where('central_transport_required', true)
            ->whereIn('status', [\App\Enums\RegistrationStatus::Registered, \App\Enums\RegistrationStatus::InTransport])
            ->count();
        $specialNeedsCount = SpecialNeed::whereHas('person', fn ($q) => $q->where('event_id', $event->id))->count();

        $score = $this->score(
            checkedInCount: $totalCheckedIn,
            capacityLimit: $totalCapacity,
            specialNeedsCount: $specialNeedsCount,
            pendingTransportCount: $pendingTransport,
            totalRegistered: $totalRegistered,
        );

        return [
            'score' => round($score, 1),
            'level' => $this->levelFromScore($score),
            'utilization' => $totalCapacity > 0 ? round($totalCheckedIn / $totalCapacity, 3) : 0.0,
        ];
    }
}
