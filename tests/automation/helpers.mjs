// Resolves extensionless imports inside lib/automation to .ts, like the bundler does. Same trick as tests/nodefarm.
import { registerHooks } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
    resolve(spec, ctx, next) {
        try {
            return next(spec, ctx);
        } catch (e) {
            if (spec.startsWith(".")) return next(spec + ".ts", ctx);
            throw e;
        }
    },
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const load = (rel) => import(pathToFileURL(resolve(root, rel)).href);
