import { z } from 'zod';
import type { OrderType } from '@/api/types';

const PHONE = /^\+?[0-9\s()-]{7,20}$/;

export const orderInfoSchema = (type: OrderType) =>
  z
    .object({
      guests: z.number().int('Целое число').min(1, 'Минимум 1').max(500, 'Слишком много').nullable(),
      customerName: z.string().trim().max(120, 'Не более 120 символов'),
      customerPhone: z.string().trim().refine((v) => !v || PHONE.test(v), 'Некорректный телефон'),
      deliveryAddress: z.string().trim().max(500, 'Не более 500 символов'),
      deliveryFee: z.number().min(0, 'Не может быть отрицательной').nullable(),
      comment: z.string().trim().max(500, 'Не более 500 символов'),
    })
    .superRefine((data, ctx) => {
      if (type !== 'DELIVERY') return;
      if (!data.customerPhone) ctx.addIssue({ code: 'custom', path: ['customerPhone'], message: 'Укажите телефон клиента' });
      if (data.deliveryAddress.length < 3) ctx.addIssue({ code: 'custom', path: ['deliveryAddress'], message: 'Укажите адрес доставки' });
    });

export type OrderInfoValues = z.infer<ReturnType<typeof orderInfoSchema>>;

export const emptyOrderInfo: OrderInfoValues = {
  guests: null,
  customerName: '',
  customerPhone: '',
  deliveryAddress: '',
  deliveryFee: null,
  comment: '',
};
