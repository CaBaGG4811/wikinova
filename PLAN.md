# План структуры файлов WikiNova

```
wikinova/
  app/
    layout.tsx, globals.css            # ядро (готово)
    (public)/
      layout.tsx                       # шапка/подвал/док ассистента (готово)
      page.tsx                         # главная
      articles/page.tsx                # каталог
      article/[slug]/page.tsx          # статья
      category/[slug]/page.tsx
      tag/[slug]/page.tsx
      search/page.tsx
      request/page.tsx
      about|contact|rules/page.tsx
    admin/
      layout.tsx, page.tsx, login/page.tsx
      articles/(list|new|[id]/edit)
      media/, requests/, users/, categories/, tags/, settings/
      ai/(settings|prompts|usage|logs)/
    api/
      articles/**, categories, tags, search, requests, upload, auth  # A
      admin/** (кроме admin/ai)                                          # B
      ai/**, admin/ai/**                                                 # C
  components/{ui,article,admin,ai}
  lib/{db,auth,utils,crypto,design-tokens,ai/**}
  prisma/{schema.prisma,seed.ts}
  DESIGN.md, ANTI-SLOP-AUDIT.md
```

# Схема Prisma (итог)

User, Article, Category, Tag, ArticleTag, Media, ArticleRequest, ArticleVersion,
ArticleLike, Bookmark, ActivityLog, AISettings, AIPrompt, AIUsage, AISummaryCache,
ArticleTranslation. SQLite через `prisma/dev.db`. Роли: USER/EDITOR/ADMIN.
API-ключ AI хранится AES-256-GCM (`lib/crypto.ts`).
