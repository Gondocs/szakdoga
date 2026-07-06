<?php

namespace App\Enums;

enum IncidentCategory: string
{
    case Complaint = 'complaint';
    case Conflict = 'conflict';
    case Security = 'security';
    case Damage = 'damage';
    case Other = 'other';
}
