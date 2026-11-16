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

  it('has a slot for each required and optional setup step in flow order', () => {
    const order = ['basics', 'invoice-profile', 'service-defaults', 'inventory-template', 'contract-profile']
    const positions = order.map(id => page.indexOf(`<template #step-${id}>`))

    expect(positions.every(position => position > -1)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
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
