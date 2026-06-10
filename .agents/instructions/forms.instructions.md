---
applyTo: "app/components/**/*.vue, app/pages/**/*.vue, app/composables/**/*.ts, app/utils/validators/**"
---

# Forms

Form state và validation nằm ở composable hoặc component local — không dùng Pinia. Client validate bằng Zod. Server luôn re-validate độc lập.

## ✓ Cách dùng đúng

**Định nghĩa schema một lần, dùng ở cả client lẫn server:**
```ts
// app/utils/validators/buildings.ts
import { z } from 'zod'

export const buildingSchema = z.object({
  name: z.string().min(1, 'Tên tòa nhà là bắt buộc').max(100),
  address: z.string().min(1, 'Địa chỉ là bắt buộc'),
  totalFloors: z.number().int().min(1).max(99).optional(),
})

export type BuildingInput = z.infer<typeof buildingSchema>
```

**Form component — nhận initial, emit submit:**
```vue
<!-- app/components/buildings/BuildingForm.vue -->
<script setup lang="ts">
import type { BuildingInput } from '~/utils/validators/buildings'

const props = defineProps<{
  initial?: Partial<BuildingInput>
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', value: BuildingInput): void
  (e: 'cancel'): void
}>()

const { form, errors, submit } = useBuildingForm(props.initial)

async function onSubmit() {
  const result = await submit()
  if (result) emit('submit', result)
}
</script>

<template>
  <form @submit.prevent="onSubmit" novalidate>
    <UiInput
      v-model="form.name"
      label="Tên tòa nhà"
      :error="errors.name"
      required
    />
    <UiInput
      v-model="form.address"
      label="Địa chỉ"
      :error="errors.address"
      required
    />
    <div class="flex gap-3 justify-end">
      <UiButton variant="secondary" type="button" @click="emit('cancel')">
        Hủy
      </UiButton>
      <UiButton type="submit" :loading="loading">Lưu</UiButton>
    </div>
  </form>
</template>
```

**Server re-validate độc lập (không trust client):**
```ts
// server/api/buildings/index.post.ts
import { buildingSchema } from '~/utils/validators/buildings'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const body = await readBody(event)
  const result = buildingSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 422,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ',
          details: result.error.flatten(),
        },
      },
    })
  }

  const building = await BuildingService.create(user, result.data)
  return { data: building }
})
```

**Hiện thị lỗi server xuống form:**
```ts
// app/composables/buildings/useBuildingForm.ts
async function submit() {
  try {
    const { data } = await $fetch('/api/buildings', { method: 'POST', body: form })
    return data
  } catch (err: any) {
    const apiError = err.data?.error
    if (apiError?.code === 'VALIDATION_ERROR') {
      const fieldErrors = apiError.details?.fieldErrors ?? {}
      Object.entries(fieldErrors).forEach(([field, messages]) => {
        errors.value[field as keyof BuildingInput] = (messages as string[])[0]
      })
    }
    return null
  }
}
```

## ✗ Cách không được dùng

```ts
// ✗ Đừng lưu form state trong Pinia
const store = useBuildingStore()
store.formData.name = 'ABC' // form state là local, không global

// ✗ Đừng validate thủ công thay vì Zod
if (!form.name || form.name.trim().length === 0) {
  errors.value.name = 'Bắt buộc'
}
// → Dùng z.string().min(1, 'Bắt buộc')

// ✗ Đừng trust client validation, bỏ qua server validation
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  await BuildingService.create(body) // body là unknown — phải parse Zod trước
})

// ✗ Đừng v-model trực tiếp vào prop
const props = defineProps<{ name: string }>()
// <UiInput v-model="props.name" /> ← sẽ có Vue warning, dùng local state + emit

// ✗ Đừng bỏ qua loading state khi đang submit
async function onSubmit() {
  await $fetch('/api/buildings', { method: 'POST', body: form })
  // thiếu: set loading = true/false, disable button để tránh double submit
}

// ✗ Đừng reset error thủ công từng field — reset toàn bộ trước khi submit
errors.value.name = ''
errors.value.address = ''
// → errors.value = {} // clear all trước mỗi lần validate
```

## Zod patterns hay dùng trong project

```ts
// Số tiền VND — phải là số nguyên dương
z.number().int().min(0, 'Không được âm')

// Ngày tháng — ISO string
z.string().date()   // Zod v4: validates YYYY-MM-DD

// Enum từ constants
import { BUILDING_STATUS } from '~/utils/constants/buildings'
z.enum(BUILDING_STATUS)  // ['active', 'inactive']

// Optional field có default
z.number().int().min(1).default(1)
```
