// Mara Solano's jobs: three missions in a row, each with a line of story, an objective on the
// screen and a marker in the world. A mission is a small state machine: its steps name a place
// to reach or a thing to do, and the world reports the step done. Finish all three and Solmar
// is Rook's to roam, with the cash to show for it.
import { MISSIONS } from './config.js';

/** Where the jobs happen: the garage, the pier and the dockside. */
export const PLACES = {
  garage: { x: -140, z: 140, label: "Mara's garage" },
  pier: { x: 120, z: 200, label: 'Solmar Pier' },
  docks: { x: -180, z: -160, label: 'Dockside' },
  plaza: { x: 0, z: 0, label: 'Plaza del Sol' },
};

function step(kind, target, text, extra) {
  return { kind, target, text, ...extra };
}

export function createMissions() {
  const list = [
    {
      ...MISSIONS[0],
      brief: 'Mara Solano: "Rook, you owe the house. Steal a car — any car — and bring it to my garage. No cops, no fuss."',
      steps: [
        step('enterCar', null, 'Steal a car (walk up to one and press E)'),
        step('reach', PLACES.garage, "Drive to Mara's garage", { radius: 10 }),
      ],
    },
    {
      ...MISSIONS[1],
      brief: 'Mara: "A package for the pier. The Vultures tipped the cops, so expect company. Ninety seconds — the boat does not wait."',
      steps: [
        step('reach', PLACES.pier, 'Deliver the package to Solmar Pier', { radius: 10, timer: 90, wanted: 1 }),
        step('wait', PLACES.pier, 'Hand over the package…', { wait: 3 }),
      ],
    },
    {
      ...MISSIONS[2],
      brief: 'Mara: "The Vultures hold the dockside. Take it back — all three of them — then come home. This ends tonight."',
      steps: [
        step('reach', PLACES.docks, 'Go to the Dockside', { radius: 14 }),
        step('defeat', PLACES.docks, 'Defeat the Vulture crew (3 left)', { count: 3 }),
        step('reach', PLACES.garage, "Return to Mara's garage", { radius: 10 }),
      ],
    },
  ];
  return {
    list,
    index: 0,
    stepIndex: 0,
    timer: 0,
    waitLeft: 0,
    defeated: 0,
    done: false,
    /** The current step's text and target for the HUD and the minimap. */
    current() {
      if (this.done) return null;
      const mission = this.list[this.index];
      return { mission, step: mission.steps[this.stepIndex], missionIndex: this.index };
    },
    /** Start the current mission's first step (sets its timer and opening wanted level). */
    startStep() {
      const cur = this.current();
      if (!cur) return;
      this.timer = cur.step.timer ?? 0;
      this.waitLeft = cur.step.wait ?? 0;
      this.defeated = 0;
      return cur.step.wanted ?? 0;
    },
    /** A step finished by the world: advance, or finish the mission and pay out. */
    advance() {
      const mission = this.list[this.index];
      this.stepIndex += 1;
      if (this.stepIndex >= mission.steps.length) {
        this.index += 1;
        this.stepIndex = 0;
        if (this.index >= this.list.length) this.done = true;
        return { missionDone: mission, allDone: this.done };
      }
      return { missionDone: null, allDone: false };
    },
  };
}
