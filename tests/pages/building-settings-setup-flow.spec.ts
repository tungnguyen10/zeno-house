import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(process.cwd(), 'app/pages/dashboard/buildings/[id]/settings.vue'), 'utf8')

describe('building settings setup flow page', () => {
  it('renders the readiness card and the step list', () => {
    expect(page).toContain('<SettingsReadinessCard')
    expect(page).toContain('<SettingsStepList :steps="setupFlow.steps"')
    expect(page).toContain('deriveSetupSteps(')
  })

  it('has a slot for each step in the new order', () => {
    const order = ['lessor-profile', 'contract-terms', 'basics', 'invoice-profile', 'service-defaults', 'inventory-template']
    const positions = order.map(id => page.indexOf(`<template #step-${id}>`))

    expect(positions.every(position => position > -1)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(page).not.toContain('<ContractStep')
  })

  it('wires setup mode: relabelled saves, skip for optional steps, completion CTA with building_id', () => {
    expect(page).toContain('useBuildingSetupMode(')
    expect(page).toContain(':submit-label="setupMode.submitLabel.value"')
    expect(page).toContain('setupMode.skip(')
    expect(page).toContain('/dashboard/contracts/create?building_id=')
    expect(page).toContain('Thiết lập tòa nhà')
  })

  it('aliases the old contract-profile hash', () => {
    expect(page).toContain('resolveStepHash(')
  })

  it('does not auto-advance after the inventory template while rooms still lack inventory', () => {
    expect(page).toContain('roomIdsWithoutInventory')
    expect(page).toContain('@saved="handleInventorySaved"')
    expect(page).toContain("setupMode.afterSave('inventory-template')")
  })

  it('passes the lessor phone into the step derivation', () => {
    expect(page).toContain('lessorPhone')
  })

  it('keeps advanced groups out of the setup progress', () => {
    const advanced = readFileSync(resolve(process.cwd(), 'app/components/buildings/settings/AdvancedSection.vue'), 'utf8')

    expect(page).toContain('<AdvancedSection')
    for (const id of ['identity-access', 'finance-rules', 'service-overrides']) {
      expect(advanced).toContain(`#step-${id}`)
    }
    expect(advanced).toContain(':numbered="false"')
  })

  it('folds the old edit page into the basics step', () => {
    expect(page).toContain('<BasicsStep')
  })

  it('guards unsaved basics edits on step switch and route leave', () => {
    expect(page).toContain('usePortalUnsavedChanges(basicsDirty)')
    expect(page).toContain('onBeforeRouteLeave(guardRouteLeave)')
    expect(page).toContain('title="Bỏ thay đổi chưa lưu?"')
  })

  it('drops the old side navigation and metric tiles', () => {
    expect(page).not.toContain('Điều hướng cài đặt')
    expect(page).not.toContain('<UiMetricGrid')
  })

  it('still gates sections by permission', () => {
    expect(page).toContain(`canViewContractProfile: authStore.can('building-contract-profile.read')`)
    expect(page).toContain(`canViewInventory: authStore.can('rooms.read')`)
  })
})
