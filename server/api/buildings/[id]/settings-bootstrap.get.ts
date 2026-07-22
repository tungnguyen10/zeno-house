import { BuildingSettingsBootstrapService } from '../../../services/buildings/settings-bootstrap'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!
  return { data: await BuildingSettingsBootstrapService.get(event, user, id) }
})
