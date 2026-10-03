const EchoCapture = (() => {
  let lastStatusAt = 0;

  function setStatus(message, unavailable = false) {
    const label = $('#captureStatus');
    if (!label) return;
    label.textContent = message;
    label.classList.toggle('unavailable', unavailable);
  }

  function status() {
    if (!state.current) return;
    if (state.corsFallback) {
      setStatus('This host blocks browser clipping. If you already saved this episode, play it from Downloads.', true);
    } else if (state.captureMode === 'direct') {
      setStatus('Audio capture is unavailable in this browser for this playback.', true);
    } else if (audio.paused) {
      setStatus('Start playback to prepare clipping.');
    } else if (state.audioCtx && state.audioCtx.state !== 'running') {
      setStatus('Tap play to activate audio capture on this device.');
    } else if (state.ringSamples < state.audioCtx.sampleRate) {
      setStatus('Preparing the clip buffer…');
    } else {
      const seconds = Math.floor(state.ringSamples / state.audioCtx.sampleRate * audio.playbackRate);
      if (seconds < 10) setStatus(seconds + 's captured · keep listening for a 10s clip');
      else if (seconds < 45) setStatus('10s clip ready · ' + seconds + 's captured');
      else setStatus('10s and 45s clips ready');
    }
  }

  function appendSamples(samples) {
    if (!state.ring?.length) return;
    if (Date.now() < (state.discardCaptureUntil || 0)) return;
    for (let i = 0; i < samples.length; i++) {
      state.ring[(state.ringAt + i) % state.ring.length] = samples[i];
    }
    state.ringAt = (state.ringAt + samples.length) % state.ring.length;
    state.ringSamples = Math.min(state.ring.length, state.ringSamples + samples.length);
    if (Date.now() - lastStatusAt > 1000) {
      lastStatusAt = Date.now();
      status();
    }
  }

  function clearBuffer() {
    if (state.ring?.fill) state.ring.fill(0);
    if (state.captureMode === 'worklet') state.processor?.port.postMessage('clear');
    state.ringAt = 0;
    state.ringSamples = 0;
    state.discardCaptureUntil = Date.now() + 150;
    status();
  }

  function prime() {
    if (state.audioCtx) return state.audioCtx;
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) {
      state.captureMode = 'direct';
      status();
      return null;
    }
    try {
      const ctx = new AudioContextType();
      state.audioCtx = ctx;
      state.ring = new Float32Array(ctx.sampleRate * 70);
      if (ctx.audioWorklet && window.AudioWorkletNode) {
        ctx.audioWorklet.addModule('./capture-worklet.js')
          .then(() => { if (state.audioCtx === ctx) state.workletReady = true; })
          .catch(() => {});
      }
      return ctx;
    } catch {
      state.captureMode = 'direct';
      status();
      return null;
    }
  }

  function resumeFromGesture() {
    const ctx = prime();
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => status());
  }

  function start() {
    if (state.corsFallback) { status(); return; }
    const ctx = prime();
    if (!ctx) { status(); return; }
    try {
      if (!state.sourceNode) state.sourceNode = ctx.createMediaElementSource(audio);
      if (!state.processor) {
        if (state.workletReady) {
          state.processor = new AudioWorkletNode(ctx, 'echo-capture', {
            numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2]
          });
          state.processor.port.onmessage = event => appendSamples(event.data);
          state.captureMode = 'worklet';
        } else {
          state.processor = ctx.createScriptProcessor(4096, 2, 2);
          state.processor.onaudioprocess = event => {
            const input = event.inputBuffer;
            const output = event.outputBuffer;
            const mono = new Float32Array(input.length);
            for (let channel = 0; channel < input.numberOfChannels; channel++) {
              const samples = input.getChannelData(channel);
              for (let i = 0; i < samples.length; i++) mono[i] += samples[i] / input.numberOfChannels;
            }
            for (let channel = 0; channel < output.numberOfChannels; channel++) {
              output.getChannelData(channel).set(input.getChannelData(Math.min(channel, input.numberOfChannels - 1)));
            }
            appendSamples(mono);
          };
          state.captureMode = 'script';
        }
        state.sourceNode.connect(state.processor);
        state.processor.connect(ctx.destination);
      }
      if (ctx.state !== 'running') ctx.resume().catch(() => status());
      status();
    } catch {
      try {
        state.sourceNode?.disconnect();
        state.sourceNode?.connect(ctx.destination);
        state.captureMode = 'direct';
        ctx.resume().catch(() => {});
      } catch {}
      status();
    }
  }

  function reset() {
    const ctx = state.audioCtx;
    try { state.sourceNode?.disconnect(); } catch {}
    try { state.processor?.disconnect(); } catch {}
    if (ctx) ctx.close().catch(() => {});
    state.audioCtx = null;
    state.sourceNode = null;
    state.processor = null;
    state.workletReady = false;
    state.captureMode = 'none';
    state.ring = [];
    state.ringSamples = 0;
    state.ringAt = 0;
    status();
  }

  return {prime, resumeFromGesture, start, status, reset, clearBuffer};
})();
