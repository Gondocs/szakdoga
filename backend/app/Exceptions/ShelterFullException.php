<?php

namespace App\Exceptions;

use Exception;

class ShelterFullException extends Exception
{
    protected $message = 'A befogadóhely kapacitása megtelt.';
}
