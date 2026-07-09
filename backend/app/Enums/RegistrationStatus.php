<?php

namespace App\Enums;

enum RegistrationStatus: string
{
    case Registered = 'registered';
    case CheckedInAssembly = 'checked_in_assembly';
    case InTransport = 'in_transport';
    case ArrivedShelter = 'arrived_shelter';
    case LeftShelter = 'left_shelter';
    case ReturnedHome = 'returned_home';
    case Missing = 'missing';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Registered => 'Regisztrált',
            self::CheckedInAssembly => 'Megjelent a gyülekezőponton',
            self::InTransport => 'Szállítás alatt',
            self::ArrivedShelter => 'Megérkezett',
            self::LeftShelter => 'Befogadóhelyet elhagyta',
            self::ReturnedHome => 'Visszatelepült',
            self::Missing => 'Hiányzik',
            self::Cancelled => 'Törölt',
        };
    }
}
