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
/** Arbitrary JSON bag carried alongside events and commands. */
export declare const dataSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export declare const logLevelSchema: z.ZodEnum<{
    error: "error";
    debug: "debug";
    info: "info";
    warn: "warn";
}>;
