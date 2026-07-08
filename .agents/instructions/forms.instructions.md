---
applyTo: "app/components/**/*.vue, app/pages/**/*.vue, app/composables/**/*.ts, app/utils/validators/**"
---

# Forms

Form state and validation belong in composables or local component state — do not use Pinia. Client validates with Zod. Server always re-validates independently.

## ✓ Correct Usage

**Define schema once, use on both client and server:**
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

**Form component — accepts initial, emits submit:**
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

**Number fields declare intent with `numberMode`:**
```vue
<UiInput
  v-model.number="form.monthlyRent"
  label="Giá thuê"
  type="number"
  number-mode="currency"
  min="0"
/>

<UiInput
  v-model.number="form.currentReading"
  label="Chỉ số mới"
  type="number"
  number-mode="meter"
/>
```

Use `currency`, `meter`, `area`, `month`, `year`, `day`, `integer`, `decimal`, or `percent` to describe the domain value. Keep formatted numeric display fields as `type="text"` with `inputmode` when the component formats while typing.

**Date fields use the calendar picker:**
```vue
<UiDatePicker
  v-model="form.paidAt"
  label="Ngày thanh toán"
  date-mode="payment"
  required
/>
```

Use `UiDatePicker` for domain/page date entry instead of `UiInput type="date"`. Keep the model as an ISO `YYYY-MM-DD` string and choose a `date-mode` such as `payment`, `reading`, `period-start`, `period-end`, `past`, `future`, or `operational`.

**Server re-validates independently (do not trust client):**
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

**Display server errors down to form fields:**
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

## ✗ Do Not

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

## Common Zod Patterns in This Project

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
