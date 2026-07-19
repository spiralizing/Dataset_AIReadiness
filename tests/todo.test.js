// Unit tests for the to-do (action plan) generator. Run with:  npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { generateTodo } from '../src/generators/todo.js';

const FIXED = '2026-07-16T00:00:00.000Z';

test('Plan: acquisition items are "Do now"; release/doc items are "Coming up"', () => {
  const md = generateTodo({ pathway: 'A', stage: 'plan', answers: {}, dataset: {} }, { now: FIXED });
  assert.match(md, /^# AI-readiness to-do/);
  assert.match(md, /Starting point:.*Starting to collect data/);
  assert.match(md, /## Do now/);
  assert.match(md, /Original sources of the data/); // acquisition — actionable now in Plan
  assert.match(md, /## Coming up — at\/before release/);
  assert.match(md, /Persistent identifier assigned/); // release-time — deferred in Plan
});

test('Prepare: fixed acquisition items go under "Document as-is"', () => {
  const md = generateTodo({ pathway: 'A', stage: 'prepare', answers: {}, dataset: {} }, { now: FIXED });
  assert.match(md, /## Document as-is/);
  assert.match(md, /Consent basis recorded/); // acquisition, locked in Prepare
});

test('to-do title includes the dataset name when set', () => {
  const md = generateTodo(
    { pathway: 'A', stage: 'plan', answers: {}, dataset: { name: 'My cohort' } },
    { now: FIXED },
  );
  assert.match(md, /# AI-readiness to-do — My cohort/);
});
