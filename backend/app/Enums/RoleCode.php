<?php

namespace App\Enums;

enum RoleCode: string
{
    case Admin = 'admin';
    case Manager = 'manager';
    case Registrar = 'registrar';
    case ShelterOperator = 'shelter_operator';
    case Auditor = 'auditor';
}
