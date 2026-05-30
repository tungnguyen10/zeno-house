import type { H3Event } from 'h3'
import type { AuthUser } from '~/types/auth'
import type { ServiceCatalogItem } from '~/types/service-catalog'
import { ServiceCatalogRepository } from '../../repositories/service-catalog'

export const ServiceCatalogService = {
  async list(event: H3Event, _user: AuthUser): Promise<ServiceCatalogItem[]> {
    if (!can(_user, 'building-services.read')) throwForbidden('Không có quyền xem danh mục dịch vụ')
    return ServiceCatalogRepository.findAll(event)
  },
}
