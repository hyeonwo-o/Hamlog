export function seedPosts() {
    return [
        {
            id: 'post-1',
            slug: 'designing-resilient-ui-state',
            title: '리액트에서 견고한 UI 상태 설계하기',
            summary: '로딩, 에러, 빈 상태까지 포함한 실전 체크리스트.',
            category: 'UI 설계',
            publishedAt: '2024-11-12',
            tags: ['리액트', '상태', 'UX'],
            series: 'UI 회복력',
            featured: true,
            cover:
                'https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=1400&q=80',
            sections: [
                {
                    type: 'paragraph',
                    content:
                        '견고한 UI 상태는 경계를 명확히 하는 것에서 시작됩니다. 로딩, 빈 상태, 에러를 예외가 아니라 기본 UI로 다루세요.'
                },
                {
                    type: 'heading',
                    content: '성공 경로와 실패 경로를 함께 설계하기'
                },
                {
                    type: 'paragraph',
                    content:
                        '각 화면에는 명확한 기본 상태와 최소 한 가지 대안이 필요합니다. UI가 설명하지 못하면 사용자는 더 혼란스럽습니다.'
                },
                {
                    type: 'list',
                    content: [
                        '네트워크 상태와 화면 상태를 분리한다.',
                        '필터를 유지해 새로고침 시 UI가 초기화되지 않게 한다.',
                        '스켈레톤은 체감 대기 시간을 줄일 때만 사용한다.'
                    ]
                },
                {
                    type: 'code',
                    language: 'ts',
                    content:
                        "type Loadable<T> =\\n  | { status: 'idle' }\\n  | { status: 'loading' }\\n  | { status: 'ready'; data: T }\\n  | { status: 'error'; message: string };"
                },
                {
                    type: 'callout',
                    content: 'UI 상태 모델을 한 문장으로 설명할 수 없다면 이미 과합니다.'
                }
            ]
        },
        {
            id: 'post-2',
            slug: 'vite-express-monorepo-that-ships-fast',
            title: '빠르게 배송하는 Vite + Express 모노레포',
            summary: '로컬 개발 속도를 유지하면서 풀스택 프로토타입을 만드는 방법.',
            category: '개발 환경',
            publishedAt: '2024-10-28',
            tags: ['툴링', 'Vite', 'Node'],
            series: '배송 플레이북',
            featured: true,
            cover:
                'https://images.unsplash.com/photo-1484417894907-623942c8ee29?auto=format&fit=crop&w=1400&q=80',
            sections: [
                {
                    type: 'paragraph',
                    content:
                        '모노레포가 무거울 필요는 없습니다. 로컬 피드백 루프를 2초 이내로 유지하고 컨텍스트 스위칭을 줄이는 것이 목표입니다.'
                },
                {
                    type: 'heading',
                    content: 'API는 가까이, 결합은 느슨하게'
                },
                {
                    type: 'paragraph',
                    content:
                        'API 서버는 같은 레포에 두되 런타임은 분리합니다. Vite는 클라이언트를, Express는 JSON 저장소 기반의 영속화를 담당합니다.'
                },
                {
                    type: 'code',
                    language: 'bash',
                    content: 'npm run dev\\n# and in another tab\\nnpm run server'
                },
                {
                    type: 'list',
                    content: [
                        'API 베이스 URL은 하나로 통일한다.',
                        '가능한 한 서버는 상태를 최소화한다.',
                        '기본 데이터셋을 문서화해 바로 시작할 수 있게 한다.'
                    ]
                },
                {
                    type: 'quote',
                    content: '온보딩이 10분을 넘는다면 레포가 너무 무겁다.'
                }
            ]
        },
        {
            id: 'post-3',
            slug: 'latency-budgets-for-client-apps',
            title: '클라이언트 앱을 위한 지연 예산',
            summary: '빠름의 기준을 정하고 UI를 그 예산에 맞추는 법.',
            category: '성능',
            publishedAt: '2024-09-18',
            tags: ['성능', '제품', '아키텍처'],
            cover:
                'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80',
            sections: [
                {
                    type: 'paragraph',
                    content:
                        '지연 예산은 사용자에게 하는 약속입니다. 예산을 정하면 로딩과 상호작용 상태를 더 솔직하게 설계할 수 있습니다.'
                },
                {
                    type: 'heading',
                    content: '체감 타임라인부터 시작하기'
                },
                {
                    type: 'list',
                    content: [
                        '100ms 이내 피드백은 즉각적으로 느껴집니다.',
                        '400ms 이후에는 진행 표시가 불안을 줄입니다.',
                        '3초 이후에는 복구 옵션이 필요합니다.'
                    ]
                },
                {
                    type: 'callout',
                    content: '90퍼센타일을 측정하세요. 대부분이 실제로 겪는 경험입니다.'
                }
            ]
        },
        {
            id: 'post-4',
            slug: 'design-tokens-for-typography-and-spacing',
            title: '타이포/간격 디자인 토큰 만들기',
            summary: '토큰 시스템은 리듬을 유지하고 시각적 부채를 줄입니다.',
            category: '디자인 시스템',
            publishedAt: '2024-08-29',
            tags: ['디자인', 'CSS', '시스템'],
            cover:
                'https://images.unsplash.com/photo-1504805572947-34fad45aed93?auto=format&fit=crop&w=1400&q=80',
            sections: [
                {
                    type: 'paragraph',
                    content:
                        '토큰은 의사결정을 위한 가드레일입니다. 타이포와 간격에서 가장 먼저 효과가 나타납니다.'
                },
                {
                    type: 'heading',
                    content: '리듬 스케일 만들기'
                },
                {
                    type: 'list',
                    content: [
                        '간격은 4px 기반 그리드를 사용한다.',
                        '폰트 크기와 일정한 행간을 함께 설계한다.',
                        '가독성을 먼저, 밀도는 그다음에 둔다.'
                    ]
                },
                {
                    type: 'code',
                    language: 'css',
                    content: ':root {\\n  --space-2: 8px;\\n  --space-3: 12px;\\n  --space-4: 16px;\\n  --space-6: 24px;\\n}'
                },
                {
                    type: 'quote',
                    content: '일관성은 창의성을 죽이지 않습니다. 오히려 확장 가능하게 만듭니다.'
                }
            ]
        },
        {
            id: 'post-5',
            slug: 'practical-client-side-logging',
            title: '실전 클라이언트 로깅',
            summary: '콘솔을 어지럽히지 않으면서 디버깅에 도움이 되는 로깅.',
            category: '관측성',
            publishedAt: '2024-07-30',
            tags: ['관측성', '디버깅', '타입스크립트'],
            cover:
                'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1400&q=80',
            sections: [
                {
                    type: 'paragraph',
                    content:
                        '클라이언트 로그는 의도적이어야 합니다. 모든 클릭을 기록하지 말고 필요한 맥락만 담으세요.'
                },
                {
                    type: 'heading',
                    content: '최소한의 유용한 정보 정의하기'
                },
                {
                    type: 'list',
                    content: [
                        '사용자 행동 + 타임스탬프',
                        '화면 또는 컴포넌트 이름',
                        '디버깅에 필요한 선택적 메타데이터'
                    ]
                },
                {
                    type: 'code',
                    language: 'ts',
                    content:
                        "logger.info('User Action: Filter Changed', {\\n  tag: currentTag,\\n  query: searchQuery\\n});"
                },
                {
                    type: 'callout',
                    content: '로그는 개발자만의 출력이 아니라 제품 신호로 다뤄야 합니다.'
                }
            ]
        },
        {
            id: 'post-6',
            slug: 'infinite-scroll-vs-pagination',
            title: '무한 스크롤 vs 페이지네이션',
            summary: '사용자 의도에 따라 피드 경험을 선택하는 방법.',
            category: '제품 경험',
            publishedAt: '2024-06-18',
            tags: ['제품', 'UX', '프론트엔드'],
            cover:
                'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=80',
            sections: [
                {
                    type: 'paragraph',
                    content:
                        '무한 스크롤은 탐색에, 페이지네이션은 통제에 강합니다. 편의가 아니라 사용자 의도로 결정하세요.'
                },
                {
                    type: 'heading',
                    content: '사용자 목적에 맞춰 결정하기'
                },
                {
                    type: 'list',
                    content: [
                        '탐색과 영감을 위한 브라우징에는 무한 스크롤을 사용한다.',
                        '위치 인지가 필요할 때는 페이지네이션을 사용한다.',
                        '검색이나 필터를 제공해 끝없는 스크롤을 줄인다.'
                    ]
                },
                {
                    type: 'quote',
                    content: '콘텐츠가 가치 있을수록 멈출 수 있는 장치가 필요합니다.'
                }
            ]
        }
    ];
}
