"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logLevelSchema = exports.dataSchema = exports.macHardwareIdSchema = exports.peripheralSchema = exports.peripheralTypeSchema = void 0;
exports.normaliseMac = normaliseMac;
const zod_1 = require("zod");
/** Field gear reported by the hub. Cloud clients are not peripherals. */
exports.peripheralTypeSchema = zod_1.z.enum(['CAMERA', 'PLACAR']);
/**
 * A peripheral's permanent, self-reported identity. Stable across reboots and
 * DHCP leases — it is the MediaMTX path name and the R2 key segment, so it
 * must never change for a given physical unit.
 */
exports.peripheralSchema = zod_1.z.object({
    hardwareId: zod_1.z.string().min(1),
    type: exports.peripheralTypeSchema,
    label: zod_1.z.string().optional(),
    firmwareVersion: zod_1.z.string().optional(),
});
/**
 * A camera's hardwareId is its MAC: 12 lowercase hex digits, no separators.
 *
 * Colons would fail the API's hardwareId rule and end up in R2 keys, and the
 * case has to be fixed so the hub and the API derive the same id from the same
 * camera, byte for byte.
 */
exports.macHardwareIdSchema = zod_1.z
    .string()
    .regex(/^[0-9a-f]{12}$/, 'expected a MAC as 12 lowercase hex digits');
/**
 * `F0:00:06:21:CD:6E`, `f0-00-06-21-cd-6e` or `F0000621CD6E` → `f0000621cd6e`.
 *
 * Only separators are stripped. Anything else that is not hex means the input
 * was not a MAC, and returns null rather than being quietly coerced into one.
 */
function normaliseMac(input) {
    const bare = input.replace(/[:\-.\s]/g, '').toLowerCase();
    return /^[0-9a-f]{12}$/.test(bare) ? bare : null;
}
/** Arbitrary JSON bag carried alongside events and commands. */
exports.dataSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown());
exports.logLevelSchema = zod_1.z.enum(['debug', 'info', 'warn', 'error']);
