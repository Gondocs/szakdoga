<?php

namespace App\Enums;

enum SpecialNeedCategory: string
{
    case Medical = 'medical';
    case Mobility = 'mobility';
    case Age = 'age';
    case Diet = 'diet';
    case Animal = 'animal';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Medical => 'Egészségügyi',
            self::Mobility => 'Mozgás-/érzékszervi korlátozottság',
            self::Age => 'Életkor szerinti',
            self::Diet => 'Diétás igény',
            self::Animal => 'Állattartás',
            self::Other => 'Egyéb',
        };
    }
}
