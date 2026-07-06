<?php

namespace App\Enums;

enum IncidentSeverity: string
{
    case Low = 'low';
    case Medium = 'medium';
    case High = 'high';
}
