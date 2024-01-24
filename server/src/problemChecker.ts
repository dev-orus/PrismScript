import { execSync, exec } from "child_process";
import { dir } from "console";
import { writeFileSync, unlinkSync } from "fs";
import { dirname, join } from "path";

// let id = Math.floor(Math.random() * 1000);

type errList = {
  problems:
    | [
        {
          type: string;
          ln: number;
          col: number;
          msg: string;
        }
      ]
    | any;
  errCount: number;
  warnCount: number;
  infoCount: number;
};

function checkCode(code: string): Promise<[string, errList]> {
  return new Promise((res) => {
    const tempFilePath = join(dirname(dirname(__dirname)), "temp", `temp.py`);
    writeFileSync(tempFilePath, code);
    exec(`pyright ${tempFilePath}`, (error, stdout, stderr) => {
      if (error) {
        res([tempFilePath, parsePythonError(stdout)]);
      } else {
        res([
          tempFilePath,
          { problems: [], errCount: 0, warnCount: 0, infoCount: 0 },
        ]);
      }
    });
  });
}

function parsePythonError(errorMessage: string): errList {
  const lines = errorMessage.split("\n");
  const problems = [];
  let errCount = 0;
  let warnCount = 0;
  let infoCount = 0;

  for (const line of lines) {
    const match = line.match(/^(.+):(\d+):(\d+) - (.+): (.+)$/);
    if (match) {
      const [, file, ln, col, type, err] = match;
      const errorType = type.toLowerCase().includes("warning") ? "warn" : "err";

      const errorObj = {
        type: errorType,
        ln: parseInt(ln),
        col: parseInt(col),
        msg: err.trim(),
      };
      // if (!err.includes('indent'))
      problems.push(errorObj);

      if (errorType === "err") {
        errCount++;
      } else {
        warnCount++;
      }
    }
  }

  return {
    problems,
    errCount,
    warnCount,
    infoCount,
  };
}

export { checkCode, errList };
