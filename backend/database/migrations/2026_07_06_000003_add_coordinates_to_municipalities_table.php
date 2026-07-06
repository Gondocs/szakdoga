<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Interreg tanulmány "Geografikus Nyomon Követési Dashboard" funkciója: a
 * befogadóhelyek (a településük koordinátáin keresztül) térképen
 * megjeleníthetők legyenek.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('municipalities', function (Blueprint $table) {
            $table->decimal('lat', 9, 6)->nullable()->after('postal_code');
            $table->decimal('lng', 9, 6)->nullable()->after('lat');
        });
    }

    public function down(): void
    {
        Schema::table('municipalities', function (Blueprint $table) {
            $table->dropColumn(['lat', 'lng']);
        });
    }
};
