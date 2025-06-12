const { nanoid } = require("nanoid");
const Boom = require("@hapi/boom");
const News = require("../models/news");
const fs = require("fs");
const path = require("path");
const { Formidable } = require("formidable");
const educationContent = require("../data/education");

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
  console.log("--- Inside uploadImageHandler (with formidable parser) ---");
  console.log("Request Headers:", request.headers);

  authenticateAdmin(request, h);

  // --- Tentukan path uploadDirRoot dengan TEPAT ---
  let uploadDirRoot;
  // PENTING: Pilih salah satu di bawah ini berdasarkan struktur repo Anda:

  // Jika folder public/images ada di ROOT repositori:
  // uploadDirRoot = path.join(process.cwd(), 'public', 'images'); 

  // JIKA folder public/images ada di dalam folder 'src/' di repositori:
  uploadDirRoot = path.join(process.cwd(), 'src', 'public', 'images'); 

  console.log(`Calculated uploadDirRoot: ${uploadDirRoot}`); // Debugging: Lihat path ini di log Railway

  // --- PASTIKAN DIREKTORI DIBUAT SEBELUM FORMIDABLE DIGUNAKAN ---
  try {
      if (!fs.existsSync(uploadDirRoot)) {
          fs.mkdirSync(uploadDirRoot, { recursive: true });
          console.log(`SUCCESS: Direktori upload dibuat: ${uploadDirRoot}`);
      } else {
          console.log(`INFO: Direktori upload sudah ada: ${uploadDirRoot}`);
      }
  } catch (dirError) {
      console.error(`ERROR: Gagal membuat direktori upload: ${uploadDirRoot}`, dirError);
      // Lempar error agar request gagal jika direktori tidak bisa dibuat
      throw Boom.badImplementation(`Gagal mengunggah gambar. Direktori penyimpanan tidak dapat dibuat: ${dirError.message}`);
  }

  const form = new Formidable({
    multiples: false,
    uploadDir: uploadDirRoot,
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024,
  });

  try {
    const [fields, files] = await new Promise((resolve, reject) => {
      // --- TAMBAHKAN LOG DEBUG INI DI SINI ---
      form.parse(request.payload, (err, fields, files) => {
        console.log("Formidable parse result:");
        console.log("Error from formidable:", err);
        console.log("Fields from formidable:", fields);
        console.log("Files from formidable:", files); // <--- INI PENTING!
        // --- AKHIR LOG DEBUG ---

        if (err) {
          // Jika ini error, periksa error.message atau error.code
          console.error("Formidable parse error:", err);
          if (err.code === 1009) { // Contoh error code Formidable untuk file too large
             return reject(Boom.entityTooLarge("Ukuran file gambar terlalu besar."));
          }
          return reject(err);
        }
        resolve([fields, files]);
      });
    });

    const uploadedFile = files.image && files.image[0];

    console.log(`Uploaded file path from Formidable: ${uploadedFile.filepath}`);
    console.log(`Original filename: ${uploadedFile.originalFilename}`);
    console.log(`File name after formidable save: ${path.basename(uploadedFile.filepath)}`);

    if (!uploadedFile) {
      throw Boom.badRequest(
        "Tidak ada gambar yang diunggah atau nama field tidak tepat."
      );
    }

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedMimeTypes.includes(uploadedFile.mimetype)) {
      if (fs.existsSync(uploadedFile.filepath)) {
        fs.unlinkSync(uploadedFile.filepath);
      }
      throw Boom.badRequest(
        "Format file tidak didukung. Hanya JPEG, PNG, atau GIF yang diizinkan."
      );
    }

    const oldPath = uploadedFile.filepath;
    const fileExtension = path.extname(uploadedFile.originalFilename);
    const uniqueFilename = `${nanoid(16)}${fileExtension}`;
    const newPath = path.join(__dirname, "../../public/images", uniqueFilename);

    await fs.promises.rename(oldPath, newPath);

    const imageUrl = `https://${request.info.host}/public/images/${path.basename(uploadedFile.filepath)}`;

    return h
      .response({
        status: "success",
        message: "Gambar berhasil diunggah",
        data: {
          imageUrl: imageUrl,
        },
      })
      .code(200);
  } catch (error) {
    if (Boom.isBoom(error)) {
      throw error;
    }
    if (error.code === 1009) {
      throw Boom.entityTooLarge("Ukuran file gambar terlalu besar.");
    }
    console.error("Error during image upload with formidable:", error);
    throw Boom.badImplementation(
      "Gagal mengunggah gambar. Terjadi kesalahan server."
    );
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
