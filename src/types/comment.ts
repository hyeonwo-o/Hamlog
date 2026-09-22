export interface Comment {
    id: string;
    postId: string;
    author: string;
    content: string;
    createdAt: string;
}

export type CommentVisibilityFilter = 'all' | 'visible' | 'hidden';

export interface ModeratedComment extends Comment {
    moderation: {
        hidden: boolean;
        version: string;
        updatedAt?: string;
    };
    post: {
        id: string;
        title: string;
        status: 'draft' | 'scheduled' | 'published' | 'trashed' | 'missing';
        publicVisible: boolean;
    };
}

export interface CommentModerationPage {
    comments: ModeratedComment[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}
