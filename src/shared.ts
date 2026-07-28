import { z } from 'zod';

/** Field gear reported by the hub. Cloud clients are not peripherals. */
export const peripheralTypeSchema = z.enum(['CAMERA', 'PLACAR']);
export type PeripheralType = z.infer<typeof peripheralTypeSchema>;

/**
 * A peripheral's permanent, self-reported identity. Stable across reboots and
 * DHCP leases — it is the MediaMTX path name and the R2 key segment, so it
 * must never change for a given physical unit.
 */
export const peripheralSchema = z.object({
  hardwareId: z.string().min(1),
  type: peripheralTypeSchema,
  label: z.string().optional(),
  firmwareVersion: z.string().optional(),
});
export type Peripheral = z.infer<typeof peripheralSchema>;

/** Arbitrary JSON bag carried alongside events and commands. */
export const dataSchema = z.record(z.string(), z.unknown());

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
