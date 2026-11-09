import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TimedSpeech } from '../client/timed-speech.js';

function clock() {
  let now = 0, nextId = 0;
  const jobs = new Map();
  return {
    setTimeout(callback, delay) {
      const id = ++nextId;
      jobs.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { jobs.delete(id); },
    get size() { return jobs.size; },
    callbacks() { return [...jobs.values()].map(job => job.callback); },
    advance(milliseconds) {
      const end = now + milliseconds;
      for (;;) {
        const next = [...jobs].filter(([, job]) => job.at <= end)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        const [id, job] = next;
        jobs.delete(id);
        now = job.at;
        job.callback();
      }
      now = end;
    }
  };
}

function setup(options = {}) {
  const timers = clock();
  const element = { textContent: 'previous text' };
  const calls = [];
  const speech = new TimedSpeech(element, {
    timers,
    reducedMotion: false,
    onStart: text => calls.push(['start', text]),
    onComplete: text => calls.push(['complete', text]),
    ...options
  });
  return { timers, element, calls, speech };
}

test('speech waits briefly, reveals Unicode code points at 40 per second, and stays visible', () => {
  const { timers, element, calls, speech } = setup();
  speech.speak('A🦉B');
  assert.equal(speech.pending, true);
  assert.equal(speech.isTyping, false);
  assert.equal(element.textContent, '');
  timers.advance(449);
  assert.deepEqual(calls, []);
  assert.equal(element.textContent, '');
  timers.advance(1);
  assert.equal(element.textContent, 'A');
  assert.equal(speech.pending, false);
  assert.equal(speech.isTyping, true);
  timers.advance(25);
  assert.equal(element.textContent, 'A🦉');
  timers.advance(25);
  assert.equal(element.textContent, 'A🦉B');
  assert.equal(speech.isTyping, false);
  assert.equal(timers.size, 0);
  timers.advance(60_000);
  assert.equal(element.textContent, 'A🦉B', 'Completed speech never hides or advances itself');
  assert.deepEqual(calls, [['start', 'A🦉B'], ['complete', 'A🦉B']]);
});

test('quick replacement cancels delayed and mid-reveal callbacks, including stale queued work', () => {
  const { timers, element, calls, speech } = setup();
  speech.speak('Old delayed speech');
  const oldDelay = timers.callbacks()[0];
  speech.speak('New words', { delay: 0 });
  const oldTick = timers.callbacks()[0];
  assert.equal(element.textContent, 'N');
  speech.speak('Final', { delay: 100 });
  oldDelay();
  oldTick();
  assert.equal(element.textContent, '');
  assert.equal(timers.size, 1, 'Stale callbacks cannot clear the replacement timer');
  timers.advance(200);
  assert.equal(element.textContent, 'Final');
  assert.equal(speech.targetText, 'Final');
  assert.deepEqual(calls, [['start', 'New words'], ['start', 'Final'], ['complete', 'Final']]);
});

test('complete during the initial delay reveals the full text and calls completion only once', () => {
  const { timers, element, calls, speech } = setup();
  speech.speak('The gate can wait.');
  speech.complete();
  speech.complete();
  timers.advance(10_000);
  assert.equal(element.textContent, 'The gate can wait.');
  assert.equal(speech.pending, false);
  assert.equal(speech.isTyping, false);
  assert.equal(timers.size, 0);
  assert.deepEqual(calls, [['start', 'The gate can wait.'], ['complete', 'The gate can wait.']]);
});

test('cancel preserves currently visible text without completing, and clear explicitly removes it', () => {
  const { timers, element, calls, speech } = setup();
  speech.speak('Unfinished', { delay: 0 });
  const staleTick = timers.callbacks()[0];
  speech.cancel();
  speech.complete();
  staleTick();
  timers.advance(10_000);
  assert.equal(element.textContent, 'U');
  assert.equal(speech.targetText, 'Unfinished');
  assert.equal(speech.pending, false);
  assert.equal(speech.isTyping, false);
  assert.equal(timers.size, 0);
  assert.deepEqual(calls, [['start', 'Unfinished']]);
  speech.cancel({ clear: true });
  assert.equal(element.textContent, '');
});

test('navigation cancellation during the delay never starts or restores old speech', () => {
  const { timers, element, calls, speech } = setup();
  speech.speak('An old encounter');
  const staleDelay = timers.callbacks()[0];
  speech.cancel({ clear: true });
  staleDelay();
  timers.advance(10_000);
  assert.equal(element.textContent, '');
  assert.equal(timers.size, 0);
  assert.deepEqual(calls, []);
});

test('reduced motion and explicit instant speech skip every delay and reveal in full', () => {
  for (const options of [{ reducedMotion: true }, { reducedMotion: () => true }, {}]) {
    const { timers, element, calls, speech } = setup(options);
    speech.speak('Read at your pace.', { instant: !options.reducedMotion });
    assert.equal(element.textContent, 'Read at your pace.');
    assert.equal(speech.pending, false);
    assert.equal(speech.isTyping, false);
    assert.equal(timers.size, 0);
    assert.deepEqual(calls, [['start', 'Read at your pace.'], ['complete', 'Read at your pace.']]);
  }
});

test('a live reduced-motion preference is checked again during the delay and reveal', () => {
  let reduce = false;
  const { timers, element, calls, speech } = setup({ reducedMotion: () => reduce });
  speech.speak('Waiting');
  reduce = true;
  timers.advance(450);
  assert.equal(element.textContent, 'Waiting');
  reduce = false;
  speech.speak('Thinking', { delay: 0 });
  assert.equal(element.textContent, 'T');
  reduce = true;
  timers.advance(25);
  assert.equal(element.textContent, 'Thinking');
  assert.equal(timers.size, 0);
  assert.deepEqual(calls.filter(([kind]) => kind === 'complete'), [['complete', 'Waiting'], ['complete', 'Thinking']]);
});

test('replay restarts the latest speech with its original options, even after cancellation', () => {
  const { timers, element, calls, speech } = setup();
  speech.replay();
  assert.equal(timers.size, 0, 'There is nothing to replay before the first speech');
  speech.speak('Go', { delay: 100 });
  timers.advance(125);
  speech.replay();
  assert.equal(element.textContent, '');
  timers.advance(99);
  assert.equal(element.textContent, '');
  timers.advance(26);
  assert.equal(element.textContent, 'Go');
  speech.cancel({ clear: true });
  speech.replay();
  speech.complete();
  assert.deepEqual(calls, Array.from({ length: 3 }, () => [['start', 'Go'], ['complete', 'Go']]).flat());
});

test('all speech, including markup, is written exclusively as textContent', () => {
  const element = {
    textContent: '',
    set innerHTML(_) { assert.fail('Speech must never assign HTML'); }
  };
  const speech = new TimedSpeech(element);
  speech.speak('<img src=x onerror=alert(1)>', { instant: true });
  assert.equal(element.textContent, '<img src=x onerror=alert(1)>');
});

test('callbacks can replace or cancel speech without letting its previous run resume', () => {
  const { timers, element, calls, speech } = setup();
  speech.onStart = text => {
    calls.push(['start', text]);
    if (text === 'Old') speech.speak('Replacement', { instant: true });
  };
  speech.speak('Old', { delay: 0 });
  timers.advance(10_000);
  assert.equal(element.textContent, 'Replacement');
  assert.deepEqual(calls, [['start', 'Old'], ['start', 'Replacement'], ['complete', 'Replacement']]);
  speech.onStart = () => speech.cancel({ clear: true });
  speech.speak('Cancel at start', { instant: true });
  assert.equal(element.textContent, '');
  assert.equal(timers.size, 0);
});
