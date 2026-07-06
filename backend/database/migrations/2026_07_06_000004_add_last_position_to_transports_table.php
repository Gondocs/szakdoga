<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A jármű utoljára ismert (a hiányzó valós GPS-integráció miatt szimulált)
 * pozíciója a "Geografikus Nyomon Követési Dashboard" funkcióhoz.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transports', function (Blueprint $table) {
            $table->decimal('last_lat', 9, 6)->nullable()->after('capacity');
            $table->decimal('last_lng', 9, 6)->nullable()->after('last_lat');
            $table->timestamp('last_position_at')->nullable()->after('last_lng');
        });
    }

    public function down(): void
    {
        Schema::table('transports', function (Blueprint $table) {
            $table->dropColumn(['last_lat', 'last_lng', 'last_position_at']);
        });
    }
};
