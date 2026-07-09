# Tauri Build Attempt

Date: 2026-07-09

## Completed

- Installed Rustup via winget.
- Confirmed Rust toolchain:
  - rustup 1.29.0
  - rustc 1.96.1
  - cargo 1.96.1
  - stable-x86_64-pc-windows-msvc
- Ran `pnpm tauri info` after Rust install.
- Ran `pnpm tauri build`.

## Result

`pnpm tauri build` successfully completed the frontend build and downloaded Rust crates, then stopped at Rust compilation because the MSVC linker was unavailable.

Representative error:

```text
error: linker `link.exe` not found
note: the msvc targets depend on the msvc linker but `link.exe` was not found
note: please ensure that Visual Studio 2017 or later, or Build Tools for Visual Studio were installed with the Visual C++ option
```

## Remaining Blocker

Visual Studio Build Tools with the Visual C++ workload is not installed.

Attempted commands:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --source winget --accept-package-agreements --accept-source-agreements --silent --override "--wait --quiet --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --source winget --accept-package-agreements --accept-source-agreements --interactive --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Both attempts exited with `1602`. The Visual Studio installer log says:

```text
User may have declined UAC prompt
Error 0x80070642: Failed to start the process
```

A direct administrator launch of `vs_BuildTools.exe` also returned:

```text
The operation was canceled by the user.
```

## Next Action

Approve the UAC prompt for Visual Studio Build Tools installation, or install manually with:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --source winget --accept-package-agreements --accept-source-agreements --interactive --override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

After installation:

```powershell
cd D:\SougouStartFolder\Fukidashi_Studio\md
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
pnpm tauri info
pnpm tauri build
```
