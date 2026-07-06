<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('checkins', function (Blueprint $table) {
            $table->timestamp('temporary_leave_at')->nullable()->after('checked_in_at');
            $table->timestamp('temporary_return_at')->nullable()->after('temporary_leave_at');
        });
    }

    public function down(): void
    {
        Schema::table('checkins', function (Blueprint $table) {
            $table->dropColumn(['temporary_leave_at', 'temporary_return_at']);
        });
    }
};
