import { prisma } from '../store/prisma.js';

export async function createUserIfNotExists(input: {
    username: string;
    password: string;
    displayName?: string | undefined;
}) {
    const existing = await prisma.user.findFirst({
        where: { username: input.username },
    });
    if (existing) return existing;
    return prisma.user.create({
        data: {
            username: input.username,
            password: input.password,
            displayName: input.displayName ?? null,
        },
    });
}

export async function findUserByCredentials(input: {
    username: string;
    password: string;
}) {
    return prisma.user.findFirst({
        where: {
            username: input.username,
            password: input.password,
        },
    });
}
