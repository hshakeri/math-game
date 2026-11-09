/**
 * Silent speech reveal for still character panels. Safe to import without a DOM.
 * Text stays visible until replaced or explicitly cleared; this never advances play.
 */
export class TimedSpeech {
  constructor(element, {
    onComplete,
    onStart,
    reducedMotion = () => typeof globalThis.matchMedia === 'function'
      && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
    timers
  } = {}) {
    this.el = element;
    this.onComplete = onComplete;
    this.onStart = onStart;
    this.reducedMotion = reducedMotion;
    this.timers = timers || {
      setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
      clearTimeout: id => globalThis.clearTimeout(id)
    };
    this.targetText = '';
    this.pending = false;
    this.isTyping = false;
    this._run = null;
    this._timer = null;
    this._lastOptions = null;
  }

  /** Replace any pending speech. Callbacks receive the full text, once per run. */
  speak(text, { delay = 450, instant = false } = {}) {
    this.cancel();
    this.targetText = String(text ?? '');
    this._lastOptions = {
      delay: Number.isFinite(delay) ? Math.max(0, delay) : 450,
      instant: Boolean(instant)
    };
    const run = {
      text: this.targetText,
      characters: Array.from(this.targetText),
      index: 0,
      started: false,
      completed: false
    };
    this._run = run;
    this._write('');

    if (instant || this._reduceMotion() || !run.characters.length) {
      this.complete();
    } else if (this._lastOptions.delay === 0) {
      this._start(run);
    } else {
      this.pending = true;
      this._schedule(run, () => this._start(run), this._lastOptions.delay);
    }
    return this;
  }

  /** Skip both the initial delay and the remaining reveal; harmless when repeated. */
  complete() {
    const run = this._run;
    if (!run || run.completed) return this;
    this._clearTimer();
    this.pending = false;
    this.isTyping = false;
    if (!this._notifyStart(run)) return this;
    this._write(run.text);
    run.completed = true;
    if (typeof this.onComplete === 'function') this.onComplete(run.text);
    return this;
  }

  /** Cancel without completing or calling callbacks. Keep the latest text for replay. */
  cancel({ clear = false } = {}) {
    this._run = null;
    this._clearTimer();
    this.pending = false;
    this.isTyping = false;
    if (clear) this._write('');
    return this;
  }

  /** Repeat the latest text with its original delay and instant option. */
  replay() {
    if (this._lastOptions) this.speak(this.targetText, this._lastOptions);
    return this;
  }

  _reduceMotion() {
    return typeof this.reducedMotion === 'function'
      ? Boolean(this.reducedMotion())
      : Boolean(this.reducedMotion);
  }

  _write(text) {
    if (this.el) this.el.textContent = text;
  }

  _clearTimer() {
    if (this._timer !== null) {
      this.timers.clearTimeout(this._timer);
      this._timer = null;
    }
  }

  _schedule(run, callback, delay) {
    this._timer = this.timers.setTimeout(() => {
      // A queued callback may survive cancellation in a host or test scheduler.
      if (this._run !== run || run.completed) return;
      this._timer = null;
      callback();
    }, delay);
  }

  _notifyStart(run) {
    if (!run.started) {
      run.started = true;
      if (typeof this.onStart === 'function') this.onStart(run.text);
    }
    // A callback can itself cancel, replace or instantly complete the speech.
    return this._run === run && !run.completed;
  }

  _start(run) {
    if (this._run !== run || run.completed) return;
    this.pending = false;
    this.isTyping = true;
    if (this._notifyStart(run)) this._tick(run);
  }

  _tick(run) {
    if (this._run !== run || run.completed) return;
    if (this._reduceMotion()) {
      this.complete();
      return;
    }
    run.index += 1;
    this._write(run.characters.slice(0, run.index).join(''));
    if (run.index === run.characters.length) this.complete();
    else this._schedule(run, () => this._tick(run), 25); // Silent 40 characters/second.
  }
}
