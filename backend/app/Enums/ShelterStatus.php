<?php

namespace App\Enums;

enum ShelterStatus: string
{
    case Planned = 'planned';
    case Active = 'active';
    case Full = 'full';
    case Inactive = 'inactive';
}
