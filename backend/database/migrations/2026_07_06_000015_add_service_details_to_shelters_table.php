<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shelters', function (Blueprint $table) {
            $table->boolean('drinking_water_available')->default(false)->after('medical_support_available');
            $table->boolean('meals_available')->default(false)->after('drinking_water_available');
            $table->boolean('hygiene_facilities_available')->default(false)->after('meals_available');
            $table->boolean('childcare_available')->default(false)->after('hygiene_facilities_available');
            $table->boolean('psychological_support_available')->default(false)->after('childcare_available');
            $table->text('house_rules')->nullable()->after('psychological_support_available');
            $table->text('public_health_notes')->nullable()->after('house_rules');
        });
    }

    public function down(): void
    {
        Schema::table('shelters', function (Blueprint $table) {
            $table->dropColumn([
                'drinking_water_available',
                'meals_available',
                'hygiene_facilities_available',
                'childcare_available',
                'psychological_support_available',
                'house_rules',
                'public_health_notes',
            ]);
        });
    }
};
