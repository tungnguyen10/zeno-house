import { nextSetupStepId, type SetupFlow, type SetupStepId } from '~/utils/building-setup-steps'

export function useBuildingSetupMode(options: { flow: Ref<SetupFlow>, openStep: (id: SetupStepId | null) => void }) {
  const route = useRoute()
  const router = useRouter()
  const active = computed(() => route.query.setup === '1')
  const submitLabel = computed(() => (active.value ? 'Lưu và tiếp' : 'Lưu'))

  function advance(from: SetupStepId) {
    options.openStep(nextSetupStepId(options.flow.value, from))
  }

  // Runs after the settings refresh, so `flow` already reflects the saved step.
  function afterSave(id: SetupStepId) {
    if (active.value) advance(id)
    else options.openStep(null)
  }

  function skip(id: SetupStepId) {
    advance(id)
  }

  async function exit() {
    const { setup: _setup, ...query } = route.query
    await router.replace({ query, hash: '' })
  }

  return { active, submitLabel, afterSave, skip, exit }
}
