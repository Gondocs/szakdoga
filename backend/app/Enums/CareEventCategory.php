<?php

namespace App\Enums;

/**
 * Interreg tanulmány "Befogadóhelyi érkeztetés és ellátáskövetés" funkciója:
 * a befogadóhelyen nyújtott ellátási események kategorizált naplózása
 * (étkezési jogosultság, segélycsomag, adomány, orvosi ellátás, tisztálkodás).
 */
enum CareEventCategory: string
{
    case Meal = 'meal';
    case AidPackage = 'aid_package';
    case Medical = 'medical';
    case Hygiene = 'hygiene';
    case Other = 'other';
}
