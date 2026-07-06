<?php

namespace App\Exceptions;

use Exception;

class AlreadyCheckedInException extends Exception
{
    protected $message = 'A személy már érkeztetve lett.';
}
