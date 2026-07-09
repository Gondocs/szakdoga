<?php

namespace App\Enums;

enum Gender: string
{
    case Male = 'male';
    case Female = 'female';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Male => 'Férfi',
            self::Female => 'Nő',
            self::Other => 'Egyéb',
        };
    }
}
