<?php

namespace App\OpenApi;

use OpenApi\Attributes as OA;

/**
 * Ez az osztály csak a globális OpenAPI metaadatokat (Info, szerverek,
 * biztonsági séma, közös hibaválasz-sémák) hordozza annotáció formájában.
 * A tényleges végpontokat a megfelelő kontrollerek annotálják.
 */
#[OA\Info(
    version: '0.1.0',
    title: 'Kitelepítési Támogató Rendszer API',
    description: "QR-kódos kitelepítési, regisztrációs és befogadóhelyi nyomon követő prototípus REST API-ja.\n\n".
        "Az autentikáció Laravel Sanctum SPA session-cookie alapú: előbb GET /sanctum/csrf-cookie, ".
        "utána POST /api/login. A böngészőn kívüli kliensek (pl. ez a Swagger UI) ezért a `/api/login` ".
        'végpontot csak akkor tudják sikeresen meghívni, ha a kliens ugyanabból az origin-ből fut, ahonnan '.
        'a cookie-kat is fogadja.'
)]
#[OA\Server(url: 'http://localhost:8000', description: 'Helyi fejlesztői szerver')]
#[OA\SecurityScheme(
    securityScheme: 'sanctumSession',
    type: 'apiKey',
    in: 'cookie',
    name: 'laravel_session',
    description: 'Laravel Sanctum SPA session-cookie autentikáció. Bejelentkezés: POST /api/login.'
)]
#[OA\Tag(name: 'Auth', description: 'Bejelentkezés, kijelentkezés, aktuális felhasználó')]
#[OA\Tag(name: 'Events', description: 'Kitelepítési események kezelése')]
#[OA\Tag(name: 'Persons', description: 'Személy/család regisztráció')]
#[OA\Tag(name: 'Qr', description: 'QR-token generálás és feloldás')]
#[OA\Tag(name: 'Shelters', description: 'Befogadóhelyek és kapacitás')]
#[OA\Tag(name: 'CheckIns', description: 'Befogadóhelyi érkeztetés')]
#[OA\Tag(name: 'Dashboard', description: 'Összesített mutatók és kockázati becslés')]
#[OA\Tag(name: 'Audit', description: 'Műveleti napló')]
class OpenApiSpec
{
    //
}
