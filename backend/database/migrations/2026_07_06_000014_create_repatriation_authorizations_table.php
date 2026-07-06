<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repatriation_authorizations', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('event_id')->constrained('evacuation_events')->cascadeOnDelete();
            $table->foreignId('municipality_id')->constrained('municipalities')->cascadeOnDelete();
            $table->string('status')->default('not_permitted');
            $table->text('conditions_note')->nullable();
            $table->timestamp('window_starts_at')->nullable();
            $table->timestamp('window_ends_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['event_id', 'municipality_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('repatriation_authorizations');
    }
};
