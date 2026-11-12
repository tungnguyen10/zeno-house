import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContractDocumentIssueDialog from '~/components/contracts/ContractDocumentIssueDialog.vue'

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('$fetch', fetchMock)

const stubs = {
  UiModal: { props: ['open'], template: '<div v-if="open"><slot /><slot name="footer" /></div>' },
  UiDatePicker: { props: ['modelValue'], template: '<input />' },
  UiAlert: { template: '<div><slot /></div>' },
  UiButton: { template: '<button><slot /></button>' },
}

beforeEach(() => vi.clearAllMocks())

describe('ContractDocumentIssueDialog', () => {
  it('shows missing items and hides the issue button when not ready', async () => {
    fetchMock.mockResolvedValue({ data: { ready: false, missing: [{ code: 'tenant.id_number', label: 'CCCD khách thuê' }] } })
    const w = mount(ContractDocumentIssueDialog, { props: { open: true, contractId: 'c-1' }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="issue-missing"]').exists()).toBe(true)
    expect(w.text()).toContain('CCCD khách thuê')
    expect(w.find('[data-test="issue-confirm"]').exists()).toBe(false)
  })

  it('offers preview + issue when ready', async () => {
    fetchMock.mockResolvedValue({ data: { ready: true, missing: [] } })
    const w = mount(ContractDocumentIssueDialog, { props: { open: true, contractId: 'c-1' }, global: { stubs } })
    await flushPromises()
    expect(w.find('[data-test="issue-preview"]').exists()).toBe(true)
    expect(w.find('[data-test="issue-confirm"]').exists()).toBe(true)
  })
})
