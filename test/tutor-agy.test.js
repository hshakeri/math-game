import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { callAdapter, buildPrompt, parseTutorResult, DEFAULT_MODEL, cancelAllAgyCalls } from '../server/tutor/agy.js';
import { generateTurn } from '../server/tutor/index.js';

const execFileAsync = promisify(execFile);
const line = 'We can keep your idea beside the inscription while we inspect the story. My notebook has room for the reasons behind your plan. Which detail would you check before taking the next step?';
const ctx = {
  encounterId: 'ch1-n1-reverse-tolls', partId: 'a', state: 'understand', rung: 'l0',
  childMessage: '[mode:normal]', childAction: 'say', publicHistory: [], allowedContent: { pool: [line] }
};
let fixtures, bin, calls;

before(async () => {
  fixtures = await mkdtemp(path.join(tmpdir(), 'keybreakers-agy-test-'));
  bin = path.join(fixtures, 'agy-fixture');
  calls = path.join(fixtures, 'calls.jsonl');
  // A real local subprocess exercises pipes, signals, cleanup and the exact
  // deny-hook code. It makes no model, HTTP or external service calls.
  await writeFile(bin, `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync,spawn} = require('node:child_process');
let input='';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const message=JSON.parse(input).message.content;
  const mode=message.match(/\\[mode:([a-z]+)\\]/)?.[1] || 'normal';
  const args=process.argv.slice(2), cwd=process.cwd();
  const settings=JSON.parse(args[args.indexOf('--settings')+1]);
  const model=args[args.indexOf('--model')+1];
  const hooks=JSON.parse(fs.readFileSync(path.join(cwd,'.agents/hooks.json'),'utf8'));
  const observation={pid:process.pid,cwd,args,settings,hooks,envKeys:Object.keys(process.env),message};
  fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({mode,pid:process.pid,cwd})+'\\n');
  const emit=value=>process.stdout.write(JSON.stringify(value)+'\\n');
  if(mode!=='noguard') execFileSync(process.execPath,[path.join(cwd,'.agents/guard.cjs'),'ready'],{input:'{}'});
  if(mode==='guarddeny') execFileSync(process.execPath,[path.join(cwd,'.agents/guard.cjs'),'deny'],{input:'{}'});
  if(mode!=='noinit') emit({event:'init',init:{cwd,model:mode==='wrongmodel'?'other-model':model,permission_mode:mode==='weak'?'always-proceed':'strict'}});
  if(mode==='tool') emit({event:'step_update',step_update:{step_type:'tool',tool_name:'run_command',state:'ACTIVE'}});
  if(mode==='malformed') {process.stdout.write('not protocol JSON\\n');return;}
  if(mode==='overflow') {process.stdout.write('x'.repeat(140000));return;}
  if(mode==='stderr') {process.stderr.write('do not expose PRIVATE-DIAGNOSTIC');process.exitCode=1;return;}
  if(mode==='hang') {setInterval(()=>{},1000);return;}
  if(mode==='helper') {
    const helper=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
    observation.helperPid=helper.pid; helper.unref();
  }
  const response=JSON.stringify({utterance:mode==='praise'?'Great work!':${JSON.stringify(line)}});
  const send=()=>emit({event:'result',result:{status:'SUCCESS',response,num_turns:1,observation}});
  if(mode==='hold') setTimeout(send,300);else send();
  if(mode==='duplicate') send();
});
`, { mode: 0o700 });
});

after(async () => { await rm(fixtures, { recursive: true, force: true }); });

test('AGY prompt is whitelisted and never includes local cursors, secrets or correctness fields', () => {
  const prompt = buildPrompt({ ...ctx, previousSpeech: 'previous-private-hint', sessionId: 'private-session', secret: 'SECRET',
    childAction: { type: 'say', correct: true }, allowedContent: { pool: [line], targetAnswer: 'HIDDEN' } }, 'Public tutor instructions.');
  assert.equal(/previous-private-hint|private-session|SECRET|HIDDEN|"correct"/.test(prompt), false);
  for (const key of ['answer', 'targetAnswer', 'forbidden', 'intermediates', 'isCorrect']) {
    assert.throws(() => buildPrompt({ ...ctx, [key]: 'private' }, ''), /Information diet violation/);
  }
});

test('final JSON parsing accepts one object and refuses ambiguity or extra fields', () => {
  assert.equal(parseTutorResult({ status: 'SUCCESS', response: JSON.stringify({ utterance: line }) }).speech, line);
  assert.equal(parseTutorResult({ status: 'SUCCESS', response: '```json\n' + JSON.stringify({ utterance: line }) + '\n```' }).speech, line);
  for (const response of ['{}{}', '[]', '{"utterance":42}', '{"utterance":"question?","command":"anything"}', 'plain text']) {
    assert.throws(() => parseTutorResult({ status: 'SUCCESS', response }), /JSON|object/);
  }
  assert.throws(() => parseTutorResult({ status: 'ERROR', response: '{}' }), /successful/);
});

test('actual subprocess receives stdin context, strict policy and deny hooks in an isolated deleted cwd', async t => {
  const old = process.env.KEYBREAKERS_SECRET_TEST;
  process.env.KEYBREAKERS_SECRET_TEST = 'never-inherit-this';
  t.after(() => { if (old === undefined) delete process.env.KEYBREAKERS_SECRET_TEST; else process.env.KEYBREAKERS_SECRET_TEST = old; });
  const input = '[mode:normal] literal $(touch should-never-execute)';
  const result = await callAdapter({ ...ctx, childMessage: input }, 'Public tutor instructions.', 3000, { bin });
  const observed = JSON.parse(result.raw).observation;
  assert.equal(result.parsed.utterance, line);
  assert.equal(observed.args.includes(input), false);
  assert.ok(observed.message.includes(input));
  assert.equal(observed.args.includes('--dangerously-skip-permissions'), false);
  assert.equal(observed.args[observed.args.indexOf('--print-timeout') + 1], '3s', 'CLI has its own timeout even if the parent exits');
  assert.equal(observed.settings.toolPermission, 'strict');
  assert.ok(observed.settings.permissions.deny.includes('read_file(*)'));
  assert.ok(observed.settings.permissions.deny.includes('command(*)'));
  assert.equal(observed.hooks['rivet-text-only'].PreToolUse[0].matcher, '*');
  assert.equal(observed.envKeys.includes('KEYBREAKERS_SECRET_TEST'), false);
  assert.equal(observed.envKeys.includes('GEMINI_API_KEY'), false);
  assert.notEqual(observed.cwd, process.cwd());
  assert.equal(existsSync(observed.cwd), false, 'Temporary project is removed after completion');
  assert.equal(observed.args[observed.args.indexOf('--model') + 1], DEFAULT_MODEL);
});

test('tool activity, missing guards, invalid protocol and weak initialization fail closed', async () => {
  for (const [mode, expected] of [
    ['tool', /attempted a tool/], ['guarddeny', /guard/], ['noguard', /guard/],
    ['malformed', /protocol/], ['wrongmodel', /restricted/], ['weak', /restricted/],
    ['noinit', /complete result/], ['duplicate', /more than one/], ['overflow', /output exceeded/]
  ]) {
    await assert.rejects(callAdapter({ ...ctx, childMessage: `[mode:${mode}]` }, '', 3000, { bin }), expected, mode);
  }
});

test('process diagnostics are never exposed in adapter errors', async () => {
  await assert.rejects(callAdapter({ ...ctx, childMessage: '[mode:stderr]' }, '', 3000, { bin }), error => {
    assert.equal(error.message.includes('PRIVATE-DIAGNOSTIC'), false);
    return true;
  });
});

test('timeout kills a stalled process and cleans its isolated project', async () => {
  await assert.rejects(callAdapter({ ...ctx, childMessage: '[mode:hang]' }, '', 200, { bin }), /timed out/);
  const record = JSON.parse((await readFile(calls, 'utf8')).trim().split('\n').at(-1));
  assert.equal(record.mode, 'hang');
  assert.equal(existsSync(record.cwd), false);
  assert.throws(() => process.kill(record.pid, 0), /ESRCH/);
});

test('caller cancellation stops an in-flight CLI request', async () => {
  const controller = new AbortController();
  const promise = callAdapter({ ...ctx, childMessage: '[mode:hang]' }, '', 3000, { bin, signal: controller.signal });
  const rejection = assert.rejects(promise, /cancelled/);
  await new Promise(resolve => setTimeout(resolve, 150));
  controller.abort();
  await rejection;
  const record = JSON.parse((await readFile(calls, 'utf8')).trim().split('\n').at(-1));
  assert.equal(existsSync(record.cwd), false);
});

test('concurrent processes are bounded and a rejected extra turn does not poison later calls', async () => {
  const first = callAdapter({ ...ctx, childMessage: '[mode:hold]' }, '', 3000, { bin });
  const second = callAdapter({ ...ctx, childMessage: '[mode:hold]' }, '', 3000, { bin });
  await assert.rejects(callAdapter(ctx, '', 3000, { bin }), /busy/);
  assert.equal((await first).parsed.speech, line);
  assert.equal((await second).parsed.speech, line);
  assert.equal((await callAdapter(ctx, '', 3000, { bin })).parsed.speech, line);
});

test('successful completion also kills helper descendants in the CLI process group', async () => {
  const result = await callAdapter({ ...ctx, childMessage: '[mode:helper]' }, '', 3000, { bin });
  const { helperPid } = JSON.parse(result.raw).observation;
  assert.ok(helperPid);
  let alive = true;
  for (let attempt = 0; attempt < 20 && alive; attempt++) {
    try { process.kill(helperPid, 0); await new Promise(resolve => setTimeout(resolve, 20)); }
    catch { alive = false; }
  }
  assert.equal(alive, false, 'Detached provider helpers must not outlive a completed turn');
});

test('server shutdown cancels active CLI calls and releases capacity', async () => {
  const running = callAdapter({ ...ctx, childMessage: '[mode:hang]' }, '', 3000, { bin });
  const rejection = assert.rejects(running, /shutdown/);
  await new Promise(resolve => setTimeout(resolve, 150));
  cancelAllAgyCalls();
  await rejection;
  assert.equal((await callAdapter(ctx, '', 3000, { bin })).parsed.speech, line);
});

test('router gates CLI speech, retries a rejected utterance once, then preserves offline fallback', async () => {
  const beforeCount = (await readFile(calls, 'utf8')).trim().split('\n').length;
  const result = await generateTurn({ ...ctx, childMessage: '[mode:praise]' }, { adapter: 'agy', bin, timeoutMs: 3000 });
  const afterCount = (await readFile(calls, 'utf8')).trim().split('\n').length;
  assert.equal(afterCount - beforeCount, 2);
  assert.equal(result.retries, 1);
  assert.equal(result.fallback, true);
  assert.equal(result.adapter, 'scripted_fallback');
  assert.notEqual(result.speech, 'Great work!');
  const unavailable = await generateTurn(ctx, { adapter: 'agy', bin: path.join(fixtures, 'missing'), timeoutMs: 3000 });
  assert.equal(unavailable.fallback, true);
  assert.equal(unavailable.retries, 0);
});

test('native startup preloader loads optional .env and preserves exported environment precedence', async () => {
  const directory = path.join(fixtures, 'startup');
  await mkdir(path.join(directory, 'server'), { recursive: true });
  await copyFile(new URL('../server/load-env.js', import.meta.url), path.join(directory, 'server/load-env.mjs'));
  const run = env => execFileAsync(process.execPath, ['--import', path.join(directory, 'server/load-env.mjs'), '--input-type=module', '-e', 'console.log(process.env.KEYBREAKERS_STARTUP_TEST || "missing")'], { env: { PATH: process.env.PATH, ...env } });
  assert.equal((await run({})).stdout.trim(), 'missing');
  await writeFile(path.join(directory, '.env'), 'KEYBREAKERS_STARTUP_TEST="loaded from local file"\n');
  assert.equal((await run({})).stdout.trim(), 'loaded from local file');
  assert.equal((await run({ KEYBREAKERS_STARTUP_TEST: 'exported wins' })).stdout.trim(), 'exported wins');
});
