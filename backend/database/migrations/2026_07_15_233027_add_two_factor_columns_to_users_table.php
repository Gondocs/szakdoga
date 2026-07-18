<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // A három mező kizárólag a folyamatban lévő 2FA-kódot írja le
        // (nincs külön "enabled"/"confirmed_at" flag), mert a 2FA minden
        // staff szerepkörnek kötelező — nincs önkéntes be/kikapcsolás.
        Schema::table('users', function (Blueprint $table) {
            $table->string('two_factor_code')->nullable(); // hash-elt kód
            $table->timestamp('two_factor_expires_at')->nullable();
            $table->unsignedTinyInteger('two_factor_attempts')->default(0); // sikertelen próbálkozások
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['two_factor_code', 'two_factor_expires_at', 'two_factor_attempts']);
        });
    }
};
