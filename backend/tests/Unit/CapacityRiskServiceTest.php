<?php

namespace Tests\Unit;

use App\Enums\RiskLevel;
use App\Services\CapacityRiskService;
use PHPUnit\Framework\TestCase;

/**
 * A projektleírás 10.2 fejezetében rögzített kockázati képlet ellenőrzése:
 * risk_score = capacity_utilization*70 + special_need_ratio*20 + pending_transport_ratio*10
 */
class CapacityRiskServiceTest extends TestCase
{
    private CapacityRiskService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new CapacityRiskService();
    }

    // Üres befogadóhelyen (0 fő, nincs igény, nincs függő szállítás) a
    // kockázati pontszám pontosan 0, a szint "Low".
    public function test_score_is_zero_when_shelter_is_empty(): void
    {
        $score = $this->service->score(0, 100, 0, 0, 0);

        $this->assertSame(0.0, $score);
        $this->assertSame(RiskLevel::Low, $this->service->levelFromScore($score));
    }

    // Ha mindhárom tényező (telítettség, egyedi igény arány, függő
    // szállítás arány) maximális, a pontszám pontosan 100, a szint
    // "Critical" — a képlet felső határa helyesen viselkedik.
    public function test_score_reaches_critical_when_shelter_is_full_and_needs_are_high(): void
    {
        // capacity_utilization = 1.0 -> 70, special_need_ratio = 1.0 -> 20, pending_transport_ratio = 1.0 -> 10
        $score = $this->service->score(
            checkedInCount: 100,
            capacityLimit: 100,
            specialNeedsCount: 100,
            pendingTransportCount: 10,
            totalRegistered: 10,
        );

        $this->assertSame(100.0, $score);
        $this->assertSame(RiskLevel::Critical, $this->service->levelFromScore($score));
    }

    // A projektleírásban dokumentált konkrét számpéldát reprodukálja
    // (70%-os telítettség, egyéb tényező nélkül) és ellenőrzi, hogy a
    // szolgáltatás pontosan a dokumentált 49-es pontszámot adja.
    public function test_score_matches_documented_example(): void
    {
        // 70% telítettség -> 49, nincs speciális igény, nincs függő szállítás.
        $score = $this->service->score(
            checkedInCount: 70,
            capacityLimit: 100,
            specialNeedsCount: 0,
            pendingTransportCount: 0,
            totalRegistered: 100,
        );

        $this->assertSame(49.0, $score);
        $this->assertSame(RiskLevel::Low, $this->service->levelFromScore($score));
    }

    // A pontszám-szint kategóriák (Low/Medium/High/Critical) határai
    // pontosan a dokumentált küszöbértékeken váltanak — 50/51,
    // 70/71 és 90/91 pontnál helyesen billen át a következő szintre.
    public function test_level_boundaries(): void
    {
        $this->assertSame(RiskLevel::Low, $this->service->levelFromScore(50));
        $this->assertSame(RiskLevel::Medium, $this->service->levelFromScore(51));
        $this->assertSame(RiskLevel::Medium, $this->service->levelFromScore(70));
        $this->assertSame(RiskLevel::High, $this->service->levelFromScore(71));
        $this->assertSame(RiskLevel::High, $this->service->levelFromScore(90));
        $this->assertSame(RiskLevel::Critical, $this->service->levelFromScore(91));
    }
}
