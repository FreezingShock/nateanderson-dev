// Shared WebAudio pieces for the site sound and the Brasswork sound: one way to get an AudioContext and one way to
// build the short synthetic room used as a convolution reverb. Each caller passes its own room shape, so the sound
// each game makes stays the same.

export type RoomShape = {
    /** Length of the room tail in seconds. */
    seconds: number;
    /** Smoothing pole of the noise filter (0 to 1). Higher is darker. */
    pole: number;
    /** Exponent of the decay envelope. Higher dies away faster. */
    decay: number;
};

/** The AudioContext constructor, with the webkit prefix as a fallback. Null when there is no window or no audio. */
export function audioContextClass(): typeof AudioContext | null {
    if (typeof window === "undefined") return null;
    return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null;
}

/** Decaying, low-passed noise in stereo. Used as the impulse response of a ConvolverNode. */
export function makeRoomImpulse(ctx: AudioContext, shape: RoomShape): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * shape.seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        let last = 0;
        for (let i = 0; i < len; i++) {
            last = last * shape.pole + (Math.random() * 2 - 1) * (1 - shape.pole);
            d[i] = last * Math.pow(1 - i / len, shape.decay);
        }
    }
    return b;
}
