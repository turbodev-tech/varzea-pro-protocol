import { z } from 'zod';
/** Field gear reported by the hub. Cloud clients are not peripherals. */
export declare const peripheralTypeSchema: z.ZodEnum<{
    CAMERA: "CAMERA";
    PLACAR: "PLACAR";
}>;
export type PeripheralType = z.infer<typeof peripheralTypeSchema>;
/**
 * A peripheral's permanent, self-reported identity. Stable across reboots and
 * DHCP leases — it is the MediaMTX path name and the R2 key segment, so it
 * must never change for a given physical unit.
 */
export declare const peripheralSchema: z.ZodObject<{
    hardwareId: z.ZodString;
    type: z.ZodEnum<{
        CAMERA: "CAMERA";
        PLACAR: "PLACAR";
    }>;
    label: z.ZodOptional<z.ZodString>;
    firmwareVersion: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Peripheral = z.infer<typeof peripheralSchema>;
/**
 * A camera's hardwareId is its MAC: 12 lowercase hex digits, no separators.
 *
 * Colons would fail the API's hardwareId rule and end up in R2 keys, and the
 * case has to be fixed so the hub and the API derive the same id from the same
 * camera, byte for byte.
 */
export declare const macHardwareIdSchema: z.ZodString;
/**
 * `F0:00:06:21:CD:6E`, `f0-00-06-21-cd-6e` or `F0000621CD6E` → `f0000621cd6e`.
 *
 * Only separators are stripped. Anything else that is not hex means the input
 * was not a MAC, and returns null rather than being quietly coerced into one.
 */
export declare function normaliseMac(input: string): string | null;
/** Arbitrary JSON bag carried alongside events and commands. */
export declare const dataSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export declare const logLevelSchema: z.ZodEnum<{
    error: "error";
    debug: "debug";
    info: "info";
    warn: "warn";
}>;
