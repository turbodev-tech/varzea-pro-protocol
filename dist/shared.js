"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logLevelSchema = exports.dataSchema = exports.peripheralSchema = exports.peripheralTypeSchema = void 0;
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
/** Arbitrary JSON bag carried alongside events and commands. */
exports.dataSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown());
exports.logLevelSchema = zod_1.z.enum(['debug', 'info', 'warn', 'error']);
