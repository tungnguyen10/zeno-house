import type { H3Event } from 'h3'
import type { Tenant } from '~/types/tenants'
import type { HandoverInventory } from '~/types/inventory'
import { mapContractVehicle } from '~/utils/mappers/contract-vehicles'
import { ContractRepository } from '../../repositories/contracts'
import { ContractOccupantRepository } from '../../repositories/contract-occupants'
import { ContractVehicleRepository } from '../../repositories/contract-vehicles'
import { ContractServiceRepository } from '../../repositories/contract-services'
import { BuildingRepository } from '../../repositories/buildings'
import { RoomRepository } from '../../repositories/rooms'
import { TenantRepository } from '../../repositories/tenants'
import { BuildingInvoiceProfileRepository } from '../../repositories/building-invoice-profiles'
import { BuildingContractProfileService } from '../buildings/contract-profile'
import type { ContractDocumentSources, DocParty, DocService } from './build-data'

function tenantToParty(t: Tenant | null): DocParty {
  return {
    fullName: t?.fullName ?? null,
    dateOfBirth: t?.dateOfBirth ?? null,
    permanentAddress: t?.permanentAddress ?? null,
    idNumber: t?.idNumber ?? null,
    idIssuedDate: t?.idIssuedDate ?? null,
    idIssuedPlace: t?.idIssuedPlace ?? null,
    phone: t?.phone ?? null,
  }
}

function mapInvoiceProfile(row: unknown): ContractDocumentSources['invoiceProfile'] {
  if (!row) return null
  const r = row as Record<string, unknown>
  return {
    bankName: String(r.bank_name ?? ''),
    accountHolder: String(r.account_holder ?? ''),
    accountNumber: String(r.account_number ?? ''),
    transferContentTemplate: String(r.transfer_content_template ?? r.transfer_content ?? ''),
  }
}

function pickBuilding(b: NonNullable<Awaited<ReturnType<typeof BuildingRepository.findById>>>): ContractDocumentSources['building'] {
  return {
    name: b.name,
    address: b.address,
    code: b.code,
    electricityPricingType: b.electricityPricingType,
    defaultElectricityRate: b.defaultElectricityRate,
    waterPricingType: b.waterPricingType,
    defaultWaterRate: b.defaultWaterRate,
    billingGenerationDay: b.billingGenerationDay,
    paymentDueDay: b.paymentDueDay,
    gracePeriodDays: b.gracePeriodDays,
  }
}

function mapServices(list: Awaited<ReturnType<typeof ContractServiceRepository.findByContract>>): DocService[] {
  return list
    .filter(s => s.isEnabled)
    .map(s => ({
      name: s.catalog?.name ?? '',
      pricingType: ((s.catalog as { pricingType?: DocService['pricingType'] })?.pricingType) ?? 'fixed_per_room',
      amount: s.amount,
      notes: s.notes,
    }))
}

/** Builds the full document data source for an existing contract. */
export async function gatherContractSources(event: H3Event, contractId: string, signedDate: string): Promise<ContractDocumentSources> {
  const contract = await ContractRepository.findByIdentifier(event, contractId)
  if (!contract) throwNotFound('Không tìm thấy hợp đồng')

  const [building, lessor, invoiceRow, tenant, occupantRows, vehicleRows, serviceRows, inventory] = await Promise.all([
    BuildingRepository.findById(event, contract.buildingId),
    BuildingContractProfileService.getUnmaskedForServer(event, contract.buildingId),
    BuildingInvoiceProfileRepository.findByBuildingId(event, contract.buildingId),
    TenantRepository.findById(event, contract.tenantId),
    ContractOccupantRepository.listByContract(event, contract.id),
    ContractVehicleRepository.list(event, contract.id),
    ContractServiceRepository.findByContract(event, contract.id),
    ContractRepository.findHandoverInventory(event, contract.id),
  ])
  if (!building) throwNotFound('Không tìm thấy tòa nhà')

  const roommateIds = occupantRows.filter(o => o.role !== 'primary').map(o => o.tenantId)
  const occTenants = roommateIds.length ? await TenantRepository.findByIds(event, roommateIds) : []
  const byId = new Map(occTenants.map(t => [t.id, t]))

  return {
    contract: {
      contractCode: contract.contractCode,
      roomNumber: contract.room?.roomNumber ?? '',
      startDate: contract.startDate,
      endDate: contract.endDate,
      monthlyRent: contract.monthlyRent,
      deposit: contract.deposit,
      occupantCount: contract.occupantCount,
    },
    building: pickBuilding(building),
    lessor,
    invoiceProfile: mapInvoiceProfile(invoiceRow),
    tenant: tenantToParty(tenant),
    occupants: roommateIds.map(id => tenantToParty(byId.get(id) ?? null)),
    vehicles: vehicleRows.map(mapContractVehicle),
    services: mapServices(serviceRows),
    inventory,
    handoverDate: contract.startDate,
    signedDate,
  }
}

/** Builds a minimal source for the pre-contract readiness check (room + tenant + occupants only). */
export async function gatherReadinessSources(
  event: H3Event,
  input: { roomId: string; tenantId: string; occupantTenantIds: string[] },
): Promise<{ buildingId: string; sources: ContractDocumentSources }> {
  const room = await RoomRepository.findByIdentifier(event, input.roomId)
  if (!room) throwNotFound('Không tìm thấy phòng')

  const [building, lessor, invoiceRow, tenant, occTenants] = await Promise.all([
    BuildingRepository.findById(event, room.buildingId),
    BuildingContractProfileService.getUnmaskedForServer(event, room.buildingId),
    BuildingInvoiceProfileRepository.findByBuildingId(event, room.buildingId),
    TenantRepository.findById(event, input.tenantId),
    input.occupantTenantIds.length ? TenantRepository.findByIds(event, input.occupantTenantIds) : Promise.resolve([]),
  ])
  if (!building) throwNotFound('Không tìm thấy tòa nhà')

  const emptyInventory: HandoverInventory = { sourceContractId: null, sourceContractCode: null, items: [] }
  const sources: ContractDocumentSources = {
    contract: {
      contractCode: '', roomNumber: room.roomNumber, startDate: '', endDate: '', monthlyRent: 0, deposit: 0, occupantCount: 0,
    },
    building: pickBuilding(building),
    lessor,
    invoiceProfile: mapInvoiceProfile(invoiceRow),
    tenant: tenantToParty(tenant),
    occupants: occTenants.map(t => tenantToParty(t)),
    vehicles: [],
    services: [],
    inventory: emptyInventory,
    handoverDate: '',
    signedDate: '',
  }
  return { buildingId: room.buildingId, sources }
}
