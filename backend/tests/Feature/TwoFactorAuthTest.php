<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Mail\TwoFactorCodeMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class TwoFactorAuthTest extends TestCase
{
    use RefreshDatabase;

    private function createUser(): User
    {
        $role = Role::create(['code' => RoleCode::Admin->value, 'name' => 'Admin']);

        return User::factory()->create([
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);
    }

    // Hibás kód esetén a végpont 422-t ad, nem jelentkezteti be a
    // felhasználót, és a sikertelen próbálkozást naplózza.
    public function test_wrong_two_factor_code_is_rejected(): void
    {
        Mail::fake();
        $user = $this->createUser();

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ])->assertOk();

        $this->withSession(['2fa_user_id' => $user->id])
            ->withHeader('Referer', 'http://localhost:5173')
            ->postJson('/api/login/two-factor/verify', ['code' => '000000'])
            ->assertUnprocessable();

        $this->assertGuest();
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'login_2fa_failed']);
    }

    // Lejárt kód esetén a végpont elutasítja a kódot, még ha egyébként
    // helyes is lenne.
    public function test_expired_two_factor_code_is_rejected(): void
    {
        Mail::fake();
        $user = $this->createUser();

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ])->assertOk();

        $code = null;
        Mail::assertSent(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code) {
            $code = $mail->code;

            return true;
        });

        $user->two_factor_expires_at = now()->subMinute();
        $user->save();

        $this->withSession(['2fa_user_id' => $user->id])
            ->withHeader('Referer', 'http://localhost:5173')
            ->postJson('/api/login/two-factor/verify', ['code' => $code])
            ->assertUnprocessable();

        $this->assertGuest();
    }

    // 5 egymást követő hibás próbálkozás után a folyamatban lévő belépés
    // lezárul — újra be kell jelentkezni, a régi kód innentől nem használható.
    public function test_too_many_failed_attempts_locks_out_the_pending_login(): void
    {
        Mail::fake();
        $user = $this->createUser();

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ])->assertOk();

        $code = null;
        Mail::assertSent(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code) {
            $code = $mail->code;

            return true;
        });

        for ($i = 0; $i < 4; $i++) {
            $this->withSession(['2fa_user_id' => $user->id])
                ->withHeader('Referer', 'http://localhost:5173')
                ->postJson('/api/login/two-factor/verify', ['code' => '000000'])
                ->assertUnprocessable();
        }

        // Az 5. sikertelen próbálkozás lezárja a folyamatot.
        $this->withSession(['2fa_user_id' => $user->id])
            ->withHeader('Referer', 'http://localhost:5173')
            ->postJson('/api/login/two-factor/verify', ['code' => '000000'])
            ->assertUnprocessable();

        $user->refresh();
        $this->assertNull($user->two_factor_code);
        $this->assertEquals(0, $user->two_factor_attempts);

        // A régi, egyébként helyes kód sem fogadható el többé, mivel a
        // pending állapot törlődött.
        $this->withSession(['2fa_user_id' => $user->id])
            ->withHeader('Referer', 'http://localhost:5173')
            ->postJson('/api/login/two-factor/verify', ['code' => $code])
            ->assertUnprocessable();

        $this->assertGuest();
    }

    // A kód újraküldése új kódot generál és kiküld, a próbálkozás-számlálót
    // pedig visszaállítja.
    public function test_resend_issues_a_new_code(): void
    {
        Mail::fake();
        $user = $this->createUser();

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ])->assertOk();

        $firstHash = $user->fresh()->two_factor_code;

        $this->withSession(['2fa_user_id' => $user->id])
            ->withHeader('Referer', 'http://localhost:5173')
            ->postJson('/api/login/two-factor/resend')
            ->assertOk()
            ->assertJson(['two_factor_required' => true]);

        $this->assertNotEquals($firstHash, $user->fresh()->two_factor_code);
        Mail::assertSent(TwoFactorCodeMail::class, 2);
    }

    // Ha nincs folyamatban lévő belépés (pl. lejárt a session, vagy még
    // nem történt sikeres jelszavas hitelesítés), a verify/resend végpontok
    // elutasítják a kérést.
    public function test_verify_without_pending_login_is_rejected(): void
    {
        $this->withHeader('Referer', 'http://localhost:5173')
            ->postJson('/api/login/two-factor/verify', ['code' => '123456'])
            ->assertUnprocessable();

        $this->withHeader('Referer', 'http://localhost:5173')
            ->postJson('/api/login/two-factor/resend')
            ->assertUnprocessable();
    }
}
