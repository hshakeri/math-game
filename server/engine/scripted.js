/**
 * Castle of Theorems v1 (Home Edition)
 * Authored Scripted Fallback Engine
 * Implements SPEC §6, §7
 */

export const SCRIPTED_PROBES = {
  // =========================================================================
  // 1. CHASM OF REVERSE TOLLS (ch1-n1-reverse-tolls)
  // Part a: Givens [3, 5, 9, 13], Target 6, Forbidden [6, 7, 11, 12, 14, 22]
  // =========================================================================
  'ch1-n1-reverse-tolls': {
    a: {
      conjecture: [
        "Convince me of your thinking in one clear sentence: why does that starting pouch make sense for this journey?"
      ],
      understand: {
        l0: [
          "Say the goal in your own words: what count are we hunting for, and what do we know for certain about the end of the road?",
          "Tell me the story of a single gate in order: what happened first, and what happened second?",
          "Which end of the road do we know for certain, the start or the finish?"
        ]
      },
      plan: {
        l1: [
          "Think of putting on socks and then shoes on your feet. When it is time to take them off, which one comes off first?",
          "If you walked this road backwards, which gate would you reach first, and what would you have to undo there?",
          "Is there a card in the Deck that starts from the end of a story instead of its beginning?"
        ]
      },
      carry_out: {
        l1: [
          "If you walked this road backwards from the castle door, which gate would you reach first, and what happened there?",
          "Look at the very last gate before the castle: what was the last thing that changed the coins in her pouch?"
        ],
        l2: [
          "Each gate did two things in order, first doubling, then paying. Walking backwards you meet the paying first, so you undo it first by giving the coins back, and only then undo the doubling. Which gate will you undo first, and what do you give back there?"
        ],
        l3: [
          "Start at the castle door with her 13 coins: give back the 9 she paid at the third gate and split the pouch in half to undo the doubling. What count do you write on that gate before moving to the second gate?"
        ]
      },
      simpler_problem: {
        l4: [
          "Try this tiny road with just one gate: if you undo the final payment and then undo the doubling, does that lead you straight back to the beginning?"
        ]
      },
      look_back: {
        l0: [
          "Run your starting count forward through all three gates in order. Does the traveler arrive at the castle door with the exact coins told in the story?"
        ]
      }
    }
  },

  // =========================================================================
  // 2. ALCHEMIST'S DARK VAULT (ch1-n2-dark-vault)
  // Givens [12]
  // =========================================================================
  'ch1-n2-dark-vault': {
    // Part a: Torch of Pairs (Target 4, Forbidden [3, 4])
    a: {
      conjecture: [
        "Convince me in one sentence: why does that number of grabs guarantee a matching pair no matter how unlucky you are?"
      ],
      understand: {
        l0: [
          "Say the goal in your own words: are we looking for what might happen on a lucky grab, or what must happen every single time?",
          "What must be true for a grab to count as certain, no matter how unlucky we are?",
          "Is the question asking what could happen, or what must happen?"
        ]
      },
      plan: {
        l1: [
          "Picture a sneaky goblin inside the chest who wants to ruin your torch. What would that goblin hand you on each grab to delay a pair?",
          "Is there a card in the Deck about the unluckiest case?",
          "Try a chest with only two colours. How long could the goblin keep your grabs all different?"
        ]
      },
      carry_out: {
        l1: [
          "If the goblin puts each crystal into an empty bin to avoid matching, how long can it keep dodging before every bin has one?",
          "Imagine the goblin handing you crystals to delay your pair for as long as possible: what colour comes next?"
        ],
        l2: [
          "Think of one bin per colour. The goblin keeps placing crystals into empty bins to avoid a pair. Once every bin holds one crystal, what must the very next crystal do?"
        ],
        l3: [
          "Place one crystal in each of the bins so the goblin delays a pair as long as possible. What happens when you must drop the next crystal into a bin that is already occupied?"
        ]
      },
      simpler_problem: {
        l4: [
          "Suppose a tiny chest holds only two colours of crystals. How many grabs make a matching pair completely unavoidable?"
        ]
      },
      look_back: {
        l0: [
          "Why did the Torch of Pairs need so few grabs compared to emptying an entire colour from the chest?"
        ]
      }
    },

    // Part b: Torch of Four (Target 10, Forbidden [3, 9, 10])
    b: {
      conjecture: [
        "Convince me in one sentence: how does your number prevent the goblin from dodging a club of four of the same colour?"
      ],
      understand: {
        l0: [
          "What does this torch require: do we need four of every colour, or four crystals of any single colour?",
          "How many crystals of one single colour does the claw need to secure?",
          "What is the goblin trying to prevent from happening as it deals crystals?"
        ]
      },
      plan: {
        l1: [
          "Can you use the unluckiest case card to fill each colour just short of the goal before any colour reaches the club size?",
          "How many crystals could the goblin give you of each colour without completing a club of four?",
          "What happens if the goblin hands you as many as possible without any colour reaching the target?"
        ]
      },
      carry_out: {
        l1: [
          "If the goblin gives you as many crystals as possible without any colour reaching the goal, what must happen on the very next grab?",
          "How many can sit in each colour before the club is forced?"
        ],
        l2: [
          "The goblin wants no bin to reach the club size, so it fills every bin just one below the club size. When all bins are filled that way, where does the next crystal go?"
        ],
        l3: [
          "Fill each bin until it is one crystal short of four, then add one final grab. What does that final grab force to happen?"
        ]
      },
      simpler_problem: {
        l4: [
          "Imagine a tiny chest with only two colours: what happens when the goblin fills both colours just below the target?"
        ]
      },
      look_back: {
        l0: [
          "How would the required grabs change if the torch asked for five crystals of the same colour instead of four?"
        ]
      }
    },

    // Part c: Torch of Difference (Target 13, Forbidden [12, 13])
    c: {
      conjecture: [
        "Convince me in one sentence: what is the worst trick the goblin can play to keep all your grabs the same colour?"
      ],
      understand: {
        l0: [
          "What does this torch ask us to guarantee: how many different colours must appear in your hand?",
          "What does the Torch of Difference ask us to guarantee?",
          "What would the unluckiest possible grab look like if we want two different colours?"
        ]
      },
      plan: {
        l1: [
          "If the goblin wants to delay giving you a second colour, which crystals will it keep handing you?",
          "Could the goblin keep giving you the very same colour until that whole colour runs completely out?",
          "What is the goblin’s trick to keep your crystals all the same colour for as long as possible?"
        ]
      },
      carry_out: {
        l1: [
          "Could the goblin keep giving you the very same colour until that whole colour runs completely out?",
          "What happens after the goblin runs out of crystals in its favorite colour?"
        ],
        l2: [
          "The goblin’s trick is now the opposite: it hands you the same colour for as long as it can. How long can that last, and what must the next grab be?"
        ],
        l3: [
          "Let the goblin hand you every single crystal of one colour until that bin is completely empty. What colour must the very next grab be?"
        ]
      },
      simpler_problem: {
        l4: [
          "If a tiny chest has red and blue crystals, and the goblin gives you all five red ones, what must the next grab be?"
        ]
      },
      look_back: {
        l0: [
          "Why did the Torch of Difference require so many more grabs than the Torch of Pairs did?"
        ]
      }
    }
  },

  // =========================================================================
  // 3. COURTYARD OF FIVE SHIELDS (ch1-n3-five-shields)
  // Givens [2, 3, 5, 66], Target 30, Forbidden [10, 22, 30]
  // =========================================================================
  'ch1-n3-five-shields': {
    a: {
      conjecture: [
        "Convince me in one sentence: how does the walk around one shield compare to the walk around the entire courtyard?"
      ],
      understand: {
        l0: [
          "What is the question asking for: the outside walk around the whole courtyard, or the distance around a single stone shield?",
          "What do we know as a number, and what do we know only as a shape fact?",
          "Where do the standing shields touch the lying ones, and what is special about that line?"
        ]
      },
      plan: {
        l1: [
          "Look at where the standing shields meet the flat shields: what does that shared middle seam tell us about their sides?",
          "Is there a card in the Deck about something the two rows share?",
          "Could you invent a small unit that measures both a short side and a long side with no leftover?"
        ]
      },
      carry_out: {
        l1: [
          "Without using numbers, how many short sides cover the exact same length as the long sides along the middle seam?",
          "What happens to the edges that touch along the middle seam when walking around the outside?"
        ],
        l2: [
          "Along the middle seam, three short sides match two long sides. Let a short side be 2 units and a long side be 3 units. How do the sides on the outer border match up?"
        ],
        l3: [
          "Count the outside walk in units: across top, bottom, and each side. Then find how many cubits each unit is worth, and find the distance around one shield?"
        ]
      },
      simpler_problem: {
        l4: [
          "If two identical squares sit side by side to make a rectangle, which edges lie hidden on the inside where they meet?"
        ]
      },
      look_back: {
        l0: [
          "When five shields are pushed together edge to edge, why does the outside walk measure less than five separate shields?"
        ]
      }
    }
  },

  // =========================================================================
  // 4. CASTLE KEEP PORTCULLIS (ch1-n4-castle-keep)
  // Givens [34, 85], Target 24, Forbidden [2, 5, 17, 24]
  // =========================================================================
  'ch1-n4-castle-keep': {
    a: {
      conjecture: [
        "Convince me in one sentence: why must the sum of the three prime runes equal the number you chose for the portcullis?"
      ],
      understand: {
        l0: [
          "What kind of number is a prime rune, and which Royal Guardian is named in both clue inscriptions on the arch?",
          "What is special about a prime rune: in how many ways can it be made by multiplying?",
          "What are we asked for at the end, a product or a sum?"
        ]
      },
      plan: {
        l1: [
          "Is there a card in the Deck about finding something shared between both clue numbers on the arch?",
          "If one rune sits inside both products, what must it be a factor of?",
          "Could you break each clue number into prime pieces and compare the pieces?"
        ]
      },
      carry_out: {
        l1: [
          "If Kimmy appears in both clues, what does that tell us about a prime factor shared by both clue numbers?",
          "Look at the shared guardian: how does breaking clue numbers into prime pieces reveal who holds what?"
        ],
        l2: [
          "Kimmy stands in both clues, so Kimmy divides both 34 and 85. When you break each clue into prime factors, which shared prime appears on both dials?"
        ],
        l3: [
          "Find the prime factor that 34 and 85 share to reveal Kimmy, then find the remaining prime factors for Jimmy and Timmy. Can you combine all three?"
        ]
      },
      simpler_problem: {
        l4: [
          "If a pair of runes multiplies to 21, and another pair multiplies to 77, which prime rune appears in both clues?"
        ]
      },
      look_back: {
        l0: [
          "Looking at the clue numbers on the arch, how could you know right away that Jimmy had to hold an even prime rune?"
        ]
      }
    }
  }
};

/**
 * Retrieves an authored fallback probe.
 * Always guaranteed to pass all 8 stages of the leak gate.
 *
 * @param {string} encounterId
 * @param {string} partId
 * @param {string} state - 'conjecture' | 'understand' | 'plan' | 'carry_out' | 'simpler_problem' | 'look_back'
 * @param {string} [rung='l0'] - 'l0' | 'l1' | 'l2' | 'l3' | 'l4'
 * @param {object} [options] - { index: number }
 * @returns {string} Authored probe string
 */
export function getScriptedProbe(encounterId, partId, state, rung = 'l0', options = {}) {
  const encProbes = SCRIPTED_PROBES[encounterId]?.[partId];
  if (!encProbes) {
    return "What do you notice about the clue, and what can we try next?";
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
    return "What do you notice about the clue, and what can we try next?";
  }

  const idx = options.index !== undefined ? options.index % candidates.length : 0;
  return candidates[idx];
}
