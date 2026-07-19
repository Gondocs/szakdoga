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
        // A family_code ("CSAL-001" stb.) generálása (CreateRegistrationAction)
        // eseményenként újraindul 1-től, de az eredeti séma globálisan tette
        // egyedivé az oszlopot — emiatt bármely két esemény azonos sorszámú
        // első családja ütközött. A helyes üzleti szabály: a kód csak az adott
        // eseményen belül kell, hogy egyedi legyen.
        Schema::table('families', function (Blueprint $table) {
            $table->dropUnique('families_family_code_unique');
            $table->unique(['event_id', 'family_code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('families', function (Blueprint $table) {
            $table->dropUnique(['event_id', 'family_code']);
            $table->unique('family_code');
        });
    }
};
