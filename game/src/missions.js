// missions.js — the 10-mission story of Leo Marín in Costa Mirada.
// Original story and code written for this game. Each mission is a list of
// steps; the manager advances steps, moves the objective marker, plays
// dialogue, and pays the reward. Main.js supplies world callbacks
// (spawning enemies, chase cars, passengers) through the context object.
import * as THREE from 'three';

export const MISSIONS = [
  {
    name: 'Homecoming',
    reward: 150,
    intro: [
      ['ROSA', 'Leo! You actually came back. The garage is mine now — and the loan sharks want it.'],
      ['LEO', 'Then we pay them back. One job at a time. What do you need first?'],
      ['ROSA', 'Walk over to the garage door. I have a car waiting — sort of.'],
    ],
    steps: [
      { type: 'goto', x: 30, z: -8, radius: 5, text: 'Go to Rosa\'s garage' },
      { type: 'goto', x: -215, z: 60, radius: 6, text: 'Drive or walk to the beach bar' },
    ],
  },
  {
    name: 'First Wheels',
    reward: 200,
    intro: [
      ['ROSA', 'That rust bucket won\'t cut it. Costa Mirada is full of nice cars with unlocked doors.'],
      ['LEO', 'You want me to steal one? First day back and I\'m already a criminal again.'],
      ['ROSA', 'Borrow. With style. Press E near any car on the street.'],
    ],
    steps: [
      { type: 'enterCar', text: 'Steal a car (press E near one)' },
      { type: 'goto', x: -180, z: 120, radius: 7, text: 'Take the car to the Dockside chop shop' },
    ],
  },
  {
    name: 'The Collector',
    reward: 300,
    intro: [
      ['ROSA', 'Three clients owe us. Drive down to Dockside and collect — politely, at first.'],
      ['LEO', 'Polite is my middle name. Mostly.'],
    ],
    steps: [
      { type: 'goto', x: -180, z: 180, radius: 6, text: 'Collect from the fish market' },
      { type: 'goto', x: -120, z: 180, radius: 6, text: 'Collect from the warehouse' },
      { type: 'goto', x: -60, z: 240, radius: 6, text: 'Collect from the pier café' },
    ],
  },
  {
    name: 'Hot Pursuit',
    reward: 400,
    intro: [
      ['ROSA', 'One of the debtors just drove off with our money in his trunk. Catch him!'],
      ['LEO', 'I was born for this. Get in the car and hold on.'],
    ],
    steps: [
      { type: 'catchCar', x: 60, z: 120, text: 'Chase the debtor\'s car — stay close to catch him' },
    ],
  },
  {
    name: 'Beach Brawl',
    reward: 450,
    intro: [
      ['ROSA', 'The Marlin gang is shaking down the beach bars. They owe US now.'],
      ['LEO', 'Time to remind them who runs Marina Bay. F to punch, click to shoot.'],
    ],
    steps: [
      { type: 'defeat', x: -215, z: 60, radius: 10, count: 4, text: 'Deal with the Marlin gang at the beach (4)' },
    ],
  },
  {
    name: 'Sunset Taxi',
    reward: 250,
    intro: [
      ['ROSA', 'Slow day. A tourist at Old Town Plaza needs a ride to the east hotels.'],
      ['LEO', 'A taxi driver? I used to outrun the whole police force, Rosa.'],
      ['ROSA', 'And now you drive tourists. Pick them up — in a car, genius.'],
    ],
    steps: [
      { type: 'pickup', x: 30, z: 30, radius: 5, text: 'Pick up the tourist at Old Town Plaza' },
      { type: 'dropoff', x: 180, z: -180, radius: 7, text: 'Drop the tourist at the Sunset hotels' },
    ],
  },
  {
    name: 'Street King',
    reward: 600,
    intro: [
      ['ROSA', 'Tonight the street racers run the loop. Win it and the whole city knows your name.'],
      ['LEO', 'Five checkpoints, one crown. Let\'s race.'],
    ],
    steps: [
      { type: 'race', checkpoints: [
        { x: 120, z: 0 }, { x: 120, z: 120 }, { x: 0, z: 180 },
        { x: -180, z: 120 }, { x: -120, z: -60 }, { x: 60, z: -60 },
      ], timeLimit: 210, text: 'Race the loop — hit every checkpoint' },
    ],
  },
  {
    name: 'The Drop',
    reward: 700,
    intro: [
      ['ROSA', 'A package for the pier. The cops are watching the docks tonight — two stars, at least.'],
      ['LEO', 'Then I deliver fast and disappear. Nobody catches Leo Marín.'],
    ],
    steps: [
      { type: 'goto', x: -300, z: 60, radius: 8, text: 'Deliver the package to the pier (police are watching!)' },
      { type: 'escape', seconds: 20, text: 'Lose the police!' },
    ],
  },
  {
    name: 'Repo Men',
    reward: 800,
    intro: [
      ['ROSA', 'They took my car. MY car. The repo men are holding it at the old lot.'],
      ['LEO', 'Nobody takes my sister\'s car. I\'m getting it back — whatever it takes.'],
    ],
    steps: [
      { type: 'defeat', x: 180, z: 180, radius: 12, count: 5, text: 'Clear out the repo men at the old lot (5)' },
      { type: 'enterCar', x: 180, z: 180, radius: 10, text: 'Get in Rosa\'s car and bring it home' },
      { type: 'goto', x: 30, z: -8, radius: 6, text: 'Bring Rosa\'s car back to the garage' },
    ],
  },
  {
    name: 'Take the City',
    reward: 1500,
    intro: [
      ['ROSA', 'This is it. The loan shark boss is meeting his crew at the plaza. End this, Leo.'],
      ['LEO', 'For the garage. For us. Costa Mirada is ours tonight.'],
    ],
    steps: [
      { type: 'catchCar', x: 0, z: 120, text: 'Chase the boss\'s car to the plaza' },
      { type: 'defeat', x: 30, z: 30, radius: 14, count: 6, text: 'Take down the boss\'s crew at the plaza (6)' },
      { type: 'escape', seconds: 25, text: 'Lose the police and own the city!' },
    ],
  },
];

export function createMissionManager(ctx) {
  // ctx: { showDialog, toast, addMoney, setWanted, spawnEnemies, spawnChaseCar,
  //        spawnPassenger, removePassenger, onMissionComplete, onStoryComplete,
  //        onMissionFailed, playerHasCar }
  let missionIndex = -1; // -1 = free roam / no mission
  let stepIndex = 0;
  let stepState = {};
  let dialogQueue = [];
  let dialogTimer = 0;
  let active = false;
  let failed = false;

  const markerGroup = new THREE.Group();
  markerGroup.name = 'mission-marker';
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 40, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffc020, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.y = 20;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.35, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  arrow.rotation.x = Math.PI;
  arrow.position.y = 9;
  markerGroup.add(beacon, ring, arrow);
  markerGroup.visible = false;
  ctx.scene.add(markerGroup);

  function mission() { return MISSIONS[missionIndex]; }
  function step() { return mission()?.steps[stepIndex]; }

  function showIntro() {
    dialogQueue = [...mission().intro];
    dialogTimer = 0;
  }

  function beginStep() {
    stepState = {};
    const s = step();
    if (!s) return;
    if (s.type === 'defeat') {
      stepState.remaining = s.count;
      ctx.spawnEnemies(s.x, s.z, s.count, s.radius);
    } else if (s.type === 'catchCar') {
      stepState.chase = ctx.spawnChaseCar(s.x, s.z);
      stepState.catchTime = 0;
    } else if (s.type === 'pickup') {
      ctx.spawnPassenger(s.x, s.z);
    } else if (s.type === 'race') {
      stepState.cpIndex = 0;
      stepState.timeLeft = s.timeLimit;
    } else if (s.type === 'escape') {
      stepState.timeLeft = s.seconds;
      if (ctx.setWanted) ctx.setWanted(2);
    }
    updateMarker();
  }

  function updateMarker() {
    const s = step();
    if (!s || !active) { markerGroup.visible = false; return; }
    let pos = null;
    if (s.type === 'race') pos = s.checkpoints[stepState.cpIndex || 0];
    else if (s.type === 'catchCar') pos = stepState.chase ? stepState.chase.getPos() : { x: s.x, z: s.z };
    else if (s.type === 'escape') { markerGroup.visible = false; return; }
    else pos = { x: s.x, z: s.z };
    if (pos) {
      markerGroup.visible = true;
      markerGroup.position.set(pos.x, 0, pos.z);
    }
  }

  function advance() {
    ctx.toast?.('Objective complete');
    stepIndex++;
    if (stepIndex >= mission().steps.length) completeMission();
    else beginStep();
  }

  function completeMission() {
    const m = mission();
    active = false;
    markerGroup.visible = false;
    ctx.addMoney?.(m.reward);
    ctx.onMissionComplete?.(missionIndex, m);
    missionIndex++;
    stepIndex = 0;
    if (missionIndex >= MISSIONS.length) {
      ctx.onStoryComplete?.();
    }
  }

  function failMission(reason) {
    if (!active) return;
    active = false;
    failed = true;
    markerGroup.visible = false;
    ctx.onMissionFailed?.(reason);
  }

  return {
    get missionIndex() { return missionIndex; },
    get active() { return active; },
    get failed() { return failed; },
    markerGroup,
    startMission(i) {
      missionIndex = i;
      stepIndex = 0;
      failed = false;
      active = true;
      ctx.setObjective?.(MISSIONS[i].name, MISSIONS[i].steps[0].text);
      showIntro();
      beginStep();
    },
    startNext() {
      if (missionIndex < 0) this.startMission(0);
      else if (missionIndex < MISSIONS.length) this.startMission(missionIndex);
    },
    stop() {
      active = false;
      markerGroup.visible = false;
      missionIndex = -1;
    },
    restartCurrent() {
      if (missionIndex >= 0 && missionIndex < MISSIONS.length) this.startMission(missionIndex);
    },
    reportKill() {
      if (!active) return;
      const s = step();
      if (s?.type === 'defeat') {
        stepState.remaining = (stepState.remaining ?? s.count) - 1;
        if (stepState.remaining <= 0) advance();
      }
    },
    reportEnteredCar() {
      if (!active) return;
      const s = step();
      if (s?.type === 'enterCar') advance();
    },
    reportPassengerBoarded() {
      if (!active) return;
      const s = step();
      if (s?.type === 'pickup') advance();
    },
    currentText() {
      if (!active || !mission()) return 'Free roam — explore Costa Mirada.';
      const s = step();
      if (!s) return '';
      if (s.type === 'race') {
        const left = Math.max(0, Math.ceil(stepState.timeLeft || 0));
        return `${s.text} — checkpoint ${(stepState.cpIndex || 0) + 1}/${s.checkpoints.length} · ${left}s left`;
      }
      if (s.type === 'defeat') {
        return `${s.text} — ${stepState.remaining ?? s.count} left`;
      }
      if (s.type === 'escape') {
        return `${s.text} — ${Math.max(0, Math.ceil(stepState.timeLeft || 0))}s`;
      }
      return s.text;
    },
    currentName() {
      return active && mission() ? `Mission ${missionIndex + 1}/10 — ${mission().name}` : 'COSTA MIRADA';
    },
    markerPos() {
      if (!active || !markerGroup.visible) return null;
      return { x: markerGroup.position.x, z: markerGroup.position.z };
    },
    update(dt, state) {
      // Dialogue lines, one at a time.
      if (dialogQueue.length) {
        dialogTimer -= dt;
        if (dialogTimer <= 0) {
          const [who, text] = dialogQueue.shift();
          ctx.showDialog?.(who, text);
          dialogTimer = 4.2;
        }
      }
      if (!active || !mission()) return;
      const s = step();
      if (!s) return;
      // Marker animation + chase marker follow.
      if (markerGroup.visible) {
        ring.rotation.z += dt * 1.5;
        arrow.position.y = 9 + Math.sin(performance.now() * 0.004) * 1.2;
        if (s.type === 'catchCar' && stepState.chase) {
          const p = stepState.chase.getPos();
          markerGroup.position.set(p.x, 0, p.z);
        } else if (s.type === 'race') {
          const cp = s.checkpoints[stepState.cpIndex || 0];
          if (cp) markerGroup.position.set(cp.x, 0, cp.z);
        }
      }
      const px = state.x, pz = state.z;
      const distTo = (x, z) => Math.hypot(px - x, pz - z);
      switch (s.type) {
        case 'goto':
        case 'dropoff':
          if (distTo(s.x, s.z) < s.radius) advance();
          break;
        case 'pickup':
          if (state.inCar && distTo(s.x, s.z) < s.radius) {
            ctx.removePassenger?.();
            ctx.toast?.('Passenger aboard!');
            advance();
          } else if (!state.inCar && distTo(s.x, s.z) < s.radius) {
            ctx.toast?.('Get in a car to pick up the passenger');
          }
          break;
        case 'enterCar':
          if (state.inCar) {
            if (!s.x || distTo(s.x, s.z) < (s.radius || 9999)) advance();
          }
          break;
        case 'catchCar': {
          const chase = stepState.chase;
          if (!chase) break;
          const cp = chase.getPos();
          const d = Math.hypot(px - cp.x, pz - cp.z);
          if (d < 11) {
            stepState.catchTime += dt;
            if (stepState.catchTime > 2.5) {
              chase.caught = true;
              ctx.toast?.('Target caught!');
              advance();
            }
          } else stepState.catchTime = 0;
          break;
        }
        case 'race': {
          stepState.timeLeft -= dt;
          const cp = s.checkpoints[stepState.cpIndex];
          if (cp && distTo(cp.x, cp.z) < 8) {
            stepState.cpIndex++;
            ctx.toast?.(`Checkpoint ${stepState.cpIndex}/${s.checkpoints.length}`);
            if (stepState.cpIndex >= s.checkpoints.length) {
              ctx.toast?.('Race won!');
              advance();
            } else updateMarker();
          }
          if (stepState.timeLeft <= 0) failMission('Out of time — the racers left without you.');
          break;
        }
        case 'escape': {
          stepState.timeLeft -= dt;
          if ((ctx.getWanted?.() ?? 0) === 0) {
            ctx.toast?.('You lost them!');
            advance();
          } else if (stepState.timeLeft <= 0) {
            // Still wanted when the timer ends: give a partial pass if heat is low.
            if ((ctx.getWanted?.() ?? 0) <= 1) advance();
            else failMission('The police caught up with you.');
          }
          break;
        }
        default: break;
      }
    },
  };
}
