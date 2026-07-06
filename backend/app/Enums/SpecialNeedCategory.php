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
}
