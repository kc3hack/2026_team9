import type { ZodType } from "zod";

export type SessionUser = {
	id: string;
	name: string;
	email: string;
	image?: string | null;
};

export type SessionPayload = {
	session: {
		id: string;
		userId: string;
	};
	user: SessionUser;
};

export type SessionResponse = SessionPayload | null;

export type AuthSchemas = {
	SessionPayloadSchema: ZodType<SessionPayload>;
	SessionResponseSchema: ZodType<SessionResponse>;
};

export function createAuthSchemas(z: typeof import("zod")): AuthSchemas {
	const SessionUserSchema = z.object({
		id: z.string(),
		name: z.string(),
		email: z.string(),
		image: z.string().nullable().optional(),
	});

	const SessionPayloadSchema = z.object({
		session: z.object({
			id: z.string(),
			userId: z.string(),
		}),
		user: SessionUserSchema,
	});

	const SessionResponseSchema = z.union([SessionPayloadSchema, z.null()]);

	return { SessionPayloadSchema, SessionResponseSchema };
}
