const {
  getAllNewsHandler,
  getNewsByIdHandler,
  addNewsHandler,
  editNewsByIdHandler,
  deleteNewsByIdHandler,
  adminLoginHandler,
  uploadImageHandler,
  getEducationByCategoryHandler,
} = require("../handler/handler");

const routes = [
  {
    method: "GET",
    path: "/news",
    handler: getAllNewsHandler,
  },
  {
    method: "GET",
    path: "/news/{newsId}",
    handler: getNewsByIdHandler,
  },
  {
    method: "POST",
    path: "/admin/login",
    handler: adminLoginHandler,
  },
  {
    method: "POST",
    path: "/admin/news",
    handler: addNewsHandler,
  },
  {
    method: "PUT",
    path: "/admin/news/{newsId}",
    handler: editNewsByIdHandler,
  },
  {
    method: "DELETE",
    path: "/admin/news/{newsId}",
    handler: deleteNewsByIdHandler,
  },
  {
    method: "POST",
    path: "/admin/upload/image",
    handler: uploadImageHandler,
    options: {
      payload: {
        output: "stream",
        parse: false,
        allow: "multipart/form-data",
        maxBytes: 5 * 1024 * 1024,
      },
    },
  },
  {
    method: "GET",
    path: "/education/{category}", 
    handler: getEducationByCategoryHandler,
  },
];

module.exports = routes;
