/* Pizza Stack song data: "Slice of Sunday" - lofi pop, 80 BPM, swing 0.58, key of C major / A minor.
 * Arranged by a composer/judge panel (3 composers, 3 judges, 1 arranger) and validated in code:
 * every pitch is diatonic to C major so it never clashes with the perfect-drop notes (G A B D E).
 * Notes are MIDI numbers (C4 = 60). One bar = 16 sixteenth steps; the loop is 8 bars. */
window.PT = window.PT || {};
PT.songs = {
  lofipop: {
    title: "Slice of Sunday", bpm: 80, swing: 0.58,
    chords: [
      {"name": "Fmaj9", "notes": [55, 57, 60, 64], "bass": 41},
      {"name": "Em7", "notes": [55, 59, 62, 64], "bass": 40},
      {"name": "Dm9", "notes": [53, 57, 60, 64], "bass": 38},
      {"name": "G13", "notes": [53, 59, 62, 64], "bass": 43},
      {"name": "Cmaj9", "notes": [55, 59, 62, 64], "bass": 36},
      {"name": "Am7", "notes": [52, 55, 60, 64], "bass": 45},
      {"name": "Dm9", "notes": [53, 57, 60, 64], "bass": 38},
      {"name": "G9sus4", "notes": [53, 57, 60, 62], "bass": 43}
    ],
    comp: [
      [{"step": 0, "dur": 6, "vel": 0.6}, {"step": 7, "dur": 3, "vel": 0.42}, {"step": 11, "dur": 4, "vel": 0.5}],
      [{"step": 0, "dur": 3, "vel": 0.62}, {"step": 3, "dur": 4, "vel": 0.4}, {"step": 8, "dur": 3, "vel": 0.5}, {"step": 11, "dur": 5, "vel": 0.45}]
    ],
    bassPattern: [{"step": 0, "dur": 5, "vel": 0.88, "oct": 0}, {"step": 6, "dur": 3, "vel": 0.55, "oct": 0}, {"step": 10, "dur": 3, "vel": 0.7, "oct": 0}, {"step": 13, "dur": 2, "vel": 0.42, "oct": 1}],
    drums: {
      kick: [0, 6, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12], ghost: [3, 11, 15], openHat: [14],
      fill: { kick: [0, 6, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8], ghost: [14, 15], openHat: [10] }
    },
    melody: [
      {"bar": 0, "step": 2, "midi": 72, "dur": 2, "vel": 0.58},
      {"bar": 0, "step": 4, "midi": 77, "dur": 3, "vel": 0.66},
      {"bar": 0, "step": 7, "midi": 76, "dur": 2, "vel": 0.6},
      {"bar": 0, "step": 9, "midi": 77, "dur": 3, "vel": 0.7},
      {"bar": 1, "step": 2, "midi": 79, "dur": 2, "vel": 0.58},
      {"bar": 1, "step": 4, "midi": 74, "dur": 3, "vel": 0.55},
      {"bar": 1, "step": 7, "midi": 76, "dur": 5, "vel": 0.64},
      {"bar": 2, "step": 2, "midi": 74, "dur": 2, "vel": 0.56},
      {"bar": 2, "step": 4, "midi": 76, "dur": 4, "vel": 0.62},
      {"bar": 2, "step": 10, "midi": 79, "dur": 2, "vel": 0.7},
      {"bar": 2, "step": 12, "midi": 77, "dur": 4, "vel": 0.66},
      {"bar": 4, "step": 0, "midi": 76, "dur": 3, "vel": 0.7},
      {"bar": 4, "step": 4, "midi": 81, "dur": 3, "vel": 0.78},
      {"bar": 4, "step": 7, "midi": 79, "dur": 2, "vel": 0.62},
      {"bar": 4, "step": 9, "midi": 81, "dur": 5, "vel": 0.72},
      {"bar": 6, "step": 2, "midi": 72, "dur": 2, "vel": 0.6},
      {"bar": 6, "step": 4, "midi": 77, "dur": 3, "vel": 0.66},
      {"bar": 6, "step": 7, "midi": 76, "dur": 2, "vel": 0.6},
      {"bar": 6, "step": 9, "midi": 74, "dur": 3, "vel": 0.64},
      {"bar": 7, "step": 4, "midi": 77, "dur": 2, "vel": 0.58},
      {"bar": 7, "step": 6, "midi": 74, "dur": 2, "vel": 0.55},
      {"bar": 7, "step": 8, "midi": 72, "dur": 8, "vel": 0.74}
    ]
  }
};
