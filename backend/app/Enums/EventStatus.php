<?php

namespace App\Enums;

enum EventStatus: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Paused = 'paused';
    case Closed = 'closed';
}
