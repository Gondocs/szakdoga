<?php

namespace App\Enums;

enum RiskLevel: string
{
    case Low = 'low';
    case Medium = 'medium';
    case High = 'high';
    case Critical = 'critical';

    public function label(): string
    {
        return match ($this) {
            self::Low => 'Alacsony',
            self::Medium => 'Közepes',
            self::High => 'Magas',
            self::Critical => 'Kritikus',
        };
    }
}
