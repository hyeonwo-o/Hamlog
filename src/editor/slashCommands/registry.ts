import type { Editor } from '@tiptap/core';
import { API_BASE_URL } from '../../api/client';
import { promptForText, showEditorToast } from '../../utils/editorDialog';
import { DEFAULT_MERMAID_SOURCE } from '../../utils/mermaid';
import type { SlashCommandContext, SlashCommandItem } from './types';

const createColumnContent = (count: 2 | 3, contentType: 'paragraph' | 'image') => {
  const layout = count === 3 ? 'three-column' : 'two-column';
  const columnContent = contentType === 'image'
    ? { type: 'image', attrs: { src: '' } }
    : { type: 'paragraph' };

  return {
    type: 'columns',
    attrs: { layout },
    content: Array.from({ length: count }, () => ({
      type: 'column',
      content: [columnContent]
    }))
  };
};

const insertFallbackLink = (editor: Editor, url: string) => {
  editor
    .chain()
    .focus()
    .insertContent({
      type: 'text',
      text: url,
      marks: [{ type: 'link', attrs: { href: url } }]
    })
    .run();
};

const createStaticCommand = (
  config: Omit<SlashCommandItem, 'command'>,
  command: (context: SlashCommandContext) => void
): SlashCommandItem => ({
  ...config,
  command
});

const createPromptedCommand = (
  config: Omit<SlashCommandItem, 'command'>,
  prompt: () => Promise<string | null>,
  command: (context: SlashCommandContext, value: string) => void | Promise<void>
): SlashCommandItem => ({
  ...config,
  command: async (context) => {
    const rawValue = await prompt();
    const value = rawValue?.trim();
    if (!value) return;
    await command(context, value);
  }
});

export const getSlashCommandItems = (): SlashCommandItem[] => [
  createStaticCommand(
    {
      title: '제목 1',
      description: '가장 큰 제목',
      searchTerms: ['h1', 'heading', '제목'],
      icon: 'H1'
    },
    ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    }
  ),
  createStaticCommand(
    {
      title: '제목 2',
      description: '중간 크기 제목',
      searchTerms: ['h2', 'heading', '제목'],
      icon: 'H2'
    },
    ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    }
  ),
  createStaticCommand(
    {
      title: '제목 3',
      description: '작은 제목',
      searchTerms: ['h3', 'heading', '제목'],
      icon: 'H3'
    },
    ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    }
  ),
  createStaticCommand(
    {
      title: '본문',
      description: '일반 텍스트',
      searchTerms: ['p', 'paragraph', '본문'],
      icon: 'T'
    },
    ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    }
  ),
  createStaticCommand(
    {
      title: '글머리 목록',
      description: '순서 없는 목록',
      searchTerms: ['unordered', 'point', 'list', '목록'],
      icon: '•'
    },
    ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    }
  ),
  createStaticCommand(
    {
      title: '번호 목록',
      description: '순서 있는 목록',
      searchTerms: ['ordered', 'number', 'list', '목록'],
      icon: '1.'
    },
    ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    }
  ),
  createStaticCommand(
    {
      title: '인용구',
      description: '인용문 작성',
      searchTerms: ['quote', 'blockquote', '인용'],
      icon: '“'
    },
    ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    }
  ),
  createStaticCommand(
    {
      title: '코드 블록',
      description: '코드 작성',
      searchTerms: ['code', 'block', '코드'],
      icon: '<>'
    },
    ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    }
  ),
  createStaticCommand(
    {
      title: '구분선',
      description: '수평선 삽입',
      searchTerms: ['line', 'divider', 'rule', '구분선'],
      icon: '—'
    },
    ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    }
  ),
  createPromptedCommand(
    {
      title: '이미지 URL',
      description: 'URL로 이미지 삽입',
      searchTerms: ['image', 'photo', 'picture', '이미지'],
      icon: '🖼'
    },
    () => promptForText({
      title: '이미지 URL 입력',
      placeholder: 'https://'
    }),
    ({ editor, range }, url) => {
      editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
    }
  ),
  createStaticCommand(
    {
      title: '표',
      description: '3x3 표 삽입',
      searchTerms: ['table', 'grid', '표'],
      icon: '▦'
    },
    ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
  ),
  createPromptedCommand(
    {
      title: '유튜브',
      description: '유튜브 영상 삽입',
      searchTerms: ['youtube', 'video', '유튜브', '영상'],
      icon: '▶'
    },
    () => promptForText({
      title: '유튜브 URL 입력',
      placeholder: 'https://www.youtube.com/watch?v=...'
    }),
    ({ editor, range }, url) => {
      editor.chain().focus().deleteRange(range).setYoutubeVideo({ src: url }).run();
    }
  ),
  createPromptedCommand(
    {
      title: '수식',
      description: 'LaTeX 수식 삽입',
      searchTerms: ['math', 'latex', '수식'],
      icon: '∑'
    },
    () => promptForText({
      title: 'LaTeX 수식 입력',
      defaultValue: 'E = mc^2'
    }),
    ({ editor, range }, latex) => {
      editor.chain().focus().deleteRange(range).insertContent({ type: 'math', attrs: { latex } }).run();
    }
  ),
  createPromptedCommand(
    {
      title: 'Mermaid 다이어그램',
      description: '플로우차트와 시퀀스 다이어그램 삽입',
      searchTerms: ['mermaid', 'diagram', 'flowchart', 'sequence', '다이어그램', '순서도'],
      icon: '◇'
    },
    () => promptForText({
      title: 'Mermaid 다이어그램 삽입',
      description: 'Mermaid 문법을 입력하세요. Ctrl/Cmd + Enter로 삽입할 수 있습니다.',
      defaultValue: DEFAULT_MERMAID_SOURCE,
      confirmText: '삽입',
      multiline: true
    }),
    ({ editor, range }, source) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: 'mermaid', attrs: { source } })
        .run();
    }
  ),
  createPromptedCommand(
    {
      title: '링크 카드',
      description: 'URL을 카드 형태로 삽입',
      searchTerms: ['link', 'card', 'preview', '링크', '카드'],
      icon: '🔗'
    },
    () => promptForText({
      title: '링크 URL 입력',
      placeholder: 'https://'
    }),
    async ({ editor, range }, url) => {
      try {
        editor.chain().focus().deleteRange(range).run();
        const response = await fetch(
          `${API_BASE_URL}/preview?url=${encodeURIComponent(url)}`,
          { credentials: 'include' }
        );
        if (!response.ok) throw new Error(`Failed to fetch preview (${response.status})`);

        const data = await response.json();
        editor.chain().focus().setLinkCard(data).run();
      } catch (error) {
        console.error(error);
        showEditorToast('링크 정보를 불러오지 못해 일반 링크로 삽입했습니다.', 'error');
        insertFallbackLink(editor, url);
      }
    }
  ),
  createStaticCommand(
    {
      title: '2단 레이아웃',
      description: '화면을 2개로 분할',
      searchTerms: ['2', 'column', 'layout', '분할'],
      icon: '◫'
    },
    ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(createColumnContent(2, 'paragraph'))
        .run();
    }
  ),
  createStaticCommand(
    {
      title: '3단 레이아웃',
      description: '화면을 3개로 분할',
      searchTerms: ['3', 'column', 'layout', '분할'],
      icon: '▥'
    },
    ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(createColumnContent(3, 'paragraph'))
        .run();
    }
  ),
  createStaticCommand(
    {
      title: '2단 이미지',
      description: '이미지 2개를 나란히 배치',
      searchTerms: ['2', 'photo', 'image', 'picture', '이미지', '사진'],
      icon: '🖼'
    },
    ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(createColumnContent(2, 'image'))
        .run();
    }
  ),
  createStaticCommand(
    {
      title: '3단 이미지',
      description: '이미지 3개를 나란히 배치',
      searchTerms: ['3', 'photo', 'image', 'picture', '이미지', '사진'],
      icon: '🖼'
    },
    ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent(createColumnContent(3, 'image'))
        .run();
    }
  )
];

export const getSuggestionItems = ({ query }: { query: string }) => {
  const items = getSlashCommandItems();
  if (!query) return items;

  const search = query.toLowerCase();
  return items.filter((item) => (
    item.title.toLowerCase().includes(search)
    || item.description?.toLowerCase().includes(search)
    || item.searchTerms?.some(term => term.includes(search))
  ));
};
