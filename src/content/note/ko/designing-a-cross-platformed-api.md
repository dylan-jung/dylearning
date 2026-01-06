---
title: Designing a Cross-Platformed API
timestamp: 2025-03-11
toc: true
tags:
  - learn/design
  - tech/system
---

모바일이나 데스크탑 네이티브 앱을 개발하다 보면 특정 기능을 구현하기 위해 운영체제(OS)가 직접 제공하는 Native API를 호출해야 하는 경우가 많다. 파일 시스템, 윈도우 제어, 미디어 캡처 등 보안적으로 민감한 기능은 Web API보다 Native API가 훨씬 풍부하고 유연하기 때문이다.

그러나 현실의 크로스플랫폼 개발에서는 운영체제마다 API의 형태와 지원 수준이 달라서, 이를 통일적으로 다루기 어려운 경우가 자주 발생한다. 이번 글에서는 이러한 문제를 해결하기 위해 Tauri v2 기반 데스크탑 앱에서 Native API를 직접 호출하여 스크린 녹화 기능을 구현한 과정을 소개한다.

특히 macOS(Swift)와 Windows(C#)에서 각각 Native API를 이용해 스크린 녹화를 구현하고, 이를 Rust(Tauri Backend)에서 FFI로 호출하는 구조를 실제 예제 코드를 설명해보려고 한다.

# Tauri v2

> Tauri is a framework for building tiny, fast binaries for all major desktop and mobile platforms.

Electron과 달리 Tauri는 시스템 WebView + Rust Backend라는 구조를 갖는다. 이 때문에 번들 크기, 메모리 사용량, 성능에서 매우 유리하며, 특히 네이티브 기능을 다루는 데에도 Rust를 통해 안전한 구조를 제공한다.

간단하게 Tauri v2의 핵심 특징을 정리하면 다음과 같다.

1. 프론트엔드와 백엔드의 프로세스가 분리

- 프론트엔드(WebView): JS/TS 기반
- 백엔드(Tauri Core): Rust 기반
- 두 프로세스는 **IPC(Inter-Process Communication)**로 통신

2. 기능 실행 방식

- 프론트엔드 → 백엔드: invoke()로 Command 호출
- 백엔드 → 프론트엔드: Event 송신
- OS 기능 호출은 백엔드에서 수행

![도표](https://v2.tauri.app/d2/docs/concept/process-model-0.svg)
_출처: 자세한 내용은 [공식홈페이지 - 프로세스 모델](https://v2.tauri.app/concept/process-model/)에서 확인할 수 있다._

# 스크린 녹화를 직접 구현해야 했던 이유

최근 진행한 프로젝트는 화면, 마우스, 키보드, 웹캠, 클릭 이벤트 등을 모두 시간 동기화하여 캡처하고, 후처리 단계에서 이를 하나의 영상으로 렌더링하는 데스크탑 앱이었다. 처음에는 Web API(Screen Capture API)를 이용해 간단하게 구현하려 했지만 다음 두 제약 때문에 불가능했다.

## 제한 1 — 녹화 중인 Window의 좌표 획득 불가

보안상의 이유로 Web API는 윈도우/프로세스의 좌표 정보를 제공하지 않는다.
그러나 우리 요구사항에서는 마우스가 어떤 윈도우 위에 있는지 실시간으로 알 수 있어야 했다.

## 제한 2 — 특정 Window 제거나 필터링 불가

예를 들어, 사용자가 녹화하는 동안 자기 앱(UI)을 녹화 대상에서 제외하고 싶어도 Web API에서는 불가능하다. **반면 Native API**(macOS, ScreenCaptureKit / Windows, Graphics Capture 등)에서는 **가능하다**. 따라서 Web API 대신 macOS·Windows의 네이티브 API를 직접 사용한 스크린 캡처 파이프라인을 구축하기로 했다.

이러한 이유로 우리의 요구사항을 완벽하게 수행할 수 있도록 새롭게 API를 제작하기로 했다.

# Native API를 Rust에서 직접 사용하지 않은 이유

Rust에서 C FFI 모듈을 직접 작성해 호출할 수도 있지만 아래의 문제들이 존재한다.

## **DX(Developer Experience) 문제**

- Native 구조체 타입을 Rust에서 그대로 다루기 불편
- Swift/Objective-C 인터페이스를 Rust에서 자동 참조하기 어려움
- IDE 인텔리센스 부족

## **외부 크레이트 의존성 문제**

- 네이티브 기능을 감싸는 Rust crate는 존재하더라도 유지보수 중단 또는 API mismatch 문제가 생길 수 있다.

실제로 직접 이러한 방법으로 네이티브 API를 개발해보았지만 공식 문서를 Rust로 변환하는 과정, 그리고 IDE의 불친절함 때문에 높은 러닝 허들이 존재한다.

따라서 가장 안전하고 유지보수가 쉬운 방법은
**각 OS의 공식 API를 해당 언어(Swift/C#/C++)로 직접 구현하고, 이를 라이브러리 형태로 컴파일하여 Rust에서 FFI로 호출하는 방식**
이라고 생각했다.

# Rust → Swift 함수 호출 예제 (FFI)

[여기](/note/understanding-binary-compatibility)의 내용을 참고하며 읽으면 조금 더 이해하기 쉬울수 있다.
다음과 같이 Swift에서 C와 호환되는 정적 라이브러리를 만들고, Rust에서 이를 링크하여 함수 호출을 수행한다.

① Swift 라이브러리 제작 (libscreencapture.a)

```swift
@_cdecl("monitor_start_recording")
public func monitor_start_recording(
    outputPathPtr: UnsafePointer<CChar>,
    monitorId: UInt32,
    excludeWindowIds: UnsafePointer<UInt32>,
    excludeWindowIdsCount: UInt32
) {
    // ...
}
```

C ABI에 맞게 작성하는 것이 핵심이다. Swift → C → Rust로 이어지는 ABI 안정성을 위해서다.

② Rust에서 라이브러리 링크

```rust
println!(
    "cargo:rustc-link-search=native={}/.build/{}/{}",
    screencapture_path_str,
    swift_target_info.target.unversioned_triple,
    profile
);
```

빌드 시 Swift 라이브러리의 경로를 등록한다.

③ Rust에서 FFI 함수 정의

```rust
#[link(name = "screencapture")]
extern "C" { // in unsafe boundary
    fn monitor_start_recording(
        outputPathPtr: *const c_char,
        monitorId: u32,
        excludeWindowIds: *const u32,
        excludeWindowIdsCount: u32,
    );
}
```

이제 Rust에서 Swift의 기능을 직접 호출할 수 있다.
윈도우 또한 비슷한 방법으로 C#으로 작성된 WinRT의 기능을 호출 할 수 있다.

# 아키텍처의 핵심: 플랫폼 차이를 외부에 드러내지 않기

이 구조의 핵심은 다음 한 문장으로 요약된다.

> 플랫폼별 OS API의 차이를 캡슐화하여, 외부에는 일관된 추상화만 제공한다.

이를 위해 Rust에서 다음과 같은 trait을 정의한다

```
trait ScreenRecorder {
    fn ready(&self) -> Result<()>;
    fn start(&self) -> Result<()>;
    fn stop(&self) -> Result<()>;
}
```

macOS 구현체, Windows 구현체는 각각

- FFI 함수 호출
- 네이티브 스레드·메모리 관리
- 에러 변환
- 리소스 수명 관리
  같은 플랫폼 특화 로직을 내부에서 처리한다.

프론트엔드는 이 구현체가 macOS인지 Windows인지 알 필요 없다.
런타임에는 **LSP**(Liskov Substitution Principle)에 따라 적절한 구현체가 선택된다.

# 다음 글에서 다룰 것

크로스플랫폼 애플리케이션 개발에서는 플랫폼별 API 차이가 드러나는 순간 개발 복잡도가 급격히 증가한다. 이번 사례에서는 Tauri v2의 Rust 백엔드를 중심으로 Swift·C# 네이티브 코드를 FFI로 연결하는 구조를 통해 이 문제를 우아하게 해결할 수 있었다.

요약하자면

- Web API는 고급 캡처 기능에 제약이 많다
- 플랫폼 네이티브 API를 직접 호출하는 것이 기능/성능 측면에서 가장 우수
- Swift/C#/Rust 각각의 언어 특성을 살려 안정적인 FFI 구조를 구성
- Rust trait로 OS 의존성을 캡슐화하여 일관된 인터페이스 확보

이 구조는 스크린 녹화뿐 아니라 윈도우 제어·시스템 정보·마이크/카메라 처리·파일 핸들링 등 다양한 네이티브 기능을 크로스플랫폼 환경에서 안전하게 사용하기 위한 아키텍처 패턴으로 그대로 확장할 수 있다.

기회가 된다면 다음 글에서는 해당 아키텍처의 빌드 파이프라인, Swift/C# 라이브러리 설정, ABI 분석 등도 추가 글로 정리해보겠다.
