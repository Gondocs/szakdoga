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
}
