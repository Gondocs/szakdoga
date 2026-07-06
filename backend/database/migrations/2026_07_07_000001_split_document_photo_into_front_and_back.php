<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->string('document_photo_front_path')->nullable()->after('document_photo_path');
            $table->string('document_photo_back_path')->nullable()->after('document_photo_front_path');
        });

        DB::statement('UPDATE persons SET document_photo_front_path = document_photo_path');

        Schema::table('persons', function (Blueprint $table) {
            $table->dropColumn('document_photo_path');
        });
    }

    public function down(): void
    {
        Schema::table('persons', function (Blueprint $table) {
            $table->string('document_photo_path')->nullable()->after('id_document_number');
        });

        DB::statement('UPDATE persons SET document_photo_path = document_photo_front_path');

        Schema::table('persons', function (Blueprint $table) {
            $table->dropColumn(['document_photo_front_path', 'document_photo_back_path']);
        });
    }
};
