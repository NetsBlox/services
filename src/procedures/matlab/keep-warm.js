const { setTimeout, setInterval, clearInterval } = require("../../timers");
const seconds = 1000;
const minutes = 60 * seconds;

/**
 * This is made to "keep the matlab cluster warm" and prevent worker nodes from being
 * released back to the cluster. This class takes an action and, once started, call it
 * on a given interval for a specified duration.
 *
 * Essentially, it is a stateful setInterval w/ an end duration that restarts on each call
 *
 * Please use responsibly.
 */
class KeepWarm {
  constructor(action, interval = 10 * seconds) {
    this.action = action;
    this.interval = interval;
    this.currentInterval = null;
  }

  async keepWarm(duration = 15 * minutes) {
    this.stop();
    const intervalId = setInterval(this.action, this.interval);
    this.currentInterval = intervalId;
    setTimeout(() => {
      if (this.currentInterval === intervalId) {
        this.stop();
      }
    }, duration);
  }

  stop() {
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
  }

  isStillWarm() {
    return !!this.currentInterval;
  }
}

module.exports = KeepWarm;
