import React, { useEffect, useRef } from "react";
import { getRandomValue } from "src/utils";
import {
  Engine,
  Render,
  Bodies,
  Composite,
  Runner,
  Events,
  Body,
  Svg,
} from "matter-js";
import decomp from "poly-decomp";
window.decomp = decomp;

// constants
const GAP = 25;
const NUMBER_OF_ROWS = 16;
const INITIAL_NUMBER_OF_NAILS = 3;
const NUMBER_OF_BASE = 17;
const NAIL_RADIUS = 9;
const SCORE_LIST = [
  120, 40, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 40, 120,
];
const X_FLOAT = 200;
const Y_FLOAT = 200;

//获取钉子位置
const getLoc = () => {
  const lastRowNail = INITIAL_NUMBER_OF_NAILS + NUMBER_OF_ROWS - 1;
  const loc = [];

  const initLoc = { x: (GAP * lastRowNail + 600) / 2, y: 50 };
  for (let i = 0; i < NUMBER_OF_ROWS; i++) {
    const currentNum = INITIAL_NUMBER_OF_NAILS + i;
    for (let j = 0; j < currentNum; j++) {
      loc.push({
        x: initLoc.x - (currentNum - 1) * GAP + j * GAP * 2,
        y: initLoc.y + i * GAP * 2,
        row: i,
      });
    }
  }
  return loc;
};

const Game = () => {
  const canvasRef = useRef(null);
  const [isFirstTime, setIsFirstTime] = React.useState(true);
  const [gameStart, setGameStart] = React.useState(false);
  const [result, setResult] = React.useState(0);
  const [groundLocDom, setGroundLocDom] = React.useState([]);
  const [textLoc, setTextLoc] = React.useState([]);

  //matterjs元素及逻辑
  useEffect(() => {
    let timer;

    // 创建一个引擎
    const engine = Engine.create();

    //获取钉子位置
    const nailsLoc = getLoc();
    const groundLoc = [];
    const renderSize = calculateRenderSize(nailsLoc, X_FLOAT, Y_FLOAT);

    // 创建一个渲染器
    const render = Render.create({
      element: canvasRef.current, // 通过ref获取Canvas元素
      engine: engine,
      options: {
        width: renderSize.width, // 设置渲染器宽度为视口宽度
        height: renderSize.height, // 设置渲染器高度为视口高度
        wireframes: false, // 关闭线框模式
        background: "rgba(0, 0, 0, 0)",
      },
    });

    //创建弹球
    const ball = Bodies.circle(
      renderSize.width / getRandomValue(1.9, 2.1),
      -20,
      12,
      {
        restitution: 0.6, // 弹性
        render: {
          fillStyle: "#FF7377", // 填充样式
        },
      }
    );

    // 创建地面
    const baseWidth = calculateBaseWidth(nailsLoc, NUMBER_OF_BASE);
    const paths = document.querySelectorAll("path");
    for (let i = 0; i < NUMBER_OF_BASE; i++) {
      const colorGap = 100 / Math.ceil(NUMBER_OF_BASE / 2);
      const color = `rgb(0, ${
        250 - Math.abs(i - Math.ceil(NUMBER_OF_BASE / 2)) * colorGap
      }, 154)`;
      //更新地面位置
      groundLoc.push({
        index: i + 1,
        x: Math.min(...nailsLoc.map((item) => item.x)) + i * baseWidth,
        y: nailsLoc[nailsLoc.length - 1].y + 70,
      });
      const ground = generateBase(
        paths,
        Math.min(...nailsLoc.map((item) => item.x)),
        i * baseWidth,
        nailsLoc[nailsLoc.length - 1].y + 70,
        baseWidth,
        color
      );
      Composite.add(engine.world, [...ground]);
    }

    setGroundLocDom(groundLoc);

    // 将所有物体添加到世界中
    Composite.add(engine.world, [...generateNails(nailsLoc), ball]);

    // run the renderer
    Render.run(render);

    // create runner
    const runner = Runner.create();

    // run the engine
    gameStart && Runner.run(runner, engine);

    //监听游戏结束事件
    Events.on(engine, "beforeUpdate", () => {
      // 获取小球的线速度
      const velocity = ball.velocity;
      // 检查小球的线速度是否足够小
      const speedThreshold = 0.05; // 设置一个合适的速度阈值

      if (
        (Math.abs(velocity.x) < speedThreshold &&
          Math.abs(velocity.y) < speedThreshold &&
          ball.position.y > Math.max(...nailsLoc.map((item) => item.y)) + 50) ||
        ball.position.y > renderSize.height + 50
      ) {
        if (ball.position.y > renderSize.height) {
          setResult(-1);
        }

        // 游戏结束了
        for (let i = 0; i < groundLoc.length; i++) {
          if (
            ball.position.x > groundLoc[i].x &&
            ball.position.x < groundLoc[i].x + baseWidth
          ) {
            const ballIndex = groundLoc[i].index;
            setResult(SCORE_LIST[ballIndex]);
            break;
          }
        }

        timer = setTimeout(() => {
          setGameStart(false);
          Events.off(engine, "beforeUpdate");
        }, 1000);

        // 在这里可以执行其他操作，因为小球已经停止
      }
    });

    return () => {
      canvasRef.current.removeChild(render.canvas);
      Render.stop(render);
      Runner.stop(runner);
      Engine.clear(engine);
      Events.off(engine, "beforeUpdate");
      Composite.clear(engine.world);
      clearTimeout(timer);
    };
  }, [gameStart]);

  //监听窗口变化调整text位置
  useEffect(() => {
    const offsetBottom =
      window.innerHeight - canvasRef.current.getBoundingClientRect().bottom;

    const resizeText = () => {
      setTextLoc(
        groundLocDom.map((item) => {
          return {
            x: item.x + canvasRef.current.offsetLeft,
            y:
              canvasRef.current.offsetTop +
              getLoc()[getLoc().length - 1].y +
              78,
          };
        })
      );
    };

    resizeText();
    window.addEventListener("resize", resizeText);
    () => {
      window.removeEventListener("resize");
    };
  }, [groundLocDom]);

  const generateNails = (loc) => {
    return loc.map((item) => {
      return Bodies.circle(item.x, item.y, NAIL_RADIUS, {
        isStatic: true, // 非静态物体
        restitution: loc.row
          ? getRandomValue(0.4, 0.5)
          : getRandomValue(0.1, 0.2), // 弹性
        render: {
          fillStyle: "white", // 填充样式
        },
      });
    });
  };

  /**
   * Get Nails Location
   * @param {*} gap gap between nails
   * @param {*} rows rows of nails
   * @param {*} initNum initial number of nails on first row
   * @returns
   */

  const generateBase = (paths, initx, x, y, width, color) => {
    const baseBody = [];
    paths.forEach((path) => {
      let vertices = Svg.pathToVertices(path);
      if (vertices.length === 0) {
        return;
      }
      let svgBody = Bodies.fromVertices(initx, y, [vertices], {
        isStatic: true,
        render: {
          restitution: 0.6, // 弹性
          fillStyle: color,
          wireframes: false,
          lineWidth: 0,
        },
      });

      const scaleX = width / svgBody.bounds.max.x / 0.93;
      // const scaleY = height / svgBody.bounds.max.x;
      Body.scale(svgBody, scaleX, scaleX);
      Body.translate(svgBody, { x, y: 0 });
      baseBody.push(svgBody);
    });
    return baseBody;
  };

  const calculateBaseWidth = (nailsLoc, numberOfBase) => {
    const nailsLocX = nailsLoc.map((item) => item.x);
    const max = Math.max(...nailsLocX);
    const min = Math.min(...nailsLocX);
    return (max - min) / (numberOfBase - 1);
  };

  const calculateRenderSize = (nailsLoc, floatY, floatX) => {
    const nailsLocX = nailsLoc.map((item) => item.x);
    const maxX = Math.max(...nailsLocX);
    const minX = Math.min(...nailsLocX);

    const nailsLocY = nailsLoc.map((item) => item.y);
    const maxY = Math.max(...nailsLocY);
    const minY = Math.min(...nailsLocY);

    return {
      width: maxX - minX + floatX,
      height: maxY - minY + floatY,
    };
  };

  return (
    <>
      <div
        className={` min-h-screen h-full flex justify-center items-center relative bg-general bg-cover bg-center ${
          gameStart || "bg-gray-500 opacity-60 relative"
        }`}
      >
        <div ref={canvasRef} className={``}></div>

        {textLoc.map((item, i) => {
          return (
            <span
              className={`text-[20px] absolute text-white translate-x-[-50%] translate-y-[-50%]`}
              style={{
                left: `${item.x}px`,
                top: `${item.y}px`,
              }}
              key={i}
            >
              {SCORE_LIST[i]}
            </span>
          );
        })}
      </div>
      {gameStart || (
        <div className="fixed inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center justify-center space-y-2">
            {isFirstTime || (
              <div className="stat bg-white rounded-md">
                <div className="stat-title">Score: </div>
                <div className="stat-value">
                  {result !== -1 ? result + "x" : "Your ball flys away"}
                </div>
              </div>
            )}
            <button
              className="btn btn-error btn-lg text-white"
              onClick={() => {
                setGameStart(true);
                setIsFirstTime(false);
              }}
            >
              {isFirstTime ? "Start Game" : "Play Again"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Game;
