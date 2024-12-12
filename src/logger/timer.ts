import { logger } from ".";
import { generateRandomId } from "../utils";

interface ITimerMap {
  [key: string]: {
    name: string;
    time: number;
  };
}

export class Timer {
  static _timemap: ITimerMap = {};
  static start(name: string) {
    const randomKey = generateRandomId();
    // check process.hrtime use here: https://nodejs.org/dist/latest-v18.x/docs/api/process.html#processhrtimetime
    // Note: using depricated version to not introduce bigint and their string conversion --- will check later if bigint will cause perf issue or not
    this._timemap[randomKey] = {
      name,
      time: Date.now(),
    };

    return randomKey;
  }
  static stop(key: string, info: object = {}) {
    if (!(key in this._timemap)) return;
    const keyData = this._timemap[key];
    const timepassed = Date.now() - keyData.time;
    delete this._timemap[key];
    logger.info({
      level: "time",
      message: `time for running ${keyData.name} is ${timepassed} ms`,
      time: timepassed,
      operationName: keyData.name,
      type: "TIMER", // will replace by info object if this key is present in it
      ...info,
    });
    return timepassed;
  }
}
