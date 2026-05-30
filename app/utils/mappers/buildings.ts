import type { Tables } from '~/types/database.types'
import type { Building, BuildingStatus, ElectricityPricingType, WaterPricingType } from '~/types/buildings'

export type BuildingRow = Tables<'buildings'> & { rooms: [{ count: number }] }

export function mapBuilding(row: BuildingRow): Building {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    description: row.description,
    status: row.status as BuildingStatus,
    totalRooms: row.rooms[0]?.count ?? 0,
    ownerName: row.owner_name,
    ownerPhone: row.owner_phone,
    ownerEmail: row.owner_email,
    electricityPricingType: row.electricity_pricing_type as ElectricityPricingType,
    defaultElectricityRate: row.default_electricity_rate,
    waterPricingType: row.water_pricing_type as WaterPricingType,
    defaultWaterRate: row.default_water_rate,
    meterReadingDay: row.meter_reading_day,
    billingGenerationDay: row.billing_generation_day,
    paymentDueDay: row.payment_due_day,
    gracePeriodDays: row.grace_period_days,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
