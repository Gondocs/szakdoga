<?php

namespace Tests\Feature;

use App\Enums\RoleCode;
use App\Mail\TwoFactorCodeMail;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    // Helyes e-mail/jelszó párossal a bejelentkezés a 2FA-lépést kéri
    // (nem jelentkezteti be azonnal a felhasználót), majd a kiküldött
    // kóddal a /login/two-factor/verify végpont sikeresen bejelentkeztet.
    public function test_user_can_login_with_correct_credentials_and_two_factor_code(): void
    {
        Mail::fake();

        $role = Role::create(['code' => RoleCode::Admin->value, 'name' => 'Admin']);
        $user = User::factory()->create([
            'email' => 'admin@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);

        $response = $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'password',
        ]);

        $response->assertOk()->assertJson(['two_factor_required' => true]);
        $this->assertGuest();

        $code = null;
        Mail::assertSent(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code) {
            $code = $mail->code;

            return true;
        });

        // A teszt-kliens nem viszi át automatikusan a /login által beállított
        // session-sütit a következő hívásra (lásd lentebb, a login-history
        // tesztnél is), ezért a pending 2FA-állapotot itt explicit módon
        // állítjuk be a session-ben.
        $verify = $this->withSession(['2fa_user_id' => $user->id])
            ->withHeader('Referer', 'http://localhost:5173')
            ->postJson('/api/login/two-factor/verify', ['code' => $code]);

        $verify->assertOk()->assertJsonPath('data.email', 'admin@example.com');
        $this->assertAuthenticated();
    }

    // Hibás jelszóval a bejelentkezés elutasításra kerül (422).
    public function test_login_fails_with_wrong_password(): void
    {
        User::factory()->create(['email' => 'admin@example.com', 'password' => bcrypt('password')]);

        $response = $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'admin@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertUnprocessable();
    }

    // A saját profil (/api/me) végpont bejelentkezés nélkül 401-et ad.
    public function test_me_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
    }

    // Bejelentkezve a /api/me a ténylegesen bejelentkezett felhasználó
    // adatait adja vissza.
    public function test_me_endpoint_returns_current_user(): void
    {
        $user = $this->actingAsRole(RoleCode::Admin);

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);
    }

    // A saját név módosításához nem szükséges a jelenlegi jelszó megadása
    // (csak érzékenyebb mezőknél, pl. jelszó/e-mail váltásnál kötelező).
    public function test_user_can_update_own_name_without_current_password(): void
    {
        $this->actingAsRole(RoleCode::Admin);

        $this->putJson('/api/me', ['name' => 'Új Név'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Új Név');
    }

    // Az e-mail cím módosításához helyes jelenlegi jelszó szükséges; hibás
    // "current_password" esetén a kérés 422-t ad, a módosítás nem történik meg.
    public function test_user_cannot_change_email_without_correct_current_password(): void
    {
        $this->actingAsRole(RoleCode::Admin, ['password' => bcrypt('titkosjelszo')]);

        $this->putJson('/api/me', [
            'email' => 'uj-email@example.com',
            'current_password' => 'wrong-password',
        ])->assertUnprocessable();
    }

    // Helyes jelenlegi jelszóval a jelszó módosítható, és az adatbázisban
    // ténylegesen az új (hash-elt) jelszó kerül elmentésre.
    public function test_user_can_change_password_with_correct_current_password(): void
    {
        $user = $this->actingAsRole(RoleCode::Admin, ['password' => bcrypt('regijelszo')]);

        $this->putJson('/api/me', [
            'password' => 'ujjelszo123',
            'current_password' => 'regijelszo',
        ])->assertOk();

        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('ujjelszo123', $user->fresh()->password));
    }

    // A saját bejelentkezési előzmény (/api/me/login-history) attól
    // függetlenül elérhető egy regisztrátor számára, hogy a teljes
    // auditnaplóhoz (/api/audit-logs) nincs jogosultsága — a felhasználó
    // legalább a saját sikeres és sikertelen bejelentkezéseit láthatja.
    public function test_login_history_is_available_even_to_roles_without_audit_log_access(): void
    {
        Mail::fake();

        $role = Role::create(['code' => RoleCode::Registrar->value, 'name' => 'Registrar']);
        $user = User::factory()->create([
            'email' => 'registrar@example.com',
            'password' => bcrypt('password'),
            'role_id' => $role->id,
        ]);

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'registrar@example.com',
            'password' => 'wrong-password',
        ])->assertUnprocessable();

        $this->withHeader('Referer', 'http://localhost:5173')->postJson('/api/login', [
            'email' => 'registrar@example.com',
            'password' => 'password',
        ])->assertOk();

        $code = null;
        Mail::assertSent(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code) {
            $code = $mail->code;

            return true;
        });

        $this->withSession(['2fa_user_id' => $user->id])
            ->withHeader('Referer', 'http://localhost:5173')
            ->postJson('/api/login/two-factor/verify', ['code' => $code])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'login']);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'login_failed']);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'two_factor_sent']);

        // A tényleges bejelentkezés által beállított session-sütit a teszt-kliens
        // nem viszi át automatikusan a következő hívásra, ezért a védett
        // végpontokat explicit módon, a már autentikált felhasználóval hívjuk.
        $this->actingAs($user);

        $this->getJson('/api/audit-logs')->assertForbidden();

        $history = $this->getJson('/api/me/login-history')->assertOk();
        $actions = collect($history->json('data'))->pluck('action');
        $this->assertTrue($actions->contains('login'));
        $this->assertTrue($actions->contains('login_failed'));
    }

    // Egy frissen létrehozott felhasználónak (akinek még nincs korábbi
    // bejelentkezése) a saját előzménye üres listát ad — nem más
    // felhasználók bejegyzéseit szivárogtatja ki.
    public function test_login_history_only_shows_own_entries(): void
    {
        $this->actingAsRole(RoleCode::Admin);

        $history = $this->getJson('/api/me/login-history')->assertOk();
        $this->assertEmpty($history->json('data'));
    }
}
