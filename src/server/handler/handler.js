const { nanoid } = require("nanoid");
const Boom = require("@hapi/boom");
const News = require("../models/news");
const fs = require("fs");
const path = require("path");
const { Formidable } = require("formidable");
const educationContent = require("../data/education");
const { Storage } = require('@google-cloud/storage');

let storage;
try {
    if (process.env.GCS_CREDENTIALS_BASE64) {
        const credentials = JSON.parse(Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString('utf8'));
        storage = new Storage({ credentials });
    } else {
        // Fallback untuk lokal jika menggunakan GOOGLE_APPLICATION_CREDENTIALS file path
        // require('dotenv').config(); // Pastikan dotenv di-require jika menggunakan .env
        // Contoh: GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/key.json
        storage = new Storage(); // Ini akan mencari GOOGLE_APPLICATION_CREDENTIALS
    }
    console.log("Google Cloud Storage client initialized.");
} catch (error) {
    console.error("Error initializing Google Cloud Storage client:", error);
    storage = null; // Pastikan storage null jika gagal
}

// Dapatkan nama bucket dari variabel lingkungan
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const activeAdminSessions = new Set();

const authenticateAdmin = (request, h) => {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw Boom.unauthorized(
      "Token otentikasi tidak ditemukan atau tidak valid."
    );
  }
  const token = authHeader.split(" ")[1];
  if (!activeAdminSessions.has(token)) {
    throw Boom.forbidden("Akses ditolak. Anda tidak memiliki izin admin.");
  }
};

const addNewsHandler = async (request, h) => {
  authenticateAdmin(request, h);
  const { title, content, imageUrl } = request.payload;
  if (!title || !content || !imageUrl) {
    throw Boom.badRequest(
      "Judul, konten, dan URL gambar berita tidak boleh kosong."
    );
  }

  const id = nanoid(16);

  try {
    const newItem = await News.create({
      id,
      title,
      content,
      imageUrl,
    });

    return h
      .response({
        status: "success",
        message: "Berita berhasil ditambahkan",
        data: { id: newItem.id },
      })
      .code(201);
  } catch (error) {
    console.error("Error adding news to database:", error);
    throw Boom.badImplementation("Gagal menambahkan berita ke database.");
  }
};

const getAllNewsHandler = async (request, h) => {
  try {
    const newsList = await News.findAll({
      order: [["createdAt", "DESC"]],
    });
    return {
      status: "success",
      data: { news: newsList },
    };
  } catch (error) {
    console.error("Error fetching all news from database:", error);
    throw Boom.badImplementation(
      "Gagal mengambil daftar berita dari database."
    );
  }
};

const getNewsByIdHandler = async (request, h) => {
  const { newsId } = request.params;
  try {
    const item = await News.findByPk(newsId);

    if (item) {
      return { status: "success", data: { item } };
    }
    throw Boom.notFound("Berita tidak ditemukan.");
  } catch (error) {
    if (Boom.isBoom(error)) {
      throw error;
    }
    console.error("Unexpected error fetching news by ID from database:", error);
    throw Boom.badImplementation(
      "Terjadi kesalahan server internal saat mengambil berita."
    );
  }
};

const editNewsByIdHandler = async (request, h) => {
  authenticateAdmin(request, h);

  const { newsId } = request.params;
  const { title, content, imageUrl } = request.payload;

  if (!title || !content || !imageUrl) {
    throw Boom.badRequest(
      "Judul, konten, dan URL gambar berita tidak boleh kosong."
    );
  }

  try {
    const [updatedRowsCount] = await News.update(
      {
        title,
        content,
        imageUrl,
      },
      {
        where: { id: newsId },
      }
    );

    if (updatedRowsCount > 0) {
      return h
        .response({
          status: "success",
          message: "Berita berhasil diperbarui",
        })
        .code(200);
    }
    throw Boom.notFound("Gagal memperbarui berita. ID tidak ditemukan.");
  } catch (error) {
    if (Boom.isBoom(error)) {
      throw error;
    }
    console.error("Unexpected error updating news in database:", error);
    throw Boom.badImplementation(
      "Terjadi kesalahan server internal saat memperbarui berita."
    );
  }
};

const deleteNewsByIdHandler = async (request, h) => {
  authenticateAdmin(request, h);

  const { newsId } = request.params;

  try {
    const deletedRowCount = await News.destroy({
      where: { id: newsId },
    });

    if (deletedRowCount > 0) {
      return h
        .response({
          status: "success",
          message: "Berita berhasil dihapus",
        })
        .code(200);
    }
    throw Boom.notFound("ID berita tidak ditemukan.");
  } catch (error) {
    if (Boom.isBoom(error)) {
      throw error;
    }
    console.error("Unexpected error deleting news from database:", error);
    throw Boom.badImplementation(
      "Terjadi kesalahan server internal saat menghapus berita."
    );
  }
};

const uploadImageHandler = async (request, h) => {
    console.log("--- Inside uploadImageHandler (GCS version) ---");
    console.log("Request Headers:", request.headers);

    if (!storage || !GCS_BUCKET_NAME) {
        return h.response({ status: 'error', message: 'GCS storage not configured properly.' }).code(500);
    }

    try {
        // Hapi.js dengan 'multipart: true' dan 'output: stream' akan mem-parse payload seperti ini:
        const imagePayload = request.payload.image; // Asumsi field gambar bernama 'image'

        if (!imagePayload || !imagePayload.hapi.filename) {
            return h.response({ status: 'fail', message: 'No image file uploaded.' }).code(400);
        }

        const originalFilename = imagePayload.hapi.filename;
        const fileExtension = path.extname(originalFilename);
        const uniqueFilename = `${nanoid(16)}${fileExtension}`; // Buat nama file unik
        const gcsFile = storage.bucket(GCS_BUCKET_NAME).file(uniqueFilename);

        // --- Upload stream langsung ke GCS ---
        const writeStream = gcsFile.createWriteStream({
            metadata: {
                contentType: imagePayload.hapi.headers['content-type'] // Setel MIME type
            }
        });

        await new Promise((resolve, reject) => {
            imagePayload.pipe(writeStream)
                .on('finish', () => {
                    resolve();
                })
                .on('error', (err) => {
                    console.error("GCS upload stream error:", err);
                    reject(err);
                });
        });

        // URL publik gambar di GCS
        const imageUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${uniqueFilename}`;

        // ... (Logika untuk menyimpan imageUrl ke database tetap sama) ...
        // const newNews = await News.create({ id: nanoid(), title: 'Image News', content: '...', imageUrl: imageUrl });

        return h
            .response({
                status: 'success',
                message: 'Gambar berhasil diunggah ke GCS.',
                data: { imageUrl: imageUrl }
            })
            .code(200);

    } catch (error) {
        console.error("Error during GCS image upload:", error);
        return h.response({ status: 'error', message: `Gagal mengunggah gambar ke GCS: ${error.message}` }).code(500);
    }
};

const getEducationByCategoryHandler = (request, h) => {
  const { category } = request.params;

  if (!educationContent[category]) {
    throw Boom.notFound("Kategori edukasi tidak ditemukan.");
  }

  return h
    .response({
      status: "success",
      data: {
        education: educationContent[category],
      },
    })
    .code(200);
};

const adminLoginHandler = async (request, h) => {
  const { username, password } = request.payload;

  if (!username || !password) {
    throw Boom.badRequest("Username dan password harus diisi.");
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const sessionToken = nanoid(32);
    activeAdminSessions.add(sessionToken);

    setTimeout(() => {
      activeAdminSessions.delete(sessionToken);
      console.log(`Admin session token ${sessionToken} expired.`);
    }, 4 * 60 * 60 * 1000);

    return h
      .response({
        status: "success",
        message: "Login berhasil",
        data: {
          token: sessionToken,
        },
      })
      .code(200);
  }

  throw Boom.unauthorized("Username atau password salah.");
};

module.exports = {
  addNewsHandler,
  getAllNewsHandler,
  getNewsByIdHandler,
  editNewsByIdHandler,
  deleteNewsByIdHandler,
  adminLoginHandler,
  uploadImageHandler,
  getEducationByCategoryHandler,
};
