// pausable timers - required for testing
function newScope() {
  const timers = [];
  let timersStopped = false;

  function setTimeout(callback, delay = 0) {
    let timer;
    const cb = () => {
      const index = timers.findIndex((t) => t === timer);
      timers.splice(index, 1);
      return callback();
    };
    timer = new Timer(cb, delay);
    timers.push(timer);

    if (!timersStopped) {
      timer.start();
    }
    return timer;
  }

  function setInterval(callback, delay = 0) {
    let timer;
    let cb = () => {
      callback();
      // restart the timer
      timers.push(timer);
      timer.reset(delay);
    };
    timer = setTimeout(cb, delay);
    return timer;
  }

  function clearInterval(timer) {
    return clearTimeout(timer);
  }

  function clearTimeout(timer) {
    timer.pause();
    const index = timers.findIndex((t) => t === timer);
    timers.splice(index, 1);
  }

  function stopTimers() {
    timersStopped = true;
    timers.forEach((timer) => timer.pause());
  }

  function startTimers() {
    timersStopped = false;
    timers.forEach((timer) => timer.start());
  }

  function clearTimers() {
    timers.splice(0, timers.length);
  }

  function sleep(duration) {
    return new Promise((resolve) => setTimeout(resolve, duration));
  }

  return {
    setTimeout,
    setInterval,
    clearTimeout,
    clearInterval,
    sleep,

    stopTimers,
    startTimers,
    clearTimers,
  };
}

class Timer {
  constructor(callback, delay) {
    this.callback = callback;
    this.delay = delay;

    this.startTime = null;
    this.id = null;
  }

  pause() {
    global.clearTimeout(this.id);
    this.id = null;
    const endTime = this.startTime + this.delay;
    this.delay = endTime - Date.now();
  }

  start() {
    if (!this.id) {
      this.id = global.setTimeout(this.callback, this.delay);
      this.startTime = Date.now();
    }
  }

  reset(delay) {
    this.pause();
    this.delay = delay;
    this.start();
  }
}

const globalScope = newScope();
globalScope.newScope = newScope;

module.exports = globalScope;
