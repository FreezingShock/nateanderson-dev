// Brasswork audio: the public surface the host uses. Everything here is original, synthesized with the Web Audio API.
//
//   armAudio()                         once on mount: waits for the first click, tap or key press
//   setEnabled(on)                     the Settings "Sound" switch
//   playSound(name, arg?)              one-shots (place, belt, remove, delivery, milestone, ...)
//   setAmbient({ wind, night, working, kinds })   call a few times a second with the world's state
//   attachUiSounds(root)               hover and press sounds, window open and close
//   getMix / setMix / subscribeMix     master, effects and ambient volumes (0..1), saved per browser
import { armAudio, disposeAudio } from "./engine";
import { startAmbient, stopAmbient } from "./ambient";

export { armAudio, setEnabled, isEnabled, getMix, setMix, subscribeMix } from "./engine";
export type { Mix } from "./engine";
export { playSound } from "./sfx";
export type { BwSound, SoundArg } from "./sfx";
export { setAmbient } from "./ambient";
export type { AmbientState } from "./ambient";
export { attachUiSounds } from "./ui";

/** Arm the first-gesture unlock and start the ambient beds. Returns the teardown. */
export function startAudio() {
    armAudio();
    startAmbient();
    return () => {
        stopAmbient();
        disposeAudio();
    };
}
