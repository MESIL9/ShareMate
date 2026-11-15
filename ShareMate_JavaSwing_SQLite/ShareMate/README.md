# 쉐어메이트 (Java Swing + SQLite)

## 실행
- JDK 17 이상, Maven 설치
- IntelliJ IDEA에서 `pom.xml`을 프로젝트로 열기
- Maven 의존성 다운로드 후 `src/main/java/kr/ac/sharemate/Main.java` 실행
- 터미널: `mvn clean compile exec:java`


## 저장
실행 위치에 `sharemate.db`가 자동 생성됩니다. 상품/찜/채팅 메시지는 SQLite에 저장되며 앱을 다시 실행해도 유지됩니다.

## 구현 범위
- 대여/물물교환 상품 등록 및 이미지 파일 경로 저장
- 상품명/설명/해시태그/희망 물품 검색, 카테고리 및 거래 유형 필터
- 찜 추가/취소 및 마이페이지 목록
- 상품별 채팅방, 메시지 저장, 데모 자동응답
- 화면별 클래스 및 공통 UI 테마 분리

## 참고
현재 버전은 단일 PC에서 동작하는 데모입니다. 로그인, 여러 기기 간 동기화, 실제 사용자 간 실시간 채팅을 위해서는 별도 서버/API가 필요합니다.
