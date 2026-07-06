<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Az Interreg tanulmány (11. old.) a regisztrációs pontokon kötelezően
     * rögzítendő adatok között sorolja fel a nemet és a személyazonosításra
     * alkalmas okmány számát.
     */
    public function up(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->string('gender')->nullable()->after('birth_date');
            $table->string('id_document_number')->nullable()->after('mother_birth_name');
        });
    }

    public function down(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->dropColumn(['gender', 'id_document_number']);
        });
    }
};
