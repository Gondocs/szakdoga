<?php

namespace App\Providers;

use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\Mailer\Bridge\Mailtrap\Transport\MailtrapApiTransport;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Laravel nem ismeri natívan a "mailtrap" transportot (csak
        // smtp/ses/postmark/resend/stb. van beépítve), ezért a
        // symfony/mailtrap-mailer csomag MailtrapApiTransport-ját kézzel
        // regisztráljuk — ez teszi elérhetővé a 'mailtrap' drivert a
        // config/mail.php 'mailers.mailtrap' bejegyzésének.
        Mail::extend('mailtrap', fn (array $config) => new MailtrapApiTransport($config['key'] ?? env('MAILTRAP_KEY')));
    }
}
