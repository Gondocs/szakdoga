<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shelters', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 150);
            $table->foreignId('municipality_id')->constrained('municipalities')->restrictOnDelete();
            $table->string('address');
            $table->unsignedInteger('capacity_total');
            $table->unsignedInteger('accessible_capacity')->default(0);
            $table->boolean('medical_support_available')->default(false);
            $table->string('status')->default('planned');
            $table->string('contact_phone', 50)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shelters');
    }
};
