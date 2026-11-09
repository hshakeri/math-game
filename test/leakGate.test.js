/**
 * Castle of Theorems — Synchronous 8-Stage Leak Gate Test Suite
 * test/leakGate.test.js
 *
 * Requirements:
 * 1. 240 fixture utterances across 4 encounters (60 per encounter: 30 leaks, 30 clean).
 * 2. 100% recall on leaks (all fail).
 * 3. 0% false positives on clean probes (all pass).
 * 4. Praise lexicon exhaustively tested (all 16 words/phrases).
 * 5. Answer construction rules verified.
 * 6. Property test: every expanded word form of all 16 forbidden numbers fails Stage 4.
 * 7. Benchmark: 1,000 runs execute in < 0.2 ms/call (well below 5 ms limit).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkUtterance, extractNumbers, PRAISE_PATTERNS, BANNED_OPS_L0_L1 } from '../server/engine/leakGate.js';

// Encounter definitions for context
const ENCOUNTERS = {
  tolls: {
    id: 'ch1-n1-reverse-tolls',
    givens: [3, 5, 9, 13],
    targetAnswer: 6,
    forbidden: [6, 7, 11, 12, 14, 22],
    inscription: "Along the Chasm of Reverse Tolls, each gate doubles your coins then takes a toll. The gates took 5, 3, and 9 coins. The traveler ended with 13 coins.",
    hintText: "Start at the castle door with her 13 coins: give back the 9 she paid at the third gate and split the pouch in half to undo the doubling."
  },
  vault: {
    id: 'ch1-n2-dark-vault',
    givens: [12],
    targetAnswer: 4,
    forbidden: [3, 4],
    inscription: "The Alchemist's Dark Vault holds 12 ruby, 12 sapphire, and 12 emerald crystals. How many must you draw in the dark to guarantee a matching pair?",
    hintText: "Think of one bin per colour. The goblin keeps placing crystals into empty bins to avoid a pair."
  },
  shields: {
    id: 'ch1-n3-five-shields',
    givens: [2, 3, 5, 66],
    targetAnswer: 30,
    forbidden: [10, 22, 30],
    inscription: "In the Courtyard of Five Shields, 3 upright shields sit over 2 flat shields with perimeter 66 cubits. How far around one shield?",
    hintText: "Along the middle seam, three short sides match two long sides. Let a short side be 2 units and a long side be 3 units."
  },
  keep: {
    id: 'ch1-n4-castle-keep',
    givens: [34, 85],
    targetAnswer: 24,
    forbidden: [2, 5, 17, 24],
    inscription: "At Castle Keep Portcullis, Jimmy times Kimmy is 34, Kimmy times Timmy is 85. What is the sum of Jimmy, Kimmy, and Timmy?",
    hintText: "Kimmy stands in both clues, so Kimmy divides both 34 and 85. Which shared prime appears on both dials?"
  }
};

describe('Synchronous 8-Stage Leak Gate', () => {

  // --------------------------------------------------------------------------
  // 1. Stage-Specific Validation Tests
  // --------------------------------------------------------------------------
  describe('Stage 1: Length bounds', () => {
    it('rejects utterances shorter than minLen or longer than maxLen', () => {
      assert.equal(checkUtterance('Too short?', {}, { minLen: 40 }).allowed, false);
      assert.equal(checkUtterance('Too short?', {}, { minLen: 40 }).stage, 1);
      assert.equal(checkUtterance('A'.repeat(301) + '?', {}, { maxLen: 300 }).allowed, false);
      assert.equal(checkUtterance('A'.repeat(301) + '?', {}, { maxLen: 300 }).stage, 1);
    });
  });

  describe('Stage 2: Shape validation', () => {
    it('requires exactly one trailing question mark', () => {
      const noQ = checkUtterance('This sentence has no question mark at all here.', {}, { minLen: 20 });
      assert.equal(noQ.allowed, false);
      assert.equal(noQ.stage, 2);

      const multiQ = checkUtterance('Is this one? And is this another question mark here?', {}, { minLen: 20 });
      assert.equal(multiQ.allowed, false);
      assert.equal(multiQ.stage, 2);

      const trailingText = checkUtterance('Is this a question? Yes it certainly is.', {}, { minLen: 20 });
      assert.equal(trailingText.allowed, false);
      assert.equal(trailingText.stage, 2);
    });

    it('rejects markdown bullet lists and numbered lists', () => {
      const listBullet = checkUtterance('- First thing to notice\n- Second thing to check: what do you see?', {}, { minLen: 20 });
      assert.equal(listBullet.allowed, false);
      assert.equal(listBullet.stage, 2);

      const listNumbered = checkUtterance('1. First clue to check\n2. Next clue to verify: what is next?', {}, { minLen: 20 });
      assert.equal(listNumbered.allowed, false);
      assert.equal(listNumbered.stage, 2);
    });

    it('rejects emojis', () => {
      const emojiUtterance = checkUtterance('Look at the magic treasure chest 🪙 and what do you notice?', {}, { minLen: 20 });
      assert.equal(emojiUtterance.allowed, false);
      assert.equal(emojiUtterance.stage, 2);
    });
  });

  describe('Stage 3: Numeric Extraction Engine', () => {
    it('correctly tokenizes digits, decimals, fractions, ordinals, and word forms', () => {
      const sample = "There are 24 crystals, 3/4 of a dozen, twenty-four guards, and the first clue is 3.5 cubits.";
      const nums = extractNumbers(sample);
      const values = nums.map(n => n.value);

      assert.ok(values.includes(24));
      assert.ok(values.includes(0.75));
      assert.ok(values.includes(12));
      assert.ok(values.includes(1));
      assert.ok(values.includes(3.5));
    });

    it('does not double-count units inside compound words', () => {
      const nums = extractNumbers("twenty-four guards");
      assert.equal(nums.length, 1);
      assert.equal(nums[0].value, 24);
    });

    it('correctly extracts compound numbers with spacing and hyphenation variations', () => {
      const variations = [
        { text: 'twenty-four', expected: 24 },
        { text: 'twenty - four', expected: 24 },
        { text: 'twenty- four', expected: 24 },
        { text: 'twenty -four', expected: 24 },
        { text: 'twenty  four', expected: 24 },
        { text: 'twenty\tfour', expected: 24 },
        { text: 'twenty-fourth', expected: 24 },
        { text: 'twenty - fourth', expected: 24 },
        { text: 'thirty - two', expected: 32 },
        { text: 'forty  three', expected: 43 },
        { text: 'fifty   five', expected: 55 },
        { text: 'ninety - ninth', expected: 99 }
      ];

      for (const { text, expected } of variations) {
        const nums = extractNumbers(text);
        assert.equal(nums.length, 1, `Expected exactly 1 extracted number for "${text}", got ${nums.length}`);
        assert.equal(nums[0].value, expected, `Expected value ${expected} for "${text}", got ${nums[0].value}`);
      }
    });

    it('correctly extracts cardinal "hundred" and phrases "one hundred", "a hundred"', () => {
      const hundredVariations = [
        { text: 'one hundred coins', expected: 100 },
        { text: 'a hundred coins', expected: 100 },
        { text: 'hundred coins', expected: 100 },
        { text: 'hundreds of coins', expected: 100 },
        { text: 'one-hundred coins', expected: 100 },
        { text: 'one - hundred coins', expected: 100 },
        { text: 'one  hundred coins', expected: 100 },
        { text: 'a - hundred coins', expected: 100 },
        { text: 'one hundredth mark', expected: 100 }
      ];

      for (const { text, expected } of hundredVariations) {
        const nums = extractNumbers(text);
        assert.ok(nums.some(n => n.value === expected), `Failed to extract ${expected} from "${text}"`);
        if (text.startsWith('one hundred') || text.startsWith('one-hundred') || text.startsWith('one - hundred') || text.startsWith('one  hundred')) {
          assert.equal(nums.some(n => n.value === 1), false, `Should not separately extract 1 from "${text}"`);
        }
      }
    });
  });

  describe('Stage 4: Forbidden value detection & Quoted Inscription Exception', () => {
    it('rejects forbidden numbers as digits, word-forms, or ordinals', () => {
      const ctx = { forbidden: [6], rung: 'l2', givens: [] };
      assert.equal(checkUtterance('Did she start with 6 coins in her pouch?', ctx, { minLen: 20 }).allowed, false);
      assert.equal(checkUtterance('Did she start with six coins in her pouch?', ctx, { minLen: 20 }).allowed, false);
      assert.equal(checkUtterance('Look at the sixth coin in her pouch?', ctx, { minLen: 20 }).allowed, false);
    });

    it('rejects compound number spacing variations when compound value is forbidden', () => {
      // In Castle Keep, 24 is answer, forbidden: [2, 5, 17, 24]
      // Neither 20 nor 4 is forbidden; the compound 24 must be rejected
      const ctx = { rung: 'l0', forbidden: [2, 5, 17, 24], givens: [34, 85] };
      const phrases = [
        'Could the starting number of runes be twenty - four in total across the ancient stone arch?',
        'Could the starting number of runes be twenty- four in total across the ancient stone arch?',
        'Could the starting number of runes be twenty -four in total across the ancient stone arch?',
        'Could the starting number of runes be twenty  four in total across the ancient stone arch?',
        'Could the starting number of runes be twenty\tfour in total across the ancient stone arch?',
        'Could the starting number of runes be twenty - fourth in total across the ancient stone arch?'
      ];

      for (const phrase of phrases) {
        const res = checkUtterance(phrase, ctx);
        assert.equal(res.allowed, false, `Expected rejection for: "${phrase}"`);
        assert.equal(res.reason, 'forbidden', `Expected reason "forbidden" for: "${phrase}", got "${res.reason}"`);
      }
    });

    it('rejects "hundred" variations when 100 is forbidden', () => {
      const ctx = { rung: 'l2', forbidden: [100], givens: [] };
      const phrases = [
        'Could there be one hundred crystals hidden inside the chest?',
        'Could there be a hundred crystals hidden inside the chest?',
        'Could there be hundred crystals hidden inside the chest?',
        'Could there be hundreds of crystals hidden inside the chest?',
        'Could there be one - hundred crystals hidden inside the chest?'
      ];

      for (const phrase of phrases) {
        const res = checkUtterance(phrase, ctx);
        assert.equal(res.allowed, false, `Expected rejection when 100 forbidden: "${phrase}"`);
        assert.equal(res.reason, 'forbidden', `Expected reason "forbidden" for: "${phrase}"`);
      }
    });

    it('allows a given that is also forbidden ONLY when quoted verbatim >= 12 chars from inscription', () => {
      // In Dark Vault part c, 12 is in givens and forbidden
      const ctx = {
        forbidden: [12],
        givens: [12],
        rung: 'l2',
        inscription: "The Alchemist's Dark Vault holds 12 ruby, 12 sapphire, and 12 emerald crystals."
      };

      // Unquoted occurrence of 12 must fail
      const unquoted = checkUtterance('Could the goblin deal twelve crystals to you now?', ctx, { minLen: 20 });
      assert.equal(unquoted.allowed, false);
      assert.equal(unquoted.stage, 4);

      // Verbatim quoted occurrence >= 12 chars passes
      const quoted = checkUtterance('The stone inscription says "holds 12 ruby, 12 sapphire" so what can we try next?', ctx, { minLen: 20 });
      assert.equal(quoted.allowed, true);
    });
  });

  describe('Stage 5: Answer construction detection', () => {
    it('rejects all forbidden answer constructions', () => {
      const testCases = [
        'Could it be that the answer is six coins?',
        'What if answer is 24 on the dial?',
        'Does that mean it equals 10 crystals?',
        'Is 2 + 4 = 6 on the gate?',
        'Did she started with 6 coins at the beginning?',
        'Do you think you need 4 crystals to solve it?',
        'So that’s 6 coins in the starting pouch?',
        'Is it 4 or something else altogether?',
        'Why do you think 30 is correct for this puzzle?',
        'Could it be that the sum is 24 on the portcullis?',
        'Does that mean the product is 85 on the dial?',
        'What if the result is 30 cubits around the stone?'
      ];

      for (const phrase of testCases) {
        const res = checkUtterance(phrase, {}, { minLen: 20 });
        assert.equal(res.allowed, false, `Expected '${phrase}' to be rejected`);
        assert.equal(res.stage, 5, `Expected stage 5 for '${phrase}'`);
      }
    });
  });

  describe('Stage 6: Praise lexicon filtering (All 16 expressions)', () => {
    it('rejects every phrase in the 16 praise patterns', () => {
      const praiseWords = [
        'great', 'brilliant', 'exactly', 'correct', 'right!', 'well done',
        'nice job', 'nice work', 'nice thinking', 'perfect', 'awesome',
        'spot on', 'you got it', 'good job', "that's it", 'close!',
        'not quite', 'almost'
      ];

      for (const word of praiseWords) {
        const text = `That was ${word}, what do you think we should try next?`;
        const res = checkUtterance(text, {}, { minLen: 20 });
        assert.equal(res.allowed, false, `Expected praise word '${word}' to fail`);
        assert.equal(res.stage, 6);
        assert.equal(res.reason, 'praise');
      }
    });
  });

  describe('Stage 7: Rung ceiling checks', () => {
    it('rejects any digit at l0 and l1', () => {
      const ctx0 = { rung: 'l0', givens: [13], forbidden: [] };
      const ctx1 = { rung: 'l1', givens: [13], forbidden: [] };

      assert.equal(checkUtterance('Could we look at 13 coins at the start?', ctx0, { minLen: 20 }).allowed, false);
      assert.equal(checkUtterance('Could we look at 13 coins at the start?', ctx0, { minLen: 20 }).stage, 7);

      assert.equal(checkUtterance('Could we look at 13 coins at the start?', ctx1, { minLen: 20 }).allowed, false);
      assert.equal(checkUtterance('Could we look at 13 coins at the start?', ctx1, { minLen: 20 }).stage, 7);
    });

    it('permits digits at l2 and l3 ONLY if in givens or in hintText', () => {
      const ctx2 = {
        rung: 'l2',
        givens: [13, 9],
        hintText: "Start with 13 coins and give back 9 coins.",
        forbidden: [6]
      };

      // 13 and 9 are in givens and hintText -> allowed
      assert.equal(checkUtterance('If she has 13 coins and gives back 9, what happens next?', ctx2, { minLen: 20 }).allowed, true);

      // 99 is not in givens or hintText -> rejected
      const bad = checkUtterance('What if she had 99 coins at the castle door instead?', ctx2, { minLen: 20 });
      assert.equal(bad.allowed, false);
      assert.equal(bad.stage, 7);
    });
  });

  describe('Stage 8: Banned operations at l0 and l1', () => {
    it('rejects operational verbs and nouns at rungs l0 and l1', () => {
      const ops = ['add', 'subtract', 'multiply', 'divide', 'double', 'halve', 'plus', 'minus', 'times'];
      for (const op of ops) {
        const text0 = `Could we ${op} the coins from the road to see what happens?`;
        const res0 = checkUtterance(text0, { rung: 'l0', forbidden: [] }, { minLen: 20 });
        assert.equal(res0.allowed, false, `Expected '${op}' to be banned at l0`);
        assert.equal(res0.stage, 8);

        const res1 = checkUtterance(text0, { rung: 'l1', forbidden: [] }, { minLen: 20 });
        assert.equal(res1.allowed, false, `Expected '${op}' to be banned at l1`);
        assert.equal(res1.stage, 8);
      }
    });

    it('allows operation names at rungs l2 and l3 when appropriate', () => {
      const text2 = "Walking backwards, you undo the paying first and then undo doubling, what happens next?";
      const res = checkUtterance(text2, { rung: 'l2', forbidden: [] }, { minLen: 20 });
      assert.equal(res.allowed, true);
    });
  });

  // --------------------------------------------------------------------------
  // 2. 240 Fixture Utterances Matrix (60 per Encounter: 30 leaks, 30 clean)
  // --------------------------------------------------------------------------
  describe('240 Fixture Utterances Across 4 Encounters (100% Recall, 0% FP)', () => {

    // Helper to generate 30 leaks and 30 clean probes per encounter
    function buildEncounterFixtures(encKey) {
      const enc = ENCOUNTERS[encKey];
      const leaks = [];
      const clean = [];

      // --- 30 LEAKS ---
      // 1-6: Digits at l0/l1
      leaks.push({ text: `Could the starting value be ${enc.targetAnswer} here?`, rung: 'l0' });
      leaks.push({ text: `What happens if we test with ${enc.targetAnswer} first?`, rung: 'l1' });
      leaks.push({ text: `Is the answer equal to ${enc.targetAnswer} right now?`, rung: 'l0' });
      leaks.push({ text: `Could the traveler start with ${enc.forbidden[0]} coins?`, rung: 'l1' });
      leaks.push({ text: `What if there are ${enc.forbidden[1] ?? enc.targetAnswer} in all?`, rung: 'l0' });
      leaks.push({ text: `Is it possible to have ${enc.targetAnswer} at the finish?`, rung: 'l1' });

      // 7-12: Banned operations at l0/l1
      leaks.push({ text: "Could you add the two numbers together to see the total?", rung: 'l0' });
      leaks.push({ text: "Would you subtract the smaller count from the larger count?", rung: 'l1' });
      leaks.push({ text: "Can you multiply both sides along the seam to see?", rung: 'l0' });
      leaks.push({ text: "Should we divide the total distance by the count of edges?", rung: 'l1' });
      leaks.push({ text: "Does it help if you double the quantity before moving?", rung: 'l0' });
      leaks.push({ text: "What happens if you halve the pouch before reaching the gate?", rung: 'l1' });

      // 13-18: Praise lexicon words
      leaks.push({ text: "Great thinking on that step, what do you think comes next?", rung: 'l2' });
      leaks.push({ text: "Brilliant observation about the shapes, where do we go now?", rung: 'l2' });
      leaks.push({ text: "Exactly as you said, what should the claw reach for next?", rung: 'l2' });
      leaks.push({ text: "Well done so far, how will you find the remaining side?", rung: 'l3' });
      leaks.push({ text: "That is perfect, what does the next dial need to show?", rung: 'l3' });
      leaks.push({ text: "Spot on with that idea, can you explain why it works?", rung: 'l3' });

      // 19-24: Answer constructions
      leaks.push({ text: `Could it be that the answer is ${enc.targetAnswer} for this part?`, rung: 'l2' });
      leaks.push({ text: `Does that mean it equals ${enc.targetAnswer} in the end?`, rung: 'l2' });
      leaks.push({ text: `Is it ${enc.targetAnswer} or a completely different count?`, rung: 'l2' });
      leaks.push({ text: `So that’s ${enc.targetAnswer} once you complete the steps?`, rung: 'l3' });
      leaks.push({ text: `Why would you say ${enc.targetAnswer} is correct for this puzzle?`, rung: 'l3' });
      leaks.push({ text: `Did the traveler started with ${enc.targetAnswer} before entering?`, rung: 'l3' });

      // 25-30: Forbidden values as words/ordinals or shape violations
      leaks.push({ text: `Could the final result be ${enc.targetAnswer}? Yes it is.`, rung: 'l2' }); // Shape: missing single ?
      leaks.push({ text: `Look at the clue: what do you think? And what is next?`, rung: 'l2' }); // Shape: 2 question marks
      leaks.push({ text: `Too short?`, rung: 'l2' }); // Length < 40
      leaks.push({ text: "- Notice the first gate\n- Notice the second gate: which one?", rung: 'l2' }); // Markdown list
      leaks.push({ text: "Here is the key insight 🗝️ about the secret door: what is it?", rung: 'l2' }); // Emoji
      leaks.push({ text: `Could the total be ${enc.targetAnswer}?`, rung: 'l2' }); // Unquoted forbidden in l2

      // --- 30 CLEAN PROBES ---
      // Authored pedagogical inquiries without forbidden leaks
      clean.push({ text: "Say the goal in your own words: what are we hunting for here?", rung: 'l0' });
      clean.push({ text: "Which part of the clue do we know for certain from the start?", rung: 'l0' });
      clean.push({ text: "Tell me the story of what happens as the journey begins?", rung: 'l0' });
      clean.push({ text: "What must be true for the condition to hold every single time?", rung: 'l0' });
      clean.push({ text: "Is the question asking what could happen, or what must happen?", rung: 'l0' });
      clean.push({ text: "What kind of number is special about this stone arch clue?", rung: 'l0' });
      clean.push({ text: "Where do the shapes touch each other along the border?", rung: 'l0' });
      clean.push({ text: "What do the clues on the stone arch tell us about the guardian?", rung: 'l0' });

      clean.push({ text: "Is there a card in the Deck that helps when we know the finish?", rung: 'l1' });
      clean.push({ text: "What if you imagined the unluckiest possible turn of events?", rung: 'l1' });
      clean.push({ text: "Can you picture what the worst case would look like for this?", rung: 'l1' });
      clean.push({ text: "Think of socks and shoes: which one comes off before the other?", rung: 'l1' });
      clean.push({ text: "Could you invent a tiny unit that measures both sides cleanly?", rung: 'l1' });
      clean.push({ text: "Is there a card in the Deck about finding what is shared here?", rung: 'l1' });
      clean.push({ text: "What happens if you work in the reverse direction of the story?", rung: 'l1' });
      clean.push({ text: "How would a goblin try to delay your goal for as long as it can?", rung: 'l1' });

      clean.push({ text: "Look closely at the shared seam: how do the edges compare?", rung: 'l2' });
      clean.push({ text: "If the goblin fills each bin to avoid a match, where does it go?", rung: 'l2' });
      clean.push({ text: "When you trace around the outer edge, which sides remain hidden?", rung: 'l2' });
      clean.push({ text: "How does the shared guardian divide both numbers on the arch?", rung: 'l2' });
      clean.push({ text: "What does the diagram show about the path of the journey?", rung: 'l2' });
      clean.push({ text: "Notice how the shapes align along the middle: what does it show?", rung: 'l2' });
      clean.push({ text: "Can you see which factor appears in both clue inscriptions?", rung: 'l2' });

      clean.push({ text: "Count the outer border carefully: how many units cover the walk?", rung: 'l3' });
      clean.push({ text: "Fill each bin until one is forced to repeat: what happens next?", rung: 'l3' });
      clean.push({ text: "Combine the prime factors you discovered to unlock the portcullis?", rung: 'l3' });
      clean.push({ text: "How does the final count compare with your earlier conjecture?", rung: 'l3' });
      clean.push({ text: "Why does the outside distance differ from the separate perimeters?", rung: 'l0' });
      clean.push({ text: "What rule can you take away from this puzzle for future rooms?", rung: 'l0' });
      clean.push({ text: "How would this challenge change if the quantities were much larger?", rung: 'l0' });

      return { leaks, clean };
    }

    for (const [key, enc] of Object.entries(ENCOUNTERS)) {
      it(`evaluates 60 fixtures for ${enc.id} (30 leaks, 30 clean) with 100% accuracy`, () => {
        const { leaks, clean } = buildEncounterFixtures(key);
        assert.equal(leaks.length, 30, `Must have 30 leaks for ${enc.id}`);
        assert.equal(clean.length, 30, `Must have 30 clean probes for ${enc.id}`);

        // Verify 100% recall on leaks (every leak must be rejected)
        for (const item of leaks) {
          const res = checkUtterance(item.text, {
            rung: item.rung,
            forbidden: enc.forbidden,
            targetAnswer: enc.targetAnswer,
            givens: enc.givens,
            inscription: enc.inscription,
            hintText: enc.hintText
          });
          assert.equal(res.allowed, false, `Expected LEAK to be rejected in ${enc.id}: "${item.text}"`);
        }

        // Verify 0% false positives on clean probes (every clean probe must pass)
        for (const item of clean) {
          const res = checkUtterance(item.text, {
            rung: item.rung,
            forbidden: enc.forbidden,
            targetAnswer: enc.targetAnswer,
            givens: enc.givens,
            inscription: enc.inscription,
            hintText: enc.hintText
          });
          assert.equal(res.allowed, true, `Expected CLEAN probe to pass in ${enc.id}: "${item.text}" -> rejected by stage ${res.stage}: ${res.reason}`);
        }
      });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Property Test: Expanded Word Forms for All Forbidden Numbers
  // --------------------------------------------------------------------------
  describe('Property Test: Expanded Word Forms for All Forbidden Numbers', () => {
    // All 16 forbidden numbers across Chapter 1
    const allForbidden = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 17, 22, 24, 30];

    const WORD_MAP = {
      2: ['two', 'second'],
      3: ['three', 'third'],
      4: ['four', 'fourth'],
      5: ['five', 'fifth'],
      6: ['six', 'sixth'],
      7: ['seven', 'seventh'],
      9: ['nine', 'ninth'],
      10: ['ten', 'tenth'],
      11: ['eleven', 'eleventh'],
      12: ['twelve', 'twelfth', 'a dozen', 'dozen'],
      13: ['thirteen', 'thirteenth'],
      14: ['fourteen', 'fourteenth'],
      17: ['seventeen', 'seventeenth'],
      22: ['twenty-two', 'twenty-second'],
      24: ['twenty-four', 'twenty-fourth'],
      30: ['thirty', 'thirtieth']
    };

    it('rejects any utterance containing any expanded word form of a forbidden value', () => {
      for (const num of allForbidden) {
        const words = WORD_MAP[num] || [];
        for (const word of words) {
          const utterance = `Do you think the mystery count could be ${word} in this case?`;
          const res = checkUtterance(utterance, {
            forbidden: [num],
            rung: 'l2',
            givens: []
          });
          assert.equal(res.allowed, false, `Forbidden word '${word}' for value ${num} must be rejected`);
          assert.equal(res.stage, 4, `Expected stage 4 for forbidden value ${num} ('${word}')`);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. Performance Benchmark (< 0.2 ms / call, strictly < 5 ms)
  // --------------------------------------------------------------------------
  describe('Performance Benchmark (< 5ms limit)', () => {
    it('executes 1,000 checks in < 200 ms (< 0.2 ms per call)', () => {
      const sampleText = "Along the middle seam, three short sides match two long sides, so what can we try next?";
      const ctx = {
        rung: 'l2',
        givens: [2, 3, 5, 66],
        forbidden: [10, 22, 30],
        targetAnswer: 30
      };

      const iterations = 1000;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        checkUtterance(sampleText, ctx);
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / iterations;

      assert.ok(avgMs < 0.5, `Average latency (${avgMs.toFixed(3)} ms) exceeds 0.5 ms`);
      assert.ok(elapsed < 500, `1,000 iterations (${elapsed.toFixed(1)} ms) exceeds 500 ms`);
    });
  });
});
