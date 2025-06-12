const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert'); //  Plugin untuk menyajikan file statis
const path = require('path');        // Modul path untuk bekerja dengan jalur file
const routes = require('./routes/news-routes'); //  Pastikan path ini benar relatif terhadap server.js (misalnya jika routes ada di ./routes/)

// Jika Anda menggunakan dotenv untuk lingkungan lokal, pastikan itu diimpor
// require('dotenv').config(); 

const init = async () => {
    const server = Hapi.server({
        // Gunakan PORT dari environment variable yang disediakan Railway
        // Default ke 9000 untuk pengembangan lokal jika tidak ada PORT
        port: process.env.PORT || 9000, 
        
        // Host '0.0.0.0' diperlukan untuk deployment di Railway agar dapat diakses dari luar
        // Untuk lokal bisa tetap 'localhost'
        host: '0.0.0.0', 
        
        routes: {
            cors: {
                // Izinkan permintaan dari semua origin untuk fleksibilitas saat ini
                // DI PRODUKSI, SANGAT DIREKOMENDASIKAN UNTUK MEMBATASI KE DOMAIN FRONTEND ANDA SAJA!
                // Contoh: origin: ['https://your-frontend-domain.com', 'http://localhost:9001'],
                origin: ['*'], 
                credentials: true
            }
        }
    });

    // Daftarkan plugin Inert untuk melayani file statis
    await server.register(Inert); // 

    // Konfigurasi untuk melayani gambar dari folder 'public/images'
    server.route({
        method: 'GET',
        path: '/public/images/{param*}', // {param*} menangkap semua setelah /public/images/
        handler: {
            directory: {
                // path.join(__dirname, 'public', 'images') akan menunjuk ke
                // folder 'public/images' di root repositori backend Anda
                path: path.join(__dirname, 'public', 'images'), 
                redirectToSlash: true,
                index: false, // Jangan melayani file index jika ada
            }
        }
    });

    // Daftarkan rute API Anda yang lain
    server.route(routes); //  Contoh rute API Anda

    // Contoh rute kesehatan untuk memverifikasi server berjalan
    server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
            return 'Hapi.js Backend is running!';
        }
    });

    await server.start();
    console.log(`Server running on ${server.info.uri}`);
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();