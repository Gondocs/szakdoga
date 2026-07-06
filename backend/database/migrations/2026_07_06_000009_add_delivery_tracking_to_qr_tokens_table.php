<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('qr_tokens', function (Blueprint $table) {
            $table->string('delivery_method')->nullable()->after('status');
            $table->timestamp('delivered_at')->nullable()->after('delivery_method');
            $table->foreignId('delivered_by')->nullable()->after('delivered_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('qr_tokens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('delivered_by');
            $table->dropColumn(['delivery_method', 'delivered_at']);
        });
    }
};
