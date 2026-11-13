// Public surface of the automation input layer. The renderer calls update(dt) each frame and reads
// camera.view(aspect) and build.ghost(). The simulation provides a BuildWorld adapter.
export { OrbitCamera, DEFAULT_LIMITS, type CameraLimits, type CameraBounds, type OrbitPose } from "./camera";
export { screenRay, project, pickGround, viewBasis, eyeFrom, type View, type Ray, type GroundHit, type HeightFn } from "./picking";
export { BuildController, DELETE_TOOL, footprintOffsets, type Footprint, type Offset, type ToolSpec, type ItemRef, type BuildWorld, type Ghost, type GhostCell, type BuildEvent } from "./build";
export { type Cell, type Rot, type BoardSize, cellKey, cellInBoard, lineCells, rotate } from "./grid";
export { mapKey, type KeyAction, type KeyLike } from "./keys";
export { PointerInput, type PointerOptions } from "./pointer";
export { vec, type Vec3 } from "./math";

import { type BoardSize } from "./grid";
import { type HeightFn } from "./picking";
import { OrbitCamera, type CameraLimits, type OrbitPose, DEFAULT_LIMITS } from "./camera";
import { BuildController, type BuildWorld, type ToolSpec, DELETE_TOOL, type BuildEvent } from "./build";
import { PointerInput } from "./pointer";
import { mapKey, type KeyAction } from "./keys";

export interface InputOptions {
    element: HTMLElement;
    board: BoardSize;
    world: BuildWorld;
    tools: ToolSpec[];
    heightAt?: HeightFn;
    limits?: CameraLimits;
    initialPose?: Partial<OrbitPose>;
    // Keyboard listener target. Defaults to window. Set to null to skip keyboard handling.
    keyTarget?: Window | null;
    onChange?: () => void;
    onEvent?: (e: BuildEvent) => void;
}

export interface InputController {
    camera: OrbitCamera;
    build: BuildController;
    pointer: PointerInput;
    setToolById(id: string | null): void;
    update(dt: number): void;
    destroy(): void;
}

const isTyping = (t: EventTarget | null): boolean => {
    const el = t as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
};

export function createInputController(opts: InputOptions): InputController {
    const camera = new OrbitCamera(opts.limits ?? DEFAULT_LIMITS, opts.initialPose);
    const build = new BuildController({ world: opts.world, board: opts.board, onEvent: opts.onEvent });
    const pointer = new PointerInput({
        element: opts.element,
        camera,
        build,
        board: opts.board,
        heightAt: opts.heightAt,
        onChange: opts.onChange,
    });
    pointer.attach();

    const toolFor = (id: string | null): ToolSpec | null => {
        if (!id) return null;
        if (id === DELETE_TOOL.id) return DELETE_TOOL;
        return opts.tools.find((t) => t.id === id) ?? null;
    };

    const setToolById = (id: string | null) => build.setTool(toolFor(id));

    const apply = (a: KeyAction): boolean => {
        switch (a.type) {
            case "rotate":
                build.rotateCw();
                return true;
            case "undo":
                return build.undo();
            case "redo":
                return build.redo();
            case "cancel":
                if (build.isStroking()) {
                    build.cancelStroke();
                    return true;
                }
                if (build.getTool()) {
                    build.setTool(null);
                    return true;
                }
                return false;
            case "topdown":
                camera.toggleTopDown();
                return true;
            case "delete-hover": {
                const h = build.getHover();
                return h ? build.deleteAt(h) > 0 : false;
            }
            case "toggle-delete":
                build.setTool(build.getTool()?.id === DELETE_TOOL.id ? null : DELETE_TOOL);
                return true;
            case "tool": {
                const t = opts.tools[a.index];
                if (!t) return false;
                build.setTool(build.getTool()?.id === t.id ? null : t);
                return true;
            }
            case "pan":
                camera.panWorld(a.forward, a.right);
                return true;
            case "zoom":
                camera.zoom(a.factor);
                return true;
            case "space":
                pointer.setSpace(a.down);
                return true;
        }
    };

    const onKey = (e: KeyboardEvent) => {
        if (isTyping(e.target) || e.defaultPrevented) return;
        const action = mapKey({
            key: e.key,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            repeat: e.repeat,
            type: e.type,
        });
        if (!action) return;
        if (apply(action)) {
            e.preventDefault();
            opts.onChange?.();
        }
    };
    const kt = opts.keyTarget === undefined ? window : opts.keyTarget;
    if (kt) {
        kt.addEventListener("keydown", onKey);
        kt.addEventListener("keyup", onKey);
    }

    const unsub = build.subscribe(() => opts.onChange?.());

    return {
        camera,
        build,
        pointer,
        setToolById,
        update(dt: number) {
            camera.update(dt);
        },
        destroy() {
            pointer.detach();
            unsub();
            if (kt) {
                kt.removeEventListener("keydown", onKey);
                kt.removeEventListener("keyup", onKey);
            }
        },
    };
}

// Minimal shape of a THREE.PerspectiveCamera. Duck-typed so this folder never imports three.
export interface ViewSink {
    position: { set(x: number, y: number, z: number): unknown };
    lookAt(x: number, y: number, z: number): void;
    fov: number;
    aspect: number;
    updateProjectionMatrix(): void;
}

export interface MountOptions extends Omit<InputOptions, "element" | "keyTarget"> {
    // Keyboard listener target. Defaults to window.
    keyTarget?: Window | null;
}

export interface MountedInput {
    controller: InputController;
    // Call once per frame: advances the camera and writes its view to the sink.
    update(dt: number): void;
    destroy(): void;
}

// Hooks the input layer up to a camera the page already owns. The renderer keeps the camera; this module
// moves it. Do not run OrbitControls on the same camera at the same time.
export function mount(camera: ViewSink, domElement: HTMLElement, options: MountOptions): MountedInput {
    const controller = createInputController({ ...options, element: domElement, keyTarget: options.keyTarget });
    const write = () => {
        const rect = domElement.getBoundingClientRect();
        const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1;
        const view = controller.camera.view(aspect);
        camera.position.set(view.eye.x, view.eye.y, view.eye.z);
        camera.lookAt(view.target.x, view.target.y, view.target.z);
        camera.fov = (view.fovY * 180) / Math.PI;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
    };
    write();
    return {
        controller,
        update(dt: number) {
            controller.update(dt);
            write();
        },
        destroy() {
            controller.destroy();
        },
    };
}
