## Context

Dự án hiện có `CLAUDE.md` với high-level architecture decisions nhưng thiếu actionable coding rules. Claude Code khi generate code thường phải đoán conventions (naming, patterns, anti-patterns). Team members mới cũng không có reference nhanh.

Approach tham khảo từ GitHub Copilot instructions format (thin index + sub-files), nhưng adapt cho Claude Code's `@file` import mechanism — Claude Code thực sự **inject nội dung vào context** thay vì chỉ link.

Project đang dùng Nuxt 4 (có `app/` directory structure), nhưng CLAUDE.md đang ghi sai là "Nuxt 3".

## Goals / Non-Goals

**Goals:**
- 9 instruction files với rules cụ thể, có examples thực tế từ codebase
- CLAUDE.md refactored thành thin index với `@imports` để Claude Code auto-load
- Fix Nuxt version discrepancy (3 → 4)
- Mỗi file tự-contained: AI có thể đọc một file và hiểu convention mà không cần đọc toàn bộ

**Non-Goals:**
- Không phải full documentation (README-style)
- Không cover deployment/DevOps — chỉ coding conventions
- Không replace openspec specs (specs = requirements, instructions = how to code)
- `edge-cases.md` và `implementation-phases.md` — defer, chưa đủ business logic để viết

## Decisions

**D1: instructions/ tại root, không phải .claude/**
- Visible trên GitHub → team members thấy và enforce trong PR
- Claude Code load via CLAUDE.md `@imports` — location không ảnh hưởng đến AI
- Alternative (`.claude/instructions/`) bị loại vì team members khó tìm

**D2: CLAUDE.md trở thành thin index**
- Chỉ giữ: stack overview, @imports, và 2-3 critical notes
- Content chi tiết chuyển vào instruction files tương ứng
- Lý do: tránh duplication, CLAUDE.md hiện quá dài gây context bloat

**D3: Mỗi file instruction phải có "Anti-patterns" section**
- AI thường generate code theo pattern phổ biến nhất, không phải pattern của project
- "Don't do X" quan trọng hơn "Do Y" vì nó ngăn sai từ đầu
- Example: "Đừng gọi Supabase trực tiếp từ component — luôn qua server/api/"

**D4: Viết 7 files trước, defer 2 files**
- `edge-cases.md` — defer đến khi có business logic thực tế (invoices, contracts)
- `implementation-phases.md` — đây là openspec proposal territory, không phải instruction

**D5: Ngôn ngữ của instruction files là English**
- Code comments, variable names = English (như CLAUDE.md quy định)
- Nhưng mỗi rule có thể có 1-2 dòng giải thích bằng tiếng Việt nếu cần context
- Tránh barrier cho AI khi đọc technical content

## Risks / Trade-offs

- **Drift risk** — Instruction files có thể lỗi thời khi code thay đổi → Mitigation: CLAUDE.md note rõ "update instruction file trong cùng PR khi convention thay đổi"
- **Context size** — Load 7-9 files vào context có thể lớn → Mitigation: Mỗi file giữ dưới ~100 lines, focus vào rules không phải prose
- **Thin CLAUDE.md** — Developer mới không thấy context ngay → Mitigation: Giữ lại stack overview và role matrix trong CLAUDE.md
