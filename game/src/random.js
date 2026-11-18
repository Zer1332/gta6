// SOLMAR — random.js
// RNG deterministik (mulberry32) supaya mode screenshot ?shot=&seed=
// selalu menghasilkan kota dan lalu lintas yang sama.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Bilangan [min, max).
    range(min, max) {
      return min + next() * (max - min);
    },
    // Bilangan bulat [min, max].
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // Satu elemen acak dari array.
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
  };
}
