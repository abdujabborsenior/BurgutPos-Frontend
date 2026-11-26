import type {
  CashOperationType,
  DishUnit,
  IngredientUnit,
  OrderStatus,
  OrderType,
  PaymentMethodType,
  ShiftStatus,
  StockLocation,
  StockMovementType,
} from '@/api/types';

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  TABLE: 'Стол',
  TAKEAWAY: 'С собой',
  DELIVERY: 'Доставка',
  HALL: 'Зал',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  OPEN: 'Открыт',
  PAID: 'Оплачен',
  CANCELLED: 'Отменён',
  MERGED: 'Объединён',
};

export const DISH_UNIT_LABELS: Record<DishUnit, string> = {
  PCS: 'шт',
  PORTION: 'порц.',
  KG: 'кг',
  L: 'л',
};

export const DISH_UNIT_OPTIONS: { value: DishUnit; label: string }[] = [
  { value: 'PCS', label: 'Штука (шт)' },
  { value: 'PORTION', label: 'Порция (порц.)' },
  { value: 'KG', label: 'Килограмм (кг)' },
  { value: 'L', label: 'Литр (л)' },
];

export const FRACTIONAL_DISH_UNITS: DishUnit[] = ['KG', 'L'];

export const INGREDIENT_UNIT_LABELS: Record<IngredientUnit, string> = {
  KG: 'кг',
  G: 'г',
  L: 'л',
  ML: 'мл',
  PCS: 'шт',
};

export const INGREDIENT_UNIT_OPTIONS: { value: IngredientUnit; label: string }[] = [
  { value: 'KG', label: 'Килограмм (кг)' },
  { value: 'G', label: 'Грамм (г)' },
  { value: 'L', label: 'Литр (л)' },
  { value: 'ML', label: 'Миллилитр (мл)' },
  { value: 'PCS', label: 'Штука (шт)' },
];

export const PAYMENT_TYPE_LABELS: Record<PaymentMethodType, string> = {
  CASH: 'Наличные',
  CARD: 'Банковская карта',
  ONLINE: 'Онлайн-оплата',
  OTHER: 'Другое',
};

export const LOCATION_LABELS: Record<StockLocation, string> = {
  SALE: 'В продаже',
  WAREHOUSE: 'На складе',
};

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  RECEIPT: 'Приход',
  RECEIPT_CANCEL: 'Отмена прихода',
  SALE: 'Продажа',
  SALE_RETURN: 'Возврат',
  TRANSFER: 'Перемещение',
  WRITE_OFF: 'Списание',
  ADJUSTMENT: 'Инвентаризация',
};

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  OPEN: 'Открыта',
  CLOSED: 'Закрыта',
};

export const CASH_OPERATION_LABELS: Record<CashOperationType, string> = {
  IN: 'Внесение',
  OUT: 'Изъятие',
};
