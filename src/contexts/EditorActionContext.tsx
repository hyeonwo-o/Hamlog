
import { createContext, useContext } from 'react';

interface EditorActionContextType {
    onSetCover: (src: string) => void;
    currentCoverUrl?: string;
    uploadLocalImage?: (file: File) => Promise<{ url: string }>;
}

export const EditorActionContext = createContext<EditorActionContextType | null>(null);

export const useEditorAction = () => {
    const context = useContext(EditorActionContext);
    if (!context) {
        throw new Error('useEditorAction must be used within an EditorActionProvider');
    }
    return context;
};
