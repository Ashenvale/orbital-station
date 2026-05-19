// Stubs de APIs de navegador para testear sfx.js (WebAudio) en Node.
// installBrowser() es idempotente y devuelve contadores para asserts.
export const audioStats = { contexts: 0 };

class FakeParam {
  constructor() {
    this.value = 0;
  }
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
  linearRampToValueAtTime() {}
}
class FakeNode {
  constructor() {
    this.gain = new FakeParam();
    this.frequency = new FakeParam();
    this.detune = new FakeParam();
    this.type = 'sine';
    this.curve = null;
  }
  connect() {
    return new FakeNode();
  }
  start() {}
  stop() {}
}
class FakeAudioContext {
  constructor() {
    audioStats.contexts++;
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = new FakeNode();
  }
  createGain() {
    return new FakeNode();
  }
  createOscillator() {
    return new FakeNode();
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  createWaveShaper() {
    return new FakeNode();
  }
  createBufferSource() {
    return new FakeNode();
  }
  createBuffer(ch, len) {
    return { getChannelData: () => new Float32Array(len) };
  }
  resume() {}
}

export function installBrowser() {
  if (!globalThis.window) globalThis.window = {};
  globalThis.window.AudioContext = FakeAudioContext;
  if (!globalThis.document) {
    globalThis.document = { addEventListener() {} };
  }
  globalThis.Audio = class {
    constructor() {
      this.paused = true;
    }
    play() {}
    pause() {}
    addEventListener() {}
  };
  audioStats.contexts = 0;
}
