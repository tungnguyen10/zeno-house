import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContractDocumentsSection from '~/components/contracts/ContractDocumentsSection.vue'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('useAuthStore', () => ({ can: () => true }))

const stubs = {
  UiSurfacePanel: { template: '<div><slot /></div>' },
  UiAlert: { template: '<div><slot /></div>' },
  UiButton: { template: '<button><slot /></button>' },
  UiBadge: { template: '<span><slot /></span>' },
  UiModal: { props: ['open'], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
  UiTextarea: { props: ['modelValue'], emits: ['update:modelValue'], template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
  ContractDocumentIssueDialog: { template: '<div />' },
}

beforeEach(() => vi.clearAllMocks())

describe('ContractDocumentsSection', () => {
  it('renders the version list', async () => {
    fetchMock.mockResolvedValue({ data: [
      { id: 'd-1', type: 'contract', versionNo: 1, status: 'issued', templateVersion: 1, issuedAt: '2026-11-12T00:00:00Z' },
    ] })
    const w = mount(ContractDocumentsSection, { props: { contractId: 'c-1' }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="document-row"]').exists()).toBe(true)
    expect(w.text()).toContain('Hợp đồng · bản 1')
    expect(w.text()).toContain('Đã phát hành')
  })

  it('requires a reason (>=10 chars) before confirming a void', async () => {
    fetchMock.mockResolvedValue({ data: [
      { id: 'd-1', type: 'contract', versionNo: 1, status: 'issued', templateVersion: 1, issuedAt: '2026-11-12T00:00:00Z' },
    ] })
    const w = mount(ContractDocumentsSection, { props: { contractId: 'c-1' }, global: { stubs } })
    await flushPromises()
    await w.find('[data-test="document-void"]').trigger('click')
    expect(w.find('[data-test="void-confirm"]').attributes('disabled')).toBeDefined()
    await w.find('textarea').setValue('Sai thông tin bên thuê cần phát hành lại')
    expect(w.find('[data-test="void-confirm"]').attributes('disabled')).toBeUndefined()
  })
})
