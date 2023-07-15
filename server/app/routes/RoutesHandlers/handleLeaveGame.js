const db = require("../../models");
const fetchTurn = require("../../socket/handlers/fetchTurn");
const GamePlayer = db.GamePlayer;
const Game = db.Game;
require("dotenv").config();

const handleLeaveGame = (socket) => {
  return async (req, res, next) => {
    const playerId = req.user.userId;
    const { gameId } = req.body;
    try {
      let player = await GamePlayer.findOne({ where: { playerId, gameId } });
      if (!player) throw new Error("Player Not in The Game");
      let game = await Game.findByPk(gameId);
      if (!game) throw new Error("Game Doesn't Exist");

      if (game.currentPlayer === parseInt(playerId)) {
        const currentOrder = player.order;
        const nextOrder = (currentOrder % game.playersNumber) + 1;
        const nextGp = await GamePlayer.findOne({
          where: { gameID: gameId, order: nextOrder },
        });
        if (!nextGp) throw new Error("Can't find next player in order");
        await Game.update(
          {
            currentPlayer: nextGp.playerId,
          },
          {
            where: { Id: gameId },
          }
        );
      }
      let num = await Game.update(
        { playersNumber: game.playersNumber - 1 },
        { where: { Id: gameId } }
      );
      if (num != 1) throw new Error("Can't Update Game");
      console.log(player);
      let gamePlayers = await GamePlayer.findAll({ where: { gameId } });
      for (const playerr of gamePlayers) {
        console.log(playerr, "mmmm");
        if (playerr.order > player.order) {
          await GamePlayer.update(
            { order: playerr.order - 1 },
            { where: { gameId: gameId, playerId: playerr.playerId } }
          );
        }
      }
      await GamePlayer.destroy({ where: { playerId } });
      if (gamePlayers.length <= 1 && game.status.toLowerCase() != "pending") {
        let num = await Game.update(
          { status: "finished" },
          { where: { Id: gameId } }
        );
        GamePlayer.destroy({ where: { gameId: gameId } });
        if (num != 1) throw new Error("Can't Update Game");
      }
      res.status(200).send("Done");

      fetchTurn(gameId).then((data) => {
        socket
          .in(process.env.ROOMPREFIX + String(gameId))
          .emit("room-update", data);
      });
    } catch (e) {
      next(e);
    }
  };
};

module.exports.create = handleLeaveGame;
