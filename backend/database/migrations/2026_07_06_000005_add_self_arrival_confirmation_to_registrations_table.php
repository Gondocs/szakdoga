<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Interreg tanulmány "Saját Járművel Utazók Kezelése" funkciója: a saját
 * járművel, választott helyre távozó lakos aktívan megerősítheti, hogy
 * megérkezett az ideiglenes tartózkodási helyére.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('registrations', function (Blueprint $table) {
            $table->timestamp('self_arrival_confirmed_at')->nullable()->after('own_vehicle');
        });
    }

    public function down(): void
    {
        Schema::table('registrations', function (Blueprint $table) {
            $table->dropColumn('self_arrival_confirmed_at');
        });
    }
};
