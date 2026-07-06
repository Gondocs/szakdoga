<?php

namespace App\Enums;

enum QrTokenStatus: string
{
    case Active = 'active';
    case Revoked = 'revoked';
    case Expired = 'expired';
}
