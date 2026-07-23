import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { BuildingInvoiceEmailSettings } from '~/types/invoice-email'
import { mapBuildingInvoiceEmailSettings } from '~/utils/mappers/invoice-email'
import { BuildingRepository } from '../../repositories/buildings'
import { BuildingInvoiceEmailSettingsRepository } from '../../repositories/building-invoice-email-settings'
import { assertBuildingScope } from '../../utils/scope'

async function requireBuilding(event: H3Event, identifier: string) {
  const building = await BuildingRepository.findByIdentifier(event, identifier)
  if (!building) throwNotFound('Không tìm thấy toà nhà')
  return building
}

export const BuildingInvoiceEmailSettingsService = {
  async get(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
  ): Promise<BuildingInvoiceEmailSettings> {
    if (!can(user, 'invoice-email-settings.read')) {
      throwForbidden('Không có quyền xem cấu hình gửi hoá đơn')
    }
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'read')
    const row = await BuildingInvoiceEmailSettingsRepository.findByBuildingId(event, building.id)
    return mapBuildingInvoiceEmailSettings(
      building.id,
      row,
      useRuntimeConfig(event).public.invoiceEmailEnabled === true,
    )
  },

  async update(
    event: H3Event,
    user: AuthUser,
    buildingIdentifier: string,
    autoSendEnabled: boolean,
  ): Promise<BuildingInvoiceEmailSettings> {
    if (!can(user, 'invoice-email-settings.write')) {
      throwForbidden('Không có quyền cập nhật cấu hình gửi hoá đơn')
    }
    const building = await requireBuilding(event, buildingIdentifier)
    await assertBuildingScope(event, user, building.id, 'write')
    const enabledGlobally = useRuntimeConfig(event).public.invoiceEmailEnabled === true
    if (autoSendEnabled && !enabledGlobally) {
      throwConflict('Chức năng gửi hoá đơn qua email chưa được bật trên hệ thống')
    }
    if (!user.id) throwForbidden('Không xác định được người cập nhật')

    return mapBuildingInvoiceEmailSettings(
      building.id,
      await BuildingInvoiceEmailSettingsRepository.save(event, {
        buildingId: building.id,
        autoSendEnabled,
        updatedBy: user.id,
      }),
      enabledGlobally,
    )
  },
}
