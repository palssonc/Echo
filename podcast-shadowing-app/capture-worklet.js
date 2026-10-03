class EchoCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pending = new Float32Array(4096);
    this.used = 0;
    this.port.onmessage = event => {
      if (event.data === 'clear') {
        this.pending = new Float32Array(4096);
        this.used = 0;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0] || [];
    const output = outputs[0] || [];
    for (let channel = 0; channel < output.length; channel++) {
      if (input.length) output[channel].set(input[Math.min(channel, input.length - 1)]);
      else output[channel].fill(0);
    }
    if (!input.length) return true;

    for (let frame = 0; frame < input[0].length; frame++) {
      let sample = 0;
      for (const channel of input) sample += channel[frame] / input.length;
      this.pending[this.used++] = sample;
      if (this.used === this.pending.length) {
        this.port.postMessage(this.pending, [this.pending.buffer]);
        this.pending = new Float32Array(4096);
        this.used = 0;
      }
    }
    return true;
  }
}

registerProcessor('echo-capture', EchoCaptureProcessor);
