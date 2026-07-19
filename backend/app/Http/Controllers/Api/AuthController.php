<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Mail\TwoFactorCodeMail;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class AuthController extends Controller
{
    private const TWO_FACTOR_MAX_ATTEMPTS = 5;

    private const TWO_FACTOR_CODE_TTL_MINUTES = 10;

    #[OA\Post(
        path: '/api/login',
        summary: 'Bejelentkezés (Sanctum SPA session)',
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['email', 'password'],
                properties: [
                    new OA\Property(property: 'email', type: 'string', format: 'email', example: 'admin@katasztrofavedelem.test'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', example: 'password'),
                ]
            )
        ),
        responses: [
            new OA\Response(
                response: 200,
                description: 'Helyes hitelesítő adatok — vagy a bejelentkezett felhasználó (ha nincs 2FA lépés hátra), '.
                    'vagy egy jelzés, hogy a rendszer e-mailben kiküldött egy 2FA kódot',
                content: new OA\JsonContent(
                    oneOf: [
                        new OA\Schema(properties: [
                            new OA\Property(property: 'data', properties: [
                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                new OA\Property(property: 'name', type: 'string', example: 'Admin Felhasználó'),
                                new OA\Property(property: 'email', type: 'string', example: 'admin@katasztrofavedelem.test'),
                                new OA\Property(property: 'role', properties: [
                                    new OA\Property(property: 'code', type: 'string', example: 'admin'),
                                    new OA\Property(property: 'name', type: 'string', example: 'Rendszergazda'),
                                ], type: 'object'),
                            ], type: 'object'),
                        ]),
                        new OA\Schema(properties: [
                            new OA\Property(property: 'two_factor_required', type: 'boolean', example: true),
                        ]),
                    ]
                )
            ),
            new OA\Response(response: 422, description: 'Hibás e-mail vagy jelszó'),
        ]
    )]
    public function login(LoginRequest $request, AuditService $auditService)
    {
        $credentials = $request->validated();

        // Auth::validate() csak a hitelesítő adatokat ellenőrzi, nem
        // jelentkezteti be a felhasználót — a tényleges bejelentkezés
        // (Auth::login + session regenerálás) csak a helyes 2FA-kód
        // megadása után történik meg, a verifyTwoFactor()-ban.
        if (! Auth::validate($credentials)) {
            $attemptedUser = User::where('email', $credentials['email'])->first();

            AuditLog::create([
                'user_id' => $attemptedUser?->id,
                'action' => 'login_failed',
                'entity_type' => 'User',
                'entity_id' => $attemptedUser ? (string) $attemptedUser->id : $credentials['email'],
                'before_json' => null,
                'after_json' => ['email' => $credentials['email']],
                'significant' => true,
            ]);

            throw ValidationException::withMessages([
                'email' => 'A megadott hitelesítő adatok nem egyeznek a nyilvántartással.',
            ]);
        }

        $user = User::where('email', $credentials['email'])->firstOrFail();

        // A two_factor_enabled mező a felhasználó saját (fiókbeállításokban
        // tett) döntése, hogy kéri-e a 2FA-t — alapból mindenkinek be van
        // kapcsolva, tehát ez a kihagyás nem gyengíti az alapértelmezett
        // biztonságot, csak opt-out lehetőséget ad (pl. fejlesztői/teszt
        // felhasználóknak).
        if (! $user->two_factor_enabled) {
            Auth::login($user);
            $request->session()->regenerate();

            $auditService->log('login', $user, $user, null, null);

            return new UserResource($user->load(['role', 'shelter']));
        }

        // A "pending" 2FA-állapotot a sessionben tároljuk (nem külön
        // tokenben), mivel a Sanctum SPA-flow már a /sanctum/csrf-cookie
        // hívással beállít egy session-sütit, amit a böngésző a következő
        // (verify/resend) kérésekhez automatikusan visszaküld.
        $this->issueTwoFactorCode($user, $request);
        $auditService->log('two_factor_sent', $user, $user, null, null);

        return response()->json(['two_factor_required' => true]);
    }

    #[OA\Post(
        path: '/api/login/two-factor/verify',
        summary: 'Kétfaktoros hitelesítő kód ellenőrzése (a /login után)',
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['code'],
                properties: [
                    new OA\Property(property: 'code', type: 'string', example: '123456'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Sikeres bejelentkezés'),
            new OA\Response(response: 422, description: 'Hibás/lejárt kód, vagy nincs folyamatban lévő belépés'),
        ]
    )]
    public function verifyTwoFactor(Request $request, AuditService $auditService)
    {
        $request->validate(['code' => ['required', 'string']]);

        $userId = $request->session()->get('2fa_user_id');
        $user = $userId ? User::find($userId) : null;

        // Nincs pending 2FA-állapot a sessionben (pl. lejárt a session,
        // vagy a felhasználó közvetlenül ezt a végpontot hívta meg
        // sikeres jelszavas belépés nélkül) — újra be kell jelentkezni.
        if (! $user) {
            throw ValidationException::withMessages([
                'code' => 'Nincs folyamatban lévő belépés, kérjük jelentkezz be újra.',
            ]);
        }

        // Egyetlen feltételben ellenőrizzük az összes elutasítási okot
        // (nincs kód, lejárt, vagy nem egyezik), mert mindegyik esetben
        // ugyanúgy próbálkozásnak számít és ugyanazt az általános hibaüzenetet
        // adjuk vissza — nem áruljuk el, konkrétan melyik feltétel bukott el.
        if (! $user->two_factor_code
            || ! $user->two_factor_expires_at
            || $user->two_factor_expires_at->isPast()
            || ! Hash::check((string) $request->input('code'), $user->two_factor_code)) {
            $user->increment('two_factor_attempts');

            $auditService->log('login_2fa_failed', $user, $user, null, null);

            // Túl sok sikertelen próbálkozás után a teljes pending
            // belépést lezárjuk (a régi, egyébként helyes kód is
            // érvénytelenné válik) — újra jelszóval kell kezdeni.
            if ($user->two_factor_attempts >= self::TWO_FACTOR_MAX_ATTEMPTS) {
                $this->clearTwoFactorState($user, $request);

                throw ValidationException::withMessages([
                    'code' => 'Túl sok sikertelen próbálkozás. Kérjük jelentkezz be újra.',
                ]);
            }

            throw ValidationException::withMessages([
                'code' => 'Hibás vagy lejárt kód.',
            ]);
        }

        $this->clearTwoFactorState($user, $request);

        // Csak itt, a helyes kód megadása után történik a tényleges
        // bejelentkezés — a login() eddig csak validált, nem jelentkeztetett be.
        Auth::login($user);
        $request->session()->regenerate();

        $auditService->log('login', $user, $user, null, null);

        return new UserResource($user->load(['role', 'shelter']));
    }

    #[OA\Post(
        path: '/api/login/two-factor/resend',
        summary: 'Kétfaktoros hitelesítő kód újraküldése (a /login után)',
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Új kód kiküldve'),
            new OA\Response(response: 422, description: 'Nincs folyamatban lévő belépés'),
        ]
    )]
    public function resendTwoFactor(Request $request, AuditService $auditService)
    {
        $userId = $request->session()->get('2fa_user_id');
        $user = $userId ? User::find($userId) : null;

        if (! $user) {
            throw ValidationException::withMessages([
                'code' => 'Nincs folyamatban lévő belépés, kérjük jelentkezz be újra.',
            ]);
        }

        // Új kód kiadása visszaállítja a próbálkozás-számlálót is, tehát a
        // korábbi hibás próbálkozások nem viszik közelebb a lezáráshoz.
        $this->issueTwoFactorCode($user, $request);
        $auditService->log('two_factor_sent', $user, $user, null, null);

        return response()->json(['two_factor_required' => true]);
    }

    private function issueTwoFactorCode(User $user, Request $request): void
    {
        $code = (string) random_int(100000, 999999);

        // forceFill()->save()-t használunk update() helyett, mert a
        // two_factor_* mezők szándékosan nincsenek a $fillable listában
        // (nem tömeges hozzárendelésből, hanem csak a szerver által,
        // belsőleg állítódnak be) — update() ezeket csendben eldobná.
        $user->forceFill([
            'two_factor_code' => Hash::make($code),
            'two_factor_expires_at' => now()->addMinutes(self::TWO_FACTOR_CODE_TTL_MINUTES),
            'two_factor_attempts' => 0,
        ])->save();

        $request->session()->put('2fa_user_id', $user->id);

        // Amíg a seedelt staff felhasználók e-mail címei (pl.
        // @katasztrofavedelem.test) nem valós postafiókok, a
        // TWO_FACTOR_TEST_RECIPIENT env kulcs minden kódot egy adott,
        // ténylegesen ellenőrizhető címre irányít át.
        $recipient = config('mail.two_factor_test_recipient') ?: $user->email;

        // Szándékosan szinkron send() (nem queue()): a felhasználó a
        // bejelentkezés közben, azonnal várja a kódot, ezért a kiküldésnek
        // a kérés részeként kell megtörténnie — egy esetlegesen nem futó
        // queue worker miatt a levél sosem érkezne meg.
        Mail::to($recipient)->send(new TwoFactorCodeMail($code));
    }

    private function clearTwoFactorState(User $user, Request $request): void
    {
        $user->forceFill([
            'two_factor_code' => null,
            'two_factor_expires_at' => null,
            'two_factor_attempts' => 0,
        ])->save();

        $request->session()->forget('2fa_user_id');
    }

    #[OA\Post(
        path: '/api/logout',
        summary: 'Kijelentkezés',
        security: [['sanctumSession' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 204, description: 'Sikeres kijelentkezés'),
            new OA\Response(response: 401, description: 'Nincs bejelentkezve'),
        ]
    )]
    public function logout(Request $request, AuditService $auditService)
    {
        $user = $request->user();

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($user) {
            $auditService->log('logout', $user, $user, null, null);
        }

        return response()->noContent();
    }

    #[OA\Get(
        path: '/api/me',
        summary: 'Aktuális bejelentkezett felhasználó és jogosultsága',
        security: [['sanctumSession' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Aktuális felhasználó adatai'),
            new OA\Response(response: 401, description: 'Nincs bejelentkezve'),
        ]
    )]
    public function me(Request $request)
    {
        return new UserResource($request->user()->load(['role', 'shelter']));
    }

    #[OA\Put(
        path: '/api/me',
        summary: 'Saját profil szerkesztése (név, e-mail, jelszó)',
        description: 'E-mail vagy jelszó módosításához a jelenlegi jelszó megadása is szükséges.',
        security: [['sanctumSession' => []]],
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'name', type: 'string'),
                    new OA\Property(property: 'email', type: 'string', format: 'email'),
                    new OA\Property(property: 'password', type: 'string', format: 'password', nullable: true),
                    new OA\Property(property: 'current_password', type: 'string', format: 'password', nullable: true),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Frissített felhasználó'),
            new OA\Response(response: 422, description: 'Validációs hiba vagy hibás jelenlegi jelszó'),
        ]
    )]
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', Password::min(8)],
            'current_password' => ['nullable', 'string'],
        ]);

        if (isset($data['email']) || ! empty($data['password'])) {
            if (! Hash::check($data['current_password'] ?? '', $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => 'A jelenlegi jelszó nem megfelelő.',
                ]);
            }
        }

        $update = array_filter([
            'name' => $data['name'] ?? null,
            'email' => $data['email'] ?? null,
        ], fn ($v) => $v !== null);

        if (! empty($data['password'])) {
            $update['password'] = bcrypt($data['password']);
        }

        $user->update($update);

        return new UserResource($user->fresh(['role', 'shelter']));
    }

    #[OA\Put(
        path: '/api/me/two-factor',
        summary: 'Saját kétfaktoros hitelesítés be-/kikapcsolása',
        security: [['sanctumSession' => []]],
        tags: ['Auth'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['enabled'],
                properties: [
                    new OA\Property(property: 'enabled', type: 'boolean'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Frissített felhasználó'),
        ]
    )]
    public function updateTwoFactorPreference(Request $request)
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);

        $user = $request->user();
        $user->forceFill(['two_factor_enabled' => $data['enabled']])->save();

        return new UserResource($user->fresh(['role', 'shelter']));
    }

    #[OA\Get(
        path: '/api/me/login-history',
        summary: 'Saját legutóbbi bejelentkezési/kijelentkezési előzmények',
        description: 'Minden szerepkör lekérheti a saját fiókjához tartozó bejegyzéseket, függetlenül attól, '.
            'hogy jogosult-e az általános műveleti napló megtekintésére.',
        security: [['sanctumSession' => []]],
        tags: ['Auth'],
        responses: [
            new OA\Response(response: 200, description: 'Legutóbbi bejelentkezési előzmények (max. 10 bejegyzés)'),
        ]
    )]
    public function loginHistory(Request $request)
    {
        // A two_factor_sent/login_2fa_failed akciók is itt jelennek meg,
        // hogy a felhasználó a saját előzményében lássa, ha valaki
        // (ő maga vagy más) 2FA-kódot kért/rontott el a fiókjához.
        $entries = AuditLog::where('user_id', $request->user()->id)
            ->whereIn('action', ['login', 'logout', 'login_failed', 'two_factor_sent', 'login_2fa_failed'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get(['id', 'action', 'created_at']);

        return response()->json(['data' => $entries]);
    }
}
