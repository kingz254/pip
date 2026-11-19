import { prisma } from '../lib/prisma';

export interface CreateMessageInput {
    content: string;
    userId: string;
    categoryId: string;
    replyToId?: string;
    attachments?: {
        type: 'image' | 'video';
        url: string;
    }[];
}

export interface UpdateUserInput {
    fullName?: string;
    avatar?: string;
    bio?: string;
    status?: 'online' | 'offline' | 'away';
}

// User Functions
export const getUserByLoginId = async (loginId: string) => {
    return await prisma.user.findUnique({
        where: { loginId },
    });
};

export const createUser = async (loginId: string, fullName: string) => {
    return await prisma.user.create({
        data: {
            loginId,
            fullName,
            status: 'online',
        },
    });
};

export const updateUser = async (loginId: string, data: UpdateUserInput) => {
    return await prisma.user.update({
        where: { loginId },
        data: {
            ...data,
            lastSeen: new Date(),
        },
    });
};

export const updateUserStatus = async (loginId: string, status: 'online' | 'offline' | 'away') => {
    return await prisma.user.update({
        where: { loginId },
        data: {
            status,
            lastSeen: new Date(),
        },
    });
};

export const getUserStats = async (loginId: string) => {
    const user = await prisma.user.findUnique({
        where: { loginId },
        include: {
            messages: true,
        },
    });

    if (!user) return null;

    return {
        id: user.id,
        loginId: user.loginId,
        fullName: user.fullName,
        avatar: user.avatar,
        bio: user.bio,
        status: user.status,
        joinedDate: user.joinedDate,
        messagesCount: user.messages.length,
    };
};

// Category Functions
export const getCategories = async () => {
    return await prisma.category.findMany({
        orderBy: { name: 'asc' },
    });
};

export const getCategoryByName = async (name: string) => {
    return await prisma.category.findUnique({
        where: { name },
    });
};

export const createCategory = async (name: string, description?: string, icon?: string) => {
    return await prisma.category.create({
        data: {
            name,
            description,
            icon,
        },
    });
};

// Message Functions
export const getMessagesByCategory = async (categoryId: string, limit = 50) => {
    return await prisma.message.findMany({
        where: { categoryId },
        include: {
            user: true,
            replyTo: {
                include: {
                    user: true,
                },
            },
            attachments: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
};

export const createMessage = async (data: CreateMessageInput) => {
    const message = await prisma.message.create({
        data: {
            content: data.content,
            userId: data.userId,
            categoryId: data.categoryId,
            replyToId: data.replyToId,
            attachments: data.attachments
                ? {
                      create: data.attachments,
                  }
                : undefined,
        },
        include: {
            user: true,
            replyTo: {
                include: {
                    user: true,
                },
            },
            attachments: true,
        },
    });

    // Update category message count
    await prisma.category.update({
        where: { id: data.categoryId },
        data: {
            messageCount: {
                increment: 1,
            },
        },
    });

    return message;
};

export const deleteMessage = async (messageId: string, userId: string) => {
    // Verify the user owns this message
    const message = await prisma.message.findUnique({
        where: { id: messageId },
    });

    if (!message || message.userId !== userId) {
        throw new Error('Unauthorized or message not found');
    }

    await prisma.message.delete({
        where: { id: messageId },
    });

    // Update category message count
    await prisma.category.update({
        where: { id: message.categoryId },
        data: {
            messageCount: {
                decrement: 1,
            },
        },
    });

    return true;
};

// Initialize default categories
export const initializeCategories = async () => {
    const categories = [
        { name: 'general', description: 'General chat and discussions', icon: '💬' },
        { name: 'support', description: 'Get help and support', icon: '🆘' },
        { name: 'strategies', description: 'Share and discuss trading strategies', icon: '📊' },
    ];

    for (const cat of categories) {
        const exists = await getCategoryByName(cat.name);
        if (!exists) {
            await createCategory(cat.name, cat.description, cat.icon);
        }
    }
};
