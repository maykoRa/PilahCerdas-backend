const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert'); // Plugin untuk menyajikan file statis
const path = require('path');  
const fs = require('fs');      // Modul path untuk bekerja dengan jalur file
const routes = require('./routes/news-routes'); // Pastikan path ini benar relatif terhadap server.js (misalnya jika routes ada di ./routes/)

// require('dotenv').config(); // Uncomment jika Anda menggunakan .env lokal

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
    await server.register(Inert); 

    server.route({
        method: 'GET',
        path: '/debug/image/{filename}', // Contoh: /debug/image/namafile.jpg
        handler: async (request, h) => {
            const filename = request.params.filename;
            const filePath = path.join(__dirname, 'src', 'public', 'images', filename); // Path yang diharapkan
            
            console.log(`DEBUG: Mencoba membaca file di: ${filePath}`);

            try {
                // Periksa apakah file ada
                await fs.promises.access(filePath, fs.constants.R_OK); // R_OK = izin baca
                console.log(`DEBUG: File ${filename} ditemukan dan dapat dibaca.`);

                // Jika file ditemukan, sajikan sebagai respons
                return h.file(filePath); // Gunakan h.file() dari Inert

            } catch (error) {
                console.error(`DEBUG: Gagal mengakses file ${filename} di ${filePath}:`, error.message);
                // Tambahkan log detail error di sini untuk membedakan ENOENT, EACCES dll.
                if (error.code === 'ENOENT') {
                    return h.response({ status: 'fail', message: 'File tidak ditemukan di jalur yang diharapkan.' }).code(404);
                } else if (error.code === 'EACCES') {
                    return h.response({ status: 'fail', message: 'Tidak ada izin baca untuk file.' }).code(403);
                }
                return h.response({ status: 'error', message: `Kesalahan server: ${error.message}` }).code(500);
            }
        }
    });

    // Konfigurasi untuk melayani gambar dari folder 'public/images'
    server.route({
        method: 'GET',
        path: '/public/images/{param*}', 
        handler: {
            directory: {
                // Perbaiki path ini agar sesuai dengan tempat formidable menyimpan gambar
                // __dirname adalah '/app/'
                // Jadi, path.join(__dirname, 'src', 'public', 'images') akan menjadi '/app/src/public/images/'
                path: path.join(__dirname, 'src', 'public', 'images'), // <--- INI PERBAIKANNYA!
                redirectToSlash: true,
                index: false, 
            }
        }
    });

    // Daftarkan rute API Anda yang lain
    server.route(routes); // Contoh rute API Anda

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