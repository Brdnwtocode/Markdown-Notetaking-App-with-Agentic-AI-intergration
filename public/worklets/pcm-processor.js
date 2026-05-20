// public/worklets/pcm-processor.js
//
// Loaded via audioContext.audioWorklet.addModule('/worklets/pcm-processor.js').
// Must live in public/ — Next.js must NOT bundle this file.
//
// Converts Float32 mic samples → Int16 PCM and forwards them to the main
// thread via postMessage. The main thread writes each buffer to the Deepgram
// WebSocket. Using a worklet avoids ScriptProcessorNode (deprecated) and
// keeps audio processing off the React main thread entirely.

class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channelData = inputs[0]?.[0];
    if (!channelData || channelData.length === 0) return true;

    // Float32 [-1, 1] → Int16 [-32768, 32767]
    const int16 = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      // Clamp before converting to avoid wrapping artifacts on loud input
      const clamped = Math.max(-1, Math.min(1, channelData[i]));
      int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }

    // Transfer ownership — zero-copy, avoids GC pressure on the audio thread
    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true; // keep processor alive
  }
}

registerProcessor("pcm-processor", PcmProcessor);
