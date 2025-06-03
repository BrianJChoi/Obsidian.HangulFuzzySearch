# Obsidian Plugin Development Template

이 프로젝트는 Obsidian 플러그인 개발을 위한 시작 템플릿입니다. 기본적인 플러그인 구조와 몇 가지 예제 기능을 포함하고 있어, Obsidian 플러그인 개발을 시작하는 데 도움이 됩니다.

## 주요 기능

- 사용자 리스트 관리
- JSON 파일 선택 및 정보 표시
- 커스텀 상태바
- 리본 아이콘
- 컨텍스트 메뉴
- 자동완성 기능

## 프로젝트 설정 및 개발 방법

1. 이 리포지토리를 클론합니다:
   ```bash
   git clone https://github.com/your-username/obsidian-plugin-dev-start-template.git
   ```

2. 프로젝트 폴더로 이동합니다:
   ```bash
   cd obsidian-plugin-dev-start-template
   ```

3. 필요한 의존성을 설치합니다:
   ```bash
   npm install
   ```

4. 개발 모드로 실행합니다:
   ```bash
   npm run dev
   ```

5. Obsidian 볼트의 플러그인 폴더에 이 프로젝트를 심볼릭 링크로 연결합니다:
   ```bash
   mklink /D "C:\Path\To\Your\Vault\.obsidian\plugins\obsidian-plugin-dev-start-template" "C:\Path\To\This\Project"
   ```
   (Windows 사용자의 경우. Mac/Linux 사용자는 `ln -s` 명령어를 사용하세요.)

6. Obsidian에서 플러그인을 활성화하고 개발을 시작하세요!

## 주요 파일 설명

- `main.ts`: 플러그인의 주요 로직이 있는 메인 파일
- `src/settings.ts`: 플러그인 설정 관련 코드
- `src/statusBar.ts`: 상태바 관련 코드
- `src/ribbon.ts`: 리본 아이콘 관련 코드
- `src/contextMenu.ts`: 컨텍스트 메뉴 관련 코드
- `src/autoComplete.ts`: 자동완성 기능 관련 코드
- `src/userSuggest.ts`: 사용자 이름 제안 기능 관련 코드
- `src/renderer.ts`: 커스텀 마크다운 렌더링 관련 코드
- `src/selectionPopup.ts`: 텍스트 선택 시 팝업 표시 관련 코드
- `src/sampleModal.ts`: 모달 창 예시 관련 코드

## 기여 방법

1. 이 리포지토리를 클론합니다:
   ```bash
   git clone https://github.com/your-username/obsidian-plugin-dev-start-template.git
   ```
2. 최신 변경사항을 가져옵니다:
   ```bash
   git pull origin main
   ```
3. 변경사항을 작업하고 추가합니다:
   ```bash
   git add .
   ```
4. 변경사항을 커밋합니다:
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
5. 변경사항을 푸시합니다:
   ```bash
   git push origin main
   ```

주의: 큰 변경사항을 작업할 때는 별도의 브랜치를 사용하는 것이 좋습니다.

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 다음 단계

- 커스텀 뷰 예시 만들기
- 이벤트 리스너 예시 만들기
- 플러그인 설정 탭 항목 추가
- 파일 생성 및 수정 예시 만들기