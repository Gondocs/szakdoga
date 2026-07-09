<?php

namespace App\Enums;

/**
 * Interreg tanulmány "Visszatelepítési modul" funkciója: településenkénti
 * visszatelepítési engedélyezési státusz (közegészségügyi, közmű,
 * közlekedési, lakhatási feltételek alapján).
 */
enum RepatriationStatus: string
{
    case NotPermitted = 'not_permitted';
    case Conditional = 'conditional';
    case Permitted = 'permitted';

    public function label(): string
    {
        return match ($this) {
            self::NotPermitted => 'Nem engedélyezett',
            self::Conditional => 'Feltételes',
            self::Permitted => 'Engedélyezett',
        };
    }
}
