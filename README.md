# Obsidian 한글 퍼지 검색 플러그인

Obsidian에서 한글 파일명을 **초성**, **중성**, **종성** 단위로 검색할 수 있게 해주는 플러그인입니다.

## ✨ 주요 기능

### 🔍 **한글 퍼지 검색**
- **초성 검색**: `ㅎㄱ` → "한글", "항공", "학교" 등
- **부분 음절**: `한ㄱ` → "한국", "한글" 등  
- **혼합 검색**: `ㅎㄱㄹ교` → "한글학교" 등

### 🚀 **Quick Switcher 대체**
- 기본 Quick Switcher (⌘+O)를 한글 검색 지원 버전으로 교체
- 기존 영문 검색도 그대로 지원

### 🔗 **링크 자동완성**
- `[[` 입력 시 한글 파일명 자동완성
- 초성/중성/종성 단위 실시간 검색

## 📦 설치 방법

### 방법 1: BRAT 설치 (추천)

1. [BRAT 플러그인](https://github.com/TfTHacker/obsidian42-brat) 설치 및 활성화
2. BRAT 설정에서 **"Add Beta plugin"** 클릭
3. 다음 GitHub URL 입력:
   ```
   https://github.com/BrianJChoi/obsidian-hangul-search
   ```
4. **"Add Plugin"** 클릭하여 설치
5. 설정 → 커뮤니티 플러그인에서 "Hangul Fuzzy Search" 활성화

### 방법 2: 수동 설치 (개발 버전)

1. 이 저장소를 클론하거나 다운로드
```bash
git clone https://github.com/BrianJChoi/obsidian-hangul-search.git
```

2. 플러그인 빌드
```bash
cd obsidian-hangul-search
npm install
npm run build
```

3. Obsidian 플러그인 폴더에 복사
```
[Vault]/.obsidian/plugins/obsidian-hangul-search/
├── main.js
├── manifest.json
└── (기타 파일들)
```

4. Obsidian에서 플러그인 활성화
   - 설정 → 커뮤니티 플러그인 → "Hangul Fuzzy Search" 활성화

## 🎯 사용법

### Quick Switcher
- **⌘+O** (Mac) 또는 **Ctrl+O** (Windows/Linux) 누르기
- 한글 파일명 입력:
  - `ㅁㅊ` → "미치", "맞춤", "마침" 등
  - `프로젝트` → "프로젝트 관리", "프로젝트 계획" 등

### 링크 자동완성
1. 노트에서 `[[` 입력
2. 한글 파일명 타이핑
3. 자동완성 목록에서 선택

## ⚙️ 설정

설정 → 커뮤니티 플러그인 → Hangul Fuzzy Search 설정

- **퍼지 임계값**: 검색 정확도 조절 (0: 엄격, 1: 느슨)
- **Quick Switcher 대체**: 기본 Quick Switcher 교체 여부

## 🛠 개발 환경 설정

### 필요 조건
- Node.js 16+ 
- npm 또는 yarn

### 개발 시작하기

1. 저장소 클론
```bash
git clone https://github.com/BrianJChoi/obsidian-hangul-search.git
cd obsidian-hangul-search
```

2. 의존성 설치
```bash
npm install
```

3. 개발 모드 실행
```bash
npm run dev
```

4. 빌드
```bash
npm run build
```

### 프로젝트 구조
```
├── src/
│   └── main.ts          # 메인 플러그인 코드
├── manifest.json        # 플러그인 메타데이터
├── package.json         # 프로젝트 설정
├── tsconfig.json        # TypeScript 설정
├── rollup.config.js     # 빌드 설정
└── README.md           # 이 파일
```

## 🔧 기술 스택

- **TypeScript**: 타입 안전성
- **Fuse.js**: 퍼지 검색 엔진  
- **hangul-js**: 한글 자모 분해/조합
- **Rollup**: 번들러

## 📝 라이센스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 🤝 기여하기

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 버그 신고 & 기능 요청

[Issues](https://github.com/BrianJChoi/obsidian-hangul-search/issues) 페이지에서 버그 신고나 기능 요청을 해주세요.

## 📊 버전 히스토리

- **v0.1.0**: 초기 릴리스
  - 한글 퍼지 검색 지원
  - Quick Switcher 대체 기능
  - 링크 자동완성 지원

---

**만든 이**: [Brian Choi](https://github.com/BrianJChoi)  
**문의**: [GitHub Issues](https://github.com/BrianJChoi/obsidian-hangul-search/issues)