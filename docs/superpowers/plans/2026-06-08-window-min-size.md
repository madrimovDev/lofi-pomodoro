# Oyna min o'lcham (timer card) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oyna minimal o'lchamini timer card to'liq ko'rinadigan darajaga (440×780) qo'yish.

**Architecture:** Statik min o'lcham IKKI joyda sinxron: `tauri.conf.json` (boshlang'ich) va `window.rs` `normal_min_size` (mini-rejimdan chiqishda tiklanadi).

**Tech Stack:** Tauri v2 config + Rust.

**Spec:** `docs/superpowers/specs/2026-06-08-window-min-size-design.md`

---

## Task 1: minWidth/minHeight (440×780) ikki joyda

**Files:**
- Modify: `src-tauri/tauri.conf.json` (`app.windows[0]` minWidth/minHeight)
- Modify: `src-tauri/src/commands/window.rs` (`normal_min_size` ~24)

- [ ] **Step 1: tauri.conf.json**

`src-tauri/tauri.conf.json` `app.windows[0]`'da:
```json
        "minWidth": 600,
        "minHeight": 400,
```
ni quyidagiga o'zgartir:
```json
        "minWidth": 440,
        "minHeight": 780,
```

- [ ] **Step 2: window.rs normal_min_size**

`src-tauri/src/commands/window.rs`'da (`set_mini_mode` ichida, ~24-qator):
```rust
      inner.normal_min_size = Some((600.0, 400.0));
```
ni quyidagiga o'zgartir:
```rust
      inner.normal_min_size = Some((440.0, 780.0));
```

- [ ] **Step 3: Verifikatsiya**

Run: `python3 -c "import json;json.load(open('src-tauri/tauri.conf.json'))" && echo VALID`
Expected: VALID.
Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings 2>&1 | tail -3 && cargo test --lib 2>&1 | tail -3 && cargo fmt --check; echo "fmt:$?"`
Expected: clippy toza; 18 test PASS; fmt exit 0.
Run: `grep -n "440\|780" src-tauri/tauri.conf.json src-tauri/src/commands/window.rs`
Expected: ikkala joyда 440/780.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/tauri.conf.json src-tauri/src/commands/window.rs
git commit -m "fix(window): min o'lchamni timer card'ga moslash (440×780, conf + normal_min_size)"
```

- [ ] **Step 5: Runtime acceptance (foydalanuvchida)**

`bun run dev` → resize qo'llari bilan oynani min'gacha kichraytirib, timer card to'liq ko'rinishini tasdiqlash. Mini-rejimga kirib-chiqib, normal min tiklanishini tekshirish. Saxiylik ko'p/kam bo'lsa qiymat sozlanadi.

---

## Self-review eslatmalari
- **Spec qamrovi:** ikki joy (conf + window.rs) Task 1'da.
- **Izchillik:** 440/780 ikkala joyда bir xil.
- **Tuzoq:** faqat conf'ni o'zgartirib window.rs'ni unutsa — mini-rejimdan chiqgach eski min (600/400) tiklanadi. Ikkalasi SHART.
