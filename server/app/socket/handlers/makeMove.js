const { where } = require("sequelize");
const db = require("../../models");
const Game = db.Game;
const GP = db.GamePlayer;
const ELEM = db.BoardElement;
const User = db.User;
const TIMEOUT_DURATION = 10000;
const makeMove = async (game_id, user, io) => {
  const rollDice = () => Math.ceil(Math.random() * 6);
  let gameID = parseInt(game_id);
  if (isNaN(gameID)) {
    return `failed parsing ${game_id}, make sure to include a proper gameID field`;
  }
  const dice = rollDice();
  let game = await Game.findOne({
    where: {
      Id: gameID,
    },
  });
  if (game && game.status.toUpperCase() === "ACTIVE") {
    const currentPlayer = game.currentPlayer;
    const authUserId = user.userId;
    if (authUserId !== currentPlayer) {
      return "No! Wait for your turn";
    }
    const boardId = game.boardId;
    const gp = await GP.findOne({
      where: { gameID: gameID, playerId: currentPlayer },
    });
    if (!gp) {
      return;
    }
    const oldPosition = gp.lastPosition;
    const currentOrder = gp.order;
    const nextOrder = (currentOrder % game.playersNumber) + 1;
    const nextGp = await GP.findOne({
      where: { gameID: gameID, order: nextOrder },
    });

    let newPos = dice + oldPosition;
    let gameStatus = "ACTIVE";
    if (newPos <= 100) {
      const elem = await ELEM.findOne({
        where: { boardId: boardId, from: newPos },
      });
      if (elem) {
        newPos = elem.to;
      }
      await GP.update(
        {
          lastPosition: newPos,
        },
        {
          where: { playerId: currentPlayer },
        }
      );
      if (newPos == 100) {
        gameStatus = "FINISHED";
        await Game.update(
          {
            status: "FINISHED",
          },
          {
            where: { Id: gameID },
          }
        );
      }
    }

    const t = Date.now();
    await Game.update(
      {
        currentPlayer: nextGp.playerId,
        lastPlayTime: t,
      },
      {
        where: { Id: gameID },
      }
    );
    setTimeout(
      async (t, gameID) => {
        const g = await Game.findOne({ where: { Id: gameID } });
        console.log(g);
        if (!g) {
          return;
        }
        const lastPlay = g.lastPlayTime;
        if (
          lastPlay &&
          new Date(t).toISOString().slice(0, -4) ===
            lastPlay.toISOString().slice(0, -4)
        ) {
          console.log("the bot is playing");
          makeMove(
            gameID,
            {
              userId: nextGp.playerId,
            },
            io
          ).then((update) => {
            io.in("team-C room-" + String(gameID)).emit("turn-update", update);
            console.log("the bot just played");
          });
        } else {
          console.log("the bot is sad :(");
        }
      },
      TIMEOUT_DURATION,
      t,
      gameID
    );

    let Players = await User.findAll({
      include: [
        {
          model: GP,
          required: true,
          attributes: ["color", "lastPosition", "order"],
          foreignKey: {
            name: "playerId", // Name of the foreign key column in the User model
          },
          where: { gameID: gameID },
        },
      ],
      attributes: ["userId", "userName"],
    });

    Players = Players.map((p) => {
      return {
        name: p.userName,
        color: p.GamePlayer.color,
        position: p.GamePlayer.lastPosition,
        order: p.GamePlayer.order,
        id: p.userId,
      };
    });

    Players.sort((a, b) => a.order - b.order);

    let last_player_index = Players.findIndex((p) => p.id === currentPlayer);
    let next_player_index = Players.findIndex((p) => p.id === nextGp.playerId);

    if (last_player_index == -1) {
      last_player_index = 0;
    }
    if (last_player_index == -1) {
      next_player_index = 0;
    }

    return {
      game_status: gameStatus,
      pending_player_index: next_player_index,
      lastPlayTime: t,
      move: {
        player_index: last_player_index,
        dice_outcome: dice,
        from: oldPosition,
        to: newPos,
      },
    };
  } else {
    return "No such on-going game exists";
  }
};
module.exports = makeMove;
