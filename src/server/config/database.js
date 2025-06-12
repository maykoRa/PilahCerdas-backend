// D:\DBS Foundation\Capstone Project\PilahCerdas-backend\config\database.js

const { Sequelize } = require('sequelize'); // Impor Sequelize
// require('dotenv').config(); // Uncomment jika Anda menggunakan .env lokal

// Dapatkan variabel lingkungan untuk koneksi database dari Railway
const DB_HOST = process.env.MYSQL_HOST || 'localhost';
const DB_USER = process.env.MYSQL_USER || 'root';
const DB_PASSWORD = process.env.MYSQL_PASSWORD || '';
const DB_DATABASE = process.env.MYSQL_DATABASE || 'pilahcerdas_db';
// Pastikan port di-parse sebagai integer, default 3306
const DB_PORT = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306;

let sequelize;

// Preferensi menggunakan DATABASE_URL jika disediakan oleh Railway/Render (direkomendasikan)
if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'mysql',
        logging: false, // Atur ke true jika ingin melihat log SQL
        dialectOptions: {
            // Penting jika Anda menggunakan koneksi SSL/TLS di production (misalnya di Railway/Render)
            // Render dan Railway seringkali membutuhkan SSL.
            // Anda mungkin perlu menambahkan { ssl: { rejectUnauthorized: false } } jika terjadi error SSL
            // ssl: {
            //   rejectUnauthorized: false
            // }
        },
        pool: { // Konfigurasi connection pool
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
} else {
    // Fallback jika DATABASE_URL tidak tersedia (misalnya untuk pengembangan lokal)
    sequelize = new Sequelize(DB_DATABASE, DB_USER, DB_PASSWORD, {
        host: DB_HOST,
        port: DB_PORT,
        dialect: 'mysql',
        logging: false, // Atur ke true jika ingin melihat log SQL
        pool: { // Konfigurasi connection pool
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
}

// Uji koneksi database saat aplikasi dimulai
async function connectDB() {
    try {
        await sequelize.authenticate();
        console.log('Koneksi ke database MySQL (via Sequelize) berhasil!');
        // Untuk pengembangan cepat, Anda bisa mengaktifkan sinkronisasi model di sini.
        // HATI-HATI: sequelize.sync() di production bisa berbahaya bagi data.
        // Sebaiknya gunakan migrasi Sequelize untuk production.
        // await sequelize.sync(); 
        // console.log('Semua model telah disinkronkan!');
    } catch (error) {
        console.error('Gagal terhubung ke database MySQL (via Sequelize):', error);
        // Pertimbangkan untuk keluar dari proses jika koneksi database kritis
        // process.exit(1); 
    }
}

connectDB(); // Panggil fungsi koneksi saat file ini dimuat

module.exports = sequelize; // Export instance Sequelize