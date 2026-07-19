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
        // Alapból minden felhasználónak kötelező marad a 2FA (default true) —
        // ez a mező csak azt teszi lehetővé, hogy a felhasználó saját magának
        // (a fiókbeállításokban) kikapcsolhassa, elsősorban fejlesztői/teszt
        // kényelmi célból. Ha ezt a funkciót később eltávolítjuk, ez a
        // migráció visszagörgethető (down()).
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('two_factor_enabled')->default(true)->after('two_factor_attempts');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('two_factor_enabled');
        });
    }
};
