<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transports', function (Blueprint $table) {
            $table->string('escort_name')->nullable()->after('destination');
            $table->integer('delay_minutes')->nullable()->after('arrival_planned_at');
            $table->string('route_change_note')->nullable()->after('delay_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('transports', function (Blueprint $table) {
            $table->dropColumn(['escort_name', 'delay_minutes', 'route_change_note']);
        });
    }
};
