---
applyTo: "app/types/database.types.ts, server/**/*.ts, app/utils/mappers/**"
---

# Database Schema

`app/types/database.types.ts` is an **auto-generated** file from Supabase schema. Do not edit by hand.

## Regenerate Types

```bash
npx supabase gen types typescript --project-id alndujothmxhilmvykqs \
  > app/types/database.types.ts
```

Run again whenever the Supabase schema changes.

## ✓ Correct Usage

**Use `Tables<>`, `TablesInsert<>`, `TablesUpdate<>` for DB types:**
```ts
import type { Tables, TablesInsert, TablesUpdate } from '~/types/database.types'

type BuildingRow    = Tables<'buildings'>       // SELECT shape
type BuildingInsert = TablesInsert<'buildings'> // INSERT shape
type BuildingUpdate = TablesUpdate<'buildings'> // UPDATE shape (tất cả optional)
```

**Map DB row → app DTO in `app/utils/mappers/`:**
```ts
// app/utils/mappers/buildings.ts
import type { Tables } from '~/types/database.types'
import type { Building } from '~/types/buildings'

export function mapBuilding(row: Tables<'buildings'>): Building {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? '',
    status: row.status as BuildingStatus,
    totalRooms: row.total_rooms ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

**App DTO fully decoupled from DB type:**
```ts
// app/types/buildings.ts — app shape, không phụ thuộc DB column names
export type BuildingStatus = 'active' | 'inactive'

export interface Building {
  id: string
  name: string
  address: string
  status: BuildingStatus
  totalRooms: number
  createdAt: string
  updatedAt: string
}

export interface BuildingInput {
  name: string
  address: string
  totalFloors?: number
}
```

**Use mapper in repository:**
```ts
// server/repositories/buildings.ts
import { mapBuilding } from '~/utils/mappers/buildings'

export const BuildingRepository = {
  async findAll(event: H3Event): Promise<Building[]> {
    const client = await serverSupabaseClient(event)
    const { data, error } = await client
      .from('buildings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throwDbError(error, 'buildings.findAll')
    return data.map(mapBuilding)  // ← luôn map trước khi return
  },
}
```

## ✗ Do Not

```ts
// ✗ Không sửa tay database.types.ts — sẽ bị overwrite khi gen lại
export type Database = {
  public: {
    Tables: {
      buildings: { Row: { id: string; my_custom_field: string } } // ← đừng thêm vào đây
    }
  }
}

// ✗ Không trả raw DB row trực tiếp ra API response
return row  // thiếu mapper, expose DB shape ra ngoài

// ✗ Không import database.types.ts trong Vue component
// app/components/buildings/BuildingCard.vue
import type { Tables } from '~/types/database.types'  // ← component chỉ dùng app DTO
// Dùng: import type { Building } from '~/types/buildings'

// ✗ Không dùng snake_case field của DB trực tiếp trong UI
<p>{{ building.total_rooms }}</p>  // ← đã map sang totalRooms trong DTO

// ✗ Không bỏ qua error từ Supabase query
const { data } = await client.from('buildings').select('*')
// → Phải check error: const { data, error } = ...
```

## Enums from DB

```ts
// Lấy enum từ DB types thay vì hardcode string
import type { Enums } from '~/types/database.types'

type ContractStatus = Enums<'contract_status'>  // auto-typed từ DB enum
```
