<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transports', function (Blueprint $table) {
            $table->string('origin')->nullable()->after('capacity');
            $table->string('destination')->nullable()->after('origin');
            $table->timestamp('departure_planned_at')->nullable()->after('destination');
            $table->timestamp('arrival_planned_at')->nullable()->after('departure_planned_at');
        });
    }

    public function down(): void
    {
        Schema::table('transports', function (Blueprint $table) {
            $table->dropColumn(['origin', 'destination', 'departure_planned_at', 'arrival_planned_at']);
        });
    }
};
