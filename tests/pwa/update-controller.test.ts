import { describe, expect, it, vi } from 'vitest'
import { createPwaUpdateController, hasPendingPwaWork, observePwaControllerChanges } from '~/utils/pwa/update-controller'

describe('PWA updates preserve the active tab', () => {
  it('blocks a portal document upload outside a form without blocking on its own button', () => {
    const root = document.createElement('div')
    root.innerHTML = '<section class="portal-shell"><button aria-busy="true">Upload</button></section><aside class="portal-shell" data-pwa-update-host><button aria-busy="true">Update</button></aside>'
    expect(hasPendingPwaWork(root)).toBe(true)
    root.querySelector('section button')!.setAttribute('aria-busy', 'false')
    expect(hasPendingPwaWork(root)).toBe(false)
  })

  it('does not reload when a different tab activates the new worker', () => {
    const reload = vi.fn()
    const controller = createPwaUpdateController({ isBlocked: () => false, activate: vi.fn(), reload })
    controller.onActivated()
    expect(reload).not.toHaveBeenCalled()
  })

  it('rejects an update while a form is dirty or the connection is unavailable', async () => {
    const activate = vi.fn()
    const reload = vi.fn()
    const controller = createPwaUpdateController({ isBlocked: () => true, activate, reload })
    expect(await controller.apply()).toBe(false)
    expect(activate).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads only after this clean tab requests activation', async () => {
    const activate = vi.fn(async () => {})
    const reload = vi.fn()
    const controller = createPwaUpdateController({ isBlocked: () => false, activate, reload })
    await controller.apply()
    expect(activate).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
    controller.onActivated()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('rechecks unsaved input that appears while activation is in flight', async () => {
    let blocked = false
    const reload = vi.fn()
    const controller = createPwaUpdateController({ isBlocked: () => blocked, activate: vi.fn(async () => {}), reload })
    await controller.apply()
    blocked = true
    controller.onActivated()
    expect(reload).not.toHaveBeenCalled()
    blocked = false
    await controller.apply()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('activates the next waiting version even after an earlier update became active', async () => {
    const activate = vi.fn(async () => {})
    const reload = vi.fn()
    const controller = createPwaUpdateController({ isBlocked: () => false, activate, reload })
    controller.onActivated() // An update from another tab: this tab stays open.
    controller.onWaiting() // A subsequent release starts waiting.
    await controller.apply()
    expect(activate).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
    controller.onActivated()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not revoke consent when the same waiting worker is announced twice', async () => {
    const worker = {}
    const reload = vi.fn()
    const controller = createPwaUpdateController({ isBlocked: () => false, activate: vi.fn(async () => {}), reload })
    expect(controller.onWaiting(worker)).toBe(true)
    await controller.apply()
    expect(controller.onWaiting(worker)).toBe(false)
    controller.onActivated()
    expect(reload).toHaveBeenCalledOnce()
    // A late notification for the activated worker also cannot create a new update.
    expect(controller.onWaiting(worker)).toBe(false)
  })

  it('ignores the initial SW claim but reloads a later consented update in the same first-visit tab', async () => {
    const container = Object.assign(new EventTarget(), { controller: null as ServiceWorker | null })
    const activate = vi.fn(async () => {})
    const reload = vi.fn()
    const controller = createPwaUpdateController({ isBlocked: () => false, activate, reload })
    const stop = observePwaControllerChanges(container as unknown as ServiceWorkerContainer, controller.onActivated)
    container.controller = { scriptURL: '/sw.js?version=1' } as ServiceWorker
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).not.toHaveBeenCalled()
    controller.onWaiting()
    await controller.apply()
    container.controller = { scriptURL: '/sw.js?version=2' } as ServiceWorker
    container.dispatchEvent(new Event('controllerchange'))
    expect(activate).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledOnce()
    stop()
  })
})
