const { DataTypes } = require("sequelize");
const sequelize = require("../config/database"); 

const News = sequelize.define(
  "News",
  {
    id: {
      type: DataTypes.STRING(16), 
      primaryKey: true, 
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255), 
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT, 
      allowNull: false,
    },
    imageUrl: {
      type: DataTypes.STRING(2048), 
      allowNull: false,
    },
  },
  {
    tableName: "news",
    timestamps: true,
    freezeTableName: true,
  }
);

module.exports = News;
