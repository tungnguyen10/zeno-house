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

  it('replaces an issued document atomically: one issue call carrying replaces_document_id and the reason', async () => {
    const issued = { id: 'd-1', type: 'contract', amendmentId: null, versionNo: 1, status: 'issued', templateVersion: 1, signedDate: '2026-11-12', issuedAt: '2026-11-12T00:00:00Z' }
    fetchMock.mockImplementation(async (url: string, opts?: { method?: string }) => (opts?.method === 'POST' ? { data: { ...issued, id: 'd-2', versionNo: 2 } } : { data: [issued] }))
    const w = mount(ContractDocumentsSection, { props: { contractId: 'c-1' }, global: { stubs } })
    await flushPromises()
    await w.find('[data-test="document-void"]').trigger('click')
    await w.find('textarea').setValue('Sai thông tin bên thuê cần phát hành lại')
    await w.find('[data-test="void-confirm"]').trigger('click')
    await flushPromises()

    const posts = fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0]![0]).toBe('/api/contracts/c-1/documents')
    expect(posts[0]![1].body).toMatchObject({
      type: 'contract', signed_date: '2026-11-12', replaces_document_id: 'd-1', void_reason: 'Sai thông tin bên thuê cần phát hành lại',
    })
  })

  it('only voids a failed document (nothing to replace it with yet)', async () => {
    const failed = { id: 'd-9', type: 'contract', amendmentId: null, versionNo: 1, status: 'failed', templateVersion: 1, signedDate: '2026-11-12', issuedAt: null }
    fetchMock.mockImplementation(async (url: string, opts?: { method?: string }) => (opts?.method === 'POST' ? { data: { ...failed, status: 'voided' } } : { data: [failed] }))
    const w = mount(ContractDocumentsSection, { props: { contractId: 'c-1' }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="document-void"]').text()).toBe('Hủy bản lỗi')
    await w.find('[data-test="document-void"]').trigger('click')
    await w.find('textarea').setValue('Bản lỗi, hủy để phát hành lại')
    await w.find('[data-test="void-confirm"]').trigger('click')
    await flushPromises()

    const posts = fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0]![0]).toBe('/api/contract-documents/d-9/void')
  })
})
