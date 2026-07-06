<?php

namespace App\Enums;

/**
 * A regisztráció eredetét jelöli az Interreg tanulmány "Integrált, Többcsatornás
 * Adatbevitel" funkciója szerint: hatósági (helyszíni) rögzítés vagy lakossági
 * önkiszolgáló előregisztráció.
 */
enum RegistrationChannel: string
{
    case Staff = 'staff';
    case SelfService = 'self_service';
}
