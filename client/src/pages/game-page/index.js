import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import cloneDeep from "lodash/cloneDeep";
import styles from "./styles.module.css";
import "./style.css";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import * as io from "../../socket/socket";
import axios from "axios";
import boards from "../../boards";

function Game() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [progress, setProgress] = React.useState(0);
  const [gameId, setGameId] = useState(null);
  let [game, setGame] = useState(null);
  let [turnUpdate, setturnUpdate] = useState(null);
  const [msg, setMsg] = useState("The game is Loading");
  let diceRef = useRef(null);
  let rollRef = useRef(null);
  let [timer, setTimer] = useState(Date.now());
  let [lastPlayTime, setLastPlayTime] = useState(Date.now());
  const [t, setT] = useState(false);

  useEffect(() => {
    const headers = {
      "x-access-token": sessionStorage.getItem("authenticated"),
    };
    axios
      .get(`/currentGame`, { headers: headers })
      .then((res) => {
        console.log("RESPONSE RECEIVED: ", res);
        setGameId(res.data.Id);
      })
      .catch((err) => {
        console.log("AXIOS ERROR: ", err);
        navigate("/");
      });
  }, []);
  useEffect(() => {
    if (gameId) {
      io.subscribeToRoom(gameId, handleTurnUpdate, handleRoomUpdate);
    }
  }, [gameId]);

  useEffect(() => {
    if (
      game &&
      game.game_status.toLowerCase() === "active" &&
      (timer - lastPlayTime) / 1000.0 <= 10
    ) {
      setProgress((timer - lastPlayTime) / 1000.0);
    }
  }, [timer]);

  useEffect(() => {
    if (game) {
      let x = { ...game };
      x.game_status = turnUpdate?.game_status;
      x.pending_player_index = turnUpdate?.pending_player_index;
      x.lastPlayTime = turnUpdate?.pending_player_index;
      if (
        x.players[turnUpdate?.move.player_index].position &&
        turnUpdate?.move.to <= 100
      ) {
        x.players[turnUpdate?.move.player_index].position = turnUpdate?.move.to;
        setMsg(
          `It's ${x.players[turnUpdate?.pending_player_index].name}'s turn`
        );
        setGame(x);
      }
      if (!t) {
        setInterval(() => {
          // if (game && game.game_status.toLowerCase() === "active") {
          setTimer((p) => p + 1000);
          // }
        }, 1000);
        setT(true);
      }
    }
  }, [turnUpdate]);

  const handleTurnUpdate = (gameTurnObject) => {
    if (typeof gameTurnObject === "string") {
      setMsg(gameTurnObject);
      return;
    }
    rollDice(gameTurnObject.move.dice_outcome);
    setTimeout(() => {
      setturnUpdate(gameTurnObject);
    }, 1000);
    const { lastPlayTime } = gameTurnObject;
    setLastPlayTime(lastPlayTime);
    setTimer(lastPlayTime);
  };

  const handleRoomUpdate = (gameObject) => {
    if (typeof gameObject === "string") {
      setMsg(gameObject);
      return;
    }
    if (
      gameObject?.players?.length <= 1 &&
      gameObject?.game_status.toLowerCase() !== "pending"
    ) {
      navigate("/");
    } else {
      setGame(gameObject);
    }
  };
  function rollDice(elComeOut) {
    var elDiceOne = diceRef?.current;
    if (elDiceOne) {
      for (let i = 1; i <= 6; i++) {
        elDiceOne.classList.remove("show-" + i);
        if (elComeOut == i) {
          elDiceOne.classList.add("show-" + i);
        }
      }
    }
  }
  const pos = (pos_1) => {
    const pos_0 = pos_1 - 1;
    const y = 9 - Math.floor(pos_0 / 10);
    let x = pos_0 % 10;
    if (y % 2 == 0) {
      x = 9 - x;
    }
    return { x, y };
  };
  useEffect(() => {
    //
    if (diceRef.current && rollRef.current && canvasRef.current && game) {
      drawCanvas(game);
      var elComeOut = rollRef.current;

      elComeOut.onclick = function () {
        io.rollDice(gameId);
      };
    }
  }, [diceRef.current, rollRef.current, canvasRef.current, game]);
  useEffect(() => {
    if (turnUpdate && turnUpdate.move.to <= 100) {
      const { from, to, dice_outcome, player_index } = turnUpdate.move;
      let newPlayersObject = [...game.players];
      if (
        player_index < newPlayersObject.length &&
        newPlayersObject[player_index]
      ) {
        newPlayersObject[player_index].position = from + dice_outcome;
      }
      let gameObject = {
        ...game,
        pending_player_index: turnUpdate.pending_player_index,
        players: [...newPlayersObject],
      };
      if (newPlayersObject[player_index].position <= 100) {
        drawCanvas(gameObject);
      }
      if (from + dice_outcome != to && from + dice_outcome <= 100) {
        setTimeout(() => {
          if (
            player_index < gameObject.players.length &&
            gameObject.players[player_index]
          ) {
            gameObject.players[player_index].position = to;
          }
          drawCanvas(game);
        }, 500);
      }
    }
  }, [turnUpdate]);

  let drawCanvas = (game) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    //img.src = `./assets/board${game.board_id}.jpg`;
    img.src = boards[game.board_id - 1];
    img.onload = function () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const cellW = canvas.width / 10.0;
      const cellH = canvas.height / 10.0;
      //draw pieces:
      for (const p of game.players) {
        if (p?.position === 0) {
          continue;
        }
        const { x, y } = pos(p.position);

        ctx.beginPath();
        ctx.arc(
          x * cellW + cellW / 2.0,
          y * cellH + cellH / 2.0,
          cellW / 3.0,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = "white";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(
          x * cellW + cellW / 2.0,
          y * cellH + cellH / 2.0,
          cellW / 3.3,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    };
  };

  const leaveGame = (e) => {
    e.preventDefault();
    const headers = {
      "x-access-token": sessionStorage.getItem("authenticated"),
    };
    axios
      .post(`/leaveGame`, { gameId: parseInt(gameId) }, { headers: headers })
      .then((res) => {
        console.log("RESPONSE RECEIVED: ", res);
        window.location.reload(true);
      })
      .catch((err) => {
        console.log("AXIOS ERROR: ", err);
      });
  };

  return (
    <>
      {!game ? null : (
        <div className={styles.gameContainer}>
          <div className={styles.playersList}>
            <table className={styles.playersTable}>
              <thead>
                <th>Player</th>
                <th>Position</th>
              </thead>
              <tbody>
                {game?.players?.map((player) => (
                  <tr
                    className={styles.player}
                    style={{
                      color:
                        player?.name ==
                        game.players[game?.pending_player_index]?.name
                          ? "rgb(141, 206, 206)"
                          : "black",
                    }}
                  >
                    <td>
                      <div>{player?.name}</div>
                      <div
                        className={styles.playerColor}
                        style={{ backgroundColor: player?.color }}
                      ></div>
                    </td>
                    <td>{player?.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <canvas ref={canvasRef} width={749} height={749} />

          <div className={styles.timerDiceContainer}>
            <button className="leaveGame" onClick={(e) => leaveGame(e)}>
              Leave
            </button>
            <div className="msg" id="msssg">
              {msg}
            </div>
            <div className={styles.timer}>
              <Box sx={{ position: "relative", display: "inline-flex" }}>
                <CircularProgress
                  variant="determinate"
                  value={(progress / 10) * 100}
                  style={{
                    width: "150px",
                    height: "150px",
                    color: "rgb(141, 206, 206)",
                    backgroundColor: "#fff",
                    borderRadius: "50%",
                  }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: "absolute",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography
                    variant="caption"
                    component="div"
                    color="text.secondary"
                    style={{
                      fontSize: "4rem",
                      color: "black",
                      fontFamily: "Bungee",
                    }}
                  >
                    {`${progress}`}
                  </Typography>
                </Box>
              </Box>
            </div>

            <div ref={rollRef}>
              <div className="dice dice-one" ref={diceRef}>
                <div id="dice-one-side-one" className="side one">
                  <div className="dot one-1"></div>
                </div>
                <div id="dice-one-side-two" className="side two">
                  <div className="dot two-1"></div>
                  <div className="dot two-2"></div>
                </div>
                <div id="dice-one-side-three" className="side three">
                  <div className="dot three-1"></div>
                  <div className="dot three-2"></div>
                  <div className="dot three-3"></div>
                </div>
                <div id="dice-one-side-four" className="side four">
                  <div className="dot four-1"></div>
                  <div className="dot four-2"></div>
                  <div className="dot four-3"></div>
                  <div className="dot four-4"></div>
                </div>
                <div id="dice-one-side-five" className="side five">
                  <div className="dot five-1"></div>
                  <div className="dot five-2"></div>
                  <div className="dot five-3"></div>
                  <div className="dot five-4"></div>
                  <div className="dot five-5"></div>
                </div>
                <div id="dice-one-side-six" className="side six">
                  <div className="dot six-1"></div>
                  <div className="dot six-2"></div>
                  <div className="dot six-3"></div>
                  <div className="dot six-4"></div>
                  <div className="dot six-5"></div>
                  <div className="dot six-6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Game;
