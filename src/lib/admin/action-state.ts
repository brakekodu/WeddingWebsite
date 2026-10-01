/** Result returned by admin Server Actions to forms using useActionState. */
export type ActionState<T = undefined> = { ok: boolean; message: string; data?: T } | null;
