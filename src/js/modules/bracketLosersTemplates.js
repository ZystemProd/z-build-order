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
          },
        ],

        // Round 1 (LQF): J, K
        [
          {
            // J = loser(E) vs loser(A)
            a: { from: "W", r: 1, m: 1, res: "L" }, // E
            b: { from: "W", r: 0, m: 0, res: "L" }, // A
          },
          {
            // K = loser(D) vs winner(I)
            a: { from: "W", r: 1, m: 0, res: "L" }, // D
            b: { from: "L", r: 0, m: 0, res: "W" }, // I
          },
        ],

        // Round 2 (LSF): L
        [
          {
            // L = winner(J) vs winner(K)
            a: { from: "L", r: 1, m: 0, res: "W" }, // J
            b: { from: "L", r: 1, m: 1, res: "W" }, // K
          },
        ],

        // Round 3 (LFinal): M
        [
          {
            // M = loser(F) vs winner(L)
            a: { from: "W", r: 2, m: 0, res: "L" }, // F
            b: { from: "L", r: 2, m: 0, res: "W" }, // L
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
          },
          {
            // I = loser(C) vs loser(B)
            a: { from: "W", r: 1, m: 0, res: "L" }, // C
            b: { from: "W", r: 0, m: 1, res: "L" }, // B
          },
        ],

        // Round 1 (LSF): J
        [
          {
            // J = winner(H) vs winner(I)
            a: { from: "L", r: 0, m: 0, res: "W" }, // H
            b: { from: "L", r: 0, m: 1, res: "W" }, // I
          },
        ],

        // Round 2 (LFinal): K
        [
          {
            // K = loser(E) vs winner(J)
            a: { from: "W", r: 2, m: 0, res: "L" }, // E
            b: { from: "L", r: 1, m: 0, res: "W" }, // J
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
        },
      ],
      // Round 1 (L2): L, M
      [
        {
          // L = winner(K) vs loser(D)
          a: { from: "L", r: 0, m: 0, res: "W" }, // K
          b: { from: "W", r: 1, m: 2, res: "L" }, // D
        },
        {
          // M = loser(C) vs loser(B)
          a: { from: "W", r: 1, m: 1, res: "L" }, // C
          b: { from: "W", r: 1, m: 0, res: "L" }, // B
        },
      ],
      // Round 2 (L3 / LQF): N, O
      [
        {
          // N = loser(F) vs winner(L)
          a: { from: "W", r: 2, m: 0, res: "L" }, // F
          b: { from: "L", r: 1, m: 0, res: "W" }, // L
        },
        {
          // O = loser(G) vs winner(M)
          a: { from: "W", r: 2, m: 1, res: "L" }, // G
          b: { from: "L", r: 1, m: 1, res: "W" }, // M
        },
      ],
      // Round 3 (L4 / LSF): P
      [
        {
          // P = winner(N) vs winner(O)
          a: { from: "L", r: 2, m: 0, res: "W" },
          b: { from: "L", r: 2, m: 1, res: "W" },
        },
      ],
      // Round 4 (L5 / LFinal): Q
      [
        {
          // Q = loser(H) vs winner(P)
          a: { from: "W", r: 3, m: 0, res: "L" }, // H
          b: { from: "L", r: 3, m: 0, res: "W" }, // P
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
        },
      ],

      // Round 1 (L2): P, Q, R, S
      [
        {
          // P = loser(I) vs loser(A)
          a: { from: "W", r: 1, m: 3, res: "L" }, // I
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
        },
        {
          // Q = loser(H) vs winner(O)
          a: { from: "W", r: 1, m: 2, res: "L" }, // H
          b: { from: "L", r: 0, m: 0, res: "W" }, // O
        },
        {
          // R = loser(G) vs loser(D)
          a: { from: "W", r: 1, m: 1, res: "L" }, // G
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
        },
        {
          // S = loser(F) vs loser(E)
          a: { from: "W", r: 1, m: 0, res: "L" }, // F
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
        },
      ],

      // Round 2 (L3): T, U
      [
        {
          // T = winner(P) vs winner(Q)
          a: { from: "L", r: 1, m: 0, res: "W" }, // P
          b: { from: "L", r: 1, m: 1, res: "W" }, // Q
        },
        {
          // U = winner(R) vs winner(S)
          a: { from: "L", r: 1, m: 2, res: "W" }, // R
          b: { from: "L", r: 1, m: 3, res: "W" }, // S
        },
      ],

      // Round 3 (LQF): V, W
      [
        {
          // V = loser(J) vs winner(T)
          a: { from: "W", r: 2, m: 0, res: "L" }, // J
          b: { from: "L", r: 2, m: 0, res: "W" }, // T
        },
        {
          // W = loser(K) vs winner(U)
          a: { from: "W", r: 2, m: 1, res: "L" }, // K
          b: { from: "L", r: 2, m: 1, res: "W" }, // U
        },
      ],

      // Round 4 (LSF): X
      [
        {
          // X = winner(V) vs winner(W)
          a: { from: "L", r: 3, m: 0, res: "W" }, // V
          b: { from: "L", r: 3, m: 1, res: "W" }, // W
        },
      ],

      // Round 5 (LFinal): Y
      [
        {
          // Y = loser(L) vs winner(X)
          a: { from: "W", r: 3, m: 0, res: "L" }, // L
          b: { from: "L", r: 4, m: 0, res: "W" }, // X
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
        },
        {
          // Q = loser(E) vs loser(F)
          a: { from: "W", r: 0, m: 4, res: "L" }, // E
          b: { from: "W", r: 0, m: 5, res: "L" }, // F
        },
      ],

      // Round 1 (L2): R, S, T, U
      [
        {
          // R = loser(J) vs loser(A)
          a: { from: "W", r: 1, m: 3, res: "L" }, // J
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
        },
        {
          // S = loser(I) vs winner(P)
          a: { from: "W", r: 1, m: 2, res: "L" }, // I
          b: { from: "L", r: 0, m: 0, res: "W" }, // P
        },
        {
          // T = loser(H) vs loser(D)
          a: { from: "W", r: 1, m: 1, res: "L" }, // H
          b: { from: "W", r: 0, m: 3, res: "L" }, // D
        },
        {
          // U = loser(G) vs winner(Q)
          a: { from: "W", r: 1, m: 0, res: "L" }, // G
          b: { from: "L", r: 0, m: 1, res: "W" }, // Q
        },
      ],

      // Round 2 (L3): V, W
      [
        {
          // V = winner(R) vs winner(S)
          a: { from: "L", r: 1, m: 0, res: "W" }, // R
          b: { from: "L", r: 1, m: 1, res: "W" }, // S
        },
        {
          // W = winner(T) vs winner(U)
          a: { from: "L", r: 1, m: 2, res: "W" }, // T
          b: { from: "L", r: 1, m: 3, res: "W" }, // U
        },
      ],

      // Round 3 (LQF): X, Y
      [
        {
          // X = loser(K) vs winner(V)
          a: { from: "W", r: 2, m: 0, res: "L" }, // K
          b: { from: "L", r: 2, m: 0, res: "W" }, // V
        },
        {
          // Y = loser(L) vs winner(W)
          a: { from: "W", r: 2, m: 1, res: "L" }, // L
          b: { from: "L", r: 2, m: 1, res: "W" }, // W
        },
      ],

      // Round 4 (LSF): Z
      [
        {
          // Z = winner(X) vs winner(Y)
          a: { from: "L", r: 3, m: 0, res: "W" }, // X
          b: { from: "L", r: 3, m: 1, res: "W" }, // Y
        },
      ],

      // Round 5 (LFinal): AA
      [
        {
          // AA = loser(M) vs winner(Z)
          a: { from: "W", r: 3, m: 0, res: "L" }, // M
          b: { from: "L", r: 4, m: 0, res: "W" }, // Z
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
        },
        {
          // R = loser(D) vs loser(E)
          a: { from: "W", r: 0, m: 3, res: "L" }, // D
          b: { from: "W", r: 0, m: 4, res: "L" }, // E
        },
        {
          // S = loser(F) vs loser(G)
          a: { from: "W", r: 0, m: 5, res: "L" }, // F
          b: { from: "W", r: 0, m: 6, res: "L" }, // G
        },
      ],

      // Round 1 (L2): T, U, V, W
      [
        {
          // T = loser(K) vs loser(A)
          a: { from: "W", r: 1, m: 3, res: "L" }, // K
          b: { from: "W", r: 0, m: 0, res: "L" }, // A
        },
        {
          // U = loser(J) vs winner(Q)
          a: { from: "W", r: 1, m: 2, res: "L" }, // J
          b: { from: "L", r: 0, m: 0, res: "W" }, // Q
        },
        {
          // V = loser(I) vs winner(R)
          a: { from: "W", r: 1, m: 1, res: "L" }, // I
          b: { from: "L", r: 0, m: 1, res: "W" }, // R
        },
        {
          // W = loser(H) vs winner(S)
          a: { from: "W", r: 1, m: 0, res: "L" }, // H
          b: { from: "L", r: 0, m: 2, res: "W" }, // S
        },
      ],

      // Round 2 (L3): X, Y
      [
        {
          // X = winner(T) vs winner(U)
          a: { from: "L", r: 1, m: 0, res: "W" }, // T
          b: { from: "L", r: 1, m: 1, res: "W" }, // U
        },
        {
          // Y = winner(V) vs winner(W)
          a: { from: "L", r: 1, m: 2, res: "W" }, // V
          b: { from: "L", r: 1, m: 3, res: "W" }, // W
        },
      ],

      // Round 3 (LQF): Z, AA
      [
        {
          // Z = loser(L) vs winner(X)
          a: { from: "W", r: 2, m: 0, res: "L" }, // L
          b: { from: "L", r: 2, m: 0, res: "W" }, // X
        },
        {
          // AA = loser(M) vs winner(Y)
          a: { from: "W", r: 2, m: 1, res: "L" }, // M
          b: { from: "L", r: 2, m: 1, res: "W" }, // Y
        },
      ],

      // Round 4 (LSF): AB
      [
        {
          // AB = winner(Z) vs winner(AA)
          a: { from: "L", r: 3, m: 0, res: "W" }, // Z
          b: { from: "L", r: 3, m: 1, res: "W" }, // AA
        },
      ],

      // Round 5 (LFinal): AC
      [
        {
          // AC = loser(N) vs winner(AB)
          a: { from: "W", r: 3, m: 0, res: "L" }, // N
          b: { from: "L", r: 4, m: 0, res: "W" }, // AB
        },
      ],
    ],
  },

  16: {
    // 16 players (0 play-ins, total = 16)
    // Let generic DE handle 16+ until explicit templates are added.
    0: null,

    // 17-31 players (1-15 play-ins, total = 17-31) - use generic until defined
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null,
    10: null,
    11: null,
    12: null,
    13: null,
    14: null,
    15: null,
    16: null,
  },
};
