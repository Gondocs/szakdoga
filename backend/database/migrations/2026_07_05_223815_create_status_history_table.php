<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('status_history', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type');
            $table->string('entity_id');
            $table->string('old_status')->nullable();
            $table->string('new_status');
            $table->foreignId('changed_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('status_history');
    }
};
