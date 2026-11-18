// A small seeded random source (mulberry32) so a screenshot staged with ?seed=N
// always plays out the same way, and a run with no seed still varies.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random pick from a list, through the same source. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}
