<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('plate_number')->unique();
            $table->string('label');
            $table->unsignedInteger('capacity')->nullable();
            $table->string('driver_name')->nullable();
            $table->string('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('transports', function (Blueprint $table) {
            $table->foreignUuid('vehicle_id')->nullable()->after('event_id')->constrained('vehicles')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('transports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vehicle_id');
        });

        Schema::dropIfExists('vehicles');
    }
};
