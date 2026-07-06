<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Megkülönbözteti a hatósági (helyszíni) és a lakossági önkiszolgáló
     * előregisztrációt (Interreg tanulmány 21. old. "Integrált,
     * Többcsatornás Adatbevitel" funkciója).
     */
    public function up(): void
    {
        Schema::table('registrations', function (Blueprint $table) {
            $table->string('channel')->default('staff')->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('registrations', function (Blueprint $table) {
            $table->dropColumn('channel');
        });
    }
};
