const { PrismaClient } = require('@prisma/client'); // 

// Pastikan dotenv diimpor jika Anda menggunakannya untuk pengembangan lokal
// require('dotenv').config(); 

const db = new PrismaClient({
  datasources: {
    db: {
      // Gunakan DATABASE_URL yang disediakan oleh Railway
      // Jika tidak ada (misalnya saat pengembangan lokal tanpa .env yang tepat), gunakan default lokal
      url: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/pilahcerdas_db', 
    },
  },
});

module.exports = db; //