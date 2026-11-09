/**
 * Rivet the clockwork owl: authored, deterministic tutor probes.
 * Every line stays within the existing Socratic information diet.
 */

export const SCRIPTED_PROBES = {
  "ch1-n1-reverse-tolls": {
    "a": {
      "conjecture": [
        "Grubb wants your reasons on the record. My notebook is open. Why does that starting pouch make sense for the whole journey through the gates?"
      ],
      "understand": {
        "l0": [
          "Grubb says you're bluffing. I prefer a written account. In your own words, what number are we hunting, and what do we know for certain about the journey?",
          "My gears work in order; these gates have an order too. Tell me the story of a single gate: what happened first, and what happened second?",
          "Before we set off, let's mark what the inscription actually tells us. Which end of the road do we know for certain, the start or the finish?"
        ]
      },
      "plan": {
        "l1": [
          "I once tried taking off my socks before my boots. A poor design. When we undo getting dressed, which thing has to come off first?",
          "We could look at the road from the castle door. If you walked backwards from there, which gate would you reach first, and what would you have to undo?",
          "Lemma keeps a card for journeys like this. Is there a card in the Deck that starts from the end of a story instead of its beginning?"
        ]
      },
      "carry_out": {
        "l1": [
          "Let's put a pin in the castle end of the blueprint. Walking backwards from that door, which gate would you meet first, and what happened there?",
          "Grubb has plenty to say about the pouch. The inscription is less noisy. At the last gate, what was the last thing that changed the coins?"
        ],
        "l2": [
          "Each gate doubles the coins, then takes a toll. Backwards, we meet the payment first: return those coins, then undo the doubling. Which gate will you undo first, and what do you give back there?"
        ],
        "l3": [
          "Set the blueprint at the castle door with 13 coins. Give back the 9 paid at the third gate, then split the pouch in half to undo the doubling. What count belongs on that gate before we move on?"
        ]
      },
      "simpler_problem": {
        "l4": [
          "A pocket-sized road for our notebook. If we undo the final payment at a single gate and then undo the doubling, does that take us back to the beginning?"
        ]
      },
      "look_back": {
        "l0": [
          "Time to test the road in its usual direction. If you run your starting count through all three gates, does the traveler reach the castle with the coins named in the story?"
        ]
      }
    }
  },
  "ch1-n2-dark-vault": {
    "a": {
      "conjecture": [
        "Grubb intends to choose every crystal himself. Why does your number of grabs guarantee a matching pair even when he tries to keep the colours apart?"
      ],
      "understand": {
        "l0": [
          "My lantern runs on oil, not luck. For this torch, are we hunting for a pair that might appear on a lucky grab, or a pair that cannot be avoided?",
          "Let's read the torch's demand before opening the chest. What must be true for a grab to count as certain, no matter how unlucky we are?",
          "Grubb would like us to rely on luck. Look at the inscription: is it asking what could happen, or what must happen every single time?"
        ]
      },
      "plan": {
        "l1": [
          "Picture Grubb inside the chest, choosing each crystal to delay our torch. What would he hand you on each grab to keep a pair from appearing?",
          "Lemma has a card for a day when luck refuses to help. Which card in the Deck could help us think about the unluckiest case?",
          "Let's try a chest small enough for my workbench, with only two colours. How long could Grubb keep every crystal you grab a different colour?"
        ]
      },
      "carry_out": {
        "l1": [
          "Grubb keeps looking for an empty bin so no colours match. How long can he keep dodging a pair before every bin holds a crystal?",
          "Leave Grubb in charge of the chest for now. If he wants to delay a pair for as long as possible, which colour would he hand you next?"
        ],
        "l2": [
          "A bin for each colour gives us a place to keep watch. Grubb uses empty bins to avoid a pair. Once every bin holds one crystal, what must the next crystal do?"
        ],
        "l3": [
          "Put one crystal in each bin on the blueprint, leaving Grubb no empty bin to choose. What happens when the next crystal has to join an occupied bin?"
        ]
      },
      "simpler_problem": {
        "l4": [
          "Let's clear a corner of the workbench for a tiny chest with only two colours. How many grabs make a matching pair unavoidable, however Grubb chooses?"
        ]
      },
      "look_back": {
        "l0": [
          "I'll file the blueprint beside the torch. Why did making a matching pair need so few grabs compared with emptying an entire colour from the chest?"
        ]
      }
    },
    "b": {
      "conjecture": [
        "Grubb is still choosing the crystals, and this torch wants a larger club. Why does your number leave him no way to dodge four of the same colour?"
      ],
      "understand": {
        "l0": [
          "New torch, new demand. Let's put it in our own words: does it want four crystals of every colour, or four crystals of any single colour?",
          "My notebook has room for the torch's demand. How many crystals of a single colour must the claw secure, however Grubb chooses them?",
          "Grubb has taken his place beside the chest again. Looking at this torch's demand, what is he trying to prevent as he hands over crystals?"
        ]
      },
      "plan": {
        "l1": [
          "Lemma has kept the unluckiest-case card handy. Can we use it to fill each colour short of the goal before any colour reaches the club size?",
          "Let Grubb make the choices on our blueprint. How many crystals could he give you of each colour without completing a club of four?",
          "A goblin needs somewhere to hide the next crystal. What happens if he has handed out as many as possible without any colour reaching the target?"
        ]
      },
      "carry_out": {
        "l1": [
          "Let's leave Grubb every choice the chest allows. If he has given as many crystals as possible without a club, what must the very next grab do?",
          "The blueprint lets us keep an eye on each colour. How many crystals can sit in each bin before the club this torch wants is forced?"
        ],
        "l2": [
          "Grubb fills each bin one below the club size so no bin reaches the goal. Once every bin is filled that way, where can the next crystal go?"
        ],
        "l3": [
          "On the blueprint, fill each bin until it is one crystal short of four. Then let Grubb choose a bin for a final grab. What does that grab force to happen?"
        ]
      },
      "simpler_problem": {
        "l4": [
          "Let's use a chest with only two colours on the workbench. What happens when Grubb fills both colours below the target and then hands over another crystal?"
        ]
      },
      "look_back": {
        "l0": [
          "Keep this blueprint in the notebook; we can change the torch's demand. How would the needed grabs change if it asked for five of a colour instead of four?"
        ]
      }
    },
    "c": {
      "conjecture": [
        "Grubb has changed his plan for this torch. What is the longest trick he can play to keep every crystal in your hand the same colour?"
      ],
      "understand": {
        "l0": [
          "The Torch of Difference has its own demand. Before we open the chest, how many different colours must we be certain to hold in our hand?",
          "Let's give this torch a fresh line in the notebook. In your own words, what does the Torch of Difference ask us to guarantee?",
          "Grubb is choosing again, so luck gets no say. What would the unluckiest hand look like when we want crystals of two different colours?"
        ]
      },
      "plan": {
        "l1": [
          "Grubb wants to keep a second colour out of your hand. If he controls each grab from the chest, which crystals will he keep handing you?",
          "Let's check the limits of Grubb's plan. Could he keep giving you the very same colour until that whole colour runs completely out?",
          "Lemma has opened the unluckiest-case card again. What trick would keep every crystal in your hand the same colour for as long as possible?"
        ]
      },
      "carry_out": {
        "l1": [
          "My notebook has a column for the colour Grubb keeps choosing. Could he keep handing you that colour until none of it remains in the chest?",
          "Let Grubb keep choosing his favourite colour. Once the chest has no crystals of that colour left, what happens on the next grab?"
        ],
        "l2": [
          "This time Grubb hands over the same colour for as long as the chest allows. How long can he keep that up, and what must happen on the next grab?"
        ],
        "l3": [
          "Give Grubb every crystal of one colour on the blueprint, then let him hand them over until none remain. What colour must his next crystal be?"
        ]
      },
      "simpler_problem": {
        "l4": [
          "A tiny chest for the workbench holds red and blue crystals. If Grubb hands over all five red crystals, what colour must the next grab be?"
        ]
      },
      "look_back": {
        "l0": [
          "Let's place the torch blueprints side by side in the notebook. Why did the Torch of Difference need more grabs than the Torch of Pairs?"
        ]
      }
    }
  },
  "ch1-n3-five-shields": {
    "a": {
      "conjecture": [
        "The Stonemason has left the courtyard for us to inspect. How does your walk around a single shield compare with a walk around the entire courtyard?"
      ],
      "understand": {
        "l0": [
          "Boots ready, notebook open. Before we trace any edges, are we looking for the walk around the whole courtyard or the walk around a single stone shield?",
          "My blueprint has room for measurements and for things we know from the arrangement. What does the inscription tell us as a number, and what does the shape tell us?",
          "The Stonemason set these shields edge to edge. Where do the standing shields touch the lying ones, and what can we say about that line?"
        ]
      },
      "plan": {
        "l1": [
          "I'll hold the blueprint still. At the place where the standing shields meet the flat shields, what does the shared seam tell us about their sides?",
          "Lemma is sorting the Deck beside the blueprint. Is there a card that could help us look at something the rows of shields share?",
          "The Stonemason's ruler is missing, so we can choose our own unit. Could a small unit measure both a short side and a long side with no leftover?"
        ]
      },
      "carry_out": {
        "l1": [
          "Trace the middle seam with a finger on the blueprint. How many short sides cover the same length as the long sides along that seam?",
          "Let's walk around the outside edge on the blueprint. What happens to the edges that touch along the middle seam when we follow that path?"
        ],
        "l2": [
          "The middle seam joins three short sides to two long sides. Mark a short side as 2 units and a long side as 3 units on the blueprint. How do the sides on the outer border fit together?"
        ],
        "l3": [
          "Trace the outer border in units across the top, bottom and sides. Use its length to find the cubits in a unit. What distance does that give for the walk around a single shield?"
        ]
      },
      "simpler_problem": {
        "l4": [
          "Let's sketch a smaller arrangement in the notebook: two identical squares sit side by side. Which edges are hidden inside where the squares meet?"
        ]
      },
      "look_back": {
        "l0": [
          "The Stonemason can leave the shields where they are. Why does the outside walk around the joined courtyard measure less than the walks around five separate shields?"
        ]
      }
    }
  },
  "ch1-n4-castle-keep": {
    "a": {
      "conjecture": [
        "The guardians are waiting by their dials. Why must the sum of their prime runes match the number you chose for the portcullis?"
      ],
      "understand": {
        "l0": [
          "The guardians have handed us clues, not their runes. What kind of number is a prime rune, and which guardian is named in both clues?",
          "Before we touch a dial, let's write down what prime means. What is special about the ways a prime rune can be made by multiplying?",
          "My notebook has a space for what the portcullis wants. At the end of this puzzle, are we being asked for a product or a sum?"
        ]
      },
      "plan": {
        "l1": [
          "Lemma has brought the Deck up to the arch. Which card might help us find something shared between the clue numbers written there?",
          "Keep both clues in view on the blueprint. If a rune sits inside both products, what must it be a factor of?",
          "We can inspect the clues like parts on a workbench. Could you break each clue number into prime pieces and compare the pieces?"
        ]
      },
      "carry_out": {
        "l1": [
          "Kimmy has a place in both clues on the arch. What does that tell us about a prime factor shared by the clue numbers?",
          "I'll keep the clues side by side in the notebook. How could breaking them into prime pieces help us find the shared guardian's rune?"
        ],
        "l2": [
          "Kimmy stands in both clues, so Kimmy's rune divides both 34 and 85. Break each clue into prime pieces on the blueprint. Which prime appears on both dials?"
        ],
        "l3": [
          "Find the prime factor shared by 34 and 85 for Kimmy, then the remaining prime factors for Jimmy and Timmy. What do all three runes give when combined?"
        ]
      },
      "simpler_problem": {
        "l4": [
          "A smaller set of dials for the workbench: a pair of runes multiplies to 21, and another pair to 77. Which prime rune appears in both clues?"
        ]
      },
      "look_back": {
        "l0": [
          "Before we file the blueprint, look back at the clue numbers on the arch. How could you tell that Jimmy had to hold an even prime rune?"
        ]
      }
    }
  }
};

// These follow-ups acknowledge that the child has described some working, never
// whether it is valid. No child text or computed value is interpolated into them.
export const SCRIPTED_FOLLOW_UPS = {
  conjecture: [
    "I will keep your idea in the notebook without filling in the rest for you. Grubb is waiting for the reason behind it. How does your explanation fit the clues in the inscription?",
    "Let us pin your idea beside the inscription and leave room for its reasons. I can hold the lantern while you inspect the clues. What would you check to test your idea?"
  ],
  understand: [
    "I have your working in the notebook. Before we choose where to use it, let's keep the story and the question in view. Which part of the story is still unknown?",
    "Your idea can stay on the page while we inspect the clues. I will keep my monocle on the inscription beside us. Which detail in the story does your explanation use?"
  ],
  plan: [
    "Your route is in the notebook. Lemma has the Deck ready beside it, and we can choose how to test the idea on the blueprint. Which card fits the approach you described?",
    "Let us keep your explanation beside the Deck while we choose a way to try it. Lemma can hold the cards where you can inspect them. Which card would you use to try your plan?"
  ],
  carry_out: [
    "I have kept your working beside the blueprint. We can try the idea there without losing the trail in your notebook. Which part of your explanation would you test next?",
    "Let us keep your idea on the page while we inspect the blueprint. My monocle is ready for the details. What would you expect to happen when you try your next step?"
  ],
  simpler_problem: [
    "The smaller problem has its own corner of the notebook, so we can keep it apart from the main gate. Which clue in this smaller story would you use to test your idea?",
    "I have your working for the smaller problem beside its inscription. We can try it there before returning to the main gate. What would you check next in this smaller story?"
  ],
  look_back: [
    "The blueprint can stay open while we write the last page of this issue. I have left room for the reasons behind your route. Which part of your explanation would you keep for another journey?",
    "You can use the notebook to trace the plan you chose and the steps you tried. I will keep the old clues in view while you look back. What made you choose that route?"
  ]
};

const GENERAL_FOLLOW_UPS = [
  "I have left room in the notebook for your idea and the clues that led you to it. We can keep the inscription beside us while we inspect them. What would you like to try next?",
  "Let us leave your idea on the page while we look at the clues in the inscription. My monocle is ready, and the notebook has room for your reasons. What would you check next?"
];

const OPENING_SUPPORT = [
  'Your note is in the notebook, and the inscription can stay beside it while we find a place to begin. My monocle is ready for the clues. Which part of the story tells you something you know for certain?',
  'We can leave room in the notebook for an answer while we inspect the story. The inscription has clues we can return to as we work. What is the story asking us to find out?'
];

function previousSpeech(options) {
  if (typeof options.previousSpeech === 'string' && options.previousSpeech) return options.previousSpeech;
  const history = options.publicHistory?.length ? options.publicHistory : options.transcript || [];
  const previous = [...history].reverse().find(entry => ['tutor', 'assistant', 'Rivet', 'rivet', 'owl'].includes(entry.who));
  return previous?.text || previous?.speech || '';
}

function select(candidates, options) {
  const previous = candidates.indexOf(previousSpeech(options));
  const index = Number.isInteger(options.index) ? options.index : previous + 1;
  const usedPoolIndex = ((index % candidates.length) + candidates.length) % candidates.length;
  return { speech: candidates[usedPoolIndex], usedPoolIndex };
}

/** Safe, phase-specific questions when an authored pool has no further probe. */
export function getScriptedFollowUp(state, options = {}) {
  return select(SCRIPTED_FOLLOW_UPS[state] || GENERAL_FOLLOW_UPS, options).speech;
}

/**
 * Selects an authored probe from the current phase/rung, advancing after the last
 * delivered line. Selection is local and deterministic, with no session-global
 * counter, correctness check or interpolation of the child's numbers.
 *
 * @param {string} encounterId
 * @param {string} partId
 * @param {string} state - 'conjecture' | 'understand' | 'plan' | 'carry_out' | 'simpler_problem' | 'look_back'
 * @param {string} [rung='l0'] - 'l0' | 'l1' | 'l2' | 'l3' | 'l4'
 * @param {object} [options] - index, previousSpeech, publicHistory, childMessage, childAction
 * @returns {{speech: string, usedPoolIndex: number}}
 */
export function selectScriptedProbe(encounterId, partId, state, rung = 'l0', options = {}) {
  if (state === 'understand' && options.conversationCue === 'opening_support') return select(OPENING_SUPPORT, options);
  const encProbes = SCRIPTED_PROBES[encounterId]?.[partId];
  if (!encProbes) {
    return select(GENERAL_FOLLOW_UPS, options);
  }

  let candidates = null;

  if (state === 'conjecture') {
    candidates = encProbes.conjecture;
  } else if (state === 'understand') {
    candidates = encProbes.understand?.[rung] || encProbes.understand?.l0;
  } else if (state === 'plan') {
    candidates = encProbes.plan?.[rung] || encProbes.plan?.l1;
  } else if (state === 'carry_out') {
    candidates = encProbes.carry_out?.[rung] || encProbes.carry_out?.l1;
  } else if (state === 'simpler_problem') {
    candidates = encProbes.simpler_problem?.[rung] || encProbes.simpler_problem?.l4;
  } else if (state === 'look_back') {
    candidates = encProbes.look_back?.[rung] || encProbes.look_back?.l0;
  }

  if (!candidates || candidates.length === 0) {
    const stateObj = encProbes[state];
    if (stateObj && typeof stateObj === 'object') {
      const firstKey = Object.keys(stateObj)[0];
      candidates = stateObj[firstKey];
    }
  }

  if (!candidates || candidates.length === 0) {
    return select(SCRIPTED_FOLLOW_UPS[state] || GENERAL_FOLLOW_UPS, options);
  }

  const action = typeof options.childAction === 'object' ? options.childAction?.type : options.childAction;
  const message = typeof options.childMessage === 'string' ? options.childMessage : '';
  const describingWork = ['say', 'chip', 'conjecture', 'lookback'].includes(action)
    && /\d|[=+×÷]|\b(?:because|then|before|after|undo|backwards?|calculated|working|start|end|tried)\b/i.test(message);
  if (describingWork && SCRIPTED_FOLLOW_UPS[state]) {
    return select(SCRIPTED_FOLLOW_UPS[state], options);
  }
  // A single authored hint still leads to a fresh question on the next turn.
  // Explicit indices retain the existing authored-pool API used by validators.
  if (candidates.length === 1 && !Number.isInteger(options.index)) {
    candidates = [...candidates, ...(SCRIPTED_FOLLOW_UPS[state] || GENERAL_FOLLOW_UPS)];
  }
  return select(candidates, options);
}

export function getScriptedProbe(encounterId, partId, state, rung = 'l0', options = {}) {
  return selectScriptedProbe(encounterId, partId, state, rung, options).speech;
}
