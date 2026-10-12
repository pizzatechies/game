/* Pizza Stack song data (placeholder until the arrangement is finalised). Key: C major / A minor.
 * Notes are MIDI numbers (C4 = 60). One bar = 16 sixteenth steps; the loop is 8 bars. */
window.PT = window.PT || {};
PT.songs = {
  lofipop: {
    title: 'Placeholder', bpm: 84, swing: 0.58,
    chords: [
      { name: 'Fmaj7', notes: [57, 60, 64, 67], bass: 41 }, { name: 'G7', notes: [59, 62, 65, 69], bass: 43 },
      { name: 'Em7', notes: [55, 59, 62, 67], bass: 40 }, { name: 'Am7', notes: [60, 64, 67, 71], bass: 45 },
      { name: 'Dm7', notes: [53, 57, 60, 64], bass: 38 }, { name: 'Em7', notes: [55, 59, 62, 67], bass: 40 },
      { name: 'Fmaj7', notes: [57, 60, 64, 67], bass: 41 }, { name: 'G7', notes: [59, 62, 65, 69], bass: 43 }
    ],
    comp: [
      [{ step: 0, dur: 6, vel: 0.75 }, { step: 7, dur: 3, vel: 0.55 }, { step: 10, dur: 6, vel: 0.6 }],
      [{ step: 0, dur: 4, vel: 0.7 }, { step: 6, dur: 4, vel: 0.55 }, { step: 11, dur: 5, vel: 0.65 }]
    ],
    bassPattern: [{ step: 0, dur: 3, vel: 0.9, oct: 0 }, { step: 6, dur: 2, vel: 0.6, oct: 0 }, { step: 10, dur: 3, vel: 0.75, oct: 1 }],
    drums: {
      kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], ghost: [9, 15], openHat: [14],
      fill: { kick: [0, 6, 10, 13], snare: [4, 12, 14, 15], hat: [0, 2, 4, 6, 8, 10], ghost: [11], openHat: [] }
    },
    melody: [
      { bar: 0, step: 2, midi: 72, dur: 3, vel: 0.7 }, { bar: 0, step: 6, midi: 76, dur: 2, vel: 0.6 }, { bar: 0, step: 8, midi: 74, dur: 6, vel: 0.65 },
      { bar: 1, step: 2, midi: 71, dur: 3, vel: 0.7 }, { bar: 1, step: 6, midi: 74, dur: 2, vel: 0.6 }, { bar: 1, step: 8, midi: 72, dur: 6, vel: 0.65 },
      { bar: 2, step: 2, midi: 71, dur: 3, vel: 0.7 }, { bar: 2, step: 6, midi: 69, dur: 2, vel: 0.6 }, { bar: 2, step: 8, midi: 67, dur: 6, vel: 0.65 },
      { bar: 3, step: 4, midi: 69, dur: 4, vel: 0.7 }, { bar: 3, step: 10, midi: 72, dur: 4, vel: 0.6 },
      { bar: 4, step: 2, midi: 69, dur: 3, vel: 0.7 }, { bar: 4, step: 6, midi: 72, dur: 2, vel: 0.6 }, { bar: 4, step: 8, midi: 71, dur: 6, vel: 0.65 },
      { bar: 5, step: 2, midi: 67, dur: 3, vel: 0.7 }, { bar: 5, step: 6, midi: 71, dur: 2, vel: 0.6 }, { bar: 5, step: 8, midi: 74, dur: 6, vel: 0.65 },
      { bar: 6, step: 2, midi: 72, dur: 3, vel: 0.7 }, { bar: 6, step: 6, midi: 69, dur: 2, vel: 0.6 }, { bar: 6, step: 8, midi: 72, dur: 4, vel: 0.65 },
      { bar: 7, step: 4, midi: 71, dur: 3, vel: 0.7 }, { bar: 7, step: 8, midi: 67, dur: 6, vel: 0.65 }
    ]
  }
};
