function applyDenseSlots(templateTree) {
  if (!templateTree || typeof templateTree !== "object") return;

  const fillRound = (round) => {
    if (!Array.isArray(round)) return;
    round.forEach((match, idx) => {
      if (!match || typeof match !== "object") return;
      if (!Number.isFinite(match.slot)) {
        match.slot = idx;
      }
    });
  };

  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((round) => fillRound(round));
      return;
    }
    Object.values(node).forEach((child) => walk(child));
  };

  walk(templateTree);
}

function tightenLosersSlots(templateTree) {
  if (!templateTree || typeof templateTree !== "object") return;

  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      // node is an array of rounds
      node.forEach((round) => {
        if (!Array.isArray(round)) return;
        round.forEach((match, idx) => {
          if (!match || typeof match !== "object") return;
          if (!Number.isFinite(match.slot)) {
            match.slot = idx; // dense, ordered slots to avoid overlap
          }
        });
      });
      return;
    }
    Object.values(node).forEach((child) => walk(child));
  };

  walk(templateTree);
}

export const WINNERS_TEMPLATES = {
  4: [
    // Round 1: A-B
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "player", seed: 4 },
      }, // A
      {
        slot: 1,
        a: { type: "player", seed: 2 },
        b: { type: "player", seed: 3 },
      }, // B
    ],
    // Round 2: C
    [
      {
        slot: 0.5,
        a: { type: "match", round: 0, match: 0, outcome: "winner" },
        b: { type: "match", round: 0, match: 1, outcome: "winner" },
      }, // C
    ],
  ],
  6: [
    // Round 1: A-B (two play-ins, seeds 1/2 get byes)
    [
      {
        slot: 0,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 6 },
      }, // A
      {
        slot: 1,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 5 },
      }, // B
    ],
    // Round 2: C-D (top seeds enter)
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // C
      {
        slot: 1,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" },
      }, // D
    ],
    // Round 3: E (final)
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // C
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // D
      }, // E
    ],
  ],
  7: [
    // Round 1: A-C (one bye for seed 1; three play-ins)
    [
      {
        slot: 0,
        a: { type: "player", seed: 2 },
        b: { type: "player", seed: 7 },
      }, // A
      {
        slot: 1,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 6 },
      }, // B
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 5 },
      }, // C
    ],
    // Round 2: D-E (top seed enters)
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // D
      {
        slot: 1,
        a: { type: "match", round: 0, match: 1, outcome: "winner" },
        b: { type: "match", round: 0, match: 2, outcome: "winner" },
      }, // E
    ],
    // Round 3: F
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // D
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // E
      }, // F
    ],
  ],
  8: [
    // Round 1: A-D
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "player", seed: 8 },
      }, // A
      {
        slot: 1,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 5 },
      }, // B
      {
        slot: 2,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 6 },
      }, // C
      {
        slot: 3,
        a: { type: "player", seed: 2 },
        b: { type: "player", seed: 7 },
      }, // D
    ],
    // Round 2: E, F
    [
      {
        slot: 0.5,
        a: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
        b: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
      }, // E
      {
        slot: 2.5,
        a: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // F
    ],
    // Round 3: G
    [
      {
        slot: 1.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // E
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // F
      }, // G
    ],
  ],
  5: [
    // Round 1: play-in
    [
      {
        slot: 0,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 5 },
      }, // A
    ],
    // Round 2
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // B
      {
        slot: 1,
        a: { type: "player", seed: 2 },
        b: { type: "player", seed: 3 },
      }, // C
    ],
    // Round 3
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" },
        b: { type: "match", round: 1, match: 1, outcome: "winner" },
      }, // D
    ],
  ],
  9: [
    // Round 1 (play-in): A
    [
      {
        slot: 0,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      },
    ],
    // Round 2: B, C, D, E
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // B
      {
        slot: 1,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 5 },
      }, // C
      {
        slot: 2,
        a: { type: "player", seed: 2 },
        b: { type: "player", seed: 7 },
      }, // D
      {
        slot: 3,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 6 },
      }, // E
    ],
    // Round 3: F, G
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" },
        b: { type: "match", round: 1, match: 1, outcome: "winner" },
      }, // F
      {
        slot: 1.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" },
        b: { type: "match", round: 1, match: 3, outcome: "winner" },
      }, // G
    ],
    // Round 4: H
    [
      {
        slot: 1,
        a: { type: "match", round: 2, match: 0, outcome: "winner" },
        b: { type: "match", round: 2, match: 1, outcome: "winner" },
      }, // H
    ],
  ],
  12: [
    // Round 1 (play-ins): A-D
    [
      {
        slot: 0,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // A
      {
        slot: 1,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 12 },
      }, // B
      {
        slot: 3,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // C
      {
        slot: 2,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // D
    ],
    // Round 2: E-H
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // E (1 vs A)
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" },
      }, // F (4 vs B)
      {
        slot: 3,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 2, outcome: "winner" },
      }, // G (3 vs D)
      {
        slot: 1,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" },
      }, // H (2 vs C)
    ],
    // Round 3: I, J
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // E
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // F
      }, // I
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // G
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // H
      }, // J
    ],
    // Round 4: K
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // I
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // J
      }, // K
    ],
  ],
  11: [
    // Round 1 (play-ins): A-C
    [
      {
        slot: 0,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // A
      {
        slot: 2, // leave a visual gap after A to reduce overlap
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // B
      {
        slot: 3,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // C
    ],
    // Round 2: D-G
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // D (1 vs A)
      {
        slot: 1,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 5 },
      }, // E (4 vs 5)
      {
        slot: 2,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" },
      }, // F (2 vs B)
      {
        slot: 3,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 2, outcome: "winner" },
      }, // G (3 vs C)
    ],
    // Round 3: H, I
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // D
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // E
      }, // H
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // F
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // G
      }, // I
    ],
    // Round 4: J
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // H
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // I
      }, // J
    ],
  ],
  13: [
    // Round 1: A-E (five play-ins)
    [
      {
        slot: 0,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // A (8 vs 9)
      {
        slot: 1,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 13 },
      }, // B (4 vs 13)
      {
        slot: 2,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 12 },
      }, // C (5 vs 12)
      {
        slot: 3,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // D (7 vs 10)
      {
        slot: 4,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // E (6 vs 11)
    ],
    // Round 2: F-I
    [
      {
        slot: 0.5,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // F (1 vs winner A)
      {
        slot: 1.5,
        a: { type: "match", round: 0, match: 1, outcome: "winner" },
        b: { type: "match", round: 0, match: 2, outcome: "winner" },
      }, // G (winner B vs winner C)
      {
        slot: 2.5,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" },
      }, // H (2 vs winner D)
      {
        slot: 3.5,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 4, outcome: "winner" },
      }, // I (3 vs winner E)
    ],
    // Round 3: J, K
    [
      {
        slot: 1.25,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // F
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // G
      }, // J
      {
        slot: 2.75,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // H
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // I
      }, // K
    ],
    // Round 4: L
    [
      {
        slot: 2,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // J
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // K
      }, // L
    ],
  ],
  14: [
    // Round 1: A-F (six play-ins, seeds 1/2 get byes)
    [
      {
        slot: 0,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // A
      {
        slot: 1,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 13 },
      }, // B
      {
        slot: 2,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 12 },
      }, // C
      {
        slot: 3,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // D
      {
        slot: 4,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 14 },
      }, // E
      {
        slot: 5,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // F
    ],
    // Round 2: G-J (top seeds enter)
    [
      {
        slot: 0.5,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // G
      {
        slot: 1.5,
        a: { type: "match", round: 0, match: 1, outcome: "winner" },
        b: { type: "match", round: 0, match: 2, outcome: "winner" },
      }, // H
      {
        slot: 3.5,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" },
      }, // I
      {
        slot: 4.5,
        a: { type: "match", round: 0, match: 4, outcome: "winner" },
        b: { type: "match", round: 0, match: 5, outcome: "winner" },
      }, // J
    ],
    // Round 3: K, L
    [
      {
        slot: 1,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // G
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // H
      }, // K
      {
        slot: 4,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // I
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // J
      }, // L
    ],
    // Round 4: M
    [
      {
        slot: 2.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // K
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // L
      }, // M
    ],
  ],
  15: [
    // Round 1: A-G (seven play-ins, seed 1 gets a bye)
    [
      {
        slot: 0,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // A
      {
        slot: 1,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 13 },
      }, // B
      {
        slot: 2,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 12 },
      }, // C
      {
        slot: 3,
        a: { type: "player", seed: 2 },
        b: { type: "player", seed: 15 },
      }, // D
      {
        slot: 4,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // E
      {
        slot: 5,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 14 },
      }, // F
      {
        slot: 6,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // G
    ],
    // Round 2: H-K
    [
      {
        slot: 0.5,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // H
      {
        slot: 1.5,
        a: { type: "match", round: 0, match: 1, outcome: "winner" },
        b: { type: "match", round: 0, match: 2, outcome: "winner" },
      }, // I
      {
        slot: 3.5,
        a: { type: "match", round: 0, match: 3, outcome: "winner" },
        b: { type: "match", round: 0, match: 4, outcome: "winner" },
      }, // J
      {
        slot: 5.5,
        a: { type: "match", round: 0, match: 5, outcome: "winner" },
        b: { type: "match", round: 0, match: 6, outcome: "winner" },
      }, // K
    ],
    // Round 3: L, M
    [
      {
        slot: 1,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // H
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // I
      }, // L
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // J
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // K
      }, // M
    ],
    // Round 4: N
    [
      {
        slot: 2.75,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // L
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // M
      }, // N
    ],
  ],
  16: [
    // Round 1: A-H
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "player", seed: 16 },
      }, // A
      {
        slot: 1,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // B
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 13 },
      }, // C
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 12 },
      }, // D
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "player", seed: 15 },
      }, // E
      {
        slot: 5,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // F
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 14 },
      }, // G
      {
        slot: 7,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // H
    ],
    // Round 2: I-L
    [
      {
        slot: 0,
        a: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
        b: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
      }, // I
      {
        slot: 1,
        a: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // J
      {
        slot: 2,
        a: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
        b: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
      }, // K
      {
        slot: 3,
        a: { type: "match", round: 0, match: 6, outcome: "winner" }, // G
        b: { type: "match", round: 0, match: 7, outcome: "winner" }, // H
      }, // L
    ],
    // Round 3: M, N
    [
      {
        slot: 0,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // I
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // J
      }, // M
      {
        slot: 1,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // K
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // L
      }, // N
    ],
    // Round 4: O
    [
      {
        slot: 0,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // M
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // N
      }, // O
    ],
  ],
  17: [
    // Round 0: play-in A
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A (play-in)
    ],
    // Round 1: B-I (full 16-player round with play-in winner)
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // B
      {
        slot: 1,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // C
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 13 },
      }, // D
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 12 },
      }, // E
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "player", seed: 15 },
      }, // F
      {
        slot: 5,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // G
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 14 },
      }, // H
      {
        slot: 7,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // I
    ],
    // Round 2: J, K, L, M
    [
      {
        slot: 0,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // B
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // C
      }, // J
      {
        slot: 1,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // D
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // E
      }, // K
      {
        slot: 2,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // F
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // G
      }, // L
      {
        slot: 3,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // H
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // I
      }, // M
    ],
    // Round 3: N, O
    [
      {
        slot: 0,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // J
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // K
      }, // N
      {
        slot: 1,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // L
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // M
      }, // O
    ],
    // Round 4: P
    [
      {
        slot: 0,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // N
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // O
      }, // P
    ],
  ],
  18: [
    // Round 0: play-ins A, B
    [
      {
        slot: 0, // top play-in
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 4, // lower play-in so G sits between F and H
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // B
    ],
    // Round 1: C-J (16-player first round with two play-in winners)
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // C
      {
        slot: 1,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // D
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 13 },
      }, // E
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 12 },
      }, // F
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" },
      }, // G
      {
        slot: 5,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // H
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 14 },
      }, // I
      {
        slot: 7,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // J
    ],
    // Round 2: K, L, M, N
    [
      {
        slot: 0,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // C
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // D
      }, // K
      {
        slot: 1,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // E
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // F
      }, // L
      {
        slot: 2,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // G
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // H
      }, // M
      {
        slot: 3,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // I
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // J
      }, // N
    ],
    // Round 3: O, P
    [
      {
        slot: 0,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // K
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // L
      }, // O
      {
        slot: 1,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // M
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // N
      }, // P
    ],
    // Round 4: Q
    [
      {
        slot: 0,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // O
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // P
      }, // Q
    ],
  ],
  19: [
    // Round 0: play-ins A, B, C
    [
      {
        slot: 0, // aligns with D (slot 0)
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 19 },
      }, // A
      {
        slot: 4, // aligns with H (slot 4)
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // B
      {
        slot: 6, // aligns with J (slot 6)
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 17 },
      }, // C
    ],
    // Round 1: D-K (16-player first round with three play-in winners)
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // D
      {
        slot: 1,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // E
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 13 },
      }, // F
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 12 },
      }, // G
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" },
      }, // H (uses play-in B)
      {
        slot: 5,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // I
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 2, outcome: "winner" },
      }, // J (uses play-in C)
      {
        slot: 7,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // K
    ],
    // Round 2: L, M, N, O
    [
      {
        slot: 0,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // D
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // E
      }, // L
      {
        slot: 1,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // F
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // G
      }, // M
      {
        slot: 2,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // H
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // I
      }, // N
      {
        slot: 3,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // J
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // K
      }, // O
    ],
    // Round 3: P, Q
    [
      {
        slot: 0,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // L
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // M
      }, // P
      {
        slot: 1,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // N
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // O
      }, // Q
    ],
    // Round 4: R
    [
      {
        slot: 0,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // P
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // Q
      }, // R
    ],
  ],
  20: [
    // Round 0 (play-ins): A-D
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // B
      {
        slot: 4,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // C
      {
        slot: 6,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // D
    ],
    // Round 1: E-L
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // E
      {
        slot: 1,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // F
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
      }, // G
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 12 },
      }, // H
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // I
      {
        slot: 5,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // J
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // K
      {
        slot: 7,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // L
    ],
    // Round 2: M, N, O, P
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // E
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // F
      }, // M
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // G
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // H
      }, // N
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // I
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // J
      }, // O
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // K
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // L
      }, // P
    ],
    // Round 3: Q, R
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // M
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // N
      }, // Q
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // O
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // P
      }, // R
    ],
    // Round 4: S (WB Final)
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // Q
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // R
      }, // S
    ],
  ],
  21: [
    // Round 0 (play-ins): A-E
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // B
      {
        slot: 3,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // C
      {
        slot: 4,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // D
      {
        slot: 6,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // E
    ],

    // Round 1: F-M
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // F
      {
        slot: 1,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // G
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
      }, // H
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // I
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // J
      {
        slot: 5,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // K
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
      }, // L
      {
        slot: 7,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 11 },
      }, // M
    ],

    // Round 2: N, O, P, Q
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // F
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // G
      }, // N
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // H
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // I
      }, // O
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // J
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // K
      }, // P
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // L
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // M
      }, // Q
    ],

    // Round 3: R, S
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // N
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // O
      }, // R
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // P
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // Q
      }, // S
    ],

    // Round 4: T (WB Final)
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // R
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // S
      }, // T
    ],
  ],
  22: [
    // Round 0 (play-ins): A-F
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // B
      {
        slot: 3,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // C
      {
        slot: 4,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // D
      {
        slot: 5,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // E
      {
        slot: 6,
        a: { type: "player", seed: 11 },
        b: { type: "player", seed: 22 },
      }, // F
    ],

    // Round 1: G-N
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // G
      {
        slot: 1,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // H
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
      }, // I
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // J
      {
        slot: 4.25,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // K
      {
        slot: 5.25,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // L
      {
        slot: 6.25,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
      }, // M
      {
        slot: 7.25,
        a: { type: "player", seed: 6 },
        b: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
      }, // N
    ],

    // Round 2: O-R
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // G
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // H
      }, // O
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // I
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // J
      }, // P
      {
        slot: 4.75,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // K
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // L
      }, // Q
      {
        slot: 6.75,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // M
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // N
      }, // R
    ],

    // Round 3: S, T
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // O
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // P
      }, // S
      {
        slot: 5.75,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // Q
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // R
      }, // T
    ],

    // Round 4: U (WB Final)
    [
      {
        slot: 3.625,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // S
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // T
      }, // U
    ],
  ],
  23: [
    // Round 0 (play-ins): A-G
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // B
      {
        slot: 3,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // C
      {
        slot: 4,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // D
      {
        slot: 5,
        a: { type: "player", seed: 10 },
        b: { type: "player", seed: 23 },
      }, // E
      {
        slot: 6,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // F
      {
        slot: 7,
        a: { type: "player", seed: 11 },
        b: { type: "player", seed: 22 },
      }, // G
    ],

    // Round 1: H-O
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // H
      {
        slot: 1,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // I
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
      }, // J
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // K
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // L
      {
        slot: 5,
        a: { type: "player", seed: 7 },
        b: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
      }, // M
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
      }, // N
      {
        slot: 7,
        a: { type: "player", seed: 6 },
        b: { type: "match", round: 0, match: 6, outcome: "winner" }, // G
      }, // O
    ],

    // Round 2 (Quarter-Final): P-S
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // H
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // I
      }, // P
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // J
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // K
      }, // Q
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // L
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // M
      }, // R
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // N
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // O
      }, // S
    ],

    // Round 3 (Semi-Final): T, U
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // P
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // Q
      }, // T
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // R
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // S
      }, // U
    ],

    // Round 4 (Final): V
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // T
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // U
      }, // V
    ],
  ],
  24: [
    // Round 0 (play-ins): A-H
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 9 },
        b: { type: "player", seed: 24 },
      }, // B
      {
        slot: 4,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // C
      {
        slot: 6,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // D
      {
        slot: 8,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // E
      {
        slot: 10,
        a: { type: "player", seed: 10 },
        b: { type: "player", seed: 23 },
      }, // F
      {
        slot: 12,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // G
      {
        slot: 14,
        a: { type: "player", seed: 11 },
        b: { type: "player", seed: 22 },
      }, // H
    ],

    // Round 1: I-P
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // I
      {
        slot: 1,
        a: { type: "player", seed: 8 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
      }, // J
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // K
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // L
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
      }, // M
      {
        slot: 5,
        a: { type: "player", seed: 7 },
        b: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
      }, // N
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 6, outcome: "winner" }, // G
      }, // O
      {
        slot: 7,
        a: { type: "player", seed: 6 },
        b: { type: "match", round: 0, match: 7, outcome: "winner" }, // H
      }, // P
    ],

    // Round 2 (Quarter-Final): Q-T
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // I
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // J
      }, // Q
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // K
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // L
      }, // R
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // M
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // N
      }, // S
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // O
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // P
      }, // T
    ],

    // Round 3 (Semi-Final): U, V
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // Q
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // R
      }, // U
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // S
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // T
      }, // V
    ],

    // Round 4 (Final): W
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // U
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // V
      }, // W
    ],
  ],
  25: [
    // Round 0 (play-ins): A-I
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 25 },
      }, // B
      {
        slot: 4,
        a: { type: "player", seed: 9 },
        b: { type: "player", seed: 24 },
      }, // C
      {
        slot: 6,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // D
      {
        slot: 8,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // E
      {
        slot: 10,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // F
      {
        slot: 12,
        a: { type: "player", seed: 10 },
        b: { type: "player", seed: 23 },
      }, // G
      {
        slot: 14,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // H
      {
        slot: 16,
        a: { type: "player", seed: 11 },
        b: { type: "player", seed: 22 },
      }, // I
    ],

    // Round 1: J-Q
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // J
      {
        slot: 1,
        a: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // K
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // L
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
      }, // M
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
      }, // N
      {
        slot: 5,
        a: { type: "player", seed: 7 },
        b: { type: "match", round: 0, match: 6, outcome: "winner" }, // G
      }, // O
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 7, outcome: "winner" }, // H
      }, // P
      {
        slot: 7,
        a: { type: "player", seed: 6 },
        b: { type: "match", round: 0, match: 8, outcome: "winner" }, // I
      }, // Q
    ],

    // Round 2 (Quarter-Final): R-U
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // J
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // K
      }, // R
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // L
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // M
      }, // S
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // N
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // O
      }, // T
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // P
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // Q
      }, // U
    ],

    // Round 3 (Semi-Final): V, W
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // R
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // S
      }, // V
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // T
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // U
      }, // W
    ],

    // Round 4 (Final): X
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // V
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // W
      }, // X
    ],
  ],
  26: [
    // Round 0 (play-ins): A-J
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 25 },
      }, // B
      {
        slot: 4,
        a: { type: "player", seed: 9 },
        b: { type: "player", seed: 24 },
      }, // C
      {
        slot: 6,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // D
      {
        slot: 8,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // E
      {
        slot: 10,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // F
      {
        slot: 12,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 26 },
      }, // G
      {
        slot: 14,
        a: { type: "player", seed: 10 },
        b: { type: "player", seed: 23 },
      }, // H
      {
        slot: 16,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // I
      {
        slot: 18,
        a: { type: "player", seed: 11 },
        b: { type: "player", seed: 22 },
      }, // J
    ],

    // Round 1: K-R
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // K
      {
        slot: 1,
        a: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // L
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // M
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
      }, // N
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
      }, // O
      {
        slot: 5,
        a: { type: "match", round: 0, match: 6, outcome: "winner" }, // G
        b: { type: "match", round: 0, match: 7, outcome: "winner" }, // H
      }, // P
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 8, outcome: "winner" }, // I
      }, // Q
      {
        slot: 7,
        a: { type: "player", seed: 6 },
        b: { type: "match", round: 0, match: 9, outcome: "winner" }, // J
      }, // R
    ],

    // Round 2 (Quarter-Final): S-V
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // K
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // L
      }, // S
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // M
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // N
      }, // T
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // O
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // P
      }, // U
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // Q
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // R
      }, // V
    ],

    // Round 3 (Semi-Final): W, X
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // S
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // T
      }, // W
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // U
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // V
      }, // X
    ],

    // Round 4 (Final): Y
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // W
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // X
      }, // Y
    ],
  ],
  27: [
    // Round 0 (play-ins): A-K
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 25 },
      }, // B
      {
        slot: 4,
        a: { type: "player", seed: 9 },
        b: { type: "player", seed: 24 },
      }, // C
      {
        slot: 6,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // D
      {
        slot: 8,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // E
      {
        slot: 10,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // F
      {
        slot: 12,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 26 },
      }, // G
      {
        slot: 14,
        a: { type: "player", seed: 10 },
        b: { type: "player", seed: 23 },
      }, // H
      {
        slot: 16,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // I
      {
        slot: 18,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 27 },
      }, // J
      {
        slot: 20,
        a: { type: "player", seed: 11 },
        b: { type: "player", seed: 22 },
      }, // K
    ],

    // Round 1: L-S
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // L
      {
        slot: 1,
        a: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // M
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // N
      {
        slot: 3,
        a: { type: "player", seed: 5 },
        b: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
      }, // O
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
      }, // P
      {
        slot: 5,
        a: { type: "match", round: 0, match: 6, outcome: "winner" }, // G
        b: { type: "match", round: 0, match: 7, outcome: "winner" }, // H
      }, // Q
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 8, outcome: "winner" }, // I
      }, // R
      {
        slot: 7,
        a: { type: "match", round: 0, match: 9, outcome: "winner" }, // J
        b: { type: "match", round: 0, match: 10, outcome: "winner" }, // K
      }, // S
    ],

    // Round 2 (Quarter-Final): T-W
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // L
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // M
      }, // T
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // N
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // O
      }, // U
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // P
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // Q
      }, // V
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // R
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // S
      }, // W
    ],

    // Round 3 (Semi-Final): X, Y
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // T
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // U
      }, // X
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // V
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // W
      }, // Y
    ],

    // Round 4 (Final): Z
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // X
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // Y
      }, // Z
    ],
  ],
  28: [
    // Round 0 (play-ins): A-L
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 25 },
      }, // B
      {
        slot: 4,
        a: { type: "player", seed: 9 },
        b: { type: "player", seed: 24 },
      }, // C
      {
        slot: 6,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // D
      {
        slot: 8,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 28 },
      }, // E
      {
        slot: 10,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // F
      {
        slot: 12,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // G
      {
        slot: 14,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 26 },
      }, // H
      {
        slot: 16,
        a: { type: "player", seed: 10 },
        b: { type: "player", seed: 23 },
      }, // I
      {
        slot: 18,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // J
      {
        slot: 20,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 27 },
      }, // K
      {
        slot: 22,
        a: { type: "player", seed: 11 },
        b: { type: "player", seed: 22 },
      }, // L
    ],

    // Round 1: M-T
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // M
      {
        slot: 1,
        a: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // N
      {
        slot: 2,
        a: { type: "player", seed: 4 },
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // O
      {
        slot: 3,
        a: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
        b: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
      }, // P
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 6, outcome: "winner" }, // G
      }, // Q
      {
        slot: 5,
        a: { type: "match", round: 0, match: 7, outcome: "winner" }, // H
        b: { type: "match", round: 0, match: 8, outcome: "winner" }, // I
      }, // R
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 9, outcome: "winner" }, // J
      }, // S
      {
        slot: 7,
        a: { type: "match", round: 0, match: 10, outcome: "winner" }, // K
        b: { type: "match", round: 0, match: 11, outcome: "winner" }, // L
      }, // T
    ],

    // Round 2 (Quarter-Final): U-X
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // M
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // N
      }, // U
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // O
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // P
      }, // V
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // Q
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // R
      }, // W
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // S
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // T
      }, // X
    ],

    // Round 3 (Semi-Final): Y, Z
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // U
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // V
      }, // Y
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // W
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // X
      }, // Z
    ],

    // Round 4 (Final): AA
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // Y
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // Z
      }, // AA
    ],
  ],
  29: [
    // Round 0 (play-ins): A-M
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 25 },
      }, // B
      {
        slot: 4,
        a: { type: "player", seed: 9 },
        b: { type: "player", seed: 24 },
      }, // C
      {
        slot: 6,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 29 },
      }, // D
      {
        slot: 8,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // E
      {
        slot: 10,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 28 },
      }, // F
      {
        slot: 12,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // G
      {
        slot: 14,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // H
      {
        slot: 16,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 26 },
      }, // I
      {
        slot: 18,
        a: { type: "player", seed: 10 },
        b: { type: "player", seed: 23 },
      }, // J
      {
        slot: 20,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // K
      {
        slot: 22,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 27 },
      }, // L
      {
        slot: 24,
        a: { type: "player", seed: 11 },
        b: { type: "player", seed: 22 },
      }, // M
    ],

    // Round 1: N-U
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // N
      {
        slot: 1,
        a: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // O
      {
        slot: 2,
        a: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
        b: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
      }, // P
      {
        slot: 3,
        a: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
        b: { type: "match", round: 0, match: 6, outcome: "winner" }, // G
      }, // Q
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 7, outcome: "winner" }, // H
      }, // R
      {
        slot: 5,
        a: { type: "match", round: 0, match: 8, outcome: "winner" }, // I
        b: { type: "match", round: 0, match: 9, outcome: "winner" }, // J
      }, // S
      {
        slot: 6,
        a: { type: "player", seed: 3 },
        b: { type: "match", round: 0, match: 10, outcome: "winner" }, // K
      }, // T
      {
        slot: 7,
        a: { type: "match", round: 0, match: 11, outcome: "winner" }, // L
        b: { type: "match", round: 0, match: 12, outcome: "winner" }, // M
      }, // U
    ],

    // Round 2 (Quarter-Final): V-Y
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // N
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // O
      }, // V
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // P
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // Q
      }, // W
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // R
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // S
      }, // X
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // T
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // U
      }, // Y
    ],

    // Round 3 (Semi-Final): Z, AA
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // V
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // W
      }, // Z
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // X
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // Y
      }, // AA
    ],

    // Round 4 (Final): AB
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // Z
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // AA
      }, // AB
    ],
  ],
  30: [
    // Round 0 (play-ins): A-N
    [
      {
        slot: 0,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 25 },
      }, // B
      {
        slot: 4,
        a: { type: "player", seed: 9 },
        b: { type: "player", seed: 24 },
      }, // C
      {
        slot: 6,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 29 },
      }, // D
      {
        slot: 8,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // E
      {
        slot: 10,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 28 },
      }, // F
      {
        slot: 12,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // G
      {
        slot: 14,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // H
      {
        slot: 16,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 26 },
      }, // I
      {
        slot: 18,
        a: { type: "player", seed: 10 },
        b: { type: "player", seed: 23 },
      }, // J
      {
        slot: 20,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // K
      {
        slot: 22,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 27 },
      }, // L
      {
        slot: 24,
        a: { type: "player", seed: 11 },
        b: { type: "player", seed: 22 },
      }, // M
      {
        slot: 26,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 30 },
      }, // N
    ],

    // Round 1: O-V
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
      }, // O
      {
        slot: 1,
        a: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
        b: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
      }, // P
      {
        slot: 2,
        a: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
        b: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
      }, // Q
      {
        slot: 3,
        a: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
        b: { type: "match", round: 0, match: 6, outcome: "winner" }, // G
      }, // R
      {
        slot: 4,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 7, outcome: "winner" }, // H
      }, // S
      {
        slot: 5,
        a: { type: "match", round: 0, match: 8, outcome: "winner" }, // I
        b: { type: "match", round: 0, match: 9, outcome: "winner" }, // J
      }, // T
      {
        slot: 6,
        a: { type: "match", round: 0, match: 10, outcome: "winner" }, // K
        b: { type: "match", round: 0, match: 11, outcome: "winner" }, // L
      }, // U
      {
        slot: 7,
        a: { type: "match", round: 0, match: 12, outcome: "winner" }, // M
        b: { type: "match", round: 0, match: 13, outcome: "winner" }, // N
      }, // V
    ],

    // Round 2 (Quarter-Final): W-Z
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // O
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // P
      }, // W
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // Q
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // R
      }, // X
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // S
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // T
      }, // Y
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // U
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // V
      }, // Z
    ],

    // Round 3 (Semi-Final): AA, AB
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // W
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // X
      }, // AA
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // Y
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // Z
      }, // AB
    ],

    // Round 4 (Final): AC
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // AA
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // AB
      }, // AC
    ],
  ],
  31: [
    // Winners Round 1: A-P (32-slot core with 1 bye)
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "player", seed: 32 }, // bye (no seed 32 for 31 entrants)
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 16 },
        b: { type: "player", seed: 17 },
      }, // B
      {
        slot: 4,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 25 },
      }, // C
      {
        slot: 6,
        a: { type: "player", seed: 9 },
        b: { type: "player", seed: 24 },
      }, // D
      {
        slot: 8,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 29 },
      }, // E
      {
        slot: 10,
        a: { type: "player", seed: 13 },
        b: { type: "player", seed: 20 },
      }, // F
      {
        slot: 12,
        a: { type: "player", seed: 5 },
        b: { type: "player", seed: 28 },
      }, // G
      {
        slot: 14,
        a: { type: "player", seed: 12 },
        b: { type: "player", seed: 21 },
      }, // H
      {
        slot: 16,
        a: { type: "player", seed: 2 },
        b: { type: "player", seed: 31 },
      }, // I
      {
        slot: 18,
        a: { type: "player", seed: 15 },
        b: { type: "player", seed: 18 },
      }, // J
      {
        slot: 20,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 26 },
      }, // K
      {
        slot: 22,
        a: { type: "player", seed: 10 },
        b: { type: "player", seed: 23 },
      }, // L
      {
        slot: 24,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 30 },
      }, // M
      {
        slot: 26,
        a: { type: "player", seed: 14 },
        b: { type: "player", seed: 19 },
      }, // N
      {
        slot: 28,
        a: { type: "player", seed: 6 },
        b: { type: "player", seed: 27 },
      }, // O
      {
        slot: 30,
        a: { type: "player", seed: 11 },
        b: { type: "player", seed: 22 },
      }, // P
    ],

    // Winners Round 2: Q-X
    [
      {
        slot: 0,
        a: { type: "match", round: 0, match: 0, outcome: "winner" }, // A
        b: { type: "match", round: 0, match: 1, outcome: "winner" }, // B
      }, // Q
      {
        slot: 1,
        a: { type: "match", round: 0, match: 2, outcome: "winner" }, // C
        b: { type: "match", round: 0, match: 3, outcome: "winner" }, // D
      }, // R
      {
        slot: 2,
        a: { type: "match", round: 0, match: 4, outcome: "winner" }, // E
        b: { type: "match", round: 0, match: 5, outcome: "winner" }, // F
      }, // S
      {
        slot: 3,
        a: { type: "match", round: 0, match: 6, outcome: "winner" }, // G
        b: { type: "match", round: 0, match: 7, outcome: "winner" }, // H
      }, // T
      {
        slot: 4,
        a: { type: "match", round: 0, match: 8, outcome: "winner" }, // I
        b: { type: "match", round: 0, match: 9, outcome: "winner" }, // J
      }, // U
      {
        slot: 5,
        a: { type: "match", round: 0, match: 10, outcome: "winner" }, // K
        b: { type: "match", round: 0, match: 11, outcome: "winner" }, // L
      }, // V
      {
        slot: 6,
        a: { type: "match", round: 0, match: 12, outcome: "winner" }, // M
        b: { type: "match", round: 0, match: 13, outcome: "winner" }, // N
      }, // W
      {
        slot: 7,
        a: { type: "match", round: 0, match: 14, outcome: "winner" }, // O
        b: { type: "match", round: 0, match: 15, outcome: "winner" }, // P
      }, // X
    ],

    // Winners Quarter-Final: Y-AB
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" }, // Q
        b: { type: "match", round: 1, match: 1, outcome: "winner" }, // R
      }, // Y
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" }, // S
        b: { type: "match", round: 1, match: 3, outcome: "winner" }, // T
      }, // Z
      {
        slot: 4.5,
        a: { type: "match", round: 1, match: 4, outcome: "winner" }, // U
        b: { type: "match", round: 1, match: 5, outcome: "winner" }, // V
      }, // AA
      {
        slot: 6.5,
        a: { type: "match", round: 1, match: 6, outcome: "winner" }, // W
        b: { type: "match", round: 1, match: 7, outcome: "winner" }, // X
      }, // AB
    ],

    // Winners Semi-Final: AC, AD
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" }, // Y
        b: { type: "match", round: 2, match: 1, outcome: "winner" }, // Z
      }, // AC
      {
        slot: 5.5,
        a: { type: "match", round: 2, match: 2, outcome: "winner" }, // AA
        b: { type: "match", round: 2, match: 3, outcome: "winner" }, // AB
      }, // AD
    ],

    // Winners Final: AE
    [
      {
        slot: 3.5,
        a: { type: "match", round: 3, match: 0, outcome: "winner" }, // AC
        b: { type: "match", round: 3, match: 1, outcome: "winner" }, // AD
      }, // AE
    ],
  ],
  10: [
    [
      {
        slot: 0,
        a: { type: "player", seed: 8 },
        b: { type: "player", seed: 9 },
      }, // A
      {
        slot: 2,
        a: { type: "player", seed: 7 },
        b: { type: "player", seed: 10 },
      }, // B
    ],
    [
      {
        slot: 0,
        a: { type: "player", seed: 1 },
        b: { type: "match", round: 0, match: 0, outcome: "winner" },
      }, // C
      {
        slot: 1,
        a: { type: "player", seed: 4 },
        b: { type: "player", seed: 5 },
      }, // D
      {
        slot: 2,
        a: { type: "player", seed: 2 },
        b: { type: "match", round: 0, match: 1, outcome: "winner" },
      }, // E
      {
        slot: 3,
        a: { type: "player", seed: 3 },
        b: { type: "player", seed: 6 },
      }, // F
    ],
    [
      {
        slot: 0.5,
        a: { type: "match", round: 1, match: 0, outcome: "winner" },
        b: { type: "match", round: 1, match: 1, outcome: "winner" },
      }, // G
      {
        slot: 2.5,
        a: { type: "match", round: 1, match: 2, outcome: "winner" },
        b: { type: "match", round: 1, match: 3, outcome: "winner" },
      }, // H
    ],
    [
      {
        slot: 1.5,
        a: { type: "match", round: 2, match: 0, outcome: "winner" },
        b: { type: "match", round: 2, match: 1, outcome: "winner" },
      }, // I
    ],
  ],
};

export const LOSERS_TEMPLATES = {
  8: {
    // 8 players (0 play-ins, total = 8) - start.gg layout (2/2/1/1)
    0: [
      // Round 0 (L1): J, K
      [
        {
          // J = loser(A) vs loser(B)
          a: { from: "W", r: 0, m: 0, res: "L" }, // A
          b: { from: "W", r: 0, m: 1, res: "L" }, // B
        },
        {
          // K = loser(C) vs loser(D)
          a: { from: "W", r: 0, m: 2, res: "L" }, // C
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
        },
      ],

      // Round 1 (LQF): L, M
      [
        {
          // L = loser(F) vs winner(J)
          a: { from: "W", r: 1, m: 1, res: "L" }, // F
          b: { from: "L", r: 0, m: 0, res: "W" }, // J
        },
        {
          // M = loser(E) vs winner(K)
          a: { from: "W", r: 1, m: 0, res: "L" }, // E
          b: { from: "L", r: 0, m: 1, res: "W" }, // K
        },
      ],

      // Round 2 (LSF): N
      [
        {
          // N = winner(L) vs winner(M)
          a: { from: "L", r: 1, m: 0, res: "W" }, // L
          b: { from: "L", r: 1, m: 1, res: "W" }, // M
        },
      ],

      // Round 3 (LFinal): O
      [
        {
          // O = loser(G) vs winner(N)
          a: { from: "W", r: 2, m: 0, res: "L" }, // G
          b: { from: "L", r: 2, m: 0, res: "W" }, // N
        },
      ],
    ],

    // 6 players (2 byes into an 8-slot core)
    byes: {
      // 7 players (1 bye into an 8-slot core) - start.gg layout
      1: [
        // Round 0 (L1): I
        [
          {
            // I = loser(B) vs loser(C)
            a: { from: "W", r: 0, m: 1, res: "L" }, // B
            b: { from: "W", r: 0, m: 2, res: "L" }, // C
            slot: 1, // push down one slot for spacing
          },
        ],

        // Round 1 (LQF): J, K
        [
          {
            // J = loser(E) vs loser(A)
            a: { from: "W", r: 1, m: 1, res: "L" }, // E
            b: { from: "W", r: 0, m: 0, res: "L" }, // A
            slot: 0,
          },
          {
            // K = loser(D) vs winner(I)
            a: { from: "W", r: 1, m: 0, res: "L" }, // D
            b: { from: "L", r: 0, m: 0, res: "W" }, // I
            slot: 3, // move down one slot for spacing
          },
        ],

        // Round 2 (LSF): L
        [
          {
            // L = winner(J) vs winner(K)
            a: { from: "L", r: 1, m: 0, res: "W" }, // J
            b: { from: "L", r: 1, m: 1, res: "W" }, // K
            slot: 1,
          },
        ],

        // Round 3 (LFinal): M
        [
          {
            // M = loser(F) vs winner(L)
            a: { from: "W", r: 2, m: 0, res: "L" }, // F
            b: { from: "L", r: 2, m: 0, res: "W" }, // L
            slot: 1,
          },
        ],
      ],

      2: [
        // Round 0 (LQF): H, I
        [
          {
            // H = loser(D) vs loser(A)
            a: { from: "W", r: 1, m: 1, res: "L" }, // D
            b: { from: "W", r: 0, m: 0, res: "L" }, // A
            slot: 0,
          },
          {
            // I = loser(C) vs loser(B)
            a: { from: "W", r: 1, m: 0, res: "L" }, // C
            b: { from: "W", r: 0, m: 1, res: "L" }, // B
            slot: 1,
          },
        ],

        // Round 1 (LSF): J
        [
          {
            // J = winner(H) vs winner(I)
            a: { from: "L", r: 0, m: 0, res: "W" }, // H
            b: { from: "L", r: 0, m: 1, res: "W" }, // I
            slot: 0.5,
          },
        ],

        // Round 2 (LFinal): K
        [
          {
            // K = loser(E) vs winner(J)
            a: { from: "W", r: 2, m: 0, res: "L" }, // E
            b: { from: "L", r: 1, m: 0, res: "W" }, // J
            slot: 0.5,
          },
        ],
      ],
    },

    // 9 players (1 play-in, total = 9)
    1: [
      // Round 0 (L1): K
      [
        {
          // K = loser(E) vs loser(A)
          a: { from: "W", r: 1, m: 3, res: "L" }, // E
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
      ],
      // Round 1 (L2): L, M
      [
        {
          // L = winner(K) vs loser(D)
          a: { from: "L", r: 0, m: 0, res: "W" }, // K
          b: { from: "W", r: 1, m: 2, res: "L" }, // D
          slot: 0,
        },
        {
          // M = loser(C) vs loser(B)
          a: { from: "W", r: 1, m: 1, res: "L" }, // C
          b: { from: "W", r: 1, m: 0, res: "L" }, // B
          slot: 1,
        },
      ],
      // Round 2 (L3 / LQF): N, O
      [
        {
          // N = loser(F) vs winner(L)
          a: { from: "W", r: 2, m: 0, res: "L" }, // F
          b: { from: "L", r: 1, m: 0, res: "W" }, // L
          slot: 0,
        },
        {
          // O = loser(G) vs winner(M)
          a: { from: "W", r: 2, m: 1, res: "L" }, // G
          b: { from: "L", r: 1, m: 1, res: "W" }, // M
          slot: 1,
        },
      ],
      // Round 3 (L4 / LSF): P
      [
        {
          // P = winner(N) vs winner(O)
          a: { from: "L", r: 2, m: 0, res: "W" },
          b: { from: "L", r: 2, m: 1, res: "W" },
          slot: 0,
        },
      ],
      // Round 4 (L5 / LFinal): Q
      [
        {
          // Q = loser(H) vs winner(P)
          a: { from: "W", r: 3, m: 0, res: "L" }, // H
          b: { from: "L", r: 3, m: 0, res: "W" }, // P
          slot: 0,
        },
      ],
    ],

    // 10 players (2 play-ins, total = 10)
    2: [
      // Round 0 (L1): K, L
      [
        {
          a: { from: "W", r: 1, m: 3, res: "L" }, // F
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
        },
        {
          a: { from: "W", r: 1, m: 1, res: "L" }, // D
          b: { from: "W", r: 0, m: 1, res: "L" }, // B
        },
      ],

      // Round 1 (L2): M, N
      [
        {
          a: { from: "L", r: 0, m: 0, res: "W" }, // K
          b: { from: "W", r: 1, m: 2, res: "L" }, // E
        },
        {
          a: { from: "W", r: 1, m: 0, res: "L" }, // C
          b: { from: "L", r: 0, m: 1, res: "W" }, // L
        },
      ],

      // Round 2 (L3 / LQF): O, P
      [
        {
          a: { from: "W", r: 2, m: 0, res: "L" }, // G
          b: { from: "L", r: 1, m: 0, res: "W" }, // M
        },
        {
          a: { from: "W", r: 2, m: 1, res: "L" }, // H
          b: { from: "L", r: 1, m: 1, res: "W" }, // N
        },
      ],

      // Round 3 (L4 / LSF): R
      [
        {
          a: { from: "L", r: 2, m: 0, res: "W" },
          b: { from: "L", r: 2, m: 1, res: "W" },
        },
      ],

      // Round 4 (L5 / LFinal): S
      [
        {
          a: { from: "W", r: 3, m: 0, res: "L" }, // I
          b: { from: "L", r: 3, m: 0, res: "W" }, // R
        },
      ],
    ],

    // 11 players (3 play-ins, total = 11)
    3: [
      // Round 0 (L1): M, N, O
      [
        {
          // M = loser(G) vs loser(A)
          a: { from: "W", r: 1, m: 3, res: "L" }, // G
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
        },
        {
          // N = loser(E) vs loser(B)
          a: { from: "W", r: 1, m: 1, res: "L" }, // E
          b: { from: "W", r: 0, m: 1, res: "L" }, // B
        },
        {
          // O = loser(D) vs loser(C)
          a: { from: "W", r: 1, m: 0, res: "L" }, // D
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
        },
      ],

      // Round 1 (L2): P, Q
      [
        {
          // P = winner(M) vs loser(F)
          a: { from: "L", r: 0, m: 0, res: "W" }, // M
          b: { from: "W", r: 1, m: 2, res: "L" }, // F
        },
        {
          // Q = winner(N) vs winner(O)
          a: { from: "L", r: 0, m: 1, res: "W" }, // N
          b: { from: "L", r: 0, m: 2, res: "W" }, // O
        },
      ],

      // Round 2 (L3 / LQF): R, S
      [
        {
          // R = loser(H) vs winner(P)
          a: { from: "W", r: 2, m: 0, res: "L" }, // H
          b: { from: "L", r: 1, m: 0, res: "W" }, // P
        },
        {
          // S = loser(I) vs winner(Q)
          a: { from: "W", r: 2, m: 1, res: "L" }, // I
          b: { from: "L", r: 1, m: 1, res: "W" }, // Q
        },
      ],

      // Round 3 (L4 / LSF): T
      [
        {
          // T = winner(R) vs winner(S)
          a: { from: "L", r: 2, m: 0, res: "W" }, // R
          b: { from: "L", r: 2, m: 1, res: "W" }, // S
        },
      ],

      // Round 4 (L5 / LFinal): U
      [
        {
          // U = loser(J) vs winner(T)
          a: { from: "W", r: 3, m: 0, res: "L" }, // J
          b: { from: "L", r: 3, m: 0, res: "W" }, // T
        },
      ],
    ],

    // 12 players (4 play-ins, total = 12)
    4: [
      // 12 players (4 play-ins, total = 12) — start.gg layout
      // Winners (for reference):
      // A: 8 vs 9, B: 5 vs 12, C: 7 vs 10, D: 6 vs 11
      // E: 1 vs winner(A), F: 4 vs winner(B), G: 2 vs winner(C), H: 3 vs winner(D)
      // I: winner(E) vs winner(F), J: winner(G) vs winner(H)
      // K: winner(I) vs winner(J)

      // Round 0 (L1): N, O, P, Q
      [
        {
          // N = loser(H) vs loser(A)
          a: { from: "W", r: 1, m: 3, res: "L" }, // H
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
        },
        {
          // O = loser(G) vs loser(B)
          a: { from: "W", r: 1, m: 2, res: "L" }, // G
          b: { from: "W", r: 0, m: 1, res: "L" }, // B
        },
        {
          // P = loser(F) vs loser(C)
          a: { from: "W", r: 1, m: 1, res: "L" }, // F
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
        },
        {
          // Q = loser(E) vs loser(D)
          a: { from: "W", r: 1, m: 0, res: "L" }, // E
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
        },
      ],

      // Round 1 (L2): R, S
      [
        {
          // R = winner(N) vs winner(O)
          a: { from: "L", r: 0, m: 0, res: "W" }, // N
          b: { from: "L", r: 0, m: 1, res: "W" }, // O
        },
        {
          // S = winner(P) vs winner(Q)
          a: { from: "L", r: 0, m: 2, res: "W" }, // P
          b: { from: "L", r: 0, m: 3, res: "W" }, // Q
        },
      ],

      // Round 2 (L3 / LQF): T, U
      [
        {
          // T = loser(I) vs winner(R)
          a: { from: "W", r: 2, m: 0, res: "L" }, // I
          b: { from: "L", r: 1, m: 0, res: "W" }, // R
        },
        {
          // U = loser(J) vs winner(S)
          a: { from: "W", r: 2, m: 1, res: "L" }, // J
          b: { from: "L", r: 1, m: 1, res: "W" }, // S
        },
      ],

      // Round 3 (L4 / LSF): V
      [
        {
          // V = winner(T) vs winner(U)
          a: { from: "L", r: 2, m: 0, res: "W" }, // T
          b: { from: "L", r: 2, m: 1, res: "W" }, // U
        },
      ],

      // Round 4 (L5 / LFinal): W
      [
        {
          // W = loser(K) vs winner(V)
          a: { from: "W", r: 3, m: 0, res: "L" }, // K
          b: { from: "L", r: 3, m: 0, res: "W" }, // V
        },
      ],
    ],

    // 13 players (5 play-ins, total = 13)
    5: [
      // Winners (for reference):
      // A: 8 vs 9, B: 4 vs 13, C: 5 vs 12, D: 7 vs 10, E: 6 vs 11
      // F: 1 vs winner(A), G: winner(B) vs winner(C), H: 2 vs winner(D), I: 3 vs winner(E)
      // J: winner(F) vs winner(G), K: winner(H) vs winner(I)
      // L: winner(J) vs winner(K)

      // Round 0 (L1): O
      [
        {
          // O = loser(B) vs loser(C)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 1, // move down one slot
        },
      ],

      // Round 1 (L2): P, Q, R, S
      [
        {
          // P = loser(I) vs loser(A)
          a: { from: "W", r: 1, m: 3, res: "L" }, // I
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // Q = loser(H) vs winner(O)
          a: { from: "W", r: 1, m: 2, res: "L" }, // H
          b: { from: "L", r: 0, m: 0, res: "W" }, // O
          slot: 1.5, // nudge down half a slot
        },
        {
          // R = loser(G) vs loser(D)
          a: { from: "W", r: 1, m: 1, res: "L" }, // G
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
          slot: 2,
        },
        {
          // S = loser(F) vs loser(E)
          a: { from: "W", r: 1, m: 0, res: "L" }, // F
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 3,
        },
      ],

      // Round 2 (L3): T, U
      [
        {
          // T = winner(P) vs winner(Q)
          a: { from: "L", r: 1, m: 0, res: "W" }, // P
          b: { from: "L", r: 1, m: 1, res: "W" }, // Q
          slot: 0,
        },
        {
          // U = winner(R) vs winner(S)
          a: { from: "L", r: 1, m: 2, res: "W" }, // R
          b: { from: "L", r: 1, m: 3, res: "W" }, // S
          slot: 1,
        },
      ],

      // Round 3 (LQF): V, W
      [
        {
          // V = loser(J) vs winner(T)
          a: { from: "W", r: 2, m: 0, res: "L" }, // J
          b: { from: "L", r: 2, m: 0, res: "W" }, // T
          slot: 0,
        },
        {
          // W = loser(K) vs winner(U)
          a: { from: "W", r: 2, m: 1, res: "L" }, // K
          b: { from: "L", r: 2, m: 1, res: "W" }, // U
          slot: 1,
        },
      ],

      // Round 4 (LSF): X
      [
        {
          // X = winner(V) vs winner(W)
          a: { from: "L", r: 3, m: 0, res: "W" }, // V
          b: { from: "L", r: 3, m: 1, res: "W" }, // W
          slot: 4,
        },
      ],

      // Round 5 (LFinal): Y
      [
        {
          // Y = loser(L) vs winner(X)
          a: { from: "W", r: 3, m: 0, res: "L" }, // L
          b: { from: "L", r: 4, m: 0, res: "W" }, // X
          slot: 4,
        },
      ],
    ],

    // 14 players (6 play-ins, total = 14)
    6: [
      // Winners (for reference):
      // A: 8 vs 9, B: 4 vs 13, C: 5 vs 12, D: 7 vs 10, E: 3 vs 14, F: 6 vs 11
      // G: 1 vs winner(A), H: winner(B) vs winner(C), I: 2 vs winner(D), J: winner(E) vs winner(F)
      // K: winner(G) vs winner(H), L: winner(I) vs winner(J)
      // M: winner(K) vs winner(L)

      // Round 0 (L1): P, Q
      [
        {
          // P = loser(B) vs loser(C)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 0,
        },
        {
          // Q = loser(E) vs loser(F)
          a: { from: "W", r: 0, m: 4, res: "L" }, // E
          b: { from: "W", r: 0, m: 5, res: "L" }, // F
          slot: 2.5, // move down half a slot
        },
      ],

      // Round 1 (L2): R, S, T, U
      [
        {
          // R = loser(J) vs loser(A)
          a: { from: "W", r: 1, m: 3, res: "L" }, // J
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 1, // move down one slot
        },
        {
          // S = loser(I) vs winner(P)
          a: { from: "W", r: 1, m: 2, res: "L" }, // I
          b: { from: "L", r: 0, m: 0, res: "W" }, // P
          slot: 2,
        },
        {
          // T = loser(H) vs loser(D)
          a: { from: "W", r: 1, m: 1, res: "L" }, // H
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
          slot: 4,
        },
        {
          // U = loser(G) vs winner(Q)
          a: { from: "W", r: 1, m: 0, res: "L" }, // G
          b: { from: "L", r: 0, m: 1, res: "W" }, // Q
          slot: 6,
        },
      ],

      // Round 2 (L3): V, W
      [
        {
          // V = winner(R) vs winner(S)
          a: { from: "L", r: 1, m: 0, res: "W" }, // R
          b: { from: "L", r: 1, m: 1, res: "W" }, // S
          slot: 1,
        },
        {
          // W = winner(T) vs winner(U)
          a: { from: "L", r: 1, m: 2, res: "W" }, // T
          b: { from: "L", r: 1, m: 3, res: "W" }, // U
          slot: 5,
        },
      ],

      // Round 3 (LQF): X, Y
      [
        {
          // X = loser(K) vs winner(V)
          a: { from: "W", r: 2, m: 0, res: "L" }, // K
          b: { from: "L", r: 2, m: 0, res: "W" }, // V
          slot: 2,
        },
        {
          // Y = loser(L) vs winner(W)
          a: { from: "W", r: 2, m: 1, res: "L" }, // L
          b: { from: "L", r: 2, m: 1, res: "W" }, // W
          slot: 6,
        },
      ],

      // Round 4 (LSF): Z
      [
        {
          // Z = winner(X) vs winner(Y)
          a: { from: "L", r: 3, m: 0, res: "W" }, // X
          b: { from: "L", r: 3, m: 1, res: "W" }, // Y
          slot: 4,
        },
      ],

      // Round 5 (LFinal): AA
      [
        {
          // AA = loser(M) vs winner(Z)
          a: { from: "W", r: 3, m: 0, res: "L" }, // M
          b: { from: "L", r: 4, m: 0, res: "W" }, // Z
          slot: 4,
        },
      ],
    ],

    // 15 players (7 play-ins, total = 15)
    7: [
      // Winners (for reference):
      // A: 8 vs 9, B: 4 vs 13, C: 5 vs 12, D: 2 vs 15, E: 7 vs 10, F: 3 vs 14, G: 6 vs 11
      // H: 1 vs winner(A), I: winner(B) vs winner(C), J: winner(D) vs winner(E), K: winner(F) vs winner(G)
      // L: winner(H) vs winner(I), M: winner(J) vs winner(K)
      // N: winner(L) vs winner(M)

      // Round 0 (L1): Q, R, S
      [
        {
          // Q = loser(B) vs loser(C)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 0,
        },
        {
          // R = loser(D) vs loser(E)
          a: { from: "W", r: 0, m: 3, res: "L" }, // D
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 1,
        },
        {
          // S = loser(F) vs loser(G)
          a: { from: "W", r: 0, m: 5, res: "L" }, // F
          b: { from: "W", r: 0, m: 6, res: "L" }, // G
          slot: 2,
        },
      ],

      // Round 1 (L2): T, U, V, W
      [
        {
          // T = loser(K) vs loser(A)
          a: { from: "W", r: 1, m: 3, res: "L" }, // K
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // U = loser(J) vs winner(Q)
          a: { from: "W", r: 1, m: 2, res: "L" }, // J
          b: { from: "L", r: 0, m: 0, res: "W" }, // Q
          slot: 1,
        },
        {
          // V = loser(I) vs winner(R)
          a: { from: "W", r: 1, m: 1, res: "L" }, // I
          b: { from: "L", r: 0, m: 1, res: "W" }, // R
          slot: 2,
        },
        {
          // W = loser(H) vs winner(S)
          a: { from: "W", r: 1, m: 0, res: "L" }, // H
          b: { from: "L", r: 0, m: 2, res: "W" }, // S
          slot: 3,
        },
      ],

      // Round 2 (L3): X, Y
      [
        {
          // X = winner(T) vs winner(U)
          a: { from: "L", r: 1, m: 0, res: "W" }, // T
          b: { from: "L", r: 1, m: 1, res: "W" }, // U
          slot: 0,
        },
        {
          // Y = winner(V) vs winner(W)
          a: { from: "L", r: 1, m: 2, res: "W" }, // V
          b: { from: "L", r: 1, m: 3, res: "W" }, // W
          slot: 2,
        },
      ],

      // Round 3 (LQF): Z, AA
      [
        {
          // Z = loser(L) vs winner(X)
          a: { from: "W", r: 2, m: 0, res: "L" }, // L
          b: { from: "L", r: 2, m: 0, res: "W" }, // X
          slot: 0,
        },
        {
          // AA = loser(M) vs winner(Y)
          a: { from: "W", r: 2, m: 1, res: "L" }, // M
          b: { from: "L", r: 2, m: 1, res: "W" }, // Y
          slot: 2,
        },
      ],

      // Round 4 (LSF): AB
      [
        {
          // AB = winner(Z) vs winner(AA)
          a: { from: "L", r: 3, m: 0, res: "W" }, // Z
          b: { from: "L", r: 3, m: 1, res: "W" }, // AA
          slot: 4,
        },
      ],

      // Round 5 (LFinal): AC
      [
        {
          // AC = loser(N) vs winner(AB)
          a: { from: "W", r: 3, m: 0, res: "L" }, // N
          b: { from: "L", r: 4, m: 0, res: "W" }, // AB
          slot: 4,
        },
      ],
    ],
  },

  32: {
    // 32 players (0 byes, total = 32) - start.gg layout
    0: [
      // Round 0 (L1): AH-AO
      [
        {
          // AH = loser(A) vs loser(B)
          a: { from: "W", r: 0, m: 0, res: "L" }, // A
          b: { from: "W", r: 0, m: 1, res: "L" }, // B
          slot: 0,
        },
        {
          // AI = loser(C) vs loser(D)
          a: { from: "W", r: 0, m: 2, res: "L" }, // C
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
          slot: 1,
        },
        {
          // AJ = loser(E) vs loser(F)
          a: { from: "W", r: 0, m: 4, res: "L" }, // E
          b: { from: "W", r: 0, m: 5, res: "L" }, // F
          slot: 2,
        },
        {
          // AK = loser(G) vs loser(H)
          a: { from: "W", r: 0, m: 6, res: "L" }, // G
          b: { from: "W", r: 0, m: 7, res: "L" }, // H
          slot: 3,
        },
        {
          // AL = loser(I) vs loser(J)
          a: { from: "W", r: 0, m: 8, res: "L" }, // I
          b: { from: "W", r: 0, m: 9, res: "L" }, // J
          slot: 4,
        },
        {
          // AM = loser(K) vs loser(L)
          a: { from: "W", r: 0, m: 10, res: "L" }, // K
          b: { from: "W", r: 0, m: 11, res: "L" }, // L
          slot: 5,
        },
        {
          // AN = loser(M) vs loser(N)
          a: { from: "W", r: 0, m: 12, res: "L" }, // M
          b: { from: "W", r: 0, m: 13, res: "L" }, // N
          slot: 6,
        },
        {
          // AO = loser(O) vs loser(P)
          a: { from: "W", r: 0, m: 14, res: "L" }, // O
          b: { from: "W", r: 0, m: 15, res: "L" }, // P
          slot: 7,
        },
      ],

      // Round 1 (L2): AP-AW
      [
        {
          // AP = loser(X) vs winner(AH)
          a: { from: "W", r: 1, m: 7, res: "L" }, // X
          b: { from: "L", r: 0, m: 0, res: "W" }, // AH
          slot: 0,
        },
        {
          // AQ = loser(W) vs winner(AI)
          a: { from: "W", r: 1, m: 6, res: "L" }, // W
          b: { from: "L", r: 0, m: 1, res: "W" }, // AI
          slot: 1,
        },
        {
          // AR = loser(V) vs winner(AJ)
          a: { from: "W", r: 1, m: 5, res: "L" }, // V
          b: { from: "L", r: 0, m: 2, res: "W" }, // AJ
          slot: 2,
        },
        {
          // AS = loser(U) vs winner(AK)
          a: { from: "W", r: 1, m: 4, res: "L" }, // U
          b: { from: "L", r: 0, m: 3, res: "W" }, // AK
          slot: 3,
        },
        {
          // AT = loser(T) vs winner(AL)
          a: { from: "W", r: 1, m: 3, res: "L" }, // T
          b: { from: "L", r: 0, m: 4, res: "W" }, // AL
          slot: 4,
        },
        {
          // AU = loser(S) vs winner(AM)
          a: { from: "W", r: 1, m: 2, res: "L" }, // S
          b: { from: "L", r: 0, m: 5, res: "W" }, // AM
          slot: 5,
        },
        {
          // AV = loser(R) vs winner(AN)
          a: { from: "W", r: 1, m: 1, res: "L" }, // R
          b: { from: "L", r: 0, m: 6, res: "W" }, // AN
          slot: 6,
        },
        {
          // AW = loser(Q) vs winner(AO)
          a: { from: "W", r: 1, m: 0, res: "L" }, // Q
          b: { from: "L", r: 0, m: 7, res: "W" }, // AO
          slot: 7,
        },
      ],

      // Round 2 (L3): AX-BA
      [
        {
          // AX = winner(AP) vs winner(AQ)
          a: { from: "L", r: 1, m: 0, res: "W" }, // AP
          b: { from: "L", r: 1, m: 1, res: "W" }, // AQ
          slot: 0.5,
        },
        {
          // AY = winner(AR) vs winner(AS)
          a: { from: "L", r: 1, m: 2, res: "W" }, // AR
          b: { from: "L", r: 1, m: 3, res: "W" }, // AS
          slot: 2.5,
        },
        {
          // AZ = winner(AT) vs winner(AU)
          a: { from: "L", r: 1, m: 4, res: "W" }, // AT
          b: { from: "L", r: 1, m: 5, res: "W" }, // AU
          slot: 4.5,
        },
        {
          // BA = winner(AV) vs winner(AW)
          a: { from: "L", r: 1, m: 6, res: "W" }, // AV
          b: { from: "L", r: 1, m: 7, res: "W" }, // AW
          slot: 6.5,
        },
      ],

      // Round 3 (L4): BB-BE (WB QF losers drop)
      [
        {
          // BB = loser(Z) vs winner(AX)
          a: { from: "W", r: 2, m: 1, res: "L" }, // Z
          b: { from: "L", r: 2, m: 0, res: "W" }, // AX
          slot: 1,
        },
        {
          // BC = loser(Y) vs winner(AY)
          a: { from: "W", r: 2, m: 0, res: "L" }, // Y
          b: { from: "L", r: 2, m: 1, res: "W" }, // AY
          slot: 3,
        },
        {
          // BD = loser(AB) vs winner(AZ)
          a: { from: "W", r: 2, m: 3, res: "L" }, // AB
          b: { from: "L", r: 2, m: 2, res: "W" }, // AZ
          slot: 5,
        },
        {
          // BE = loser(AA) vs winner(BA)
          a: { from: "W", r: 2, m: 2, res: "L" }, // AA
          b: { from: "L", r: 2, m: 3, res: "W" }, // BA
          slot: 7,
        },
      ],

      // Round 4 (L5): BF, BG
      [
        {
          // BF = winner(BB) vs winner(BC)
          a: { from: "L", r: 3, m: 0, res: "W" }, // BB
          b: { from: "L", r: 3, m: 1, res: "W" }, // BC
          slot: 2,
        },
        {
          // BG = winner(BD) vs winner(BE)
          a: { from: "L", r: 3, m: 2, res: "W" }, // BD
          b: { from: "L", r: 3, m: 3, res: "W" }, // BE
          slot: 6,
        },
      ],

      // Round 5 (LQF): BH, BI (WB SF losers drop)
      [
        {
          // BH = loser(AD) vs winner(BF)
          a: { from: "W", r: 3, m: 1, res: "L" }, // AD
          b: { from: "L", r: 4, m: 0, res: "W" }, // BF
          slot: 2,
        },
        {
          // BI = loser(AC) vs winner(BG)
          a: { from: "W", r: 3, m: 0, res: "L" }, // AC
          b: { from: "L", r: 4, m: 1, res: "W" }, // BG
          slot: 6,
        },
      ],

      // Round 6 (LSF): BJ
      [
        {
          // BJ = winner(BH) vs winner(BI)
          a: { from: "L", r: 5, m: 0, res: "W" }, // BH
          b: { from: "L", r: 5, m: 1, res: "W" }, // BI
          slot: 4,
        },
      ],

      // Round 7 (LFinal): BK
      [
        {
          // BK = loser(AE) vs winner(BJ)
          a: { from: "W", r: 4, m: 0, res: "L" }, // AE
          b: { from: "L", r: 6, m: 0, res: "W" }, // BJ
          slot: 4,
        },
      ],
    ],

    // 31 players (1 bye into a 32-slot core) - start.gg layout
    byes: {
      1: [
        // Round 0 (L1): AH-AO
        [
          {
            // AH = loser(A) vs loser(B)
            a: { from: "W", r: 0, m: 0, res: "L" }, // A
            b: { from: "W", r: 0, m: 1, res: "L" }, // B
            slot: 0,
          },
          {
            // AI = loser(C) vs loser(D)
            a: { from: "W", r: 0, m: 2, res: "L" }, // C
            b: { from: "W", r: 0, m: 3, res: "L" }, // D
            slot: 1,
          },
          {
            // AJ = loser(E) vs loser(F)
            a: { from: "W", r: 0, m: 4, res: "L" }, // E
            b: { from: "W", r: 0, m: 5, res: "L" }, // F
            slot: 2,
          },
          {
            // AK = loser(G) vs loser(H)
            a: { from: "W", r: 0, m: 6, res: "L" }, // G
            b: { from: "W", r: 0, m: 7, res: "L" }, // H
            slot: 3,
          },
          {
            // AL = loser(I) vs loser(J)
            a: { from: "W", r: 0, m: 8, res: "L" }, // I
            b: { from: "W", r: 0, m: 9, res: "L" }, // J
            slot: 4,
          },
          {
            // AM = loser(K) vs loser(L)
            a: { from: "W", r: 0, m: 10, res: "L" }, // K
            b: { from: "W", r: 0, m: 11, res: "L" }, // L
            slot: 5,
          },
          {
            // AN = loser(M) vs loser(N)
            a: { from: "W", r: 0, m: 12, res: "L" }, // M
            b: { from: "W", r: 0, m: 13, res: "L" }, // N
            slot: 6,
          },
          {
            // AO = loser(O) vs loser(P)
            a: { from: "W", r: 0, m: 14, res: "L" }, // O
            b: { from: "W", r: 0, m: 15, res: "L" }, // P
            slot: 7,
          },
        ],

        // Round 1 (L2): AP-AW
        [
          {
            // AP = loser(X) vs winner(AH)
            a: { from: "W", r: 1, m: 7, res: "L" }, // X
            b: { from: "L", r: 0, m: 0, res: "W" }, // AH
            slot: 0,
          },
          {
            // AQ = loser(W) vs winner(AI)
            a: { from: "W", r: 1, m: 6, res: "L" }, // W
            b: { from: "L", r: 0, m: 1, res: "W" }, // AI
            slot: 1,
          },
          {
            // AR = loser(V) vs winner(AJ)
            a: { from: "W", r: 1, m: 5, res: "L" }, // V
            b: { from: "L", r: 0, m: 2, res: "W" }, // AJ
            slot: 2,
          },
          {
            // AS = loser(U) vs winner(AK)
            a: { from: "W", r: 1, m: 4, res: "L" }, // U
            b: { from: "L", r: 0, m: 3, res: "W" }, // AK
            slot: 3,
          },
          {
            // AT = loser(T) vs winner(AL)
            a: { from: "W", r: 1, m: 3, res: "L" }, // T
            b: { from: "L", r: 0, m: 4, res: "W" }, // AL
            slot: 4,
          },
          {
            // AU = loser(S) vs winner(AM)
            a: { from: "W", r: 1, m: 2, res: "L" }, // S
            b: { from: "L", r: 0, m: 5, res: "W" }, // AM
            slot: 5,
          },
          {
            // AV = loser(R) vs winner(AN)
            a: { from: "W", r: 1, m: 1, res: "L" }, // R
            b: { from: "L", r: 0, m: 6, res: "W" }, // AN
            slot: 6,
          },
          {
            // AW = loser(Q) vs winner(AO)
            a: { from: "W", r: 1, m: 0, res: "L" }, // Q
            b: { from: "L", r: 0, m: 7, res: "W" }, // AO
            slot: 7,
          },
        ],

        // Round 2 (L3): AX-BA
        [
          {
            // AX = winner(AP) vs winner(AQ)
            a: { from: "L", r: 1, m: 0, res: "W" }, // AP
            b: { from: "L", r: 1, m: 1, res: "W" }, // AQ
            slot: 0.5,
          },
          {
            // AY = winner(AR) vs winner(AS)
            a: { from: "L", r: 1, m: 2, res: "W" }, // AR
            b: { from: "L", r: 1, m: 3, res: "W" }, // AS
            slot: 2.5,
          },
          {
            // AZ = winner(AT) vs winner(AU)
            a: { from: "L", r: 1, m: 4, res: "W" }, // AT
            b: { from: "L", r: 1, m: 5, res: "W" }, // AU
            slot: 4.5,
          },
          {
            // BA = winner(AV) vs winner(AW)
            a: { from: "L", r: 1, m: 6, res: "W" }, // AV
            b: { from: "L", r: 1, m: 7, res: "W" }, // AW
            slot: 6.5,
          },
        ],

        // Round 3 (L4): BB-BE (WB QF losers drop)
        [
          {
            // BB = loser(Z) vs winner(AX)
            a: { from: "W", r: 2, m: 1, res: "L" }, // Z
            b: { from: "L", r: 2, m: 0, res: "W" }, // AX
            slot: 1,
          },
          {
            // BC = loser(Y) vs winner(AY)
            a: { from: "W", r: 2, m: 0, res: "L" }, // Y
            b: { from: "L", r: 2, m: 1, res: "W" }, // AY
            slot: 3,
          },
          {
            // BD = loser(AB) vs winner(AZ)
            a: { from: "W", r: 2, m: 3, res: "L" }, // AB
            b: { from: "L", r: 2, m: 2, res: "W" }, // AZ
            slot: 5,
          },
          {
            // BE = loser(AA) vs winner(BA)
            a: { from: "W", r: 2, m: 2, res: "L" }, // AA
            b: { from: "L", r: 2, m: 3, res: "W" }, // BA
            slot: 7,
          },
        ],

        // Round 4 (L5): BF, BG
        [
          {
            // BF = winner(BB) vs winner(BC)
            a: { from: "L", r: 3, m: 0, res: "W" }, // BB
            b: { from: "L", r: 3, m: 1, res: "W" }, // BC
            slot: 2,
          },
          {
            // BG = winner(BD) vs winner(BE)
            a: { from: "L", r: 3, m: 2, res: "W" }, // BD
            b: { from: "L", r: 3, m: 3, res: "W" }, // BE
            slot: 6,
          },
        ],

        // Round 5 (LQF): BH, BI (WB SF losers drop)
        [
          {
            // BH = loser(AD) vs winner(BF)
            a: { from: "W", r: 3, m: 1, res: "L" }, // AD
            b: { from: "L", r: 4, m: 0, res: "W" }, // BF
            slot: 2,
          },
          {
            // BI = loser(AC) vs winner(BG)
            a: { from: "W", r: 3, m: 0, res: "L" }, // AC
            b: { from: "L", r: 4, m: 1, res: "W" }, // BG
            slot: 6,
          },
        ],

        // Round 6 (LSF): BJ
        [
          {
            // BJ = winner(BH) vs winner(BI)
            a: { from: "L", r: 5, m: 0, res: "W" }, // BH
            b: { from: "L", r: 5, m: 1, res: "W" }, // BI
            slot: 4,
          },
        ],

        // Round 7 (LFinal): BK
        [
          {
            // BK = loser(AE) vs winner(BJ)
            a: { from: "W", r: 4, m: 0, res: "L" }, // AE
            b: { from: "L", r: 6, m: 0, res: "W" }, // BJ
            slot: 4,
          },
        ],
      ],
    },
  },

  16: {
    // 16 players (0 play-ins, total = 16)
    0: [
      // Round 0 (L1): R, S, T, U
      [
        {
          // R = loser(B) vs loser(A)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // S = loser(D) vs loser(C)
          a: { from: "W", r: 0, m: 3, res: "L" }, // D
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 1,
        },
        {
          // T = loser(F) vs loser(E)
          a: { from: "W", r: 0, m: 5, res: "L" }, // F
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 2,
        },
        {
          // U = loser(H) vs loser(G)
          a: { from: "W", r: 0, m: 7, res: "L" }, // H
          b: { from: "W", r: 0, m: 6, res: "L" }, // G
          slot: 3,
        },
      ],

      // Round 1 (L2): V, W, X, Y
      [
        {
          // V = loser(I) vs winner(R)
          a: { from: "W", r: 1, m: 0, res: "L" }, // I
          b: { from: "L", r: 0, m: 0, res: "W" }, // R
          slot: 0,
        },
        {
          // W = loser(J) vs winner(S)
          a: { from: "W", r: 1, m: 1, res: "L" }, // J
          b: { from: "L", r: 0, m: 1, res: "W" }, // S
          slot: 1,
        },
        {
          // X = loser(K) vs winner(T)
          a: { from: "W", r: 1, m: 2, res: "L" }, // K
          b: { from: "L", r: 0, m: 2, res: "W" }, // T
          slot: 2,
        },
        {
          // Y = loser(L) vs winner(U)
          a: { from: "W", r: 1, m: 3, res: "L" }, // L
          b: { from: "L", r: 0, m: 3, res: "W" }, // U
          slot: 3,
        },
      ],

      // Round 2 (L3): Z, AA
      [
        {
          // Z = winner(V) vs winner(W)
          a: { from: "L", r: 1, m: 0, res: "W" }, // V
          b: { from: "L", r: 1, m: 1, res: "W" }, // W
          slot: 0,
        },
        {
          // AA = winner(X) vs winner(Y)
          a: { from: "L", r: 1, m: 2, res: "W" }, // X
          b: { from: "L", r: 1, m: 3, res: "W" }, // Y
          slot: 1,
        },
      ],

      // Round 3 (LQF): AB, AC
      [
        {
          // AB = loser(M) vs winner(Z)
          a: { from: "W", r: 2, m: 0, res: "L" }, // M
          b: { from: "L", r: 2, m: 0, res: "W" }, // Z
          slot: 0,
        },
        {
          // AC = loser(N) vs winner(AA)
          a: { from: "W", r: 2, m: 1, res: "L" }, // N
          b: { from: "L", r: 2, m: 1, res: "W" }, // AA
          slot: 1,
        },
      ],

      // Round 4 (LSF): AD
      [
        {
          // AD = winner(AB) vs winner(AC)
          a: { from: "L", r: 3, m: 0, res: "W" }, // AB
          b: { from: "L", r: 3, m: 1, res: "W" }, // AC
          slot: 0,
        },
      ],

      // Round 5 (LFinal): AE
      [
        {
          // AE = loser(O) vs winner(AD)
          a: { from: "W", r: 3, m: 0, res: "L" }, // O
          b: { from: "L", r: 4, m: 0, res: "W" }, // AD
          slot: 0,
        },
      ],
    ],

    // 22 players (6 play-ins, total = 22)
    6: [
      // Round 0 (L1): V-AA (play-in losers face early WB R1 losers)
      [
        {
          // V = loser(A) vs loser(H)
          a: { from: "W", r: 0, m: 0, res: "L" }, // A (16v17)
          b: { from: "W", r: 1, m: 1, res: "L" }, // H (8v9)
          slot: 0,
        },
        {
          // W = loser(B) vs loser(I)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B (13v20)
          b: { from: "W", r: 1, m: 2, res: "L" }, // I (4 vs winner B)
          slot: 1,
        },
        {
          // X = loser(C) vs loser(J)
          a: { from: "W", r: 0, m: 2, res: "L" }, // C (12v21)
          b: { from: "W", r: 1, m: 3, res: "L" }, // J (5 vs winner C)
          slot: 2,
        },
        {
          // Y = loser(D) vs loser(L)
          a: { from: "W", r: 0, m: 3, res: "L" }, // D (15v18)
          b: { from: "W", r: 1, m: 5, res: "L" }, // L (7 vs 10)
          slot: 3,
        },
        {
          // Z = loser(E) vs loser(M)
          a: { from: "W", r: 0, m: 4, res: "L" }, // E (14v19)
          b: { from: "W", r: 1, m: 6, res: "L" }, // M (3 vs winner E)
          slot: 4,
        },
        {
          // AA = loser(F) vs loser(N)
          a: { from: "W", r: 0, m: 5, res: "L" }, // F (11v22)
          b: { from: "W", r: 1, m: 7, res: "L" }, // N (6 vs winner F)
          slot: 5,
        },
      ],

      // Round 1 (L2): AB-AE (remaining WB R1 losers join)
      [
        {
          // AB = winner(V) vs loser(G)
          a: { from: "L", r: 0, m: 0, res: "W" }, // V
          b: { from: "W", r: 1, m: 0, res: "L" }, // G (1 vs winner A)
          slot: 0,
        },
        {
          // AC = winner(W) vs loser(K)
          a: { from: "L", r: 0, m: 1, res: "W" }, // W
          b: { from: "W", r: 1, m: 4, res: "L" }, // K (2 vs winner D)
          slot: 1,
        },
        {
          // AD = winner(X) vs winner(Y)
          a: { from: "L", r: 0, m: 2, res: "W" }, // X
          b: { from: "L", r: 0, m: 3, res: "W" }, // Y
          slot: 2,
        },
        {
          // AE = winner(Z) vs winner(AA)
          a: { from: "L", r: 0, m: 4, res: "W" }, // Z
          b: { from: "L", r: 0, m: 5, res: "W" }, // AA
          slot: 3,
        },
      ],

      // Round 2 (L3): AF-AI (WB R2 losers drop)
      [
        {
          // AF = loser(O) vs winner(AB)
          a: { from: "W", r: 2, m: 0, res: "L" }, // O
          b: { from: "L", r: 1, m: 0, res: "W" }, // AB
          slot: 0,
        },
        {
          // AG = loser(P) vs winner(AC)
          a: { from: "W", r: 2, m: 1, res: "L" }, // P
          b: { from: "L", r: 1, m: 1, res: "W" }, // AC
          slot: 1,
        },
        {
          // AH = loser(Q) vs winner(AD)
          a: { from: "W", r: 2, m: 2, res: "L" }, // Q
          b: { from: "L", r: 1, m: 2, res: "W" }, // AD
          slot: 2,
        },
        {
          // AI = loser(R) vs winner(AE)
          a: { from: "W", r: 2, m: 3, res: "L" }, // R
          b: { from: "L", r: 1, m: 3, res: "W" }, // AE
          slot: 3,
        },
      ],

      // Round 3 (L4): AJ, AK
      [
        {
          // AJ = winner(AF) vs winner(AG)
          a: { from: "L", r: 2, m: 0, res: "W" }, // AF
          b: { from: "L", r: 2, m: 1, res: "W" }, // AG
          slot: 0,
        },
        {
          // AK = winner(AH) vs winner(AI)
          a: { from: "L", r: 2, m: 2, res: "W" }, // AH
          b: { from: "L", r: 2, m: 3, res: "W" }, // AI
          slot: 1,
        },
      ],

      // Round 4 (L5): AL, AM (WB R3 losers drop)
      [
        {
          // AL = loser(S) vs winner(AJ)
          a: { from: "W", r: 3, m: 0, res: "L" }, // S
          b: { from: "L", r: 3, m: 0, res: "W" }, // AJ
          slot: 0,
        },
        {
          // AM = loser(T) vs winner(AK)
          a: { from: "W", r: 3, m: 1, res: "L" }, // T
          b: { from: "L", r: 3, m: 1, res: "W" }, // AK
          slot: 1,
        },
      ],

      // Round 5 (L6): AN
      [
        {
          // AN = winner(AL) vs winner(AM)
          a: { from: "L", r: 4, m: 0, res: "W" }, // AL
          b: { from: "L", r: 4, m: 1, res: "W" }, // AM
          slot: 0,
        },
      ],

      // Round 6 (LFinal): AO
      [
        {
          // AO = loser(U) vs winner(AN)
          a: { from: "W", r: 4, m: 0, res: "L" }, // U (WB final)
          b: { from: "L", r: 5, m: 0, res: "W" }, // AN
          slot: 0,
        },
      ],
    ],

    // 23 players (7 play-ins, total = 23)
    7: [
      // Round 0 (L1): Y-AE
      [
        {
          // Y = loser(O) vs loser(A)
          a: { from: "W", r: 1, m: 7, res: "L" }, // O
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // Z = loser(M) vs loser(B)
          a: { from: "W", r: 1, m: 5, res: "L" }, // M
          b: { from: "W", r: 0, m: 1, res: "L" }, // B
          slot: 1,
        },
        {
          // AA = loser(L) vs loser(C)
          a: { from: "W", r: 1, m: 4, res: "L" }, // L
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 2,
        },
        {
          // AB = loser(K) vs loser(D)
          a: { from: "W", r: 1, m: 3, res: "L" }, // K
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
          slot: 3,
        },
        {
          // AC = loser(J) vs loser(E)
          a: { from: "W", r: 1, m: 2, res: "L" }, // J
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 4,
        },
        {
          // AD = loser(I) vs loser(F)
          a: { from: "W", r: 1, m: 1, res: "L" }, // I
          b: { from: "W", r: 0, m: 5, res: "L" }, // F
          slot: 5,
        },
        {
          // AE = loser(H) vs loser(G)
          a: { from: "W", r: 1, m: 0, res: "L" }, // H
          b: { from: "W", r: 0, m: 6, res: "L" }, // G
          slot: 6,
        },
      ],

      // Round 1 (L2): AF-AI
      [
        {
          // AF = winner(Y) vs loser(N)
          a: { from: "L", r: 0, m: 0, res: "W" }, // Y
          b: { from: "W", r: 1, m: 6, res: "L" }, // N
          slot: 0,
        },
        {
          // AG = winner(Z) vs winner(AA)
          a: { from: "L", r: 0, m: 1, res: "W" }, // Z
          b: { from: "L", r: 0, m: 2, res: "W" }, // AA
          slot: 1,
        },
        {
          // AH = winner(AB) vs winner(AC)
          a: { from: "L", r: 0, m: 3, res: "W" }, // AB
          b: { from: "L", r: 0, m: 4, res: "W" }, // AC
          slot: 2,
        },
        {
          // AI = winner(AD) vs winner(AE)
          a: { from: "L", r: 0, m: 5, res: "W" }, // AD
          b: { from: "L", r: 0, m: 6, res: "W" }, // AE
          slot: 3,
        },
      ],

      // Round 2 (L3): AJ-AM (WB QF losers drop)
      [
        {
          // AJ = loser(P) vs winner(AF)
          a: { from: "W", r: 2, m: 0, res: "L" }, // P
          b: { from: "L", r: 1, m: 0, res: "W" }, // AF
          slot: 0,
        },
        {
          // AK = loser(Q) vs winner(AG)
          a: { from: "W", r: 2, m: 1, res: "L" }, // Q
          b: { from: "L", r: 1, m: 1, res: "W" }, // AG
          slot: 1,
        },
        {
          // AL = loser(R) vs winner(AH)
          a: { from: "W", r: 2, m: 2, res: "L" }, // R
          b: { from: "L", r: 1, m: 2, res: "W" }, // AH
          slot: 2,
        },
        {
          // AM = loser(S) vs winner(AI)
          a: { from: "W", r: 2, m: 3, res: "L" }, // S
          b: { from: "L", r: 1, m: 3, res: "W" }, // AI
          slot: 3,
        },
      ],

      // Round 3 (L4): AN, AO
      [
        {
          // AN = winner(AJ) vs winner(AK)
          a: { from: "L", r: 2, m: 0, res: "W" }, // AJ
          b: { from: "L", r: 2, m: 1, res: "W" }, // AK
          slot: 0,
        },
        {
          // AO = winner(AL) vs winner(AM)
          a: { from: "L", r: 2, m: 2, res: "W" }, // AL
          b: { from: "L", r: 2, m: 3, res: "W" }, // AM
          slot: 1,
        },
      ],

      // Round 4 (LQF): AP, AQ (WB SF losers drop)
      [
        {
          // AP = loser(U) vs winner(AN)
          a: { from: "W", r: 3, m: 1, res: "L" }, // U
          b: { from: "L", r: 3, m: 0, res: "W" }, // AN
          slot: 0,
        },
        {
          // AQ = loser(T) vs winner(AO)
          a: { from: "W", r: 3, m: 0, res: "L" }, // T
          b: { from: "L", r: 3, m: 1, res: "W" }, // AO
          slot: 1,
        },
      ],

      // Round 5 (LSF): AR
      [
        {
          // AR = winner(AP) vs winner(AQ)
          a: { from: "L", r: 4, m: 0, res: "W" }, // AP
          b: { from: "L", r: 4, m: 1, res: "W" }, // AQ
          slot: 0,
        },
      ],

      // Round 6 (LFinal): AS
      [
        {
          // AS = loser(V) vs winner(AR)
          a: { from: "W", r: 4, m: 0, res: "L" }, // V
          b: { from: "L", r: 5, m: 0, res: "W" }, // AR
          slot: 0,
        },
      ],
    ],

    // 24 players (8 play-ins, total = 24)
    8: [
      // Round 0 (L1): Z-AG (pair R1 losers with play-in losers)
      [
        {
          // Z = loser(P) vs loser(A)
          a: { from: "W", r: 1, m: 7, res: "L" }, // P
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // AA = loser(O) vs loser(B)
          a: { from: "W", r: 1, m: 6, res: "L" }, // O
          b: { from: "W", r: 0, m: 1, res: "L" }, // B
          slot: 1,
        },
        {
          // AB = loser(N) vs loser(C)
          a: { from: "W", r: 1, m: 5, res: "L" }, // N
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 2,
        },
        {
          // AC = loser(M) vs loser(D)
          a: { from: "W", r: 1, m: 4, res: "L" }, // M
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
          slot: 3,
        },
        {
          // AD = loser(L) vs loser(E)
          a: { from: "W", r: 1, m: 3, res: "L" }, // L
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 4,
        },
        {
          // AE = loser(K) vs loser(F)
          a: { from: "W", r: 1, m: 2, res: "L" }, // K
          b: { from: "W", r: 0, m: 5, res: "L" }, // F
          slot: 5,
        },
        {
          // AF = loser(J) vs loser(G)
          a: { from: "W", r: 1, m: 1, res: "L" }, // J
          b: { from: "W", r: 0, m: 6, res: "L" }, // G
          slot: 6,
        },
        {
          // AG = loser(I) vs loser(H)
          a: { from: "W", r: 1, m: 0, res: "L" }, // I
          b: { from: "W", r: 0, m: 7, res: "L" }, // H
          slot: 7,
        },
      ],

      // Round 1 (L2): AH-AK
      [
        {
          // AH = winner(Z) vs winner(AA)
          a: { from: "L", r: 0, m: 0, res: "W" }, // Z
          b: { from: "L", r: 0, m: 1, res: "W" }, // AA
          slot: 0,
        },
        {
          // AI = winner(AB) vs winner(AC)
          a: { from: "L", r: 0, m: 2, res: "W" }, // AB
          b: { from: "L", r: 0, m: 3, res: "W" }, // AC
          slot: 1,
        },
        {
          // AJ = winner(AD) vs winner(AE)
          a: { from: "L", r: 0, m: 4, res: "W" }, // AD
          b: { from: "L", r: 0, m: 5, res: "W" }, // AE
          slot: 2,
        },
        {
          // AK = winner(AF) vs winner(AG)
          a: { from: "L", r: 0, m: 6, res: "W" }, // AF
          b: { from: "L", r: 0, m: 7, res: "W" }, // AG
          slot: 3,
        },
      ],

      // Round 2 (L3): AL-AO (WB QF losers drop)
      [
        {
          // AL = loser(R) vs winner(AH)
          a: { from: "W", r: 2, m: 1, res: "L" }, // R
          b: { from: "L", r: 1, m: 0, res: "W" }, // AH
          slot: 0,
        },
        {
          // AM = loser(Q) vs winner(AI)
          a: { from: "W", r: 2, m: 0, res: "L" }, // Q
          b: { from: "L", r: 1, m: 1, res: "W" }, // AI
          slot: 1,
        },
        {
          // AN = loser(T) vs winner(AJ)
          a: { from: "W", r: 2, m: 3, res: "L" }, // T
          b: { from: "L", r: 1, m: 2, res: "W" }, // AJ
          slot: 2,
        },
        {
          // AO = loser(S) vs winner(AK)
          a: { from: "W", r: 2, m: 2, res: "L" }, // S
          b: { from: "L", r: 1, m: 3, res: "W" }, // AK
          slot: 3,
        },
      ],

      // Round 3 (L4): AP, AQ
      [
        {
          // AP = winner(AL) vs winner(AM)
          a: { from: "L", r: 2, m: 0, res: "W" }, // AL
          b: { from: "L", r: 2, m: 1, res: "W" }, // AM
          slot: 0,
        },
        {
          // AQ = winner(AN) vs winner(AO)
          a: { from: "L", r: 2, m: 2, res: "W" }, // AN
          b: { from: "L", r: 2, m: 3, res: "W" }, // AO
          slot: 1,
        },
      ],

      // Round 4 (LQF): AR, AS (WB SF losers drop)
      [
        {
          // AR = loser(V) vs winner(AP)
          a: { from: "W", r: 3, m: 1, res: "L" }, // V
          b: { from: "L", r: 3, m: 0, res: "W" }, // AP
          slot: 0,
        },
        {
          // AS = loser(U) vs winner(AQ)
          a: { from: "W", r: 3, m: 0, res: "L" }, // U
          b: { from: "L", r: 3, m: 1, res: "W" }, // AQ
          slot: 1,
        },
      ],

      // Round 5 (LSF): AT
      [
        {
          // AT = winner(AR) vs winner(AS)
          a: { from: "L", r: 4, m: 0, res: "W" }, // AR
          b: { from: "L", r: 4, m: 1, res: "W" }, // AS
          slot: 0,
        },
      ],

      // Round 6 (LFinal): AU
      [
        {
          // AU = loser(W) vs winner(AT)
          a: { from: "W", r: 4, m: 0, res: "L" }, // W
          b: { from: "L", r: 5, m: 0, res: "W" }, // AT
          slot: 0,
        },
      ],
    ],

    // 17-31 players (1-15 play-ins, total = 17-31) - use generic until defined
    1: [
      // Round 0 (L0): Q (reduce 9 losers to 8)
      [
        {
          // Q = loser(A) vs loser(B)
          a: { from: "W", r: 0, m: 0, res: "L" }, // A (play-in)
          b: { from: "W", r: 1, m: 0, res: "L" }, // B (1 vs winner A)
          slot: 0,
        },
      ],

      // Round 1 (L1): R, S, T, U
      [
        {
          // R = winner(Q) vs loser(C)
          a: { from: "L", r: 0, m: 0, res: "W" }, // Q
          b: { from: "W", r: 1, m: 1, res: "L" }, // C
          slot: 0,
        },
        {
          // S = loser(D) vs loser(E)
          a: { from: "W", r: 1, m: 2, res: "L" }, // D
          b: { from: "W", r: 1, m: 3, res: "L" }, // E
          slot: 1,
        },
        {
          // T = loser(F) vs loser(G)
          a: { from: "W", r: 1, m: 4, res: "L" }, // F
          b: { from: "W", r: 1, m: 5, res: "L" }, // G
          slot: 2,
        },
        {
          // U = loser(H) vs loser(I)
          a: { from: "W", r: 1, m: 6, res: "L" }, // H
          b: { from: "W", r: 1, m: 7, res: "L" }, // I
          slot: 3,
        },
      ],

      // Round 2 (L2): V, W, X, Y
      [
        {
          // V = loser(J) vs winner(R)
          a: { from: "W", r: 2, m: 0, res: "L" }, // J
          b: { from: "L", r: 1, m: 0, res: "W" }, // R
          slot: 0,
        },
        {
          // W = loser(K) vs winner(S)
          a: { from: "W", r: 2, m: 1, res: "L" }, // K
          b: { from: "L", r: 1, m: 1, res: "W" }, // S
          slot: 1,
        },
        {
          // X = loser(L) vs winner(T)
          a: { from: "W", r: 2, m: 2, res: "L" }, // L
          b: { from: "L", r: 1, m: 2, res: "W" }, // T
          slot: 2,
        },
        {
          // Y = loser(M) vs winner(U)
          a: { from: "W", r: 2, m: 3, res: "L" }, // M
          b: { from: "L", r: 1, m: 3, res: "W" }, // U
          slot: 3,
        },
      ],

      // Round 3 (L3): Z, AA
      [
        {
          // Z = winner(V) vs winner(W)
          a: { from: "L", r: 2, m: 0, res: "W" }, // V
          b: { from: "L", r: 2, m: 1, res: "W" }, // W
          slot: 0,
        },
        {
          // AA = winner(X) vs winner(Y)
          a: { from: "L", r: 2, m: 2, res: "W" }, // X
          b: { from: "L", r: 2, m: 3, res: "W" }, // Y
          slot: 1,
        },
      ],

      // Round 4 (LQF): AB, AC
      [
        {
          // AB = loser(N) vs winner(Z)
          a: { from: "W", r: 3, m: 0, res: "L" }, // N
          b: { from: "L", r: 3, m: 0, res: "W" }, // Z
          slot: 0,
        },
        {
          // AC = loser(O) vs winner(AA)
          a: { from: "W", r: 3, m: 1, res: "L" }, // O
          b: { from: "L", r: 3, m: 1, res: "W" }, // AA
          slot: 1,
        },
      ],

      // Round 5 (LSF): AD
      [
        {
          // AD = winner(AB) vs winner(AC)
          a: { from: "L", r: 4, m: 0, res: "W" }, // AB
          b: { from: "L", r: 4, m: 1, res: "W" }, // AC
          slot: 0,
        },
      ],

      // Round 6 (LFinal): AE
      [
        {
          // AE = loser(P) vs winner(AD)
          a: { from: "W", r: 4, m: 0, res: "L" }, // P (WB final)
          b: { from: "L", r: 5, m: 0, res: "W" }, // AD
          slot: 0,
        },
      ],
    ],
    2: [
      // Round 0 (L0): Q, R  (trim to 8 by pairing play-in losers)
      [
        {
          // Q = loser(A) vs loser(C)
          a: { from: "W", r: 0, m: 0, res: "L" }, // A (play-in)
          b: { from: "W", r: 0, m: 2, res: "L" }, // C (play-in)
          slot: 0,
        },
        {
          // R = loser(B) vs loser(D)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B (play-in)
          b: { from: "W", r: 1, m: 3, res: "L" }, // D
          slot: 1,
        },
      ],

      // Round 1 (L1): S, T, U, V
      [
        {
          // S = winner(Q) vs loser(E)
          a: { from: "L", r: 0, m: 0, res: "W" }, // Q
          b: { from: "W", r: 1, m: 1, res: "L" }, // E
          slot: 0,
        },
        {
          // T = winner(R) vs loser(F)
          a: { from: "L", r: 0, m: 1, res: "W" }, // R
          b: { from: "W", r: 1, m: 2, res: "L" }, // F
          slot: 1,
        },
        {
          // U = loser(G) vs loser(H)
          a: { from: "W", r: 1, m: 4, res: "L" }, // G
          b: { from: "W", r: 1, m: 5, res: "L" }, // H
          slot: 2,
        },
        {
          // V = loser(I) vs loser(J)
          a: { from: "W", r: 1, m: 6, res: "L" }, // I
          b: { from: "W", r: 1, m: 7, res: "L" }, // J
          slot: 3,
        },
      ],

      // Round 2 (L2): W, X, Y, Z
      [
        {
          // W = loser(K) vs winner(S)
          a: { from: "W", r: 2, m: 0, res: "L" }, // K
          b: { from: "L", r: 1, m: 0, res: "W" }, // S
          slot: 0,
        },
        {
          // X = loser(L) vs winner(T)
          a: { from: "W", r: 2, m: 1, res: "L" }, // L
          b: { from: "L", r: 1, m: 1, res: "W" }, // T
          slot: 1,
        },
        {
          // Y = loser(M) vs winner(U)
          a: { from: "W", r: 2, m: 2, res: "L" }, // M
          b: { from: "L", r: 1, m: 2, res: "W" }, // U
          slot: 2,
        },
        {
          // Z = loser(N) vs winner(V)
          a: { from: "W", r: 2, m: 3, res: "L" }, // N
          b: { from: "L", r: 1, m: 3, res: "W" }, // V
          slot: 3,
        },
      ],

      // Round 3 (L3): AA, AB
      [
        {
          // AA = winner(W) vs winner(X)
          a: { from: "L", r: 2, m: 0, res: "W" }, // W
          b: { from: "L", r: 2, m: 1, res: "W" }, // X
          slot: 0,
        },
        {
          // AB = winner(Y) vs winner(Z)
          a: { from: "L", r: 2, m: 2, res: "W" }, // Y
          b: { from: "L", r: 2, m: 3, res: "W" }, // Z
          slot: 1,
        },
      ],

      // Round 4 (LQF): AC, AD
      [
        {
          // AC = loser(O) vs winner(AA)
          a: { from: "W", r: 3, m: 0, res: "L" }, // O
          b: { from: "L", r: 3, m: 0, res: "W" }, // AA
          slot: 0,
        },
        {
          // AD = loser(P) vs winner(AB)
          a: { from: "W", r: 3, m: 1, res: "L" }, // P
          b: { from: "L", r: 3, m: 1, res: "W" }, // AB
          slot: 1,
        },
      ],

      // Round 5 (LSF): AE
      [
        {
          // AE = winner(AC) vs winner(AD)
          a: { from: "L", r: 4, m: 0, res: "W" }, // AC
          b: { from: "L", r: 4, m: 1, res: "W" }, // AD
          slot: 0,
        },
      ],

      // Round 6 (LFinal): AF
      [
        {
          // AF = loser(Q) vs winner(AE)
          a: { from: "W", r: 4, m: 0, res: "L" }, // Q (WB final)
          b: { from: "L", r: 5, m: 0, res: "W" }, // AE
          slot: 0,
        },
      ],
    ],

    // 19 players (3 play-ins, total = 19)
    3: [
      // Round 0 (L0): Q, R (pair play-in losers to reduce to 8)
      [
        {
          // Q = loser(A) vs loser(C)
          a: { from: "W", r: 0, m: 0, res: "L" }, // A
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 0,
        },
        {
          // R = loser(B) vs loser(E)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 1, m: 1, res: "L" }, // E
          slot: 1,
        },
      ],

      // Round 1 (L1): S, T, U, V (remaining R1 losers plus L0 winners)
      [
        {
          // S = winner(Q) vs loser(D)
          a: { from: "L", r: 0, m: 0, res: "W" }, // Q
          b: { from: "W", r: 1, m: 0, res: "L" }, // D
          slot: 0,
        },
        {
          // T = winner(R) vs loser(F)
          a: { from: "L", r: 0, m: 1, res: "W" }, // R
          b: { from: "W", r: 1, m: 2, res: "L" }, // F
          slot: 1,
        },
        {
          // U = loser(G) vs loser(H)
          a: { from: "W", r: 1, m: 3, res: "L" }, // G
          b: { from: "W", r: 1, m: 4, res: "L" }, // H
          slot: 2,
        },
        {
          // V = loser(I) vs loser(J)
          a: { from: "W", r: 1, m: 5, res: "L" }, // I
          b: { from: "W", r: 1, m: 6, res: "L" }, // J
          slot: 3,
        },
      ],

      // Round 2 (L2): W, X, Y, Z (WB R2 losers drop)
      [
        {
          // W = loser(L) vs winner(S)
          a: { from: "W", r: 2, m: 0, res: "L" }, // L
          b: { from: "L", r: 1, m: 0, res: "W" }, // S
          slot: 0,
        },
        {
          // X = loser(M) vs winner(T)
          a: { from: "W", r: 2, m: 1, res: "L" }, // M
          b: { from: "L", r: 1, m: 1, res: "W" }, // T
          slot: 1,
        },
        {
          // Y = loser(N) vs winner(U)
          a: { from: "W", r: 2, m: 2, res: "L" }, // N
          b: { from: "L", r: 1, m: 2, res: "W" }, // U
          slot: 2,
        },
        {
          // Z = loser(O) vs winner(V)
          a: { from: "W", r: 2, m: 3, res: "L" }, // O
          b: { from: "L", r: 1, m: 3, res: "W" }, // V
          slot: 3,
        },
      ],

      // Round 3 (L3): AA, AB
      [
        {
          // AA = winner(W) vs winner(X)
          a: { from: "L", r: 2, m: 0, res: "W" },
          b: { from: "L", r: 2, m: 1, res: "W" },
          slot: 0,
        },
        {
          // AB = winner(Y) vs winner(Z)
          a: { from: "L", r: 2, m: 2, res: "W" },
          b: { from: "L", r: 2, m: 3, res: "W" },
          slot: 1,
        },
      ],

      // Round 4 (LQF): AC, AD
      [
        {
          // AC = loser(P) vs winner(AA)
          a: { from: "W", r: 3, m: 0, res: "L" }, // P
          b: { from: "L", r: 3, m: 0, res: "W" }, // AA
          slot: 0,
        },
        {
          // AD = loser(Q) vs winner(AB)
          a: { from: "W", r: 3, m: 1, res: "L" }, // Q
          b: { from: "L", r: 3, m: 1, res: "W" }, // AB
          slot: 1,
        },
      ],

      // Round 5 (LSF): AE
      [
        {
          // AE = winner(AC) vs winner(AD)
          a: { from: "L", r: 4, m: 0, res: "W" },
          b: { from: "L", r: 4, m: 1, res: "W" },
          slot: 0,
        },
      ],

      // Round 6 (LFinal): AF
      [
        {
          // AF = loser(R) vs winner(AE)
          a: { from: "W", r: 4, m: 0, res: "L" },
          b: { from: "L", r: 5, m: 0, res: "W" },
          slot: 0,
        },
      ],
    ],
    // 20 players (4 play-ins, total = 20)
    4: [
      // Round 0 (L0): pair play-in losers so we have 8 advancing
      [
        {
          // Q = loser(A) vs loser(C)
          a: { from: "W", r: 0, m: 0, res: "L" }, // A (play-in 16v17)
          b: { from: "W", r: 0, m: 2, res: "L" }, // C (play-in 15v18)
          slot: 0,
        },
        {
          // R = loser(B) vs loser(D)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B (play-in 13v20)
          b: { from: "W", r: 0, m: 3, res: "L" }, // D (play-in 14v19)
          slot: 1,
        },
      ],

      // Round 1 (L1): S, T, U, V (first wave of WB R1 losers join L0 winners)
      [
        {
          // S = winner(Q) vs loser(G)
          a: { from: "L", r: 0, m: 0, res: "W" }, // Q
          b: { from: "W", r: 1, m: 2, res: "L" }, // G
          slot: 0,
        },
        {
          // T = winner(R) vs loser(H)
          a: { from: "L", r: 0, m: 1, res: "W" }, // R
          b: { from: "W", r: 1, m: 3, res: "L" }, // H
          slot: 1,
        },
        {
          // U = loser(I) vs loser(J)
          a: { from: "W", r: 1, m: 4, res: "L" }, // I
          b: { from: "W", r: 1, m: 5, res: "L" }, // J
          slot: 2,
        },
        {
          // V = loser(E) vs loser(F)
          a: { from: "W", r: 1, m: 0, res: "L" }, // E
          b: { from: "W", r: 1, m: 1, res: "L" }, // F
          slot: 3,
        },
      ],

      // Round 2 (L2): W, X, Y, Z (WB R2 losers drop)
      [
        {
          // W = loser(M) vs winner(S)
          a: { from: "W", r: 2, m: 0, res: "L" }, // M
          b: { from: "L", r: 1, m: 0, res: "W" }, // S
          slot: 0,
        },
        {
          // X = loser(N) vs winner(T)
          a: { from: "W", r: 2, m: 1, res: "L" }, // N
          b: { from: "L", r: 1, m: 1, res: "W" }, // T
          slot: 1,
        },
        {
          // Y = loser(O) vs winner(U)
          a: { from: "W", r: 2, m: 2, res: "L" }, // O
          b: { from: "L", r: 1, m: 2, res: "W" }, // U
          slot: 2,
        },
        {
          // Z = loser(P) vs winner(V)
          a: { from: "W", r: 2, m: 3, res: "L" }, // P
          b: { from: "L", r: 1, m: 3, res: "W" }, // V
          slot: 3,
        },
      ],

      // Round 3 (LQF): AA, AB
      [
        {
          // AA = winner(W) vs winner(X)
          a: { from: "L", r: 2, m: 0, res: "W" },
          b: { from: "L", r: 2, m: 1, res: "W" },
          slot: 0,
        },
        {
          // AB = winner(Y) vs winner(Z)
          a: { from: "L", r: 2, m: 2, res: "W" },
          b: { from: "L", r: 2, m: 3, res: "W" },
          slot: 1,
        },
      ],

      // Round 4 (LSF): AC
      [
        {
          // AC = loser(Q) vs winner(AA)
          a: { from: "W", r: 3, m: 0, res: "L" }, // Q (WB round 3)
          b: { from: "L", r: 3, m: 0, res: "W" }, // AA
          slot: 0,
        },
        {
          // AD = loser(R) vs winner(AB)
          a: { from: "W", r: 3, m: 1, res: "L" }, // R (WB round 3)
          b: { from: "L", r: 3, m: 1, res: "W" }, // AB
          slot: 1,
        },
      ],

      // Round 5 (LQF2): AE
      [
        {
          // AE = winner(AC) vs winner(AD)
          a: { from: "L", r: 4, m: 0, res: "W" },
          b: { from: "L", r: 4, m: 1, res: "W" },
          slot: 0,
        },
      ],

      // Round 6 (LFinal): AF
      [
        {
          // AF = loser(S) vs winner(AE)
          a: { from: "W", r: 4, m: 0, res: "L" }, // S (WB final)
          b: { from: "L", r: 5, m: 0, res: "W" }, // AE
          slot: 0,
        },
      ],
    ],

    // 21 players (5 play-ins, total = 21)
    5: [
      // Round 0 (L1): V-Z (play-in losers enter immediately)
      [
        {
          // V = loser(A) vs loser(G)
          a: { from: "W", r: 0, m: 0, res: "L" }, // A
          b: { from: "W", r: 1, m: 1, res: "L" }, // G
          slot: 0,
        },
        {
          // W = loser(B) vs loser(K)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 1, m: 5, res: "L" }, // K
          slot: 1,
        },
        {
          // X = loser(C) vs loser(M)
          a: { from: "W", r: 0, m: 2, res: "L" }, // C
          b: { from: "W", r: 1, m: 7, res: "L" }, // M
          slot: 2,
        },
        {
          // Y = loser(D) vs loser(H)
          a: { from: "W", r: 0, m: 3, res: "L" }, // D
          b: { from: "W", r: 1, m: 2, res: "L" }, // H
          slot: 3,
        },
        {
          // Z = loser(E) vs loser(J)
          a: { from: "W", r: 0, m: 4, res: "L" }, // E
          b: { from: "W", r: 1, m: 4, res: "L" }, // J
          slot: 4,
        },
      ],

      // Round 1 (L2): AA-AD (remaining WB R1 losers join)
      [
        {
          // AA = winner(V) vs loser(F)
          a: { from: "L", r: 0, m: 0, res: "W" }, // V
          b: { from: "W", r: 1, m: 0, res: "L" }, // F
          slot: 0,
        },
        {
          // AB = winner(W) vs loser(I)
          a: { from: "L", r: 0, m: 1, res: "W" }, // W
          b: { from: "W", r: 1, m: 3, res: "L" }, // I
          slot: 1,
        },
        {
          // AC = winner(X) vs loser(L)
          a: { from: "L", r: 0, m: 2, res: "W" }, // X
          b: { from: "W", r: 1, m: 6, res: "L" }, // L
          slot: 2,
        },
        {
          // AD = winner(Y) vs winner(Z)
          a: { from: "L", r: 0, m: 3, res: "W" }, // Y
          b: { from: "L", r: 0, m: 4, res: "W" }, // Z
          slot: 3,
        },
      ],

      // Round 2 (L3): AE-AH (WB R2 losers drop)
      [
        {
          // AE = loser(N) vs winner(AA)
          a: { from: "W", r: 2, m: 0, res: "L" }, // N
          b: { from: "L", r: 1, m: 0, res: "W" }, // AA
          slot: 0,
        },
        {
          // AF = loser(O) vs winner(AB)
          a: { from: "W", r: 2, m: 1, res: "L" }, // O
          b: { from: "L", r: 1, m: 1, res: "W" }, // AB
          slot: 1,
        },
        {
          // AG = loser(P) vs winner(AC)
          a: { from: "W", r: 2, m: 2, res: "L" }, // P
          b: { from: "L", r: 1, m: 2, res: "W" }, // AC
          slot: 2,
        },
        {
          // AH = loser(Q) vs winner(AD)
          a: { from: "W", r: 2, m: 3, res: "L" }, // Q
          b: { from: "L", r: 1, m: 3, res: "W" }, // AD
          slot: 3,
        },
      ],

      // Round 3 (L4): AI, AJ
      [
        {
          // AI = winner(AE) vs winner(AF)
          a: { from: "L", r: 2, m: 0, res: "W" }, // AE
          b: { from: "L", r: 2, m: 1, res: "W" }, // AF
          slot: 0,
        },
        {
          // AJ = winner(AG) vs winner(AH)
          a: { from: "L", r: 2, m: 2, res: "W" }, // AG
          b: { from: "L", r: 2, m: 3, res: "W" }, // AH
          slot: 1,
        },
      ],

      // Round 4 (L5): AK, AL (WB R3 losers drop)
      [
        {
          // AK = loser(R) vs winner(AI)
          a: { from: "W", r: 3, m: 0, res: "L" }, // R
          b: { from: "L", r: 3, m: 0, res: "W" }, // AI
          slot: 0,
        },
        {
          // AL = loser(S) vs winner(AJ)
          a: { from: "W", r: 3, m: 1, res: "L" }, // S
          b: { from: "L", r: 3, m: 1, res: "W" }, // AJ
          slot: 1,
        },
      ],

      // Round 5 (L6): AM
      [
        {
          // AM = winner(AK) vs winner(AL)
          a: { from: "L", r: 4, m: 0, res: "W" }, // AK
          b: { from: "L", r: 4, m: 1, res: "W" }, // AL
          slot: 0,
        },
      ],

      // Round 6 (LFinal): AN
      [
        {
          // AN = loser(T) vs winner(AM)
          a: { from: "W", r: 4, m: 0, res: "L" }, // T (WB final)
          b: { from: "L", r: 5, m: 0, res: "W" }, // AM
          slot: 0,
        },
      ],
    ],

    // 25 players (9 play-ins, total = 25)
    9: [
      // Round 0 (L1): AA
      [
        {
          // AA = loser(B) vs loser(C)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 1,
        },
      ],

      // Round 1 (L2): AB-AI
      [
        {
          // AB = loser(Q) vs loser(A)
          a: { from: "W", r: 1, m: 7, res: "L" }, // Q
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // AC = loser(P) vs winner(AA)
          a: { from: "W", r: 1, m: 6, res: "L" }, // P
          b: { from: "L", r: 0, m: 0, res: "W" }, // AA
          slot: 1,
        },
        {
          // AD = loser(O) vs loser(D)
          a: { from: "W", r: 1, m: 5, res: "L" }, // O
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
          slot: 2,
        },
        {
          // AE = loser(N) vs loser(E)
          a: { from: "W", r: 1, m: 4, res: "L" }, // N
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 3,
        },
        {
          // AF = loser(M) vs loser(F)
          a: { from: "W", r: 1, m: 3, res: "L" }, // M
          b: { from: "W", r: 0, m: 5, res: "L" }, // F
          slot: 4,
        },
        {
          // AG = loser(L) vs loser(G)
          a: { from: "W", r: 1, m: 2, res: "L" }, // L
          b: { from: "W", r: 0, m: 6, res: "L" }, // G
          slot: 5,
        },
        {
          // AH = loser(K) vs loser(H)
          a: { from: "W", r: 1, m: 1, res: "L" }, // K
          b: { from: "W", r: 0, m: 7, res: "L" }, // H
          slot: 6,
        },
        {
          // AI = loser(J) vs loser(I)
          a: { from: "W", r: 1, m: 0, res: "L" }, // J
          b: { from: "W", r: 0, m: 8, res: "L" }, // I
          slot: 7,
        },
      ],

      // Round 2 (L3): AJ, AK, AL, AM
      [
        {
          // AJ = winner(AB) vs winner(AC)
          a: { from: "L", r: 1, m: 0, res: "W" }, // AB
          b: { from: "L", r: 1, m: 1, res: "W" }, // AC
          slot: 0.5,
        },
        {
          // AK = winner(AD) vs winner(AE)
          a: { from: "L", r: 1, m: 2, res: "W" }, // AD
          b: { from: "L", r: 1, m: 3, res: "W" }, // AE
          slot: 2.5,
        },
        {
          // AL = winner(AF) vs winner(AG)
          a: { from: "L", r: 1, m: 4, res: "W" }, // AF
          b: { from: "L", r: 1, m: 5, res: "W" }, // AG
          slot: 4.5,
        },
        {
          // AM = winner(AH) vs winner(AI)
          a: { from: "L", r: 1, m: 6, res: "W" }, // AH
          b: { from: "L", r: 1, m: 7, res: "W" }, // AI
          slot: 6.5,
        },
      ],

      // Round 3 (L4): AN, AO, AP, AQ (WB QF losers drop)
      [
        {
          // AN = loser(S) vs winner(AJ)
          a: { from: "W", r: 2, m: 1, res: "L" }, // S
          b: { from: "L", r: 2, m: 0, res: "W" }, // AJ
          slot: 1,
        },
        {
          // AO = loser(R) vs winner(AK)
          a: { from: "W", r: 2, m: 0, res: "L" }, // R
          b: { from: "L", r: 2, m: 1, res: "W" }, // AK
          slot: 3,
        },
        {
          // AP = loser(U) vs winner(AL)
          a: { from: "W", r: 2, m: 3, res: "L" }, // U
          b: { from: "L", r: 2, m: 2, res: "W" }, // AL
          slot: 5,
        },
        {
          // AQ = loser(T) vs winner(AM)
          a: { from: "W", r: 2, m: 2, res: "L" }, // T
          b: { from: "L", r: 2, m: 3, res: "W" }, // AM
          slot: 7,
        },
      ],

      // Round 4 (L5): AR, AS
      [
        {
          // AR = winner(AN) vs winner(AO)
          a: { from: "L", r: 3, m: 0, res: "W" }, // AN
          b: { from: "L", r: 3, m: 1, res: "W" }, // AO
          slot: 2,
        },
        {
          // AS = winner(AP) vs winner(AQ)
          a: { from: "L", r: 3, m: 2, res: "W" }, // AP
          b: { from: "L", r: 3, m: 3, res: "W" }, // AQ
          slot: 6,
        },
      ],

      // Round 5 (LQF): AT, AU (WB SF losers drop)
      [
        {
          // AT = loser(W) vs winner(AR)
          a: { from: "W", r: 3, m: 1, res: "L" }, // W
          b: { from: "L", r: 4, m: 0, res: "W" }, // AR
          slot: 2,
        },
        {
          // AU = loser(V) vs winner(AS)
          a: { from: "W", r: 3, m: 0, res: "L" }, // V
          b: { from: "L", r: 4, m: 1, res: "W" }, // AS
          slot: 6,
        },
      ],

      // Round 6 (LSF): AV
      [
        {
          // AV = winner(AT) vs winner(AU)
          a: { from: "L", r: 5, m: 0, res: "W" }, // AT
          b: { from: "L", r: 5, m: 1, res: "W" }, // AU
          slot: 4,
        },
      ],

      // Round 7 (LFinal): AW
      [
        {
          // AW = loser(X) vs winner(AV)
          a: { from: "W", r: 4, m: 0, res: "L" }, // X
          b: { from: "L", r: 6, m: 0, res: "W" }, // AV
          slot: 4,
        },
      ],
    ],

    // 26 players (10 play-ins, total = 26)
    10: [
      // Round 0 (L1): AB, AC
      [
        {
          // AB = loser(B) vs loser(C)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 1,
        },
        {
          // AC = loser(G) vs loser(H)
          a: { from: "W", r: 0, m: 6, res: "L" }, // G
          b: { from: "W", r: 0, m: 7, res: "L" }, // H
          slot: 5,
        },
      ],

      // Round 1 (L2): AD-AK
      [
        {
          // AD = loser(R) vs loser(A)
          a: { from: "W", r: 1, m: 7, res: "L" }, // R
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // AE = loser(Q) vs winner(AB)
          a: { from: "W", r: 1, m: 6, res: "L" }, // Q
          b: { from: "L", r: 0, m: 0, res: "W" }, // AB
          slot: 1,
        },
        {
          // AF = loser(P) vs loser(D)
          a: { from: "W", r: 1, m: 5, res: "L" }, // P
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
          slot: 2,
        },
        {
          // AG = loser(O) vs loser(E)
          a: { from: "W", r: 1, m: 4, res: "L" }, // O
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 3,
        },
        {
          // AH = loser(N) vs loser(F)
          a: { from: "W", r: 1, m: 3, res: "L" }, // N
          b: { from: "W", r: 0, m: 5, res: "L" }, // F
          slot: 4,
        },
        {
          // AI = loser(M) vs winner(AC)
          a: { from: "W", r: 1, m: 2, res: "L" }, // M
          b: { from: "L", r: 0, m: 1, res: "W" }, // AC
          slot: 5,
        },
        {
          // AJ = loser(L) vs loser(I)
          a: { from: "W", r: 1, m: 1, res: "L" }, // L
          b: { from: "W", r: 0, m: 8, res: "L" }, // I
          slot: 6,
        },
        {
          // AK = loser(K) vs loser(J)
          a: { from: "W", r: 1, m: 0, res: "L" }, // K
          b: { from: "W", r: 0, m: 9, res: "L" }, // J
          slot: 7,
        },
      ],

      // Round 2 (L3): AL, AM, AN, AO
      [
        {
          // AL = winner(AD) vs winner(AE)
          a: { from: "L", r: 1, m: 0, res: "W" }, // AD
          b: { from: "L", r: 1, m: 1, res: "W" }, // AE
          slot: 0.5,
        },
        {
          // AM = winner(AF) vs winner(AG)
          a: { from: "L", r: 1, m: 2, res: "W" }, // AF
          b: { from: "L", r: 1, m: 3, res: "W" }, // AG
          slot: 2.5,
        },
        {
          // AN = winner(AH) vs winner(AI)
          a: { from: "L", r: 1, m: 4, res: "W" }, // AH
          b: { from: "L", r: 1, m: 5, res: "W" }, // AI
          slot: 4.5,
        },
        {
          // AO = winner(AJ) vs winner(AK)
          a: { from: "L", r: 1, m: 6, res: "W" }, // AJ
          b: { from: "L", r: 1, m: 7, res: "W" }, // AK
          slot: 6.5,
        },
      ],

      // Round 3 (L4): AP, AQ, AR, AS (WB QF losers drop)
      [
        {
          // AP = loser(T) vs winner(AL)
          a: { from: "W", r: 2, m: 1, res: "L" }, // T
          b: { from: "L", r: 2, m: 0, res: "W" }, // AL
          slot: 1,
        },
        {
          // AQ = loser(S) vs winner(AM)
          a: { from: "W", r: 2, m: 0, res: "L" }, // S
          b: { from: "L", r: 2, m: 1, res: "W" }, // AM
          slot: 3,
        },
        {
          // AR = loser(V) vs winner(AN)
          a: { from: "W", r: 2, m: 3, res: "L" }, // V
          b: { from: "L", r: 2, m: 2, res: "W" }, // AN
          slot: 5,
        },
        {
          // AS = loser(U) vs winner(AO)
          a: { from: "W", r: 2, m: 2, res: "L" }, // U
          b: { from: "L", r: 2, m: 3, res: "W" }, // AO
          slot: 7,
        },
      ],

      // Round 4 (L5): AT, AU
      [
        {
          // AT = winner(AP) vs winner(AQ)
          a: { from: "L", r: 3, m: 0, res: "W" }, // AP
          b: { from: "L", r: 3, m: 1, res: "W" }, // AQ
          slot: 2,
        },
        {
          // AU = winner(AR) vs winner(AS)
          a: { from: "L", r: 3, m: 2, res: "W" }, // AR
          b: { from: "L", r: 3, m: 3, res: "W" }, // AS
          slot: 6,
        },
      ],

      // Round 5 (LQF): AV, AW (WB SF losers drop)
      [
        {
          // AV = loser(X) vs winner(AT)
          a: { from: "W", r: 3, m: 1, res: "L" }, // X
          b: { from: "L", r: 4, m: 0, res: "W" }, // AT
          slot: 2,
        },
        {
          // AW = loser(W) vs winner(AU)
          a: { from: "W", r: 3, m: 0, res: "L" }, // W
          b: { from: "L", r: 4, m: 1, res: "W" }, // AU
          slot: 6,
        },
      ],

      // Round 6 (LSF): AX
      [
        {
          // AX = winner(AV) vs winner(AW)
          a: { from: "L", r: 5, m: 0, res: "W" }, // AV
          b: { from: "L", r: 5, m: 1, res: "W" }, // AW
          slot: 4,
        },
      ],

      // Round 7 (LFinal): AY
      [
        {
          // AY = loser(Y) vs winner(AX)
          a: { from: "W", r: 4, m: 0, res: "L" }, // Y
          b: { from: "L", r: 6, m: 0, res: "W" }, // AX
          slot: 4,
        },
      ],
    ],

    // 27 players (11 play-ins, total = 27)
    11: [
      // Round 0 (L1): AC, AD, AE
      [
        {
          // AC = loser(B) vs loser(C)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 1,
        },
        {
          // AD = loser(G) vs loser(H)
          a: { from: "W", r: 0, m: 6, res: "L" }, // G
          b: { from: "W", r: 0, m: 7, res: "L" }, // H
          slot: 5,
        },
        {
          // AE = loser(J) vs loser(K)
          a: { from: "W", r: 0, m: 9, res: "L" }, // J
          b: { from: "W", r: 0, m: 10, res: "L" }, // K
          slot: 7,
        },
      ],

      // Round 1 (L2): AF-AM
      [
        {
          // AF = loser(S) vs loser(A)
          a: { from: "W", r: 1, m: 7, res: "L" }, // S
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // AG = loser(R) vs winner(AC)
          a: { from: "W", r: 1, m: 6, res: "L" }, // R
          b: { from: "L", r: 0, m: 0, res: "W" }, // AC
          slot: 1,
        },
        {
          // AH = loser(Q) vs loser(D)
          a: { from: "W", r: 1, m: 5, res: "L" }, // Q
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
          slot: 2,
        },
        {
          // AI = loser(P) vs loser(E)
          a: { from: "W", r: 1, m: 4, res: "L" }, // P
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 3,
        },
        {
          // AJ = loser(O) vs loser(F)
          a: { from: "W", r: 1, m: 3, res: "L" }, // O
          b: { from: "W", r: 0, m: 5, res: "L" }, // F
          slot: 4,
        },
        {
          // AK = loser(N) vs winner(AD)
          a: { from: "W", r: 1, m: 2, res: "L" }, // N
          b: { from: "L", r: 0, m: 1, res: "W" }, // AD
          slot: 5,
        },
        {
          // AL = loser(M) vs loser(I)
          a: { from: "W", r: 1, m: 1, res: "L" }, // M
          b: { from: "W", r: 0, m: 8, res: "L" }, // I
          slot: 6,
        },
        {
          // AM = loser(L) vs winner(AE)
          a: { from: "W", r: 1, m: 0, res: "L" }, // L
          b: { from: "L", r: 0, m: 2, res: "W" }, // AE
          slot: 7,
        },
      ],

      // Round 2 (L3): AN, AO, AP, AQ
      [
        {
          // AN = winner(AF) vs winner(AG)
          a: { from: "L", r: 1, m: 0, res: "W" }, // AF
          b: { from: "L", r: 1, m: 1, res: "W" }, // AG
          slot: 0.5,
        },
        {
          // AO = winner(AH) vs winner(AI)
          a: { from: "L", r: 1, m: 2, res: "W" }, // AH
          b: { from: "L", r: 1, m: 3, res: "W" }, // AI
          slot: 2.5,
        },
        {
          // AP = winner(AJ) vs winner(AK)
          a: { from: "L", r: 1, m: 4, res: "W" }, // AJ
          b: { from: "L", r: 1, m: 5, res: "W" }, // AK
          slot: 4.5,
        },
        {
          // AQ = winner(AL) vs winner(AM)
          a: { from: "L", r: 1, m: 6, res: "W" }, // AL
          b: { from: "L", r: 1, m: 7, res: "W" }, // AM
          slot: 6.5,
        },
      ],

      // Round 3 (L4): AR, AS, AT, AU (WB QF losers drop)
      [
        {
          // AR = loser(U) vs winner(AN)
          a: { from: "W", r: 2, m: 1, res: "L" }, // U
          b: { from: "L", r: 2, m: 0, res: "W" }, // AN
          slot: 1,
        },
        {
          // AS = loser(T) vs winner(AO)
          a: { from: "W", r: 2, m: 0, res: "L" }, // T
          b: { from: "L", r: 2, m: 1, res: "W" }, // AO
          slot: 3,
        },
        {
          // AT = loser(W) vs winner(AP)
          a: { from: "W", r: 2, m: 3, res: "L" }, // W
          b: { from: "L", r: 2, m: 2, res: "W" }, // AP
          slot: 5,
        },
        {
          // AU = loser(V) vs winner(AQ)
          a: { from: "W", r: 2, m: 2, res: "L" }, // V
          b: { from: "L", r: 2, m: 3, res: "W" }, // AQ
          slot: 7,
        },
      ],

      // Round 4 (L5): AV, AW
      [
        {
          // AV = winner(AR) vs winner(AS)
          a: { from: "L", r: 3, m: 0, res: "W" }, // AR
          b: { from: "L", r: 3, m: 1, res: "W" }, // AS
          slot: 2,
        },
        {
          // AW = winner(AT) vs winner(AU)
          a: { from: "L", r: 3, m: 2, res: "W" }, // AT
          b: { from: "L", r: 3, m: 3, res: "W" }, // AU
          slot: 6,
        },
      ],

      // Round 5 (LQF): AX, AY (WB SF losers drop)
      [
        {
          // AX = loser(Y) vs winner(AV)
          a: { from: "W", r: 3, m: 1, res: "L" }, // Y
          b: { from: "L", r: 4, m: 0, res: "W" }, // AV
          slot: 2,
        },
        {
          // AY = loser(X) vs winner(AW)
          a: { from: "W", r: 3, m: 0, res: "L" }, // X
          b: { from: "L", r: 4, m: 1, res: "W" }, // AW
          slot: 6,
        },
      ],

      // Round 6 (LSF): AZ
      [
        {
          // AZ = winner(AX) vs winner(AY)
          a: { from: "L", r: 5, m: 0, res: "W" }, // AX
          b: { from: "L", r: 5, m: 1, res: "W" }, // AY
          slot: 4,
        },
      ],

      // Round 7 (LFinal): BA
      [
        {
          // BA = loser(Z) vs winner(AZ)
          a: { from: "W", r: 4, m: 0, res: "L" }, // Z
          b: { from: "L", r: 6, m: 0, res: "W" }, // AZ
          slot: 4,
        },
      ],
    ],

    // 28 players (12 play-ins, total = 28)
    12: [
      // Round 0 (L1): AD, AE, AF, AG
      [
        {
          // AD = loser(B) vs loser(C)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 1,
        },
        {
          // AE = loser(E) vs loser(F)
          a: { from: "W", r: 0, m: 4, res: "L" }, // E
          b: { from: "W", r: 0, m: 5, res: "L" }, // F
          slot: 3,
        },
        {
          // AF = loser(H) vs loser(I)
          a: { from: "W", r: 0, m: 7, res: "L" }, // H
          b: { from: "W", r: 0, m: 8, res: "L" }, // I
          slot: 5,
        },
        {
          // AG = loser(K) vs loser(L)
          a: { from: "W", r: 0, m: 10, res: "L" }, // K
          b: { from: "W", r: 0, m: 11, res: "L" }, // L
          slot: 7,
        },
      ],

      // Round 1 (L2): AH-AO
      [
        {
          // AH = loser(T) vs loser(A)
          a: { from: "W", r: 1, m: 7, res: "L" }, // T
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // AI = loser(S) vs winner(AD)
          a: { from: "W", r: 1, m: 6, res: "L" }, // S
          b: { from: "L", r: 0, m: 0, res: "W" }, // AD
          slot: 1,
        },
        {
          // AJ = loser(R) vs loser(D)
          a: { from: "W", r: 1, m: 5, res: "L" }, // R
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
          slot: 2,
        },
        {
          // AK = loser(Q) vs winner(AE)
          a: { from: "W", r: 1, m: 4, res: "L" }, // Q
          b: { from: "L", r: 0, m: 1, res: "W" }, // AE
          slot: 3,
        },
        {
          // AL = loser(P) vs loser(G)
          a: { from: "W", r: 1, m: 3, res: "L" }, // P
          b: { from: "W", r: 0, m: 6, res: "L" }, // G
          slot: 4,
        },
        {
          // AM = loser(O) vs winner(AF)
          a: { from: "W", r: 1, m: 2, res: "L" }, // O
          b: { from: "L", r: 0, m: 2, res: "W" }, // AF
          slot: 5,
        },
        {
          // AN = loser(N) vs loser(J)
          a: { from: "W", r: 1, m: 1, res: "L" }, // N
          b: { from: "W", r: 0, m: 9, res: "L" }, // J
          slot: 6,
        },
        {
          // AO = loser(M) vs winner(AG)
          a: { from: "W", r: 1, m: 0, res: "L" }, // M
          b: { from: "L", r: 0, m: 3, res: "W" }, // AG
          slot: 7,
        },
      ],

      // Round 2 (L3): AP, AQ, AR, AS
      [
        {
          // AP = winner(AH) vs winner(AI)
          a: { from: "L", r: 1, m: 0, res: "W" }, // AH
          b: { from: "L", r: 1, m: 1, res: "W" }, // AI
          slot: 0.5,
        },
        {
          // AQ = winner(AJ) vs winner(AK)
          a: { from: "L", r: 1, m: 2, res: "W" }, // AJ
          b: { from: "L", r: 1, m: 3, res: "W" }, // AK
          slot: 2.5,
        },
        {
          // AR = winner(AL) vs winner(AM)
          a: { from: "L", r: 1, m: 4, res: "W" }, // AL
          b: { from: "L", r: 1, m: 5, res: "W" }, // AM
          slot: 4.5,
        },
        {
          // AS = winner(AN) vs winner(AO)
          a: { from: "L", r: 1, m: 6, res: "W" }, // AN
          b: { from: "L", r: 1, m: 7, res: "W" }, // AO
          slot: 6.5,
        },
      ],

      // Round 3 (L4): AT, AU, AV, AW (WB QF losers drop)
      [
        {
          // AT = loser(V) vs winner(AP)
          a: { from: "W", r: 2, m: 1, res: "L" }, // V
          b: { from: "L", r: 2, m: 0, res: "W" }, // AP
          slot: 1,
        },
        {
          // AU = loser(U) vs winner(AQ)
          a: { from: "W", r: 2, m: 0, res: "L" }, // U
          b: { from: "L", r: 2, m: 1, res: "W" }, // AQ
          slot: 3,
        },
        {
          // AV = loser(X) vs winner(AR)
          a: { from: "W", r: 2, m: 3, res: "L" }, // X
          b: { from: "L", r: 2, m: 2, res: "W" }, // AR
          slot: 5,
        },
        {
          // AW = loser(W) vs winner(AS)
          a: { from: "W", r: 2, m: 2, res: "L" }, // W
          b: { from: "L", r: 2, m: 3, res: "W" }, // AS
          slot: 7,
        },
      ],

      // Round 4 (L5): AX, AY
      [
        {
          // AX = winner(AT) vs winner(AU)
          a: { from: "L", r: 3, m: 0, res: "W" }, // AT
          b: { from: "L", r: 3, m: 1, res: "W" }, // AU
          slot: 2,
        },
        {
          // AY = winner(AV) vs winner(AW)
          a: { from: "L", r: 3, m: 2, res: "W" }, // AV
          b: { from: "L", r: 3, m: 3, res: "W" }, // AW
          slot: 6,
        },
      ],

      // Round 5 (LQF): AZ, BA (WB SF losers drop)
      [
        {
          // AZ = loser(Z) vs winner(AX)
          a: { from: "W", r: 3, m: 1, res: "L" }, // Z
          b: { from: "L", r: 4, m: 0, res: "W" }, // AX
          slot: 2,
        },
        {
          // BA = loser(Y) vs winner(AY)
          a: { from: "W", r: 3, m: 0, res: "L" }, // Y
          b: { from: "L", r: 4, m: 1, res: "W" }, // AY
          slot: 6,
        },
      ],

      // Round 6 (LSF): BB
      [
        {
          // BB = winner(AZ) vs winner(BA)
          a: { from: "L", r: 5, m: 0, res: "W" }, // AZ
          b: { from: "L", r: 5, m: 1, res: "W" }, // BA
          slot: 4,
        },
      ],

      // Round 7 (LFinal): BC
      [
        {
          // BC = loser(AA) vs winner(BB)
          a: { from: "W", r: 4, m: 0, res: "L" }, // AA
          b: { from: "L", r: 6, m: 0, res: "W" }, // BB
          slot: 4,
        },
      ],
    ],

    // 29 players (13 play-ins, total = 29)
    13: [
      // Round 0 (L1): AE-AI
      [
        {
          // AE = loser(B) vs loser(C)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 1,
        },
        {
          // AF = loser(D) vs loser(E)
          a: { from: "W", r: 0, m: 3, res: "L" }, // D
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 3,
        },
        {
          // AG = loser(F) vs loser(G)
          a: { from: "W", r: 0, m: 5, res: "L" }, // F
          b: { from: "W", r: 0, m: 6, res: "L" }, // G
          slot: 5,
        },
        {
          // AH = loser(I) vs loser(J)
          a: { from: "W", r: 0, m: 8, res: "L" }, // I
          b: { from: "W", r: 0, m: 9, res: "L" }, // J
          slot: 7,
        },
        {
          // AI = loser(L) vs loser(M)
          a: { from: "W", r: 0, m: 11, res: "L" }, // L
          b: { from: "W", r: 0, m: 12, res: "L" }, // M
          slot: 9,
        },
      ],

      // Round 1 (L2): AJ-AQ
      [
        {
          // AJ = loser(U) vs loser(A)
          a: { from: "W", r: 1, m: 7, res: "L" }, // U
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // AK = loser(T) vs winner(AE)
          a: { from: "W", r: 1, m: 6, res: "L" }, // T
          b: { from: "L", r: 0, m: 0, res: "W" }, // AE
          slot: 1,
        },
        {
          // AL = loser(S) vs winner(AF)
          a: { from: "W", r: 1, m: 5, res: "L" }, // S
          b: { from: "L", r: 0, m: 1, res: "W" }, // AF
          slot: 3,
        },
        {
          // AM = loser(R) vs winner(AG)
          a: { from: "W", r: 1, m: 4, res: "L" }, // R
          b: { from: "L", r: 0, m: 2, res: "W" }, // AG
          slot: 5,
        },
        {
          // AN = loser(Q) vs loser(H)
          a: { from: "W", r: 1, m: 3, res: "L" }, // Q
          b: { from: "W", r: 0, m: 7, res: "L" }, // H
          slot: 6,
        },
        {
          // AO = loser(P) vs winner(AH)
          a: { from: "W", r: 1, m: 2, res: "L" }, // P
          b: { from: "L", r: 0, m: 3, res: "W" }, // AH
          slot: 7,
        },
        {
          // AP = loser(O) vs loser(K)
          a: { from: "W", r: 1, m: 1, res: "L" }, // O
          b: { from: "W", r: 0, m: 10, res: "L" }, // K
          slot: 8,
        },
        {
          // AQ = loser(N) vs winner(AI)
          a: { from: "W", r: 1, m: 0, res: "L" }, // N
          b: { from: "L", r: 0, m: 4, res: "W" }, // AI
          slot: 9,
        },
      ],

      // Round 2 (L3): AR-AU
      [
        {
          // AR = winner(AJ) vs winner(AK)
          a: { from: "L", r: 1, m: 0, res: "W" }, // AJ
          b: { from: "L", r: 1, m: 1, res: "W" }, // AK
          slot: 0.5,
        },
        {
          // AS = winner(AL) vs winner(AM)
          a: { from: "L", r: 1, m: 2, res: "W" }, // AL
          b: { from: "L", r: 1, m: 3, res: "W" }, // AM
          slot: 4,
        },
        {
          // AT = winner(AN) vs winner(AO)
          a: { from: "L", r: 1, m: 4, res: "W" }, // AN
          b: { from: "L", r: 1, m: 5, res: "W" }, // AO
          slot: 6.5,
        },
        {
          // AU = winner(AP) vs winner(AQ)
          a: { from: "L", r: 1, m: 6, res: "W" }, // AP
          b: { from: "L", r: 1, m: 7, res: "W" }, // AQ
          slot: 8.5,
        },
      ],

      // Round 3 (L4): AV, AW, AX, AY (WB QF losers drop)
      [
        {
          // AV = loser(W) vs winner(AR)
          a: { from: "W", r: 2, m: 1, res: "L" }, // W
          b: { from: "L", r: 2, m: 0, res: "W" }, // AR
          slot: 1,
        },
        {
          // AW = loser(V) vs winner(AS)
          a: { from: "W", r: 2, m: 0, res: "L" }, // V
          b: { from: "L", r: 2, m: 1, res: "W" }, // AS
          slot: 3,
        },
        {
          // AX = loser(Y) vs winner(AT)
          a: { from: "W", r: 2, m: 3, res: "L" }, // Y
          b: { from: "L", r: 2, m: 2, res: "W" }, // AT
          slot: 5,
        },
        {
          // AY = loser(X) vs winner(AU)
          a: { from: "W", r: 2, m: 2, res: "L" }, // X
          b: { from: "L", r: 2, m: 3, res: "W" }, // AU
          slot: 7,
        },
      ],

      // Round 4 (L5): AZ, BA
      [
        {
          // AZ = winner(AV) vs winner(AW)
          a: { from: "L", r: 3, m: 0, res: "W" }, // AV
          b: { from: "L", r: 3, m: 1, res: "W" }, // AW
          slot: 2,
        },
        {
          // BA = winner(AX) vs winner(AY)
          a: { from: "L", r: 3, m: 2, res: "W" }, // AX
          b: { from: "L", r: 3, m: 3, res: "W" }, // AY
          slot: 6,
        },
      ],

      // Round 5 (LQF): BB, BC (WB SF losers drop)
      [
        {
          // BB = loser(AA) vs winner(AZ)
          a: { from: "W", r: 3, m: 1, res: "L" }, // AA
          b: { from: "L", r: 4, m: 0, res: "W" }, // AZ
          slot: 2,
        },
        {
          // BC = loser(Z) vs winner(BA)
          a: { from: "W", r: 3, m: 0, res: "L" }, // Z
          b: { from: "L", r: 4, m: 1, res: "W" }, // BA
          slot: 6,
        },
      ],

      // Round 6 (LSF): BD
      [
        {
          // BD = winner(BB) vs winner(BC)
          a: { from: "L", r: 5, m: 0, res: "W" }, // BB
          b: { from: "L", r: 5, m: 1, res: "W" }, // BC
          slot: 4,
        },
      ],

      // Round 7 (LFinal): BE
      [
        {
          // BE = loser(AB) vs winner(BD)
          a: { from: "W", r: 4, m: 0, res: "L" }, // AB
          b: { from: "L", r: 6, m: 0, res: "W" }, // BD
          slot: 4,
        },
      ],
    ],

    // 30 players (14 play-ins, total = 30)
    14: [
      // Round 0 (L1): AF-AK
      [
        {
          // AF = loser(B) vs loser(C)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 1,
        },
        {
          // AG = loser(D) vs loser(E)
          a: { from: "W", r: 0, m: 3, res: "L" }, // D
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 3,
        },
        {
          // AH = loser(F) vs loser(G)
          a: { from: "W", r: 0, m: 5, res: "L" }, // F
          b: { from: "W", r: 0, m: 6, res: "L" }, // G
          slot: 5,
        },
        {
          // AI = loser(I) vs loser(J)
          a: { from: "W", r: 0, m: 8, res: "L" }, // I
          b: { from: "W", r: 0, m: 9, res: "L" }, // J
          slot: 7,
        },
        {
          // AJ = loser(K) vs loser(L)
          a: { from: "W", r: 0, m: 10, res: "L" }, // K
          b: { from: "W", r: 0, m: 11, res: "L" }, // L
          slot: 9,
        },
        {
          // AK = loser(M) vs loser(N)
          a: { from: "W", r: 0, m: 12, res: "L" }, // M
          b: { from: "W", r: 0, m: 13, res: "L" }, // N
          slot: 11,
        },
      ],

      // Round 1 (L2): AL-AS (remaining WB R1 losers + two unpaired play-in losers)
      [
        {
          // AL = loser(V) vs loser(A)
          a: { from: "W", r: 1, m: 7, res: "L" }, // V
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // AM = loser(U) vs winner(AF)
          a: { from: "W", r: 1, m: 6, res: "L" }, // U
          b: { from: "L", r: 0, m: 0, res: "W" }, // AF
          slot: 1,
        },
        {
          // AN = loser(T) vs winner(AG)
          a: { from: "W", r: 1, m: 5, res: "L" }, // T
          b: { from: "L", r: 0, m: 1, res: "W" }, // AG
          slot: 3,
        },
        {
          // AO = loser(S) vs winner(AH)
          a: { from: "W", r: 1, m: 4, res: "L" }, // S
          b: { from: "L", r: 0, m: 2, res: "W" }, // AH
          slot: 5,
        },
        {
          // AP = loser(R) vs loser(H)
          a: { from: "W", r: 1, m: 3, res: "L" }, // R
          b: { from: "W", r: 0, m: 7, res: "L" }, // H
          slot: 6,
        },
        {
          // AQ = loser(Q) vs winner(AI)
          a: { from: "W", r: 1, m: 2, res: "L" }, // Q
          b: { from: "L", r: 0, m: 3, res: "W" }, // AI
          slot: 7,
        },
        {
          // AR = loser(P) vs winner(AJ)
          a: { from: "W", r: 1, m: 1, res: "L" }, // P
          b: { from: "L", r: 0, m: 4, res: "W" }, // AJ
          slot: 9,
        },
        {
          // AS = loser(O) vs winner(AK)
          a: { from: "W", r: 1, m: 0, res: "L" }, // O
          b: { from: "L", r: 0, m: 5, res: "W" }, // AK
          slot: 11,
        },
      ],

      // Round 2 (L3): AT-AW
      [
        {
          // AT = winner(AL) vs winner(AM)
          a: { from: "L", r: 1, m: 0, res: "W" }, // AL
          b: { from: "L", r: 1, m: 1, res: "W" }, // AM
          slot: 0.5,
        },
        {
          // AU = winner(AN) vs winner(AO)
          a: { from: "L", r: 1, m: 2, res: "W" }, // AN
          b: { from: "L", r: 1, m: 3, res: "W" }, // AO
          slot: 4,
        },
        {
          // AV = winner(AP) vs winner(AQ)
          a: { from: "L", r: 1, m: 4, res: "W" }, // AP
          b: { from: "L", r: 1, m: 5, res: "W" }, // AQ
          slot: 6.5,
        },
        {
          // AW = winner(AR) vs winner(AS)
          a: { from: "L", r: 1, m: 6, res: "W" }, // AR
          b: { from: "L", r: 1, m: 7, res: "W" }, // AS
          slot: 10,
        },
      ],

      // Round 3 (L4): AX-BA (WB QF losers drop)
      [
        {
          // AX = loser(X) vs winner(AT)
          a: { from: "W", r: 2, m: 1, res: "L" }, // X
          b: { from: "L", r: 2, m: 0, res: "W" }, // AT
          slot: 1,
        },
        {
          // AY = loser(W) vs winner(AU)
          a: { from: "W", r: 2, m: 0, res: "L" }, // W
          b: { from: "L", r: 2, m: 1, res: "W" }, // AU
          slot: 3,
        },
        {
          // AZ = loser(Z) vs winner(AV)
          a: { from: "W", r: 2, m: 3, res: "L" }, // Z
          b: { from: "L", r: 2, m: 2, res: "W" }, // AV
          slot: 5,
        },
        {
          // BA = loser(Y) vs winner(AW)
          a: { from: "W", r: 2, m: 2, res: "L" }, // Y
          b: { from: "L", r: 2, m: 3, res: "W" }, // AW
          slot: 7,
        },
      ],

      // Round 4 (L5): BB, BC
      [
        {
          // BB = winner(AX) vs winner(AY)
          a: { from: "L", r: 3, m: 0, res: "W" }, // AX
          b: { from: "L", r: 3, m: 1, res: "W" }, // AY
          slot: 2,
        },
        {
          // BC = winner(AZ) vs winner(BA)
          a: { from: "L", r: 3, m: 2, res: "W" }, // AZ
          b: { from: "L", r: 3, m: 3, res: "W" }, // BA
          slot: 6,
        },
      ],

      // Round 5 (LQF): BD, BE (WB SF losers drop)
      [
        {
          // BD = loser(AB) vs winner(BB)
          a: { from: "W", r: 3, m: 1, res: "L" }, // AB
          b: { from: "L", r: 4, m: 0, res: "W" }, // BB
          slot: 2,
        },
        {
          // BE = loser(AA) vs winner(BC)
          a: { from: "W", r: 3, m: 0, res: "L" }, // AA
          b: { from: "L", r: 4, m: 1, res: "W" }, // BC
          slot: 6,
        },
      ],

      // Round 6 (LSF): BF
      [
        {
          // BF = winner(BD) vs winner(BE)
          a: { from: "L", r: 5, m: 0, res: "W" }, // BD
          b: { from: "L", r: 5, m: 1, res: "W" }, // BE
          slot: 4,
        },
      ],

      // Round 7 (LFinal): BG
      [
        {
          // BG = loser(AC) vs winner(BF)
          a: { from: "W", r: 4, m: 0, res: "L" }, // AC
          b: { from: "L", r: 6, m: 0, res: "W" }, // BF
          slot: 4,
        },
      ],
    ],

    // 31 players (15 play-ins, total = 31)
    15: [
      // Round 0 (L1): AG-AM
      [
        {
          // AG = loser(B) vs loser(C)
          a: { from: "W", r: 0, m: 1, res: "L" }, // B
          b: { from: "W", r: 0, m: 2, res: "L" }, // C
          slot: 1,
        },
        {
          // AH = loser(D) vs loser(E)
          a: { from: "W", r: 0, m: 3, res: "L" }, // D
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
          slot: 3,
        },
        {
          // AI = loser(F) vs loser(G)
          a: { from: "W", r: 0, m: 5, res: "L" }, // F
          b: { from: "W", r: 0, m: 6, res: "L" }, // G
          slot: 5,
        },
        {
          // AJ = loser(H) vs loser(I)
          a: { from: "W", r: 0, m: 7, res: "L" }, // H
          b: { from: "W", r: 0, m: 8, res: "L" }, // I
          slot: 7,
        },
        {
          // AK = loser(J) vs loser(K)
          a: { from: "W", r: 0, m: 9, res: "L" }, // J
          b: { from: "W", r: 0, m: 10, res: "L" }, // K
          slot: 9,
        },
        {
          // AL = loser(L) vs loser(M)
          a: { from: "W", r: 0, m: 11, res: "L" }, // L
          b: { from: "W", r: 0, m: 12, res: "L" }, // M
          slot: 11,
        },
        {
          // AM = loser(N) vs loser(O)
          a: { from: "W", r: 0, m: 13, res: "L" }, // N
          b: { from: "W", r: 0, m: 14, res: "L" }, // O
          slot: 13,
        },
      ],

      // Round 1 (L2): AN-AU
      [
        {
          // AN = loser(W) vs loser(A)
          a: { from: "W", r: 1, m: 7, res: "L" }, // W
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
          slot: 0,
        },
        {
          // AO = loser(V) vs winner(AG)
          a: { from: "W", r: 1, m: 6, res: "L" }, // V
          b: { from: "L", r: 0, m: 0, res: "W" }, // AG
          slot: 1,
        },
        {
          // AP = loser(U) vs winner(AH)
          a: { from: "W", r: 1, m: 5, res: "L" }, // U
          b: { from: "L", r: 0, m: 1, res: "W" }, // AH
          slot: 3,
        },
        {
          // AQ = loser(T) vs winner(AI)
          a: { from: "W", r: 1, m: 4, res: "L" }, // T
          b: { from: "L", r: 0, m: 2, res: "W" }, // AI
          slot: 5,
        },
        {
          // AR = loser(S) vs winner(AJ)
          a: { from: "W", r: 1, m: 3, res: "L" }, // S
          b: { from: "L", r: 0, m: 3, res: "W" }, // AJ
          slot: 7,
        },
        {
          // AS = loser(R) vs winner(AK)
          a: { from: "W", r: 1, m: 2, res: "L" }, // R
          b: { from: "L", r: 0, m: 4, res: "W" }, // AK
          slot: 9,
        },
        {
          // AT = loser(Q) vs winner(AL)
          a: { from: "W", r: 1, m: 1, res: "L" }, // Q
          b: { from: "L", r: 0, m: 5, res: "W" }, // AL
          slot: 11,
        },
        {
          // AU = loser(P) vs winner(AM)
          a: { from: "W", r: 1, m: 0, res: "L" }, // P
          b: { from: "L", r: 0, m: 6, res: "W" }, // AM
          slot: 13,
        },
      ],

      // Round 2 (L3): AV-AY
      [
        {
          // AV = winner(AN) vs winner(AO)
          a: { from: "L", r: 1, m: 0, res: "W" }, // AN
          b: { from: "L", r: 1, m: 1, res: "W" }, // AO
          slot: 0.5,
        },
        {
          // AW = winner(AP) vs winner(AQ)
          a: { from: "L", r: 1, m: 2, res: "W" }, // AP
          b: { from: "L", r: 1, m: 3, res: "W" }, // AQ
          slot: 4,
        },
        {
          // AX = winner(AR) vs winner(AS)
          a: { from: "L", r: 1, m: 4, res: "W" }, // AR
          b: { from: "L", r: 1, m: 5, res: "W" }, // AS
          slot: 8,
        },
        {
          // AY = winner(AT) vs winner(AU)
          a: { from: "L", r: 1, m: 6, res: "W" }, // AT
          b: { from: "L", r: 1, m: 7, res: "W" }, // AU
          slot: 12,
        },
      ],

      // Round 3 (L4): AZ, BA, BB, BC (WB QF losers drop)
      [
        {
          // AZ = loser(Y) vs winner(AV)
          a: { from: "W", r: 2, m: 1, res: "L" }, // Y
          b: { from: "L", r: 2, m: 0, res: "W" }, // AV
          slot: 1,
        },
        {
          // BA = loser(X) vs winner(AW)
          a: { from: "W", r: 2, m: 0, res: "L" }, // X
          b: { from: "L", r: 2, m: 1, res: "W" }, // AW
          slot: 3,
        },
        {
          // BB = loser(AA) vs winner(AX)
          a: { from: "W", r: 2, m: 3, res: "L" }, // AA
          b: { from: "L", r: 2, m: 2, res: "W" }, // AX
          slot: 5,
        },
        {
          // BC = loser(Z) vs winner(AY)
          a: { from: "W", r: 2, m: 2, res: "L" }, // Z
          b: { from: "L", r: 2, m: 3, res: "W" }, // AY
          slot: 7,
        },
      ],

      // Round 4 (L5): BD, BE
      [
        {
          // BD = winner(AZ) vs winner(BA)
          a: { from: "L", r: 3, m: 0, res: "W" }, // AZ
          b: { from: "L", r: 3, m: 1, res: "W" }, // BA
          slot: 2,
        },
        {
          // BE = winner(BB) vs winner(BC)
          a: { from: "L", r: 3, m: 2, res: "W" }, // BB
          b: { from: "L", r: 3, m: 3, res: "W" }, // BC
          slot: 10,
        },
      ],

      // Round 5 (LQF): BF, BG (WB SF losers drop)
      [
        {
          // BF = loser(AC) vs winner(BD)
          a: { from: "W", r: 3, m: 1, res: "L" }, // AC
          b: { from: "L", r: 4, m: 0, res: "W" }, // BD
          slot: 2,
        },
        {
          // BG = loser(AB) vs winner(BE)
          a: { from: "W", r: 3, m: 0, res: "L" }, // AB
          b: { from: "L", r: 4, m: 1, res: "W" }, // BE
          slot: 10,
        },
      ],

      // Round 6 (LSF): BH
      [
        {
          // BH = winner(BF) vs winner(BG)
          a: { from: "L", r: 5, m: 0, res: "W" }, // BF
          b: { from: "L", r: 5, m: 1, res: "W" }, // BG
          slot: 6,
        },
      ],

      // Round 7 (LFinal): BI
      [
        {
          // BI = loser(AD) vs winner(BH)
          a: { from: "W", r: 4, m: 0, res: "L" }, // AD
          b: { from: "L", r: 6, m: 0, res: "W" }, // BH
          slot: 6,
        },
      ],
    ],
  },

  // 21 players (5 play-ins, total = 21)
  5: [
    // Round 0 (L1): V-Z (play-in losers enter immediately)
    [
      {
        // V = loser(A) vs loser(G)
        a: { from: "W", r: 0, m: 0, res: "L" }, // A (16v17)
        b: { from: "W", r: 1, m: 1, res: "L" }, // G (8v9)
        slot: 0,
      },
      {
        // W = loser(B) vs loser(K)
        a: { from: "W", r: 0, m: 1, res: "L" }, // B (13v20)
        b: { from: "W", r: 1, m: 5, res: "L" }, // K (7v10)
        slot: 1,
      },
      {
        // X = loser(C) vs loser(M)
        a: { from: "W", r: 0, m: 2, res: "L" }, // C (12v21)
        b: { from: "W", r: 1, m: 7, res: "L" }, // M (6v11)
        slot: 2,
      },
      {
        // Y = loser(D) vs loser(H)
        a: { from: "W", r: 0, m: 3, res: "L" }, // D (15v18)
        b: { from: "W", r: 1, m: 2, res: "L" }, // H (4 vs winner B)
        slot: 3,
      },
      {
        // Z = loser(E) vs loser(J)
        a: { from: "W", r: 0, m: 4, res: "L" }, // E (14v19)
        b: { from: "W", r: 1, m: 4, res: "L" }, // J (2 vs winner D)
        slot: 4,
      },
    ],

    // Round 1 (L2): AA-AD (remaining WB R1 losers join)
    [
      {
        // AA = winner(V) vs loser(F)
        a: { from: "L", r: 0, m: 0, res: "W" }, // V
        b: { from: "W", r: 1, m: 0, res: "L" }, // F (1 vs winner A)
        slot: 0,
      },
      {
        // AB = winner(W) vs loser(I)
        a: { from: "L", r: 0, m: 1, res: "W" }, // W
        b: { from: "W", r: 1, m: 3, res: "L" }, // I (5 vs winner C)
        slot: 1,
      },
      {
        // AC = winner(X) vs loser(L)
        a: { from: "L", r: 0, m: 2, res: "W" }, // X
        b: { from: "W", r: 1, m: 6, res: "L" }, // L (3 vs winner E)
        slot: 2,
      },
      {
        // AD = winner(Y) vs winner(Z)
        a: { from: "L", r: 0, m: 3, res: "W" }, // Y
        b: { from: "L", r: 0, m: 4, res: "W" }, // Z
        slot: 3,
      },
    ],

    // Round 2 (L3): AE-AH (WB R2 losers drop)
    [
      {
        // AE = loser(N) vs winner(AA)
        a: { from: "W", r: 2, m: 0, res: "L" }, // N
        b: { from: "L", r: 1, m: 0, res: "W" }, // AA
        slot: 0,
      },
      {
        // AF = loser(O) vs winner(AB)
        a: { from: "W", r: 2, m: 1, res: "L" }, // O
        b: { from: "L", r: 1, m: 1, res: "W" }, // AB
        slot: 1,
      },
      {
        // AG = loser(P) vs winner(AC)
        a: { from: "W", r: 2, m: 2, res: "L" }, // P
        b: { from: "L", r: 1, m: 2, res: "W" }, // AC
        slot: 2,
      },
      {
        // AH = loser(Q) vs winner(AD)
        a: { from: "W", r: 2, m: 3, res: "L" }, // Q
        b: { from: "L", r: 1, m: 3, res: "W" }, // AD
        slot: 3,
      },
    ],

    // Round 3 (L4): AI, AJ
    [
      {
        // AI = winner(AE) vs winner(AF)
        a: { from: "L", r: 2, m: 0, res: "W" }, // AE
        b: { from: "L", r: 2, m: 1, res: "W" }, // AF
        slot: 0,
      },
      {
        // AJ = winner(AG) vs winner(AH)
        a: { from: "L", r: 2, m: 2, res: "W" }, // AG
        b: { from: "L", r: 2, m: 3, res: "W" }, // AH
        slot: 1,
      },
    ],

    // Round 4 (L5): AK, AL (WB R3 losers drop)
    [
      {
        // AK = loser(R) vs winner(AI)
        a: { from: "W", r: 3, m: 0, res: "L" }, // R
        b: { from: "L", r: 3, m: 0, res: "W" }, // AI
        slot: 0,
      },
      {
        // AL = loser(S) vs winner(AJ)
        a: { from: "W", r: 3, m: 1, res: "L" }, // S
        b: { from: "L", r: 3, m: 1, res: "W" }, // AJ
        slot: 1,
      },
    ],

    // Round 5 (L6): AM
    [
      {
        // AM = winner(AK) vs winner(AL)
        a: { from: "L", r: 4, m: 0, res: "W" }, // AK
        b: { from: "L", r: 4, m: 1, res: "W" }, // AL
        slot: 0,
      },
    ],

    // Round 6 (LFinal): AN
    [
      {
        // AN = loser(T) vs winner(AM)
        a: { from: "W", r: 4, m: 0, res: "L" }, // T
        b: { from: "L", r: 5, m: 0, res: "W" }, // AM
        slot: 0,
      },
    ],
  ],
};

// Ensure every template has dense, explicit slots for tight, non-overlapping layout.
applyDenseSlots(WINNERS_TEMPLATES);
applyDenseSlots(LOSERS_TEMPLATES);
tightenLosersSlots(LOSERS_TEMPLATES);

// Optional tightening for upper brackets when a branch uses sparse slots.
// Scoped to 21-player winners only to avoid changing other brackets.
// (Temporarily disabled; re-enable if you need automatic dense remapping for 21p winners.)
// (function tightenUpperSparseBranches21() {
//   const tpl = WINNERS_TEMPLATES && WINNERS_TEMPLATES[21];
//   if (!Array.isArray(tpl)) return;
//
//   const remapRound = (round) => {
//     if (!Array.isArray(round)) return;
//     const slots = round.map((m) => (m && Number.isFinite(m.slot) ? m.slot : null)).filter((s) => s !== null);
//     if (!slots.length) return;
//     const unique = [...new Set(slots)].sort((a, b) => a - b);
//     let sparse = false;
//     for (let i = 1; i < unique.length; i++) {
//       if (unique[i] - unique[i - 1] > 1.01) {
//         sparse = true;
//         break;
//       }
//     }
//     if (!sparse) return;
//     const remap = new Map(unique.map((s, idx) => [s, idx]));
//     round.forEach((m) => {
//       if (m && Number.isFinite(m.slot) && remap.has(m.slot)) {
//         m.slot = remap.get(m.slot);
//       }
//     });
//   };
//
//   tpl.forEach((round) => remapRound(round));
// })();
