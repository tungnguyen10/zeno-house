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

  it('asks for confirmation before marking a document as signed', async () => {
    const issued = { id: 'd-1', type: 'contract', amendmentId: null, versionNo: 1, status: 'issued', templateVersion: 1, signedDate: '2026-11-12', issuedAt: '2026-11-12T00:00:00Z' }
    fetchMock.mockImplementation(async (url: string, opts?: { method?: string }) => (opts?.method === 'POST' ? { data: { ...issued, status: 'signed' } } : { data: [issued] }))
    const w = mount(ContractDocumentsSection, { props: { contractId: 'c-1' }, global: { stubs } })
    await flushPromises()
    await w.find('[data-test="document-sign"]').trigger('click')
    expect(fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST')).toHaveLength(0)

    await w.find('[data-test="sign-confirm"]').trigger('click')
    await flushPromises()
    const posts = fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(posts[0]![0]).toBe('/api/contract-documents/d-1/sign')
  })

  it('warns when an unsigned contract document was issued before the latest renewal', async () => {
    const issued = { id: 'd-1', type: 'contract', amendmentId: null, versionNo: 2, status: 'issued', templateVersion: 1, signedDate: '2026-11-12', issuedAt: '2026-11-12T00:00:00Z' }
    fetchMock.mockResolvedValue({ data: [issued] })
    const w = mount(ContractDocumentsSection, { props: { contractId: 'c-1', lastRenewalAt: '2026-11-13T00:00:00Z' }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="documents-stale-renewal"]').exists()).toBe(true)
    expect(w.find('[data-test="documents-stale-renewal"]').text()).toContain('bản 2')
  })

  it.each([
    ['issued after the renewal', { status: 'issued', issuedAt: '2026-11-14T00:00:00Z' }, '2026-11-13T00:00:00Z'],
    ['signed before the renewal', { status: 'signed', issuedAt: '2026-11-12T00:00:00Z' }, '2026-11-13T00:00:00Z'],
    ['no renewal yet', { status: 'issued', issuedAt: '2026-11-12T00:00:00Z' }, null],
  ])('does not warn when %s', async (_label, doc, lastRenewalAt) => {
    fetchMock.mockResolvedValue({ data: [{ id: 'd-1', type: 'contract', amendmentId: null, versionNo: 1, templateVersion: 1, signedDate: '2026-11-12', ...doc }] })
    const w = mount(ContractDocumentsSection, { props: { contractId: 'c-1', lastRenewalAt }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="documents-stale-renewal"]').exists()).toBe(false)
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
