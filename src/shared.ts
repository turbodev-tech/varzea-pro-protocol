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

/**
 * A camera's hardwareId is its MAC: 12 lowercase hex digits, no separators.
 *
 * Colons would fail the API's hardwareId rule and end up in R2 keys, and the
 * case has to be fixed so the hub and the API derive the same id from the same
 * camera, byte for byte.
 */
export const macHardwareIdSchema = z
  .string()
  .regex(/^[0-9a-f]{12}$/, 'expected a MAC as 12 lowercase hex digits');

/**
 * `F0:00:06:21:CD:6E`, `f0-00-06-21-cd-6e` or `F0000621CD6E` → `f0000621cd6e`.
 *
 * Only separators are stripped. Anything else that is not hex means the input
 * was not a MAC, and returns null rather than being quietly coerced into one.
 */
export function normaliseMac(input: string): string | null {
  const bare = input.replace(/[:\-.\s]/g, '').toLowerCase();
  return /^[0-9a-f]{12}$/.test(bare) ? bare : null;
}

/** Arbitrary JSON bag carried alongside events and commands. */
export const dataSchema = z.record(z.string(), z.unknown());

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);
