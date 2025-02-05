const { DataTypes } = require("sequelize");
module.exports = (sequelize, Sequelize) => {
  const Game = sequelize.define(
    "Game",
    {
      Id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      creationDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      playersNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      capacity: {
        type: Sequelize.INTEGER,
      },
      status: {
        type: DataTypes.ENUM("pending", "active", "finished"),
        allowNull: false,
        defaultValue: "pending",
      },
      boardId: {
        type: Sequelize.INTEGER,
        references: {
          model: "Board",
          key: "boardId",
        },
      },
      currentPlayer: {
        type: Sequelize.INTEGER,
        references: {
          model: "User",
          key: "userId",
        },
      },
      lastPlayTime:{
        type: Sequelize.DATE,
        allowNull: false,
      }
    },
    {
      tablaName: "games",
    }
  );

  return Game;
};
